import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { ENEMY_COUNT, INFANTRY, TOWN_WALL_HP, type InfantryKind } from '../src/config.ts';
import { InfantryDefense, nearestInfantryPlayer, type InfantryEnvironment, type InfantryPlayer } from '../src/infantry.ts';
import type { InfantryPose } from '../src/infantryNetworkTypes.ts';
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

async function arena(events: Partial<InfantryEnvironment> = {}, authoritative = true) {
    const scene = new THREE.Scene(), targets: THREE.Group[] = [];
    const defense = new InfantryDefense(scene, targets, seed, walls.map(wall => wall.object), [], {
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
        assert.equal(defense.damage(ENEMY_COUNT, 4).killed, false);
        assert.equal(defense.damage(ENEMY_COUNT, 1).killed, true);
        assert.equal(defense.damage(ENEMY_COUNT, 1).accepted, false);
        assert.equal(targetData(targets[0]).hp, 0);
        for (const [day, total, kinds] of [[2, 13, ['base', 'fast']], [3, 24, ['base', 'fast', 'big']], [4, 38, ['base', 'fast', 'big']]] as const) {
            defense.update(.05, 479.99, []); defense.update(.05, .04, []);
            const snapshot = defense.snapshot();
            assert.equal(snapshot.day, day);
            assert.equal(snapshot.bots.length, total);
            assert.deepEqual([...new Set(snapshot.bots.map(bot => bot.kind))].sort(), [...kinds].sort());
        }
        defense.update(.05, 479.99, []); defense.update(.05, .04, []);
        assert.equal(defense.snapshot().bots.length, 48);
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
    const closest = player('Covered', 8, 2), visible = player('Visible', 40, 32), outside = player('Outside', 5, 53);
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
        defense.receive({ day: 3, wallHp: 5, sequence: 1, bots: [
            pose(0, 'fast', 106, 40), pose(1, 'big', 106, -40), pose(2, 'base', 96.1, -56),
        ] });
        for (let frame = 1; frame <= 100; frame++) defense.update(.05, frame * .05, []);
        assert.ok(strikes.includes('fast') && strikes.includes('big') && strikes.includes('base'));
        assert.equal(defense.wallHp, 0);
        assert.equal(losses.length, 1);
        assert.ok(Math.abs(losses[0].x - 95) < 1e-6);
    } finally { defense.dispose(); }
});

test('infantry snapshot validates bounds and late joiners reject stale state or old kills', async () => {
    const { defense, targets } = await arena({}, false);
    try {
        const snapshot = { sequence: 9, day: 3, wallHp: 419, bots: [pose(0, 'big', 900, 400)] };
        const packet = { type: 'infantry_state', state: snapshot };
        assert.deepEqual(parseNetworkPacket(packet), packet);
        assert.equal(parseNetworkPacket({ ...packet, state: { ...snapshot, bots: [...snapshot.bots, ...snapshot.bots] } }), null);
        assert.equal(parseNetworkPacket({ ...packet, state: { ...snapshot, wallHp: 501 } }), null);
        defense.receive(snapshot);
        defense.receive({ ...snapshot, sequence: 8, wallHp: 10, bots: [] });
        assert.equal(defense.wallHp, 419);
        assert.equal(defense.day, 3);
        defense.receive({ ...snapshot, sequence: 10, bots: [{ ...snapshot.bots[0], revision: 3 }] });
        defense.acceptKill({ kind: 'kill', slot: 0, revision: 1, score: 1, killer: null });
        assert.equal(targetData(targets[0]).hp, 10);
    } finally { defense.dispose(); }
});
