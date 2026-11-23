import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { MAP_SIZE, MAP_HALF_SIZE, PILLAR_COUNT, PILLAR_WIDTH, MAX_PILLAR_HEIGHT, LAVA_POOL_HALF_SIZE, LAVA_POOL_COUNT, LAVA_SURFACE_Y, FAKE_PILLAR_COUNT, FAKE_LAVA_POOL_COUNT, BUSH_2D_COUNT, BUSH_3D_COUNT, BUSH_3D_RADIUS_CAP, BUSH_2D_INNER_RADIUS, BUSH_2D_SPREAD, GROUND_VISUAL_SIZE } from './config.js';
import { getTownPavingOutline, overlapsTown } from './town.js';
import { getDominantBiome, sampleBiomeBarkColor, sampleBiomeBushColor, sampleBiomeLeafColor, type BiomeField, type BiomeId, type BiomeWeights } from './biomes.js';
import { installLeafAnimationShader } from './leafAnimation.js';
import {
    GROUND_DETAIL_ALBEDO_GLSL,
    GROUND_DETAIL_NORMAL_GLSL,
    GROUND_DETAIL_PARS_GLSL,
    GROUND_DETAIL_VERTEX_GLSL,
    GROUND_DETAIL_VERTEX_PARS_GLSL,
    installSurfaceDetailShader,
} from './surfaceDetail.js';
import {
    LAVA_PIT_MASK_ENCODE_RANGE,
    LAVA_POOL_QUERY_RADIUS,
    LAVA_SHAPE_COUNT,
    createLavaShapeGeometries,
    getLavaPoolDescriptor,
    getLavaShapeBoundRadius,
    setLavaPoolDescriptor,
    type LavaShapeIndex,
} from './lavaPools.js';
import { obstacleData } from './userDataTypes.js';
import { SpatialHash } from './spatialHash.js';

export type SceneryRole = 'pillars' | 'lava' | 'branches' | 'canopy';

export interface SceneryInstances {}
export interface SceneryPort<T extends SceneryInstances> {
    seed: number;
    biomeField: BiomeField;
    biomeMapTexture: THREE.DataTexture;
    random(): number;
    addObject<O extends THREE.Object3D>(object: O): O;
    instances(geometry: THREE.BufferGeometry, material: THREE.Material | THREE.Material[], capacity: number, castShadow?: boolean, receiveShadow?: boolean, role?: SceneryRole): T;
    instance(set: T, x: number, z: number, matrix: THREE.Matrix4, color?: THREE.Color, pillarId?: number): void;
    renderObject(object: THREE.Object3D): void;
    floor(object: THREE.Mesh): void;
    pillar(object: THREE.Mesh): void;
    lava(object: THREE.Object3D): void;
    fakeLava(objects: THREE.Object3D[]): void;
    fakePillars(objects: THREE.Object3D[]): void;
}

function attachBushLeafWeights(geometry: THREE.BufferGeometry): THREE.BufferGeometry {
    const positions = geometry.getAttribute('position');
    const weights = new Float32Array(positions.count);
    for (let i = 0; i < positions.count; i++) {
        const x = positions.getX(i);
        const y = positions.getY(i);
        const z = positions.getZ(i);
        // Keep the lower center near the stem more stable while outer and upper
        // bush leaves sway and part freely on player contact.
        const distFromStem = Math.hypot(x, Math.max(0, y + 0.6), z);
        weights[i] = THREE.MathUtils.clamp(
            0.18 + THREE.MathUtils.smoothstep(distFromStem, 0.35, 1.65) * 0.82,
            0.18,
            1.0,
        );
    }
    geometry.setAttribute('aLeafWeight', new THREE.BufferAttribute(weights, 1));
    return geometry;
}

const FOLIAGE_PUFFS: readonly {
    x: number; y: number; z: number;
    sx: number; sy: number; sz: number;
    rx: number; ry: number; rz: number;
}[] = [
    // Root collar directly wrapping the branch attachment anchor at (0, 0, 0).
    { x: 0.0, y: 0.22, z: 0.0, sx: 1.05, sy: 0.78, sz: 1.05, rx: 0.2, ry: 0.4, rz: 0.1 },
    // Dense inner crown puff.
    { x: 0.06, y: 0.9, z: -0.05, sx: 1.24, sy: 0.92, sz: 1.2, rx: 0.5, ry: 1.1, rz: 0.3 },
    // Four spreading outer leafy tufts forming an organic silhouette.
    { x: -0.92, y: 0.64, z: 0.52, sx: 1.0, sy: 0.74, sz: 0.96, rx: 0.9, ry: 0.3, rz: 0.6 },
    { x: 0.94, y: 0.72, z: 0.46, sx: 0.98, sy: 0.76, sz: 0.94, rx: 0.4, ry: 1.7, rz: 0.8 },
    { x: -0.74, y: 0.82, z: -0.82, sx: 0.96, sy: 0.72, sz: 1.0, rx: 1.2, ry: 0.8, rz: 0.2 },
    { x: 0.82, y: 0.6, z: -0.76, sx: 0.94, sy: 0.74, sz: 0.92, rx: 0.7, ry: 2.3, rz: 0.5 },
    // Upper leafy crest.
    { x: -0.08, y: 1.48, z: 0.1, sx: 0.98, sy: 0.72, sz: 0.96, rx: 0.3, ry: 0.9, rz: 1.1 },
];

/** Multi-tuft sculpted foliage geometry anchored at local (0, 0, 0) with aLeafWeight
 * rising from 0.0 at the branch root to 1.0 at the outer leafy tips. */
export function createSculptedFoliageGeometry(): THREE.BufferGeometry {
    const parts: THREE.BufferGeometry[] = [];
    const matrix = new THREE.Matrix4();
    const quaternion = new THREE.Quaternion();
    const euler = new THREE.Euler();
    const position = new THREE.Vector3();
    const scale = new THREE.Vector3();

    for (let puffIndex = 0; puffIndex < FOLIAGE_PUFFS.length; puffIndex++) {
        const puff = FOLIAGE_PUFFS[puffIndex];
        const part = new THREE.IcosahedronGeometry(1, 0);
        part.deleteAttribute('uv');

        // Perturb unit vertices purely as a function of original direction so
        // shared corners on each non-indexed puff remain watertight.
        const pos = part.getAttribute('position');
        for (let i = 0; i < pos.count; i++) {
            const vx = pos.getX(i);
            const vy = pos.getY(i);
            const vz = pos.getZ(i);
            const jitter = 0.88 + 0.2 * Math.sin(vx * 3.7 + puffIndex * 1.9) *
                Math.cos(vy * 4.1 - vz * 2.9 + puffIndex * 1.3);
            pos.setXYZ(i, vx * jitter, vy * jitter, vz * jitter);
        }

        euler.set(puff.rx, puff.ry, puff.rz);
        quaternion.setFromEuler(euler);
        position.set(puff.x, puff.y, puff.z);
        scale.set(puff.sx, puff.sy, puff.sz);
        matrix.compose(position, quaternion, scale);
        part.applyMatrix4(matrix);
        parts.push(part);
    }

    const merged = mergeGeometries(parts, false);
    for (const part of parts) part.dispose();
    if (!merged) throw new Error('Unable to build sculpted canopy foliage geometry.');

    const positions = merged.getAttribute('position');
    const weights = new Float32Array(positions.count);
    for (let i = 0; i < positions.count; i++) {
        const vx = positions.getX(i);
        const vy = positions.getY(i);
        const vz = positions.getZ(i);
        const radial = Math.hypot(vx, vz);
        const heightAboveRoot = Math.max(0, vy);
        const distFromRoot = Math.hypot(radial, heightAboveRoot * 0.85);
        weights[i] = THREE.MathUtils.smoothstep(distFromRoot, 0.55, 1.85);
    }
    merged.setAttribute('aLeafWeight', new THREE.BufferAttribute(weights, 1));
    merged.computeVertexNormals();
    return merged;
}

// Bushes use shared geometry/materials because there can be hundreds of them.
const SHARED_TRUNK_GEO = new THREE.CylinderGeometry(0.15, 0.25, 1.0, 5);
const SHARED_LEAF_GEO = attachBushLeafWeights(new THREE.DodecahedronGeometry(1.5, 0));
// White bases let instanceColor carry the per-biome tints without extra draws.
const SHARED_TRUNK_MAT = new THREE.MeshLambertMaterial({ color: 0xffffff, flatShading: true });
const SHARED_LEAF_MAT = new THREE.MeshLambertMaterial({ color: 0xffffff, flatShading: true });
installLeafAnimationShader(SHARED_LEAF_MAT, 'bush-leaf-wind-v2');
export const SHARED_WORLD_GEOMETRIES = new Set<THREE.BufferGeometry>([
    SHARED_TRUNK_GEO,
    SHARED_LEAF_GEO
]);
export const SHARED_WORLD_MATERIALS = new Set<THREE.Material>([
    SHARED_TRUNK_MAT,
    SHARED_LEAF_MAT
]);

const UP = new THREE.Vector3(0, 1, 0);
const WARM_BUSH_2D_SHADES = [0x153018, 0x1a331c, 0x162c18, 0x0f2010, 0x132815];
const COOL_BUSH_2D_SHADES = [0x12251c, 0x163028, 0x0f1f19, 0x1a382c];
const SAND_BUSH_2D_SHADES = [0x6d6637, 0x7d7440, 0x5d5a30, 0x8a7b46];
const WARM_FAKE_TREE_CANOPY = ['#2f7a37', '#3f8f43', '#245f2c', '#4a9b3f'];
const COOL_FAKE_TREE_CANOPY = ['#173b3d', '#1d4a45', '#122e30', '#25564f'];

// The original preview placed 56 square fake pools and consumed two world-stream
// draws for each before pillars were seeded. Replay those draws so established
// seeds keep their pillar, mecha, plant and enemy layout while the new pools
// use their own stream below.
const LEGACY_FAKE_LAVA_DRAWS = 56 * 2;

// The floor shader decodes a baked SDF mask where 255 encodes solid ground well
// outside every pit. One full-outside texel stands in until pools are placed.
const EMPTY_LAVA_PIT_MASK = new THREE.DataTexture(new Uint8Array([255, 0, 0, 255]), 1, 1, THREE.RGBAFormat, THREE.UnsignedByteType);
EMPTY_LAVA_PIT_MASK.colorSpace = THREE.NoColorSpace;
EMPTY_LAVA_PIT_MASK.flipY = false;
EMPTY_LAVA_PIT_MASK.minFilter = EMPTY_LAVA_PIT_MASK.magFilter = THREE.LinearFilter;
EMPTY_LAVA_PIT_MASK.generateMipmaps = false;
EMPTY_LAVA_PIT_MASK.needsUpdate = true;

/** The existing texture and placement draws deliberately share one stream.
 * Both callers run these stages in the original order; separating cosmetic RNG
 * would silently move pillars, lava, plants and every later enemy for old seeds.
 * New tree details and organic lava use separate seed-derived streams so their
 * positions cannot move the established world stream. */
export function createBarkTexture(random: () => number): THREE.CanvasTexture {
    const size = 512;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d')!;

    // A bright neutral-warm grain multiplied by sampleBiomeBarkColor()
    // produces brown, charcoal or sun-dried tan without extra materials.
    ctx.fillStyle = '#c8ae8a';
    ctx.fillRect(0, 0, size, size);

    for (let i = 0; i < 4000; i++) {
        const x = random() * size;
        const y = random() * size;
        const length = 40 + random() * 120;

        const hue = 26 + random() * 10;
        const sat = 18 + random() * 16;
        const light = 48 + random() * 26;

        ctx.strokeStyle = `hsl(${hue}, ${sat}%, ${light}%)`;
        ctx.lineWidth = 1.5 + random() * 3.5;
        ctx.beginPath();
        ctx.moveTo(x, y);
        const jitter = (random() - 0.5) * 2;
        ctx.lineTo(x + jitter, y + length);
        ctx.stroke();
    }

    ctx.strokeStyle = '#8b7357';
    for (let i = 0; i < 40; i++) {
        let x = random() * size;
        ctx.lineWidth = 2 + random() * 4;
        ctx.beginPath();
        ctx.moveTo(x, 0);
        for (let y = 0; y < size; y += 20) {
            x += (random() - 0.5) * 4;
            ctx.lineTo(x, y);
        }
        ctx.stroke();
    }

    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(1, 4);
    return texture;
}

export function createRingsTexture(random: () => number): THREE.CanvasTexture {
    const size = 512;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d')!;

    const cx = size / 2;
    const cy = size / 2;

    ctx.fillStyle = '#e4c49f';
    ctx.fillRect(0, 0, size, size);

    const maxRadius = size * 0.75;
    const step = 6 + random() * 4;

    for (let r = 10; r < maxRadius; r += step) {
        const hue = 25 + random() * 8;
        const sat = 30 + random() * 15;
        const light = 35 + random() * 10;
        ctx.strokeStyle = `hsl(${hue}, ${sat}%, ${light}%)`;
        ctx.lineWidth = 1 + random() * 1.5;

        ctx.beginPath();
        const segments = 120;
        for (let i = 0; i <= segments; i++) {
            const angle = (i / segments) * Math.PI * 2;

            const wave = Math.sin(angle * 6) * 3 + Math.cos(angle * 3) * 2 + Math.sin(angle * 12) * 0.8;
            const radialJitter = wave + (random() - 0.5) * 0.5;
            const currentRadius = r + radialJitter;

            const px = cx + Math.cos(angle) * currentRadius;
            const py = cy + Math.sin(angle) * currentRadius;

            if (i === 0) {
                ctx.moveTo(px, py);
            } else {
                ctx.lineTo(px, py);
            }
        }
        ctx.stroke();
    }

    ctx.fillStyle = 'rgba(150, 110, 80, 0.08)';
    for (let i = 0; i < 5000; i++) {
        const angle = random() * Math.PI * 2;
        const radius = random() * maxRadius;
        const px = cx + Math.cos(angle) * radius;
        const py = cy + Math.sin(angle) * radius;

        ctx.fillRect(px, py, 1.5, 1.5);
    }

    const numCracks = 3 + Math.floor(random() * 3);
    ctx.strokeStyle = 'rgba(65, 40, 20, 0.85)';

    for (let i = 0; i < numCracks; i++) {
        const baseAngle = random() * Math.PI * 2;
        const startRad = 15 + random() * 30;
        const endRad = maxRadius * (0.6 + random() * 0.4);

        ctx.lineWidth = 1.5 + random() * 2;
        ctx.beginPath();

        let currentX = cx + Math.cos(baseAngle) * startRad;
        let currentY = cy + Math.sin(baseAngle) * startRad;
        ctx.moveTo(currentX, currentY);

        const steps = 15;
        for (let j = 1; j <= steps; j++) {
            const t = j / steps;
            const r = startRad + t * (endRad - startRad);
            const angleJitter = baseAngle + (random() - 0.5) * 0.15;

            currentX = cx + Math.cos(angleJitter) * r;
            currentY = cy + Math.sin(angleJitter) * r;
            ctx.lineTo(currentX, currentY);
        }
        ctx.stroke();
    }

    ctx.fillStyle = '#412814';
    ctx.beginPath();
    ctx.arc(cx, cy, 3 + random() * 4, 0, Math.PI * 2);
    ctx.fill();

    const texture = new THREE.CanvasTexture(canvas);
    return texture;
}

/** WebGL2 offers dFdx as a core function; WebGL1 Lambert ground shading needs
 * the derivatives extension that MeshStandardMaterial already requests. */
function enableGroundDetailDerivatives(material: THREE.MeshLambertMaterial): void {
    (material as THREE.MeshLambertMaterial & { extensions: { derivatives: boolean } }).extensions = {
        derivatives: true,
    };
}

export function createSceneryBuilder<T extends SceneryInstances>(port: SceneryPort<T>) {
    const worldRandom = port.random;
    const addWorldObject = port.addObject;
    const createChunkedInstanceSet = port.instances;
    const addChunkedInstance = port.instance;
    const addChunkedRenderObject = port.renderObject;
    const obstacleHash = new SpatialHash<THREE.Object3D>(32), lavaHash = new SpatialHash<THREE.Object3D>(32);
    const _placementObstacleCandidates: THREE.Object3D[] = [], _placementLavaCandidates: THREE.Object3D[] = [];
    const biomeWeights: BiomeWeights = { warm: 0, cool: 0, sand: 0, town: 0 };
    const lavaWeights: BiomeWeights = { warm: 0, cool: 0, sand: 0, town: 0 };
    let fakePillars: THREE.Object3D[] = [];
    let fakeLavaObjects: THREE.Object3D[] = [];
    let worldGrassTex: THREE.CanvasTexture | null = null;
    let worldSandTex: THREE.CanvasTexture | null = null;
    let worldLavaTex: THREE.CanvasTexture | null = null;
    let detailState = 0;
    let lavaState = ((port.seed >>> 0) ^ 0x6c617661) >>> 0;

    // A dedicated stream keeps lava changes from moving tree, plant or enemy
    // placement. It is reset with the builder, not by individual stages.
    function resetLavaRandom(): void {
        lavaState = ((port.seed >>> 0) ^ 0x6c617661) >>> 0;
    }

    function lavaRandom(): number {
        let value = (lavaState += 0x6d2b79f5);
        value = Math.imul(value ^ (value >>> 15), value | 1);
        value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
        return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
    }

    // Independent tree/detail stream. It is reset when the floor stage starts,
    // which is always the first stage of a freshly built world.
    function resetDetailRandom(): void {
        detailState = ((port.seed >>> 0) ^ 0x74726565) >>> 0;
    }

    function detailRandom(): number {
        let value = (detailState += 0x6d2b79f5);
        value = Math.imul(value ^ (value >>> 15), value | 1);
        value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
        return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
    }

    function checkAABBOverlap(x: number, z: number, checkRadius: number, array: THREE.Object3D[], halfWidth: number): boolean {
        const len = array.length;
        for (let i = 0; i < len; i++) {
            const item = array[i];
            const dx = Math.abs(x - item.position.x);
            const dz = Math.abs(z - item.position.z);
            if (dx < halfWidth + checkRadius && dz < halfWidth + checkRadius) {
                return true;
            }
        }
        return false;
    }

    function overlapsWithPillars(x: number, z: number, poolRadius: number): boolean {
        const candidates = obstacleHash.query(
            x,
            z,
            poolRadius + PILLAR_WIDTH,
            _placementObstacleCandidates
        );
        return checkAABBOverlap(x, z, poolRadius, candidates, PILLAR_WIDTH / 2);
    }

    // Small canvas textures keep the game self-contained: no external art assets are
    // needed for the arena floor or pillar surfaces.
    function createGrassTexture(): THREE.CanvasTexture {
        const size = 512;
        const canvas = document.createElement('canvas');
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext('2d')!;

        ctx.fillStyle = '#1e4620';
        ctx.fillRect(0, 0, size, size);

        for (let i = 0; i < 5000; i++) {
            const x = worldRandom() * size;
            const y = worldRandom() * size;
            const length = 2 + worldRandom() * 5;
            const angle = -Math.PI / 2 + (worldRandom() - 0.5) * 0.5;

            const hue = 90 + worldRandom() * 25;
            const sat = 45 + worldRandom() * 15;
            const light = 22 + worldRandom() * 18;

            ctx.strokeStyle = `hsl(${hue}, ${sat}%, ${light}%)`;
            ctx.lineWidth = 1.5 + worldRandom() * 2.0;
            ctx.beginPath();
            ctx.moveTo(x, y);
            ctx.lineTo(x + Math.cos(angle) * length, y + Math.sin(angle) * length);
            ctx.stroke();
        }

        const texture = new THREE.CanvasTexture(canvas);
        texture.wrapS = THREE.RepeatWrapping;
        texture.wrapT = THREE.RepeatWrapping;
        texture.repeat.set(250, 250);
        return texture;
    }

    function createSandTexture(): THREE.CanvasTexture {
        const size = 512;
        const canvas = document.createElement('canvas');
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext('2d')!;

        ctx.fillStyle = '#c9a86a';
        ctx.fillRect(0, 0, size, size);

        // Long, shallow wind ripples give the desert floor a directional grain.
        for (let i = 0; i < 180; i++) {
            const y = detailRandom() * size;
            const amplitude = 2 + detailRandom() * 5;
            const wavelength = 18 + detailRandom() * 34;
            const phase = detailRandom() * Math.PI * 2;
            const light = 46 + detailRandom() * 18;
            ctx.strokeStyle = `hsl(${34 + detailRandom() * 8}, ${30 + detailRandom() * 12}%, ${light}%)`;
            ctx.lineWidth = 1 + detailRandom() * 2.4;
            ctx.beginPath();
            for (let x = 0; x <= size; x += 8) {
                const ripple = Math.sin(x / wavelength * Math.PI * 2 + phase) * amplitude;
                if (x === 0) ctx.moveTo(x, y + ripple);
                else ctx.lineTo(x, y + ripple);
            }
            ctx.stroke();
        }

        // Coarse grains keep the surface from reading as a flat color.
        for (let i = 0; i < 5200; i++) {
            const x = detailRandom() * size;
            const y = detailRandom() * size;
            const radius = 0.5 + detailRandom() * 1.6;
            const light = 34 + detailRandom() * 34;
            ctx.fillStyle = `hsla(${33 + detailRandom() * 10}, ${26 + detailRandom() * 18}%, ${light}%, ${0.25 + detailRandom() * 0.4})`;
            ctx.beginPath();
            ctx.arc(x, y, radius, 0, Math.PI * 2);
            ctx.fill();
        }

        const texture = new THREE.CanvasTexture(canvas);
        texture.wrapS = THREE.RepeatWrapping;
        texture.wrapT = THREE.RepeatWrapping;
        texture.repeat.set(250, 250);
        return texture;
    }

    function createLavaTexture(): THREE.CanvasTexture {
        const size = 256;
        const canvas = document.createElement('canvas');
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext('2d')!;

        // Seed-local stream keeps molten surface art independent of layout draws.
        let magmaState = ((port.seed >>> 0) ^ 0x6d61676d) >>> 0;
        const magmaRandom = (): number => {
            let value = (magmaState += 0x6d2b79f5);
            value = Math.imul(value ^ (value >>> 15), value | 1);
            value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
            return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
        };

        // Incandescent orange-gold base for glowing magma veins between crust plates.
        ctx.fillStyle = '#f25c0b';
        ctx.fillRect(0, 0, size, size);

        const drawWrappedPolygon = (
            cx: number,
            cy: number,
            radiusX: number,
            radiusY: number,
            vertices: number,
            angleOffset: number,
            radii: number[],
            fill: string,
        ) => {
            ctx.fillStyle = fill;
            for (let ox = -size; ox <= size; ox += size) {
                for (let oy = -size; oy <= size; oy += size) {
                    const px = cx + ox;
                    const py = cy + oy;
                    if (px + radiusX * 1.4 < 0 || px - radiusX * 1.4 > size ||
                        py + radiusY * 1.4 < 0 || py - radiusY * 1.4 > size) continue;
                    ctx.beginPath();
                    for (let v = 0; v < vertices; v++) {
                        const a = angleOffset + (v / vertices) * Math.PI * 2;
                        const vx = px + Math.cos(a) * radiusX * radii[v];
                        const vy = py + Math.sin(a) * radiusY * radii[v];
                        if (v === 0) ctx.moveTo(vx, vy);
                        else ctx.lineTo(vx, vy);
                    }
                    ctx.closePath();
                    ctx.fill();
                }
            }
        };

        // Bright hot magma eddies.
        const hotShades = ['#ff851b', '#ffab2e', '#ffd452', '#ff6c12'];
        for (let i = 0; i < 48; i++) {
            const cx = magmaRandom() * size;
            const cy = magmaRandom() * size;
            const rx = 14 + magmaRandom() * 28;
            const ry = 10 + magmaRandom() * 24;
            const verts = 6 + Math.floor(magmaRandom() * 3);
            const radii = Array.from({ length: verts }, () => 0.72 + magmaRandom() * 0.45);
            drawWrappedPolygon(
                cx, cy, rx, ry, verts, magmaRandom() * Math.PI * 2, radii,
                hotShades[Math.floor(magmaRandom() * hotShades.length)],
            );
        }

        // Cooling dark volcanic crust islands separated by glowing orange fissures.
        const crustShades = ['#681504', '#4d0d02', '#821e07', '#3a0801'];
        for (let i = 0; i < 42; i++) {
            const cx = magmaRandom() * size;
            const cy = magmaRandom() * size;
            const rx = 10 + magmaRandom() * 22;
            const ry = 8 + magmaRandom() * 18;
            const verts = 5 + Math.floor(magmaRandom() * 4);
            const radii = Array.from({ length: verts }, () => 0.68 + magmaRandom() * 0.48);
            drawWrappedPolygon(
                cx, cy, rx, ry, verts, magmaRandom() * Math.PI * 2, radii,
                crustShades[Math.floor(magmaRandom() * crustShades.length)],
            );
        }

        // Fine bright incandescent streaks threading across the molten surface.
        ctx.strokeStyle = 'rgba(255, 232, 130, 0.55)';
        for (let i = 0; i < 28; i++) {
            const startX = magmaRandom() * size;
            const startY = magmaRandom() * size;
            const angle = magmaRandom() * Math.PI * 2;
            const len = 18 + magmaRandom() * 38;
            ctx.lineWidth = 1.2 + magmaRandom() * 2.2;
            for (let ox = -size; ox <= size; ox += size) {
                for (let oy = -size; oy <= size; oy += size) {
                    const x0 = startX + ox;
                    const y0 = startY + oy;
                    if (x0 + len < 0 || x0 - len > size || y0 + len < 0 || y0 - len > size) continue;
                    ctx.beginPath();
                    ctx.moveTo(x0, y0);
                    ctx.lineTo(x0 + Math.cos(angle) * len, y0 + Math.sin(angle) * len);
                    ctx.stroke();
                }
            }
        }

        const texture = new THREE.CanvasTexture(canvas);
        texture.wrapS = THREE.RepeatWrapping;
        texture.wrapT = THREE.RepeatWrapping;
        texture.needsUpdate = true;
        return texture;
    }

    function createFakeTreeTexture(biome: BiomeId): THREE.CanvasTexture {
        const width = 256, height = 512;
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d')!;
        ctx.clearRect(0, 0, width, height);

        const trunkWidth = width * 0.125;
        const trunkLeft = (width - trunkWidth) / 2;
        const trunkTop = height * 0.24;
        const trunkColor = biome === 'warm' ? '#6f4a2b' : biome === 'cool' ? '#24272b' : '#b08a58';

        // The narrow center strip matches the pillar width on the wider canopy plane.
        ctx.fillStyle = trunkColor;
        ctx.beginPath();
        ctx.moveTo(trunkLeft + trunkWidth * 0.1, height);
        ctx.lineTo(trunkLeft + trunkWidth * 0.22, trunkTop);
        ctx.lineTo(trunkLeft + trunkWidth * 0.78, trunkTop);
        ctx.lineTo(trunkLeft + trunkWidth * 0.9, height);
        ctx.closePath();
        ctx.fill();

        const branchAnchors: { x: number; y: number; scale: number }[] = [
            { x: width * 0.5, y: trunkTop - 6, scale: 1.18 },
        ];
        const drawBranch = (x: number, y: number, angle: number, length: number, size: number, depth: number) => {
            const endX = x + Math.cos(angle) * length;
            const endY = y + Math.sin(angle) * length;
            ctx.strokeStyle = trunkColor;
            ctx.lineWidth = size;
            ctx.beginPath();
            ctx.moveTo(x, y);
            ctx.lineTo(endX, endY);
            ctx.stroke();
            branchAnchors.push({ x: endX, y: endY, scale: depth === 0 ? 0.95 : 0.8 });
            if (depth <= 0) return;
            const fork = 2 + Math.floor(detailRandom() * 2);
            for (let i = 0; i < fork; i++) {
                const startT = 0.45 + (i / fork) * 0.45;
                const fx = x + (endX - x) * startT;
                const fy = y + (endY - y) * startT;
                const spread = (i % 2 === 0 ? 1 : -1) * (0.35 + detailRandom() * 0.55);
                drawBranch(fx, fy, angle + spread,
                    length * (0.45 + detailRandom() * 0.22), size * 0.55, depth - 1);
            }
        };

        const primaryCount = 6;
        for (let i = 0; i < primaryCount; i++) {
            const side = i % 2 === 0 ? -1 : 1;
            const tier = Math.floor(i / 2);
            const spreadAngle = side * (0.38 + tier * 0.24 + detailRandom() * 0.2) - Math.PI / 2;
            drawBranch(
                width / 2 + side * trunkWidth * 0.22,
                trunkTop + 8 + tier * 14,
                spreadAngle,
                64 + detailRandom() * 34,
                10.5 - tier * 1.3,
                1,
            );
        }

        if (biome !== 'sand') {
            const palette = biome === 'warm' ? WARM_FAKE_TREE_CANOPY : COOL_FAKE_TREE_CANOPY;
            // Paint multi-tuft foliage puffs directly over the trunk crown and branch
            // tips so outer-border silhouettes mirror the connected 3D canopies.
            for (const anchor of branchAnchors) {
                const tufts = 3 + Math.floor(detailRandom() * 2);
                for (let t = 0; t < tufts; t++) {
                    const cx = anchor.x + (detailRandom() - 0.5) * 24 * anchor.scale;
                    const cy = anchor.y - 4 + (detailRandom() - 0.5) * 20 * anchor.scale;
                    const radiusX = (18 + detailRandom() * 18) * anchor.scale;
                    const radiusY = (14 + detailRandom() * 14) * anchor.scale;
                    ctx.fillStyle = palette[Math.floor(detailRandom() * palette.length)];
                    ctx.beginPath();
                    const vertices = 6 + Math.floor(detailRandom() * 3);
                    for (let vertex = 0; vertex < vertices; vertex++) {
                        const angle = (vertex / vertices) * Math.PI * 2;
                        const px = cx + Math.cos(angle) * radiusX * (0.82 + detailRandom() * 0.28);
                        const py = cy + Math.sin(angle) * radiusY * (0.82 + detailRandom() * 0.28);
                        if (vertex === 0) ctx.moveTo(px, py);
                        else ctx.lineTo(px, py);
                    }
                    ctx.closePath();
                    ctx.fill();
                }
            }
        }

        const texture = new THREE.CanvasTexture(canvas);
        return texture;
    }

    // Keep the original material-index draws so 2D bush placement, distant lava
    // and enemy poses remain at the same coordinates for existing seeds.
    function pickBushLeafVariant(): { rareAccent: boolean; shade: number } {
        const rareAutumnStart = 6;
        const index = worldRandom() < 0.08
            ? rareAutumnStart + Math.floor(worldRandom() * 2)
            : Math.floor(worldRandom() * rareAutumnStart);
        return { rareAccent: index >= rareAutumnStart, shade: detailRandom() };
    }

    function appendLowPolyBush(
        trunkInstances: T,
        leafInstances: T,
        x: number,
        z: number,
        scale: number,
        root: THREE.Object3D,
        part: THREE.Object3D,
        matrix: THREE.Matrix4,
        weights: BiomeWeights,
        barkColor: THREE.Color,
        leafColor: THREE.Color
    ): void {
        root.position.set(x, 0, z);
        root.rotation.set(0, 0, 0);
        root.scale.setScalar(scale);
        root.updateMatrix();

        part.position.set(0, 0.5, 0);
        part.rotation.set(0, 0, 0);
        part.scale.set(1, 1, 1);
        part.updateMatrix();
        matrix.multiplyMatrices(root.matrix, part.matrix);
        addChunkedInstance(trunkInstances, x, z, matrix, barkColor);

        const variant = pickBushLeafVariant();
        const numClusters = 1 + Math.floor(worldRandom() * 3);
        for (let i = 0; i < numClusters; i++) {
            const radius = 0.85 + worldRandom() * 0.8;
            const ox = numClusters === 1 ? 0 : (worldRandom() - 0.5) * 1.1;
            const oy = 0.75 + worldRandom() * 0.85;
            const oz = numClusters === 1 ? 0 : (worldRandom() - 0.5) * 1.1;
            part.position.set(ox, oy, oz);
            part.rotation.set(
                worldRandom() * Math.PI,
                worldRandom() * Math.PI,
                worldRandom() * Math.PI
            );
            part.scale.setScalar(radius);
            part.updateMatrix();
            matrix.multiplyMatrices(root.matrix, part.matrix);
            sampleBiomeBushColor(weights, variant.shade + (detailRandom() - 0.5) * 0.2, variant.rareAccent, leafColor);
            addChunkedInstance(leafInstances, x, z, matrix, leafColor);
        }
    }

    // Distant vegetation is rendered as sprites to fill the horizon without a huge
    // mesh count. Nearby bushes remain real 3D objects.
    function create2DLowPolyBushTexture(baseColorHex: number | string, random: () => number = worldRandom): THREE.CanvasTexture {
        const size = 256;
        const canvas = document.createElement('canvas');
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext('2d')!;

        ctx.clearRect(0, 0, size, size);

        const centerX = size / 2;
        const centerY = size * 0.9;

        function drawFacetedCluster(cx: number, cy: number, radius: number, colorHex: number | string) {
            let hex = colorHex;
            if (typeof hex === 'number') {
                hex = '#' + hex.toString(16).padStart(6, '0');
            }
            const r = parseInt(hex.slice(1, 3), 16);
            const g = parseInt(hex.slice(3, 5), 16);
            const b = parseInt(hex.slice(5, 7), 16);

            const numVertices = 6 + Math.floor(random() * 3);
            const vertices: { x: number, y: number }[] = [];
            for (let i = 0; i < numVertices; i++) {
                const angle = (i / numVertices) * Math.PI * 2 + (random() - 0.5) * 0.1;
                const dist = radius * (0.85 + random() * 0.3);
                vertices.push({
                    x: cx + Math.cos(angle) * dist,
                    y: cy + Math.sin(angle) * dist
                });
            }

            const centerOffsetX = (random() - 0.3) * (radius * 0.25);
            const centerOffsetY = -radius * 0.15 + (random() - 0.5) * (radius * 0.15);
            const center = { x: cx + centerOffsetX, y: cy + centerOffsetY };

            for (let i = 0; i < numVertices; i++) {
                const v1 = vertices[i];
                const v2 = vertices[(i + 1) % numVertices];

                const midX = (v1.x + v2.x) / 2;
                const midY = (v1.y + v2.y) / 2;
                const faceAngle = Math.atan2(midY - cy, midX - cx);

                const dot = Math.cos(faceAngle - (-Math.PI / 4));
                const lightFactor = 0.95 + dot * 0.25;

                const newR = Math.min(255, Math.max(0, Math.round(r * lightFactor)));
                const newG = Math.min(255, Math.max(0, Math.round(g * lightFactor)));
                const newB = Math.min(255, Math.max(0, Math.round(b * lightFactor)));
                const colorStr = `rgb(${newR}, ${newG}, ${newB})`;

                ctx.fillStyle = colorStr;
                ctx.strokeStyle = colorStr;
                ctx.lineWidth = 1;
                ctx.beginPath();
                ctx.moveTo(center.x, center.y);
                ctx.lineTo(v1.x, v1.y);
                ctx.lineTo(v2.x, v2.y);
                ctx.closePath();
                ctx.fill();
                ctx.stroke();
            }
        }

        drawFacetedCluster(centerX - 30, centerY - 35, 45, baseColorHex);
        drawFacetedCluster(centerX + 30, centerY - 35, 45, baseColorHex);
        drawFacetedCluster(centerX, centerY - 80, 50, baseColorHex);
        drawFacetedCluster(centerX - 10, centerY - 110, 38, baseColorHex);
        drawFacetedCluster(centerX + 15, centerY - 105, 35, baseColorHex);

        const texture = new THREE.CanvasTexture(canvas);
        return texture;
    }

    function overlapsWithPillarsOrLava(x: number, z: number, checkRadius: number): boolean {
        if (overlapsTown(x, z, checkRadius)) return true;
        const obstacleCandidates = obstacleHash.query(
            x,
            z,
            PILLAR_WIDTH + checkRadius,
            _placementObstacleCandidates
        );
        if (checkAABBOverlap(x, z, checkRadius, obstacleCandidates, PILLAR_WIDTH / 2)) return true;

        const lavaCandidates = lavaHash.query(
            x,
            z,
            LAVA_POOL_QUERY_RADIUS + checkRadius,
            _placementLavaCandidates
        );
        for (const pool of lavaCandidates) {
            const half = getLavaPoolDescriptor(pool)?.boundRadius ?? LAVA_POOL_HALF_SIZE;
            if (Math.abs(x - pool.position.x) < half + checkRadius &&
                Math.abs(z - pool.position.z) < half + checkRadius) return true;
        }
        if (x * x + z * z < 625) return true;
        return false;
    }

    function overlapsWithFakePillars(x: number, z: number, checkRadius: number): boolean {
        if (!fakePillars) return false;
        return checkAABBOverlap(x, z, checkRadius, fakePillars, (PILLAR_WIDTH * 1.5) / 2);
    }

    function createFloor(): void {
        // Every world starts here, so reset the independent tree/detail and lava
        // streams. World-stream draws remain untouched for established seeds.
        resetDetailRandom();
        resetLavaRandom();
        // Grass and town paving meet at y=0 without competing depth-buffer layers.
        const half = GROUND_VISUAL_SIZE / 2;
        const shape = new THREE.Shape([
            new THREE.Vector2(-half, -half), new THREE.Vector2(half, -half),
            new THREE.Vector2(half, half), new THREE.Vector2(-half, half),
        ]);
        shape.holes.push(new THREE.Path(getTownPavingOutline().map(([x, z]) => new THREE.Vector2(x, -z))));
        const floorGeo = new THREE.ShapeGeometry(shape);
        const positions = floorGeo.getAttribute('position');
        const uv = floorGeo.getAttribute('uv');
        for (let i = 0; i < uv.count; i++) {
            uv.setXY(i, positions.getX(i) / GROUND_VISUAL_SIZE + 0.5, positions.getY(i) / GROUND_VISUAL_SIZE + 0.5);
        }
        const grassTex = createGrassTexture();
        const sandTex = createSandTexture();
        worldGrassTex = grassTex;
        worldSandTex = sandTex;
        const floorMat = new THREE.MeshLambertMaterial({ map: grassTex, color: 0xffffff });
        enableGroundDetailDerivatives(floorMat);
        const lavaPitMaskUniform: { value: THREE.Texture } = { value: EMPTY_LAVA_PIT_MASK };
        floorMat.userData.lavaPitMaskUniform = lavaPitMaskUniform;
        floorMat.onBeforeCompile = (shader) => {
            shader.uniforms.uBiomeMap = { value: port.biomeMapTexture };
            shader.uniforms.uSandMap = { value: sandTex };
            shader.uniforms.uLavaPitMask = lavaPitMaskUniform;
            shader.vertexShader = shader.vertexShader.replace(
                '#include <common>',
                `#include <common>
                ${GROUND_DETAIL_VERTEX_PARS_GLSL}
                varying vec2 vBiomeWorldXZ;`
            );
            // Compute world XZ after the floor's -90 degree rotation. Reusing the
            // unrepeated ground UVs directly would flip the biome map in Z.
            shader.vertexShader = shader.vertexShader.replace(
                '#include <begin_vertex>',
                `#include <begin_vertex>
                ${GROUND_DETAIL_VERTEX_GLSL}
                vBiomeWorldXZ = (modelMatrix * vec4(transformed, 1.0)).xz;`
            );
            shader.fragmentShader = shader.fragmentShader.replace(
                '#include <common>',
                `#include <common>
                uniform sampler2D uBiomeMap;
                uniform sampler2D uSandMap;
                uniform sampler2D uLavaPitMask;
                varying vec2 vBiomeWorldXZ;
                ${GROUND_DETAIL_PARS_GLSL}`
            );
            shader.fragmentShader = shader.fragmentShader.replace('#include <map_fragment>', `
                #ifdef USE_MAP
                    // Decode the linearly filtered SDF pit mask so curved cutouts
                    // follow the basin rim smoothly without texel stair-stepping.
                    vec2 pitUv = clamp(vBiomeWorldXZ / ${GROUND_VISUAL_SIZE.toFixed(1)} + 0.5, 0.0, 1.0);
                    float pitSdf = (texture2D(uLavaPitMask, pitUv).r - 0.5) * ${(2 * LAVA_PIT_MASK_ENCODE_RANGE).toFixed(1)};
                    if (pitSdf < 0.0) discard;
                    vec2 biomeUv = pitUv;
                    vec3 biomeWeights = texture2D(uBiomeMap, biomeUv).rgb;
                    vec3 grassSample = texture2D(map, vMapUv).rgb;
                    vec3 sandSample = texture2D(uSandMap, vMapUv).rgb;
                    float grassLuma = dot(grassSample, vec3(0.299, 0.587, 0.114));
                    // Cool ground keeps the blade pattern but moves toward dark
                    // pine-moss; sand replaces grass entirely in its core.
                    vec3 coolGrass = mix(grassSample * vec3(0.42, 0.60, 0.52),
                        vec3(0.106, 0.196, 0.169) * (0.4 + grassLuma), 0.5);
                    vec3 groundSample = grassSample * biomeWeights.r +
                        coolGrass * biomeWeights.g + sandSample * biomeWeights.b;
                    diffuseColor.rgb *= groundSample / max(biomeWeights.r + biomeWeights.g + biomeWeights.b, 0.001);
                    vec3 groundDetailBiomeWeights = biomeWeights;
                    ${GROUND_DETAIL_ALBEDO_GLSL}
                #endif
            `);
            shader.fragmentShader = shader.fragmentShader.replace(
                '#include <normal_fragment_maps>',
                `#include <normal_fragment_maps>
                #ifdef USE_MAP
                    ${GROUND_DETAIL_NORMAL_GLSL}
                #endif`
            );
        };
        floorMat.customProgramCacheKey = () => 'biome-ground-v5';
        floorMat.userData.extraTextures = [sandTex];
        const floor = new THREE.Mesh(floorGeo, floorMat);
        floor.name = 'grass-floor';
        floor.rotation.x = -Math.PI / 2;
        floor.receiveShadow = true;
        floor.userData.extraTextures = [sandTex];
        addWorldObject(floor);
        // The gameplay floor remains continuous, including beneath culled objects.
        const collider = new THREE.Mesh(new THREE.PlaneGeometry(GROUND_VISUAL_SIZE, GROUND_VISUAL_SIZE), new THREE.MeshBasicMaterial());
        collider.rotation.x = -Math.PI / 2;
        collider.visible = false;
        collider.name = 'ground-collider';
        port.floor(addWorldObject(collider));
    }

    function createLavaPitVisuals(capacity: number): { basin: T[]; surface: T[] } {
        const geometries = createLavaShapeGeometries();
        const basinMaterial = new THREE.MeshLambertMaterial({
            map: worldGrassTex ?? undefined,
            vertexColors: true,
            flatShading: false,
            // Push the tucked outer skirt slightly behind the uncut floor so
            // overlapping border pixels never z-fight at distance.
            polygonOffset: true,
            polygonOffsetFactor: 1,
            polygonOffsetUnits: 1,
        });
        enableGroundDetailDerivatives(basinMaterial);
        if (worldGrassTex && worldSandTex) {
            const sandTex = worldSandTex;
            basinMaterial.onBeforeCompile = (shader) => {
                shader.uniforms.uBiomeMap = { value: port.biomeMapTexture };
                shader.uniforms.uSandMap = { value: sandTex };
                shader.vertexShader = shader.vertexShader.replace(
                    '#include <common>',
                    `#include <common>
                    ${GROUND_DETAIL_VERTEX_PARS_GLSL}
                    varying vec2 vBasinWorldXZ;`,
                );
                shader.vertexShader = shader.vertexShader.replace(
                    '#include <begin_vertex>',
                    `#include <begin_vertex>
                    ${GROUND_DETAIL_VERTEX_GLSL}
                    vec4 basinWorldPos = vec4(transformed, 1.0);
                    #ifdef USE_INSTANCING
                        basinWorldPos = instanceMatrix * basinWorldPos;
                    #endif
                    vBasinWorldXZ = (modelMatrix * basinWorldPos).xz;`,
                );
                shader.fragmentShader = shader.fragmentShader.replace(
                    '#include <common>',
                    `#include <common>
                    uniform sampler2D uBiomeMap;
                    uniform sampler2D uSandMap;
                    varying vec2 vBasinWorldXZ;
                    ${GROUND_DETAIL_PARS_GLSL}`,
                );
                // Sample the exact same world-aligned biome ground textures as
                // floorMat so the rim at y=0 (vertexColor=1) is seam-free.
                shader.fragmentShader = shader.fragmentShader.replace('#include <map_fragment>', `
                    #ifdef USE_MAP
                        vec2 basinBiomeUv = clamp(vBasinWorldXZ / ${GROUND_VISUAL_SIZE.toFixed(1)} + 0.5, 0.0, 1.0);
                        vec2 basinGroundUv = vec2(vBasinWorldXZ.x / ${GROUND_VISUAL_SIZE.toFixed(1)} + 0.5, -vBasinWorldXZ.y / ${GROUND_VISUAL_SIZE.toFixed(1)} + 0.5) * 250.0;
                        vec3 basinBiomeWeights = texture2D(uBiomeMap, basinBiomeUv).rgb;
                        vec3 basinGrass = texture2D(map, basinGroundUv).rgb;
                        vec3 basinSand = texture2D(uSandMap, basinGroundUv).rgb;
                        float basinGrassLuma = dot(basinGrass, vec3(0.299, 0.587, 0.114));
                        vec3 basinCool = mix(basinGrass * vec3(0.42, 0.60, 0.52),
                            vec3(0.106, 0.196, 0.169) * (0.4 + basinGrassLuma), 0.5);
                        vec3 basinGround = basinGrass * basinBiomeWeights.r +
                            basinCool * basinBiomeWeights.g + basinSand * basinBiomeWeights.b;
                        diffuseColor.rgb *= basinGround / max(basinBiomeWeights.r + basinBiomeWeights.g + basinBiomeWeights.b, 0.001);
                        vec3 groundDetailBiomeWeights = basinBiomeWeights;
                        ${GROUND_DETAIL_ALBEDO_GLSL}
                    #endif
                `);
                shader.fragmentShader = shader.fragmentShader.replace(
                    '#include <normal_fragment_maps>',
                    `#include <normal_fragment_maps>
                    #ifdef USE_MAP
                        ${GROUND_DETAIL_NORMAL_GLSL}
                    #endif`,
                );
            };
            basinMaterial.customProgramCacheKey = () => 'lava-basin-ground-v3';
            basinMaterial.userData.extraTextures = [sandTex];
        }
        if (!worldLavaTex) worldLavaTex = createLavaTexture();
        const surfaceMaterial = new THREE.MeshStandardMaterial({
            map: worldLavaTex,
            emissiveMap: worldLavaTex,
            color: 0xff8c3a,
            emissive: 0xff4b12,
            emissiveIntensity: 1.45,
            roughness: 0.45,
            metalness: 0.05,
        });
        return {
            basin: geometries.map(geometry => createChunkedInstanceSet(
                geometry.basin, basinMaterial, capacity, false, true, 'lava')),
            surface: geometries.map(geometry => createChunkedInstanceSet(
                geometry.surface, surfaceMaterial, capacity, false, false, 'lava')),
        };
    }

    function placeLavaPit(
        visuals: { basin: T[]; surface: T[] },
        x: number,
        z: number,
        yaw: number,
        scale: number,
        shapeIndex: LavaShapeIndex,
        boundRadius: number,
    ): THREE.Object3D {
        const dummy = new THREE.Object3D();
        dummy.position.set(x, 0, z);
        dummy.rotation.set(0, yaw, 0);
        // Scale only X/Z: the basin keeps its authored 0.8-unit depth and the
        // liquid surface stays exactly at LAVA_SURFACE_Y.
        dummy.scale.set(scale, 1, scale);
        dummy.updateMatrix();
        addChunkedInstance(visuals.basin[shapeIndex], x, z, dummy.matrix);
        addChunkedInstance(visuals.surface[shapeIndex], x, z, dummy.matrix);

        const registry = new THREE.Object3D();
        registry.position.set(x, LAVA_SURFACE_Y, z);
        setLavaPoolDescriptor(registry, { x, z, yaw, shapeIndex, scale, boundRadius });
        return addWorldObject(registry);
    }

    function createFakeBillboards(): void {
        // Background-only props outside the playable square. They add scale without
        // participating in physics or gameplay.
        fakePillars = []; port.fakePillars(fakePillars);
        const fakePillarGeo = new THREE.PlaneGeometry(PILLAR_WIDTH * 10, 1);
        const fakePillarMats: Record<BiomeId, THREE.MeshLambertMaterial> = {
            warm: new THREE.MeshLambertMaterial({
                map: createFakeTreeTexture('warm'), transparent: true, alphaTest: 0.5,
                side: THREE.DoubleSide,
            }),
            cool: new THREE.MeshLambertMaterial({
                map: createFakeTreeTexture('cool'), transparent: true, alphaTest: 0.5,
                side: THREE.DoubleSide,
            }),
            sand: new THREE.MeshLambertMaterial({
                map: createFakeTreeTexture('sand'), transparent: true, alphaTest: 0.5,
                side: THREE.DoubleSide,
            }),
        };

        for (let i = 0; i < FAKE_PILLAR_COUNT; i++) {
            const angle = worldRandom() * Math.PI * 2;
            const directionX = Math.cos(angle);
            const directionZ = Math.sin(angle);
            const borderRadius = (MAP_SIZE / 2) / Math.max(Math.abs(directionX), Math.abs(directionZ));
            const radius = borderRadius + 20 + worldRandom() * 700;
            const x = directionX * radius;
            const z = directionZ * radius;
            const height = 20 + worldRandom() * (MAX_PILLAR_HEIGHT - 20);

            port.biomeField.sample(x, z, biomeWeights);
            const mesh = new THREE.Mesh(fakePillarGeo, fakePillarMats[getDominantBiome(biomeWeights)]);
            mesh.scale.set(1, height, 1);
            mesh.position.set(x, height / 2, z);

            addWorldObject(mesh);
            fakePillars.push(mesh);
        }

        // The sand-only fake pools take their positions from the lava stream so
        // changing their count can never move pillars or the later enemy layout.
        for (let i = 0; i < LEGACY_FAKE_LAVA_DRAWS; i++) worldRandom();

        fakeLavaObjects = [];
        const fakeLava = createLavaPitVisuals(FAKE_LAVA_POOL_COUNT);
        let placedFakePools = 0;
        for (let attempt = 0; attempt < FAKE_LAVA_POOL_COUNT * 80 && placedFakePools < FAKE_LAVA_POOL_COUNT; attempt++) {
            const shapeIndex = (placedFakePools % LAVA_SHAPE_COUNT) as LavaShapeIndex;
            const scale = 0.88 + lavaRandom() * 0.24;
            const boundRadius = getLavaShapeBoundRadius(shapeIndex, scale);
            const angle = lavaRandom() * Math.PI * 2;
            const directionX = Math.cos(angle);
            const directionZ = Math.sin(angle);
            const borderRadius = MAP_HALF_SIZE / Math.max(Math.abs(directionX), Math.abs(directionZ));
            const radius = borderRadius + boundRadius + 20 + lavaRandom() * 600;
            const x = directionX * radius;
            const z = directionZ * radius;

            if (Math.max(Math.abs(x), Math.abs(z)) < MAP_HALF_SIZE + boundRadius + 10) continue;
            port.biomeField.sample(x, z, lavaWeights);
            if (lavaWeights.sand < 0.6) continue;

            fakeLavaObjects.push(placeLavaPit(fakeLava, x, z, lavaRandom() * Math.PI * 2, scale, shapeIndex, boundRadius));
            placedFakePools++;
        }
        port.fakeLava(fakeLavaObjects);
    }

    function createPillars(): void {
        obstacleHash.clear();
        const dummy = new THREE.Object3D();
        const branchDummy = new THREE.Object3D();
        const canopyDummy = new THREE.Object3D();
        const branchDirection = new THREE.Vector3();
        const barkColor = new THREE.Color();
        const leafColor = new THREE.Color();
        const boxGeo = new THREE.BoxGeometry(PILLAR_WIDTH, 1, PILLAR_WIDTH);

        const barkTex = createBarkTexture(worldRandom);
        const ringsTex = createRingsTexture(worldRandom);

        const barkMat = new THREE.MeshStandardMaterial({
            map: barkTex,
            roughness: 0.9,
            metalness: 0.1
        });

        const ringsMat = new THREE.MeshStandardMaterial({
            map: ringsTex,
            roughness: 0.8,
            metalness: 0.1
        });

        // Real-world-scale grain keeps tall instanced trunks and fine branch
        // cylinders consistent instead of stretching the texture pattern.
        installSurfaceDetailShader(barkMat, 'bark');
        installSurfaceDetailShader(ringsMat, 'rings');

        // Keep each face's existing vertices/UVs; only group opaque triangles by
        // material so every visible chunk needs two draws instead of six.
        const indices = boxGeo.index!, reordered: number[] = [];
        for (const face of [0, 1, 4, 5, 2, 3]) for (let i = face * 6; i < face * 6 + 6; i++) reordered.push(indices.getX(i));
        boxGeo.setIndex(reordered); boxGeo.clearGroups();
        boxGeo.addGroup(0, 24, 0); boxGeo.addGroup(24, 12, 1);
        const materials = [barkMat, ringsMat];

        const pillarInstances = createChunkedInstanceSet(boxGeo, materials, PILLAR_COUNT, true, true, 'pillars');

        // Branches and canopy clusters are presentation only. They never enter
        // obstacleHash or state.obstacles, so tree foliage cannot block movement.
        const branchGeo = new THREE.CylinderGeometry(0.42, 1.0, 1.0, 6);
        const branchInstances = createChunkedInstanceSet(branchGeo, barkMat, PILLAR_COUNT * 36, false, true, 'branches');
        const canopyGeo = createSculptedFoliageGeometry();
        const canopyMat = new THREE.MeshLambertMaterial({ color: 0xffffff, flatShading: true });
        installLeafAnimationShader(canopyMat, 'tree-canopy-wind-v2');
        const canopyInstances = createChunkedInstanceSet(canopyGeo, canopyMat, PILLAR_COUNT * 38, true, true, 'canopy');

        const colliderMat = new THREE.MeshBasicMaterial();
        const sharedUnitBoxGeo = new THREE.BoxGeometry(1, 1, 1);
        const canopyAxis = new THREE.Vector3();
        const canopyRoll = new THREE.Quaternion();

        function addBranch(
            pillarId: number,
            pillarX: number,
            pillarZ: number,
            baseX: number,
            baseY: number,
            baseZ: number,
            yaw: number,
            tilt: number,
            length: number,
            thickness: number,
        ): { dirX: number; dirY: number; dirZ: number } {
            const dirX = Math.sin(tilt) * Math.cos(yaw);
            const dirY = Math.cos(tilt);
            const dirZ = Math.sin(tilt) * Math.sin(yaw);
            branchDirection.set(dirX, dirY, dirZ);
            branchDummy.position.set(
                baseX + dirX * length / 2,
                baseY + dirY * length / 2,
                baseZ + dirZ * length / 2,
            );
            branchDummy.quaternion.setFromUnitVectors(UP, branchDirection);
            branchDummy.scale.set(thickness, length, thickness);
            branchDummy.updateMatrix();
            addChunkedInstance(branchInstances, pillarX, pillarZ, branchDummy.matrix, barkColor, pillarId);
            return { dirX, dirY, dirZ };
        }

        function addFoliageCluster(
            pillarId: number,
            pillarX: number,
            pillarZ: number,
            anchorX: number,
            anchorY: number,
            anchorZ: number,
            axisX: number,
            axisY: number,
            axisZ: number,
            scaleRadius: number,
        ): void {
            canopyAxis.set(axisX, axisY, axisZ).normalize();
            canopyDummy.position.set(anchorX, anchorY, anchorZ);
            canopyDummy.quaternion.setFromUnitVectors(UP, canopyAxis);
            canopyRoll.setFromAxisAngle(canopyAxis, detailRandom() * Math.PI * 2);
            canopyDummy.quaternion.premultiply(canopyRoll);
            canopyDummy.scale.set(
                scaleRadius * (0.9 + detailRandom() * 0.24),
                scaleRadius * (0.82 + detailRandom() * 0.22),
                scaleRadius * (0.9 + detailRandom() * 0.24),
            );
            canopyDummy.updateMatrix();
            sampleBiomeLeafColor(biomeWeights, detailRandom(), leafColor);
            addChunkedInstance(canopyInstances, pillarX, pillarZ, canopyDummy.matrix, leafColor, pillarId);
        }

        function addPillarTreeCrown(pillarId: number, x: number, z: number, height: number): void {
            const isSand = biomeWeights.sand >= 0.5;
            const leafFactor = isSand
                ? 0
                : biomeWeights.sand <= 0.15
                    ? 1.0
                    : 1.0 - (biomeWeights.sand - 0.15) / 0.35;

            // 6-9 sturdy primary boughs emerging out of the upper trunk, each
            // forking into 2-3 secondary limbs for a 44-64 unit canopy span.
            const primaryCount = 6 + Math.floor(detailRandom() * 4);
            const baseAngle = detailRandom() * Math.PI * 2;
            const crownBand = Math.min(10, height * 0.35);

            for (let b = 0; b < primaryCount; b++) {
                const yaw = baseAngle + (b / primaryCount) * Math.PI * 2 +
                    (detailRandom() - 0.5) * (Math.PI * 1.1 / primaryCount);
                const tilt = THREE.MathUtils.degToRad(34 + detailRandom() * 34);
                const length = isSand ? (17 + detailRandom() * 11) : (16 + detailRandom() * 12);
                const thickness = isSand ? (1.1 + detailRandom() * 0.55) : (1.15 + detailRandom() * 0.55);
                const baseY = height - crownBand + detailRandom() * Math.max(0.5, crownBand - 0.5);
                // Keep the branch base embedded inside the trunk wall (half-width 3.0).
                const baseRadius = 1.6 + detailRandom() * 0.9;
                const baseX = x + Math.cos(yaw) * baseRadius;
                const baseZ = z + Math.sin(yaw) * baseRadius;
                const primaryDir = addBranch(pillarId, x, z, baseX, baseY, baseZ, yaw, tilt, length, thickness);

                // Attach a mid-bough foliage cluster right at the primary fork zone.
                if (leafFactor > 0 && (leafFactor >= 0.99 || detailRandom() < leafFactor)) {
                    const midT = 0.58 + detailRandom() * 0.2;
                    addFoliageCluster(
                        pillarId, x, z,
                        baseX + primaryDir.dirX * length * midT,
                        baseY + primaryDir.dirY * length * midT,
                        baseZ + primaryDir.dirZ * length * midT,
                        primaryDir.dirX * 0.45,
                        primaryDir.dirY * 0.45 + 0.55,
                        primaryDir.dirZ * 0.45,
                        4.6 + detailRandom() * 1.7,
                    );
                }

                // 2-3 secondary sub-branches forking outward from the primary bough.
                const subCount = 2 + Math.floor(detailRandom() * 2);
                for (let s = 0; s < subCount; s++) {
                    const forkT = Math.min(0.92, 0.45 + (s / subCount) * 0.4 + detailRandom() * 0.08);
                    const forkX = baseX + primaryDir.dirX * length * forkT;
                    const forkY = baseY + primaryDir.dirY * length * forkT;
                    const forkZ = baseZ + primaryDir.dirZ * length * forkT;
                    const side = s % 2 === 0 ? 1 : -1;
                    const subYaw = yaw + side * (0.42 + detailRandom() * 0.52) +
                        (s === 2 ? (detailRandom() - 0.5) * 0.7 : 0);
                    const subTilt = THREE.MathUtils.degToRad(34 + detailRandom() * 38);
                    const subLength = length * (0.42 + detailRandom() * 0.24);
                    const subThickness = thickness * (0.48 + detailRandom() * 0.14);
                    const subDir = addBranch(
                        pillarId, x, z,
                        forkX, forkY, forkZ,
                        subYaw, subTilt, subLength, subThickness,
                    );

                    // Attach a sculpted multi-tuft cluster directly onto each sub-branch tip.
                    if (leafFactor > 0 && (leafFactor >= 0.99 || detailRandom() < leafFactor)) {
                        const tipT = 0.84 + detailRandom() * 0.1;
                        addFoliageCluster(
                            pillarId, x, z,
                            forkX + subDir.dirX * subLength * tipT,
                            forkY + subDir.dirY * subLength * tipT,
                            forkZ + subDir.dirZ * subLength * tipT,
                            subDir.dirX * 0.5,
                            subDir.dirY * 0.5 + 0.5,
                            subDir.dirZ * 0.5,
                            4.8 + detailRandom() * 2.1,
                        );
                    }
                }
            }

            // Cap the central trunk top so the inner crown closes densely over the wood.
            if (leafFactor > 0) {
                for (let cap = 0; cap < 2; cap++) {
                    if (cap > 0 && leafFactor < 0.99 && detailRandom() >= leafFactor) continue;
                    const capAngle = detailRandom() * Math.PI * 2;
                    const capOffset = detailRandom() * 2.2;
                    addFoliageCluster(
                        pillarId, x, z,
                        x + Math.cos(capAngle) * capOffset,
                        height - 1.4 + detailRandom() * 1.4,
                        z + Math.sin(capAngle) * capOffset,
                        (detailRandom() - 0.5) * 0.25,
                        1.0,
                        (detailRandom() - 0.5) * 0.25,
                        6.2 + detailRandom() * 1.8,
                    );
                }
            }
        }

        let pillarId = 0;
        for (let i = 0; i < PILLAR_COUNT; i++) {
            const height = 20.0 + worldRandom() * (MAX_PILLAR_HEIGHT - 20.0);
            dummy.scale.set(1, height, 1);
            dummy.position.set(
                (worldRandom() - 0.5) * (MAP_SIZE - 40),
                height / 2,
                (worldRandom() - 0.5) * (MAP_SIZE - 40)
            );
            let attempts = 0;
            while (overlapsTown(dummy.position.x, dummy.position.z, PILLAR_WIDTH / 2) && attempts++ < 100) {
                dummy.position.x = (worldRandom() - 0.5) * (MAP_SIZE - 40);
                dummy.position.z = (worldRandom() - 0.5) * (MAP_SIZE - 40);
            }
            if (overlapsTown(dummy.position.x, dummy.position.z, PILLAR_WIDTH / 2)) continue;
            dummy.updateMatrix();
            port.biomeField.sample(dummy.position.x, dummy.position.z, biomeWeights);
            sampleBiomeBarkColor(biomeWeights, barkColor);
            addChunkedInstance(pillarInstances, dummy.position.x, dummy.position.z, dummy.matrix, barkColor);

            const obstacle = new THREE.Mesh(sharedUnitBoxGeo, colliderMat);
            obstacle.scale.set(PILLAR_WIDTH, height, PILLAR_WIDTH);
            obstacle.position.copy(dummy.position);
            const data = obstacleData(obstacle);
            data.height = height;
            data.halfW = PILLAR_WIDTH / 2;
            data.halfD = PILLAR_WIDTH / 2;
            data.halfH = height / 2;
            // Invisible meshes are the gameplay colliders and grapple targets; the
            // visible pillars are batched in the InstancedMesh above.
            obstacle.visible = false;
            addWorldObject(obstacle);
            port.pillar(obstacle);
            obstacleHash.insert(obstacle.position.x, obstacle.position.z, PILLAR_WIDTH, obstacle);

            const id = pillarId++;
            addPillarTreeCrown(id, dummy.position.x, dummy.position.z, height);
        }
    }

    function createLavaPools(): void {
        lavaHash.clear();
        const visuals = createLavaPitVisuals(LAVA_POOL_COUNT);
        const placedPools: { x: number; z: number; boundRadius: number }[] = [];

        for (let attempt = 0; attempt < LAVA_POOL_COUNT * 80 && placedPools.length < LAVA_POOL_COUNT; attempt++) {
            const shapeIndex = (placedPools.length % LAVA_SHAPE_COUNT) as LavaShapeIndex;
            const scale = 0.88 + lavaRandom() * 0.24;
            const boundRadius = getLavaShapeBoundRadius(shapeIndex, scale);
            const x = (lavaRandom() - 0.5) * (MAP_SIZE - 80);
            const z = (lavaRandom() - 0.5) * (MAP_SIZE - 80);

            if (Math.abs(x) > MAP_HALF_SIZE - boundRadius - 10 ||
                Math.abs(z) > MAP_HALF_SIZE - boundRadius - 10) continue;
            if (overlapsTown(x, z, boundRadius + 2)) continue;
            if (overlapsWithPillars(x, z, boundRadius + 1)) continue;
            if (placedPools.some(pool =>
                Math.hypot(x - pool.x, z - pool.z) < pool.boundRadius + boundRadius + 4)) continue;

            port.biomeField.sample(x, z, lavaWeights);
            if (lavaWeights.sand < 0.6) continue;
            // Keep the whole rim inside sand instead of ending half on grass.
            const rimSand =
                port.biomeField.sample(x + boundRadius, z, lavaWeights).sand >= 0.45 &&
                port.biomeField.sample(x - boundRadius, z, lavaWeights).sand >= 0.45 &&
                port.biomeField.sample(x, z + boundRadius, lavaWeights).sand >= 0.45 &&
                port.biomeField.sample(x, z - boundRadius, lavaWeights).sand >= 0.45;
            if (!rimSand) continue;

            const yaw = lavaRandom() * Math.PI * 2;
            const registry = placeLavaPit(visuals, x, z, yaw, scale, shapeIndex, boundRadius);
            port.lava(registry);
            lavaHash.insert(x, z, boundRadius, registry);
            placedPools.push({ x, z, boundRadius });
        }
    }

    function createBushes(): void {
        // Near-field bushes are geometry; far-field bushes are sprites. Both avoid
        // blockers/hazards so the arena remains readable.
        const trunkInstances = createChunkedInstanceSet(
            SHARED_TRUNK_GEO,
            SHARED_TRUNK_MAT,
            BUSH_3D_COUNT
        );
        const leafInstances = createChunkedInstanceSet(
            SHARED_LEAF_GEO,
            SHARED_LEAF_MAT,
            BUSH_3D_COUNT * 3
        );
        const bushRoot = new THREE.Object3D();
        const bushPart = new THREE.Object3D();
        const bushMatrix = new THREE.Matrix4();
        const barkColor = new THREE.Color();
        const leafColor = new THREE.Color();

        let spawned3DBushes = 0;
        let attempts3D = 0;
        while (spawned3DBushes < BUSH_3D_COUNT && attempts3D < BUSH_3D_COUNT * 10) {
            attempts3D++;
            const angle = worldRandom() * Math.PI * 2;
            const radius = worldRandom() * BUSH_3D_RADIUS_CAP;
            const x = Math.cos(angle) * radius;
            const z = Math.sin(angle) * radius;

            if (!overlapsWithPillarsOrLava(x, z, 3.5)) {
                const s = 0.75 + worldRandom() * 0.5;
                port.biomeField.sample(x, z, biomeWeights);
                sampleBiomeBarkColor(biomeWeights, barkColor);
                appendLowPolyBush(
                    trunkInstances,
                    leafInstances,
                    x,
                    z,
                    s,
                    bushRoot,
                    bushPart,
                    bushMatrix,
                    biomeWeights,
                    barkColor,
                    leafColor
                );
                spawned3DBushes++;
            }
        }

        // Existing warm sprite textures keep their original worldRandom draws.
        // The two new palettes use the detail stream so bush/enemy layout cannot move.
        const bush2DTextures: Record<BiomeId, THREE.CanvasTexture[]> = {
            warm: WARM_BUSH_2D_SHADES.map(color => create2DLowPolyBushTexture(color)),
            cool: COOL_BUSH_2D_SHADES.map(color => create2DLowPolyBushTexture(color, detailRandom)),
            sand: SAND_BUSH_2D_SHADES.map(color => create2DLowPolyBushTexture(color, detailRandom)),
        };
        const spriteMaterials: Record<BiomeId, THREE.SpriteMaterial[]> = {
            warm: bush2DTextures.warm.map(tex => new THREE.SpriteMaterial({ map: tex, transparent: true, color: 0xffffff })),
            cool: bush2DTextures.cool.map(tex => new THREE.SpriteMaterial({ map: tex, transparent: true, color: 0xffffff })),
            sand: bush2DTextures.sand.map(tex => new THREE.SpriteMaterial({ map: tex, transparent: true, color: 0xffffff })),
        };

        let spawned2DOutside = 0;
        let attempts2DOutside = 0;
        while (spawned2DOutside < BUSH_2D_COUNT && attempts2DOutside < BUSH_2D_COUNT * 8) {
            attempts2DOutside++;
            const angle = worldRandom() * Math.PI * 2;
            const radius = BUSH_2D_INNER_RADIUS + worldRandom() * BUSH_2D_SPREAD;
            const x = Math.cos(angle) * radius;
            const z = Math.sin(angle) * radius;

            if (!overlapsWithFakePillars(x, z, 3.5)) {
                port.biomeField.sample(x, z, biomeWeights);
                const palette = spriteMaterials[getDominantBiome(biomeWeights)];
                const mat = palette[Math.floor(worldRandom() * palette.length)];
                const height = 4.0 + worldRandom() * 2.0;
                const width = height * (0.8 + worldRandom() * 0.3);
                spawned2DOutside++;
                if (Math.max(Math.abs(x), Math.abs(z)) < MAP_SIZE / 2 + width / 2) continue;
                const sprite = new THREE.Sprite(mat);
                sprite.scale.set(width, height, 1.0);
                sprite.position.set(x, height / 2, z);
                addWorldObject(sprite);
                addChunkedRenderObject(sprite);
            }
        }
    }


    const reset = () => {
        obstacleHash.clear(); lavaHash.clear(); fakePillars = []; fakeLavaObjects = [];
        worldGrassTex = null; worldSandTex = null; worldLavaTex = null;
        _placementObstacleCandidates.length = _placementLavaCandidates.length = 0;
    };
    return { createFloor, createFakeBillboards, createPillars, createLavaPools, createBushes, reset };
}
