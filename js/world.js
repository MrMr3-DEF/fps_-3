import * as THREE from 'three';
import { state } from './state.js';
import {
    MAP_SIZE,
    PILLAR_COUNT,
    PILLAR_WIDTH,
    MAX_PILLAR_HEIGHT,
    MAX_ENEMY_HEIGHT,
    ENEMY_CLASSES,
    LAVA_POOL_HALF_SIZE
} from './config.js';

export function respawnTarget(targetGroup) {
    targetGroup.position.x = (Math.random() - 0.5) * (MAP_SIZE - 40);
    targetGroup.position.y = 3.0 + Math.random() * (MAX_ENEMY_HEIGHT - 5.0);
    targetGroup.position.z = (Math.random() - 0.5) * (MAP_SIZE - 40);

    const randClass = ENEMY_CLASSES[Math.floor(Math.random() * ENEMY_CLASSES.length)];

    targetGroup.userData.maxHp = randClass.hp;
    targetGroup.userData.hp = randClass.hp;
    targetGroup.userData.scale = randClass.scale;
    targetGroup.userData.color = randClass.color; // Keep color for explosions
    targetGroup.userData.bodyMesh.material.color.setHex(randClass.color);
    
    targetGroup.userData.bodyMesh.scale.set(randClass.scale, randClass.scale, randClass.scale);
    targetGroup.userData.healthBarGroup.position.y = 1.6 * randClass.scale;
    targetGroup.userData.healthBarGroup.scale.set(randClass.scale, randClass.scale, 1);
    
    targetGroup.userData.healthBarFg.scale.x = 1;
}

// Helper to check if a square center (sqX, sqZ) overlaps with any spawned pillar
function overlapsWithPillars(sqX, sqZ) {
    const halfPillar = PILLAR_WIDTH / 2; // 3.0
    const checkDist = LAVA_POOL_HALF_SIZE + halfPillar; // 12.8 + 3.0 = 15.8
    for (let i = 0; i < state.obstacles.length; i++) {
        const obs = state.obstacles[i];
        const dx = Math.abs(sqX - obs.position.x);
        const dz = Math.abs(sqZ - obs.position.z);
        if (dx < checkDist && dz < checkDist) {
            return true;
        }
    }
    return false;
}

export function createEnvironment() {
    if (!state.scene) return;

    // Floor Mesh Setup
    const floorGeo = new THREE.PlaneGeometry(MAP_SIZE, MAP_SIZE);
    const floorMat = new THREE.MeshLambertMaterial({ color: 0xeff3f8 });
    const floor = new THREE.Mesh(floorGeo, floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true; 
    state.scene.add(floor);
    state.grappleSurfaces.push(floor);

    // Border Walls
    const wallMat = new THREE.MeshBasicMaterial({ color: 0xe0e6ed, side: THREE.DoubleSide });
    const wallGeo = new THREE.PlaneGeometry(MAP_SIZE, 300);

    // North
    const wallN = new THREE.Mesh(wallGeo, wallMat);
    wallN.position.set(0, 150, -MAP_SIZE / 2);
    state.scene.add(wallN);

    // South
    const wallS = new THREE.Mesh(wallGeo, wallMat);
    wallS.position.set(0, 150, MAP_SIZE / 2);
    wallS.rotation.y = Math.PI;
    state.scene.add(wallS);

    // East
    const wallE = new THREE.Mesh(wallGeo, wallMat);
    wallE.position.set(MAP_SIZE / 2, 150, 0);
    wallE.rotation.y = -Math.PI / 2;
    state.scene.add(wallE);

    // West
    const wallW = new THREE.Mesh(wallGeo, wallMat);
    wallW.position.set(-MAP_SIZE / 2, 150, 0);
    wallW.rotation.y = Math.PI / 2;
    state.scene.add(wallW);

    // 1) Instanced pillars for excellent draw-call performance - SPAWNED FIRST to allow lava overlap checks
    const dummy = new THREE.Object3D();
    const boxGeo = new THREE.BoxGeometry(PILLAR_WIDTH, 1, PILLAR_WIDTH);
    const boxMat = new THREE.MeshStandardMaterial({ roughness: 0.3 });
    
    const pillarInstanced = new THREE.InstancedMesh(boxGeo, boxMat, PILLAR_COUNT);
    pillarInstanced.castShadow = true;
    pillarInstanced.receiveShadow = true;

    // Invisible collision boxes use a lightweight separate material so that
    // future changes to pillar visuals don't accidentally affect colliders.
    const colliderMat = new THREE.MeshBasicMaterial();

    for (let i = 0; i < PILLAR_COUNT; i++) {
        const height = 20.0 + Math.random() * (MAX_PILLAR_HEIGHT - 20.0);
        dummy.scale.set(1, height, 1);
        dummy.position.set(
            (Math.random() - 0.5) * (MAP_SIZE - 40),
            height / 2,
            (Math.random() - 0.5) * (MAP_SIZE - 40)
        );
        dummy.updateMatrix();
        pillarInstanced.setMatrixAt(i, dummy.matrix);

        // Keep invisible collision box
        const obstacle = new THREE.Mesh(new THREE.BoxGeometry(PILLAR_WIDTH, height, PILLAR_WIDTH), colliderMat);
        obstacle.position.copy(dummy.position);
        obstacle.userData.height = height;
        obstacle.userData.halfW = PILLAR_WIDTH / 2;
        obstacle.userData.halfD = PILLAR_WIDTH / 2;
        obstacle.userData.halfH = height / 2;
        obstacle.visible = false; 
        state.scene.add(obstacle);
        state.obstacles.push(obstacle);
        state.grappleSurfaces.push(obstacle);
    }
    state.scene.add(pillarInstanced);

    // 2) Spawn 30 glowing orange lava pool chains of 1 to 5 connected squares (completely avoiding pillars)
    const lavaGeo = new THREE.PlaneGeometry(LAVA_POOL_HALF_SIZE * 2, LAVA_POOL_HALF_SIZE * 2);
    const lavaMat = new THREE.MeshStandardMaterial({ 
        color: 0xff4500, 
        emissive: 0xff2200, 
        emissiveIntensity: 1.5,
        roughness: 0.5
    });

    for (let i = 0; i < 30; i++) {
        let chainValid = false;
        let squares = [];
        let attempts = 0;

        while (!chainValid && attempts < 100) {
            attempts++;
            squares = [];
            
            // Choose start position for the chain
            let startX, startZ;
            let posAttempts = 0;
            do {
                startX = (Math.random() - 0.5) * (MAP_SIZE - 80);
                startZ = (Math.random() - 0.5) * (MAP_SIZE - 80);
                posAttempts++;
            } while (
                (Math.sqrt(startX * startX + startZ * startZ) < 30 || overlapsWithPillars(startX, startZ)) && 
                posAttempts < 50
            );
            
            if (posAttempts >= 50) continue;
            
            squares.push({ x: startX, z: startZ });
            
            // Random amount of squares between 1 and 5
            const squareCount = 1 + Math.floor(Math.random() * 5); // 1 to 5
            
            let growthSuccess = true;
            for (let j = 1; j < squareCount; j++) {
                let spotFound = false;
                let spotAttempts = 0;
                
                while (!spotFound && spotAttempts < 30) {
                    spotAttempts++;
                    // Pick a random existing square in the chain
                    const parent = squares[Math.floor(Math.random() * squares.length)];
                    
                    // Pick random cardinal direction
                    const dir = Math.floor(Math.random() * 4);
                    let nextX = parent.x;
                    let nextZ = parent.z;
                    const step = LAVA_POOL_HALF_SIZE * 2; // adjacent placement
                    
                    if (dir === 0) nextX += step; // East
                    else if (dir === 1) nextX -= step; // West
                    else if (dir === 2) nextZ += step; // North
                    else nextZ -= step; // South
                    
                    // Check if already in the chain
                    const duplicate = squares.some(sq => Math.abs(sq.x - nextX) < 1.0 && Math.abs(sq.z - nextZ) < 1.0);
                    if (duplicate) continue;
                    
                    // Check map bounds
                    if (Math.abs(nextX) > (MAP_SIZE / 2 - LAVA_POOL_HALF_SIZE - 10) || 
                        Math.abs(nextZ) > (MAP_SIZE / 2 - LAVA_POOL_HALF_SIZE - 10)) {
                        continue;
                    }
                    
                    // Check player spawn safety
                    if (Math.sqrt(nextX * nextX + nextZ * nextZ) < 30) {
                        continue;
                    }
                    
                    // Check pillar overlap
                    if (overlapsWithPillars(nextX, nextZ)) {
                        continue;
                    }
                    
                    // Valid spot found!
                    squares.push({ x: nextX, z: nextZ });
                    spotFound = true;
                }
                
                if (!spotFound) {
                    growthSuccess = false;
                    break;
                }
            }
            
            if (growthSuccess) {
                chainValid = true;
            }
        }

        // If we successfully generated a valid chain configuration, instantiate all its squares
        if (chainValid) {
            for (const sq of squares) {
                const lavaMesh = new THREE.Mesh(lavaGeo, lavaMat);
                lavaMesh.rotation.x = -Math.PI / 2;
                lavaMesh.position.set(sq.x, 0.02, sq.z);
                state.scene.add(lavaMesh);
                state.lavaPools.push(lavaMesh);
                
                // Lava pools are also grappleable surfaces!
                state.grappleSurfaces.push(lavaMesh);
            }
        }
    }

    // Spawn 16 enemies
    for (let i = 0; i < 16; i++) {
        const targetGroup = new THREE.Group();

        const targetGeo = new THREE.BoxGeometry(2, 2, 2);
        const targetMat = new THREE.MeshStandardMaterial({ roughness: 0.2 });
        const bodyMesh = new THREE.Mesh(targetGeo, targetMat);
        bodyMesh.castShadow = true;    
        bodyMesh.receiveShadow = true;
        targetGroup.add(bodyMesh);
        targetGroup.userData.bodyMesh = bodyMesh;

        const healthBarGroup = new THREE.Group();
        healthBarGroup.position.y = 1.6;

        const barBgGeo = new THREE.PlaneGeometry(1.8, 0.15);
        const barBgMat = new THREE.MeshBasicMaterial({ color: 0x333333, side: THREE.DoubleSide });
        const barBg = new THREE.Mesh(barBgGeo, barBgMat);
        healthBarGroup.add(barBg);

        const barFgGeo = new THREE.PlaneGeometry(1.8, 0.15);
        barFgGeo.translate(0.9, 0, 0);
        const barFgMat = new THREE.MeshBasicMaterial({ color: 0x00ffcc, side: THREE.DoubleSide });
        const barFg = new THREE.Mesh(barFgGeo, barFgMat);
        barFg.position.set(-0.9, 0, 0.01);
        healthBarGroup.add(barFg);

        targetGroup.add(healthBarGroup);
        targetGroup.userData.healthBarFg = barFg;
        targetGroup.userData.healthBarBg = barBg;
        targetGroup.userData.healthBarGroup = healthBarGroup;

        respawnTarget(targetGroup);
        state.scene.add(targetGroup);
        state.targets.push(targetGroup);
    }
}

export function updateTargets(delta) {
    state.targets.forEach((target) => {
        target.userData.bodyMesh.rotation.x += 0.01;
        target.userData.bodyMesh.rotation.y += 0.015;
        if (state.camera) {
            target.userData.healthBarGroup.quaternion.copy(state.camera.quaternion);
        }
    });
}
