import { MAX_PLAYERS, ROOM_CODE_LENGTH } from './config.js';
import { TurnRoomStateMachine } from './turnRoom.js';

interface Env {
    TURN_KEY_ID?: string;
    TURN_KEY_API_TOKEN?: string;
    TURNSTILE_SECRET_KEY?: string;
    TURNSTILE_SITE_KEY?: string;
    /** The exact hostname registered for the Turnstile site key. */
    TURNSTILE_HOSTNAME?: string;
    DISABLE_TURN?: string;
    TURN_RATE_LIMITER: DurableObjectNamespace;
    ACTIVE_TURN_ROOM: DurableObjectNamespace;
    ASSETS: {
        fetch: (request: Request) => Promise<Response>;
    };
}

interface RateLimitRequest {
    limit: number;
    windowMs: number;
}

interface RateLimitResponse {
    allowed: boolean;
    retryAfterSeconds: number;
}

interface TurnstileResponse {
    success?: boolean;
    action?: string;
    hostname?: string;
}

interface SerializedIceServer {
    urls: string | string[];
    username?: string;
    credential?: string;
    credentialType?: 'password';
}

const JSON_HEADERS = {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
};
const EMPTY_HEADERS = {
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
};
const ROOM_PATTERN = new RegExp(`^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{${ROOM_CODE_LENGTH}}$`);
const CAPABILITY_PATTERN = /^[A-Za-z0-9_-]{43}$/;
const MAX_JSON_BODY_BYTES = 4_096;
const MAX_TURNSTILE_TOKEN_LENGTH = 2_048;

// A host must actively refresh its room to keep it discoverable. Sessions are
// deliberately much shorter, which constrains a leaked room code/capability.
const ROOM_LIFETIME_MS = 30 * 60 * 1_000;
const TURN_SESSION_LIFETIME_MS = 5 * 60 * 1_000;
const TURN_CREDENTIAL_TTL_SECONDS = 5 * 60;
const TURNSTILE_TIMEOUT_MS = 5_000;

const TURN_REQUEST_LIMIT = 8;
const TURN_REQUEST_WINDOW_MS = 10 * 60 * 1_000;
const ROOM_CREATION_LIMIT = 3;
const ROOM_CREATION_WINDOW_MS = 30 * 60 * 1_000;
const ROOM_JOIN_LIMIT = 6;
const ROOM_JOIN_WINDOW_MS = 10 * 60 * 1_000;

function json(body: unknown, status = 200): Response {
    return new Response(JSON.stringify(body), { status, headers: JSON_HEADERS });
}

function empty(status = 204): Response {
    return new Response(null, { status, headers: EMPTY_HEADERS });
}

function getClientIp(request: Request): string {
    return request.headers.get('CF-Connecting-IP') || 'local';
}

function isConfigured(env: Env): boolean {
    return env.DISABLE_TURN !== 'true' && Boolean(
        env.TURN_KEY_ID && env.TURN_KEY_API_TOKEN && env.TURNSTILE_SECRET_KEY &&
        env.TURNSTILE_SITE_KEY && env.TURNSTILE_HOSTNAME,
    );
}

function normalizeRoomCode(value: unknown): string | null {
    if (typeof value !== 'string') return null;
    const room = value.trim().toUpperCase();
    return ROOM_PATTERN.test(room) ? room : null;
}

function getBearerToken(request: Request): string | null {
    const authorization = request.headers.get('Authorization');
    if (!authorization?.startsWith('Bearer ')) return null;
    const token = authorization.slice('Bearer '.length).trim();
    return CAPABILITY_PATTERN.test(token) ? token : null;
}

function makeCapability(): string {
    const bytes = new Uint8Array(32);
    crypto.getRandomValues(bytes);
    return btoa(String.fromCharCode(...bytes))
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/g, '');
}

async function parseJsonBody<T>(request: Request): Promise<T | null> {
    const contentLength = request.headers.get('Content-Length');
    if (contentLength && (!/^\d+$/.test(contentLength) || Number(contentLength) > MAX_JSON_BODY_BYTES)) {
        return null;
    }

    try {
        const raw = await request.text();
        if (new TextEncoder().encode(raw).byteLength > MAX_JSON_BODY_BYTES) return null;
        return JSON.parse(raw) as T;
    } catch {
        return null;
    }
}

async function consumeRateLimit(
    env: Env,
    scope: string,
    key: string,
    limit: number,
    windowMs: number,
): Promise<RateLimitResponse | null> {
    try {
        const id = env.TURN_RATE_LIMITER.idFromName(`${scope}:${key}`);
        const stub = env.TURN_RATE_LIMITER.get(id);
        const response = await stub.fetch('https://turn-rate-limit.internal/consume', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ limit, windowMs } satisfies RateLimitRequest),
        });
        // A deliberately denied bucket uses HTTP 429; it is still a valid
        // limiter response and must not be mistaken for an infrastructure
        // outage by the public endpoint.
        if (response.status !== 200 && response.status !== 429) return null;
        const result = await response.json() as Partial<RateLimitResponse>;
        return typeof result.allowed === 'boolean' && typeof result.retryAfterSeconds === 'number' && Number.isFinite(result.retryAfterSeconds)
            ? { allowed: result.allowed, retryAfterSeconds: Math.max(0, result.retryAfterSeconds) }
            : null;
    } catch {
        return null;
    }
}

async function verifyTurnstile(
    request: Request,
    env: Env,
    token: unknown,
    expectedAction: 'create-room' | 'join-room',
): Promise<boolean> {
    if (
        typeof token !== 'string' || token.length === 0 || token.length > MAX_TURNSTILE_TOKEN_LENGTH ||
        !env.TURNSTILE_SECRET_KEY || !env.TURNSTILE_HOSTNAME
    ) {
        return false;
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), TURNSTILE_TIMEOUT_MS);
    try {
        const form = new URLSearchParams();
        form.set('secret', env.TURNSTILE_SECRET_KEY);
        form.set('response', token);
        form.set('remoteip', getClientIp(request));

        const verification = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
            method: 'POST',
            body: form,
            signal: controller.signal,
        });
        if (!verification.ok) return false;
        const result = await verification.json() as TurnstileResponse;
        return result.success === true && result.action === expectedAction && result.hostname === env.TURNSTILE_HOSTNAME;
    } catch {
        return false;
    } finally {
        clearTimeout(timeout);
    }
}

function isSerializableIceServer(value: unknown): value is SerializedIceServer {
    if (!value || typeof value !== 'object') return false;
    const candidate = value as Record<string, unknown>;
    const urls = candidate.urls;
    const validUrls = typeof urls === 'string'
        ? urls.length > 0 && urls.length <= 512
        : Array.isArray(urls) && urls.length > 0 && urls.length <= 8 && urls.every((url) => typeof url === 'string' && url.length > 0 && url.length <= 512);
    if (!validUrls) return false;
    return (candidate.username === undefined || (typeof candidate.username === 'string' && candidate.username.length <= 512)) &&
        (candidate.credential === undefined || (typeof candidate.credential === 'string' && candidate.credential.length <= 512)) &&
        (candidate.credentialType === undefined || candidate.credentialType === 'password');
}

function sanitizeIceServers(value: unknown): SerializedIceServer[] | null {
    if (!Array.isArray(value) || value.length === 0 || value.length > 8 || !value.every(isSerializableIceServer)) {
        return null;
    }
    return value.map((server) => ({
        urls: server.urls,
        ...(server.username === undefined ? {} : { username: server.username }),
        ...(server.credential === undefined ? {} : { credential: server.credential }),
        ...(server.credentialType === undefined ? {} : { credentialType: server.credentialType }),
    }));
}

async function registerRoom(request: Request, env: Env): Promise<Response> {
    if (!isConfigured(env)) {
        return json({ error: 'Secure multiplayer is not configured on this deployment.' }, 503);
    }

    const rate = await consumeRateLimit(
        env,
        'room-create',
        getClientIp(request),
        ROOM_CREATION_LIMIT,
        ROOM_CREATION_WINDOW_MS,
    );
    if (!rate) return json({ error: 'Room protection is temporarily unavailable. Please retry.' }, 503);
    if (!rate.allowed) {
        return json({ error: 'Too many room creation attempts. Please try again later.', retryAfterSeconds: rate.retryAfterSeconds }, 429);
    }

    const body = await parseJsonBody<{ room?: unknown; turnstileToken?: unknown }>(request);
    if (!body) return json({ error: 'Expected a small JSON room registration request.' }, 400);
    const room = normalizeRoomCode(body.room);
    if (!room) return json({ error: `Room code must be ${ROOM_CODE_LENGTH} unambiguous characters.` }, 400);
    if (!await verifyTurnstile(request, env, body.turnstileToken, 'create-room')) {
        return json({ error: 'Human verification failed. Please complete the challenge and retry.' }, 403);
    }

    const closeToken = makeCapability();
    const turnSessionToken = makeCapability();
    try {
        const stub = env.ACTIVE_TURN_ROOM.get(env.ACTIVE_TURN_ROOM.idFromName(room));
        const registration = await stub.fetch('https://turn-room.internal/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                closeToken,
                turnSessionToken,
                ip: getClientIp(request),
                expiresAt: Date.now() + ROOM_LIFETIME_MS,
                sessionExpiresAt: Date.now() + TURN_SESSION_LIFETIME_MS,
            }),
        });
        if (registration.status === 409) {
            return json({ error: 'This room code is already active. Generate a new code and retry.' }, 409);
        }
        if (!registration.ok) return json({ error: 'Unable to register the room. Please retry.' }, 503);
        const result = await registration.json() as { expiresAt?: unknown };
        if (typeof result.expiresAt !== 'number') return json({ error: 'Unable to register the room. Please retry.' }, 503);
        return json({ closeToken, turnSessionToken, expiresAt: result.expiresAt }, 201);
    } catch {
        return json({ error: 'Unable to register the room. Please retry.' }, 503);
    }
}

async function createJoinSession(request: Request, env: Env): Promise<Response> {
    if (!isConfigured(env)) {
        return json({ error: 'Secure multiplayer is not configured on this deployment.' }, 503);
    }

    const rate = await consumeRateLimit(
        env,
        'room-join',
        getClientIp(request),
        ROOM_JOIN_LIMIT,
        ROOM_JOIN_WINDOW_MS,
    );
    if (!rate) return json({ error: 'Room protection is temporarily unavailable. Please retry.' }, 503);
    if (!rate.allowed) {
        return json({ error: 'Too many room join attempts. Please try again later.', retryAfterSeconds: rate.retryAfterSeconds }, 429);
    }

    const body = await parseJsonBody<{ room?: unknown; turnstileToken?: unknown }>(request);
    if (!body) return json({ error: 'Expected a small JSON room join request.' }, 400);
    const room = normalizeRoomCode(body.room);
    if (!room) return json({ error: `Room code must be ${ROOM_CODE_LENGTH} unambiguous characters.` }, 400);
    if (!await verifyTurnstile(request, env, body.turnstileToken, 'join-room')) {
        return json({ error: 'Human verification failed. Please complete the challenge and retry.' }, 403);
    }

    const turnSessionToken = makeCapability();
    try {
        const stub = env.ACTIVE_TURN_ROOM.get(env.ACTIVE_TURN_ROOM.idFromName(room));
        const session = await stub.fetch('https://turn-room.internal/create-session', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                turnSessionToken,
                ip: getClientIp(request),
                expiresAt: Date.now() + TURN_SESSION_LIFETIME_MS,
            }),
        });
        if (session.status === 404) return json({ error: 'This room is not active or has expired.' }, 404);
        if (session.status === 409) return json({ error: 'This room is full.' }, 409);
        if (!session.ok) return json({ error: 'Unable to authorize this room. Please retry.' }, 503);
        const result = await session.json() as { expiresAt?: unknown };
        if (typeof result.expiresAt !== 'number') return json({ error: 'Unable to authorize this room. Please retry.' }, 503);
        return json({ turnSessionToken, expiresAt: result.expiresAt }, 201);
    } catch {
        return json({ error: 'Unable to authorize this room. Please retry.' }, 503);
    }
}

async function closeRoom(request: Request, env: Env, room: string): Promise<Response> {
    const token = getBearerToken(request);
    if (!token) return json({ error: 'Missing room close capability.' }, 401);

    try {
        const stub = env.ACTIVE_TURN_ROOM.get(env.ACTIVE_TURN_ROOM.idFromName(room));
        const response = await stub.fetch('https://turn-room.internal/close', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ closeToken: token }),
        });
        if (response.status === 403) return json({ error: 'Invalid room close capability.' }, 403);
        if (response.status === 204 || response.status === 404) return empty();
        return json({ error: 'Unable to close the room. Please retry.' }, 503);
    } catch {
        return json({ error: 'Unable to close the room. Please retry.' }, 503);
    }
}

async function heartbeatRoom(request: Request, env: Env, room: string): Promise<Response> {
    const token = getBearerToken(request);
    if (!token) return json({ error: 'Missing room heartbeat capability.' }, 401);

    try {
        const stub = env.ACTIVE_TURN_ROOM.get(env.ACTIVE_TURN_ROOM.idFromName(room));
        const response = await stub.fetch('https://turn-room.internal/heartbeat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ closeToken: token, expiresAt: Date.now() + ROOM_LIFETIME_MS }),
        });
        if (response.status === 403) return json({ error: 'Invalid room heartbeat capability.' }, 403);
        if (response.status === 404) return json({ error: 'This room is not active or has expired.' }, 404);
        if (!response.ok) return json({ error: 'Unable to refresh the room. Please retry.' }, 503);
        const result = await response.json() as { expiresAt?: unknown };
        return typeof result.expiresAt === 'number'
            ? json({ expiresAt: result.expiresAt })
            : json({ error: 'Unable to refresh the room. Please retry.' }, 503);
    } catch {
        return json({ error: 'Unable to refresh the room. Please retry.' }, 503);
    }
}

async function releaseJoinSession(request: Request, env: Env, room: string): Promise<Response> {
    const token = getBearerToken(request);
    if (!token) return json({ error: 'Missing room-session capability.' }, 401);

    try {
        const stub = env.ACTIVE_TURN_ROOM.get(env.ACTIVE_TURN_ROOM.idFromName(room));
        const response = await stub.fetch('https://turn-room.internal/release-session', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ turnSessionToken: token }),
        });
        return response.ok || response.status === 404
            ? empty()
            : json({ error: 'Unable to release the room session.' }, 503);
    } catch {
        return json({ error: 'Unable to release the room session.' }, 503);
    }
}

async function issueTurnCredentials(request: Request, env: Env, room: string): Promise<Response> {
    if (!isConfigured(env)) {
        return json({ error: 'Secure multiplayer is not configured on this deployment.' }, 503);
    }
    const turnSessionToken = requestUrlCapability(request, 'session');
    if (!turnSessionToken) return json({ error: 'Missing or invalid room-session capability.' }, 401);

    const rate = await consumeRateLimit(
        env,
        'turn-credentials',
        getClientIp(request),
        TURN_REQUEST_LIMIT,
        TURN_REQUEST_WINDOW_MS,
    );
    if (!rate) return json({ error: 'Room protection is temporarily unavailable. Please retry.' }, 503);
    if (!rate.allowed) {
        return json({ error: 'Too many credential requests. Please retry later.', retryAfterSeconds: rate.retryAfterSeconds }, 429);
    }

    try {
        const roomStub = env.ACTIVE_TURN_ROOM.get(env.ACTIVE_TURN_ROOM.idFromName(room));
        const claim = await roomStub.fetch('https://turn-room.internal/claim-credential', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ turnSessionToken, ip: getClientIp(request) }),
        });
        if (claim.status === 404) return json({ error: 'This room session is not active or has expired.' }, 404);
        if (claim.status === 403) return json({ error: 'This room-session capability is not valid for this network.' }, 403);
        if (claim.status === 429) return json({ error: 'This room-session capability has no relay requests remaining.' }, 429);
        if (!claim.ok) return json({ error: 'Unable to authorize relay credentials. Please retry.' }, 503);
    } catch {
        return json({ error: 'Unable to authorize relay credentials. Please retry.' }, 503);
    }

    try {
        const cfResponse = await fetch(
            `https://rtc.live.cloudflare.com/v1/turn/keys/${encodeURIComponent(env.TURN_KEY_ID!)}/credentials/generate-ice-servers`,
            {
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${env.TURN_KEY_API_TOKEN!}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ ttl: TURN_CREDENTIAL_TTL_SECONDS }),
            },
        );
        if (!cfResponse.ok) {
            console.error('Cloudflare TURN credential request failed:', cfResponse.status);
            return json({ error: 'Unable to issue relay credentials. Please retry.' }, 503);
        }
        const payload = await cfResponse.json() as { iceServers?: unknown };
        const iceServers = sanitizeIceServers(payload.iceServers);
        if (!iceServers) {
            console.error('Cloudflare TURN credential request returned invalid server data.');
            return json({ error: 'Unable to issue relay credentials. Please retry.' }, 503);
        }
        return json({ iceServers });
    } catch {
        console.error('Cloudflare TURN credential request threw.');
        return json({ error: 'Unable to issue relay credentials. Please retry.' }, 503);
    }
}

function requestUrlCapability(request: Request, name: string): string | null {
    const token = new URL(request.url).searchParams.get(name);
    return token && CAPABILITY_PATTERN.test(token) ? token : null;
}

export class TurnRateLimiter {
    private readonly state: DurableObjectState;

    constructor(state: DurableObjectState) {
        this.state = state;
    }

    async fetch(request: Request): Promise<Response> {
        if (request.method !== 'POST') return json({ error: 'Method not allowed.' }, 405);
        const body = await parseJsonBody<Partial<RateLimitRequest>>(request);
        if (!body) return json({ error: 'Invalid rate limit request.' }, 400);
        const limit = Number(body.limit);
        const windowMs = Number(body.windowMs);
        if (!Number.isInteger(limit) || limit < 1 || !Number.isInteger(windowMs) || windowMs < 1_000) {
            return json({ error: 'Invalid rate limit request.' }, 400);
        }

        const now = Date.now();
        const current = await this.state.storage.get<{ startedAt: number; count: number }>('bucket');
        const reset = !current || now - current.startedAt >= windowMs;
        const bucket = reset ? { startedAt: now, count: 0 } : current;
        const retryAfterSeconds = Math.max(1, Math.ceil((bucket.startedAt + windowMs - now) / 1_000));

        if (bucket.count >= limit) {
            return json({ allowed: false, retryAfterSeconds } satisfies RateLimitResponse, 429);
        }

        bucket.count += 1;
        await this.state.storage.put('bucket', bucket);
        await this.state.storage.setAlarm(bucket.startedAt + windowMs);
        return json({ allowed: true, retryAfterSeconds: 0 } satisfies RateLimitResponse);
    }

    async alarm(): Promise<void> {
        await this.state.storage.deleteAll();
    }
}

export class ActiveTurnRoom extends TurnRoomStateMachine {
    constructor(state: DurableObjectState) {
        super(state, MAX_PLAYERS);
    }
}

export default {
    async fetch(request: Request, env: Env): Promise<Response> {
        const url = new URL(request.url);

        if (url.pathname === '/api/security-config' && request.method === 'GET') {
            const enabled = isConfigured(env);
            return json({
                multiplayerEnabled: enabled,
                turnstileSiteKey: enabled ? env.TURNSTILE_SITE_KEY : null,
                roomCodeLength: ROOM_CODE_LENGTH,
            });
        }

        if (url.pathname === '/api/rooms' && request.method === 'POST') {
            return registerRoom(request, env);
        }

        if (url.pathname === '/api/room-sessions' && request.method === 'POST') {
            return createJoinSession(request, env);
        }

        if (url.pathname.startsWith('/api/rooms/')) {
            const room = normalizeRoomCode(url.pathname.slice('/api/rooms/'.length));
            if (!room) return json({ error: 'Invalid room code.' }, 400);
            if (request.method === 'DELETE') return closeRoom(request, env, room);
            if (request.method === 'PATCH') return heartbeatRoom(request, env, room);
            return json({ error: 'Method not allowed.' }, 405);
        }

        if (url.pathname.startsWith('/api/room-sessions/')) {
            const room = normalizeRoomCode(url.pathname.slice('/api/room-sessions/'.length));
            if (!room) return json({ error: 'Invalid room code.' }, 400);
            return request.method === 'DELETE'
                ? releaseJoinSession(request, env, room)
                : json({ error: 'Method not allowed.' }, 405);
        }

        if (url.pathname === '/api/turn') {
            if (request.method !== 'GET') return json({ error: 'Method not allowed.' }, 405);
            const room = normalizeRoomCode(url.searchParams.get('room'));
            return room ? issueTurnCredentials(request, env, room) : json({ error: 'Invalid room code.' }, 400);
        }

        return env.ASSETS.fetch(request);
    },
};
