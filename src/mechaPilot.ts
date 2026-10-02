import * as THREE from 'three';
import { MECHA_LEG_ALIGNMENT, MECHA_LEG_TURN_SPEED, MECHA_TORSO_YAW_SPEED, MECHA_TURN_RADIUS, MECHA_LOOK_WINDOW } from './config.js';
import { MechaRockets } from './mechaRockets.js';

export interface PilotMovement { clip: 'Idle' | 'Walk' | 'TurnLeft' | 'TurnRight'; rate: number; distance: number }
export type PilotMotionResolver = (start: THREE.Vector3, end: THREE.Vector3, heading: number, out: THREE.Vector3) => THREE.Vector3;
const angle = (value: number) => Math.atan2(Math.sin(value), Math.cos(value));

/** Vehicle input is independent of bean physics and enemy AI. Torso yaw is
 * world-relative: compensating for leg heading prevents their yaw rates adding. */
export class MechaPilot {
    readonly rockets = new MechaRockets();
    readonly cameraPosition = new THREE.Vector3();
    readonly cameraQuaternion = new THREE.Quaternion();
    yaw = 0;
    pitch = 0;
    hudTime = 0;
    cooldown = 0;
    moving = false;
    private rate = 0;
    private direction = 0;
    private clip: PilotMovement['clip'] = 'Idle';
    private readonly destination = new THREE.Vector3();
    private readonly forward = new THREE.Vector3();
    private readonly resolved = new THREE.Vector3();
    private readonly samples: { time: number; yaw: number }[] = [];
    private latestTime = 0;
    private inputAge = Infinity;
    look(yaw: number, pitch: number, time = performance.now()): void {
        if (yaw && Number.isFinite(time)) {
            // Time is used only to compare input samples. Their expiry advances
            // with simulation, so a pause cannot accumulate or replay motion.
            if (time < this.latestTime) this.clearLookMotion();
            this.latestTime = time; this.inputAge = 0;
            this.samples.push({ time, yaw });
            while (this.samples.length > 64 || this.samples[0].time < time - MECHA_LOOK_WINDOW * 1000) this.samples.shift();
        }
        this.pitch = THREE.MathUtils.clamp(this.pitch + pitch, -Math.PI / 2 + 0.01, Math.PI / 2 - 0.01);
    }
    clearLookMotion(): void { this.samples.length = 0; this.inputAge = Infinity; }
    reset(yaw: number): void {
        this.yaw = yaw; this.clearLookMotion();
        this.pitch = this.hudTime = this.cooldown = this.rate = this.direction = 0;
        this.moving = false; this.clip = 'Idle'; this.rockets.clear();
    }
    update(delta: number, position: THREE.Vector3, heading: number, speed: number, direction: number,
        resolve: PilotMotionResolver): PilotMovement & { heading: number } {
        this.cooldown = Math.max(0, this.cooldown - delta);
        this.hudTime += delta;
        // Integrate only the part of this frame still inside the 50ms window.
        // This also stops correctly on a long frame after input has ended.
        let remaining = delta, consumed = 0;
        while (remaining > 1e-9 && this.inputAge < MECHA_LOOK_WINDOW) {
            const step = Math.min(remaining, 1 / 240, MECHA_LOOK_WINDOW - this.inputAge);
            const cutoff = this.latestTime + this.inputAge * 1000 - MECHA_LOOK_WINDOW * 1000;
            const motion = this.samples.reduce((sum, sample) => sum + (sample.time >= cutoff ? sample.yaw : 0), 0);
            this.yaw = angle(this.yaw + THREE.MathUtils.clamp(motion / MECHA_LOOK_WINDOW, -MECHA_TORSO_YAW_SPEED, MECHA_TORSO_YAW_SPEED) * step);
            this.inputAge += step; consumed += step; remaining -= step;
        }
        this.inputAge += delta - consumed;
        const difference = angle(this.yaw - heading);
        if (!direction || direction !== this.direction) this.moving = false;
        const turning = direction !== 0 && !this.moving && Math.abs(difference) > MECHA_LEG_ALIGNMENT;
        const clip = !direction ? 'Idle' : turning ? difference < 0 ? 'TurnLeft' : 'TurnRight' : 'Walk';
        if (clip !== this.clip || direction !== this.direction) { this.rate = 0; this.clip = clip; }
        this.direction = direction;
        this.rate = Math.min(1, this.rate + delta / 0.4);
        const previousHeading = heading;
        const maxYaw = (turning ? MECHA_LEG_TURN_SPEED : Math.min(MECHA_LEG_TURN_SPEED, speed * this.rate / MECHA_TURN_RADIUS)) * delta * (turning ? this.rate : 1);
        if (direction) heading = angle(heading + THREE.MathUtils.clamp(difference, -maxYaw, maxYaw));
        let distance = 0;
        if (clip === 'Walk') {
            this.forward.set(Math.sin(heading), 0, Math.cos(heading));
            this.destination.copy(position).addScaledVector(this.forward, speed * delta * this.rate * direction);
            resolve(position, this.destination, heading, this.resolved);
            distance = position.distanceTo(this.resolved) * direction;
            position.copy(this.resolved);
            // Keep movement intent through blockage. Otherwise every contact
            // restarts stationary alignment and the acceleration ramp.
            this.moving = true;
            heading = angle(previousHeading + THREE.MathUtils.clamp(angle(heading - previousHeading), -Math.abs(distance) / MECHA_TURN_RADIUS, Math.abs(distance) / MECHA_TURN_RADIUS));
            return { clip: distance ? 'Walk' : 'Idle', rate: delta > 0 ? distance / (speed * delta) : 0, distance, heading };
        }
        return { clip, rate: clip === 'Idle' ? 0 : this.rate, distance, heading };
    }
    dispose(): void { this.rockets.dispose(); }
}
