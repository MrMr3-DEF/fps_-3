import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { state } from '../src/state.ts';
import { userSettings, getParticleLimit } from '../src/settings.ts';
import { spawnMechaArmorImpact, spawnParticles, updateParticles, disposeParticles } from '../src/particles.ts';

const point = new THREE.Vector3(10, 24, -8), incoming = new THREE.Vector3(0, 0, -1);

test('armor particles expire, release scene resources and do not leak pooled transforms', () => {
    const amount = userSettings.particleAmount;
    state.scene = new THREE.Scene(); userSettings.particleAmount = 1;
    try {
        spawnMechaArmorImpact(point, incoming);
        assert.ok(state.activeParticles.length > 0);
        updateParticles(0.05);
        const mesh = state.scene.children.find(o => o instanceof THREE.InstancedMesh) as THREE.InstancedMesh;
        assert.equal(mesh.count, state.activeParticles.length);
        // Reusing a slot for generic particles must clear the armor-specific transform.
        spawnParticles(point, 0xffffff, 1, 1, 0.1, 1); updateParticles(0.01);
        const matrix = new THREE.Matrix4(), pos = new THREE.Vector3(), q = new THREE.Quaternion(), scale = new THREE.Vector3();
        mesh.getMatrixAt(state.activeParticles.length - 1, matrix); matrix.decompose(pos, q, scale);
        assert.ok(q.angleTo(new THREE.Quaternion()) < 1e-6);
        assert.ok(Math.abs(scale.y - scale.x) < 1e-6);
        const expiry = Math.max(...state.activeParticles.map(p => p.maxLife));
        updateParticles(expiry + 1);
        assert.equal(state.activeParticles.length, 0);
        assert.equal(mesh.count, 0);
        spawnMechaArmorImpact(point, incoming);
        assert.ok(state.activeParticles.length > 0);
        disposeParticles();
        assert.equal(state.activeParticles.length, 0);
        assert.equal(state.scene.children.length, 0);
    } finally { disposeParticles(); state.scene = null; userSettings.particleAmount = amount; }
});

test('repeated armor hits share the graphics budget and scale both dust and sparks with quality', () => {
    const amount = userSettings.particleAmount;
    state.scene = new THREE.Scene(); userSettings.particleAmount = 0.2;
    try {
        spawnMechaArmorImpact(point, incoming);
        assert.ok(state.activeParticles.some(p => p.kind === 'armor-spark'));
        assert.ok(state.activeParticles.some(p => p.kind === 'dust'));
        for (let i = 0; i < 200; i++) spawnMechaArmorImpact(point, incoming);
        assert.equal(state.activeParticles.length, getParticleLimit());
        updateParticles(0.1);
        assert.equal((state.scene.children[0] as THREE.InstancedMesh).count, getParticleLimit());
        updateParticles(1); assert.equal(state.activeParticles.length, 0);
        spawnMechaArmorImpact(point, new THREE.Vector3()); assert.equal(state.activeParticles.length, 0);
        spawnMechaArmorImpact(point, { x: NaN, y: 0, z: 1 }); assert.equal(state.activeParticles.length, 0);
    } finally { disposeParticles(); state.scene = null; userSettings.particleAmount = amount; }
});
