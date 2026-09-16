import test from 'node:test';
import assert from 'node:assert/strict';
import { parseNetworkPacket } from '../src/networkTypes.ts';

const validUpdate = {
    type: 'update', lifeId: 0,
    username: 'Pilot',
    pos: { x: 0, y: 2, z: 0 },
    yaw: 0,
    pitch: 0,
    activeWeapon: 'PISTOL',
    isMouseDown: false,
    isDead: false,
    hookState: 'IDLE',
    hookPos: null,
    isHovering: false,
    hoverKeys: null,
    hp: 10,
    maxHp: 10,
};

test('network parser accepts a valid update packet', () => {
    const parsed = parseNetworkPacket(validUpdate);
    assert.equal(parsed?.type, 'update');
});

test('network parser requires canonical peer health consistent with life state', () => {
    assert.equal(parseNetworkPacket({ ...validUpdate, hp: 7, maxHp: 10 })?.type, 'update');
    assert.equal(parseNetworkPacket({ ...validUpdate, isDead: true, hp: 0, maxHp: 10 })?.type, 'update');
    for (const health of [
        { hp: undefined },
        { maxHp: undefined },
        { hp: -1, maxHp: 10 },
        { hp: 11, maxHp: 10 },
        { hp: Number.NaN, maxHp: 10 },
        { hp: 0, maxHp: 10 },
        { hp: 7, maxHp: 999 },
        { isDead: true, hp: 7, maxHp: 10 },
    ]) {
        assert.equal(parseNetworkPacket({ ...validUpdate, ...health }), null);
    }
});

test('network parser rejects malformed vectors and unsupported weapons', () => {
    assert.equal(parseNetworkPacket({ ...validUpdate, pos: { x: Number.NaN, y: 0, z: 0 } }), null);
    assert.equal(parseNetworkPacket({ ...validUpdate, activeWeapon: 'LASER' }), null);
});

test('network parser bounds target snapshots and validates target state', () => {
    const snapshot = parseNetworkPacket({
        type: 'world_snapshot', gameStarted: false, username: 'Guest3',
        spawnHouseSlot: 1,
        seed: 42,
        score: 3,
        dayNightElapsedSeconds: 123.5,
        targets: [{
            targetIndex: 0,
            position: { x: 1, y: 2, z: 3 },
            maxHp: 3,
            hp: 2,
            scale: 1.5,
            color: 0x00bfff
        }]
    });
    assert.equal(snapshot?.type, 'world_snapshot');

    assert.equal(parseNetworkPacket({
        type: 'world_snapshot', gameStarted: false, username: 'Guest3',
        spawnHouseSlot: 1,
        seed: -1,
        score: 0,
        dayNightElapsedSeconds: 0,
        targets: []
    }), null);
});

test('network parser requires a normalized fire direction', () => {
    assert.equal(parseNetworkPacket({
        type: 'fire',
        weapon: 'AR',
        barrelPos: { x: 0, y: 2, z: 0 },
        dir: { x: 0, y: 0, z: 0 }
    }), null);
});

test('fire packets accept enemy homing locks but never sniper homing', () => {
    const fire = {
        type: 'fire', shotId: 1, spreadSeed: 42, weapon: 'AR',
        barrelPos: { x: 0, y: 2, z: 0 }, dir: { x: 0, y: 0, z: -1 },
    };
    assert.equal(parseNetworkPacket({
        ...fire,
        homingTarget: { kind: 'npc', targetIndex: 3, targetRevision: 2 },
        homingStartDistance: 25,
    })?.type, 'fire');
    assert.equal(parseNetworkPacket({
        ...fire,
        homingTarget: { kind: 'peer', targetPeerId: 'peer-a', targetLifeId: 4 },
    })?.type, 'fire');
    assert.equal(parseNetworkPacket({
        ...fire,
        weapon: 'SNIPER',
        homingTarget: { kind: 'npc', targetIndex: 3, targetRevision: 2 },
    }), null);
    assert.equal(parseNetworkPacket({ ...fire, homingStartDistance: 25 }), null);
    assert.equal(parseNetworkPacket({
        ...fire,
        homingTarget: { kind: 'npc', targetIndex: 3, targetRevision: 2 },
        homingStartDistance: -1,
    }), null);
});

test('avatar colors accept only optional 24-bit integers', () => {
    assert.equal(parseNetworkPacket({ ...validUpdate, bodyColor: 0xdf5b64 })?.type, 'update');
    for (const bodyColor of [-1, 0x1000000, 1.5, '#df5b64', null]) {
        assert.equal(parseNetworkPacket({ ...validUpdate, bodyColor }), null);
    }
});

test('world snapshots require a valid client house assignment', () => {
    const snapshot = { type: 'world_snapshot', gameStarted: false, username: 'Guest3', seed: 42, score: 0, dayNightElapsedSeconds: 0, targets: [] };
    for (const spawnHouseSlot of [undefined, null, -1, 0, 1.5, 5, '2']) {
        assert.equal(parseNetworkPacket({ ...snapshot, spawnHouseSlot }), null);
    }
    for (const spawnHouseSlot of [1, 2, 3, 4]) {
        assert.equal(parseNetworkPacket({ ...snapshot, spawnHouseSlot })?.type, 'world_snapshot');
    }
});

test('network parser validates synchronized day/night clocks', () => {
    assert.equal(parseNetworkPacket({ ...validUpdate, dayNightElapsedSeconds: 42.5 })?.type, 'update');
    for (const dayNightElapsedSeconds of [-1, Number.NaN, Infinity, '42']) {
        assert.equal(parseNetworkPacket({ ...validUpdate, dayNightElapsedSeconds }), null);
    }
    assert.equal(parseNetworkPacket({
        type: 'world_snapshot', gameStarted: false, username: 'Guest3', spawnHouseSlot: 1, seed: 42, score: 0, targets: [],
    }), null);
});

test('player hits require the victim life to prevent damage leaking across respawns', () => {
    const hit = { type: 'player_hit', shotId: 1, pelletIndex: 0, targetPeerId: 'peer-a', damage: 1, attackerName: 'Guest2' };
    for (const targetLifeId of [undefined, -1, 0.5, '1']) {
        assert.equal(parseNetworkPacket({ ...hit, targetLifeId }), null);
    }
    assert.equal(parseNetworkPacket({ ...hit, targetLifeId: 7 })?.type, 'player_hit');
});
