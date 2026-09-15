import * as THREE from 'three';
import { distanceToOrientedBox, type StableTargetEnvelope } from './smartGogglesMath.js';

const _stablePeerEnvelopes = new WeakMap<THREE.Object3D, StableTargetEnvelope>();
const _peerRootInverse = new THREE.Matrix4();
const _meshToPeerRoot = new THREE.Matrix4();
const _peerLocalBounds = new THREE.Box3();
const _transformedMeshBounds = new THREE.Box3();
const STABLE_ENVELOPE_EXCLUDED = 'smartGogglesEnvelopeExcluded';

export function excludeFromStablePeerEnvelope(object: THREE.Object3D): void {
    object.userData[STABLE_ENVELOPE_EXCLUDED] = true;
}

function isExcludedFromStableEnvelope(object: THREE.Object3D, peerRoot: THREE.Object3D): boolean {
    let current: THREE.Object3D | null = object;
    while (current && current !== peerRoot) {
        if (current.userData[STABLE_ENVELOPE_EXCLUDED] === true) return true;
        current = current.parent;
    }
    return false;
}

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
 * Build and cache one maximum root-local body envelope for a peer avatar.
 * Equipment branches are explicitly excluded and sprites have no geometry, so
 * neither weapon switching nor child animation can resize the goggles frame.
 */
export function getStablePeerEnvelope(peerRoot: THREE.Object3D): StableTargetEnvelope | null {
    const cached = _stablePeerEnvelopes.get(peerRoot);
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
        if (isExcludedFromStableEnvelope(object, peerRoot)) return;
        const geometry = visibleMeshGeometry(object);
        if (!geometry?.boundingBox) return;
        _meshToPeerRoot.multiplyMatrices(_peerRootInverse, object.matrixWorld);
        _transformedMeshBounds.copy(geometry.boundingBox).applyMatrix4(_meshToPeerRoot);
        _peerLocalBounds.union(_transformedMeshBounds);
    });
    if (_peerLocalBounds.isEmpty()) return null;

    const horizontalX = Math.max(Math.abs(_peerLocalBounds.min.x), Math.abs(_peerLocalBounds.max.x));
    const horizontalZ = Math.max(Math.abs(_peerLocalBounds.min.z), Math.abs(_peerLocalBounds.max.z));
    const envelope: StableTargetEnvelope = {
        // Root x/z is the stable lock point. Only the body's vertical midpoint
        // comes from its geometry, so yaw cannot orbit an asymmetric envelope.
        center: new THREE.Vector3(0, (_peerLocalBounds.min.y + _peerLocalBounds.max.y) * 0.5, 0),
        halfWidth: Math.hypot(horizontalX, horizontalZ),
        halfHeight: (_peerLocalBounds.max.y - _peerLocalBounds.min.y) * 0.5,
    };
    _stablePeerEnvelopes.set(peerRoot, envelope);
    return envelope;
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
