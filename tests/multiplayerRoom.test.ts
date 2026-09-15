import test from 'node:test';
import assert from 'node:assert/strict';
import { Worker } from 'node:worker_threads';

test('BinaryPack room: visibility, every weapon in both directions, respawns and C health', { timeout: 15000 }, async () => {
    const queue: { target: number; packet: any }[] = [];
    const workers = [0, 1].map(() => new Worker(new URL('./roomPeer.worker.ts', import.meta.url)));
    let nextId = 0;
    const pending = new Map<number, { resolve: (value: any) => void; reject: (error: Error) => void }>();
    workers.forEach((worker, index) => worker.on('message', message => {
        if (message.packet) queue.push({ target: 1 - index, packet: message.packet });
        else {
            const call = pending.get(message.id)!; pending.delete(message.id);
            if (message.error) call.reject(new Error(message.error)); else call.resolve(message.result);
        }
    }));
    const call = (index: number, command: string, args: any = {}) => new Promise<any>((resolve, reject) => {
        const id = ++nextId; pending.set(id, { resolve, reject }); workers[index].postMessage({ id, command, args });
    });
    const flush = async () => { while (queue.length) { const next = queue.shift()!; await call(next.target, 'receive', next.packet); } };
    const tick = async () => { await call(0, 'tick', { delta: 0.05 }); await call(1, 'tick', { delta: 0.05 }); await flush(); };
    try {
        const host = await call(0, 'init', { host: true });
        const guest = await call(1, 'init', { host: false });
        await call(0, 'connect', guest); await flush();
        await call(0, 'arena'); await call(1, 'arena');
        await call(0, 'start'); await flush();
        await call(0, 'pose', { z: 10, yaw: 0 }); await call(1, 'pose', { z: -10, yaw: Math.PI }); await flush();
        for (let i = 0; i < 15; i++) await tick();
        assert.equal((await call(0, 'state')).peers[guest.peerId].visible, true);
        assert.equal((await call(1, 'state')).peers[host.peerId].visible, true);
        await call(0, 'shoot', { weapon: 'PISTOL' }); await flush();
        for (let i = 0; i < 3; i++) await tick();
        assert.equal((await call(1, 'state')).hp, 9, 'host pistol damages guest');
        assert.equal((await call(0, 'state')).peers[guest.peerId].hp, 9, 'host inspection agrees with guest health');
        await call(1, 'shoot', { weapon: 'PISTOL' }); await flush();
        for (let i = 0; i < 3; i++) await tick();
        assert.equal((await call(0, 'state')).hp, 9, 'guest pistol damages host');
        assert.equal((await call(1, 'state')).peers[host.peerId].hp, 9, 'guest inspection agrees with host health');
        assert.deepEqual(await call(0, 'inspect'), ['HEALTH 9 / 10']);
        assert.deepEqual(await call(1, 'inspect'), ['HEALTH 9 / 10']);
        await call(1, 'recover'); await flush();
        assert.deepEqual(await call(0, 'inspect'), ['HEALTH 10 / 10'], 'C updates on confirmed regeneration');
        for (const weapon of ['AR', 'SHOTGUN', 'MINIGUN', 'SNIPER']) {
            for (const shooter of [0, 1]) {
                if (weapon === 'MINIGUN') { await call(shooter, 'trigger'); await flush(); }
                for (let i = 0; i < 65; i++) await tick();
                const victim = 1 - shooter;
                const before = await call(victim, 'state');
                await call(shooter, 'shoot', { weapon }); await flush();
                if (weapon === 'SNIPER') {
                    assert.equal((await call(victim, 'state')).hp, 0, 'hitscan is applied without a victim render tick');
                    const victimId = victim === 0 ? host.peerId : guest.peerId;
                    assert.equal((await call(shooter, 'state')).peers[victimId].hp, 0, 'victim immediately confirms lethal health');
                }
                for (let i = 0; i < 3; i++) await tick();
                const after = await call(victim, 'state');
                assert.ok(after.hp < before.hp, `${weapon} from player ${shooter} deals damage`);
                const victimId = victim === 0 ? host.peerId : guest.peerId;
                assert.equal((await call(shooter, 'state')).peers[victimId].hp, after.hp);
                if (after.hp > 0) assert.deepEqual(await call(shooter, 'inspect'), [`HEALTH ${after.hp} / 10`]);
                else {
                    assert.equal((await call(shooter, 'state')).peers[victimId].visible, false);
                    await call(victim, 'respawn'); await flush();
                    assert.equal((await call(shooter, 'state')).peers[victimId].visible, true);
                    assert.equal((await call(shooter, 'state')).peers[victimId].hp, 10);
                }
            }
        }
    } finally { await Promise.all(workers.map(w => w.terminate())); }
});
