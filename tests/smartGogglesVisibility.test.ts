import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {
    hasLineOfSightToOrientedBox,
    type SmartGogglesObstacleQuery,
} from '../src/smartGoggles.ts';

const targetBox = new THREE.Box3(
    new THREE.Vector3(-2, -2, -2),
    new THREE.Vector3(2, 2, 2),
);
const observer = new THREE.Vector3(0, 0, 0);

function wall(width: number, centerX: number, z: number): THREE.Mesh {
    const result = new THREE.Mesh(
        new THREE.BoxGeometry(width, 30, 0.1),
        new THREE.MeshBasicMaterial(),
    );
    result.position.set(centerX, 0, z);
    result.updateMatrixWorld(true);
    return result;
}

function queryFor(...obstacles: THREE.Object3D[]): SmartGogglesObstacleQuery {
    return (_startX, _startZ, _endX, _endZ, out) => {
        out.length = 0;
        out.push(...obstacles);
        return out;
    };
}

test('a wall blocks an offset box even when its center ray is farther than the shortest box point', () => {
    // For this offset target the nearest point is not on the center ray. The old
    // center-ray/shortest-distance combination stopped before reaching this wall.
    const targetMatrix = new THREE.Matrix4().makeTranslation(4, 0, -10);
    const fullWall = wall(30, 0, -7.75);

    assert.equal(hasLineOfSightToOrientedBox(
        observer,
        targetBox,
        targetMatrix,
        queryFor(fullWall),
    ), false);
});

test('silhouette samples retain a target lock when its edge peeks around cover', () => {
    const targetMatrix = new THREE.Matrix4().makeTranslation(0, 0, -10);
    // The wall covers the target center but ends before its projected right edge.
    const partialWall = wall(10.5, -4.75, -5);

    assert.equal(hasLineOfSightToOrientedBox(
        observer,
        targetBox,
        targetMatrix,
        queryFor(partialWall),
    ), true);
});

test('an unobstructed oriented box is visible', () => {
    const targetMatrix = new THREE.Matrix4().compose(
        new THREE.Vector3(-3, 1, -20),
        new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI / 4),
        new THREE.Vector3(1.5, 1.5, 1.5),
    );
    assert.equal(hasLineOfSightToOrientedBox(
        observer,
        targetBox,
        targetMatrix,
        queryFor(),
    ), true);
});

test('another enemy occludes a lock while the target ignores its own mesh', () => {
    const target = new THREE.Mesh(new THREE.BoxGeometry(4, 4, 4), new THREE.MeshBasicMaterial());
    target.position.set(0, 0, -10);
    target.geometry.computeBoundingBox();
    const targetBounds = target.geometry.boundingBox!;
    target.updateMatrixWorld(true);
    const blocker = new THREE.Mesh(new THREE.BoxGeometry(5, 5, 0.2), new THREE.MeshBasicMaterial());
    blocker.position.set(0, 0, -5);
    blocker.updateMatrixWorld(true);

    assert.equal(hasLineOfSightToOrientedBox(
        observer,
        targetBounds,
        target.matrixWorld,
        queryFor(),
        [target],
        target,
    ), true, 'the current target does not occlude itself');
    assert.equal(hasLineOfSightToOrientedBox(
        observer,
        targetBounds,
        target.matrixWorld,
        queryFor(),
        [target, blocker],
        target,
    ), false, 'a nearer enemy fully covering the silhouette blocks recognition');
});
