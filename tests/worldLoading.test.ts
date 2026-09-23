import test from 'node:test';
import assert from 'node:assert/strict';
import { withWorldLoading, cancelWorldLoading, isWorldLoading } from '../src/worldLoading.ts';

const overlay = { hidden: true };
Object.assign(globalThis, {
    document: { getElementById: () => overlay },
    requestAnimationFrame: (callback: () => void) => setTimeout(callback, 0),
});

test('loading screen paints before generation and always closes on failure', async () => {
    let started = false;
    const loading = withWorldLoading(async checkpoint => {
        started = true;
        assert.equal(overlay.hidden, false);
        await checkpoint();
        throw new Error('generation failed');
    });
    assert.equal(started, false);
    assert.equal(overlay.hidden, false);
    assert.equal(isWorldLoading, true);
    await assert.rejects(loading, /generation failed/);
    assert.equal(overlay.hidden, true);
    assert.equal(isWorldLoading, false);
});

test('cancelled startup cannot resume generation or hide a newer loading screen', async () => {
    let continued = false;
    const old = withWorldLoading(async () => { continued = true; });
    const rejected = assert.rejects(old, { name: 'AbortError' });
    cancelWorldLoading();
    const current = withWorldLoading(async () => {
        await rejected;
        assert.equal(overlay.hidden, false);
    });
    await current;
    assert.equal(continued, false);
    assert.equal(overlay.hidden, true);
});
