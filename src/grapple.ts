import * as THREE from 'three';
import { state } from './state.js';
import {
    HOOK_MAX_RANGE,
    HOOK_SPEED,
    HOOK_RELEASE_DISTANCE,
    HOOK_OBJECT_RELEASE_DISTANCE,
    HOOK_MAGNETIC_RADIUS,
    HOOK_MIN_PULL_SPEED,
    HOOK_MAX_SLINGSHOT_SPEED,
    HOOK_SLINGSHOT_ACCEL
} from './config.js';
import { queryTargetsNear } from './world.js';

// Reused scratch values for aiming and cable placement.
const _dirToTarget = new THREE.Vector3();
const _toEnemy = new THREE.Vector3();
const _pullDir = new THREE.Vector3();
const _toHook = new THREE.Vector3();
const _gunTip = new THREE.Vector3();
const _midPoint = new THREE.Vector3();
const _camDir = new THREE.Vector3();
const _targetCandidates: THREE.Group[] = [];

const _raycaster = new THREE.Raycaster();
const _centerScreen = new THREE.Vector2(0, 0);

export const GUN_TIP_OFFSET = new THREE.Vector3(0, 0, -0.19);

let hookBadgeEl: HTMLElement | null = null;

export function resetHook(): void {
    state.hookState = 'IDLE';
    state.hookIsEnemy = false;
    state.hookTargetEnemy = null;
    if (state.scene && state.hookMesh) {
        state.scene.remove(state.hookMesh);
    }
    if (!hookBadgeEl) hookBadgeEl = document.getElementById('hook-badge');
    if (hookBadgeEl) hookBadgeEl.style.display = 'none';
}

// Fire from screen center. Enemy targets get a small aim-assist radius; surfaces
// use exact ray hits so pillars and floor still feel precise.
export function toggleGrapplingHook(): void {
    if (!state.scene || !state.camera || !state.leftGun || !state.controls) return;

    if (state.hookState === 'IDLE') {
        state.hookState = 'FIRING';
        state.hookIsEnemy = false;
        state.hookTargetEnemy = null;

        if (state.leftGun && !state.isThirdPerson) {
            state.leftGun.position.z += 0.15;
        }

        state.leftGun.updateWorldMatrix(true, false);
        const barrelWorldPosition = _gunTip.copy(GUN_TIP_OFFSET);
        state.leftGun.localToWorld(barrelWorldPosition);
        state.hookPosition.copy(barrelWorldPosition);

        _raycaster.setFromCamera(_centerScreen, state.camera);
        const ray = _raycaster.ray;

        const playerObj = state.controls.getObject();

        let bestEnemyHit: { target: THREE.Object3D; distance: number } | null = null;
        let closestEnemyDist = Infinity;

        const targetCandidates = queryTargetsNear(playerObj.position.x, playerObj.position.z, HOOK_MAX_RANGE + 20, _targetCandidates);
        const targetLen = targetCandidates.length;
        for (let j = 0; j < targetLen; j++) {
            const target = targetCandidates[j];
            if (!target.visible) continue;
            const enemyPos = target.position;

            const distToRay = ray.distanceToPoint(enemyPos);
            const enemyScale = target.userData.scale || 1.0;

            const magneticRadius = HOOK_MAGNETIC_RADIUS * enemyScale;

            if (distToRay <= magneticRadius) {
                const distToPlayer = playerObj.position.distanceTo(enemyPos);

                _toEnemy.subVectors(enemyPos, playerObj.position);
                const dot = _toEnemy.dot(ray.direction);

                if (dot > 0 && distToPlayer <= (HOOK_MAX_RANGE + enemyScale) && distToPlayer < closestEnemyDist) {
                    closestEnemyDist = distToPlayer;
                    bestEnemyHit = {
                        target: target,
                        distance: distToPlayer
                    };
                }
            }
        }

        const surfaceHits = _raycaster.intersectObjects(state.grappleSurfaces);
        let bestSurfaceHit: THREE.Intersection | null = null;
        if (surfaceHits.length > 0 && surfaceHits[0].distance <= HOOK_MAX_RANGE) {
            bestSurfaceHit = surfaceHits[0];
        }

        // Prefer an unobstructed enemy pull over a farther surface hit.
        if (bestEnemyHit && (!bestSurfaceHit || bestEnemyHit.distance <= bestSurfaceHit.distance)) {
            state.hookTargetEnemy = bestEnemyHit.target;
            state.hookTarget.copy(state.hookTargetEnemy.position);
            state.hookWillHit = true;
            state.hookIsEnemy = true;
        } else if (bestSurfaceHit) {
            state.hookTarget.copy(bestSurfaceHit.point);
            state.hookWillHit = true;
            state.hookIsEnemy = false;
        } else {
            state.camera.getWorldDirection(_camDir);
            state.hookTarget.copy(playerObj.position).addScaledVector(_camDir, HOOK_MAX_RANGE);
            state.hookWillHit = false;
            state.hookIsEnemy = false;
        }

        state.scene.add(state.hookMesh!);
    } else {
        resetHook();
    }
}

export function updateHook(delta: number): void {
    if (state.hookState !== 'IDLE') {
        if (!state.controls) return;
        const playerObj = state.controls.getObject();

        if (state.hookState === 'FIRING') {
            _dirToTarget.subVectors(state.hookTarget, state.hookPosition).normalize();
            state.hookPosition.addScaledVector(_dirToTarget, HOOK_SPEED * delta);

            if (state.hookPosition.distanceTo(state.hookTarget) < 1.5) {
                if (state.hookWillHit) {
                    state.hookState = 'PULLING';
                    if (!hookBadgeEl) hookBadgeEl = document.getElementById('hook-badge');
                    if (hookBadgeEl) hookBadgeEl.style.display = 'inline-block';
                } else {
                    resetHook();
                }
            }
        } else if (state.hookState === 'PULLING') {

            if (state.hookIsEnemy && state.hookTargetEnemy) {
                state.hookTarget.copy(state.hookTargetEnemy.position);
                _toEnemy.subVectors(state.hookTarget, playerObj.position);
                const dist = _toEnemy.length();

                if (dist > HOOK_RELEASE_DISTANCE) {
                    _pullDir.copy(_toEnemy).normalize();
                    const pullSpeed = HOOK_SPEED * 0.75;
                    state.velocity.copy(_pullDir).multiplyScalar(pullSpeed);
                } else {
                    resetHook();
                }
            } else {
                _toHook.subVectors(state.hookTarget, playerObj.position);
                const dist = _toHook.length();

                if (dist > HOOK_OBJECT_RELEASE_DISTANCE) {
                    _pullDir.copy(_toHook).normalize();

                    state.velocity.x += _pullDir.x * HOOK_SLINGSHOT_ACCEL * delta;
                    state.velocity.y += _pullDir.y * HOOK_SLINGSHOT_ACCEL * delta;
                    state.velocity.z += _pullDir.z * HOOK_SLINGSHOT_ACCEL * delta;

                    const dot = state.velocity.dot(_pullDir);
                    if (dot < HOOK_MIN_PULL_SPEED) {
                        state.velocity.addScaledVector(_pullDir, HOOK_MIN_PULL_SPEED - dot);
                    }

                    if (state.velocity.length() > HOOK_MAX_SLINGSHOT_SPEED) {
                        state.velocity.setLength(HOOK_MAX_SLINGSHOT_SPEED);
                    }
                } else {
                    resetHook();
                }
            }
        }

        if (state.leftGun && state.hookMesh) {
            state.leftGun.updateWorldMatrix(true, false);
            _gunTip.copy(GUN_TIP_OFFSET);
            state.leftGun.localToWorld(_gunTip);
            const distance = _gunTip.distanceTo(state.hookPosition);

            if (distance > 0.05) {
                _midPoint.addVectors(_gunTip, state.hookPosition).multiplyScalar(0.5);
                state.hookMesh.position.copy(_midPoint);
                state.hookMesh.scale.set(1, 1, distance);
                state.hookMesh.lookAt(state.hookPosition);
            }
        }
    }
}
