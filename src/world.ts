import { createSceneryBuilder, SHARED_WORLD_GEOMETRIES, SHARED_WORLD_MATERIALS } from './seededScenery.js';
import { cancelHookForTarget } from './hookLifecycle.js';
import * as THREE from 'three';
import { state } from './state.js';
import { ForgottenMecha, type MechaEvents } from './forgottenMecha.js';
import {
    MAP_SIZE,
    PILLAR_WIDTH,
    MAX_ENEMY_HEIGHT,
    ENEMY_COUNT,
    ENEMY_CLASSES,
    LAVA_POOL_HALF_SIZE,
    TARGET_HIT_RANGE_MULTIPLIER,
    RENDER_CHUNK_SIZE,
    MAX_RENDER_DISTANCE_CHUNKS
} from './config.js';
import { SpatialHash } from './spatialHash.js';
import { createLavaGlowTexture, getLavaDarknessStrength, LAVA_GLOW_SIZE } from './lavaGlow.js';
import { obstacleData, targetData } from './userDataTypes.js';
import { GothGirlfriend } from './gothGirlfriend.js';
import { createGothHouseDecor } from './gothHouse.js';
import { createTownBoxes, generateTownLayout, overlapsTown, type TownMaterial } from './town.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

const obstacleHash = new SpatialHash<THREE.Object3D>(32);
const lavaHash = new SpatialHash<THREE.Object3D>(32);
const targetHash = new SpatialHash<THREE.Group>(48);
export let gothGirlfriend: GothGirlfriend | null = null;
export let forgottenMecha: ForgottenMecha | null = null;
/** Changes only at a real world replacement/disposal boundary. */
export let worldGeneration = 0;

/** Asset preparation is awaited by match startup; cancellation disposes even
 * a model that finishes downloading after its match has already been replaced. */
export async function prepareForgottenMecha(events: MechaEvents, checkpoint: () => Promise<void>): Promise<void> {
    if (!state.scene) return;
    const scene = state.scene;
    const actor = new ForgottenMecha([...state.obstacles], [...state.lavaPools], worldSeed, events, queryObstaclesAlongSegment);
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

interface TownLanternLight {
    light: THREE.PointLight;
    x: number;
    z: number;
    phase: number;
    chunk: string;
}

const townLanternLights: TownLanternLight[] = [];
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
    mesh: THREE.InstancedMesh;
    matricesByChunk: Map<string, THREE.Matrix4[]>;
    packedByChunk: Map<string, Float32Array>;
}

// Static props keep one draw call per material while their instance buffers are
// refreshed only when the player crosses a render-chunk boundary.
const chunkedInstanceSets: ChunkedInstanceSet[] = [];
let targetUpdateFrame = 0;
let lastRenderChunkX = Number.NaN;
let lastRenderChunkZ = Number.NaN;
let lastRenderDistanceChunks = -1;

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
    const frameSet = createChunkedInstanceSet(frameGeometry, frameMaterial, TOWN_LANTERN_POSITIONS.length, false, false, group);
    const frames = frameSet.mesh;
    frames.name = 'town-lantern-frames';
    const glassSet = createChunkedInstanceSet(glassGeometry, townLanternGlassMaterial, TOWN_LANTERN_POSITIONS.length, false, false, group);
    const glass = glassSet.mesh;
    glass.name = 'town-lantern-glass';
    townLanternFlames = new THREE.InstancedMesh(flameGeometry, flameMaterial, TOWN_LANTERN_POSITIONS.length);
    townLanternFlames.name = 'town-lantern-flames';
    townLanternFlames.instanceMatrix.setUsage(THREE.DynamicDrawUsage);

    const colliderGeometry = new THREE.BoxGeometry(0.7, 5.7, 0.7);
    const colliderMaterial = new THREE.MeshBasicMaterial();
    townLanternLights.length = 0;
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

        const light = new THREE.PointLight(0xffa34d, 0, 30, 2);
        light.position.set(x, 4.7, z);
        light.visible = false;
        group.add(light);
        townLanternLights.push({ light, x, z, phase: index * 1.731, chunk: getRenderChunkKey(x, z) });

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
    frames.instanceMatrix.needsUpdate = true;
    glass.instanceMatrix.needsUpdate = true;
    townLanternFlames.instanceMatrix.needsUpdate = true;
    frames.frustumCulled = glass.frustumCulled = townLanternFlames.frustumCulled = false;
    group.add(frames, glass, townLanternFlames);
    addWorldObject(group);
}

export function getGasLanternFlicker(timeSeconds: number, phase: number): number {
    return 0.91
        + Math.sin(timeSeconds * 11.3 + phase) * 0.055
        + Math.sin(timeSeconds * 23.7 + phase * 1.7) * 0.025
        + Math.sin(timeSeconds * 4.1 + phase * 0.6) * 0.02;
}

let lastLanternTime = 0, lastLanternStrength = 0;
export function updateTownLanterns(timeSeconds: number, strength: number, preparing = false): void {
    lastLanternTime = timeSeconds; lastLanternStrength = strength;
    if (!townLanternFlames || !townLanternGlassMaterial) return;
    const clampedStrength = Math.max(0, Math.min(1, strength));
    townLanternGlassMaterial.emissiveIntensity = 0.05 + clampedStrength * 1.25;

    townLanternLights.forEach(({ light, x, z, phase, chunk }, index) => {
        const flicker = getGasLanternFlicker(timeSeconds, phase);
        light.intensity = 42 * clampedStrength * flicker;
        const visible = preparing || activeRenderChunks.has(chunk);
        light.visible = visible && clampedStrength > 0.015;

        const flameScale = visible ? clampedStrength * flicker : 0;
        lanternMatrixDummy.position.set(x, 4.67, z);
        lanternMatrixDummy.scale.set(flameScale, flameScale * 1.08, flameScale);
        lanternMatrixDummy.updateMatrix();
        townLanternFlames!.setMatrixAt(index, lanternMatrixDummy.matrix);
    });
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
    material.onBeforeCompile = (shader) => {
        shader.uniforms.lavaVisibleChunks = lavaVisibleChunks;
        shader.fragmentShader = 'uniform vec3 lavaVisibleChunks;\n' + shader.fragmentShader;
        shader.fragmentShader = shader.fragmentShader.replace('#include <map_fragment>', `
            vec4 spillData = texture2D(map, vMapUv);
            vec2 sourceUv = (floor(vMapUv * ${material.map!.image.width.toFixed(1)}) + 0.5) / ${material.map!.image.width.toFixed(1)};
            vec2 sourceChunk = floor(texture2D(map, sourceUv).gb * 255.0 + 0.5) - 128.0;
            vec2 chunkDistance = abs(sourceChunk - lavaVisibleChunks.xy);
            if (spillData.r < 0.002 || max(chunkDistance.x, chunkDistance.y) > lavaVisibleChunks.z) discard;
            diffuseColor.a *= spillData.r;
        `);
        // Additive light fades to zero in fog, rather than adding the sky color.
        shader.fragmentShader = shader.fragmentShader.replace('#include <fog_fragment>', THREE.ShaderChunk.fog_fragment.replace(
            'gl_FragColor.rgb = mix( gl_FragColor.rgb, fogColor, fogFactor );',
            'gl_FragColor.rgb *= 1.0 - fogFactor;',
        ));
    };
    material.customProgramCacheKey = () => 'lava-ground-spill-v2';
    return material;
}

function getRenderChunkKey(x: number, z: number): string {
    return `${Math.floor(x / RENDER_CHUNK_SIZE)},${Math.floor(z / RENDER_CHUNK_SIZE)}`;
}

function createChunkedInstanceSet(
    geometry: THREE.BufferGeometry,
    material: THREE.Material | THREE.Material[],
    capacity: number,
    castShadow = false,
    receiveShadow = false,
    parent?: THREE.Group
): ChunkedInstanceSet {
    const mesh = new THREE.InstancedMesh(geometry, material, capacity);
    mesh.count = 0;
    mesh.castShadow = castShadow;
    mesh.receiveShadow = receiveShadow;
    // The active instances move between chunks while the mesh itself stays at
    // the origin, so its static bounding sphere cannot safely cull it.
    mesh.frustumCulled = false;
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    if (parent) parent.add(mesh); else addWorldObject(mesh);

    const instanceSet: ChunkedInstanceSet = {
        mesh,
        matricesByChunk: new Map<string, THREE.Matrix4[]>(),
        packedByChunk: new Map<string, Float32Array>()
    };
    chunkedInstanceSets.push(instanceSet);
    return instanceSet;
}

function addChunkedInstance(instanceSet: ChunkedInstanceSet, x: number, z: number, matrix: THREE.Matrix4): void {
    const key = getRenderChunkKey(x, z);
    const matrices = instanceSet.matricesByChunk.get(key);
    if (matrices) {
        matrices.push(matrix.clone());
    } else {
        instanceSet.matricesByChunk.set(key, [matrix.clone()]);
    }
}

function refreshChunkedInstances(): void {
    for (let setIndex = 0; setIndex < chunkedInstanceSets.length; setIndex++) {
        const instanceSet = chunkedInstanceSets[setIndex];
        let instanceIndex = 0;

        activeRenderChunks.forEach((key) => {
            const packed = instanceSet.packedByChunk.get(key);
            if (!packed) return;
            (instanceSet.mesh.instanceMatrix.array as Float32Array).set(packed, instanceIndex * 16);
            instanceIndex += packed.length / 16;
        });

        instanceSet.mesh.count = instanceIndex;
        instanceSet.mesh.instanceMatrix.clearUpdateRanges();
        if (instanceIndex > 0) {
            instanceSet.mesh.instanceMatrix.addUpdateRange(0, instanceIndex * 16);
            instanceSet.mesh.instanceMatrix.needsUpdate = true;
        }
    }
}

/** Force full-capacity buffers through WebGL before chunk culling resumes. */
export function prepareWorldInstanceBuffers(): void {
    for (const set of chunkedInstanceSets) {
        let offset = 0;
        for (const packed of set.packedByChunk.values()) {
            (set.mesh.instanceMatrix.array as Float32Array).set(packed, offset);
            offset += packed.length;
        }
        set.mesh.count = offset / 16;
        set.mesh.instanceMatrix.clearUpdateRanges();
        set.mesh.instanceMatrix.needsUpdate = true;
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
    if (!objects) return;
    for (let i = 0; i < objects.length; i++) {
        objects[i].visible = visible;
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
    refreshChunkedInstances();
    // Repack dynamic flames and lights on the same chunk transition, including
    // zero-delta settings changes and prepared-world reveals.
    updateTownLanterns(lastLanternTime, lastLanternStrength);
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

export function queryTargetsNear(x: number, z: number, radius: number, out?: THREE.Group[]): THREE.Group[] {
    return targetHash.query(x, z, radius, out);
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
    return targetHash.querySegment(startX, startZ, endX, endZ, out, padding);
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
    random: worldRandom, addObject: addWorldObject,
    instances: (geometry, material, capacity, castShadow, receiveShadow) => createChunkedInstanceSet(geometry, material, capacity, castShadow, receiveShadow),
    instance: addChunkedInstance, renderObject: addChunkedRenderObject,
    floor: object => { grappleFloor = object; },
    pillar: object => { state.obstacles.push(object); obstacleHash.insert(object.position.x, object.position.z, PILLAR_WIDTH, object); },
    lava: object => { state.lavaPools.push(object); lavaHash.insert(object.position.x, object.position.z, LAVA_POOL_HALF_SIZE, object); },
    fakePillars: objects => { state.fakePillars = objects; },
});
function createLavaPools(): void {
    lavaHash.clear();
    sceneryBuilder.createLavaPools();
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
    const targetMat = new THREE.MeshStandardMaterial({ roughness: 0.2 });

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

        const bodyMesh = new THREE.Mesh(targetGeo, targetMat.clone());
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
            gothGirlfriend = new GothGirlfriend(building);
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
    const geometry = new THREE.BoxGeometry(1, 1, 1);
    const colliderMaterial = new THREE.MeshBasicMaterial();
    const dummy = new THREE.Object3D();
    for (const materialName of Object.keys(colors) as TownMaterial[]) {
        const parts = boxes.filter(box => box.material === materialName);
        const material = new THREE.MeshStandardMaterial({ color: colors[materialName], roughness: materialName === 'water' ? 0.2 : 0.95 });
        // Ground must remain present like the grass floor, even when distant
        // buildings are hidden. Culling these tiles would expose the grass hole.
        const ground = materialName === 'road' || materialName === 'plaza';
        const instances = ground ? null : createChunkedInstanceSet(geometry, material, parts.length, true, true);
        const mesh = instances?.mesh ?? addWorldObject(new THREE.InstancedMesh(geometry, material, parts.length));
        mesh.name = ground ? `town-ground-${materialName}` : `town-${materialName}`;
        mesh.receiveShadow = true;
        for (let index = 0; index < parts.length; index++) {
            const part = parts[index];
            dummy.position.set(part.x, part.y, part.z);
            dummy.rotation.set(part.rotationX ?? 0, 0, 0);
            dummy.scale.set(part.width, part.height, part.depth);
            dummy.updateMatrix();
            if (instances) addChunkedInstance(instances, part.x, part.z, dummy.matrix);
            else mesh.setMatrixAt(index, dummy.matrix);
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
        }
        if (ground) mesh.instanceMatrix.needsUpdate = true;
    }
}

function finishStaticWorld(): void {
    // An identity scene matrix must not force every frozen child to update.
    state.scene!.updateMatrix();
    state.scene!.matrixAutoUpdate = false;
    state.scene!.updateMatrixWorld(true);
    for (const set of chunkedInstanceSets) {
        for (const [key, matrices] of set.matricesByChunk) {
            const packed = new Float32Array(matrices.length * 16);
            matrices.forEach((matrix, index) => matrix.toArray(packed, index * 16));
            set.packedByChunk.set(key, packed);
        }
        set.matricesByChunk.clear();
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

/** Fresh-world builder. Public replacements use one of the disposing entry
 * points so old arrays, hashes and GPU resources cannot be silently retained. */
export function createEnvironment(preserveSeed = false): void {
    if (!state.scene) return;
    if (worldObjects.length || gothGirlfriend || forgottenMecha) throw new Error('World already exists; use rebuildEnvironmentWithSeed or createEnvironmentAsync.');
    if (!state.isMultiplayer && !preserveSeed) setWorldSeed(generateWorldSeed());
    resetWorldRandom();
    for (const stage of WORLD_GENERATION_STAGES) stage();
}

/** Same seeded stage order as createEnvironment(), with cancellation between stages. */
export async function createEnvironmentAsync(seed: number, checkpoint: () => Promise<void>): Promise<void> {
    setWorldSeed(seed);
    disposeWorld();
    resetWorldRandom();
    for (const stage of WORLD_GENERATION_STAGES) {
        await checkpoint();
        stage();
    }
}

export function disposeWorld(): void {
    worldGeneration++; sceneryBuilder.reset();
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
    state.targets = [];
    state.obstacles = [];
    grappleFloor = null;
    townLanternFlames = null;
    townLanternGlassMaterial = null;
    townLanternLights.length = 0;
    lastLanternTime = lastLanternStrength = 0;
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
