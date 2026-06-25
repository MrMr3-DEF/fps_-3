import * as THREE from 'three';
import { state } from './state.js';
import { spawnRocketFlame, spawnManeuveringBeam } from './particles.js';
import { resetHook } from './grapple.js';
import { queryObstaclesNear } from './world.js';
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
    AIR_BACK_BRAKE_COEFF,
    AIR_DRAG,
    GROUND_ACCEL_RATE,
    APEX_VELOCITY_THRESHOLD,
    DESCENT_FALL_RATIO_CAP
} from './config.js';

// Scratch vectors reused by the hot physics path.
const _camForward = new THREE.Vector3();
const _camRight = new THREE.Vector3();
const _moveDir = new THREE.Vector3();
const _tempPos = new THREE.Vector3();
const _tempZ   = new THREE.Vector3();
const _boosterPos = new THREE.Vector3();
const _negCamForward = new THREE.Vector3();
const _negCamRight = new THREE.Vector3();
const _obstacleCandidates: THREE.Object3D[] = [];
const _collisionCandidates: THREE.Object3D[] = [];

// Cached HUD elements touched by movement effects.
let speedlinesEl: HTMLElement | null = null;
let sprintBadgeEl: HTMLElement | null = null;
let hoverBadgeEl: HTMLElement | null = null;

const MAX_FALL_SPEED = JUMP_FORCE * 0.88;
const MAP_LIMIT = (MAP_SIZE / 2) - 1;
const OBSTACLE_QUERY_RADIUS = 40;

interface ScanResult {
    colX: boolean;
    colZ: boolean;
    groundY: number;
}

// Single obstacle pass used by the frame loop: independent X/Z collision checks
// prevent snagging on corners while also finding the floor height under the player.
function scanObstacles(actualPos: THREE.Vector3, testPosX: THREE.Vector3, testPosZ: THREE.Vector3, feetY: number): ScanResult {
    let groundY = 0;
    let colX = false;
    let colZ = false;

    if (Math.abs(testPosX.x) > MAP_LIMIT || Math.abs(testPosX.z) > MAP_LIMIT) colX = true;
    if (Math.abs(testPosZ.x) > MAP_LIMIT || Math.abs(testPosZ.z) > MAP_LIMIT) colZ = true;

    const candidates = queryObstaclesNear(actualPos.x, actualPos.z, OBSTACLE_QUERY_RADIUS, _obstacleCandidates);
    const len = candidates.length;
    for (let i = 0; i < len; i++) {
        const box = candidates[i];
        const ph  = box.userData.height;
        const halfW = box.userData.halfW || (PILLAR_WIDTH / 2);
        const halfD = box.userData.halfD || (PILLAR_WIDTH / 2);
        const ex = halfW + PLAYER_RADIUS;
        const ez = halfD + PLAYER_RADIUS;
        const bx = box.position.x;
        const bz = box.position.z;

        if (!colX &&
            testPosX.x > bx - ex && testPosX.x < bx + ex &&
            testPosX.z > bz - ez && testPosX.z < bz + ez) {
            if (feetY < ph - 0.3) colX = true;
        }

        if (!colZ &&
            testPosZ.x > bx - ex && testPosZ.x < bx + ex &&
            testPosZ.z > bz - ez && testPosZ.z < bz + ez) {
            if (feetY < ph - 0.3) colZ = true;
        }

        if (actualPos.x > bx - ex && actualPos.x < bx + ex &&
            actualPos.z > bz - ez && actualPos.z < bz + ez) {
            if (ph > groundY) groundY = ph;
        }
    }

    return { colX, colZ, groundY };
}

export function checkCollision(position: THREE.Vector3, feetY: number): boolean {
    if (Math.abs(position.x) > MAP_LIMIT || Math.abs(position.z) > MAP_LIMIT) return true;
    const candidates = queryObstaclesNear(position.x, position.z, OBSTACLE_QUERY_RADIUS, _collisionCandidates);
    const len = candidates.length;
    for (let i = 0; i < len; i++) {
        const box = candidates[i];
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

export function getGroundY(position: THREE.Vector3): number {
    let highest = 0;
    const candidates = queryObstaclesNear(position.x, position.z, OBSTACLE_QUERY_RADIUS, _collisionCandidates);
    const len = candidates.length;
    for (let i = 0; i < len; i++) {
        const box = candidates[i];
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

export function updatePlayerPhysics(delta: number): void {
    if (state.controls) {
        const isPaused = !state.controls.isLocked && state.isPlaying;
        
        if (state.controls.isLocked || isPaused) {
            const playerObj = state.controls.getObject();
            
            // Keep gravity/collisions alive while paused, but ignore movement input.
            const moveForward = isPaused ? false : state.moveForward;
            const moveBackward = isPaused ? false : state.moveBackward;
            const moveLeft = isPaused ? false : state.moveLeft;
            const moveRight = isPaused ? false : state.moveRight;
            const isMoving = moveForward || moveBackward || moveLeft || moveRight;

            // Convert camera-relative WASD into horizontal world-space directions.
            _camForward.set(0, 0, -1).applyQuaternion(state.camera!.quaternion);
            _camForward.y = 0;
            _camForward.normalize();

            _camRight.set(1, 0, 0).applyQuaternion(state.camera!.quaternion);
            _camRight.y = 0;
            _camRight.normalize();

            if (!speedlinesEl) speedlinesEl = document.getElementById('speedlines');
            if (!sprintBadgeEl) sprintBadgeEl = document.getElementById('sprint-badge');
            if (speedlinesEl) speedlinesEl.style.opacity = '0';
            if (sprintBadgeEl) sprintBadgeEl.style.display = 'none';

            // Hover is a mid-air brake/thruster state; grappling gets priority.
            const wasHovering = state.isHovering;
            if (!state.canJump && state.isShiftDown && state.hoverFuel > 0.0 && state.hookState !== 'PULLING') {
                state.isHovering = true;
            } else {
                state.isHovering = false;
            }

            if (state.isHovering) {
                state.hoverFuel -= delta / HOVER_DRAIN_RATE;
                if (state.hoverFuel < 0) {
                    state.hoverFuel = 0;
                    state.isHovering = false;
                }

                _boosterPos.copy(playerObj.position);
                _boosterPos.y -= 1.8;
                spawnRocketFlame(_boosterPos, 2, false);

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

            const friction = (state.canJump && state.hookState !== 'PULLING') ? GROUND_FRICTION : 0.0;
            state.velocity.x -= state.velocity.x * friction * delta;
            state.velocity.z -= state.velocity.z * friction * delta;

            // Gravity is shaped for game feel: strong jumps, softer apexes,
            // faster descents, and special cases for hover/grapple states.
            let dynamicGravity = BASE_GRAVITY;
            if (state.hookState === 'PULLING' && state.hookIsEnemy) {
                dynamicGravity = 0;
            } else if (state.hookState === 'PULLING') {
                dynamicGravity = BASE_GRAVITY * GRAPPLE_GRAVITY_SCALE;
            } else if (state.isHovering && state.velocity.y <= 0) {
                dynamicGravity = BASE_GRAVITY * HOVER_GRAVITY_SCALE;
            } else if (state.velocity.y > 0) {
                if (state.velocity.y > APEX_VELOCITY_THRESHOLD) {
                    dynamicGravity = BASE_GRAVITY * 1.0;
                } else {
                    const ratio = state.velocity.y / APEX_VELOCITY_THRESHOLD;
                    const ease = ratio * ratio;
                    dynamicGravity = BASE_GRAVITY * (0.2 + 0.8 * ease);
                }
            } else {
                const fallSpeed = Math.abs(state.velocity.y);
                const fallRatio = Math.min(1.0, fallSpeed / DESCENT_FALL_RATIO_CAP);
                dynamicGravity = BASE_GRAVITY * (0.2 + 1.1 * fallRatio);
            }
            state.velocity.y -= dynamicGravity * delta;

            if (state.isHovering) {
                if (state.velocity.y < HOVER_MAX_FALL_SPEED) {
                    state.velocity.y = HOVER_MAX_FALL_SPEED;
                }
            } else if (state.hookState !== 'PULLING') {
                if (state.velocity.y < -MAX_FALL_SPEED) {
                    state.velocity.y = -MAX_FALL_SPEED;
                }
            }

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
                    state.velocity.x += (targetVelX - state.velocity.x) * GROUND_ACCEL_RATE * delta;
                    state.velocity.z += (targetVelZ - state.velocity.z) * GROUND_ACCEL_RATE * delta;
                }
            } else {
                if (state.hookState !== 'PULLING') {
                    state.velocity.x -= state.velocity.x * AIR_DRAG * delta;
                    state.velocity.z -= state.velocity.z * AIR_DRAG * delta;

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
