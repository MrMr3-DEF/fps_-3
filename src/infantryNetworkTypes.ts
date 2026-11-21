import { INFANTRY, INFANTRY_DEBRIS_TIME, INFANTRY_LIMIT, INFANTRY_TURN_ANGLE, MAP_HALF_SIZE, TOWN_WALL_HP, type InfantryKind } from './config.js';
import { fields, isPacketRecord as isRecord, variant, vectorFields, type Projection } from './networkProjection.js';
import { isPeerId } from './roomIdentity.js';
import type { Vec3Packet } from './networkTypes.js';

export type InfantryPhase = 'idle' | 'moving' | 'turn' | 'attack' | 'death';
export interface InfantryPose {
    slot: number;
    revision: number;
    kind: InfantryKind;
    hp: number;
    position: Vec3Packet;
    yaw: number;
    /** During a step, yaw is the landing heading and turnAngle is the signed sweep. */
    turnAngle?: number;
    pitch: number;
    phase: InfantryPhase;
    time: number;
}

export interface InfantryState {
    sequence: number;
    day: number;
    wallHp: number;
    bots: InfantryPose[];
}

export type InfantryEvent =
    | { kind: 'attack'; robot: InfantryKind; start: Vec3Packet; end: Vec3Packet; victim?: { peerId: string; lifeId: number } }
    | { kind: 'kill'; slot: number; revision: number; score: number; killer: string | null };

export interface InfantryStatePacket { type: 'infantry_state'; state: InfantryState; senderPeerId?: string }
export interface InfantryEventPacket { type: 'infantry_event'; sequence: number; event: InfantryEvent; senderPeerId?: string }

const number = (value: unknown, min: number, max: number): value is number =>
    typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max;
const integer = (value: unknown, min = 0, max = Number.MAX_SAFE_INTEGER): value is number =>
    number(value, min, max) && Number.isSafeInteger(value);
const isKind = (value: unknown): value is InfantryKind => value === 'base' || value === 'fast' || value === 'big';
const isSlot = (value: unknown): boolean => integer(value, 0, INFANTRY_LIMIT - 1);
const isPosition = (value: unknown): value is Vec3Packet => isRecord(value) &&
    number(value.x, -MAP_HALF_SIZE - 50, MAP_HALF_SIZE + 50) && number(value.z, -MAP_HALF_SIZE - 50, MAP_HALF_SIZE + 50) && number(value.y, -20, 1000);

function isPose(value: unknown): value is InfantryPose {
    if (!isRecord(value) || !isKind(value.kind) || !isSlot(value.slot) || !integer(value.revision, 1) ||
        !isPosition(value.position) || value.position.y !== 0 || Math.max(Math.abs(value.position.x), Math.abs(value.position.z)) > MAP_HALF_SIZE || !number(value.yaw, -Math.PI, Math.PI) ||
        !number(value.pitch, -Math.PI / 2, Math.PI / 2) || !number(value.time, 0, INFANTRY_DEBRIS_TIME)) return false;
    if (value.phase === 'turn') return number(value.turnAngle, -INFANTRY_TURN_ANGLE, INFANTRY_TURN_ANGLE) &&
        value.turnAngle !== 0 && number(value.hp, Number.EPSILON, INFANTRY[value.kind].hp);
    if (value.turnAngle !== undefined) return false;
    if (value.phase === 'death') return value.hp === 0;
    return (value.phase === 'idle' || value.phase === 'moving' || value.phase === 'attack') &&
        number(value.hp, Number.EPSILON, INFANTRY[value.kind].hp);
}

export function isInfantryState(value: unknown): value is InfantryState {
    if (!isRecord(value) || !integer(value.sequence) || !integer(value.day) || !integer(value.wallHp, 0, TOWN_WALL_HP) ||
        !Array.isArray(value.bots) || value.bots.length > INFANTRY_LIMIT || !value.bots.every(isPose)) return false;
    if (value.day === 0 && (value.bots.length || value.wallHp !== TOWN_WALL_HP)) return false;
    return new Set(value.bots.map(bot => bot.slot)).size === value.bots.length;
}

export function isInfantryEvent(value: unknown): value is InfantryEvent {
    if (!isRecord(value)) return false;
    if (value.kind === 'kill') return isSlot(value.slot) && integer(value.revision, 1) && integer(value.score) &&
        (value.killer === null || isPeerId(value.killer));
    return value.kind === 'attack' && isKind(value.robot) && isPosition(value.start) && isPosition(value.end) &&
        (value.victim === undefined || (isRecord(value.victim) && isPeerId(value.victim.peerId) && integer(value.victim.lifeId)));
}

export const infantryStateFields: Projection = {
    ...fields('sequence', 'day', 'wallHp'),
    bots: [{ ...fields('slot', 'revision', 'kind', 'hp', 'yaw', 'turnAngle', 'pitch', 'phase', 'time'), position: vectorFields }],
};
export const infantryEventFields = variant('kind', {
    attack: { ...fields('kind', 'robot'), start: vectorFields, end: vectorFields, victim: fields('peerId', 'lifeId') },
    kill: fields('kind', 'slot', 'revision', 'score', 'killer'),
});
export const isInfantrySequence = integer;
