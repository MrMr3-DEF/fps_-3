import test from 'node:test';
import assert from 'node:assert/strict';
import { TurnRoomStateMachine } from '../src/turnRoom.ts';
import { MAX_PLAYERS } from '../src/config.ts';

class MemoryStorage {
    private readonly values = new Map<string, unknown>();
    alarmAt: number | null = null;

    async get<T>(key: string): Promise<T | undefined> {
        return this.values.get(key) as T | undefined;
    }

    async put<T>(key: string, value: T): Promise<void> {
        this.values.set(key, value);
    }

    async setAlarm(time: number): Promise<void> {
        this.alarmAt = time;
    }

    async deleteAll(): Promise<void> {
        this.values.clear();
        this.alarmAt = null;
    }
}

function capability(char: string): string {
    return char.repeat(43);
}

async function call(room: TurnRoomStateMachine, path: string, body?: unknown): Promise<Response> {
    return room.fetch(new Request(`https://turn-room.internal${path}`, {
        method: body === undefined ? 'GET' : 'POST',
        headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
        body: body === undefined ? undefined : JSON.stringify(body),
    }));
}

test('active TURN room caps verified sessions and credential issuance', async () => {
    const storage = new MemoryStorage();
    const room = new TurnRoomStateMachine({ storage }, MAX_PLAYERS);
    const now = Date.now();
    const closeToken = capability('c');
    const hostToken = capability('h');

    const registration = await call(room, '/register', {
        closeToken,
        turnSessionToken: hostToken,
        ip: '203.0.113.8',
        expiresAt: now + 60_000,
        sessionExpiresAt: now + 60_000,
    });
    assert.equal(registration.status, 201);

    for (let index = 0; index < MAX_PLAYERS - 1; index++) {
        const response = await call(room, '/create-session', {
            turnSessionToken: capability(String(index)),
            ip: `203.0.113.${index + 10}`,
            expiresAt: now + 60_000,
        });
        assert.equal(response.status, 201);
    }

    const fullRoom = await call(room, '/create-session', {
        turnSessionToken: capability('z'),
        ip: '203.0.113.99',
        expiresAt: now + 60_000,
    });
    assert.equal(fullRoom.status, 409);

    const firstClaim = await call(room, '/claim-credential', { turnSessionToken: hostToken, ip: '203.0.113.8' });
    const secondClaim = await call(room, '/claim-credential', { turnSessionToken: hostToken, ip: '203.0.113.8' });
    const exhaustedClaim = await call(room, '/claim-credential', { turnSessionToken: hostToken, ip: '203.0.113.8' });
    assert.equal(firstClaim.status, 200);
    assert.equal(secondClaim.status, 200);
    assert.equal(exhaustedClaim.status, 429);

    const mismatchedNetwork = await call(room, '/claim-credential', { turnSessionToken: capability('0'), ip: '198.51.100.1' });
    assert.equal(mismatchedNetwork.status, 403);
});

test('active TURN room requires the close capability and removes all sessions', async () => {
    const storage = new MemoryStorage();
    const room = new TurnRoomStateMachine({ storage }, MAX_PLAYERS);
    const now = Date.now();
    const closeToken = capability('d');

    await call(room, '/register', {
        closeToken,
        turnSessionToken: capability('e'),
        ip: '203.0.113.8',
        expiresAt: now + 60_000,
        sessionExpiresAt: now + 60_000,
    });

    assert.equal((await call(room, '/close', { closeToken: capability('x') })).status, 403);
    assert.equal((await call(room, '/close', { closeToken })).status, 204);
    assert.equal((await call(room, '/authorize')).status, 404);
});
