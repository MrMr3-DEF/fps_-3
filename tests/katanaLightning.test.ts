import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createKatanaLightning, updateKatanaLightning } from '../src/katanaLightning.ts';

function vertices(group: THREE.Group): number[] {
    const mesh = group.children[0] as THREE.Mesh;
    return Array.from(mesh.geometry.getAttribute('position').array.slice(0, mesh.geometry.drawRange.count * 3));
}
function dispose(group: THREE.Group): void {
    group.traverse(child => { if (child instanceof THREE.Mesh) { child.geometry.dispose(); child.material.dispose(); } });
}

test('lightning updates reuse buffers and isolate sword instances', () => {
    const first = createKatanaLightning(), second = createKatanaLightning();
    const buffer = (first.children[0] as THREE.Mesh).geometry.getAttribute('position').array;
    updateKatanaLightning(first, 3, 4, false);
    assert.ok(vertices(first).length > 0);
    updateKatanaLightning(first, 8, 4.1, false);
    assert.equal((first.children[0] as THREE.Mesh).geometry.getAttribute('position').array, buffer);
    assert.equal(second.visible, false);
    dispose(first); dispose(second);
});
test('gentle lightning is steady at a fixed charge and clears on cancellation', () => {
    const effect = createKatanaLightning();
    updateKatanaLightning(effect, 1.5, 1, true);
    const before = vertices(effect);
    updateKatanaLightning(effect, 1.5, 100, true);
    assert.deepEqual(vertices(effect), before);
    updateKatanaLightning(effect, 0, 101, true);
    assert.equal(effect.visible, false);
    assert.equal(vertices(effect).length, 0);
    dispose(effect);
});
