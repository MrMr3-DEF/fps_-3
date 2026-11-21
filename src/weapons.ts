import { attachPlayerAvatar, bindAvatarEffects, getPlayerAvatar } from './playerAvatar.js';
import { getHolderMuzzlePosition } from './firstPersonReload.js';
import { getKatanaAction } from './katana.js';
import { userSettings } from './settings.js';
import { characterColor } from './appearance.js';
import { isInputActive } from './inputSession.js';
import { spreadDirection } from './shotAuthority.js';
import * as THREE from 'three';
import { pulseEmptyAmmoBar } from './hud.js';
import { state, type GameState } from './state.js';
import {
    SWITCH_DURATION,
    WEAPON_STATS,
    MINIGUN_RAMP_TIME,
    MINIGUN_SHOOT_DELAY,
    MINIGUN_MIN_RPM,
    MINIGUN_MAX_RPM,
    MAX_PROJECTILES,
    BULLET_TRAVEL_DISTANCE,
    PROJECTILE_RADIUS,
    FULL_SPEED_MINIGUN_HOMING_SAMPLE_BULLETS,
    FIREARM_MAGAZINES,
    KATANA,
} from './config.js';
import { broadcastLocalFire, broadcastToAll, flashPeerMesh, sendWeaponIntent } from './weaponNetworkPort.js';
import { beginWeaponSwitch, clearHookTether } from './hookLifecycle.js';
import { isFirearm } from './weaponHandling.js';
import type { WeaponName } from './networkTypes.js';
import { spawnParticles, createLaserBeam } from './particles.js';
import { processTargetHit, processMechaHit } from './damage.js';
import { forgottenMecha, queryObstaclesAlongSegment, queryTargetsAlongSegment, shotObstructionT } from './world.js';
import type { HitTargetPacket, PlayerHitPacket } from './networkTypes.js';
import { projectileData, targetData, obstacleData } from './userDataTypes.js';
import { shouldUseThirdPersonView } from './thirdPersonCamera.js';
import { triggerMuzzleFlash, updateMuzzleFlash } from './muzzleFlash.js';
import { flashHitmarker } from './hitmarker.js';
import { segmentPlayerHitboxHitT, PLAYER_BODY_CAMERA_OFFSET } from './playerHitbox.js';
import { segmentGroundHitT } from './gameplayMath.js';
import {
    getProjectileHomingTarget,
    isHomingTargetInRange,
    PROJECTILE_HOMING_START_FRACTION,
    resolveProjectileHomingTarget,
    toHomingTargetPacket,
    type ProjectileHomingTarget,
} from './projectileHoming.js';
import { beginProjectileTrail } from './projectileTrails.js';

const INSPECT_DURATION = 3.8;

export const SHARED_PROJECTILE_GEO = new THREE.SphereGeometry(PROJECTILE_RADIUS, 8, 8);

// Scratch values reused by firing, third-person alignment and hitscan checks.
const _camEuler = new THREE.Euler();
const _visualMuzzle = new THREE.Vector3();
const _barrelPos = new THREE.Vector3();
const _eyePosition = new THREE.Vector3();
const _pelletDirection = new THREE.Vector3();
const _camDirection = new THREE.Vector3();

const _hitPoint = new THREE.Vector3();
const _rayEnd = new THREE.Vector3();
const _homingTargetPosition = new THREE.Vector3();
const _raycaster = new THREE.Raycaster();
const _targetCandidates: THREE.Group[] = [];
const _obstacleCandidates: THREE.Object3D[] = [];

// Map equipped weapon names to their event and effect handles in game state.
const WEAPON_MESH_KEYS: Record<string, keyof GameState> = {
    PISTOL: 'pistolMesh',
    SHOTGUN: 'shotgunMesh',
    AR: 'arMesh',
    SNIPER: 'sniperMesh',
    KATANA: 'katanaMesh',
    MINIGUN: 'minigunMesh'
};

function getWeaponMesh(name: string): THREE.Object3D | null {
    const key = WEAPON_MESH_KEYS[name];
    return key ? (state[key] as THREE.Object3D | null) : null;
}

export function createAkimboGuns(): void {
    if (!state.camera || !state.scene) return;

    // The logical handles own weapon events and effects. The fitted skeleton
    // supplies the physical socket once match assets have been prepared.
    state.leftGun = new THREE.Group();
    state.rightGunContainer = new THREE.Group();
    state.leftGun.position.set(-0.32, -0.22, -0.5);
    state.rightGunContainer.position.set(0.32, -0.22, -0.5);
    state.leftGun.visible = state.rightGunContainer.visible = false;
    state.camera.add(state.leftGun, state.rightGunContainer);

    state.pistolMesh = new THREE.Group();
    state.shotgunMesh = new THREE.Group();
    state.arMesh = new THREE.Group();
    state.sniperMesh = new THREE.Group();
    state.minigunMesh = new THREE.Group();
    state.katanaMesh = new THREE.Group();
    for (const weapon of Object.keys(WEAPON_MESH_KEYS)) {
        const anchor = getWeaponMesh(weapon)!;
        anchor.visible = weapon === state.activeWeaponName;
        state.rightGunContainer.add(anchor);
    }
    state.rightGun = getWeaponMesh(state.activeWeaponName);
    state.scene.add(state.camera);
}

// Normal weapons spawn simulated projectiles. The sniper is hitscan so it can
// resolve occlusion immediately and draw a beam to the exact hit point.
let nextShotId = 0;
let minigunHomingDistanceSample: {
    target: ProjectileHomingTarget;
    startDistance: number;
    bulletCount: number;
} | null = null;

function isSameHomingTarget(a: ProjectileHomingTarget, b: ProjectileHomingTarget): boolean {
    return a.kind === b.kind && a.object === b.object && (
        a.kind === 'mecha' && b.kind === 'mecha' ? a.actor === b.actor && a.targetRevision === b.targetRevision :
        a.kind === 'npc' && b.kind === 'npc'
            ? a.targetIndex === b.targetIndex && a.targetRevision === b.targetRevision
            : a.kind === 'peer' && b.kind === 'peer' &&
                a.targetPeerId === b.targetPeerId && a.targetLifeId === b.targetLifeId
    );
}

function sampleHomingStartDistance(
    target: ProjectileHomingTarget | null,
    barrelPosition: THREE.Vector3,
    targetPosition: THREE.Vector3,
): number | undefined {
    if (!target) {
        minigunHomingDistanceSample = null;
        return undefined;
    }
    const batchSamples = state.activeWeaponName === 'MINIGUN' &&
        state.minigunRamp >= MINIGUN_RAMP_TIME;
    if (!batchSamples) {
        minigunHomingDistanceSample = null;
        return barrelPosition.distanceTo(targetPosition) * PROJECTILE_HOMING_START_FRACTION;
    }
    if (!minigunHomingDistanceSample ||
        !isSameHomingTarget(minigunHomingDistanceSample.target, target) ||
        minigunHomingDistanceSample.bulletCount >= FULL_SPEED_MINIGUN_HOMING_SAMPLE_BULLETS) {
        minigunHomingDistanceSample = {
            target,
            startDistance: barrelPosition.distanceTo(targetPosition) * PROJECTILE_HOMING_START_FRACTION,
            bulletCount: 1,
        };
    } else {
        minigunHomingDistanceSample.bulletCount++;
    }
    return minigunHomingDistanceSample.startDistance;
}

export function fireProjectile(): void {
    if (forgottenMecha?.ownsLocalPilot) return;
    if (!state.scene || !state.camera || !state.rightGunContainer || !state.rightGun) return;

    if (state.activeWeaponName === 'MINIGUN' && state.minigunRamp < MINIGUN_SHOOT_DELAY) {
        return;
    }

    const stats = WEAPON_STATS[state.activeWeaponName];
    const weapon = state.activeWeaponName;
    if (!stats || !isFirearm(weapon) || !state.weaponHandling.canFire(weapon, state.weaponTime)) return;
    const rig = getPlayerAvatar(state.playerMesh)?.rig;
    if (rig) updatePlayerAvatarPose(0);
    (rig?.muzzleFor(weapon) ?? state.rightGun).getWorldPosition(_barrelPos);
    state.camera.getWorldPosition(_eyePosition);
    // A long barrel can protrude past cover even though the player's eye is
    // clear. Both shooter and host test this segment before committing a round.
    if (shotObstructionT(_eyePosition, _barrelPos, weapon === 'SNIPER' ? 0 : PROJECTILE_RADIUS) !== null ||
        !state.weaponHandling.spendShot(weapon, state.weaponTime)) return;
    if (!rig || state.isScoped || state.isThirdPersonView || !getHolderMuzzlePosition(rig, weapon, _visualMuzzle)) {
        _visualMuzzle.copy(_barrelPos);
    }
    state.camera.getWorldDirection(_camDirection);
    state.rightGun.userData.onAvatarFire?.();

    let homingTarget: ProjectileHomingTarget | null = state.isScoped && state.activeWeaponName !== 'SNIPER'
        ? getProjectileHomingTarget()
        : null;
    if (homingTarget && !resolveProjectileHomingTarget(
        homingTarget,
        state.targets,
        state.peers,
        _homingTargetPosition,
    )) homingTarget = null;

    triggerMuzzleFlash(state.rightGun);

    const shotId = ++nextShotId;
    const spreadSeed = crypto.getRandomValues(new Uint32Array(1))[0];
    if (homingTarget && !isHomingTargetInRange(homingTarget, _barrelPos, BULLET_TRAVEL_DISTANCE)) {
        homingTarget = null;
    }
    const homingTargetPacket = toHomingTargetPacket(homingTarget);
    const homingStartDistance = sampleHomingStartDistance(
        homingTarget,
        _barrelPos,
        _homingTargetPosition,
    );

    const fireSinglePellet = (spreadAmt: number, pelletIndex = 0) => {
        if (state.projectiles.length >= MAX_PROJECTILES) return;

        let projectile: THREE.Mesh;
        const bulletColor = stats.bulletColor;

        if (state.projectilePool.length > 0) {
            projectile = state.projectilePool.pop() as THREE.Mesh;
            projectile.visible = true;
            (projectile.material as THREE.MeshBasicMaterial).color.setHex(bulletColor);
        } else {
            const projMat = new THREE.MeshBasicMaterial({ color: bulletColor });
            projectile = new THREE.Mesh(SHARED_PROJECTILE_GEO, projMat);
            projectile.userData = {};
        }
        state.scene!.add(projectile);

        const direction = spreadDirection(_camDirection, spreadSeed, pelletIndex, spreadAmt, _pelletDirection);
        projectile.position.copy(_visualMuzzle);
        const data = projectileData(projectile);
        data.dx = direction.x;
        data.dy = direction.y;
        data.dz = direction.z;
        data.age = 0;
        data.distanceTraveled = 0;
        data.visualOnly = false;
        data.damage = stats.damage;
        (data.shotOrigin ??= new THREE.Vector3()).copy(_barrelPos);
        data.shotId = shotId;
        data.pelletIndex = pelletIndex;
        data.homingTarget = homingTarget ?? undefined;
        data.homingStartDistance = homingStartDistance;
        data.guidanceRemainder = 0;
        if (homingTarget) (data.guidanceTargetPosition ??= new THREE.Vector3()).copy(_homingTargetPosition);
        else data.guidanceTargetPosition = undefined;

        beginProjectileTrail(projectile, state.scene!, bulletColor);

        state.projectiles.push(projectile);
    };

    let currentFireRate = stats.fireRate;
    if (state.activeWeaponName === 'MINIGUN') {
        const t = state.minigunRamp / MINIGUN_RAMP_TIME;
        const currentRpm = MINIGUN_MIN_RPM + (MINIGUN_MAX_RPM - MINIGUN_MIN_RPM) * t;
        currentFireRate = 60.0 / currentRpm;
    }
    state.fireCooldown = currentFireRate;

    if (state.activeWeaponName === 'SNIPER') {
        const barrelWorldPosition = _barrelPos;
        const camDirection = _camDirection;

        _raycaster.set(barrelWorldPosition, camDirection);
        _raycaster.far = BULLET_TRAVEL_DISTANCE;
        (_raycaster as any).camera = state.camera;

        _rayEnd.copy(barrelWorldPosition).addScaledVector(camDirection, _raycaster.far);
        const obstacleCandidates = queryObstaclesAlongSegment(
            barrelWorldPosition.x,
            barrelWorldPosition.z,
            _rayEnd.x,
            _rayEnd.z,
            _obstacleCandidates
        );
        const obstacleHits = _raycaster.intersectObjects(obstacleCandidates);
        const floorHit = segmentGroundHitT(barrelWorldPosition, _rayEnd);
        let closestObstacleDist = floorHit === null ? Infinity : floorHit * BULLET_TRAVEL_DISTANCE;
        if (obstacleHits.length > 0) {
            closestObstacleDist = Math.min(closestObstacleDist, obstacleHits[0].distance);
        }

        let hitTargetIndex = -1;
        let closestTargetDist = Infinity;
        let hitTargetGroup: THREE.Object3D | null = null;

        const targetCandidates = queryTargetsAlongSegment(
            barrelWorldPosition.x,
            barrelWorldPosition.z,
            _rayEnd.x,
            _rayEnd.z,
            _targetCandidates
        );
        const targetsLen = targetCandidates.length;
        for (let j = 0; j < targetsLen; j++) {
            const targetGroup = targetCandidates[j];
            const data = targetData(targetGroup);
            const bodyMesh = data.bodyMesh;
            if (bodyMesh) {
                bodyMesh.updateWorldMatrix(true, false);
                const targetHits = _raycaster.intersectObject(bodyMesh);
                if (targetHits.length > 0) {
                    const dist = targetHits[0].distance;
                    if (dist < closestTargetDist) {
                        closestTargetDist = dist;
                        hitTargetIndex = data.index;
                        hitTargetGroup = targetGroup;
                    }
                }
            }
        }

        let pvpPeerId: string | null = null;
        let closestPeerDist = Infinity;
        if (state.isMultiplayer) {
            const peerIds = state.peerIds;
            const peerIdsLen = peerIds.length;
            for (let j = 0; j < peerIdsLen; j++) {
                const peerId = peerIds[j];
                const peerData = state.peers[peerId];
                if (forgottenMecha?.ownsPilot && forgottenMecha.pilotPeerId === peerId) continue;
                if (peerData?.mesh && peerData.hp > 0) {
                    // Use the same body hit volume as bullets; labels and guns are not hitboxes.
                    const hit = segmentPlayerHitboxHitT(
                        barrelWorldPosition,
                        _rayEnd,
                        peerData.mesh.position,
                        peerData.mesh.rotation.y,
                    );
                    if (hit !== null && hit * BULLET_TRAVEL_DISTANCE < closestPeerDist) {
                        closestPeerDist = hit * BULLET_TRAVEL_DISTANCE;
                        pvpPeerId = peerId;
                    }
                }
            }
        }
        _raycaster.far = Infinity;

        const hitPoint = _hitPoint.copy(barrelWorldPosition).addScaledVector(camDirection, BULLET_TRAVEL_DISTANCE);
        let sniperFireBroadcast = false;
        const shieldT = forgottenMecha?.combat.shieldContactT(barrelWorldPosition, _rayEnd, barrelWorldPosition);
        const shieldDist = shieldT != null ? shieldT * BULLET_TRAVEL_DISTANCE : Infinity;

        if (shieldDist < closestObstacleDist && shieldDist < closestTargetDist && shieldDist < closestPeerDist) {
            hitPoint.copy(barrelWorldPosition).addScaledVector(camDirection, shieldDist);
            if (state.isMultiplayer) { broadcastLocalFire(barrelWorldPosition, camDirection, hitPoint, shotId, spreadSeed); sniperFireBroadcast = true; }
            processMechaHit(stats.damage, { origin: barrelWorldPosition, point: hitPoint, surface: 'shield', shotId, pelletIndex: 0 });
        } else if (closestObstacleDist < closestTargetDist && closestObstacleDist < closestPeerDist) {
            hitPoint.copy(barrelWorldPosition).addScaledVector(camDirection, closestObstacleDist);
            if (obstacleHits[0]?.distance === closestObstacleDist && obstacleData(obstacleHits[0].object).damageTarget === 'forgotten-mecha') {
                if (state.isMultiplayer) { broadcastLocalFire(barrelWorldPosition, camDirection, hitPoint, shotId, spreadSeed); sniperFireBroadcast = true; }
                processMechaHit(stats.damage, { origin: barrelWorldPosition, point: hitPoint, direction: camDirection, surface: 'body', shotId, pelletIndex: 0 });
            } else spawnParticles(hitPoint, 0xccd5e0, 6, 8, 0.1, 8.0);
        } else if (hitTargetIndex !== -1 && closestTargetDist < closestPeerDist && hitTargetGroup) {
            hitPoint.copy(barrelWorldPosition).addScaledVector(camDirection, closestTargetDist);
            
            if (state.isMultiplayer) {
                // Hitscan damage is resolved in this same call, so the host
                // must see the fire intent before the target-hit packet.
                broadcastLocalFire(barrelWorldPosition, camDirection, hitPoint, shotId, spreadSeed, homingTargetPacket, homingStartDistance);
                sniperFireBroadcast = true;
                if (!state.isHost) {
                    const targetInfo = targetData(hitTargetGroup as THREE.Group);
                    const packet: HitTargetPacket = {
                        type: 'hit_target', shotId, pelletIndex: 0,
                        targetIndex: hitTargetIndex,
                        ...(targetInfo.infantry ? { targetRevision: targetInfo.eliminationRevision } : {}),
                        damage: stats.damage
                    };
                    broadcastToAll(packet);
                } else {
                    processTargetHit(hitTargetIndex, stats.damage);
                }
            } else {
                processTargetHit(hitTargetIndex, stats.damage);
            }

            spawnParticles(hitPoint, targetData(hitTargetGroup as THREE.Group).color || 0xffaa00, 15, 12, 0.15, 12.0);
        } else if (pvpPeerId !== null) {
            hitPoint.copy(barrelWorldPosition).addScaledVector(camDirection, closestPeerDist);

            const peerData = state.peers[pvpPeerId];
            if (peerData) {
                flashPeerMesh(peerData, 0xff3333, 150);
            }

            broadcastLocalFire(barrelWorldPosition, camDirection, hitPoint, shotId, spreadSeed, homingTargetPacket, homingStartDistance);
            sniperFireBroadcast = true;

            const attackerName = state.username;
            const packet: PlayerHitPacket = {
                type: 'player_hit', shotId, pelletIndex: 0,
                targetPeerId: pvpPeerId,
                targetLifeId: peerData?.lifeId ?? 0,
                damage: stats.damage,
                attackerName: attackerName
            };
            broadcastToAll(packet);
            if (state.isHost) flashHitmarker(false);

            spawnParticles(hitPoint, 0x8c7ae6, 15, 12, 0.15, 12.0);
        }

        createLaserBeam(_visualMuzzle, hitPoint, stats.bulletColor);

        if (state.isMultiplayer && !sniperFireBroadcast) {
            broadcastLocalFire(barrelWorldPosition, camDirection, hitPoint, shotId, spreadSeed, homingTargetPacket, homingStartDistance);
        }

        return;
    } else if (state.activeWeaponName === 'SHOTGUN') {
        const pellets = stats.pellets || 5;
        for (let p = 0; p < pellets; p++) {
            fireSinglePellet(stats.spread, p);
        }
    } else {
        fireSinglePellet(stats.spread);
    }

    if (state.isMultiplayer) {
        broadcastLocalFire(_barrelPos, _camDirection, null, shotId, spreadSeed, homingTargetPacket, homingStartDistance);
    }
}

export function weaponHudFraction(): number {
    const weapon = state.activeWeaponName;
    return isFirearm(weapon) ? state.weaponHandling.rounds[weapon] / FIREARM_MAGAZINES[weapon].capacity :
        Math.max(0, Math.min(1, 1 - state.fireCooldown / KATANA.duration));
}

export function requestReload(): void {
    const weapon = state.activeWeaponName;
    if (!isFirearm(weapon) || !isInputActive() || state.playerHp <= 0 || state.hookState !== 'IDLE' ||
        state.switchState !== 'IDLE' || state.desiredWeaponName !== weapon || forgottenMecha?.ownsLocalPilot ||
        !state.weaponHandling.beginReload(weapon, state.weaponTime)) return;
    cancelInspect();
    if (state.isMultiplayer) sendWeaponIntent('reload', weapon);
}

let emptyTriggerReported = false;

/** Automatic fire never claims the support hand from a pre-held trigger.
 * A fresh press can queue exactly one heavy shot behind the stow/raise. */
export function requestPrimaryFire(fresh: boolean): void {
    if (!isInputActive() || state.playerHp <= 0 || forgottenMecha?.ownsLocalPilot) return;
    beginWeaponSwitch();
    const switching = state.switchState !== 'IDLE';
    const weapon = switching ? state.nextWeaponName : state.activeWeaponName;
    if (!weapon || !isFirearm(weapon)) return;
    const handling = state.weaponHandling;
    if (fresh || handling.rounds[weapon] > 0) emptyTriggerReported = false;
    if (!switching && handling.rounds[weapon] === 0 && !emptyTriggerReported) {
        emptyTriggerReported = true;
        pulseEmptyAmmoBar();
    }
    if (fresh && handling.requestHeavyFire(weapon, state.weaponTime, switching)) {
        cancelInspect();
        clearHookTether();
        if (state.isMultiplayer) sendWeaponIntent('raise', weapon);
    }
    if (!switching && state.fireCooldown <= 0 && handling.canFire(weapon, state.weaponTime)) {
        cancelInspect();
        fireProjectile();
    }
}

export function cancelWeaponHandling(): void {
    const h = state.weaponHandling, weapon = (state.nextWeaponName ?? state.activeWeaponName) as WeaponName;
    if (h.hand === 'holstered' && !h.reload && !h.pendingFire && !h.queuedReload) return;
    h.interrupt(weapon, state.weaponTime);
    clearHookTether();
    if (state.isMultiplayer) sendWeaponIntent('cancel', weapon);
}

export function updateWeapons(delta: number): void {
    state.weaponTime += delta;
    const startsSwitch = !forgottenMecha?.ownsLocalPilot && beginWeaponSwitch();
    state.weaponHandling.advance(state.weaponTime);
    state.fireCooldown = Math.max(0, state.fireCooldown - delta);
    if (forgottenMecha?.ownsLocalPilot) { state.minigunRamp = 0; return; }
    updateMuzzleFlash(state.leftGun, delta);
    updateMuzzleFlash(state.rightGun, delta);


    if (state.activeWeaponName === 'MINIGUN') {
        if (state.controls && isInputActive() && (state.isMouseDown || state.weaponHandling.pendingFire === 'MINIGUN') &&
            state.switchState === 'IDLE' && state.weaponHandling.canFire('MINIGUN', state.weaponTime)) {
            state.minigunRamp = Math.min(MINIGUN_RAMP_TIME, state.minigunRamp + delta);
        } else {
            state.minigunRamp = Math.max(0.0, state.minigunRamp - delta * 2.0);
        }
        
    } else {
        state.minigunRamp = Math.max(0.0, state.minigunRamp - delta * 2.0);
    }

    if (!startsSwitch && state.switchState !== 'IDLE') {
        // The frame that first observes a switch preceded the intent. Only
        // subsequent frames advance the two host-verifiable transition clocks.
        state.switchTimer += delta;
        if (state.switchTimer >= SWITCH_DURATION) {
            if (state.switchState === 'WITHDRAWING') {
                const next = state.nextWeaponName;
                const anchor = next ? getWeaponMesh(next) : null;
                if (next && anchor) {
                    if (state.rightGun) state.rightGun.visible = false;
                    state.activeWeaponName = next;
                    state.rightGun = anchor;
                    anchor.visible = true;
                    state.switchState = 'BRINGING_IN';
                    state.switchTimer = 0;
                }
            } else {
                state.nextWeaponName = null;
                state.switchState = 'IDLE';
                state.switchTimer = 0;
            }
        }
    }

    if (state.inspectState === 'INSPECTING') {
        state.inspectTimer += delta;
        if (state.inspectTimer >= INSPECT_DURATION) cancelInspect();
    }
}

export function cancelInspect(): void {
    state.inspectState = 'IDLE';
    state.inspectTimer = 0;
}

/** A life reset retains equipped inventory but discards unfinished presentation. */
export function resetWeaponPresentation(): void {
    emptyTriggerReported = false;
    minigunHomingDistanceSample = null;
    cancelInspect();
    state.rightGun = getWeaponMesh(state.activeWeaponName);
    for (const weapon of Object.keys(WEAPON_MESH_KEYS)) {
        const anchor = getWeaponMesh(weapon);
        if (anchor) anchor.visible = anchor === state.rightGun;
    }
}

/** Copy the accepted player pose after physics and hook translation, before
 * shoulder-camera placement. Weapon simulation/firing retains its earlier order. */
export function updatePlayerAvatarPose(delta = 0): void {
    const shell = state.playerMesh;
    if (!shell || !state.controls || !state.camera) return;
    const pilot = forgottenMecha?.ownsLocalPilot ? forgottenMecha : null;
    _camEuler.setFromQuaternion(state.camera.quaternion, 'YXZ');
    if (!pilot) {
        shell.position.copy(state.controls.getObject().position);
        shell.position.y -= PLAYER_BODY_CAMERA_OFFSET;
        shell.rotation.y = _camEuler.y;
    }
    const avatar = getPlayerAvatar(shell);
    if (!avatar) return;
    const weapon = state.activeWeaponName;
    const { hand, handStarted, handEnds, reload } = state.weaponHandling;
    const now = state.weaponTime;
    avatar.update(delta, {
        weapon, grounded: state.canJump, velocity: state.velocity, yaw: _camEuler.y, pitch: _camEuler.x,
        hover: state.isHovering, hook: state.hookState, hookMoving: state.hookIsEnemy, scoped: state.isScoped,
        lifeId: state.lifeId, alive: state.playerHp > 0,
        inspectTime: state.inspectState === 'INSPECTING' ? state.inspectTimer : undefined,
        switchState: state.switchState, switchTime: state.switchTimer, minigunRamp: state.minigunRamp,
        pilot: pilot?.pilotAvatarPhase, pilotProgress: pilot?.pilotAvatarProgress,
        katana: weapon === 'KATANA' ? getKatanaAction() : undefined, gentle: userSettings.photosensitivityMode,
        handling: {
            hand, handWeapon:state.weaponHandling.handWeapon, outgoingLight:state.weaponHandling.outgoingLight,
            handProgress: handEnds > handStarted ? (now - handStarted) / (handEnds - handStarted) : 1,
            reloadProgress: reload?.weapon === weapon ? (now - reload.started) / (reload.ends - reload.started) : undefined,
            chargeStage: isFirearm(weapon) ? state.weaponHandling.chargeStage(weapon, now) : 4,
        },
    });
}

export function createPlayerMesh(): void {
    if (!state.scene) return;
    state.playerMesh = new THREE.Group();
    state.playerMesh.visible = false;
    state.scene.add(state.playerMesh);
}

export function prepareLocalPlayerAvatar(): void {
    if (!state.playerMesh || !state.leftGun || !state.rightGunContainer) return;
    const avatar = attachPlayerAvatar(state.playerMesh, Number.parseInt(characterColor.slice(1), 16));
    if (!avatar) return;
    const weapons = Object.fromEntries(Object.keys(WEAPON_MESH_KEYS).map(name => [name, getWeaponMesh(name)!]));
    bindAvatarEffects(avatar, state.leftGun, weapons);
    syncThirdPersonPresentation();
    updatePlayerAvatarPose();
}

export function disposePlayerVisuals(): void {
    if (!state.scene && !state.camera) return;
    const disposedMaterials = new Set<THREE.Material>();

    const disposeObject = (obj: THREE.Object3D | null) => {
        if (!obj) return;
        obj.parent?.remove(obj);
        obj.traverse((child: any) => {
            if (!child.isMesh && !child.isLine) return;
            if (child.geometry && child.geometry !== SHARED_PROJECTILE_GEO) {
                child.geometry.dispose();
            }
            const materials = Array.isArray(child.material) ? child.material : [child.material];
            materials.forEach((mat: THREE.Material | undefined) => {
                if (!mat || disposedMaterials.has(mat)) return;
                disposedMaterials.add(mat);
                (mat as any).map?.dispose?.();
                mat.dispose();
            });
        });
    };

    getPlayerAvatar(state.playerMesh)?.dispose();
    disposeObject(state.leftGun);
    disposeObject(state.rightGunContainer);
    disposeObject(state.playerMesh);

    state.leftGun = null;
    state.rightGun = null;
    state.rightGunContainer = null;
    state.pistolMesh = null;
    state.shotgunMesh = null;
    state.arMesh = null;
    state.sniperMesh = null;
    state.minigunMesh = null;
    state.katanaMesh = null;
    state.playerMesh = null;
}

/** Switching camera modes changes the visible suit geometry. Both shot
 * anchors remain in the logical camera's frame throughout the match. */
export function syncThirdPersonPresentation(): void {
    const transition = forgottenMecha?.localTransition;
    const avatar = getPlayerAvatar(state.playerMesh);
    if (forgottenMecha?.ownsLocalPilot) {
        state.isThirdPersonView = transition?.locked ? transition.thirdPerson : state.isThirdPerson && !state.keyCActive && !state.rightClickActive;
        avatar?.rig.setFirstPerson(false);
        return;
    }
    const enabled = transition?.locked ? transition.thirdPerson : shouldUseThirdPersonView(state.isThirdPerson, state.keyCActive);
    if (enabled !== state.isThirdPersonView) cancelInspect();
    state.isThirdPersonView = enabled;
    if (state.playerMesh) state.playerMesh.visible = enabled || state.playerHp > 0;
    avatar?.rig.setFirstPerson(!enabled);
}

export function setThirdPerson(enabled: boolean): void {
    if (forgottenMecha?.localTransition?.locked) return;
    state.isThirdPerson = enabled;
    syncThirdPersonPresentation();
}
