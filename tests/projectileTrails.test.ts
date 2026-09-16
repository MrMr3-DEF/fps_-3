import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {
    appendCurvedProjectileTrail,
    appendProjectileTrail,
    beginProjectileTrail,
    disposeProjectileTrails,
    retireProjectileTrail,
    setProjectileTrailsEnabled,
    updateProjectileTrails,
} from '../src/projectileTrails.ts';

test('projectile tracers retain a clipped curved path, fade after impact and reuse their line', () => {
    const scene = new THREE.Scene();
    const projectile = new THREE.Object3D();
    const line = beginProjectileTrail(projectile, scene, 0x00ff88)!;
    assert.equal(line.parent, scene);

    projectile.position.set(60, 0, 0);
    appendProjectileTrail(projectile);
    projectile.position.set(120, 20, 0);
    appendProjectileTrail(projectile);
    assert.equal(line.geometry.drawRange.count, 3);
    const positions = line.geometry.getAttribute('position') as THREE.BufferAttribute;
    assert.ok(positions.getX(0) > 30, 'the visible tail is clipped to its maximum world length');
    assert.equal(positions.getX(2), 120);
    assert.equal(positions.getY(2), 20, 'the recorded geometry preserves projectile turns');

    retireProjectileTrail(projectile);
    updateProjectileTrails(0.08);
    assert.equal(line.parent, scene);
    assert.ok(line.material.opacity > 0 && line.material.opacity < 0.95);
    updateProjectileTrails(0.09);
    assert.equal(line.parent, null);
    assert.equal(line.visible, false);

    const nextProjectile = new THREE.Object3D();
    const reusedLine = beginProjectileTrail(nextProjectile, scene, 0xff6600)!;
    assert.equal(reusedLine, line);
    disposeProjectileTrails();
    assert.equal(reusedLine.parent, null);
});

test('homing tracer samples form a smooth cubic arc inside one simulation frame', () => {
    const scene = new THREE.Scene();
    const projectile = new THREE.Object3D();
    const line = beginProjectileTrail(projectile, scene, 0xff0055)!;
    const start = new THREE.Vector3();
    projectile.position.set(10, 10, 0);
    appendCurvedProjectileTrail(
        projectile,
        start,
        new THREE.Vector3(1, 0, 0),
        new THREE.Vector3(0, 1, 0),
    );

    assert.equal(line.geometry.drawRange.count, 4);
    const positions = line.geometry.getAttribute('position') as THREE.BufferAttribute;
    assert.ok(positions.getX(1) > positions.getY(1), 'first sample follows the starting tangent');
    assert.ok(positions.getY(2) < positions.getX(2), 'second sample bends progressively toward the end tangent');
    assert.equal(positions.getX(3), 10);
    assert.equal(positions.getY(3), 10);
    disposeProjectileTrails();
});

test('disabled bullet trails allocate nothing and clear an existing trail immediately', () => {
    const scene = new THREE.Scene();
    const firstProjectile = new THREE.Object3D();
    const line = beginProjectileTrail(firstProjectile, scene, 0xffffff)!;
    assert.equal(line.parent, scene);

    setProjectileTrailsEnabled(false);
    assert.equal(line.parent, null);
    assert.equal(beginProjectileTrail(new THREE.Object3D(), scene, 0xffffff), null);

    setProjectileTrailsEnabled(true);
    const restoredLine = beginProjectileTrail(new THREE.Object3D(), scene, 0xffffff);
    assert.ok(restoredLine);
    disposeProjectileTrails();
});
