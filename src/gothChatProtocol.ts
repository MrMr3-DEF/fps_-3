import type { ChatMessage } from './gothKnowledge.js';

interface Identity { generation: number; requestId: number }
export type GothWorkerRequest = Identity & (
    | { type: 'load'; modelId: string; contextWindowSize: number }
    | { type: 'reply'; messages: ChatMessage[]; modelId: string; temperature: number; maxReplyTokens: number }
    | { type: 'interrupt' }
);
export type GothWorkerResponse = Identity & (
    | { type: 'progress'; fraction: number; text: string }
    | { type: 'token'; text: string }
    | { type: 'complete' }
    | { type: 'cancelled' }
    | { type: 'error'; message: string }
);

export function isGothWorkerResponse(value: unknown): value is GothWorkerResponse {
    if (!value || typeof value !== 'object') return false;
    const x = value as Record<string, unknown>;
    if (!Number.isSafeInteger(x.generation) || !Number.isSafeInteger(x.requestId)) return false;
    if (x.type === 'complete' || x.type === 'cancelled') return true;
    if (x.type === 'error') return typeof x.message === 'string';
    if (x.type === 'token') return typeof x.text === 'string';
    return x.type === 'progress' && typeof x.fraction === 'number' && Number.isFinite(x.fraction)
        && x.fraction >= 0 && x.fraction <= 1 && typeof x.text === 'string';
}
