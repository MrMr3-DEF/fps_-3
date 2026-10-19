import * as THREE from 'three';

export type TargetObstacleQuery = (
    startX: number,
    startZ: number,
    endX: number,
    endZ: number,
    out: THREE.Object3D[],
) => THREE.Object3D[];
const OCCLUSION_SURFACE_EPSILON = 0.02;
const _toBody = new THREE.Vector3(), _sightSample = new THREE.Vector3();
const _occlusionRaycaster = new THREE.Raycaster();
const _occlusionCandidates: THREE.Object3D[] = [];
const _occlusionHits: THREE.Intersection[] = [];
const NO_ADDITIONAL_OCCLUDERS: THREE.Object3D[] = [];

// A 3 x 3 x 3 lattice without its interior point covers face centers, edge
// midpoints and corners. Face centers make the common case cheap; silhouette
// corners and edges preserve acquisition when only a slice of a target peeks
// around cover.
const OCCLUSION_SAMPLE_FRACTIONS: ReadonlyArray<readonly [number, number, number]> = (() => {
    const samples: Array<readonly [number, number, number]> = [];
    for (let boundaryCount = 1; boundaryCount <= 3; boundaryCount++) {
        for (let ix = 0; ix < 3; ix++) {
            for (let iy = 0; iy < 3; iy++) {
                for (let iz = 0; iz < 3; iz++) {
                    const boundaries = Number(ix !== 1) + Number(iy !== 1) + Number(iz !== 1);
                    if (boundaries === boundaryCount) samples.push([ix / 2, iy / 2, iz / 2]);
                }
            }
        }
    }
    return samples;
})();

/**
 * Returns true when at least one representative point on an oriented box is
 * visible from the observer. Each obstacle ray ends at its own target sample;
 * it never borrows the shorter distance of another point on the box.
 *
 * The optional query seam keeps the geometry behavior directly testable while
 * production uses the world's spatial hash broad phase.
 */
export function hasLineOfSightToOrientedBox(
    origin: THREE.Vector3,
    localBox: THREE.Box3,
    worldMatrix: THREE.Matrix4,
    obstacleQuery: TargetObstacleQuery,
    additionalOccluders: THREE.Object3D[] = NO_ADDITIONAL_OCCLUDERS,
    ignoredTargetRoot?: THREE.Object3D,
    additionalBlocker?: (start: THREE.Vector3, end: THREE.Vector3) => boolean,
): boolean {
    if (localBox.isEmpty()) return false;
    const determinant = worldMatrix.determinant();
    if (!Number.isFinite(determinant) || Math.abs(determinant) <= Number.EPSILON) return false;

    const sizeX = localBox.max.x - localBox.min.x;
    const sizeY = localBox.max.y - localBox.min.y;
    const sizeZ = localBox.max.z - localBox.min.z;
    for (let i = 0; i < OCCLUSION_SAMPLE_FRACTIONS.length; i++) {
        const fraction = OCCLUSION_SAMPLE_FRACTIONS[i];
        _sightSample.set(
            localBox.min.x + sizeX * fraction[0],
            localBox.min.y + sizeY * fraction[1],
            localBox.min.z + sizeZ * fraction[2],
        ).applyMatrix4(worldMatrix);

        _toBody.subVectors(_sightSample, origin);
        const sampleDistance = _toBody.length();
        if (sampleDistance <= OCCLUSION_SURFACE_EPSILON) return true;

        _occlusionRaycaster.set(origin, _toBody.multiplyScalar(1 / sampleDistance));
        _occlusionRaycaster.near = 0;
        _occlusionRaycaster.far = Math.max(0, sampleDistance - OCCLUSION_SURFACE_EPSILON);
        const candidates = obstacleQuery(
            origin.x,
            origin.z,
            _sightSample.x,
            _sightSample.z,
            _occlusionCandidates,
        );
        _occlusionHits.length = 0;
        _occlusionRaycaster.intersectObjects(candidates, false, _occlusionHits);
        if (additionalOccluders.length > 0) {
            _occlusionRaycaster.intersectObjects(additionalOccluders, true, _occlusionHits);
        }
        let blocked = false;
        for (let hitIndex = 0; hitIndex < _occlusionHits.length; hitIndex++) {
            let hitObject: THREE.Object3D | null = _occlusionHits[hitIndex].object;
            if (ignoredTargetRoot) {
                while (hitObject && hitObject !== ignoredTargetRoot) hitObject = hitObject.parent;
                if (hitObject === ignoredTargetRoot) continue;
            }
            blocked = true;
            break;
        }
        if (!blocked && !additionalBlocker?.(origin, _sightSample)) return true;
    }
    return false;
}
