import * as THREE from 'three';

/** Render-only rotation: callers restore the logical pose after drawing, so
 * shaking cannot move the player, change collisions, or accumulate aim drift. */
export class CameraShake {
    private time = 0;
    private readonly pulses: Array<{ start: number; duration: number; strength: number }> = [];
    private readonly rotation = new THREE.Quaternion();
    private readonly euler = new THREE.Euler();
    trigger(strength: number, duration: number): void {
        if (strength <= 0) return;
        if (this.pulses.length >= 8) this.pulses.shift();
        this.pulses.push({ start: this.time, duration, strength });
    }
    update(delta: number): void {
        this.time += delta;
        for (let i = this.pulses.length - 1; i >= 0; i--) if (this.time - this.pulses[i].start >= this.pulses[i].duration) this.pulses.splice(i, 1);
    }
    apply(camera: THREE.Camera): void {
        let amplitude = 0;
        for (const pulse of this.pulses) amplitude += pulse.strength * Math.pow(1 - (this.time - pulse.start) / pulse.duration, 2);
        const t = this.time;
        camera.quaternion.multiply(this.rotation.setFromEuler(this.euler.set(
            Math.sin(t * 91) * amplitude, Math.sin(t * 113 + 1) * amplitude * 0.6, Math.sin(t * 79) * amplitude * 0.4,
        )));
    }
    reset(): void { this.time = 0; this.pulses.length = 0; }
}
