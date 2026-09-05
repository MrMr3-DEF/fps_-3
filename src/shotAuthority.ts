import * as THREE from 'three';
import { WEAPON_STATS, PROJECTILE_SPEED, PROJECTILE_LIFETIME, PROJECTILE_RADIUS } from './config.js';
import { segmentSphereHitT } from './gameplayMath.js';
import type { FirePacket, WeaponName } from './networkTypes.js';

/** Identical spread on the shooter, host and viewers. */
export function spreadDirection(base: THREE.Vector3, seed: number, pelletIndex: number, spread: number, out = new THREE.Vector3()): THREE.Vector3 {
    let value = (seed ^ Math.imul(pelletIndex + 1, 0x9e3779b9)) >>> 0;
    const next = () => { value = (Math.imul(value, 1664525) + 1013904223) >>> 0; return value / 0x100000000 - 0.5; };
    return out.copy(base).add(new THREE.Vector3(next(), next(), next()).multiplyScalar(spread)).normalize();
}
interface Shot { at: number; weapon: WeaponName; origin: THREE.Vector3; directions: THREE.Vector3[]; used: Set<number>; }
export class ShotLedger {
    private shots = new Map<number, Shot>();
    private lastFireAt = -Infinity;
    private lastShotId = -1;
    private triggerStartedAt = 0;
    private triggerHeld = false;
    updateTrigger(held: boolean, now: number): void {
        if (held && !this.triggerHeld) this.triggerStartedAt = now;
        this.triggerHeld = held;
    }
    reset(): void { this.shots.clear(); this.lastFireAt = -Infinity; this.triggerHeld = false; }
    record(packet: FirePacket, now: number, dead: boolean): boolean {
        const stats = WEAPON_STATS[packet.weapon];
        let interval = stats.fireRate * 1000;
        if (packet.weapon === 'MINIGUN') {
            if (!this.triggerHeld || now - this.triggerStartedAt < 300) return false;
            const t = Math.min(1, (now - this.triggerStartedAt) / 3000);
            interval = 60_000 / (50 + 950 * t);
        }
        // A small fixed jitter allowance cannot multiply the permitted cadence.
        if (dead || packet.shotId <= this.lastShotId || now - this.lastFireAt < interval - Math.min(15, interval * 0.1)) return false;
        this.lastShotId = packet.shotId;
        this.lastFireAt = now;
        for (const [id, shot] of this.shots) if (now - shot.at > PROJECTILE_LIFETIME * 1000 + 250) this.shots.delete(id);
        const base = new THREE.Vector3(packet.dir.x, packet.dir.y, packet.dir.z).normalize();
        const count = packet.weapon === 'SHOTGUN' ? stats.pellets! : 1;
        this.shots.set(packet.shotId, { at: now, weapon: packet.weapon,
            origin: new THREE.Vector3(packet.barrelPos.x, packet.barrelPos.y, packet.barrelPos.z),
            directions: Array.from({ length: count }, (_, i) => spreadDirection(base, packet.spreadSeed, i, stats.spread)), used: new Set() });
        return true;
    }
    consume(shotId: number, pelletIndex: number, target: THREE.Vector3, radius: number, damage: number, now: number,
        blocked: (start: THREE.Vector3, end: THREE.Vector3) => boolean): boolean {
        const shot = this.shots.get(shotId);
        if (!shot || shot.used.has(pelletIndex) || !shot.directions[pelletIndex] || now - shot.at > PROJECTILE_LIFETIME * 1000 + 250 || damage !== WEAPON_STATS[shot.weapon].damage) return false;
        const range = shot.weapon === 'SNIPER' ? 500 : Math.min(PROJECTILE_SPEED * PROJECTILE_LIFETIME, PROJECTILE_SPEED * ((now - shot.at + 100) / 1000));
        const end = shot.origin.clone().addScaledVector(shot.directions[pelletIndex], range);
        const hit = segmentSphereHitT(shot.origin, end, target, radius + PROJECTILE_RADIUS);
        if (hit === null || blocked(shot.origin, shot.origin.clone().lerp(end, hit))) return false;
        shot.used.add(pelletIndex);
        return true;
    }
}

export interface LifeState { lifeId: number; wasDead: boolean; deathReported: boolean; }
export function acceptLifeUpdate(life: LifeState, lifeId: number, dead: boolean): boolean {
    if (lifeId === life.lifeId) {
        if (life.wasDead && !dead) return false;
        life.wasDead = dead;
        return true;
    }
    if (lifeId !== life.lifeId + 1 || !life.deathReported || dead) return false;
    life.lifeId = lifeId; life.wasDead = false; life.deathReported = false;
    return true;
}
export function acceptDeath(life: LifeState, lifeId: number): boolean {
    if (life.lifeId !== lifeId || life.deathReported) return false;
    life.wasDead = true; life.deathReported = true;
    return true;
}
