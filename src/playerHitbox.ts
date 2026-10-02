import * as THREE from 'three';
import { segmentAabbHitT, segmentRoundedBoxHitT, cylinderIntersectsBox, type Vec3Like } from './gameplayMath.js';

// The playable bean is always rendered at 1.5x scale. These bounds tightly
// enclose its body, visor and booster, while intentionally excluding weapons
// and the remote name tag.
export const PLAYER_HITBOX_MIN = Object.freeze({ x: -0.9, y: -1.65, z: -1.107 });
export const PLAYER_HITBOX_MAX = Object.freeze({ x: 0.9, y: 1.65, z: 0.9 });
export const PLAYER_BODY_CAMERA_OFFSET = 0.35;
export const PLAYER_HITBOX_BOUNDING_RADIUS = Math.hypot(
    (PLAYER_HITBOX_MAX.x - PLAYER_HITBOX_MIN.x) / 2,
    (PLAYER_HITBOX_MAX.y - PLAYER_HITBOX_MIN.y) / 2,
    (PLAYER_HITBOX_MAX.z - PLAYER_HITBOX_MIN.z) / 2,
);

const _localStart = new THREE.Vector3();
const _localEnd = new THREE.Vector3();
const _expandedMin = new THREE.Vector3();
const _expandedMax = new THREE.Vector3();

/** SAT contact between the yaw-oriented bean and an animated world box.
 * Support collisions use these same mecha proxies; standing on their tops
 * must count even if the visible armor below the top is sloped. */
export function playerTouchesWorldBox(position: Vec3Like, yaw: number, min: Vec3Like, max: Vec3Like, margin = 0): boolean {
    const hx = (PLAYER_HITBOX_MAX.x - PLAYER_HITBOX_MIN.x) / 2, hy = (PLAYER_HITBOX_MAX.y - PLAYER_HITBOX_MIN.y) / 2;
    const hz = (PLAYER_HITBOX_MAX.z - PLAYER_HITBOX_MIN.z) / 2, middleZ = (PLAYER_HITBOX_MAX.z + PLAYER_HITBOX_MIN.z) / 2;
    const c = Math.cos(yaw), s = Math.sin(yaw), ac = Math.abs(c), as = Math.abs(s);
    const dx = position.x + s * middleZ - (min.x + max.x) / 2;
    const dy = position.y - (min.y + max.y) / 2;
    const dz = position.z + c * middleZ - (min.z + max.z) / 2;
    const bx = (max.x - min.x) / 2, by = (max.y - min.y) / 2, bz = (max.z - min.z) / 2;
    return Math.abs(dy) <= hy + by + margin
        && Math.abs(dx) <= ac * hx + as * hz + bx + margin
        && Math.abs(dz) <= as * hx + ac * hz + bz + margin
        && Math.abs(c * dx - s * dz) <= hx + ac * bx + as * bz + margin
        && Math.abs(s * dx + c * dz) <= hz + as * bx + ac * bz + margin;
}

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

/** Closest point on the same oriented body used by shots and leg contacts. */
export function closestPlayerBodyPoint(point: Vec3Like, position: Vec3Like, yaw: number, out: THREE.Vector3): THREE.Vector3 {
    toPlayerLocal(point, position, yaw, out);
    out.x = THREE.MathUtils.clamp(out.x, PLAYER_HITBOX_MIN.x, PLAYER_HITBOX_MAX.x);
    out.y = THREE.MathUtils.clamp(out.y, PLAYER_HITBOX_MIN.y, PLAYER_HITBOX_MAX.y);
    out.z = THREE.MathUtils.clamp(out.z, PLAYER_HITBOX_MIN.z, PLAYER_HITBOX_MAX.z);
    const x = out.x, z = out.z, c = Math.cos(yaw), s = Math.sin(yaw);
    return out.set(position.x + c * x + s * z, position.y + out.y, position.z - s * x + c * z);
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

/** Thick laser contact uses the same body box, with Euclidean edge distance. */
export function segmentPlayerBeamHitT(start: Vec3Like, end: Vec3Like, playerPosition: Vec3Like, playerYaw: number, radius: number): number | null {
    toPlayerLocal(start, playerPosition, playerYaw, _localStart);
    toPlayerLocal(end, playerPosition, playerYaw, _localEnd);
    const hit = segmentRoundedBoxHitT(_localStart, _localEnd, PLAYER_HITBOX_MIN, PLAYER_HITBOX_MAX, radius);
    if (hit === null || !cylinderIntersectsBox(_localStart, _localEnd, PLAYER_HITBOX_MIN, PLAYER_HITBOX_MAX, radius)) return null;
    return hit;
}
