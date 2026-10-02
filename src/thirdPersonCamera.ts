import * as THREE from 'three';
import {
    THIRD_PERSON_CAMERA_AIM_DISTANCE,
    THIRD_PERSON_CAMERA_COLLISION_RADIUS,
    THIRD_PERSON_CAMERA_DISTANCE,
    THIRD_PERSON_CAMERA_HEIGHT,
    THIRD_PERSON_CAMERA_SHOULDER_OFFSET,
    THIRD_PERSON_CAMERA_WALL_PADDING,
    MECHA_CAMERA_DISTANCE, MECHA_CAMERA_HEIGHT, MECHA_CAMERA_SHOULDER, MECHA_RELEASE_CAMERA_TIME,
} from './config.js';
import { segmentAabbHitT } from './gameplayMath.js';
import { obstacleData } from './userDataTypes.js';

const _forward = new THREE.Vector3();
const _right = new THREE.Vector3();
const _desiredPosition = new THREE.Vector3();
const _minimum = new THREE.Vector3();
const _maximum = new THREE.Vector3();

/** A simulation-clock boom handoff follows the falling bean. Include the
 * eye-to-seat offset so release doesn't first jump down to the cockpit. */
export class MechaCameraHandoff {
    readonly dimensions = { distance: THIRD_PERSON_CAMERA_DISTANCE, height: THIRD_PERSON_CAMERA_HEIGHT, shoulder: THIRD_PERSON_CAMERA_SHOULDER_OFFSET };
    private readonly start = { ...this.dimensions };
    private readonly offset = new THREE.Vector3();
    private readonly right = new THREE.Vector3();
    private readonly forward = new THREE.Vector3();
    private elapsed = MECHA_RELEASE_CAMERA_TIME;
    get active(): boolean { return this.elapsed < MECHA_RELEASE_CAMERA_TIME; }
    begin(viewPosition: THREE.Vector3, playerPosition: THREE.Vector3, quaternion: THREE.Quaternion): void {
        this.right.set(1, 0, 0).applyQuaternion(quaternion); this.right.y = 0; this.right.normalize();
        this.forward.set(this.right.z, 0, -this.right.x);
        this.offset.subVectors(viewPosition, playerPosition);
        this.start.distance = MECHA_CAMERA_DISTANCE - this.offset.dot(this.forward);
        this.start.height = MECHA_CAMERA_HEIGHT + this.offset.y;
        this.start.shoulder = MECHA_CAMERA_SHOULDER + this.offset.dot(this.right);
        this.elapsed = 0; this.update(0);
    }
    update(delta: number): void {
        this.elapsed = Math.min(MECHA_RELEASE_CAMERA_TIME, this.elapsed + Math.max(0, delta));
        const t = this.elapsed / MECHA_RELEASE_CAMERA_TIME, ease = t * t * (3 - 2 * t);
        this.dimensions.distance = THREE.MathUtils.lerp(this.start.distance, THIRD_PERSON_CAMERA_DISTANCE, ease);
        this.dimensions.height = THREE.MathUtils.lerp(this.start.height, THIRD_PERSON_CAMERA_HEIGHT, ease);
        this.dimensions.shoulder = THREE.MathUtils.lerp(this.start.shoulder, THIRD_PERSON_CAMERA_SHOULDER_OFFSET, ease);
    }
    reset(): void { this.elapsed = MECHA_RELEASE_CAMERA_TIME; this.update(0); }
}

/** Holding C temporarily overrides the saved third-person camera mode. */
export function shouldUseThirdPersonView(thirdPersonMode: boolean, keyCActive: boolean): boolean {
    return thirdPersonMode && !keyCActive;
}

/** Point the shoulder camera back toward the player's logical aiming ray. */
export function resolveThirdPersonAimTarget(
    logicalPosition: THREE.Vector3,
    cameraQuaternion: THREE.Quaternion,
    out: THREE.Vector3,
    aimDistance = THIRD_PERSON_CAMERA_AIM_DISTANCE,
): THREE.Vector3 {
    _forward.set(0, 0, -1).applyQuaternion(cameraQuaternion);
    return out.copy(logicalPosition).addScaledVector(_forward, aimDistance);
}

/**
 * Place a collision-safe, right-shoulder camera around the logical player eye.
 * Camera pitch still controls the view direction, while the boom remains level
 * so looking sharply up or down cannot put the camera below the ground.
 */
export function resolveThirdPersonCameraPosition(
    logicalPosition: THREE.Vector3,
    cameraQuaternion: THREE.Quaternion,
    obstacles: readonly THREE.Object3D[],
    out: THREE.Vector3,
    dimensions?: { distance: number; height: number; shoulder: number },
): THREE.Vector3 {
    _right.set(1, 0, 0).applyQuaternion(cameraQuaternion);
    _right.y = 0;
    if (_right.lengthSq() < Number.EPSILON) _right.set(1, 0, 0);
    else _right.normalize();
    // Deriving forward from horizontal right preserves the last meaningful yaw
    // even when the player looks exactly straight up or down.
    _forward.set(_right.z, 0, -_right.x);

    _desiredPosition.copy(logicalPosition)
        .addScaledVector(_forward, -(dimensions?.distance ?? THIRD_PERSON_CAMERA_DISTANCE))
        .addScaledVector(_right, dimensions?.shoulder ?? THIRD_PERSON_CAMERA_SHOULDER_OFFSET);
    _desiredPosition.y += dimensions?.height ?? THIRD_PERSON_CAMERA_HEIGHT;

    let nearestHitT = 1;
    for (let i = 0; i < obstacles.length; i++) {
        const obstacle = obstacles[i];
        const data = obstacleData(obstacle);
        const halfHeight = data.halfH || data.height / 2;
        if (!Number.isFinite(data.halfW) || !Number.isFinite(data.halfD) || !Number.isFinite(halfHeight)) continue;

        _minimum.set(
            obstacle.position.x - data.halfW - THIRD_PERSON_CAMERA_COLLISION_RADIUS,
            obstacle.position.y - halfHeight - THIRD_PERSON_CAMERA_COLLISION_RADIUS,
            obstacle.position.z - data.halfD - THIRD_PERSON_CAMERA_COLLISION_RADIUS,
        );
        _maximum.set(
            obstacle.position.x + data.halfW + THIRD_PERSON_CAMERA_COLLISION_RADIUS,
            obstacle.position.y + halfHeight + THIRD_PERSON_CAMERA_COLLISION_RADIUS,
            obstacle.position.z + data.halfD + THIRD_PERSON_CAMERA_COLLISION_RADIUS,
        );

        const hitT = segmentAabbHitT(logicalPosition, _desiredPosition, _minimum, _maximum);
        if (hitT !== null && hitT < nearestHitT) nearestHitT = hitT;
    }

    const boomLength = logicalPosition.distanceTo(_desiredPosition);
    const safeT = nearestHitT < 1
        ? Math.max(0, nearestHitT - THIRD_PERSON_CAMERA_WALL_PADDING / boomLength)
        : 1;
    return out.lerpVectors(logicalPosition, _desiredPosition, safeT);
}
