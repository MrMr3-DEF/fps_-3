import { parseJsonBody } from './boundedJson.js';
import { isCapability, isPeerId, isUsername, usernameKey } from './roomIdentity.js';

export interface TurnRoomStorage {
    get<T>(key: string): Promise<T | undefined>;
    put<T>(key: string, value: T): Promise<void>;
    setAlarm(time: number): Promise<void>;
    deleteAll(): Promise<void>;
}
export interface TurnRoomState { storage: TurnRoomStorage; }
interface Session {
    ip: string; expiresAt: number; credentialIssues: number; credentialWindow: number;
    username: string; peerId: string; admissionToken: string; admissionProof: string; admitted: boolean;
}
interface RoomRecord { expiresAt: number; closeToken: string; hostPeerId: string; sessions: Record<string, Session>; }
const SESSION_MS = 5 * 60_000;
const headers = { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' };
function json(body: unknown, status = 200): Response { return new Response(JSON.stringify(body), { status, headers }); }
function empty(): Response { return new Response(null, { status: 204, headers }); }
function future(value: unknown): value is number { return typeof value === 'number' && Number.isFinite(value) && value > Date.now(); }
type Body = Record<string, unknown>;
function validSession(body: Body): boolean {
    return isCapability(body.turnSessionToken) && isCapability(body.admissionToken) && isCapability(body.admissionProof) &&
        isUsername(body.username) && isPeerId(body.peerId) && typeof body.ip === 'string' && body.ip.length > 0 && body.ip.length <= 128;
}
function session(body: Body, expiresAt: number, admitted: boolean): Session {
    return { ip: body.ip as string, username: body.username as string, peerId: body.peerId as string,
        admissionToken: body.admissionToken as string, admissionProof: body.admissionProof as string,
        expiresAt, admitted, credentialIssues: 0, credentialWindow: Date.now() };
}

/** Parse outside the queue; serialize every storage read/check/write, including alarms. */
export class TurnRoomStateMachine {
    private readonly state: TurnRoomState;
    private readonly maxPlayers: number;
    private tail: Promise<unknown> = Promise.resolve();
    constructor(state: TurnRoomState, maxPlayers: number) { this.state = state; this.maxPlayers = maxPlayers; }
    private serialized<T>(operation: () => Promise<T>): Promise<T> {
        const result = this.tail.then(operation);
        this.tail = result.catch(() => {});
        return result;
    }
    async fetch(request: Request): Promise<Response> {
        const body = request.method === 'POST' ? await parseJsonBody<Body>(request) : {};
        if (!body) return json({ error: 'Expected a small JSON object.' }, 400);
        return this.serialized(() => this.handle(new URL(request.url).pathname, request.method, body));
    }
    private async handle(path: string, method: string, body: Body): Promise<Response> {
        const record = await this.readActiveRecord();
        if (path === '/authorize') return record ? json({ active: true, expiresAt: record.expiresAt }) : json({ error: 'Room is inactive.' }, 404);
        if (method !== 'POST') return json({ error: 'Method not allowed.' }, 405);
        if (path === '/register') {
            if (record) return json({ error: 'Room is already active.' }, 409);
            if (!validSession(body) || !isCapability(body.closeToken) || !future(body.expiresAt) || !future(body.sessionExpiresAt)) return json({ error: 'Invalid room registration.' }, 400);
            const next: RoomRecord = { closeToken: body.closeToken, expiresAt: body.expiresAt, hostPeerId: body.peerId as string,
                sessions: { [body.turnSessionToken as string]: session(body, Math.min(body.expiresAt, body.sessionExpiresAt), true) } };
            await this.state.storage.put('room', next);
            await this.state.storage.setAlarm(next.expiresAt);
            return json({ expiresAt: next.expiresAt }, 201);
        }
        if (!record) return json({ error: 'Room is inactive.' }, 404);
        if (path === '/create-session') {
            if (!validSession(body) || !future(body.expiresAt)) return json({ error: 'Invalid room session.' }, 400);
            const sessions = Object.values(record.sessions);
            if (sessions.some(s => usernameKey(s.username) === usernameKey(body.username as string))) return json({ error: 'That username is already in this lobby. Choose another name.' }, 409);
            if (sessions.some(s => s.peerId === body.peerId)) return json({ error: 'Peer is already in this lobby.' }, 409);
            if (sessions.length >= this.maxPlayers) return json({ error: 'Room is full.' }, 409);
            record.sessions[body.turnSessionToken as string] = session(body, Math.min(record.expiresAt, body.expiresAt), false);
            await this.state.storage.put('room', record);
            return json({ expiresAt: body.expiresAt }, 201);
        }
        if (path === '/admit' || path === '/depart') {
            if (body.closeToken !== record.closeToken || !isPeerId(body.peerId) || body.peerId === record.hostPeerId) return json({ error: 'Invalid host capability or peer.' }, 403);
            const entry = Object.entries(record.sessions).find(([, s]) => s.peerId === body.peerId);
            if (!entry) return json({ error: 'Room session is inactive.' }, 404);
            const [token, s] = entry;
            if (path === '/depart') { delete record.sessions[token]; await this.state.storage.put('room', record); return empty(); }
            if (s.admitted || !isCapability(body.admissionToken) || s.admissionToken !== body.admissionToken) return json({ error: 'Invalid or used admission ticket.' }, 403);
            s.admitted = true;
            s.expiresAt = Math.min(record.expiresAt, Date.now() + SESSION_MS);
            await this.state.storage.put('room', record);
            return json({ username: s.username, admissionProof: s.admissionProof });
        }
        if (path === '/claim-credential') {
            if (!isCapability(body.turnSessionToken)) return json({ error: 'Invalid room-session capability.' }, 400);
            const s = record.sessions[body.turnSessionToken];
            if (!s || s.expiresAt <= Date.now()) return json({ error: 'Room session is inactive.' }, 404);
            if (s.ip !== body.ip) return json({ error: 'Room session network mismatch.' }, 403);
            if (Date.now() - s.credentialWindow >= SESSION_MS) { s.credentialWindow = Date.now(); s.credentialIssues = 0; }
            if (s.credentialIssues >= 2) return json({ error: 'Room session exhausted.' }, 429);
            s.credentialIssues++;
            await this.state.storage.put('room', record);
            return json({ allowed: true });
        }
        if (path === '/release-session') {
            if (!isCapability(body.turnSessionToken)) return json({ error: 'Invalid room-session capability.' }, 400);
            delete record.sessions[body.turnSessionToken];
            await this.state.storage.put('room', record);
            return empty();
        }
        if (path === '/heartbeat') {
            if (body.closeToken !== record.closeToken || !future(body.expiresAt) || !Array.isArray(body.peerIds) || body.peerIds.length > this.maxPlayers || !body.peerIds.every(isPeerId)) return json({ error: 'Invalid room heartbeat.' }, 403);
            record.expiresAt = body.expiresAt;
            for (const [token, s] of Object.entries(record.sessions)) {
                if (!s.admitted) continue;
                if (s.peerId !== record.hostPeerId && !body.peerIds.includes(s.peerId)) delete record.sessions[token];
                else s.expiresAt = Math.min(record.expiresAt, Date.now() + SESSION_MS);
            }
            await this.state.storage.put('room', record);
            await this.state.storage.setAlarm(record.expiresAt);
            return json({ expiresAt: record.expiresAt });
        }
        if (path === '/close') {
            if (body.closeToken !== record.closeToken) return json({ error: 'Invalid close capability.' }, 403);
            await this.state.storage.deleteAll(); return empty();
        }
        return json({ error: 'Not found.' }, 404);
    }
    async alarm(): Promise<void> {
        await this.serialized(async () => {
            const record = await this.readActiveRecord();
            if (record) await this.state.storage.setAlarm(record.expiresAt);
        });
    }
    private async readActiveRecord(): Promise<RoomRecord | null> {
        const record = await this.state.storage.get<RoomRecord>('room');
        if (!record) return null;
        // Fail closed for rooms created by the older protocol.
        if (record.expiresAt <= Date.now() || !record.hostPeerId) { await this.state.storage.deleteAll(); return null; }
        let changed = false;
        for (const [token, s] of Object.entries(record.sessions)) {
            if (!s || (!s.admitted && s.expiresAt <= Date.now())) { delete record.sessions[token]; changed = true; }
        }
        if (changed) await this.state.storage.put('room', record);
        return record;
    }
}
