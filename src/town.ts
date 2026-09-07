import { TOWN_HALF_SIZE, TOWN_WALL_HEIGHT, TOWN_WALL_THICKNESS, TOWN_GATE_WIDTH, TOWN_GATE_HEIGHT, TOWN_CLEARANCE, CHURCH_TOWER_HEIGHT, TOWN_STAIR_WIDTH, TOWN_STAIR_STEPS, TOWN_STAIR_TREAD, TOWN_STAIR_START_Z, TOWN_STAIR_LANDING_Z, TOWN_ROAD_WIDTH, TOWN_APPROACH_LENGTH } from './config.js';

export interface TownBuilding {
    kind: 'house' | 'church';
    x: number;
    z: number;
    width: number;
    depth: number;
    height: number;
    palette: number;
    doorSide: -1 | 1;
    doorAxis: 'x' | 'z';
}

/** Building centers are clear of furniture; face the open doorway on arrival. */
export function getTownSpawn(seed: number, kind: 'house' | 'church', houseSlot = 0) {
    const buildings = generateTownLayout(seed).filter(building => building.kind === kind);
    const building = buildings[kind === 'church' ? 0 : houseSlot];
    if (!building) throw new RangeError('Invalid town spawn house slot');
    const yaw = building.doorAxis === 'x'
        ? building.doorSide * Math.PI / 2
        : building.doorSide === 1 ? 0 : Math.PI;
    return { x: building.x, z: building.z, yaw };
}

/** A separate random stream keeps architecture independent of texture/detail changes. */
export function generateTownLayout(seed: number): TownBuilding[] {
    let randomState = (seed >>> 0) ^ 0x746f776e;
    const random = () => {
        let value = (randomState += 0x6d2b79f5);
        value = Math.imul(value ^ (value >>> 15), value | 1);
        value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
        return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
    };
    const buildings: TownBuilding[] = [];
    // Two plots per quadrant guarantee open cardinal streets and a spawn plaza.
    // Jitter, footprint, height and a quarter-turn create different arrangements.
    const rotate = random() < 0.5;
    for (const sx of [-1, 1] as const) {
        for (const sz of [-1, 1] as const) {
            for (const distance of [30, 61]) {
                const x = sx * (distance + (random() - 0.5) * 5);
                const z = sz * (40 + (random() - 0.5) * 24);
                const width = 15 + random() * 6;
                const depth = 20 + random() * 10;
                buildings.push({
                    kind: 'house',
                    x: rotate ? z : x, z: rotate ? x : z,
                    width: rotate ? depth : width, depth: rotate ? width : depth,
                    height: 9 + Math.floor(random() * 8),
                    palette: Math.floor(random() * 3),
                    doorSide: sz,
                    doorAxis: rotate ? 'x' : 'z',
                });
            }
        }
    }
    // Dedicate one of the guaranteed clear plots to the church on every seed.
    // Its position varies without adding a ninth footprint across a street.
    const church = buildings[Math.floor(random() * buildings.length)];
    church.kind = 'church';
    church.height = 18;
    church.palette = 0;
    return buildings;
}

/** Reserve the whole town plus an approach apron, including each prop's extent. */
export function overlapsTown(x: number, z: number, radius: number): boolean {
    const edge = TOWN_HALF_SIZE + TOWN_WALL_THICKNESS / 2 + TOWN_CLEARANCE;
    return Math.abs(x) < edge + radius && Math.abs(z) < edge + radius;
}

export type TownMaterial = 'stone' | 'trim' | 'roof' | 'door' | 'window' | 'road' | 'plaza' | 'plaster0' | 'plaster1' | 'plaster2' | 'water';
export interface TownBox {
    x: number; y: number; z: number;
    width: number; height: number; depth: number;
    material: TownMaterial;
    solid: boolean;
    kind: 'wall' | 'tower' | 'building' | 'church-tower' | 'walkway' | 'stair' | 'lookout-post' | 'lookout-roof' | 'well' | 'detail' | 'paving';
}

/** Outline shared by the paving union and the hole in the grass mesh. */
export function getTownPavingOutline(): Array<[number, number]> {
    const edge = TOWN_HALF_SIZE - TOWN_WALL_THICKNESS / 2;
    const road = TOWN_ROAD_WIDTH / 2;
    const approach = TOWN_HALF_SIZE + TOWN_APPROACH_LENGTH;
    return [
        [-edge, -edge], [-road, -edge], [-road, -approach], [road, -approach],
        [road, -edge], [edge, -edge], [edge, -road], [approach, -road],
        [approach, road], [edge, road], [edge, edge], [road, edge],
        [road, approach], [-road, approach], [-road, edge], [-edge, edge],
        [-edge, road], [-approach, road], [-approach, -road], [-edge, -road],
    ];
}

/** Partition paving instead of stacking nearly coplanar street/path decals. */
export function createTownPaving(buildings: TownBuilding[]): TownBox[] {
    interface Rect { left: number; right: number; near: number; far: number; material: 'plaza' | 'road' }
    const inner = TOWN_HALF_SIZE - TOWN_WALL_THICKNESS / 2;
    let tiles: Rect[] = [{ left: -inner, right: inner, near: -inner, far: inner, material: 'plaza' }];
    const pave = (x: number, z: number, width: number, depth: number) => {
        const patch: Rect = { left: x - width / 2, right: x + width / 2, near: z - depth / 2, far: z + depth / 2, material: 'road' };
        const next: Rect[] = [];
        for (const tile of tiles) {
            const left = Math.max(tile.left, patch.left), right = Math.min(tile.right, patch.right);
            const near = Math.max(tile.near, patch.near), far = Math.min(tile.far, patch.far);
            if (left >= right || near >= far) { next.push(tile); continue; }
            if (tile.left < left) next.push({ ...tile, right: left });
            if (right < tile.right) next.push({ ...tile, left: right });
            if (tile.near < near) next.push({ ...tile, left, right, far: near });
            if (far < tile.far) next.push({ ...tile, left, right, near: far });
        }
        next.push(patch);
        tiles = next;
    };
    const approach = (TOWN_HALF_SIZE + TOWN_APPROACH_LENGTH) * 2;
    pave(0, 0, TOWN_ROAD_WIDTH, approach);
    pave(0, 0, approach, TOWN_ROAD_WIDTH);
    pave(0, 0, 32, 32);
    for (const b of buildings) {
        pave(b.x, b.z, b.width - 1.4, b.depth - 1.4);
        const along = b.doorAxis === 'x' ? b.x : b.z;
        const depth = b.doorAxis === 'x' ? b.width : b.depth;
        const door = along - b.doorSide * depth / 2;
        if (b.doorAxis === 'x') pave(door / 2, b.z, Math.abs(door), 3.2);
        else pave(b.x, door / 2, 3.2, Math.abs(door));
    }
    return tiles.map(tile => ({
        x: (tile.left + tile.right) / 2, y: -0.025, z: (tile.near + tile.far) / 2,
        width: tile.right - tile.left, height: 0.05, depth: tile.far - tile.near,
        material: tile.material, solid: false, kind: 'paving',
    }));
}

/** Axis-aligned boxes share the same bounds for movement, bullets and grapples. */
export function createTownBoxes(buildings: TownBuilding[]): TownBox[] {
    const boxes: TownBox[] = [];
    const box = (x: number, y: number, z: number, width: number, height: number, depth: number,
        material: TownMaterial, solid = false, kind: TownBox['kind'] = 'detail') => {
        boxes.push({ x, y, z, width, height, depth, material, solid, kind });
    };
    const solid = (x: number, z: number, w: number, h: number, d: number, material: TownMaterial, kind: TownBox['kind']) => {
        box(x, h / 2, z, w, h, d, material, true, kind);
    };
    const half = TOWN_HALF_SIZE;
    const gate = TOWN_GATE_WIDTH / 2;
    const thick = TOWN_WALL_THICKNESS;
    const height = TOWN_WALL_HEIGHT;
    const inner = half - thick / 2;
    const deckThickness = 0.35;
    const bodyTop = height - deckThickness;
    const length = inner - gate;
    const center = (inner + gate) / 2;

    for (const side of [-1, 1]) {
        // Keep ground-level gateways, with a continuous paved deck above them.
        const lintelHeight = bodyTop - TOWN_GATE_HEIGHT;
        const lintelY = TOWN_GATE_HEIGHT + lintelHeight / 2;
        box(0, lintelY, side * half, TOWN_GATE_WIDTH, lintelHeight, thick, 'stone', true, 'wall');
        box(side * half, lintelY, 0, thick, lintelHeight, TOWN_GATE_WIDTH, 'stone', true, 'wall');
        for (const end of [-1, 1]) {
            solid(end * center, side * half, length, bodyTop, thick, 'stone', 'wall');
            solid(side * half, end * center, thick, bodyTop, length, 'stone', 'wall');
        }
        box(0, height - deckThickness / 2, side * half, inner * 2, deckThickness, thick, 'trim', true, 'walkway');
        box(side * half, height - deckThickness / 2, 0, thick, deckThickness, inner * 2, 'trim', true, 'walkway');
        // Crenellations only occupy the outer edge, leaving the central path open.
        const outerEdge = side * (half + thick / 2 - 0.6);
        box(0, height + 0.5, outerEdge, inner * 2, 1, 1.2, 'stone', true, 'wall');
        box(outerEdge, height + 0.5, 0, 1.2, 1, inner * 2, 'stone', true, 'wall');
        for (let t = -inner + 3; t < inner; t += 6) {
            box(t, height + 1.75, outerEdge, 2.5, 1.5, 1.2, 'stone', true, 'wall');
            box(outerEdge, height + 1.75, t, 1.2, 1.5, 2.5, 'stone', true, 'wall');
        }
        // The straight ascent enters through the west inner curb, away from gates.
        const innerEdge = side * (inner + 0.3);
        box(0, height + 0.5, innerEdge, inner * 2, 1, 0.6, 'stone', true, 'wall');
        const intervals = side === -1
            ? [[-inner, TOWN_STAIR_LANDING_Z - 4], [TOWN_STAIR_LANDING_Z + 4, inner]]
            : [[-inner, inner]];
        for (const [from, to] of intervals) {
            box(innerEdge, height + 0.5, (from + to) / 2, 0.6, 1, to - from, 'stone', true, 'wall');
        }
    }

    // The corner foundations meet the wall ends without intersecting faces.
    // Low parapets continue around the exposed edges; both walkway entries stay open.
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
        const x = sx * half, z = sz * half;
        solid(x, z, thick, bodyTop, thick, 'stone', 'tower');
        box(x, height - deckThickness / 2, z, thick, deckThickness, thick, 'trim', true, 'walkway');
        const parapetThickness = 1.2;
        box(x, height + 0.5, sz * (half + thick / 2 - parapetThickness / 2),
            thick, 1, parapetThickness, 'stone', true, 'wall');
        // Shorten one leg so the two stone sections meet without overlapping faces.
        box(sx * (half + thick / 2 - parapetThickness / 2), height + 0.5, z - sz * parapetThickness / 2,
            parapetThickness, 1, thick - parapetThickness, 'stone', true, 'wall');
        for (const px of [-1, 1]) for (const pz of [-1, 1]) {
            const base = px === sx || pz === sz ? 1 : 0;
            box(x + px * (thick / 2 - 0.7), height + base + (7 - base) / 2, z + pz * (thick / 2 - 0.7),
                1, 7 - base, 1, 'door', true, 'lookout-post');
        }
        for (let tier = 0; tier < 4; tier++) {
            const size = thick + 2 - tier * 2.5;
            box(x, height + 7 + tier * 0.45 + 0.225, z, size, 0.45, size, 'roof', true, 'lookout-roof');
        }
    }

    // A compact, straight ascent uses near-maximum risers and the shortest
    // tread that keeps normal walking smooth. It stays south of the west gate.
    const steps = TOWN_STAIR_STEPS;
    const rise = height / steps;
    const tread = TOWN_STAIR_TREAD;
    const width = TOWN_STAIR_WIDTH;
    for (let step = 0; step < steps; step++) {
        const top = (step + 1) * rise;
        const z = TOWN_STAIR_START_Z - (step + 0.5) * tread;
        // Ground-based steps make one stone support rather than floating treads.
        solid(-80, z, width, top, tread, 'trim', 'stair');
        if (step % 2 === 0) for (const side of [-1, 1]) {
            box(-80 + side * (width / 2 - 0.15), top + 1.1, z - tread / 2,
                0.2, 0.2, tread * 2, 'door', true, 'stair');
            if (step % 8 === 0) box(-80 + side * (width / 2 - 0.15), top + 0.5, z, 0.2, 1, 0.12, 'door', true, 'stair');
        }
    }
    // One level turn at the top leads directly onto the west wall walk.
    solid(-80, TOWN_STAIR_LANDING_Z, width, height, width, 'trim', 'stair');
    box(-84, height - 0.15, TOWN_STAIR_LANDING_Z, 2, 0.3, width, 'trim', true, 'stair');

    // The well is deliberately independent of the building layout and random seed.
    for (const side of [-1, 1]) {
        solid(side * 2.25, 0, 0.5, 1.5, 4, 'stone', 'well');
        solid(0, side * 1.75, 4, 1.5, 0.5, 'stone', 'well');
    }
    solid(0, 0, 4, 0.2, 3, 'stone', 'well');
    box(0, 0.85, 0, 4, 0.05, 3, 'water', false, 'well');
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
        box(sx * 2.25, 3, sz * 1.75, 0.35, 3, 0.35, 'door', true, 'well');
    }
    for (let tier = 0; tier < 4; tier++) {
        box(0, 4.5 + tier * 0.3 + 0.15, 0, 7 - tier * 1.5, 0.3, 6, 'door', true, 'well');
    }

    for (const building of buildings) {
        const { x, z, height: h, doorSide, doorAxis } = building;
        const w = doorAxis === 'x' ? building.depth : building.width;
        const d = doorAxis === 'x' ? building.width : building.depth;
        const part = (px: number, py: number, pz: number, pw: number, ph: number, pd: number,
            material: TownMaterial, collides = false, kind: TownBox['kind'] = 'detail') => {
            box(x + (doorAxis === 'x' ? pz : px), py, z + (doorAxis === 'x' ? px : pz),
                doorAxis === 'x' ? pd : pw, ph, doorAxis === 'x' ? pw : pd, material, collides, kind);
        };
        const isChurch = building.kind === 'church';
        const plaster: TownMaterial = isChurch ? 'trim' : `plaster${building.palette}` as TownMaterial;
        const thickness = 0.7;
        const doorway = 4.8;
        const doorHeight = 4.8;
        const wallTop = h - 0.7;
        const insideWidth = w - thickness * 2;
        // Four walls, an open doorway and a solid roof. All collider bounds match
        // their visible geometry, including the elevated lintel and ceiling.
        for (const side of [-1, 1]) {
            part(side * (w / 2 - thickness / 2), wallTop / 2, 0, thickness, wallTop, d, plaster, true, 'building');
        }
        part(0, wallTop / 2, doorSide * (d / 2 - thickness / 2), insideWidth, wallTop, thickness, plaster, true, 'building');
        const front = -doorSide * (d / 2 - thickness / 2);
        for (const side of [-1, 1]) {
            part(side * (insideWidth + doorway) / 4, wallTop / 2, front, (insideWidth - doorway) / 2, wallTop, thickness, plaster, true, 'building');
        }
        part(0, (wallTop + doorHeight) / 2, front, doorway, wallTop - doorHeight, thickness, plaster, true, 'building');
        part(0, h - 0.35, 0, w + 0.5, 0.7, d + 0.5, 'roof', true, 'building');
        // Frames on side/back walls read as shuttered windows inside and outside.
        for (const side of [-1, 1]) {
            for (const offset of [-d * 0.28, d * 0.28]) {
                part(side * (w / 2 + 0.025), h * 0.64, offset, 0.05, 3, 2.5, 'trim');
                part(side * (w / 2 + 0.055), h * 0.64, offset, 0.03, 2.4, 1.8, 'window');
            }
            part(side * w * 0.29, h * 0.64, doorSide * (d / 2 + 0.025), 2.5, 3, 0.05, 'trim');
            part(side * w * 0.29, h * 0.64, doorSide * (d / 2 + 0.06), 1.8, 2.4, 0.03, 'window');
        }
        // Door surround stays outside the opening, with no invisible threshold.
        for (const side of [-1, 1]) {
            part(side * (doorway / 2 + 0.2), doorHeight / 2, -doorSide * (d / 2 + 0.03), 0.4, doorHeight, 0.06, 'trim');
        }
        part(0, doorHeight + 0.25, -doorSide * (d / 2 + 0.03), doorway + 0.8, 0.5, 0.06, 'trim');
        if (isChurch) {
            // Shallow stepped gables preserve exact box-based rooftop collision.
            // Each narrower tier rests on the preceding tier, with no hollow gaps.
            for (let tier = 0; tier < 8; tier++) {
                part(0, h + tier * 0.45 + 0.225, 0, w * (1 - tier / 8), 0.45, d, 'roof', true, 'building');
            }
            const towerZ = -doorSide * (d / 2 - 4.2);
            const towerBase = h;
            const towerTop = CHURCH_TOWER_HEIGHT - 5;
            part(0, (towerBase + towerTop) / 2, towerZ, 7, towerTop - towerBase, 7, 'trim', true, 'church-tower');
            // Dark bell openings on all four faces make the tower legible at range.
            for (const side of [-1, 1]) {
                part(side * 3.525, towerTop - 2.5, towerZ, 0.05, 3.5, 2.3, 'window');
                part(0, towerTop - 2.5, towerZ + side * 3.525, 2.3, 3.5, 0.05, 'window');
            }
            for (let tier = 0; tier < 4; tier++) {
                part(0, towerTop + tier * 0.5 + 0.25, towerZ, 7 - tier * 1.5, 0.5, 7 - tier * 1.5, 'roof', true, 'church-tower');
            }
            // The cross is included in the tower's total height: 80% of the wall height.
            part(0, CHURCH_TOWER_HEIGHT - 1.5, towerZ, 0.6, 3, 0.6, 'trim', true, 'church-tower');
            part(0, CHURCH_TOWER_HEIGHT - 1, towerZ, 2.6, 0.5, 0.6, 'trim', true, 'church-tower');
            // Front cross, paired tall windows, pews and a simple altar.
            const face = -doorSide * (d / 2 + 0.06);
            part(0, 11, face, 0.6, 4, 0.08, 'door');
            part(0, 12, face, 2.6, 0.6, 0.08, 'door');
            for (const side of [-1, 1]) {
                part(side * w * 0.31, 10.5, face, 1.4, 6, 0.08, 'window');
                for (const row of [-d * 0.2, 0, d * 0.2]) {
                    part(side * w * 0.28, 0.55, row, w * 0.25, 1.1, 1.2, 'door', true);
                    part(side * w * 0.28, 1.1, row - doorSide * 0.5, w * 0.25, 1.1, 0.2, 'door', true);
                }
            }
            part(0, 0.7, doorSide * (d / 2 - 2.5), 4, 1.4, 1.5, 'stone', true);
            const altarWall = doorSide * (d / 2 - thickness - 0.04);
            part(0, 6, altarWall, 0.6, 4, 0.08, 'door');
            part(0, 7, altarWall, 2.6, 0.6, 0.08, 'door');
        } else {
            part(-w / 2 + 2.5, 0.9, doorSide * (d / 2 - 2.5), 2.5, 1.8, 2.5, 'door', true);
            part(w / 2 - 2, 0.55, doorSide * (d / 2 - 3.5), 1.5, 1.1, 4, 'door', true);
        }
    }
    boxes.push(...createTownPaving(buildings));
    return boxes;
}
