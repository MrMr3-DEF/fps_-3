import test from 'node:test';
import assert from 'node:assert/strict';
import { state } from '../src/state.ts';
import { updateHealthRegen } from '../src/healthRegen.ts';
import { createPlayerLife, damagePlayerLife, healPlayerLife } from '../src/playerLife.ts';
import { PLAYER_MAX_HP, REGEN_DELAY_MS } from '../src/config.ts';

(globalThis as any).document = { getElementById: () => null };

test('the host heals from its own clock, once per elapsed second, and never revives a dead life', () => {
    const life = createPlayerLife(1);
    assert.ok(damagePlayerLife(life, 6, 1000));
    const first = 1000 + REGEN_DELAY_MS + 1000;
    assert.equal(healPlayerLife(life, first - 1, false), false);
    assert.equal(healPlayerLife(life, first, false), true);
    assert.equal(healPlayerLife(life, first, false), false);
    assert.equal(life.hp, 5);
    assert.ok(healPlayerLife(life, first + 8000, false));
    assert.equal(life.hp, PLAYER_MAX_HP);
    assert.ok(damagePlayerLife(life, PLAYER_MAX_HP, first + 9000));
    assert.equal(healPlayerLife(life, first + 30_000, false), false);
});

test('offline regeneration counts only unpaused simulation time', () => {
    state.isPlaying = true;
    state.isMultiplayer = false;
    state.playerHp = 4;
    state.playerMaxHp = PLAYER_MAX_HP;
    state.regenDelayMs = REGEN_DELAY_MS;
    state.regenTimer = 0;
    updateHealthRegen(REGEN_DELAY_MS / 1000);
    updateHealthRegen(0.5);
    assert.equal(state.playerHp, 4);
    updateHealthRegen(0.5);
    assert.equal(state.playerHp, 5);
    state.isPlaying = false;
    updateHealthRegen(10);
    assert.equal(state.playerHp, 5);
});
