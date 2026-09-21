import * as THREE from 'three';
import type { HomingTargetPacket } from './networkTypes.js';
import { targetData } from './userDataTypes.js';
import { classifyOutOfRange, distanceToOrientedBox } from './smartGogglesMath.js';
import { distanceToVisiblePeerMeshes } from './smartGogglesPeerMath.js';

/** Strong enough to correct a near miss, but finite so fast/close targets can escape. */
export const PROJECTILE_HOMING_RESPONSE = 48;
/** Prevent a large frame or close target from producing a visible direction snap. */
export const PROJECTILE_HOMING_MAX_TURN_RATE = THREE.MathUtils.degToRad(720);
/** Begin guidance early enough for the turn to read before a 900 m/s bullet arrives. */
export const PROJECTILE_HOMING_START_FRACTION = 1 / 3;
/** Small authority allowance for the six-pixel padding around the visual scan box. */
export const HOMING_AIM_PADDING_RADIANS = THREE.MathUtils.degToRad(1.25);

export type ProjectileHomingTarget =
    | {
        kind: 'npc';
        object: THREE.Group;
        targetIndex: number;
        targetRevision: number;
    }
    | {
        kind: 'peer';
        object: THREE.Group;
        targetPeerId: string;
        targetLifeId: number;
    };

let aimedTarget: ProjectileHomingTarget | null = null;

export function setProjectileHomingTarget(target: ProjectileHomingTarget | null): void {
    aimedTarget = target;
}

export function getProjectileHomingTarget(): ProjectileHomingTarget | null {
    return aimedTarget;
}

/** Match the goggles' reachability check, including targets straddling the range boundary. */
export function isHomingTargetInRange(
    target: ProjectileHomingTarget,
    origin: THREE.Vector3,
    maximumRange: number,
): boolean {
    let distance: number;
    if (target.kind === 'peer') {
        distance = distanceToVisiblePeerMeshes(origin, target.object);
    } else {
        const body = targetData(target.object).bodyMesh;
        if (body) {
            body.updateWorldMatrix(true, false);
            if (!body.geometry.boundingBox) body.geometry.computeBoundingBox();
            distance = body.geometry.boundingBox
                ? distanceToOrientedBox(origin, body.geometry.boundingBox, body.matrixWorld)
                : Infinity;
        } else {
            distance = origin.distanceTo(target.object.position);
        }
    }
    return !classifyOutOfRange(distance, maximumRange);
}

export function resolveProjectileHomingTarget(
    target: ProjectileHomingTarget,
    npcTargets: readonly THREE.Group[],
    peers: Readonly<Record<string, { mesh: THREE.Group; hp: number; lifeId?: number }>>,
    out: THREE.Vector3,
): THREE.Vector3 | null {
    if (target.kind === 'npc') {
        if (npcTargets[target.targetIndex] !== target.object) return null;
        const data = targetData(target.object);
        if (data.hp <= 0 || (data.eliminationRevision ?? 0) !== target.targetRevision) return null;
        return out.copy(target.object.position);
    }
    const peer = peers[target.targetPeerId];
    if (!peer || peer.mesh !== target.object || peer.hp <= 0 ||
        (peer.lifeId ?? 0) !== target.targetLifeId || !peer.mesh.visible) return null;
    return out.copy(peer.mesh.position);
}

export function toHomingTargetPacket(target: ProjectileHomingTarget | null): HomingTargetPacket | undefined {
    if (!target) return undefined;
    return target.kind === 'npc'
        ? { kind: 'npc', targetIndex: target.targetIndex, targetRevision: target.targetRevision }
        : { kind: 'peer', targetPeerId: target.targetPeerId, targetLifeId: target.targetLifeId };
}

export function fromHomingTargetPacket(
    packet: HomingTargetPacket | undefined,
    npcTargets: readonly THREE.Group[],
    peers: Readonly<Record<string, { mesh: THREE.Group; hp: number; lifeId?: number }>>,
): ProjectileHomingTarget | null {
    if (!packet) return null;
    if (packet.kind === 'npc') {
        const object = npcTargets[packet.targetIndex];
        if (!object || targetData(object).hp <= 0 ||
            (targetData(object).eliminationRevision ?? 0) !== packet.targetRevision) return null;
        return {
            kind: 'npc',
            object,
            targetIndex: packet.targetIndex,
            targetRevision: packet.targetRevision,
        };
    }
    const peer = peers[packet.targetPeerId];
    if (!peer || peer.hp <= 0 || (peer.lifeId ?? 0) !== packet.targetLifeId) return null;
    return {
        kind: 'peer',
        object: peer.mesh,
        targetPeerId: packet.targetPeerId,
        targetLifeId: packet.targetLifeId,
    };
}

/** Exponential steering is stable across frame rates and deliberately never snaps. */
export function steerHomingDirection(
    currentDirection: THREE.Vector3,
    desiredDirection: THREE.Vector3,
    deltaSeconds: number,
    out = new THREE.Vector3(),
): THREE.Vector3 {
    const safeDelta = Math.max(0, deltaSeconds);
    const responseAlpha = Math.min(0.85, 1 - Math.exp(-PROJECTILE_HOMING_RESPONSE * safeDelta));
    const angle = currentDirection.angleTo(desiredDirection);
    const turnAlpha = angle > Number.EPSILON
        ? Math.min(1, PROJECTILE_HOMING_MAX_TURN_RATE * safeDelta / angle)
        : 1;
    const alpha = Math.min(responseAlpha, turnAlpha);
    out.copy(currentDirection).lerp(desiredDirection, alpha);
    return out.lengthSq() > 0 ? out.normalize() : out.copy(currentDirection).normalize();
}

/** Host-side approximation of the visual scan box, with a small network/UI allowance. */
export function isWithinHomingAimEnvelope(
    origin: THREE.Vector3,
    direction: THREE.Vector3,
    targetCenter: THREE.Vector3,
    targetRadius: number,
    maximumRange: number,
): boolean {
    const normalizedDirection = direction.clone().normalize();
    const offset = targetCenter.clone().sub(origin);
    const distanceSq = offset.lengthSq();
    const maximumDistance = maximumRange + Math.max(0, targetRadius);
    if (distanceSq > maximumDistance * maximumDistance) return false;
    const forwardDistance = offset.dot(normalizedDirection);
    if (forwardDistance <= 0) return false;
    const lateralSq = Math.max(0, distanceSq - forwardDistance * forwardDistance);
    const allowedLateral = Math.max(0, targetRadius) +
        Math.tan(HOMING_AIM_PADDING_RADIANS) * forwardDistance;
    return lateralSq <= allowedLateral * allowedLateral;
}
