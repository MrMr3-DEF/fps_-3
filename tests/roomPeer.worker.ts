import { mock } from 'node:test';
// Each worker owns a real, isolated game module graph. Only transport/auth are faked.
import { HudElement } from './fakeHudDom.ts';
import { SmartGogglesHud } from '../src/smartGoggles.ts';
import { pack, unpack } from 'peerjs-js-binarypack';
import { parentPort } from 'node:worker_threads';
import * as THREE from 'three';
import { state, resetPlayerState } from '../src/state.ts';
import { parseNetworkPacket } from '../src/networkTypes.ts';
import { hostGame, joinGame, startHostMatch, sendLocalState, updateRemotePeers, broadcastToAll } from '../src/multiplayer.ts';
import { createAkimboGuns, fireProjectile, updateWeapons } from '../src/weapons.ts';
import { updateProjectiles } from '../src/projectiles.ts';
import { setDamageHandlers } from '../src/damage.ts';
import { Peer, Connection } from './fakePeer.ts';
(globalThis as any).document = {
    getElementById: (id: string) => id === 'goggles-anomaly-tear-a' ? {} : null,
    createElement: () => new HudElement(), createElementNS: () => new HudElement(),
};
(globalThis as any).window = { innerWidth: 1280, innerHeight: 720, matchMedia: () => ({ matches: true }) };
mock.timers.enable({ apis: ['setInterval'] });
let now = 1000;
Object.defineProperty(performance, 'now', { value: () => now });
const layer = new HudElement();
const goggles = new SmartGogglesHud(layer as any);
const cap = 'a'.repeat(43);
globalThis.fetch = (async (input: any) => {
    if (String(input).startsWith('/api/turn?')) return Response.json({ iceServers: [{ urls: 'stun:test' }] });
    if (String(input).startsWith('/api/room-admissions/')) return Response.json({ username: 'Guest2', admissionProof: cap, admissionGeneration: 1 });
    return Response.json({ closeToken: cap, turnSessionToken: cap, admissionToken: cap, admissionProof: cap, expiresAt: Date.now() + 300000 });
}) as typeof fetch;
let connection: Connection;
let lastDeath: unknown;
const wire = (c: Connection) => {
    connection = c;
    c.send = packet => {
        if ((packet as any).type === 'player_died') {
            if (!parseNetworkPacket(packet)) throw new Error('Outgoing death packet failed parsing');
            lastDeath = packet;
        }
        const encoded = pack(packet as any);
        if (encoded instanceof Promise) throw new Error('Unexpected asynchronous packet encoding');
        parentPort!.postMessage({ packet: unpack(encoded) });
    };
};
setDamageHandlers(() => {}, (damage, attackerName, attackerId) => {
    if (!state.isPlaying || state.playerHp <= 0) return;
    state.playerHp = Math.max(0, state.playerHp - damage);
    state.lastDamageTime = performance.now(); state.regenTimer = 0;
    if (state.playerHp === 0) broadcastToAll({ type: 'player_died', lifeId: state.lifeId, cause: 'player',
        killerPeerId: attackerId!, victimName: state.username, killerName: attackerName, victimPeerId: state.peer!.id });
});
parentPort!.on('message', async ({ id, command, args }) => {
    try {
        let result: unknown;
        if (command === 'init') {
            state.camera = new THREE.PerspectiveCamera();
            state.controls = { isLocked: true, getObject: () => state.camera, unlock: () => {} } as any;
            if (args.host) await hostGame('Guest1', 'ABCDEFGH', 'test');
            else await joinGame('Guest', 'ABCDEFGH', 'test');
            Peer.latest.emit('open', Peer.latest.id);
            if (!args.host) wire(Peer.latest.connections['testfps-room-ABCDEFGH'][0]);
            result = { peerId: state.peer!.id };
        } else if (command === 'arena') { state.scene = new THREE.Scene(); createAkimboGuns();
        } else if (command === 'connect') {
            const c = new Connection(args.peerId, { admissionToken: cap }); wire(c);
            Peer.latest.emit('connection', c);
            await new Promise(resolve => setImmediate(resolve));
        } else if (command === 'receive') connection.emit('data', args);
        else if (command === 'start') startHostMatch();
        else if (command === 'pose') {
            state.camera!.position.set(0, 2, args.z);
            state.camera!.rotation.set(0, args.yaw, 0, 'YXZ');
            sendLocalState(true);
        } else if (command === 'scope') {
            state.isScoped = args.enabled;
            state.camera!.updateMatrixWorld(true);
            if (args.enabled) {
                goggles.update(state.camera!, state.camera!.position, state.camera!.position, [], state.peers, true, now);
            } else {
                goggles.reset();
            }
        } else if (command === 'equip') {
            state.desiredWeaponName = args.weapon;
        } else if (command === 'shoot') {
            if (state.activeWeaponName !== args.weapon || state.switchState !== 'IDLE' || state.fireCooldown > 0) throw new Error('Weapon is not ready');
            fireProjectile();
        } else if (command === 'tick') {
            now += args.delta * 1000;
            mock.timers.tick(args.delta * 1000);
            updateWeapons(args.delta);
            updateRemotePeers(args.delta);
            if (state.isScoped) {
                state.camera!.updateMatrixWorld(true);
                goggles.update(state.camera!, state.camera!.position, state.camera!.position, [], state.peers, true, now);
            }
            updateProjectiles(args.delta, state.username);
            sendLocalState(true);
        } else if (command === 'inspect') {
            state.camera!.updateMatrixWorld(true);
            goggles.update(state.camera!, state.camera!.position, state.camera!.position, [], state.peers, true, now);
            result = layer.texts().filter(text => text.startsWith('HEALTH'));
        } else if (command === 'trigger') {
            state.isMouseDown = true; sendLocalState(true);
        } else if (command === 'pauseTime') {
            now += args.duration;
            mock.timers.tick(args.duration);
        } else if (command === 'respawn') { resetPlayerState(); sendLocalState(true); }
        else if (command === 'state') result = { hp: state.playerHp, lifeId: state.lifeId, isPlaying: state.isPlaying, lastDeath,
            peers: Object.fromEntries(Object.entries(state.peers).map(([key, p]) => [key, { hp: p.hp, lifeId: p.lifeId,
                visible: p.mesh.visible, position: p.mesh.position.toArray() }])) };
        parentPort!.postMessage({ id, result });
    } catch (error) { parentPort!.postMessage({ id, error: String(error) }); }
});
