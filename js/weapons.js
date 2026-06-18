import * as THREE from 'three';
import { state } from './state.js';
import {
    SWITCH_DURATION,
    WEAPON_STATS,
    MINIGUN_RAMP_TIME,
    MINIGUN_MIN_RPM,
    MINIGUN_MAX_RPM
} from './config.js';
import { broadcastLocalFire, broadcastToAll, flashPeerMesh } from './multiplayer.js';
import { spawnParticles, createLaserBeam } from './particles.js';
import { processTargetHit } from './main.js';

// ---------------------------------------------------------------------------
// Inspect animation — cached vectors (avoids per-frame Vector3 allocations)
// ---------------------------------------------------------------------------
const _INSPECT_BASE_POS    = new THREE.Vector3(0.32, -0.22, -0.5);
const _INSPECT_WEAPON_POS  = new THREE.Vector3(0.12, -0.15, -0.42);
const _INSPECT_LEFT_BASE   = new THREE.Vector3(-0.32, -0.22, -0.5);
const _INSPECT_HOLSTER_POS = new THREE.Vector3(-0.32, -0.65, -0.45);

// Inspect phase boundary timestamps (seconds)
const INSPECT_PHASE1_END   = 0.6;  // Gun lifts into view
const INSPECT_PAUSE1_END   = 1.0;  // Short pause before spin
const INSPECT_PHASE2_END   = 3.2;  // Spin animation complete
const INSPECT_TOTAL        = 3.8;  // Entire animation length

// Module-level cached vectors to prevent per-frame garbage collection
const _camEuler = new THREE.Euler();
const _barrelPos = new THREE.Vector3();
const _camDirection = new THREE.Vector3();
const _spreadVec = new THREE.Vector3();
const _hitPoint = new THREE.Vector3();
const _raycaster = new THREE.Raycaster();

// ---------------------------------------------------------------------------
// Weapon helpers — O(1) object maps
// ---------------------------------------------------------------------------
const WEAPON_MESH_KEYS = {
    PISTOL: 'pistolMesh',
    SHOTGUN: 'shotgunMesh',
    AR: 'arMesh',
    SNIPER: 'sniperMesh',
    MINIGUN: 'minigunMesh'
};

function getWeaponMesh(name) {
    const key = WEAPON_MESH_KEYS[name];
    return key ? state[key] : null;
}

const WEAPON_OFFSETS = {
    PISTOL: 0.19,
    SHOTGUN: 0.22,
    AR: 0.26,
    SNIPER: 0.32,
    MINIGUN: 0.36
};

function getWeaponOffset(name) {
    return WEAPON_OFFSETS[name] ?? 0.22;
}

export const buildGun = (coreColor) => {
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
    core.position.set(0, 0.042, -0.04);
    gunGroup.add(core);
    return gunGroup;
};

// Builds standard 3D double barrel shotgun geometry with custom pump handles and glowing weapon core.
export const buildShotgun = () => {
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

export const buildAR = () => {
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
    core.position.set(0, 0.052, -0.06);
    arGroup.add(core);

    return arGroup;
};

// Builds 3D high-precision sniper rifle model featuring round muzzle brake cylinder, stock pad and optic scope.
export const buildSniper = () => {
    const sniperGroup = new THREE.Group();
    const bodyMat = new THREE.MeshStandardMaterial({ color: 0x2f3542, roughness: 0.4 });
    const coreMat = new THREE.MeshBasicMaterial({ color: 0xffea00 });
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
    core.position.set(0, 0.042, -0.04);
    sniperGroup.add(core);

    // 2. Continuous round barrel (centered on the end of the body, Y = 0, length increased by 20% to 1.14)
    const barrelGeo = new THREE.CylinderGeometry(0.027, 0.027, 1.14, 8);
    barrelGeo.rotateX(Math.PI / 2);
    const barrel = new THREE.Mesh(barrelGeo, bodyMat);
    barrel.position.set(0, 0, -0.76);
    barrel.castShadow = true;
    sniperGroup.add(barrel);

    // 3. Muzzle brake at the end of the barrel
    const brakeMat = new THREE.MeshStandardMaterial({ color: 0x1e272e, roughness: 0.5, metalness: 0.8 });
    const ventMat = new THREE.MeshBasicMaterial({ color: 0x0a0a12 });

    const brakeBodyGeo = new THREE.CylinderGeometry(0.038, 0.038, 0.14, 8);
    brakeBodyGeo.rotateX(Math.PI / 2);
    const brakeBody = new THREE.Mesh(brakeBodyGeo, brakeMat);
    brakeBody.position.set(0, 0, -1.40);
    brakeBody.castShadow = true;
    sniperGroup.add(brakeBody);

    // Side vent ports (2 on left, 2 on right)
    const ventGeo = new THREE.BoxGeometry(0.01, 0.05, 0.025);
    const ventL1 = new THREE.Mesh(ventGeo, ventMat);
    ventL1.position.set(-0.036, 0, -1.365);
    sniperGroup.add(ventL1);

    const ventL2 = new THREE.Mesh(ventGeo, ventMat);
    ventL2.position.set(-0.036, 0, -1.435);
    sniperGroup.add(ventL2);

    const ventR1 = new THREE.Mesh(ventGeo, ventMat);
    ventR1.position.set(0.036, 0, -1.365);
    sniperGroup.add(ventR1);

    const ventR2 = new THREE.Mesh(ventGeo, ventMat);
    ventR2.position.set(0.036, 0, -1.435);
    sniperGroup.add(ventR2);

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

// Builds 3D heavy minigun rotary model containing six spinning barrels wrapped in barrel rings.
export const buildMinigun = () => {
    const minigunGroup = new THREE.Group();
    const bodyMat = new THREE.MeshStandardMaterial({ color: 0x2c3e50, roughness: 0.5 });
    const barrelMat = new THREE.MeshStandardMaterial({ color: 0x1e272e, roughness: 0.3, metalness: 0.8 });
    const handleMat = new THREE.MeshStandardMaterial({ color: 0x2f3542, roughness: 0.7 });

    const Y_OFFSET = -0.06;
    const Z_OFFSET = 0.08;

    // 1. Base is a cube
    const cubeGeo = new THREE.BoxGeometry(0.18, 0.18, 0.18);
    const cube = new THREE.Mesh(cubeGeo, bodyMat);
    cube.position.set(0, Y_OFFSET, Z_OFFSET);
    cube.castShadow = true;
    minigunGroup.add(cube);

    // 2. Handle on top - Thicker uniform L-shape connecting only at the rear (+Z)
    const handleGroup = new THREE.Group();
    
    // Vertical rear support
    const s1Geo = new THREE.BoxGeometry(0.04, 0.12, 0.04);
    const s1 = new THREE.Mesh(s1Geo, handleMat);
    s1.position.set(0, Y_OFFSET + 0.09, 0.07 + Z_OFFSET);
    s1.castShadow = true;
    handleGroup.add(s1);

    // Horizontal grip bar
    const gripGeo = new THREE.CylinderGeometry(0.02, 0.02, 0.15, 8);
    gripGeo.rotateX(Math.PI / 2);
    const grip = new THREE.Mesh(gripGeo, handleMat);
    grip.position.set(0, Y_OFFSET + 0.15, -0.005 + Z_OFFSET);
    grip.castShadow = true;
    handleGroup.add(grip);

    minigunGroup.add(handleGroup);

    // 3. Barrels Group (so we can rotate it!)
    const barrelsGroup = new THREE.Group();
    barrelsGroup.position.set(0, Y_OFFSET, Z_OFFSET - 0.09);
    
    const barrelRadius = 0.07;
    const barrelLength = 0.72;
    const barrelGeo = new THREE.CylinderGeometry(0.02, 0.02, barrelLength, 8);
    barrelGeo.rotateX(Math.PI / 2);

    for (let i = 0; i < 6; i++) {
        const angle = (i * Math.PI) / 3;
        const b = new THREE.Mesh(barrelGeo, barrelMat);
        b.position.set(
            Math.cos(angle) * barrelRadius,
            Math.sin(angle) * barrelRadius,
            -barrelLength / 2
        );
        b.castShadow = true;
        barrelsGroup.add(b);
    }

    // 4. Square shaped plane (bracket) at half length from barrels
    const bracketGeo = new THREE.BoxGeometry(0.18, 0.18, 0.015);
    const bracket = new THREE.Mesh(bracketGeo, bodyMat);
    bracket.position.set(0, 0, -barrelLength / 2);
    barrelsGroup.add(bracket);

    minigunGroup.add(barrelsGroup);

    // Save barrelsGroup reference in userData so we can spin it easily during updates
    minigunGroup.userData.barrels = barrelsGroup;

    return minigunGroup;
};

export function createAkimboGuns() {
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

    state.minigunMesh = buildMinigun();
    state.minigunMesh.visible = false;
    state.rightGunContainer.add(state.minigunMesh);

    state.rightGun = state.pistolMesh;

    state.scene.add(state.camera);
}

// Triggers a raycast or projectile launch in the direction of the camera based on active weapon fire cooldown.
export function fireProjectile() {
    if (!state.scene || !state.camera || !state.rightGunContainer || !state.rightGun) return;

    const stats = WEAPON_STATS[state.activeWeaponName];
    if (!stats) return;

    // Recoil Distances
    state.rightGunContainer.position.z += stats.recoil;

    const fireSinglePellet = (spreadAmt) => {
        let projectile;
        const bulletColor = stats.bulletColor;

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

        const barrelWorldPosition = _barrelPos;
        state.rightGun.getWorldPosition(barrelWorldPosition);

        const camDirection = _camDirection;
        state.camera.getWorldDirection(camDirection);

        if (spreadAmt > 0) {
            _spreadVec.set(
                (Math.random() - 0.5) * spreadAmt,
                (Math.random() - 0.5) * spreadAmt,
                (Math.random() - 0.5) * spreadAmt
            );
            camDirection.add(_spreadVec).normalize();
        }

        projectile.position.copy(barrelWorldPosition).addScaledVector(camDirection, 0.1);
        projectile.userData.direction = camDirection.clone();
        projectile.userData.age = 0;

        state.projectiles.push(projectile);
    };

    let currentFireRate = stats.fireRate;
    if (state.activeWeaponName === 'MINIGUN') {
        const t = state.minigunRamp / MINIGUN_RAMP_TIME; // 0 to 1
        const currentRpm = MINIGUN_MIN_RPM + (MINIGUN_MAX_RPM - MINIGUN_MIN_RPM) * t;
        currentFireRate = 60.0 / currentRpm;
    }
    state.fireCooldown = currentFireRate;

    if (state.activeWeaponName === 'SNIPER') {
        const barrelWorldPosition = _barrelPos;
        state.rightGun.getWorldPosition(barrelWorldPosition);

        const camDirection = _camDirection;
        state.camera.getWorldDirection(camDirection);

        // Raycasting for hitscan sniper aiming (using pre-allocated raycaster)
        _raycaster.set(state.camera.position, camDirection);
        _raycaster.camera = state.camera;

        // Intersect obstacles (pillars)
        const obstacleHits = _raycaster.intersectObjects(state.obstacles);
        let closestObstacleDist = Infinity;
        if (obstacleHits.length > 0) {
            closestObstacleDist = obstacleHits[0].distance;
        }

        // Intersect targets
        let hitTargetIndex = -1;
        let closestTargetDist = Infinity;
        let hitTargetGroup = null;

        const targetsLen = state.targets.length;
        for (let j = 0; j < targetsLen; j++) {
            const targetGroup = state.targets[j];
            const bodyMesh = targetGroup.userData.bodyMesh;
            if (bodyMesh) {
                const targetHits = _raycaster.intersectObject(bodyMesh);
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
            const peerIdsLen = peerIds.length;
            for (let j = 0; j < peerIdsLen; j++) {
                const peerId = peerIds[j];
                const peerData = state.peers[peerId];
                if (peerData && peerData.mesh) {
                    const peerHits = _raycaster.intersectObject(peerData.mesh, true);
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
        const hitPoint = _hitPoint.copy(state.camera.position).addScaledVector(camDirection, 300);

        if (closestObstacleDist < closestTargetDist && closestObstacleDist < closestPeerDist) {
            // Hit pillar/wall
            hitPoint.copy(state.camera.position).addScaledVector(camDirection, closestObstacleDist);
            spawnParticles(hitPoint, 0xccd5e0, 6, 8, 0.1, 8.0);
        } else if (hitTargetIndex !== -1 && closestTargetDist < closestPeerDist) {
            // Hit enemy target authoritatively
            hitPoint.copy(state.camera.position).addScaledVector(camDirection, closestTargetDist);
            
            if (state.isMultiplayer) {
                if (!state.isHost) {
                    broadcastToAll({
                        type: 'hit_target',
                        targetIndex: hitTargetIndex,
                        damage: stats.damage
                    });
                } else {
                    processTargetHit(hitTargetIndex, stats.damage);
                }
            } else {
                processTargetHit(hitTargetIndex, stats.damage);
            }

            spawnParticles(hitPoint, hitTargetGroup.userData.color || 0xffaa00, 15, 12, 0.15, 12.0);
        } else if (pvpPeerId !== null) {
            // Hit remote player in PvP
            hitPoint.copy(state.camera.position).addScaledVector(camDirection, closestPeerDist);

            // Flash the hit remote player mesh locally on shooter's screen for instant hit confirmation
            const peerData = state.peers[pvpPeerId];
            if (peerData) {
                flashPeerMesh(peerData, 0xff3333, 150);
            }

            // Broadcast the hit to everyone
            broadcastToAll({
                type: 'player_hit',
                targetPeerId: pvpPeerId,
                damage: stats.damage,
                attackerName: document.getElementById('input-username').value.trim() || 'Guest'
            });

            spawnParticles(hitPoint, 0x8c7ae6, 15, 12, 0.15, 12.0);
        }

        // Draw local sniper trace trail
        createLaserBeam(barrelWorldPosition, hitPoint, stats.bulletColor);

        // Broadcast sniper fire to P2P network
        if (state.isMultiplayer) {
            broadcastLocalFire(barrelWorldPosition, camDirection, hitPoint);
        }
        return;
    } else if (state.activeWeaponName === 'SHOTGUN') {
        const pellets = stats.pellets || 5;
        for (let p = 0; p < pellets; p++) {
            fireSinglePellet(stats.spread);
        }
    } else {
        fireSinglePellet(stats.spread);
    }

    // Broadcast fire event in multiplayer
    if (state.isMultiplayer) {
        const barrelWorldPosition = _barrelPos;
        state.rightGun.getWorldPosition(barrelWorldPosition);
        const camDirection = _camDirection;
        state.camera.getWorldDirection(camDirection);
        broadcastLocalFire(barrelWorldPosition, camDirection);
    }
}

// Processes active weapon recoil, minigun rotary spin, weapon swap timers and third-person model alignments.
export function updateWeapons(delta) {
    if (state.fireCooldown > 0) {
        state.fireCooldown -= delta;
    }

    if (state.rightGunContainer) {
        // Recoil recovery
        state.rightGunContainer.position.z += (-0.5 - state.rightGunContainer.position.z) * 15 * delta;
    }

    if (state.leftGun && state.inspectState === 'IDLE' && !state.isThirdPerson) {
        // Recoil recovery for left gun (grappling gun)
        if (Math.abs(state.leftGun.position.z - (-0.5)) > 0.001) {
            state.leftGun.position.z += (-0.5 - state.leftGun.position.z) * 15 * delta;
        }
    }

    // Minigun ramp up and barrel spin animation
    if (state.activeWeaponName === 'MINIGUN') {
        if (state.controls && state.controls.isLocked && state.isMouseDown && state.switchState === 'IDLE') {
            state.minigunRamp = Math.min(MINIGUN_RAMP_TIME, state.minigunRamp + delta);
        } else {
            state.minigunRamp = Math.max(0.0, state.minigunRamp - delta * 2.0);
        }
        
        if (state.minigunMesh && state.minigunMesh.userData.barrels) {
            const spinSpeed = (state.minigunRamp / MINIGUN_RAMP_TIME) * 40.0 + (state.isMouseDown && state.controls.isLocked && state.switchState === 'IDLE' ? 5.0 : 0.0);
            state.minigunMesh.userData.barrels.rotation.z += spinSpeed * delta;
        }
    } else {
        state.minigunRamp = Math.max(0.0, state.minigunRamp - delta * 2.0);
    }

    // Auto-trigger weapon switch cycle if desired weapon is not active
    if (state.switchState === 'IDLE' && state.activeWeaponName !== state.desiredWeaponName) {
        state.nextWeaponName = state.desiredWeaponName;
        state.switchState = 'WITHDRAWING';
        state.switchTimer = 0;
    }

    // Animate weapon switching
    if (state.switchState !== 'IDLE' && state.pistolMesh && state.shotgunMesh && state.arMesh && state.sniperMesh && state.minigunMesh) {
        state.switchTimer += delta;
        const t = Math.min(1.0, state.switchTimer / SWITCH_DURATION);

        const currentMesh = getWeaponMesh(state.activeWeaponName);
        const nextMesh    = getWeaponMesh(state.nextWeaponName);
        const d           = getWeaponOffset(state.activeWeaponName);

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
        state.playerMesh.position.y -= 0.35;

        _camEuler.setFromQuaternion(state.camera.quaternion, 'YXZ');
        state.playerMesh.rotation.y = _camEuler.y;

        if (state.isThirdPerson) {
            if (state.leftGun) state.leftGun.rotation.x = _camEuler.x;
            if (state.rightGunContainer) state.rightGunContainer.rotation.x = _camEuler.x;
        } else {
            if (state.leftGun) state.leftGun.rotation.set(0, 0, 0);
            if (state.rightGunContainer) state.rightGunContainer.rotation.set(0, 0, 0);
        }
    }

    // Increment inspect timer and apply animation if inspecting
    if (state.inspectState === 'INSPECTING') {
        state.inspectTimer += delta;
        if (state.inspectTimer >= INSPECT_TOTAL) {
            state.inspectState = 'IDLE';
            state.inspectTimer = 0.0;
            if (state.rightGunContainer && !state.isThirdPerson) {
                state.rightGunContainer.position.set(0.32, -0.22, -0.5);
                state.rightGunContainer.rotation.set(0, 0, 0);
            }
            if (state.leftGun && !state.isThirdPerson) {
                state.leftGun.position.set(-0.32, -0.22, -0.5);
                state.leftGun.rotation.set(0, 0, 0);
            }
        } else if (!state.isThirdPerson) {
            const t = state.inspectTimer;
            const basePos       = _INSPECT_BASE_POS;
            const inspectPos    = _INSPECT_WEAPON_POS;
            const baseLeftPos   = _INSPECT_LEFT_BASE;
            const holsterLeftPos = _INSPECT_HOLSTER_POS;
            
            const targetRotX = 0;
            const targetRotY = 83 * Math.PI / 180;
            const targetRotZ = 0;
            const targetLeftRotX = Math.PI / 2;

            if (t < INSPECT_PHASE1_END) {
                // Phase 1: Transition in
                const r = t / INSPECT_PHASE1_END;
                const ease = 0.5 - 0.5 * Math.cos(r * Math.PI);
                
                if (state.rightGunContainer) {
                    state.rightGunContainer.position.lerpVectors(basePos, inspectPos, ease);
                    state.rightGunContainer.rotation.set(
                        targetRotX * ease,
                        targetRotY * ease,
                        targetRotZ * ease
                    );
                }

                if (state.leftGun) {
                    state.leftGun.position.lerpVectors(baseLeftPos, holsterLeftPos, ease);
                    state.leftGun.rotation.set(targetLeftRotX * ease, 0, 0);
                }
            } else if (t < INSPECT_PAUSE1_END) {
                // Phase 1 Pause
                if (state.rightGunContainer) {
                    state.rightGunContainer.position.copy(inspectPos);
                    state.rightGunContainer.rotation.set(targetRotX, targetRotY, targetRotZ);
                }
                if (state.leftGun) {
                    state.leftGun.position.copy(holsterLeftPos);
                    state.leftGun.rotation.set(targetLeftRotX, 0, 0);
                }
            } else if (t < INSPECT_PHASE2_END) {
                // Phase 2: Spin inspect around Z axis with pauses
                if (state.rightGunContainer) {
                    state.rightGunContainer.position.copy(inspectPos);
                }
                if (state.leftGun) {
                    state.leftGun.position.copy(holsterLeftPos);
                    state.leftGun.rotation.set(targetLeftRotX, 0, 0);
                }
                
                const time = t - 1.0; 
                const maxRoll = Math.PI / 2.2;
                let rollZ = 0;

                if (time < 0.4) {
                    const r = time / 0.4;
                    const ease = 0.5 - 0.5 * Math.cos(r * Math.PI);
                    rollZ = ease * maxRoll;
                } else if (time < 0.8) {
                    rollZ = maxRoll;
                } else if (time < 1.4) {
                    const r = (time - 0.8) / 0.6;
                    const ease = 0.5 - 0.5 * Math.cos(r * Math.PI);
                    rollZ = maxRoll - ease * (2 * maxRoll);
                } else if (time < 1.8) {
                    rollZ = -maxRoll;
                } else {
                    const r = (time - 1.8) / 0.4;
                    const ease = 0.5 - 0.5 * Math.cos(r * Math.PI);
                    rollZ = -maxRoll + ease * maxRoll;
                }

                if (state.rightGunContainer) {
                    state.rightGunContainer.rotation.set(targetRotX, targetRotY, rollZ);
                }
            } else {
                // Phase 3: Transition out
                const r = (t - INSPECT_PHASE2_END) / (INSPECT_TOTAL - INSPECT_PHASE2_END);
                const ease = 0.5 - 0.5 * Math.cos(r * Math.PI);

                if (state.rightGunContainer) {
                    state.rightGunContainer.position.lerpVectors(inspectPos, basePos, ease);
                    state.rightGunContainer.rotation.set(
                        targetRotX * (1.0 - ease),
                        targetRotY * (1.0 - ease),
                        targetRotZ * (1.0 - ease)
                    );
                }

                if (state.leftGun) {
                    state.leftGun.position.lerpVectors(holsterLeftPos, baseLeftPos, ease);
                    state.leftGun.rotation.set(targetLeftRotX * (1.0 - ease), 0, 0);
                }
            }
        }
    }
}

export function cancelInspect() {
    if (state.inspectState === 'INSPECTING') {
        state.inspectState = 'IDLE';
        state.inspectTimer = 0.0;
        if (state.rightGunContainer && !state.isThirdPerson) {
            state.rightGunContainer.position.set(0.32, -0.22, -0.5);
            state.rightGunContainer.rotation.set(0, 0, 0);
        }
        if (state.leftGun && !state.isThirdPerson) {
            state.leftGun.position.set(-0.32, -0.22, -0.5);
            state.leftGun.rotation.set(0, 0, 0);
        }
    }
}

// Shared factory model for player/peer beans
export function buildBeanModel(bodyColor, visorStripColor) {
    const playerGroup = new THREE.Group();

    // Body: bean color
    const bodyMat = new THREE.MeshStandardMaterial({
        color: bodyColor,
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

    // Booster body material: silver metal
    const boosterMat = new THREE.MeshStandardMaterial({
        color: 0xc0c0c0, // Silver
        roughness: 0.15,
        metalness: 0.85
    });

    // Booster Cylinder attached to the bottom of the bean
    const boosterCylinderGeo = new THREE.CylinderGeometry(0.6, 0.6, 0.4, 16);
    const boosterCylinder = new THREE.Mesh(boosterCylinderGeo, boosterMat);
    boosterCylinder.position.y = -0.7;
    boosterCylinder.castShadow = true;
    boosterCylinder.receiveShadow = true;
    playerGroup.add(boosterCylinder);

    // Booster Nozzle at the very bottom
    const nozzleGeo = new THREE.CylinderGeometry(0.4, 0.2, 0.2, 16);
    const nozzle = new THREE.Mesh(nozzleGeo, boosterMat);
    nozzle.position.y = -1.0;
    nozzle.castShadow = true;
    nozzle.receiveShadow = true;
    playerGroup.add(nozzle);

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

    // Glowing center horizontal line inside visor
    const visorStripGeo = new THREE.BoxGeometry(0.5, 0.05, 0.47);
    const visorStripMat = new THREE.MeshBasicMaterial({ color: visorStripColor });
    const visorStrip = new THREE.Mesh(visorStripGeo, visorStripMat);
    visorStrip.position.set(0, 0.5, -0.36);
    playerGroup.add(visorStrip);

    return playerGroup;
}

export function createPlayerMesh() {
    state.playerMesh = buildBeanModel(0x3b5998, 0x00ffcc);
    state.playerMesh.scale.set(1.5, 1.5, 1.5);
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
