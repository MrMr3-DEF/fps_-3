import * as THREE from 'three';
import { state } from './state.js';
import {
    PILLAR_WIDTH,
    PLAYER_RADIUS,
    MAP_SIZE,
    BASE_GRAVITY,
    JUMP_FORCE,
    WALK_SPEED,
    SPRINT_SPEED
} from './config.js';

export function checkCollision(position, feetY) {
    const halfW = PILLAR_WIDTH / 2;
    for (let i = 0; i < state.obstacles.length; i++) {
        const box = state.obstacles[i];
        const pillarHeight = box.userData.height;

        const minX = box.position.x - halfW - PLAYER_RADIUS;
        const maxX = box.position.x + halfW + PLAYER_RADIUS;
        const minZ = box.position.z - halfW - PLAYER_RADIUS;
        const maxZ = box.position.z + halfW + PLAYER_RADIUS;

        if (position.x > minX && position.x < maxX && position.z > minZ && position.z < maxZ) {
            if (feetY < pillarHeight - 0.3) {
                return true;
            }
        }
    }
    const limit = (MAP_SIZE / 2) - 1;
    if (Math.abs(position.x) > limit || Math.abs(position.z) > limit) return true;
    return false;
}

export function getGroundY(position) {
    let highestGround = 0;
    const halfW = PILLAR_WIDTH / 2;

    for (let i = 0; i < state.obstacles.length; i++) {
        const box = state.obstacles[i];
        const pillarHeight = box.userData.height;

        const minX = box.position.x - halfW - PLAYER_RADIUS;
        const maxX = box.position.x + halfW + PLAYER_RADIUS;
        const minZ = box.position.z - halfW - PLAYER_RADIUS;
        const maxZ = box.position.z + halfW + PLAYER_RADIUS;

        if (position.x > minX && position.x < maxX && position.z > minZ && position.z < maxZ) {
            if (pillarHeight > highestGround) {
                highestGround = pillarHeight;
            }
        }
    }
    return highestGround;
}

export function updatePlayerPhysics(delta) {
    if (state.controls && state.controls.isLocked === true) {
        const isMoving = state.moveForward || state.moveBackward || state.moveLeft || state.moveRight;
        const playerObj = state.controls.getObject();

        // Speedlines & sprint UI updates
        const speedlines = document.getElementById('speedlines');
        const badge = document.getElementById('sprint-badge');
        if (state.isSprinting && isMoving && state.hookState !== 'PULLING') {
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
        const camForward = new THREE.Vector3(0, 0, -1).applyQuaternion(state.camera.quaternion);
        camForward.y = 0;
        camForward.normalize();

        const camRight = new THREE.Vector3(1, 0, 0).applyQuaternion(state.camera.quaternion);
        camRight.y = 0;
        camRight.normalize();

        // Keyboard movement vector
        const moveDir = new THREE.Vector3();
        if (state.moveForward) moveDir.add(camForward);
        if (state.moveBackward) moveDir.sub(camForward);
        if (state.moveRight) moveDir.add(camRight);
        if (state.moveLeft) moveDir.sub(camRight);
        if (moveDir.lengthSq() > 0) moveDir.normalize();

        const currentSpeed = state.isSprinting ? SPRINT_SPEED : WALK_SPEED;

        if (state.canJump) {
            if (state.hookState !== 'PULLING' && isMoving) {
                const targetVelX = moveDir.x * currentSpeed;
                const targetVelZ = moveDir.z * currentSpeed;
                state.velocity.x += (targetVelX - state.velocity.x) * 10.0 * delta;
                state.velocity.z += (targetVelZ - state.velocity.z) * 10.0 * delta;
            }
        } else {
            // In-air steering & drag
            if (state.hookState !== 'PULLING') {
                const airDrag = 0.25;
                state.velocity.x -= state.velocity.x * airDrag * delta;
                state.velocity.z -= state.velocity.z * airDrag * delta;

                if (state.moveForward || state.moveLeft || state.moveRight) {
                    state.velocity.x += moveDir.x * 35.0 * delta;
                    state.velocity.z += moveDir.z * 35.0 * delta;
                }
                if (state.moveBackward) {
                    state.velocity.x -= state.velocity.x * 1.5 * delta;
                    state.velocity.z -= state.velocity.z * 1.5 * delta;
                }
            }
        }

        const nextX = playerObj.position.x + state.velocity.x * delta;
        const nextZ = playerObj.position.z + state.velocity.z * delta;
        const feetY = playerObj.position.y - 2.0;

        const collisionX = checkCollision(new THREE.Vector3(nextX, playerObj.position.y, playerObj.position.z), feetY);
        const collisionZ = checkCollision(new THREE.Vector3(playerObj.position.x, playerObj.position.y, nextZ), feetY);

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

        const currentGroundY = getGroundY(playerObj.position);
        const minCameraY = currentGroundY + 2.0; 

        if (playerObj.position.y < minCameraY) {
            state.velocity.y = 0;
            playerObj.position.y = minCameraY;
            state.canJump = true; 
        }
    }
}
