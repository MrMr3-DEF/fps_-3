import { MECHA_ENDING_READY_TIMEOUT_MS } from './config.js';
import type { Vec3Packet } from './networkTypes.js';

export const MECHA_ENDING_TIMING = {
    fadeOut: .45, fadeIn: .6, establish: .5, impact: 35 / 24, chain: .8, detonation: .85, aftermath: 3,
} as const;
// The real-GLB regression checks this authored duration against HeavyPunch.
export const MECHA_ENDING_DURATION = .45 + .6 + .5 + 85 / 24 + 3;
export interface MechaEndingState {
    id: number; seed: number; effectsSeed: number; position: Vec3Packet; heading: number; lightingElapsed: number;
    phase: 'preparing' | 'playing' | 'complete'; elapsed: number;
}
export type MechaEndingPhase = 'preparing' | 'fade-out' | 'fade-in' | 'establish' | 'punch' | 'aftermath' | 'game-over';
export interface MechaEndingFrame {
    time: number; phase: MechaEndingPhase; blackout: number; punchTime: number; impactAge: number; gameOver: boolean;
}
const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));
const smooth = (n: number) => { const t = clamp(n, 0, 1); return t * t * (3 - 2 * t); };

/** Absolute time keeps replay, snapshots and dropped render frames identical. */
export function sampleMechaEnding(time: number, punchDuration: number): MechaEndingFrame {
    const { fadeOut, fadeIn, establish, impact, aftermath } = MECHA_ENDING_TIMING;
    const start = fadeOut + fadeIn + establish, end = start + punchDuration + aftermath;
    const t = clamp(Number.isFinite(time) ? time : 0, 0, end);
    const phase: MechaEndingPhase = t < fadeOut ? 'fade-out' : t < fadeOut + fadeIn ? 'fade-in'
        : t < start ? 'establish' : t < start + punchDuration ? 'punch' : t < end ? 'aftermath' : 'game-over';
    return { time: t, phase, blackout: t < fadeOut ? smooth(t / fadeOut) : 1 - smooth((t - fadeOut) / fadeIn),
        punchTime: clamp(t - start, 0, punchDuration), impactAge: t - start - impact, gameOver: t >= end };
}

/** One authority owns readiness and the clock. Viewer death/pause never pauses
 * this terminal sequence. Only geometry preparation may extend opaque cover. */
export class MechaEndingAuthority {
    private readonly pending: Set<string>;
    private localReadyAt: number | null = null;
    private playAt: number | null = null;
    private readonly initial: Omit<MechaEndingState, 'phase' | 'elapsed'>;
    private readonly committedAt: number;
    constructor(initial: Omit<MechaEndingState, 'phase' | 'elapsed'>, committedAt: number, peers: readonly string[] = []) {
        this.initial = structuredClone(initial); this.committedAt = committedAt;
        this.pending = new Set(peers);
    }
    markLocalReady(now: number): boolean {
        if (this.localReadyAt !== null) return false;
        this.localReadyAt = now; return true;
    }
    markPeerReady(peer: string): boolean { return this.pending.delete(peer); }
    removePeer(peer: string): void { this.pending.delete(peer); }
    snapshot(now: number): MechaEndingState {
        const { fadeOut } = MECHA_ENDING_TIMING;
        const fade = Math.min(fadeOut, Math.max(0, now - this.committedAt) / 1000);
        if (this.playAt === null && fade >= fadeOut && this.localReadyAt !== null &&
            (this.pending.size === 0 || now - this.localReadyAt >= MECHA_ENDING_READY_TIMEOUT_MS)) this.playAt = now;
        const elapsed = this.playAt === null ? fade : Math.min(MECHA_ENDING_DURATION, fadeOut + Math.max(0, now - this.playAt) / 1000);
        return { ...this.initial, position: { ...this.initial.position }, elapsed,
            phase: this.playAt === null ? 'preparing' : elapsed >= MECHA_ENDING_DURATION ? 'complete' : 'playing' };
    }
}
