import * as THREE from 'three';
import { segmentAabbHitT, type Vec3Like } from './gameplayMath.js';

// The playable bean is always rendered at 1.5x scale. These bounds tightly
// enclose its body, visor and booster, while intentionally excluding weapons
// and the remote name tag.
export const PLAYER_HITBOX_MIN = Object.freeze({ x: -0.9, y: -1.65, z: -1.107 });
export const PLAYER_HITBOX_MAX = Object.freeze({ x: 0.9, y: 1.65, z: 0.9 });
export const PLAYER_HITBOX_BOUNDING_RADIUS = Math.hypot(
    (PLAYER_HITBOX_MAX.x - PLAYER_HITBOX_MIN.x) / 2,
    (PLAYER_HITBOX_MAX.y - PLAYER_HITBOX_MIN.y) / 2,
    (PLAYER_HITBOX_MAX.z - PLAYER_HITBOX_MIN.z) / 2,
);

const _localStart = new THREE.Vector3();
const _localEnd = new THREE.Vector3();
const _expandedMin = new THREE.Vector3();
const _expandedMax = new THREE.Vector3();

function toPlayerLocal(point: Vec3Like, position: Vec3Like, yaw: number, out: THREE.Vector3): THREE.Vector3 {
    const dx = point.x - position.x;
    const dy = point.y - position.y;
    const dz = point.z - position.z;
    const cosine = Math.cos(yaw);
    const sine = Math.sin(yaw);
    return out.set(
        cosine * dx - sine * dz,
        dy,
        sine * dx + cosine * dz,
    );
}

/** Return the first contact with the bean's tight, yaw-oriented box. */
export function segmentPlayerHitboxHitT(
    start: Vec3Like,
    end: Vec3Like,
    playerPosition: Vec3Like,
    playerYaw: number,
    padding = 0,
): number | null {
    toPlayerLocal(start, playerPosition, playerYaw, _localStart);
    toPlayerLocal(end, playerPosition, playerYaw, _localEnd);
    _expandedMin.set(
        PLAYER_HITBOX_MIN.x - padding,
        PLAYER_HITBOX_MIN.y - padding,
        PLAYER_HITBOX_MIN.z - padding,
    );
    _expandedMax.set(
        PLAYER_HITBOX_MAX.x + padding,
        PLAYER_HITBOX_MAX.y + padding,
        PLAYER_HITBOX_MAX.z + padding,
    );
    return segmentAabbHitT(_localStart, _localEnd, _expandedMin, _expandedMax);
}
