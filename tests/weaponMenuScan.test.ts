import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import {
    createWeaponScanGeometry,
    fitWeaponPreviewDistance,
    getVisibleWeaponBounds,
    projectWeaponScanBounds,
} from '../src/weaponMenuScan.js';

test('weapon scan radius uses visible mesh vertices, not dormant muzzle effects or empty box corners', () => {
    const gun = new THREE.Group();
    gun.add(new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.3, 2)));
    const dormantFlash = new THREE.Mesh(new THREE.RingGeometry(0.5, 20));
    dormantFlash.visible = false;
    gun.add(dormantFlash);

    const bounds = getVisibleWeaponBounds(gun);
    assert.ok(bounds.max.x <= 0.11);
    assert.ok(bounds.max.z <= 1.01);
    assert.ok(Math.abs(createWeaponScanGeometry(gun).radius - Math.hypot(0.1, 0.15, 1)) < 1e-6);
});

test('a shared camera gives differently sized guns their own scan boxes', () => {
    const width = 821, height = 400;
    const camera = new THREE.PerspectiveCamera(34, width / height, 0.1, 100);
    camera.position.z = fitWeaponPreviewDistance(1.45, width, height, camera.fov);
    camera.position.x = -camera.position.z * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * camera.aspect * 0.5;
    camera.lookAt(camera.position.x, 0, 0);
    camera.updateProjectionMatrix();
    camera.updateMatrixWorld();
    const pistol = { left: 0, top: 0, right: 0, bottom: 0 };
    const sniper = { ...pistol };
    assert.equal(projectWeaponScanBounds({ radius: 0.99 }, camera, width, height, pistol), true);
    assert.equal(projectWeaponScanBounds({ radius: 1.42 }, camera, width, height, sniper), true);
    assert.ok(sniper.right - sniper.left > pistol.right - pistol.left);
    assert.ok(sniper.bottom - sniper.top > pistol.bottom - pistol.top);
});

test('each gun keeps one tight scan box that contains its vertices through full rotation', () => {
    const gun = new THREE.Group();
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.35, 2.3));
    body.position.set(0, -0.08, -0.15);
    gun.add(body);
    const geometry = createWeaponScanGeometry(gun);
    const bounds = { left: 0, top: 0, right: 0, bottom: 0 };
    const yaw = new THREE.Quaternion();
    const pitch = new THREE.Quaternion();
    const rotation = new THREE.Quaternion();
    const screen = new THREE.Vector3();
    const vertex = new THREE.Vector3();
    const positions = body.geometry.getAttribute('position');

    for (const [width, height] of [[687, 909], [821, 400]] as const) {
        const camera = new THREE.PerspectiveCamera(34, width / height, 0.1, 100);
        camera.position.z = fitWeaponPreviewDistance(geometry.radius, width, height, camera.fov);
        camera.position.x = -camera.position.z * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * camera.aspect * 0.5;
        camera.lookAt(camera.position.x, 0, 0);
        camera.updateProjectionMatrix();
        camera.updateMatrixWorld();

        assert.equal(projectWeaponScanBounds(geometry, camera, width, height, bounds), true);
        const fixedBounds = { ...bounds };
        assert.ok(bounds.left >= width / 2, `scan stays in right half at ${width}x${height}`);
        assert.ok(bounds.right <= width, `scan stays inside viewport at ${width}x${height}`);
        for (let yi = 0; yi < 12; yi++) {
            for (let pi = 0; pi < 12; pi++) {
                yaw.setFromAxisAngle(new THREE.Vector3(0, 1, 0), yi * Math.PI / 6);
                pitch.setFromAxisAngle(new THREE.Vector3(1, 0, 0), pi * Math.PI / 6);
                gun.quaternion.copy(rotation.copy(yaw).multiply(pitch));
                gun.updateWorldMatrix(true, true);
                assert.equal(projectWeaponScanBounds(geometry, camera, width, height, bounds), true);
                assert.deepEqual(bounds, fixedBounds, 'frame does not react to rotation');
                for (let i = 0; i < positions.count; i++) {
                    vertex.fromBufferAttribute(positions, i).applyMatrix4(body.matrixWorld);
                    screen.copy(vertex).project(camera);
                    const x = (screen.x + 1) * width / 2;
                    const y = (1 - screen.y) * height / 2;
                    assert.ok(x > bounds.left && x < bounds.right);
                    assert.ok(y > bounds.top && y < bounds.bottom);
                }
            }
        }
    }
});
