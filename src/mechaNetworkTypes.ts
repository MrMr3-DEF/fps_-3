import { MECHA_ENDING_DURATION, MECHA_ENDING_TIMING, type MechaEndingState } from './mechaEndingTimeline.js';
import { isPeerId } from './roomIdentity.js';
import { MECHA_HP, MECHA_ROCKET_POOL_SIZE, MECHA_NETWORK_MAX_BONES, MECHA_STOMP_COOLDOWN, MECHA_ROCKET_FIRE_TIME } from './config.js';
import type { Vec3Packet } from './networkTypes.js';
import type { MechaMode, MechaImpact } from './forgottenMecha.js';
import type { MechaHeadPhase } from './mechaHeadView.js';
import type { LaserPhase, ShieldPhase } from './mechaCombat.js';
import { isPilotWeapon, type PilotWeapon } from './mechaStomp.js';

export interface MechaPose { position: Vec3Packet; quaternion: number[]; viewPosition: Vec3Packet }
export interface MechaRocketState { slot: number; position: Vec3Packet; direction: Vec3Packet }
export interface MechaState {
    sequence: number; revision: number; mode: MechaMode; elapsed: number;
    position: Vec3Packet; heading: number; hp: number; recoveringExit: boolean;
    pilotPeerId: string | null; pilotLifeId: number; pilotYaw: number; pilotPitch: number; cooldown: number;
    pilotWeapon: PilotWeapon; stompActive: boolean; stompElapsed: number; stompCooldown: number; rocketTime: number;
    /** Asset-order bone transforms include planted feet and the corrected launcher. */
    boneCount: number; bones: number[][]; eye: number[];
    head: { phase: MechaHeadPhase; fold: number; wantedOpen: boolean; eyeBlend: number; blackout: number;
        loadingProgress: number; hudOpacity: number; revealProgress: number };
    combat: { clock: number; laserPhase: LaserPhase; shieldPhase: ShieldPhase; manual: boolean; energy: number;
        manualBuild: number; collapse: number; build: number; eyePower: number; orbRadius: number; beamRadius: number;
        beamLength: number; beamOrigin: Vec3Packet; beamDirection: Vec3Packet; orbPosition: Vec3Packet; shieldCenter: Vec3Packet };
    rockets: MechaRocketState[]; matchEnded: boolean; ending?: MechaEndingState;
}
interface MechaSender { senderPeerId?: string }
export interface MechaInputPacket extends MechaSender {
    type: 'mecha_input'; sequence: number; revision: number; lifeId: number;
    direction: number; yaw: number; pitch: number; shield: boolean; fire: boolean;
    weapon: PilotWeapon;
    helmet: boolean; exit: boolean; thirdPerson: boolean; secondaryHeld: boolean; viewThirdPerson: boolean; fov: number; aspect: number;
}
export interface MechaBoardPacket extends MechaSender { type: 'mecha_board'; sequence: number; revision: number; lifeId: number; thirdPerson: boolean; secondaryHeld: boolean }
export interface MechaHitPacket extends MechaSender { type: 'hit_mecha'; revision: number; shotId: number; pelletIndex: number; damage: number }
export type MechaEvent =
    | { kind: 'damage'; peerId: string; lifeId: number; damage: number; attack: 'laser' | 'stomp' | 'rocket'; attackerPeerId: string | null }
    | { kind: 'release'; peerId: string; lifeId: number; pose: MechaPose }
    | { kind: 'impact'; impact: MechaImpact; position: Vec3Packet }
    | { kind: 'shield'; position: Vec3Packet }
    | { kind: 'blast'; position: Vec3Packet }
    | { kind: 'blocked'; peerId: string }
    | { kind: 'board_denied'; peerId: string; lifeId: number }
    | { kind: 'hit'; peerId: string; killed: boolean; score: number; position: Vec3Packet; direction: Vec3Packet }
    | { kind: 'end' };
export interface MechaEventPacket extends MechaSender { type: 'mecha_event'; sequence: number; state: MechaState; event: MechaEvent }
export interface MechaStatePacket extends MechaSender { type: 'mecha_state'; state: MechaState }
export interface MechaEndingReadyPacket extends MechaSender { type: 'mecha_ending_ready'; id: number; revision: number }
export type MechaPacket = MechaEndingReadyPacket | MechaInputPacket | MechaBoardPacket | MechaHitPacket | MechaEventPacket | MechaStatePacket;

const record = (x: unknown): x is Record<string, unknown> => !!x && typeof x === 'object' && !Array.isArray(x);
const number = (x: unknown, min: number, max: number): x is number => typeof x === 'number' && Number.isFinite(x) && x >= min && x <= max;
const integer = (x: unknown, max = Number.MAX_SAFE_INTEGER): x is number => number(x, 0, max) && Number.isSafeInteger(x);
const bool = (x: unknown): x is boolean => typeof x === 'boolean';
export const isMechaVector = (x: unknown): x is Vec3Packet => record(x) && ['x', 'y', 'z'].every(k => number(x[k], -5000, 5000));
const direction = (x: unknown) => isMechaVector(x) && number(x.x ** 2 + x.y ** 2 + x.z ** 2, 0.99, 1.01);
const quaternion = (x: unknown) => Array.isArray(x) && x.length === 4 && x.every(v => number(v, -1.000001, 1.000001)) && number(x.reduce((s, v) => s + v * v, 0), 0.99, 1.01);
const modes = ['walking', 'tracking', 'rocketing', 'stomping', 'punching', 'aligning', 'dying', 'dead', 'game-over', 'boarding', 'startup', 'piloted', 'shutting-down', 'destroying', 'destroyed'];
const phases = ['inactive', 'mount', 'loading', 'hud', 'reveal', 'ready', 'opening-black', 'opening-move', 'opening', 'open', 'closing', 'closing-black', 'closing-move', 'closing-reveal', 'shutdown-reveal', 'shutdown-hud', 'shutdown', 'shutdown-opening'];
export function isMechaEnding(x: unknown): x is MechaEndingState {
    return record(x) && integer(x.id) && x.id > 0 && integer(x.seed, 0xffffffff) && integer(x.effectsSeed, 0xffffffff) &&
        isMechaVector(x.position) && number(x.heading, -Math.PI * 4, Math.PI * 4) &&
        Math.abs(x.heading / (Math.PI / 2) - Math.round(x.heading / (Math.PI / 2))) < 1e-8 &&
        number(x.lightingElapsed, 0, 480) && number(x.elapsed, 0, MECHA_ENDING_DURATION) &&
        (x.phase === 'preparing' ? x.elapsed <= MECHA_ENDING_TIMING.fadeOut :
            x.phase === 'playing' ? x.elapsed >= MECHA_ENDING_TIMING.fadeOut : x.phase === 'complete' && x.elapsed === MECHA_ENDING_DURATION);
}
export function isMechaState(x: unknown): x is MechaState {
    if (!record(x) || !integer(x.sequence) || !integer(x.revision) || !modes.includes(x.mode as string) || !number(x.elapsed, 0, 86400) ||
        !isMechaVector(x.position) || !number(x.heading, -Math.PI * 4, Math.PI * 4) || !number(x.hp, 0, MECHA_HP) ||
        !(x.pilotPeerId === null || isPeerId(x.pilotPeerId)) || !integer(x.pilotLifeId) || !number(x.pilotYaw, -Math.PI * 4, Math.PI * 4) ||
        !number(x.pilotPitch, -Math.PI, Math.PI) || !number(x.cooldown, 0, 60) || !isPilotWeapon(x.pilotWeapon) ||
        !bool(x.stompActive) || !number(x.stompElapsed, 0, 4) || !number(x.stompCooldown, 0, MECHA_STOMP_COOLDOWN) || !number(x.rocketTime, 0, MECHA_ROCKET_FIRE_TIME) ||
        x.stompActive && (x.mode !== 'piloted' && x.mode !== 'stomping' || x.stompCooldown !== 0 || x.rocketTime < MECHA_ROCKET_FIRE_TIME) ||
        !bool(x.matchEnded) || !bool(x.recoveringExit) ||
        !integer(x.boneCount, MECHA_NETWORK_MAX_BONES) || x.boneCount === 0 || !Array.isArray(x.bones) || x.bones.length > x.boneCount ||
        !x.bones.every(b => Array.isArray(b) && b.length === 11 && integer(b[0], (x.boneCount as number) - 1) &&
            b.slice(1, 4).every(v => number(v, -5000, 5000)) && quaternion(b.slice(4, 8)) && b.slice(8).every(v => number(v, 0, 100))) ||
        new Set(x.bones.map(b => b[0])).size !== x.bones.length || !Array.isArray(x.eye) || x.eye.length !== 7 || !x.eye.every(v => number(v, 0, 20))) return false;
    const ending = x.ending;
    if (ending !== undefined && (!isMechaEnding(ending) || !x.matchEnded || !['punching', 'game-over'].includes(x.mode as string) ||
        ending.heading !== x.heading || ['x', 'y', 'z'].some(k => ending.position[k as keyof Vec3Packet] !== (x.position as Vec3Packet)[k as keyof Vec3Packet]))) return false;
    const h = x.head, c = x.combat;
    if (!record(h) || !phases.includes(h.phase as string) || !bool(h.wantedOpen) ||
        !['fold', 'eyeBlend', 'blackout', 'loadingProgress', 'hudOpacity', 'revealProgress'].every(k => number(h[k], 0, 1))) return false;
    if (!record(c) || !['idle', 'charging', 'firing', 'fading', 'cancelling'].includes(c.laserPhase as string) ||
        !['powered', 'warning', 'down', 'rebuilding', 'disabled'].includes(c.shieldPhase as string) || !bool(c.manual) ||
        !number(c.clock, 0, 86400) || !['energy', 'manualBuild', 'collapse', 'build', 'eyePower'].every(k => number(c[k], 0, 1)) ||
        !number(c.orbRadius, 0, 20) || !number(c.beamRadius, 0, 20) || !number(c.beamLength, 0, 700) ||
        !['beamOrigin', 'orbPosition', 'shieldCenter'].every(k => isMechaVector(c[k])) || !direction(c.beamDirection)) return false;
    const occupied = ['boarding', 'startup', 'piloted', 'shutting-down'].includes(x.mode as string);
    return occupied === (x.pilotPeerId !== null) && Array.isArray(x.rockets) && x.rockets.length <= MECHA_ROCKET_POOL_SIZE &&
        x.rockets.every(r => record(r) && integer(r.slot, MECHA_ROCKET_POOL_SIZE - 1) && isMechaVector(r.position) && direction(r.direction)) &&
        new Set(x.rockets.map(r => r.slot)).size === x.rockets.length;
}
function isEvent(e: unknown): e is MechaEvent {
    if (!record(e)) return false;
    if (e.kind === 'end') return true;
    if (e.kind === 'impact') return ['step', 'stomp', 'knees', 'fists', 'punch'].includes(e.impact as string) && isMechaVector(e.position);
    if (e.kind === 'blast' || e.kind === 'shield') return isMechaVector(e.position);
    if (!isPeerId(e.peerId)) return false;
    if (e.kind === 'blocked') return true;
    if (e.kind === 'board_denied') return integer(e.lifeId);
    if (e.kind === 'hit') return bool(e.killed) && integer(e.score) && isMechaVector(e.position) && direction(e.direction);
    if (!integer(e.lifeId)) return false;
    if (e.kind === 'damage') return number(e.damage, 0.01, 100) && ['laser', 'stomp', 'rocket'].includes(e.attack as string) && (e.attackerPeerId === null || isPeerId(e.attackerPeerId));
    return e.kind === 'release' && record(e.pose) && isMechaVector(e.pose.position) && isMechaVector(e.pose.viewPosition) && quaternion(e.pose.quaternion);
}
export function parseMechaPacket(x: Record<string, unknown>): MechaPacket | null {
    if (x.type === 'mecha_ending_ready') return integer(x.id) && x.id > 0 && integer(x.revision) ? x as unknown as MechaEndingReadyPacket : null;
    if (x.type === 'mecha_state') return isMechaState(x.state) ? x as unknown as MechaStatePacket : null;
    if (x.type === 'mecha_event') return integer(x.sequence) && isMechaState(x.state) && isEvent(x.event) ? x as unknown as MechaEventPacket : null;
    if (x.type === 'hit_mecha') return integer(x.revision) && integer(x.shotId) && integer(x.pelletIndex, 4) && number(x.damage, 0.01, 100) ? x as unknown as MechaHitPacket : null;
    if (!integer(x.sequence) || !integer(x.revision) || !integer(x.lifeId) || !bool(x.thirdPerson) || !bool(x.secondaryHeld)) return null;
    if (x.type === 'mecha_board') return x as unknown as MechaBoardPacket;
    return x.type === 'mecha_input' && isPilotWeapon(x.weapon) && number(x.direction, -1, 1) && number(x.yaw, -10, 10) && number(x.pitch, -Math.PI, Math.PI) &&
        ['shield', 'fire', 'helmet', 'exit', 'viewThirdPerson'].every(k => bool(x[k])) && number(x.fov, 10, 150) && number(x.aspect, 0.1, 10) ? x as unknown as MechaInputPacket : null;
}
