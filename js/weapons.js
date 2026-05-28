import * as THREE from 'three';
import { state } from './state.js';
import { SWITCH_DURATION } from './config.js';
import { broadcastLocalFire } from './multiplayer.js';

export function createAkimboGuns() {
    const buildGun = (coreColor) => {
        const gunGroup = new THREE.Group();
        const bodyGeo = new THREE.BoxGeometry(0.07, 0.11, 0.38);
        const bodyMat = new THREE.MeshStandardMaterial({ color: 0x2f3542, roughness: 0.4 });
        const body = new THREE.Mesh(bodyGeo, bodyMat);
        body.castShadow = true;
        gunGroup.add(body);

        const gripGeo = new THREE.BoxGeometry(0.05, 0.16, 0.07);
        const grip = new THREE.Mesh(gripGeo, bodyMat);
        grip.position.set(0, -0.09, 0.09);
        grip.rotation.x = Math.PI / 6;
        gunGroup.add(grip);

        const coreGeo = new THREE.BoxGeometry(0.03, 0.03, 0.36);
        const coreMat = new THREE.MeshBasicMaterial({ color: coreColor });
        const core = new THREE.Mesh(coreGeo, coreMat);
        core.position.set(0, 0.04, -0.04);
        gunGroup.add(core);
        return gunGroup;
    };

    const buildShotgun = () => {
        const shotgunGroup = new THREE.Group();
        const bodyMat = new THREE.MeshStandardMaterial({ color: 0x2f3542, roughness: 0.4 });
        const coreMat = new THREE.MeshBasicMaterial({ color: 0xffaa00 }); 
        
        const bodyGeo = new THREE.BoxGeometry(0.08, 0.12, 0.45);
        const body = new THREE.Mesh(bodyGeo, bodyMat);
        body.castShadow = true;
        shotgunGroup.add(body);
        
        const barrelGeo = new THREE.CylinderGeometry(0.02, 0.02, 0.55, 8);
        barrelGeo.rotateX(Math.PI / 2);
        
        const leftBarrel = new THREE.Mesh(barrelGeo, bodyMat);
        leftBarrel.position.set(-0.02, 0.02, -0.3);
        leftBarrel.castShadow = true;
        shotgunGroup.add(leftBarrel);
        
        const rightBarrel = new THREE.Mesh(barrelGeo, bodyMat);
        rightBarrel.position.set(0.02, 0.02, -0.3);
        rightBarrel.castShadow = true;
        shotgunGroup.add(rightBarrel);
        
        const gripGeo = new THREE.BoxGeometry(0.06, 0.12, 0.22);
        const grip = new THREE.Mesh(gripGeo, bodyMat);
        grip.position.set(0, -0.09, 0.15);
        grip.rotation.x = Math.PI / 6;
        shotgunGroup.add(grip);
        
        const pumpGeo = new THREE.BoxGeometry(0.09, 0.08, 0.25);
        const pump = new THREE.Mesh(pumpGeo, bodyMat);
        pump.position.set(0, -0.04, -0.15);
        shotgunGroup.add(pump);

        const coreGeo = new THREE.BoxGeometry(0.04, 0.04, 0.42);
        const core = new THREE.Mesh(coreGeo, coreMat);
        core.position.set(0, 0.05, -0.05);
        shotgunGroup.add(core);
        
        return shotgunGroup;
    };

    const buildAR = () => {
        const arGroup = new THREE.Group();
        const bodyMat = new THREE.MeshStandardMaterial({ color: 0x2f3542, roughness: 0.4 });
        const coreMat = new THREE.MeshBasicMaterial({ color: 0x00ff88 }); 
        
        const bodyGeo = new THREE.BoxGeometry(0.08, 0.13, 0.52);
        const body = new THREE.Mesh(bodyGeo, bodyMat);
        body.castShadow = true;
        arGroup.add(body);
        
        const barrelGeo = new THREE.CylinderGeometry(0.015, 0.015, 0.65, 8);
        barrelGeo.rotateX(Math.PI / 2);
        const barrel = new THREE.Mesh(barrelGeo, bodyMat);
        barrel.position.set(0, 0.02, -0.4);
        barrel.castShadow = true;
        arGroup.add(barrel);
        
        const gripGeo = new THREE.BoxGeometry(0.05, 0.15, 0.07);
        const grip = new THREE.Mesh(gripGeo, bodyMat);
        grip.position.set(0, -0.1, 0.12);
        grip.rotation.x = Math.PI / 6;
        arGroup.add(grip);
        
        const magGeo = new THREE.BoxGeometry(0.04, 0.18, 0.08);
        magGeo.rotateX(-Math.PI / 12);
        const mag = new THREE.Mesh(magGeo, bodyMat);
        mag.position.set(0, -0.16, -0.05);
        arGroup.add(mag);

        const coreGeo = new THREE.BoxGeometry(0.04, 0.03, 0.48);
        const core = new THREE.Mesh(coreGeo, coreMat);
        core.position.set(0, 0.05, -0.06);
        arGroup.add(core);
        
        return arGroup;
    };

    state.leftGun = buildGun(0x00aaff);
    state.leftGun.position.set(-0.32, -0.22, -0.5);
    state.camera.add(state.leftGun);

    state.rightGunContainer = new THREE.Group();
    state.rightGunContainer.position.set(0.32, -0.22, -0.5);
    state.camera.add(state.rightGunContainer);

    state.pistolMesh = buildGun(0xff0055);
    state.rightGunContainer.add(state.pistolMesh);

    state.shotgunMesh = buildShotgun();
    state.shotgunMesh.visible = false;
    state.rightGunContainer.add(state.shotgunMesh);

    state.arMesh = buildAR();
    state.arMesh.visible = false;
    state.rightGunContainer.add(state.arMesh);

    state.rightGun = state.pistolMesh;

    state.scene.add(state.camera);
}

export function fireProjectile() {
    if (!state.scene || !state.camera || !state.rightGunContainer || !state.rightGun) return;

    // Recoil Distances
    let recoilDist = 0.08;
    if (state.activeWeaponName === 'SHOTGUN') recoilDist = 0.22;
    else if (state.activeWeaponName === 'AR') recoilDist = 0.12;
    state.rightGunContainer.position.z += recoilDist;

    const fireSinglePellet = (spreadAmt) => {
        let projectile;
        const bulletColor = state.activeWeaponName === 'PISTOL' ? 0xff0055 : (state.activeWeaponName === 'SHOTGUN' ? 0xffaa00 : 0x00ff88);
        
        if (state.projectilePool.length > 0) {
            projectile = state.projectilePool.pop();
            projectile.visible = true;
            projectile.material.color.setHex(bulletColor);
        } else {
            const projGeo = new THREE.SphereGeometry(0.07, 8, 8);
            const projMat = new THREE.MeshBasicMaterial({ color: bulletColor });
            projectile = new THREE.Mesh(projGeo, projMat);
            projectile.userData = {};
        }
        state.scene.add(projectile);

        const barrelWorldPosition = new THREE.Vector3();
        state.rightGun.getWorldPosition(barrelWorldPosition);

        const camDirection = new THREE.Vector3();
        state.camera.getWorldDirection(camDirection);

        if (spreadAmt > 0) {
            const spreadVec = new THREE.Vector3(
                (Math.random() - 0.5) * spreadAmt,
                (Math.random() - 0.5) * spreadAmt,
                (Math.random() - 0.5) * spreadAmt
            );
            camDirection.add(spreadVec).normalize();
        }

        projectile.position.copy(barrelWorldPosition).addScaledVector(camDirection, 0.1);
        projectile.userData.direction = camDirection.clone();
        projectile.userData.age = 0;

        state.projectiles.push(projectile);
    };

    if (state.activeWeaponName === 'PISTOL') {
        state.fireCooldown = 0.1;
        fireSinglePellet(0.0);
    } else if (state.activeWeaponName === 'SHOTGUN') {
        state.fireCooldown = 0.6;
        for (let p = 0; p < 5; p++) {
            fireSinglePellet(0.08);
        }
    } else if (state.activeWeaponName === 'AR') {
        state.fireCooldown = 0.2;
        fireSinglePellet(0.02);
    }

    // Broadcast fire event in multiplayer
    if (state.isMultiplayer) {
        const barrelWorldPosition = new THREE.Vector3();
        state.rightGun.getWorldPosition(barrelWorldPosition);
        const camDirection = new THREE.Vector3();
        state.camera.getWorldDirection(camDirection);
        broadcastLocalFire(barrelWorldPosition, camDirection);
    }
}

export function updateWeapons(delta) {
    if (state.fireCooldown > 0) {
        state.fireCooldown -= delta;
    }

    if (state.rightGunContainer) {
        // Recoil recovery
        state.rightGunContainer.position.z += (-0.5 - state.rightGunContainer.position.z) * 15 * delta;
    }

    // Auto-trigger weapon switch cycle if desired weapon is not active
    if (state.switchState === 'IDLE' && state.activeWeaponName !== state.desiredWeaponName) {
        const weaponCycle = ['PISTOL', 'SHOTGUN', 'AR'];
        const currentIndex = weaponCycle.indexOf(state.activeWeaponName);
        const nextIndex = (currentIndex + 1) % weaponCycle.length;
        state.nextWeaponName = weaponCycle[nextIndex];
        state.switchState = 'WITHDRAWING';
        state.switchTimer = 0;
    }

    // Animate weapon switching
    if (state.switchState !== 'IDLE' && state.pistolMesh && state.shotgunMesh && state.arMesh) {
        state.switchTimer += delta;
        const t = Math.min(1.0, state.switchTimer / SWITCH_DURATION);
        
        const getWeaponMesh = (name) => {
            if (name === 'PISTOL') return state.pistolMesh;
            if (name === 'SHOTGUN') return state.shotgunMesh;
            if (name === 'AR') return state.arMesh;
            return null;
        };

        const getWeaponOffset = (name) => {
            if (name === 'PISTOL') return 0.19;
            if (name === 'SHOTGUN') return 0.22;
            if (name === 'AR') return 0.26;
            return 0.22;
        };

        const currentMesh = getWeaponMesh(state.activeWeaponName);
        const nextMesh = getWeaponMesh(state.nextWeaponName);
        const d = getWeaponOffset(state.activeWeaponName);
        
        if (state.switchState === 'WITHDRAWING') {
            const theta = t * (Math.PI / 1.7);
            currentMesh.rotation.x = theta;
            currentMesh.position.y = -d * Math.sin(Math.abs(theta));
            currentMesh.position.z = d * (Math.cos(theta) - 1);
            
            if (t >= 1.0) {
                currentMesh.visible = false;
                currentMesh.rotation.set(0, 0, 0); 
                currentMesh.position.set(0, 0, 0); 
                
                state.activeWeaponName = state.nextWeaponName;
                state.rightGun = nextMesh;
                
                const nextD = getWeaponOffset(state.activeWeaponName);
                const startTheta = -Math.PI / 1.7;
                
                nextMesh.visible = true;
                nextMesh.rotation.x = startTheta; 
                nextMesh.position.y = -nextD * Math.sin(Math.abs(startTheta));
                nextMesh.position.z = nextD * (Math.cos(startTheta) - 1);
                
                state.switchState = 'BRINGING_IN';
                state.switchTimer = 0;
            }
        } else if (state.switchState === 'BRINGING_IN') {
            const theta = -Math.PI / 1.7 * (1.0 - t);
            nextMesh.rotation.x = theta;
            nextMesh.position.y = -d * Math.sin(Math.abs(theta));
            nextMesh.position.z = d * (Math.cos(theta) - 1);
            
            if (t >= 1.0) {
                nextMesh.rotation.set(0, 0, 0);
                nextMesh.position.set(0, 0, 0);
                state.switchState = 'IDLE';
            }
        }
    }

    // --- Third Person Player Model Position & Pitch/Yaw Updates ---
    if (state.playerMesh && state.controls) {
        const playerObj = state.controls.getObject();
        state.playerMesh.position.copy(playerObj.position);
        state.playerMesh.position.y -= 1.0; 

        const camEuler = new THREE.Euler().setFromQuaternion(state.camera.quaternion, 'YXZ');
        state.playerMesh.rotation.y = camEuler.y;

        if (state.isThirdPerson) {
            // Tilts guns based on camera pitch
            if (state.leftGun) state.leftGun.rotation.x = camEuler.x;
            if (state.rightGunContainer) state.rightGunContainer.rotation.x = camEuler.x;
        } else {
            // Reset rotations in first person
            if (state.leftGun) state.leftGun.rotation.set(0, 0, 0);
            if (state.rightGunContainer) state.rightGunContainer.rotation.set(0, 0, 0);
        }
    }
}

export function createPlayerMesh() {
    const playerGroup = new THREE.Group();

    // Body: bean color (standard sci-fi blue 0x3b5998)
    const bodyMat = new THREE.MeshStandardMaterial({ 
        color: 0x3b5998, 
        roughness: 0.3,
        metalness: 0.2
    });

    // Create solid bean using Cylinder + top/bottom Spheres to ensure universal Three.js support
    const cylinderGeo = new THREE.CylinderGeometry(0.6, 0.6, 1.0, 16);
    const cylinder = new THREE.Mesh(cylinderGeo, bodyMat);
    cylinder.castShadow = true;
    cylinder.receiveShadow = true;
    playerGroup.add(cylinder);
    
    const sphereGeo = new THREE.SphereGeometry(0.6, 16, 16);
    
    const topSphere = new THREE.Mesh(sphereGeo, bodyMat);
    topSphere.position.y = 0.5;
    topSphere.castShadow = true;
    topSphere.receiveShadow = true;
    playerGroup.add(topSphere);
    
    const bottomSphere = new THREE.Mesh(sphereGeo, bodyMat);
    bottomSphere.position.y = -0.5;
    bottomSphere.castShadow = true;
    bottomSphere.receiveShadow = true;
    playerGroup.add(bottomSphere);

    // Sleek dark shiny glass visor
    const visorGeo = new THREE.BoxGeometry(0.85, 0.25, 0.45);
    const visorMat = new THREE.MeshStandardMaterial({ 
        color: 0x1e272e, 
        roughness: 0.1,
        metalness: 0.9
    });
    const visor = new THREE.Mesh(visorGeo, visorMat);
    visor.position.set(0, 0.5, -0.35);
    visor.castShadow = true;
    visor.receiveShadow = true;
    playerGroup.add(visor);

    // Glowing cyan center horizontal line inside visor
    const visorStripGeo = new THREE.BoxGeometry(0.5, 0.05, 0.47);
    const visorStripMat = new THREE.MeshBasicMaterial({ color: 0x00ffcc });
    const visorStrip = new THREE.Mesh(visorStripGeo, visorStripMat);
    visorStrip.position.set(0, 0.5, -0.36);
    playerGroup.add(visorStrip);

    state.playerMesh = playerGroup;
    state.playerMesh.visible = false;
    state.scene.add(state.playerMesh);
}

export function setThirdPerson(enabled) {
    state.isThirdPerson = enabled;
    if (enabled) {
        if (state.playerMesh) state.playerMesh.visible = true;
        // Attach guns to playerMesh
        if (state.playerMesh && state.leftGun && state.rightGunContainer) {
            state.playerMesh.add(state.leftGun);
            state.playerMesh.add(state.rightGunContainer);
            
            // Adjust gun positions relative to the bean center
            state.leftGun.position.set(-0.7, 0.0, -0.5);
            state.rightGunContainer.position.set(0.7, 0.0, -0.5);
        }
    } else {
        if (state.playerMesh) state.playerMesh.visible = false;
        // Attach guns back to camera
        if (state.camera && state.leftGun && state.rightGunContainer) {
            state.camera.add(state.leftGun);
            state.camera.add(state.rightGunContainer);
            
            // Reset gun positions for first-person view
            state.leftGun.position.set(-0.32, -0.22, -0.5);
            state.rightGunContainer.position.set(0.32, -0.22, -0.5);
        }
    }
}
