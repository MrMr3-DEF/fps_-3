import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { state } from '../src/state.ts';
import { createEnvironment, rebuildEnvironmentWithSeed, disposeWorld, gothGirlfriend, updateEnvironmentVisibility, queryObstaclesAlongSegment } from '../src/world.ts';
import { GothGirlfriend } from '../src/gothGirlfriend.ts';

const context = new Proxy({}, { get: () => () => {} });
Object.assign(globalThis, { document: { getElementById: () => null, createElement: () => ({ getContext: () => context }) } });

test('NPC presentation and fill light follow chunks while the independently owned collider remains active', async () => {
    const originalLoad = GothGirlfriend.prototype.load;
    GothGirlfriend.prototype.load = async () => {};
    Object.assign(globalThis, { window: {} });
    state.scene = new THREE.Scene(); state.isMultiplayer = true;
    try {
        rebuildEnvironmentWithSeed(42);
        const npc = gothGirlfriend!, fill = npc.group.children.find(object => object instanceof THREE.PointLight)!;
        assert.ok(fill);
        updateEnvironmentVisibility(npc.group.position.clone(), 1);
        assert.equal(npc.group.visible, true); assert.equal(fill.parent, npc.group);
        updateEnvironmentVisibility(new THREE.Vector3(1600, 0, 1600), 1);
        assert.equal(npc.group.visible, false); assert.equal(fill.parent!.visible, false);
        const position = npc.hitbox.position;
        assert.ok(queryObstaclesAlongSegment(position.x - 2, position.z, position.x + 2, position.z).includes(npc.hitbox));
        let geometryDisposals = 0, materialDisposals = 0;
        npc.hitbox.geometry.addEventListener('dispose', () => geometryDisposals++);
        (npc.hitbox.material as THREE.Material).addEventListener('dispose', () => materialDisposals++);
        disposeWorld(); disposeWorld();
        assert.equal(geometryDisposals, 1); assert.equal(materialDisposals, 1);
        assert.equal(npc.group.parent, null);
    } finally {
        disposeWorld(); GothGirlfriend.prototype.load = originalLoad;
        delete (globalThis as any).window; state.isMultiplayer = false;
    }
});

test('fresh builder rejects an existing world and disposal still owns its roots after the scene reference is cleared', () => {
    state.scene = new THREE.Scene(); state.isMultiplayer = true;
    try {
        rebuildEnvironmentWithSeed(42);
        const scene = state.scene, collider = state.obstacles.find(object => object instanceof THREE.Mesh) as THREE.Mesh;
        const count = scene.children.length; let disposed = 0;
        collider.geometry.addEventListener('dispose', () => disposed++);
        assert.throws(() => createEnvironment(true), /World already exists/);
        assert.equal(scene.children.length, count);
        state.scene = null; disposeWorld(); disposeWorld();
        assert.equal(disposed, 1); assert.equal(collider.parent, null);
        assert.equal(state.targets.length, 0); assert.equal(state.obstacles.length, 0);
        assert.equal(scene.children.length, 0);
    } finally { disposeWorld(); state.isMultiplayer = false; }
});
