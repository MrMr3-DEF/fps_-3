import { isInputActive, touchMove } from './inputSession.js';
import * as THREE from 'three';
import { state } from './state.js';
import { resetHook } from './grapple.js';
import { queryLavaPoolsNear, queryObstaclesNear } from './world.js';
import { getLavaPitFloorY, isPointInLava, LAVA_POOL_QUERY_RADIUS } from './lavaPools.js';
import { obstacleData } from './userDataTypes.js';
import {
    PILLAR_WIDTH,
    PLAYER_RADIUS,
    PLAYER_STEP_HEIGHT,
    MAP_SIZE,
    BASE_GRAVITY,
    NORMAL_JUMP_GRAVITY,
    JUMP_FORCE,
    WALK_SPEED,
    PLAYER_HEIGHT,
    CAMERA_CEILING_CLEARANCE,
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
    DESCENT_FALL_RATIO_CAP,
    LAVA_SPEED_MULTIPLIER
} from './config.js';

// Scratch vectors reused by the hot physics path.
const _camForward = new THREE.Vector3();
const _camRight = new THREE.Vector3();
const _moveDir = new THREE.Vector3();
const _tempPos = new THREE.Vector3();
const _tempZ   = new THREE.Vector3();
const _obstacleCandidates: THREE.Object3D[] = [];
// One spatial-hash lava query per substep feeds both feet-level contact and
// the recessed-basin floor sampled after horizontal resolution.
const _lavaCandidates: THREE.Object3D[] = [];
// Candidate geometry is prepared once so the vertical support pass does not
// re-read every collider's user data and transform.
const _candidateBoxX: number[] = [];
const _candidateBoxZ: number[] = [];
const _candidateExtentX: number[] = [];
const _candidateExtentZ: number[] = [];
const _candidateTop: number[] = [];
const _candidateBottom: number[] = [];

const MAX_FALL_SPEED = JUMP_FORCE * 0.88;
const MAP_LIMIT = (MAP_SIZE / 2) - 1;
const OBSTACLE_QUERY_RADIUS = 40;

interface ScanResult {
    colX: boolean;
    colZ: boolean;
    groundY: number;
    ceilingY: number;
}

// Independent X/Z collision checks prevent snagging on corners, followed by
// floor and ceiling checks at the accepted horizontal position.
function scanObstacles(
    actualPos: THREE.Vector3,
    testPosX: THREE.Vector3,
    testPosZ: THREE.Vector3,
    feetY: number,
    lavaPools: readonly THREE.Object3D[],
): ScanResult {
    let colX = Math.abs(testPosX.x) > Math.max(MAP_LIMIT, Math.abs(actualPos.x));
    const colZAtBoundary = Math.abs(testPosZ.z) > Math.max(MAP_LIMIT, Math.abs(actualPos.z));
    // Z acceptance depends on which X position the X pass accepts, so both
    // choices are accumulated in the same candidate pass instead of re-reading
    // every obstacle from the spatial hash.
    let zBlocksFromActualX = false;
    let zBlocksFromTestX = false;

    const candidates = queryObstaclesNear(actualPos.x, actualPos.z, OBSTACLE_QUERY_RADIUS, _obstacleCandidates);
    const len = candidates.length;
    _candidateBoxX.length = 0;
    _candidateBoxZ.length = 0;
    _candidateExtentX.length = 0;
    _candidateExtentZ.length = 0;
    _candidateTop.length = 0;
    _candidateBottom.length = 0;
    const headY = actualPos.y + CAMERA_CEILING_CLEARANCE;
    for (let i = 0; i < len; i++) {
        const box = candidates[i];
        const data = obstacleData(box);
        const halfH = data.halfH || data.height / 2;
        const top = box.position.y + halfH;
        const bottom = box.position.y - halfH;
        const halfW = data.halfW || (PILLAR_WIDTH / 2);
        const halfD = data.halfD || (PILLAR_WIDTH / 2);
        const ex = halfW + PLAYER_RADIUS;
        const ez = halfD + PLAYER_RADIUS;
        const bx = box.position.x;
        const bz = box.position.z;
        const blocksHeight = feetY < top - PLAYER_STEP_HEIGHT && headY > bottom + 0.001;

        _candidateBoxX.push(bx);
        _candidateBoxZ.push(bz);
        _candidateExtentX.push(ex);
        _candidateExtentZ.push(ez);
        _candidateTop.push(top);
        _candidateBottom.push(bottom);

        if (!colX &&
            testPosX.x > bx - ex && testPosX.x < bx + ex &&
            testPosX.z > bz - ez && testPosX.z < bz + ez) {
            if (blocksHeight) colX = true;
        }

        // Test Z against whichever X is accepted: the old position when X was
        // blocked, otherwise the attempted X. Accumulating both outcomes keeps
        // the independent-axis result identical in one pass.
        if (blocksHeight && testPosZ.z > bz - ez && testPosZ.z < bz + ez) {
            if (actualPos.x > bx - ex && actualPos.x < bx + ex) zBlocksFromActualX = true;
            if (testPosX.x > bx - ex && testPosX.x < bx + ex) zBlocksFromTestX = true;
        }
    }

    const resolvedX = colX ? actualPos.x : testPosX.x;
    const colZ = colZAtBoundary || (colX ? zBlocksFromActualX : zBlocksFromTestX);

    // Resolve support at the accepted horizontal position. Sampling the old
    // position can miss a roof edge during a fast falling/grappling frame.
    const finalX = resolvedX;
    const finalZ = colZ ? actualPos.z : testPosZ.z;
    // Recessed lava basins supply the baseline floor; obstacle tops can only
    // raise support above it.
    let groundY = getLavaPitFloorY(finalX, finalZ, lavaPools);
    let ceilingY = Infinity;
    for (let i = 0; i < len; i++) {
        if (Math.abs(finalX - _candidateBoxX[i]) >= _candidateExtentX[i] ||
            Math.abs(finalZ - _candidateBoxZ[i]) >= _candidateExtentZ[i]) continue;
        const top = _candidateTop[i];
        if (top <= feetY + PLAYER_STEP_HEIGHT && top > groundY) groundY = top;
        const bottom = _candidateBottom[i];
        if (bottom >= actualPos.y - 0.001 && bottom < ceilingY) ceilingY = bottom;
    }

    return { colX, colZ, groundY, ceilingY };
}

/** Substeps bound travel to half a unit so grapple frames cannot skip pillars. */
export function updatePlayerPhysics(delta: number): void {
    if (!Number.isFinite(delta) || delta <= 0) return;
    let remaining = Math.min(delta, 0.05);
    for (let i = 0; i < 64 && remaining > 1e-8; i++) {
        if (!Number.isFinite(state.velocity.lengthSq())) state.velocity.set(0, 0, 0);
        const maxSpeed = state.velocity.length() + WALK_SPEED + BASE_GRAVITY * remaining;
        const step = Math.min(remaining, 1 / 60, 0.5 / Math.max(1, maxSpeed));
        stepPlayerPhysics(step);
        remaining -= step;
    }
}

function stepPlayerPhysics(delta: number): void {
    if (state.controls) {
        const isPaused = !isInputActive() && state.isPlaying;
        
        if (isInputActive() || isPaused) {
            const playerObj = state.controls.getObject();
            const wasGrounded = state.canJump;
            
            // Keep gravity/collisions alive while paused, but ignore movement input.
            const moveForward = isPaused ? false : state.moveForward;
            const moveBackward = isPaused ? false : state.moveBackward;
            const moveLeft = isPaused ? false : state.moveLeft;
            const moveRight = isPaused ? false : state.moveRight;
            const analogX = isPaused ? 0 : touchMove.x;
            const analogY = isPaused ? 0 : touchMove.y;
            const isMoving = moveForward || moveBackward || moveLeft || moveRight || analogX !== 0 || analogY !== 0;

            // Convert camera-relative WASD into horizontal world-space directions.
            _camRight.set(1, 0, 0).applyQuaternion(state.camera!.quaternion);
            _camRight.y = 0;
            _camRight.normalize();
            _camForward.set(_camRight.z, 0, -_camRight.x);

            // Hover is a mid-air brake/thruster state; grappling gets priority.
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

            } else {
                if (state.canJump || state.hookState === 'PULLING') {
                    state.hoverFuel += delta / HOVER_RECHARGE_RATE;
                    if (state.hoverFuel > 1.0) {
                        state.hoverFuel = 1.0;
                    }
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
            } else if (state.normalJumpActive) {
                dynamicGravity = NORMAL_JUMP_GRAVITY;
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
            const normalBallistic = state.normalJumpActive && state.hookState !== 'PULLING' && !state.isHovering;
            const initialVerticalVelocity = state.velocity.y;
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
            _moveDir.addScaledVector(_camRight, analogX).addScaledVector(_camForward, -analogY);
            if (_moveDir.lengthSq() > 1) _moveDir.normalize();

            // A single broad-phase lava query serves both the speed multiplier
            // and the basin floor used by this substep's obstacle scan.
            const lavaPools = queryLavaPoolsNear(
                playerObj.position.x,
                playerObj.position.z,
                LAVA_POOL_QUERY_RADIUS + PLAYER_RADIUS,
                _lavaCandidates,
            );
            const inLava = state.canJump &&
                isPointInLava(playerObj.position.x, playerObj.position.z, playerObj.position.y - PLAYER_HEIGHT,
                    PLAYER_RADIUS, lavaPools);
            const currentSpeed = inLava ? WALK_SPEED * LAVA_SPEED_MULTIPLIER : WALK_SPEED;

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
                        if (isMoving) {
                            state.velocity.x += _moveDir.x * AIR_STEER_FORCE * delta;
                            state.velocity.z += _moveDir.z * AIR_STEER_FORCE * delta;
                        }
                    } else {
                        if (moveForward || moveLeft || moveRight || analogY < 0 || analogX !== 0) {
                            state.velocity.x += _moveDir.x * AIR_STEER_FORCE * delta;
                            state.velocity.z += _moveDir.z * AIR_STEER_FORCE * delta;
                        }
                        if (moveBackward || analogY > 0) {
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
            const { colX: collisionX, colZ: collisionZ, groundY: currentGroundY, ceilingY } =
                scanObstacles(playerObj.position, testPosX, testPosZ, feetY, lavaPools);

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

            const verticalDisplacement = normalBallistic
                ? (initialVerticalVelocity + state.velocity.y) * 0.5 * delta
                : state.velocity.y * delta;
            playerObj.position.y += verticalDisplacement;
            const maxCameraY = ceilingY - CAMERA_CEILING_CLEARANCE;
            if (verticalDisplacement > 0 && playerObj.position.y >= maxCameraY) {
                playerObj.position.y = maxCameraY;
                state.velocity.y = 0;
                if (state.hookState === 'PULLING') resetHook();
            }

            const minCameraY = currentGroundY + PLAYER_HEIGHT; 

            // A grounded walk follows a gentle drop without leaving the floor.
            // The 0.25-grade lava banks change less than STEP_HEIGHT per frame,
            // so stepping into or out of a 0.8-unit basin needs no jump.
            const followsDescent = wasGrounded && state.velocity.y <= 0 &&
                minCameraY <= maxCameraY &&
                playerObj.position.y > minCameraY &&
                playerObj.position.y - minCameraY <= PLAYER_STEP_HEIGHT;
            if (followsDescent) {
                state.normalJumpActive = false;
                state.velocity.y = 0;
                playerObj.position.y = minCameraY;
                state.canJump = true;
            } else {
                const isGrounded = minCameraY <= maxCameraY && playerObj.position.y <= minCameraY && state.velocity.y <= 0;
                if (isGrounded) {
                    state.normalJumpActive = false;
                    state.velocity.y = 0;
                    playerObj.position.y = minCameraY;
                }
                // Grounded state must be recomputed every frame. Otherwise a player
                // who walks off a pillar keeps their previous canJump=true state.
                state.canJump = isGrounded;
            }
        }
    }
}
