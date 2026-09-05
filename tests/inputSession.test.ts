import test from 'node:test';
import assert from 'node:assert/strict';
import { state } from '../src/state.js';
import { beginInput, enableTouchMode, endInput, isInputActive, onInputStarted, onInputEnded, touchMove } from '../src/inputSession.js';

test('desktop uses pointer lock; landscape touch uses the same session lifecycle without requesting it', async () => {
    let locks = 0, unlocks = 0, starts = 0, ends = 0;
    const events = new Map<string, () => void>();
    const controls = {
        isLocked: false,
        lock() { locks++; this.isLocked = true; events.get('lock')?.(); },
        unlock() { unlocks++; this.isLocked = false; events.get('unlock')?.(); },
        addEventListener(name: string, callback: () => void) { events.set(name, callback); },
    };
    state.controls = controls as unknown as NonNullable<typeof state.controls>;
    onInputStarted(() => starts++);
    onInputEnded(() => ends++);
    beginInput();
    assert.equal(isInputActive(), true);
    endInput();
    assert.equal(isInputActive(), false);
    assert.equal(locks, 1);
    assert.equal(unlocks, 1);

    enableTouchMode();
    Object.defineProperty(globalThis, 'innerWidth', { value: 390, writable: true, configurable: true });
    Object.defineProperty(globalThis, 'innerHeight', { value: 844, writable: true, configurable: true });
    beginInput();
    assert.equal(isInputActive(), false, 'portrait must never enable gameplay');
    assert.equal(starts, 1);
    globalThis.innerWidth = 844;
    globalThis.innerHeight = 390;
    // Fullscreen and orientation rejection must not prevent landscape play.
    Object.defineProperty(globalThis, 'document', { value: { fullscreenElement: null, documentElement: {
        requestFullscreen: async () => { throw new Error('Unsupported'); },
    } }, configurable: true });
    beginInput();
    await Promise.resolve();
    assert.equal(isInputActive(), true);
    assert.equal(locks, 1, 'touch must not request desktop pointer lock');
    touchMove.x = 0.5;
    touchMove.y = -1;
    endInput();
    assert.equal(isInputActive(), false);
    assert.deepEqual(touchMove, { x: 0, y: 0 });
    assert.equal(starts, 2);
    assert.equal(ends, 2);
    assert.equal(unlocks, 1);
});
