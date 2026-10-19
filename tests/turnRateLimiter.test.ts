import test from 'node:test';
import assert from 'node:assert/strict';
import { TurnRateLimiter } from '../src/worker.ts';

test('a delayed old alarm retains a renewed rate window and reschedules its real expiry', async t => {
    let now = 100_000;
    t.mock.method(Date, 'now', () => now);
    let stored: any, alarmAt = 0;
    const storage = {
        async get() { return structuredClone(stored); },
        async put(_key: string, value: any) { stored = structuredClone(value); },
        async setAlarm(time: number) { alarmAt = time; },
        async deleteAll() { stored = undefined; alarmAt = 0; },
    };
    const limiter = new TurnRateLimiter({ storage } as any);
    const claim = () => limiter.fetch(new Request('https://limiter', { method: 'POST', body: JSON.stringify({ limit: 1, windowMs: 10_000 }) }));
    assert.equal((await claim()).status, 200);
    now += 10_001;
    assert.equal((await claim()).status, 200);
    await limiter.alarm();
    assert.equal((await claim()).status, 429);
    assert.equal(alarmAt, now + 10_000);
    now += 10_000;
    await limiter.alarm(); assert.equal(stored, undefined);
    assert.equal((await claim()).status, 200);
    stored = { startedAt: 1, count: 1 }; // Pre-upgrade buckets have no expiry.
    await limiter.alarm(); assert.equal(stored, undefined);
});
