import { requestMechaBoard, rememberMechaApproach } from './mechaNetwork.js';
import { beginWeaponSwitch, resetHook } from './hookLifecycle.js';
import { isLight } from './weaponHandling.js';
import { sendWeaponIntent } from './weaponNetworkPort.js';
import type { WeaponName } from './networkTypes.js';
export { resetHook } from './hookLifecycle.js';
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
    HOOK_SLINGSHOT_ACCEL,
    GUN_TIP_Z,
} from './config.js';
import { queryGrappleSurfacesAlongSegment, queryTargetsNear, queryObstaclesAlongSegment, forgottenMecha } from './world.js';
import { segmentAabbHitT } from './gameplayMath.js';
import { obstacleData } from './userDataTypes.js';
import { PLAYER_RADIUS, PLAYER_HEIGHT, CAMERA_CEILING_CLEARANCE } from './config.js';
import { triggerMuzzleFlash } from './muzzleFlash.js';

// Reused scratch values for aiming and cable placement.
const _dirToTarget = new THREE.Vector3();
const _toEnemy = new THREE.Vector3();
const _pullDir = new THREE.Vector3();
const _toHook = new THREE.Vector3();
const _gunTip = new THREE.Vector3();
const _midPoint = new THREE.Vector3();
const _targetCandidates: THREE.Group[] = [];
const _surfaceCandidates: THREE.Object3D[] = [];
const _sightCandidates: THREE.Object3D[] = [];
const _rayEnd = new THREE.Vector3();

const _raycaster = new THREE.Raycaster();
const _enemySight = new THREE.Raycaster();
const _centerScreen = new THREE.Vector2(0, 0);

export const GUN_TIP_OFFSET = new THREE.Vector3(0, 0, GUN_TIP_Z);


// Fire from screen center. Enemy targets get a small aim-assist radius; surfaces
// use exact ray hits so pillars and floor still feel precise.
export function toggleGrapplingHook(): void {
    if (forgottenMecha?.ownsLocalPilot) return;
    if (!state.scene || !state.camera || !state.leftGun || !state.controls) return;
    if (state.playerHp <= 0) return;
    beginWeaponSwitch();
    const weapon = (state.nextWeaponName ?? state.activeWeaponName) as WeaponName;
    if (state.switchState !== 'IDLE' && !isLight(weapon)) return;
    if (state.hookState !== 'IDLE' || state.weaponHandling.launchPending) { resetHook(); return; }
    if (!state.weaponHandling.pressGrapple(weapon, state.weaponTime)) return;
    if (state.isMultiplayer) sendWeaponIntent('grapple', weapon);
}

function launchGrapplingHook(aimRay?: THREE.Ray, prepareLaunchPose?: () => void): void {
    if (!state.scene || !state.camera || !state.leftGun || !state.controls) return;
    if (state.hookState === 'IDLE') {
        if (state.isMultiplayer) rememberMechaApproach();
        state.hookState = 'FIRING';
        state.hookIsEnemy = false;
        state.hookTargetEnemy = null;
        state.hookTargetSurface = null;
        // Simulation normally precedes posing. Sample the raised glove now so
        // the projectile, flash and the rendered cable share one physical outlet.
        prepareLaunchPose?.();
        grappleMuzzlePosition(state.leftGun, state.hookPosition);
        triggerMuzzleFlash(state.leftGun);

        if (aimRay) _raycaster.ray.copy(aimRay);
        else _raycaster.setFromCamera(_centerScreen, state.camera);
        const ray = _raycaster.ray;
        const cockpit = forgottenMecha?.cockpitHit(ray, HOOK_MAX_RANGE);

        let bestEnemyHit: { target: THREE.Object3D; distance: number } | null = null;
        let closestEnemyDist = Infinity;

        const targetCandidates = queryTargetsNear(ray.origin.x, ray.origin.z, HOOK_MAX_RANGE + 20, _targetCandidates);
        const targetLen = targetCandidates.length;
        for (let j = 0; j < targetLen; j++) {
            const target = targetCandidates[j];
            if (target.userData.hp <= 0) continue;
            const enemyPos = target.position;

            const distToRay = ray.distanceToPoint(enemyPos);
            const enemyScale = target.userData.scale || 1.0;

            const magneticRadius = HOOK_MAGNETIC_RADIUS * enemyScale;

            if (distToRay <= magneticRadius) {
                const distToPlayer = ray.origin.distanceTo(enemyPos);

                _toEnemy.subVectors(enemyPos, ray.origin);
                const dot = _toEnemy.dot(ray.direction);

                if (dot > 0 && distToPlayer <= (HOOK_MAX_RANGE + enemyScale) && distToPlayer < closestEnemyDist) {
                    _enemySight.set(ray.origin, _toEnemy.normalize());
                    _enemySight.far = Math.max(0, distToPlayer - 0.01);
                    const cover = queryObstaclesAlongSegment(ray.origin.x, ray.origin.z, enemyPos.x, enemyPos.z, _sightCandidates);
                    if (_enemySight.intersectObjects(cover).length) continue;
                    closestEnemyDist = distToPlayer;
                    bestEnemyHit = {
                        target: target,
                        distance: distToPlayer
                    };
                }
            }
        }

        _rayEnd.copy(ray.origin).addScaledVector(ray.direction, HOOK_MAX_RANGE);
        const surfaceCandidates = queryGrappleSurfacesAlongSegment(
            ray.origin.x,
            ray.origin.z,
            _rayEnd.x,
            _rayEnd.z,
            _surfaceCandidates
        );
        // Only a verified opening may bypass the body's coarse boxes. Exterior
        // armor still uses the ordinary surface grapple behavior.
        const surfaceHits = _raycaster.intersectObjects(cockpit ? surfaceCandidates.filter(object => object.userData.damageTarget !== 'forgotten-mecha') : surfaceCandidates);
        let bestSurfaceHit: THREE.Intersection | null = null;
        if (surfaceHits.length > 0 && surfaceHits[0].distance <= HOOK_MAX_RANGE) {
            bestSurfaceHit = surfaceHits[0];
        }

        // Prefer an unobstructed enemy pull over a farther surface hit.
        if (cockpit && (!bestSurfaceHit || cockpit.distance < bestSurfaceHit.distance) && (!bestEnemyHit || cockpit.distance < bestEnemyHit.distance)) {
            state.hookTargetCockpit = forgottenMecha;
            state.hookTarget.copy(cockpit.point); state.hookWillHit = true; state.hookIsEnemy = true;
        } else if (bestEnemyHit && (!bestSurfaceHit || bestEnemyHit.distance <= bestSurfaceHit.distance)) {
            state.hookTargetEnemy = bestEnemyHit.target;
            state.hookTarget.copy(state.hookTargetEnemy.position);
            state.hookWillHit = true;
            state.hookIsEnemy = true;
        } else if (bestSurfaceHit) {
            state.hookTarget.copy(bestSurfaceHit.point);
            state.hookWillHit = true;
            state.hookIsEnemy = false;
            if (bestSurfaceHit.object.userData.damageTarget === 'forgotten-mecha') {
                state.hookTargetSurface = bestSurfaceHit.object;
                bestSurfaceHit.object.worldToLocal(state.hookSurfaceLocalPoint.copy(bestSurfaceHit.point));
            }
        } else {
            state.hookTarget.copy(ray.origin).addScaledVector(ray.direction, HOOK_MAX_RANGE);
            state.hookWillHit = false;
            state.hookIsEnemy = false;
        }

        if (!state.hookMesh) {
            resetHook();
            return;
        }
        state.hookMesh.visible = false;
        state.scene.add(state.hookMesh);
    } else {
        resetHook();
    }
}

function grappleMuzzlePosition(gun: THREE.Object3D, out: THREE.Vector3): THREE.Vector3 {
    const muzzle: THREE.Object3D | undefined = gun.userData.grappleMuzzle;
    return muzzle ? muzzle.getWorldPosition(out) : gun.localToWorld(out.copy(GUN_TIP_OFFSET));
}

export function updateHook(delta: number, aimRay?: THREE.Ray, prepareLaunchPose?: () => void): void {
    // Sample the currently visible aim at the handoff, even if the player
    // turned between pressing grapple and the muzzle clearing the holster.
    let flightDelta = delta;
    if (state.weaponHandling.takeLaunch(state.weaponTime) && state.hookState === 'IDLE') {
        launchGrapplingHook(aimRay, prepareLaunchPose);
        // Only the part of this frame after release belongs to the hook.
        flightDelta = Math.min(delta, Math.max(0, state.weaponTime - state.weaponHandling.handStarted));
    }
    if (state.hookTargetCockpit && (!state.hookTargetCockpit.canMount || state.hookTargetCockpit.disposed)) { resetHook(); return; }
    if (state.hookTargetSurface) {
        const surface = state.hookTargetSurface;
        if (!forgottenMecha || forgottenMecha.disposed || !forgottenMecha.solidColliders.includes(surface as THREE.Mesh)) { resetHook(); return; }
        surface.localToWorld(state.hookTarget.copy(state.hookSurfaceLocalPoint));
        if (state.hookState === 'PULLING') state.hookPosition.copy(state.hookTarget);
    }
    if (state.hookState !== 'IDLE') {
        if (!state.controls) return;
        const playerObj = state.controls.getObject();

        if (state.hookState === 'FIRING') {
            _dirToTarget.subVectors(state.hookTarget, state.hookPosition);
            const distanceToTarget = _dirToTarget.length();
            const travelDistance = HOOK_SPEED * flightDelta;

            // Snap when this frame would cross the target. Checking only the
            // post-step distance lets the hook overshoot forever on a slow or
            // stalled frame.
            if (distanceToTarget <= travelDistance + 1.5) {
                state.hookPosition.copy(state.hookTarget);
                if (state.hookWillHit) {
                    state.hookState = 'PULLING';
                } else {
                    resetHook();
                }
            } else {
                _dirToTarget.multiplyScalar(1 / distanceToTarget);
                state.hookPosition.addScaledVector(_dirToTarget, travelDistance);
            }
        } else if (state.hookState === 'PULLING') {

            if (state.hookTargetCockpit) {
                const actor = state.hookTargetCockpit;
                actor.seatAnchor.getWorldPosition(state.hookTarget);
                state.hookPosition.copy(state.hookTarget);
                _toEnemy.subVectors(state.hookTarget, playerObj.position);
                const distance = _toEnemy.length(); const travel = Math.min(distance, HOOK_SPEED * 0.75 * delta);
                _pullDir.copy(_toEnemy).normalize(); _rayEnd.copy(playerObj.position).addScaledVector(_pullDir, travel);
                // This pull owns translation so ordinary bean substeps cannot
                // collide with the empty-cockpit AABBs or overshoot the seat.
                const candidates = queryObstaclesAlongSegment(playerObj.position.x, playerObj.position.z, _rayEnd.x, _rayEnd.z, _surfaceCandidates, PLAYER_RADIUS);
                let blocked = false;
                for (const object of candidates) {
                    if (object.userData.damageTarget === 'forgotten-mecha') continue;
                    const d = obstacleData(object), hh = d.halfH ?? d.height / 2;
                    _midPoint.set(object.position.x - d.halfW - PLAYER_RADIUS,
                        object.position.y - hh - CAMERA_CEILING_CLEARANCE, object.position.z - d.halfD - PLAYER_RADIUS);
                    _gunTip.set(object.position.x + d.halfW + PLAYER_RADIUS,
                        object.position.y + hh + PLAYER_HEIGHT, object.position.z + d.halfD + PLAYER_RADIUS);
                    if (segmentAabbHitT(playerObj.position, _rayEnd, _midPoint, _gunTip) !== null) { blocked = true; break; }
                }
                state.velocity.set(0, 0, 0);
                if (blocked) { resetHook(); return; }
                playerObj.position.copy(_rayEnd);
                if (distance <= travel + 0.001) { playerObj.position.copy(state.hookTarget); if (state.isMultiplayer) requestMechaBoard(); else actor.beginBoarding(playerObj.position, playerObj.quaternion, state.isThirdPerson, state.rightClickActive); resetHook(); return; }
            } else if (state.hookIsEnemy && state.hookTargetEnemy) {
                state.hookTarget.copy(state.hookTargetEnemy.position);
                state.hookPosition.copy(state.hookTarget);
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

    }
}

/** The moving glove and target must be sampled in the same rendered frame. */
export function updateGrappleCable(displayOrigin?: THREE.Vector3): void {
    if (state.hookState === 'IDLE' || !state.leftGun || !state.hookMesh) return;
    if (displayOrigin) _gunTip.copy(displayOrigin);
    else grappleMuzzlePosition(state.leftGun, _gunTip);
    const distance = _gunTip.distanceTo(state.hookPosition);
    state.hookMesh.visible = distance > .05;
    if (state.hookMesh.visible) {
        state.hookMesh.position.copy(_midPoint.addVectors(_gunTip, state.hookPosition).multiplyScalar(.5));
        state.hookMesh.scale.set(1, 1, distance);
        state.hookMesh.lookAt(state.hookPosition);
    }
}
