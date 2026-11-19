import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import * as THREE from 'three';
import { state } from '../src/state.ts';
import { GothGirlfriend } from '../src/gothGirlfriend.ts';
import { rebuildEnvironmentWithSeed, updateEnvironmentVisibility, disposeWorld } from '../src/world.ts';
import { MechaEndingScenery } from '../src/mechaEndingScenery.ts';
import { SHARED_WORLD_GEOMETRIES, SHARED_WORLD_MATERIALS } from '../src/seededScenery.ts';
import { LAVA_POOL_HALF_SIZE, MAP_HALF_SIZE } from '../src/config.ts';

const context = new Proxy({}, { get: () => () => {} });
Object.assign(globalThis, { window: {}, document: { getElementById: () => null, createElement: () => ({ getContext: () => context }) } });
GothGirlfriend.prototype.load = async () => {};
// Full-world fingerprints cover seeded placement and the draw order of the scenery recipes.
// Positions are normalized to nine decimal places for ARM64/x64 portability.
// Include post-scenery enemies: their poses prove the RNG continuation stayed intact.
const baseline = new Map([
    [0, '261d0d07abadbc03345f40327b98e3b34eb6d35ff9f0a8d2a438c353f67cfc0c'],
    [1, 'd83567e8b997e80eec5b75582546b3227d6ff8ec16fc8a6c18dd2b7891c8498f'],
    [42, 'cd7a9943921ce494648d8c356ac297beb93fc83ca7475e5a89025fe86791b6c8'],
    [91234, 'b133cf522ff6387eda6b72cbf758d00cc89ca21d96e903e2c58c8e94c1cb62a9'],
    [0xffffffff, 'fc2d0930d60f8f54fa22224dfe08ce69fd0f19b9a5fe97692fcb5e6da2a83b6e'],
]);
// Material identity follows physical box faces, independently of draw grouping.
function faceMaterials(object: any): THREE.Material[] {
    const materials = Array.isArray(object.material) ? object.material : [object.material];
    if (!Array.isArray(object.material) || object.geometry?.type !== 'BoxGeometry') return materials;
    const result: THREE.Material[] = [], index = object.geometry.index, normal = object.geometry.attributes.normal;
    for (const group of object.geometry.groups) for (let i = group.start; i < group.start + group.count; i += 3) {
        const vertex = index.getX(i), x = normal.getX(vertex), y = normal.getY(vertex), z = normal.getZ(vertex);
        const face = x ? (x > 0 ? 0 : 1) : y ? (y > 0 ? 2 : 3) : z > 0 ? 4 : 5;
        result[face] = materials[group.materialIndex];
    }
    assert.equal(result.length, 6); assert.ok(result.every(Boolean));
    return result;
}
function fingerprint(scene: THREE.Scene, portablePositions = false) {
    const shapes = scene.children.map((object: any) => ({ type: object.type, name: object.name, pos: object.position.toArray(), scale: object.scale.toArray(),
        matrices: object.isInstancedMesh ? Array.from(object.instanceMatrix.array).slice(0, object.count * 16) : undefined,
        mats: object.material ? faceMaterials(object).map((material: any) => ({ type: material.type, color: material.color?.getHex(),
            map: material.map ? { repeat: material.map.repeat.toArray(), width: material.map.image?.width, height: material.map.image?.height } : null })) : undefined }));
    // Trigonometric positions differ by ~2e-13 across ARM64/x64 V8 builds.
    // Normalize only the golden baseline; mutation checks below stay bit-exact,
    // as do instance matrices, scales, materials and texture metadata.
    if (portablePositions) for (const shape of shapes) shape.pos = shape.pos.map((value: number) => Number(value.toFixed(9)));
    return createHash('sha256').update(JSON.stringify(shapes)).digest('hex');
}
function disposePresentation(scene: THREE.Scene) {
    const geometries = new Set<THREE.BufferGeometry>(), materials = new Set<THREE.Material>(), textures = new Set<THREE.Texture>();
    scene.traverse(node => {
        if (node instanceof THREE.Mesh) { geometries.add(node.geometry); if (node instanceof THREE.InstancedMesh) node.dispose(); }
        if (node instanceof THREE.Mesh || node instanceof THREE.Sprite) for (const material of Array.isArray(node.material) ? node.material : [node.material]) {
            materials.add(material); for (const value of Object.values(material)) if (value instanceof THREE.Texture) textures.add(value);
        }
    });
    geometries.forEach(g => g.dispose()); materials.forEach(m => m.dispose()); textures.forEach(t => t.dispose()); scene.clear();
}
const sorted = (rows: number[][]) => rows.map(row => JSON.stringify(row)).sort();
function plantMatrices(scene: THREE.Scene): string[] {
    return sorted(scene.getObjectsByProperty('isInstancedMesh', true).flatMap(node => {
        const mesh = node as THREE.InstancedMesh;
        if (mesh.name.startsWith('town-') || !['DodecahedronGeometry', 'CylinderGeometry'].includes(mesh.geometry.type)) return [];
        const color = (mesh.material as THREE.MeshLambertMaterial).color.getHex();
        return Array.from({ length: mesh.count }, (_, index) => [color, ...Array.from(mesh.instanceMatrix.array).slice(index * 16, index * 16 + 16)]);
    }));
}

test('seeded worlds preserve their fingerprints and keep decorative footprints outside the arena', () => {
    state.isMultiplayer = true;
    try {
        for (const [seed, expected] of baseline) {
            state.scene = new THREE.Scene(); rebuildEnvironmentWithSeed(seed); updateEnvironmentVisibility(new THREE.Vector3(), 16);
            assert.equal(fingerprint(state.scene, true), expected, `world changed for seed ${seed}`);
            for (const node of state.scene.children) {
                const radius = node instanceof THREE.Sprite ? node.scale.x / 2 :
                    node instanceof THREE.Mesh && node.material.color?.getHex() === 0xff3b00 ? LAVA_POOL_HALF_SIZE : null;
                if (radius !== null) assert.ok(Math.max(Math.abs(node.position.x), Math.abs(node.position.z)) >= MAP_HALF_SIZE + radius);
            }
            disposeWorld();
        }
    } finally { disposeWorld(); state.scene = null; state.isMultiplayer = false; }
});

test('isolated cinematic scenery matches seeded pillars, plants, lava and horizon without touching live world state', async () => {
    state.isMultiplayer = true;
    try {
        for (const seed of [0, 42, 0xffffffff]) {
            state.scene = new THREE.Scene(); rebuildEnvironmentWithSeed(seed); updateEnvironmentVisibility(new THREE.Vector3(), 16);
            const liveScene = state.scene, liveObstacles = state.obstacles, before = fingerprint(liveScene);
            const previewScene = new THREE.Scene();
            try {
                const scenery = await MechaEndingScenery.create(seed, previewScene, async () => {});
                assert.equal(state.scene, liveScene); assert.equal(state.obstacles, liveObstacles); assert.equal(fingerprint(liveScene), before);
                const pillars = liveObstacles.filter(o => !o.name.startsWith('town-'));
                assert.deepEqual(scenery.pillars.map(p => [...p.position.toArray(), ...p.size.toArray()]), pillars.map(p => [...p.position.toArray(), ...p.scale.toArray()]));
                assert.deepEqual(scenery.fakePillars.map(p => [...p.position.toArray(), ...p.scale.toArray()]), state.fakePillars.map(p => [...p.position.toArray(), ...p.scale.toArray()]));
                assert.deepEqual(plantMatrices(previewScene), plantMatrices(liveScene));
                const lava = scenery.group.children.filter(o => o instanceof THREE.Mesh && !o.visible && o.geometry instanceof THREE.BoxGeometry && o.geometry.parameters.width === LAVA_POOL_HALF_SIZE * 2);
                assert.equal(scenery.lavaCount, state.lavaPools.length);
                assert.deepEqual(sorted(lava.map(p => p.position.toArray())), sorted(state.lavaPools.map(p => p.position.toArray())));
                let sharedDisposals = 0;
                const count = () => sharedDisposals++;
                SHARED_WORLD_GEOMETRIES.forEach(g => g.addEventListener('dispose', count)); SHARED_WORLD_MATERIALS.forEach(m => m.addEventListener('dispose', count));
                disposePresentation(previewScene);
                SHARED_WORLD_GEOMETRIES.forEach(g => g.removeEventListener('dispose', count)); SHARED_WORLD_MATERIALS.forEach(m => m.removeEventListener('dispose', count));
                assert.equal(sharedDisposals, 0, 'cinematic disposal must preserve process-wide plant assets');
                assert.equal(fingerprint(liveScene), before);
            } finally { disposePresentation(previewScene); disposeWorld(); }
        }
    } finally { disposeWorld(); state.scene = null; state.isMultiplayer = false; }
});
