import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {
    collectVisiblePeerMeshes,
    distanceToVisiblePeerMeshes,
    projectVisiblePeerMeshesToScreen,
    someVisiblePeerMeshBounds,
} from '../src/smartGogglesPeerMath.ts';
import { createScreenBounds } from '../src/smartGogglesMath.ts';

const near = (actual: number, expected: number, epsilon = 1e-7) => {
    assert.ok(Math.abs(actual - expected) <= epsilon, `${actual} != ${expected}`);
};

function camera(): THREE.PerspectiveCamera {
    const result = new THREE.PerspectiveCamera(90, 1, 0.1, 100);
    result.updateProjectionMatrix();
    result.updateMatrixWorld(true);
    return result;
}

function boxAt(x: number, y: number, z: number, size = 2): THREE.Mesh {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(size, size, size));
    mesh.position.set(x, y, z);
    return mesh;
}

test('projects the union of visible peer meshes while excluding name sprites and hidden branches', () => {
    const peer = new THREE.Group();
    peer.add(boxAt(-2, 0, -10), boxAt(2, 0, -10));

    const hiddenWeapon = new THREE.Group();
    hiddenWeapon.visible = false;
    hiddenWeapon.add(boxAt(0, 0, -4, 20));
    peer.add(hiddenWeapon);

    const nameTag = new THREE.Sprite();
    nameTag.position.set(0, 8, -10);
    nameTag.scale.set(100, 100, 1);
    peer.add(nameTag);

    const bounds = createScreenBounds();
    assert.equal(projectVisiblePeerMeshesToScreen(peer, camera(), 200, 200, bounds), true);
    near(bounds.left, 100 - 100 / 3);
    near(bounds.right, 100 + 100 / 3);
    near(bounds.top, 100 - 100 / 9);
    near(bounds.bottom, 100 + 100 / 9);
    near(bounds.width, 200 / 3);
    near(bounds.height, 200 / 9);
});

test('returns distance to the nearest visible mesh bound and respects inherited visibility', () => {
    const peer = new THREE.Group();
    peer.add(boxAt(0, 0, -10));

    const activeWeapon = new THREE.Group();
    activeWeapon.add(boxAt(0, 0, -8, 1));
    peer.add(activeWeapon);

    const hiddenWeapon = new THREE.Group();
    hiddenWeapon.visible = false;
    hiddenWeapon.add(boxAt(0, 0, -2));
    peer.add(hiddenWeapon);

    near(distanceToVisiblePeerMeshes(new THREE.Vector3(), peer), 7.5);

    peer.visible = false;
    assert.equal(distanceToVisiblePeerMeshes(new THREE.Vector3(), peer), Number.POSITIVE_INFINITY);
    const bounds = createScreenBounds();
    assert.equal(projectVisiblePeerMeshesToScreen(peer, camera(), 200, 200, bounds), false);
    assert.deepEqual(bounds, createScreenBounds());
});

test('ignores meshes whose material is hidden', () => {
    const peer = new THREE.Group();
    peer.add(boxAt(0, 0, -12));
    const hiddenMaterialMesh = boxAt(0, 0, -2);
    hiddenMaterialMesh.material.visible = false;
    peer.add(hiddenMaterialMesh);

    near(distanceToVisiblePeerMeshes(new THREE.Vector3(), peer), 11);
});

test('visible-mesh predicate skips sprites and hidden mesh branches', () => {
    const peer = new THREE.Group();
    const visible = boxAt(2, 0, -10);
    peer.add(visible);
    peer.add(new THREE.Sprite());
    const hidden = boxAt(0, 0, -2);
    hidden.visible = false;
    peer.add(hidden);

    const visited: THREE.Box3[] = [];
    assert.equal(someVisiblePeerMeshBounds(peer, (bounds) => {
        visited.push(bounds);
        return false;
    }), false);
    assert.equal(visited.length, 1);
    assert.equal(someVisiblePeerMeshBounds(peer, (_bounds, matrix) => matrix.elements[12] === 2), true);

    const meshes: THREE.Mesh[] = [];
    assert.deepEqual(collectVisiblePeerMeshes(peer, meshes), [visible]);
});
