import test from 'node:test';
import assert from 'node:assert/strict';
import { GothChatEngine } from '../src/gothChatEngine.ts';
import { createGothWorkerHandler } from '../src/gothChatWorkerRuntime.ts';
import type { GothWorkerRequest, GothWorkerResponse } from '../src/gothChatProtocol.ts';

const tick = () => new Promise<void>(resolve => setImmediate(resolve));
const config = { modelId: 'Qwen3.5-test-f16', temperature: .7, maxReplyTokens: 64 } as any;
function gate() { let release!: () => void; const promise = new Promise<void>(resolve => { release = resolve; }); return { promise, release }; }
function fixture() {
    const names = ['navigator', 'isSecureContext', 'Worker'];
    const original = names.map(name => Object.getOwnPropertyDescriptor(globalThis, name));
    const models: any[] = [], workers: FakeWorker[] = [];
    let adapter: Promise<any> = Promise.resolve({ features: { has: () => true } });
    let reload = Promise.resolve();
    let stream = async function* () { yield { choices: [{ delta: { content: 'Hello.' } }] }; };
    class FakeWorker {
        onmessage: ((e: { data: GothWorkerResponse }) => void) | null = null;
        onerror: (() => void) | null = null;
        onmessageerror: (() => void) | null = null;
        stopped = false; terminations = 0; sent: GothWorkerRequest[] = [];
        handle: ReturnType<typeof createGothWorkerHandler>;
        constructor() {
            const model = { loads: 0, resets: 0, interrupts: 0, options: null as any, progress: null as any,
                setInitProgressCallback(callback: any) { this.progress = callback; },
                async reload(_id: string, options: any) { this.loads++; this.options = options; await reload; },
                async resetChat() { this.resets++; },
                async interruptGenerate() { this.interrupts++; },
                chat: { completions: { create: async (options: any) => { model.options = options; return stream(); } } },
            };
            models.push(model); workers.push(this);
            this.handle = createGothWorkerHandler(model as any, response => queueMicrotask(() => {
                if (!this.stopped) this.onmessage?.({ data: response });
            }));
        }
        postMessage(request: GothWorkerRequest) { this.sent.push(request); queueMicrotask(() => { if (!this.stopped) this.handle(request); }); }
        terminate() { this.stopped = true; this.terminations++; }
    }
    Object.defineProperties(globalThis, {
        navigator: { configurable: true, value: { gpu: { requestAdapter: () => adapter } } },
        isSecureContext: { configurable: true, value: true }, Worker: { configurable: true, value: FakeWorker },
    });
    return { models, workers, adapter: (value: Promise<any>) => adapter = value, reload: (value: Promise<void>) => reload = value,
        stream: (value: typeof stream) => stream = value,
        restore: () => names.forEach((name, i) => { if (original[i]) Object.defineProperty(globalThis, name, original[i]!); else delete (globalThis as any)[name]; }),
    };
}

test('adapter/load cancellation terminates once and ignores late worker responses', async () => {
    const f = fixture(), engine = new GothChatEngine(), adapter = gate(), reload = gate();
    try {
        f.adapter(adapter.promise.then(() => ({ features: { has: () => true } })));
        const early = engine.load(config, () => {}); engine.dispose(); adapter.release();
        await assert.rejects(early, /stopped/); assert.equal(f.workers.length, 0);
        f.adapter(Promise.resolve({ features: { has: () => true } })); f.reload(reload.promise);
        let progress = 0; const pending = engine.load(config, () => progress++); await tick();
        const worker = f.workers[0], late = worker.onmessage!, request = worker.sent[0];
        const rejected = assert.rejects(pending, /stopped/); engine.dispose(); engine.dispose(); await rejected;
        late({ data: { ...request, type: 'progress', fraction: .8, text: 'late' } }); reload.release(); await tick();
        assert.equal(worker.terminations, 1); assert.equal(progress, 0); assert.equal(engine.ready, false);
    } finally { adapter.release(); reload.release(); engine.dispose(); f.restore(); }
});

test('worker RPC preserves progress, generation options, and filtered streaming', async () => {
    const f = fixture(), engine = new GothChatEngine(), loading = gate(); f.reload(loading.promise);
    try {
        const progress: number[] = [], load = engine.load(config, fraction => progress.push(fraction)); await tick();
        f.models[0].progress({ progress: .5, text: 'loading' }); loading.release(); await load;
        assert.deepEqual(progress, [.5]); assert.equal(f.models[0].options.context_window_size, 8192);
        f.stream(async function* () {
            for (const content of ['<think>private', '</think>', 'Hello.']) yield { choices: [{ delta: { content } }] };
        });
        const visible: string[] = [];
        assert.equal(await engine.reply([{ role: 'user', content: 'Hi' }], config, text => visible.push(text)), 'Hello.');
        assert.equal(visible.at(-1), 'Hello.'); assert.ok(visible.every(text => !text.includes('private')));
        assert.equal(f.models[0].options.max_tokens, 64); assert.equal(f.models[0].options.extra_body.enable_thinking, true);
        assert.equal(f.models[0].resets, 1);
    } finally { loading.release(); engine.dispose(); f.restore(); }
});

test('interrupt drains old generation before immediate reopen and retains the loaded model', async () => {
    const f = fixture(), engine = new GothChatEngine(), blocked = gate(); let calls = 0;
    f.stream(async function* () {
        if (++calls === 1) { yield { choices: [{ delta: { content: 'Partial' } }] }; await blocked.promise; }
        yield { choices: [{ delta: { content: 'Hello.' } }] };
    });
    try {
        await engine.load(config, () => {});
        const reply = engine.reply([], config, () => {}), rejection = assert.rejects(reply, { name: 'AbortError' }); await tick();
        const worker = f.workers[0], old = worker.sent.at(-1)!;
        const drain = engine.interrupt();
        const queued = engine.reply([], config, () => {}), queuedRejection = assert.rejects(queued, { name: 'AbortError' });
        engine.interrupt();
        const next = engine.reply([], config, () => {}); await tick();
        assert.equal(f.models[0].resets, 1); assert.equal(f.models[0].interrupts, 1);
        blocked.release(); await drain; await rejection; await queuedRejection;
        assert.equal(await next, 'Hello.'); assert.equal(f.models[0].loads, 1); assert.equal(f.models[0].resets, 2);
        worker.onmessage?.({ data: { ...old, type: 'token', text: 'stale' } });
        assert.equal(engine.ready, true); assert.equal(worker.terminations, 0);
    } finally { blocked.release(); engine.dispose(); f.restore(); }
});

test('worker failure and inactivity reject pending work and release the worker', async t => {
    const f = fixture(), engine = new GothChatEngine(), blocked = gate();
    try {
        await engine.load(config, () => {});
        f.stream(async function* () { await blocked.promise; yield { choices: [{ delta: { content: 'late' } }] }; });
        const pending = engine.reply([], config, () => {}), failure = assert.rejects(pending, /worker stopped/);
        f.workers[0].onerror?.(); await failure; assert.equal(engine.ready, false);
        t.mock.timers.enable({ apis: ['setTimeout'] }); f.reload(blocked.promise);
        const loading = engine.load(config, () => {}), timeout = assert.rejects(loading, /five minutes/); await tick();
        t.mock.timers.tick(300_000); await timeout; assert.equal(f.workers[1].terminations, 1);
    } finally { blocked.release(); engine.dispose(); f.restore(); }
});

test('an interruption that cannot drain terminates after five seconds', async t => {
    const f = fixture(), engine = new GothChatEngine(), blocked = gate();
    try {
        await engine.load(config, () => {});
        f.stream(async function* () { await blocked.promise; yield { choices: [{ delta: { content: 'late' } }] }; });
        t.mock.timers.enable({ apis: ['setTimeout'] });
        const reply = engine.reply([], config, () => {}), rejection = assert.rejects(reply, { name: 'AbortError' }); await tick();
        const drain = engine.interrupt(); t.mock.timers.tick(5_000); await drain; await rejection;
        assert.equal(engine.ready, false); assert.equal(f.workers[0].terminations, 1);
    } finally { blocked.release(); engine.dispose(); f.restore(); }
});
