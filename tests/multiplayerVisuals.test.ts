import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { pulseDamageMaterials } from '../src/damagePulse.ts';

test('remote damage pulse restores shared bean materials after overlapping hits', async () => {
    const peerData = {};
    const materials = [
        new THREE.MeshStandardMaterial({ color: 0x8c7ae6 }),
        new THREE.MeshStandardMaterial({ color: 0xc0c0c0, emissive: 0x001100, emissiveIntensity: 0.2 }),
    ];
    const originals = materials.map((material) => ({
        color: material.color.getHex(),
        emissive: material.emissive.getHex(),
        emissiveIntensity: material.emissiveIntensity,
    }));

    pulseDamageMaterials(peerData, materials, 0xff3333, 10);
    pulseDamageMaterials(peerData, materials, 0xff3333, 10);

    materials.forEach((material, index) => {
        assert.equal(material.color.getHex(), originals[index].color);
        assert.equal(material.emissive.getHex(), 0xff3333);
        assert.ok(material.emissiveIntensity >= 1.35);
    });

    await new Promise((resolve) => setTimeout(resolve, 25));

    materials.forEach((material, index) => {
        assert.equal(material.color.getHex(), originals[index].color);
        assert.equal(material.emissive.getHex(), originals[index].emissive);
        assert.equal(material.emissiveIntensity, originals[index].emissiveIntensity);
    });
});
