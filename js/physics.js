import * as THREE from 'three';
import { state } from './state.js';
import { spawnRocketFlame, spawnManeuveringBeam } from './particles.js';
import { resetHook } from './grapple.js';
import {
    PILLAR_WIDTH,
    PLAYER_RADIUS,
    MAP_SIZE,
    BASE_GRAVITY,
    JUMP_FORCE,
    WALK_SPEED,
    PLAYER_HEIGHT,
    HOVER_DRAIN_RATE,
    HOVER_RECHARGE_RATE,
    GROUND_FRICTION,
    GRAPPLE_GRAVITY_SCALE,
    HOVER_GRAVITY_SCALE,
    HOVER_MAX_FALL_SPEED,
    AIR_STEER_FORCE,
    AIR_BACK_BRAKE_COEFF
} from './config.js';

// Module-level cached vectors to prevent per-frame garbage collection
const _camForward = new THREE.Vector3();
const _camRight = new THREE.Vector3();
const _moveDir = new THREE.Vector3();
const _tempPos = new THREE.Vector3();
const _tempZ   = new THREE.Vector3();
const _boosterPos = new THREE.Vector3();
const _negCamForward = new THREE.Vector3();
const _negCamRight = new THREE.Vector3();

// DOM caches
let speedlinesEl = null;
let sprintBadgeEl = null;
let hoverBadgeEl = null;

// Constant physics thresholds
const MAX_FALL_SPEED = JUMP_FORCE * 0.88;
const MAP_LIMIT = (MAP_SIZE / 2) - 1;

// ---------------------------------------------------------------------------
// scanObstacles — single-pass collision + ground query (replaces the two
// separate loops that checkCollision and getGroundY used to run).
// Returns { colX, colZ, groundY } in one obstacle-list iteration.
// ---------------------------------------------------------------------------
// Scans 3D obstacle columns (pillars) to determine floor collision boundaries and returns player ground height.
function scanObstacles(actualPos, testPosX, testPosZ, feetY) {
    let groundY = 0;
    let colX = false;
    let colZ = false;

    if (Math.abs(testPosX.x) > MAP_LIMIT || Math.abs(testPosX.z) > MAP_LIMIT) colX = true;
    if (Math.abs(testPosZ.x) > MAP_LIMIT || Math.abs(testPosZ.z) > MAP_LIMIT) colZ = true;

    const len = state.obstacles.length;
    for (let i = 0; i < len; i++) {
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
    if (Math.abs(position.x) > MAP_LIMIT || Math.abs(position.z) > MAP_LIMIT) return true;
    const len = state.obstacles.length;
    for (let i = 0; i < len; i++) {
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
    const len = state.obstacles.length;
    for (let i = 0; i < len; i++) {
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

// Updates player velocities, handles dynamic gravity scaling, clamps maximum speeds, and resolves AABB collisions.
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
            const isMoving = moveForward || moveBackward || moveLeft || moveRight;

            // --- WORLD SPACE DIRECTION INTEGRATION ---
            _camForward.set(0, 0, -1).applyQuaternion(state.camera.quaternion);
            _camForward.y = 0;
            _camForward.normalize();

            _camRight.set(1, 0, 0).applyQuaternion(state.camera.quaternion);
            _camRight.y = 0;
            _camRight.normalize();

            // Hide sprint UI permanently since sprint is replaced by hover (Cached DOM queries)
            if (!speedlinesEl) speedlinesEl = document.getElementById('speedlines');
            if (!sprintBadgeEl) sprintBadgeEl = document.getElementById('sprint-badge');
            if (speedlinesEl) speedlinesEl.style.opacity = '0';
            if (sprintBadgeEl) sprintBadgeEl.style.display = 'none';

            // --- HOVER SYSTEM ---
            // Activate hover only mid-air when Shift is held, we have fuel, and the grappling hook is not actively pulling
            const wasHovering = state.isHovering;
            if (!state.canJump && state.isShiftDown && state.hoverFuel > 0.0 && state.hookState !== 'PULLING') {
                state.isHovering = true;
            } else {
                state.isHovering = false;
            }

            // Consume or recharge fuel
            if (state.isHovering) {
                state.hoverFuel -= delta / HOVER_DRAIN_RATE;
                if (state.hoverFuel < 0) {
                    state.hoverFuel = 0;
                    state.isHovering = false;
                }

                // Spawn blue thruster flames downwards from the rocket booster (using module-level boosterPos)
                _boosterPos.copy(playerObj.position);
                _boosterPos.y -= 1.8;
                spawnRocketFlame(_boosterPos, 2, false);

                // Spawn absolute maneuvering thruster plumes when using WASD while hovering
                if (moveForward) {
                    _negCamForward.copy(_camForward).negate();
                    spawnManeuveringBeam(_boosterPos, 1, _negCamForward);
                }
                if (moveBackward) spawnManeuveringBeam(_boosterPos, 1, _camForward);
                if (moveLeft)     spawnManeuveringBeam(_boosterPos, 1, _camRight);
                if (moveRight) {
                    _negCamRight.copy(_camRight).negate();
                    spawnManeuveringBeam(_boosterPos, 1, _negCamRight);
                }
            } else {
                // Recharge fuel when standing on solid ground or when grappling hook is engaged
                if (state.canJump || state.hookState === 'PULLING') {
                    state.hoverFuel += delta / HOVER_RECHARGE_RATE;
                    if (state.hoverFuel > 1.0) {
                        state.hoverFuel = 1.0;
                    }
                }
            }

            if (state.isHovering !== wasHovering) {
                if (!hoverBadgeEl) hoverBadgeEl = document.getElementById('hover-badge');
                if (hoverBadgeEl) {
                    hoverBadgeEl.style.display = state.isHovering ? 'inline-block' : 'none';
                }
            }

            // --- ACCELERATION & FRICTION PIPELINE ---
            const friction = (state.canJump && state.hookState !== 'PULLING') ? GROUND_FRICTION : 0.0;
            state.velocity.x -= state.velocity.x * friction * delta;
            state.velocity.z -= state.velocity.z * friction * delta;

            // Gravity variations based on states
            let dynamicGravity = BASE_GRAVITY;
            if (state.hookState === 'PULLING' && state.hookIsEnemy) {
                dynamicGravity = 0; // Constant speed pull handles vertical velocity directly
            } else if (state.hookState === 'PULLING') {
                dynamicGravity = BASE_GRAVITY * GRAPPLE_GRAVITY_SCALE; // Low gravity for smooth slingshots
            } else if (state.isHovering && state.velocity.y <= 0) {
                dynamicGravity = BASE_GRAVITY * HOVER_GRAVITY_SCALE; // Minimal gravity while hovering downward
            } else if (state.velocity.y > 0) {
                if (state.velocity.y > 20) {
                    dynamicGravity = BASE_GRAVITY * 1.0;
                } else {
                    // Smooth deceleration before reaching max height (apex)
                    const ratio = state.velocity.y / 20;
                    const ease = ratio * ratio; // quadratic ease
                    dynamicGravity = BASE_GRAVITY * (0.2 + 0.8 * ease);
                }
            } else {
                // Descent phase: quick but smooth reacceleration after changing direction
                const fallSpeed = Math.abs(state.velocity.y);
                const fallRatio = Math.min(1.0, fallSpeed / 45);
                dynamicGravity = BASE_GRAVITY * (0.2 + 1.1 * fallRatio);
            }
            state.velocity.y -= dynamicGravity * delta;

            // Clamp downward velocity when hovering or falling normally
            if (state.isHovering) {
                if (state.velocity.y < HOVER_MAX_FALL_SPEED) {
                    state.velocity.y = HOVER_MAX_FALL_SPEED;
                }
            } else if (state.hookState !== 'PULLING') {
                if (state.velocity.y < -MAX_FALL_SPEED) {
                    state.velocity.y = -MAX_FALL_SPEED;
                }
            }

            // Keyboard movement vector
            _moveDir.set(0, 0, 0);
            if (moveForward) _moveDir.add(_camForward);
            if (moveBackward) _moveDir.sub(_camForward);
            if (moveRight) _moveDir.add(_camRight);
            if (moveLeft) _moveDir.sub(_camRight);
            if (_moveDir.lengthSq() > 0) _moveDir.normalize();

            const currentSpeed = WALK_SPEED;

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

                    if (state.isHovering) {
                        if (moveForward || moveLeft || moveRight || moveBackward) {
                            state.velocity.x += _moveDir.x * AIR_STEER_FORCE * delta;
                            state.velocity.z += _moveDir.z * AIR_STEER_FORCE * delta;
                        }
                    } else {
                        if (moveForward || moveLeft || moveRight) {
                            state.velocity.x += _moveDir.x * AIR_STEER_FORCE * delta;
                            state.velocity.z += _moveDir.z * AIR_STEER_FORCE * delta;
                        }
                        if (moveBackward) {
                            state.velocity.x -= state.velocity.x * AIR_BACK_BRAKE_COEFF * delta;
                            state.velocity.z -= state.velocity.z * AIR_BACK_BRAKE_COEFF * delta;
                        }
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
                if (state.hookState === 'PULLING') {
                    resetHook();
                }
            }

            if (!collisionZ) {
                playerObj.position.z = nextZ;
            } else {
                state.velocity.z = 0;
                if (state.hookState === 'PULLING') {
                    resetHook();
                }
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
