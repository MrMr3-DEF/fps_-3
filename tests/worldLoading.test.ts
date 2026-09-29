import test from 'node:test';
import assert from 'node:assert/strict';
import { withWorldLoading, cancelWorldLoading, isWorldLoading, isWorldReveal } from '../src/worldLoading.ts';

const phaseEvents: { target: string; phase: string; reveal: boolean }[] = [];
const phaseWaiters = new Map<string, () => void>();
function fakeClassList(target: string) {
    const classes = new Set<string>();
    return {
        add: (...names: string[]) => {
            for (const name of names) {
                classes.add(name);
                phaseEvents.push({ target, phase: name, reveal: isWorldReveal });
                phaseWaiters.get(`${target}:${name}`)?.();
            }
        },
        remove: (...names: string[]) => { for (const name of names) classes.delete(name); },
        contains: (name: string) => classes.has(name),
    };
}
const fill = { style: { transition: '', transform: '' }, classList: fakeClassList('fill') };
const overlay = {
    hidden: true,
    dataset: {} as { loadingMode?: string },
    classList: fakeClassList('overlay'),
    querySelector: (selector: string) => selector === '.world-loading-boot-fill' ? fill : null,
};
Object.assign(globalThis, {
    document: { getElementById: () => overlay },
    requestAnimationFrame: (callback: () => void) => setTimeout(callback, 0),
});

test('loading screen paints before generation and always closes on failure', async () => {
    let started = false;
    const loading = withWorldLoading(async checkpoint => {
        started = true;
        assert.equal(overlay.hidden, false);
        assert.equal(overlay.dataset.loadingMode, 'world');
        await checkpoint();
        throw new Error('generation failed');
    });
    assert.equal(started, false);
    assert.equal(overlay.hidden, false);
    assert.equal(isWorldLoading, true);
    assert.equal(isWorldReveal, false);
    await assert.rejects(loading, /generation failed/);
    assert.equal(overlay.hidden, true);
    assert.equal(overlay.dataset.loadingMode, undefined);
    assert.equal(isWorldLoading, false);
    assert.equal(isWorldReveal, false);
});

test('cancelled startup cannot resume generation or hide a newer loading screen', async () => {
    let continued = false;
    const old = withWorldLoading(async () => { continued = true; }, 'boot');
    assert.equal(overlay.dataset.loadingMode, 'boot');
    const rejected = assert.rejects(old, { name: 'AbortError' });
    cancelWorldLoading();
    assert.equal(overlay.dataset.loadingMode, undefined);
    const current = withWorldLoading(async () => {
        await rejected;
        assert.equal(overlay.hidden, false);
        assert.equal(overlay.dataset.loadingMode, 'world', 'stale boot loading cannot change the next mode');
    });
    await current;
    assert.equal(continued, false);
    assert.equal(overlay.hidden, true);
    assert.equal(overlay.dataset.loadingMode, undefined);
});

test('singleplayer boot mode stays selected through checkpoints and resets afterward', async () => {
    phaseEvents.length = 0;
    let finishWork!: () => void;
    let workStarted!: () => void;
    const started = new Promise<void>(resolve => { workStarted = resolve; });
    const held = new Promise<void>(resolve => { finishWork = resolve; });
    const loading = withWorldLoading(async checkpoint => {
        assert.equal(overlay.dataset.loadingMode, 'boot');
        await checkpoint();
        assert.equal(overlay.dataset.loadingMode, 'boot');
        workStarted();
        await held;
    }, 'boot');
    await started;
    assert.match(fill.style.transform, /^scaleX\(0\.\d+\)$/);
    assert.notEqual(fill.style.transform, 'scaleX(1)', 'fake progress cannot complete while work is pending');
    assert.equal(isWorldReveal, false);
    finishWork();
    await new Promise(resolve => setTimeout(resolve, 0));
    assert.equal(fill.style.transform, 'scaleX(1)');
    assert.equal(overlay.hidden, false, 'the last fill is visible before the overlay closes');
    assert.equal(isWorldReveal, false);
    await loading;
    assert.deepEqual(phaseEvents.map(({ target, phase }) => `${target}:${phase}`), [
        'fill:boot-flashing',
        'overlay:boot-content-out',
        'overlay:boot-screen-out',
    ]);
    assert.equal(phaseEvents.at(-1)?.reveal, true, 'the world renders behind the black screen fade');
    assert.equal(overlay.hidden, true);
    assert.equal(overlay.dataset.loadingMode, undefined);
    assert.equal(fill.style.transform, 'scaleX(0)', 'the next boot starts empty');
    assert.equal(isWorldReveal, false);
});

test('cancelling the final fill cannot hide a replacement multiplayer screen', async () => {
    let finishOld!: () => void;
    let oldStarted!: () => void;
    const started = new Promise<void>(resolve => { oldStarted = resolve; });
    const held = new Promise<void>(resolve => { finishOld = resolve; });
    const old = withWorldLoading(async () => { oldStarted(); await held; }, 'boot');
    await started;
    finishOld();
    await new Promise(resolve => setTimeout(resolve, 0));
    assert.equal(fill.style.transform, 'scaleX(1)');
    const rejected = assert.rejects(old, { name: 'AbortError' });
    cancelWorldLoading();
    let finishNew!: () => void;
    const holdNew = new Promise<void>(resolve => { finishNew = resolve; });
    const current = withWorldLoading(async () => { await holdNew; });
    await rejected;
    assert.equal(overlay.hidden, false);
    assert.equal(overlay.dataset.loadingMode, 'world');
    finishNew();
    await current;
    assert.equal(overlay.hidden, true);
});

test('cancelling the black fade clears reveal without hiding a replacement screen', async () => {
    let reachedFade!: () => void;
    const fadeStarted = new Promise<void>(resolve => { reachedFade = resolve; });
    phaseWaiters.set('overlay:boot-screen-out', reachedFade);
    try {
        const old = withWorldLoading(async () => {}, 'boot');
        await fadeStarted;
        assert.equal(isWorldReveal, true);
        const rejected = assert.rejects(old, { name: 'AbortError' });
        cancelWorldLoading();
        assert.equal(isWorldReveal, false);
        let finishNew!: () => void;
        const holdNew = new Promise<void>(resolve => { finishNew = resolve; });
        const current = withWorldLoading(async () => { await holdNew; });
        await rejected;
        assert.equal(overlay.hidden, false);
        assert.equal(overlay.dataset.loadingMode, 'world');
        finishNew();
        await current;
        assert.equal(overlay.hidden, true);
    } finally {
        phaseWaiters.delete('overlay:boot-screen-out');
    }
});
