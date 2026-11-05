import * as THREE from 'three';
import { katanaEmission } from './katanaFlicker.js';
import { KATANA } from './config.js';
import { createKatanaLightning, updateKatanaLightning } from './katanaLightning.js';
import katanaAsset from '../blender_assets/katana/katana.mesh.json' with { type: 'json' };
export function buildKatana(): THREE.Group {
    const root = new THREE.Group(), sword = new THREE.Group();
    root.add(sword);
    root.userData.sword = sword;
    // Each owner disposes its own meshes and changes its own charge material.
    // The exported arrays are immutable source data, never shared GPU resources.
    for (const part of katanaAsset.parts) {
        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute('position', new THREE.Float32BufferAttribute(part.positions, 3));
        geometry.setAttribute('normal', new THREE.Float32BufferAttribute(part.normals, 3));
        const material = new THREE.MeshStandardMaterial({
            color: part.color, metalness: part.metalness, roughness: part.roughness,
        });
        const mesh = new THREE.Mesh(geometry, material);
        mesh.name = part.name;
        sword.add(mesh);
        if (part.name === 'blade') root.userData.blade = mesh;
    }
    const lightning = createKatanaLightning();
    sword.add(lightning);
    root.userData.lightning = lightning;
    updateKatanaModel(root, 0, null, false, 0, false);
    return root;
}
// Poses are authored in the weapon container's frame, not the edge-turned blade's
// Euler axes. The asset origin is the grip center, so rotations keep the hand planted.
const restPosition = new THREE.Vector3(.22, -.30, -.18);
const restRotation = new THREE.Quaternion().setFromEuler(new THREE.Euler(-.85, -Math.PI / 2, -.15));
const cutAxis = new THREE.Vector3(0, 1, 0);
const impactRotation = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(0, 0, -1));
const raisedRotation = new THREE.Quaternion().setFromAxisAngle(cutAxis, -1.25).multiply(impactRotation);
const followRotation = new THREE.Quaternion().setFromAxisAngle(cutAxis, 1.25).multiply(impactRotation);
const raisedPosition = new THREE.Vector3(.18, -.12, -.1);
const followPosition = new THREE.Vector3(-.82, -.12, -.38);
const ease = (t: number) => { const x = THREE.MathUtils.clamp(t, 0, 1); return x * x * x * (x * (x * 6 - 15) + 10); };

/** Absolute-time sampling keeps poses identical at 30/60/144 Hz and supports scrubbing. */
export function sampleKatanaPose(sword: THREE.Object3D, swing: number | null, charged = false): void {
    const slash = charged ? KATANA.chargedSlash : KATANA.slash;
    const endCut = KATANA.windup + slash;
    const returnStart = endCut + (charged ? KATANA.chargedHold : 0);
    sword.scale.setScalar(1.368);
    if (swing === null || swing <= 0 || swing >= KATANA.duration) {
        sword.position.copy(restPosition);
        sword.quaternion.copy(restRotation);
    } else if (swing < KATANA.windup) {
        const t = ease(swing / KATANA.windup);
        sword.position.lerpVectors(restPosition, raisedPosition, t);
        sword.quaternion.slerpQuaternions(restRotation, raisedRotation, t);
    } else if (swing <= endCut) {
        // The level arc crosses forward at the corresponding visual impact time.
        const t = ease((swing - KATANA.windup) / slash);
        sword.position.lerpVectors(raisedPosition, followPosition, t);
        sword.quaternion.slerpQuaternions(raisedRotation, followRotation, t);
    } else if (swing < returnStart) {
        sword.position.copy(followPosition);
        sword.quaternion.copy(followRotation);
    } else {
        const t = ease((swing - returnStart) / (KATANA.duration - returnStart));
        sword.position.lerpVectors(followPosition, restPosition, t);
        sword.quaternion.slerpQuaternions(followRotation, restRotation, t);
    }
}

export function updateKatanaModel(root: THREE.Object3D, charge: number, swing: number | null, charged: boolean, time: number, gentle: boolean, fullChargeAge = Math.max(0, charge - KATANA.charge) + (swing ?? 0)): void {
    const sword = root.userData.sword as THREE.Group;
    if (!sword) return;
    sampleKatanaPose(sword, swing, charged);
    const activeSwing = swing !== null && swing >= 0 && swing < KATANA.duration;
    const retainedCharge = activeSwing && charged;
    const returnStart = KATANA.windup + KATANA.chargedSlash + KATANA.chargedHold;
    const fade = retainedCharge ? 1 - ease((swing! - returnStart) / (KATANA.duration - returnStart)) : 1;
    const effectCharge = retainedCharge ? KATANA.charge : charge;
    const lightning = root.userData.lightning as THREE.Group;
    updateKatanaLightning(lightning, effectCharge, time, gentle);
    // Fade the whole charged area together; do not retract the charge front on release.
    for (const child of lightning.children) (child as THREE.Mesh<THREE.BufferGeometry, THREE.MeshBasicMaterial>).material.opacity *= fade;
    const progress = THREE.MathUtils.clamp(effectCharge / KATANA.charge, 0, 1);
    const material = (root.userData.blade as THREE.Mesh).material as THREE.MeshStandardMaterial;
    material.emissive.setHex(0xffffff);
    // Black metal contributes no reflected light while charged, keeping brightness below clipping.
    material.color.setHex(progress >= 1 ? 0 : 0x080a0e);
    material.metalness = progress >= 1 ? 1 : 0;
    material.emissiveIntensity = progress >= 1 ? katanaEmission(fullChargeAge, gentle) * fade : 0;
}
