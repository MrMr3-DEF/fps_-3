import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { ENEMY_COUNT, INFANTRY, TOWN_HALF_SIZE, TOWN_WALL_HP, TOWN_WALL_THICKNESS, type InfantryKind } from '../src/config.ts';
import { InfantryDefense, botFootprintRadius, nearestInfantryPlayer, type InfantryEnvironment, type InfantryPlayer } from '../src/infantry.ts';
import type { InfantryPose } from '../src/infantryNetworkTypes.ts';
import { MechaNavigation } from '../src/mechaNavigation.ts';
import { parseNetworkPacket } from '../src/networkTypes.ts';
import { segmentAabbHitT } from '../src/gameplayMath.ts';
import { createTownBoxes, generateTownLayout } from '../src/town.ts';
import { targetData } from '../src/userDataTypes.ts';
import { loadSkinnedTestAsset } from './ironmawTestAsset.ts';

const seed = 42;
const walls = createTownBoxes(generateTownLayout(seed)).filter(part => part.kind === 'wall' && part.solid).map(part => {
    const object = new THREE.Object3D();
    object.name = 'town-wall';
    object.position.set(part.x, part.y, part.z);
    object.userData = { height: part.height, halfW: part.width / 2, halfH: part.height / 2, halfD: part.depth / 2 };
    const half = new THREE.Vector3(part.width, part.height, part.depth).multiplyScalar(.5);
    return { object, min: object.position.clone().sub(half), max: object.position.clone().add(half) };
});

async function arena(events: Partial<InfantryEnvironment> = {}, authoritative = true, obstacles: THREE.Object3D[] = []) {
    const scene = new THREE.Scene(), targets: THREE.Group[] = [];
    const defense = new InfantryDefense(scene, targets, seed, [...walls.map(wall => wall.object), ...obstacles], [], {
        visible: () => false, attack() {}, wallLost() {},
        trace(start, end) {
            let first = Infinity, obstacle: THREE.Object3D | undefined;
            for (const wall of walls) {
                const t = segmentAabbHitT(start, end, wall.min, wall.max);
                if (t !== null && t < first) { first = t; obstacle = wall.object; }
            }
            return obstacle ? { position: start.clone().lerp(end, first), obstacle } : null;
        },
        ...events,
    }, authoritative);
    const load = (url: string) => loadSkinnedTestAsset(new URL(url));
    await defense.load({ loadAsync: load });
    return { defense, targets, scene };
}

const pose = (slot: number, kind: InfantryKind, x: number, z: number): InfantryPose => ({
    slot, kind, position: { x, y: 0, z }, yaw: -Math.PI / 2, pitch: 0, hp: INFANTRY[kind].hp, phase: 'idle', time: 0, revision: 1,
});

test('dawn adds increasingly large mixed waves at deterministic reachable border positions', async () => {
    const { defense, targets } = await arena(), { defense: copy } = await arena();
    try {
        defense.update(.05, 0, []); copy.update(.05, 0, []);
        const first = defense.snapshot();
        assert.deepEqual(first, copy.snapshot());
        assert.equal(first.bots.length, 5);
        assert.ok(first.bots.every(bot => bot.kind === 'base' && Math.max(Math.abs(bot.position.x), Math.abs(bot.position.z)) > 980));
        assert.equal(new Set(first.bots.map(bot => JSON.stringify(bot.position))).size, 5);
        assert.equal(defense.damage(ENEMY_COUNT, INFANTRY.base.hp - 1).killed, false);
        assert.equal(defense.damage(ENEMY_COUNT, 1).killed, true);
        assert.equal(defense.damage(ENEMY_COUNT, 1).accepted, false);
        assert.equal(targetData(targets[0]).hp, 0);
        for (const [day, total, kinds] of [[2, 13, ['base', 'fast']], [3, 24, ['base', 'fast', 'big']], [4, 38, ['base', 'fast', 'big']]] as const) {
            defense.update(.05, 299.99, []); defense.update(.05, .04, []);
            const snapshot = defense.snapshot();
            assert.equal(snapshot.day, day);
            assert.equal(snapshot.bots.length, total);
            assert.deepEqual([...new Set(snapshot.bots.map(bot => bot.kind))].sort(), [...kinds].sort());
        }
        defense.update(.05, 299.99, []); defense.update(.05, .04, []);
        assert.equal(defense.snapshot().bots.length, 48);
        assert.equal(defense.enemiesRemaining, 54);
        defense.update(4, 4.04, []);
        defense.update(.05, 4.09, []);
        const replenished = defense.snapshot();
        assert.equal(replenished.bots.length, 48);
        assert.ok(replenished.bots[0].revision > first.bots[0].revision);
    } finally { defense.dispose(); copy.dispose(); }
});

test('scans use a sphere and choose the nearest visible player', () => {
    const origin = new THREE.Vector3(0, 2, 0);
    const player = (id: string, x: number, y: number): InfantryPlayer => ({ id, lifeId: 0, yaw: 0, position: new THREE.Vector3(x, y, 0) });
    // 90^2 + 67.5^2 = 112.5^2 (exact spherical INFANTRY_RANGE boundary); outside sits beyond 112.5 m.
    const closest = player('Covered', 8, 2), visible = player('Visible', 90, 69.5), outside = player('Outside', 5, 115.5);
    assert.equal(nearestInfantryPlayer(origin, [outside, visible, closest], candidate => candidate !== closest), visible);
    assert.equal(nearestInfantryPlayer(origin, [outside], () => true), undefined);
});

test('robot attacks prefer players, use authored cues, and drop stale melee lives', async () => {
    const strikes: [InfantryKind, string | undefined][] = [];
    const { defense } = await arena({ attack: (kind, _, __, player) => strikes.push([kind, player?.id]) });
    try {
        defense.receive({ day: 1, wallHp: TOWN_WALL_HP, sequence: 1,
            bots: [pose(0, 'base', 138, -56), pose(1, 'fast', 131.5, 0), pose(2, 'big', 132.2, 56)] });
        const players = ['BaseTarget', 'FastTarget', 'BigTarget'].map((id, index) => ({
            id, lifeId: 0, yaw: 0, position: new THREE.Vector3(130, 1.65, 56 * (index - 1)),
        }));
        defense.update(.05, 1, players);
        assert.deepEqual(strikes, [['base', 'BaseTarget']]);
        players[1].lifeId++;
        defense.update(.15, 1.15, players);
        assert.deepEqual(strikes, [['base', 'BaseTarget']]);
        defense.update(.58, 1.73, players);
        assert.deepEqual(strikes, [['base', 'BaseTarget'], ['big', 'BigTarget']]);
    } finally { defense.dispose(); }
});

test('infantry damage the wall at contact and commit the wall loss once', async () => {
    const strikes: InfantryKind[] = [], losses: THREE.Vector3[] = [];
    const { defense } = await arena({
        attack: kind => strikes.push(kind), wallLost: position => losses.push(position.clone()),
    });
    try {
        const wallHp = INFANTRY.base.damage + INFANTRY.fast.damage + INFANTRY.big.damage;
        defense.receive({ day: 3, wallHp, sequence: 1, bots: [
            pose(0, 'fast', 106, 40), pose(1, 'big', 106, -40), pose(2, 'base', 99, -56),
        ] });
        for (let frame = 1; frame <= 100; frame++) defense.update(.05, frame * .05, []);
        assert.ok(strikes.includes('fast') && strikes.includes('big') && strikes.includes('base'));
        assert.equal(defense.wallHp, 0);
        assert.equal(losses.length, 1);
        assert.ok(Math.abs(losses[0].x - 95) < 1e-6);
    } finally { defense.dispose(); }
});

test('seeded infantry routes flank differently while every segment stays clear', () => {
    const radius = Math.hypot(INFANTRY.big.width, INFANTRY.big.depth) / 2;
    const nav = new MechaNavigation(walls.map(({ object }) => {
        const { height, halfW, halfD } = object.userData as { height: number; halfW: number; halfD: number };
        return { x: object.position.x, z: object.position.z, halfW, halfD,
            bottom: object.position.y - height / 2, top: object.position.y + height / 2 };
    }), [], radius, radius + .025);
    const first = nav.borderSpawn(seed, () => true, 12, 1), second = nav.borderSpawn(seed, () => true, 12, 2);
    assert.deepEqual(first.points[0], second.points[0]);
    assert.notDeepEqual(first.points, second.points);
    for (const route of [first, second]) {
        for (let i = 1; i < route.points.length; i++) {
            assert.equal(nav.segmentClear(route.points[i - 1], route.points[i]), true, `segment ${i}`);
        }
        const end = route.points.at(-1)!;
        assert.ok(Math.abs(Math.max(Math.abs(end.x), Math.abs(end.z)) -
            (TOWN_HALF_SIZE + TOWN_WALL_THICKNESS / 2 + radius + .025)) < .01);
    }
    const divergence = Math.max(...first.points.slice(1, -1).map(point =>
        Math.min(...second.points.map(other => Math.hypot(point.x - other.x, point.z - other.z)))));
    assert.ok(divergence > 8, `routes stayed within ${divergence} units`);
});

test('living infantry never overlap while converging on one target', async () => {
    const player: InfantryPlayer = { id: 'Focus', lifeId: 1, yaw: 0, position: new THREE.Vector3(540, 1.65, 500) };
    const { defense } = await arena({ visible: () => true });
    const assertSeparated = (bots: readonly InfantryPose[], label: string) => {
        for (let i = 0; i < bots.length; i++) for (let j = i + 1; j < bots.length; j++) {
            const a = bots[i], b = bots[j];
            const clearance = botFootprintRadius(a.kind) + botFootprintRadius(b.kind);
            assert.ok(Math.hypot(a.position.x - b.position.x, a.position.z - b.position.z) >= clearance - .05,
                `${label}: ${a.kind} and ${b.kind} overlapped`);
        }
    };
    try {
        defense.update(.05, 0, []);
        const spawned = defense.snapshot().bots;
        for (let i = 0; i < spawned.length; i++) for (let j = i + 1; j < spawned.length; j++) {
            const a = spawned[i], b = spawned[j];
            assert.ok(Math.hypot(a.position.x - b.position.x, a.position.z - b.position.z) >=
                botFootprintRadius(a.kind) + botFootprintRadius(b.kind) + 1.49, 'spawn overlap');
        }
        for (let frame = 1; frame <= 200; frame++) {
            defense.update(.05, frame * .05, []);
            assertSeparated(defense.snapshot().bots, `spawn frame ${frame}`);
        }
        defense.receive({ sequence: 1, day: 3, wallHp: TOWN_WALL_HP, bots: [
            { ...pose(0, 'base', 420, 480), revision: 2 }, { ...pose(1, 'base', 420, 500), revision: 2 },
            { ...pose(2, 'base', 420, 520), revision: 2 },
        ] });
        for (let frame = 1; frame <= 300; frame++) {
            defense.update(.05, frame * .05, [player]);
            assertSeparated(defense.snapshot().bots, `chase frame ${frame}`);
        }
    } finally { defense.dispose(); }
});

test('fast robots route around an obstacle to a visible player instead of the wall', async () => {
    const pillar = new THREE.Object3D();
    pillar.position.set(520, 6, 500);
    pillar.userData = { height: 12, halfH: 6, halfW: 6, halfD: 6 };
    // The pillar blocks the navigation grid but not the line of sight trace, so
    // the chase must path around cover rather than lose the player.
    const { defense } = await arena({}, true, [pillar]);
    const player: InfantryPlayer = { id: 'Covered', lifeId: 1, yaw: 0, position: new THREE.Vector3(540, 1.65, 500) };
    try {
        defense.receive({ sequence: 1, day: 1, wallHp: TOWN_WALL_HP,
            bots: [{ ...pose(0, 'fast', 500, 500), revision: 2 }] });
        for (let frame = 1; frame <= 240; frame++) defense.update(.05, frame * .05, [player]);
        const [bot] = defense.snapshot().bots;
        const remaining = Math.hypot(bot.position.x - player.position.x, bot.position.z - player.position.z);
        assert.ok(bot.position.x > 530, `bot stayed behind the obstacle at x=${bot.position.x.toFixed(1)}`);
        assert.ok(remaining < 5, `bot stopped ${remaining.toFixed(1)} units from the player`);
    } finally { defense.dispose(); }
});

test('infantry snapshot validates bounds and late joiners reject stale state or old kills', async () => {
    const { defense, targets } = await arena({}, false);
    try {
        const snapshot = { sequence: 9, day: 3, queued: 7, wallHp: 419, bots: [pose(0, 'big', 900, 400)] };
        const packet = { type: 'infantry_state', state: snapshot };
        assert.deepEqual(parseNetworkPacket(packet), packet);
        assert.equal(parseNetworkPacket({ ...packet, state: { ...snapshot, bots: [...snapshot.bots, ...snapshot.bots] } }), null);
        assert.equal(parseNetworkPacket({ ...packet, state: { ...snapshot, wallHp: 501 } }), null);
        assert.equal(parseNetworkPacket({ ...packet, state: { ...snapshot, queued: -1 } }), null);
        defense.receive(snapshot);
        assert.equal(defense.enemiesRemaining, 8);
        defense.receive({ ...snapshot, sequence: 8, wallHp: 10, bots: [] });
        assert.equal(defense.wallHp, 419);
        assert.equal(defense.day, 3);
        defense.receive({ ...snapshot, sequence: 10, bots: [{ ...snapshot.bots[0], revision: 3 }] });
        defense.acceptKill({ kind: 'kill', slot: 0, revision: 1, score: 1, killer: null });
        assert.equal(targetData(targets[0]).hp, INFANTRY.big.hp);
    } finally { defense.dispose(); }
});

test('infantry pivot on alternating planted feet and replicate a partially completed turn', async () => {
    const { defense, scene } = await arena({ visible: () => true });
    const replica = await arena({ visible: () => true }, false);
    try {
        const kinds = ['base', 'fast', 'big'] as const;
        const bots = kinds.map((kind, i) => ({ ...pose(i, kind, 500, 500 + 150 * i), yaw: 0 }));
        const players = bots.map((bot, i) => ({ id: String(i), lifeId: 1, yaw: 0,
            position: new THREE.Vector3(bot.position.x + (i === 1 ? -1 : 1) * 1.5, 1.65, bot.position.z) }));
        defense.receive({ sequence: 1, day: 1, wallHp: TOWN_WALL_HP, bots });
        defense.update(.01, 1, players);
        const snapshot = defense.snapshot();
        const packet = { type: 'infantry_state', state: snapshot };
        assert.deepEqual(parseNetworkPacket(packet), packet);
        for (const bad of [undefined, 0, Infinity, Math.PI]) {
            assert.equal(parseNetworkPacket({ ...packet, state: { ...snapshot,
                bots: [{ ...snapshot.bots[0], turnAngle: bad }] } }), null);
        }
        function foot(world: THREE.Scene, kind: string, side: string): THREE.Vector3 {
            return world.getObjectByName('enemy_' + kind)!.getObjectByName('foot' + side)!.getWorldPosition(new THREE.Vector3());
        }
        for (const [i, bot] of snapshot.bots.entries()) {
            assert.equal(bot.phase, 'turn');
            const side = bot.turnAngle! > 0 ? 'L' : 'R';
            const swing = side === 'L' ? 'R' : 'L';
            const start = foot(scene, bot.kind, side);
            const startSwing = foot(scene, bot.kind, swing);
            const asset = await loadSkinnedTestAsset(new URL(`../blender_assets/enemy_${bot.kind}/enemy_${bot.kind}.glb`, import.meta.url));
            const seconds = THREE.AnimationClip.findByName(asset.animations, bot.turnAngle! > 0 ? 'TurnLeft' : 'TurnRight').duration;
            const sample = (time: number, sequence: number) => replica.defense.receive({ ...snapshot, sequence,
                bots: [{ ...bot, time }] });
            sample(seconds / 4, 10 + i * 4);
            assert.ok(foot(replica.scene, bot.kind, side).distanceTo(start) < .025, bot.kind + ' stance foot slides');
            assert.ok(foot(replica.scene, bot.kind, swing).y > startSwing.y + .1);
            sample(seconds * .5, 11 + i * 4);
            const landed = foot(replica.scene, bot.kind, swing);
            sample(seconds * .75, 12 + i * 4);
            assert.ok(foot(replica.scene, bot.kind, swing).distanceTo(landed) < .025, bot.kind + ' second stance foot slides');
            assert.ok(foot(replica.scene, bot.kind, side).y > start.y + .1);
        }
    } finally { defense.dispose(); replica.defense.dispose(); }
});
