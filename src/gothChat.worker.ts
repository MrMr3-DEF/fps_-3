import { MLCEngine } from '@mlc-ai/web-llm';
import { createGothWorkerHandler } from './gothChatWorkerRuntime.js';
import type { GothWorkerRequest } from './gothChatProtocol.js';

const handle = createGothWorkerHandler(new MLCEngine({ logLevel: 'WARN' }), response => self.postMessage(response));
self.onmessage = (event: MessageEvent<GothWorkerRequest>) => handle(event.data);
