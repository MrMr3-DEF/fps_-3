import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { getTownSpawn, generateTownLayout, createTownBoxes, createTownPaving, overlapsTown } from '../src/town.ts';
import { TOWN_HALF_SIZE, TOWN_GATE_WIDTH, TOWN_GATE_HEIGHT, TOWN_WALL_HEIGHT, CHURCH_TOWER_HEIGHT, TOWN_WALL_THICKNESS, TOWN_ROAD_WIDTH, TOWN_APPROACH_LENGTH, PLAYER_RADIUS, PLAYER_HEIGHT, MAX_PLAYERS, PLAYER_STEP_HEIGHT, TOWN_STAIR_WIDTH, TOWN_STAIR_X, TOWN_STAIR_STEPS, TOWN_STAIR_TREAD, TOWN_STAIR_START_Z, TOWN_STAIR_LANDING_Z, LAVA_POOL_HALF_SIZE, PILLAR_COUNT } from '../src/config.ts';
import { state } from '../src/state.ts';
import { resetPlayerAtTownSpawn } from '../src/playerSpawn.ts';
import { rebuildEnvironmentWithSeed, disposeWorld, getWorldSeed, updateEnvironmentVisibility, updateLavaLights, updateTownLanterns, queryObstaclesAlongSegment, queryGrappleSurfacesAlongSegment, respawnTarget } from '../src/world.ts';
import { updatePlayerPhysics } from '../src/physics.ts';
import { updateProjectiles, resetProjectiles } from '../src/projectiles.ts';
import { disposeParticles } from '../src/particles.ts';

// Canvas drawing is cosmetic; run the real world generation and spatial indexes.
const context = new Proxy({}, { get: () => () => {} });
(globalThis as any).document = { getElementById: () => null, createElement: () => ({ getContext: () => context }) };

function occupied(x: number, y: number, z: number, boxes: ReturnType<typeof createTownBoxes>, radius = PLAYER_RADIUS) {
    return boxes.some(b => b.solid && Math.abs(x - b.x) < b.width / 2 + radius &&
        Math.abs(z - b.z) < b.depth / 2 + radius && y > b.y - b.height / 2 && y - PLAYER_HEIGHT < b.y + b.height / 2);
}

test('1,000 seeds produce repeatable, varied, separated buildings and accessible streets/interiors', () => {
    const signatures = new Set<string>();
    const churchPositions = new Set<string>();
    for (let seed = 0; seed < 1000; seed++) {
        const buildings = generateTownLayout(seed);
        assert.deepEqual(buildings, generateTownLayout(seed));
        signatures.add(JSON.stringify(buildings));
        assert.equal(buildings.length, 8);
        const churches = buildings.filter(b => b.kind === 'church');
        assert.equal(churches.length, 1, `guaranteed church seed ${seed}`);
        churchPositions.add(`${churches[0].x},${churches[0].z}`);
        const boxes = createTownBoxes(buildings);
        const tower = boxes.filter(b => b.kind === 'church-tower');
        assert.ok(tower.length > 0);
        assert.equal(Math.max(...tower.map(b => b.y + b.height / 2)), CHURCH_TOWER_HEIGHT);
        assert.equal(CHURCH_TOWER_HEIGHT, TOWN_WALL_HEIGHT * 0.8);
        for (let i = 0; i < buildings.length; i++) {
            const a = buildings[i];
            assert.ok(Math.abs(a.x) + a.width / 2 < TOWN_HALF_SIZE - 8);
            assert.ok(Math.abs(a.z) + a.depth / 2 < TOWN_HALF_SIZE - 8);
            assert.equal(occupied(a.x, 2, a.z, boxes), false, `interior seed ${seed}`);
            for (const b of buildings.slice(i + 1)) {
                assert.ok(Math.abs(a.x - b.x) > (a.width + b.width) / 2 + 4 ||
                    Math.abs(a.z - b.z) > (a.depth + b.depth) / 2 + 4, `alley seed ${seed}`);
            }
            // Walk the complete path from the cardinal street through the doorway.
            const coordinate = a.doorAxis === 'x' ? a.x : a.z;
            for (let step = 0; step <= Math.abs(coordinate); step += 0.5) {
                const value = step * Math.sign(coordinate);
                assert.equal(occupied(a.doorAxis === 'x' ? value : a.x, 2, a.doorAxis === 'z' ? value : a.z, boxes), false, `door path seed ${seed}`);
            }
        }
        // Test the full street width up to and beyond all four gateways.
        for (let distance = -110; distance <= 110; distance += 2) {
            for (const offset of [-5, 0, 5]) {
                if (offset === 0 && Math.abs(distance) <= 5) continue; // Walk around the central well.
                assert.equal(occupied(distance, 2, offset, boxes), false);
                assert.equal(occupied(offset, 2, distance, boxes), false);
            }
        }
        // Walls enclose all four sides except for deliberate gateways.
        for (let distance = -90; distance <= 90; distance++) {
            if (Math.abs(distance) < TOWN_GATE_WIDTH / 2) continue;
            for (const side of [-1, 1]) {
                assert.equal(occupied(distance, 15, side * 90, boxes), true);
                assert.equal(occupied(side * 90, 15, distance, boxes), true);
            }
        }
    }
    assert.equal(signatures.size, 1000);
    assert.equal(churchPositions.size, 1000);
    assert.deepEqual(generateTownLayout(-1), generateTownLayout(0xffffffff));
});

function setup(seed = 42) {
    if (state.scene) disposeWorld();
    state.scene = new THREE.Scene();
    state.camera = new THREE.PerspectiveCamera();
    state.controls = { isLocked: true, getObject: () => state.camera } as any;
    state.isMultiplayer = false;
    rebuildEnvironmentWithSeed(seed);
    state.scene.updateMatrixWorld(true);
}
function snapshot() {
    return {
        obstacles: state.obstacles.map(o => [o.name, ...o.position.toArray(), ...o.scale.toArray()]),
        lava: state.lavaPools.map(o => o.position.toArray()),
        targets: state.targets.map(o => [o.position.toArray(), o.userData.scale]),
    };
}

test('real world respects explicit seeds, reserves the town, synchronizes geometry and disposes every rebuild', () => {
    for (const seed of [0, 1, 42, 0xffffffff]) {
        setup(seed);
        assert.equal(getWorldSeed(), seed);
        assert.equal(state.obstacles.filter(o => !o.name.startsWith('town-')).length, PILLAR_COUNT);
        for (const o of state.obstacles.filter(o => !o.name.startsWith('town-'))) {
            assert.equal(overlapsTown(o.position.x, o.position.z, o.userData.halfW), false);
        }
        for (const lava of state.lavaPools) assert.equal(overlapsTown(lava.position.x, lava.position.z, LAVA_POOL_HALF_SIZE), false);
        const original = snapshot();
        state.isMultiplayer = true;
        rebuildEnvironmentWithSeed(seed);
        assert.deepEqual(snapshot(), original);
        const colliders = [...state.obstacles];
        disposeWorld();
        assert.equal(state.scene!.children.length, 0);
        assert.equal(state.obstacles.length, 0);
        assert.equal(queryObstaclesAlongSegment(-200, 0, 200, 0).length, 0);
        for (const collider of colliders) assert.equal(collider.parent, null);
    }
});

test('lava illumination follows the nearest pool with one reusable light', () => {
    setup();
    const lava = state.lavaPools[0];
    updateLavaLights(1, lava.position, 1);
    const group = state.scene!.getObjectByName('lava-lights')!;
    const lights = group.children.filter(child => (child as THREE.PointLight).isPointLight) as THREE.PointLight[];
    assert.equal(lights.length, 1);
    assert.ok(lights.some(light => light.visible && light.intensity > 0));
    assert.equal(lights.filter(light => light.visible).length, 1);

    updateLavaLights(2, new THREE.Vector3(0, 2, 0), 1);
    assert.ok(lights.every(light => !light.visible), 'town remains free of wilderness lava lights');
    disposeWorld();
});

test('all town lanterns emit light together at night', () => {
    setup();
    updateTownLanterns(1, 1);
    const group = state.scene!.getObjectByName('town-lanterns')!;
    const lights = group.children.filter(child => (child as THREE.PointLight).isPointLight) as THREE.PointLight[];
    assert.equal(lights.length, 8);
    assert.ok(lights.every(light => light.visible && light.intensity > 0));

    updateTownLanterns(2, 0);
    assert.ok(lights.every(light => !light.visible));
    disposeWorld();
});

test('walls, roofs and doorways share real grapple and projectile broad-phase geometry regardless of render distance', () => {
    setup();
    const ray = new THREE.Raycaster(new THREE.Vector3(30, 12, 80), new THREE.Vector3(0, 0, 1), 0, 30);
    const candidates = queryGrappleSurfacesAlongSegment(30, 80, 30, 110);
    assert.ok(ray.intersectObjects(candidates, false).some(hit => hit.object.name === 'town-wall'));
    assert.ok(queryObstaclesAlongSegment(30, 80, 30, 110).some(o => o.name === 'town-wall'));
    const building = generateTownLayout(42)[0];
    const roofRay = new THREE.Raycaster(new THREE.Vector3(building.x, 60, building.z), new THREE.Vector3(0, -1, 0), 0, 70);
    assert.ok(roofRay.intersectObjects(queryGrappleSurfacesAlongSegment(building.x, building.z, building.x, building.z), false).some(hit => hit.object.name === 'town-building'));
    const doorRay = new THREE.Raycaster(new THREE.Vector3(0, 2, 80), new THREE.Vector3(0, 0, 1), 0, 30);
    assert.equal(doorRay.intersectObjects(queryGrappleSurfacesAlongSegment(0, 80, 0, 110), false).length, 0);
    updateEnvironmentVisibility(new THREE.Vector3(0, 0, 0), 1);
    const townMeshes = state.scene!.children.filter(o => o.name.startsWith('town-') && (o as THREE.InstancedMesh).isInstancedMesh) as THREE.InstancedMesh[];
    assert.equal(townMeshes.length, 14);
    assert.ok(townMeshes.every(mesh => mesh.count > 0));
    updateEnvironmentVisibility(new THREE.Vector3(900, 0, 900), 1);
    assert.ok(townMeshes.filter(mesh => !mesh.name.startsWith('town-ground-')).every(mesh => mesh.count === 0));
    assert.ok(townMeshes.filter(mesh => mesh.name.startsWith('town-ground-')).every(mesh => mesh.count > 0), 'ground stays visible outside the active chunks');
    assert.ok(ray.intersectObjects(queryGrappleSurfacesAlongSegment(30, 80, 30, 110), false).length > 0);
    disposeWorld();
});

function player(x: number, y: number, z: number, vx = 0, vy = 0, vz = 0) {
    state.camera!.position.set(x, y, z);
    state.velocity.set(vx, vy, vz);
    state.isPlaying = true;
    state.canJump = false;
    state.isShiftDown = state.isHovering = false;
    state.moveForward = state.moveBackward = state.moveLeft = state.moveRight = false;
    state.hookState = 'IDLE';
}

test('players enter and exit every doorway without teleporting onto the roof', () => {
    for (const seed of [0, 42]) {
        setup(seed);
        for (const b of generateTownLayout(seed)) {
            const axis = b.doorAxis;
            const edge = (axis === 'x' ? b.width : b.depth) / 2;
            player(b.x, 2, b.z);
            state.camera!.position[axis] -= b.doorSide * (edge + 3);
            for (let frame = 0; frame < 12; frame++) {
                state.velocity[axis] = b.doorSide * 20;
                updatePlayerPhysics(0.05);
                assert.ok(state.camera!.position.y < 2.01, 'no roof snap');
            }
            assert.ok(Math.abs(state.camera!.position[axis] - b[axis]) < edge - 1, 'entered room');
            for (let frame = 0; frame < 16; frame++) {
                state.velocity[axis] = -b.doorSide * 20;
                updatePlayerPhysics(0.05);
            }
            assert.ok(Math.abs(state.camera!.position[axis] - b[axis]) > edge + 1, 'exited room');
        }
    }
    disposeWorld();
});

test('ceilings and lintels stop upward motion, rooftops support landings and walls stop fast grapples', () => {
    setup();
    const b = generateTownLayout(42).find(b => b.kind === 'house' && !b.name)!;
    player(b.x, 2, b.z, 0, 164);
    let highest = 2;
    for (let i = 0; i < 40; i++) {
        updatePlayerPhysics(0.05);
        highest = Math.max(highest, state.camera!.position.y);
    }
    assert.ok(highest <= b.height - 0.7);
    assert.equal(state.camera!.position.y, 2);
    player(b.x, 2, b.z, 0, 164);
    state.camera!.position[b.doorAxis] -= b.doorSide * ((b.doorAxis === 'x' ? b.width : b.depth) / 2 - 0.35);
    highest = 2;
    for (let i = 0; i < 20; i++) {
        updatePlayerPhysics(0.05);
        highest = Math.max(highest, state.camera!.position.y);
    }
    assert.ok(highest <= 4.8, 'door lintel stops upward jumps');
    player(b.x, b.height + 12, b.z, 0, -100);
    for (let i = 0; i < 20; i++) updatePlayerPhysics(0.05);
    assert.equal(state.camera!.position.y, b.height + PLAYER_HEIGHT);
    assert.equal(state.canJump, true);
    player(30, 2, 82, 0, 0, 225);
    state.hookState = 'PULLING'; state.hookIsEnemy = true;
    updatePlayerPhysics(0.05);
    assert.ok(state.camera!.position.z <= 87 - PLAYER_RADIUS);
    assert.equal(state.velocity.z, 0);
    player(0, 2, 82, 0, 0, 225);
    state.hookState = 'PULLING'; state.hookIsEnemy = true;
    updatePlayerPhysics(0.05);
    assert.ok(state.camera!.position.z > 92, 'gateway permits high-speed traversal');
    disposeWorld();
});

test('roof edges catch diagonal falls and release support immediately on walking off', () => {
    setup();
    const b = generateTownLayout(42).find(b => b.kind === 'house' && !b.name)!;
    const edge = b.x + b.width / 2 + 0.25 + PLAYER_RADIUS;
    player(edge + 0.05, b.height + PLAYER_HEIGHT + 0.1, b.z, -50, -50);
    updatePlayerPhysics(0.01);
    assert.equal(state.camera!.position.y, b.height + PLAYER_HEIGHT);
    player(edge - 0.05, b.height + PLAYER_HEIGHT, b.z, 50, 0);
    updatePlayerPhysics(0.01);
    assert.equal(state.canJump, false);
    assert.ok(state.camera!.position.y < b.height + PLAYER_HEIGHT);
    disposeWorld();
});

test('swept bullets stop at town walls and ceilings, but travel through open gateways and doors', () => {
    setup();
    const shoot = (start: THREE.Vector3, direction: THREE.Vector3, delta: number) => {
        resetProjectiles();
        const bullet = new THREE.Object3D();
        bullet.position.copy(start);
        bullet.userData = { dx: direction.x, dy: direction.y, dz: direction.z, age: 0, visualOnly: true };
        state.projectiles = [bullet];
        updateProjectiles(delta, 'Town test');
        return state.projectiles.length;
    };
    assert.equal(shoot(new THREE.Vector3(30, 2, 82), new THREE.Vector3(0, 0, 1), .05), 0);
    assert.equal(shoot(new THREE.Vector3(0, 2, 82), new THREE.Vector3(0, 0, 1), .05), 1);
    const b = generateTownLayout(42).find(b => b.kind === 'house' && !b.name)!;
    assert.equal(shoot(new THREE.Vector3(b.x, 2, b.z), new THREE.Vector3(0, 1, 0), .05), 0);
    const start = new THREE.Vector3(b.x, 2, b.z);
    start[b.doorAxis] -= b.doorSide * ((b.doorAxis === 'x' ? b.width : b.depth) / 2 + 3);
    const direction = new THREE.Vector3();
    direction[b.doorAxis] = b.doorSide;
    assert.equal(shoot(start, direction, .02), 1);
    resetProjectiles();
    disposeParticles();
    disposeWorld();
});

test('target respawns stay outside the fortress and never intersect structures or pillars', () => {
    setup();
    for (let iteration = 0; iteration < 12; iteration++) for (const target of state.targets) {
        respawnTarget(target);
        const radius = Math.sqrt(3) * target.userData.scale;
        assert.equal(overlapsTown(target.position.x, target.position.z, radius), false);
        for (const obstacle of state.obstacles) {
            const data = obstacle.userData;
            assert.equal(Math.abs(target.position.x - obstacle.position.x) < data.halfW + radius &&
                Math.abs(target.position.z - obstacle.position.z) < data.halfD + radius &&
                Math.abs(target.position.y - obstacle.position.y) < data.halfH + radius, false);
        }
    }
    disposeWorld();
});


test('all four covered wall doorways remain traversable and stop jumps, shots and grapples at the lintel', () => {
    setup();
    assert.equal(TOWN_WALL_HEIGHT, 28 * 2.5);
    for (const axis of ['x', 'z'] as const) for (const side of [-1, 1]) {
        player(0, 2, 0);
        state.camera!.position[axis] = side * 90;
        state.velocity.y = 164;
        let highest = 2;
        for (let frame = 0; frame < 40; frame++) {
            updatePlayerPhysics(.05);
            highest = Math.max(highest, state.camera!.position.y);
        }
        assert.ok(highest > 10 && highest <= TOWN_GATE_HEIGHT);
        assert.equal(state.camera!.position.y, PLAYER_HEIGHT);
        const start = new THREE.Vector3(0, TOWN_GATE_HEIGHT + 2, 0);
        start[axis] = side * 80;
        const direction = new THREE.Vector3();
        direction[axis] = side;
        const end = start.clone().addScaledVector(direction, 25);
        const candidates = queryGrappleSurfacesAlongSegment(start.x, start.z, end.x, end.z);
        const ray = new THREE.Raycaster(start, direction, 0, 25);
        assert.equal(ray.intersectObjects(candidates, false)[0]?.object.name, 'town-wall');
        const bullet = new THREE.Object3D();
        bullet.position.copy(start);
        bullet.userData = { dx: direction.x, dy: 0, dz: direction.z, age: 0, visualOnly: true };
        state.projectiles = [bullet];
        updateProjectiles(.05, 'Town test');
        assert.equal(state.projectiles.length, 0);
    }
    disposeParticles();
    disposeWorld();
});

test('church nave has a clear center aisle, a solid ceiling and a grappleable tower', () => {
    for (const seed of [0, 1, 42, 0xffffffff]) {
        setup(seed);
        const church = generateTownLayout(seed).find(b => b.kind === 'church')!;
        player(church.x, 2, church.z, 0, 164);
        let highest = 2;
        for (let frame = 0; frame < 40; frame++) {
            updatePlayerPhysics(.05);
            highest = Math.max(highest, state.camera!.position.y);
        }
        assert.ok(highest <= church.height - .7);
        assert.equal(state.camera!.position.y, 2);
        const tower = state.obstacles.filter(o => o.name === 'town-church-tower');
        assert.ok(tower.length > 0);
        const cross = tower.reduce((a, b) => a.position.y + a.userData.halfH > b.position.y + b.userData.halfH ? a : b);
        assert.equal(cross.position.y + cross.userData.halfH, TOWN_WALL_HEIGHT * 0.8);
        const ray = new THREE.Raycaster(new THREE.Vector3(cross.position.x, 60, cross.position.z), new THREE.Vector3(0, -1, 0), 0, 60);
        assert.equal(ray.intersectObjects(queryGrappleSurfacesAlongSegment(cross.position.x, cross.position.z, cross.position.x, cross.position.z), false)[0]?.object, cross);
    }
    disposeWorld();
});


test('the full rampart loop is walkable through all four open corner lookouts', () => {
    setup();
    const boxes = createTownBoxes(generateTownLayout(42));
    assert.equal(boxes.filter(b => b.kind === 'lookout-post').length, 16);
    assert.equal(boxes.filter(b => b.kind === 'lookout-roof').length, 16);
    for (const side of [-1, 1]) for (let along = -90; along <= 90; along += 1) {
        assert.equal(occupied(along, TOWN_WALL_HEIGHT + PLAYER_HEIGHT, side * 90, boxes), false);
        assert.equal(occupied(side * 90, TOWN_WALL_HEIGHT + PLAYER_HEIGHT, along, boxes), false);
    }
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
        // The low outer wall continues through each corner, including its joins.
        for (let along = 84; along <= 94.5; along += 0.5) {
            assert.equal(occupied(sx * along, TOWN_WALL_HEIGHT + PLAYER_HEIGHT, sz * 94.4, boxes, 0.001), true);
            assert.equal(occupied(sx * 94.4, TOWN_WALL_HEIGHT + PLAYER_HEIGHT, sz * along, boxes, 0.001), true);
        }
        assert.equal(occupied(sx * 90, TOWN_WALL_HEIGHT + 4, sz * 94.4, boxes, 0), false, 'view above the low wall remains open');
        player(sx * 90, TOWN_WALL_HEIGHT + PLAYER_HEIGHT, sz * 90);
        updatePlayerPhysics(.05);
        assert.equal(state.camera!.position.y, TOWN_WALL_HEIGHT + PLAYER_HEIGHT);
        assert.equal(state.canJump, true);
        const ray = new THREE.Raycaster(new THREE.Vector3(sx * 90, 72, sz * 90), new THREE.Vector3(0, 1, 0), 0, 20);
        assert.equal(ray.intersectObjects(queryGrappleSurfacesAlongSegment(sx * 90, sz * 90, sx * 90, sz * 90), false)[0]?.object.name, 'town-lookout-roof');
    }
    disposeWorld();
});

test('thin stone stairs cantilever from the west wall with a wooden outer railing', () => {
    const boxes = createTownBoxes(generateTownLayout(42));
    const rise = TOWN_WALL_HEIGHT / TOWN_STAIR_STEPS;
    const westWallFace = -TOWN_HALF_SIZE + TOWN_WALL_THICKNESS / 2;
    const treads = boxes.filter(b => b.kind === 'stair' && b.solid && b.depth === TOWN_STAIR_TREAD);
    assert.equal(treads.length, TOWN_STAIR_STEPS);
    for (const tread of treads) {
        assert.equal(tread.material, 'stone');
        assert.ok(Math.abs(tread.height - rise) < 1e-10);
        assert.equal(tread.x, TOWN_STAIR_X);
        assert.ok(Math.abs(tread.x - tread.width / 2 - westWallFace) < 1e-10, 'tread is anchored to the wall face');
    }
    assert.ok(Math.abs(treads[0].y - treads[0].height / 2) < 1e-10);
    assert.ok(treads.at(-1)!.y - treads.at(-1)!.height / 2 > TOWN_WALL_HEIGHT - rise * 2);

    const structure = boxes.filter(b => b.kind === 'stair' && b.solid);
    assert.ok(structure.every(b => b.material === 'stone'));
    assert.ok(structure.every(b => b.height <= 0.35 + 1e-10), 'no ground-based stair wedge or landing column');

    const railing = boxes.filter(b => b.kind === 'railing');
    const slopedRails = railing.filter(b => b.rotationX !== undefined);
    assert.equal(slopedRails.length, 1);
    assert.equal(slopedRails[0].material, 'door');
    assert.equal(slopedRails[0].solid, false);
    assert.ok(Math.abs(slopedRails[0].rotationX! - Math.atan2(TOWN_WALL_HEIGHT, TOWN_STAIR_STEPS * TOWN_STAIR_TREAD)) < 1e-10);
    const posts = railing.filter(b => b.solid);
    assert.ok(posts.length > 2);
    assert.ok(posts.every(post => post.material === 'door'));
    assert.ok(posts.every(post => Math.abs(post.x + post.width / 2 - (TOWN_STAIR_X + TOWN_STAIR_WIDTH / 2)) < 1e-10));
});

test('players can walk the entire stair ascent to the rampart and back down without jumping', () => {
    setup();
    player(TOWN_STAIR_X, PLAYER_HEIGHT, TOWN_STAIR_START_Z + 2);
    const walk = (axis: 'x' | 'z', destination: number) => {
        const direction = Math.sign(destination - state.camera!.position[axis]);
        let frames = 0;
        while ((destination - state.camera!.position[axis]) * direction > .15 && frames++ < 1600) {
            state.velocity.x = state.velocity.z = 0;
            state.velocity[axis] = direction * Math.min(14, Math.abs(destination - state.camera!.position[axis]) / .016);
            updatePlayerPhysics(.016);
        }
        assert.ok(frames < 1600, `stuck at ${state.camera!.position.toArray()} moving ${axis} to ${destination}`);
    };
    walk('z', TOWN_STAIR_LANDING_Z);
    walk('x', -90);
    assert.equal(state.camera!.position.y, TOWN_WALL_HEIGHT + PLAYER_HEIGHT);
    walk('z', -90);
    walk('x', 90);
    walk('z', 90);
    walk('x', -90);
    walk('z', TOWN_STAIR_LANDING_Z);
    assert.equal(state.camera!.position.y, TOWN_WALL_HEIGHT + PLAYER_HEIGHT);
    walk('x', TOWN_STAIR_X);
    walk('z', TOWN_STAIR_START_Z + 2);
    for (let i = 0; i < 20; i++) { state.velocity.x = state.velocity.z = 0; updatePlayerPhysics(.05); }
    assert.equal(state.camera!.position.y, PLAYER_HEIGHT);
    disposeWorld();
});

test('roof slabs have eaves and sit above the shell without coplanar exterior faces', () => {
    for (const seed of [0, 1, 42, 0xffffffff]) for (const building of generateTownLayout(seed)) {
        const boxes = createTownBoxes([building]);
        const shell = boxes.filter(b => b.kind === 'building' && !['roof', 'gothRoof', 'gothTrim'].includes(b.material));
        const roof = boxes.find(b => b.kind === 'building' && (b.material === 'roof' || b.material === 'gothRoof'))!;
        assert.ok(roof.width > building.width && roof.depth > building.depth);
        for (const wall of shell) assert.ok(wall.y + wall.height / 2 <= roof.y - roof.height / 2 + 1e-8);
        // Different outward materials must never share overlapping face area.
        for (const axis of ['x', 'y', 'z'] as const) {
            const extent = {x:'width',y:'height',z:'depth'} as const;
            for (const wall of shell) for (const sign of [-1, 1]) {
                assert.ok(Math.abs((roof[axis] + sign * roof[extent[axis]] / 2) - (wall[axis] + sign * wall[extent[axis]] / 2)) > 1e-6);
            }
        }
    }
});


test('paving is a single non-overlapping ground surface across streets, paths and room floors', () => {
    const edge = TOWN_HALF_SIZE - TOWN_WALL_THICKNESS / 2;
    const approach = TOWN_HALF_SIZE + TOWN_APPROACH_LENGTH;
    const expectedArea = (edge * 2) ** 2 + 4 * (approach - edge) * TOWN_ROAD_WIDTH;
    for (let seed = 0; seed < 100; seed++) {
        const tiles = createTownPaving(generateTownLayout(seed));
        assert.ok(Math.abs(tiles.reduce((area, tile) => area + tile.width * tile.depth, 0) - expectedArea) < 1e-6);
        for (let i = 0; i < tiles.length; i++) {
            const a = tiles[i];
            assert.ok(a.width > 0 && a.depth > 0);
            assert.equal(a.y + a.height / 2, 0, 'same height as physical ground');
            for (const b of tiles.slice(i + 1)) {
                assert.ok(Math.abs(a.x - b.x) >= (a.width + b.width) / 2 - 1e-8 ||
                    Math.abs(a.z - b.z) >= (a.depth + b.depth) / 2 - 1e-8, `overlapping ground seed ${seed}`);
            }
        }
    }
});

test('grass is cut out under paving while grapple ground remains continuous at every render distance', () => {
    setup();
    const grass = state.scene!.getObjectByName('grass-floor')!;
    const tiles = createTownPaving(generateTownLayout(42));
    for (const tile of tiles) {
        const ray = new THREE.Raycaster(new THREE.Vector3(tile.x, 1, tile.z), new THREE.Vector3(0, -1, 0), 0, 2);
        assert.equal(ray.intersectObject(grass, false).length, 0, 'no hidden grass layer');
        assert.ok(ray.intersectObjects(queryGrappleSurfacesAlongSegment(tile.x, tile.z, tile.x, tile.z), false).some(hit => hit.object.name === 'ground-collider'));
    }
    for (const [x, z] of [[120, 0], [-120, 0], [0, 120], [0, -120], [95, 95], [-95, -95]]) {
        const ray = new THREE.Raycaster(new THREE.Vector3(x, 1, z), new THREE.Vector3(0, -1, 0), 0, 2);
        assert.ok(ray.intersectObject(grass, false).length > 0, 'grass outside paving remains intact');
    }
    updateEnvironmentVisibility(new THREE.Vector3(900, 0, 900), 1);
    state.scene!.updateMatrixWorld(true);
    const groundMeshes = state.scene!.children.filter(o => o.name.startsWith('town-ground-'));
    for (const tile of tiles) {
        const ray = new THREE.Raycaster(new THREE.Vector3(tile.x, 1, tile.z), new THREE.Vector3(0, -1, 0), 0, 2);
        assert.ok(ray.intersectObjects(groundMeshes, false).length > 0, 'paving still fills the hole when town props are culled');
    }
    disposeWorld();
});

test('rampart and cantilevered stair top faces meet without overlapping', () => {
    const surfaces = createTownBoxes(generateTownLayout(42)).filter(b => b.solid && (b.kind === 'walkway' || b.kind === 'stair'));
    for (let i = 0; i < surfaces.length; i++) for (const b of surfaces.slice(i + 1)) {
        const a = surfaces[i];
        if (Math.abs(a.y + a.height / 2 - b.y - b.height / 2) > 1e-8) continue;
        assert.ok(Math.abs(a.x - b.x) >= (a.width + b.width) / 2 - 1e-8 ||
            Math.abs(a.z - b.z) >= (a.depth + b.depth) / 2 - 1e-8);
    }
});


test('near-limit straight stairs stay smooth with walking input across frame rates and frame jitter', () => {
    setup();
    assert.ok(TOWN_WALL_HEIGHT / TOWN_STAIR_STEPS < PLAYER_STEP_HEIGHT);
    assert.ok(PLAYER_STEP_HEIGHT - TOWN_WALL_HEIGHT / TOWN_STAIR_STEPS < .001);
    assert.ok(TOWN_STAIR_STEPS * TOWN_STAIR_TREAD < 41, 'compact single flight');
    assert.ok(TOWN_STAIR_LANDING_Z - 3 > TOWN_GATE_WIDTH / 2 + PLAYER_RADIUS, 'ascent and landing avoid the west gate');
    for (const fps of [20, 24, 30, 40, 50, 60, 90, 100, 120, 144, 240, 0]) {
        player(TOWN_STAIR_X, PLAYER_HEIGHT, TOWN_STAIR_START_Z + 2);
        state.camera!.quaternion.identity();
        state.canJump = true;
        state.moveForward = true;
        let stuck = 0;
        let elapsed = 0;
        for (let frame = 0; frame < 4000 && state.camera!.position.z > TOWN_STAIR_LANDING_Z + .5; frame++) {
            const delta = fps ? 1 / fps : [1/144, 1/30, 1/60, .05, 1/90][frame % 5];
            elapsed += delta;
            updatePlayerPhysics(delta);
            if (state.velocity.z === 0) stuck++;
            assert.ok(state.velocity.y <= 0, 'no jump input or launch needed');
            if (elapsed > 12) break;
        }
        assert.equal(stuck, 0, `no catching on risers at ${fps || 'variable'} FPS`);
        assert.ok(state.camera!.position.z <= TOWN_STAIR_LANDING_Z + .5, `reached landing at ${fps} FPS`);
        assert.equal(state.camera!.position.y, TOWN_WALL_HEIGHT + PLAYER_HEIGHT);
    }
    state.moveForward = false;
    disposeWorld();
});

test('the central well is identical across seeds and leaves plaza detours clear', () => {
    const well = createTownBoxes(generateTownLayout(0)).filter(b => b.kind === 'well');
    assert.ok(well.some(b => b.material === 'water' && !b.solid));
    assert.ok(well.some(b => b.material === 'door' && b.y > 4));
    for (let seed = 0; seed < 100; seed++) {
        const boxes = createTownBoxes(generateTownLayout(seed));
        assert.deepEqual(boxes.filter(b => b.kind === 'well'), well);
        assert.equal(occupied(0, PLAYER_HEIGHT, MAX_PLAYERS, boxes), false);
        for (let distance = -10; distance <= 10; distance++) for (const side of [-1, 1]) {
            assert.equal(occupied(distance, PLAYER_HEIGHT, side * 5, boxes), false);
            assert.equal(occupied(side * 5, PLAYER_HEIGHT, distance, boxes), false);
        }
    }
    setup();
    player(0, PLAYER_HEIGHT, 10);
    updatePlayerPhysics(.05);
    assert.equal(state.camera!.position.y, PLAYER_HEIGHT);
    assert.equal(state.canJump, true);
    const ray = new THREE.Raycaster(new THREE.Vector3(0, 10, 0), new THREE.Vector3(0, -1, 0), 0, 12);
    assert.equal(ray.intersectObjects(queryGrappleSurfacesAlongSegment(0, 0, 0, 0), false)[0]?.object.name, 'town-well');
    disposeWorld();
});

test('house spawns are distinct and every house/church spawn faces a clear exit across 1,000 seeds', () => {
    for (let seed = 0; seed < 1000; seed++) {
        const buildings = generateTownLayout(seed);
        const houses = buildings.filter(b => b.kind === 'house' && !b.name);
        assert.ok(houses.length >= MAX_PLAYERS);
        const positions = new Set<string>();
        for (let slot = 0; slot < MAX_PLAYERS; slot++) {
            const spawn = getTownSpawn(seed, 'house', slot);
            assert.equal(spawn.x, houses[slot].x);
            assert.equal(spawn.z, houses[slot].z);
            positions.add(`${spawn.x},${spawn.z}`);
        }
        assert.equal(positions.size, MAX_PLAYERS);
        // Existing geometry tests verify that the center-to-door path is clear.
        for (const b of buildings.filter(b => !b.name)) {
            const spawn = getTownSpawn(seed, b.kind, houses.indexOf(b));
            assert.equal(spawn.x, b.x);
            assert.equal(spawn.z, b.z);
            const direction = new THREE.Vector3(0, 0, -1).applyAxisAngle(new THREE.Vector3(0, 1, 0), spawn.yaw);
            assert.ok(Math.abs(direction[b.doorAxis] + b.doorSide) < 1e-8);
        }
    }
});

test('fresh house spawns and repeated church respawns restore the player and allow walking out without jumping', () => {
    for (const seed of [0, 1, 42, 0xffffffff]) {
        setup(seed);
        for (const kind of ['house', 'church', 'church'] as const) {
            player(100, 200, 300, 10, -50, 20);
            state.camera!.rotation.set(1, 2, 0.5);
            state.playerHp = 0;
            state.kills = 3; state.deaths = 2;
            state.hookState = 'PULLING';
            const life = state.lifeId;
            resetPlayerAtTownSpawn(seed, kind);
            assert.equal(state.lifeId, life + 1);
            assert.equal(state.playerHp, state.playerMaxHp);
            assert.deepEqual(state.velocity.toArray(), [0, 0, 0]);
            assert.equal(state.hookState, 'IDLE');
            assert.equal(state.kills, 3); assert.equal(state.deaths, 2);
            const spawn = getTownSpawn(seed, kind);
            assert.deepEqual(state.camera!.position.toArray(), [spawn.x, PLAYER_HEIGHT, spawn.z]);
            assert.equal(state.camera!.rotation.x, 0); assert.equal(state.camera!.rotation.z, 0);
            updatePlayerPhysics(1 / 60);
            assert.equal(state.camera!.position.y, PLAYER_HEIGHT);
            assert.equal(state.canJump, true);
            state.moveForward = true;
            for (let frame = 0; frame < 90; frame++) {
                updatePlayerPhysics(1 / 60);
                assert.equal(state.camera!.position.y, PLAYER_HEIGHT, 'walk out without roof snaps or jumping');
            }
            state.moveForward = false;
            const b = generateTownLayout(seed).find(b => b.x === spawn.x && b.z === spawn.z)!;
            const distance = Math.abs(state.camera!.position[b.doorAxis] - b[b.doorAxis]);
            assert.ok(distance > (b.doorAxis === 'x' ? b.width : b.depth) / 2 + 1, 'walked outside the doorway');
        }
        disposeWorld();
    }
});

test('each seed has one named goth house, clear access and five distinct ordinary spawn houses', () => {
    const locations = new Set<string>();
    for (let seed = 0; seed < 1000; seed++) {
        const buildings = generateTownLayout(seed);
        const gothic = buildings.filter(b => b.name === 'goth house');
        assert.equal(gothic.length, 1);
        const goth = gothic[0];
        assert.equal(goth.kind, 'house');
        assert.equal(buildings.filter(b => b.kind === 'house' && !b.name).length, 6);
        locations.add(`${goth.x},${goth.z}`);
        for (let slot = 0; slot < MAX_PLAYERS; slot++) {
            const spawn = getTownSpawn(seed, 'house', slot);
            assert.ok(spawn.x !== goth.x || spawn.z !== goth.z, 'special house is excluded from MP spawns');
        }
    }
    assert.ok(locations.size > 900);
    for (const seed of [0, 1, 42, 0xffffffff]) {
        setup(seed);
        const goth = generateTownLayout(seed).find(b => b.name === 'goth house')!;
        const decor = state.scene!.getObjectByName('goth house')!;
        assert.ok(decor);
        assert.ok(decor.children.length <= 7, 'ornaments are batched by material');
        const axes = new THREE.Vector3(0, 0, 0);
        const localGeometries: THREE.BufferGeometry[] = [];
        decor.traverse(o => {
            if (!(o instanceof THREE.Mesh)) return;
            o.geometry.computeBoundingBox();
            assert.ok(o.geometry.boundingBox!.getSize(axes).length() > 0);
            localGeometries.push(o.geometry);
        });
        let disposed = 0;
        localGeometries.forEach(geometry => geometry.addEventListener('dispose', () => disposed++));
        player(goth.x, PLAYER_HEIGHT, goth.z);
        for (let frame = 0; frame < 30; frame++) updatePlayerPhysics(1 / 60);
        assert.equal(state.camera!.position.y, PLAYER_HEIGHT);
        const roof = state.obstacles.filter(o => o.name === 'town-building' && Math.abs(o.position.x - goth.x) < .01 && Math.abs(o.position.z - goth.z) < .01);
        assert.ok(roof.some(o => o.userData.height === 0.55), 'tiered roof has physical geometry');
        disposeWorld();
        assert.equal(disposed, localGeometries.length);
    }
});
