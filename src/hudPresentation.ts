import type { MechaMode } from './forgottenMecha.js';
import type { MechaHeadPhase } from './mechaHeadView.js';

export interface HudContext {
    runtime: boolean;
    playing: boolean;
    input: boolean;
    alive: boolean;
    ended: boolean;
    conversation: boolean;
    loading: boolean;
    reveal: boolean;
    editor: boolean;
    scoped: boolean;
    thirdPerson: boolean;
    touch: boolean;
    showFps: boolean;
    multiplayer: boolean;
    pilot: { mode: MechaMode; phase: MechaHeadPhase; blackout: number; targetingReady: boolean; hudOpacity: number; recoveringExit?: boolean } | null;
}

/** One presentation decision for transitions and draws. Reveal permits HUD
 * presentation while worldLoading still owns the frozen simulation clock. */
export function deriveHudPresentation(context: HudContext) {
    const active = context.runtime && context.playing && context.input && context.alive && !context.ended &&
        !context.conversation && !context.editor && (!context.loading || context.reveal);
    const pilot = context.pilot;
    const boot = pilot?.mode === 'startup' && (pilot.phase === 'hud' || pilot.phase === 'reveal');
    const shutdown = pilot?.mode === 'shutting-down' && (pilot.phase === 'shutdown-reveal' || pilot.phase === 'shutdown-hud');
    // Helmet camera relocation obscures the world, not vehicle ownership or
    // telemetry. In third person that internal blackout is never drawn.
    const piloting = active && pilot?.mode === 'piloted';
    const ready = piloting && (context.thirdPerson || pilot.blackout <= 1e-9);
    const onFoot = active && !pilot && !context.scoped;
    const ordinary = onFoot || piloting;
    const scope = active && (pilot
        ? !context.thirdPerson && (shutdown || boot || ready && (pilot.targetingReady || context.scoped))
        : context.scoped);
    return {
        ordinary,
        crosshair: active && (pilot ? ready && !scope : !context.scoped),
        scope,
        mechaScope: Boolean(scope && pilot && (pilot.targetingReady || boot || shutdown)),
        scopeOpacity: pilot && (boot || shutdown || pilot.targetingReady) ? pilot.hudOpacity : 1,
        fps: ordinary && context.showFps,
        accelerometer: ordinary && !context.scoped && !context.touch,
        powerJump: onFoot && !context.touch,
        touchPowerJump: onFoot && context.touch,
        speedlines: ordinary && !context.scoped,
        prompt: onFoot,
        border: ordinary && !context.scoped,
        hardware: Boolean(active && pilot && pilot.phase !== 'inactive' && (!context.thirdPerson || pilot.recoveringExit)),
        pvpStats: ordinary && context.multiplayer,
    };
}
export type HudPresentation = ReturnType<typeof deriveHudPresentation>;
