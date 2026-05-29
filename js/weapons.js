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

    const buildSniper = () => {
        const sniperGroup = new THREE.Group();
        const bodyMat = new THREE.MeshStandardMaterial({ color: 0x2f3542, roughness: 0.4 });
        const coreMat = new THREE.MeshBasicMaterial({ color: 0xffea00 }); // glowing bright yellow accents
        const scopeMat = new THREE.MeshStandardMaterial({ color: 0x1e272e, roughness: 0.2 });

        // 1. Pistol Base Structure
        const bodyGeo = new THREE.BoxGeometry(0.07, 0.11, 0.38);
        const body = new THREE.Mesh(bodyGeo, bodyMat);
        body.castShadow = true;
        sniperGroup.add(body);

        const gripGeo = new THREE.BoxGeometry(0.05, 0.16, 0.07);
        const grip = new THREE.Mesh(gripGeo, bodyMat);
        grip.position.set(0, -0.09, 0.09);
        grip.rotation.x = Math.PI / 6;
        sniperGroup.add(grip);

        const coreGeo = new THREE.BoxGeometry(0.03, 0.03, 0.36);
        const core = new THREE.Mesh(coreGeo, coreMat);
        core.position.set(0, 0.04, -0.04);
        sniperGroup.add(core);

        // 2. Primary round barrel: 1.5x base length (0.38 * 1.5 = 0.57)
        const primaryBarrelGeo = new THREE.CylinderGeometry(0.018, 0.018, 0.57, 8);
        primaryBarrelGeo.rotateX(Math.PI / 2);
        const primaryBarrel = new THREE.Mesh(primaryBarrelGeo, bodyMat);
        primaryBarrel.position.set(0, 0.02, -0.475);
        primaryBarrel.castShadow = true;
        sniperGroup.add(primaryBarrel);

        // 3. Smaller round barrel at the end: standard barrel length (0.38)
        const secondaryBarrelGeo = new THREE.CylinderGeometry(0.011, 0.011, 0.38, 8);
        secondaryBarrelGeo.rotateX(Math.PI / 2);
        const secondaryBarrel = new THREE.Mesh(secondaryBarrelGeo, bodyMat);
        secondaryBarrel.position.set(0, 0.02, -0.95);
        secondaryBarrel.castShadow = true;
        sniperGroup.add(secondaryBarrel);

        // 4. Stock (butt of the gun)
        const stockGeo = new THREE.BoxGeometry(0.05, 0.11, 0.32);
        const stock = new THREE.Mesh(stockGeo, bodyMat);
        stock.position.set(0, -0.04, 0.35);
        sniperGroup.add(stock);

        // Stock buttpad accent (yellow)
        const padGeo = new THREE.BoxGeometry(0.052, 0.112, 0.02);
        const pad = new THREE.Mesh(padGeo, coreMat);
        pad.position.set(0, -0.04, 0.51);
        sniperGroup.add(pad);

        // 5. Scope on top
        const scopeGeo = new THREE.CylinderGeometry(0.02, 0.02, 0.25, 8);
        scopeGeo.rotateX(Math.PI / 2);
        const scope = new THREE.Mesh(scopeGeo, scopeMat);
        scope.position.set(0, 0.09, -0.05);
        scope.castShadow = true;
        sniperGroup.add(scope);

        // Scope mounts
        const mountGeo = new THREE.BoxGeometry(0.015, 0.04, 0.03);
        const mount1 = new THREE.Mesh(mountGeo, bodyMat);
        mount1.position.set(0, 0.065, 0.03);
        sniperGroup.add(mount1);
        const mount2 = new THREE.Mesh(mountGeo, bodyMat);
        mount2.position.set(0, 0.065, -0.13);
        sniperGroup.add(mount2);

        // Glowing scope lens (yellow)
        const lensGeo = new THREE.CylinderGeometry(0.018, 0.018, 0.01, 8);
        lensGeo.rotateX(Math.PI / 2);
        const lens = new THREE.Mesh(lensGeo, coreMat);
        lens.position.set(0, 0.09, -0.176);
        sniperGroup.add(lens);

        return sniperGroup;
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

    state.sniperMesh = buildSniper();
    state.sniperMesh.visible = false;
    state.rightGunContainer.add(state.sniperMesh);

    state.rightGun = state.pistolMesh;

    state.scene.add(state.camera);
}


export function fireProjectile() {
    if (!state.scene || !state.camera || !state.rightGunContainer || !state.rightGun) return;

    // Recoil Distances
    let recoilDist = 0.08;
    if (state.activeWeaponName === 'SHOTGUN') recoilDist = 0.22;
    else if (state.activeWeaponName === 'AR') recoilDist = 0.12;
    else if (state.activeWeaponName === 'SNIPER') recoilDist = 0.30;
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
    } else if (state.activeWeaponName === 'SNIPER') {
        state.fireCooldown = 2.0;

        const barrelWorldPosition = new THREE.Vector3();
        state.rightGun.getWorldPosition(barrelWorldPosition);

        const camDirection = new THREE.Vector3();
        state.camera.getWorldDirection(camDirection);

        // Raycasting for hitscan sniper aiming
        const raycaster = new THREE.Raycaster();
        raycaster.set(state.camera.position, camDirection);
        raycaster.camera = state.camera; // Required for raycasting against Sprites (peer name labels)

        // Intersect obstacles (pillars)
        const obstacleHits = raycaster.intersectObjects(state.obstacles);
        let closestObstacleDist = Infinity;
        if (obstacleHits.length > 0) {
            closestObstacleDist = obstacleHits[0].distance;
        }

        // Intersect targets
        let hitTargetIndex = -1;
        let closestTargetDist = Infinity;
        let hitTargetGroup = null;

        for (let j = 0; j < state.targets.length; j++) {
            const targetGroup = state.targets[j];
            const bodyMesh = targetGroup.userData.bodyMesh;
            if (bodyMesh) {
                const targetHits = raycaster.intersectObject(bodyMesh);
                if (targetHits.length > 0) {
                    const dist = targetHits[0].distance;
                    if (dist < closestTargetDist) {
                        closestTargetDist = dist;
                        hitTargetIndex = j;
                        hitTargetGroup = targetGroup;
                    }
                }
            }
        }

        // Intersect PvP remote players
        let pvpPeerId = null;
        let closestPeerDist = Infinity;
        if (state.isMultiplayer) {
            const peerIds = Object.keys(state.peers);
            for (let j = 0; j < peerIds.length; j++) {
                const peerId = peerIds[j];
                const peerData = state.peers[peerId];
                if (peerData && peerData.mesh) {
                    const peerHits = raycaster.intersectObject(peerData.mesh, true);
                    if (peerHits.length > 0) {
                        const dist = peerHits[0].distance;
                        if (dist < closestPeerDist) {
                            closestPeerDist = dist;
                            pvpPeerId = peerId;
                        }
                    }
                }
            }
        }

        // Determine hit point and what was hit
        let hitPoint = new THREE.Vector3().copy(state.camera.position).addScaledVector(camDirection, 300);

        if (closestObstacleDist < closestTargetDist && closestObstacleDist < closestPeerDist) {
            // Hit pillar/wall
            hitPoint.copy(state.camera.position).addScaledVector(camDirection, closestObstacleDist);
            import('./particles.js').then((parts) => {
                parts.spawnParticles(hitPoint, 0xccd5e0, 6, 8, 0.1, 8.0);
            });
        } else if (hitTargetIndex !== -1 && closestTargetDist < closestPeerDist) {
            // Hit enemy target authoritatively
            hitPoint.copy(state.camera.position).addScaledVector(camDirection, closestTargetDist);
            
            if (state.isMultiplayer) {
                if (!state.isHost) {
                    state.connections.forEach((conn) => {
                        if (conn.open) {
                            try {
                                conn.send({
                                    type: 'hit_target',
                                    targetIndex: hitTargetIndex,
                                    damage: 10
                                });
                            } catch (err) {
                                console.error('Error broadcasting hit_target:', err);
                            }
                        }
                    });
                } else {
                    import('./main.js').then((main) => {
                        main.processTargetHit(hitTargetIndex, 10);
                    });
                }
            } else {
                import('./main.js').then((main) => {
                    main.processTargetHit(hitTargetIndex, 10);
                });
            }

            import('./particles.js').then((parts) => {
                parts.spawnParticles(hitPoint, hitTargetGroup.userData.color || 0xffaa00, 15, 12, 0.15, 12.0);
            });
        } else if (pvpPeerId !== null) {
            // Hit remote player in PvP
            hitPoint.copy(state.camera.position).addScaledVector(camDirection, closestPeerDist);

            // Flash the hit remote player mesh locally on shooter's screen for instant hit confirmation
            const peerData = state.peers[pvpPeerId];
            if (peerData && peerData.mesh) {
                peerData.mesh.traverse((child) => {
                    if (child.isMesh && child.material && child.material.color) {
                        if (child.userData.originalColor === undefined) {
                            child.userData.originalColor = child.material.color.getHex();
                        }
                        child.material.color.setHex(0xff3333); // Bright neon-red
                    }
                });
                setTimeout(() => {
                    peerData.mesh.traverse((child) => {
                        if (child.isMesh && child.material && child.material.color && child.userData.originalColor !== undefined) {
                            child.material.color.setHex(child.userData.originalColor);
                        }
                    });
                }, 150);
            }

            state.connections.forEach((conn) => {
                if (conn.open) {
                    try {
                        conn.send({
                            type: 'player_hit',
                            targetPeerId: pvpPeerId,
                            damage: 10,
                            attackerName: document.getElementById('input-username').value.trim() || 'Gast'
                        });
                    } catch (err) {
                        console.error('Error broadcasting player_hit:', err);
                    }
                }
            });

            import('./particles.js').then((parts) => {
                parts.spawnParticles(hitPoint, 0x8c7ae6, 15, 12, 0.15, 12.0);
            });
        }

        // Draw local sniper trace trail (yellow)
        import('./particles.js').then((parts) => {
            parts.createLaserBeam(barrelWorldPosition, hitPoint, 0xffff00);
        });


        // Broadcast sniper fire to P2P network
        if (state.isMultiplayer) {
            broadcastLocalFire(barrelWorldPosition, camDirection, hitPoint);
        }
        return;
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
        const weaponCycle = ['PISTOL', 'SHOTGUN', 'AR', 'SNIPER'];
        const currentIndex = weaponCycle.indexOf(state.activeWeaponName);
        const nextIndex = (currentIndex + 1) % weaponCycle.length;
        state.nextWeaponName = weaponCycle[nextIndex];
        state.switchState = 'WITHDRAWING';
        state.switchTimer = 0;
    }

    // Animate weapon switching
    if (state.switchState !== 'IDLE' && state.pistolMesh && state.shotgunMesh && state.arMesh && state.sniperMesh) {
        state.switchTimer += delta;
        const t = Math.min(1.0, state.switchTimer / SWITCH_DURATION);

        const getWeaponMesh = (name) => {
            if (name === 'PISTOL') return state.pistolMesh;
            if (name === 'SHOTGUN') return state.shotgunMesh;
            if (name === 'AR') return state.arMesh;
            if (name === 'SNIPER') return state.sniperMesh;
            return null;
        };

        const getWeaponOffset = (name) => {
            if (name === 'PISTOL') return 0.19;
            if (name === 'SHOTGUN') return 0.22;
            if (name === 'AR') return 0.26;
            if (name === 'SNIPER') return 0.32;
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
