import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {
    classifyOutOfRange,
    createScreenBounds,
    createSmartGogglesCalloutLayout,
    distanceToOrientedBox,
    layoutSmartGogglesCallout,
    projectStableTargetEnvelopeToScreen,
    projectStableTargetSphereToScreen,
    type ScreenBounds,
} from '../src/smartGogglesMath.ts';

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

test('callout chooses the sides with room and preserves a 45-degree first segment', () => {
    const layout = createSmartGogglesCalloutLayout();
    layoutSmartGogglesCallout(
        { left: 10, top: 8, right: 40, bottom: 28, width: 30, height: 20 },
        240,
        140,
        layout,
        { diagonalLength: 18, horizontalLength: 80, labelWidth: 80, margin: 6 },
    );

    assert.equal(layout.horizontal, 'right');
    assert.equal(layout.vertical, 'down');
    assert.equal(layout.labelPlacement, 'below');
    near(layout.anchor.x, 40);
    near(layout.anchor.y, 28);
    near(Math.abs(layout.elbow.x - layout.anchor.x), Math.abs(layout.elbow.y - layout.anchor.y));
    near(layout.end.y, layout.elbow.y);
    near(layout.labelX, layout.elbow.x);
    near(layout.labelY, layout.elbow.y);
});

test('callout flips left and up near the lower-right viewport corner', () => {
    const layout = createSmartGogglesCalloutLayout();
    layoutSmartGogglesCallout(
        { left: 190, top: 105, right: 230, bottom: 132, width: 40, height: 27 },
        240,
        140,
        layout,
        { diagonalLength: 16, horizontalLength: 70, labelWidth: 70, margin: 6 },
    );

    assert.equal(layout.horizontal, 'left');
    assert.equal(layout.vertical, 'up');
    assert.equal(layout.labelPlacement, 'below');
    assert.ok(layout.elbow.x < layout.anchor.x);
    assert.ok(layout.elbow.y < layout.anchor.y);
    assert.ok(layout.end.x < layout.elbow.x);
    near(Math.abs(layout.elbow.x - layout.anchor.x), Math.abs(layout.elbow.y - layout.anchor.y));
    near(layout.end.y, layout.elbow.y);
    near(layout.labelX, layout.elbow.x - 70);
});

test('callouts fan away from the screen center when both outer sides fit', () => {
    const leftTarget = createSmartGogglesCalloutLayout();
    const rightTarget = createSmartGogglesCalloutLayout();
    const options = { diagonalLength: 12, horizontalLength: 50, labelWidth: 50, margin: 6 };
    layoutSmartGogglesCallout(
        { left: 70, top: 40, right: 90, bottom: 60, width: 20, height: 20 },
        200,
        120,
        leftTarget,
        options,
    );
    layoutSmartGogglesCallout(
        { left: 110, top: 40, right: 130, bottom: 60, width: 20, height: 20 },
        200,
        120,
        rightTarget,
        options,
    );
    assert.equal(leftTarget.horizontal, 'left');
    assert.equal(rightTarget.horizontal, 'right');
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
