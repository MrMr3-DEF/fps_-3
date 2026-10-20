import type { WebGLRenderer } from 'three';
import { MECHA_ENDING_DURATION, MECHA_ENDING_TIMING, sampleMechaEnding, type MechaEndingState } from './mechaEndingTimeline.js';
import type { MechaEndingFrame } from './mechaEndingTimeline.js';

interface EndingScene {
    begin(renderer: WebGLRenderer): Promise<void>;
    seek(time: number): MechaEndingFrame;
    render(renderer: WebGLRenderer): void;
    dispose(): void;
}
export interface EndingPlaybackPort {
    prepare(state: MechaEndingState): Promise<EndingScene>;
    cover(opacity: number): void;
    ready(id: number): void;
    complete(): void;
    failed(error: unknown): void;
}

/** Renderer-independent lifecycle orchestration. In particular, asset load and
 * async activation cannot resume a disposed/replaced match. The live canvas
 * keeps its last frame during fade-out; only opaque cover permits replacement. */
export class MechaEndingPlayback {
    private latest: MechaEndingState;
    private receivedAt: number;
    private readonly fadeStartedAt: number;
    private scene: EndingScene | null = null;
    private building = false;
    private ready = false;
    private completed = false;
    private disposed = false;
    private displayed = 0;
    private renderedSize = '';

    private readonly port: EndingPlaybackPort;
    constructor(initial: MechaEndingState, now: number, port: EndingPlaybackPort) {
        this.port = port;
        this.latest = structuredClone(initial); this.receivedAt = this.fadeStartedAt = now;
        void port.prepare(initial).then(scene => {
            if (this.disposed) scene.dispose(); else this.scene = scene;
        }).catch(error => this.fail(error));
    }
    receive(next: MechaEndingState, now: number): void {
        const previous = this.latest;
        if (this.disposed || next.id !== previous.id || next.seed !== previous.seed || next.effectsSeed !== previous.effectsSeed ||
            next.heading !== previous.heading || next.lightingElapsed !== previous.lightingElapsed ||
            ['x', 'y', 'z'].some(k => next.position[k as keyof typeof next.position] !== previous.position[k as keyof typeof previous.position])) return;
        const rank = { preparing: 0, playing: 1, complete: 2 };
        if (rank[next.phase] < rank[this.latest.phase] || next.elapsed < this.latest.elapsed) return;
        // Duplicate snapshots must not reset extrapolation or replay the shot.
        if (next.phase === this.latest.phase && next.elapsed === this.latest.elapsed) return;
        this.latest = structuredClone(next); this.receivedAt = now;
    }
    update(now: number, renderer: WebGLRenderer): void {
        if (this.disposed || this.completed && !this.scene) return;
        const fade = Math.min(MECHA_ENDING_TIMING.fadeOut, Math.max(0, now - this.fadeStartedAt) / 1000);
        if (!this.ready || fade < MECHA_ENDING_TIMING.fadeOut || this.latest.phase === 'preparing') {
            this.port.cover(sampleMechaEnding(fade, 85 / 24).blackout);
            if (fade >= MECHA_ENDING_TIMING.fadeOut && this.scene && !this.building) {
                this.building = true;
                void this.scene.begin(renderer).then(() => {
                    if (this.disposed) return;
                    this.ready = true; this.port.ready(this.latest.id);
                }).catch(error => this.fail(error));
            }
            return;
        }
        const elapsed = Math.min(MECHA_ENDING_DURATION, this.latest.elapsed + Math.max(0, now - this.receivedAt) / 1000);
        this.displayed = Math.max(this.displayed, elapsed);
        const size = `${renderer.domElement.width}:${renderer.domElement.height}`;
        if (!this.completed || this.renderedSize !== size) {
            const frame = this.scene!.seek(this.displayed);
            this.scene!.render(renderer); this.renderedSize = size; this.port.cover(0);
            // Exported clip key times use float32; the shared authored clock
            // must finish even if the GLB duration is a few nanoseconds longer.
            if ((frame.gameOver || this.displayed >= MECHA_ENDING_DURATION) && !this.completed) { this.completed = true; this.port.complete(); }
        }
    }
    private fail(error: unknown): void {
        if (this.disposed || this.completed) return;
        this.scene?.dispose(); this.scene = null;
        this.completed = true; this.port.cover(1);
        // Readiness failure still releases the host barrier; other viewers can
        // finish the cutscene, while this viewer receives a usable Game Over.
        this.port.ready(this.latest.id); this.port.failed(error); this.port.complete();
    }
    dispose(): void {
        if (this.disposed) return;
        this.disposed = true; this.scene?.dispose(); this.scene = null; this.port.cover(0);
    }
}
