import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { pack, unpack } from 'peerjs-js-binarypack';
import { ForgottenMecha, type MechaPlayer } from '../src/forgottenMecha.ts';
import { loadIronmawTestAsset } from './ironmawTestAsset.ts';
import { parseNetworkPacket } from '../src/networkTypes.ts';
import { state } from '../src/state.ts';
import { MechaRockets, type RocketPlayer } from '../src/mechaRockets.ts';
import { initializeNetworkMecha, resetMechaNetwork, setMechaNetworkPort, setMechaPresentation, updateMechaNetwork,
    acceptMechaCommand, mechaPeerLeft, receiveMechaState, receiveMechaEvent, acknowledgeMechaRender, flushMechaDamage,
    multiplayerMechaEvents, captureMechaSnapshot, markMechaEndingReady, acceptMechaEndingReady, updateMechaEndingNetwork } from '../src/mechaNetwork.ts';
import { MECHA_ENDING_DURATION, type MechaEndingState } from '../src/mechaEndingTimeline.ts';
import type { MechaInputPacket, MechaEventPacket, MechaState } from '../src/mechaNetworkTypes.ts';

const absent = { position: new THREE.Vector3(), alive: false, grounded: false };
const emptyQuery = (_sx: number, _sz: number, _ex: number, _ez: number, out: THREE.Object3D[]) => { out.length = 0; return out; };
async function actor(events?: ConstructorParameters<typeof ForgottenMecha>[3]) {
    const a = new ForgottenMecha([], [], 42, events);
    a.install(await loadIronmawTestAsset()); a.group.position.set(0, 0, 0); a.group.rotation.y = 0;
    a.update(1 / 60, absent); return a;
}
function advance(a: ForgottenMecha, time: number) { for (let t = 0; t < time - 1e-9; t += 1 / 60) a.update(Math.min(1 / 60, time - t), absent); }
const player = (peerId: string, x: number, y: number, z: number, grounded = true): MechaPlayer => ({ peerId, lifeId: 0, position: new THREE.Vector3(x, y, z), yaw: 0, grounded, alive: true, velocity: new THREE.Vector3() });
function host(a: ForgottenMecha, players: MechaPlayer[]) {
    resetMechaNetwork(); state.isMultiplayer = state.isHost = state.isPlaying = true; state.matchEnded = false;
    state.playerHp = 10; state.lifeId = 0; state.peers = {}; state.peerIds = [];
    state.peer = { id: 'host', destroy() {}, on() {}, connect() { throw new Error('not used'); } };
    state.scene = new THREE.Scene(); state.camera = new THREE.PerspectiveCamera();
    const packets: any[] = [];
    setMechaNetworkPort({ send: p => packets.push(structuredClone(p)), players: () => players, hitTarget() {}, acceptedDamage() {} });
    initializeNetworkMecha(a); return packets;
}
function command(a: ForgottenMecha, sequence: number, rest: Partial<MechaInputPacket> = {}): MechaInputPacket {
    return { type: 'mecha_input', sequence, revision: a.revision, lifeId: 0, direction: 0, yaw: 0, pitch: 0,
        shield: false, fire: false, helmet: false, exit: false, thirdPerson: false, secondaryHeld: false, viewThirdPerson: false, fov: 75, aspect: 1, ...rest };
}
function cleanup(a: ForgottenMecha) { resetMechaNetwork(); a.dispose(); state.isMultiplayer = state.isHost = state.isPlaying = false; state.matchEnded = false; state.peer = null; }

test('wall arrival commits loss before the first punch tick and shares readiness with paused/dead viewers', async t => {
    let now = 1000; t.mock.method(performance, 'now', () => now);
    const a = await actor(multiplayerMechaEvents());
    const viewers = [player('paused', 800, 2, 800), { ...player('dead', 800, 2, 800), alive: false }];
    const packets = host(a, viewers), endings: MechaEndingState[] = [];
    let overlays = 0;
    setMechaPresentation({ impact() {}, release() {}, blocked() {}, damage() {}, gameOver: () => overlays++, hit() {}, ending: s => endings.push(s) });
    try {
        state.dayNightElapsedSeconds = 780;
        const goal = a.route!.points.at(-1)!;
        a.group.position.set(goal.x, 0, goal.z); a.followRoute({ points: [goal, goal], heading: a.route!.heading });
        updateMechaNetwork(1 / 60);
        assert.equal(state.matchEnded, true); assert.equal(a.mode, 'punching'); assert.equal(a.elapsed, 0);
        assert.equal(overlays, 0); assert.equal(endings.length, 1);
        assert.equal(endings[0].lightingElapsed, 300);
        assert.deepEqual(endings[0].position, { x: goal.x, y: 0, z: goal.z });
        assert.ok(parseNetworkPacket(unpack(await pack(packets.at(-1)))));
        assert.equal(a.damage(50).accepted, false, 'loss cannot be reversed after commitment');
        now = 1500; markMechaEndingReady(endings[0].id);
        const ready = { type: 'mecha_ending_ready' as const, id: endings[0].id, revision: a.revision };
        assert.equal(acceptMechaEndingReady('intruder', ready), false);
        assert.equal(acceptMechaEndingReady('paused', { ...ready, senderPeerId: 'dead' }), false);
        assert.equal(acceptMechaEndingReady('paused', { ...ready, revision: a.revision + 1 }), false);
        assert.equal(acceptMechaEndingReady('paused', { ...ready, id: ready.id + 1 }), false);
        assert.equal(acceptMechaEndingReady('paused', ready), true);
        assert.equal(acceptMechaEndingReady('paused', ready), false);
        assert.equal(captureMechaSnapshot()!.ending!.phase, 'preparing');
        mechaPeerLeft('dead');
        assert.equal(captureMechaSnapshot()!.ending!.phase, 'playing');
        now += 4000; updateMechaEndingNetwork();
        assert.equal(captureMechaSnapshot()!.ending!.elapsed, 4.45);
        assert.equal(a.elapsed, 0); assert.equal(overlays, 0);
        now += 6000;
        const lateJoin = captureMechaSnapshot()!;
        assert.equal(lateJoin.ending!.elapsed, MECHA_ENDING_DURATION);
        assert.equal(lateJoin.ending!.phase, 'complete'); assert.ok(parseNetworkPacket({ type: 'mecha_state', state: lateJoin }));
        resetMechaNetwork(); initializeNetworkMecha(a);
        assert.equal(captureMechaSnapshot()!.ending, undefined, 'new session cannot carry an old ending');
    } finally { cleanup(a); }
});

test('ending metadata is validated and late replicas suppress old damage and immediate end overlays', async () => {
    const a = await actor(); host(a, []); state.isHost = false; state.playerHp = 0;
    const scenes: MechaEndingState[] = []; let overlays = 0, damage = 0;
    setMechaPresentation({ impact() {}, release() {}, blocked() {}, damage: () => damage++, gameOver: () => overlays++, hit() {}, ending: s => scenes.push(s) });
    try {
        const base = a.captureNetworkState(1, true); base.mode = 'punching'; base.heading = Math.PI / 2;
        base.ending = { id: 1, seed: 42, effectsSeed: 123, position: { ...base.position }, heading: base.heading, lightingElapsed: 150, phase: 'playing', elapsed: 4 };
        assert.ok(parseNetworkPacket(unpack(await pack({ type: 'mecha_state', state: base }))));
        for (const change of [
            (s: MechaState) => { s.ending!.elapsed = Infinity; }, (s: MechaState) => { s.ending!.elapsed = -1; },
            (s: MechaState) => { s.ending!.seed = -1; }, (s: MechaState) => { s.ending!.position.x++; },
            (s: MechaState) => { s.ending!.phase = 'preparing'; }, (s: MechaState) => { s.ending!.phase = 'complete'; },
            (s: MechaState) => { s.matchEnded = false; }, (s: MechaState) => { s.mode = 'walking'; },
            (s: MechaState) => { s.ending!.heading = .3; }, (s: MechaState) => { s.ending!.effectsSeed = 2 ** 32; },
            (s: MechaState) => { s.ending!.lightingElapsed = 481; },
        ]) { const next = structuredClone(base); change(next); assert.equal(parseNetworkPacket({ type: 'mecha_state', state: next }), null); }
        assert.equal(parseNetworkPacket({ type: 'mecha_ending_ready', id: 0, revision: 0 }), null);
        assert.equal(parseNetworkPacket({ type: 'mecha_ending_ready', id: 1, revision: -1 }), null);
        assert.ok(parseNetworkPacket({ type: 'mecha_ending_ready', id: 1, revision: 0 }));
        receiveMechaState(base); assert.equal(state.matchEnded, true); assert.equal(overlays, 0); assert.equal(scenes.at(-1)!.elapsed, 4);
        receiveMechaState(base); assert.equal(scenes.length, 1);
        receiveMechaState({ ...base, sequence: 2, ending: undefined }); assert.equal(scenes.length, 1);
        receiveMechaState({ ...base, sequence: 3, ending: { ...base.ending!, elapsed: 3 } }); assert.equal(scenes.length, 1);
        receiveMechaEvent({ type: 'mecha_event', sequence: 1, state: base, event: { kind: 'end' } });
        receiveMechaEvent({ type: 'mecha_event', sequence: 2, state: base, event: { kind: 'damage', peerId: 'host', lifeId: 0, damage: 10, attack: 'stomp', attackerPeerId: null } });
        acknowledgeMechaRender(); flushMechaDamage(); assert.equal(damage, 0); assert.equal(overlays, 0);
        receiveMechaState({ ...base, sequence: 4, ending: { ...base.ending!, elapsed: MECHA_ENDING_DURATION, phase: 'complete' } });
        assert.equal(scenes.at(-1)!.phase, 'complete'); assert.equal(overlays, 0, 'presentation owns the final overlay after local readiness');
    } finally { cleanup(a); }
});

test('actual rig snapshots round-trip through BinaryPack and strict packet parsing, including active rockets', async () => {
    const a = await actor(); host(a, []);
    try {
        a.pilot.rockets.fire(new THREE.Vector3(0, 10, 0), new THREE.Vector3(0, 0, 1), []);
        const snapshot = a.captureNetworkState(1);
        assert.equal(snapshot.boneCount, 160); assert.ok(snapshot.bones.length <= 192);
        const packet = { type: 'mecha_state', state: snapshot };
        assert.ok(parseNetworkPacket(unpack(await pack(packet))));
        for (const mutate of [
            (s: MechaState) => { s.hp = 51; }, (s: MechaState) => { s.sequence = -1; },
            (s: MechaState) => { s.bones.push(...s.bones, ...s.bones, ...s.bones); },
            (s: MechaState) => { s.bones[0][4] = NaN; }, (s: MechaState) => { s.pilotPeerId = 'unowned'; },
            (s: MechaState) => { s.rockets.push(s.rockets[0]); }, (s: MechaState) => { s.combat.beamDirection.x = 20; },
        ]) { const s = structuredClone(snapshot); mutate(s); assert.equal(parseNetworkPacket({ type: 'mecha_state', state: s }), null); }
        assert.equal(parseNetworkPacket(command(a, 1, { direction: 4 })), null);
        assert.equal(parseNetworkPacket(command(a, 1, { yaw: Infinity })), null);
        assert.ok(parseNetworkPacket(command(a, 1)));
    } finally { cleanup(a); }
});

test('replicas preserve fitted armor and rockets without simulating damage or acquiring local ownership', async () => {
    const source = await actor(), copy = await actor();
    try {
        source.damage(50); advance(source, 6.2); source.pilotPeerId = 'pilot'; source.pilotLifeId = 7;
        source.beginBoarding(source.seatAnchor.getWorldPosition(new THREE.Vector3()), new THREE.Quaternion()); advance(source, 8);
        source.pilot.rockets.fire(new THREE.Vector3(0, 10, 20), new THREE.Vector3(0, 0, 1), []);
        const snapshot = source.captureNetworkState(1); copy.networked = true; copy.localPeerId = 'observer'; copy.applyNetworkState(snapshot);
        assert.equal(copy.ownsPilot, true); assert.equal(copy.ownsLocalPilot, false); assert.equal(copy.pilotLifeId, 7);
        for (let i = 0; i < source.colliders.length; i++) assert.ok(copy.colliders[i].position.distanceTo(source.colliders[i].position) < 1e-5);
        assert.equal(copy.pilot.rockets.activeCount, 1);
        copy.pilot.rockets.update(0.1, [], emptyQuery, () => assert.fail('replicas cannot damage NPCs'));
        assert.equal(copy.pilot.rockets.activeCount, 1);
    } finally { source.dispose(); copy.dispose(); }
});

test('AI retains its first eligible target despite a closer challenger, then reacquires after death', async () => {
    const a = await actor(); a.networked = true;
    const first = player('first', 0, 2, 45), second = player('second', 0, 2, 50);
    try {
        a.updatePlayers(0.1, [first, second]); second.position.z = 30;
        for (let i = 0; i < 90; i++) a.updatePlayers(1 / 60, [first, second]);
        const rocket = (a.pilot.rockets as any).rockets.find((r: any) => r.active);
        assert.equal(rocket.playerPeerId, 'first');
        first.alive = false;
        for (let i = 0; i < 240; i++) a.updatePlayers(1 / 60, [first, second]);
        assert.ok((a.pilot.rockets as any).rockets.some((r: any) => r.active && r.playerPeerId === 'second'));
    } finally { a.dispose(); }
});

test('stomps damage every contacted player once while airborne players outside leg contact remain safe', async () => {
    const hits: string[] = [];
    const a = await actor({ impact() {}, stompPlayer() {}, gameOver() {}, playerHit: p => hits.push(p.peerId!) }); a.networked = true;
    const players = [player('one', 0, 2, 10), player('two', 10, 2, 0), player('jump', 0, 10, 15, false)];
    try { for (let i = 0; i < 120; i++) a.updatePlayers(1 / 60, players); assert.deepEqual(hits.sort(), ['one', 'two']); }
    finally { a.dispose(); }
});

test('a released laser can hit two lives on its physical beam once each without host render acknowledgment', async () => {
    const hits: string[] = [];
    const a = await actor({ impact() {}, stompPlayer() {}, gameOver() {}, playerHit: (p, _d, attack) => { if (attack === 'laser') hits.push(p.peerId!); } }); a.networked = true;
    const players = [player('one', 0, 24, 70, false), player('two', 0, 24, 90, false), player('side', 30, 24, 80, false)];
    try { for (let i = 0; i < 260; i++) a.updatePlayers(1 / 60, players); assert.deepEqual(hits.sort(), ['one', 'two']); }
    finally { a.dispose(); }
});

test('boarding is exclusive, rejects stale/nonowner commands, expires held input and survives pilot departure', async t => {
    const a = await actor(); a.damage(50); advance(a, 6.2);
    const seat = a.seatAnchor.getWorldPosition(new THREE.Vector3());
    const pilots = [player('pilot', seat.x, seat.y, seat.z + 10), player('other', seat.x, seat.y, seat.z + 10)];
    const packets = host(a, pilots); let now = 1000; t.mock.method(performance, 'now', () => now);
    try {
        updateMechaNetwork(1 / 60);
        const board = { type: 'mecha_board' as const, sequence: 1, revision: a.revision, lifeId: 0, thirdPerson: true, secondaryHeld: false };
        assert.equal(acceptMechaCommand('pilot', board), true);
        assert.equal(a.ownsLocalPilot, false); assert.equal(acceptMechaCommand('other', board), false);
        assert.equal(acceptMechaCommand('other', command(a, 2, { fire: true })), false);
        assert.equal(acceptMechaCommand('pilot', command(a, 2, { lifeId: 1 })), false);
        for (let i = 0; i < 510; i++) { now += 17; updateMechaNetwork(1 / 60); }
        assert.equal(a.mode, 'piloted');
        const moving = command(a, 3, { direction: 1, shield: true }); assert.equal(acceptMechaCommand('pilot', moving), true);
        assert.equal(acceptMechaCommand('pilot', moving), false);
        updateMechaNetwork(0.1); now += 300; updateMechaNetwork(0.1);
        assert.equal((a as any).pilotDirection, 0); assert.equal((a as any).shieldHeld, false);
        assert.ok(packets.every(p => parseNetworkPacket(p) !== null));
        mechaPeerLeft('pilot'); assert.equal(a.canMount, true); assert.equal(a.pilotPeerId, null); assert.equal(a.pilot.rockets.activeCount, 0);
        assert.equal(acceptMechaCommand('pilot', moving), false);
    } finally { cleanup(a); }
});

test('host simulation progresses after the local host dies and does not progress in the lobby', async () => {
    const a = await actor(), players = [player('guest', 0, 2, 45)]; host(a, players);
    try {
        state.isPlaying = false; const before = a.animationTime; updateMechaNetwork(0.1); assert.equal(a.animationTime, before);
        state.isPlaying = true; state.playerHp = 0; updateMechaNetwork(0.1); assert.ok(a.animationTime > before);
        assert.equal(a.mode, 'rocketing');
    } finally { cleanup(a); }
});

test('client damage waits for the actual laser draw, ignores duplicates and cannot leak into a new life', async () => {
    const a = await actor(); host(a, []); state.isHost = false;
    const damage: number[] = []; let endings = 0;
    setMechaPresentation({ impact() {}, release() {}, blocked() {}, hit() {}, damage: d => damage.push(d), gameOver: () => endings++ });
    try {
        const snapshot = a.captureNetworkState(1); snapshot.combat.laserPhase = 'firing'; snapshot.combat.beamRadius = 1; snapshot.combat.beamLength = 100;
        const packet: MechaEventPacket = { type: 'mecha_event', sequence: 1, state: snapshot,
            event: { kind: 'damage', peerId: 'host', lifeId: 0, damage: 10, attack: 'laser', attackerPeerId: null } };
        receiveMechaEvent(packet); receiveMechaEvent(packet); acknowledgeMechaRender(); flushMechaDamage(); assert.deepEqual(damage, []);
        const beam = a.combat.effects.group.getObjectByName('Forgotten Mecha laser beam') as THREE.Mesh;
        (beam.onAfterRender as () => void)(); acknowledgeMechaRender(); flushMechaDamage(); assert.deepEqual(damage, [10]);
        receiveMechaEvent({ ...packet, sequence: 2 }); state.lifeId = 1;
        (beam.onAfterRender as () => void)(); acknowledgeMechaRender(); flushMechaDamage(); assert.deepEqual(damage, [10]);
        receiveMechaState({ ...snapshot, sequence: 10, matchEnded: true }); assert.equal(endings, 1); assert.equal(state.matchEnded, true);
        receiveMechaState({ ...snapshot, sequence: 9 }); assert.equal(state.matchEnded, true);
    } finally { cleanup(a); }
});

test('pilot rocket blast hits nearby peer lives once, excludes the pilot and drops stale guidance', () => {
    const rockets = new MechaRockets();
    const owner: RocketPlayer = { peerId: 'pilot', lifeId: 0, alive: true, position: new THREE.Vector3(0, 2, 0), yaw: 0, velocity: new THREE.Vector3() };
    const victim: RocketPlayer = { ...owner, peerId: 'victim', position: new THREE.Vector3(0, 2, 30) };
    const collateral: RocketPlayer = { ...owner, peerId: 'nearby', position: new THREE.Vector3(2, 2, 30) };
    const hits: string[] = [];
    try {
        rockets.fire(new THREE.Vector3(0, 2, 0), new THREE.Vector3(0, 0, 1), [], { mode: 'guided', peerTarget: victim, ownerPeerId: 'pilot' });
        for (let i = 0; i < 60; i++) rockets.update(1 / 60, [], emptyQuery, () => {}, undefined, () => {}, [owner, victim, collateral], (p, d, id) => { assert.equal(d, 10); assert.equal(id, 'pilot'); hits.push(p.peerId!); });
        assert.deepEqual(hits.sort(), ['nearby', 'victim']);
        rockets.fire(new THREE.Vector3(0, 10, 0), new THREE.Vector3(0, 0, 1), [], { mode: 'guided', peerTarget: victim, ownerPeerId: 'pilot' });
        victim.lifeId++; rockets.update(1 / 60, [], emptyQuery, () => {}, undefined, () => {}, [owner, victim]);
        assert.equal((rockets as any).rockets.find((r: any) => r.active).player, null);
    } finally { rockets.dispose(); }
});

test('late replicas recover active laser, startup and complete breakup poses without old collision', async () => {
    const source = await actor(), copy = await actor(); source.networked = true; copy.networked = true; copy.localPeerId = 'observer';
    try {
        const target = player('enemy-target', 0, 24, 70, false);
        for (let i = 0; i < 195; i++) source.updatePlayers(1 / 60, [target]);
        let snapshot = source.captureNetworkState(1); assert.equal(snapshot.combat.laserPhase, 'firing');
        copy.applyNetworkState(snapshot); assert.equal(copy.combat.beamLength, source.combat.beamLength);
        source.damage(50); advance(source, 6.2); source.pilotPeerId = 'pilot'; source.pilotLifeId = 4;
        source.beginBoarding(source.seatAnchor.getWorldPosition(new THREE.Vector3()), new THREE.Quaternion()); advance(source, 2);
        snapshot = source.captureNetworkState(2); assert.equal(snapshot.mode, 'startup'); assert.ok(parseNetworkPacket({ type: 'mecha_state', state: snapshot }));
        copy.applyNetworkState(snapshot); assert.equal(copy.headView.phase, source.headView.phase); assert.equal(copy.ownsLocalPilot, false);
        advance(source, 7); source.damage(50); advance(source, 0.5);
        snapshot = source.captureNetworkState(3); assert.equal(snapshot.mode, 'destroying'); assert.ok(parseNetworkPacket({ type: 'mecha_state', state: snapshot }));
        copy.applyNetworkState(snapshot); assert.equal(copy.solidColliders.length, 0); assert.equal(copy.canMount, false);
        for (const name of ['PART_HelmetShell_01', 'PART_Forearm_L_01', 'PART_UpperTorso_Cavity_01']) assert.ok(copy.group.getObjectByName(name)!.getWorldPosition(new THREE.Vector3()).distanceTo(source.group.getObjectByName(name)!.getWorldPosition(new THREE.Vector3())) < 1e-4);
        advance(source, 4); copy.applyNetworkState(source.captureNetworkState(4)); assert.equal(copy.mode, 'destroyed');
    } finally { source.dispose(); copy.dispose(); }
});

test('a pilot leaving during boarding or startup retires ownership and restores a remountable wreck', async () => {
    for (const time of [0, 2]) {
        const a = await actor(); a.damage(50); advance(a, 6.2); host(a, []);
        try {
            a.pilotPeerId = 'pilot'; a.beginBoarding(a.seatAnchor.getWorldPosition(new THREE.Vector3()), new THREE.Quaternion()); advance(a, time);
            mechaPeerLeft('pilot'); assert.equal(a.canMount, true); assert.equal(a.hp, 0); assert.equal(a.pilotPeerId, null); assert.equal(a.headView.phase, 'inactive');
            assert.ok(parseNetworkPacket({ type: 'mecha_state', state: a.captureNetworkState(1) }));
        } finally { cleanup(a); }
    }
});

test('host acquisition uses the pilot frustum and physical NPCs even when host chunks cull their visuals', () => {
    const rockets = new MechaRockets(), camera = new THREE.PerspectiveCamera(75, 1, 0.1, 1000);
    camera.position.set(0, 2, 0); camera.lookAt(0, 2, 40); camera.updateMatrixWorld(true);
    const target = new THREE.Group(), body = new THREE.Mesh(new THREE.BoxGeometry(2, 2, 2), new THREE.MeshBasicMaterial());
    target.position.set(0, 2, 40); target.add(body); target.userData = { index: 0, hp: 10, scale: 1, eliminationRevision: 0, bodyMesh: body };
    target.visible = body.visible = false; target.updateMatrixWorld(true);
    try {
        assert.equal(rockets.select(camera, camera.position, [target], emptyQuery), null);
        assert.equal(rockets.select(camera, camera.position, [target], emptyQuery, true)?.index, 0);
    } finally { rockets.dispose(); body.geometry.dispose(); (body.material as THREE.Material).dispose(); }
});

test('physical cover intercepts pilot rockets and blocks nearby player splash; covered enemy launches retain their captured life', () => {
    const rockets = new MechaRockets(), victim: RocketPlayer = { peerId: 'victim', lifeId: 0, alive: true, yaw: 0, position: new THREE.Vector3(0, 2, 26.5), velocity: new THREE.Vector3() };
    const wall = new THREE.Mesh(new THREE.BoxGeometry(20, 20, 1), new THREE.MeshBasicMaterial());
    wall.position.set(0, 10, 25); wall.userData = { height: 20, halfH: 10, halfW: 10, halfD: 0.5 }; wall.updateMatrixWorld(true);
    const query = (_sx: number, _sz: number, _ex: number, _ez: number, out: THREE.Object3D[]) => { out.length = 0; out.push(wall); return out; };
    let hits = 0, blasts = 0; rockets.onExplosion = () => blasts++;
    try {
        rockets.fire(new THREE.Vector3(0, 2, 0), new THREE.Vector3(0, 0, 1), [], { mode: 'guided', peerTarget: victim, ownerPeerId: 'pilot' });
        for (let i = 0; i < 40; i++) rockets.update(1 / 60, [], query, () => {}, undefined, () => {}, [victim], () => hits++);
        assert.equal(blasts, 1); assert.equal(hits, 0);
        rockets.fire(new THREE.Vector3(0, 10, 0), new THREE.Vector3(0, 0, 1), [], { mode: 'wandering', player: victim });
        rockets.update(1 / 60, [], emptyQuery, () => {}, undefined, () => {}, [victim]); assert.equal(rockets.activeCount, 1);
        victim.lifeId++; rockets.update(1 / 60, [], emptyQuery, () => {}, undefined, () => {}, [victim]); assert.equal(rockets.activeCount, 0);
    } finally { rockets.dispose(); wall.geometry.dispose(); (wall.material as THREE.Material).dispose(); }
});

test('shutdown can synchronously clear the current host input without firing again or crashing', async t => {
    const a = await actor(multiplayerMechaEvents()); a.damage(50); advance(a, 6.2);
    const seat = a.seatAnchor.getWorldPosition(new THREE.Vector3()), pilots = [player('pilot', seat.x, seat.y, seat.z + 10)];
    const packets = host(a, pilots); let now = 1000; t.mock.method(performance, 'now', () => now);
    try {
        a.pilotPeerId = 'pilot'; a.beginBoarding(seat, new THREE.Quaternion()); advance(a, 8.5);
        assert.equal(a.mode, 'piloted');
        assert.equal(acceptMechaCommand('pilot', command(a, 1, { exit: true })), true);
        for (let i = 0; i < 650 && !a.canMount; i++) {
            now += 17; acceptMechaCommand('pilot', command(a, i + 2));
            assert.doesNotThrow(() => updateMechaNetwork(1 / 60));
        }
        assert.equal(a.canMount, true); assert.equal(a.pilotPeerId, null); assert.equal(a.pilot.rockets.activeCount, 0);
        assert.equal(packets.filter(p => p.type === 'mecha_event' && p.event.kind === 'release').length, 1);
    } finally { cleanup(a); }
});

test('a late boarding rejection cannot relocate a respawned life', async () => {
    const a = await actor(); host(a, []); state.isHost = false;
    let releases = 0;
    setMechaPresentation({ impact() {}, release: () => releases++, blocked() {}, hit() {}, damage() {}, gameOver() {} });
    try {
        const { rememberMechaApproach } = await import('../src/mechaNetwork.ts'); rememberMechaApproach(); state.lifeId = 1;
        const packet: MechaEventPacket = { type: 'mecha_event', sequence: 1, state: a.captureNetworkState(1), event: { kind: 'board_denied', peerId: 'host', lifeId: 0 } };
        assert.ok(parseNetworkPacket(packet)); receiveMechaEvent(packet); assert.equal(releases, 0);
    } finally { cleanup(a); }
});

test('blocked-exit recovery reaches the owning replica camera while observers remain independent', async () => {
    const a = await actor(); host(a, []); state.isHost = false; state.isThirdPerson = true;
    try {
        const snapshot = a.captureNetworkState(1);
        Object.assign(snapshot, { mode: 'piloted', pilotPeerId: 'host', pilotLifeId: 0, hp: 50 });
        receiveMechaState(snapshot); updateMechaNetwork(1 / 60);
        receiveMechaState({ ...snapshot, sequence: 2, mode: 'shutting-down' }); updateMechaNetwork(1 / 60);
        receiveMechaState({ ...snapshot, sequence: 3, mode: 'startup', recoveringExit: true, head: { ...snapshot.head, phase: 'hud', blackout: 1 } });
        updateMechaNetwork(1 / 60);
        assert.equal(a.localTransition?.recovering, true);
        assert.equal(a.headView.blackout, 1); assert.equal(a.ownsLocalPilot, true);
        a.localPeerId = 'observer'; a.localPilotPresentation = false;
        assert.equal(a.localTransition, undefined);
    } finally { cleanup(a); state.isThirdPerson = false; }
});
