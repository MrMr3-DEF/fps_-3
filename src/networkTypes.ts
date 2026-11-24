import { fields, isPacketRecord as isRecord, projectKnown, variant, vectorFields as vec, type Projection } from './networkProjection.js';
import { parseMechaPacket, isMechaState, mechaStateFields, type MechaPacket, type MechaState } from './mechaNetworkTypes.js';
import { isUsername, isPeerId } from './roomIdentity.js';
import { isHandlingSnapshot, handlingFields, type HandlingCommand, type HandlingStatePacket } from './handlingNetworkTypes.js';
import { MAX_PLAYERS, PLAYER_MAX_HP, MAX_SHOT_PELLET_INDEX } from './config.js';
import { infantryEventFields, infantryStateFields, isInfantryEvent, isInfantrySequence, isInfantryState,
    type InfantryEventPacket, type InfantryState, type InfantryStatePacket } from './infantryNetworkTypes.js';
export type HookState = 'IDLE' | 'FIRING' | 'PULLING';
export type FirearmName = 'PISTOL' | 'SHOTGUN' | 'AR' | 'SNIPER' | 'MINIGUN';
export type WeaponName = FirearmName | 'KATANA';
export type WeaponSwitchPhase = 'IDLE' | 'WITHDRAWING' | 'BRINGING_IN';

export const WEAPON_NAMES: readonly WeaponName[] = ['PISTOL', 'SHOTGUN', 'AR', 'SNIPER', 'MINIGUN', 'KATANA'];

export interface MeleeCommand {
    type: 'melee_command'; action: 'start' | 'release' | 'cancel'; sequence: number; lifeId: number; senderPeerId?: string;
}
export interface MeleeEvent {
    type: 'melee_event'; action: 'start' | 'release' | 'cancel'; sequence: number; lifeId: number;
    senderPeerId: string; charged: boolean; origin: Vec3Packet; yaw: number; pitch: number;
}

export interface MeleeHitEvent {
    type: 'melee_hit'; senderPeerId: string; sequence: number; lifeId: number;
    target: string; contact: Vec3Packet; execution: boolean;
}

export interface Vec3Packet {
    x: number;
    y: number;
    z: number;
}

export interface HoverKeysPacket {
    w: boolean;
    s: boolean;
    a: boolean;
    d: boolean;
}

export interface UpdatePacket {
    type: 'update';
    /** Monotonic per-life sequence number used to discard out-of-order UDP/SCTP updates. */
    seq?: number;
    bodyColor?: number;
    lifeId: number;
    senderPeerId?: string;
    username: string;
    pos: Vec3Packet;
    yaw: number;
    pitch: number;
    activeWeapon: WeaponName;
    switchState: WeaponSwitchPhase;
    nextWeapon: WeaponName | null;
    isMouseDown: boolean;
    isDead: boolean;
    hookState: HookState;
    hookPos: Vec3Packet | null;
    isHovering: boolean;
    hoverKeys: HoverKeysPacket | null;
    grounded?: boolean;
    movingHook?: boolean;
    scoped?: boolean;
    inspectTime?: number;
    switchTime?: number;
    hp: number;
    maxHp: number;
    /** Present only on host-originated updates. */
    dayNightElapsedSeconds?: number;
}

export interface FirePacket {
    type: 'fire';
    lifeId?: number;
    shotId: number;
    senderPeerId?: string;
    weapon: FirearmName;
    barrelPos: Vec3Packet;
    dir: Vec3Packet;
    hitPoint?: Vec3Packet;
    /** Makes multi-pellet visual replication identical on every remote peer. */
    spreadSeed: number;
    pelletCount?: number;
    /** Optional goggles lock captured when a simulated projectile is fired. */
    homingTarget?: HomingTargetPacket;
    /** Shared travel threshold so every peer begins steering at the same point. */
    homingStartDistance?: number;
}

export type HomingTargetPacket =
    | { kind: 'mecha'; targetRevision: number }
    | { kind: 'npc'; targetIndex: number; targetRevision: number }
    | { kind: 'peer'; targetPeerId: string; targetLifeId: number };

export interface HitTargetPacket {
    type: 'hit_target';
    shotId: number;
    pelletIndex: number;
    senderPeerId?: string;
    targetIndex: number;
    targetRevision?: number;
    damage: number;
}

export interface KillTargetPacket {
    type: 'kill_target';
    senderPeerId?: string;
    targetIndex: number;
    score: number;
    newPosition: Vec3Packet;
    scale: number;
    hp: number;
    color: number;
    /** Peer credited by the host; absent on packets from older builds. */
    killerPeerId?: string | null;
}

export interface PlayerHitPacket {
    type: 'player_hit';
    shotId: number;
    pelletIndex: number;
    senderPeerId?: string;
    targetPeerId: string;
    targetLifeId: number;
    damage: number;
    attackerName: string;
}

export interface PlayerDiedPacket {
    type: 'player_died';
    lifeId: number;
    cause: 'player' | 'lava' | 'mecha' | 'infantry';
    killerPeerId: string | null;
    senderPeerId?: string;
    victimName: string;
    killerName: string;
    victimPeerId?: string;
}

export interface PlayerHealthPacket {
    type: 'player_health';
    peerId: string;
    lifeId: number;
    hp: number;
    mechaSequence?: number;
    senderPeerId?: string;
}

export interface RespawnRequestPacket {
    type: 'respawn_request';
    lifeId: number;
    senderPeerId?: string;
}

export interface PlayerRespawnPacket {
    type: 'player_respawn';
    peerId: string;
    lifeId: number;
    pos: Vec3Packet;
    yaw: number;
    weapon: WeaponName;
    cooldownMs: number;
    senderPeerId?: string;
}

export interface JumpPacket {
    type: 'jump';
    lifeId?: number;
    powered?: boolean;
    senderPeerId?: string;
}

export interface TargetState {
    targetIndex: number;
    position: Vec3Packet;
    maxHp: number;
    hp: number;
    scale: number;
    color: number;
}

/** Host-only incremental target replication, including nonlethal damage. */
export interface TargetStatePacket extends TargetState {
    type: 'target_state';
    senderPeerId?: string;
}

/** Sent by the host as soon as a client data channel opens. */
export interface WorldSnapshotPacket {
    type: 'world_snapshot';
    gameStarted: boolean;
    username: string;
    senderPeerId?: string;
    seed: number;
    spawnHouseSlot: number;
    score: number;
    dayNightElapsedSeconds: number;
    targets: TargetState[];
    players?: LobbyPlayer[];
    mecha?: MechaState;
    infantry?: InfantryState;
}

export interface PeerLeftPacket { type: 'peer_left'; peerId: string; senderPeerId?: string; }

export interface LobbyPlayer { peerId: string; username: string; bodyColor: number; }
export interface LobbyRosterPacket { type: 'lobby_roster'; players: LobbyPlayer[]; senderPeerId?: string; }
export interface LobbyColorPacket { type: 'lobby_color'; bodyColor: number; senderPeerId?: string; }

export interface PlayerListEntry extends LobbyPlayer { kills: number; deaths: number; }
/** Host-owned snapshot for the held-Tab list, including late joins. */
export interface PlayerListPacket { type: 'player_list'; players: PlayerListEntry[]; senderPeerId?: string; }

export type NetworkPacket =
    | HandlingCommand | HandlingStatePacket
    | MeleeCommand | MeleeEvent | MeleeHitEvent
    | MechaPacket
    | InfantryStatePacket | InfantryEventPacket
    | { type: 'start_game'; senderPeerId?: string }
    | PeerLeftPacket
    | LobbyRosterPacket
    | LobbyColorPacket
    | PlayerListPacket
    | UpdatePacket
    | FirePacket
    | HitTargetPacket
    | KillTargetPacket
    | PlayerHitPacket
    | PlayerDiedPacket
    | PlayerHealthPacket | RespawnRequestPacket | PlayerRespawnPacket
    | JumpPacket
    | TargetStatePacket
    | WorldSnapshotPacket;

const MAX_PACKET_POSITION = 5000;
const MAX_TARGETS_IN_SNAPSHOT = 512;
const MAX_DAY_NIGHT_ELAPSED_SECONDS = 24 * 60 * 60;

function isFiniteNumber(value: unknown, min = -Infinity, max = Infinity): value is number {
    return typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max;
}

function isInteger(value: unknown, min = -Infinity, max = Infinity): value is number {
    return Number.isInteger(value) && isFiniteNumber(value, min, max);
}

function isWeaponName(value: unknown): value is WeaponName {
    return typeof value === 'string' && (WEAPON_NAMES as readonly string[]).includes(value);
}

function isHookState(value: unknown): value is HookState {
    return value === 'IDLE' || value === 'FIRING' || value === 'PULLING';
}

function isHomingTarget(value: unknown): value is HomingTargetPacket {
    if (!isRecord(value)) return false;
    if (value.kind === 'mecha') return isInteger(value.targetRevision, 0, Number.MAX_SAFE_INTEGER);
    if (value.kind === 'npc') {
        return isInteger(value.targetIndex, 0, MAX_TARGETS_IN_SNAPSHOT - 1) &&
            isInteger(value.targetRevision, 0, Number.MAX_SAFE_INTEGER);
    }
    return value.kind === 'peer' && isPeerId(value.targetPeerId) &&
        isInteger(value.targetLifeId, 0, Number.MAX_SAFE_INTEGER);
}

function isVec3(value: unknown): value is Vec3Packet {
    if (!isRecord(value)) return false;
    return isFiniteNumber(value.x, -MAX_PACKET_POSITION, MAX_PACKET_POSITION) &&
        isFiniteNumber(value.y, -MAX_PACKET_POSITION, MAX_PACKET_POSITION) &&
        isFiniteNumber(value.z, -MAX_PACKET_POSITION, MAX_PACKET_POSITION);
}

function isHoverKeys(value: unknown): value is HoverKeysPacket {
    if (!isRecord(value)) return false;
    return typeof value.w === 'boolean' && typeof value.s === 'boolean' &&
        typeof value.a === 'boolean' && typeof value.d === 'boolean';
}

function isSender(value: unknown): value is string | undefined {
    return value === undefined || isPeerId(value);
}

function isLobbyRoster(value: unknown): value is LobbyPlayer[] {
    return Array.isArray(value) && value.length >= 1 && value.length <= MAX_PLAYERS &&
        value.every(player => isRecord(player) && isPeerId(player.peerId) &&
            isUsername(player.username) && isInteger(player.bodyColor, 0, 0xffffff)) &&
        new Set(value.map(player => player.peerId)).size === value.length;
}

function isTargetState(value: unknown): value is TargetState {
    if (!isRecord(value)) return false;
    return isInteger(value.targetIndex, 0, MAX_TARGETS_IN_SNAPSHOT - 1) &&
        isVec3(value.position) &&
        isFiniteNumber(value.maxHp, 1, 1000) &&
        isFiniteNumber(value.hp, 0, 1000) &&
        isFiniteNumber(value.scale, 0.1, 100) &&
        isInteger(value.color, 0, 0xffffff) &&
        value.hp <= value.maxHp;
}

function isPlayerHealth(value: Record<string, unknown>): boolean {
    if (value.maxHp !== PLAYER_MAX_HP || !isInteger(value.hp, 0, PLAYER_MAX_HP)) return false;
    return value.isDead === true ? value.hp === 0 : value.isDead === false && value.hp > 0;
}

/**
 * PeerJS delivers untrusted `unknown` data. Keep structural validation at this
 * boundary so malformed packets cannot crash the render/update loop.
 */
function validateNetworkPacket(value: unknown): NetworkPacket | null {
    if (!isRecord(value) || !Object.hasOwn(value, 'type') || typeof value.type !== 'string' || !isSender(value.senderPeerId)) return null;

    switch (value.type) {
        case 'handling_command':
            return isInteger(value.lifeId, 0, Number.MAX_SAFE_INTEGER) && isInteger(value.sequence, 1, Number.MAX_SAFE_INTEGER)
                && isWeaponName(value.weapon) && ['reload','grapple','toggleGrapple','release','raise','cancel'].some(action => action === value.action)
                ? value as unknown as HandlingCommand : null;
        case 'handling_state':
            return isPeerId(value.peerId) && isInteger(value.lifeId, 0, Number.MAX_SAFE_INTEGER)
                && isInteger(value.revision, 1, Number.MAX_SAFE_INTEGER) && isInteger(value.commandAck, 0, Number.MAX_SAFE_INTEGER)
                && isInteger(value.shotAck, -1, Number.MAX_SAFE_INTEGER) && typeof value.tetherActive === 'boolean' && isHandlingSnapshot(value.handling)
                && (!value.tetherActive || value.handling.hand === 'drawn' && !value.handling.launchPending)
                && (value.rejected === undefined || typeof value.rejected === 'boolean')
                ? value as unknown as HandlingStatePacket : null;
        case 'melee_hit': {
            if (Object.keys(value).some(key => !['type', 'senderPeerId', 'sequence', 'lifeId', 'target', 'contact', 'execution'].includes(key)) ||
                !isPeerId(value.senderPeerId) || !isInteger(value.sequence, 0, Number.MAX_SAFE_INTEGER) ||
                !isInteger(value.lifeId, 0, Number.MAX_SAFE_INTEGER) || !isVec3(value.contact) || typeof value.execution !== 'boolean' ||
                typeof value.target !== 'string' || value.target.length > 180) return null;
            const parts = value.target.split(':');
            const validId = (part: string | undefined) => part !== undefined && /^(0|[1-9][0-9]*)$/.test(part) && Number.isSafeInteger(Number(part));
            if (!(parts[0] === 'npc' && parts.length === 3 && validId(parts[1]) && Number(parts[1]) < 4096 && validId(parts[2]) ||
                parts[0] === 'peer' && parts.length === 3 && isPeerId(parts[1]) && validId(parts[2]) ||
                parts[0] === 'mecha' && parts.length === 2 && validId(parts[1]))) return null;
            if (value.execution && parts[0] !== 'mecha') return null;
            return value as unknown as MeleeHitEvent;
        }
        case 'melee_command':
        case 'melee_event': {
            if ((value.action !== 'start' && value.action !== 'release' && value.action !== 'cancel') ||
                !isInteger(value.sequence, 0, Number.MAX_SAFE_INTEGER) || !isInteger(value.lifeId, 0, Number.MAX_SAFE_INTEGER)) return null;
            if (value.type === 'melee_event' && (!isPeerId(value.senderPeerId) || typeof value.charged !== 'boolean' || !isVec3(value.origin) || !isFiniteNumber(value.yaw, -Math.PI*4, Math.PI*4) || !isFiniteNumber(value.pitch, -Math.PI/2, Math.PI/2))) return null;
            // Commands contain intent only; never accept claimed power or damage.
            if (value.type === 'melee_command' && Object.keys(value).some(key => !['type','action','sequence','lifeId','senderPeerId'].includes(key))) return null;
            return value as unknown as MeleeCommand | MeleeEvent;
        }
        case 'update':
            if (!(value.seq === undefined || isInteger(value.seq, 0, Number.MAX_SAFE_INTEGER)) ||
                !(value.bodyColor === undefined || isInteger(value.bodyColor, 0, 0xffffff)) || !isInteger(value.lifeId, 0, Number.MAX_SAFE_INTEGER) || !isUsername(value.username) || !isVec3(value.pos) ||
                !isFiniteNumber(value.yaw, -Math.PI * 4, Math.PI * 4) ||
                !isFiniteNumber(value.pitch, -Math.PI, Math.PI) ||
                !isWeaponName(value.activeWeapon) ||
                !(['IDLE', 'WITHDRAWING', 'BRINGING_IN'] as unknown[]).includes(value.switchState) ||
                !(value.nextWeapon === null || isWeaponName(value.nextWeapon)) ||
                (value.switchState === 'IDLE' ? value.nextWeapon !== null : value.nextWeapon === null) ||
                (value.switchState === 'WITHDRAWING' && value.nextWeapon === value.activeWeapon) ||
                (value.switchState === 'BRINGING_IN' && value.nextWeapon !== value.activeWeapon) ||
                typeof value.isMouseDown !== 'boolean' ||
                typeof value.isDead !== 'boolean' || !isHookState(value.hookState) ||
                typeof value.isHovering !== 'boolean' ||
                !(value.grounded === undefined || typeof value.grounded === 'boolean') ||
                !(value.movingHook === undefined || typeof value.movingHook === 'boolean') ||
                !(value.scoped === undefined || typeof value.scoped === 'boolean') ||
                !(value.inspectTime === undefined || isFiniteNumber(value.inspectTime, 0, 3.801)) ||
                !(value.switchTime === undefined || isFiniteNumber(value.switchTime, 0, .151)) ||
                !(value.hookPos === null || isVec3(value.hookPos)) ||
                !(value.hoverKeys === null || isHoverKeys(value.hoverKeys)) ||
                !(value.dayNightElapsedSeconds === undefined || isFiniteNumber(
                    value.dayNightElapsedSeconds,
                    0,
                    MAX_DAY_NIGHT_ELAPSED_SECONDS,
                )) ||
                !isPlayerHealth(value)) return null;
            return value as unknown as UpdatePacket;

        case 'fire': {
            if (value.lifeId !== undefined && !isInteger(value.lifeId, 0, Number.MAX_SAFE_INTEGER)) return null;
            if (!isInteger(value.shotId, 0, Number.MAX_SAFE_INTEGER) || (!isWeaponName(value.weapon) || value.weapon === 'KATANA') || !isVec3(value.barrelPos) || !isVec3(value.dir) ||
                !(value.hitPoint === undefined || isVec3(value.hitPoint)) ||
                !isInteger(value.spreadSeed, 0, 0xffffffff) ||
                !(value.pelletCount === undefined || isInteger(value.pelletCount, 1, 16)) ||
                !(value.homingTarget === undefined || (value.weapon !== 'SNIPER' && isHomingTarget(value.homingTarget))) ||
                !(value.homingTarget === undefined ? value.homingStartDistance === undefined : (
                    value.homingTarget !== undefined && value.weapon !== 'SNIPER' &&
                    isFiniteNumber(value.homingStartDistance, 0, MAX_PACKET_POSITION)
                ))) return null;
            const lengthSq = value.dir.x * value.dir.x + value.dir.y * value.dir.y + value.dir.z * value.dir.z;
            return lengthSq >= 0.25 && lengthSq <= 2.25 ? value as unknown as FirePacket : null;
        }

        case 'hit_target':
            return isInteger(value.shotId, 0, Number.MAX_SAFE_INTEGER) && isInteger(value.pelletIndex, 0, MAX_SHOT_PELLET_INDEX) && isInteger(value.targetIndex, 0, MAX_TARGETS_IN_SNAPSHOT - 1) &&
                (value.targetRevision === undefined || isInteger(value.targetRevision, 1, Number.MAX_SAFE_INTEGER)) &&
                isFiniteNumber(value.damage, 0.01, 100) ? value as unknown as HitTargetPacket : null;

        case 'kill_target':
            return isInteger(value.targetIndex, 0, MAX_TARGETS_IN_SNAPSHOT - 1) &&
                isInteger(value.score, 0, Number.MAX_SAFE_INTEGER) &&
                isVec3(value.newPosition) && isFiniteNumber(value.scale, 0.1, 100) &&
                isFiniteNumber(value.hp, 1, 1000) && isInteger(value.color, 0, 0xffffff) &&
                (value.killerPeerId === undefined || value.killerPeerId === null || isPeerId(value.killerPeerId))
                ? value as unknown as KillTargetPacket : null;

        case 'player_hit':
            return isInteger(value.targetLifeId, 0, Number.MAX_SAFE_INTEGER) && isInteger(value.shotId, 0, Number.MAX_SAFE_INTEGER) && isInteger(value.pelletIndex, 0, MAX_SHOT_PELLET_INDEX) && isPeerId(value.targetPeerId) && isInteger(value.damage, 1, 100) &&
                isUsername(value.attackerName) ? value as unknown as PlayerHitPacket : null;

        case 'player_died':
            return isInteger(value.lifeId, 0, Number.MAX_SAFE_INTEGER) &&
                (((value.cause === 'lava' || value.cause === 'mecha' || value.cause === 'infantry') && value.killerPeerId === null) || (value.cause === 'player' && isPeerId(value.killerPeerId))) && isUsername(value.victimName) &&
                (value.killerName === 'Lava' || value.killerName === 'Forgotten Mecha' || isUsername(value.killerName)) &&
                (value.victimPeerId === undefined || isPeerId(value.victimPeerId))
                ? value as unknown as PlayerDiedPacket : null;

        case 'player_health':
            return isPeerId(value.peerId) && isInteger(value.lifeId, 0, Number.MAX_SAFE_INTEGER) &&
                isInteger(value.hp, 0, PLAYER_MAX_HP) &&
                (value.mechaSequence === undefined || isInteger(value.mechaSequence, 0, Number.MAX_SAFE_INTEGER))
                ? value as unknown as PlayerHealthPacket : null;

        case 'respawn_request':
            return isInteger(value.lifeId, 0, Number.MAX_SAFE_INTEGER) ? value as unknown as RespawnRequestPacket : null;

        case 'player_respawn':
            return isPeerId(value.peerId) && isInteger(value.lifeId, 1, Number.MAX_SAFE_INTEGER) &&
                isVec3(value.pos) && isFiniteNumber(value.yaw, -Math.PI * 4, Math.PI * 4) && isWeaponName(value.weapon) &&
                isFiniteNumber(value.cooldownMs, 0, 5000) ? value as unknown as PlayerRespawnPacket : null;

        case 'start_game':
            return value as unknown as NetworkPacket;

        case 'peer_left':
            return isPeerId(value.peerId) ? value as unknown as PeerLeftPacket : null;

        case 'lobby_color':
            return isInteger(value.bodyColor, 0, 0xffffff) ? value as unknown as LobbyColorPacket : null;

        case 'lobby_roster':
            return isLobbyRoster(value.players) ? value as unknown as LobbyRosterPacket : null;

        case 'player_list':
            if (!Array.isArray(value.players) || value.players.length < 1 || value.players.length > MAX_PLAYERS ||
                !value.players.every((player: unknown) => isRecord(player) && isPeerId(player.peerId) &&
                    isUsername(player.username) && isInteger(player.bodyColor, 0, 0xffffff) &&
                    isInteger(player.kills, 0, 1_000_000) && isInteger(player.deaths, 0, 1_000_000)) ||
                new Set(value.players.map((player: PlayerListEntry) => player.peerId)).size !== value.players.length) return null;
            return value as unknown as PlayerListPacket;

        case 'jump':
            return (value.powered === undefined || typeof value.powered === 'boolean') &&
                (value.lifeId === undefined || isInteger(value.lifeId, 0, Number.MAX_SAFE_INTEGER))
                ? value as unknown as JumpPacket : null;

        case 'target_state':
            return isTargetState(value) ? value as unknown as TargetStatePacket : null;

        case 'infantry_state':
            return isInfantryState(value.state) ? value as unknown as InfantryStatePacket : null;

        case 'infantry_event':
            return isInfantrySequence(value.sequence, 1) && isInfantryEvent(value.event) ? value as unknown as InfantryEventPacket : null;

        case 'world_snapshot':
            if (typeof value.gameStarted !== 'boolean' || !isUsername(value.username) || !isInteger(value.seed, 0, 0xffffffff) || !isInteger(value.score, 0, Number.MAX_SAFE_INTEGER) ||
                !isInteger(value.spawnHouseSlot, 1, MAX_PLAYERS - 1) ||
                !isFiniteNumber(value.dayNightElapsedSeconds, 0, MAX_DAY_NIGHT_ELAPSED_SECONDS) ||
                !Array.isArray(value.targets) || value.targets.length > MAX_TARGETS_IN_SNAPSHOT ||
                !value.targets.every(isTargetState) || !(value.mecha === undefined || isMechaState(value.mecha)) ||
                !(value.infantry === undefined || isInfantryState(value.infantry)) ||
                !(value.players === undefined || isLobbyRoster(value.players))) return null;
            return value as unknown as WorldSnapshotPacket;

        default:
            return parseMechaPacket(value);
    }
}

const targetFields = { ...fields('targetIndex', 'maxHp', 'hp', 'scale', 'color'), position: vec };
const playerFields = fields('peerId', 'username', 'bodyColor');
const packetFields = {
    handling_command: fields('action','weapon','sequence','lifeId'),
    handling_state: { ...fields('peerId','lifeId','revision','commandAck','shotAck','rejected','tetherActive'), handling: handlingFields },
    melee_command: fields('action', 'sequence', 'lifeId'),
    melee_event: { ...fields('action', 'sequence', 'lifeId', 'charged', 'yaw', 'pitch'), origin: vec },
    melee_hit: { ...fields('sequence', 'lifeId', 'target', 'execution'), contact: vec },
    update: { ...fields('seq', 'bodyColor', 'lifeId', 'username', 'yaw', 'pitch', 'activeWeapon', 'switchState', 'nextWeapon',
        'isMouseDown', 'isDead', 'hookState', 'isHovering', 'hp', 'maxHp', 'dayNightElapsedSeconds',
        'grounded','movingHook','scoped','inspectTime','switchTime'),
        pos: vec, hookPos: vec, hoverKeys: fields('w', 's', 'a', 'd') },
    fire: { ...fields('shotId', 'lifeId', 'weapon', 'spreadSeed', 'pelletCount', 'homingStartDistance'), barrelPos: vec, dir: vec, hitPoint: vec,
        homingTarget: variant('kind', {
            mecha: fields('kind', 'targetRevision'), npc: fields('kind', 'targetIndex', 'targetRevision'),
            peer: fields('kind', 'targetPeerId', 'targetLifeId'),
        }) },
    hit_target: fields('shotId', 'pelletIndex', 'targetIndex', 'targetRevision', 'damage'),
    kill_target: { ...fields('targetIndex', 'score', 'scale', 'hp', 'color', 'killerPeerId'), newPosition: vec },
    player_hit: fields('shotId', 'pelletIndex', 'targetPeerId', 'targetLifeId', 'damage', 'attackerName'),
    player_died: fields('lifeId', 'cause', 'killerPeerId', 'victimName', 'killerName', 'victimPeerId'),
    player_health: fields('peerId', 'lifeId', 'hp', 'mechaSequence'),
    respawn_request: fields('lifeId'),
    player_respawn: { ...fields('peerId', 'lifeId', 'yaw', 'weapon', 'cooldownMs'), pos: vec },
    start_game: {}, jump: fields('lifeId', 'powered'), peer_left: fields('peerId'), lobby_color: fields('bodyColor'),
    lobby_roster: { players: [playerFields] }, player_list: { players: [{ ...playerFields, ...fields('kills', 'deaths') }] },
    target_state: targetFields,
    infantry_state: { state: infantryStateFields },
    infantry_event: { ...fields('sequence'), event: infantryEventFields },
    world_snapshot: { ...fields('gameStarted', 'username', 'seed', 'spawnHouseSlot', 'score', 'dayNightElapsedSeconds'),
        targets: [targetFields], players: [playerFields], mecha: mechaStateFields, infantry: infantryStateFields },
} satisfies Record<Exclude<NetworkPacket['type'], MechaPacket['type']>, Projection>;
const projectedPacketFields = Object.fromEntries(Object.entries(packetFields)
    .map(([type, schema]) => [type, { ...fields('type', 'senderPeerId'), ...schema }])) as Record<string, Projection>;

export function parseNetworkPacket(value: unknown): NetworkPacket | null {
    const packet = validateNetworkPacket(value);
    if (!packet) return null;
    // Mecha's parser already projects its own complete nested state/event shapes.
    if (!Object.hasOwn(projectedPacketFields, packet.type)) return packet;
    return projectKnown(packet, projectedPacketFields[packet.type]);
}
