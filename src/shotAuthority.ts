import * as THREE from 'three';
import { BULLET_TRAVEL_DISTANCE, WEAPON_STATS, PROJECTILE_SPEED, PROJECTILE_LIFETIME, PROJECTILE_RADIUS, MINIGUN_RAMP_TIME, MINIGUN_SHOOT_DELAY, MINIGUN_MIN_RPM, MINIGUN_MAX_RPM } from './config.js';
import { segmentSphereHitT } from './gameplayMath.js';
import { segmentPlayerHitboxHitT } from './playerHitbox.js';
import type { FirePacket, WeaponName } from './networkTypes.js';

const PROJECTILE_MUZZLE_OFFSET = 0.1;
const PROJECTILE_NETWORK_GRACE_MS = 100;
const PROJECTILE_LEDGER_GRACE_MS = 250;

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
    private triggerUpdatedAt: number | null = null;
    private triggerRampMs = 0;
    private triggerHeld = false;
    updateTrigger(held: boolean, now: number): void {
        if (this.triggerUpdatedAt !== null) {
            const elapsed = Math.max(0, now - this.triggerUpdatedAt);
            this.triggerRampMs = THREE.MathUtils.clamp(this.triggerRampMs + elapsed * (this.triggerHeld ? 1 : -2),
                0, MINIGUN_RAMP_TIME * 1000);
        }
        this.triggerUpdatedAt = now;
        this.triggerHeld = held;
    }
    reset(): void { this.shots.clear(); this.lastFireAt = -Infinity; this.triggerHeld = false; this.triggerRampMs = 0; this.triggerUpdatedAt = null; }
    record(packet: FirePacket, now: number, dead: boolean): boolean {
        const stats = WEAPON_STATS[packet.weapon];
        let interval = stats.fireRate * 1000;
        if (packet.weapon === 'MINIGUN') {
            this.updateTrigger(this.triggerHeld, now);
            if (!this.triggerHeld || this.triggerRampMs < MINIGUN_SHOOT_DELAY * 1000) return false;
            const t = this.triggerRampMs / (MINIGUN_RAMP_TIME * 1000);
            interval = 60_000 / (MINIGUN_MIN_RPM + (MINIGUN_MAX_RPM - MINIGUN_MIN_RPM) * t);
        }
        // A small fixed jitter allowance cannot multiply the permitted cadence.
        if (dead || packet.shotId <= this.lastShotId || now - this.lastFireAt < interval - Math.min(15, interval * 0.1)) return false;
        this.lastShotId = packet.shotId;
        this.lastFireAt = now;
        for (const [id, shot] of this.shots) if (now - shot.at > PROJECTILE_LIFETIME * 1000 + PROJECTILE_LEDGER_GRACE_MS) this.shots.delete(id);
        const base = new THREE.Vector3(packet.dir.x, packet.dir.y, packet.dir.z).normalize();
        const count = packet.weapon === 'SHOTGUN' ? stats.pellets! : 1;
        this.shots.set(packet.shotId, { at: now, weapon: packet.weapon,
            origin: new THREE.Vector3(packet.barrelPos.x, packet.barrelPos.y, packet.barrelPos.z),
            directions: Array.from({ length: count }, (_, i) => spreadDirection(base, packet.spreadSeed, i, stats.spread)), used: new Set() });
        return true;
    }
    private consumeIntersection(
        shotId: number,
        pelletIndex: number,
        damage: number,
        now: number,
        blocked: (start: THREE.Vector3, end: THREE.Vector3) => boolean,
        intersect: (start: THREE.Vector3, end: THREE.Vector3) => number | null,
    ): boolean {
        const shot = this.shots.get(shotId);
        if (!shot || shot.used.has(pelletIndex) || !shot.directions[pelletIndex] || now - shot.at > PROJECTILE_LIFETIME * 1000 + PROJECTILE_LEDGER_GRACE_MS || damage !== WEAPON_STATS[shot.weapon].damage) return false;
        const range = shot.weapon === 'SNIPER'
            ? BULLET_TRAVEL_DISTANCE
            : Math.min(BULLET_TRAVEL_DISTANCE, PROJECTILE_SPEED * ((now - shot.at + PROJECTILE_NETWORK_GRACE_MS) / 1000));
        const direction = shot.directions[pelletIndex];
        const start = shot.origin.clone();
        if (shot.weapon !== 'SNIPER') {
            // Simulated projectiles are born just ahead of the weapon. Begin host
            // collision/occlusion checks at that same point while preserving the
            // shared endpoint measured from the barrel.
            start.addScaledVector(direction, Math.min(PROJECTILE_MUZZLE_OFFSET, range));
        }
        const end = shot.origin.clone().addScaledVector(direction, range);
        const hit = intersect(start, end);
        if (hit === null || blocked(start, start.clone().lerp(end, hit))) return false;
        shot.used.add(pelletIndex);
        return true;
    }
    consume(shotId: number, pelletIndex: number, target: THREE.Vector3, radius: number, damage: number, now: number,
        blocked: (start: THREE.Vector3, end: THREE.Vector3) => boolean): boolean {
        return this.consumeIntersection(shotId, pelletIndex, damage, now, blocked,
            (start, end) => segmentSphereHitT(start, end, target, radius + PROJECTILE_RADIUS));
    }
    consumePlayerHitbox(shotId: number, pelletIndex: number, target: THREE.Vector3, yaw: number, damage: number, now: number,
        blocked: (start: THREE.Vector3, end: THREE.Vector3) => boolean): boolean {
        return this.consumeIntersection(shotId, pelletIndex, damage, now, blocked,
            (start, end) => segmentPlayerHitboxHitT(start, end, target, yaw, PROJECTILE_RADIUS));
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
