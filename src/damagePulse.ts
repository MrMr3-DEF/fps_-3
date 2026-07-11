import * as THREE from 'three';

interface DamagePulse {
    timeout: ReturnType<typeof setTimeout> | null;
    materials: Array<{
        material: THREE.MeshStandardMaterial;
        emissive: number;
        emissiveIntensity: number;
    }>;
}

const activeDamagePulses = new WeakMap<object, DamagePulse>();

export function clearDamagePulse(target: object): void {
    const pulse = activeDamagePulses.get(target);
    if (!pulse) return;
    if (pulse.timeout !== null) clearTimeout(pulse.timeout);
    for (const original of pulse.materials) {
        original.material.emissive.setHex(original.emissive);
        original.material.emissiveIntensity = original.emissiveIntensity;
    }
    activeDamagePulses.delete(target);
}

/** Briefly add red emissive light without changing any avatar base colors. */
export function pulseDamageMaterials(
    target: object,
    materials: readonly THREE.MeshStandardMaterial[],
    color: number,
    durationMs: number,
): void {
    if (materials.length === 0) return;

    let pulse = activeDamagePulses.get(target);
    if (!pulse) {
        pulse = {
            timeout: null,
            materials: materials.map((material) => ({
                material,
                emissive: material.emissive.getHex(),
                emissiveIntensity: material.emissiveIntensity,
            })),
        };
        activeDamagePulses.set(target, pulse);
    } else if (pulse.timeout !== null) {
        clearTimeout(pulse.timeout);
    }

    for (const original of pulse.materials) {
        original.material.emissive.setHex(color);
        original.material.emissiveIntensity = Math.max(original.emissiveIntensity, 1.35);
    }

    pulse.timeout = setTimeout(
        () => clearDamagePulse(target),
        Math.max(1, Math.min(durationMs, 1_000)),
    );
}
