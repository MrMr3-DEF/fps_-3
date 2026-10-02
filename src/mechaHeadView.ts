import { MECHA_HEAD_BLACK_FADE_TIME, MECHA_HEAD_CAMERA_MOVE_TIME, MECHA_HELMET_TIME,
    MECHA_HUD_FADE_TIME, MECHA_MOUNT_HELMET_CLOSE_TIME, MECHA_VISION_REVEAL_TIME } from './config.js';

export type MechaHeadPhase = 'inactive' | 'mount' | 'loading' | 'hud' | 'reveal' | 'ready' |
    'opening-black' | 'opening-move' | 'opening' | 'open' | 'closing' | 'closing-black' | 'closing-move' | 'closing-reveal' | 'shutdown-reveal' | 'shutdown-hud' | 'shutdown' | 'shutdown-opening';
const clamp = (value: number) => Math.max(0, Math.min(1, value));
const ease = (value: number) => value * value * (3 - 2 * value);

/** Actor-owned presentation uses simulation seconds, never DOM timers. Camera
 * relocation stays behind an opaque cover; the physical hinge remains visible
 * before/after it. Reversals inherit current values instead of restarting poses. */
export class MechaHeadView {
    phase: MechaHeadPhase = 'inactive';
    fold = 0;
    wantedOpen = false;
    eyeBlend = 1;
    blackout = 0;
    loadingProgress = 0;
    hudOpacity = 0;
    revealProgress = 0;
    private phaseTime = 0;
    private fromBlack = 0;
    private fromEye = 1;
    get targetingReady(): boolean { return this.phase === 'ready' && !this.wantedOpen && this.fold <= 1e-9; }
    get viewportClear(): boolean { return this.eyeBlend >= 1 - 1e-9 && this.fold <= 1e-9 && this.phase !== 'inactive'; }
    begin(): void {
        this.reset(); this.phase = 'mount'; this.eyeBlend = 0;
    }
    reset(): void {
        this.phase = 'inactive'; this.fold = 0; this.wantedOpen = false;
        this.eyeBlend = 1; this.blackout = this.loadingProgress = this.hudOpacity = this.revealProgress = this.phaseTime = 0;
    }
    updateStartup(time: number, duration: number): boolean {
        const close = MECHA_MOUNT_HELMET_CLOSE_TIME;
        this.blackout = time >= close && time < duration + MECHA_HUD_FADE_TIME ? 1 : 0;
        this.eyeBlend = ease(clamp((time - close) / MECHA_HEAD_CAMERA_MOVE_TIME));
        this.loadingProgress = clamp((time - close) / (duration - close));
        this.hudOpacity = clamp((time - duration) / MECHA_HUD_FADE_TIME);
        this.revealProgress = clamp((time - duration - MECHA_HUD_FADE_TIME) / MECHA_VISION_REVEAL_TIME);
        this.phase = time < close ? 'mount' : time < duration ? 'loading' : time < duration + MECHA_HUD_FADE_TIME ? 'hud'
            : this.revealProgress < 1 - 1e-9 ? 'reveal' : 'ready';
        return this.phase === 'ready';
    }
    updateShutdown(time: number, duration: number): void {
        // Reverse the startup video/HUD before reversing the physical clip.
        // The progress bar still measures shutdown completion, so it fills
        // forward while Mount runs backward.
        this.loadingProgress = 0; this.eyeBlend = 1;
        if (time < MECHA_VISION_REVEAL_TIME) {
            this.phase = 'shutdown-reveal'; this.blackout = 0; this.hudOpacity = 1;
            this.revealProgress = 1 - clamp(time / MECHA_VISION_REVEAL_TIME);
            return;
        }
        this.revealProgress = 0;
        const reverseTime = time - (MECHA_VISION_REVEAL_TIME + MECHA_HUD_FADE_TIME);
        if (reverseTime < 0) {
            this.phase = 'shutdown-hud'; this.blackout = 1;
            this.hudOpacity = 1 - clamp((time - MECHA_VISION_REVEAL_TIME) / MECHA_HUD_FADE_TIME);
            return;
        }
        const opening = duration - MECHA_MOUNT_HELMET_CLOSE_TIME;
        // Hold the completed bar briefly while relocating behind black. The
        // normal capped frame delta then guarantees a visible 100% endpoint.
        const reveal = opening + MECHA_HEAD_BLACK_FADE_TIME;
        this.phase = reverseTime < reveal ? 'shutdown' : 'shutdown-opening';
        this.loadingProgress = clamp(reverseTime / opening);
        this.blackout = reverseTime < reveal ? 1 : 1 - clamp((reverseTime - reveal) / MECHA_HEAD_BLACK_FADE_TIME);
        this.eyeBlend = 1 - ease(clamp((reverseTime - opening + MECHA_HEAD_CAMERA_MOVE_TIME) / MECHA_HEAD_CAMERA_MOVE_TIME));
        this.hudOpacity = 0;
    }
    private enter(phase: MechaHeadPhase): void {
        this.phase = phase; this.phaseTime = 0; this.fromBlack = this.blackout; this.fromEye = this.eyeBlend;
    }
    toggle(): void {
        this.wantedOpen = !this.wantedOpen;
        this.hudOpacity = 0;
        if (this.wantedOpen) {
            if (this.eyeBlend <= 1e-9 && this.fold > 0) this.enter('opening');
            else this.enter('opening-black');
        } else this.enter(this.fold > 0 ? 'closing' : 'closing-black');
    }
    update(delta: number): void {
        // Carry remaining time across phase boundaries so slow frames do not
        // lengthen the hinge animation or reveal the camera halfway through a move.
        let remaining = Math.max(0, delta);
        for (let transitions = 0; remaining > 1e-12 && transitions < 8; transitions++) {
            const phase = this.phase;
            if (phase === 'inactive' || phase === 'ready' || phase === 'open') break;
            const hinge = phase === 'opening' || phase === 'closing';
            const duration = hinge ? (phase === 'opening' ? 1 - this.fold : this.fold) * MECHA_HELMET_TIME
                : phase.endsWith('move') ? MECHA_HEAD_CAMERA_MOVE_TIME : MECHA_HEAD_BLACK_FADE_TIME;
            const step = Math.min(remaining, hinge ? duration : Math.max(0, duration - this.phaseTime));
            remaining -= step; this.phaseTime += step;
            if (hinge) {
                this.fold = clamp(this.fold + (phase === 'opening' ? 1 : -1) * step / MECHA_HELMET_TIME);
                this.blackout = this.fromBlack * (1 - clamp(this.phaseTime / MECHA_HEAD_BLACK_FADE_TIME));
                if (duration > step + 1e-9) break;
                this.fold = phase === 'opening' ? 1 : 0;
                this.enter(phase === 'opening' ? 'open' : 'closing-black');
            } else {
                const progress = clamp(this.phaseTime / duration);
                if (phase.endsWith('black')) this.blackout = this.fromBlack + (1 - this.fromBlack) * ease(progress);
                else if (phase.endsWith('move')) {
                    this.blackout = 1;
                    this.eyeBlend = this.fromEye + ((phase === 'opening-move' ? 0 : 1) - this.fromEye) * ease(progress);
                } else this.blackout = this.fromBlack * (1 - ease(progress));
                if (progress < 1 - 1e-9) break;
                if (phase === 'opening-black') this.enter('opening-move');
                else if (phase === 'opening-move') this.enter('opening');
                else if (phase === 'closing-black') this.enter('closing-move');
                else if (phase === 'closing-move') this.enter('closing-reveal');
                else { this.blackout = 0; this.hudOpacity = 1; this.enter('ready'); }
            }
        }
    }
}
