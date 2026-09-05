import { isUsername, isPeerId } from './roomIdentity.js';
export type HookState = 'IDLE' | 'FIRING' | 'PULLING';
export type WeaponName = 'PISTOL' | 'SHOTGUN' | 'AR' | 'SNIPER' | 'MINIGUN';

export const WEAPON_NAMES: readonly WeaponName[] = ['PISTOL', 'SHOTGUN', 'AR', 'SNIPER', 'MINIGUN'];

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
    lifeId: number;
    senderPeerId?: string;
    username: string;
    pos: Vec3Packet;
    yaw: number;
    pitch: number;
    activeWeapon: WeaponName;
    isMouseDown: boolean;
    isDead: boolean;
    hookState: HookState;
    hookPos: Vec3Packet | null;
    isHovering: boolean;
    hoverKeys: HoverKeysPacket | null;
}

export interface FirePacket {
    type: 'fire';
    shotId: number;
    senderPeerId?: string;
    weapon: WeaponName;
    barrelPos: Vec3Packet;
    dir: Vec3Packet;
    hitPoint?: Vec3Packet;
    /** Makes multi-pellet visual replication identical on every remote peer. */
    spreadSeed: number;
    pelletCount?: number;
}

export interface HitTargetPacket {
    type: 'hit_target';
    shotId: number;
    pelletIndex: number;
    senderPeerId?: string;
    targetIndex: number;
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
}

export interface PlayerHitPacket {
    type: 'player_hit';
    shotId: number;
    pelletIndex: number;
    senderPeerId?: string;
    targetPeerId: string;
    damage: number;
    attackerName: string;
}

export interface PlayerDiedPacket {
    type: 'player_died';
    lifeId: number;
    cause: 'player' | 'lava';
    killerPeerId: string | null;
    senderPeerId?: string;
    victimName: string;
    killerName: string;
    victimPeerId?: string;
}

export interface JumpPacket {
    type: 'jump';
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
    senderPeerId?: string;
    seed: number;
    score: number;
    targets: TargetState[];
}

export interface PeerLeftPacket { type: 'peer_left'; peerId: string; senderPeerId?: string; }

export type NetworkPacket =
    | PeerLeftPacket
    | UpdatePacket
    | FirePacket
    | HitTargetPacket
    | KillTargetPacket
    | PlayerHitPacket
    | PlayerDiedPacket
    | JumpPacket
    | TargetStatePacket
    | WorldSnapshotPacket;

const MAX_PACKET_POSITION = 5000;
const MAX_TARGETS_IN_SNAPSHOT = 512;

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null;
}

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

/**
 * PeerJS delivers untrusted `unknown` data. Keep structural validation at this
 * boundary so malformed packets cannot crash the render/update loop.
 */
export function parseNetworkPacket(value: unknown): NetworkPacket | null {
    if (!isRecord(value) || typeof value.type !== 'string' || !isSender(value.senderPeerId)) return null;

    switch (value.type) {
        case 'update':
            if (!isInteger(value.lifeId, 0, Number.MAX_SAFE_INTEGER) || !isUsername(value.username) || !isVec3(value.pos) ||
                !isFiniteNumber(value.yaw, -Math.PI * 4, Math.PI * 4) ||
                !isFiniteNumber(value.pitch, -Math.PI, Math.PI) ||
                !isWeaponName(value.activeWeapon) || typeof value.isMouseDown !== 'boolean' ||
                typeof value.isDead !== 'boolean' || !isHookState(value.hookState) ||
                typeof value.isHovering !== 'boolean' ||
                !(value.hookPos === null || isVec3(value.hookPos)) ||
                !(value.hoverKeys === null || isHoverKeys(value.hoverKeys))) return null;
            return value as unknown as UpdatePacket;

        case 'fire': {
            if (!isInteger(value.shotId, 0, Number.MAX_SAFE_INTEGER) || !isWeaponName(value.weapon) || !isVec3(value.barrelPos) || !isVec3(value.dir) ||
                !(value.hitPoint === undefined || isVec3(value.hitPoint)) ||
                !isInteger(value.spreadSeed, 0, 0xffffffff) ||
                !(value.pelletCount === undefined || isInteger(value.pelletCount, 1, 16))) return null;
            const lengthSq = value.dir.x * value.dir.x + value.dir.y * value.dir.y + value.dir.z * value.dir.z;
            return lengthSq >= 0.25 && lengthSq <= 2.25 ? value as unknown as FirePacket : null;
        }

        case 'hit_target':
            return isInteger(value.shotId, 0, Number.MAX_SAFE_INTEGER) && isInteger(value.pelletIndex, 0, 4) && isInteger(value.targetIndex, 0, MAX_TARGETS_IN_SNAPSHOT - 1) &&
                isFiniteNumber(value.damage, 0.01, 100) ? value as unknown as HitTargetPacket : null;

        case 'kill_target':
            return isInteger(value.targetIndex, 0, MAX_TARGETS_IN_SNAPSHOT - 1) &&
                isInteger(value.score, 0, Number.MAX_SAFE_INTEGER) &&
                isVec3(value.newPosition) && isFiniteNumber(value.scale, 0.1, 100) &&
                isFiniteNumber(value.hp, 1, 1000) && isInteger(value.color, 0, 0xffffff)
                ? value as unknown as KillTargetPacket : null;

        case 'player_hit':
            return isInteger(value.shotId, 0, Number.MAX_SAFE_INTEGER) && isInteger(value.pelletIndex, 0, 4) && isPeerId(value.targetPeerId) && isFiniteNumber(value.damage, 0.01, 100) &&
                isUsername(value.attackerName) ? value as unknown as PlayerHitPacket : null;

        case 'player_died':
            return isInteger(value.lifeId, 0, Number.MAX_SAFE_INTEGER) &&
                ((value.cause === 'lava' && value.killerPeerId === null) || (value.cause === 'player' && isPeerId(value.killerPeerId))) && isUsername(value.victimName) &&
                (value.killerName === 'Lava' || isUsername(value.killerName)) &&
                (value.victimPeerId === undefined || isPeerId(value.victimPeerId))
                ? value as unknown as PlayerDiedPacket : null;

        case 'peer_left':
            return isPeerId(value.peerId) ? value as unknown as PeerLeftPacket : null;

        case 'jump':
            return value as unknown as JumpPacket;

        case 'target_state':
            return isTargetState(value) ? value as unknown as TargetStatePacket : null;

        case 'world_snapshot':
            if (!isInteger(value.seed, 0, 0xffffffff) || !isInteger(value.score, 0, Number.MAX_SAFE_INTEGER) ||
                !Array.isArray(value.targets) || value.targets.length > MAX_TARGETS_IN_SNAPSHOT ||
                !value.targets.every(isTargetState)) return null;
            return value as unknown as WorldSnapshotPacket;

        default:
            return null;
    }
}
