import type { MLCEngineInterface } from '@mlc-ai/web-llm';
import type { GothWorkerRequest, GothWorkerResponse } from './gothChatProtocol.js';

/** Interrupt bypasses the single-operation gate, but completion waits for the
 * old generator to drain before another resetChat can touch its KV state. */
export function createGothWorkerHandler(engine: MLCEngineInterface, post: (response: GothWorkerResponse) => void): (request: GothWorkerRequest) => void {
    let active: { request: GothWorkerRequest; cancelled: boolean } | null = null;
    let loadedGeneration: number | null = null;
    return request => {
        if (request.type === 'interrupt') {
            if (active?.request.type === 'reply' && active.request.generation === request.generation && active.request.requestId === request.requestId) {
                active.cancelled = true;
                void Promise.resolve().then(() => engine.interruptGenerate()).catch(() => {});
            }
            return;
        }
        const identity = { generation: request.generation, requestId: request.requestId };
        if (active) { post({ ...identity, type: 'error', message: 'Local AI is busy.' }); return; }
        const operation = active = { request, cancelled: false };
        void (async () => {
            let failure: unknown;
            try {
                if (request.type === 'load') {
                    loadedGeneration = null;
                    engine.setInitProgressCallback(report => {
                        if (active === operation) post({ ...identity, type: 'progress', fraction: Math.max(0, Math.min(1, report.progress)), text: report.text });
                    });
                    await engine.reload(request.modelId, { context_window_size: request.contextWindowSize });
                    loadedGeneration = request.generation;
                } else {
                    if (loadedGeneration !== request.generation) throw new Error('Load the local model first.');
                    await engine.resetChat();
                    if (!operation.cancelled) {
                        const stream = await engine.chat.completions.create({
                            messages: request.messages, stream: true, temperature: request.temperature,
                            ...(request.modelId.startsWith('Qwen3.5-') ? { extra_body: { enable_thinking: true } } : {}),
                            max_tokens: request.maxReplyTokens, top_p: .9, repetition_penalty: 1.1,
                        });
                        for await (const chunk of stream) {
                            if (operation.cancelled) break;
                            const text = chunk.choices[0]?.delta.content;
                            if (text) post({ ...identity, type: 'token', text });
                        }
                    }
                }
            } catch (error) { failure = error; }
            finally {
                active = null;
                if (operation.cancelled) post({ ...identity, type: 'cancelled' });
                else if (failure) post({ ...identity, type: 'error', message: failure instanceof Error ? failure.message : 'The local AI worker failed.' });
                else post({ ...identity, type: 'complete' });
            }
        })();
    };
}
