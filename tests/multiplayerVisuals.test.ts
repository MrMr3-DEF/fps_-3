import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { attachPlayerAvatar } from '../src/playerAvatar.ts';
import { changePlayerSuitColor } from '../src/playerAppearance.ts';
import { characterColor } from '../src/appearance.ts';
import { loadCyborgTestAssets } from './cyborgTestAsset.ts';
import { state } from '../src/state.ts';
import { clearDamagePulse, pulseDamageMaterials } from '../src/damagePulse.ts';

test('remote damage pulse restores shared armor materials after overlapping hits', async () => {
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

test('a live color change tints only the edited pilot and survives their hit flash', async () => {
    await loadCyborgTestAssets();
    const previousColor = characterColor;
    const shell = new THREE.Group(), other = new THREE.Group();
    const local = attachPlayerAvatar(shell, 0x111111)!, remote = attachPlayerAvatar(other, 0x3311cb)!;
    state.playerMesh = shell;
    try {
        const accent = local.rig.damageMaterials.find(m => m.name === 'Suit_Primary')!;
        const armor = local.rig.damageMaterials.find(m => m.name === 'Armor_Graphite')!;
        const previousArmor = armor.color.getHex();
        pulseDamageMaterials(shell, local.rig.damageMaterials, 0xff3333, 250);
        changePlayerSuitColor('#f01135');
        assert.equal(accent.emissive.getHex(), 0xff3333);
        clearDamagePulse(shell);
        assert.equal(accent.emissive.getHex(), 0xf01135);
        assert.equal(armor.color.getHex(), previousArmor);
        assert.equal(remote.rig.damageMaterials.find(m => m.name === 'Suit_Primary')!.emissive.getHex(), 0x3311cb);
    } finally {
        clearDamagePulse(shell);
        state.playerMesh = null;
        changePlayerSuitColor(previousColor);
        local.dispose(); remote.dispose();
    }
});
