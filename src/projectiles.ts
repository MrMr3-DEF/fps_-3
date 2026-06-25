import * as THREE from 'three';
import { state } from './state.js';
import {
    PLAYER_RADIUS,
    PROJECTILE_LIFETIME,
    PROJECTILE_SPEED,
    TARGET_HIT_RANGE_MULTIPLIER,
    WEAPON_STATS
} from './config.js';
import { processTargetHit } from './damage.js';
import { flashPeerMesh } from './multiplayer.js';
import { spawnParticles } from './particles.js';
import { queryTargetsNear } from './world.js';

const _targetCandidates: THREE.Group[] = [];

function broadcastHitTarget(targetIndex: number, damage: number): void {
    state.connections.forEach((conn) => {
        if (conn.open) {
            try {
                conn.send({
                    type: 'hit_target',
                    targetIndex,
                    damage
                });
            } catch (err) {
                console.error('Error broadcasting hit_target:', err);
            }
        }
    });
}

function broadcastPlayerHit(peerId: string, damage: number, attackerName: string): void {
    state.connections.forEach((conn) => {
        if (conn.open) {
            try {
                conn.send({
                    type: 'player_hit',
                    targetPeerId: peerId,
                    damage,
                    attackerName
                });
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
        proj.userData.age += delta;
        proj.position.x += proj.userData.dx * PROJECTILE_SPEED * delta;
        proj.position.y += proj.userData.dy * PROJECTILE_SPEED * delta;
        proj.position.z += proj.userData.dz * PROJECTILE_SPEED * delta;

        let projectileHit = false;
        const visualOnly = proj.userData.visualOnly === true;
        const damage = proj.userData.damage ?? fallbackDamage;

        if (!visualOnly) {
            const targetCandidates = queryTargetsNear(proj.position.x, proj.position.z, 14, _targetCandidates);
            const targetsLen = targetCandidates.length;
            for (let j = 0; j < targetsLen; j++) {
                const target = targetCandidates[j];
                const hitRange = TARGET_HIT_RANGE_MULTIPLIER * (target.userData.scale || 1.0);
                if (proj.position.distanceToSquared(target.position) < hitRange * hitRange) {
                    const targetIndex = target.userData.index as number;
                    if (state.isMultiplayer) {
                        if (!state.isHost) {
                            broadcastHitTarget(targetIndex, damage);
                        } else {
                            processTargetHit(targetIndex, damage);
                        }
                    } else {
                        processTargetHit(targetIndex, damage);
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

        if (projectileHit || proj.userData.age > PROJECTILE_LIFETIME) {
            retireProjectile(i, proj);
        }
    }
}
