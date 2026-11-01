import { MECHA_STOMP_COOLDOWN, MECHA_STOMP_IMPACT_TIME, MECHA_STOMP_RADIUS } from './config.js';

export type PilotWeapon = 'rocket' | 'stomp';
export const isPilotWeapon = (value: unknown): value is PilotWeapon => value === 'rocket' || value === 'stomp';
export const cyclePilotWeapon = (current: PilotWeapon): PilotWeapon => current === 'rocket' ? 'stomp' : 'rocket';

/** Both drivers stop at the authored contact and clip end before consuming a
 * hitch's remainder. Cooldown begins only after the complete animation. */
export class MechaStomp {
    active = false;
    elapsed = 0;
    cooldown = 0;
    private impacted = false;
    start(): boolean {
        if (this.active || this.cooldown > 1e-9) return false;
        this.active = true; this.elapsed = 0; this.impacted = false; return true;
    }
    step(delta: number, duration: number): number {
        return Math.min(delta, Math.max(0, (!this.impacted ? MECHA_STOMP_IMPACT_TIME : duration) - this.elapsed));
    }
    advance(delta: number, duration: number): { impact: boolean; finished: boolean } {
        this.elapsed += delta;
        const impact = !this.impacted && this.elapsed + 1e-9 >= MECHA_STOMP_IMPACT_TIME;
        if (impact) this.impacted = true;
        const finished = this.elapsed + 1e-9 >= duration;
        if (finished) { this.active = false; this.cooldown = MECHA_STOMP_COOLDOWN; }
        return { impact, finished };
    }
    tick(delta: number): void { if (!this.active) this.cooldown = Math.max(0, this.cooldown - delta); }
    reset(): void { this.active = false; this.elapsed = this.cooldown = 0; this.impacted = false; }
}

export function stompContact(center: { x: number; z: number }, victim: { x: number; z: number }, grounded: boolean, legs: boolean): boolean {
    return legs || grounded && Math.hypot(victim.x - center.x, victim.z - center.z) <= MECHA_STOMP_RADIUS;
}
