import type { PlayerHitPacket } from './networkTypes.js';
import type { InfantryPlayer } from './infantry.js';
import type { InfantryEvent, InfantryEventPacket } from './infantryNetworkTypes.js';
import { acceptMeleeCommand, invalidateMeleePeer, forgetMeleePeer, receiveMeleeEvent, receiveMeleeHit, localMeleePlayer, resetKatana, getKatanaAction } from './katana.js';
import { attachPlayerAvatar, getPlayerAvatar, bindAvatarEffects } from './playerAvatar.js';
import { WeaponHandling, isFirearm, isLight } from './weaponHandling.js';
import type { HandlingCommand, HandlingStatePacket, WeaponIntent } from './handlingNetworkTypes.js';
import { userSettings } from './settings.js';
import { setMeleeNetworkPort } from './weaponNetworkPort.js';
import { KATANA } from './config.js';
import { setMechaNetworkPort, captureMechaSnapshot, receiveMechaState, receiveMechaEvent, receiveMechaDenial, resetMechaNetwork, acceptMechaCommand, acceptMechaEndingReady, mechaPeerLeft, mechaPlayer, mountedPeerPosition, announceMechaHit, announceMechaShield } from './mechaNetwork.js';
import type { MechaHitPacket } from './mechaNetworkTypes.js';
import { TargetMotionHistory, type HomingFireContext } from './projectileFlight.js';
import { hasLineOfSightToOrientedBox } from './targetVisibility.js';
import { touchesLava } from './lavaDamage.js';
import { createPlayerLife, damagePlayerLife, healPlayerLife, type PlayerLife } from './playerLife.js';
import { getTownSpawn } from './town.js';
import { PacketRate } from './packetRate.js';
import { cancelHookForTarget, clearHookTether } from './hookLifecycle.js';
import { characterColor } from './appearance.js';
import { endInput, touchMove } from './inputSession.js';
import { renderPlayerList, setPlayerListVisible } from './playerList.js';
import { resetProjectiles } from './projectiles.js';
import type { Peer } from 'peerjs';
import { ShotLedger, spreadDirection, initialWeaponState, advanceWeaponState, type AcceptedWeaponState } from './shotAuthority.js';
import { isCapability, isPeerId, usernameKey } from './roomIdentity.js';
import * as THREE from 'three';
import { state, resetPlayerState, resetMatchStats, type DataConnectionLike, type PeerData } from './state.js';
import { placePlayerAtTownSpawn, resetPlayerAtTownSpawn } from './playerSpawn.js';
import { disposeParticles, spawnParticles, createLaserBeam, spawnRocketFlame, spawnManeuveringBeam, createShockwave } from './particles.js';
import {
    forgottenMecha, infantry, rebuildInfantryHash,
    generateWorldSeed,
    getWorldSeed,
    queryObstaclesAlongSegment, shotObstructionT,
    queryTargetsAlongSegment,
    rebuildEnvironmentWithSeed,
    rebuildTargetHash,
} from './world.js';
import { resetHook } from './grapple.js';
import { processMechaHit, processTargetHit, takePlayerDamage } from './damage.js';
import {
    NETWORK_TICK_MS,
    NETWORK_POSITION_RESPONSE,
    MAX_PLAYERS,
    MAX_PENDING_ROOM_CONNECTIONS, NETWORK_PROTOCOL_VERSION,
    PROJECTILE_RADIUS, FIREARM_MUZZLE_REACH, MAX_MUZZLE_LATERAL, MAX_MUZZLE_BEHIND_EYE,
    TARGET_HIT_RANGE_MULTIPLIER,
    PLAYER_MAX_HP,
    PLAYER_HEIGHT,
    LAVA_DAMAGE_TICK_MS, LAVA_DAMAGE_PER_TICK,
    ROOM_CODE_LENGTH,
    MAP_HALF_SIZE,
    PEER_Y_OFFSET,
    HIT_FLASH_DURATION_MS,
    WEAPON_STATS,
    BULLET_TRAVEL_DISTANCE,
    MAX_PROJECTILES,
    NETWORK_MOVEMENT_SPEED,
    NETWORK_MOVEMENT_BURST,
    GRAPPLE_BLUE,
    ENEMY_COUNT, INFANTRY, INFANTRY_NETWORK_INTERVAL, type InfantryKind,
} from './config.js';
import { SHARED_PROJECTILE_GEO } from './weapons.js';
import { triggerMuzzleFlash, updateMuzzleFlash } from './muzzleFlash.js';
import {
    parseNetworkPacket,
    type FirePacket,
    type HomingTargetPacket,
    type JumpPacket,
    type KillTargetPacket,
    type LobbyPlayer,
    type PlayerDiedPacket,
    type PlayerHealthPacket,
    type PlayerRespawnPacket,
    type PlayerListEntry,
    type NetworkPacket,
    type TargetState,
    type TargetStatePacket,
    type UpdatePacket,
    type WeaponName,
    type WorldSnapshotPacket
} from './networkTypes.js';
import { obstacleData, projectileData, targetData, type TargetUserData } from './userDataTypes.js';
import { segmentSphereHitT } from './gameplayMath.js';
import { clearDamagePulse, pulseDamageMaterials } from './damagePulse.js';
import { excludeFromStablePeerEnvelope, setPeerScanBounds } from './smartGogglesPeerMath.js';
import { setWeaponNetworkPort } from './weaponNetworkPort.js';
import { flashHitmarker } from './hitmarker.js';
import {
    fromHomingTargetPacket,
    PROJECTILE_HOMING_START_FRACTION,
    resolveProjectileHomingTarget,
    type ProjectileHomingTarget,
} from './projectileHoming.js';
import { toPlayerLocal, PLAYER_BODY_CAMERA_OFFSET, PLAYER_HITBOX_MIN, PLAYER_HITBOX_MAX, PLAYER_HITBOX_BOUNDING_RADIUS, segmentPlayerHitboxHitT } from './playerHitbox.js';
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
const _observerMuzzle = new THREE.Vector3();
const _localBarrelOffset = new THREE.Vector3();
const _dir = new THREE.Vector3();
const _baseFireDir = new THREE.Vector3();
const _peerTargetPosition = new THREE.Vector3();

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
    score: null as HTMLElement | null,
    kills: null as HTMLElement | null,
};

const DOM = {
    hostLobbyStatus: () => (UI.hostLobbyStatus || (UI.hostLobbyStatus = document.getElementById('host-lobby-status'))),
    btnHostStart: () => (UI.btnHostStart || (UI.btnHostStart = document.getElementById('btn-host-start') as HTMLButtonElement | null)),
    joinErrorLog: () => (UI.joinErrorLog || (UI.joinErrorLog = document.getElementById('join-error-log'))),
    pvpStats: () => (UI.pvpStats || (UI.pvpStats = document.getElementById('pvp-stats'))),
    btnJoinConnect: () => (UI.btnJoinConnect || (UI.btnJoinConnect = document.getElementById('btn-join-connect') as HTMLButtonElement | null)),
    score: () => (UI.score || (UI.score = document.getElementById('score'))),
    kills: () => (UI.kills || (UI.kills = document.getElementById('kills'))),
};

let cachedUsername = 'Guest1';
let healthInterval: ReturnType<typeof setInterval> | null = null;
let onLocalHealth: ((previousHp: number, feedback: boolean) => void) | undefined;
let onLocalRespawn: ((packet: PlayerRespawnPacket) => void) | undefined;
let pendingLocalHealth: { packet: PlayerHealthPacket; expiresAt: number } | null = null;
export function setMultiplayerLifePresentation(
    health: typeof onLocalHealth, respawn: typeof onLocalRespawn,
): void {
    onLocalHealth = health;
    onLocalRespawn = respawn;
}
const matchStartListeners = new Set<() => void>();
export function onMultiplayerStarted(listener: () => void): void { matchStartListeners.add(listener); }
export interface MultiplayerDisconnect { wasHost: boolean; reason: string | null; }
const disconnectListeners = new Set<(event: MultiplayerDisconnect) => void>();
/** The composition root owns renderer/world teardown; networking only reports
 * session termination, after invalidating all pending callbacks. */
export function onMultiplayerDisconnected(listener: (event: MultiplayerDisconnect) => void): () => void {
    disconnectListeners.add(listener);
    return () => disconnectListeners.delete(listener);
}

function enterMultiplayerMatch(): void {
    if (state.isPlaying) return;
    state.isPlaying = true;
    state.pendingPlay = false;
    state.prevTime = performance.now();
    if (state.isHost) healthInterval = setInterval(updateHostPlayerLives, 100);
    sendLocalState(true);
    if (state.isHost) publishPlayerList();
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

function publishLobbyRoster(): void {
    if (!state.isHost || !state.peer) return;
    const players = refreshHostRoster();
    broadcastToAll({ type: 'lobby_roster', players });
    if (state.isPlaying) publishPlayerList();
}

let colorPublishTimer: ReturnType<typeof setTimeout> | null = null;
let lastColorPublish = -Infinity;

function applyRemoteSuitColor(peerId: string, color: number): void {
    const peer = state.peers[peerId];
    if (!peer || peer.mesh.userData.bodyColor === color) return;
    peer.mesh.userData.bodyColor = color;
    getPlayerAvatar(peer.mesh)?.setColor(color);
}

/** Coalesce a dragged native color picker. Always send the last choice, even
 * if the user leaves the picker between two updates. Room teardown cancels it. */
export function publishSuitColor(): void {
    if (!state.isMultiplayer || !state.peer || colorPublishTimer !== null) return;
    const send = () => {
        colorPublishTimer = null;
        lastColorPublish = performance.now();
        if (state.isHost) publishLobbyRoster();
        else {
            const host = getHostPeerId();
            if (host && clientWorldSynchronized)
                sendToPeer(host, { type: 'lobby_color', bodyColor: Number.parseInt(characterColor.slice(1), 16) });
        }
    };
    const wait = 100 - (performance.now() - lastColorPublish);
    if (wait <= 0) send();
    else colorPublishTimer = setTimeout(send, wait);
}

function refreshHostRoster(): LobbyPlayer[] {
    // Connection order is the host's admission order. Rebuild after departures
    // so a replacement joins the end of the visible lineup, even if its house
    // slot reuses an earlier vacancy.
    const colors = new Map(state.lobbyPlayers.map(player => [player.peerId, player.bodyColor]));
    const players: LobbyPlayer[] = [{ peerId: state.peer!.id, username: getCachedUsername(),
        bodyColor: Number.parseInt(characterColor.slice(1), 16) }];
    for (const conn of state.connections) {
        const username = admittedNames.get(conn.peer);
        if (conn.open && username) players.push({ peerId: conn.peer, username,
            bodyColor: colors.get(conn.peer) ?? 0x3b5998 });
    }
    state.lobbyPlayers = players;
    return players;
}

function publishPlayerList(): void {
    if (!state.isHost || !state.isPlaying) return;
    const scores = new Map(state.playerList.map(player => [player.peerId, player]));
    // Admission order is stable; only the host may turn verified room members
    // and accepted death events into the displayed match scoreboard.
    const players: PlayerListEntry[] = state.lobbyPlayers.map(player => ({ ...player,
        kills: scores.get(player.peerId)?.kills ?? 0,
        deaths: scores.get(player.peerId)?.deaths ?? 0,
    }));
    state.playerList = players;
    renderPlayerList();
    if (state.playerList.length) broadcastToAll({ type: 'player_list', players: state.playerList });
}

function recordConfirmedDeath(packet: PlayerDiedPacket): void {
    if (!state.isHost || !state.isPlaying) return;
    const victim = state.playerList.find(player => player.peerId === packet.victimPeerId);
    if (!victim) return;
    victim.deaths = Math.min(1_000_000, victim.deaths + 1);
    if (packet.killerPeerId && packet.killerPeerId !== packet.victimPeerId) {
        const killer = state.playerList.find(player => player.peerId === packet.killerPeerId);
        if (killer) killer.kills = Math.min(1_000_000, killer.kills + 1);
    }
    publishPlayerList();
}

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
    if (!state.isMultiplayer) return;
    if (state.isHost && packet.type === 'player_hit' && !packet.senderPeerId) {
        const hostId = state.peer?.id;
        if (!hostId || hostLife.hp <= 0 || !commitPlayerDamage(packet.targetPeerId, packet.targetLifeId, packet.damage, 'player', hostId)) return;
        packet = { ...packet, senderPeerId: hostId, attackerName: getCachedUsername() };
    }
    if (state.isHost && packet.type === 'hit_mecha' && state.peer) { authorizeMechaHit(state.peer.id, packet); return; }
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
    if (state.isHost && packet.type === 'player_died') recordConfirmedDeath(packet);
}

function sendToPeer(peerId: string, packet: NetworkPacket): void {
    const conn = state.connections.find(candidate => candidate.peer === peerId && candidate.open);
    try { conn?.send(packet); } catch { conn?.close(); }
}

function flashPeerMesh(peerData: PeerData, color = 0xff3333, durationMs = HIT_FLASH_DURATION_MS): void {
    const avatar = getPlayerAvatar(peerData.mesh);
    avatar?.hit();
    pulseDamageMaterials(peerData, avatar?.rig.damageMaterials ?? [], color, durationMs);
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
let acknowledgedAdmissionGeneration = 0;

const pendingConnectionPeers = new Set<string>();
const targetStateFingerprints = new Map<number, string>();
const MAX_PLAYER_HORIZONTAL_POSITION = MAP_HALF_SIZE + 100;
const MAX_PLAYER_VERTICAL_POSITION = 600;
const peerHitBox = new THREE.Box3(new THREE.Vector3(PLAYER_HITBOX_MIN.x, PLAYER_HITBOX_MIN.y, PLAYER_HITBOX_MIN.z), new THREE.Vector3(PLAYER_HITBOX_MAX.x, PLAYER_HITBOX_MAX.y, PLAYER_HITBOX_MAX.z));

interface PeerRuntimeState {
    handling: WeaponHandling;
    commandAck: number;
    shotAck: number;
    held: boolean;
    freshTrigger: boolean;
    intentRate: PacketRate;
    correctionDue: boolean;
    hookFlight: 'firing' | 'latched' | 'spent';
    wasMounted: boolean;
    motion: TargetMotionHistory;
    username: string;
    position: THREE.Vector3;
    yaw: number;
    pitch: number;
    lastUpdateAt: number;
    travelAllowance: number;
    shots: ShotLedger;
    life: PlayerLife;
    jumpRate: PacketRate;
    fireRate: PacketRate;
    weaponState: AcceptedWeaponState;
}

const peerRuntime = new Map<string, PeerRuntimeState>();
let hostLife = createPlayerLife(0);
let localCommand = 0, localShot = -1, handlingRevision = 0, localAckRevision = 0;
const handlingCopies = new Map<string,{lifeId:number;revision:number;handling:WeaponHandling}>();
const handlingPhases = new Map<string,string>();

function handlingPacket(id: string): HandlingStatePacket | null {
    const local = id === state.peer?.id, runtime = peerRuntime.get(id);
    if (!local && !runtime) return null;
    const handling = local ? state.weaponHandling : runtime!.handling;
    const snapshot = handling.snapshot(local ? state.weaponTime : performance.now() / 1000);
    return { type: 'handling_state', peerId: id, lifeId: local ? hostLife.id : runtime!.life.id,
        tetherActive: local ? state.hookState !== 'IDLE' : runtime!.hookFlight !== 'spent',
        revision: ++handlingRevision, commandAck: local ? localCommand : runtime!.commandAck,
        shotAck: local ? localShot : runtime!.shotAck, handling: snapshot };
}

function publishHandling(id: string, rejected = false): void {
    const packet = handlingPacket(id);
    if (!packet) return;
    if (rejected) sendToPeer(id, { ...packet, rejected: true });
    else {
        const s = packet.handling;
        handlingPhases.set(id, [s.hand, s.handWeapon, s.outgoingLight, s.reloadWeapon, s.queuedReload, s.pendingFire, s.launchPending].join('/'));
        broadcastToAll(packet);
    }
}

function receiveHandling(packet: HandlingStatePacket): void {
    const id = packet.peerId;
    if (!state.lobbyPlayers.some(p => p.peerId === id)) return;
    if (id === state.peer?.id) {
        if (packet.lifeId !== state.lifeId || packet.revision <= localAckRevision ||
            packet.commandAck < localCommand || packet.shotAck < localShot) return;
        localAckRevision = packet.revision;
        const h = state.weaponHandling, s = packet.handling;
        // Reliable replies can arrive after the owner's locally predicted draw
        // or stow has finished. Rewinding its timer would fire the hook twice.
        const phaseAgrees = h.hand === s.hand || (s.hand === 'drawing' && h.hand === 'drawn')
            || (s.hand === 'returning' && h.hand === 'holstered');
        const lostReload = h.reload && !s.reloadWeapon && s.queuedReload !== h.reload.weapon;
        if (packet.rejected || !phaseAgrees || lostReload) {
            h.restore(s, state.weaponTime);
            if (s.hand !== 'drawn' || packet.rejected && !s.launchPending && !packet.tetherActive) clearHookTether();
        } else {
            for (const weapon of Object.keys(s.rounds) as (keyof typeof s.rounds)[]) {
                if (weapon !== s.reloadWeapon || h.reload) h.rounds[weapon] = s.rounds[weapon];
            }
        }
        return;
    }
    const copy = handlingCopies.get(id);
    if (packet.lifeId < (state.peers[id]?.lifeId ?? 0) || (copy && (packet.lifeId < copy.lifeId ||
        packet.lifeId === copy.lifeId && packet.revision <= copy.revision))) return;
    const pose = remotePoses.get(id);
    if (!packet.tetherActive && !packet.handling.launchPending && pose?.packet.lifeId === packet.lifeId) {
        pose.packet = {...pose.packet, hookState:'IDLE', hookPos:null, movingHook:false};
    }
    const handling = copy?.lifeId === packet.lifeId ? copy.handling : new WeaponHandling();
    handling.restore(packet.handling, performance.now() / 1000);
    handlingCopies.set(id, {lifeId: packet.lifeId, revision: packet.revision, handling});
}

function sendLocalIntent(action: WeaponIntent, weapon: WeaponName): void {
    if (!state.isMultiplayer || !state.isPlaying || !state.peer || state.matchEnded) return;
    const sequence = ++localCommand;
    if (state.isHost) { publishHandling(state.peer.id); return; }
    sendLocalState(true);
    broadcastToAll({type:'handling_command', lifeId:state.lifeId, sequence, action, weapon});
}

function handleWeaponIntent(id: string, packet: HandlingCommand): void {
    const r = getPeerRuntime(id);
    if ((packet.senderPeerId && packet.senderPeerId !== id) || !isKnownClient(id) || !state.isPlaying || state.matchEnded || !r || r.life.id !== packet.lifeId ||
        r.life.hp <= 0 || !r.motion.samples.length || packet.sequence <= r.commandAck) return;
    r.commandAck = packet.sequence;
    const now = performance.now(), w = packet.weapon, h = r.handling;
    if (!r.intentRate.accept(now)) { r.correctionDue = true; return; }
    const switching = r.weaponState.switchState !== 'IDLE';
    const equipped = r.weaponState.nextWeapon ?? r.weaponState.activeWeapon;
    const activeCable = r.hookFlight !== 'spent';
    let accepted = false;
    if (w === equipped && !mountedPeerPosition(id)) {
        switch (packet.action) {
            case 'cancel':
                h.interrupt(equipped, now/1000);
                r.hookFlight = 'spent';
                accepted = true; break;
            case 'toggleGrapple':
                accepted = !switching && h.toggleGrappleMode(w, now/1000);
                if (accepted) {
                    r.hookFlight = 'spent';
                    r.freshTrigger = false;
                }
                break;
            case 'grapple':
                if ((!switching || isLight(w)) && !activeCable && !h.launchPending)
                    accepted = h.pressGrapple(w,now/1000);
                if (accepted) r.freshTrigger = false;
                break;
            case 'release':
                accepted = h.releaseGrapple(w,now/1000);
                if (accepted) r.hookFlight = 'spent';
                break;
            case 'raise':
                accepted = isFirearm(w) && r.freshTrigger && h.requestHeavyFire(w,now/1000,switching);
                if (accepted) r.hookFlight = 'spent';
                r.freshTrigger = false; break;
            case 'reload':
                accepted = !switching && isFirearm(w) && h.beginReload(w,now/1000,activeCable);
                break;
        }
    }
    publishHandling(id, !accepted);
}

function playerLife(peerId: string): PlayerLife | undefined {
    return peerId === state.peer?.id ? hostLife : peerRuntime.get(peerId)?.life;
}

function applyLocalHealth(packet: PlayerHealthPacket, feedback: boolean): void {
    if (packet.lifeId !== state.lifeId || state.playerHp === packet.hp) return;
    const previousHp = state.playerHp;
    state.playerHp = packet.hp;
    onLocalHealth?.(previousHp, feedback);
}

function applyHealth(packet: PlayerHealthPacket): void {
    if (packet.peerId !== state.peer?.id) {
        const peer = state.peers[packet.peerId];
        if (peer?.lifeId === packet.lifeId) {
            if (packet.hp < peer.hp) getPlayerAvatar(peer.mesh)?.hit();
            peer.hp = packet.hp;
        }
        return;
    }
    if (packet.lifeId !== state.lifeId) return;
    pendingLocalHealth = null;
    if (packet.mechaSequence !== undefined) {
        pendingLocalHealth = { packet, expiresAt: performance.now() + 1000 };
    } else {
        applyLocalHealth(packet, true);
    }
}

export function presentMultiplayerHealth(mechaSequence?: number): void {
    const pending = pendingLocalHealth;
    if (!pending) return;
    const acknowledged = mechaSequence !== undefined && pending.packet.mechaSequence === mechaSequence;
    if (!acknowledged && performance.now() < pending.expiresAt) return;
    pendingLocalHealth = null;
    applyLocalHealth(pending.packet, acknowledged);
}

function publishHealth(peerId: string, life: PlayerLife, mechaSequence?: number): void {
    const packet: PlayerHealthPacket = { type: 'player_health', peerId, lifeId: life.id, hp: life.hp,
        ...(mechaSequence === undefined ? {} : { mechaSequence }) };
    broadcastToAll(packet);
    applyHealth(packet);
}

function commitPlayerDamage(
    peerId: string, lifeId: number, damage: number, cause: PlayerDiedPacket['cause'],
    attacker: string | null = null, mechaSequence?: number,
): boolean {
    const life = playerLife(peerId);
    if (!state.isHost || !state.isPlaying || state.matchEnded || !life || life.id !== lifeId ||
        mountedPeerPosition(peerId) || !damagePlayerLife(life, damage, performance.now())) return false;
    publishHealth(peerId, life, mechaSequence);
    if (life.hp > 0) return true;
    const hostId = state.peer?.id;
    const victim = peerRuntime.get(peerId);
    (peerId === hostId ? state.weaponHandling : victim?.handling)?.cancelActions();
    if (victim) victim.hookFlight = 'spent';
    (peerId === hostId ? hostMechaShots : peerRuntime.get(peerId)?.shots)?.retireLife();
    invalidateMeleePeer(peerId);
    const packet: PlayerDiedPacket = { type: 'player_died', senderPeerId: hostId, lifeId, cause,
        victimPeerId: peerId, victimName: admittedNames.get(peerId) ?? 'Guest',
        killerPeerId: attacker, killerName: attacker ? admittedNames.get(attacker) ?? 'Guest' :
            cause === 'mecha' ? 'Forgotten Mecha' : cause === 'infantry' ? 'Enemy' : 'Lava' };
    broadcastToAll(packet);
    applyPlayerDeath(packet);
    return true;
}

function updateHostPlayerLives(): void {
    if (!state.isHost || !state.isPlaying || state.matchEnded) return;
    const now = performance.now();
    const tick = (peerId: string, life: PlayerLife, position: THREE.Vector3) => {
        const mounted = Boolean(mountedPeerPosition(peerId));
        const peer = peerRuntime.get(peerId);
        const h = peer?.handling ?? state.weaponHandling;
        if (mounted || life.hp <= 0) {
            h.cancelActions();
            if (peer) { peer.hookFlight = 'spent'; peer.wasMounted = mounted; }
        }
        h.advance(peer ? now/1000 : state.weaponTime);
        if (peer?.correctionDue) {
            // Coalesce denials so even a burst of bad inputs gets reconciled at bounded cost.
            peer.correctionDue = false;
            publishHandling(peerId, true);
        }
        const phase = [h.hand, h.handWeapon, h.outgoingLight, h.reload?.weapon ?? null, h.queuedReload, h.pendingFire, h.launchPending].join('/');
        if (phase !== handlingPhases.get(peerId)) publishHandling(peerId);
        if (!mounted && life.hp > 0 && now >= life.nextLavaAt && touchesLava(position)) {
            life.nextLavaAt = now + LAVA_DAMAGE_TICK_MS;
            commitPlayerDamage(peerId, life.id, LAVA_DAMAGE_PER_TICK, 'lava');
        }
        if (healPlayerLife(life, now, mounted)) publishHealth(peerId, life);
    };
    const hostPosition = state.controls?.getObject().position;
    if (state.peer && hostPosition) tick(state.peer.id, hostLife, hostPosition);
    for (const [peerId, runtime] of peerRuntime) tick(peerId, runtime.life, runtime.position);
}

function createPeerRuntime(username: string, slot: number): PeerRuntimeState {
    const spawn = getTownSpawn(getWorldSeed(), 'house', slot);
    return { username, motion: new TargetMotionHistory(), shots: new ShotLedger(), life: createPlayerLife(0), jumpRate: new PacketRate(4, 2), fireRate: new PacketRate(60, 8),
        handling: new WeaponHandling('PISTOL'), commandAck: 0, shotAck: -1, held: false, freshTrigger: false, intentRate: new PacketRate(12, 6), correctionDue: false, hookFlight: 'spent', wasMounted: false,
        position: new THREE.Vector3(spawn.x, PLAYER_HEIGHT, spawn.z), yaw: spawn.yaw, pitch: 0,
        lastUpdateAt: performance.now(), travelAllowance: NETWORK_MOVEMENT_BURST, weaponState: initialWeaponState('PISTOL') };
}

function applyRespawn(packet: PlayerRespawnPacket): void {
    if (packet.peerId === state.peer?.id) {
        if (packet.lifeId <= state.lifeId) return;
        localCommand = 0; localShot = -1; localAckRevision = 0;
        pendingLocalHealth = null;
        state.activeWeaponName = packet.weapon;
        if (onLocalRespawn) onLocalRespawn(packet);
        else {
            resetPlayerAtTownSpawn(getWorldSeed(), 'church');
            state.lifeId = packet.lifeId;
            state.fireCooldown = packet.cooldownMs / 1000;
        }
        sendLocalState(true);
        return;
    }
    const peer = state.peers[packet.peerId];
    if (!peer || packet.lifeId <= (peer.lifeId ?? -1)) return;
    peer.lifeId = packet.lifeId;
    peer.deathReported = false;
    peer.hp = PLAYER_MAX_HP;
    peer.minigunRamp = 0;
    peer.lastHookState = 'IDLE';
    if (peer.mesh.userData.nameTag) peer.mesh.userData.nameTag.visible = true;
    const pose = remotePoses.get(packet.peerId);
    if (pose) receiveRemotePose(packet.peerId, peer, {
        ...pose.packet, lifeId:packet.lifeId, pos:packet.pos, yaw:packet.yaw, pitch:0, activeWeapon:packet.weapon,
        hp:PLAYER_MAX_HP, isDead:false, isMouseDown:false, isHovering:false, hookState:'IDLE', hookPos:null,
        switchState:'IDLE', nextWeapon:null, inspectTime:undefined, grounded:true, scoped:false
    }, true);
    peer.targetPosition.set(packet.pos.x, packet.pos.y - PEER_Y_OFFSET, packet.pos.z);
    peer.mesh.position.copy(peer.targetPosition);
    peer.targetYaw = peer.mesh.rotation.y = packet.yaw;
    peer.mesh.visible = true;
}

function grantRespawn(peerId: string, lifeId: number): void {
    const runtime = peerRuntime.get(peerId);
    const host = peerId === state.peer?.id;
    const life = host ? hostLife : runtime?.life;
    if (!state.isHost || !state.isPlaying || state.matchEnded || !life || life.id !== lifeId || life.hp > 0) return;
    const spawn = getTownSpawn(getWorldSeed(), 'church');
    const weapon = runtime?.weaponState.activeWeapon ?? getActiveWeaponName();
    const packet: PlayerRespawnPacket = { type: 'player_respawn', peerId, lifeId: lifeId + 1, weapon,
        pos: { x: spawn.x, y: PLAYER_HEIGHT, z: spawn.z }, yaw: spawn.yaw,
        cooldownMs: (runtime?.shots ?? hostMechaShots).remainingCooldown(performance.now()) };
    if (runtime) {
        runtime.handling.reset(weapon); runtime.commandAck = 0; runtime.shotAck = -1;
        runtime.held = runtime.freshTrigger = runtime.correctionDue = false;
        runtime.hookFlight = 'spent'; runtime.wasMounted = false;
        runtime.life = createPlayerLife(packet.lifeId);
        runtime.position.set(packet.pos.x, packet.pos.y, packet.pos.z);
        runtime.yaw = spawn.yaw;
        runtime.pitch = 0;
        runtime.weaponState = initialWeaponState(weapon);
        runtime.motion = new TargetMotionHistory();
        runtime.travelAllowance = NETWORK_MOVEMENT_BURST;
        runtime.lastUpdateAt = performance.now();
    } else {
        hostLife = createPlayerLife(packet.lifeId);
    }
    broadcastToAll(packet);
    applyRespawn(packet);
    publishHandling(peerId);
}

export function requestMultiplayerRespawn(): void {
    if (!state.peer || state.playerHp > 0 || !state.isPlaying || state.matchEnded) return;
    if (state.isHost) grantRespawn(state.peer.id, state.lifeId);
    else broadcastToAll({ type: 'respawn_request', lifeId: state.lifeId });
}
let localMotion = new TargetMotionHistory(), localMotionLife = -1;
const npcMotion = new Map<number, { object: THREE.Group; revision: number; history: TargetMotionHistory }>();
function peerMotion(peerId: string, now: number): TargetMotionHistory | null {
    const position = getPeerHitPosition(peerId), yaw = getPeerHitYaw(peerId);
    if (!position || yaw === null) return null;
    if (peerId !== state.peer?.id) return getPeerRuntime(peerId)?.motion ?? null;
    if (localMotionLife !== state.lifeId) { localMotion = new TargetMotionHistory(); localMotionLife = state.lifeId; }
    localMotion.add(now, position, yaw);
    return localMotion;
}
function targetMotion(index: number, now: number): TargetMotionHistory | null {
    const object = state.targets[index];
    if (!object) return null;
    const revision = targetData(object).eliminationRevision ?? 0;
    let tracked = npcMotion.get(index);
    if (!tracked || tracked.object !== object || tracked.revision !== revision) {
        tracked = { object, revision, history: new TargetMotionHistory() }; npcMotion.set(index, tracked);
    }
    tracked.history.add(now, object.position, object.rotation.y);
    return tracked.history;
}

let lastSentTime = 0;
let lastSentSnapshot: {
    x: number;
    y: number;
    z: number;
    yaw: number;
    pitch: number;
    weapon: string;
    switchState: UpdatePacket['switchState'];
    nextWeapon: WeaponName | null;
    flags: number;
    hookX: number;
    hookY: number;
    hookZ: number;
    hookState: UpdatePacket['hookState'];
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
        // Pending channels belong to this same snapshot: admission responses
        // may return out of order, so a later generation must still retain an
        // earlier peer whose response has not arrived yet.
        void heartbeatTurnRoom(room, closeToken, [...new Set([...state.connections.map(c => c.peer), ...pendingConnectionPeers])], acknowledgedAdmissionGeneration).catch(() => {
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
    if (data.infantry) return null;
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
    if (data.infantry) return false;
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
    const mecha = captureMechaSnapshot();
    const packet: WorldSnapshotPacket = {
        type: 'world_snapshot',
        gameStarted: state.isPlaying,
        username: admittedNames.get(conn.peer)!,
        senderPeerId: state.peer?.id,
        seed: getWorldSeed(),
        spawnHouseSlot,
        score: state.score,
        dayNightElapsedSeconds: state.dayNightElapsedSeconds,
        players: refreshHostRoster(),
        targets,
        ...(mecha ? { mecha } : {}),
        ...(infantry ? { infantry: infantry.snapshot() } : {}),
    };
    try {
        conn.send(packet);
        if (state.isPlaying && state.peer) {
            for (const id of [state.peer.id, ...peerRuntime.keys()]) {
                // A paused or dead peer may not send another movement update.
                const last = remotePoses.get(id), runtime = peerRuntime.get(id);
                if (id !== conn.peer && last && runtime) {
                    const {inspectTime, switchTime, ...pose} = last.packet;
                    const age = Math.max(0, performance.now()/1000-last.at);
                    conn.send({...pose, pos:{x:runtime.position.x,y:runtime.position.y,z:runtime.position.z},
                        lifeId:runtime.life.id, hp:runtime.life.hp, isDead:runtime.life.hp === 0,
                        ...(typeof inspectTime === 'number' && inspectTime+age<3.8 ? {inspectTime:inspectTime+age} : {}),
                        ...(typeof switchTime === 'number' ? {switchTime:Math.min(.15,switchTime+age)} : {}),
                        ...(runtime.hookFlight === 'spent' ? {hookState:'IDLE' as const,hookPos:null,movingHook:false} : {}),
                        ...(runtime.life.hp <= 0 ? {isHovering:false} : {})});
                }
                const status = handlingPacket(id);
                if (status) conn.send(status);
            }
        }
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

// main.ts owns renderer preparation; networking supplies the seed and a session
// validity predicate without importing the client composition root.
let multiplayerWorldLoader: ((seed: number, current: () => boolean, spawnSlot?: number) => Promise<void>) | null = null;
// Preserve host packet order while a client builds its world. Apply the snapshot
// first, then replay these updates; null means ordinary live packet handling.
let pendingWorldPackets: { peer: string; packet: NetworkPacket }[] | null = null;
export function setMultiplayerWorldLoader(loader: typeof multiplayerWorldLoader): void { multiplayerWorldLoader = loader; }

function applyWorldSnapshot(packet: WorldSnapshotPacket, prepared = false): void {
    if (!prepared) rebuildEnvironmentWithSeed(packet.seed);
    if (forgottenMecha?.networked && !packet.mecha) throw new Error('Multiplayer requires the same client build. Reload both players.');
    if (infantry && !packet.infantry) throw new Error('Multiplayer requires the same client build. Reload both players.');
    state.dayNightElapsedSeconds = packet.dayNightElapsedSeconds;
    state.dayNightSyncPending = true;
    state.dayNightSyncImmediate = true;
    placePlayerAtTownSpawn(packet.seed, 'house', packet.spawnHouseSlot);
    if (packet.players?.[0].peerId === getHostPeerId()) state.lobbyPlayers = packet.players;
    for (const target of packet.targets) {
        applyTargetState(target);
    }
    rebuildTargetHash();
    if (packet.infantry) {
        infantry?.receive(packet.infantry);
        rebuildInfantryHash();
    }
    setScore(packet.score);
    clientWorldSynchronized = true;
    clearWorldSyncTimeout();
    setCachedUsername(packet.username);
    setJoinReady(true, `You are ${packet.username}. Waiting for the host to start the game…`);
    // The local picker may have changed after the connection metadata was sent.
    publishSuitColor();
    if (packet.gameStarted) enterMultiplayerMatch();
    if (packet.mecha) receiveMechaState(packet.mecha);
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
    return state.activeWeaponName === 'KATANA' || Object.prototype.hasOwnProperty.call(WEAPON_STATS, state.activeWeaponName)
        ? state.activeWeaponName as WeaponName
        : 'PISTOL';
}

function errorMessage(error: unknown, fallback: string): string {
    return error instanceof Error && error.message ? error.message : fallback;
}

function resetLocalMatch(): void {
    localCommand = 0; localShot = -1; localAckRevision = 0; handlingRevision = 0;
    handlingCopies.clear(); handlingPhases.clear(); remotePoses.clear();
    resetMechaNetwork(); hostMechaShots = new ShotLedger(); mechaMotion = null;
    hostLife = createPlayerLife(0); pendingLocalHealth = null; lastInfantryPublish = -Infinity;
    npcMotion.clear(); localMotion = new TargetMotionHistory(); localMotionLife = -1;
    state.playerList = [];
    setPlayerListVisible(false);
    resetHook();
    resetProjectiles();
    disposeParticles();
    resetPlayerState();
    state.lifeId = 0;
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
        watchSignallingClose(peer, generation);
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
            publishLobbyRoster();
            const startBtn = DOM.btnHostStart();
            if (startBtn) startBtn.style.display = 'inline-block';
        });

        peer.on('connection', (conn) => {
            if (!isCurrentSession(generation) || !state.isHost) {
                conn.close();
                return;
            }
            const metadata = conn.metadata as { admissionToken?: unknown; version?: unknown } | null;
            if (!isPeerId(conn.peer) || !isCapability(metadata?.admissionToken) || metadata?.version !== NETWORK_PROTOCOL_VERSION) {
                conn.close(); return;
            }
            const currentPlayers = state.connections.length + 1;
            const duplicate = pendingConnectionPeers.has(conn.peer) || state.connections.some((item) => item.peer === conn.peer);
            if (duplicate || currentPlayers >= MAX_PLAYERS || pendingConnectionPeers.size >= MAX_PENDING_ROOM_CONNECTIONS) {
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
            showJoinError(err.type === 'unavailable-id' ? 'Code already in use. Please try again.' : `Connection failed: ${err.type || 'unknown error'}`);
            disconnectMultiplayer({ preserveJoinError: true });
        });
    } catch (error) {
        if (!isCurrentSession(generation)) return;
        console.error('Failed to create host peer:', error);
        const message = errorMessage(error, 'Unable to create the room. Please retry.');
        showJoinError(message);
        disconnectMultiplayer({ preserveJoinError: true });
        throw new Error(message);
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
        watchSignallingClose(peer, generation);
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
            const conn = peer.connect(hostPeerId, { metadata: { admissionToken: registration.admissionToken,
                version: NETWORK_PROTOCOL_VERSION, bodyColor: Number.parseInt(characterColor.slice(1), 16) } });

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

export function disconnectMultiplayer(options: { preserveJoinError?: boolean; notifyRuntime?: boolean } = {}): void {
    if (disconnecting) return;
    const hadSession = state.isMultiplayer || peerInstance !== null;
    disconnecting = true;
    if (colorPublishTimer !== null) clearTimeout(colorPublishTimer);
    colorPublishTimer = null;
    lastColorPublish = -Infinity;
    resetMechaNetwork(); hostMechaShots = new ShotLedger(); mechaMotion = null;
    hostLife = createPlayerLife(0); pendingLocalHealth = null; lastInfantryPublish = -Infinity;
    if (healthInterval) clearInterval(healthInterval);
    healthInterval = null;
    const roomToRelease = state.roomCode;
    const wasHost = state.isHost;
    const closeToken = roomCloseToken;
    const sessionToken = turnSessionToken;
    roomCloseToken = null;
    turnSessionToken = null;
    stopRoomHeartbeat();
    acknowledgedAdmissionGeneration = 0;
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
    state.lobbyPlayers = [];
    state.playerList = [];
    setPlayerListVisible(false);
    state.pendingPlay = false;
    state.isMouseDown = false;
    state.moveForward = state.moveBackward = state.moveLeft = state.moveRight = false;
    state.isShiftDown = state.isHovering = false;
    state.roomCode = null;
    state.kills = 0;
    state.deaths = 0;
    lastSentSnapshot = null;
    lastSentTime = 0;
    clientWorldSynchronized = false;
    state.dayNightSyncPending = false;
    state.dayNightSyncImmediate = false;
    targetStateFingerprints.clear();
    peerRuntime.clear();
    handlingCopies.clear(); handlingPhases.clear(); remotePoses.clear();
    resetKatana();
    npcMotion.clear(); localMotion = new TargetMotionHistory(); localMotionLife = -1;
    pendingConnectionPeers.clear();

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
    state.peers = Object.create(null);
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
    try {
        if (hadSession && options.notifyRuntime !== false) {
            for (const listener of disconnectListeners) listener({ wasHost, reason: options.preserveJoinError ? persistentJoinError : null });
        }
    } finally { disconnecting = false; }
}

function showJoinError(msg: string): void {
    persistentJoinError = msg;
    const joinErrorLog = state.isHost ? DOM.hostLobbyStatus() : DOM.joinErrorLog();
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

function watchSignallingClose(peer: Peer, generation: number): void {
    const closed = () => {
        if (!isCurrentSession(generation) || peerInstance !== peer) return;
        showJoinError('The signalling connection was lost. Please reconnect.');
        disconnectMultiplayer({ preserveJoinError: true });
    };
    peer.on('disconnected', closed);
    peer.on('close', closed);
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

function setupConnection(conn: DataConnectionLike, generation: number): void {
    let closed = false;
    let admitted = false;
    let opening = false;
    const current = () => !closed && isCurrentSession(generation);
    const cleanup = () => { closed = true; clearTimeout(timeoutId); connectionCleanup.delete(conn); conn.close(); };
    const timeout = () => {
        if (!current() || admitted) return;
        if (!state.isHost) showJoinError('Connection authorization timed out. Please retry.');
        handleClose(); // PeerJS does not emit close for a channel that never opened.
        conn.close();
    };
    let timeoutId = setTimeout(timeout, state.isHost ? 5000 : 20_000);
    connectionCleanup.set(conn, cleanup);
    const handleOpen = async () => {
        if (!current() || opening) return;
        opening = true;
        if (!state.isHost) return; // Wait for the proof delivered by the verified host.
        clearTimeout(timeoutId);
        timeoutId = setTimeout(timeout, 20_000);
        const room = state.roomCode;
        const closeToken = roomCloseToken;
        const metadata = conn.metadata as { admissionToken?: unknown; bodyColor?: unknown } | null;
        if (!room || !closeToken || !isCapability(metadata?.admissionToken)) { conn.close(); return; }
        let serverAdmitted = false;
        try {
            const result = await admitRoomPeer(room, closeToken, conn.peer, metadata.admissionToken);
            serverAdmitted = true;
            if (isCurrentSession(generation) && roomCloseToken === closeToken) {
                acknowledgedAdmissionGeneration = Math.max(acknowledgedAdmissionGeneration, result.admissionGeneration);
            }
            if (!current()) { void departRoomPeer(room, closeToken, conn.peer).catch(() => {}); return; }
            if ([...admittedNames.values()].some(name => usernameKey(name) === usernameKey(result.username))) {
                throw new Error('Name is already in the room.');
            }
            const usedSlots = new Set(spawnHouseSlots.values());
            let slot = 1;
            while (usedSlots.has(slot)) slot++;
            if (slot >= MAX_PLAYERS) throw new Error('No spawn house available.');
            spawnHouseSlots.set(conn.peer, slot);
            admittedNames.set(conn.peer, result.username);
            peerRuntime.set(conn.peer, createPeerRuntime(result.username, slot));
            admitted = true;
            clearTimeout(timeoutId);
            pendingConnectionPeers.delete(conn.peer);
            state.connections.push(conn);
            const color = metadata.bodyColor;
            if (typeof color === 'number' && Number.isInteger(color) && color >= 0 && color <= 0xffffff) {
                state.lobbyPlayers.push({ peerId: conn.peer, username: result.username, bodyColor: color });
            }
            conn.send({ type: 'admission', proof: result.admissionProof, version: NETWORK_PROTOCOL_VERSION });
            sendWorldSnapshot(conn, slot);
            publishLobbyRoster();
            // A late join must see the host even when its render loop is paused
            // or browser-throttled. Do not wait for the next animation frame.
            sendLocalState(true);
            const status = DOM.hostLobbyStatus();
            if (status) status.innerText = `Waiting for players (${state.connections.length + 1}/${MAX_PLAYERS})...`;
        } catch {
            // Admission can commit before local snapshot/setup fails. A pending
            // channel has no admitted close handler to release that reservation.
            if (serverAdmitted && !admitted) void departRoomPeer(room, closeToken, conn.peer).catch(() => {});
            if (current()) { handleClose(); conn.close(); }
        }
    };
    conn.on('data', (data: unknown) => {
        if (!current()) return;
        if (!admitted) {
            if (state.isHost) return;
            const proof = data as { type?: unknown; proof?: unknown; version?: unknown } | null;
            if (!proof || proof.type !== 'admission' || !expectedHostProof || proof.proof !== expectedHostProof) { conn.close(); return; }
            if (proof.version !== NETWORK_PROTOCOL_VERSION) {
                showJoinError('Multiplayer requires the same client build. Reload both players and rejoin.');
                disconnectMultiplayer({ preserveJoinError: true });
                return;
            }
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
        removePeer(conn.peer);
        if (state.isHost) {
            if (admitted) {
                broadcastToAll({ type: 'peer_left', peerId: conn.peer });
                publishLobbyRoster();
                if (state.roomCode && roomCloseToken) void departRoomPeer(state.roomCode, roomCloseToken, conn.peer).catch(() => {});
            }
            const status = DOM.hostLobbyStatus();
            if (status) status.innerText = `Waiting for players (${state.connections.length + 1}/${MAX_PLAYERS})...`;
        } else {
            showJoinError('Connection to the host was closed.');
            disconnectMultiplayer({ preserveJoinError: true });
            endInput();
        }
    };
    conn.on('close', handleClose);
    conn.on('error', () => { if (current()) { handleClose(); conn.close(); } });
    if (conn.open) void handleOpen(); else conn.on('open', () => { void handleOpen(); });
}

function getPeerRuntime(peerId: string): PeerRuntimeState | null {
    return peerRuntime.get(peerId) ?? null;
}

// Keep the public host query available to authority diagnostics.
export { shotObstructionT } from './world.js';

/** Guided sweeps also stop at intervening bodies. The claimed victim and
 * shooter are excluded; peer poses come from the same bounded observation time. */
function guidedPathBlocker(shooter: string, victim: HomingTargetPacket, ignoreMecha = false) {
    const targets: THREE.Group[] = [];
    return (start: THREE.Vector3, end: THREE.Vector3, radius: number, at?: number, filtered = false): boolean => {
        const obstacle = shotObstructionT(start, end, radius, ignoreMecha);
        if (obstacle !== null && obstacle < 1 - 1e-6) return true;
        // Ordinary straight claims keep their existing intersection policy.
        // A zero-length contact cannot have a different body strictly before it.
        if ((!ignoreMecha && at === undefined) || start.distanceToSquared(end) < 1e-12) return false;
        queryTargetsAlongSegment(start.x, start.z, end.x, end.z, targets, radius);
        for (const object of targets) {
            const data = targetData(object);
            if (data.hp <= 0 || victim.kind === 'npc' && data.index === victim.targetIndex) continue;
            if (segmentSphereHitT(start, end, object.position, TARGET_HIT_RANGE_MULTIPLIER * (data.scale || 1) + radius) !== null) return true;
        }
        return peerBodiesBlockSegment(shooter, victim, start, end, radius, at ?? performance.now(), filtered);
    };
}

const _peerOcclusionPoint = new THREE.Vector3();
function peerBodiesBlockSegment(shooter: string, victim: HomingTargetPacket, start: THREE.Vector3, end: THREE.Vector3,
    radius: number, at: number, filtered: boolean): boolean {
    for (const [id, runtime] of peerRuntime) {
        if (forgottenMecha?.ownsPilot && forgottenMecha.pilotPeerId === id) continue;
        if (id === shooter || victim.kind === 'peer' && id === victim.targetPeerId || runtime.life.hp <= 0 || !runtime.motion.samples.length) continue;
        const yaw = runtime.motion.sample(at, _peerOcclusionPoint, filtered);
        const hit = segmentPlayerHitboxHitT(start, end, _peerOcclusionPoint, yaw, radius);
        if (hit !== null && hit < 1 - 1e-6) return true;
    }
    if (!(forgottenMecha?.ownsLocalPilot) && state.peer?.id !== shooter && !(victim.kind === 'peer' && victim.targetPeerId === state.peer?.id) && hostLife.hp > 0 && localMotion.samples.length) {
        const yaw = localMotion.sample(at, _peerOcclusionPoint, filtered);
        const hit = segmentPlayerHitboxHitT(start, end, _peerOcclusionPoint, yaw, radius);
        if (hit !== null && hit < 1 - 1e-6) return true;
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

/** Acquisition uses the same sampled visible body as the goggles. The host
 * keeps receipt-time history; neither a client timestamp nor lock animation is authority. */
function homingFireContext(fromPeerId: string, packet: FirePacket, now: number): HomingFireContext | null {
    const lock = packet.homingTarget;
    if (!lock || packet.weapon === 'SNIPER') return null;
    const origin = new THREE.Vector3(packet.barrelPos.x, packet.barrelPos.y, packet.barrelPos.z);
    const occluders: THREE.Object3D[] = [], candidates: THREE.Group[] = [];
    const updated = new Set<THREE.Object3D>();
    if (state.peer) peerMotion(state.peer.id, now);
    const peersBlock = (at: number, filtered: boolean) => (start: THREE.Vector3, end: THREE.Vector3) =>
        peerBodiesBlockSegment(fromPeerId, lock, start, end, 0, at, filtered);
    const occludersForRay = (spend: (cost: number) => boolean) =>
        (start: THREE.Vector3, end: THREE.Vector3, obstacleCount: number) => {
            queryTargetsAlongSegment(start.x, start.z, end.x, end.z, candidates);
            if (!spend(1 + obstacleCount + candidates.length + peerRuntime.size)) return null;
            occluders.length = 0;
            for (const target of candidates) {
                const data = targetData(target), body = data.bodyMesh;
                if (data.hp <= 0 || !body || lock.kind === 'npc' && target === state.targets[lock.targetIndex]) continue;
                if (!updated.has(body)) { body.updateWorldMatrix(true, false); updated.add(body); }
                occluders.push(body);
            }
            return occluders;
        };
    if (lock.kind === 'mecha') {
        const actor = forgottenMecha;
        if (!actor?.ready || actor.hp <= 0 || actor.revision !== lock.targetRevision) return null;
        if (!mechaMotion || mechaMotion.actor !== actor || mechaMotion.revision !== actor.revision) mechaMotion = { actor, revision: actor.revision, history: new TargetMotionHistory() };
        mechaMotion.history.add(now, actor.hitbox.position, actor.group.rotation.y);
        const body = actor.hitbox; body.updateMatrixWorld(true); body.geometry.computeBoundingSphere(); body.geometry.computeBoundingBox();
        const radius = body.geometry.boundingSphere!.radius * body.matrixWorld.getMaxScaleOnAxis();
        const query = (sx: number, sz: number, ex: number, ez: number, out: THREE.Object3D[], padding?: number) => {
            queryObstaclesAlongSegment(sx, sz, ex, ez, out, padding);
            for (let i = out.length - 1; i >= 0; i--) if (obstacleData(out[i]).damageTarget === 'forgotten-mecha') out.splice(i, 1);
            return out;
        };
        const observed = body.matrixWorld.clone();
        return { history: mechaMotion.history, kind: 'sphere', radius, aimRadius: radius,
            canAcquire: (position, _yaw, at, filtered, spend) => {
                observed.setPosition(position);
                return hasLineOfSightToOrientedBox(origin, body.geometry.boundingBox!, observed, query, occludersForRay(spend), body, peersBlock(at, filtered));
            } };
    }
    if (lock.kind === 'npc') {
        const object = state.targets[lock.targetIndex];
        if (!object) return null;
        const data = targetData(object);
        if (data.hp <= 0 || (data.eliminationRevision ?? 0) !== lock.targetRevision) return null;
        const history = targetMotion(lock.targetIndex, now)!;
        const body = data.bodyMesh;
        const box = new THREE.Box3(new THREE.Vector3(-1, -1, -1), new THREE.Vector3(1, 1, 1));
        const matrix = new THREE.Matrix4().makeScale(data.scale || 1, data.scale || 1, data.scale || 1);
        if (body) {
            body.updateWorldMatrix(true, false);
            if (!body.geometry.boundingBox) body.geometry.computeBoundingBox();
            box.copy(body.geometry.boundingBox!); matrix.copy(body.matrixWorld);
        } else matrix.setPosition(object.position);
        const offset = new THREE.Vector3().setFromMatrixPosition(matrix).sub(object.position);
        const aimRadius = box.getSize(new THREE.Vector3()).multiply(new THREE.Vector3().setFromMatrixScale(matrix)).length() / 2;
        return { history, kind: 'sphere', radius: TARGET_HIT_RANGE_MULTIPLIER * (data.scale || 1), aimRadius,
            canAcquire: (position, _yaw, at, filtered, spend) => {
                matrix.setPosition(position.clone().add(offset));
                return hasLineOfSightToOrientedBox(origin, box, matrix, queryObstaclesAlongSegment, occludersForRay(spend), object, peersBlock(at, filtered));
            } };
    }
    if (lock.targetPeerId === fromPeerId) return null;
    const host = lock.targetPeerId === state.peer?.id;
    const runtime = getPeerRuntime(lock.targetPeerId);
    if (lock.targetLifeId !== (host ? hostLife.id : runtime?.life.id) ||
        (host ? hostLife.hp <= 0 : (!runtime || runtime.life.hp <= 0)) || (!host && !state.peers[lock.targetPeerId])) return null;
    const history = peerMotion(lock.targetPeerId, now);
    if (!history) return null;
    const box = peerHitBox;
    const matrix = new THREE.Matrix4(), yawRotation = new THREE.Quaternion(), unit = new THREE.Vector3(1, 1, 1);
    return { history, kind: 'player', radius: PLAYER_HITBOX_BOUNDING_RADIUS,
        canAcquire: (position, yaw, at, filtered, spend) => {
            yawRotation.setFromAxisAngle(THREE.Object3D.DEFAULT_UP, yaw); matrix.compose(position, yawRotation, unit);
            return hasLineOfSightToOrientedBox(origin, box, matrix, queryObstaclesAlongSegment, occludersForRay(spend), undefined, peersBlock(at, filtered));
        } };
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
    out.copy(barrelPosition).addScaledVector(normalizedDirection, distance);
    const obstruction = shotObstructionT(barrelPosition, out, 0);
    return obstruction === null ? out : out.lerpVectors(barrelPosition, out, obstruction);
}

export function authorizeClientPacket(fromPeerId: string, packet: NetworkPacket): NetworkPacket | null {
    if (!isKnownClient(fromPeerId) || state.matchEnded) return null;
    const now = performance.now();

    if (packet.type === 'update') {
        const mounted = mountedPeerPosition(fromPeerId);
        if (mounted) packet = { ...packet, pos: { x: mounted.x, y: mounted.y, z: mounted.z }, isMouseDown: false, hookState: 'IDLE', hookPos: null, isHovering: false };
        const reservedName = admittedNames.get(fromPeerId);
        if (!reservedName) return null;
        const color = state.lobbyPlayers.find(player => player.peerId === fromPeerId)?.bodyColor;
        if (color === undefined) return null;
        packet = { ...packet, username: reservedName, bodyColor: color };
        if (![packet.pos.x, packet.pos.y, packet.pos.z].every(Number.isFinite) ||
            Math.abs(packet.pos.x) > MAX_PLAYER_HORIZONTAL_POSITION ||
            Math.abs(packet.pos.z) > MAX_PLAYER_HORIZONTAL_POSITION ||
            packet.pos.y < -20 || packet.pos.y > MAX_PLAYER_VERTICAL_POSITION) return null;
        const runtime = getPeerRuntime(fromPeerId);
        if (!runtime || packet.lifeId !== runtime.life.id) return null;
        if (runtime.life.hp <= 0) return null;
        const allowance = Math.min(NETWORK_MOVEMENT_BURST,
            runtime.travelAllowance + Math.max(0, now - runtime.lastUpdateAt) / 1000 * NETWORK_MOVEMENT_SPEED);
        const nextPosition = _targetPos.set(packet.pos.x, packet.pos.y, packet.pos.z);
        const travel = nextPosition.distanceTo(runtime.position);
        if (!mounted && travel > allowance + 1e-6) return null;
        const weaponState = advanceWeaponState(runtime.weaponState, packet, now);
        if (!weaponState) return null;
        if (mounted) {
            runtime.handling.cancelActions();
            runtime.hookFlight = 'spent';
        } else if (runtime.wasMounted || (runtime.weaponState.switchState === 'IDLE' && weaponState.switchState !== 'IDLE')) {
            const equipped = weaponState.nextWeapon ?? weaponState.activeWeapon;
            runtime.handling.equip(equipped, now/1000, runtime.weaponState.activeWeapon);
            if (!isLight(equipped)) runtime.hookFlight = 'spent';
        }
        runtime.wasMounted = Boolean(mounted);
        runtime.handling.advance(now/1000);
        // A held launcher is reusable. Every new flight still needs its own
        // accepted input, including a flight that reaches a latch between packets.
        if (packet.hookState !== 'IDLE' && runtime.handling.hand === 'drawn' && !mounted &&
            (runtime.hookFlight !== 'spent' || runtime.handling.takeLaunch(now/1000)) &&
            !(packet.hookState === 'FIRING' && runtime.hookFlight === 'latched')) {
            runtime.hookFlight = packet.hookState === 'PULLING' ? 'latched' : 'firing';
        } else {
            if (packet.hookState === 'IDLE') runtime.hookFlight = 'spent';
            packet = {...packet, hookState:'IDLE', hookPos:null, movingHook:false};
        }
        runtime.travelAllowance = mounted ? NETWORK_MOVEMENT_BURST : Math.max(0, allowance - travel);
        runtime.position.copy(nextPosition);
        runtime.yaw = packet.yaw;
        runtime.pitch = packet.pitch;
        runtime.lastUpdateAt = now;
        runtime.weaponState = weaponState;
        if (packet.isMouseDown !== runtime.held) runtime.freshTrigger = packet.isMouseDown;
        runtime.held = packet.isMouseDown;
        if (packet.switchState !== 'IDLE' || packet.activeWeapon !== 'KATANA') invalidateMeleePeer(fromPeerId);
        runtime.motion.add(now, _peerTargetPosition.copy(runtime.position).addScaledVector(THREE.Object3D.DEFAULT_UP, -PEER_Y_OFFSET), runtime.yaw);
        runtime.shots.updateTrigger((packet.isMouseDown || runtime.handling.pendingFire === 'MINIGUN') &&
            packet.activeWeapon === 'MINIGUN' && packet.switchState === 'IDLE' && runtime.handling.canFire('MINIGUN', now/1000), now);
        return { ...packet, senderPeerId: fromPeerId, hp: runtime.life.hp, maxHp: PLAYER_MAX_HP, isDead: false };
    }

    const runtime = getPeerRuntime(fromPeerId);
    if (!runtime || runtime.life.hp <= 0 || !runtime.motion.samples.length) return null;

    if (packet.type === 'fire') {
        if ((packet.lifeId ?? 0) !== runtime.life.id) return null;
        if (!runtime.fireRate.accept(now)) return null;
        if (forgottenMecha?.pilotPeerId === fromPeerId && forgottenMecha.ownsPilot) return null;
        const stats = WEAPON_STATS[packet.weapon];
        if (!stats || packet.weapon !== runtime.weaponState.activeWeapon || runtime.weaponState.switchState !== 'IDLE' ||
            !runtime.handling.canFire(packet.weapon, now/1000)) return null;
        _barrelPos.set(packet.barrelPos.x, packet.barrelPos.y, packet.barrelPos.z);
        // Long barrels extend forward and swing vertically while aiming. A
        // radius alone would also grant that extra reach sideways and behind cover.
        toPlayerLocal(_barrelPos, runtime.position, runtime.yaw, _localBarrelOffset);
        if (_localBarrelOffset.lengthSq() > FIREARM_MUZZLE_REACH[packet.weapon] ** 2 ||
            Math.abs(_localBarrelOffset.x) > MAX_MUZZLE_LATERAL || _localBarrelOffset.z > MAX_MUZZLE_BEHIND_EYE ||
            shotObstructionT(runtime.position, _barrelPos, packet.weapon === 'SNIPER' ? 0 : PROJECTILE_RADIUS) !== null) return null;
        const firePacket = packet;
        if (!runtime.shots.record(firePacket, now, false, () => homingFireContext(fromPeerId, firePacket, now), forgottenMecha?.revision)) return null;
        runtime.handling.spendShot(firePacket.weapon, now/1000);
        if (packet.weapon === 'SNIPER') {
            _baseFireDir.set(packet.dir.x, packet.dir.y, packet.dir.z).normalize();
            canonicalSniperBeamEnd(_barrelPos, _baseFireDir, packet.hitPoint, _targetPos);
            packet = {
                ...packet,
                hitPoint: { x: _targetPos.x, y: _targetPos.y, z: _targetPos.z },
            };
        }
        return { ...packet, pelletCount: stats.pellets ?? 1, senderPeerId: fromPeerId };
    }

    if (packet.type === 'hit_target') {
        const target = state.targets[packet.targetIndex];
        if (!target) return null;
        const targetInfo = targetData(target);
        if (targetInfo.infantry && (targetInfo.hp <= 0 || packet.targetRevision !== targetInfo.eliminationRevision)) return null;
        const targetRadius = TARGET_HIT_RANGE_MULTIPLIER * (targetInfo.scale || 1.0);
        const targetRevision = targetInfo.eliminationRevision ?? 0;
        const history = targetMotion(packet.targetIndex, now)!;
        const identity = { kind: 'npc', targetIndex: packet.targetIndex, targetRevision } as const;
        const blocker = guidedPathBlocker(fromPeerId, identity);
        const body = targetInfo.bodyMesh;
        if (body && runtime.shots.isSniperShot(packet.shotId)) {
            body.updateWorldMatrix(true, false);
            if (!body.geometry.boundingBox) body.geometry.computeBoundingBox();
            const offset = new THREE.Vector3().setFromMatrixPosition(body.matrixWorld).sub(target.position);
            return runtime.shots.consumeSniperBox(packet.shotId, packet.pelletIndex, history, offset,
                body.geometry.boundingBox!, body.matrixWorld, packet.damage, now, blocker)
                ? { ...packet, senderPeerId: fromPeerId } : null;
        }
        if (!runtime.shots.consumeHomingNpc(
            packet.shotId,
            packet.pelletIndex,
            packet.targetIndex,
            targetRevision,
            target.position,
            targetRadius,
            packet.damage,
            now,
            blocker,
        ) && !(targetInfo.infantry ? runtime.shots.consumeMovingNpc(packet.shotId, packet.pelletIndex, history,
            targetRadius, packet.damage, now, blocker, identity) : runtime.shots.consume(
            packet.shotId,
            packet.pelletIndex,
            target.position,
            targetRadius,
            packet.damage,
            now,
            blocker,
            identity,
        ))) return null;
        return { ...packet, senderPeerId: fromPeerId };
    }

    if (packet.type === 'player_hit') {
        if (forgottenMecha?.ownsPilot && forgottenMecha.pilotPeerId === packet.targetPeerId) return null;
        const targetsHost = packet.targetPeerId === state.peer?.id;
        const targetPosition = getPeerHitPosition(packet.targetPeerId);
        const targetYaw = getPeerHitYaw(packet.targetPeerId);
        const history = peerMotion(packet.targetPeerId, now);
        const blocker = guidedPathBlocker(fromPeerId, { kind: 'peer', targetPeerId: packet.targetPeerId, targetLifeId: packet.targetLifeId });
        if (packet.targetLifeId !== (targetsHost ? hostLife.id : getPeerRuntime(packet.targetPeerId)?.life.id)) return null;
        if ((playerLife(packet.targetPeerId)?.hp ?? 0) <= 0 || packet.targetPeerId === fromPeerId || (!targetsHost && !state.peers[packet.targetPeerId]) || !targetPosition || targetYaw === null ||
            (!runtime.shots.consumeHomingPeer(
                packet.shotId,
                packet.pelletIndex,
                packet.targetPeerId,
                packet.targetLifeId,
                targetPosition,
                PLAYER_HITBOX_BOUNDING_RADIUS,
                packet.damage,
                now,
                blocker,
            ) && !runtime.shots.consumePlayerHitbox(
                packet.shotId,
                packet.pelletIndex,
                targetPosition,
                targetYaw,
                packet.damage,
                now,
                blocker,
                { kind: 'peer', targetPeerId: packet.targetPeerId, targetLifeId: packet.targetLifeId },
                history ?? undefined,
            ))) return null;
        return { ...packet, senderPeerId: fromPeerId, attackerName: runtime.username };
    }

    if (packet.type === 'jump') {
        if ((packet.lifeId ?? 0) !== runtime.life.id) return null;
        if (mountedPeerPosition(fromPeerId) || !runtime.jumpRate.accept(now)) return null;
        return { ...packet, senderPeerId: fromPeerId };
    }

    // World snapshots and target mutation packets are host-only.
    return null;
}

function spawnRemoteBullet(
    barrelPos: THREE.Vector3,
    visibleMuzzle: THREE.Vector3,
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
    bullet.position.copy(visibleMuzzle);
    const data = projectileData(bullet);
    data.dx = direction.x;
    data.dy = direction.y;
    data.dz = direction.z;
    data.age = 0;
    data.guidanceRemainder = 0;
    data.guidanceTargetPosition = undefined;
    data.distanceTraveled = 0;
    (data.shotOrigin ??= new THREE.Vector3()).copy(barrelPos);
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
function handlePeerMessage(fromPeerId: string, rawPacket: unknown): void {
    if (!state.isMultiplayer) return;
    const parsed = parseNetworkPacket(rawPacket);
    if (!parsed) {
        console.warn(`Discarded malformed packet from ${fromPeerId}`);
        return;
    }

    let msg: NetworkPacket = parsed;
    if (state.isHost) {
        if (msg.type === 'handling_command') { handleWeaponIntent(fromPeerId, msg); return; }
        if (msg.type === 'handling_state') return;
        if (msg.type === 'melee_command') {
            if (isKnownClient(fromPeerId) && acceptMeleeCommand(fromPeerId, msg) && msg.action === 'start') {
                const peer = peerRuntime.get(fromPeerId);
                if (peer && peer.handling.hand !== 'holstered') {
                    peer.handling.interrupt('KATANA', performance.now()/1000);
                    peer.hookFlight = 'spent';
                    publishHandling(fromPeerId);
                }
            }
            return;
        }
        if (msg.type === 'melee_event' || msg.type === 'melee_hit') return;
        if (msg.type === 'mecha_ending_ready') {
            if (isKnownClient(fromPeerId)) acceptMechaEndingReady(fromPeerId, msg);
            return;
        }
        if (msg.type === 'mecha_input' || msg.type === 'mecha_board') {
            if (isKnownClient(fromPeerId)) acceptMechaCommand(fromPeerId, msg);
            return;
        }
        if (msg.type === 'hit_mecha') { if (isKnownClient(fromPeerId)) authorizeMechaHit(fromPeerId, msg); return; }
        if (msg.type === 'lobby_color') {
            if (isKnownClient(fromPeerId)) {
                const player = state.lobbyPlayers.find(item => item.peerId === fromPeerId);
                if (player && player.bodyColor !== msg.bodyColor) {
                    player.bodyColor = msg.bodyColor;
                    applyRemoteSuitColor(fromPeerId, msg.bodyColor);
                    publishSuitColor();
                }
            }
            return;
        }
        if (!state.isPlaying || state.matchEnded) return;
        if (msg.type === 'respawn_request') {
            if (isKnownClient(fromPeerId)) grantRespawn(fromPeerId, msg.lifeId);
            return;
        }
        // Each reliable fire request is final, even when it arrives before the draw,
        // reload or cadence deadline. A replay cannot spend it later.
        if (parsed.type === 'fire' && parsed.shotId <= (peerRuntime.get(fromPeerId)?.shotAck ?? -1)) return;
        const authorized = authorizeClientPacket(fromPeerId, parsed);
        if (parsed.type === 'fire') {
            const runtime = peerRuntime.get(fromPeerId);
            if (runtime && runtime.life.id === (parsed.lifeId ?? 0) && parsed.shotId > runtime.shotAck) {
                runtime.shotAck = parsed.shotId;
                if (authorized || runtime.intentRate.accept(performance.now())) publishHandling(fromPeerId, !authorized);
                else runtime.correctionDue = true;
            }
        }
        if (!authorized) return;
        msg = authorized;
        if (!state.isPlaying) return;
        if (msg.type === 'hit_target') {
            const result = processTargetHit(msg.targetIndex, msg.damage, fromPeerId);
            if (result.accepted && !result.killed) sendToPeer(fromPeerId, msg);
            syncHostTargetStates();
            return;
        }
        if (msg.type === 'player_hit' && !commitPlayerDamage(msg.targetPeerId, msg.targetLifeId, msg.damage, 'player', fromPeerId)) return;
        if (msg.type === 'update' || msg.type === 'fire' || msg.type === 'player_hit' || msg.type === 'jump') {
            // Echo validated player hits for shooter feedback. Health is sent by
            // the life authority. Ordinary self-originated visuals need no echo.
            broadcastToAll(msg, msg.type === 'player_hit' ? null : fromPeerId);
        }
    } else {
        if (!isExpectedHost(fromPeerId)) return;
        if (pendingWorldPackets) {
            // Bound memory if an untrusted host sends indefinitely during load.
            if (pendingWorldPackets.length >= 4096) {
                showJoinError('World preparation received too many updates. Please retry.');
                disconnectMultiplayer({ preserveJoinError: true });
            } else if (msg.type !== 'world_snapshot') pendingWorldPackets.push({ peer: fromPeerId, packet: msg });
            return;
        }
        if (msg.type === 'player_health' || msg.type === 'player_respawn') {
            if (clientWorldSynchronized && state.isPlaying && !state.matchEnded) {
                if (msg.type === 'player_health') applyHealth(msg);
                else applyRespawn(msg);
            }
            return;
        }
        if (msg.type === 'handling_command') return;
        if (msg.type === 'handling_state') {
            if (clientWorldSynchronized && state.isPlaying && !state.matchEnded) receiveHandling(msg);
            return;
        }
        if (msg.type === 'mecha_state') { receiveMechaState(msg.state); return; }
        if (msg.type === 'mecha_event') { receiveMechaEvent(msg); return; }
        if (msg.type === 'mecha_denied') { receiveMechaDenial(msg); return; }
        if (msg.type === 'start_game') {
            if (clientWorldSynchronized) enterMultiplayerMatch();
            return;
        }
        if (msg.type === 'peer_left') { removePeer(msg.peerId); return; }
        if (msg.type === 'lobby_roster') {
            if (msg.players[0].peerId === getHostPeerId()) {
                for (const peerId of state.peerIds) {
                    if (!msg.players.some(player => player.peerId === peerId)) removePeer(peerId);
                }
                state.lobbyPlayers = msg.players;
                for (const player of msg.players) applyRemoteSuitColor(player.peerId, player.bodyColor);
            }
            return;
        }
        if (msg.type === 'player_list') {
            if (msg.players[0].peerId === getHostPeerId()) {
                state.playerList = msg.players;
                renderPlayerList();
            }
            return;
        }
        if (msg.type === 'world_snapshot') {
            if (clientWorldSynchronized) return;
            if (!multiplayerWorldLoader) { applyWorldSnapshot(msg); return; }
            const generation = sessionGeneration;
            const snapshot = msg;
            pendingWorldPackets = [];
            clearWorldSyncTimeout();
            void multiplayerWorldLoader(snapshot.seed, () => isCurrentSession(generation), snapshot.spawnHouseSlot).then(() => {
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
        if (msg.type === 'infantry_state') {
            if (clientWorldSynchronized && state.isPlaying && !state.matchEnded) infantry?.receive(msg.state);
            return;
        }
        if (msg.type === 'infantry_event') {
            if (clientWorldSynchronized && state.isPlaying && !state.matchEnded && infantry?.acceptSequence(msg.sequence)) {
                applyInfantryEvent(msg.event);
            }
            return;
        }
        if (msg.type === 'update' &&
            (msg.senderPeerId === undefined || msg.senderPeerId === getHostPeerId()) &&
            msg.dayNightElapsedSeconds !== undefined) {
            state.dayNightElapsedSeconds = msg.dayNightElapsedSeconds;
            state.dayNightSyncPending = true;
        }
        if (state.matchEnded) return;
        if (!clientWorldSynchronized || (!state.isPlaying && msg.type !== 'kill_target')) return;
    }

    if (msg.type === 'melee_event') { receiveMeleeEvent(msg); return; }
    if (msg.type === 'melee_hit') { receiveMeleeHit(msg); return; }
    if (msg.type === 'melee_command') return;
    const senderId = msg.senderPeerId || fromPeerId;

    if (msg.type === 'update') {
        if (senderId === state.peer?.id || !state.lobbyPlayers.some(player => player.peerId === senderId)) return;
        let peerData = state.peers[senderId] as PeerData | undefined;
        let justJoined = false;
        if (!peerData) {
            const username = msg.username || 'Guest';
            peerData = createPeerAvatar(username);
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
        peerData.hp = msg.hp;
        peerData.maxHp = msg.maxHp;
        peerData.username = msg.username;

        const color = state.lobbyPlayers.find(player => player.peerId === senderId)?.bodyColor;
        if (color !== undefined) applyRemoteSuitColor(senderId, color);
        _targetPos.set(msg.pos.x, msg.pos.y - PEER_Y_OFFSET, msg.pos.z);
        peerData.targetPosition.copy(_targetPos);
        peerData.targetYaw = msg.yaw;
        if (justJoined) {
            peerData.mesh.position.copy(peerData.targetPosition);
            peerData.mesh.rotation.y = msg.yaw;
        }

        receiveRemotePose(senderId, peerData, msg, justJoined);
        if (msg.isDead) {
            peerData.hp = 0;
            peerData.mesh.visible = Boolean(getPlayerAvatar(peerData.mesh));
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

            if (msg.isHovering && !getPlayerAvatar(peerData.mesh)) {
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
        if (peerData.katanaMesh) peerData.katanaMesh.visible = msg.activeWeapon === 'KATANA';
        peerData.mesh.userData.meleePitch = msg.pitch;
        peerData.mesh.userData.meleeWeapon = msg.activeWeapon;
        peerData.mesh.userData.meleeReady = msg.switchState === 'IDLE';
        if(msg.isDead || msg.activeWeapon !== 'KATANA' || msg.switchState !== 'IDLE') invalidateMeleePeer(senderId);

    } else if (msg.type === 'fire') {
        const remote = state.peers[senderId];
        if (remote && ((msg.lifeId ?? 0) !== (remote.lifeId ?? 0) || remote.hp <= 0)) return;
        _barrelPos.set(msg.barrelPos.x, msg.barrelPos.y, msg.barrelPos.z);
        _baseFireDir.set(msg.dir.x, msg.dir.y, msg.dir.z).normalize();
        _observerMuzzle.copy(_barrelPos);
        const firingPeer = state.peers[senderId];
        if (firingPeer) {
            const firingWeapon = msg.weapon === 'PISTOL' ? firingPeer.pistolMesh
                : msg.weapon === 'SHOTGUN' ? firingPeer.shotgunMesh
                : msg.weapon === 'AR' ? firingPeer.arMesh
                : msg.weapon === 'SNIPER' ? firingPeer.sniperMesh
                : firingPeer.minigunMesh;
            getPlayerAvatar(firingPeer.mesh)?.rig.muzzleFor(msg.weapon).getWorldPosition(_observerMuzzle);
            firingWeapon.userData.onAvatarFire?.();
            triggerMuzzleFlash(firingWeapon);
        }

        if (msg.weapon === 'SNIPER') {
            const targetPos = _targetPos;
            canonicalSniperBeamEnd(_barrelPos, _baseFireDir, msg.hitPoint, targetPos);
            createLaserBeam(_observerMuzzle, targetPos, WEAPON_STATS.SNIPER.bulletColor);

        } else {
            const stats = WEAPON_STATS[msg.weapon];
            const pelletCount = stats.pellets ?? 1;
            const spreadSeed = msg.spreadSeed;
            const homingTarget = fromHomingTargetPacket(msg.homingTarget, state.targets, state.peers);
            for (let pellet = 0; pellet < pelletCount; pellet++) {
                const direction = spreadDirection(_baseFireDir, spreadSeed, pellet, stats.spread, _dir);
                spawnRemoteBullet(
                    _barrelPos, _observerMuzzle,
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
        if (target && !targetData(target).infantry) {
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
    } else if (msg.type === 'player_died') {
        applyPlayerDeath(msg);
    } else if (msg.type === 'jump') {
        const peerData = state.peers[senderId];
        if (peerData && peerData.mesh && peerData.mesh.visible) {
            if (peerData.hp <= 0 || (msg.lifeId ?? 0) !== (peerData.lifeId ?? 0) || msg.powered === false) return;
            const avatar = getPlayerAvatar(peerData.mesh);
            avatar?.powerJump();
            _boosterPos.copy(peerData.mesh.position);
            _boosterPos.y -= 1.45;
            if (!avatar) spawnRocketFlame(_boosterPos, 50, true);
            createShockwave(_boosterPos, 15.0);
        }
    }
}

function applyPlayerDeath(packet: PlayerDiedPacket): void {
    const victimPeer = state.peers[packet.victimPeerId ?? ''];
    if (victimPeer && victimPeer.lifeId !== undefined && packet.lifeId < victimPeer.lifeId) return;
    if (victimPeer?.deathReported && packet.lifeId === victimPeer.lifeId) return;
    if (victimPeer && victimPeer.mesh) {
        victimPeer.lifeId = packet.lifeId;
        victimPeer.deathReported = true;
        victimPeer.hp = 0;
        if (victimPeer.mesh.userData.nameTag) victimPeer.mesh.userData.nameTag.visible = false;
        spawnParticles(victimPeer.mesh.position, 0x8c7ae6, 40, 30, 0.4, 18.0);
        victimPeer.mesh.visible = Boolean(getPlayerAvatar(victimPeer.mesh));
        if (victimPeer.hookLine) victimPeer.hookLine.visible = false;
    }

    if (packet.cause === 'player' && packet.killerPeerId === state.peer?.id) {
        state.kills++;
        const killsEl = DOM.kills();
        if (killsEl) killsEl.innerText = state.kills.toString();

        flashHitmarker(true);
    }
}

// Peer avatars own cloned weapon/name-tag resources, so leaving a room must
// dispose those objects instead of only removing them from the scene.
function removePeer(peerId: string): void {
    handlingCopies.delete(peerId); handlingPhases.delete(peerId); remotePoses.delete(peerId);
    forgetMeleePeer(peerId);
    mechaPeerLeft(peerId);
    const peerData = state.peers[peerId];
    if (peerData) {
        clearDamagePulse(peerData);
        if (peerData.mesh) {
            getPlayerAvatar(peerData.mesh)?.dispose();
            peerData.mesh.removeFromParent();
            const geometries = new Set<THREE.BufferGeometry>(), materials = new Set<THREE.Material>(), textures = new Set<THREE.Texture>();
            peerData.mesh.traverse(child => {
                if ((child instanceof THREE.Mesh || child instanceof THREE.Line) && child.geometry !== SHARED_PROJECTILE_GEO) geometries.add(child.geometry);
                if (!(child instanceof THREE.Mesh || child instanceof THREE.Line || child instanceof THREE.Sprite)) return;
                for (const material of Array.isArray(child.material) ? child.material : [child.material]) {
                    materials.add(material);
                    for (const value of Object.values(material)) if (value instanceof THREE.Texture) textures.add(value);
                }
            });
            textures.forEach(texture => texture.dispose());
            materials.forEach(material => material.dispose());
            geometries.forEach(geometry => geometry.dispose());
        }
        // Hook geometry/material are module-owned and reused by the next peer.
        peerData.hookLine?.removeFromParent();
        delete state.peers[peerId];
        state.peerIds = Object.keys(state.peers);
        console.log(`Disposed remote peer mesh for: ${peerId}`);
    }
}

export function sendLocalState(force = false): void {
    if (!state.isMultiplayer || !state.isPlaying || state.matchEnded || (!state.isHost && state.connections.length === 0) || !state.controls || !state.camera) return;

    const now = performance.now();
    if (!force && now - lastSentTime < NETWORK_TICK_MS) return;
    if (state.isHost) {
        hostMechaShots.updateTrigger((state.isMouseDown || state.weaponHandling.pendingFire === 'MINIGUN') &&
            state.activeWeaponName === 'MINIGUN' && state.switchState === 'IDLE' && state.weaponHandling.canFire('MINIGUN', state.weaponTime), now);
        if (forgottenMecha?.ready) {
            if (!mechaMotion || mechaMotion.actor !== forgottenMecha || mechaMotion.revision !== forgottenMecha.revision) mechaMotion = { actor: forgottenMecha, revision: forgottenMecha.revision, history: new TargetMotionHistory() };
            mechaMotion.history.add(now, forgottenMecha.hitbox.position, forgottenMecha.group.rotation.y);
        }
        syncHostTargetStates();
        if (state.peer) peerMotion(state.peer.id, now);
        for (const index of npcMotion.keys()) if (index < ENEMY_COUNT) targetMotion(index, now);
        for (let index = ENEMY_COUNT; index < state.targets.length; index++) {
            if (targetData(state.targets[index]).hp > 0) targetMotion(index, now);
        }
    }

    const playerObj = state.controls.getObject();
    const camEuler = _stateEuler.setFromQuaternion(state.camera.quaternion, 'YXZ');
    const activeWeapon = getActiveWeaponName();

    const username = getCachedUsername();
    const q2 = (value: number) => Math.round(value * 100) / 100;
    const q3 = (value: number) => Math.round(value * 1000) / 1000;
    const hp = state.isHost ? hostLife.hp : state.playerHp;
    const flags =
        (state.isMouseDown ? 1 : 0) |
        (hp <= 0 ? 2 : 0) |
        (state.isHovering ? 4 : 0) |
        (state.moveForward ? 8 : 0) |
        (state.moveBackward ? 16 : 0) |
        (state.moveLeft ? 32 : 0) |
        (state.moveRight ? 64 : 0) | (state.canJump ? 128 : 0) | (state.isScoped ? 256 : 0) |
        (state.inspectState === 'INSPECTING' ? 512 : 0) | (state.hookIsEnemy ? 1024 : 0);

    const pos = playerObj.position;
    const hookX = state.hookState !== 'IDLE' ? q2(state.hookPosition.x) : 0;
    const hookY = state.hookState !== 'IDLE' ? q2(state.hookPosition.y) : 0;
    const hookZ = state.hookState !== 'IDLE' ? q2(state.hookPosition.z) : 0;
    const snapshot = {
        x: q2(pos.x),
        y: q2(pos.y),
        z: q2(pos.z),
        yaw: q3(camEuler.y),
        pitch: THREE.MathUtils.clamp(q3(camEuler.x), -Math.PI / 2, Math.PI / 2),
        weapon: activeWeapon,
        switchState: state.switchState,
        nextWeapon: state.switchState === 'IDLE' ? null : state.nextWeaponName as WeaponName,
        flags,
        hookX,
        hookY,
        hookZ,
        hookState: state.hookState,
        hp,
        maxHp: state.playerMaxHp,
    };

    const changed = !lastSentSnapshot ||
        Math.abs(snapshot.x - lastSentSnapshot.x) > 0.01 ||
        Math.abs(snapshot.y - lastSentSnapshot.y) > 0.01 ||
        Math.abs(snapshot.z - lastSentSnapshot.z) > 0.01 ||
        Math.abs(snapshot.yaw - lastSentSnapshot.yaw) > 0.002 ||
        Math.abs(snapshot.pitch - lastSentSnapshot.pitch) > 0.002 ||
        snapshot.weapon !== lastSentSnapshot.weapon ||
        snapshot.switchState !== lastSentSnapshot.switchState ||
        snapshot.nextWeapon !== lastSentSnapshot.nextWeapon ||
        snapshot.flags !== lastSentSnapshot.flags ||
        snapshot.hookState !== lastSentSnapshot.hookState ||
        snapshot.hookX !== lastSentSnapshot.hookX ||
        snapshot.hookY !== lastSentSnapshot.hookY ||
        snapshot.hookZ !== lastSentSnapshot.hookZ ||
        snapshot.hp !== lastSentSnapshot.hp ||
        snapshot.maxHp !== lastSentSnapshot.maxHp;

    if (!force && !changed && now - lastSentTime < 250) return;
    lastSentTime = now;
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
        switchState: snapshot.switchState,
        nextWeapon: snapshot.nextWeapon,
        isMouseDown: state.isMouseDown,
        isDead: hp <= 0,
        hookState: state.hookState,
        hookPos: state.hookState !== 'IDLE' ? { x: hookX, y: hookY, z: hookZ } : null,
        isHovering: state.isHovering,
        grounded: state.canJump, scoped: state.isScoped, movingHook: state.hookIsEnemy,
        ...(state.inspectState === 'INSPECTING' ? {inspectTime: Math.min(3.8, state.inspectTimer)} : {}),
        ...(state.switchState !== 'IDLE' ? {switchTime: Math.min(.15,state.switchTimer)} : {}),
        hp: snapshot.hp,
        maxHp: snapshot.maxHp,
        // BinaryPack encodes explicit undefined as null; omit host-only fields.
        ...(state.isHost ? { dayNightElapsedSeconds: state.dayNightElapsedSeconds } : {}),
        hoverKeys: state.isHovering ? {
            w: state.moveForward || touchMove.y < -.1,
            s: state.moveBackward || touchMove.y > .1,
            a: state.moveLeft || touchMove.x < -.1,
            d: state.moveRight || touchMove.x > .1
        } : null
    };

    broadcastToAll(packet);
}

interface RemotePose {
    packet: UpdatePacket;
    at: number;
    velocity: THREE.Vector3;
}
const remotePoses = new Map<string, RemotePose>();
function receiveRemotePose(id: string, peer: PeerData, packet: UpdatePacket, joined: boolean): void {
    const now = performance.now()/1000, previous = remotePoses.get(id);
    const velocity = previous?.velocity ?? new THREE.Vector3();
    if (previous && !joined && previous.packet.lifeId === packet.lifeId && now > previous.at) {
        velocity.set(packet.pos.x - previous.packet.pos.x, packet.pos.y - previous.packet.pos.y,
            packet.pos.z - previous.packet.pos.z).divideScalar(Math.max(.01, now - previous.at)).clampLength(0,NETWORK_MOVEMENT_SPEED);
    } else velocity.set(0,0,0);
    remotePoses.set(id, {packet, at:now, velocity});
    if (peer.mesh.userData.nameTag) peer.mesh.userData.nameTag.visible = !packet.isDead;
}
function presentPeerHook(peer: PeerData, hook: UpdatePacket['hookState'], hookPos: UpdatePacket['hookPos'], muzzle: THREE.Object3D): void {
    // Movement and hand receipts may arrive in different frames. Make the
    // effect and cable visible only after the actual raised pose was sampled.
    if (hook === 'FIRING' && peer.lastHookState !== 'FIRING') triggerMuzzleFlash(peer.leftGun);
    peer.lastHookState = hook;
    if (hook === 'IDLE' || !hookPos || !state.scene) {
        if (peer.hookLine) peer.hookLine.visible = false;
        return;
    }
    if (!peer.hookLine) {
        peer.hookLine = new THREE.Mesh(SHARED_HOOK_GEO, SHARED_HOOK_MAT);
        peer.hookLine.castShadow = true;
        state.scene.add(peer.hookLine);
    }
    muzzle.getWorldPosition(_gunTip);
    _targetPos.set(hookPos.x,hookPos.y,hookPos.z);
    const distance = _targetPos.distanceTo(_gunTip);
    peer.hookLine.visible = distance > .05;
    peer.hookLine.position.copy(_midPoint.addVectors(_gunTip,_targetPos).multiplyScalar(.5));
    peer.hookLine.scale.set(1,1,distance);
    peer.hookLine.lookAt(_targetPos);
}
function enablePeerAvatar(peer: PeerData, color: number) {
    const actor = attachPlayerAvatar(peer.mesh,color);
    if (actor && !peer.leftGun.userData.grappleMuzzle) {
        bindAvatarEffects(actor,peer.leftGun,{PISTOL:peer.pistolMesh, SHOTGUN:peer.shotgunMesh, AR:peer.arMesh,
            SNIPER:peer.sniperMesh, MINIGUN:peer.minigunMesh, KATANA:peer.katanaMesh!});
    }
    return actor;
}
function animatePeer(id: string, peer: PeerData, delta: number): void {
    const pose = remotePoses.get(id);
    if (!pose) return;
    const p = pose.packet, avatar = enablePeerAvatar(peer, peer.mesh.userData.bodyColor ?? 0x8c7ae6);
    if (!avatar) return;
    const now = performance.now()/1000, elapsed = now-pose.at;
    const copy = handlingCopies.get(id);
    const h = state.isHost ? peerRuntime.get(id)?.handling : copy && copy.lifeId === peer.lifeId ? copy.handling : undefined;
    h?.advance(now);
    if (elapsed > .32 || p.isDead) pose.velocity.set(0,0,0);
    const spin = p.activeWeapon === 'MINIGUN' && (p.isMouseDown || h?.pendingFire === 'MINIGUN') &&
        p.switchState === 'IDLE' && (h?.canFire('MINIGUN',now) ?? true);
    peer.minigunRamp = THREE.MathUtils.clamp((peer.minigunRamp ?? 0) + delta*(spin ? 1 : -2), 0,3);
    const seat = forgottenMecha?.ownsPilot && forgottenMecha.pilotPeerId === id ? forgottenMecha : null;
    const cableAllowed = !state.isHost || peerRuntime.get(id)?.hookFlight !== 'spent';
    const hook = h?.hand === 'drawn' && cableAllowed && peer.hp > 0 && !p.isDead && !seat ? p.hookState : 'IDLE';
    avatar.update(delta,{weapon:p.activeWeapon,grounded:p.grounded ?? Math.abs(pose.velocity.y)<.1,
        velocity:pose.velocity,yaw:peer.mesh.rotation.y,pitch:p.pitch,hover:p.isHovering,hook,
        hookMoving:p.movingHook,scoped:p.scoped,inspectTime:p.inspectTime === undefined ? undefined : p.inspectTime+elapsed,
        switchState:p.switchState,switchTime:(p.switchTime ?? 0)+elapsed,minigunRamp:peer.minigunRamp,alive:peer.hp>0,
        lifeId:peer.lifeId ?? p.lifeId,katana:getKatanaAction(id),gentle:userSettings.photosensitivityMode,
        pilot:seat?.pilotAvatarPhase, pilotProgress:seat?.pilotAvatarProgress,
        handling:h ? {hand:h.hand,handWeapon:h.handWeapon,outgoingLight:h.outgoingLight,handProgress:THREE.MathUtils.clamp((now-h.handStarted)/Math.max(.0001,h.handEnds-h.handStarted),0,1),
            reloadProgress:h.reload ? (now-h.reload.started)/(h.reload.ends-h.reload.started) : undefined,
            chargeStage:isFirearm(p.activeWeapon)?h.chargeStage(p.activeWeapon,now):4}:undefined});
    presentPeerHook(peer,hook,p.hookPos,avatar.rig.grappleMuzzle);
}
export function updateRemotePeers(delta: number): void {
    if (!state.isMultiplayer) return;

    const peerIds = state.peerIds;
    const alpha = 1 - Math.exp(-NETWORK_POSITION_RESPONSE * delta);
    for (let i = 0; i < peerIds.length; i++) {
        const peerData = state.peers[peerIds[i]];
        if (!peerData) continue;

        // Health is replicated by the victim. Predicting regeneration here can
        // resurrect a stale health value and makes inspection disagree with combat.
        if (!(forgottenMecha?.ownsPilot && forgottenMecha.pilotPeerId === peerIds[i])) {
            peerData.mesh.position.lerp(peerData.targetPosition, alpha);
            const currentYaw = peerData.mesh.rotation.y, diff = peerData.targetYaw - currentYaw;
            peerData.mesh.rotation.y = currentYaw + Math.atan2(Math.sin(diff), Math.cos(diff))*alpha;
        }
        animatePeer(peerIds[i], peerData, delta);
        updateMuzzleFlash(peerData.leftGun, delta);
        updateMuzzleFlash(peerData.pistolMesh, delta);
        updateMuzzleFlash(peerData.shotgunMesh, delta);
        updateMuzzleFlash(peerData.arMesh, delta);
        updateMuzzleFlash(peerData.sniperMesh, delta);
        updateMuzzleFlash(peerData.minigunMesh, delta);
    }
}

function broadcastLocalFire(
    barrelPos: THREE.Vector3,
    dir: THREE.Vector3,
    hitPoint: THREE.Vector3 | null,
    shotId: number,
    spreadSeed: number,
    homingTarget?: HomingTargetPacket,
    homingStartDistance?: number,
): void {
    if (!state.isMultiplayer || (!state.isHost && state.connections.length === 0)) return;
    sendLocalState(true);
    const weapon = getActiveWeaponName();
    if (weapon === 'KATANA') return;

    const packet: FirePacket = {
        type: 'fire',
        lifeId: state.lifeId,
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

    if (state.isHost && forgottenMecha?.networked) {
        hostMechaShots.updateTrigger(weapon === 'MINIGUN', performance.now());
        hostMechaShots.record(packet, performance.now(), hostLife.hp <= 0, () => homingFireContext(state.peer!.id, packet, performance.now()), forgottenMecha?.revision);
    }
    localShot = shotId;
    broadcastToAll(packet);
    if (state.isHost && state.peer) publishHandling(state.peer.id);
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

export function broadcastLocalJump(powered = true): void {
    if (!state.isMultiplayer || state.connections.length === 0) return;
    const packet: JumpPacket = {
        type: 'jump', powered, lifeId:state.lifeId
    };
    broadcastToAll(packet);
}

// Keep weapon simulation independent from the networking module so scene-model
// construction does not participate in a weapons ↔ multiplayer import cycle.
setWeaponNetworkPort({
    sendSwitchStart: () => sendLocalState(true),
    sendWeaponIntent: sendLocalIntent,
    broadcastLocalFire,
    broadcastToAll,
    flashPeerMesh,
});

// The wrapper is the network pose. The skin, weapon attachment and name tag
// are children so cockpit placement never changes replicated movement units.
function createPeerAvatar(username: string): PeerData {
    if (!state.scene) throw new Error('Scene not initialized');

    const peerGroup = new THREE.Group();
    const avatar = attachPlayerAvatar(peerGroup, 0x8c7ae6);
    // Combat and scanner bounds are available even during asynchronous model loading.
    setPeerScanBounds(peerGroup, peerHitBox);
    const leftGun = new THREE.Group(), rightGunContainer = new THREE.Group();
    peerGroup.add(leftGun,rightGunContainer);
    excludeFromStablePeerEnvelope(leftGun);
    excludeFromStablePeerEnvelope(rightGunContainer);
    leftGun.position.set(-.7,0,-.5);
    rightGunContainer.position.set(.7,0,-.5);
    const pistolMesh = new THREE.Group(), shotgunMesh = new THREE.Group(), arMesh = new THREE.Group();
    const sniperMesh = new THREE.Group(), minigunMesh = new THREE.Group(), katanaMesh = new THREE.Group();
    rightGunContainer.add(pistolMesh,shotgunMesh,arMesh,sniperMesh,minigunMesh,katanaMesh);
    if (avatar) bindAvatarEffects(avatar,leftGun,{PISTOL:pistolMesh, SHOTGUN:shotgunMesh, AR:arMesh,
        SNIPER:sniperMesh, MINIGUN:minigunMesh, KATANA:katanaMesh});

    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 64;
    const ctx = canvas.getContext('2d');
    const drawNameTag = () => {
        if (!ctx) return;
        ctx.clearRect(0, 0, 256, 64);
        ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
        ctx.fillRect(0, 0, 256, 64);
        ctx.font = '700 24px "Science Gothic", sans-serif';
        ctx.fillStyle = '#ffffff';
        ctx.textAlign = 'center';
        ctx.fillText(username, 128, 40, 240);
    };
    drawNameTag();

    const spriteMat = new THREE.SpriteMaterial({ 
        map: new THREE.CanvasTexture(canvas), 
        transparent: true 
    });
    const nameSprite = new THREE.Sprite(spriteMat);
    nameSprite.position.set(0, 1.05, 0);
    peerGroup.userData.nameTag = nameSprite;
    nameSprite.scale.set(3, 0.75, 1);
    peerGroup.add(nameSprite);

    state.scene.add(peerGroup);


    // Canvas does not repaint when a web font finishes loading. Refresh only
    // while this peer still owns the sprite and its texture.
    if (document.fonts?.load) {
        void document.fonts.load('700 24px "Science Gothic"', username).then(() => {
            if (!peerGroup.parent || !spriteMat.map) return;
            drawNameTag();
            spriteMat.map.needsUpdate = true;
        }).catch(() => {});
    }

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
        katanaMesh,
        hookLine: null,
        lastHookState: 'IDLE',
        hp: PLAYER_MAX_HP,
        maxHp: PLAYER_MAX_HP,
    };
}


let hostMechaShots = new ShotLedger();
let mechaMotion: { actor: NonNullable<typeof forgottenMecha>; revision: number; history: TargetMotionHistory } | null = null;
let lastInfantryPublish = -Infinity;

export function publishInfantryState(force = false): void {
    if (!infantry || !state.isMultiplayer || !state.isHost || !state.connections.length) return;
    const now = performance.now();
    if (!force && now - lastInfantryPublish < INFANTRY_NETWORK_INTERVAL) return;
    lastInfantryPublish = now;
    broadcastToAll({ type: 'infantry_state', state: infantry.snapshot() });
}

function publishInfantryEvent(event: InfantryEvent): void {
    if (!infantry || !state.isMultiplayer || !state.isHost) return;
    const packet: InfantryEventPacket = { type: 'infantry_event', sequence: infantry.nextSequence(), event };
    broadcastToAll(packet);
}

export function publishInfantryKill(index: number, revision: number, killer?: string): void {
    publishInfantryEvent({ kind: 'kill', slot: index - ENEMY_COUNT, revision, score: state.score,
        killer: killer ?? state.peer?.id ?? null });
}

function applyInfantryEvent(event: InfantryEvent): void {
    if (event.kind === 'kill') {
        infantry?.acceptKill(event);
        setScore(event.score);
        if (event.killer === state.peer?.id) flashHitmarker(true);
        return;
    }
    const { start, end } = event;
    if (event.robot === 'base') createLaserBeam(new THREE.Vector3(start.x, start.y, start.z), new THREE.Vector3(end.x, end.y, end.z), 0xfac377);
}

export function infantryAttack(kind: InfantryKind, start: THREE.Vector3, end: THREE.Vector3, victim?: InfantryPlayer): void {
    const point = (position: THREE.Vector3) => ({ x: position.x, y: position.y, z: position.z });
    let remoteVictim: { peerId: string; lifeId: number } | undefined;
    if (victim?.mounted) {
        const actor = forgottenMecha;
        if (actor?.mode === 'piloted' && actor.revision === victim.mounted.revision) {
            const contact = actor.weaponContact(start, end, start, .05);
            if (contact?.surface === 'shield') {
                if (state.isMultiplayer) announceMechaShield(contact.point);
                else actor.combat.shieldImpact(contact.point);
            } else if (contact) {
                if (state.isMultiplayer) {
                    const result = actor.damage(INFANTRY[kind].damage, { origin: start, point: contact.point, surface: 'body' });
                    if (result.accepted) announceMechaHit(null, result.killed, contact.point, _baseFireDir.subVectors(end, start).normalize());
                } else processMechaHit(INFANTRY[kind].damage, { origin: start, point: contact.point, surface: 'body' });
            }
        }
    } else if (victim) {
        if (!state.isMultiplayer) {
            if (state.lifeId === victim.lifeId) takePlayerDamage(INFANTRY[kind].damage, 'Enemy');
        } else if (commitPlayerDamage(victim.id, victim.lifeId, INFANTRY[kind].damage, 'infantry')) {
            remoteVictim = { peerId: victim.id, lifeId: victim.lifeId };
        }
    }
    const event: InfantryEvent = { kind: 'attack', robot: kind, start: point(start), end: point(end),
        ...(remoteVictim ? { victim: remoteVictim } : {}) };
    applyInfantryEvent(event);
    publishInfantryEvent(event);
}

export function infantryPlayers(): InfantryPlayer[] {
    const actor = forgottenMecha;
    const mounted = actor?.mode === 'piloted' ? {
        revision: actor.revision, bounds: new THREE.Box3().setFromObject(actor.hitbox),
        closestPoint: (origin: THREE.Vector3, out: THREE.Vector3) => actor.closestArmorPoint(origin, out),
    } : undefined;
    const local = state.controls?.getObject();
    const players = state.isMultiplayer ? mechaPlayers() : local ? [
        { peerId: 'local', lifeId: state.lifeId, position: local.position.clone(), yaw: local.rotation.y, alive: state.playerHp > 0 },
    ] : [];
    return players.flatMap(player => {
        if (!player.peerId || !player.alive) return [];
        const piloting = actor?.ownsPilot && (state.isMultiplayer ? actor.pilotPeerId === player.peerId : actor.ownsLocalPilot);
        if (piloting && !mounted) return [];
        const position = piloting ? actor!.group.position.clone() : player.position.add(new THREE.Vector3(0, -PLAYER_BODY_CAMERA_OFFSET, 0));
        return [{ id: player.peerId, lifeId: player.lifeId ?? 0, position, yaw: player.yaw ?? 0, ...(piloting && mounted ? { mounted } : {}) }];
    });
}

function mechaPlayers() {
    return state.lobbyPlayers.flatMap(entry => {
        if (entry.peerId === state.peer?.id) {
            const object = state.controls?.getObject();
            return object ? [mechaPlayer(entry.peerId, object.position.clone(), object.rotation.y, hostLife.id, hostLife.hp > 0, state.velocity)] : [];
        }
        const runtime = peerRuntime.get(entry.peerId);
        if (!runtime?.motion.samples.length) return [];
        const samples = runtime.motion.samples, previous = samples.at(-2), latest = samples.at(-1);
        const velocity = previous && latest && latest.at > previous.at ? latest.position.clone().sub(previous.position).multiplyScalar(1000 / (latest.at - previous.at)) : new THREE.Vector3();
        return [mechaPlayer(entry.peerId, runtime.position.clone(), runtime.yaw, runtime.life.id, runtime.life.hp > 0, velocity)];
    });
}
export function authorizeMechaHit(peerId: string, packet: MechaHitPacket): boolean {
    const actor = forgottenMecha, host = peerId === state.peer?.id;
    const runtime = peerRuntime.get(peerId), ledger = host ? hostMechaShots : runtime?.shots;
    if (!state.isHost || !state.isPlaying || state.matchEnded || !actor?.networked || actor.revision !== packet.revision || actor.hp <= 0 || !ledger ||
        (host ? hostLife.hp <= 0 : !runtime || runtime.life.hp <= 0) || actor.ownsPilot && actor.pilotPeerId === peerId) return false;
    let contact: ReturnType<typeof actor.weaponContact> = null;
    let origin = new THREE.Vector3();
    const direction = new THREE.Vector3();
    const accepted = ledger.consumeMechaHit(packet.shotId, packet.pelletIndex, packet.revision, packet.damage, performance.now(),
        (start, end, shotOrigin, radius) => {
            origin = shotOrigin; contact = actor.weaponContact(start, end, shotOrigin, radius);
            direction.subVectors(end, start).normalize();
            return contact?.t ?? null;
        },
        guidedPathBlocker(peerId, { kind: 'mecha', targetRevision: packet.revision }, true));
    if (!accepted || !contact) return false;
    const hit = contact as { t: number; surface: 'body' | 'shield'; point: THREE.Vector3 };
    if (hit.surface === 'shield') { announceMechaShield(hit.point); return true; }
    const mounted = actor.ownsPilot;
    const result = actor.damage(packet.damage, { origin, point: hit.point, surface: hit.surface });
    if (!result.accepted) return false;
    if (result.killed && !mounted) state.score++;
    announceMechaHit(peerId, result.killed, hit.point, direction); return true;
}
setMechaNetworkPort({
    send: broadcastToAll,
    players: mechaPlayers,
    sendTo: sendToPeer,
    endingPeers: () => state.connections.filter(conn => conn.open && isKnownClient(conn.peer)).map(conn => conn.peer),
    hitTarget: (index, damage, owner) => processTargetHit(index, damage, owner ?? undefined),
    acceptedDamage: (peerId, lifeId, attacker, damage, mechaSequence) => {
        commitPlayerDamage(peerId, lifeId, damage, attacker ? 'player' : 'mecha', attacker, mechaSequence);
    },
});


setMeleeNetworkPort({
    ready: peerId => !state.isMultiplayer || (peerId===state.peer?.id ? hostMechaShots : peerRuntime.get(peerId)?.shots)?.ready(performance.now()) === true,
    reserve: peerId => { if(state.isMultiplayer) (peerId===state.peer?.id ? hostMechaShots : peerRuntime.get(peerId)?.shots)?.reserveMelee(performance.now(),KATANA.duration); },
    hitTarget: (index,damage,attacker,sequence) => {
        const result = processTargetHit(index,damage,attacker.id==='local'?undefined:attacker.id);
        if (state.isMultiplayer && result.accepted && !result.killed) {
            broadcastToAll({type:'hit_target',shotId:sequence,pelletIndex:0,targetIndex:index,damage,senderPeerId:attacker.id});
            syncHostTargetStates();
        }
        return result;
    },
    players: () => {
        const local = localMeleePlayer();
        if (!state.isMultiplayer) return [local];
        if (state.isHost) return [local, ...Array.from(peerRuntime, ([id, p]) => ({id, lifeId:p.life.id, alive:p.motion.samples.length > 0 && p.life.hp > 0 && !(forgottenMecha?.ownsPilot && forgottenMecha.pilotPeerId===id),
            ready:p.weaponState.activeWeapon==='KATANA' && p.weaponState.switchState==='IDLE' && !(forgottenMecha?.ownsPilot && forgottenMecha.pilotPeerId===id),
            position:p.position.clone(), yaw:p.yaw, pitch:p.pitch, name:p.username}))];
        return [local, ...Object.entries(state.peers).map(([id,p]) => ({id,lifeId:p.lifeId??0,alive:p.hp>0 && !(forgottenMecha?.ownsPilot && forgottenMecha.pilotPeerId===id),
            ready:p.mesh.userData.meleeWeapon==='KATANA' && p.mesh.userData.meleeReady===true,
            position:p.targetPosition.clone().add(new THREE.Vector3(0,PLAYER_BODY_CAMERA_OFFSET,0)),yaw:p.targetYaw,pitch:p.mesh.userData.meleePitch??0,name:p.username}))];
    },
    sendCommand: packet => { sendLocalState(true); broadcastToAll(packet); },
    emit: broadcastToAll,
    confirmHit: broadcastToAll,
    blocked: (start,end,mecha) => { const t=shotObstructionT(start,end,0,mecha); return t!==null && t<1-1e-6; },
    hitPlayer: (victim,attacker,damage,sequence) => {
        if (state.isMultiplayer && !state.isHost) return;
        if (!state.isMultiplayer) {
            takePlayerDamage(damage, attacker.name, attacker.id);
            return;
        }
        if (!commitPlayerDamage(victim.id, victim.lifeId, damage, 'player', attacker.id)) return;
        const packet: PlayerHitPacket={type:'player_hit',shotId:sequence,pelletIndex:0,senderPeerId:attacker.id,
            targetPeerId:victim.id,targetLifeId:victim.lifeId,damage,attackerName:attacker.name};
        if(state.peers[victim.id]) flashPeerMesh(state.peers[victim.id]);
        broadcastToAll(packet);
    },
    hitMecha: (attacker,damage,origin,point,beforeLethal) => {
        const actor=forgottenMecha; if(!actor || state.isMultiplayer && !state.isHost) return false;
        if(!state.isMultiplayer) { const hp = actor.hp; processMechaHit(damage,{origin,point,surface:'body',beforeLethal}); return actor.hp < hp; }
        if (actor.combat.shieldActive && !actor.combat.isInsideShield(origin)) {
            announceMechaShield(point);
            return false;
        }
        const mounted=actor.ownsPilot;
        const result=actor.damage(damage,{origin,point,surface:'body',beforeLethal});
        if(!result.accepted) return false;
        if(result.killed && !mounted) state.score++;
        if(state.isMultiplayer) announceMechaHit(attacker.id,result.killed,point,point.clone().sub(origin).normalize());
        return true;
    },
});
