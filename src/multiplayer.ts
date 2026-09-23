import { updateHealthRegen } from './healthRegen.js';
import { cancelHookForTarget } from './hookLifecycle.js';
import { characterColor } from './appearance.js';
import { endInput } from './inputSession.js';
import { resetProjectiles } from './projectiles.js';
import type { Peer } from 'peerjs';
import { ShotLedger, spreadDirection, acceptLifeUpdate, acceptDeath } from './shotAuthority.js';
import { isCapability, isUsername } from './roomIdentity.js';
import * as THREE from 'three';
import { state, resetPlayerState, resetMatchStats, type DataConnectionLike, type PeerData } from './state.js';
import { placePlayerAtTownSpawn } from './playerSpawn.js';
import { disposeParticles, spawnParticles, createLaserBeam, spawnRocketFlame, spawnManeuveringBeam, createShockwave } from './particles.js';
import {
    generateWorldSeed,
    getWorldSeed,
    queryObstaclesAlongSegment,
    rebuildEnvironmentWithSeed,
    rebuildTargetHash,
} from './world.js';
import { resetHook, GUN_TIP_OFFSET } from './grapple.js';
import { processTargetHit, takePlayerDamage } from './damage.js';
import {
    NETWORK_TICK_MS,
    MAX_PLAYERS,
    PROJECTILE_RADIUS,
    TARGET_HIT_RANGE_MULTIPLIER,
    PLAYER_MAX_HP,
    PILLAR_WIDTH,
    ROOM_CODE_LENGTH,
    MAP_HALF_SIZE,
    PEER_Y_OFFSET,
    HIT_FLASH_DURATION_MS,
    WEAPON_STATS,
    BULLET_TRAVEL_DISTANCE,
    MAX_PROJECTILES,
    GRAPPLE_BLUE,
} from './config.js';
import { setBeanColor, buildGun, buildShotgun, buildAR, buildSniper, buildMinigun, buildBeanModel, getBeanDamagePulseMaterials, isSharedGeometry, SHARED_BODY_MAT, SHARED_PROJECTILE_GEO } from './weapons.js';
import { triggerMuzzleFlash, updateMuzzleFlash } from './muzzleFlash.js';
import {
    parseNetworkPacket,
    type FirePacket,
    type HomingTargetPacket,
    type JumpPacket,
    type KillTargetPacket,
    type NetworkPacket,
    type TargetState,
    type TargetStatePacket,
    type UpdatePacket,
    type WeaponName,
    type WorldSnapshotPacket
} from './networkTypes.js';
import { obstacleData, projectileData, targetData, type TargetUserData } from './userDataTypes.js';
import { segmentAabbHitT } from './gameplayMath.js';
import { clearDamagePulse, pulseDamageMaterials } from './damagePulse.js';
import { excludeFromStablePeerEnvelope } from './smartGogglesPeerMath.js';
import { setWeaponNetworkPort } from './weaponNetworkPort.js';
import { flashHitmarker } from './hitmarker.js';
import {
    fromHomingTargetPacket,
    isWithinHomingAimEnvelope,
    PROJECTILE_HOMING_START_FRACTION,
    resolveProjectileHomingTarget,
    type ProjectileHomingTarget,
} from './projectileHoming.js';
import { PLAYER_HITBOX_BOUNDING_RADIUS } from './playerHitbox.js';
import { beginProjectileTrail } from './projectileTrails.js';
import {
    admitRoomPeer,
    departRoomPeer,
    closeTurnRoom,
    fetchTurnIceServers,
    heartbeatTurnRoom,
    registerTurnRoom,
    registerTurnSession,
    releaseTurnSession,
} from './turnSecurity.js';

const _stateEuler = new THREE.Euler();

// Scratch objects reused while applying remote packets.
const _boosterPos = new THREE.Vector3();
const _peerForward = new THREE.Vector3();
const _peerRight = new THREE.Vector3();
const _peerEuler = new THREE.Euler();
const _gunTip = new THREE.Vector3();
const _targetPos = new THREE.Vector3();
const _midPoint = new THREE.Vector3();
const _barrelPos = new THREE.Vector3();
const _dir = new THREE.Vector3();
const _baseFireDir = new THREE.Vector3();
const _shotAabbMin = new THREE.Vector3();
const _shotAabbMax = new THREE.Vector3();
const _peerTargetPosition = new THREE.Vector3();
const _shotObstacleCandidates: THREE.Object3D[] = [];

const SHARED_HOOK_GEO = new THREE.CylinderGeometry(0.035, 0.035, 1, 8);
SHARED_HOOK_GEO.rotateX(Math.PI / 2);
const SHARED_HOOK_MAT = new THREE.MeshBasicMaterial({ color: GRAPPLE_BLUE, toneMapped: false });

export interface PeerJSConfig {
    debug: number;
    host: string;
    port: number;
    path: string;
    secure: boolean;
    config: { iceServers: RTCIceServer[] };
}

// Lazily cached menu/HUD elements touched by networking callbacks.
const UI = {
    hostLobbyStatus: null as HTMLElement | null,
    btnHostStart: null as HTMLButtonElement | null,
    joinErrorLog: null as HTMLElement | null,
    pvpStats: null as HTMLElement | null,
    btnJoinConnect: null as HTMLButtonElement | null,
    blocker: null as HTMLElement | null,
    panelMain: null as HTMLElement | null,
    score: null as HTMLElement | null,
    kills: null as HTMLElement | null,
};

const DOM = {
    hostLobbyStatus: () => (UI.hostLobbyStatus || (UI.hostLobbyStatus = document.getElementById('host-lobby-status'))),
    btnHostStart: () => (UI.btnHostStart || (UI.btnHostStart = document.getElementById('btn-host-start') as HTMLButtonElement | null)),
    joinErrorLog: () => (UI.joinErrorLog || (UI.joinErrorLog = document.getElementById('join-error-log'))),
    pvpStats: () => (UI.pvpStats || (UI.pvpStats = document.getElementById('pvp-stats'))),
    btnJoinConnect: () => (UI.btnJoinConnect || (UI.btnJoinConnect = document.getElementById('btn-join-connect') as HTMLButtonElement | null)),
    blocker: () => (UI.blocker || (UI.blocker = document.getElementById('blocker'))),
    panelMain: () => (UI.panelMain || (UI.panelMain = document.getElementById('panel-main'))),
    score: () => (UI.score || (UI.score = document.getElementById('score'))),
    kills: () => (UI.kills || (UI.kills = document.getElementById('kills'))),
};

let cachedUsername = 'Guest1';
let healthInterval: ReturnType<typeof setInterval> | null = null;
const matchStartListeners = new Set<() => void>();
export function onMultiplayerStarted(listener: () => void): void { matchStartListeners.add(listener); }

function enterMultiplayerMatch(): void {
    if (state.isPlaying) return;
    state.isPlaying = true;
    state.pendingPlay = false;
    state.prevTime = performance.now();
    // requestAnimationFrame can stop in a paused/background tab. This timer
    // catches healing up from elapsed time and publishes only confirmed changes.
    healthInterval = setInterval(() => {
        if (state.isMultiplayer && state.isPlaying && updateHealthRegen(0)) sendLocalState(true);
    }, 250);
    sendLocalState(true);
    for (const listener of matchStartListeners) listener();
}

export function startHostMatch(): boolean {
    if (!state.isMultiplayer || !state.isHost || !state.peer || state.isPlaying) return false;
    broadcastToAll({ type: 'start_game' });
    enterMultiplayerMatch();
    return true;
}

// Slot zero belongs to the host. Keep assignments stable when other peers leave.
const spawnHouseSlots = new Map<string, number>();

function setCachedUsername(username: string): void {
    cachedUsername = username.trim() || 'Guest1';
    state.username = cachedUsername;
}

// Secure rooms supply their own short-lived STUN/TURN configuration. There is
// intentionally no public-relay fallback: it would turn a deployment outage
// into an unmetered abuse path under someone else's credentials.
async function getPeerConfig(roomCode: string, turnSessionToken: string): Promise<PeerJSConfig> {
    return {
        debug: 0,
        host: '0.peerjs.com',
        port: 443,
        path: '/',
        secure: true,
        config: {
            iceServers: await fetchTurnIceServers(roomCode, turnSessionToken),
        }
    };
}

function getCachedUsername(): string {
    // Lobby identity is fixed by the Worker reservation, never by a mutable input.
    return cachedUsername;
}

export function broadcastToAll(packet: NetworkPacket, excludePeerId: string | null = null): void {
    if (!state.isMultiplayer || state.connections.length === 0) return;
    if (state.isHost && packet.type === 'player_hit' && !packet.senderPeerId) {
        const now = performance.now();
        packet = { ...packet, senderPeerId: state.peer?.id, attackerName: getCachedUsername() };
        if (state.peer) lastDamageByVictim.set(packet.targetPeerId, { attackerPeerId: state.peer.id, at: now });
    }
    if (state.isHost && packet.type === 'player_died' && !packet.senderPeerId) {
        const latest = state.peer ? lastDamageByVictim.get(state.peer.id) : null;
        packet = { ...packet, senderPeerId: state.peer?.id, killerPeerId: packet.cause === 'player' ? latest?.attackerPeerId ?? null : null };
    }
    const recipients = [...state.connections];
    const connLen = recipients.length;
    for (let i = 0; i < connLen; i++) {
        const conn = recipients[i];
        if (conn.open && conn.peer !== excludePeerId) {
            try {
                conn.send(packet);
            } catch (err) {
                console.error(`Error broadcasting packet of type ${packet.type} to peer ${conn.peer}:`, err);
                try {
                    conn.close();
                } catch (closeErr) {
                }
            }
        }
    }
}

export function flashPeerMesh(peerData: PeerData, color = 0xff3333, durationMs = HIT_FLASH_DURATION_MS): void {
    pulseDamageMaterials(peerData, getBeanDamagePulseMaterials(peerData.mesh), color, durationMs);
}

let peerInstance: Peer | null = null;
let peerStartupTimeout: ReturnType<typeof setTimeout> | null = null;
let expectedHostProof: string | null = null;
let iceRefreshInterval: ReturnType<typeof setInterval> | null = null;
const connectionCleanup = new Map<DataConnectionLike, () => void>();
const admittedNames = new Map<string, string>();
let sessionGeneration = 0;
let disconnecting = false;
let persistentJoinError: string | null = null;
let worldSyncTimeout: ReturnType<typeof setTimeout> | null = null;
let clientWorldSynchronized = false;
let roomCloseToken: string | null = null;
let turnSessionToken: string | null = null;
let roomHeartbeatInterval: ReturnType<typeof setInterval> | null = null;

const pendingConnectionPeers = new Set<string>();
const targetStateFingerprints = new Map<number, string>();
const lastDamageByVictim = new Map<string, { attackerPeerId: string; at: number }>();
const MAX_PLAYER_HORIZONTAL_POSITION = MAP_HALF_SIZE + 100;
const MAX_PLAYER_VERTICAL_POSITION = 600;

interface PeerRuntimeState {
    username: string;
    position: THREE.Vector3;
    yaw: number;
    lastUpdateAt: number;
    shots: ShotLedger;
    lifeId: number;
    deathReported: boolean;
    activeWeapon: WeaponName;
    wasDead: boolean;
}

const peerRuntime = new Map<string, PeerRuntimeState>();

let lastSentTime = 0;
let lastForceSendTime = 0;
let lastSentSnapshot: {
    x: number;
    y: number;
    z: number;
    yaw: number;
    pitch: number;
    weapon: string;
    flags: number;
    hookX: number;
    hookY: number;
    hookZ: number;
    hp: number;
    maxHp: number;
} | null = null;

export function generateRoomCode(): string {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    const values = new Uint32Array(ROOM_CODE_LENGTH);
    const cryptoApi = globalThis.crypto;
    if (!cryptoApi?.getRandomValues) {
        throw new Error('Secure room creation requires Web Crypto support.');
    }
    cryptoApi.getRandomValues(values);
    let code = '';
    for (let i = 0; i < ROOM_CODE_LENGTH; i++) {
        // The alphabet is exactly 32 symbols, so the cryptographic random
        // value maps without modulo bias.
        const index = values[i] & 31;
        code += chars.charAt(index);
    }
    return code;
}

function getHostPeerId(): string | null {
    return state.roomCode ? `testfps-room-${state.roomCode}` : null;
}

function isCurrentSession(generation: number): boolean {
    return sessionGeneration === generation && state.isMultiplayer;
}

function clearWorldSyncTimeout(): void {
    if (worldSyncTimeout) {
        clearTimeout(worldSyncTimeout);
        worldSyncTimeout = null;
    }
}

function stopRoomHeartbeat(): void {
    if (roomHeartbeatInterval) {
        clearInterval(roomHeartbeatInterval);
        roomHeartbeatInterval = null;
    }
}

function startRoomHeartbeat(room: string, closeToken: string, generation: number): void {
    stopRoomHeartbeat();
    roomHeartbeatInterval = setInterval(() => {
        if (!isCurrentSession(generation) || !state.isHost || roomCloseToken !== closeToken) {
            stopRoomHeartbeat();
            return;
        }
        void heartbeatTurnRoom(room, closeToken, [...new Set([...state.connections.map(c => c.peer), ...pendingConnectionPeers])]).catch(() => {
            if (!isCurrentSession(generation)) return;
            // The active connection may continue, but do not hide the fact that
            // new relay credentials can no longer be issued for this room.
            const hostStatus = DOM.hostLobbyStatus();
            if (hostStatus) hostStatus.innerText = 'Room relay access could not be refreshed. New joins may be unavailable.';
        });
    }, 2 * 60 * 1_000);
}

function setJoinReady(ready: boolean, message?: string): void {
    const joinErrorLog = DOM.joinErrorLog();
    if (joinErrorLog && message) {
        joinErrorLog.style.color = ready ? '#00ff88' : '#57606f';
        joinErrorLog.innerText = message;
    }

    const btnJoinConnect = DOM.btnJoinConnect();
    if (!btnJoinConnect) return;
    btnJoinConnect.disabled = true;
    if (ready) {
        btnJoinConnect.innerText = 'Waiting for host…';
        btnJoinConnect.style.background = 'linear-gradient(135deg, #2ed573, #26af5f)';
        btnJoinConnect.removeAttribute('data-connected');
    } else {
        btnJoinConnect.innerText = 'Synchronizing world...';
        btnJoinConnect.style.background = '';
        btnJoinConnect.removeAttribute('data-connected');
    }
}

function buildTargetState(targetIndex: number): TargetState | null {
    const target = state.targets[targetIndex];
    if (!target) return null;
    const data = targetData(target);
    return {
        targetIndex,
        position: { x: target.position.x, y: target.position.y, z: target.position.z },
        maxHp: data.maxHp,
        hp: data.hp,
        scale: data.scale,
        color: data.color
    };
}

function targetStateFingerprint(target: TargetState): string {
    const { position } = target;
    return `${position.x.toFixed(3)}:${position.y.toFixed(3)}:${position.z.toFixed(3)}:${target.maxHp}:${target.hp}:${target.scale}:${target.color}`;
}

function applyTargetState(targetState: TargetState): boolean {
    const target = state.targets[targetState.targetIndex];
    if (!target) return false;
    const data = targetData(target);
    if (targetState.hp <= 0 || target.position.x !== targetState.position.x ||
        target.position.y !== targetState.position.y || target.position.z !== targetState.position.z) {
        cancelHookForTarget(target);
    }
    target.position.set(targetState.position.x, targetState.position.y, targetState.position.z);
    data.maxHp = targetState.maxHp;
    data.hp = targetState.hp;
    data.scale = targetState.scale;
    data.color = targetState.color;
    (data.bodyMesh.material as THREE.MeshStandardMaterial).color.setHex(targetState.color);
    data.bodyMesh.scale.setScalar(targetState.scale);
    data.healthBarFg.scale.x = Math.max(0, Math.min(1, targetState.hp / targetState.maxHp));
    data.healthBarGroup.position.y = 1.6 * targetState.scale;
    data.healthBarGroup.scale.set(targetState.scale, targetState.scale, 1);
    return true;
}

function setScore(score: number): void {
    state.score = score;
    const scoreEl = DOM.score();
    if (scoreEl) scoreEl.innerText = score.toString();
}

function sendWorldSnapshot(conn: DataConnectionLike, spawnHouseSlot: number): void {
    if (!state.isHost || !conn.open) return;
    const targets: TargetState[] = [];
    for (let i = 0; i < state.targets.length; i++) {
        const target = buildTargetState(i);
        if (target) {
            targets.push(target);
            targetStateFingerprints.set(i, targetStateFingerprint(target));
        }
    }
    const packet: WorldSnapshotPacket = {
        type: 'world_snapshot',
        gameStarted: state.isPlaying,
        username: admittedNames.get(conn.peer)!,
        senderPeerId: state.peer?.id,
        seed: getWorldSeed(),
        spawnHouseSlot,
        score: state.score,
        dayNightElapsedSeconds: state.dayNightElapsedSeconds,
        targets
    };
    try {
        conn.send(packet);
    } catch (error) {
        console.error(`Failed to send world snapshot to ${conn.peer}:`, error);
        conn.close();
    }
}

function syncHostTargetStates(): void {
    if (!state.isHost || !state.isMultiplayer || state.connections.length === 0) return;

    for (let i = 0; i < state.targets.length; i++) {
        const target = buildTargetState(i);
        if (!target) continue;
        const fingerprint = targetStateFingerprint(target);
        if (targetStateFingerprints.get(i) === fingerprint) continue;
        targetStateFingerprints.set(i, fingerprint);
        const packet: TargetStatePacket = { type: 'target_state', ...target };
        broadcastToAll(packet);
    }
}

let multiplayerWorldLoader: ((seed: number, current: () => boolean) => Promise<void>) | null = null;
let pendingWorldPackets: { peer: string; packet: NetworkPacket }[] | null = null;
export function setMultiplayerWorldLoader(loader: typeof multiplayerWorldLoader): void { multiplayerWorldLoader = loader; }

function applyWorldSnapshot(packet: WorldSnapshotPacket, prepared = false): void {
    if (!prepared) rebuildEnvironmentWithSeed(packet.seed);
    state.dayNightElapsedSeconds = packet.dayNightElapsedSeconds;
    state.dayNightSyncPending = true;
    state.dayNightSyncImmediate = true;
    placePlayerAtTownSpawn(packet.seed, 'house', packet.spawnHouseSlot);
    for (const target of packet.targets) {
        applyTargetState(target);
    }
    rebuildTargetHash();
    setScore(packet.score);
    clientWorldSynchronized = true;
    clearWorldSyncTimeout();
    setCachedUsername(packet.username);
    setJoinReady(true, `You are ${packet.username}. Waiting for the host to start the game…`);
    if (packet.gameStarted) enterMultiplayerMatch();
}

function isExpectedHost(fromPeerId: string): boolean {
    // The client only installs a data listener on its outbound host connection;
    // accepting the expected ID before its local `open` callback avoids dropping
    // a snapshot that races that callback.
    return !state.isHost && fromPeerId === getHostPeerId();
}

function isKnownClient(fromPeerId: string): boolean {
    return state.connections.some((connection) => connection.peer === fromPeerId);
}

function getActiveWeaponName(): WeaponName {
    return Object.prototype.hasOwnProperty.call(WEAPON_STATS, state.activeWeaponName)
        ? state.activeWeaponName as WeaponName
        : 'PISTOL';
}

function errorMessage(error: unknown, fallback: string): string {
    return error instanceof Error && error.message ? error.message : fallback;
}

function resetLocalMatch(): void {
    resetHook();
    resetProjectiles();
    disposeParticles();
    resetPlayerState();
    resetMatchStats();
}

// The host owns the stable room peer ID. Clients connect to that ID, and the
// host relays client packets to the rest of the room.
export async function hostGame(username: string, roomCode: string, turnstileToken: string): Promise<void> {
    if (state.isMultiplayer || peerInstance || roomCloseToken || turnSessionToken) disconnectMultiplayer();

    const generation = ++sessionGeneration;
    const normalizedRoomCode = roomCode.toUpperCase();
    disconnecting = false;
    state.isMultiplayer = true;
    state.isHost = true;
    state.roomCode = normalizedRoomCode;
    setCachedUsername(username);
    targetStateFingerprints.clear();
    resetLocalMatch();
    state.dayNightElapsedSeconds = 0;
    state.dayNightSyncPending = true;
    state.dayNightSyncImmediate = true;

    const hostPeerId = getHostPeerId()!;
    const hostStatus = DOM.hostLobbyStatus();

    try {
        const registration = await registerTurnRoom(normalizedRoomCode, turnstileToken, username, hostPeerId);
        if (!isCurrentSession(generation) || !state.isHost || state.roomCode !== normalizedRoomCode) {
            void closeTurnRoom(normalizedRoomCode, registration.closeToken).catch(() => {});
            return;
        }

        roomCloseToken = registration.closeToken;
        admittedNames.set(hostPeerId, username);
        turnSessionToken = registration.turnSessionToken;
        startRoomHeartbeat(normalizedRoomCode, registration.closeToken, generation);
        const seed = generateWorldSeed();
        if (multiplayerWorldLoader) await multiplayerWorldLoader(seed, () => isCurrentSession(generation));
        else rebuildEnvironmentWithSeed(seed);
        if (!isCurrentSession(generation)) return;
        placePlayerAtTownSpawn(getWorldSeed(), 'house');
        setScore(0);

        const { Peer } = await import('peerjs');
        const activeConfig = await getPeerConfig(normalizedRoomCode, registration.turnSessionToken);
        if (!isCurrentSession(generation) || !state.isHost) return;

        const peer = new Peer(hostPeerId, activeConfig);
        if (!isCurrentSession(generation) || !state.isHost) {
            peer.destroy();
            return;
        }
        peerInstance = peer;
        state.peer = peer;
        peerStartupTimeout = setTimeout(() => {
            if (!isCurrentSession(generation)) return;
            showJoinError('Signalling connection timed out. Please retry.');
            disconnectMultiplayer({ preserveJoinError: true });
        }, 20_000);
        startIceRefresh(peer, normalizedRoomCode, registration.turnSessionToken, generation);

        peer.on('open', (id: string) => {
            if (!isCurrentSession(generation)) return;
            if (peerStartupTimeout) clearTimeout(peerStartupTimeout);
            peerStartupTimeout = null;
            console.log('Host registered successfully on PeerJS with ID:', id);
            if (hostStatus) hostStatus.innerText = `Waiting for players (1/${MAX_PLAYERS})...`;
            const startBtn = DOM.btnHostStart();
            if (startBtn) startBtn.style.display = 'inline-block';
        });

        peer.on('connection', (conn) => {
            if (!isCurrentSession(generation) || !state.isHost) {
                conn.close();
                return;
            }
            const currentPlayers = state.connections.length + pendingConnectionPeers.size + 1;
            const duplicate = pendingConnectionPeers.has(conn.peer) || state.connections.some((item) => item.peer === conn.peer);
            if (duplicate || currentPlayers >= MAX_PLAYERS) {
                console.warn(`Rejecting ${duplicate ? 'duplicate' : 'full-room'} connection from ${conn.peer}`);
                conn.close();
                return;
            }
            pendingConnectionPeers.add(conn.peer);
            setupConnection(conn, generation);
        });

        peer.on('error', (err) => {
            if (!isCurrentSession(generation)) return;
            console.error('Host peer error:', err);
            if (hostStatus) {
                if (err.type === 'unavailable-id') {
                    hostStatus.innerText = 'Error: Code already in use! Please try again.';
                } else {
                    hostStatus.innerText = `Error: ${err.type || 'connection failed'}`;
                }
            }
            disconnectMultiplayer();
        });
    } catch (error) {
        if (!isCurrentSession(generation)) return;
        console.error('Failed to create host peer:', error);
        disconnectMultiplayer();
        throw new Error(errorMessage(error, 'Unable to create the room. Please retry.'));
    }
}

export async function joinGame(username: string, roomCode: string, turnstileToken: string): Promise<void> {
    if (state.isMultiplayer || peerInstance || roomCloseToken || turnSessionToken) disconnectMultiplayer();

    const generation = ++sessionGeneration;
    const normalizedRoomCode = roomCode.toUpperCase();
    disconnecting = false;
    state.isMultiplayer = true;
    state.isHost = false;
    state.roomCode = normalizedRoomCode;
    setCachedUsername(username);
    clientWorldSynchronized = false;
    persistentJoinError = null;
    clearWorldSyncTimeout();
    resetLocalMatch();

    const clientPeerId = `player-${crypto.randomUUID()}`;
    const joinError = DOM.joinErrorLog();
    if (joinError) joinError.innerText = 'Authorizing secure room access...';

    try {
        const registration = await registerTurnSession(normalizedRoomCode, turnstileToken, username, clientPeerId);
        if (!isCurrentSession(generation) || state.isHost || state.roomCode !== normalizedRoomCode) {
            void releaseTurnSession(normalizedRoomCode, registration.turnSessionToken).catch(() => {});
            return;
        }

        turnSessionToken = registration.turnSessionToken;
        expectedHostProof = registration.admissionProof;
        const { Peer } = await import('peerjs');
        const activeConfig = await getPeerConfig(normalizedRoomCode, registration.turnSessionToken);
        if (!isCurrentSession(generation) || state.isHost) return;

        const peer = new Peer(clientPeerId, activeConfig);
        if (!isCurrentSession(generation) || state.isHost) {
            peer.destroy();
            return;
        }
        peerInstance = peer;
        state.peer = peer;
        peerStartupTimeout = setTimeout(() => {
            if (!isCurrentSession(generation)) return;
            showJoinError('Signalling connection timed out. Please retry.');
            disconnectMultiplayer({ preserveJoinError: true });
        }, 20_000);
        startIceRefresh(peer, normalizedRoomCode, registration.turnSessionToken, generation);

        peer.on('open', (clientId: string) => {
            if (!isCurrentSession(generation)) return;
            if (peerStartupTimeout) clearTimeout(peerStartupTimeout);
            peerStartupTimeout = null;
            console.log('Client registered with ID:', clientId);
            if (joinError) joinError.innerText = `Searching room ${state.roomCode}...`;
            const hostPeerId = getHostPeerId();
            if (!hostPeerId) return;
            const conn = peer.connect(hostPeerId, { metadata: { admissionToken: registration.admissionToken } });

            setupConnection(conn, generation);
        });

        peer.on('error', (err) => {
            if (!isCurrentSession(generation)) return;
            console.error('Client peer error:', err);
            showJoinError(err.type === 'peer-unavailable'
                ? 'Error: Room not found! Please check the code.'
                : `Error: ${err.type || 'connection failed'}`);
            disconnectMultiplayer({ preserveJoinError: true });
        });
    } catch (error) {
        if (!isCurrentSession(generation)) return;
        const message = errorMessage(error, 'Unable to start a connection. Please try again.');
        console.error('Failed to create client peer:', error);
        showJoinError(message);
        disconnectMultiplayer({ preserveJoinError: true });
        throw new Error(message);
    }
}

export function disconnectMultiplayer(options: { preserveJoinError?: boolean } = {}): void {
    if (disconnecting) return;
    disconnecting = true;
    if (healthInterval) clearInterval(healthInterval);
    healthInterval = null;
    const roomToRelease = state.roomCode;
    const wasHost = state.isHost;
    const closeToken = roomCloseToken;
    const sessionToken = turnSessionToken;
    roomCloseToken = null;
    turnSessionToken = null;
    stopRoomHeartbeat();
    sessionGeneration++;
    pendingWorldPackets = null;
    if (peerStartupTimeout) clearTimeout(peerStartupTimeout);
    peerStartupTimeout = null;
    if (iceRefreshInterval) clearInterval(iceRefreshInterval);
    iceRefreshInterval = null;
    expectedHostProof = null;
    for (const cleanup of [...connectionCleanup.values()]) cleanup();
    connectionCleanup.clear();
    admittedNames.clear();
    spawnHouseSlots.clear();
    clearWorldSyncTimeout();
    state.isMultiplayer = false;
    state.isHost = false;
    state.isPlaying = false;
    state.pendingPlay = false;
    state.isMouseDown = false;
    state.moveForward = state.moveBackward = state.moveLeft = state.moveRight = false;
    state.isShiftDown = state.isHovering = false;
    state.roomCode = null;
    state.kills = 0;
    state.deaths = 0;
    lastSentSnapshot = null;
    lastSentTime = 0;
    lastForceSendTime = 0;
    clientWorldSynchronized = false;
    state.dayNightSyncPending = false;
    state.dayNightSyncImmediate = false;
    targetStateFingerprints.clear();
    peerRuntime.clear();
    pendingConnectionPeers.clear();
    lastDamageByVictim.clear();

    const pvpStats = DOM.pvpStats();
    if (pvpStats) pvpStats.style.display = 'none';

    const connections = state.connections;
    state.connections = [];
    connections.forEach((conn) => conn.close());

    if (peerInstance) {
        peerInstance.destroy();
        peerInstance = null;
    }
    state.peer = null;

    Object.keys(state.peers).forEach((peerId) => {
        removePeer(peerId);
    });
    state.peers = {};
    state.peerIds = [];

    resetHook();

    const btnJoinConnect = DOM.btnJoinConnect();
    if (btnJoinConnect) {
        btnJoinConnect.innerText = 'Connect';
        btnJoinConnect.style.background = '';
        btnJoinConnect.disabled = false;
        btnJoinConnect.removeAttribute('data-connected');
    }
    const joinErrorLog = DOM.joinErrorLog();
    if (options.preserveJoinError && persistentJoinError) {
        if (joinErrorLog) {
            joinErrorLog.style.color = '#ff4757';
            joinErrorLog.innerText = persistentJoinError;
        }
    } else {
        persistentJoinError = null;
        if (joinErrorLog) {
            joinErrorLog.style.color = '';
            joinErrorLog.innerText = '';
        }
    }

    if (roomToRelease && wasHost && closeToken) {
        void closeTurnRoom(roomToRelease, closeToken).catch(() => {
            // Credential expiry and the Worker room timeout still limit a
            // failed best-effort close when the browser is going away.
        });
    } else if (roomToRelease && sessionToken) {
        void releaseTurnSession(roomToRelease, sessionToken).catch(() => {
            // A short server-side session expiry is the fallback cleanup path.
        });
    }
    disconnecting = false;
}

function showJoinError(msg: string): void {
    persistentJoinError = msg;
    const joinErrorLog = DOM.joinErrorLog();
    if (joinErrorLog) {
        joinErrorLog.style.color = '#ff4757';
        joinErrorLog.innerText = msg;
    }
    const btnJoinConnect = DOM.btnJoinConnect();
    if (btnJoinConnect) {
        btnJoinConnect.innerText = 'Connect';
        btnJoinConnect.style.background = '';
        btnJoinConnect.disabled = false;
        btnJoinConnect.removeAttribute('data-connected');
    }
}

function startIceRefresh(peer: Peer, room: string, token: string, generation: number): void {
    if (iceRefreshInterval) clearInterval(iceRefreshInterval);
    let pending = false;
    iceRefreshInterval = setInterval(() => {
        if (!isCurrentSession(generation) || peerInstance !== peer || pending) return;
        pending = true;
        void fetchTurnIceServers(room, token).then(iceServers => {
            if (!isCurrentSession(generation) || peerInstance !== peer) return;
            // PeerJS reads options.config when constructing each RTCPeerConnection.
            peer.options.config = { ...peer.options.config, iceServers };
            for (const connections of Object.values(peer.connections)) {
                for (const connection of connections) {
                    if (connection.peerConnection?.signalingState !== 'closed') connection.peerConnection?.setConfiguration(peer.options.config);
                }
            }
        }).catch(() => {
            if (!isCurrentSession(generation)) return;
            showJoinError('Relay refresh failed. Leave and rejoin if your network connection stops working.');
        }).finally(() => { pending = false; });
    }, 4 * 60_000);
}

export function setupConnection(conn: DataConnectionLike, generation: number): void {
    let closed = false;
    let admitted = false;
    let opening = false;
    const current = () => !closed && isCurrentSession(generation);
    const cleanup = () => { closed = true; clearTimeout(timeoutId); connectionCleanup.delete(conn); conn.close(); };
    const timeoutId = setTimeout(() => {
        if (!current() || admitted) return;
        if (!state.isHost) showJoinError('Connection authorization timed out. Please retry.');
        handleClose(); // PeerJS does not emit close for a channel that never opened.
        conn.close();
        if (current() && !state.isHost) disconnectMultiplayer({ preserveJoinError: true });
    }, 20_000);
    connectionCleanup.set(conn, cleanup);
    const handleOpen = async () => {
        if (!current() || opening) return;
        opening = true;
        if (!state.isHost) return; // Wait for the proof delivered by the verified host.
        const room = state.roomCode;
        const closeToken = roomCloseToken;
        const metadata = conn.metadata as { admissionToken?: unknown } | null;
        if (!room || !closeToken || !isCapability(metadata?.admissionToken)) { conn.close(); return; }
        try {
            const result = await admitRoomPeer(room, closeToken, conn.peer, metadata.admissionToken);
            if (!current()) { void departRoomPeer(room, closeToken, conn.peer).catch(() => {}); return; }
            if (!isUsername(result.username) || !isCapability(result.admissionProof)) throw new Error('Invalid admission response.');
            const usedSlots = new Set(spawnHouseSlots.values());
            let slot = 1;
            while (usedSlots.has(slot)) slot++;
            if (slot >= MAX_PLAYERS) throw new Error('No spawn house available.');
            spawnHouseSlots.set(conn.peer, slot);
            admittedNames.set(conn.peer, result.username);
            admitted = true;
            clearTimeout(timeoutId);
            pendingConnectionPeers.delete(conn.peer);
            state.connections.push(conn);
            conn.send({ type: 'admission', proof: result.admissionProof });
            sendWorldSnapshot(conn, slot);
            // A late join must see the host even when its render loop is paused
            // or browser-throttled. Do not wait for the next animation frame.
            sendLocalState(true);
            const status = DOM.hostLobbyStatus();
            if (status) status.innerText = `Waiting for players (${state.connections.length + 1}/${MAX_PLAYERS})...`;
        } catch { if (current()) conn.close(); }
    };
    conn.on('data', (data: unknown) => {
        if (!current()) return;
        if (!admitted) {
            if (state.isHost) return;
            const proof = data as { type?: unknown; proof?: unknown } | null;
            if (!proof || proof.type !== 'admission' || !expectedHostProof || proof.proof !== expectedHostProof) { conn.close(); return; }
            admitted = true;
            expectedHostProof = null;
            clearTimeout(timeoutId);
            state.connections.push(conn);
            setJoinReady(false, 'Connected. Synchronizing host world...');
            worldSyncTimeout = setTimeout(() => {
                if (current() && !clientWorldSynchronized) { showJoinError('World synchronization timed out.'); disconnectMultiplayer({ preserveJoinError: true }); }
            }, 10_000);
            return;
        }
        handlePeerMessage(conn.peer, data);
    });
    const handleClose = () => {
        if (!current()) return;
        closed = true;
        clearTimeout(timeoutId);
        connectionCleanup.delete(conn);
        pendingConnectionPeers.delete(conn.peer);
        const index = state.connections.indexOf(conn);
        if (index >= 0) state.connections.splice(index, 1);
        peerRuntime.delete(conn.peer);
        admittedNames.delete(conn.peer);
        spawnHouseSlots.delete(conn.peer);
        lastDamageByVictim.delete(conn.peer);
        removePeer(conn.peer);
        if (state.isHost) {
            if (admitted) {
                broadcastToAll({ type: 'peer_left', peerId: conn.peer });
                if (state.roomCode && roomCloseToken) void departRoomPeer(state.roomCode, roomCloseToken, conn.peer).catch(() => {});
            }
            const status = DOM.hostLobbyStatus();
            if (status) status.innerText = `Waiting for players (${state.connections.length + 1}/${MAX_PLAYERS})...`;
        } else {
            showJoinError('Connection to the host was closed.');
            disconnectMultiplayer({ preserveJoinError: true });
            endInput();
            const blocker = DOM.blocker(); if (blocker) blocker.style.display = 'flex';
            for (const id of ['panel-mp', 'panel-host-waiting', 'panel-join-room', 'panel-pause', 'death-overlay']) {
                const el = document.getElementById(id); if (el) el.style.display = 'none';
            }
            const panel = DOM.panelMain(); if (panel) panel.style.display = 'flex';
        }
    };
    conn.on('close', handleClose);
    conn.on('error', () => { if (current()) { handleClose(); conn.close(); } });
    if (conn.open) void handleOpen(); else conn.on('open', () => { void handleOpen(); });
}

function getPeerRuntime(peerId: string): PeerRuntimeState | null {
    return peerRuntime.get(peerId) ?? null;
}

function shotIsBlocked(start: THREE.Vector3, end: THREE.Vector3): boolean {
    const obstacleCandidates = queryObstaclesAlongSegment(start.x, start.z, end.x, end.z, _shotObstacleCandidates);
    for (let index = 0; index < obstacleCandidates.length; index++) {
        const obstacle = obstacleCandidates[index];
        const data = obstacleData(obstacle);
        const halfW = (data.halfW || PILLAR_WIDTH / 2) + PROJECTILE_RADIUS;
        const halfD = (data.halfD || PILLAR_WIDTH / 2) + PROJECTILE_RADIUS;
        const halfH = (data.halfH || data.height / 2) + PROJECTILE_RADIUS;
        _shotAabbMin.set(obstacle.position.x - halfW, obstacle.position.y - halfH, obstacle.position.z - halfD);
        _shotAabbMax.set(obstacle.position.x + halfW, obstacle.position.y + halfH, obstacle.position.z + halfD);
        const hitT = segmentAabbHitT(start, end, _shotAabbMin, _shotAabbMax);
        if (hitT !== null && hitT < 0.999) return true;
    }
    return false;
}

function getPeerHitPosition(peerId: string): THREE.Vector3 | null {
    if (peerId === state.peer?.id) {
        const player = state.controls?.getObject();
        if (!player) return null;
        _peerTargetPosition.copy(player.position);
        _peerTargetPosition.y -= PEER_Y_OFFSET;
        return _peerTargetPosition;
    }

    const runtime = getPeerRuntime(peerId);
    if (!runtime) return null;
    _peerTargetPosition.copy(runtime.position);
    _peerTargetPosition.y -= PEER_Y_OFFSET;
    return _peerTargetPosition;
}

function getPeerHitYaw(peerId: string): number | null {
    if (peerId === state.peer?.id) {
        if (!state.camera) return null;
        return _stateEuler.setFromQuaternion(state.camera.quaternion, 'YXZ').y;
    }
    return getPeerRuntime(peerId)?.yaw ?? null;
}

function authorizeHomingTarget(fromPeerId: string, packet: FirePacket): boolean {
    const homingTarget = packet.homingTarget;
    if (!homingTarget || packet.weapon === 'SNIPER') return !homingTarget;
    _barrelPos.set(packet.barrelPos.x, packet.barrelPos.y, packet.barrelPos.z);
    _baseFireDir.set(packet.dir.x, packet.dir.y, packet.dir.z).normalize();

    if (homingTarget.kind === 'npc') {
        const target = state.targets[homingTarget.targetIndex];
        if (!target) return false;
        const data = targetData(target);
        if (data.hp <= 0 || (data.eliminationRevision ?? 0) !== homingTarget.targetRevision) return false;
        return isWithinHomingAimEnvelope(
            _barrelPos,
            _baseFireDir,
            target.position,
            Math.sqrt(3) * (data.scale || 1),
            BULLET_TRAVEL_DISTANCE,
        );
    }

    if (homingTarget.targetPeerId === fromPeerId) return false;
    const targetsHost = homingTarget.targetPeerId === state.peer?.id;
    const targetRuntime = targetsHost ? null : getPeerRuntime(homingTarget.targetPeerId);
    const targetPosition = getPeerHitPosition(homingTarget.targetPeerId);
    if (!targetPosition || homingTarget.targetLifeId !== (targetsHost ? state.lifeId : targetRuntime?.lifeId) ||
        (targetsHost ? state.playerHp <= 0 : targetRuntime?.wasDead !== false) ||
        (!targetsHost && !state.peers[homingTarget.targetPeerId])) return false;
    return isWithinHomingAimEnvelope(
        _barrelPos,
        _baseFireDir,
        targetPosition,
        PLAYER_HITBOX_BOUNDING_RADIUS,
        BULLET_TRAVEL_DISTANCE,
    );
}

/** Keep a reported sniper impact on its shot ray and within visual weapon range. */
function canonicalSniperBeamEnd(
    barrelPosition: THREE.Vector3,
    normalizedDirection: THREE.Vector3,
    reportedHitPoint: FirePacket['hitPoint'],
    out: THREE.Vector3,
): THREE.Vector3 {
    let distance = BULLET_TRAVEL_DISTANCE;
    if (reportedHitPoint) {
        const offsetX = reportedHitPoint.x - barrelPosition.x;
        const offsetY = reportedHitPoint.y - barrelPosition.y;
        const offsetZ = reportedHitPoint.z - barrelPosition.z;
        distance = THREE.MathUtils.clamp(
            offsetX * normalizedDirection.x + offsetY * normalizedDirection.y + offsetZ * normalizedDirection.z,
            0,
            BULLET_TRAVEL_DISTANCE,
        );
    }
    return out.copy(barrelPosition).addScaledVector(normalizedDirection, distance);
}

export function authorizeClientPacket(fromPeerId: string, packet: NetworkPacket): NetworkPacket | null {
    if (!isKnownClient(fromPeerId)) return null;
    const now = performance.now();

    if (packet.type === 'update') {
        const reservedName = admittedNames.get(fromPeerId);
        if (!reservedName) return null;
        packet = { ...packet, username: reservedName };
        if (Math.abs(packet.pos.x) > MAX_PLAYER_HORIZONTAL_POSITION ||
            Math.abs(packet.pos.z) > MAX_PLAYER_HORIZONTAL_POSITION ||
            packet.pos.y < -20 || packet.pos.y > MAX_PLAYER_VERTICAL_POSITION) return null;
        let runtime = getPeerRuntime(fromPeerId);
        if (!runtime) {
            runtime = {
                username: packet.username,
                position: new THREE.Vector3(packet.pos.x, packet.pos.y, packet.pos.z),
                yaw: packet.yaw,
                lastUpdateAt: now,
                shots: new ShotLedger(),
                lifeId: packet.lifeId,
                deathReported: false,
                activeWeapon: packet.activeWeapon,
                wasDead: packet.isDead
            };
            peerRuntime.set(fromPeerId, runtime);
        } else {
            const oldLife = runtime.lifeId;
            if (!acceptLifeUpdate(runtime, packet.lifeId, packet.isDead)) return null;
            if (oldLife !== runtime.lifeId) { runtime.shots.reset(); lastDamageByVictim.delete(fromPeerId); }
            const elapsed = Math.min(1, Math.max(0.016, (now - runtime.lastUpdateAt) / 1000));
            const maxTravel = 75 + 450 * elapsed;
            const nextPosition = _targetPos.set(packet.pos.x, packet.pos.y, packet.pos.z);
            if (nextPosition.distanceTo(runtime.position) > maxTravel && oldLife === runtime.lifeId && !packet.isDead && !runtime.wasDead) {
                return null;
            }
            runtime.position.copy(nextPosition);
            runtime.yaw = packet.yaw;
            runtime.lastUpdateAt = now;
            runtime.username = packet.username;
            runtime.activeWeapon = packet.activeWeapon;
            runtime.wasDead = packet.isDead;
        }
        runtime.shots.updateTrigger(packet.isMouseDown && packet.activeWeapon === 'MINIGUN', now);
        return { ...packet, senderPeerId: fromPeerId };
    }

    const runtime = getPeerRuntime(fromPeerId);
    if (!runtime) return null;

    if (packet.type === 'fire') {
        const stats = WEAPON_STATS[packet.weapon];
        if (!stats || packet.weapon !== runtime.activeWeapon || runtime.wasDead) return null;
        _barrelPos.set(packet.barrelPos.x, packet.barrelPos.y, packet.barrelPos.z);
        if (_barrelPos.distanceTo(runtime.position) > 5 || shotIsBlocked(runtime.position, _barrelPos)) return null;
        if (!authorizeHomingTarget(fromPeerId, packet)) return null;
        if (!runtime.shots.record(packet, now, runtime.wasDead)) return null;
        if (packet.weapon === 'SNIPER') {
            _baseFireDir.set(packet.dir.x, packet.dir.y, packet.dir.z).normalize();
            canonicalSniperBeamEnd(_barrelPos, _baseFireDir, packet.hitPoint, _targetPos);
            packet = {
                ...packet,
                hitPoint: { x: _targetPos.x, y: _targetPos.y, z: _targetPos.z },
            };
        }
        return { ...packet, senderPeerId: fromPeerId };
    }

    if (packet.type === 'hit_target') {
        const target = state.targets[packet.targetIndex];
        if (!target) return null;
        const targetInfo = targetData(target);
        const targetRadius = TARGET_HIT_RANGE_MULTIPLIER * (targetInfo.scale || 1.0);
        const targetRevision = targetInfo.eliminationRevision ?? 0;
        if (!runtime.shots.consumeHomingNpc(
            packet.shotId,
            packet.pelletIndex,
            packet.targetIndex,
            targetRevision,
            target.position,
            targetRadius,
            packet.damage,
            now,
            shotIsBlocked,
        ) && !runtime.shots.consume(
            packet.shotId,
            packet.pelletIndex,
            target.position,
            targetRadius,
            packet.damage,
            now,
            shotIsBlocked,
        )) return null;
        return { ...packet, senderPeerId: fromPeerId };
    }

    if (packet.type === 'player_hit') {
        const targetsHost = packet.targetPeerId === state.peer?.id;
        const targetPosition = getPeerHitPosition(packet.targetPeerId);
        const targetYaw = getPeerHitYaw(packet.targetPeerId);
        if (packet.targetLifeId !== (targetsHost ? state.lifeId : getPeerRuntime(packet.targetPeerId)?.lifeId)) return null;
        if ((targetsHost ? state.playerHp <= 0 : getPeerRuntime(packet.targetPeerId)?.wasDead !== false) || packet.targetPeerId === fromPeerId || (!targetsHost && !state.peers[packet.targetPeerId]) || !targetPosition || targetYaw === null ||
            (!runtime.shots.consumeHomingPeer(
                packet.shotId,
                packet.pelletIndex,
                packet.targetPeerId,
                packet.targetLifeId,
                targetPosition,
                PLAYER_HITBOX_BOUNDING_RADIUS,
                packet.damage,
                now,
                shotIsBlocked,
            ) && !runtime.shots.consumePlayerHitbox(
                packet.shotId,
                packet.pelletIndex,
                targetPosition,
                targetYaw,
                packet.damage,
                now,
                shotIsBlocked,
            ))) return null;
        lastDamageByVictim.set(packet.targetPeerId, { attackerPeerId: fromPeerId, at: now });
        return { ...packet, senderPeerId: fromPeerId, attackerName: runtime.username };
    }

    if (packet.type === 'player_died') {
        let killerName = 'Lava';
        let killerPeerId: string | null = null;
        if (packet.cause === 'player') {
            const latestDamage = lastDamageByVictim.get(fromPeerId);
            if (!latestDamage || now - latestDamage.at > 10000) return null;
            killerPeerId = latestDamage.attackerPeerId;
            const name = killerPeerId === state.peer?.id ? getCachedUsername() : admittedNames.get(killerPeerId);
            // A killer leaving before the death report must not block the victim's next life.
            killerName = name ?? 'Guest';
        }
        if (!acceptDeath(runtime, packet.lifeId)) return null;
        runtime.shots.reset();
        lastDamageByVictim.delete(fromPeerId);
        return { ...packet, senderPeerId: fromPeerId, victimPeerId: fromPeerId,
            victimName: runtime.username, killerName, killerPeerId };
    }

    if (packet.type === 'jump') {
        return { ...packet, senderPeerId: fromPeerId };
    }

    // World snapshots and target mutation packets are host-only.
    return null;
}

function spawnRemoteBullet(
    barrelPos: THREE.Vector3,
    direction: THREE.Vector3,
    color: number,
    homingTarget: ProjectileHomingTarget | null,
    homingStartDistance?: number,
): void {
    if (state.projectiles.length >= MAX_PROJECTILES || !state.scene) return;
    let bullet: THREE.Mesh;
    if (state.projectilePool.length > 0) {
        bullet = state.projectilePool.pop() as THREE.Mesh;
        bullet.visible = true;
        (bullet.material as THREE.MeshBasicMaterial).color.setHex(color);
    } else {
        bullet = new THREE.Mesh(SHARED_PROJECTILE_GEO, new THREE.MeshBasicMaterial({ color }));
        bullet.userData = {};
    }
    bullet.position.copy(barrelPos).addScaledVector(direction, 0.1);
    const data = projectileData(bullet);
    data.dx = direction.x;
    data.dy = direction.y;
    data.dz = direction.z;
    data.age = 0;
    data.distanceTraveled = bullet.position.distanceTo(barrelPos);
    data.visualOnly = true;
    data.damage = undefined;
    data.homingTarget = homingTarget ?? undefined;
    data.homingStartDistance = homingTarget
        ? homingStartDistance ?? (resolveProjectileHomingTarget(
            homingTarget,
            state.targets,
            state.peers,
            _targetPos,
        ) ? barrelPos.distanceTo(_targetPos) * PROJECTILE_HOMING_START_FRACTION : undefined)
        : undefined;
    beginProjectileTrail(bullet, state.scene, color);
    state.scene.add(bullet);
    state.projectiles.push(bullet);
}

// Packet router. The host is authoritative for target health/respawns and also
// relays validated client gameplay packets in a star topology.
export function handlePeerMessage(fromPeerId: string, rawPacket: unknown): void {
    if (!state.isMultiplayer) return;
    const parsed = parseNetworkPacket(rawPacket);
    if (!parsed) {
        console.warn(`Discarded malformed packet from ${fromPeerId}`);
        return;
    }

    let msg: NetworkPacket = parsed;
    if (state.isHost) {
        if (!state.isPlaying) return;
        const authorized = authorizeClientPacket(fromPeerId, parsed);
        if (!authorized) return;
        msg = authorized;
        if (!state.isPlaying) return;
        if (msg.type === 'update' || msg.type === 'fire' || msg.type === 'hit_target' || msg.type === 'player_hit' || msg.type === 'player_died' || msg.type === 'jump') {
            // The shooter also receives validated player hits so its copy of the
            // victim's health changes immediately. Ordinary self-originated
            // movement/fire events still do not need to echo back.
            broadcastToAll(msg, msg.type === 'player_hit' || msg.type === 'hit_target' ? null : fromPeerId);
        }
    } else {
        if (!isExpectedHost(fromPeerId)) return;
        if (pendingWorldPackets) {
            if (pendingWorldPackets.length >= 4096) {
                showJoinError('World preparation received too many updates. Please retry.');
                disconnectMultiplayer({ preserveJoinError: true });
            } else if (msg.type !== 'world_snapshot') pendingWorldPackets.push({ peer: fromPeerId, packet: msg });
            return;
        }
        if (msg.type === 'start_game') {
            if (clientWorldSynchronized) enterMultiplayerMatch();
            return;
        }
        if (msg.type === 'peer_left') { removePeer(msg.peerId); return; }
        if (msg.type === 'world_snapshot') {
            if (clientWorldSynchronized) return;
            if (!multiplayerWorldLoader) { applyWorldSnapshot(msg); return; }
            const generation = sessionGeneration;
            const snapshot = msg;
            pendingWorldPackets = [];
            clearWorldSyncTimeout();
            void multiplayerWorldLoader(snapshot.seed, () => isCurrentSession(generation)).then(() => {
                if (!isCurrentSession(generation)) return;
                const queued = pendingWorldPackets ?? [];
                pendingWorldPackets = null;
                applyWorldSnapshot(snapshot, true);
                for (const item of queued) handlePeerMessage(item.peer, item.packet);
            }).catch(error => {
                if (!isCurrentSession(generation)) return;
                showJoinError(errorMessage(error, 'Unable to prepare the world. Please retry.'));
                disconnectMultiplayer({ preserveJoinError: true });
            });
            return;
        }
        if (msg.type === 'target_state') {
            if (applyTargetState(msg)) rebuildTargetHash();
            return;
        }
        if (msg.type === 'update' &&
            (msg.senderPeerId === undefined || msg.senderPeerId === getHostPeerId()) &&
            msg.dayNightElapsedSeconds !== undefined) {
            state.dayNightElapsedSeconds = msg.dayNightElapsedSeconds;
            state.dayNightSyncPending = true;
        }
        if (!clientWorldSynchronized || (!state.isPlaying && msg.type !== 'kill_target')) return;
    }

    const senderId = msg.senderPeerId || fromPeerId;

    if (msg.type === 'update') {
        let peerData = state.peers[senderId] as PeerData | undefined;
        let justJoined = false;
        if (!peerData) {
            const username = msg.username || 'Guest';
            console.log(`Spawning remote peer bean model for: ${username}`);
            peerData = createPeerBean(username);
            state.peers[senderId] = peerData;
            state.peerIds = Object.keys(state.peers);
            justJoined = true;
        }

        // Relayed movement may have been queued before a death notification.
        // It must not resurrect the old life or overwrite a newer spawn.
        if (peerData.lifeId !== undefined && (msg.lifeId < peerData.lifeId ||
            (msg.lifeId === peerData.lifeId && peerData.deathReported && !msg.isDead))) return;
        if (msg.lifeId !== peerData.lifeId) peerData.deathReported = false;
        peerData.lifeId = msg.lifeId;
        const previousHp = peerData.hp;
        peerData.hp = msg.hp;
        peerData.maxHp = msg.maxHp;
        peerData.username = msg.username;
        if (msg.hp < previousHp) {
            peerData.lastDamageTime = performance.now();
            peerData.regenTimer = 0;
        } else if (msg.hp <= 0 || msg.hp >= msg.maxHp || previousHp <= 0) {
            peerData.regenTimer = 0;
        }

        if (msg.bodyColor !== undefined) setBeanColor(peerData.mesh, msg.bodyColor);
        _targetPos.set(msg.pos.x, msg.pos.y - PEER_Y_OFFSET, msg.pos.z);
        peerData.targetPosition.copy(_targetPos);
        peerData.targetYaw = msg.yaw;
        if (justJoined) {
            peerData.mesh.position.copy(peerData.targetPosition);
            peerData.mesh.rotation.y = msg.yaw;
        }

        if (msg.isDead) {
            peerData.hp = 0;
            peerData.mesh.visible = false;
        } else {
            if (justJoined) {
                peerData.mesh.visible = true;
            } else if (peerData.mesh.visible === false) {
                // A new life starts at a spawn, not along an interpolation path
                // from the previous death position. This also gives the HUD one
                // clean retiring lock instead of a trail of teleport records.
                peerData.mesh.position.copy(peerData.targetPosition);
                peerData.mesh.rotation.y = msg.yaw;
                peerData.mesh.visible = true;
            }

            if (msg.isHovering) {
                const now = performance.now();
                // Packets arrive at 30 Hz per peer. Exhaust is visual-only, so
                // limit it to a render-friendly cadence instead of allowing a
                // full room to consume the global particle budget every tick.
                if ((peerData.lastRemoteExhaustTime ?? -Infinity) + 100 <= now) {
                    peerData.lastRemoteExhaustTime = now;
                    _boosterPos.copy(peerData.mesh.position);
                    _boosterPos.y -= 1.45;
                    spawnRocketFlame(_boosterPos, 4, false);

                    if (msg.hoverKeys) {
                        _peerEuler.set(0, msg.yaw, 0);
                        _peerForward.set(0, 0, -1).applyEuler(_peerEuler);
                        _peerRight.set(1, 0, 0).applyEuler(_peerEuler);

                        if (msg.hoverKeys.w) {
                            _peerForward.negate();
                            spawnManeuveringBeam(_boosterPos, 2, _peerForward);
                            _peerForward.negate();
                        }
                        if (msg.hoverKeys.s) spawnManeuveringBeam(_boosterPos, 2, _peerForward);
                        if (msg.hoverKeys.a) spawnManeuveringBeam(_boosterPos, 2, _peerRight);
                        if (msg.hoverKeys.d) {
                            _peerRight.negate();
                            spawnManeuveringBeam(_boosterPos, 2, _peerRight);
                        }
                    }
                }
            }
        }

        peerData.leftGun.rotation.x = msg.pitch;
        peerData.rightGunContainer.rotation.x = msg.pitch;

        peerData.pistolMesh.visible = (msg.activeWeapon === 'PISTOL');
        peerData.shotgunMesh.visible = (msg.activeWeapon === 'SHOTGUN');
        peerData.arMesh.visible = (msg.activeWeapon === 'AR');
        peerData.sniperMesh.visible = (msg.activeWeapon === 'SNIPER');
        peerData.minigunMesh.visible = (msg.activeWeapon === 'MINIGUN');

        if (msg.hookState === 'FIRING' && peerData.lastHookState !== 'FIRING') {
            triggerMuzzleFlash(peerData.leftGun);
        }
        peerData.lastHookState = msg.hookState;

        if (msg.activeWeapon === 'MINIGUN' && peerData.minigunMesh && peerData.minigunMesh.userData.barrels) {
            if (peerData.minigunRamp === undefined)      peerData.minigunRamp = 0.0;
            if (peerData.lastUpdateTime === undefined)   peerData.lastUpdateTime = performance.now();

            const now = performance.now();

            const dt = Math.min((now - peerData.lastUpdateTime) / 1000, 0.1);
            peerData.lastUpdateTime = now;

            if (msg.isMouseDown) {
                peerData.minigunRamp = Math.min(3.0, peerData.minigunRamp + dt);
            } else {
                peerData.minigunRamp = Math.max(0.0, peerData.minigunRamp - dt * 2.0);
            }
            
            const spinSpeed = (peerData.minigunRamp / 3.0) * 40.0 + (msg.isMouseDown ? 5.0 : 0.0);
            peerData.minigunMesh.userData.barrels.rotation.z += spinSpeed * dt;
        }

        if (!msg.isDead && msg.hookState !== 'IDLE' && msg.hookPos) {
            if (!peerData.hookLine) {
                peerData.hookLine = new THREE.Mesh(SHARED_HOOK_GEO, SHARED_HOOK_MAT);
                peerData.hookLine.castShadow = true;
                state.scene!.add(peerData.hookLine);
            }

            peerData.leftGun.updateWorldMatrix(true, false);
            _gunTip.copy(GUN_TIP_OFFSET);
            peerData.leftGun.localToWorld(_gunTip);
            _targetPos.set(msg.hookPos.x, msg.hookPos.y, msg.hookPos.z);
            const distance = _gunTip.distanceTo(_targetPos);

            if (distance > 0.05) {
                _midPoint.addVectors(_gunTip, _targetPos).multiplyScalar(0.5);
                peerData.hookLine.position.copy(_midPoint);
                peerData.hookLine.scale.set(1, 1, distance);
                peerData.hookLine.lookAt(_targetPos);
                peerData.hookLine.visible = true;
            }
        } else {
            if (peerData.hookLine) {
                peerData.hookLine.visible = false;
            }
        }
    } else if (msg.type === 'fire') {
        _barrelPos.set(msg.barrelPos.x, msg.barrelPos.y, msg.barrelPos.z);
        _baseFireDir.set(msg.dir.x, msg.dir.y, msg.dir.z).normalize();
        const firingPeer = state.peers[senderId];
        if (firingPeer) {
            const firingWeapon = msg.weapon === 'PISTOL' ? firingPeer.pistolMesh
                : msg.weapon === 'SHOTGUN' ? firingPeer.shotgunMesh
                : msg.weapon === 'AR' ? firingPeer.arMesh
                : msg.weapon === 'SNIPER' ? firingPeer.sniperMesh
                : firingPeer.minigunMesh;
            triggerMuzzleFlash(firingWeapon);
        }

        if (msg.weapon === 'SNIPER') {
            const targetPos = _targetPos;
            canonicalSniperBeamEnd(_barrelPos, _baseFireDir, msg.hitPoint, targetPos);
            createLaserBeam(_barrelPos, targetPos, 0xffff00);

        } else {
            const stats = WEAPON_STATS[msg.weapon];
            const pelletCount = msg.weapon === 'SHOTGUN'
                ? Math.min(msg.pelletCount ?? stats.pellets ?? 5, 16)
                : 1;
            const fallbackSeed = (Math.floor(_barrelPos.x * 100) ^ Math.floor(_barrelPos.y * 100) ^ Math.floor(_barrelPos.z * 100)) >>> 0;
            const spreadSeed = msg.spreadSeed ?? fallbackSeed;
            const homingTarget = fromHomingTargetPacket(msg.homingTarget, state.targets, state.peers);
            for (let pellet = 0; pellet < pelletCount; pellet++) {
                const direction = spreadDirection(_baseFireDir, spreadSeed, pellet, stats.spread, _dir);
                spawnRemoteBullet(
                    _barrelPos,
                    direction,
                    stats.bulletColor,
                    homingTarget,
                    msg.homingStartDistance,
                );
            }
        }
    } else if (msg.type === 'kill_target') {
        // Host broadcast: all clients apply the same target respawn and score.
        const target = state.targets[msg.targetIndex];
        if (target) {
            cancelHookForTarget(target);
            const data = targetData(target);
            data.eliminationRevision = (data.eliminationRevision ?? 0) + 1;
            const enemyColor = msg.color || 0xff4500;
            spawnParticles(target.position, enemyColor, 35, 30, 0.35, 15.0);

            createShockwave(target.position, 8.0 * (msg.scale || 1.0), 0xffaa00);
            applyTargetState({
                targetIndex: msg.targetIndex,
                position: msg.newPosition,
                maxHp: msg.hp,
                hp: msg.hp,
                scale: msg.scale,
                color: msg.color
            });
            rebuildTargetHash();
            setScore(msg.score);
            if (state.isPlaying && msg.killerPeerId === state.peer?.id) flashHitmarker(true);
        }
    } else if (msg.type === 'hit_target') {
        if (state.isMultiplayer && state.isHost) {
            processTargetHit(msg.targetIndex, msg.damage, senderId);
            syncHostTargetStates();
        } else if (msg.senderPeerId === state.peer?.id) {
            // The echoed packet confirms the hit; only the following host kill
            // packet can authoritatively upgrade it from white to red.
            flashHitmarker(false);
        }
    } else if (msg.type === 'player_hit') {
        if (senderId === state.peer?.id && msg.targetPeerId !== state.peer?.id) flashHitmarker(false);
        const targetPeer = state.peers[msg.targetPeerId];
        if (targetPeer && targetPeer.lifeId === msg.targetLifeId) {
            flashPeerMesh(targetPeer, 0xff3333, 150);
        }
        if (state.peer && msg.targetPeerId === state.peer.id && msg.targetLifeId === state.lifeId) {
            updateHealthRegen(0);
            takePlayerDamage(msg.damage, msg.attackerName, senderId);
            // The victim owns health. Publish the result immediately so combat,
            // all observers and the C inspection read exactly the same value.
            sendLocalState(true);
        }
    } else if (msg.type === 'player_died') {
        const victimPeer = state.peers[msg.victimPeerId || senderId];
        if (victimPeer && victimPeer.lifeId !== undefined && msg.lifeId < victimPeer.lifeId) return;
        if (victimPeer?.deathReported && msg.lifeId === victimPeer.lifeId) return;
        if (victimPeer && victimPeer.mesh) {
            victimPeer.lifeId = msg.lifeId;
            victimPeer.deathReported = true;
            victimPeer.hp = 0;
            spawnParticles(victimPeer.mesh.position, 0x8c7ae6, 40, 30, 0.4, 18.0);
            victimPeer.mesh.visible = false;
            if (victimPeer.hookLine) victimPeer.hookLine.visible = false;
        }

        if (msg.cause === 'player' && msg.killerPeerId === state.peer?.id) {
            state.kills++;
            const killsEl = DOM.kills();
            if (killsEl) killsEl.innerText = state.kills.toString();
            
            flashHitmarker(true);
        }
    } else if (msg.type === 'jump') {
        const peerData = state.peers[senderId];
        if (peerData && peerData.mesh && peerData.mesh.visible) {
            _boosterPos.copy(peerData.mesh.position);
            _boosterPos.y -= 1.45;
            spawnRocketFlame(_boosterPos, 50, true);
            createShockwave(_boosterPos, 15.0);
        }
    }
}

// Peer avatars own cloned weapon/name-tag resources, so leaving a room must
// dispose those objects instead of only removing them from the scene.
function removePeer(peerId: string): void {
    const peerData = state.peers[peerId];
    if (peerData) {
        clearDamagePulse(peerData);
        if (peerData.mesh) {
            state.scene!.remove(peerData.mesh);
            peerData.mesh.traverse((child: any) => {
                if (child.isMesh) {
                    if (child.geometry && !isSharedGeometry(child.geometry)) {
                        child.geometry.dispose();
                    }
                    if (child.material && child.material !== SHARED_BODY_MAT) {
                        child.material.dispose();
                    }
                }
                if (child.isSprite) {
                    child.material?.map?.dispose();
                    child.material?.dispose();
                }
            });
        }
        if (peerData.hookLine) {
            state.scene!.remove(peerData.hookLine);
        }
        delete state.peers[peerId];
        state.peerIds = Object.keys(state.peers);
        console.log(`Disposed remote peer mesh for: ${peerId}`);
    }
}

export function sendLocalState(force = false): void {
    if (!state.isMultiplayer || !state.isPlaying || state.connections.length === 0 || !state.controls || !state.camera) return;

    const now = performance.now();
    if (!force && now - lastSentTime < NETWORK_TICK_MS) return;
    if (state.isHost) syncHostTargetStates();

    const playerObj = state.controls.getObject();
    const camEuler = _stateEuler.setFromQuaternion(state.camera.quaternion, 'YXZ');
    const activeWeapon = getActiveWeaponName();

    const username = getCachedUsername();
    const q2 = (value: number) => Math.round(value * 100) / 100;
    const q3 = (value: number) => Math.round(value * 1000) / 1000;
    const flags =
        (state.isMouseDown ? 1 : 0) |
        (state.playerHp <= 0 ? 2 : 0) |
        (state.isHovering ? 4 : 0) |
        (state.moveForward ? 8 : 0) |
        (state.moveBackward ? 16 : 0) |
        (state.moveLeft ? 32 : 0) |
        (state.moveRight ? 64 : 0);

    const pos = playerObj.position;
    const hookX = state.hookState !== 'IDLE' ? q2(state.hookPosition.x) : 0;
    const hookY = state.hookState !== 'IDLE' ? q2(state.hookPosition.y) : 0;
    const hookZ = state.hookState !== 'IDLE' ? q2(state.hookPosition.z) : 0;
    const snapshot = {
        x: q2(pos.x),
        y: q2(pos.y),
        z: q2(pos.z),
        yaw: q3(camEuler.y),
        pitch: q3(camEuler.x),
        weapon: activeWeapon,
        flags,
        hookX,
        hookY,
        hookZ,
        hp: THREE.MathUtils.clamp(state.playerHp, 0, state.playerMaxHp),
        maxHp: state.playerMaxHp,
    };

    const changed = !lastSentSnapshot ||
        Math.abs(snapshot.x - lastSentSnapshot.x) > 0.01 ||
        Math.abs(snapshot.y - lastSentSnapshot.y) > 0.01 ||
        Math.abs(snapshot.z - lastSentSnapshot.z) > 0.01 ||
        Math.abs(snapshot.yaw - lastSentSnapshot.yaw) > 0.002 ||
        Math.abs(snapshot.pitch - lastSentSnapshot.pitch) > 0.002 ||
        snapshot.weapon !== lastSentSnapshot.weapon ||
        snapshot.flags !== lastSentSnapshot.flags ||
        snapshot.hookX !== lastSentSnapshot.hookX ||
        snapshot.hookY !== lastSentSnapshot.hookY ||
        snapshot.hookZ !== lastSentSnapshot.hookZ ||
        snapshot.hp !== lastSentSnapshot.hp ||
        snapshot.maxHp !== lastSentSnapshot.maxHp;

    if (!force && !changed && now - lastForceSendTime < 250) return;
    lastSentTime = now;
    lastForceSendTime = now;
    lastSentSnapshot = snapshot;

    const packet: UpdatePacket = {
        type: 'update',
        bodyColor: Number.parseInt(characterColor.slice(1), 16),
        lifeId: state.lifeId,
        username: username,
        pos: { x: snapshot.x, y: snapshot.y, z: snapshot.z },
        yaw: snapshot.yaw,
        pitch: snapshot.pitch,
        activeWeapon,
        isMouseDown: state.isMouseDown,
        isDead: state.playerHp <= 0,
        hookState: state.hookState,
        hookPos: state.hookState !== 'IDLE' ? { x: hookX, y: hookY, z: hookZ } : null,
        isHovering: state.isHovering,
        hp: snapshot.hp,
        maxHp: snapshot.maxHp,
        // BinaryPack encodes explicit undefined as null; omit host-only fields.
        ...(state.isHost ? { dayNightElapsedSeconds: state.dayNightElapsedSeconds } : {}),
        hoverKeys: state.isHovering ? {
            w: state.moveForward,
            s: state.moveBackward,
            a: state.moveLeft,
            d: state.moveRight
        } : null
    };

    broadcastToAll(packet);
}

export function updateRemotePeers(delta: number): void {
    if (!state.isMultiplayer) return;

    const peerIds = state.peerIds;
    const alpha = 1 - Math.exp(-14 * delta);
    for (let i = 0; i < peerIds.length; i++) {
        const peerData = state.peers[peerIds[i]];
        if (!peerData) continue;

        // Health is replicated by the victim. Predicting regeneration here can
        // resurrect a stale health value and makes inspection disagree with combat.
        peerData.mesh.position.lerp(peerData.targetPosition, alpha);

        const currentYaw = peerData.mesh.rotation.y;
        let yawDelta = peerData.targetYaw - currentYaw;
        yawDelta = Math.atan2(Math.sin(yawDelta), Math.cos(yawDelta));
        peerData.mesh.rotation.y = currentYaw + yawDelta * alpha;
        updateMuzzleFlash(peerData.leftGun, delta);
        updateMuzzleFlash(peerData.pistolMesh, delta);
        updateMuzzleFlash(peerData.shotgunMesh, delta);
        updateMuzzleFlash(peerData.arMesh, delta);
        updateMuzzleFlash(peerData.sniperMesh, delta);
        updateMuzzleFlash(peerData.minigunMesh, delta);
    }
}

export function broadcastLocalFire(
    barrelPos: THREE.Vector3,
    dir: THREE.Vector3,
    hitPoint: THREE.Vector3 | null,
    shotId: number,
    spreadSeed: number,
    homingTarget?: HomingTargetPacket,
    homingStartDistance?: number,
): void {
    if (!state.isMultiplayer || state.connections.length === 0) return;
    sendLocalState(true);
    const weapon = getActiveWeaponName();

    const packet: FirePacket = {
        type: 'fire',
        shotId, spreadSeed,
        weapon,
        barrelPos: { x: barrelPos.x, y: barrelPos.y, z: barrelPos.z },
        dir: { x: dir.x, y: dir.y, z: dir.z },
        ...(homingTarget ? { homingTarget } : {}),
        ...(homingTarget && homingStartDistance !== undefined ? { homingStartDistance } : {}),
    };

    if (weapon === 'SHOTGUN') {
        packet.pelletCount = WEAPON_STATS.SHOTGUN.pellets ?? 5;
    }

    if (hitPoint) {
        packet.hitPoint = { x: hitPoint.x, y: hitPoint.y, z: hitPoint.z };
    }

    broadcastToAll(packet);
}

export function broadcastTargetKill(targetIndex: number, score: number, newPos: THREE.Vector3, data: TargetUserData, killerPeerId: string | null = null): void {
    if (!state.isMultiplayer || !state.isHost || state.connections.length === 0) return;

    const packet: KillTargetPacket = {
        type: 'kill_target',
        targetIndex: targetIndex,
        score: score,
        newPosition: { x: newPos.x, y: newPos.y, z: newPos.z },
        scale: data.scale,
        hp: data.hp,
        color: data.color,
        killerPeerId,
    };

    const targetState = buildTargetState(targetIndex);
    if (targetState) {
        targetStateFingerprints.set(targetIndex, targetStateFingerprint(targetState));
    }

    broadcastToAll(packet);
}

export function broadcastLocalJump(): void {
    if (!state.isMultiplayer || state.connections.length === 0) return;
    const packet: JumpPacket = {
        type: 'jump'
    };
    broadcastToAll(packet);
}

// Keep weapon simulation independent from the networking module so scene-model
// construction does not participate in a weapons ↔ multiplayer import cycle.
setWeaponNetworkPort({
    broadcastLocalFire,
    broadcastToAll,
    flashPeerMesh,
});

// Remote players use the same bean/weapon builders as the local player, but with
// a canvas-generated name tag attached as a Sprite.
function createPeerBean(username: string): PeerData {
    if (!state.scene) throw new Error('Scene not initialized');

    const peerGroup = buildBeanModel(0x8c7ae6, 0xff4757);

    const leftGun = buildGun(GRAPPLE_BLUE, true);
    excludeFromStablePeerEnvelope(leftGun);
    leftGun.position.set(-0.7, 0.0, -0.5);
    peerGroup.add(leftGun);

    const rightGunContainer = new THREE.Group();
    excludeFromStablePeerEnvelope(rightGunContainer);
    rightGunContainer.position.set(0.7, 0.0, -0.5);
    peerGroup.add(rightGunContainer);

    const pistolMesh = buildGun(WEAPON_STATS.PISTOL.bulletColor);
    rightGunContainer.add(pistolMesh);

    const shotgunMesh = buildShotgun();
    shotgunMesh.visible = false;
    rightGunContainer.add(shotgunMesh);

    const arMesh = buildAR();
    arMesh.visible = false;
    rightGunContainer.add(arMesh);

    const sniperMesh = buildSniper();
    sniperMesh.visible = false;
    rightGunContainer.add(sniperMesh);

    const minigunMesh = buildMinigun();
    minigunMesh.visible = false;
    rightGunContainer.add(minigunMesh);

    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 64;
    const ctx = canvas.getContext('2d');
    if (ctx) {
        ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
        ctx.fillRect(0, 0, 256, 64);
        ctx.font = 'bold 24px Segoe UI, Arial';
        ctx.fillStyle = '#ffffff';
        ctx.textAlign = 'center';
        ctx.fillText(username, 128, 40);
    }
    
    const spriteMat = new THREE.SpriteMaterial({ 
        map: new THREE.CanvasTexture(canvas), 
        transparent: true 
    });
    const nameSprite = new THREE.Sprite(spriteMat);
    nameSprite.position.set(0, 1.6, 0);
    nameSprite.scale.set(3, 0.75, 1);
    peerGroup.add(nameSprite);

    state.scene.add(peerGroup);
    peerGroup.scale.set(1.5, 1.5, 1.5);

    return {
        username,
        mesh: peerGroup,
        targetPosition: peerGroup.position.clone(),
        targetYaw: 0,
        leftGun: leftGun,
        rightGunContainer: rightGunContainer,
        pistolMesh: pistolMesh,
        shotgunMesh: shotgunMesh,
        arMesh: arMesh,
        sniperMesh: sniperMesh,
        minigunMesh: minigunMesh,
        hookLine: null,
        lastHookState: 'IDLE',
        hp: PLAYER_MAX_HP,
        maxHp: PLAYER_MAX_HP,
        lastDamageTime: 0,
        regenTimer: 0,
    };
}
