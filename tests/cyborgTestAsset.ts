import { readFile } from 'node:fs/promises';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { loadCyborgAssets } from '../src/cyborgAvatar.ts';

export function loadCyborgTestAssets() {
    const loader = new GLTFLoader();
    return loadCyborgAssets(async url => {
        const bytes = await readFile(new URL(url));
        return loader.parseAsync(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), '');
    });
}

/** Sample the deformed character in its gameplay anchor frame, excluding props and jets. */
export function armorBounds(shell: THREE.Group, visorOnly = false) {
    shell.updateWorldMatrix(true, false);
    shell.updateMatrixWorld(true);
    const inverse = new THREE.Matrix4().copy(shell.matrixWorld).invert();
    const box = new THREE.Box3(), vertex = new THREE.Vector3();
    shell.traverse(node => {
        if (!(node instanceof THREE.SkinnedMesh)) return;
        const material = node.material as THREE.MeshStandardMaterial;
        if (visorOnly ? material.name !== 'Visor_Smoked_Glass' : !/^(Armor_|Suit_|Pilot_Warm_Skin|Visor_|Sealed_Joints)/.test(material.name)) return;
        const transform = new THREE.Matrix4().multiplyMatrices(inverse, node.matrixWorld);
        for (let i = 0; i < node.geometry.attributes.position.count; i++) {
            box.expandByPoint(node.getVertexPosition(i, vertex).applyMatrix4(transform));
        }
    });
    if (box.isEmpty()) throw new Error('Missing cyborg armor');
    return box;
}
