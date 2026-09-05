async function timedFetch(input: RequestInfo | URL, init: RequestInit = {}): Promise<Response> {
    return fetch(input, { ...init, signal: AbortSignal.timeout(12_000) });
}
import { isCapability } from './roomIdentity.js';
export interface SecurityConfig {
    multiplayerEnabled: boolean;
    turnstileSiteKey: string | null;
    roomCodeLength: number;
}

export interface RegisteredHostRoom {
    closeToken: string;
    turnSessionToken: string;
    admissionToken: string;
    admissionProof: string;
    expiresAt: number;
}

export interface RegisteredTurnSession {
    turnSessionToken: string;
    admissionToken: string;
    admissionProof: string;
    expiresAt: number;
}

type TurnstileAction = 'create-room' | 'join-room';

interface TurnstileApi {
    render(container: HTMLElement, options: {
        sitekey: string;
        action: TurnstileAction;
        theme: 'light' | 'dark' | 'auto';
        callback: (token: string) => void;
        'error-callback': () => void;
        'expired-callback': () => void;
        'timeout-callback': () => void;
    }): string | number;
    remove?(widgetId: string | number): void;
}

declare global {
    interface Window {
        turnstile?: TurnstileApi;
    }
}

let securityConfigPromise: Promise<SecurityConfig> | null = null;
let turnstileScriptPromise: Promise<TurnstileApi> | null = null;

async function readJson<T>(response: Response): Promise<T> {
    let payload: { error?: unknown } | null = null;
    try {
        payload = await response.clone().json() as { error?: unknown };
    } catch {
        // The status text below is a safe fallback for malformed responses.
    }
    if (!response.ok) {
        const message = typeof payload?.error === 'string' ? payload.error : `Request failed (${response.status}).`;
        throw new Error(message);
    }
    return response.json() as Promise<T>;
}

function validateSecurityConfig(config: SecurityConfig): SecurityConfig {
    if (typeof config.multiplayerEnabled !== 'boolean' || !Number.isInteger(config.roomCodeLength) || config.roomCodeLength < 4) {
        throw new Error('Secure multiplayer returned an invalid configuration.');
    }
    if (config.turnstileSiteKey !== null && (typeof config.turnstileSiteKey !== 'string' || config.turnstileSiteKey.length === 0)) {
        throw new Error('Secure multiplayer returned an invalid verification key.');
    }
    return config;
}

export function getSecurityConfig(): Promise<SecurityConfig> {
    if (!securityConfigPromise) {
        const request = timedFetch('/api/security-config', { cache: 'no-store' })
            .then(readJson<SecurityConfig>)
            .then(validateSecurityConfig);
        securityConfigPromise = request;
        void request.catch(() => {
            if (securityConfigPromise === request) securityConfigPromise = null;
        });
    }
    return securityConfigPromise;
}

function loadTurnstile(): Promise<TurnstileApi> {
    if (window.turnstile) return Promise.resolve(window.turnstile);
    if (turnstileScriptPromise) return turnstileScriptPromise;

    let script: HTMLScriptElement | null = null;
    const request = new Promise<TurnstileApi>((resolve, reject) => {
        script = document.createElement('script');
        script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
        script.async = true;
        script.defer = true;
        const timeout = setTimeout(() => { script?.remove(); reject(new Error('Human verification timed out. Please retry.')); }, 12_000);
        script.onload = () => { clearTimeout(timeout); return window.turnstile
            ? resolve(window.turnstile)
            : reject(new Error('Human-verification service did not initialize.')); };
        script.onerror = () => { clearTimeout(timeout); reject(new Error('Unable to load human verification. Check your connection and retry.')); };
        document.head.append(script);
    });
    turnstileScriptPromise = request;
    void request.catch(() => {
        if (turnstileScriptPromise === request) {
            turnstileScriptPromise = null;
            script?.remove();
        }
    });
    return request;
}

/** A cancellable explicit Turnstile widget for room creation or room joining. */
export class RoomAccessChallenge {
    private generation = 0;
    private widgetId: string | number | null = null;
    private container: HTMLElement | null = null;
    private pendingReject: ((reason: Error) => void) | null = null;

    private readonly action: TurnstileAction;
    constructor(action: TurnstileAction) { this.action = action; }

    async requestToken(container: HTMLElement): Promise<string> {
        this.cancel();
        const generation = ++this.generation;
        this.container = container;

        const config = await getSecurityConfig();
        const siteKey = config.turnstileSiteKey;
        if (!config.multiplayerEnabled || !siteKey) {
            throw new Error('Secure multiplayer is unavailable on this deployment.');
        }

        const turnstile = await loadTurnstile();
        if (generation !== this.generation) {
            throw new Error('Room verification was cancelled.');
        }

        container.replaceChildren();
        return new Promise<string>((resolve, reject) => {
            let settled = false;
            const settle = (callback: () => void) => {
                if (settled || generation !== this.generation) return;
                settled = true;
                this.pendingReject = null;
                callback();
            };

            this.pendingReject = (reason) => {
                if (settled) return;
                settled = true;
                reject(reason);
            };
            try {
                this.widgetId = turnstile.render(container, {
                    sitekey: siteKey,
                    action: this.action,
                    theme: 'light',
                    callback: (token) => settle(() => {
                        if (token) resolve(token);
                        else reject(new Error('Human verification did not return a token.'));
                    }),
                    'error-callback': () => settle(() => reject(new Error('Human verification failed. Please retry.'))),
                    'expired-callback': () => settle(() => reject(new Error('Human verification expired. Please retry.'))),
                    'timeout-callback': () => settle(() => reject(new Error('Human verification timed out. Please retry.'))),
                });
            } catch {
                settle(() => reject(new Error('Unable to display human verification. Please retry.')));
            }
        });
    }

    cancel(): void {
        const rejection = this.pendingReject;
        this.pendingReject = null;
        this.generation++;
        if (this.widgetId !== null && window.turnstile?.remove) {
            window.turnstile.remove(this.widgetId);
        }
        this.widgetId = null;
        this.container?.replaceChildren();
        this.container = null;
        rejection?.(new Error('Room verification was cancelled.'));
    }
}

export async function registerTurnRoom(room: string, turnstileToken: string, username: string, peerId: string): Promise<RegisteredHostRoom> {
    const response = await timedFetch('/api/rooms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ room, turnstileToken, username, peerId }),
        cache: 'no-store',
    });
    return validateRegistration(await readJson<RegisteredHostRoom>(response));
}

export async function registerTurnSession(room: string, turnstileToken: string, username: string, peerId: string): Promise<RegisteredTurnSession> {
    const response = await timedFetch('/api/room-sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ room, turnstileToken, username, peerId }),
        cache: 'no-store',
    });
    return validateRegistration(await readJson<RegisteredTurnSession>(response));
}

export async function closeTurnRoom(room: string, closeToken: string): Promise<void> {
    const response = await timedFetch(`/api/rooms/${encodeURIComponent(room)}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${closeToken}` },
        keepalive: true,
        cache: 'no-store',
    });
    if (!response.ok && response.status !== 404) {
        await readJson<unknown>(response);
    }
}

export async function heartbeatTurnRoom(room: string, closeToken: string, peerIds: string[]): Promise<void> {
    const response = await timedFetch(`/api/rooms/${encodeURIComponent(room)}`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${closeToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ peerIds }),
        cache: 'no-store',
    });
    await readJson<unknown>(response);
}

export async function releaseTurnSession(room: string, turnSessionToken: string): Promise<void> {
    const response = await timedFetch(`/api/room-sessions/${encodeURIComponent(room)}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${turnSessionToken}` },
        keepalive: true,
        cache: 'no-store',
    });
    if (!response.ok && response.status !== 404) {
        await readJson<unknown>(response);
    }
}

function isIceServer(value: unknown): value is RTCIceServer {
    if (!value || typeof value !== 'object') return false;
    const server = value as Record<string, unknown>;
    const urls = server.urls;
    const validUrls = typeof urls === 'string'
        ? urls.length > 0
        : Array.isArray(urls) && urls.length > 0 && urls.every((url) => typeof url === 'string' && url.length > 0);
    return validUrls &&
        (server.username === undefined || typeof server.username === 'string') &&
        (server.credential === undefined || typeof server.credential === 'string') &&
        (server.credentialType === undefined || server.credentialType === 'password');
}

export async function fetchTurnIceServers(room: string, turnSessionToken: string): Promise<RTCIceServer[]> {
    const params = new URLSearchParams({ room, session: turnSessionToken });
    const response = await timedFetch(`/api/turn?${params}`, { cache: 'no-store' });
    const payload = await readJson<{ iceServers?: unknown }>(response);
    if (!Array.isArray(payload.iceServers) || payload.iceServers.length === 0 || !payload.iceServers.every(isIceServer)) {
        throw new Error('Secure multiplayer did not return valid relay credentials.');
    }
    return payload.iceServers;
}

function validateRegistration<T extends RegisteredTurnSession>(value: T): T {
    if (!value || !isCapability(value.turnSessionToken) || !isCapability(value.admissionToken) || !isCapability(value.admissionProof) || !Number.isFinite(value.expiresAt) ||
        ('closeToken' in value && !isCapability(value.closeToken))) throw new Error('Invalid room registration.');
    return value;
}
export async function admitRoomPeer(room: string, closeToken: string, peerId: string, admissionToken: string): Promise<{ username: string; admissionProof: string }> {
    return readJson(await timedFetch(`/api/room-admissions/${encodeURIComponent(room)}`, {
        method: 'POST', headers: { Authorization: `Bearer ${closeToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ peerId, admissionToken }),
    }));
}
export async function departRoomPeer(room: string, closeToken: string, peerId: string): Promise<void> {
    const response = await timedFetch(`/api/room-admissions/${encodeURIComponent(room)}`, {
        method: 'DELETE', headers: { Authorization: `Bearer ${closeToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ peerId }), keepalive: true,
    });
    if (!response.ok && response.status !== 404) await readJson(response);
}
