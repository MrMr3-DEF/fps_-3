import { PLAYER_MAX_HP, REGEN_DELAY_MS } from './config.js';

export interface PlayerLife {
    id: number;
    hp: number;
    nextHealAt: number;
    nextLavaAt: number;
}

export function createPlayerLife(id: number): PlayerLife {
    return { id, hp: PLAYER_MAX_HP, nextHealAt: Infinity, nextLavaAt: -Infinity };
}

export function damagePlayerLife(life: PlayerLife, damage: number, now: number): boolean {
    if (life.hp <= 0 || !Number.isSafeInteger(damage) || damage <= 0) return false;
    life.hp = Math.max(0, life.hp - damage);
    life.nextHealAt = now + REGEN_DELAY_MS + 1000;
    return true;
}

export function healPlayerLife(life: PlayerLife, now: number, mounted: boolean): boolean {
    if (life.hp <= 0 || life.hp === PLAYER_MAX_HP || now < life.nextHealAt) return false;
    if (mounted) {
        life.nextHealAt = now + 1000;
        return false;
    }
    const amount = Math.min(PLAYER_MAX_HP - life.hp, 1 + Math.floor((now - life.nextHealAt) / 1000));
    life.hp += amount;
    life.nextHealAt += amount * 1000;
    return true;
}
