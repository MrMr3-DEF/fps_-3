import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import * as THREE from 'three';
import { state } from '../src/state.ts';
import { GothGirlfriend } from '../src/gothGirlfriend.ts';
import { rebuildEnvironmentWithSeed, updateEnvironmentVisibility, disposeWorld, getWorldBiomeField } from '../src/world.ts';
import { MechaEndingScenery } from '../src/mechaEndingScenery.ts';
import { SHARED_WORLD_GEOMETRIES, SHARED_WORLD_MATERIALS } from '../src/seededScenery.ts';
import { getLavaPoolDescriptor, getLavaShapeBoundRadius } from '../src/lavaPools.ts';
import { LAVA_POOL_COUNT, MAP_HALF_SIZE } from '../src/config.ts';

const context = new Proxy({}, { get: () => () => {} });
Object.assign(globalThis, { window: {}, document: { getElementById: () => null, createElement: () => ({ getContext: () => context }) } });
GothGirlfriend.prototype.load = async () => {};
// Full-world fingerprints cover seeded placement and the draw order of the scenery recipes.
// Positions are normalized to nine decimal places for ARM64/x64 portability.
// Include post-scenery enemies: their poses prove the RNG continuation stayed intact.
const baseline = new Map([
    [0, 'e8d22276159f438590ee185b7d0a7d66be6f4738500cf52d40428482ab5bd641'],
    [1, '4e4e5d68bde3c9147dc2d3b469a2da2cc79dc61e1057c33e9325b2796ac02d30'],
    [42, 'cbd7337bfb74d127acb4f807767f00824a9533502f619c4b166d7e3af2a711db'],
    [91234, 'b7b708cf2987eb1cdaaa387d76073d6288a077254c4c2dcc2aaf30eae1f6c7a3'],
    [0xffffffff, '8760391474b9f981172bb73739fe0ec867dfc6cb1d5935c09fb622ea2eba7c1d'],
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
    const addExtra = (owner: { userData?: Record<string, unknown> } | undefined) => {
        const extra = owner?.userData?.extraTextures;
        if (Array.isArray(extra)) for (const value of extra) if (value instanceof THREE.Texture) textures.add(value);
    };
    scene.traverse(node => {
        addExtra(node as unknown as { userData?: Record<string, unknown> });
        if (node instanceof THREE.Mesh) { geometries.add(node.geometry); if (node instanceof THREE.InstancedMesh) node.dispose(); }
        if (node instanceof THREE.Mesh || node instanceof THREE.Sprite) for (const material of Array.isArray(node.material) ? node.material : [node.material]) {
            materials.add(material); addExtra(material as unknown as { userData?: Record<string, unknown> });
            for (const value of Object.values(material)) if (value instanceof THREE.Texture) textures.add(value);
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
        const matrices = mesh.instanceMatrix.array;
        return Array.from({ length: mesh.count }, (_, index) => [color,
            ...Array.from(matrices.subarray(index * 16, index * 16 + 16))]);
    }));
}

test('seeded worlds preserve their fingerprints and keep decorative footprints outside the arena', () => {
    state.isMultiplayer = true;
    try {
        for (const [seed, expected] of baseline) {
            state.scene = new THREE.Scene(); rebuildEnvironmentWithSeed(seed); updateEnvironmentVisibility(new THREE.Vector3(), 16);
            assert.equal(fingerprint(state.scene, true), expected, `world changed for seed ${seed}`);
            for (const node of state.scene.children) {
                const radius = node instanceof THREE.Sprite ? node.scale.x / 2 : null;
                if (radius !== null) assert.ok(Math.max(Math.abs(node.position.x), Math.abs(node.position.z)) >= MAP_HALF_SIZE + radius);
            }
            // Decorative lava uses the same organic shapes but stays beyond the
            // arena border; every in-map pool sits cleanly inside a sand biome.
            const lavaMeshes = state.scene.children.filter(object =>
                (object as THREE.InstancedMesh).isInstancedMesh && object.name === 'world-lava') as THREE.InstancedMesh[];
            assert.equal(lavaMeshes.length, 16, 'four basin and four surface batches exist for map and horizon');
            const matrix = new THREE.Matrix4(), position = new THREE.Vector3();
            for (const mesh of lavaMeshes) for (let index = 0; index < mesh.count; index++) {
                mesh.getMatrixAt(index, matrix);
                position.setFromMatrixPosition(matrix);
                if (Math.max(Math.abs(position.x), Math.abs(position.z)) > MAP_HALF_SIZE) {
                    assert.ok(Math.max(Math.abs(position.x), Math.abs(position.z)) >= MAP_HALF_SIZE + 10,
                        'decorative lava clears the arena border');
                }
            }
            assert.ok(state.lavaPools.length > 0 && state.lavaPools.length <= LAVA_POOL_COUNT);
            const field = getWorldBiomeField()!;
            const lavaShapes = new Set<number>();
            for (const pool of state.lavaPools) {
                const descriptor = getLavaPoolDescriptor(pool);
                assert.ok(descriptor, 'every live lava pool carries an organic descriptor');
                assert.ok(field.sample(descriptor.x, descriptor.z).sand >= 0.6, 'lava centers sit in sand');
                assert.equal(descriptor.boundRadius, getLavaShapeBoundRadius(descriptor.shapeIndex, descriptor.scale));
                assert.ok(Math.abs(descriptor.x) <= MAP_HALF_SIZE - descriptor.boundRadius - 10);
                assert.ok(Math.abs(descriptor.z) <= MAP_HALF_SIZE - descriptor.boundRadius - 10);
                lavaShapes.add(descriptor.shapeIndex);
            }
            assert.deepEqual([...lavaShapes].sort(), [0, 1, 2, 3], 'all four organic shapes are used');
            // Tree canopy and branch instancing is presentation only: the arena's
            // wilderness colliders remain exactly the invisible pillar trunks.
            const pillarMesh = state.scene.getObjectByName('world-pillars') as THREE.InstancedMesh | undefined;
            const branchMesh = state.scene.getObjectByName('world-branches') as THREE.InstancedMesh | undefined;
            const canopyMesh = state.scene.getObjectByName('world-canopy') as THREE.InstancedMesh | undefined;
            assert.ok(pillarMesh && branchMesh && canopyMesh, 'seeded tree meshes exist');
            assert.ok(branchMesh.count > 0 && canopyMesh.count > 0, 'trees render branches and canopy');
            const leafWeight = canopyMesh.geometry.getAttribute('aLeafWeight') as THREE.BufferAttribute | undefined;
            assert.ok(leafWeight && leafWeight.count === canopyMesh.geometry.getAttribute('position').count,
                'sculpted canopy geometry exposes per-vertex branch-anchor leaf weights');
            let minWeight = Infinity, maxWeight = -Infinity;
            for (let i = 0; i < leafWeight.count; i++) {
                const w = leafWeight.getX(i);
                if (w < minWeight) minWeight = w;
                if (w > maxWeight) maxWeight = w;
            }
            assert.ok(minWeight <= 0.05 && maxWeight >= 0.95, 'canopy weights anchor roots at 0 and free outer tips at 1');
            const wildernessColliders = state.obstacles.filter(object => !object.name.startsWith('town-'));
            assert.equal(wildernessColliders.length, pillarMesh.count, 'only pillar trunks add wilderness colliders');
            assert.ok(wildernessColliders.every(object => object !== branchMesh && object !== canopyMesh));
            const floorMask = (state.scene.getObjectByName('grass-floor') as THREE.Mesh).material as THREE.Material;
            const mask = (floorMask.userData.lavaPitMaskUniform as { value: THREE.Texture }).value;
            let maskDisposals = 0;
            mask.addEventListener('dispose', () => maskDisposals++);
            disposeWorld();
            assert.equal(maskDisposals, 1, 'the baked pit mask is disposed with its world');
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
                assert.equal(scenery.lavaCount, state.lavaPools.length);
                assert.deepEqual(
                    scenery.lavaPools.map(pool => getLavaPoolDescriptor(pool)),
                    state.lavaPools.map(pool => getLavaPoolDescriptor(pool)),
                    'cinematic organic pits match the live seeded layout',
                );
                let sharedDisposals = 0;
                const count = () => sharedDisposals++;
                SHARED_WORLD_GEOMETRIES.forEach(g => g.addEventListener('dispose', count)); SHARED_WORLD_MATERIALS.forEach(m => m.addEventListener('dispose', count));
                const previewMask = ((previewScene.getObjectByName('grass-floor') as THREE.Mesh).material as THREE.Material)
                    .userData.lavaPitMaskUniform as { value: THREE.Texture };
                let maskDisposals = 0;
                previewMask.value.addEventListener('dispose', () => maskDisposals++);
                disposePresentation(previewScene);
                assert.equal(maskDisposals, 1, 'cinematic pit mask is disposed with its owned floor');
                SHARED_WORLD_GEOMETRIES.forEach(g => g.removeEventListener('dispose', count)); SHARED_WORLD_MATERIALS.forEach(m => m.removeEventListener('dispose', count));
                assert.equal(sharedDisposals, 0, 'cinematic disposal must preserve process-wide plant assets');
                assert.equal(fingerprint(liveScene), before);
            } finally { disposePresentation(previewScene); disposeWorld(); }
        }
    } finally { disposeWorld(); state.scene = null; state.isMultiplayer = false; }
});
