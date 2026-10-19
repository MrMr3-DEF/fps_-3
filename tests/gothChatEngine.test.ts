import test from 'node:test';
import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';

registerHooks({ resolve(specifier, context, next) {
    if (specifier === '@mlc-ai/web-llm') return { url: 'data:text/javascript,' + encodeURIComponent(`
        export class WebWorkerMLCEngine {
            constructor(worker, options) { globalThis.workerProgress = options.initProgressCallback; }
            reload() { return globalThis.reloadGate; }
        }`), shortCircuit: true };
    return next(specifier, context);
} });

test('the real engine cancels adapter/reload work, terminates its worker once and suppresses late progress', async () => {
    const names = ['navigator', 'isSecureContext', 'Worker'];
    const original = names.map(name => Object.getOwnPropertyDescriptor(globalThis, name));
    let releaseAdapter!: (value: any) => void, releaseReload!: () => void;
    let workers = 0, terminations = 0, progress = 0;
    const adapter = { features: { has: () => true } };
    let adapterGate: Promise<any> = new Promise(resolve => { releaseAdapter = resolve; });
    Object.defineProperties(globalThis, {
        navigator: { configurable: true, value: { gpu: { requestAdapter: () => adapterGate } } },
        isSecureContext: { configurable: true, value: true },
        Worker: { configurable: true, value: class {
            constructor() { workers++; }
            terminate() { terminations++; }
        } },
    });
    try {
        const { GothChatEngine } = await import('../src/gothChatEngine.ts');
        const config = { modelId: 'test-model' } as any;
        const beforeAdapter = new GothChatEngine();
        const earlyLoad = beforeAdapter.load(config, () => progress++);
        beforeAdapter.dispose(); releaseAdapter(adapter);
        await assert.rejects(earlyLoad, /stopped/); assert.equal(workers, 0);

        adapterGate = Promise.resolve(adapter);
        (globalThis as any).reloadGate = new Promise<void>(resolve => { releaseReload = resolve; });
        const duringReload = new GothChatEngine();
        const pending = duringReload.load(config, () => progress++);
        await new Promise(resolve => setImmediate(resolve));
        assert.equal(workers, 1);
        duringReload.dispose(); duringReload.dispose();
        (globalThis as any).workerProgress({ progress: 0.8, text: 'Late worker event' });
        await assert.rejects(pending, /stopped/);
        releaseReload(); await new Promise(resolve => setImmediate(resolve));
        assert.equal(terminations, 1); assert.equal(progress, 0); assert.equal(duringReload.ready, false);

        (globalThis as any).reloadGate = Promise.resolve();
        const replacement = new GothChatEngine(); await replacement.load(config, () => progress++);
        assert.equal(replacement.ready, true); replacement.dispose();
        assert.equal(workers, 2); assert.equal(terminations, 2);
    } finally {
        releaseAdapter?.(adapter); releaseReload?.();
        names.forEach((name, index) => { if (original[index]) Object.defineProperty(globalThis, name, original[index]!); else delete (globalThis as any)[name]; });
    }
});
