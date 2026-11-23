import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { appendProjectileTrail, beginProjectileTrail, disposeProjectileTrails, retireProjectileTrail, setProjectileTrailsEnabled, syncPendingProjectileTrailOrigins, updateProjectileTrails } from '../src/projectileTrails.ts';

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

test('straight tracers keep the visible muzzle in one segment before and after clipping', () => {
    const scene = new THREE.Scene();
    const muzzle = new THREE.Vector3(0.4, 0.3, -0.2);
    const projectile = new THREE.Object3D();
    projectile.position.copy(muzzle);
    const line = beginProjectileTrail(projectile, scene, 0xffffff)!;
    const positions = line.geometry.getAttribute('position') as THREE.BufferAttribute;
    const appendAt = (distance: number) => {
        projectile.position.set(muzzle.x, muzzle.y, muzzle.z + distance);
        appendProjectileTrail(projectile, true);
    };

    appendAt(20);
    assert.equal(line.geometry.drawRange.count, 2);
    assert.ok(Math.abs(positions.getZ(0) - muzzle.z) < 1e-6);
    for (let distance = 30; distance <= 80; distance += 10) {
        appendAt(distance);
        assert.equal(line.geometry.drawRange.count, 2, 'a straight step must replace the head, not add a corner');
    }
    assert.ok(Math.abs(positions.getZ(1) - (muzzle.z + 80)) < 1e-4);

    appendAt(100);
    assert.equal(line.geometry.drawRange.count, 2, 'the clipped tail is not duplicated');
    assert.ok(Math.abs(positions.getZ(0) - (muzzle.z + 10)) < 1e-4);
    assert.ok(Math.abs(positions.getX(0) - muzzle.x) < 1e-6);
    assert.ok(Math.abs(positions.getY(0) - muzzle.y) < 1e-6);
    assert.ok(Math.abs(positions.getZ(1) - (muzzle.z + 100)) < 1e-4);
    disposeProjectileTrails();
});

test('pending tracer origins sync once, including a trail retired on its birth frame', () => {
    const scene = new THREE.Scene();
    const projectile = new THREE.Object3D();
    projectile.position.set(1, 2, 3);
    const line = beginProjectileTrail(projectile, scene, 0xffffff, 'AR')!;
    projectile.position.set(1, 2, 23);
    appendProjectileTrail(projectile, true);
    retireProjectileTrail(projectile);

    const resolved: string[] = [];
    const renderedMuzzle = new THREE.Vector3(4, 5, 6);
    const resolveOrigin = (weapon: string, out: THREE.Vector3) => {
        resolved.push(weapon);
        out.copy(renderedMuzzle);
        return true;
    };
    syncPendingProjectileTrailOrigins(resolveOrigin);
    const positions = line.geometry.getAttribute('position') as THREE.BufferAttribute;
    assert.deepEqual(resolved, ['AR']);
    assert.equal(positions.getX(0), 4);
    assert.equal(positions.getY(0), 5);
    assert.equal(positions.getZ(0), 6);
    assert.equal(line.geometry.drawRange.count, 2);

    syncPendingProjectileTrailOrigins(resolveOrigin);
    assert.deepEqual(resolved, ['AR'], 'a corrected origin must never be resolved again');
    assert.equal(positions.getX(0), 4);
    assert.equal(positions.getY(0), 5);
    assert.equal(positions.getZ(0), 6);
    disposeProjectileTrails();
});
