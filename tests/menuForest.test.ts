import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';

const context = new Proxy({}, { get: () => () => {} });
Object.assign(globalThis, {
    window: {},
    document: { getElementById: () => null, createElement: () => ({ getContext: () => context }) },
});

const { createMenuForest } = await import('../src/menuForest.ts');

test('createMenuForest builds 3D multi-biome instanced forest behind the menu hero and disposes cleanly', () => {
    const forest = createMenuForest();
    try {
        assert.ok(forest.counts.trunks >= 32 && forest.counts.trunks <= 36);
        assert.ok(forest.counts.branches > forest.counts.trunks);
        assert.ok(forest.counts.foliage > 0);
        assert.ok(forest.counts.varieties.warm > 0);
        assert.ok(forest.counts.varieties.cool > 0);
        assert.ok(forest.counts.varieties.sand > 0);
        assert.equal(
            forest.counts.varieties.warm + forest.counts.varieties.cool + forest.counts.varieties.sand,
            forest.counts.trunks,
        );

        const instancedMeshes = forest.group.children.filter(
            (child): child is THREE.InstancedMesh => child instanceof THREE.InstancedMesh,
        );
        assert.equal(instancedMeshes.length, 3);

        const matrix = new THREE.Matrix4();
        const pos = new THREE.Vector3();
        for (const mesh of instancedMeshes) {
            assert.ok(mesh.count > 0);
            for (let i = 0; i < mesh.count; i++) {
                mesh.getMatrixAt(i, matrix);
                for (const element of matrix.elements) {
                    assert.ok(Number.isFinite(element), 'instance matrix element must be finite');
                }
            }
        }

        const trunkMesh = instancedMeshes[0];
        for (let i = 0; i < trunkMesh.count; i++) {
            trunkMesh.getMatrixAt(i, matrix);
            pos.setFromMatrixPosition(matrix);
            assert.ok(pos.z <= -15, `trunk z (${pos.z}) must stay behind z = 0`);
        }

        forest.update(1.5, false);
        forest.update(2.5, true);
    } finally {
        forest.dispose();
        assert.equal(forest.group.children.length, 0);
    }
});
