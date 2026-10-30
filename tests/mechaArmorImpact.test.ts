import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { state } from '../src/state.ts';
import { MECHA_ARMOR_IMPACT } from '../src/config.ts';
import { userSettings, getParticleLimit } from '../src/settings.ts';
import { spawnMechaArmorImpact, spawnParticles, updateParticles, disposeParticles } from '../src/particles.ts';

const point = new THREE.Vector3(10, 24, -8), incoming = new THREE.Vector3(0, 0, -1);

test('armor impacts scatter warm elongated sparks and dust outward, fall, cool and expire in world space', () => {
    const amount = userSettings.particleAmount;
    state.scene = new THREE.Scene(); userSettings.particleAmount = 1;
    try {
        spawnMechaArmorImpact(point, incoming);
        const sparks = state.activeParticles.filter(p => p.kind === 'armor-spark');
        const dust = state.activeParticles.filter(p => p.kind === 'dust');
        assert.equal(sparks.length, 14); assert.equal(dust.length, 6);
        for (const p of sparks) {
            assert.ok(MECHA_ARMOR_IMPACT.sparkColors.includes(p.color as any));
            assert.ok(p.maxLife >= 0.25 && p.maxLife <= 0.55);
            assert.ok(p.length! > p.size!); assert.ok(p.vz! > 0);
        }
        for (const p of dust) {
            assert.ok(MECHA_ARMOR_IMPACT.dustColors.includes(p.color as any));
            assert.ok(p.maxLife >= 0.4 && p.maxLife <= 0.8); assert.ok(p.vz! > 0);
        }
        const spark = sparks[0], vy = spark.vy!, vz = spark.vz!;
        updateParticles(0.05);
        assert.ok(Math.abs(spark.vy! - (vy - MECHA_ARMOR_IMPACT.sparkGravity * 0.05)) < 1e-8);
        assert.ok(Math.abs(spark.z! - (point.z + MECHA_ARMOR_IMPACT.surfaceOffset + vz * 0.05)) < 1e-8);
        const mesh = state.scene.children.find(o => o instanceof THREE.InstancedMesh) as THREE.InstancedMesh;
        assert.equal(mesh.count, 20);
        const matrix = new THREE.Matrix4(), pos = new THREE.Vector3(), q = new THREE.Quaternion(), scale = new THREE.Vector3();
        mesh.getMatrixAt(state.activeParticles.indexOf(spark), matrix); matrix.decompose(pos, q, scale);
        assert.ok(scale.y > scale.x);
        const forward = new THREE.Vector3(0, 1, 0).applyQuaternion(q);
        assert.ok(forward.dot(new THREE.Vector3(spark.vx, spark.vy, spark.vz).normalize()) > 0.99999);
        const color = new THREE.Color(); mesh.getColorAt(state.activeParticles.indexOf(spark), color);
        assert.notEqual(color.getHex(), spark.color, 'hot sparks cool toward orange as they age');
        // Generic pooled particles must not inherit an armor spark's rotation/length.
        spawnParticles(point, 0xffffff, 1, 1, 0.1, 1); updateParticles(0.01);
        mesh.getMatrixAt(state.activeParticles.length - 1, matrix); matrix.decompose(pos, q, scale);
        assert.ok(q.angleTo(new THREE.Quaternion()) < 1e-6); assert.ok(Math.abs(scale.y - scale.x) < 1e-6);
        updateParticles(1); assert.equal(state.activeParticles.length, 0); assert.equal(mesh.count, 0);
        spawnMechaArmorImpact(point, incoming); assert.equal(state.activeParticles.length, 20);
        disposeParticles(); assert.equal(state.activeParticles.length, 0); assert.equal(state.scene.children.length, 0);
    } finally { disposeParticles(); state.scene = null; userSettings.particleAmount = amount; }
});

test('repeated armor hits share the graphics budget and scale both dust and sparks with quality', () => {
    const amount = userSettings.particleAmount;
    state.scene = new THREE.Scene(); userSettings.particleAmount = 0.2;
    try {
        spawnMechaArmorImpact(point, incoming);
        assert.equal(state.activeParticles.filter(p => p.kind === 'armor-spark').length, 3);
        assert.equal(state.activeParticles.filter(p => p.kind === 'dust').length, 2);
        for (let i = 0; i < 200; i++) spawnMechaArmorImpact(point, incoming);
        assert.equal(state.activeParticles.length, getParticleLimit());
        updateParticles(0.1);
        assert.equal((state.scene.children[0] as THREE.InstancedMesh).count, getParticleLimit());
        updateParticles(1); assert.equal(state.activeParticles.length, 0);
        spawnMechaArmorImpact(point, new THREE.Vector3()); assert.equal(state.activeParticles.length, 0);
        spawnMechaArmorImpact(point, { x: NaN, y: 0, z: 1 }); assert.equal(state.activeParticles.length, 0);
    } finally { disposeParticles(); state.scene = null; userSettings.particleAmount = amount; }
});
