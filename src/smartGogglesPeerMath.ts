import * as THREE from 'three';
import { distanceToOrientedBox } from './smartGogglesMath.js';

const _stablePeerSpheres = new WeakMap<THREE.Object3D, THREE.Sphere>();
const _peerRootInverse = new THREE.Matrix4();
const _meshToPeerRoot = new THREE.Matrix4();
const _peerLocalBounds = new THREE.Box3();
const _transformedMeshBounds = new THREE.Box3();
const _peerEnvelopeCorner = new THREE.Vector3();

function visibleMeshGeometry(object: THREE.Object3D): THREE.BufferGeometry | null {
    const mesh = object as THREE.Mesh;
    if (!mesh.isMesh || !mesh.geometry) return null;

    const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    if (materials.length === 0 || materials.every(material => material.visible === false)) return null;

    const geometry = mesh.geometry;
    if (!geometry.boundingBox) geometry.computeBoundingBox();
    return geometry.boundingBox?.isEmpty() === false ? geometry : null;
}

/** Collect only the peer meshes that the renderer can currently draw. */
export function collectVisiblePeerMeshes(
    peerRoot: THREE.Object3D,
    out: THREE.Mesh[],
): THREE.Mesh[] {
    out.length = 0;
    peerRoot.updateWorldMatrix(true, true);
    peerRoot.traverseVisible((object) => {
        if (visibleMeshGeometry(object)) out.push(object as THREE.Mesh);
    });
    return out;
}

/** Visit rendered peer mesh bounds until one satisfies the predicate. */
export function someVisiblePeerMeshBounds(
    peerRoot: THREE.Object3D,
    predicate: (localBox: THREE.Box3, worldMatrix: THREE.Matrix4) => boolean,
): boolean {
    peerRoot.updateWorldMatrix(true, true);

    let matched = false;
    peerRoot.traverseVisible((object) => {
        if (matched) return;
        const geometry = visibleMeshGeometry(object);
        if (geometry?.boundingBox && predicate(geometry.boundingBox, object.matrixWorld)) matched = true;
    });
    return matched;
}

/**
 * Build and cache one maximum root-local envelope for a peer avatar. Hidden
 * weapon branches are included so switching equipment or animating children
 * cannot resize the goggles frame; sprites such as name tags have no geometry
 * and are naturally excluded.
 */
export function getStablePeerSphere(peerRoot: THREE.Object3D): THREE.Sphere | null {
    const cached = _stablePeerSpheres.get(peerRoot);
    if (cached) {
        peerRoot.updateWorldMatrix(true, false);
        return cached;
    }

    peerRoot.updateWorldMatrix(true, true);
    const determinant = peerRoot.matrixWorld.determinant();
    if (!Number.isFinite(determinant) || Math.abs(determinant) <= Number.EPSILON) return null;

    _peerRootInverse.copy(peerRoot.matrixWorld).invert();
    _peerLocalBounds.makeEmpty();
    peerRoot.traverse((object) => {
        const geometry = visibleMeshGeometry(object);
        if (!geometry?.boundingBox) return;
        _meshToPeerRoot.multiplyMatrices(_peerRootInverse, object.matrixWorld);
        _transformedMeshBounds.copy(geometry.boundingBox).applyMatrix4(_meshToPeerRoot);
        _peerLocalBounds.union(_transformedMeshBounds);
    });
    if (_peerLocalBounds.isEmpty()) return null;

    // Root x/z is the stable lock point. Only the vertical midpoint comes from
    // the model, so avatar yaw cannot orbit an asymmetric held weapon around it.
    const sphere = new THREE.Sphere(
        new THREE.Vector3(0, (_peerLocalBounds.min.y + _peerLocalBounds.max.y) * 0.5, 0),
        0,
    );
    for (let i = 0; i < 8; i++) {
        _peerEnvelopeCorner.set(
            (i & 1) === 0 ? _peerLocalBounds.min.x : _peerLocalBounds.max.x,
            (i & 2) === 0 ? _peerLocalBounds.min.y : _peerLocalBounds.max.y,
            (i & 4) === 0 ? _peerLocalBounds.min.z : _peerLocalBounds.max.z,
        );
        sphere.radius = Math.max(sphere.radius, sphere.center.distanceTo(_peerEnvelopeCorner));
    }
    _stablePeerSpheres.set(peerRoot, sphere);
    return sphere;
}

/** Return the shortest world-space distance to any rendered peer mesh bound. */
export function distanceToVisiblePeerMeshes(
    worldPoint: THREE.Vector3,
    peerRoot: THREE.Object3D,
): number {
    peerRoot.updateWorldMatrix(true, true);

    let nearestDistance = Number.POSITIVE_INFINITY;
    peerRoot.traverseVisible((object) => {
        const geometry = visibleMeshGeometry(object);
        if (!geometry?.boundingBox) return;
        nearestDistance = Math.min(
            nearestDistance,
            distanceToOrientedBox(worldPoint, geometry.boundingBox, object.matrixWorld),
        );
    });
    return nearestDistance;
}
