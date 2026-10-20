import test from 'node:test';
import assert from 'node:assert/strict';
import type { WebGLRenderer } from 'three';
import { MechaEndingAuthority, MECHA_ENDING_DURATION, sampleMechaEnding, type MechaEndingState } from '../src/mechaEndingTimeline.ts';
import { MechaEndingPlayback } from '../src/mechaEndingPlayback.ts';
import { MECHA_ENDING_READY_TIMEOUT_MS } from '../src/config.ts';

const initial = { id: 1, seed: 42, effectsSeed: 123, position: { x: 0, y: 0, z: -140 }, heading: 0, lightingElapsed: 150 };
const packet = (elapsed = .45, phase: MechaEndingState['phase'] = 'playing'): MechaEndingState => ({ ...structuredClone(initial), elapsed, phase });
const flush = async () => { for (let i = 0; i < 5; i++) await Promise.resolve(); };
function deferred<T>() { let resolve!: (v: T) => void; let reject!: (e: Error) => void; const promise = new Promise<T>((r, j) => { resolve = r; reject = j; }); return { promise, resolve, reject }; }
function harness(first = packet(0, 'preparing')) {
    const loaded = deferred<any>(), built = deferred<void>();
    const seeks: number[] = [], covers: number[] = [];
    let starts = 0, renders = 0, disposals = 0, ready = 0, complete = 0, failures = 0;
    const scene = { begin: () => { starts++; return built.promise; }, seek: (t: number) => { seeks.push(t); return sampleMechaEnding(t, 85 / 24); },
        render: () => { renders++; }, dispose: () => { disposals++; } };
    const playback = new MechaEndingPlayback(first, 0, { prepare: () => loaded.promise, cover: v => covers.push(v), ready: () => ready++, complete: () => complete++, failed: () => failures++ });
    const renderer = { domElement: { width: 1600, height: 900 } } as WebGLRenderer;
    return { playback, renderer, scene, loaded, built, seeks, covers, stats: () => ({ starts, renders, disposals, ready, complete, failures }) };
}

test('authority holds opaque cover until local and connected viewers are ready, then owns an absolute clock', () => {
    const clock = new MechaEndingAuthority(initial, 0, ['paused', 'dead']);
    assert.equal(clock.snapshot(100).elapsed, .1);
    assert.equal(clock.markPeerReady('intruder'), false);
    assert.equal(clock.markLocalReady(200), true);
    assert.equal(clock.markLocalReady(300), false);
    assert.equal(clock.markPeerReady('paused'), true);
    assert.equal(clock.markPeerReady('paused'), false);
    assert.deepEqual([clock.snapshot(2000).phase, clock.snapshot(2000).elapsed], ['preparing', .45]);
    clock.markPeerReady('dead');
    assert.equal(clock.snapshot(2000).phase, 'playing');
    assert.equal(clock.snapshot(3000).elapsed, 1.45);
    assert.equal(clock.snapshot(60000).phase, 'complete');
    assert.equal(clock.snapshot(60000).elapsed, MECHA_ENDING_DURATION);
});
test('departure and bounded readiness timeout release the barrier, without timing out local preparation', () => {
    const departed = new MechaEndingAuthority(initial, 0, ['gone']);
    departed.markLocalReady(500); departed.removePeer('gone');
    assert.equal(departed.snapshot(500).phase, 'playing');
    const stalled = new MechaEndingAuthority(initial, 0, ['stuck']);
    assert.equal(stalled.snapshot(60000).phase, 'preparing');
    stalled.markLocalReady(60000);
    assert.equal(stalled.snapshot(60000 + MECHA_ENDING_READY_TIMEOUT_MS - 1).phase, 'preparing');
    assert.equal(stalled.snapshot(60000 + MECHA_ENDING_READY_TIMEOUT_MS).phase, 'playing');
});
test('playback allocates breakable geometry only under black and cannot punch before activation and authority', async () => {
    const h = harness();
    h.loaded.resolve(h.scene); await flush();
    h.playback.update(449, h.renderer); assert.equal(h.stats().starts, 0);
    h.playback.update(450, h.renderer); assert.equal(h.covers.at(-1), 1); assert.equal(h.stats().starts, 1);
    h.playback.receive(packet(2), 500); h.playback.update(550, h.renderer); assert.equal(h.stats().renders, 0);
    h.built.resolve(); await flush(); assert.equal(h.stats().ready, 1);
    h.playback.update(600, h.renderer); assert.ok(Math.abs(h.seeks.at(-1)! - 2.1) < 1e-9);
    h.playback.dispose(); assert.equal(h.stats().disposals, 1);
});
test('late snapshots seek current action, and duplicates, stale clocks and scene mutations cannot restart it', async () => {
    const h = harness(packet(4)); h.loaded.resolve(h.scene); await flush();
    h.playback.update(450, h.renderer); h.built.resolve(); await flush();
    h.playback.receive(packet(4), 900); h.playback.update(1000, h.renderer);
    assert.equal(h.seeks.at(-1), 5, 'duplicate does not reset receipt time');
    h.playback.receive(packet(.45, 'preparing'), 1200);
    h.playback.receive({ ...packet(6), heading: Math.PI }, 1200);
    h.playback.update(1500, h.renderer); assert.equal(h.seeks.at(-1), 5.5);
    h.playback.receive(packet(4.1), 1600); h.playback.update(1600, h.renderer);
    assert.equal(h.seeks.at(-1), 5.5, 'render time never rewinds after clock correction');
    h.playback.update(20000, h.renderer); h.playback.update(30000, h.renderer);
    assert.equal(h.stats().complete, 1); assert.equal(h.seeks.at(-1), MECHA_ENDING_DURATION);
    const renders = h.stats().renders;
    h.renderer.domElement.width = 800; h.playback.update(40000, h.renderer);
    assert.equal(h.stats().renders, renders + 1); assert.equal(h.stats().complete, 1);
    h.playback.dispose();
});
test('the authoritative finish survives float32 GLB duration rounding', async () => {
    const h = harness(packet(MECHA_ENDING_DURATION, 'complete'));
    h.scene.seek = t => { h.seeks.push(t); return sampleMechaEnding(t, 85 / 24 + 1e-7); };
    h.loaded.resolve(h.scene); await flush(); h.playback.update(500, h.renderer);
    h.built.resolve(); await flush(); h.playback.update(501, h.renderer);
    assert.equal(h.stats().complete, 1); h.playback.dispose();
});
test('already completed joins prepare under black and display the final shot without replaying', async () => {
    const h = harness(packet(MECHA_ENDING_DURATION, 'complete'));
    h.loaded.resolve(h.scene); await flush(); h.playback.update(500, h.renderer);
    h.built.resolve(); await flush(); h.playback.update(501, h.renderer);
    assert.deepEqual(h.seeks, [MECHA_ENDING_DURATION]); assert.equal(h.stats().complete, 1);
    h.playback.dispose();
});
test('leaving during asset preparation or activation cannot revive a disposed match', async () => {
    const loading = harness(); loading.playback.dispose(); loading.loaded.resolve(loading.scene); await flush();
    assert.equal(loading.stats().disposals, 1); assert.equal(loading.stats().ready, 0);
    const building = harness(); building.loaded.resolve(building.scene); await flush(); building.playback.update(500, building.renderer);
    building.playback.dispose(); building.built.resolve(); await flush(); building.playback.update(600, building.renderer);
    assert.deepEqual(building.stats(), { starts: 1, renders: 0, disposals: 1, ready: 0, complete: 0, failures: 0 });
});
test('preparation failure leaves usable Game Over under black and releases other viewers', async () => {
    for (const duringBuild of [false, true]) {
        const h = harness();
        if (duringBuild) { h.loaded.resolve(h.scene); await flush(); h.playback.update(500, h.renderer); h.built.reject(new Error('GPU failure')); }
        else h.loaded.reject(new Error('Asset failure'));
        await flush(); h.playback.update(20000, h.renderer);
        assert.equal(h.covers.at(-1), 1); assert.equal(h.stats().complete, 1); assert.equal(h.stats().ready, 1); assert.equal(h.stats().failures, 1);
        h.playback.dispose();
    }
});
