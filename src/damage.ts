import type { Vec3Like } from './gameplayMath.js';
export interface MechaWeaponHit { origin: Vec3Like; point: Vec3Like; surface: 'body' | 'shield' }
type TargetHitHandler = (targetIndex: number, damage: number, attackerPeerId?: string) => void;
type PlayerDamageHandler = (damage: number, attackerName: string, attackerPeerId?: string) => void;

let targetHitHandler: TargetHitHandler | null = null;
let playerDamageHandler: PlayerDamageHandler | null = null;
let mechaHitHandler: ((damage: number, hit?: MechaWeaponHit) => void) | null = null;

export function processMechaHit(damage: number, hit?: MechaWeaponHit): void {
    if (!mechaHitHandler) throw new Error('Mecha damage handler has not been initialized.');
    mechaHitHandler(damage, hit);
}

/**
 * Explicit gameplay event boundary for modules that cannot import main.ts
 * without creating a runtime cycle. Calling before initialization is a real
 * lifecycle error, not a silently discarded hit.
 */
export function processTargetHit(targetIndex: number, damage: number, attackerPeerId?: string): void {
    if (!targetHitHandler) throw new Error('Damage handlers have not been initialized.');
    targetHitHandler(targetIndex, damage, attackerPeerId);
}

export function takePlayerDamage(damage: number, attackerName: string, attackerPeerId?: string): void {
    if (!playerDamageHandler) throw new Error('Damage handlers have not been initialized.');
    playerDamageHandler(damage, attackerName, attackerPeerId);
}

export function setDamageHandlers(
    onTargetHit: TargetHitHandler,
    onPlayerDamage: PlayerDamageHandler,
    onMechaHit?: (damage: number, hit?: MechaWeaponHit) => void,
): void {
    targetHitHandler = onTargetHit;
    playerDamageHandler = onPlayerDamage;
    mechaHitHandler = onMechaHit ?? null;
}
