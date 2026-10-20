import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import * as THREE from 'three';
import { state } from '../src/state.ts';
import { GothGirlfriend } from '../src/gothGirlfriend.ts';
import { rebuildEnvironmentWithSeed, updateEnvironmentVisibility, disposeWorld } from '../src/world.ts';
import { MechaEndingScenery } from '../src/mechaEndingScenery.ts';
import { SHARED_WORLD_GEOMETRIES, SHARED_WORLD_MATERIALS } from '../src/seededScenery.ts';
import { LAVA_POOL_HALF_SIZE } from '../src/config.ts';

const context = new Proxy({}, { get: () => () => {} });
Object.assign(globalThis, { window: {}, document: { getElementById: () => null, createElement: () => ({ getContext: () => context }) } });
GothGirlfriend.prototype.load = async () => {};
// Captured from the original complete generator before extracting its scenery.
// Include post-scenery enemies: their poses prove the RNG continuation stayed intact.
const baseline = new Map([
    [0, 'fa3963afbdba3d575bb10c6abb78db2065de42b11804e53f0fc86adc4aafc635'],
    [1, '9dfe13eaa951440f1c974987d5d1166629803ca5dfd2019572e8ba94b531d8fe'],
    [42, '3e8518ee9b41369696e5fc51bba21c3967391093754a64c9b11ee421874dd7f6'],
    [91234, 'c371e34db6f6448d82f7026cdc2bce1312b7e2adee61c55a437a5e7511dc688c'],
    [0xffffffff, 'ecdd31ed94b4d6435801053fc4888682743255a1c440ecd7e5a162be5ae22910'],
]);
function fingerprint(scene: THREE.Scene) {
    const shapes = scene.children.map((object: any) => ({ type: object.type, name: object.name, pos: object.position.toArray(), scale: object.scale.toArray(),
        matrices: object.isInstancedMesh ? Array.from(object.instanceMatrix.array).slice(0, object.count * 16) : undefined,
        mats: object.material ? (Array.isArray(object.material) ? object.material : [object.material]).map((material: any) => ({ type: material.type, color: material.color?.getHex(),
            map: material.map ? { repeat: material.map.repeat.toArray(), width: material.map.image?.width, height: material.map.image?.height } : null })) : undefined }));
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

test('shared extraction preserves all complete-world baseline hashes, including texture RNG and enemy placement', () => {
    state.isMultiplayer = true;
    try {
        for (const [seed, expected] of baseline) {
            state.scene = new THREE.Scene(); rebuildEnvironmentWithSeed(seed); updateEnvironmentVisibility(new THREE.Vector3(), 16);
            assert.equal(fingerprint(state.scene), expected, `world changed for seed ${seed}`); disposeWorld();
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
