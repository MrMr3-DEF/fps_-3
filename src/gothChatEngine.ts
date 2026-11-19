import { characterContextSize, type CharacterConfig, type ChatMessage } from './gothKnowledge.js';
import { isGothWorkerResponse, type GothWorkerRequest } from './gothChatProtocol.js';
import { modelFailure } from './gothModelFailure.js';
import { visibleGothReply } from './gothReply.js';

interface Pending {
    request: GothWorkerRequest;
    resolve: (text: string) => void;
    reject: (error: Error) => void;
    progress?: (fraction: number, text: string) => void;
    onToken?: (text: string) => void;
    raw: string; visible: string; cancelled: boolean;
    timer?: ReturnType<typeof setTimeout>;
}
const INACTIVITY_MS = 300_000;
const INTERRUPT_MS = 5_000;

/** The browser owns only RPC and reply presentation; WebLLM stays in the worker. */
export class GothChatEngine {
    private worker: Worker | null = null;
    private generation = 0;
    private nextRequestId = 0;
    private replyEpoch = 0;
    private pending: Pending | null = null;
    private drain: Promise<void> | null = null;
    private resolveDrain: (() => void) | null = null;
    ready = false;

    async load(config: CharacterConfig, progress: (fraction: number, text: string) => void): Promise<void> {
        this.dispose();
        const generation = this.generation;
        if (!globalThis.isSecureContext) throw new Error('Local AI needs HTTPS or localhost. Open this game at localhost on this computer.');
        const gpu = (navigator as Navigator & { gpu?: { requestAdapter(): Promise<{ features: { has(name: string): boolean } } | null> } }).gpu;
        if (!gpu) throw new Error('WebGPU is unavailable. Try a current Chrome or Edge browser with hardware acceleration enabled.');
        const adapter = await gpu.requestAdapter();
        if (generation !== this.generation) throw new Error('Local AI was stopped.');
        if (!adapter) throw new Error('No WebGPU adapter is available. Try a browser with hardware acceleration enabled.');
        if (config.modelId.includes('f16') && !adapter.features.has('shader-f16')) {
            const fallback = config.modelId.replace(/q(?:0f16|4f16_1)-MLC$/, 'q4f32_1-MLC');
            throw new Error(`This GPU lacks shader-f16. In character.json, use ${fallback}, then refresh the page. That version uses 4-bit weights and does not need shader-f16.`);
        }
        const worker = this.worker = new Worker(new URL('./gothChat.worker.ts', import.meta.url), { type: 'module' });
        worker.onerror = worker.onmessageerror = () => {
            if (this.worker === worker) this.finish(new Error('The local AI worker stopped. Try loading it again.'), true);
        };
        worker.onmessage = event => {
            const response: unknown = event.data, pending = this.pending;
            if (this.worker !== worker || !pending || !isGothWorkerResponse(response) ||
                response.generation !== this.generation || response.requestId !== pending.request.requestId) return;
            if (response.type === 'error') { this.finish(new Error(response.message), pending.request.type !== 'reply'); return; }
            if (response.type === 'cancelled') { pending.cancelled = true; this.finish(); return; }
            if (response.type === 'complete') {
                if (pending.request.type === 'load') this.ready = true;
                if (!pending.cancelled && pending.request.type === 'reply' && !pending.visible.trim()) {
                    this.finish(new Error('The model returned an empty reply. Please retry.'));
                } else this.finish();
                return;
            }
            if (pending.cancelled) return;
            this.touch(pending);
            if (response.type === 'progress') pending.progress?.(response.fraction, response.text);
            else {
                pending.raw += response.text;
                const visible = visibleGothReply(pending.raw);
                if (visible && visible !== pending.visible) { pending.visible = visible; pending.onToken?.(visible); }
            }
        };
        await this.request({ type: 'load', generation, requestId: ++this.nextRequestId,
            modelId: config.modelId, contextWindowSize: characterContextSize() }, progress);
    }

    private touch(pending: Pending): void {
        clearTimeout(pending.timer);
        pending.timer = setTimeout(() => {
            if (this.pending === pending) this.finish(new Error('Local AI reported no progress for five minutes. Retry loading the model.'), true);
        }, INACTIVITY_MS);
    }
    private request(request: GothWorkerRequest, progress?: Pending['progress'], onToken?: Pending['onToken']): Promise<string> {
        if (!this.worker || this.pending) return Promise.reject(new Error('Local AI is unavailable or busy.'));
        return new Promise((resolve, reject) => {
            const pending = this.pending = { request, progress, onToken, resolve, reject, raw: '', visible: '', cancelled: false };
            this.touch(pending);
            try { this.worker!.postMessage(request); }
            catch (error) { this.finish(error instanceof Error ? error : new Error('The local AI worker stopped.'), true); }
        });
    }
    private stopWorker(): void {
        this.generation++; this.ready = false;
        if (this.worker) {
            this.worker.onmessage = this.worker.onerror = this.worker.onmessageerror = null;
            this.worker.terminate(); this.worker = null;
        }
    }
    private finish(error?: Error, stop = false): void {
        const pending = this.pending; this.pending = null;
        if (stop) this.stopWorker();
        if (pending) {
            clearTimeout(pending.timer);
            if (pending.cancelled) pending.reject(new DOMException('Local AI reply was interrupted.', 'AbortError'));
            else if (error) pending.reject(modelFailure(error));
            else pending.resolve(pending.visible.trim());
        }
        this.resolveDrain?.(); this.resolveDrain = null; this.drain = null;
    }
    async reply(messages: ChatMessage[], config: CharacterConfig, onToken: (text: string) => void): Promise<string> {
        const generation = this.generation, epoch = this.replyEpoch;
        if (this.drain) await this.drain;
        if (epoch !== this.replyEpoch) throw new DOMException('Local AI reply was interrupted.', 'AbortError');
        if (generation !== this.generation) throw new Error('Local AI was stopped.');
        if (!this.worker || !this.ready) throw new Error('Load the local model first.');
        return this.request({ type: 'reply', generation: this.generation, requestId: ++this.nextRequestId,
            messages, modelId: config.modelId, temperature: config.temperature, maxReplyTokens: config.maxReplyTokens }, undefined, onToken);
    }
    interrupt(): Promise<void> {
        // Closing again can cancel a reply still waiting for an earlier stream.
        this.replyEpoch++;
        const pending = this.pending;
        if (!pending || pending.request.type !== 'reply') return Promise.resolve();
        if (this.drain) return this.drain;
        pending.cancelled = true;
        this.drain = new Promise(resolve => { this.resolveDrain = resolve; });
        const drain = this.drain;
        clearTimeout(pending.timer);
        pending.timer = setTimeout(() => {
            if (this.pending === pending) this.finish(new Error('Local AI did not stop its reply.'), true);
        }, INTERRUPT_MS);
        try { this.worker?.postMessage({ type: 'interrupt', generation: this.generation, requestId: pending.request.requestId } satisfies GothWorkerRequest); }
        catch { this.finish(new Error('The local AI worker stopped.'), true); }
        return drain;
    }
    dispose(): void { this.replyEpoch++; this.finish(new Error('Local AI was stopped.'), true); }
}
