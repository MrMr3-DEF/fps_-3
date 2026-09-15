import * as THREE from 'three';
import {
    THIRD_PERSON_CAMERA_AIM_DISTANCE,
    THIRD_PERSON_CAMERA_COLLISION_RADIUS,
    THIRD_PERSON_CAMERA_DISTANCE,
    THIRD_PERSON_CAMERA_HEIGHT,
    THIRD_PERSON_CAMERA_SHOULDER_OFFSET,
    THIRD_PERSON_CAMERA_WALL_PADDING,
} from './config.js';
import { segmentAabbHitT } from './gameplayMath.js';
import { obstacleData } from './userDataTypes.js';

const _forward = new THREE.Vector3();
const _right = new THREE.Vector3();
const _desiredPosition = new THREE.Vector3();
const _minimum = new THREE.Vector3();
const _maximum = new THREE.Vector3();

/** Holding C temporarily overrides the saved third-person camera mode. */
export function shouldUseThirdPersonView(thirdPersonMode: boolean, keyCActive: boolean): boolean {
    return thirdPersonMode && !keyCActive;
}

/** Point the shoulder camera back toward the player's logical aiming ray. */
export function resolveThirdPersonAimTarget(
    logicalPosition: THREE.Vector3,
    cameraQuaternion: THREE.Quaternion,
    out: THREE.Vector3,
): THREE.Vector3 {
    _forward.set(0, 0, -1).applyQuaternion(cameraQuaternion);
    return out.copy(logicalPosition).addScaledVector(_forward, THIRD_PERSON_CAMERA_AIM_DISTANCE);
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
): THREE.Vector3 {
    _right.set(1, 0, 0).applyQuaternion(cameraQuaternion);
    _right.y = 0;
    if (_right.lengthSq() < Number.EPSILON) _right.set(1, 0, 0);
    else _right.normalize();
    // Deriving forward from horizontal right preserves the last meaningful yaw
    // even when the player looks exactly straight up or down.
    _forward.set(_right.z, 0, -_right.x);

    _desiredPosition.copy(logicalPosition)
        .addScaledVector(_forward, -THIRD_PERSON_CAMERA_DISTANCE)
        .addScaledVector(_right, THIRD_PERSON_CAMERA_SHOULDER_OFFSET);
    _desiredPosition.y += THIRD_PERSON_CAMERA_HEIGHT;

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
