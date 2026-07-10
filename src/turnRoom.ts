/**
 * Minimal storage surface shared by the Cloudflare Durable Object and unit
 * tests. Keeping the room state machine independent of Worker bindings makes
 * the quota/capability rules directly testable.
 */
export interface TurnRoomStorage {
    get<T>(key: string): Promise<T | undefined>;
    put<T>(key: string, value: T): Promise<void>;
    setAlarm(time: number): Promise<void>;
    deleteAll(): Promise<void>;
}

export interface TurnRoomState {
    storage: TurnRoomStorage;
}

interface TurnSessionRecord {
    ip: string;
    expiresAt: number;
    credentialIssues: number;
}

interface RoomRecord {
    expiresAt: number;
    closeToken: string;
    sessions: Record<string, TurnSessionRecord>;
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
const CAPABILITY_PATTERN = /^[A-Za-z0-9_-]{43}$/;
const MAX_JSON_BODY_BYTES = 4_096;
const MAX_CREDENTIALS_PER_SESSION = 2;

function json(body: unknown, status = 200): Response {
    return new Response(JSON.stringify(body), { status, headers: JSON_HEADERS });
}

function empty(status = 204): Response {
    return new Response(null, { status, headers: EMPTY_HEADERS });
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

function isCapability(value: unknown): value is string {
    return typeof value === 'string' && CAPABILITY_PATTERN.test(value);
}

function isIp(value: unknown): value is string {
    return typeof value === 'string' && value.length > 0 && value.length <= 128;
}

export class TurnRoomStateMachine {
    private readonly state: TurnRoomState;
    private readonly maxPlayers: number;

    constructor(state: TurnRoomState, maxPlayers: number) {
        this.state = state;
        this.maxPlayers = maxPlayers;
    }

    async fetch(request: Request): Promise<Response> {
        const path = new URL(request.url).pathname;
        const record = await this.readActiveRecord();

        if (path === '/authorize') {
            return record ? json({ active: true, expiresAt: record.expiresAt }) : json({ error: 'Room is inactive.' }, 404);
        }

        if (path === '/register' && request.method === 'POST') {
            if (record) return json({ error: 'Room is already active.' }, 409);
            const body = await parseJsonBody<{
                closeToken?: unknown;
                turnSessionToken?: unknown;
                ip?: unknown;
                expiresAt?: unknown;
                sessionExpiresAt?: unknown;
            }>(request);
            const expiresAt = typeof body?.expiresAt === 'number' ? body.expiresAt : Number.NaN;
            const sessionExpiresAt = typeof body?.sessionExpiresAt === 'number' ? body.sessionExpiresAt : Number.NaN;
            if (
                !body || !isCapability(body.closeToken) || !isCapability(body.turnSessionToken) || !isIp(body.ip) ||
                !Number.isFinite(expiresAt) || !Number.isFinite(sessionExpiresAt) ||
                expiresAt <= Date.now() || sessionExpiresAt <= Date.now()
            ) {
                return json({ error: 'Invalid room registration.' }, 400);
            }
            const next: RoomRecord = {
                closeToken: body.closeToken,
                expiresAt,
                sessions: {
                    [body.turnSessionToken]: {
                        ip: body.ip,
                        expiresAt: sessionExpiresAt,
                        credentialIssues: 0,
                    },
                },
            };
            await this.state.storage.put('room', next);
            await this.state.storage.setAlarm(next.expiresAt);
            return json({ expiresAt: next.expiresAt }, 201);
        }

        if (!record) return json({ error: 'Room is inactive.' }, 404);

        if (path === '/create-session' && request.method === 'POST') {
            const body = await parseJsonBody<{ turnSessionToken?: unknown; ip?: unknown; expiresAt?: unknown }>(request);
            const expiresAt = typeof body?.expiresAt === 'number' ? body.expiresAt : Number.NaN;
            if (!body || !isCapability(body.turnSessionToken) || !isIp(body.ip) || !Number.isFinite(expiresAt) || expiresAt <= Date.now()) {
                return json({ error: 'Invalid room session.' }, 400);
            }
            if (Object.keys(record.sessions).length >= this.maxPlayers) {
                return json({ error: 'Room is full.' }, 409);
            }
            record.sessions[body.turnSessionToken] = { ip: body.ip, expiresAt, credentialIssues: 0 };
            await this.state.storage.put('room', record);
            return json({ expiresAt }, 201);
        }

        if (path === '/claim-credential' && request.method === 'POST') {
            const body = await parseJsonBody<{ turnSessionToken?: unknown; ip?: unknown }>(request);
            if (!body || !isCapability(body.turnSessionToken) || !isIp(body.ip)) {
                return json({ error: 'Invalid room-session capability.' }, 400);
            }
            const session = record.sessions[body.turnSessionToken];
            if (!session) return json({ error: 'Room session is inactive.' }, 404);
            if (session.ip !== body.ip) return json({ error: 'Room session network mismatch.' }, 403);
            if (session.credentialIssues >= MAX_CREDENTIALS_PER_SESSION) {
                return json({ error: 'Room session exhausted.' }, 429);
            }
            session.credentialIssues++;
            await this.state.storage.put('room', record);
            return json({ allowed: true });
        }

        if (path === '/release-session' && request.method === 'POST') {
            const body = await parseJsonBody<{ turnSessionToken?: unknown }>(request);
            if (!body || !isCapability(body.turnSessionToken)) return json({ error: 'Invalid room-session capability.' }, 400);
            delete record.sessions[body.turnSessionToken];
            await this.state.storage.put('room', record);
            return empty();
        }

        if (path === '/heartbeat' && request.method === 'POST') {
            const body = await parseJsonBody<{ closeToken?: unknown; expiresAt?: unknown }>(request);
            const expiresAt = typeof body?.expiresAt === 'number' ? body.expiresAt : Number.NaN;
            if (!body || body.closeToken !== record.closeToken || !Number.isFinite(expiresAt) || expiresAt <= Date.now()) {
                return json({ error: 'Invalid room heartbeat.' }, 403);
            }
            record.expiresAt = expiresAt;
            await this.state.storage.put('room', record);
            await this.state.storage.setAlarm(record.expiresAt);
            return json({ expiresAt: record.expiresAt });
        }

        if (path === '/close' && request.method === 'POST') {
            const body = await parseJsonBody<{ closeToken?: unknown }>(request);
            if (!body || body.closeToken !== record.closeToken) return json({ error: 'Invalid close capability.' }, 403);
            await this.state.storage.deleteAll();
            return empty();
        }

        return json({ error: 'Not found.' }, 404);
    }

    async alarm(): Promise<void> {
        await this.state.storage.deleteAll();
    }

    private async readActiveRecord(): Promise<RoomRecord | null> {
        const record = await this.state.storage.get<RoomRecord>('room');
        if (!record) return null;
        if (record.expiresAt <= Date.now()) {
            await this.state.storage.deleteAll();
            return null;
        }

        let changed = false;
        const sessions = record.sessions || {};
        for (const [token, session] of Object.entries(sessions)) {
            if (!session || session.expiresAt <= Date.now()) {
                delete sessions[token];
                changed = true;
            }
        }
        if (record.sessions !== sessions) {
            record.sessions = sessions;
            changed = true;
        }
        if (changed) await this.state.storage.put('room', record);
        return record;
    }
}
