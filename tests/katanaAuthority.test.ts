import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { state } from '../src/state.ts';
import { acceptMeleeCommand, updateKatana, resetKatana, invalidateMeleePeer, receiveMeleeEvent } from '../src/katana.ts';
import { setMeleeNetworkPort } from '../src/weaponNetworkPort.ts';
function fixture() {
    resetKatana();
    state.isPlaying = true;
    state.matchEnded = false;
    state.isMultiplayer = true;
    state.isHost = true;
    state.playerHp = 0;
    state.targets = [];
    state.peer = { id: 'host' } as any;
    const attacker = { id: 'attacker', lifeId: 1, alive: true, ready: true, name: 'Attacker', position: new THREE.Vector3(0, 2, 0), yaw: 0, pitch: 0 };
    const victim = { ...attacker, id: 'victim', name: 'Victim', position: new THREE.Vector3(0, 2, -1.7) };
    const far = { ...victim, id: 'far', position: new THREE.Vector3(0, 2, -5) };
    let players = [attacker, victim, far], blocked = false, ready = true, reserved = 0;
    const hits: Array<{
        id: string;
        damage: number;
    }> = [], events: any[] = [];
    setMeleeNetworkPort({ players: () => players, ready: () => ready, reserve: () => { reserved++; }, sendCommand: () => { }, emit: e => events.push(e), confirmHit: () => {},
        blocked: () => blocked, hitPlayer: (p, a, damage) => hits.push({ id: p.id, damage }), hitTarget: (index, damage) => hits.push({ id: `npc:${index}`, damage }), hitMecha: () => false });
    let seq = 0;
    const command = (action: 'start' | 'release' | 'cancel', fields = {}) => acceptMeleeCommand(attacker.id, { type: 'melee_command', action, sequence: ++seq, lifeId: 1, ...fields });
    return { attacker, victim, far, hits, events, command, block: (value: boolean) => blocked = value, ready: (value: boolean) => ready = value, reserved: () => reserved, remove: () => players = [] };
}
test('host computes tap damage for multiple nearby bodies once; far bodies are excluded', () => {
    const f = fixture();
    f.far.position.z = -1.8;
    assert.ok(f.command('start'));
    assert.ok(f.command('release'));
    assert.equal(f.reserved(), 1);
    updateKatana(.19);
    assert.equal(f.hits.length, 2);
    updateKatana(.02);
    assert.deepEqual(f.hits, [{ id: 'victim', damage: 5 }, { id: 'far', damage: 5 }]);
    updateKatana(1);
    assert.equal(f.hits.length, 2);
    assert.equal(f.events.at(-1).charged, false);
});
test('host charge clock and immediate charged damage do not trust a visual event', () => {
    const f = fixture();
    f.command('start');
    updateKatana(3);
    f.command('release');
    f.attacker.yaw = Math.PI;
    updateKatana(.2);
    assert.deepEqual(f.hits, [{ id: 'victim', damage: 10 }, { id: 'far', damage: 10 }]);
    assert.equal(f.events.at(-1).charged, true);
});
test('cover, fresh lives, death, switching, input cancel and missing peers prevent pending damage', () => {
    for (const invalidate of [(f: ReturnType<typeof fixture>) => f.block(true), f => f.victim.lifeId++, f => { f.attacker.alive = false; }, f => { f.attacker.ready = false; }, f => { f.command('cancel'); }, f => f.remove(), f => invalidateMeleePeer('attacker')]) {
        const f = fixture();
        f.block(true);
        f.command('start');
        f.command('release');
        f.block(false);
        invalidate(f);
        updateKatana(.3);
        assert.equal(f.hits.length, 0);
    }
});
test('sequence replay, stale lives, unready weapon and shared firearm cooldown fail closed', () => {
    const f = fixture();
    assert.equal(f.command('release'), false);
    assert.equal(f.command('start', { lifeId: 0 }), false);
    f.ready(false);
    assert.equal(f.command('start'), false);
    f.ready(true);
    f.attacker.ready = false;
    assert.equal(f.command('start'), false);
    f.attacker.ready = true;
    assert.equal(f.command('start'), true);
    assert.equal(f.command('release', { sequence: 0 }), false);
    assert.equal(f.command('release'), true);
    assert.equal(f.command('start'), false);
    updateKatana(.6);
    assert.equal(f.command('start'), true);
    state.isHost = false;
    assert.equal(f.command('release'), false);
});
test('host-approved visual packets never apply damage on clients; reset retires pending attacks', () => {
    const f = fixture();
    state.isHost = false;
    receiveMeleeEvent({ type: 'melee_event', senderPeerId: 'attacker', action: 'release', sequence: 1, lifeId: 1, charged: true, origin: { x: 0, y: 2, z: 0 }, yaw: 0, pitch: 0 });
    updateKatana(1);
    assert.equal(f.hits.length, 0);
    state.isHost = true;
    f.block(true);
    f.command('start');
    f.command('release');
    resetKatana();
    f.block(false);
    updateKatana(1);
    assert.equal(f.hits.length, 0);
});
test('NPC revisions prevent a replacement from inheriting a pending melee hit', () => {
    for (const replacement of [false, true]) {
        const f = fixture();
        f.victim.position.z = f.far.position.z = -20;
        const target = new THREE.Group(), body = new THREE.Mesh(new THREE.BoxGeometry(.2, .2, .2), new THREE.MeshBasicMaterial());
        target.add(body);
        target.position.set(0, 1.65, -1);
        target.userData = { hp: 50, eliminationRevision: 0, bodyMesh: body };
        state.targets = [target];
        f.block(true);
        f.command('start');
        f.command('release');
        if (replacement)
            target.userData.eliminationRevision++;
        f.block(false);
        updateKatana(.2);
        assert.deepEqual(f.hits, replacement ? [] : [{ id: 'npc:0', damage: 5 }]);
        body.geometry.dispose();
        body.material.dispose();
        state.targets = [];
    }
});

test('both swings catch entry through 0.4s, but never later; repeated contact hits once', () => {
    for (const charged of [false, true]) for (const entry of [.05, .2, .4, .401, .6]) {
        const f = fixture(); f.victim.position.z = -30; f.far.position.z = -40;
        f.command('start'); if (charged) updateKatana(3); f.command('release');
        f.victim.position.z = -2;
        updateKatana(entry);
        assert.equal(f.hits.length, entry <= .4 ? 1 : 0);
        if (f.hits.length) assert.equal(f.hits[0].damage, charged ? 10 : 5);
        f.victim.position.z = -30; updateKatana(.01);
        f.victim.position.z = -2; updateKatana(.01);
        assert.equal(f.hits.length, entry <= .4 ? 1 : 0);
    }
});
test('damage follows attacker movement, yaw and pitch; a new swing resets deduplication', () => {
    for (const move of ['position', 'yaw', 'pitch']) {
        const f = fixture(); f.victim.position.set(0, 2, 3); f.far.position.z = -40;
        if (move === 'pitch') f.victim.position.set(0, 6, 0);
        f.command('start'); f.command('release'); assert.equal(f.hits.length, 0);
        if (move === 'position') f.attacker.position.z = 5;
        if (move === 'yaw') f.attacker.yaw = Math.PI;
        if (move === 'pitch') f.attacker.pitch = Math.PI / 2;
        updateKatana(.1); assert.equal(f.hits.length, 1);
        updateKatana(.5); f.command('start'); f.command('release'); assert.equal(f.hits.length, 2);
    }
});
test('cover opening during the window permits one hit, across simulation frame rates', () => {
    for (const step of [1/144, 1/60, 1/30, .2]) {
        const f = fixture(); f.block(true); f.command('start'); f.command('release');
        updateKatana(step); assert.equal(f.hits.length, 0);
        f.block(false); updateKatana(step); assert.equal(f.hits.length, 1);
        updateKatana(step); assert.equal(f.hits.length, 1);
    }
});

test('host nape execution respects cover, phases, revisions and consumed body hits', async () => {
    const { ForgottenMecha } = await import('../src/forgottenMecha.ts');
    const { loadIronmawTestAsset } = await import('./ironmawTestAsset.ts');
    const world = await import('../src/world.ts');
    const { getMeleeNetworkPort } = await import('../src/weaponNetworkPort.ts');
    const originalLoad = ForgottenMecha.prototype.load;
    ForgottenMecha.prototype.load = async function () { this.install(await loadIronmawTestAsset()); };
    try {
        for (const scenario of ['rear', 'front', 'cover', 'phase', 'revision', 'body-first', 'normal', 'cancel']) {
            const f = fixture(); state.scene = new THREE.Scene(); state.obstacles = []; state.lavaPools = [];
            await world.prepareForgottenMecha({}, async () => {});
            const actor = world.forgottenMecha!, nape = actor.nape!;
            actor.combat.shieldPhase = 'down';
            const feedback: any[] = [], amounts: number[] = [];
            setMeleeNetworkPort({ ...getMeleeNetworkPort(), confirmHit: e => feedback.push(e), hitMecha: (_a, amount, origin, point) => {
                const result = actor.damage(amount, { origin, point, surface: 'body' });
                if (result.accepted) amounts.push(amount); return result.accepted;
            } });
            const center = nape.box.getCenter(new THREE.Vector3()).applyMatrix4(nape.anchor.matrixWorld);
            const rear = new THREE.Vector3(0, 0, -1).transformDirection(nape.anchor.matrixWorld);
            const place = (behind: boolean) => {
                f.attacker.position.copy(center).addScaledVector(rear, behind ? 3 : -3); f.attacker.position.y += .35;
                f.attacker.yaw = Math.atan2(behind ? rear.x : -rear.x, behind ? rear.z : -rear.z);
            };
            place(scenario !== 'front' && scenario !== 'body-first');
            f.command('start'); if (scenario !== 'normal') updateKatana(3);
            if (scenario === 'cover' || scenario === 'revision' || scenario === 'cancel') f.block(true);
            if (scenario === 'phase') actor.mode = 'boarding';
            f.command('release');
            if (scenario === 'body-first') { place(true); updateKatana(.1); }
            if (scenario === 'revision') { actor.revision++; f.block(false); updateKatana(.1); }
            if (scenario === 'cancel') { f.command('cancel'); f.block(false); updateKatana(.1); }
            if (scenario === 'rear') { assert.deepEqual(amounts, [50]); assert.ok(feedback.some(e => e.execution)); }
            else if (scenario === 'front' || scenario === 'body-first') { assert.deepEqual(amounts, [10]); assert.equal(feedback.some(e => e.execution), false); }
            else if (scenario === 'normal') assert.deepEqual(amounts, [5]);
            else assert.deepEqual(amounts, []);
            actor.dispose(); resetKatana();
        }
    } finally { ForgottenMecha.prototype.load = originalLoad; world.forgottenMecha?.dispose(); state.scene = null; }
});
