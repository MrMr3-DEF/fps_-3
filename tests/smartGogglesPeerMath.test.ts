import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {
    collectVisiblePeerMeshes,
    distanceToVisiblePeerMeshes,
    excludeFromStablePeerEnvelope,
    getStablePeerEnvelope,
    someVisiblePeerMeshBounds,
} from '../src/smartGogglesPeerMath.ts';
import { createScreenBounds, projectStableTargetEnvelopeToScreen } from '../src/smartGogglesMath.ts';

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

test('caches one maximum peer envelope across child animation, equipment and root yaw', () => {
    const peer = new THREE.Group();
    peer.position.z = -10;
    const left = boxAt(-2, 0, 0);
    peer.add(left, boxAt(2, 0, 0));

    const hiddenWeapon = new THREE.Group();
    hiddenWeapon.visible = false;
    hiddenWeapon.add(boxAt(0, 3, 0));
    excludeFromStablePeerEnvelope(hiddenWeapon);
    peer.add(hiddenWeapon);

    const nameTag = new THREE.Sprite();
    nameTag.position.set(0, 80, 0);
    nameTag.scale.set(100, 100, 1);
    peer.add(nameTag);

    const envelope = getStablePeerEnvelope(peer);
    assert.ok(envelope);
    assert.deepEqual(envelope.center, new THREE.Vector3(0, 0, 0));
    near(envelope.halfWidth, Math.sqrt(10));
    near(envelope.halfHeight, 1);

    const initialBounds = createScreenBounds();
    assert.equal(projectStableTargetEnvelopeToScreen(envelope, peer.matrixWorld, camera(), 200, 200, initialBounds), true);
    assert.ok(initialBounds.width > initialBounds.height, 'body proportions are preserved instead of becoming a square');

    left.rotation.set(0.7, 1.2, 0.3);
    hiddenWeapon.visible = true;
    peer.rotation.y = 1.1;
    assert.equal(getStablePeerEnvelope(peer), envelope);
    const animatedBounds = createScreenBounds();
    assert.equal(projectStableTargetEnvelopeToScreen(envelope, peer.matrixWorld, camera(), 200, 200, animatedBounds), true);
    assert.deepEqual(animatedBounds, initialBounds);
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
