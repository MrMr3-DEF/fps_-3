import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { CameraShake } from '../src/cameraShake.ts';
import { triggerMechaImpactShake } from '../src/mechaImpactShake.ts';
import { type MechaImpact } from '../src/forgottenMecha.ts';
import { MECHA_PILOT_STOMP_RADIUS, MECHA_STOMP_RADIUS } from '../src/config.ts';

function sample(kind: MechaImpact, distance: number, height = 2, elapsed = 0.05): number {
    const center = new THREE.Vector3(300, 0, -400);
    const player = center.clone().add(new THREE.Vector3(distance * 0.6, height, distance * 0.8));
    const shake = new CameraShake(), camera = new THREE.PerspectiveCamera();
    triggerMechaImpactShake(shake, kind, player, center);
    shake.update(elapsed); shake.apply(camera);
    return new THREE.Quaternion().angleTo(camera.quaternion);
}

test('mounted stomp shake reaches its wider floor radius while enemy stomps keep 50m', () => {
    const center = new THREE.Vector3(0, 0, 0), player = new THREE.Vector3(42, 2, 56), camera = new THREE.PerspectiveCamera();
    const base = new CameraShake(), pilot = new CameraShake();
    triggerMechaImpactShake(base, 'stomp', player, center, MECHA_STOMP_RADIUS);
    triggerMechaImpactShake(pilot, 'stomp', player, center, MECHA_PILOT_STOMP_RADIUS);
    base.update(0.05); pilot.update(0.05); base.apply(camera); assert.ok(camera.quaternion.angleTo(new THREE.Quaternion()) < 1e-7);
    pilot.apply(camera); assert.ok(camera.quaternion.angleTo(new THREE.Quaternion()) > 0.005);
});

test('defeat shake expires and reset removes both pending pulses without moving the camera', () => {
    const shake = new CameraShake(), camera = new THREE.PerspectiveCamera();
    camera.position.set(150, 80, 0); camera.rotation.set(0.2, 0.3, 0);
    const pose = camera.quaternion.clone(), position = camera.position.clone();
    for (const kind of ['knees', 'fists'] as const) triggerMechaImpactShake(shake, kind, camera.position, new THREE.Vector3());
    shake.update(0.1); shake.apply(camera);
    assert.ok(camera.quaternion.angleTo(pose) > 0.005); assert.deepEqual(camera.position, position);
    camera.quaternion.copy(pose); shake.reset(); shake.apply(camera);
    assert.ok(camera.quaternion.angleTo(pose) < 1e-7);
});
