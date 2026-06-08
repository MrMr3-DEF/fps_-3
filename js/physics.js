import * as THREE from 'three';
import { state } from './state.js';
import {
    PILLAR_WIDTH,
    PLAYER_RADIUS,
    MAP_SIZE,
    BASE_GRAVITY,
    JUMP_FORCE,
    WALK_SPEED,
    SPRINT_SPEED,
    PLAYER_HEIGHT
} from './config.js';

// Module-level cached vectors to prevent per-frame garbage collection
const _camForward = new THREE.Vector3();
const _camRight = new THREE.Vector3();
const _moveDir = new THREE.Vector3();
const _tempPos = new THREE.Vector3();
const _tempZ   = new THREE.Vector3();

// ---------------------------------------------------------------------------
// scanObstacles — single-pass collision + ground query (replaces the two
// separate loops that checkCollision and getGroundY used to run).
// Returns { colX, colZ, groundY } in one obstacle-list iteration.
// ---------------------------------------------------------------------------
function scanObstacles(actualPos, testPosX, testPosZ, feetY) {
    let groundY = 0;
    let colX = false;
    let colZ = false;

    const limit = (MAP_SIZE / 2) - 1;
    if (Math.abs(testPosX.x) > limit || Math.abs(testPosX.z) > limit) colX = true;
    if (Math.abs(testPosZ.x) > limit || Math.abs(testPosZ.z) > limit) colZ = true;
    // Also guard the actual position for ground-boundary (player is already there, so
    // if we're past the limit physics already stopped us — no separate check needed).

    for (let i = 0; i < state.obstacles.length; i++) {
        const box = state.obstacles[i];
        const ph  = box.userData.height;
        const halfW = box.userData.halfW || (PILLAR_WIDTH / 2);
        const halfD = box.userData.halfD || (PILLAR_WIDTH / 2);
        const ex = halfW + PLAYER_RADIUS;
        const ez = halfD + PLAYER_RADIUS;
        const bx = box.position.x;
        const bz = box.position.z;

        // X-axis collision test
        if (!colX &&
            testPosX.x > bx - ex && testPosX.x < bx + ex &&
            testPosX.z > bz - ez && testPosX.z < bz + ez) {
            if (feetY < ph - 0.3) colX = true;
        }

        // Z-axis collision test
        if (!colZ &&
            testPosZ.x > bx - ex && testPosZ.x < bx + ex &&
            testPosZ.z > bz - ez && testPosZ.z < bz + ez) {
            if (feetY < ph - 0.3) colZ = true;
        }

        // Ground height from actual (current) position
        if (actualPos.x > bx - ex && actualPos.x < bx + ex &&
            actualPos.z > bz - ez && actualPos.z < bz + ez) {
            if (ph > groundY) groundY = ph;
        }
    }

    return { colX, colZ, groundY };
}

// Thin public wrappers kept for any potential external usage.
export function checkCollision(position, feetY) {
    const limit = (MAP_SIZE / 2) - 1;
    if (Math.abs(position.x) > limit || Math.abs(position.z) > limit) return true;
    for (let i = 0; i < state.obstacles.length; i++) {
        const box = state.obstacles[i];
        const ph  = box.userData.height;
        const halfW = box.userData.halfW || (PILLAR_WIDTH / 2);
        const halfD = box.userData.halfD || (PILLAR_WIDTH / 2);
        const ex = halfW + PLAYER_RADIUS, ez = halfD + PLAYER_RADIUS;
        if (position.x > box.position.x - ex && position.x < box.position.x + ex &&
            position.z > box.position.z - ez && position.z < box.position.z + ez) {
            if (feetY < ph - 0.3) return true;
        }
    }
    return false;
}

export function getGroundY(position) {
    let highest = 0;
    for (let i = 0; i < state.obstacles.length; i++) {
        const box = state.obstacles[i];
        const ph  = box.userData.height;
        const halfW = box.userData.halfW || (PILLAR_WIDTH / 2);
        const halfD = box.userData.halfD || (PILLAR_WIDTH / 2);
        const ex = halfW + PLAYER_RADIUS, ez = halfD + PLAYER_RADIUS;
        if (position.x > box.position.x - ex && position.x < box.position.x + ex &&
            position.z > box.position.z - ez && position.z < box.position.z + ez) {
            if (ph > highest) highest = ph;
        }
    }
    return highest;
}



export function updatePlayerPhysics(delta) {
    if (state.controls) {
        const isPaused = !state.controls.isLocked && state.isPlaying;
        
        if (state.controls.isLocked || isPaused) {
            const playerObj = state.controls.getObject();
            
            // Override keyboard movement inputs to false when paused
            const moveForward = isPaused ? false : state.moveForward;
            const moveBackward = isPaused ? false : state.moveBackward;
            const moveLeft = isPaused ? false : state.moveLeft;
            const moveRight = isPaused ? false : state.moveRight;
            const isSprinting = isPaused ? false : state.isSprinting;
            const isMoving = moveForward || moveBackward || moveLeft || moveRight;

            // Speedlines & sprint UI updates
            const speedlines = document.getElementById('speedlines');
            const badge = document.getElementById('sprint-badge');
            if (isSprinting && isMoving && state.hookState !== 'PULLING') {
                if (speedlines) speedlines.style.opacity = '1';
                if (badge) badge.style.display = 'inline-block';
            } else {
                if (speedlines) speedlines.style.opacity = '0';
                if (badge) badge.style.display = 'none';
            }

            // --- ACCELERATION & FRICTION PIPELINE ---
            const friction = (state.canJump && state.hookState !== 'PULLING') ? 10.0 : 0.0;
            state.velocity.x -= state.velocity.x * friction * delta;
            state.velocity.z -= state.velocity.z * friction * delta;

            // Gravity variations based on states
            let dynamicGravity = BASE_GRAVITY;
            if (state.hookState === 'PULLING' && state.hookIsEnemy) {
                dynamicGravity = 0; // Constant speed pull handles vertical velocity directly
            } else if (state.hookState === 'PULLING') {
                dynamicGravity = BASE_GRAVITY * 0.3; // Low gravity for smooth slingshots
            } else if (state.velocity.y > 0) {
                const ascentProgress = Math.min(1.0, state.velocity.y / JUMP_FORCE);
                dynamicGravity = BASE_GRAVITY * (0.3 + ascentProgress * 0.5);
            } else if (state.velocity.y <= 0 && state.velocity.y > -70) {
                dynamicGravity = BASE_GRAVITY * 0.15; 
            } else {
                dynamicGravity = BASE_GRAVITY * 1.1;
            }
            state.velocity.y -= dynamicGravity * delta;

            // --- WORLD SPACE DIRECTION INTEGRATION ---
            _camForward.set(0, 0, -1).applyQuaternion(state.camera.quaternion);
            _camForward.y = 0;
            _camForward.normalize();

            _camRight.set(1, 0, 0).applyQuaternion(state.camera.quaternion);
            _camRight.y = 0;
            _camRight.normalize();

            // Keyboard movement vector
            _moveDir.set(0, 0, 0);
            if (moveForward) _moveDir.add(_camForward);
            if (moveBackward) _moveDir.sub(_camForward);
            if (moveRight) _moveDir.add(_camRight);
            if (moveLeft) _moveDir.sub(_camRight);
            if (_moveDir.lengthSq() > 0) _moveDir.normalize();

            const currentSpeed = isSprinting ? SPRINT_SPEED : WALK_SPEED;

            if (state.canJump) {
                if (state.hookState !== 'PULLING' && isMoving) {
                    const targetVelX = _moveDir.x * currentSpeed;
                    const targetVelZ = _moveDir.z * currentSpeed;
                    state.velocity.x += (targetVelX - state.velocity.x) * 10.0 * delta;
                    state.velocity.z += (targetVelZ - state.velocity.z) * 10.0 * delta;
                }
            } else {
                // In-air steering & drag
                if (state.hookState !== 'PULLING') {
                    const airDrag = 0.25;
                    state.velocity.x -= state.velocity.x * airDrag * delta;
                    state.velocity.z -= state.velocity.z * airDrag * delta;

                    if (moveForward || moveLeft || moveRight) {
                        state.velocity.x += _moveDir.x * 35.0 * delta;
                        state.velocity.z += _moveDir.z * 35.0 * delta;
                    }
                    if (moveBackward) {
                        state.velocity.x -= state.velocity.x * 1.5 * delta;
                        state.velocity.z -= state.velocity.z * 1.5 * delta;
                    }
                }
            }

            const nextX = playerObj.position.x + state.velocity.x * delta;
            const nextZ = playerObj.position.z + state.velocity.z * delta;
            const feetY = playerObj.position.y - PLAYER_HEIGHT;

            // Single-pass scan: compute X collision, Z collision, and ground height together
            const testPosX = _tempPos.set(nextX, playerObj.position.y, playerObj.position.z);
            const testPosZ = _tempZ.set(playerObj.position.x, playerObj.position.y, nextZ);
            const { colX: collisionX, colZ: collisionZ, groundY: currentGroundY } =
                scanObstacles(playerObj.position, testPosX, testPosZ, feetY);

            if (!collisionX) {
                playerObj.position.x = nextX;
            } else {
                state.velocity.x = 0;
            }

            if (!collisionZ) {
                playerObj.position.z = nextZ;
            } else {
                state.velocity.z = 0;
            }

            playerObj.position.y += state.velocity.y * delta;

            const minCameraY = currentGroundY + PLAYER_HEIGHT; 

            if (playerObj.position.y < minCameraY) {
                state.velocity.y = 0;
                playerObj.position.y = minCameraY;
                state.canJump = true; 
            }
        }
    }
}
