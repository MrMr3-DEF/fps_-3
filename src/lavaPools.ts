import * as THREE from 'three';
import {
    GROUND_VISUAL_SIZE,
    LAVA_PIT_MAX_DEPTH,
    LAVA_POOL_HALF_SIZE,
    LAVA_SURFACE_Y,
} from './config.js';

export const LAVA_SHAPE_COUNT = 4;
/** Depth falls over this distance, giving a 0.25 grade that needs no jump. */
export const LAVA_PIT_BANK_WIDTH = 3.2;
/** World-space SDF range encoded symmetrically into the 8-bit pit mask texture. */
export const LAVA_PIT_MASK_ENCODE_RANGE = 10;
/** Spatial-hash query radius covering the largest scaled lava pool with margin. */
export const LAVA_POOL_QUERY_RADIUS = 36;

export type LavaShapeIndex = 0 | 1 | 2 | 3;

export interface LavaPoolDescriptor {
    x: number;
    z: number;
    yaw: number;
    shapeIndex: LavaShapeIndex;
    scale: number;
    boundRadius: number;
}

interface LavaLobe {
    x: number;
    z: number;
    rx: number;
    rz: number;
    rotation: number;
}

interface LavaShape {
    /** Polynomial smooth-union width between overlapping lobes. */
    smoothK: number;
    /** Conservative world-space radius of the shape's outer rim. */
    boundRadius: number;
    lobes: readonly LavaLobe[];
}

const BASIN_OUTER_SDF = 1.4;
const BASIN_MID_OUTER_SDF = 0.5;
const BASIN_OUTER_SKIRT_DROP = 0.08;
// Tucked inside the sloped bank where the basin sits well above LAVA_SURFACE_Y,
// so the bank clips the molten surface cleanly without gaps or rim z-fighting.
const SURFACE_OUTER_SDF = -0.5;
const CONTOUR_SEGMENTS = 128;
const BASIN_INTERIOR_RINGS = 14;
const SURFACE_INTERIOR_RINGS = 6;
const MASK_RESOLUTION = 1024;
const LAVA_UV_TILE_SIZE = 14;

const SHAPES: readonly LavaShape[] = [
    {
        smoothK: 2.4,
        boundRadius: 16.8,
        lobes: [
            { x: -3.3, z: 0.9, rx: 9.6, rz: 7.8, rotation: 0.22 },
            { x: 4.2, z: -1.2, rx: 7.2, rz: 6.0, rotation: -0.58 },
        ],
    },
    {
        smoothK: 2.7,
        boundRadius: 18.3,
        lobes: [
            { x: -7.35, z: 0.3, rx: 6.75, rz: 7.5, rotation: 0.25 },
            { x: 1.5, z: -1.5, rx: 7.8, rz: 7.5, rotation: -0.35 },
            { x: 7.8, z: 1.95, rx: 5.55, rz: 6.3, rotation: 0.55 },
        ],
    },
    {
        smoothK: 3.4,
        boundRadius: 23.1,
        lobes: [
            { x: -11.0, z: 3.0, rx: 7.8, rz: 6.8, rotation: -0.45 },
            { x: 0.0, z: -2.2, rx: 9.5, rz: 7.6, rotation: 0.0 },
            { x: 11.2, z: 1.8, rx: 7.2, rz: 6.5, rotation: 0.5 },
        ],
    },
    {
        smoothK: 4.0,
        boundRadius: 28.2,
        lobes: [
            { x: -14.5, z: -1.8, rx: 8.2, rz: 10.2, rotation: 0.25 },
            { x: -3.6, z: 2.0, rx: 9.3, rz: 8.6, rotation: -0.25 },
            { x: 7.0, z: -2.0, rx: 9.0, rz: 8.2, rotation: 0.35 },
            { x: 15.8, z: 1.6, rx: 6.8, rz: 7.8, rotation: -0.4 },
        ],
    },
];

export interface LavaShapeGeometries {
    basin: THREE.BufferGeometry;
    surface: THREE.BufferGeometry;
}

function isLavaShapeIndex(value: unknown): value is LavaShapeIndex {
    return value === 0 || value === 1 || value === 2 || value === 3;
}

function isFiniteNumber(value: unknown): value is number {
    return typeof value === 'number' && Number.isFinite(value);
}

function ellipseDistance(lx: number, lz: number, lobe: LavaLobe): number {
    const dx = lx - lobe.x;
    const dz = lz - lobe.z;
    const cos = Math.cos(lobe.rotation);
    const sin = Math.sin(lobe.rotation);
    const ex = (dx * cos + dz * sin) / lobe.rx;
    const ez = (-dx * sin + dz * cos) / lobe.rz;
    const radial = Math.sqrt(ex * ex + ez * ez);
    return (radial - 1) * Math.min(lobe.rx, lobe.rz);
}

/** Inigo Quilez's polynomial smooth minimum. */
function smoothMin(a: number, b: number, k: number): number {
    const h = Math.max(k - Math.abs(a - b), 0) / k;
    return Math.min(a, b) - h * h * k * 0.25;
}

export function getLavaShapeBoundRadius(shapeIndex: LavaShapeIndex, scale = 1): number {
    const safeScale = Number.isFinite(scale) && scale > 0 ? scale : 1;
    return SHAPES[shapeIndex].boundRadius * safeScale;
}

/** Negative inside the pit rim, zero on the rim and positive outside. */
export function sampleLavaShapeSdf(shapeIndex: LavaShapeIndex, lx: number, lz: number): number {
    const shape = SHAPES[shapeIndex];
    let distance = Number.POSITIVE_INFINITY;
    for (const lobe of shape.lobes) {
        const value = ellipseDistance(lx, lz, lobe);
        distance = distance === Number.POSITIVE_INFINITY
            ? value
            : smoothMin(distance, value, shape.smoothK);
    }
    return distance;
}

export function getLavaPoolDescriptor(obj: THREE.Object3D): LavaPoolDescriptor | undefined {
    const value: unknown = obj.userData?.lavaPool;
    if (!value || typeof value !== 'object') return undefined;
    const { x, z, yaw, shapeIndex, scale, boundRadius } = value as Partial<LavaPoolDescriptor>;
    if (!isFiniteNumber(x) || !isFiniteNumber(z) || !isFiniteNumber(yaw) ||
        !isFiniteNumber(scale) || !isFiniteNumber(boundRadius) ||
        !isLavaShapeIndex(shapeIndex) || scale <= 0 || boundRadius < 0) return undefined;
    return { x, z, yaw, shapeIndex, scale, boundRadius };
}

export function setLavaPoolDescriptor(obj: THREE.Object3D, desc: LavaPoolDescriptor): void {
    obj.userData.lavaPool = { ...desc };
}

export function sampleLavaPoolSdf(pool: LavaPoolDescriptor, x: number, z: number): number {
    const dx = x - pool.x;
    const dz = z - pool.z;
    const cos = Math.cos(pool.yaw);
    const sin = Math.sin(pool.yaw);
    // Inverse of Three.js Y-rotation (dx = lx*cos + lz*sin, dz = -lx*sin + lz*cos),
    // then inverse uniform scale so distances remain in world units at every scale.
    const lx = (dx * cos - dz * sin) / pool.scale;
    const lz = (dx * sin + dz * cos) / pool.scale;
    return sampleLavaShapeSdf(pool.shapeIndex, lx, lz) * pool.scale;
}

function inverseSmoothstep(value: number): number {
    const clamped = THREE.MathUtils.clamp(value, 0, 1);
    return 0.5 - Math.sin(Math.asin(1 - 2 * clamped) / 3);
}

// The liquid edge is exactly where the smooth pit floor reaches LAVA_SURFACE_Y,
// so the rendered surface and damage/contact checks cannot disagree.
export const LAVA_LIQUID_SDF_OFFSET = LAVA_PIT_BANK_WIDTH * inverseSmoothstep(
    THREE.MathUtils.clamp(-LAVA_SURFACE_Y / LAVA_PIT_MAX_DEPTH, 0, 1),
);

function pitFloorForSdf(sdf: number): number {
    if (sdf >= 0) return 0;
    const t = THREE.MathUtils.smoothstep(-sdf, 0, LAVA_PIT_BANK_WIDTH);
    return -LAVA_PIT_MAX_DEPTH * t;
}

export function sampleLavaPitFloorY(pool: LavaPoolDescriptor, x: number, z: number): number {
    return pitFloorForSdf(sampleLavaPoolSdf(pool, x, z));
}

export function getLavaPitFloorY(x: number, z: number, pools: readonly THREE.Object3D[]): number {
    let floor = 0;
    for (const pool of pools) {
        const desc = getLavaPoolDescriptor(pool);
        if (!desc) continue;
        floor = Math.min(floor, sampleLavaPitFloorY(desc, x, z));
    }
    return THREE.MathUtils.clamp(floor, -LAVA_PIT_MAX_DEPTH, 0);
}

export function isPointInLava(
    x: number,
    z: number,
    feetY: number,
    radius: number,
    pools: readonly THREE.Object3D[],
): boolean {
    if (feetY > LAVA_SURFACE_Y + 0.25) return false;
    for (const pool of pools) {
        const desc = getLavaPoolDescriptor(pool);
        if (desc) {
            if (sampleLavaPoolSdf(desc, x, z) <= -LAVA_LIQUID_SDF_OFFSET + radius) return true;
            continue;
        }
        // Legacy/synthetic pools carry no shape: retain their square footprint.
        if (feetY <= 0.15 &&
            Math.abs(x - pool.position.x) < LAVA_POOL_HALF_SIZE + radius &&
            Math.abs(z - pool.position.z) < LAVA_POOL_HALF_SIZE + radius) return true;
    }
    return false;
}

// Multipliers over the biome ground shader: pure white at the rim matches the
// surrounding sand 1:1, darkening smoothly to scorched sand and volcanic basalt.
const RIM_TINT = new THREE.Color(1.0, 1.0, 1.0);
const SCORCHED_TINT = new THREE.Color(0.56, 0.43, 0.34);
const BASALT_TINT = new THREE.Color(0.21, 0.17, 0.16);
const basinColor = new THREE.Color();

function sampleBasinColor(sdf: number, y: number): THREE.Color {
    if (sdf >= 0) return basinColor.copy(RIM_TINT);
    const depthT = THREE.MathUtils.clamp(-y / (-LAVA_SURFACE_Y * 1.15), 0, 1);
    if (depthT < 0.48) return basinColor.lerpColors(RIM_TINT, SCORCHED_TINT, depthT / 0.48);
    return basinColor.lerpColors(SCORCHED_TINT, BASALT_TINT, (depthT - 0.48) / 0.52);
}

function sampleBasinY(sdf: number): number {
    if (sdf <= 0) return pitFloorForSdf(sdf);
    // Flush at sdf === 0 (zero slope from both sides) and tucked gently beneath
    // the surrounding ground outside the cutout so no seam or lip ever appears.
    return -BASIN_OUTER_SKIRT_DROP * THREE.MathUtils.smoothstep(sdf, 0, BASIN_OUTER_SDF);
}

/** Find the radius along a ray from (0, 0) where the shape SDF crosses targetSdf. */
function findContourRadius(shapeIndex: LavaShapeIndex, dirX: number, dirZ: number, targetSdf: number): number {
    const maxRadius = SHAPES[shapeIndex].boundRadius + BASIN_OUTER_SDF + 4;
    const marchStep = 0.25;
    let low = 0;
    let high = maxRadius;
    let found = false;
    let prevValue = sampleLavaShapeSdf(shapeIndex, 0, 0) - targetSdf;

    for (let r = marchStep; r <= maxRadius; r += marchStep) {
        const value = sampleLavaShapeSdf(shapeIndex, dirX * r, dirZ * r) - targetSdf;
        if (prevValue <= 0 && value >= 0) {
            low = r - marchStep;
            high = r;
            found = true;
            break;
        }
        prevValue = value;
    }

    if (!found) {
        throw new Error(`lava shape ${shapeIndex} has no contour crossing at sdf=${targetSdf}`);
    }

    for (let iter = 0; iter < 18; iter++) {
        const mid = (low + high) * 0.5;
        const value = sampleLavaShapeSdf(shapeIndex, dirX * mid, dirZ * mid) - targetSdf;
        if (value < 0) low = mid;
        else high = mid;
    }
    return (low + high) * 0.5;
}

function buildPolarRingIndices(ringCount: number, segments: number, centerIndex: number): number[] {
    const indices: number[] = [];
    // Connect adjacent concentric rings from outermost (0) inward to ringCount - 1.
    // Angles increase from +X toward +Z (clockwise seen from +Y), so winding
    // (o0, i0, o1) / (i0, i1, o1) winds CCW from above (+Y) for (cos θ, sin θ) rings.
    for (let ring = 0; ring < ringCount - 1; ring++) {
        const outerBase = ring * segments;
        const innerBase = (ring + 1) * segments;
        for (let seg = 0; seg < segments; seg++) {
            const next = (seg + 1) % segments;
            const o0 = outerBase + seg;
            const o1 = outerBase + next;
            const i0 = innerBase + seg;
            const i1 = innerBase + next;
            indices.push(o0, i0, o1, i0, i1, o1);
        }
    }
    // Cap the innermost ring to the center vertex with upward (+Y) winding.
    const innerBase = (ringCount - 1) * segments;
    for (let seg = 0; seg < segments; seg++) {
        const next = (seg + 1) % segments;
        indices.push(innerBase + seg, centerIndex, innerBase + next);
    }
    return indices;
}

function buildBasinGeometry(shapeIndex: LavaShapeIndex): THREE.BufferGeometry {
    const segments = CONTOUR_SEGMENTS;
    // Outer skirt (+1.4), mid skirt (+0.5), exact rim (0.0), plus interior rings.
    const ringCount = 3 + BASIN_INTERIOR_RINGS;
    const vertexCount = ringCount * segments + 1;
    const positions = new Float32Array(vertexCount * 3);
    const colors = new Float32Array(vertexCount * 3);
    const uvs = new Float32Array(vertexCount * 2);

    const dirsX = new Float32Array(segments);
    const dirsZ = new Float32Array(segments);
    const outerRadii = new Float32Array(segments);
    const midOuterRadii = new Float32Array(segments);
    const rimRadii = new Float32Array(segments);

    for (let seg = 0; seg < segments; seg++) {
        const angle = (seg / segments) * Math.PI * 2;
        const dx = Math.cos(angle);
        const dz = Math.sin(angle);
        dirsX[seg] = dx;
        dirsZ[seg] = dz;
        outerRadii[seg] = findContourRadius(shapeIndex, dx, dz, BASIN_OUTER_SDF);
        midOuterRadii[seg] = findContourRadius(shapeIndex, dx, dz, BASIN_MID_OUTER_SDF);
        rimRadii[seg] = findContourRadius(shapeIndex, dx, dz, 0);
    }

    const writeVertex = (vertex: number, lx: number, lz: number, exactSdf?: number): void => {
        const sdf = exactSdf ?? sampleLavaShapeSdf(shapeIndex, lx, lz);
        const y = sampleBasinY(sdf);
        positions[vertex * 3] = lx;
        positions[vertex * 3 + 1] = y;
        positions[vertex * 3 + 2] = lz;
        uvs[vertex * 2] = lx / LAVA_UV_TILE_SIZE;
        uvs[vertex * 2 + 1] = lz / LAVA_UV_TILE_SIZE;
        const color = sampleBasinColor(sdf, y);
        colors[vertex * 3] = color.r;
        colors[vertex * 3 + 1] = color.g;
        colors[vertex * 3 + 2] = color.b;
    };

    for (let seg = 0; seg < segments; seg++) {
        const dx = dirsX[seg];
        const dz = dirsZ[seg];
        writeVertex(seg, dx * outerRadii[seg], dz * outerRadii[seg], BASIN_OUTER_SDF);
        writeVertex(segments + seg, dx * midOuterRadii[seg], dz * midOuterRadii[seg], BASIN_MID_OUTER_SDF);
        writeVertex(segments * 2 + seg, dx * rimRadii[seg], dz * rimRadii[seg], 0);

        // Cluster interior rings densely near the rim where the bank curves,
        // relaxing smoothly across the flat floor toward the center.
        for (let k = 1; k <= BASIN_INTERIOR_RINGS; k++) {
            const u = k / (BASIN_INTERIOR_RINGS + 1);
            const frac = 1 - Math.pow(u, 1.45);
            const r = rimRadii[seg] * frac;
            const ringIndex = 2 + k;
            writeVertex(ringIndex * segments + seg, dx * r, dz * r);
        }
    }

    const centerIndex = ringCount * segments;
    writeVertex(centerIndex, 0, 0);

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geometry.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
    geometry.setIndex(buildPolarRingIndices(ringCount, segments, centerIndex));
    geometry.computeVertexNormals();
    // Lock outer skirt and exact-rim normals to +Y so lighting matches the
    // surrounding flat ground identically across the SDF cutout boundary.
    const normals = geometry.getAttribute('normal') as THREE.BufferAttribute;
    for (let i = 0; i < segments * 3; i++) normals.setXYZ(i, 0, 1, 0);
    return geometry;
}

function buildSurfaceGeometry(shapeIndex: LavaShapeIndex): THREE.BufferGeometry {
    const segments = CONTOUR_SEGMENTS;
    const ringCount = 1 + SURFACE_INTERIOR_RINGS;
    const vertexCount = ringCount * segments + 1;
    const positions = new Float32Array(vertexCount * 3);
    const uvs = new Float32Array(vertexCount * 2);

    const writeVertex = (vertex: number, lx: number, lz: number): void => {
        positions[vertex * 3] = lx;
        positions[vertex * 3 + 1] = LAVA_SURFACE_Y;
        positions[vertex * 3 + 2] = lz;
        uvs[vertex * 2] = lx / LAVA_UV_TILE_SIZE;
        uvs[vertex * 2 + 1] = lz / LAVA_UV_TILE_SIZE;
    };

    for (let seg = 0; seg < segments; seg++) {
        const angle = (seg / segments) * Math.PI * 2;
        const dx = Math.cos(angle);
        const dz = Math.sin(angle);
        const outerR = findContourRadius(shapeIndex, dx, dz, SURFACE_OUTER_SDF);
        writeVertex(seg, dx * outerR, dz * outerR);

        for (let k = 1; k <= SURFACE_INTERIOR_RINGS; k++) {
            const frac = 1 - k / (SURFACE_INTERIOR_RINGS + 1);
            const r = outerR * frac;
            writeVertex(k * segments + seg, dx * r, dz * r);
        }
    }

    const centerIndex = ringCount * segments;
    writeVertex(centerIndex, 0, 0);

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
    geometry.setIndex(buildPolarRingIndices(ringCount, segments, centerIndex));
    geometry.computeVertexNormals();
    return geometry;
}

export function createLavaShapeGeometries(): LavaShapeGeometries[] {
    const geometries: LavaShapeGeometries[] = [];
    for (let index = 0; index < LAVA_SHAPE_COUNT; index++) {
        const shapeIndex = index as LavaShapeIndex;
        geometries.push({
            basin: buildBasinGeometry(shapeIndex),
            surface: buildSurfaceGeometry(shapeIndex),
        });
    }
    return geometries;
}

/** Encode a smooth signed distance field into the red channel so hardware
 * linear filtering produces razor-smooth curved cutouts in the ground shader.
 * Values < 0.5 are inside a pit (discarded); values >= 0.5 are solid floor. */
export function createLavaPitMaskTexture(pools: readonly THREE.Object3D[]): THREE.DataTexture {
    const data = new Uint8Array(MASK_RESOLUTION * MASK_RESOLUTION * 4);
    for (let index = 0; index < data.length; index += 4) {
        data[index] = 255;
        data[index + 3] = 255;
    }

    const worldSize = GROUND_VISUAL_SIZE;
    const half = worldSize / 2;
    const pixelSize = worldSize / MASK_RESOLUTION;
    const invEncodeSpan = 1 / (2 * LAVA_PIT_MASK_ENCODE_RANGE);

    for (const pool of pools) {
        const desc = getLavaPoolDescriptor(pool);
        // Include the full SDF encode range beyond the rim so neighboring
        // exterior texels carry accurate positive distances for interpolation.
        const radius = (desc ? desc.boundRadius : LAVA_POOL_HALF_SIZE) + LAVA_PIT_MASK_ENCODE_RANGE + pixelSize;
        const centerX = desc ? desc.x : pool.position.x;
        const centerZ = desc ? desc.z : pool.position.z;
        const minX = Math.max(0, Math.floor((centerX - radius + half) / pixelSize));
        const maxX = Math.min(MASK_RESOLUTION - 1, Math.ceil((centerX + radius + half) / pixelSize));
        const minZ = Math.max(0, Math.floor((centerZ - radius + half) / pixelSize));
        const maxZ = Math.min(MASK_RESOLUTION - 1, Math.ceil((centerZ + radius + half) / pixelSize));

        for (let z = minZ; z <= maxZ; z++) {
            const worldZ = (z + 0.5) * pixelSize - half;
            for (let x = minX; x <= maxX; x++) {
                const worldX = (x + 0.5) * pixelSize - half;
                let sdf: number;
                if (desc) {
                    sdf = sampleLavaPoolSdf(desc, worldX, worldZ);
                } else {
                    const qx = Math.abs(worldX - centerX) - LAVA_POOL_HALF_SIZE;
                    const qz = Math.abs(worldZ - centerZ) - LAVA_POOL_HALF_SIZE;
                    sdf = Math.hypot(Math.max(qx, 0), Math.max(qz, 0)) + Math.min(Math.max(qx, qz), 0);
                }
                const normalized = THREE.MathUtils.clamp(0.5 + sdf * invEncodeSpan, 0, 1);
                const encoded = Math.round(normalized * 255);
                const index = (z * MASK_RESOLUTION + x) * 4;
                if (encoded < data[index]) data[index] = encoded;
            }
        }
    }

    const texture = new THREE.DataTexture(data, MASK_RESOLUTION, MASK_RESOLUTION, THREE.RGBAFormat, THREE.UnsignedByteType);
    texture.colorSpace = THREE.NoColorSpace;
    texture.flipY = false;
    texture.wrapS = THREE.ClampToEdgeWrapping;
    texture.wrapT = THREE.ClampToEdgeWrapping;
    texture.minFilter = THREE.LinearFilter;
    texture.magFilter = THREE.LinearFilter;
    texture.generateMipmaps = false;
    texture.needsUpdate = true;
    return texture;
}
