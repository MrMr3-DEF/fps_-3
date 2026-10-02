import { MAP_HALF_SIZE, MECHA_HEIGHT, TOWN_HALF_SIZE, TOWN_WALL_THICKNESS } from './config.js';

export interface NavigationBox { x: number; z: number; halfW: number; halfD: number; bottom: number; top: number }
export interface NavigationPoint { x: number; z: number }
export interface MechaRoute { points: NavigationPoint[]; heading: number }

/** One reverse search per match serves every border spawn candidate. Cells
 * reserve the whole robot footprint; exact segment checks protect smoothing
 * without inflating hazards so far that real passages disappear from the grid. */
export class MechaNavigation {
    readonly cellSize = 4;
    readonly size: number;
    readonly limit: number;
    private readonly blocked: Uint8Array;
    private readonly next: Int32Array;
    private readonly goalHeading = new Map<number, number>();
    private readonly boxes: NavigationBox[];
    private readonly solidBoxes: NavigationBox[];
    private readonly radius: number;

    constructor(obstacles: readonly NavigationBox[], lava: readonly NavigationBox[], radius: number, punchReach: number, halfSize = MAP_HALF_SIZE) {
        this.limit = Math.floor((halfSize - radius - 4) / this.cellSize) * this.cellSize;
        this.size = Math.round(this.limit * 2 / this.cellSize) + 1;
        this.blocked = new Uint8Array(this.size * this.size);
        this.next = new Int32Array(this.blocked.length).fill(-1);
        this.radius = radius;
        this.boxes = [...obstacles, ...lava].filter(box => box.bottom < MECHA_HEIGHT && box.top > 0);
        this.solidBoxes = obstacles.filter(box => box.bottom < MECHA_HEIGHT && box.top > 0);
        const clearance = radius;
        for (const box of this.boxes) {
            const minX = Math.max(0, Math.ceil((box.x - box.halfW - clearance + this.limit) / this.cellSize));
            const maxX = Math.min(this.size - 1, Math.floor((box.x + box.halfW + clearance + this.limit) / this.cellSize));
            const minZ = Math.max(0, Math.ceil((box.z - box.halfD - clearance + this.limit) / this.cellSize));
            const maxZ = Math.min(this.size - 1, Math.floor((box.z + box.halfD + clearance + this.limit) / this.cellSize));
            for (let z = minZ; z <= maxZ; z++) for (let x = minX; x <= maxX; x++) {
                this.blocked[z * this.size + x] = 1;
            }
        }
        const wall = TOWN_HALF_SIZE + TOWN_WALL_THICKNESS / 2;
        // Navigation ends before the clearance envelope reaches the wall. The
        // final, checked approach is straight toward an intact wall section.
        const approach = Math.ceil((wall + clearance + 8) / this.cellSize) * this.cellSize;
        this.punchDistance = wall + punchReach;
        const queue = new Int32Array(this.blocked.length);
        let tail = 0;
        for (const offset of [-56, -40, 40, 56]) {
            for (const [x, z, yaw] of [[approach, offset, -Math.PI / 2], [-approach, offset, Math.PI / 2], [offset, approach, Math.PI], [offset, -approach, 0]]) {
                const index = this.index(x, z);
                if (index < 0 || this.blocked[index]) continue;
                const end = { x: Math.abs(Math.sin(yaw)) > 0.5 ? -Math.sin(yaw) * this.punchDistance : x,
                    z: Math.abs(Math.cos(yaw)) > 0.5 ? -Math.cos(yaw) * this.punchDistance : z };
                let safe = true;
                // The last approach enters cells conservatively reserved for
                // the wall, so check the true footprint against actual bounds.
                for (let step = 0; step <= 32 && safe; step++) {
                    const px = x + (end.x - x) * step / 32, pz = z + (end.z - z) * step / 32;
                    safe = !this.boxes.some(box =>
                        Math.abs(px - box.x) < box.halfW + radius && Math.abs(pz - box.z) < box.halfD + radius);
                }
                if (!safe) continue;
                this.next[index] = index;
                this.goalHeading.set(index, yaw);
                queue[tail++] = index;
            }
        }
        let head = 0;
        while (head < tail) {
            const index = queue[head++];
            const x = index % this.size, z = Math.floor(index / this.size);
            for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) {
                if ((!dx && !dz) || x + dx < 0 || z + dz < 0 || x + dx >= this.size || z + dz >= this.size) continue;
                const neighbor = (z + dz) * this.size + x + dx;
                if (this.blocked[neighbor] || this.next[neighbor] !== -1) continue;
                if (dx && dz && (this.blocked[z * this.size + x + dx] || this.blocked[(z + dz) * this.size + x])) continue;
                this.next[neighbor] = index;
                queue[tail++] = neighbor;
            }
        }
    }

    private readonly punchDistance: number;
    private index(x: number, z: number): number {
        const ix = Math.round((x + this.limit) / this.cellSize), iz = Math.round((z + this.limit) / this.cellSize);
        return ix < 0 || iz < 0 || ix >= this.size || iz >= this.size ? -1 : iz * this.size + ix;
    }
    private point(index: number): NavigationPoint {
        return { x: index % this.size * this.cellSize - this.limit, z: Math.floor(index / this.size) * this.cellSize - this.limit };
    }
    isClear(x: number, z: number): boolean {
        const index = this.index(x, z);
        return index >= 0 && !this.blocked[index];
    }
    segmentClear(a: NavigationPoint, b: NavigationPoint, allowLava = false): boolean {
        if (Math.max(Math.abs(a.x), Math.abs(a.z), Math.abs(b.x), Math.abs(b.z)) > this.limit) return false;
        for (const box of allowLava ? this.solidBoxes : this.boxes) {
            let enter = 0, exit = 1;
            for (const axis of ['x', 'z'] as const) {
                const half = (axis === 'x' ? box.halfW : box.halfD) + this.radius;
                const min = box[axis] - half, max = box[axis] + half, delta = b[axis] - a[axis];
                if (Math.abs(delta) < 1e-9) { if (a[axis] < min || a[axis] > max) { enter = 2; break; } }
                else {
                    const start = (min - a[axis]) / delta, end = (max - a[axis]) / delta;
                    enter = Math.max(enter, Math.min(start, end)); exit = Math.min(exit, Math.max(start, end));
                }
            }
            if (enter <= exit) return false;
        }
        return true;
    }
    routeFrom(start: NavigationPoint): MechaRoute | null {
        let index = this.index(start.x, start.z);
        if (index < 0 || this.next[index] < 0) return null;
        const raw = [this.point(index)];
        while (this.next[index] !== index) { index = this.next[index]; raw.push(this.point(index)); }
        const heading = this.goalHeading.get(index)!;
        const points = [raw[0]];
        let anchor = 0;
        while (anchor < raw.length - 1) {
            let end = anchor + 1;
            while (end + 1 < raw.length && this.segmentClear(raw[anchor], raw[end + 1])) end++;
            points.push(raw[end]);
            anchor = end;
        }
        const goal = points[points.length - 1];
        points.push({ x: Math.abs(Math.sin(heading)) > 0.5 ? -Math.sin(heading) * this.punchDistance : goal.x,
            z: Math.abs(Math.cos(heading)) > 0.5 ? -Math.cos(heading) * this.punchDistance : goal.z });
        return { points, heading };
    }
    borderSpawn(seed: number): MechaRoute {
        // A separate seed stream never consumes procedural-world randomness.
        let random = seed >>> 0;
        const border: NavigationPoint[] = [];
        for (let i = 0; i < this.size; i++) {
            const offset = i * this.cellSize - this.limit;
            border.push({ x: -this.limit, z: offset }, { x: this.limit, z: offset }, { x: offset, z: -this.limit }, { x: offset, z: this.limit });
        }
        for (let i = border.length - 1; i > 0; i--) {
            random = (Math.imul(random, 1664525) + 1013904223) >>> 0;
            const j = random % (i + 1);
            [border[i], border[j]] = [border[j], border[i]];
        }
        for (const point of border) { const route = this.routeFrom(point); if (route) return route; }
        throw new Error('No reachable border spawn for Forgotten Mecha');
    }
}
