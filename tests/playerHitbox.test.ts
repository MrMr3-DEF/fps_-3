import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { PLAYER_STANDING_HEIGHT } from '../src/config.js';
import { attachPlayerAvatar } from '../src/playerAvatar.ts';
import { loadCyborgTestAssets, armorBounds } from './cyborgTestAsset.ts';
import {
    PLAYER_HITBOX_MAX,
    PLAYER_HITBOX_MIN,
    segmentPlayerHitboxHitT,
} from '../src/playerHitbox.ts';

test('standing cyborg armor fits the gameplay hitbox at its visor-calibrated scale', async () => {
    await loadCyborgTestAssets();
    const shell = new THREE.Group(), avatar = attachPlayerAvatar(shell, 0x123456)!;
    avatar.rig.pose({body:'Idle.Armed', bodyTime:0, weapon:'AR', action:'Ready'});
    const bounds = armorBounds(shell);
    assert.ok(Math.abs(bounds.max.y - bounds.min.y - PLAYER_STANDING_HEIGHT) < .01, 'sole-to-crown height');
    const combat = new THREE.Box3(new THREE.Vector3(PLAYER_HITBOX_MIN.x, PLAYER_HITBOX_MIN.y, PLAYER_HITBOX_MIN.z),
        new THREE.Vector3(PLAYER_HITBOX_MAX.x, PLAYER_HITBOX_MAX.y, PLAYER_HITBOX_MAX.z));
    assert.ok(combat.clone().expandByScalar(.012).containsBox(bounds), 'combat box encloses armed suit');
    assert.ok(combat.max.y - bounds.max.y < .12 && bounds.min.y - combat.min.y < .06, 'sole and crown match');
    avatar.dispose();
});

test('player hitbox covers the cyborg from sole to crown without extra side room', () => {
    const position = new THREE.Vector3(0, 0, -10);
    assert.notEqual(segmentPlayerHitboxHitT(
        new THREE.Vector3(0, PLAYER_HITBOX_MAX.y - .01, 0),
        new THREE.Vector3(0, PLAYER_HITBOX_MAX.y - .01, -20),
        position,
        0,
    ), null, 'upper head is hittable');
    assert.notEqual(segmentPlayerHitboxHitT(
        new THREE.Vector3(0, PLAYER_HITBOX_MIN.y + .01, 0),
        new THREE.Vector3(0, PLAYER_HITBOX_MIN.y + .01, -20),
        position,
        0,
    ), null, 'boots are hittable');
    assert.equal(segmentPlayerHitboxHitT(
        new THREE.Vector3(PLAYER_HITBOX_MAX.x + .001, 0, 0),
        new THREE.Vector3(PLAYER_HITBOX_MAX.x + .001, 0, -20),
        position,
        0,
    ), null, 'a shot immediately outside the side misses');
});

test('empty space in the bounding cuboid corners is part of the hitbox', () => {
    const position = new THREE.Vector3(0, 0, -10);
    // At this height the helmet is much narrower than the full body
    // width. A mesh-shaped collider would miss; the requested cuboid hits.
    assert.notEqual(segmentPlayerHitboxHitT(
        new THREE.Vector3(PLAYER_HITBOX_MAX.x - .01, PLAYER_HITBOX_MAX.y - .01, 0),
        new THREE.Vector3(PLAYER_HITBOX_MAX.x - .01, PLAYER_HITBOX_MAX.y - .01, -20),
        position,
        0,
    ), null);
});

test('player hitbox rotates with the cyborg', () => {
    const position = new THREE.Vector3(3, 2, -8);
    const yaw = Math.PI / 2;
    assert.notEqual(segmentPlayerHitboxHitT(
        new THREE.Vector3(0, 2, -8),
        new THREE.Vector3(6, 2, -8),
        position,
        yaw,
    ), null);
    assert.equal(segmentPlayerHitboxHitT(
        new THREE.Vector3(0, 2 + PLAYER_HITBOX_MAX.y + .001, -8),
        new THREE.Vector3(6, 2 + PLAYER_HITBOX_MAX.y + .001, -8),
        position,
        yaw,
    ), null);
});
