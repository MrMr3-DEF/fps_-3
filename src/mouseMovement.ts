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

    sample(x: number, y: number, time: number): { x: number; y: number } | null {
        if (![x, y, time].every(Number.isFinite)) return null;
        const previous = this.previousTime;
        this.previousTime = time;
        // Some Chromium implementations report a cursor reposition as the first delta.
        if (previous === null) return null;
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
