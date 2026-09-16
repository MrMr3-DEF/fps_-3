import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { buildBeanModel } from '../src/weapons.ts';
import {
    PLAYER_HITBOX_MAX,
    PLAYER_HITBOX_MIN,
    segmentPlayerHitboxHitT,
} from '../src/playerHitbox.ts';

test('player hitbox tightly encloses the complete scaled bean model', () => {
    const bean = buildBeanModel(0x123456, 0xabcdef);
    bean.scale.setScalar(1.5);
    bean.updateMatrixWorld(true);
    const bounds = new THREE.Box3().setFromObject(bean);

    assert.ok(bounds.min.distanceTo(new THREE.Vector3(
        PLAYER_HITBOX_MIN.x,
        PLAYER_HITBOX_MIN.y,
        PLAYER_HITBOX_MIN.z,
    )) < 0.002);
    assert.ok(bounds.max.distanceTo(new THREE.Vector3(
        PLAYER_HITBOX_MAX.x,
        PLAYER_HITBOX_MAX.y,
        PLAYER_HITBOX_MAX.z,
    )) < 0.002);
});

test('player hitbox covers the bean from booster to head without extra side room', () => {
    const position = new THREE.Vector3(0, 0, -10);
    assert.notEqual(segmentPlayerHitboxHitT(
        new THREE.Vector3(0, 1.6, 0),
        new THREE.Vector3(0, 1.6, -20),
        position,
        0,
    ), null, 'upper head is hittable');
    assert.notEqual(segmentPlayerHitboxHitT(
        new THREE.Vector3(0, -1.6, 0),
        new THREE.Vector3(0, -1.6, -20),
        position,
        0,
    ), null, 'booster is hittable');
    assert.equal(segmentPlayerHitboxHitT(
        new THREE.Vector3(0.901, 0, 0),
        new THREE.Vector3(0.901, 0, -20),
        position,
        0,
    ), null, 'a shot immediately outside the side misses');
});

test('player hitbox rotates with the bean', () => {
    const position = new THREE.Vector3(3, 2, -8);
    const yaw = Math.PI / 2;
    assert.notEqual(segmentPlayerHitboxHitT(
        new THREE.Vector3(0, 2, -8),
        new THREE.Vector3(6, 2, -8),
        position,
        yaw,
    ), null);
    assert.equal(segmentPlayerHitboxHitT(
        new THREE.Vector3(0, 3.651, -8),
        new THREE.Vector3(6, 3.651, -8),
        position,
        yaw,
    ), null);
});
