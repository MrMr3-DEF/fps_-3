import { WebWorkerMLCEngine } from '@mlc-ai/web-llm';
import type { CharacterConfig, ChatMessage } from './gothKnowledge.js';
import { visibleGothReply } from './gothReply.js';

export class GothChatEngine {
    private worker: Worker | null = null;
    private engine: WebWorkerMLCEngine | null = null;
    private abort: (() => void) | null = null;
    private generation = 0;
    ready = false;

    async load(config: CharacterConfig, progress: (fraction: number, text: string) => void): Promise<void> {
        const generation = ++this.generation;
        if (!globalThis.isSecureContext) throw new Error('Local AI needs HTTPS or localhost. Open this game at localhost on this computer.');
        const gpu = (navigator as Navigator & { gpu?: { requestAdapter(): Promise<{ features: { has(name: string): boolean } } | null> } }).gpu;
        if (!gpu) throw new Error('WebGPU is unavailable. Try a current Chrome or Edge browser with hardware acceleration enabled.');
        const adapter = await gpu.requestAdapter();
        if (generation !== this.generation) throw new Error('Local AI was stopped.');
        if (!adapter) throw new Error('No WebGPU adapter is available. Try a browser with hardware acceleration enabled.');
        if (config.modelId.includes('f16') && !adapter.features.has('shader-f16')) {
            throw new Error('This GPU lacks shader-f16. In character.json, use Qwen3.5-2B-q4f32_1-MLC, then refresh the page. That version uses 4-bit weights and does not need shader-f16.');
        }
        this.worker = new Worker(new URL('./gothChat.worker.ts', import.meta.url), { type: 'module' });
        this.engine = new WebWorkerMLCEngine(this.worker, { initProgressCallback: report => progress(report.progress, report.text), logLevel: 'WARN' });
        await this.guard(this.engine.reload(config.modelId, { context_window_size: 4096, ...(config.modelId.startsWith('Qwen3.5-') ? { max_history_size: 1 } : {}) }), 300000);
        this.ready = true;
    }

    private async guard<T>(operation: Promise<T>, timeout: number): Promise<T> {
        let timer: ReturnType<typeof setTimeout> | undefined;
        const failure = new Promise<never>((_, reject) => {
            this.abort = () => reject(new Error('Local AI was stopped.'));
            if (this.worker) this.worker.onerror = () => reject(new Error('The local AI worker stopped. Try loading it again.'));
            timer = setTimeout(() => reject(new Error('Local AI timed out. Check your connection or GPU and retry.')), timeout);
        });
        try { return await Promise.race([operation, failure]); }
        catch (error) {
            this.dispose();
            if (error instanceof Error) throw error;
            throw new Error(`The local model could not run on this browser/GPU (${String(error)}). Try a current Chrome or Edge browser, then retry.`);
        }
        finally { clearTimeout(timer); this.abort = null; }
    }

    async reply(messages: ChatMessage[], config: CharacterConfig, onToken: (text: string) => void): Promise<string> {
        if (!this.engine || !this.ready) throw new Error('Load the local model first.');
        const engine = this.engine;
        return this.guard((async () => {
            // The complete, bounded prompt is rebuilt each turn, including fresh RAG facts.
            await engine.resetChat();
            const stream = await engine.chat.completions.create({
                messages, stream: true, temperature: config.temperature,
                ...(config.modelId.startsWith('Qwen3.5-') ? { extra_body: { enable_thinking: true } } : {}),
                max_tokens: config.maxReplyTokens, top_p: 0.9, repetition_penalty: 1.1,
            });
            let rawReply = '';
            let reply = '';
            for await (const chunk of stream) {
                const token = chunk.choices[0]?.delta.content;
                if (token) {
                    rawReply += token;
                    const visible = visibleGothReply(rawReply);
                    if (visible && visible !== reply) {
                        reply = visible;
                        onToken(reply);
                    }
                }
            }
            if (!reply.trim()) throw new Error('The model returned an empty reply. Please retry.');
            return reply.trim();
        })(), 90000);
    }

    dispose(): void {
        this.generation++;
        this.ready = false;
        this.abort?.();
        this.abort = null;
        this.worker?.terminate();
        this.worker = null;
        this.engine = null;
    }
}
