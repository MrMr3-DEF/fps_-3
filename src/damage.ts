// Standalone module to break circular dependencies by delegating damage handlers
export let processTargetHit: (targetIndex: number, damage: number) => void = () => {};
export let takePlayerDamage: (damage: number, attackerName: string) => void = () => {};

export function setDamageHandlers(
    onTargetHit: typeof processTargetHit,
    onPlayerDamage: typeof takePlayerDamage
): void {
    processTargetHit = onTargetHit;
    takePlayerDamage = onPlayerDamage;
}
