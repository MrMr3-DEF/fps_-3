import * as THREE from 'three';
import { BULLET_TRAVEL_DISTANCE, PROJECTILE_SPEED, HOMING_HISTORY_SAMPLES, HOMING_HISTORY_LAG_MS, HOMING_HIT_TOLERANCE, HOMING_REPLAY_CANDIDATES, PROJECTILE_GUIDANCE_STEP, NETWORK_POSITION_RESPONSE } from './config.js';
import { steerHomingDirection } from './projectileHoming.js';

const movement = new THREE.Vector3(), desired = new THREE.Vector3();
/** One shared integration step. The caller owns collision and the fixed clock;
 * muzzle offset is already included in distanceTraveled. */
export function stepProjectileFlight(position: THREE.Vector3, direction: THREE.Vector3, distanceTraveled: number,
    delta: number, target: THREE.Vector3 | null, steeringStartsAt: number,
    outPosition: THREE.Vector3, outDirection: THREE.Vector3): number {
    const distance = Math.min(PROJECTILE_SPEED * delta, Math.max(0, BULLET_TRAVEL_DISTANCE - distanceTraveled));
    movement.copy(direction).normalize(); outDirection.copy(movement);
    const guidedDistance = distanceTraveled + distance - steeringStartsAt;
    if (target && guidedDistance > 0) {
        desired.subVectors(target, position);
        if (desired.lengthSq() > 0) {
            desired.normalize();
            steerHomingDirection(movement, desired, delta * Math.min(1, guidedDistance / Math.max(distance, Number.EPSILON)), outDirection);
            movement.add(outDirection).normalize();
        }
    }
    outPosition.copy(position).addScaledVector(movement, distance);
    return distance;
}

export interface TargetMotionSample { at: number; position: THREE.Vector3; filtered: THREE.Vector3; yaw: number; }
/** Receipt-time samples never consume a client timestamp. A new target life
 * gets a new history object; old shots cannot silently follow the replacement. */
export class TargetMotionHistory {
    readonly samples: TargetMotionSample[] = [];
    add(at: number, position: THREE.Vector3, yaw = 0): void {
        const last = this.samples.at(-1);
        if (last && at < last.at) return;
        // A packet burst occupies one guidance-time bin, preserving a full
        // flight of history rather than only the latest 128 packet arrivals.
        if (last && Math.floor(at / (PROJECTILE_GUIDANCE_STEP * 1000)) === Math.floor(last.at / (PROJECTILE_GUIDANCE_STEP * 1000))) this.samples.pop();
        const previous = this.samples.at(-1);
        const filtered = previous ? previous.filtered.clone().lerp(position, 1 - Math.exp(-NETWORK_POSITION_RESPONSE * (at - previous.at) / 1000)) : position.clone();
        this.samples.push({ at, position: position.clone(), filtered, yaw });
        if (this.samples.length > HOMING_HISTORY_SAMPLES) this.samples.shift();
    }
    sample(at: number, out: THREE.Vector3, filtered = false): number {
        const samples = this.samples;
        if (!samples.length) throw new Error('Cannot sample empty target history');
        let low = 0, high = samples.length - 1;
        while (low < high) { const mid = (low + high) >>> 1; if (samples[mid].at < at) low = mid + 1; else high = mid; }
        const after = samples[low], before = samples[Math.max(0, low - 1)];
        const fraction = after.at > before.at ? THREE.MathUtils.clamp((at - before.at) / (after.at - before.at), 0, 1) : 0;
        out.lerpVectors(filtered ? before.filtered : before.position, filtered ? after.filtered : after.position, fraction);
        return before.yaw + Math.atan2(Math.sin(after.yaw - before.yaw), Math.cos(after.yaw - before.yaw)) * fraction;
    }
}

export interface HomingReplayCandidate { lagMs: number; filtered: boolean; }
export interface HomingFlightTarget {
    history: TargetMotionHistory;
    kind: 'sphere' | 'player';
    radius: number;
    guidanceRadius: number;
    candidates: HomingReplayCandidate[];
    historyFloorAt: number;
}
export interface HomingFireContext {
    history: TargetMotionHistory;
    kind: 'sphere' | 'player';
    radius: number;
    aimRadius?: number;
    canAcquire(position: THREE.Vector3, yaw: number, at: number, filtered: boolean): boolean;
}

/** Infer bounded observation delays from host-owned history and the distance
 * sample. A client distance is a constraint to check, never a trajectory proof. */
export function homingReplayCandidates(history: TargetMotionHistory, origin: THREE.Vector3, distance: number, now: number): HomingReplayCandidate[] {
    const ranked: { lagMs: number; filtered: boolean; error: number }[] = [];
    const before = new THREE.Vector3(), after = new THREE.Vector3(), offset = new THREE.Vector3(), span = new THREE.Vector3();
    const low = now - HOMING_HISTORY_LAG_MS;
    const slots = Math.max(2, Math.floor(HOMING_REPLAY_CANDIDATES / 2));
    const spacing = HOMING_HISTORY_LAG_MS / (slots - 1);
    const times = [...new Set([
        ...Array.from({ length: slots }, (_, index) => low + index * spacing),
        ...history.samples.filter(s => s.at > low && s.at < now).map(s => s.at),
    ])].sort((a, b) => a - b);
    const append = (at: number, filtered: boolean) => {
        const position = new THREE.Vector3(); history.sample(at, position, filtered);
        const error = Math.abs(position.distanceTo(origin) - distance);
        if (error > HOMING_HIT_TOLERANCE) return;
        const duplicate = ranked.find(c => c.filtered === filtered && Math.abs(c.lagMs - (now - at)) < 1e-6);
        if (duplicate) return;
        ranked.push({ lagMs: now - at, filtered, error });
    };
    for (const filtered of [false, true]) {
        for (let i = 1; i < times.length; i++) {
            const start = times[i - 1], end = times[i];
            history.sample(start, before, filtered); history.sample(end, after, filtered);
            span.subVectors(after, before); offset.subVectors(before, origin);
            const a = span.lengthSq(), b = 2 * offset.dot(span), c = offset.lengthSq() - distance * distance;
            append(start, filtered); append(end, filtered);
            if (a <= 1e-12) continue;
            const discriminant = b * b - 4 * a * c;
            if (discriminant < 0) continue;
            for (const root of [(-b - Math.sqrt(discriminant)) / (2 * a), (-b + Math.sqrt(discriminant)) / (2 * a)]) {
                if (root > 0 && root < 1) append(start + (end - start) * root, filtered);
            }
        }
    }
    // A stationary target cannot reveal observation lag at fire time. Retain
    // a bounded spread of plausible lags so movement *after* firing is still
    // verifiable; collapsing equal positions would incorrectly force zero lag.
    const selected = new Map<string, typeof ranked[number]>();
    for (const candidate of ranked) {
        const slot = Math.round(candidate.lagMs / spacing), key = `${candidate.filtered}:${slot}`;
        const previous = selected.get(key);
        if (!previous || candidate.error < previous.error || candidate.error === previous.error &&
            Math.abs(candidate.lagMs - slot * spacing) < Math.abs(previous.lagMs - slot * spacing)) selected.set(key, candidate);
    }
    return [...selected.values()].sort((a, b) => a.error - b.error || a.lagMs - b.lagMs || Number(a.filtered) - Number(b.filtered))
        .slice(0, HOMING_REPLAY_CANDIDATES).map(({ lagMs, filtered }) => ({ lagMs, filtered }));
}
