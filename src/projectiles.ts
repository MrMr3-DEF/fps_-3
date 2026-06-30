import * as THREE from 'three';
import { state } from './state.js';
import {
    PLAYER_RADIUS,
    PROJECTILE_LIFETIME,
    PROJECTILE_SPEED,
    MAX_PROJECTILES,
    TARGET_HIT_RANGE_MULTIPLIER,
    WEAPON_STATS
} from './config.js';
import { processTargetHit } from './damage.js';
import { flashPeerMesh } from './multiplayer.js';
import { spawnParticles } from './particles.js';
import { queryTargetsNear } from './world.js';
import type { HitTargetPacket, PlayerHitPacket } from './networkTypes.js';
import { projectileData, targetData } from './userDataTypes.js';

const _targetCandidates: THREE.Group[] = [];

export function canSpawnProjectile(extraCount = 1): boolean {
    return state.projectiles.length + extraCount <= MAX_PROJECTILES;
}

function broadcastHitTarget(targetIndex: number, damage: number): void {
    const packet: HitTargetPacket = {
        type: 'hit_target',
        targetIndex,
        damage
    };
    state.connections.forEach((conn) => {
        if (conn.open) {
            try {
                conn.send(packet);
            } catch (err) {
                console.error('Error broadcasting hit_target:', err);
            }
        }
    });
}

function broadcastPlayerHit(peerId: string, damage: number, attackerName: string): void {
    const packet: PlayerHitPacket = {
        type: 'player_hit',
        targetPeerId: peerId,
        damage,
        attackerName
    };
    state.connections.forEach((conn) => {
        if (conn.open) {
            try {
                conn.send(packet);
            } catch (err) {
                console.error('Error broadcasting player_hit:', err);
            }
        }
    });
}

function retireProjectile(index: number, projectile: THREE.Object3D): void {
    state.scene!.remove(projectile);
    projectile.visible = false;
    state.projectilePool.push(projectile);
    state.projectiles[index] = state.projectiles[state.projectiles.length - 1];
    state.projectiles.pop();
}

export function updateProjectiles(delta: number, attackerName: string): void {
    const peerIds = state.isMultiplayer ? state.peerIds : [];
    const peerIdsLen = peerIds.length;
    const fallbackDamage = WEAPON_STATS[state.activeWeaponName]?.damage ?? 1;

    for (let i = state.projectiles.length - 1; i >= 0; i--) {
        const proj = state.projectiles[i];
        const data = projectileData(proj);
        data.age += delta;
        proj.position.x += data.dx * PROJECTILE_SPEED * delta;
        proj.position.y += data.dy * PROJECTILE_SPEED * delta;
        proj.position.z += data.dz * PROJECTILE_SPEED * delta;

        let projectileHit = false;
        const visualOnly = data.visualOnly === true;
        const damage = data.damage ?? fallbackDamage;

        if (!visualOnly) {
            const targetCandidates = queryTargetsNear(proj.position.x, proj.position.z, 14, _targetCandidates);
            const targetsLen = targetCandidates.length;
            for (let j = 0; j < targetsLen; j++) {
                const target = targetCandidates[j];
                if (!target.visible) continue;
                const targetInfo = targetData(target);
                const hitRange = TARGET_HIT_RANGE_MULTIPLIER * (targetInfo.scale || 1.0);
                if (proj.position.distanceToSquared(target.position) < hitRange * hitRange) {
                    if (state.isMultiplayer) {
                        if (!state.isHost) {
                            broadcastHitTarget(targetInfo.index, damage);
                        } else {
                            processTargetHit(targetInfo.index, damage);
                        }
                    } else {
                        processTargetHit(targetInfo.index, damage);
                    }

                    projectileHit = true;
                    spawnParticles(proj.position, 0xffaa00, 8, 12, 0.15, 20.0);
                    break;
                }
            }
        }

        if (!visualOnly && !projectileHit && state.isMultiplayer) {
            for (let j = 0; j < peerIdsLen; j++) {
                const peerId = peerIds[j];
                const peerData = state.peers[peerId];
                if (peerData && peerData.mesh) {
                    if (proj.position.distanceToSquared(peerData.mesh.position) < PLAYER_RADIUS * PLAYER_RADIUS) {
                        projectileHit = true;
                        spawnParticles(proj.position, 0x8c7ae6, 8, 12, 0.15, 20.0);
                        flashPeerMesh(peerData, 0xff3333, 150);
                        broadcastPlayerHit(peerId, damage, attackerName);
                        break;
                    }
                }
            }
        }

        if (projectileHit || data.age > PROJECTILE_LIFETIME) {
            retireProjectile(i, proj);
        }
    }
}

export function disposeProjectiles(): void {
    if (!state.scene) return;

    const disposeProjectile = (projectile: THREE.Object3D) => {
        state.scene!.remove(projectile);
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
