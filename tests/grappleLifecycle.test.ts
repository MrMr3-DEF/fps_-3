import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { state } from '../src/state.js';
import { respawnTarget } from '../src/world.js';
import { updateHook } from '../src/grapple.js';

Object.defineProperty(globalThis, 'document', { configurable: true, value: { getElementById: () => null } });
function target() {
    const group = new THREE.Group();
    group.position.set(0, 5, -30);
    group.userData = {
        bodyMesh: new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshStandardMaterial()),
        healthBarGroup: new THREE.Group(), healthBarFg: new THREE.Mesh(), hp: 0,
    };
    return group;
}

for (const phase of ['FIRING', 'PULLING'] as const) {
    test(`respawning a grapple target cancels ${phase} before its object is reused`, () => {
        const enemy = target();
        state.scene = new THREE.Scene();
        state.camera = new THREE.PerspectiveCamera();
        state.controls = { getObject: () => state.camera } as any;
        state.hookMesh = new THREE.Mesh(new THREE.CylinderGeometry(), new THREE.MeshBasicMaterial());
        state.scene.add(state.hookMesh);
        state.hookState = phase;
        state.hookIsEnemy = state.hookWillHit = true;
        state.hookTargetEnemy = enemy;
        state.hookTarget.copy(enemy.position);
        state.hookPosition.copy(enemy.position);
        state.velocity.set(2, 3, 4);
        respawnTarget(enemy);
        assert.equal(state.hookState, 'IDLE');
        assert.equal(state.hookTargetEnemy, null);
        assert.equal(state.hookIsEnemy, false);
        assert.equal(state.hookWillHit, false);
        assert.equal(state.hookMesh.parent, null);
        updateHook(0.05);
        updateHook(0.05);
        assert.deepEqual(state.velocity.toArray(), [2, 3, 4], 'must not accelerate toward the new spawn');
    });
}

test('respawning a different target leaves an existing grapple alone', () => {
    const hooked = target();
    state.hookState = 'FIRING';
    state.hookIsEnemy = state.hookWillHit = true;
    state.hookTargetEnemy = hooked;
    respawnTarget(target());
    assert.equal(state.hookState, 'FIRING');
    assert.equal(state.hookTargetEnemy, hooked);
});
