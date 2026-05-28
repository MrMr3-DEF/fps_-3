import * as THREE from 'three';
import { state } from './state.js';
import {
    MAP_SIZE,
    PILLAR_COUNT,
    PILLAR_WIDTH,
    MAX_PILLAR_HEIGHT,
    MAX_ENEMY_HEIGHT,
    ENEMY_CLASSES
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

    // Spawn 6 glowing orange lava pools on the floor (24x24 planes slightly elevated to prevent z-fighting)
    const lavaGeo = new THREE.PlaneGeometry(24, 24);
    const lavaMat = new THREE.MeshStandardMaterial({ 
        color: 0xff4500, 
        emissive: 0xff2200, 
        emissiveIntensity: 1.5,
        roughness: 0.5
    });

    for (let i = 0; i < 6; i++) {
        const lavaMesh = new THREE.Mesh(lavaGeo, lavaMat);
        lavaMesh.rotation.x = -Math.PI / 2;
        
        // Position randomly on the map (avoid spawning exactly at 0,0 where the player starts)
        let posX, posZ;
        do {
            posX = (Math.random() - 0.5) * (MAP_SIZE - 80);
            posZ = (Math.random() - 0.5) * (MAP_SIZE - 80);
        } while (Math.sqrt(posX * posX + posZ * posZ) < 30); // Keep at least 30 units away from center spawn

        lavaMesh.position.set(posX, 0.02, posZ);
        state.scene.add(lavaMesh);
        state.lavaPools.push(lavaMesh);
        
        // Lava pools are also grappleable surfaces! (Which makes it even cooler and is a great momentum mechanic!)
        state.grappleSurfaces.push(lavaMesh);
    }

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
    const wallO = new THREE.Mesh(wallGeo, wallMat);
    wallO.position.set(MAP_SIZE / 2, 150, 0);
    wallO.rotation.y = -Math.PI / 2;
    state.scene.add(wallO);

    // West
    const wallW = new THREE.Mesh(wallGeo, wallMat);
    wallW.position.set(-MAP_SIZE / 2, 150, 0);
    wallW.rotation.y = Math.PI / 2;
    state.scene.add(wallW);

    // Instanced pillars for excellent draw-call performance
    const dummy = new THREE.Object3D();
    const boxGeo = new THREE.BoxGeometry(PILLAR_WIDTH, 1, PILLAR_WIDTH);
    const boxMat = new THREE.MeshStandardMaterial({ roughness: 0.3 });
    
    const pillarInstanced = new THREE.InstancedMesh(boxGeo, boxMat, PILLAR_COUNT);
    pillarInstanced.castShadow = true;
    pillarInstanced.receiveShadow = true;

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
        const obstacle = new THREE.Mesh(new THREE.BoxGeometry(PILLAR_WIDTH, height, PILLAR_WIDTH), boxMat);
        obstacle.position.copy(dummy.position);
        obstacle.userData.height = height;
        obstacle.visible = false; 
        state.scene.add(obstacle);
        state.obstacles.push(obstacle);
        state.grappleSurfaces.push(obstacle);
    }
    state.scene.add(pillarInstanced);

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
