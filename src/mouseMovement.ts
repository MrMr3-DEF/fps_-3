import { POINTER_RESAMPLE_INITIAL_MS, POINTER_RESAMPLE_MAX_MS, POINTER_RESAMPLE_RESET_GAP_MS } from './config.js';

interface Movement { x: number; y: number; time: number; speed: number }

/** Suppress lock-entry warps and isolated extreme deltas without capping normal turns. */
export class MouseMovementFilter {
    private previousTime: number | null = null;
    private recentSpeeds: number[] = [];
    private pending: Movement | null = null;

    reset(): void {
        this.previousTime = null;
        this.recentSpeeds = [];
        this.pending = null;
    }

    sample(x: number, y: number, time: number, protectSpikes = true): { x: number; y: number } | null {
        if (![x, y, time].every(Number.isFinite)) return null;
        const previous = this.previousTime;
        this.previousTime = time;
        // Keep ordinary lock-entry motion. Only an extreme first delta resembles
        // the reported cursor warp; dropping every first sample creates a dead spot.
        if (previous === null) return Math.hypot(x, y) > 256 ? null : { x, y };
        if (!protectSpikes) { this.pending = null; return { x, y }; }
        const gap = Math.max(1, time - previous);
        if (time < previous) { this.reset(); return null; }
        const magnitude = Math.hypot(x, y);
        const speed = magnitude / gap;
        const pending = this.pending;
        this.pending = null;
        // A second comparable event confirms a real sustained fast movement.
        if (pending && time - pending.time <= 16 && magnitude > 0 &&
            speed >= pending.speed * 0.5 && speed <= pending.speed * 2 &&
            (x * pending.x + y * pending.y) / (magnitude * Math.hypot(pending.x, pending.y)) > 0.5) {
            this.remember(speed);
            return { x: pending.x + x, y: pending.y + y };
        }
        const baseline = Math.max(0, ...this.recentSpeeds);
        if (magnitude > 256 && gap <= 16 && speed > Math.max(128, baseline * 16)) {
            this.pending = { x, y, time, speed };
            return null;
        }
        this.remember(speed);
        return { x, y };
    }

    private remember(speed: number): void {
        this.recentSpeeds.push(speed);
        if (this.recentSpeeds.length > 32) this.recentSpeeds.shift();
    }
}

/** Causal, distance-preserving interpolation shared by mice and trackpads.
 * A sample spans one observed input interval, capped at one 60 Hz interval.
 * High-polling mice therefore add a fraction of a millisecond, not a fixed lag.
 */
export class MouseMovementResampler {
    private previousTime: number | null = null;
    private interval = POINTER_RESAMPLE_INITIAL_MS;
    private samples: Array<{ x: number; y: number; start: number; duration: number; applied: number }> = [];

    reset(): void {
        this.previousTime = null;
        this.interval = POINTER_RESAMPLE_INITIAL_MS;
        this.samples.length = 0;
    }

    add(x: number, y: number, sampleTime: number, receivedTime: number): void {
        const gap = this.previousTime === null ? Infinity : sampleTime - this.previousTime;
        this.previousTime = sampleTime;
        if (gap > POINTER_RESAMPLE_RESET_GAP_MS || gap < 0) this.interval = POINTER_RESAMPLE_INITIAL_MS;
        else if (gap > 0) this.interval = Math.max(0.25, Math.min(POINTER_RESAMPLE_MAX_MS, gap));
        if (x || y) this.samples.push({ x, y, start: receivedTime, duration: this.interval, applied: 0 });
    }

    advance(time: number): { x: number; y: number } {
        let x = 0, y = 0, remaining = 0;
        for (const sample of this.samples) {
            const fraction = Math.max(sample.applied, Math.min(1, Math.max(0, (time - sample.start) / sample.duration)));
            x += sample.x * (fraction - sample.applied);
            y += sample.y * (fraction - sample.applied);
            sample.applied = fraction;
            if (fraction < 1) this.samples[remaining++] = sample;
        }
        this.samples.length = remaining;
        return { x, y };
    }
}
