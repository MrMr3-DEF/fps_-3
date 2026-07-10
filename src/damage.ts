type TargetHitHandler = (targetIndex: number, damage: number) => void;
type PlayerDamageHandler = (damage: number, attackerName: string) => void;

let targetHitHandler: TargetHitHandler | null = null;
let playerDamageHandler: PlayerDamageHandler | null = null;

/**
 * Explicit gameplay event boundary for modules that cannot import main.ts
 * without creating a runtime cycle. Calling before initialization is a real
 * lifecycle error, not a silently discarded hit.
 */
export function processTargetHit(targetIndex: number, damage: number): void {
    if (!targetHitHandler) throw new Error('Damage handlers have not been initialized.');
    targetHitHandler(targetIndex, damage);
}

export function takePlayerDamage(damage: number, attackerName: string): void {
    if (!playerDamageHandler) throw new Error('Damage handlers have not been initialized.');
    playerDamageHandler(damage, attackerName);
}

export function setDamageHandlers(
    onTargetHit: TargetHitHandler,
    onPlayerDamage: PlayerDamageHandler,
): void {
    targetHitHandler = onTargetHit;
    playerDamageHandler = onPlayerDamage;
}
