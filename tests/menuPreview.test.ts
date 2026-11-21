import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createPreviewProp } from '../src/cyborgAvatar.ts';
import { loadCyborgTestAssets } from './cyborgTestAsset.ts';

test('arsenal reload replays own their battery and leave other fitted copies closed', async () => {
    await loadCyborgTestAssets();
    const inspected = createPreviewProp('SNIPER'), other = createPreviewProp('SNIPER');
    try {
        const drawer = inspected.model.getObjectByName('Drawer')!, otherDrawer = other.model.getObjectByName('Drawer')!;
        const closed = drawer.position.clone();
        function light(model: THREE.Group): THREE.MeshStandardMaterial {
            let found: THREE.MeshStandardMaterial | undefined;
            model.traverse(o => {
                if (o instanceof THREE.SkinnedMesh && o.material.name.includes('energized glass')) found = o.material;
            });
            assert.ok(found);
            return found;
        }
        const inspectedLight=light(inspected.model), otherLight=light(other.model);
        inspected.sampleReload(.50,1);
        assert.ok(drawer.position.distanceTo(closed)>.05);
        assert.equal(otherDrawer.position.distanceTo(closed),0);
        assert.equal(inspectedLight.emissiveIntensity, otherLight.emissiveIntensity, 'the lit portion retains its weapon hue and brightness');
        const cell = inspected.model.getObjectByName('CellLight')!;
        assert.equal(Math.min(...cell.scale.toArray()), .25);
        inspected.sampleReload(.50,3);
        assert.equal(Math.min(...cell.scale.toArray()), .75, 'a paused close-up can show a different remaining charge');
        assert.equal(other.model.getObjectByName('CellLight')!.scale.y, 1);
        inspected.sampleReload(undefined,4);
        assert.equal(drawer.position.distanceTo(closed),0);
        assert.equal(inspectedLight.emissiveIntensity,otherLight.emissiveIntensity);
    } finally { inspected.dispose(); other.dispose(); }
});
