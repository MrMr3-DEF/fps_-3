import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { classifyOutOfRange, createScreenBounds, distanceToOrientedBox, projectStableTargetEnvelopeToScreen, projectStableTargetSphereToScreen, type ScreenBounds } from '../src/smartGogglesMath.ts';

const near = (actual: number, expected: number, epsilon = 1e-7) => {
    assert.ok(Math.abs(actual - expected) <= epsilon, `${actual} != ${expected}`);
};

function camera(): THREE.PerspectiveCamera {
    const result = new THREE.PerspectiveCamera(90, 1, 0.1, 100);
    result.updateProjectionMatrix();
    result.updateMatrixWorld(true);
    return result;
}

function box(halfSize = 1): THREE.Box3 {
    return new THREE.Box3(
        new THREE.Vector3(-halfSize, -halfSize, -halfSize),
        new THREE.Vector3(halfSize, halfSize, halfSize),
    );
}

function visibleBounds(localSphere: THREE.Sphere, matrix: THREE.Matrix4): ScreenBounds {
    const bounds = createScreenBounds();
    assert.ok(projectStableTargetSphereToScreen(localSphere, matrix, camera(), 200, 200, bounds));
    return bounds;
}

test('stable maximum envelope does not jiggle when a cube spins', () => {
    const maximumCubeEnvelope = new THREE.Sphere(new THREE.Vector3(), Math.sqrt(3));
    const stationary = new THREE.Matrix4().makeTranslation(0, 0, -10);
    const spinning = new THREE.Matrix4().compose(
        new THREE.Vector3(0, 0, -10),
        new THREE.Quaternion().setFromEuler(new THREE.Euler(0.8, 1.1, 0.4)),
        new THREE.Vector3(1, 1, 1),
    );
    const stationaryBounds = visibleBounds(maximumCubeEnvelope, stationary);
    const spinningBounds = visibleBounds(maximumCubeEnvelope, spinning);
    const halfSize = 100 * Math.sqrt(3) / Math.sqrt(100 - 3);
    near(stationaryBounds.left, 100 - halfSize);
    near(stationaryBounds.right, 100 + halfSize);
    near(stationaryBounds.width, halfSize * 2);
    assert.deepEqual(spinningBounds, stationaryBounds);
});

test('stable rectangular envelope preserves a tall target silhouette', () => {
    const envelope = { center: new THREE.Vector3(), halfWidth: 0.7, halfHeight: 1.8 };
    const stationary = new THREE.Matrix4().makeTranslation(0, 0, -10);
    const rotated = new THREE.Matrix4().compose(
        new THREE.Vector3(0, 0, -10),
        new THREE.Quaternion().setFromEuler(new THREE.Euler(0, 1.2, 0)),
        new THREE.Vector3(1, 1, 1),
    );
    const initial = createScreenBounds();
    const turning = createScreenBounds();
    assert.equal(projectStableTargetEnvelopeToScreen(envelope, stationary, camera(), 200, 200, initial), true);
    assert.equal(projectStableTargetEnvelopeToScreen(envelope, rotated, camera(), 200, 200, turning), true);
    assert.deepEqual(turning, initial, 'target yaw cannot resize the overlay');
    assert.ok(initial.height > initial.width * 2, 'corners retain the target’s tall proportions');
});

test('keeps a partially offscreen envelope full-size and rejects it once fully outside', () => {
    const envelope = new THREE.Sphere(new THREE.Vector3(), 1);
    const centered = visibleBounds(envelope, new THREE.Matrix4().makeTranslation(0, 0, -10));
    const partial = visibleBounds(envelope, new THREE.Matrix4().makeTranslation(10, 0, -10));
    assert.ok(partial.left < 200);
    assert.ok(partial.right > 200);
    near(partial.width, centered.width * Math.sqrt(99 / 199));

    const outside = createScreenBounds();
    assert.equal(projectStableTargetSphereToScreen(
        envelope,
        new THREE.Matrix4().makeTranslation(30, 0, -10),
        camera(),
        200,
        200,
        outside,
    ), false);
    assert.deepEqual(outside, createScreenBounds());
});

test('rejects envelopes behind the camera and safely handles a near-plane crossing', () => {
    const envelope = new THREE.Sphere(new THREE.Vector3(), 1);
    const behind = createScreenBounds();
    assert.equal(projectStableTargetSphereToScreen(
        envelope,
        new THREE.Matrix4().makeTranslation(0, 0, 10),
        camera(),
        200,
        200,
        behind,
    ), false);

    const nearPlane = visibleBounds(
        new THREE.Sphere(new THREE.Vector3(), 0.15),
        new THREE.Matrix4().makeTranslation(0, 0, -0.2),
    );
    for (const value of Object.values(nearPlane)) assert.ok(Number.isFinite(value));
    assert.ok(nearPlane.left < 0 && nearPlane.top < 0);
    assert.ok(nearPlane.right > 200 && nearPlane.bottom > 200);
    assert.ok(nearPlane.width > 0 && nearPlane.height > 0);
});

test('computes world distance to a translated, rotated and uniformly scaled box', () => {
    const localBox = box();
    const rotation = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI / 3);
    const worldMatrix = new THREE.Matrix4().compose(
        new THREE.Vector3(7, -2, 4),
        rotation,
        new THREE.Vector3(2, 2, 2),
    );
    const outside = new THREE.Vector3(2, 3, 0).applyMatrix4(worldMatrix);
    const inside = new THREE.Vector3(0.5, -0.25, 0.75).applyMatrix4(worldMatrix);

    near(distanceToOrientedBox(outside, localBox, worldMatrix), 2 * Math.sqrt(5));
    near(distanceToOrientedBox(inside, localBox, worldMatrix), 0);
});

test('range classification follows the exact shared endpoint', () => {
    const limit = 700;
    assert.equal(classifyOutOfRange(699.999, limit), false);
    assert.equal(classifyOutOfRange(700, limit), false);
    assert.equal(classifyOutOfRange(700.001, limit), true);
    assert.equal(classifyOutOfRange(Number.NaN, limit), true);
});
