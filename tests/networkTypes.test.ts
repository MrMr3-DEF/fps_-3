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
    hoverKeys: null
};

test('network parser accepts a valid update packet', () => {
    const parsed = parseNetworkPacket(validUpdate);
    assert.equal(parsed?.type, 'update');
});

test('network parser rejects malformed vectors and unsupported weapons', () => {
    assert.equal(parseNetworkPacket({ ...validUpdate, pos: { x: Number.NaN, y: 0, z: 0 } }), null);
    assert.equal(parseNetworkPacket({ ...validUpdate, activeWeapon: 'LASER' }), null);
});

test('network parser bounds target snapshots and validates target state', () => {
    const snapshot = parseNetworkPacket({
        type: 'world_snapshot',
        seed: 42,
        score: 3,
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
        type: 'world_snapshot',
        seed: -1,
        score: 0,
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
