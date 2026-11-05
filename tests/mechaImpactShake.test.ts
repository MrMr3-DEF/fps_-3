import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { CameraShake } from '../src/cameraShake.ts';
import { triggerMechaImpactShake } from '../src/mechaImpactShake.ts';
import { ForgottenMecha, type MechaImpact } from '../src/forgottenMecha.ts';
import { loadIronmawTestAsset } from './ironmawTestAsset.ts';

function sample(kind: MechaImpact, distance: number, height = 2, elapsed = 0.05): number {
    const center = new THREE.Vector3(300, 0, -400);
    const player = center.clone().add(new THREE.Vector3(distance * 0.6, height, distance * 0.8));
    const shake = new CameraShake(), camera = new THREE.PerspectiveCamera();
    triggerMechaImpactShake(shake, kind, player, center);
    shake.update(elapsed); shake.apply(camera);
    return new THREE.Quaternion().angleTo(camera.quaternion);
}

test('both defeat contacts reach 200 m horizontally with identical airborne feedback', () => {
    for (const kind of ['knees', 'fists'] as const) {
        const near = sample(kind, 0), distant = sample(kind, 150), edge = sample(kind, 200);
        assert.ok(near > distant && distant > edge && edge > 0.005);
        for (const distance of [0, 50, 150, 200]) {
            for (const height of [28, 80, 250]) assert.equal(sample(kind, distance, height), sample(kind, distance));
        }
        assert.equal(sample(kind, 200.01, 80), 0);
        assert.ok(sample(kind, 150, 80, 0.5) > 0);
        assert.equal(sample(kind, 150, 80, 0.65), 0);
    }
});

test('ordinary steps and wall punches add no gameplay shake; stomp keeps its 50 m reach', () => {
    assert.equal(sample('step', 0), 0); assert.equal(sample('punch', 0), 0);
    assert.ok(sample('stomp', 50, 80) > 0);
    assert.equal(sample('stomp', 50.01), 0);
    const expected = new CameraShake(), camera = new THREE.PerspectiveCamera();
    expected.trigger(0.065 * (1 - 0.65), 0.85); expected.update(0.05); expected.apply(camera);
    assert.equal(sample('stomp', 50), new THREE.Quaternion().angleTo(camera.quaternion));
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

test('real Death clip triggers separate knee/fist pulses at the authored cues across frame rates', async () => {
    for (const steps of [[1 / 30], [1 / 144], [0.016, 0.05, 0.09, 0.025]]) {
        const impacts: Array<{ kind: MechaImpact; time: number; angle: number }> = [];
        const camera = new THREE.PerspectiveCamera(), shake = new CameraShake();
        const player = { position: new THREE.Vector3(150, 80, 0), alive: true, grounded: false };
        const actor = new ForgottenMecha([], [], 42, {
            impact(kind) {
                triggerMechaImpactShake(shake, kind, player.position, actor.group.position);
                camera.quaternion.identity(); shake.apply(camera);
                impacts.push({ kind, time: actor.elapsed, angle: new THREE.Quaternion().angleTo(camera.quaternion) });
            }, stompPlayer() { assert.fail('defeat must not damage the airborne observer'); }, gameOver() { assert.fail('defeat must not end the match'); },
        });
        actor.install(await loadIronmawTestAsset()); actor.group.position.set(0, 0, 0);
        try {
            actor.damage(50);
            for (let time = 0, i = 0; time < 8; i++) {
                const delta = steps[i % steps.length];
                shake.update(delta); actor.update(delta, player); time += delta;
            }
            assert.equal(actor.mode, 'dead');
            assert.deepEqual(impacts.map(p => p.kind), ['knees', 'fists']);
            for (const [i, cue] of [40 / 24, 64 / 24].entries()) {
                assert.ok(impacts[i].time >= cue - 1e-9 && impacts[i].time <= cue + Math.max(...steps) + 1e-9);
                assert.ok(impacts[i].angle > 0.005, `${impacts[i].kind} must visibly shake at 150 m while airborne`);
            }
            camera.quaternion.identity(); shake.apply(camera);
            assert.equal(new THREE.Quaternion().angleTo(camera.quaternion), 0);
        } finally { actor.dispose(); }
    }
});
