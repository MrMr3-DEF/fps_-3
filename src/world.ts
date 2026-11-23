import { createSceneryBuilder, SHARED_WORLD_GEOMETRIES, SHARED_WORLD_MATERIALS, type SceneryRole } from './seededScenery.js';
import { cancelHookForTarget } from './hookLifecycle.js';
import * as THREE from 'three';
import { createBiomeField, createBiomeMapTexture, type BiomeField } from './biomes.js';
import { resetLeafAnimation } from './leafAnimation.js';
import { state } from './state.js';
import { ForgottenMecha, type MechaEvents } from './forgottenMecha.js';
import {
    MAP_SIZE,
    GROUND_VISUAL_SIZE,
    PILLAR_WIDTH,
    MAX_ENEMY_HEIGHT,
    ENEMY_COUNT,
    ENEMY_CLASSES,
    LAVA_POOL_HALF_SIZE,
    TARGET_HIT_RANGE_MULTIPLIER,
    RENDER_CHUNK_SIZE,
    MAX_RENDER_DISTANCE_CHUNKS
} from './config.js';
import { InfantryDefense, type InfantryEnvironment } from './infantry.js';
import { segmentAabbHitT, segmentGroundHitT } from './gameplayMath.js';
import { SpatialHash } from './spatialHash.js';
import { createLavaGlowTexture, getLavaDarknessStrength, LAVA_GLOW_SIZE } from './lavaGlow.js';
import {
    LAVA_PIT_MASK_ENCODE_RANGE,
    LAVA_POOL_QUERY_RADIUS,
    createLavaPitMaskTexture,
    getLavaPitFloorY,
    getLavaPoolDescriptor,
    isPointInLava,
} from './lavaPools.js';
import { obstacleData, targetData } from './userDataTypes.js';
import { GothGirlfriend } from './gothGirlfriend.js';
import { createGothHouseDecor } from './gothHouse.js';
import { createTownBoxes, generateTownLayout, overlapsTown, type TownMaterial } from './town.js';
import { installSurfaceDetailShader, type SurfaceDetailProfile } from './surfaceDetail.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

const obstacleHash = new SpatialHash<THREE.Object3D>(32);
const lavaHash = new SpatialHash<THREE.Object3D>(32);
const targetHash = new SpatialHash<THREE.Group>(48);
const infantryHash = new SpatialHash<THREE.Group>(24);
const infantryCandidates: THREE.Group[] = [];
export let gothGirlfriend: GothGirlfriend | null = null;
export let forgottenMecha: ForgottenMecha | null = null;
export let infantry: InfantryDefense | null = null;
/** Changes only at a real world replacement/disposal boundary. */
export let worldGeneration = 0;

export async function prepareInfantry(events: Pick<InfantryEnvironment, 'attack' | 'wallLost'>, checkpoint: () => Promise<void>): Promise<void> {
    if (!state.scene) return;
    const defense = new InfantryDefense(state.scene, state.targets, worldSeed,
        state.obstacles.filter(object => obstacleData(object).damageTarget !== 'forgotten-mecha'), state.lavaPools,
        { ...events, trace: traceInfantryCover, visible: position => activeRenderChunks.has(getRenderChunkKey(position.x, position.z)) },
        !state.isMultiplayer || state.isHost);
    infantry = defense;
    await defense.load();
    await checkpoint();
}

/** Asset preparation is awaited by match startup; cancellation disposes even
 * a model that finishes downloading after its match has already been replaced. */
export async function prepareForgottenMecha(events: MechaEvents, checkpoint: () => Promise<void>): Promise<void> {
    if (!state.scene) return;
    const scene = state.scene;
    const actor = new ForgottenMecha([...state.obstacles], [...state.lavaPools], worldSeed, events, queryObstaclesAlongSegment, queryLavaPoolsNear);
    forgottenMecha = actor;
    scene.add(actor.group, actor.combat.effects.group, actor.pilot.rockets.group);
    await actor.load();
    await checkpoint();
    if (forgottenMecha !== actor || state.scene !== scene || actor.disposed) throw new DOMException('Loading cancelled', 'AbortError');
    if (state.renderer) actor.prepareLighting(state.renderer);
    for (const collider of actor.colliders) { scene.add(collider); state.obstacles.push(collider); }
}

const worldObjects: THREE.Object3D[] = [];
const renderChunks = new Map<string, THREE.Object3D[]>();
const activeRenderChunks = new Set<string>();
let grappleFloor: THREE.Object3D | null = null;
let townLanternFlames: THREE.InstancedMesh | null = null;
let townLanternGlassMaterial: THREE.MeshStandardMaterial | null = null;
const wellBounds = new THREE.Box3();
const wellRay = new THREE.Ray();
const wellRayEnd = new THREE.Vector3();
const traceMin = new THREE.Vector3(), traceMax = new THREE.Vector3();
const traceObstacles: THREE.Object3D[] = [];

interface TownLantern {
    x: number;
    z: number;
    phase: number;
    chunk: string;
}

const TOWN_LANTERN_LIGHT_COUNT = 3;
const townLanternLights: THREE.PointLight[] = [];
const townLanterns: TownLantern[] = [];
const lanternMatrixDummy = new THREE.Object3D();
const TOWN_LANTERN_POSITIONS = [
    [-8.5, -60], [8.5, -25], [-8.5, 25], [8.5, 60],
    [-60, 8.5], [-25, -8.5], [25, 8.5], [60, -8.5],
] as const;

const LAVA_LIGHT_COUNT = 1;
const LAVA_LIGHT_REASSIGN_DISTANCE_SQ = 2 * 2;
const lavaLights: THREE.PointLight[] = [];
const visibleLavaPools: THREE.Object3D[] = [];
const lavaLightAnchor = new THREE.Vector3(Number.POSITIVE_INFINITY, 0, Number.POSITIVE_INFINITY);
let lavaLightGroup: THREE.Group | null = null;
let lavaGlowMesh: THREE.Mesh | null = null;
const lavaVisibleChunks = { value: new THREE.Vector3(0, 0, -1) };
let lavaGlowMaterial: THREE.MeshBasicMaterial | null = null;
let selectedLavaPool: THREE.Object3D | null = null;
let litLavaPool: THREE.Object3D | null = null;
let lavaLightFade = 0;
let lastLavaLightTime = 0;

interface ChunkedInstanceSet {
    group: THREE.Group;
    geometry: THREE.BufferGeometry;
    material: THREE.Material | THREE.Material[];
    castShadow: boolean;
    receiveShadow: boolean;
    chunkMeshes: Map<string, THREE.InstancedMesh>;
    matricesByChunk: Map<string, THREE.Matrix4[]>;
    colorsByChunk: Map<string, number[]> | null;
}

// Static props are split into one frustum-culled InstancedMesh per populated
// render chunk, toggled on chunk crossings with zero buffer copying.
const chunkedInstanceSets: ChunkedInstanceSet[] = [];
let targetUpdateFrame = 0;
let lastRenderChunkX = Number.NaN;
let lastRenderChunkZ = Number.NaN;
let lastRenderDistanceChunks = -1;

// Biome presentation is owned by the current world. It never participates in
// collision, spawn or hit authority.
let worldBiomeField: BiomeField | null = null;
let worldBiomeMapTexture: THREE.DataTexture | null = null;
let lavaPitMaskTexture: THREE.DataTexture | null = null;
let fakeLavaPools: THREE.Object3D[] = [];

export function getWorldBiomeField(): BiomeField | null {
    return worldBiomeField;
}

export function getWorldBiomeMapTexture(): THREE.DataTexture | null {
    return worldBiomeMapTexture;
}

// Procedural gameplay geometry must be identical for every player in a room.
// Keep its PRNG private to world generation so particle/UI randomness cannot
// perturb the level sequence between peers.
let worldSeed = generateWorldSeed();
let worldRandomState = worldSeed;

export function generateWorldSeed(): number {
    const cryptoApi = globalThis.crypto;
    if (cryptoApi?.getRandomValues) {
        const values = new Uint32Array(1);
        cryptoApi.getRandomValues(values);
        return values[0];
    }
    return (Date.now() ^ Math.floor(Math.random() * 0xffffffff)) >>> 0;
}

export function getWorldSeed(): number {
    return worldSeed;
}

export function setWorldSeed(seed: number): void {
    worldSeed = seed >>> 0;
    worldRandomState = worldSeed;
}

/** Rebuilds only the procedural arena; player and networking visuals survive. */
export function rebuildEnvironmentWithSeed(seed: number): void {
    if (!state.scene) return;
    setWorldSeed(seed);
    disposeWorld();
    createEnvironment(true);
}

function resetWorldRandom(): void {
    worldRandomState = worldSeed;
}

function worldRandom(): number {
    // Mulberry32: deterministic, fast, and sufficient for cosmetic/procedural layout.
    let value = (worldRandomState += 0x6d2b79f5);
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
}

const _placementObstacleCandidates: THREE.Object3D[] = [];
const _grappleLavaCandidates: THREE.Object3D[] = [];
const _terrainLavaCandidates: THREE.Object3D[] = [];
const _lavaContactCandidates: THREE.Object3D[] = [];
// The largest scaled organic pool spans ~32 units; use the shared query radius
// so terrain and contact lookups stay branch-free.
const LAVA_QUERY_RADIUS = LAVA_POOL_QUERY_RADIUS;

function addWorldObject<T extends THREE.Object3D>(obj: T): T {
    state.scene!.add(obj);
    worldObjects.push(obj);
    return obj;
}

function mergeLanternParts(parts: THREE.BufferGeometry[]): THREE.BufferGeometry {
    const merged = mergeGeometries(parts, false);
    parts.forEach(part => part.dispose());
    if (!merged) throw new Error('Unable to build the town lantern geometry.');
    return merged;
}

function createLanternFrameGeometry(): THREE.BufferGeometry {
    const parts: THREE.BufferGeometry[] = [
        new THREE.CylinderGeometry(0.34, 0.43, 0.3, 8).translate(0, 0.15, 0),
        new THREE.CylinderGeometry(0.09, 0.13, 3.8, 10).translate(0, 2.05, 0),
        new THREE.CylinderGeometry(0.22, 0.15, 0.25, 8).translate(0, 4.04, 0),
        new THREE.BoxGeometry(0.82, 0.12, 0.82).translate(0, 4.25, 0),
        new THREE.ConeGeometry(0.68, 0.48, 4).rotateY(Math.PI / 4).translate(0, 5.37, 0),
        new THREE.SphereGeometry(0.11, 8, 5).translate(0, 5.7, 0),
    ];
    for (const x of [-0.36, 0.36]) for (const z of [-0.36, 0.36]) {
        parts.push(new THREE.BoxGeometry(0.055, 0.95, 0.055).translate(x, 4.75, z));
    }
    return mergeLanternParts(parts);
}

function createTownLanterns(): void {
    const frameGeometry = createLanternFrameGeometry();
    const glassGeometry = new THREE.CylinderGeometry(0.34, 0.43, 0.85, 4, 1, true)
        .rotateY(Math.PI / 4)
        .translate(0, 4.73, 0);
    const flameGeometry = new THREE.SphereGeometry(0.11, 8, 5).scale(1, 2.2, 1);

    const frameMaterial = new THREE.MeshStandardMaterial({
        color: 0x171512,
        metalness: 0.7,
        roughness: 0.42,
    });
    townLanternGlassMaterial = new THREE.MeshStandardMaterial({
        color: 0xffad55,
        emissive: 0xff7a1a,
        emissiveIntensity: 0.05,
        transparent: true,
        opacity: 0.34,
        roughness: 0.22,
        side: THREE.DoubleSide,
    });
    const flameMaterial = new THREE.MeshBasicMaterial({ color: 0xffd27a });

    const group = new THREE.Group();
    group.name = 'town-lanterns';
    const frameSet = createChunkedInstanceSet(frameGeometry, frameMaterial, TOWN_LANTERN_POSITIONS.length, false, false, undefined, group);
    frameSet.group.name = 'town-lantern-frames';
    const glassSet = createChunkedInstanceSet(glassGeometry, townLanternGlassMaterial, TOWN_LANTERN_POSITIONS.length, false, false, undefined, group);
    glassSet.group.name = 'town-lantern-glass';
    townLanternFlames = new THREE.InstancedMesh(flameGeometry, flameMaterial, TOWN_LANTERN_POSITIONS.length);
    townLanternFlames.name = 'town-lantern-flames';
    townLanternFlames.instanceMatrix.setUsage(THREE.DynamicDrawUsage);

    const colliderGeometry = new THREE.BoxGeometry(0.7, 5.7, 0.7);
    const colliderMaterial = new THREE.MeshBasicMaterial();
    townLanternLights.length = 0;
    townLanterns.length = 0;
    for (let i = 0; i < TOWN_LANTERN_LIGHT_COUNT; i++) {
        const light = new THREE.PointLight(0xffa34d, 0, 30, 2);
        light.visible = false;
        group.add(light);
        townLanternLights.push(light);
    }
    TOWN_LANTERN_POSITIONS.forEach(([x, z], index) => {
        lanternMatrixDummy.position.set(x, 0, z);
        lanternMatrixDummy.scale.set(1, 1, 1);
        lanternMatrixDummy.updateMatrix();
        addChunkedInstance(frameSet, x, z, lanternMatrixDummy.matrix);
        addChunkedInstance(glassSet, x, z, lanternMatrixDummy.matrix);

        lanternMatrixDummy.position.set(x, 4.67, z);
        lanternMatrixDummy.scale.setScalar(0);
        lanternMatrixDummy.updateMatrix();
        townLanternFlames!.setMatrixAt(index, lanternMatrixDummy.matrix);

        townLanterns.push({ x, z, phase: index * 1.731, chunk: getRenderChunkKey(x, z) });

        const collider = new THREE.Mesh(colliderGeometry, colliderMaterial);
        collider.name = 'town-lantern';
        collider.position.set(x, 2.85, z);
        Object.assign(obstacleData(collider), {
            height: 5.7,
            halfW: 0.35,
            halfD: 0.35,
            halfH: 2.85,
        });
        collider.visible = false;
        addWorldObject(collider);
        state.obstacles.push(collider);
        obstacleHash.insert(x, z, 0.5, collider);
    });
    townLanternFlames.instanceMatrix.needsUpdate = true;
    townLanternFlames.frustumCulled = false;
    group.add(townLanternFlames);
    addWorldObject(group);
}

export function getGasLanternFlicker(timeSeconds: number, phase: number): number {
    return 0.91
        + Math.sin(timeSeconds * 11.3 + phase) * 0.055
        + Math.sin(timeSeconds * 23.7 + phase * 1.7) * 0.025
        + Math.sin(timeSeconds * 4.1 + phase * 0.6) * 0.02;
}

let lastLanternTime = 0, lastLanternStrength = 0;
let lanternsDark = false;
const lastLanternObserver = new THREE.Vector3();
const nearestLanternIndices = [-1, -1, -1];
const nearestLanternDistSq = [0, 0, 0];

export function updateTownLanterns(
    timeSeconds: number,
    strength: number,
    preparing = false,
    observerPosition?: THREE.Vector3,
): void {
    lastLanternTime = timeSeconds;
    lastLanternStrength = strength;
    if (observerPosition) lastLanternObserver.copy(observerPosition);
    if (!townLanternFlames || !townLanternGlassMaterial) return;
    const clampedStrength = Math.max(0, Math.min(1, strength));
    if (lanternsDark && clampedStrength === 0 && !preparing) return;
    lanternsDark = clampedStrength === 0;
    townLanternGlassMaterial.emissiveIntensity = 0.05 + clampedStrength * 1.25;

    const obs = observerPosition ?? state.camera?.position ?? lastLanternObserver;
    const obsX = obs.x;
    const obsZ = obs.z;
    for (let slot = 0; slot < TOWN_LANTERN_LIGHT_COUNT; slot++) {
        nearestLanternIndices[slot] = -1;
        nearestLanternDistSq[slot] = Number.POSITIVE_INFINITY;
    }

    for (let index = 0; index < townLanterns.length; index++) {
        const { x, z, phase, chunk } = townLanterns[index];
        const flicker = getGasLanternFlicker(timeSeconds, phase);
        const visible = preparing || activeRenderChunks.has(chunk);

        const flameScale = visible ? clampedStrength * flicker : 0;
        lanternMatrixDummy.position.set(x, 4.67, z);
        lanternMatrixDummy.scale.set(flameScale, flameScale * 1.08, flameScale);
        lanternMatrixDummy.updateMatrix();
        townLanternFlames.setMatrixAt(index, lanternMatrixDummy.matrix);

        if (!visible) continue;
        const dx = x - obsX;
        const dz = z - obsZ;
        const distSq = dx * dx + dz * dz;
        for (let slot = 0; slot < TOWN_LANTERN_LIGHT_COUNT; slot++) {
            if (distSq < nearestLanternDistSq[slot]) {
                for (let shift = TOWN_LANTERN_LIGHT_COUNT - 1; shift > slot; shift--) {
                    nearestLanternIndices[shift] = nearestLanternIndices[shift - 1];
                    nearestLanternDistSq[shift] = nearestLanternDistSq[shift - 1];
                }
                nearestLanternIndices[slot] = index;
                nearestLanternDistSq[slot] = distSq;
                break;
            }
        }
    }

    // Keep all 3 point lights active whenever night lighting is enabled so
    // NUM_POINT_LIGHTS never changes on chunk crossings.
    const lightsVisible = clampedStrength > 0.015;
    for (let slot = 0; slot < townLanternLights.length; slot++) {
        const light = townLanternLights[slot];
        light.visible = lightsVisible;
        const lanternIndex = nearestLanternIndices[slot];
        if (lanternIndex >= 0) {
            const lantern = townLanterns[lanternIndex];
            light.position.set(lantern.x, 4.7, lantern.z);
            light.intensity = 42 * clampedStrength * getGasLanternFlicker(timeSeconds, lantern.phase);
        } else {
            light.intensity = 0;
        }
    }
    townLanternFlames.instanceMatrix.needsUpdate = true;
}

function createLavaLights(): void {
    lavaLightGroup = new THREE.Group();
    lavaLightGroup.name = 'lava-lights';
    lavaLights.length = 0;
    for (let index = 0; index < LAVA_LIGHT_COUNT; index++) {
        const light = new THREE.PointLight(0xff651f, 0, 52, 2);
        light.castShadow = false;
        lavaLightGroup.add(light);
        lavaLights.push(light);
    }
    lavaLightAnchor.set(Number.POSITIVE_INFINITY, 0, Number.POSITIVE_INFINITY);
    addWorldObject(lavaLightGroup);
}

function refreshLavaLightPositions(observerPosition: THREE.Vector3): void {
    if (observerPosition.distanceToSquared(lavaLightAnchor) <= LAVA_LIGHT_REASSIGN_DISTANCE_SQ) return;
    lavaLightAnchor.copy(observerPosition);

    let nearest: THREE.Object3D | null = null;
    let nearestDistanceSq = Number.POSITIVE_INFINITY;
    for (const pool of visibleLavaPools) {
        const distanceSq = pool.position.distanceToSquared(observerPosition);
        if (distanceSq < nearestDistanceSq) {
            nearest = pool;
            nearestDistanceSq = distanceSq;
        }
    }
    // Hysteresis prevents repeated handoffs when walking along a shared edge.
    if (nearest && selectedLavaPool &&
        activeRenderChunks.has(getRenderChunkKey(selectedLavaPool.position.x, selectedLavaPool.position.z)) &&
        selectedLavaPool.position.distanceToSquared(observerPosition) < nearestDistanceSq * 1.25) return;
    selectedLavaPool = nearest;
}

export function updateLavaLights(timeSeconds: number, observerPosition: THREE.Vector3, nightStrength: number, enabled = true): void {
    if (!lavaLightGroup) return;
    const delta = Math.max(0, Math.min(0.1, timeSeconds - lastLavaLightTime));
    lastLavaLightTime = timeSeconds;
    lavaLightGroup.visible = enabled;
    const darkness = getLavaDarknessStrength(nightStrength);
    if (lavaGlowMesh) lavaGlowMesh.visible = enabled && darkness > 0;
    if (lavaGlowMaterial) lavaGlowMaterial.opacity = 0.55 * darkness;
    if (!enabled) {
        for (const light of lavaLights) light.intensity = 0;
        lavaLightFade = 0;
        lavaLightAnchor.set(Number.POSITIVE_INFINITY, 0, Number.POSITIVE_INFINITY);
        return;
    }
    refreshLavaLightPositions(observerPosition);
    // Fade out before moving the single light: no bright spot sliding across
    // the ground and no shader recompilation as nearby pools enter/leave range.
    if (litLavaPool !== selectedLavaPool) {
        lavaLightFade = Math.max(0, lavaLightFade - delta * 5);
        if (lavaLightFade === 0) litLavaPool = selectedLavaPool;
    } else {
        lavaLightFade = Math.min(1, lavaLightFade + delta * 4);
    }
    for (const light of lavaLights) {
        if (litLavaPool) light.position.set(litLavaPool.position.x, 4, litLavaPool.position.z);
        const sourceVisible = litLavaPool && activeRenderChunks.has(getRenderChunkKey(litLavaPool.position.x, litLavaPool.position.z));
        light.intensity = sourceVisible ? 220 * darkness * lavaLightFade : 0;
    }
}

/** One non-overlapping ground surface avoids seams between adjacent pools. */
function createLavaGlowMaterial(): THREE.MeshBasicMaterial {
    const material = new THREE.MeshBasicMaterial({
        color: 0xff6318, map: createLavaGlowTexture(state.lavaPools),
        transparent: true, opacity: 0,
        blending: THREE.AdditiveBlending, depthWrite: false,
        polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1,
    });
    const pitMaskUniform = { value: lavaPitMaskTexture };
    material.onBeforeCompile = (shader) => {
        shader.uniforms.lavaVisibleChunks = lavaVisibleChunks;
        shader.uniforms.uLavaPitMask = pitMaskUniform;
        shader.vertexShader = shader.vertexShader.replace(
            '#include <common>',
            `#include <common>
            varying vec2 vGlowWorldXZ;`,
        );
        shader.vertexShader = shader.vertexShader.replace(
            '#include <begin_vertex>',
            `#include <begin_vertex>
            vGlowWorldXZ = (modelMatrix * vec4(transformed, 1.0)).xz;`,
        );
        shader.fragmentShader = shader.fragmentShader.replace(
            '#include <common>',
            `#include <common>
            uniform vec3 lavaVisibleChunks;
            uniform sampler2D uLavaPitMask;
            varying vec2 vGlowWorldXZ;`,
        );
        shader.fragmentShader = shader.fragmentShader.replace('#include <map_fragment>', `
            // Clip the ground-level glow sheet out of recessed pit interiors
            // along the exact same smooth SDF contour used by the terrain floor.
            vec2 glowPitUv = clamp(vGlowWorldXZ / ${GROUND_VISUAL_SIZE.toFixed(1)} + 0.5, 0.0, 1.0);
            float glowPitSdf = (texture2D(uLavaPitMask, glowPitUv).r - 0.5) * ${(2 * LAVA_PIT_MASK_ENCODE_RANGE).toFixed(1)};
            if (glowPitSdf < 0.0) discard;
            vec4 spillData = texture2D(map, vMapUv);
            vec2 sourceUv = (floor(vMapUv * ${material.map!.image.width.toFixed(1)}) + 0.5) / ${material.map!.image.width.toFixed(1)};
            vec2 sourceChunk = floor(texture2D(map, sourceUv).gb * 255.0 + 0.5) - 128.0;
            vec2 chunkDistance = abs(sourceChunk - lavaVisibleChunks.xy);
            if (spillData.r < 0.002 || max(chunkDistance.x, chunkDistance.y) > lavaVisibleChunks.z) discard;
            float rimFade = smoothstep(0.0, 0.45, glowPitSdf);
            diffuseColor.a *= spillData.r * rimFade;
        `);
        // Additive light fades to zero in fog, rather than adding the sky color.
        shader.fragmentShader = shader.fragmentShader.replace('#include <fog_fragment>', THREE.ShaderChunk.fog_fragment.replace(
            'gl_FragColor.rgb = mix( gl_FragColor.rgb, fogColor, fogFactor );',
            'gl_FragColor.rgb *= 1.0 - fogFactor;',
        ));
    };
    material.customProgramCacheKey = () => 'lava-ground-spill-v3';
    return material;
}

function getRenderChunkKey(x: number, z: number): string {
    return `${Math.floor(x / RENDER_CHUNK_SIZE)},${Math.floor(z / RENDER_CHUNK_SIZE)}`;
}

function createChunkedInstanceSet(
    geometry: THREE.BufferGeometry,
    material: THREE.Material | THREE.Material[],
    _capacity: number,
    castShadow = false,
    receiveShadow = false,
    role?: SceneryRole,
    parent?: THREE.Group
): ChunkedInstanceSet {
    const group = new THREE.Group();
    if (role) group.name = `world-${role}`;
    if (parent) parent.add(group); else addWorldObject(group);

    const instanceSet: ChunkedInstanceSet = {
        group,
        geometry,
        material,
        castShadow,
        receiveShadow,
        chunkMeshes: new Map<string, THREE.InstancedMesh>(),
        matricesByChunk: new Map<string, THREE.Matrix4[]>(),
        colorsByChunk: null,
    };
    chunkedInstanceSets.push(instanceSet);
    return instanceSet;
}

function addChunkedInstance(
    instanceSet: ChunkedInstanceSet,
    x: number,
    z: number,
    matrix: THREE.Matrix4,
    color?: THREE.Color,
): void {
    const key = getRenderChunkKey(x, z);
    const matrices = instanceSet.matricesByChunk.get(key);
    if (matrices) {
        matrices.push(matrix.clone());
    } else {
        instanceSet.matricesByChunk.set(key, [matrix.clone()]);
    }

    if (!color) return;
    if (!instanceSet.colorsByChunk) instanceSet.colorsByChunk = new Map<string, number[]>();
    const colors = instanceSet.colorsByChunk.get(key);
    if (colors) {
        colors.push(color.r, color.g, color.b);
    } else {
        instanceSet.colorsByChunk.set(key, [color.r, color.g, color.b]);
    }
}

/** Reveal all chunked meshes during WebGL preparation before chunk culling resumes. */
export function prepareWorldInstanceBuffers(): void {
    for (const set of chunkedInstanceSets) {
        for (const mesh of set.chunkMeshes.values()) {
            mesh.visible = true;
        }
    }
    lastRenderChunkX = Number.NaN;
}

function addChunkedRenderObject(obj: THREE.Object3D): void {
    const key = getRenderChunkKey(obj.position.x, obj.position.z);
    obj.userData.renderChunkKey = key;
    const chunk = renderChunks.get(key);
    if (chunk) {
        chunk.push(obj);
    } else {
        renderChunks.set(key, [obj]);
    }
    obj.visible = activeRenderChunks.has(key);
}

function refreshChunkedRenderObject(obj: THREE.Object3D): void {
    const oldKey = obj.userData.renderChunkKey as string | undefined;
    const newKey = getRenderChunkKey(obj.position.x, obj.position.z);
    if (!oldKey) return;
    if (oldKey === newKey) {
        obj.visible = activeRenderChunks.has(newKey);
        return;
    }

    const oldChunk = renderChunks.get(oldKey);
    if (oldChunk) {
        const index = oldChunk.indexOf(obj);
        if (index !== -1) oldChunk.splice(index, 1);
        if (oldChunk.length === 0) renderChunks.delete(oldKey);
    }

    obj.userData.renderChunkKey = newKey;
    const newChunk = renderChunks.get(newKey);
    if (newChunk) {
        newChunk.push(obj);
    } else {
        renderChunks.set(newKey, [obj]);
    }
    obj.visible = activeRenderChunks.has(newKey);
}

function setRenderChunkVisible(key: string, visible: boolean): void {
    const objects = renderChunks.get(key);
    if (objects) {
        for (let i = 0; i < objects.length; i++) {
            objects[i].visible = visible;
        }
    }
    for (let i = 0; i < chunkedInstanceSets.length; i++) {
        const mesh = chunkedInstanceSets[i].chunkMeshes.get(key);
        if (mesh) mesh.visible = visible;
    }
}

export function updateEnvironmentVisibility(position: THREE.Vector3, distanceChunks: number): void {
    const centerX = Math.floor(position.x / RENDER_CHUNK_SIZE);
    const centerZ = Math.floor(position.z / RENDER_CHUNK_SIZE);
    const radius = Math.max(1, Math.min(MAX_RENDER_DISTANCE_CHUNKS, Math.round(distanceChunks)));
    if (centerX === lastRenderChunkX && centerZ === lastRenderChunkZ && radius === lastRenderDistanceChunks) return;

    lastRenderChunkX = centerX;
    lastRenderChunkZ = centerZ;
    lastRenderDistanceChunks = radius;
    lavaVisibleChunks.value.set(centerX, centerZ, radius);
    lavaLightAnchor.set(Number.POSITIVE_INFINITY, 0, Number.POSITIVE_INFINITY);

    const nextActive = new Set<string>();

    for (let dz = -radius; dz <= radius; dz++) {
        for (let dx = -radius; dx <= radius; dx++) {
            const key = `${centerX + dx},${centerZ + dz}`;
            nextActive.add(key);
            if (!activeRenderChunks.has(key)) {
                setRenderChunkVisible(key, true);
            }
        }
    }

    activeRenderChunks.forEach((key) => {
        if (!nextActive.has(key)) {
            setRenderChunkVisible(key, false);
        }
    });

    activeRenderChunks.clear();
    nextActive.forEach((key) => activeRenderChunks.add(key));
    visibleLavaPools.length = 0;
    for (const pool of state.lavaPools) {
        if (activeRenderChunks.has(getRenderChunkKey(pool.position.x, pool.position.z))) visibleLavaPools.push(pool);
    }
    // Repack dynamic flames and lights on the same chunk transition, including
    // zero-delta settings changes and prepared-world reveals.
    updateTownLanterns(lastLanternTime, lastLanternStrength, false, position);
}

export function queryObstaclesNear(x: number, z: number, radius: number, out?: THREE.Object3D[]): THREE.Object3D[] {
    const candidates = obstacleHash.query(x, z, radius, out);
    // Only one actor has moving colliders. Append its bounded set rather than
    // rebuilding thousands of static hash entries every animation frame.
    for (const collider of forgottenMecha?.solidColliders ?? []) {
        const data = obstacleData(collider);
        if (Math.abs(x - collider.position.x) <= radius + data.halfW && Math.abs(z - collider.position.z) <= radius + data.halfD) candidates.push(collider);
    }
    return candidates;
}

export function queryLavaPoolsNear(x: number, z: number, radius: number, out?: THREE.Object3D[]): THREE.Object3D[] {
    return lavaHash.query(x, z, radius, out);
}

/** Ground height from recessed lava basins; dry ground returns zero. */
export function getTerrainHeightAt(x: number, z: number): number {
    const pools = lavaHash.query(x, z, LAVA_QUERY_RADIUS, _terrainLavaCandidates);
    return getLavaPitFloorY(x, z, pools);
}

/** Feet-level contact against the organic liquid rim of nearby pools. */
export function isInLavaAt(x: number, z: number, feetY: number, radius = 0): boolean {
    const pools = lavaHash.query(x, z, LAVA_QUERY_RADIUS + radius, _lavaContactCandidates);
    return isPointInLava(x, z, feetY, radius, pools);
}

export function queryTargetsNear(x: number, z: number, radius: number, out?: THREE.Group[]): THREE.Group[] {
    const results = targetHash.query(x, z, radius, out);
    for (const bot of infantryHash.query(x, z, radius, infantryCandidates)) if (targetData(bot).hp > 0) results.push(bot);
    return results;
}

export function queryObstaclesAlongSegment(
    startX: number,
    startZ: number,
    endX: number,
    endZ: number,
    out?: THREE.Object3D[],
    padding = 0,
): THREE.Object3D[] {
    const candidates = obstacleHash.querySegment(startX, startZ, endX, endZ, out, padding);
    for (const collider of forgottenMecha?.solidColliders ?? []) {
        const data = obstacleData(collider);
        if (collider.position.x + data.halfW + padding >= Math.min(startX, endX) && collider.position.x - data.halfW - padding <= Math.max(startX, endX) &&
            collider.position.z + data.halfD + padding >= Math.min(startZ, endZ) && collider.position.z - data.halfD - padding <= Math.max(startZ, endZ)) candidates.push(collider);
    }
    return candidates;
}

export function queryTargetsAlongSegment(
    startX: number,
    startZ: number,
    endX: number,
    endZ: number,
    out?: THREE.Group[],
    padding = 0
): THREE.Group[] {
    const results = targetHash.querySegment(startX, startZ, endX, endZ, out, padding);
    for (const bot of infantryHash.querySegment(startX, startZ, endX, endZ, infantryCandidates, padding)) {
        if (targetData(bot).hp > 0) results.push(bot);
    }
    return results;
}

/** First contact along a shot or sightline, including ground and active shields. */
export function shotObstructionT(start: THREE.Vector3, end: THREE.Vector3, radius: number, ignoreMecha = false,
    contact?: { obstacle?: THREE.Object3D }): number | null {
    if (contact) contact.obstacle = undefined;
    let closest = segmentGroundHitT(start, end, radius) ?? Infinity;
    if (!ignoreMecha) closest = Math.min(closest, forgottenMecha?.combat.shieldContactT(start, end, start, radius) ?? Infinity);
    for (const candidate of queryObstaclesAlongSegment(start.x, start.z, end.x, end.z, traceObstacles, radius)) {
        const data = obstacleData(candidate);
        if (ignoreMecha && data.damageTarget === 'forgotten-mecha') continue;
        const { x, y, z } = candidate.position;
        const halfW = (data.halfW || PILLAR_WIDTH / 2) + radius;
        const halfD = (data.halfD || PILLAR_WIDTH / 2) + radius;
        const halfH = (data.halfH || data.height / 2) + radius;
        traceMin.set(x - halfW, y - halfH, z - halfD);
        traceMax.set(x + halfW, y + halfH, z + halfD);
        const hit = segmentAabbHitT(start, end, traceMin, traceMax);
        if (hit !== null && hit < closest) {
            closest = hit;
            if (contact) contact.obstacle = candidate;
        }
    }
    return closest === Infinity ? null : closest;
}

const infantryCover: { obstacle?: THREE.Object3D } = {};
function traceInfantryCover(start: THREE.Vector3, end: THREE.Vector3, ignoreMecha = false) {
    const t = shotObstructionT(start, end, 0, ignoreMecha, infantryCover);
    return t === null ? null : { position: start.clone().lerp(end, t), obstacle: infantryCover.obstacle };
}

export function isLookingAtTownWell(camera: THREE.Camera, anchor?: THREE.Vector3): boolean {
    if (wellBounds.isEmpty()) return false;
    camera.getWorldPosition(wellRay.origin);
    camera.getWorldDirection(wellRay.direction);
    if (!wellBounds.containsPoint(wellRay.origin)) {
        // Only cover in front of the inspection volume matters. The opening
        // between the posts belongs to the well even when the ray hits no stone.
        if (!wellRay.intersectBox(wellBounds, wellRayEnd)) return false;
        const obstruction = shotObstructionT(wellRay.origin, wellRayEnd, 0, false, infantryCover);
        if (obstruction !== null && infantryCover.obstacle?.name !== 'town-well') return false;
    }
    if (anchor) {
        wellBounds.getCenter(anchor);
        anchor.y = wellBounds.max.y + 0.25;
    }
    return true;
}

export function rebuildInfantryHash(): void {
    infantryHash.clear();
    for (let index = ENEMY_COUNT; index < state.targets.length; index++) {
        const bot = state.targets[index], data = targetData(bot);
        if (data.hp > 0) infantryHash.insert(bot.position.x, bot.position.z, TARGET_HIT_RANGE_MULTIPLIER * data.scale, bot);
    }
}

/**
 * The floor is always a candidate, while pillars and lava are gathered only
 * from cells crossed by the hook ray. This replaces a full-scene raycast.
 */
export function queryGrappleSurfacesAlongSegment(
    startX: number,
    startZ: number,
    endX: number,
    endZ: number,
    out: THREE.Object3D[] = []
): THREE.Object3D[] {
    const candidates = queryObstaclesAlongSegment(startX, startZ, endX, endZ, out);
    const lavaCandidates = lavaHash.querySegment(startX, startZ, endX, endZ, _grappleLavaCandidates);
    for (let i = 0; i < lavaCandidates.length; i++) candidates.push(lavaCandidates[i]);
    if (grappleFloor) candidates.push(grappleFloor);
    return candidates;
}

export function rebuildTargetHash(): void {
    targetHash.clear();
    for (let i = 0; i < state.targets.length; i++) {
        const target = state.targets[i];
        if (targetData(target).infantry) continue;
        refreshChunkedRenderObject(target);
        const radius = TARGET_HIT_RANGE_MULTIPLIER * (targetData(target).scale || 1.0);
        targetHash.insert(target.position.x, target.position.z, radius, target);
    }
}

export function respawnTarget(targetGroup: THREE.Group): void {
    cancelHookForTarget(targetGroup);
    // A rotating cube fits within sqrt(3) * scale. Reserve the largest class
    // before choosing one so targets never spawn inside architecture or pillars.
    const radius = Math.sqrt(3) * Math.max(...ENEMY_CLASSES.map(enemy => enemy.scale));
    let placed = false;
    for (let attempt = 0; attempt < 100; attempt++) {
        const x = (worldRandom() - 0.5) * (MAP_SIZE - 40);
        const y = radius + worldRandom() * (MAX_ENEMY_HEIGHT - radius);
        const z = (worldRandom() - 0.5) * (MAP_SIZE - 40);
        if (overlapsTown(x, z, radius)) continue;
        const candidates = obstacleHash.query(x, z, radius, _placementObstacleCandidates);
        if (candidates.some(obstacle => {
            const data = obstacleData(obstacle);
            return Math.abs(x - obstacle.position.x) < data.halfW + radius &&
                Math.abs(z - obstacle.position.z) < data.halfD + radius &&
                Math.abs(y - obstacle.position.y) < data.halfH + radius;
        })) continue;
        targetGroup.position.set(x, y, z);
        placed = true;
        break;
    }
    // This map-edge fallback is above every pillar and outside the fortress.
    if (!placed) {
        const fallbackCoordinate = MAP_SIZE / 2 - 20;
        targetGroup.position.set(fallbackCoordinate, MAX_ENEMY_HEIGHT, fallbackCoordinate);
    }
    refreshChunkedRenderObject(targetGroup);

    const randClass = ENEMY_CLASSES[Math.floor(worldRandom() * ENEMY_CLASSES.length)];

    const data = targetData(targetGroup);
    data.maxHp = randClass.hp;
    data.hp = randClass.hp;
    data.scale = randClass.scale;
    data.color = randClass.color;
    (data.bodyMesh.material as THREE.MeshStandardMaterial).color.setHex(randClass.color);
    
    data.bodyMesh.scale.set(randClass.scale, randClass.scale, randClass.scale);
    data.healthBarGroup.position.y = 1.6 * randClass.scale;
    data.healthBarGroup.scale.set(randClass.scale, randClass.scale, 1);
    
    data.healthBarFg.scale.x = 1;
}

const sceneryBuilder = createSceneryBuilder({
    get seed() { return worldSeed; },
    get biomeField() { return worldBiomeField!; },
    get biomeMapTexture() { return worldBiomeMapTexture!; },
    random: worldRandom, addObject: addWorldObject,
    instances: (geometry, material, capacity, castShadow, receiveShadow, role) => createChunkedInstanceSet(geometry, material, capacity, castShadow, receiveShadow, role),
    instance: addChunkedInstance, renderObject: addChunkedRenderObject,
    floor: object => { grappleFloor = object; },
    pillar: object => { state.obstacles.push(object); obstacleHash.insert(object.position.x, object.position.z, PILLAR_WIDTH, object); },
    lava: object => {
        state.lavaPools.push(object);
        const radius = getLavaPoolDescriptor(object)?.boundRadius ?? LAVA_POOL_HALF_SIZE;
        lavaHash.insert(object.position.x, object.position.z, radius, object);
    },
    fakeLava: objects => { fakeLavaPools = objects; },
    fakePillars: objects => { state.fakePillars = objects; },
});
function createLavaPools(): void {
    lavaHash.clear();
    sceneryBuilder.createLavaPools();
    // Bake one ground mask from every recessed pit, including the decorative
    // pools beyond the arena border, so the floor shader can open their holes.
    lavaPitMaskTexture?.dispose();
    lavaPitMaskTexture = createLavaPitMaskTexture([...state.lavaPools, ...fakeLavaPools]);
    const floor = state.scene?.getObjectByName('grass-floor') as THREE.Mesh | undefined;
    const floorMaterial = floor?.material as THREE.Material | undefined;
    const maskUniform = floorMaterial?.userData.lavaPitMaskUniform as { value: THREE.Texture } | undefined;
    if (maskUniform) maskUniform.value = lavaPitMaskTexture;
    lavaGlowMaterial = createLavaGlowMaterial();
    const glowGeometry = new THREE.PlaneGeometry(LAVA_GLOW_SIZE, LAVA_GLOW_SIZE);
    glowGeometry.rotateX(-Math.PI / 2);
    // The baked map uses increasing world Z for increasing texture V.
    const uv = glowGeometry.getAttribute('uv');
    for (let i = 0; i < uv.count; i++) uv.setY(i, 1 - uv.getY(i));
    lavaGlowMesh = new THREE.Mesh(glowGeometry, lavaGlowMaterial);
    lavaGlowMesh.position.y = 0.015;
    lavaGlowMesh.name = 'lava-ground-glow';
    addWorldObject(lavaGlowMesh);
    createLavaLights();
}

function createEnemies(): void {
    const targetGeo = new THREE.BoxGeometry(2, 2, 2);

    const barBgGeo = new THREE.PlaneGeometry(1.8, 0.15);
    const barBgMat = new THREE.MeshBasicMaterial({ color: 0x333333, side: THREE.DoubleSide });
    
    const barFgGeo = new THREE.PlaneGeometry(1.8, 0.15).translate(0.9, 0, 0);
    const barFgMat = new THREE.MeshBasicMaterial({
        color: 0x00ffcc,
        side: THREE.DoubleSide,
        polygonOffset: true,
        polygonOffsetFactor: -1,
        polygonOffsetUnits: -1,
    });

    for (let i = 0; i < ENEMY_COUNT; i++) {
        const targetGroup = new THREE.Group();
        const data = targetData(targetGroup);
        data.index = i;
        data.eliminationRevision = 0;

        const bodyMesh = new THREE.Mesh(targetGeo, new THREE.MeshStandardMaterial({ roughness: 0.2 }));
        bodyMesh.castShadow = true;    
        bodyMesh.receiveShadow = true;
        targetGroup.add(bodyMesh);
        data.bodyMesh = bodyMesh;

        const healthBarGroup = new THREE.Group();
        healthBarGroup.position.y = 1.6;

        const barBg = new THREE.Mesh(barBgGeo, barBgMat);
        healthBarGroup.add(barBg);

        const barFg = new THREE.Mesh(barFgGeo, barFgMat);
        barFg.position.set(-0.9, 0, 0.01);
        healthBarGroup.add(barFg);

        targetGroup.add(healthBarGroup);
        data.healthBarFg = barFg;
        data.healthBarGroup = healthBarGroup;

        respawnTarget(targetGroup);
        addWorldObject(targetGroup);
        addChunkedRenderObject(targetGroup);
        state.targets.push(targetGroup);
    }
    rebuildTargetHash();
}

function createTown(): void {
    const buildings = generateTownLayout(worldSeed);
    const boxes = createTownBoxes(buildings);
    for (const building of buildings.filter(b => b.name === 'goth house')) {
        // Browser asset loading stays outside the synchronous procedural/test path.
        if (typeof window !== 'undefined') {
            gothGirlfriend = new GothGirlfriend(building, queryObstaclesAlongSegment);
            state.scene!.add(gothGirlfriend.group);
            // The actor owns its animated model and fill light. Only its
            // presentation follows chunks; its world-owned hitbox stays solid.
            addChunkedRenderObject(gothGirlfriend.group);
            addWorldObject(gothGirlfriend.hitbox);
            state.obstacles.push(gothGirlfriend.hitbox);
            const hitbox = obstacleData(gothGirlfriend.hitbox);
            obstacleHash.insert(
                gothGirlfriend.hitbox.position.x,
                gothGirlfriend.hitbox.position.z,
                Math.max(hitbox.halfW, hitbox.halfD),
                gothGirlfriend.hitbox,
            );
            void gothGirlfriend.load();
        }
        const decor = createGothHouseDecor(building);
        addWorldObject(decor);
        addChunkedRenderObject(decor);
    }
    const colors: Record<TownMaterial, number> = {
        stone: 0x727a80, trim: 0xc6bca5, roof: 0x995940, door: 0x654531,
        window: 0x273c46, road: 0xb9ac8e, plaza: 0x8e9076,
        plaster0: 0xd5bd93, plaster1: 0xb9c2b2, plaster2: 0xc6997c, water: 0x2a9ab5,
        gothStone: 0x36313f, gothTrim: 0x797180, gothRoof: 0x34243f,
    };
    // Worn stone, roof and wood surfaces keep some sheen so sunrise and sundown
    // grazing light catches ridges while mortar and grooves stay matte.
    const roughness: Record<TownMaterial, number> = {
        stone: 0.86, trim: 0.86, roof: 0.82, door: 0.82, window: 0.35,
        road: 0.86, plaza: 0.86, plaster0: 0.90, plaster1: 0.90, plaster2: 0.90,
        water: 0.2, gothStone: 0.86, gothTrim: 0.86, gothRoof: 0.82,
    };
    const profiles: Record<TownMaterial, SurfaceDetailProfile> = {
        stone: 'stone', trim: 'trim', roof: 'roof', door: 'door', window: 'window',
        road: 'road', plaza: 'plaza', plaster0: 'plaster', plaster1: 'plaster', plaster2: 'plaster',
        water: 'water', gothStone: 'gothStone', gothTrim: 'gothTrim', gothRoof: 'gothRoof',
    };
    const geometry = new THREE.BoxGeometry(1, 1, 1);
    const colliderMaterial = new THREE.MeshBasicMaterial();
    const dummy = new THREE.Object3D();
    for (const materialName of Object.keys(colors) as TownMaterial[]) {
        const parts = boxes.filter(box => box.material === materialName);
        const material = new THREE.MeshStandardMaterial({ color: colors[materialName], roughness: roughness[materialName] });
        installSurfaceDetailShader(material, profiles[materialName]);
        // Ground must remain present like the grass floor, even when distant
        // buildings are hidden. Culling these tiles would expose the grass hole.
        const ground = materialName === 'road' || materialName === 'plaza';
        const instances = ground ? null : createChunkedInstanceSet(geometry, material, parts.length, true, true);
        const groundMesh = ground ? addWorldObject(new THREE.InstancedMesh(geometry, material, parts.length)) : null;
        const container = instances?.group ?? groundMesh!;
        container.name = ground ? `town-ground-${materialName}` : `town-${materialName}`;
        if (groundMesh) groundMesh.receiveShadow = true;
        for (let index = 0; index < parts.length; index++) {
            const part = parts[index];
            dummy.position.set(part.x, part.y, part.z);
            dummy.rotation.set(part.rotationX ?? 0, 0, 0);
            dummy.scale.set(part.width, part.height, part.depth);
            dummy.updateMatrix();
            if (instances) addChunkedInstance(instances, part.x, part.z, dummy.matrix);
            else groundMesh!.setMatrixAt(index, dummy.matrix);
            if (!part.solid) continue;
            const collider = new THREE.Mesh(geometry, colliderMaterial);
            collider.name = `town-${part.kind}`;
            collider.position.copy(dummy.position);
            collider.scale.copy(dummy.scale);
            Object.assign(obstacleData(collider), {
                height: part.height, halfW: part.width / 2,
                halfD: part.depth / 2, halfH: part.height / 2,
            });
            collider.visible = false;
            addWorldObject(collider);
            state.obstacles.push(collider);
            obstacleHash.insert(part.x, part.z, Math.max(part.width, part.depth) / 2, collider);
            if (part.kind === 'well') {
                wellBounds.expandByPoint(traceMin.copy(collider.position).addScaledVector(collider.scale, -.5));
                wellBounds.expandByPoint(traceMax.copy(collider.position).addScaledVector(collider.scale, .5));
            }
        }
        if (groundMesh) groundMesh.instanceMatrix.needsUpdate = true;
    }
}

function finishStaticWorld(): void {
    sceneryBuilder.reset();
    // An identity scene matrix must not force every frozen child to update.
    state.scene!.updateMatrix();
    state.scene!.matrixAutoUpdate = false;
    state.scene!.updateMatrixWorld(true);
    for (const set of chunkedInstanceSets) {
        for (const [key, matrices] of set.matricesByChunk) {
            const count = matrices.length;
            if (count === 0) continue;
            const mesh = new THREE.InstancedMesh(set.geometry, set.material, count);
            mesh.name = set.group.name;
            mesh.count = count;
            mesh.castShadow = set.castShadow;
            mesh.receiveShadow = set.receiveShadow;
            mesh.frustumCulled = true;
            const matrixArray = mesh.instanceMatrix.array as Float32Array;
            for (let i = 0; i < count; i++) matrices[i].toArray(matrixArray, i * 16);
            mesh.instanceMatrix.needsUpdate = true;
            const colors = set.colorsByChunk?.get(key);
            if (colors) {
                mesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(colors), 3);
                mesh.instanceColor.needsUpdate = true;
            }
            mesh.computeBoundingSphere();
            mesh.visible = activeRenderChunks.has(key);
            set.group.add(mesh);
            set.chunkMeshes.set(key, mesh);
        }
        set.matricesByChunk.clear();
        set.colorsByChunk?.clear();
    }
    // Freeze only stationary world roots. Enemy hierarchies, billboard pillars,
    // lights, and the separately-owned animated character remain dynamic.
    const dynamic = new Set<THREE.Object3D>([...state.targets, ...state.fakePillars]);
    if (lavaLightGroup) dynamic.add(lavaLightGroup);
    for (const object of worldObjects) {
        if (dynamic.has(object) || object.name === 'town-lanterns') continue;
        object.updateWorldMatrix(true, true);
        object.traverse(child => {
            child.matrixAutoUpdate = false;
            child.matrixWorldAutoUpdate = false;
        });
    }
}

const WORLD_GENERATION_STAGES = [
    sceneryBuilder.createFloor, sceneryBuilder.createFakeBillboards,
    () => { obstacleHash.clear(); sceneryBuilder.createPillars(); }, createLavaPools,
    sceneryBuilder.createBushes, createTown, createTownLanterns, createEnemies, finishStaticWorld,
];

function createWorldBiomeLayer(): void {
    worldBiomeField = createBiomeField(worldSeed);
    worldBiomeMapTexture = createBiomeMapTexture(worldBiomeField);
}

/** Fresh-world builder. Public replacements use one of the disposing entry
 * points so old arrays, hashes and GPU resources cannot be silently retained. */
export function createEnvironment(preserveSeed = false): void {
    if (!state.scene) return;
    if (worldObjects.length || gothGirlfriend || forgottenMecha) throw new Error('World already exists; use rebuildEnvironmentWithSeed or createEnvironmentAsync.');
    if (!state.isMultiplayer && !preserveSeed) setWorldSeed(generateWorldSeed());
    resetWorldRandom();
    createWorldBiomeLayer();
    for (const stage of WORLD_GENERATION_STAGES) stage();
}

/** Same seeded stage order as createEnvironment(), with cancellation between stages. */
export async function createEnvironmentAsync(seed: number, checkpoint: () => Promise<void>): Promise<void> {
    setWorldSeed(seed);
    disposeWorld();
    resetWorldRandom();
    createWorldBiomeLayer();
    const generation = worldGeneration;
    try {
        for (const stage of WORLD_GENERATION_STAGES) {
            await checkpoint();
            if (generation !== worldGeneration) throw new DOMException('Loading cancelled', 'AbortError');
            stage();
        }
    } catch (error) {
        if (generation === worldGeneration) disposeWorld();
        throw error;
    }
}

export function disposeWorld(): void {
    worldGeneration++; sceneryBuilder.reset();
    infantry?.dispose();
    infantry = null;
    infantryHash.clear();
    wellBounds.makeEmpty();
    forgottenMecha?.dispose();
    forgottenMecha = null;
    gothGirlfriend?.dispose();
    gothGirlfriend = null;
    const disposedGeometries = new Set<THREE.BufferGeometry>();
    const disposedMaterials = new Set<THREE.Material>();
    const disposedTextures = new Set<THREE.Texture>();

    const disposeMaterial = (mat: THREE.Material) => {
        if (SHARED_WORLD_MATERIALS.has(mat) || disposedMaterials.has(mat)) return;
        disposedMaterials.add(mat);

        const texture = (mat as any).map as THREE.Texture | undefined;
        if (texture && !disposedTextures.has(texture)) {
            disposedTextures.add(texture);
            texture.dispose();
        }
        const extraTextures = (mat.userData as { extraTextures?: THREE.Texture[] }).extraTextures;
        if (extraTextures) {
            for (const extra of extraTextures) {
                if (disposedTextures.has(extra)) continue;
                disposedTextures.add(extra);
                extra.dispose();
            }
        }

        mat.dispose();
    };

    const disposeObject = (obj: THREE.Object3D) => {
        obj.removeFromParent();
        obj.traverse((child: any) => {
            if (child.isMesh || child.isSprite) {
                if (child.isInstancedMesh) {
                    child.dispose();
                }
                if (child.geometry && !SHARED_WORLD_GEOMETRIES.has(child.geometry) && !disposedGeometries.has(child.geometry)) {
                    disposedGeometries.add(child.geometry);
                    child.geometry.dispose();
                }
                if (Array.isArray(child.material)) {
                    child.material.forEach(disposeMaterial);
                } else {
                    const mat = child.material as THREE.Material | undefined;
                    if (mat) disposeMaterial(mat);
                }
            }
        });
    };

    worldObjects.forEach(disposeObject);
    worldObjects.length = 0;
    worldBiomeMapTexture?.dispose();
    worldBiomeMapTexture = null;
    worldBiomeField = null;
    // The baked mask lives only in the floor shader uniform, outside material
    // fields, so the world owns its disposal explicitly.
    lavaPitMaskTexture?.dispose();
    lavaPitMaskTexture = null;
    fakeLavaPools = [];
    resetLeafAnimation();
    state.targets = [];
    state.obstacles = [];
    grappleFloor = null;
    townLanternFlames = null;
    townLanternGlassMaterial = null;
    townLanternLights.length = 0;
    townLanterns.length = 0;
    lastLanternTime = lastLanternStrength = 0; lanternsDark = false;
    lastLanternObserver.set(0, 0, 0);
    lavaLightGroup = null;
    lavaGlowMesh = null;
    lavaGlowMaterial = null;
    lavaVisibleChunks.value.set(0, 0, -1);
    selectedLavaPool = null;
    litLavaPool = null;
    lavaLightFade = 0;
    lastLavaLightTime = 0;
    lavaLights.length = 0;
    visibleLavaPools.length = 0;
    lavaLightAnchor.set(Number.POSITIVE_INFINITY, 0, Number.POSITIVE_INFINITY);
    state.lavaPools = [];
    state.fakePillars = [];
    obstacleHash.clear();
    lavaHash.clear();
    targetHash.clear();
    renderChunks.clear();
    activeRenderChunks.clear();
    chunkedInstanceSets.length = 0;
    lastRenderChunkX = Number.NaN;
    lastRenderChunkZ = Number.NaN;
    lastRenderDistanceChunks = -1;
}

export function updateTargets(delta: number): void {
    targetUpdateFrame++;
    const updateDistantBillboards = (targetUpdateFrame % 2) === 0;
    const targetsLen = state.targets.length;
    for (let i = 0; i < targetsLen; i++) {
        const target = state.targets[i];
        if (!target.visible) continue;
        const data = targetData(target);
        if (data.infantry) continue;
        data.bodyMesh.rotation.x += 1.0 * delta;
        data.bodyMesh.rotation.y += 1.5 * delta;
        if (state.camera) {
            data.healthBarGroup.quaternion.copy(state.camera.quaternion);
        }
    }

    // Billboard pillars face the player horizontally, not the full camera pitch.
    if (updateDistantBillboards && state.fakePillars && state.controls) {
        const playerObj = state.controls.getObject();
        const px = playerObj.position.x;
        const pz = playerObj.position.z;
        const pillarsLen = state.fakePillars.length;
        for (let i = 0; i < pillarsLen; i++) {
            const pillar = state.fakePillars[i];
            pillar.lookAt(px, pillar.position.y, pz);
        }
    }
}
