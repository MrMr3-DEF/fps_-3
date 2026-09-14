import * as THREE from 'three';
import {
    distanceToOrientedBox,
    projectOrientedBoxToScreen,
    type ScreenBounds,
} from './smartGogglesMath.js';

const _meshBounds = {
    left: 0,
    top: 0,
    right: 0,
    bottom: 0,
    width: 0,
    height: 0,
} satisfies ScreenBounds;

function clearBounds(bounds: ScreenBounds): void {
    bounds.left = 0;
    bounds.top = 0;
    bounds.right = 0;
    bounds.bottom = 0;
    bounds.width = 0;
    bounds.height = 0;
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
 * Project the union of the rendered mesh bounds beneath a remote-player root.
 * `traverseVisible` excludes hidden weapon branches and respects every ancestor's
 * visibility. Sprite name tags are excluded because only Mesh nodes contribute.
 */
export function projectVisiblePeerMeshesToScreen(
    peerRoot: THREE.Object3D,
    camera: THREE.PerspectiveCamera,
    viewportWidth: number,
    viewportHeight: number,
    out: ScreenBounds,
): boolean {
    clearBounds(out);
    peerRoot.updateWorldMatrix(true, true);

    let found = false;
    peerRoot.traverseVisible((object) => {
        const geometry = visibleMeshGeometry(object);
        if (!geometry?.boundingBox || !projectOrientedBoxToScreen(
            geometry.boundingBox,
            object.matrixWorld,
            camera,
            viewportWidth,
            viewportHeight,
            _meshBounds,
        )) return;

        if (!found) {
            out.left = _meshBounds.left;
            out.top = _meshBounds.top;
            out.right = _meshBounds.right;
            out.bottom = _meshBounds.bottom;
            found = true;
        } else {
            out.left = Math.min(out.left, _meshBounds.left);
            out.top = Math.min(out.top, _meshBounds.top);
            out.right = Math.max(out.right, _meshBounds.right);
            out.bottom = Math.max(out.bottom, _meshBounds.bottom);
        }
    });

    if (!found) return false;
    out.width = out.right - out.left;
    out.height = out.bottom - out.top;
    return true;
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
