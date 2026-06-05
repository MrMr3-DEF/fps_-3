import * as THREE from 'three';
import { state } from './state.js';
import { HOOK_MAX_RANGE, HOOK_SPEED } from './config.js';

const HOOK_SLINGSHOT_ACCEL = 360.0;

export function resetHook() {
    state.hookState = 'IDLE';
    state.hookIsEnemy = false;
    state.hookTargetEnemy = null;
    if (state.scene && state.hookMesh) {
        state.scene.remove(state.hookMesh);
    }
    const badge = document.getElementById('hook-badge');
    if (badge) badge.style.display = 'none';
}

export function toggleGrapplingHook() {
    if (!state.scene || !state.camera || !state.leftGun || !state.controls) return;

    if (state.hookState === 'IDLE') {
        state.hookState = 'FIRING';
        state.hookIsEnemy = false;
        state.hookTargetEnemy = null;

        if (state.leftGun && !state.isThirdPerson) {
            state.leftGun.position.z += 0.15;
        }

        const barrelWorldPosition = new THREE.Vector3(0, 0, -0.19);
        state.leftGun.localToWorld(barrelWorldPosition);
        state.hookPosition.copy(barrelWorldPosition);

        const raycaster = new THREE.Raycaster();
        raycaster.setFromCamera(new THREE.Vector2(0, 0), state.camera);
        const ray = raycaster.ray;

        // 1) Check enemies first with a premium magnetic aim assist
        let bestEnemyHit = null;
        let closestEnemyDist = Infinity;

        for (let j = 0; j < state.targets.length; j++) {
            const target = state.targets[j];
            const enemyPos = target.position;
            
            // Shortest distance from camera looking ray to enemy center
            const distToRay = ray.distanceToPoint(enemyPos);
            const enemyScale = target.userData.scale || 1.0;
            
            // Generous magnetic hitbox: 3.5 * enemyScale
            const magneticRadius = 3.5 * enemyScale;
            
            if (distToRay <= magneticRadius) {
                const distToPlayer = state.controls.getObject().position.distanceTo(enemyPos);
                
                // Ensure enemy is in front of the player (dot product > 0)
                const toEnemy = new THREE.Vector3().subVectors(enemyPos, state.controls.getObject().position);
                const dot = toEnemy.dot(ray.direction);
                
                // Allow a small buffer beyond HOOK_MAX_RANGE (plus enemyScale) to account for large enemy size
                if (dot > 0 && distToPlayer <= (HOOK_MAX_RANGE + enemyScale) && distToPlayer < closestEnemyDist) {
                    closestEnemyDist = distToPlayer;
                    bestEnemyHit = {
                        target: target,
                        distance: distToPlayer
                    };
                }
            }
        }

        // 2) Check surfaces (pillars and ground)
        const surfaceHits = raycaster.intersectObjects(state.grappleSurfaces);
        let bestSurfaceHit = null;
        if (surfaceHits.length > 0 && surfaceHits[0].distance <= HOOK_MAX_RANGE) {
            bestSurfaceHit = surfaceHits[0];
        }

        // 3) Resolve target: Prefer magnetic enemy hit if closer than surface hit (not obstructed), fallback to surface
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
            const camDir = new THREE.Vector3();
            state.camera.getWorldDirection(camDir);
            state.hookTarget.copy(state.controls.getObject().position).addScaledVector(camDir, HOOK_MAX_RANGE);
            state.hookWillHit = false;
            state.hookIsEnemy = false;
        }

        state.scene.add(state.hookMesh);
    } else {
        resetHook();
    }
}

export function updateHook(delta) {
    if (state.hookState !== 'IDLE') {
        const playerObj = state.controls.getObject();
        
        if (state.hookState === 'FIRING') {
            const dirToTarget = new THREE.Vector3().subVectors(state.hookTarget, state.hookPosition).normalize();
            state.hookPosition.addScaledVector(dirToTarget, HOOK_SPEED * delta);

            if (state.hookPosition.distanceTo(state.hookTarget) < 1.5) {
                if (state.hookWillHit) {
                    state.hookState = 'PULLING'; 
                    state.isSprinting = false;
                    const badge = document.getElementById('hook-badge');
                    if (badge) badge.style.display = 'inline-block';
                } else {
                    resetHook(); 
                }
            }
        } else if (state.hookState === 'PULLING') {
            state.isSprinting = false;

            if (state.hookIsEnemy && state.hookTargetEnemy) {
                state.hookTarget.copy(state.hookTargetEnemy.position);
                const toEnemy = new THREE.Vector3().subVectors(state.hookTarget, playerObj.position);
                const dist = toEnemy.length();

                if (dist > 3.0) {
                    const pullDir = toEnemy.clone().normalize();
                    const pullSpeed = HOOK_SPEED * 0.75; 
                    state.velocity.copy(pullDir).multiplyScalar(pullSpeed);
                } else {
                    resetHook();
                }
            } else {
                const toHook = new THREE.Vector3().subVectors(state.hookTarget, playerObj.position);
                const dist = toHook.length();

                if (dist > 3.0) {
                    const pullDir = toHook.clone().normalize();

                    state.velocity.x += pullDir.x * HOOK_SLINGSHOT_ACCEL * delta;
                    state.velocity.y += pullDir.y * HOOK_SLINGSHOT_ACCEL * delta;
                    state.velocity.z += pullDir.z * HOOK_SLINGSHOT_ACCEL * delta;

                    const dot = state.velocity.dot(pullDir);
                    const minPullSpeed = 35.0;
                    if (dot < minPullSpeed) {
                        state.velocity.addScaledVector(pullDir, minPullSpeed - dot);
                    }

                    const maxSpeed = 80.0;
                    if (state.velocity.length() > maxSpeed) {
                        state.velocity.setLength(maxSpeed);
                    }
                } else {
                    resetHook();
                }
            }
        }

        if (state.leftGun && state.hookMesh) {
            const gunTip = new THREE.Vector3(0, 0, -0.19);
            state.leftGun.localToWorld(gunTip);
            const distance = gunTip.distanceTo(state.hookPosition);

            if (distance > 0.05) {
                const midPoint = new THREE.Vector3().addVectors(gunTip, state.hookPosition).multiplyScalar(0.5);
                state.hookMesh.position.copy(midPoint);
                state.hookMesh.scale.set(1, 1, distance);
                state.hookMesh.lookAt(state.hookPosition);
            }
        }
    }
}
