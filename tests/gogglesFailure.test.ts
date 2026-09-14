import test from 'node:test';
import assert from 'node:assert/strict';
import {
    GOGGLES_BRICK_SCAN_MS,
    GOGGLES_TV_OFF_MS,
    createGogglesFailureState,
    finishGogglesShutdown,
    resetGogglesFailure,
    resolveGogglesScopeAttempt,
    updateGogglesFailureScan,
} from '../src/gogglesFailure.ts';

test('only thirty uninterrupted seconds of girlfriend detection bricks the goggles', () => {
    const state = createGogglesFailureState();
    assert.equal(updateGogglesFailureScan(state, true, 20_000, 100), false);
    assert.equal(updateGogglesFailureScan(state, false, 16, 116), false);
    assert.equal(state.scanDurationMs, 0);
    assert.equal(updateGogglesFailureScan(state, true, GOGGLES_BRICK_SCAN_MS - 1, 200), false);
    assert.equal(updateGogglesFailureScan(state, true, 1, 201), true);
    assert.equal(state.bricked, true);
    assert.equal(state.shutdownUntil, 201 + GOGGLES_TV_OFF_MS);
});

test('CRT shutdown finishes once, waits for release, and later attempts can show static', () => {
    const state = createGogglesFailureState();
    updateGogglesFailureScan(state, true, GOGGLES_BRICK_SCAN_MS, 1_000);
    assert.equal(resolveGogglesScopeAttempt(state, false), true, 'shutdown remains visible');
    assert.equal(finishGogglesShutdown(state, 1_000 + GOGGLES_TV_OFF_MS - 1), false);
    assert.equal(finishGogglesShutdown(state, 1_000 + GOGGLES_TV_OFF_MS), true);
    assert.equal(resolveGogglesScopeAttempt(state, true), false, 'held input cannot reopen it');
    assert.equal(resolveGogglesScopeAttempt(state, false), false, 'release clears the latch');
    assert.equal(resolveGogglesScopeAttempt(state, true), true, 'a new attempt opens static');
});

test('fresh-match reset repairs goggles while an ordinary life reset need not touch them', () => {
    const state = createGogglesFailureState();
    updateGogglesFailureScan(state, true, GOGGLES_BRICK_SCAN_MS, 10);
    resetGogglesFailure(state);
    assert.deepEqual(state, createGogglesFailureState());
});
