import test from 'node:test';
import assert from 'node:assert/strict';
import { state } from '../src/state.ts';
import { updateHealthRegen } from '../src/healthRegen.ts';
(globalThis as any).document = { getElementById: () => null };
function injured(multiplayer = true) {
    state.isPlaying = true; state.isMultiplayer = multiplayer;
    state.playerHp = 4; state.playerMaxHp = 10;
    state.lastDamageTime = 1000; state.regenUpdatedAt = 1000; state.regenTimer = 0;
    state.controls = { isLocked: false } as any;
}
test('multiplayer heals while paused, including throttled frames, without double counting', () => {
    injured();
    assert.equal(updateHealthRegen(0, 4999), false);
    assert.equal(updateHealthRegen(0, 5000), false);
    updateHealthRegen(0, 6000); assert.equal(state.playerHp, 5);
    updateHealthRegen(0.05, 6000); assert.equal(state.playerHp, 5, 'frame and timer cannot award the same HP');
    updateHealthRegen(0, 9500); assert.equal(state.playerHp, 8, 'catch up elapsed time even without rendered frames');
    updateHealthRegen(0, 10000); assert.equal(state.playerHp, 9);
    updateHealthRegen(0, 20000); assert.equal(state.playerHp, 10);
});
test('new damage restarts the full delay and dead players never regenerate', () => {
    injured(); updateHealthRegen(0, 6500);
    state.playerHp--; state.lastDamageTime = 6500; state.regenTimer = 0;
    updateHealthRegen(0, 10500); assert.equal(state.playerHp, 4);
    updateHealthRegen(0, 11500); assert.equal(state.playerHp, 5);
    state.playerHp = 0; updateHealthRegen(0, 20000); assert.equal(state.playerHp, 0);
});
test('offline regeneration counts only simulation time, not time spent paused', () => {
    injured(false);
    updateHealthRegen(0.5, 6000); assert.equal(state.playerHp, 4);
    updateHealthRegen(0.5, 66000); assert.equal(state.playerHp, 5);
    state.isPlaying = false; updateHealthRegen(10, 80000); assert.equal(state.playerHp, 5);
});
