import * as THREE from 'three';
import { state } from './state.js';
import {
    BULLET_TRAVEL_DISTANCE,
    PILLAR_WIDTH,
    PROJECTILE_LIFETIME,
    PROJECTILE_RADIUS,
    PROJECTILE_SPEED,
    TARGET_HIT_RANGE_MULTIPLIER,
    WEAPON_STATS, PROJECTILE_GUIDANCE_STEP
} from './config.js';
import { processTargetHit, processMechaHit } from './damage.js';
import { flashPeerMesh, broadcastToAll } from './weaponNetworkPort.js';
import { spawnParticles } from './particles.js';
import { forgottenMecha, queryObstaclesAlongSegment, queryTargetsNear } from './world.js';
import type { HitTargetPacket, PlayerHitPacket } from './networkTypes.js';
import { obstacleData, projectileData, targetData } from './userDataTypes.js';
import { segmentAabbHitT, segmentSphereHitT, segmentGroundHitT } from './gameplayMath.js';
import { segmentPlayerHitboxHitT } from './playerHitbox.js';
import { flashHitmarker } from './hitmarker.js';
import { canContinueHoming, homingGuidanceRadius, resolveProjectileHomingTarget } from './projectileHoming.js';
import { stepProjectileFlight } from './projectileFlight.js';
import {
    appendCurvedProjectileTrail,
    appendProjectileTrail,
    disposeProjectileTrails,
    resetProjectileTrails,
    retireProjectileTrail,
    updateProjectileTrails,
} from './projectileTrails.js';

const _targetCandidates: THREE.Group[] = [];
const _obstacleCandidates: THREE.Object3D[] = [];
const _segmentStart = new THREE.Vector3();
const _segmentEnd = new THREE.Vector3();
const _segmentMidpoint = new THREE.Vector3();
const _impactPoint = new THREE.Vector3();
const _aabbMin = new THREE.Vector3();
const _aabbMax = new THREE.Vector3();
const _currentDirection = new THREE.Vector3();
const _steeredDirection = new THREE.Vector3();
const _homingTargetPosition = new THREE.Vector3();
const _frameTargetPosition = new THREE.Vector3(), _previousTargetPosition = new THREE.Vector3();

function broadcastHitTarget(targetIndex: number, damage: number, shotId: number, pelletIndex: number): void {
    broadcastToAll({ type: 'hit_target', targetIndex, damage, shotId, pelletIndex } satisfies HitTargetPacket);
}
function broadcastPlayerHit(peerId: string, damage: number, attackerName: string, shotId: number, pelletIndex: number): void {
    broadcastToAll({ type: 'player_hit', targetPeerId: peerId, targetLifeId: state.peers[peerId]?.lifeId ?? 0, damage, attackerName, shotId, pelletIndex } satisfies PlayerHitPacket);
}

function retireProjectile(index: number, projectile: THREE.Object3D): void {
    retireProjectileTrail(projectile);
    state.scene?.remove(projectile);
    projectile.visible = false;
    state.projectilePool.push(projectile);
    state.projectiles[index] = state.projectiles[state.projectiles.length - 1];
    state.projectiles.pop();
}

export function updateProjectiles(delta: number, attackerName: string): void {
    if (!Number.isFinite(delta) || delta <= 0) return;
    updateProjectileTrails(delta);
    const peerIds = state.isMultiplayer ? state.peerIds : [];
    const fallbackDamage = WEAPON_STATS[state.activeWeaponName]?.damage ?? 1;
    for (let i = state.projectiles.length - 1; i >= 0; i--) {
        const projectile = state.projectiles[i], data = projectileData(projectile);
        data.age += delta;
        let remaining = delta + (data.guidanceRemainder ?? 0);
        data.guidanceRemainder = 0;
        if (!data.homingTarget) { advanceProjectile(i, projectile, remaining, attackerName, fallbackDamage, peerIds); continue; }
        // Fixed guidance ticks make the path independent of render-frame
        // partitioning and give host verification exactly the same integrator.
        let retired = false;
        const frameTarget = resolveProjectileHomingTarget(data.homingTarget, state.targets, state.peers, _frameTargetPosition);
        _previousTargetPosition.copy(data.guidanceTargetPosition ?? frameTarget ?? _frameTargetPosition);
        const accumulated = remaining;
        while (remaining + 1e-10 >= PROJECTILE_GUIDANCE_STEP && !retired) {
            const fraction = THREE.MathUtils.clamp((accumulated - remaining + PROJECTILE_GUIDANCE_STEP - (accumulated - delta)) / delta, 0, 1);
            const point = frameTarget ? _homingTargetPosition.lerpVectors(_previousTargetPosition, frameTarget, fraction) : null;
            retired = advanceProjectile(i, projectile, PROJECTILE_GUIDANCE_STEP, attackerName, fallbackDamage, peerIds, point);
            remaining -= PROJECTILE_GUIDANCE_STEP;
        }
        if (frameTarget && !retired) (data.guidanceTargetPosition ??= new THREE.Vector3()).copy(frameTarget);
        if (!retired) data.guidanceRemainder = Math.max(0, remaining);
    }
}

function advanceProjectile(i: number, proj: THREE.Object3D, delta: number, attackerName: string,
    fallbackDamage: number, peerIds: readonly string[], guidancePoint?: THREE.Vector3 | null): boolean {
    const peerIdsLen = peerIds.length;
    const data = projectileData(proj);

    // Treat the muzzle offset as part of the shot's range and cap the final
    // swept segment. An age-only limit can overshoot by a full render frame.
    data.distanceTraveled = Number.isFinite(data.distanceTraveled)
        ? Math.max(0, data.distanceTraveled)
        : 0;
    const remainingDistance = Math.max(0, BULLET_TRAVEL_DISTANCE - data.distanceTraveled);
    if (remainingDistance === 0 || data.age > PROJECTILE_LIFETIME) {
        retireProjectile(i, proj);
        return true;
    }
    const stepDistance = Math.min(PROJECTILE_SPEED * delta, remainingDistance);
    const reachesRangeLimit = stepDistance >= remainingDistance;

    let projectileHit = false;
    const visualOnly = data.visualOnly === true;
    const damage = data.damage ?? fallbackDamage;

    _segmentStart.copy(proj.position);
    data.shotOrigin ??= _segmentStart.clone();
    _currentDirection.set(data.dx, data.dy, data.dz).normalize();
    let homingPosition = data.homingTarget ? guidancePoint ?? resolveProjectileHomingTarget(
        data.homingTarget, state.targets, state.peers, _homingTargetPosition) : null;
    if (data.homingTarget && homingPosition && !canContinueHoming(_segmentStart, homingPosition, homingGuidanceRadius(data.homingTarget), remainingDistance)) {
        homingPosition = null;
    }
    if (data.homingTarget && !homingPosition) {
        data.homingTarget = undefined; data.homingStartDistance = undefined;
    }
    stepProjectileFlight(_segmentStart, _currentDirection, data.distanceTraveled, delta,
        homingPosition, data.homingStartDistance ?? Infinity, _segmentEnd, _steeredDirection);
    data.dx = _steeredDirection.x; data.dy = _steeredDirection.y; data.dz = _steeredDirection.z;
    const curvedTrail = _currentDirection.dot(_steeredDirection) < 1 - 1e-12;
    _segmentMidpoint.addVectors(_segmentStart, _segmentEnd).multiplyScalar(0.5);
    const travelDistance = _segmentStart.distanceTo(_segmentEnd);
    const queryRadius = travelDistance * 0.5 + 12;

    let closestHitT = segmentGroundHitT(_segmentStart, _segmentEnd, PROJECTILE_RADIUS) ?? Infinity;
    let hitObstacle: THREE.Object3D | null = null;
    let hitTarget: THREE.Group | null = null;
    let hitPeerId: string | null = null;
    let hitShield = false;

    // Always stop projectiles on terrain, including remote visual-only
    // bullets. The collider meshes are invisible but represent the same
    // pillars used by player physics and sniper raycasts.
    const obstacleCandidates = queryObstaclesAlongSegment(
        _segmentStart.x,
        _segmentStart.z,
        _segmentEnd.x,
        _segmentEnd.z,
        _obstacleCandidates,
        PROJECTILE_RADIUS,
    );
    for (let j = 0; j < obstacleCandidates.length; j++) {
        const obstacle = obstacleCandidates[j];
        const obstacleInfo = obstacleData(obstacle);
        const halfW = (obstacleInfo.halfW || PILLAR_WIDTH / 2) + PROJECTILE_RADIUS;
        const halfD = (obstacleInfo.halfD || PILLAR_WIDTH / 2) + PROJECTILE_RADIUS;
        const halfH = (obstacleInfo.halfH || obstacleInfo.height / 2) + PROJECTILE_RADIUS;
        _aabbMin.set(
            obstacle.position.x - halfW,
            obstacle.position.y - halfH,
            obstacle.position.z - halfD
        );
        _aabbMax.set(
            obstacle.position.x + halfW,
            obstacle.position.y + halfH,
            obstacle.position.z + halfD
        );
        const hitT = segmentAabbHitT(_segmentStart, _segmentEnd, _aabbMin, _aabbMax);
        if (hitT !== null && hitT < closestHitT) {
            closestHitT = hitT;
            hitObstacle = obstacle;
            hitTarget = null;
            hitPeerId = null;
        }
    }

    const shieldT = !visualOnly
        ? forgottenMecha?.combat.shieldContactT(_segmentStart, _segmentEnd, data.shotOrigin, PROJECTILE_RADIUS) : null;
    if (shieldT != null && shieldT < closestHitT) {
        closestHitT = shieldT; hitObstacle = null; hitShield = true;
    }

    if (!visualOnly) {
        const targetCandidates = queryTargetsNear(
            _segmentMidpoint.x,
            _segmentMidpoint.z,
            queryRadius,
            _targetCandidates
        );
        const targetsLen = targetCandidates.length;
        for (let j = 0; j < targetsLen; j++) {
            const target = targetCandidates[j];
            const targetInfo = targetData(target);
            const hitRange = TARGET_HIT_RANGE_MULTIPLIER * (targetInfo.scale || 1.0) + PROJECTILE_RADIUS;
            const center = data.homingTarget?.object === target && homingPosition ? homingPosition : target.position;
            const hitT = segmentSphereHitT(_segmentStart, _segmentEnd, center, hitRange);
            if (hitT !== null && hitT < closestHitT) {
                closestHitT = hitT;
                hitObstacle = null;
                hitTarget = target;
                hitPeerId = null;
                hitShield = false;
            }
        }
    }

    if (!visualOnly && state.isMultiplayer) {
        for (let j = 0; j < peerIdsLen; j++) {
            const peerId = peerIds[j];
            const peerData = state.peers[peerId];
            if (forgottenMecha?.ownsPilot && forgottenMecha.pilotPeerId === peerId) continue;
            if (peerData?.mesh && peerData.hp > 0) {
                const hitT = segmentPlayerHitboxHitT(
                    _segmentStart,
                    _segmentEnd,
                    data.homingTarget?.object === peerData.mesh && homingPosition ? homingPosition : peerData.mesh.position,
                    peerData.mesh.rotation.y,
                    PROJECTILE_RADIUS,
                );
                if (hitT !== null && hitT < closestHitT) {
                    closestHitT = hitT;
                    hitObstacle = null;
                    hitTarget = null;
                    hitPeerId = peerId;
                    hitShield = false;
                }
            }
        }
    }

    if (closestHitT !== Infinity) {
        _impactPoint.lerpVectors(_segmentStart, _segmentEnd, closestHitT);
        proj.position.copy(_impactPoint);
        data.distanceTraveled = Math.min(
            BULLET_TRAVEL_DISTANCE,
            data.distanceTraveled + travelDistance * closestHitT
        );

        if (hitTarget) {
            const targetInfo = targetData(hitTarget);
            if (state.isMultiplayer) {
                if (!state.isHost) {
                    broadcastHitTarget(targetInfo.index, damage, data.shotId!, data.pelletIndex!);
                } else {
                    processTargetHit(targetInfo.index, damage);
                }
            } else {
                processTargetHit(targetInfo.index, damage);
            }
            spawnParticles(_impactPoint, 0xffaa00, 8, 12, 0.15, 20.0);
            projectileHit = true;
        } else if (hitPeerId !== null) {
            const peerData = state.peers[hitPeerId];
            if (peerData) {
                spawnParticles(_impactPoint, 0x8c7ae6, 8, 12, 0.15, 20.0);
                flashPeerMesh(peerData, 0xff3333, 150);
                broadcastPlayerHit(hitPeerId, damage, attackerName, data.shotId!, data.pelletIndex!);
                if (state.isHost) flashHitmarker(false);
                projectileHit = true;
            }
        } else if (hitShield) {
            processMechaHit(damage, { origin: data.shotOrigin, point: _impactPoint, surface: 'shield', shotId: data.shotId, pelletIndex: data.pelletIndex });
            projectileHit = true;
        } else if (hitObstacle) {
            if (!visualOnly && obstacleData(hitObstacle).damageTarget === 'forgotten-mecha') processMechaHit(damage, { origin: data.shotOrigin, point: _impactPoint, surface: 'body', shotId: data.shotId, pelletIndex: data.pelletIndex });
            spawnParticles(_impactPoint, 0xccd5e0, 6, 8, 0.1, 8.0);
            projectileHit = true;
        } else {
            spawnParticles(_impactPoint, 0xccd5e0, 6, 8, 0.1, 8.0);
            projectileHit = true;
        }
    } else {
        proj.position.copy(_segmentEnd);
        data.distanceTraveled = Math.min(
            BULLET_TRAVEL_DISTANCE,
            data.distanceTraveled + travelDistance
        );
    }
    if (curvedTrail) {
        appendCurvedProjectileTrail(proj, _segmentStart, _currentDirection, _steeredDirection);
    } else {
        appendProjectileTrail(proj);
    }

    if (projectileHit || reachesRangeLimit || data.age > PROJECTILE_LIFETIME) {
        retireProjectile(i, proj);
        return true;
    }
    return false;
}

/** Return active projectiles to the pool when a new arena begins. */
export function resetProjectiles(): void {
    resetProjectileTrails();
    for (let i = 0; i < state.projectiles.length; i++) {
        const projectile = state.projectiles[i];
        state.scene?.remove(projectile);
        projectile.visible = false;
        state.projectilePool.push(projectile);
    }
    state.projectiles.length = 0;
}

export function disposeProjectiles(): void {
    disposeProjectileTrails();
    const disposeProjectile = (projectile: THREE.Object3D) => {
        state.scene?.remove(projectile);
        projectile.traverse((child: any) => {
            if (child.isMesh) {
                child.material?.dispose?.();
            }
        });
    };

    state.projectiles.forEach(disposeProjectile);
    state.projectilePool.forEach(disposeProjectile);
    state.projectiles.length = 0;
    state.projectilePool.length = 0;
}
