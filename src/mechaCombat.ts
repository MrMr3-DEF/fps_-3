import * as THREE from 'three';
import {
    BULLET_TRAVEL_DISTANCE, MECHA_HEIGHT, MECHA_DETECTION_RANGE, MECHA_LASER_MIN_RANGE, MECHA_STOMP_RADIUS, MECHA_SHIELD_SHOT_COUNT,
    MECHA_LASER_LOCK_ANGLE, MECHA_LASER_LOCK_TIME, MECHA_LASER_CHARGE_TIME,
    MECHA_LASER_FIRE_TIME, MECHA_LASER_FADE_TIME, MECHA_LASER_RELOAD_TIME,
    MECHA_LASER_RADIUS_RATIO, MECHA_LASER_DAMAGE, MECHA_SHIELD_RADIUS,
    MECHA_SHIELD_SHOT_WINDOW, MECHA_SHIELD_SHUTDOWN_DELAY, MECHA_SHIELD_BLINK_TIME,
    MECHA_SHIELD_EYE_FADE_TIME, MECHA_SHIELD_COLLAPSE_TIME, MECHA_SHIELD_DOWN_TIME,
    MECHA_SHIELD_BUILD_TIME, HOVER_DRAIN_RATE, HOVER_RECHARGE_RATE,
} from './config.js';
import { segmentSphereHitT, type Vec3Like } from './gameplayMath.js';
import { segmentPlayerBeamHitT } from './playerHitbox.js';
import { MechaCombatEffects } from './mechaCombatEffects.js';

export type LaserPhase = 'idle' | 'charging' | 'firing' | 'fading' | 'cancelling';
export type ShieldPhase = 'powered' | 'warning' | 'down' | 'rebuilding' | 'disabled';
export type MechaAttackRegion = 'stomp' | 'rocket' | 'laser';

/** Detection and acquisition share these disjoint volumes. Height and the
 * upper sphere are relative to the ground origin, never the moving eye/muzzle.
 * LOS stays separate so leaving a volume cannot cancel a committed windup. */
export function classifyMechaAttack(robotPosition: Vec3Like, playerPosition: Vec3Like): MechaAttackRegion | null {
    const x = playerPosition.x - robotPosition.x, z = playerPosition.z - robotPosition.z;
    const height = playerPosition.y - robotPosition.y, radiusSquared = x * x + z * z;
    if (!Number.isFinite(height) || !Number.isFinite(radiusSquared) || height < 0) return null;
    const reachSquared = MECHA_DETECTION_RANGE * MECHA_DETECTION_RANGE;
    if (height > MECHA_HEIGHT) return radiusSquared + height * height <= reachSquared ? 'rocket' : null;
    if (radiusSquared > reachSquared) return null;
    if (radiusSquared <= MECHA_STOMP_RADIUS * MECHA_STOMP_RADIUS) return 'stomp';
    return radiusSquared < MECHA_LASER_MIN_RANGE * MECHA_LASER_MIN_RANGE ? 'rocket' : 'laser';
}
export interface MechaLaserInput {
    robotPosition: THREE.Vector3;
    playerPosition: THREE.Vector3;
    playerYaw: number;
    playerAlive: boolean;
    visible: boolean;
    canCharge: boolean;
    yaw: number;
    obstacleDistance(start: THREE.Vector3, end: THREE.Vector3, radius: number): number;
}

/** Combat clocks use simulation time only. Fire direction and origin are
 * captured once, so neither vertical assistance nor a moving target can bend
 * the fired beam. Effects read these same volumes; they never decide damage. */
export class MechaCombat {
    readonly effects = new MechaCombatEffects();
    readonly shieldCenter = new THREE.Vector3();
    readonly orbPosition = new THREE.Vector3();
    readonly beamOrigin = new THREE.Vector3();
    readonly beamDirection = new THREE.Vector3(0, 0, 1);
    readonly beamEnd = new THREE.Vector3();
    laserPhase: LaserPhase = 'idle';
    shieldPhase: ShieldPhase = 'powered';
    eyeRadius = 1;
    orbRadius = 0;
    beamRadius = 0;
    beamLength = 0;
    reloadRemaining = 0;
    clock = 0;
    manual = false;
    energy = 1;
    manualBuild = 0;
    private exhausted = false;
    private laserElapsed = 0;
    private shieldElapsed = 0;
    private lockElapsed = 0;
    private fadeRadius = 0;
    private fadeBeamRadius = 0;
    private fired = false;
    private damagedPlayer = false;
    private drainPending = false;
    private readonly firingTimes: number[] = [];
    private readonly end = new THREE.Vector3();
    private readonly laserPlayer: (damage: number) => void;
    constructor(laserPlayer: (damage: number) => void = () => {}) { this.laserPlayer = laserPlayer; }

    get shotCount(): number { return this.firingTimes.length; }
    get rangedCommitted(): boolean { return this.laserPhase !== 'idle'; }
    get canStartRanged(): boolean { return !this.blocksNewAttacks && !this.drainPending && !this.rangedCommitted; }
    recordRangedShot(): void {
        this.firingTimes.push(this.clock);
        this.drainPending = this.firingTimes.length >= MECHA_SHIELD_SHOT_COUNT;
    }
    finishRangedAttack(): void {
        if (this.drainPending && this.shieldPhase === 'powered') { this.shieldPhase = 'warning'; this.shieldElapsed = 0; }
    }
    get shieldActive(): boolean { return this.shieldPhase === 'powered' || this.shieldPhase === 'warning'; }
    get frozen(): boolean { return !this.manual && (this.shieldPhase === 'down' || this.shieldPhase === 'rebuilding'); }
    get aimFrozen(): boolean { return this.frozen || this.laserPhase === 'firing' || this.laserPhase === 'fading'; }
    get blocksNewAttacks(): boolean { return this.shieldPhase !== 'powered'; }
    get eyePower(): number {
        if (this.manual) return 1;
        if (this.shieldPhase === 'disabled') return 0;
        if (this.shieldPhase === 'down') return 1 - Math.min(1, this.shieldElapsed / MECHA_SHIELD_EYE_FADE_TIME);
        if (this.shieldPhase === 'rebuilding') return Math.min(1, this.shieldElapsed / MECHA_SHIELD_BUILD_TIME);
        if (this.shieldPhase !== 'warning' || this.shieldElapsed < MECHA_SHIELD_SHUTDOWN_DELAY) return 1;
        const blink = this.shieldElapsed - MECHA_SHIELD_SHUTDOWN_DELAY;
        return Math.floor((blink + 1e-9) / (MECHA_SHIELD_BLINK_TIME / 4)) % 2 ? 1 : 0;
    }
    isInsideShield(position: Vec3Like): boolean {
        return Math.hypot(position.x - this.shieldCenter.x, position.y - this.shieldCenter.y, position.z - this.shieldCenter.z) <= MECHA_SHIELD_RADIUS;
    }
    shieldContactT(start: Vec3Like, end: Vec3Like, shotOrigin: Vec3Like, padding = 0): number | null {
        if (!this.shieldActive || this.isInsideShield(shotOrigin)) return null;
        return segmentSphereHitT(start, end, this.shieldCenter, MECHA_SHIELD_RADIUS + padding);
    }
    shieldImpact(point: Vec3Like): void {
        if (this.shieldActive) this.effects.shieldImpact(point, this.shieldCenter, this.clock);
    }
    advanceClock(delta: number): void {
        if (this.manual) return;
        if (!Number.isFinite(delta) || delta <= 0 || this.shieldPhase === 'disabled') return;
        this.clock += delta;
        this.reloadRemaining = Math.max(0, this.reloadRemaining - delta);
        if (!this.drainPending) while (this.firingTimes.length && this.clock - this.firingTimes[0] > MECHA_SHIELD_SHOT_WINDOW) this.firingTimes.shift();
        if (this.shieldPhase === 'powered') return;
        this.shieldElapsed += delta;
        const warningDuration = MECHA_SHIELD_SHUTDOWN_DELAY + MECHA_SHIELD_BLINK_TIME;
        if (this.shieldPhase === 'warning' && this.shieldElapsed + 1e-9 >= warningDuration) {
            this.shieldPhase = 'down'; this.shieldElapsed = Math.max(0, this.shieldElapsed - warningDuration);
        }
        if (this.shieldPhase === 'down' && this.shieldElapsed + 1e-9 >= MECHA_SHIELD_DOWN_TIME) {
            this.shieldPhase = 'rebuilding'; this.shieldElapsed = Math.max(0, this.shieldElapsed - MECHA_SHIELD_DOWN_TIME);
        }
        if (this.shieldPhase === 'rebuilding' && this.shieldElapsed + 1e-9 >= MECHA_SHIELD_BUILD_TIME) {
            this.shieldPhase = 'powered'; this.shieldElapsed = 0;
            this.drainPending = false; this.firingTimes.length = 0;
        }
    }
    cancelLaser(): void {
        this.lockElapsed = 0;
        if (this.laserPhase === 'idle' || this.laserPhase === 'cancelling') return;
        this.fadeRadius = this.orbRadius;
        this.fadeBeamRadius = this.beamRadius;
        this.laserElapsed = 0;
        this.laserPhase = 'cancelling';
    }
    private finishLaser(): void {
        if (this.fired) {
            this.reloadRemaining = MECHA_LASER_RELOAD_TIME;
            this.finishRangedAttack();
        }
        this.laserPhase = 'idle'; this.lockElapsed = 0;
        this.orbRadius = this.beamRadius = 0; this.beamLength = 0; this.fired = false;
    }
    updateLaser(delta: number, input: MechaLaserInput): void {
        if (!Number.isFinite(delta) || delta <= 0 || this.shieldPhase === 'disabled') return;
        const eligible = input.playerAlive && input.visible && classifyMechaAttack(input.robotPosition, input.playerPosition) === 'laser';
        // Range selects a windup, not its lifetime. Only LOS/life loss cancels
        // charging; a released beam remains a fixed physical volume.
        if (!input.playerAlive || (this.laserPhase === 'charging' && !input.visible)) this.cancelLaser();
        if (this.laserPhase === 'idle') {
            const desired = Math.atan2(input.playerPosition.x - input.robotPosition.x, input.playerPosition.z - input.robotPosition.z);
            const error = Math.atan2(Math.sin(desired - input.yaw), Math.cos(desired - input.yaw));
            if (eligible && input.canCharge && !this.blocksNewAttacks && !this.drainPending && this.reloadRemaining <= 0 && Math.abs(error) <= MECHA_LASER_LOCK_ANGLE) this.lockElapsed += delta;
            else this.lockElapsed = 0;
            if (this.lockElapsed + 1e-9 < MECHA_LASER_LOCK_TIME) return;
            this.laserPhase = 'charging'; this.laserElapsed = 0; this.fired = false; this.damagedPlayer = false;
            return;
        }
        this.laserElapsed += delta;
        if (this.laserPhase === 'charging') {
            const fraction = Math.min(1, this.laserElapsed / MECHA_LASER_CHARGE_TIME);
            this.orbRadius = this.eyeRadius * fraction * fraction * (3 - 2 * fraction);
            const horizontal = Math.hypot(input.playerPosition.x - this.orbPosition.x, input.playerPosition.z - this.orbPosition.z);
            const pitch = Math.atan2(input.playerPosition.y - this.orbPosition.y, horizontal);
            this.beamDirection.set(Math.sin(input.yaw) * Math.cos(pitch), Math.sin(pitch), Math.cos(input.yaw) * Math.cos(pitch));
            if (this.laserElapsed + 1e-9 < MECHA_LASER_CHARGE_TIME) return;
            this.laserElapsed = Math.max(0, this.laserElapsed - MECHA_LASER_CHARGE_TIME);
            this.laserPhase = 'firing'; this.fired = true;
            this.beamOrigin.copy(this.orbPosition);
            this.recordRangedShot();
        }
        if (this.laserPhase === 'firing' && this.laserElapsed + 1e-9 >= MECHA_LASER_FIRE_TIME) {
            this.laserPhase = 'fading'; this.laserElapsed = Math.max(0, this.laserElapsed - MECHA_LASER_FIRE_TIME);
        }
        if (this.laserPhase === 'fading' || this.laserPhase === 'cancelling') {
            const fraction = Math.max(0, 1 - this.laserElapsed / MECHA_LASER_FADE_TIME);
            this.orbRadius = fraction * (this.laserPhase === 'cancelling' ? this.fadeRadius : this.eyeRadius);
            this.beamRadius = fraction * (this.laserPhase === 'cancelling' ? this.fadeBeamRadius : this.eyeRadius * MECHA_LASER_RADIUS_RATIO);
            if (this.laserElapsed + 1e-9 >= MECHA_LASER_FADE_TIME) { this.finishLaser(); return; }
        } else {
            this.orbRadius = this.eyeRadius;
            this.beamRadius = this.eyeRadius * MECHA_LASER_RADIUS_RATIO;
        }
        if (!this.fired) return;
        this.end.copy(this.beamOrigin).addScaledVector(this.beamDirection, BULLET_TRAVEL_DISTANCE);
        this.beamLength = Math.max(0, Math.min(BULLET_TRAVEL_DISTANCE, input.obstacleDistance(this.beamOrigin, this.end, this.beamRadius)));
        this.beamEnd.copy(this.beamOrigin).addScaledVector(this.beamDirection, this.beamLength);
        if (this.laserPhase !== 'cancelling' && !this.damagedPlayer && input.playerAlive
            && segmentPlayerBeamHitT(this.beamOrigin, this.beamEnd, input.playerPosition, input.playerYaw, this.beamRadius) !== null) {
            this.damagedPlayer = true;
            this.laserPlayer(MECHA_LASER_DAMAGE);
        }
    }
    updateEffects(): void {
        this.effects.update({
            time: this.clock, orbPosition: this.fired ? this.beamOrigin : this.orbPosition,
            orbRadius: this.orbRadius, charging: this.laserPhase === 'charging',
            beamOrigin: this.beamOrigin, beamDirection: this.beamDirection, beamRadius: this.beamRadius,
            beamLength: this.beamLength, shieldCenter: this.shieldCenter, shieldPhase: this.shieldPhase,
            collapse: this.shieldPhase === 'down' ? Math.min(1, this.shieldElapsed / MECHA_SHIELD_COLLAPSE_TIME) : 0,
            build: this.manual ? this.manualBuild : this.shieldPhase === 'rebuilding' ? Math.min(1, this.shieldElapsed / MECHA_SHIELD_BUILD_TIME) : 0,
        });
    }
    enterManualShield(): void {
        this.stop(); this.manual = true; this.energy = 1; this.manualBuild = 0; this.exhausted = false;
    }
    updateManualShield(delta: number, held: boolean): void {
        if (!this.manual || !Number.isFinite(delta) || delta <= 0) return;
        this.clock += delta;
        if (!held) this.exhausted = false;
        const active = held && !this.exhausted && this.energy > 0;
        if (active) {
            this.energy = Math.max(0, this.energy - delta / HOVER_DRAIN_RATE);
            if (this.energy <= 1e-9) { this.energy = 0; this.exhausted = true; }
        } else this.energy = Math.min(1, this.energy + delta / HOVER_RECHARGE_RATE);
        const powering = active && !this.exhausted;
        this.manualBuild = THREE.MathUtils.clamp(this.manualBuild + (powering ? 1 : -1) * delta / MECHA_SHIELD_BUILD_TIME, 0, 1);
        this.shieldPhase = powering && this.manualBuild >= 1 - 1e-9 ? 'powered' : this.manualBuild > 0 ? 'rebuilding' : 'disabled';
        this.updateEffects();
    }
    stop(): void {
        this.manual = false; this.manualBuild = 0;
        this.laserPhase = 'idle'; this.shieldPhase = 'disabled'; this.drainPending = false;
        this.firingTimes.length = 0; this.orbRadius = this.beamRadius = this.beamLength = 0;
        this.updateEffects();
    }
    dispose(): void { this.stop(); this.effects.dispose(); }
}
