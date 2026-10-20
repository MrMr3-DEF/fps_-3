import * as THREE from 'three';
import { BULLET_TRAVEL_DISTANCE, WEAPON_STATS, PROJECTILE_SPEED, PROJECTILE_LIFETIME, PROJECTILE_RADIUS, MINIGUN_RAMP_TIME, MINIGUN_SHOOT_DELAY, MINIGUN_MIN_RPM, MINIGUN_MAX_RPM, SWITCH_DURATION, NETWORK_TICK_MS } from './config.js';
import { segmentSphereHitT } from './gameplayMath.js';
import { segmentPlayerHitboxHitT, closestPlayerBodyPoint } from './playerHitbox.js';
import type { FirePacket, HomingTargetPacket, UpdatePacket, WeaponName } from './networkTypes.js';
import { PROJECTILE_GUIDANCE_STEP, HOMING_HISTORY_SAMPLES, HOMING_VERIFICATION_STEPS_PER_SECOND, HOMING_HIT_TOLERANCE, FULL_SPEED_MINIGUN_HOMING_SAMPLE_BULLETS } from './config.js';
import { canContinueHoming, isWithinHomingAimEnvelope } from './projectileHoming.js';
import { stepProjectileFlight, homingReplayCandidates, type HomingFireContext, type HomingFlightTarget } from './projectileFlight.js';

const PROJECTILE_MUZZLE_OFFSET = 0.1;
const PROJECTILE_NETWORK_GRACE_MS = 100;
const PROJECTILE_LEDGER_GRACE_MS = 250;

export interface AcceptedWeaponState {
    activeWeapon: WeaponName;
    nextWeapon: WeaponName | null;
    switchState: UpdatePacket['switchState'];
    phaseStartedAt: number;
    transitionStartedAt: number;
}
export function initialWeaponState(activeWeapon: WeaponName): AcceptedWeaponState {
    return { activeWeapon, nextWeapon: null, switchState: 'IDLE', phaseStartedAt: -Infinity, transitionStartedAt: -Infinity };
}
/** Validate both local animation phases against receipt time. A single network
 * tick of jitter is allowed across the whole transition, not per new packet. */
export function advanceWeaponState(current: AcceptedWeaponState, packet: UpdatePacket, now: number): AcceptedWeaponState | null {
    const { activeWeapon, nextWeapon, switchState } = packet;
    if (activeWeapon === current.activeWeapon && nextWeapon === current.nextWeapon && switchState === current.switchState) return current;
    const phaseMs = SWITCH_DURATION * 1000;
    if (current.switchState === 'IDLE' && switchState === 'WITHDRAWING' && activeWeapon === current.activeWeapon &&
        nextWeapon !== null && nextWeapon !== activeWeapon) {
        return { activeWeapon, nextWeapon, switchState, phaseStartedAt: now, transitionStartedAt: now };
    }
    if (current.switchState === 'WITHDRAWING' && switchState === 'BRINGING_IN' && activeWeapon === current.nextWeapon &&
        nextWeapon === activeWeapon && now - current.phaseStartedAt >= phaseMs - NETWORK_TICK_MS) {
        return { ...current, activeWeapon, nextWeapon, switchState, phaseStartedAt: now };
    }
    if (current.switchState === 'BRINGING_IN' && switchState === 'IDLE' && activeWeapon === current.activeWeapon && nextWeapon === null &&
        now - current.phaseStartedAt >= phaseMs - NETWORK_TICK_MS &&
        now - current.transitionStartedAt >= 2 * phaseMs - NETWORK_TICK_MS) {
        return { ...current, activeWeapon, nextWeapon, switchState, phaseStartedAt: now };
    }
    // Queued reliable packets can arrive in one burst. If the intermediate
    // phase arrived too early, a later idle update can finish the *same* intent
    // after the full host deadline; it cannot replace the pending weapon.
    if (current.switchState === 'WITHDRAWING' && switchState === 'IDLE' && activeWeapon === current.nextWeapon && nextWeapon === null &&
        now - current.transitionStartedAt >= 2 * phaseMs - NETWORK_TICK_MS) {
        return { ...current, activeWeapon, nextWeapon, switchState, phaseStartedAt: now };
    }
    return null;
}

/** Identical spread on the shooter, host and viewers. */
export function spreadDirection(base: THREE.Vector3, seed: number, pelletIndex: number, spread: number, out = new THREE.Vector3()): THREE.Vector3 {
    let value = (seed ^ Math.imul(pelletIndex + 1, 0x9e3779b9)) >>> 0;
    const next = () => { value = (Math.imul(value, 1664525) + 1013904223) >>> 0; return value / 0x100000000 - 0.5; };
    return out.copy(base).add(new THREE.Vector3(next(), next(), next()).multiplyScalar(spread)).normalize();
}
interface Shot {
    at: number;
    mechaRevision?: number;
    weapon: WeaponName;
    origin: THREE.Vector3;
    directions: THREE.Vector3[];
    used: Set<number>;
    homingTarget?: HomingTargetPacket;
    flightTarget?: HomingFlightTarget;
    steeringStartsAt?: number;
}
export class ShotLedger {
    private shots = new Map<number, Shot>();
    private nextFireAt = -Infinity;
    private fireGraceMs = 0;
    private lastShotId = -1;
    private triggerUpdatedAt: number | null = null;
    private triggerRampMs = 0;
    private triggerHeld = false;
    private verificationCredits = HOMING_VERIFICATION_STEPS_PER_SECOND;
    private verificationUpdatedAt = 0;
    private minigunSample: { key: string; distance: number; count: number; flight: HomingFlightTarget } | null = null;
    private spendVerification(now: number, steps: number): boolean {
        const elapsed = Math.max(0, now - this.verificationUpdatedAt) / 1000;
        this.verificationUpdatedAt = now;
        this.verificationCredits = Math.min(HOMING_VERIFICATION_STEPS_PER_SECOND, this.verificationCredits + elapsed * HOMING_VERIFICATION_STEPS_PER_SECOND);
        if (this.verificationCredits < steps) return false;
        this.verificationCredits -= steps; return true;
    }
    updateTrigger(held: boolean, now: number): void {
        if (this.triggerUpdatedAt !== null) {
            const elapsed = Math.max(0, now - this.triggerUpdatedAt);
            this.triggerRampMs = THREE.MathUtils.clamp(this.triggerRampMs + elapsed * (this.triggerHeld ? 1 : -2),
                0, MINIGUN_RAMP_TIME * 1000);
        }
        this.triggerUpdatedAt = now;
        this.triggerHeld = held;
    }
    reset(): void { this.shots.clear(); this.nextFireAt = -Infinity; this.fireGraceMs = 0; this.triggerHeld = false; this.triggerRampMs = 0; this.triggerUpdatedAt = null; this.minigunSample = null; }
    record(packet: FirePacket, now: number, dead: boolean, context?: HomingFireContext | (() => HomingFireContext | null), mechaRevision?: number): boolean {
        const stats = WEAPON_STATS[packet.weapon];
        let interval = stats.fireRate * 1000;
        if (packet.weapon === 'MINIGUN') {
            this.updateTrigger(this.triggerHeld, now);
            if (!this.triggerHeld || this.triggerRampMs < MINIGUN_SHOOT_DELAY * 1000) return false;
            const t = this.triggerRampMs / (MINIGUN_RAMP_TIME * 1000);
            interval = 60_000 / (MINIGUN_MIN_RPM + (MINIGUN_MAX_RPM - MINIGUN_MIN_RPM) * t);
        }
        // A small fixed jitter allowance cannot multiply the permitted cadence.
        if (dead || packet.shotId <= this.lastShotId || now < this.nextFireAt - this.fireGraceMs) return false;
        let flightTarget: HomingFlightTarget | undefined;
        let nextSample: typeof this.minigunSample = null;
        if (packet.homingTarget) {
            // Charge the bounded history/context search *before* doing it.
            // Otherwise fabricated distances with zero candidates bypass the
            // later replay/visibility budget entirely.
            if (!this.spendVerification(now, HOMING_HISTORY_SAMPLES * 2)) return false;
            const homing = typeof context === 'function' ? context() : context;
            if (!homing || !homing.history.samples.length || !Number.isFinite(packet.homingStartDistance) || packet.homingStartDistance! < 0 ||
                packet.homingStartDistance! > (BULLET_TRAVEL_DISTANCE + (homing.aimRadius ?? homing.radius)) / 3) return false;
            const origin = new THREE.Vector3(packet.barrelPos.x, packet.barrelPos.y, packet.barrelPos.z);
            const base = new THREE.Vector3(packet.dir.x, packet.dir.y, packet.dir.z).normalize();
            const key = JSON.stringify(packet.homingTarget);
            const batch = packet.weapon === 'MINIGUN' && this.triggerRampMs >= MINIGUN_RAMP_TIME * 1000 - 1e-6;
            const reuse = batch && this.minigunSample?.key === key && this.minigunSample.distance === packet.homingStartDistance &&
                this.minigunSample.count < FULL_SPEED_MINIGUN_HOMING_SAMPLE_BULLETS;
            const candidates = reuse ? this.minigunSample!.flight.candidates
                : homingReplayCandidates(homing.history, origin, packet.homingStartDistance! * 3, now);
            const point = new THREE.Vector3();
            const valid = candidates.filter(candidate => {
                const yaw = homing.history.sample(now - candidate.lagMs, point, candidate.filtered);
                return isWithinHomingAimEnvelope(origin, base, point, homing.aimRadius ?? homing.radius, BULLET_TRAVEL_DISTANCE) &&
                    this.spendVerification(now, 32) && homing.canAcquire(point, yaw, now - candidate.lagMs, candidate.filtered);
            });
            if (!valid.length) return false;
            flightTarget = { history: homing.history, kind: homing.kind, radius: homing.radius, guidanceRadius: homing.aimRadius ?? homing.radius,
                candidates: valid, historyFloorAt: homing.history.samples[0].at };
            if (batch) nextSample = { key, distance: packet.homingStartDistance!, count: reuse ? this.minigunSample!.count + 1 : 1, flight: flightTarget };
        }
        this.minigunSample = nextSample;
        this.lastShotId = packet.shotId;
        // Preserve the previous shot's deadline across weapon changes. Scheduling
        // from that deadline also prevents repeated jitter credit accelerating fire.
        const scheduledAt = Math.max(now, this.nextFireAt);
        this.nextFireAt = scheduledAt + interval;
        this.fireGraceMs = Math.min(15, interval * 0.1);
        for (const [id, shot] of this.shots) if (now - shot.at > PROJECTILE_LIFETIME * 1000 + PROJECTILE_LEDGER_GRACE_MS) this.shots.delete(id);
        const base = new THREE.Vector3(packet.dir.x, packet.dir.y, packet.dir.z).normalize();
        const count = packet.weapon === 'SHOTGUN' ? stats.pellets! : 1;
        this.shots.set(packet.shotId, { at: now, mechaRevision, weapon: packet.weapon,
            origin: new THREE.Vector3(packet.barrelPos.x, packet.barrelPos.y, packet.barrelPos.z),
            directions: Array.from({ length: count }, (_, i) => spreadDirection(base, packet.spreadSeed, i, stats.spread)),
            used: new Set(),
            homingTarget: packet.homingTarget,
            flightTarget, steeringStartsAt: packet.homingStartDistance,
        });
        return true;
    }
    private consumeIntersection(
        shotId: number,
        pelletIndex: number,
        damage: number,
        now: number,
        blocked: (start: THREE.Vector3, end: THREE.Vector3, radius: number, at?: number, filtered?: boolean) => boolean,
        intersect: (start: THREE.Vector3, end: THREE.Vector3) => number | null,
        identity?: HomingTargetPacket,
    ): boolean {
        const shot = this.shots.get(shotId);
        if (!shot || shot.used.has(pelletIndex) || !shot.directions[pelletIndex] || now - shot.at > PROJECTILE_LIFETIME * 1000 + PROJECTILE_LEDGER_GRACE_MS || damage !== WEAPON_STATS[shot.weapon].damage) return false;
        if (identity && shot.homingTarget?.kind === identity.kind) {
            if (identity.kind === 'mecha' && shot.homingTarget.kind === 'mecha' && identity.targetRevision !== shot.homingTarget.targetRevision) return false;
            if (identity.kind === 'npc' && shot.homingTarget.kind === 'npc' && identity.targetIndex === shot.homingTarget.targetIndex && identity.targetRevision !== shot.homingTarget.targetRevision) return false;
            if (identity.kind === 'peer' && shot.homingTarget.kind === 'peer' && identity.targetPeerId === shot.homingTarget.targetPeerId && identity.targetLifeId !== shot.homingTarget.targetLifeId) return false;
        }
        // Incidental contacts follow the recorded curve too. A failed guided
        // claim must never fall through to the old, unsteered shot ray.
        if (shot.flightTarget) return this.replayFlight(shot, pelletIndex, now, blocked, intersect);
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
        if (hit === null || blocked(start, start.clone().lerp(end, hit), shot.weapon === 'SNIPER' ? 0 : PROJECTILE_RADIUS)) return false;
        shot.used.add(pelletIndex);
        return true;
    }
    consume(shotId: number, pelletIndex: number, target: THREE.Vector3, radius: number, damage: number, now: number,
        blocked: (start: THREE.Vector3, end: THREE.Vector3, radius: number, at?: number, filtered?: boolean) => boolean, identity?: HomingTargetPacket): boolean {
        return this.consumeIntersection(shotId, pelletIndex, damage, now, blocked,
            (start, end) => segmentSphereHitT(start, end, target, radius + (this.shots.get(shotId)?.weapon === 'SNIPER' ? 0 : PROJECTILE_RADIUS)), identity);
    }
    consumeMechaHit(shotId: number, pelletIndex: number, revision: number, damage: number, now: number,
        contact: (start: THREE.Vector3, end: THREE.Vector3, origin: THREE.Vector3, radius: number) => number | null,
        blocked: (start: THREE.Vector3, end: THREE.Vector3, radius: number, at?: number, filtered?: boolean) => boolean): boolean {
        const shot = this.shots.get(shotId);
        if (!shot || shot.mechaRevision !== undefined && shot.mechaRevision !== revision) return false;
        const radius = shot.weapon === 'SNIPER' ? 0 : PROJECTILE_RADIUS;
        return this.consumeIntersection(shotId, pelletIndex, damage, now, blocked,
            (start, end) => contact(start, end, shot.origin, radius), { kind: 'mecha', targetRevision: revision });
    }
    consumePlayerHitbox(shotId: number, pelletIndex: number, target: THREE.Vector3, yaw: number, damage: number, now: number,
        blocked: (start: THREE.Vector3, end: THREE.Vector3, radius: number, at?: number, filtered?: boolean) => boolean, identity?: HomingTargetPacket): boolean {
        return this.consumeIntersection(shotId, pelletIndex, damage, now, blocked,
            (start, end) => segmentPlayerHitboxHitT(start, end, target, yaw, this.shots.get(shotId)?.weapon === 'SNIPER' ? 0 : PROJECTILE_RADIUS), identity);
    }
    private consumeHomingTarget(
        shotId: number,
        pelletIndex: number,
        target: THREE.Vector3,
        targetRadius: number,
        damage: number,
        now: number,
        blocked: (start: THREE.Vector3, end: THREE.Vector3, radius: number, at?: number, filtered?: boolean) => boolean,
        matches: (target: HomingTargetPacket | undefined) => boolean,
    ): boolean {
        const shot = this.shots.get(shotId);
        if (!shot || !matches(shot.homingTarget) || shot.used.has(pelletIndex) ||
            !shot.directions[pelletIndex] ||
            now - shot.at > PROJECTILE_LIFETIME * 1000 + PROJECTILE_LEDGER_GRACE_MS ||
            damage !== WEAPON_STATS[shot.weapon].damage) return false;
        const flight = shot.flightTarget, latest = flight?.history.samples.at(-1);
        // The caller must first sample the current authoritative target. Do not
        // verify a claim against a forgotten/stale replacement-world history.
        if (!flight || !latest || flight.radius !== targetRadius || latest.at > now ||
            latest.position.distanceToSquared(target) > HOMING_HIT_TOLERANCE * HOMING_HIT_TOLERANCE) return false;
        return this.replayFlight(shot, pelletIndex, now, blocked);
    }
    private replayFlight(shot: Shot, pelletIndex: number, now: number,
        blocked: (start: THREE.Vector3, end: THREE.Vector3, radius: number, at?: number, filtered?: boolean) => boolean,
        incidentalIntersection?: (start: THREE.Vector3, end: THREE.Vector3) => number | null): boolean {
        const flight = shot.flightTarget;
        if (!flight || now < shot.at) return false;
        const targetRadius = flight.radius;
        const ticks = Math.min(Math.ceil(BULLET_TRAVEL_DISTANCE / (PROJECTILE_SPEED * PROJECTILE_GUIDANCE_STEP)),
            Math.floor((now - shot.at + PROJECTILE_NETWORK_GRACE_MS) / (PROJECTILE_GUIDANCE_STEP * 1000) + 1e-8));
        const position = new THREE.Vector3(), end = new THREE.Vector3(), direction = new THREE.Vector3(), nextDirection = new THREE.Vector3(), point = new THREE.Vector3(), contact = new THREE.Vector3();
        for (const candidate of flight.candidates) {
            if (flight.history.samples[0].at > Math.max(flight.historyFloorAt, shot.at - candidate.lagMs) + PROJECTILE_GUIDANCE_STEP * 1000) continue;
            direction.copy(shot.directions[pelletIndex]); position.copy(shot.origin).addScaledVector(direction, PROJECTILE_MUZZLE_OFFSET);
            let traveled = PROJECTILE_MUZZLE_OFFSET, guided = true;
            for (let tick = 0; tick < ticks && traveled < BULLET_TRAVEL_DISTANCE; tick++) {
                if (!this.spendVerification(now, 1)) return false;
                const yaw = flight.history.sample(shot.at + (tick + 1) * PROJECTILE_GUIDANCE_STEP * 1000 - candidate.lagMs, point, candidate.filtered);
                guided &&= canContinueHoming(position, point, flight.guidanceRadius, BULLET_TRAVEL_DISTANCE - traveled);
                const distance = stepProjectileFlight(position, direction, traveled, PROJECTILE_GUIDANCE_STEP, guided ? point : null,
                    shot.steeringStartsAt!, end, nextDirection);
                const hit = incidentalIntersection ? incidentalIntersection(position, end) : flight.kind === 'player'
                    ? segmentPlayerHitboxHitT(position, end, point, yaw, PROJECTILE_RADIUS + HOMING_HIT_TOLERANCE)
                    : segmentSphereHitT(position, end, point, targetRadius + PROJECTILE_RADIUS + HOMING_HIT_TOLERANCE);
                contact.copy(end);
                if (hit !== null) {
                    contact.lerpVectors(position, end, hit);
                    const exactHit = incidentalIntersection ? hit : flight.kind === 'player'
                        ? segmentPlayerHitboxHitT(position, end, point, yaw, PROJECTILE_RADIUS)
                        : segmentSphereHitT(position, end, point, targetRadius + PROJECTILE_RADIUS);
                    if (exactHit !== null) contact.lerpVectors(position, end, exactHit);
                    else if (flight.kind === 'player') closestPlayerBodyPoint(contact, point, yaw, contact);
                    else contact.sub(point).normalize().multiplyScalar(targetRadius).add(point);
                }
                // Tolerance may bridge a small pose error, but never cover.
                // Check to the physical surface, not the expanded hit volume.
                if (blocked(position, contact, PROJECTILE_RADIUS, shot.at + (tick + 1) * PROJECTILE_GUIDANCE_STEP * 1000 - candidate.lagMs, candidate.filtered)) break;
                if (hit !== null) { shot.used.add(pelletIndex); return true; }
                position.copy(end); direction.copy(nextDirection); traveled += distance;
            }
        }
        return false;
    }
    consumeHomingNpc(shotId: number, pelletIndex: number, targetIndex: number, targetRevision: number,
        target: THREE.Vector3, targetRadius: number, damage: number, now: number,
        blocked: (start: THREE.Vector3, end: THREE.Vector3, radius: number, at?: number, filtered?: boolean) => boolean): boolean {
        return this.consumeHomingTarget(shotId, pelletIndex, target, targetRadius, damage, now, blocked,
            homingTarget => homingTarget?.kind === 'npc' &&
                homingTarget.targetIndex === targetIndex && homingTarget.targetRevision === targetRevision);
    }
    consumeHomingPeer(shotId: number, pelletIndex: number, targetPeerId: string, targetLifeId: number,
        target: THREE.Vector3, targetRadius: number, damage: number, now: number,
        blocked: (start: THREE.Vector3, end: THREE.Vector3, radius: number, at?: number, filtered?: boolean) => boolean): boolean {
        return this.consumeHomingTarget(shotId, pelletIndex, target, targetRadius, damage, now, blocked,
            homingTarget => homingTarget?.kind === 'peer' &&
                homingTarget.targetPeerId === targetPeerId && homingTarget.targetLifeId === targetLifeId);
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
