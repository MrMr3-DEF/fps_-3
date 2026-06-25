// Small indirection layer used by modules that need damage callbacks without
// importing main.ts and creating circular runtime dependencies.
export let processTargetHit: (targetIndex: number, damage: number) => void = () => {};
export let takePlayerDamage: (damage: number, attackerName: string) => void = () => {};

export function setDamageHandlers(
    onTargetHit: typeof processTargetHit,
    onPlayerDamage: typeof takePlayerDamage
): void {
    processTargetHit = onTargetHit;
    takePlayerDamage = onPlayerDamage;
}
