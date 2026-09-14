import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {
    classifyOutOfRange,
    createScreenBounds,
    createSmartGogglesCalloutLayout,
    distanceToOrientedBox,
    layoutSmartGogglesCallout,
    projectOrientedBoxToScreen,
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

function visibleBounds(localBox: THREE.Box3, matrix: THREE.Matrix4): ScreenBounds {
    const bounds = createScreenBounds();
    assert.ok(projectOrientedBoxToScreen(localBox, matrix, camera(), 200, 200, bounds));
    return bounds;
}

test('projects a centered oriented box into screen-pixel bounds', () => {
    const bounds = visibleBounds(box(), new THREE.Matrix4().makeTranslation(0, 0, -10));
    // The nearest z face determines the silhouette: +/-1 at z=-9 with a 90° FOV.
    near(bounds.left, 100 - 100 / 9);
    near(bounds.right, 100 + 100 / 9);
    near(bounds.top, 100 - 100 / 9);
    near(bounds.bottom, 100 + 100 / 9);
    near(bounds.width, 200 / 9);
    near(bounds.height, 200 / 9);
});

test('clips a partially offscreen box and rejects a fully offscreen box', () => {
    const partial = visibleBounds(box(), new THREE.Matrix4().makeTranslation(9.5, 0, -10));
    assert.ok(partial.left > 170);
    near(partial.right, 200);
    assert.ok(partial.width > 0);

    const outside = createScreenBounds();
    assert.equal(projectOrientedBoxToScreen(
        box(),
        new THREE.Matrix4().makeTranslation(30, 0, -10),
        camera(),
        200,
        200,
        outside,
    ), false);
    assert.deepEqual(outside, createScreenBounds());
});

test('rejects boxes behind the camera and safely clips a near-plane crossing', () => {
    const behind = createScreenBounds();
    assert.equal(projectOrientedBoxToScreen(
        box(),
        new THREE.Matrix4().makeTranslation(0, 0, 10),
        camera(),
        200,
        200,
        behind,
    ), false);

    const nearPlane = visibleBounds(box(0.15), new THREE.Matrix4().makeTranslation(0, 0, -0.2));
    for (const value of Object.values(nearPlane)) assert.ok(Number.isFinite(value));
    assert.ok(nearPlane.left >= 0 && nearPlane.top >= 0);
    assert.ok(nearPlane.right <= 200 && nearPlane.bottom <= 200);
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
    const limit = 500;
    assert.equal(classifyOutOfRange(499.999, limit), false);
    assert.equal(classifyOutOfRange(500, limit), false);
    assert.equal(classifyOutOfRange(500.001, limit), true);
    assert.equal(classifyOutOfRange(Number.NaN, limit), true);
});
