import {
    ENEMY_CLASSES, KATANA, PLAYER_MAX_HP,
    SKILL_TREE_HEALTH_BONUS, SKILL_TREE_HEALTH_COST, SKILL_TREE_MAX_HEALTH,
    SKILL_TREE_MAX_LEVEL, SKILL_TREE_MAX_WEAPON_DAMAGE, SKILL_TREE_WEAPON_BASE_COST,
    SKILL_TREE_WEAPON_COST_MULTIPLIER, WEAPON_STATS,
} from './config.js';

export const SKILL_UPGRADE_ORDER = ['HEALTH', 'PISTOL', 'SHOTGUN', 'AR', 'SNIPER', 'MINIGUN', 'KATANA'] as const;
export type SkillUpgradeId = typeof SKILL_UPGRADE_ORDER[number];
export type SkillWeaponName = Exclude<SkillUpgradeId, 'HEALTH'>;
export type SkillLevels = Record<SkillUpgradeId, number>;
export type CyclicWeaponName = 'PISTOL' | 'AR' | 'MINIGUN';

export interface SkillTreeState {
    points: number;
    levels: SkillLevels;
    shotCounts: Record<CyclicWeaponName, number>;
}

/** Match-scoped shot counters rotate per weapon so level bonuses can be spread across a magazine. */
const CYCLIC_WEAPON_SHOT_CYCLES: Record<CyclicWeaponName, number> = { PISTOL: 5, AR: 4, MINIGUN: 10 };

// Cost of the next level at each current level. Each step compounds on the
// rounded-up previous cost so displayed and charged prices stay identical.
const WEAPON_UPGRADE_COSTS: readonly number[] = (() => {
    const costs = [SKILL_TREE_WEAPON_BASE_COST];
    for (let level = 1; level < SKILL_TREE_MAX_LEVEL; level++) {
        costs.push(Math.ceil(costs[level - 1] * SKILL_TREE_WEAPON_COST_MULTIPLIER));
    }
    return costs;
})();

export function isSkillUpgradeId(value: unknown): value is SkillUpgradeId {
    return typeof value === 'string' && (SKILL_UPGRADE_ORDER as readonly string[]).includes(value);
}

export function createSkillLevels(): SkillLevels {
    return Object.fromEntries(SKILL_UPGRADE_ORDER.map(id => [id, 0])) as SkillLevels;
}

export function createSkillTreeState(): SkillTreeState {
    return {
        points: 0,
        levels: createSkillLevels(),
        shotCounts: { PISTOL: 0, AR: 0, MINIGUN: 0 },
    };
}

export function resetSkillTreeState(tree: SkillTreeState): void {
    tree.points = 0;
    for (const id of SKILL_UPGRADE_ORDER) tree.levels[id] = 0;
    tree.shotCounts.PISTOL = 0;
    tree.shotCounts.AR = 0;
    tree.shotCounts.MINIGUN = 0;
}

/** Points awarded for a cube kill, derived from the shared enemy class table. */
export function skillPointsForCubeMaxHp(maxHp: number): number {
    return ENEMY_CLASSES.find(enemy => enemy.hp === maxHp)?.points ?? 0;
}

export function skillUpgradeCost(upgrade: SkillUpgradeId, currentLevel: number): number | null {
    if (!Number.isInteger(currentLevel) || currentLevel < 0 || currentLevel >= SKILL_TREE_MAX_LEVEL) return null;
    if (upgrade === 'HEALTH') return SKILL_TREE_HEALTH_COST;
    return WEAPON_UPGRADE_COSTS[currentLevel];
}

function clampSkillLevel(level: number): number {
    return Math.max(0, Math.min(SKILL_TREE_MAX_LEVEL, Math.trunc(level) || 0));
}

export function playerMaxHpForLevel(healthLevel: number): number {
    const level = clampSkillLevel(healthLevel);
    // The maximum-level value is a deliberate far-future cap, not the linear
    // health bonus extrapolated to the final level.
    if (level >= SKILL_TREE_MAX_LEVEL) return SKILL_TREE_MAX_HEALTH;
    return PLAYER_MAX_HP + level * SKILL_TREE_HEALTH_BONUS;
}

export function weaponDamageForShot(weapon: SkillWeaponName, level: number, shotIndex = 0, pelletIndex = 0, charged = false): number {
    const skillLevel = clampSkillLevel(level);
    if (weapon === 'KATANA') {
        const base = skillLevel >= SKILL_TREE_MAX_LEVEL ? SKILL_TREE_MAX_WEAPON_DAMAGE : KATANA.damage + skillLevel;
        return charged ? base * 2 : base;
    }
    if (skillLevel >= SKILL_TREE_MAX_LEVEL) return SKILL_TREE_MAX_WEAPON_DAMAGE;
    const base = WEAPON_STATS[weapon].damage;
    if (weapon === 'SNIPER') return base + skillLevel;
    if (weapon === 'SHOTGUN') {
        const pellets = WEAPON_STATS.SHOTGUN.pellets ?? 5;
        const idx = ((pelletIndex % pellets) + pellets) % pellets;
        const full = Math.floor(skillLevel / pellets);
        const rem = skillLevel % pellets;
        return base + full + (idx < rem ? 1 : 0);
    }
    const cycle = CYCLIC_WEAPON_SHOT_CYCLES[weapon];
    // The last `rem` positions in each cycle receive the extra point, so a
    // fresh magazine reaches its stronger rounds near the end.
    const pos = ((shotIndex % cycle) + cycle) % cycle;
    const full = Math.floor(skillLevel / cycle);
    const rem = skillLevel % cycle;
    return base + full + (pos >= cycle - rem ? 1 : 0);
}

export function consumeWeaponShotIndex(tree: SkillTreeState, weapon: SkillWeaponName): number {
    if (weapon === 'PISTOL' || weapon === 'AR' || weapon === 'MINIGUN') {
        const index = tree.shotCounts[weapon];
        tree.shotCounts[weapon] = index + 1;
        return index;
    }
    return 0;
}

export function applySkillUpgrade(tree: SkillTreeState, upgrade: SkillUpgradeId): {
    ok: boolean;
    cost: number;
    level: number;
    previousMaxHp: number;
    nextMaxHp: number;
} {
    const cost = skillUpgradeCost(upgrade, tree.levels[upgrade]);
    const previousMaxHp = playerMaxHpForLevel(tree.levels.HEALTH);
    if (cost === null || tree.points < cost) {
        return { ok: false, cost: cost ?? 0, level: tree.levels[upgrade], previousMaxHp, nextMaxHp: previousMaxHp };
    }
    tree.points -= cost;
    tree.levels[upgrade] += 1;
    return { ok: true, cost, level: tree.levels[upgrade], previousMaxHp, nextMaxHp: playerMaxHpForLevel(tree.levels.HEALTH) };
}
