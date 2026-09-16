import * as THREE from 'three';
import { userSettings } from './settings.js';

const STANDARD_FLASH_DURATION = 0.09;
const GRAPPLE_FLASH_DURATION = 0.16;
const FLASH_KEY = 'muzzleFlashEffect';

export type MuzzleFlashSize = 'small' | 'medium' | 'large';
export type MuzzlePoint = readonly [x: number, y: number, z: number];
export const MUZZLE_SHOCKWAVE_RADII: Record<MuzzleFlashSize, number> = {
    small: 0.16,
    medium: 0.22,
    large: 0.28,
};

interface MuzzleFlashEffect {
    frames: THREE.Mesh<THREE.RingGeometry, THREE.MeshBasicMaterial>[];
    activeFrame: number;
    elapsed: number;
    duration: number;
    maxRadius: number;
}

function createMaterial(color: number): THREE.MeshBasicMaterial {
    return new THREE.MeshBasicMaterial({
        color,
        transparent: true,
        opacity: 0,
        side: THREE.DoubleSide,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        toneMapped: false,
        polygonOffset: true,
        polygonOffsetFactor: -1,
        polygonOffsetUnits: -1,
    });
}

function createFrame(color: number, muzzlePoint: MuzzlePoint, innerRadius: number, segments: number): THREE.Mesh<THREE.RingGeometry, THREE.MeshBasicMaterial> {
    const frame = new THREE.Mesh(
        new THREE.RingGeometry(innerRadius, 1, segments),
        createMaterial(color),
    );
    frame.name = 'muzzle-shockwave';
    frame.position.set(...muzzlePoint);
    frame.visible = false;
    frame.frustumCulled = false;
    frame.renderOrder = 30;
    return frame;
}

/** Attach two flat ring variants; successive shots alternate between them. */
export function attachMuzzleShockwave(
    weapon: THREE.Object3D,
    muzzlePoint: MuzzlePoint,
    color: number,
    size: MuzzleFlashSize,
    options: { duration?: number } = {},
): void {
    const frameA = createFrame(color, muzzlePoint, 0.55, 32);
    const frameB = createFrame(color, muzzlePoint, 0.68, 20);
    frameB.rotation.z = Math.PI / 20;
    weapon.add(frameA, frameB);
    weapon.userData[FLASH_KEY] = {
        frames: [frameA, frameB],
        activeFrame: 1,
        elapsed: options.duration ?? STANDARD_FLASH_DURATION,
        duration: options.duration ?? STANDARD_FLASH_DURATION,
        maxRadius: MUZZLE_SHOCKWAVE_RADII[size],
    } satisfies MuzzleFlashEffect;
}

export function attachGrappleMuzzleShockwave(weapon: THREE.Object3D, muzzlePoint: MuzzlePoint, color: number): void {
    attachMuzzleShockwave(weapon, muzzlePoint, color, 'large', {
        duration: GRAPPLE_FLASH_DURATION,
    });
}

export function triggerMuzzleFlash(weapon: THREE.Object3D | null): void {
    const effect = weapon?.userData[FLASH_KEY] as MuzzleFlashEffect | undefined;
    if (!effect || !userSettings.muzzleFlashes) return;

    effect.frames.forEach(frame => { frame.visible = false; });
    effect.activeFrame = (effect.activeFrame + 1) % effect.frames.length;
    effect.elapsed = 0;
    const frame = effect.frames[effect.activeFrame];
    frame.scale.setScalar(effect.maxRadius * 0.25);
    frame.material.opacity = userSettings.muzzleFlashOpacity;
    frame.visible = true;
}

export function updateMuzzleFlash(weapon: THREE.Object3D | null, delta: number): void {
    const effect = weapon?.userData[FLASH_KEY] as MuzzleFlashEffect | undefined;
    if (!effect) return;

    const frame = effect.frames[effect.activeFrame];
    if (!userSettings.muzzleFlashes) {
        frame.visible = false;
        effect.elapsed = effect.duration;
        return;
    }
    if (effect.elapsed >= effect.duration) return;

    effect.elapsed = Math.min(effect.duration, effect.elapsed + Math.max(0, delta));
    const progress = effect.elapsed / effect.duration;
    if (progress >= 1) {
        frame.visible = false;
        return;
    }

    frame.scale.setScalar(effect.maxRadius * (0.25 + progress * 0.75));
    frame.material.opacity = (1 - progress) * userSettings.muzzleFlashOpacity;
}
