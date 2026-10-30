import test from 'node:test';
import assert from 'node:assert/strict';
import { deriveHudPresentation, type HudContext } from '../src/hudPresentation.ts';
import { applyHudPresentation } from '../src/hud.ts';
import { MechaHeadView } from '../src/mechaHeadView.ts';

const playing: HudContext = { runtime: true, playing: true, input: true, alive: true, ended: false, conversation: false,
    loading: false, reveal: false, editor: false, scoped: false, thirdPerson: false, touch: false,
    showFps: true, multiplayer: true, pilot: null };
const visibility = ['ordinary', 'locator', 'crosshair', 'scope', 'mechaScope', 'fps', 'accelerometer', 'powerJump', 'touchPowerJump', 'speedlines', 'prompt', 'border', 'hardware', 'pvpStats'] as const;
const hud = (changes: Partial<HudContext> = {}) => deriveHudPresentation({ ...playing, ...changes });
const pilot = (mode: NonNullable<HudContext['pilot']>['mode'], phase: NonNullable<HudContext['pilot']>['phase'], changes = {}) =>
    ({ mode, phase, blackout: 0, hudOpacity: 1, targetingReady: false, ...changes });

test('terminal, paused, conversation, editor and opaque loading states hide every gameplay layer', () => {
    for (const change of [{ runtime: false }, { playing: false }, { input: false }, { alive: false }, { ended: true },
        { conversation: true }, { editor: true }, { loading: true }]) {
        for (const thirdPerson of [false, true]) for (const scoped of [false, true]) {
            for (const mounted of [null, pilot('startup', 'hud'), pilot('piloted', 'ready'),
                pilot('piloted', 'opening-move', { blackout: 1 }), pilot('shutting-down', 'shutdown-hud')]) {
                const presentation = hud({ ...change, scoped, thirdPerson, pilot: mounted });
                for (const key of visibility) assert.equal(presentation[key], false, `${key} leaked for ${JSON.stringify(change)}`);
            }
        }
    }
});

test('boot reveal and respawn expose the complete ordinary HUD without waiting for simulation', () => {
    const normal = hud(), reveal = hud({ loading: true, reveal: true });
    assert.deepEqual(reveal, { ...normal, locator: false });
    assert.equal(normal.locator, true);
    for (const key of ['ordinary', 'crosshair', 'fps', 'accelerometer', 'powerJump', 'prompt', 'border', 'pvpStats'] as const) assert.equal(reveal[key], true);
    assert.deepEqual(hud({ thirdPerson: true }), normal);
    assert.equal(hud({ input: false, loading: true, reveal: true }).ordinary, false, 'denied initial input does not expose HUD');
    const scoped = hud({ scoped: true }); assert.equal(scoped.scope, true);
    assert.equal(scoped.locator, true);
    for (const key of ['ordinary', 'crosshair', 'fps', 'accelerometer', 'powerJump', 'prompt', 'border'] as const) assert.equal(scoped[key], false);
    assert.equal(hud({ touch: true }).accelerometer, false);
    assert.equal(hud({ touch: true }).powerJump, false);
    assert.equal(hud({ touch: true }).touchPowerJump, true);
});

test('Mecha startup/shutdown own their hardware fade while active piloting restores ordinary readouts', () => {
    for (const mounted of [pilot('boarding', 'mount'), pilot('startup', 'loading'), pilot('startup', 'hud'),
        pilot('startup', 'reveal'), pilot('shutting-down', 'shutdown-hud'), pilot('shutting-down', 'shutdown')]) {
        const presentation = hud({ pilot: mounted });
        assert.equal(presentation.accelerometer, false); assert.equal(presentation.powerJump, false);
        assert.equal(presentation.ordinary, false); assert.equal(presentation.prompt, false);
    }
    const boot = hud({ pilot: pilot('startup', 'hud', { hudOpacity: 0.4, blackout: 1 }) });
    assert.equal(boot.scope, true); assert.equal(boot.scopeOpacity, 0.4); assert.equal(boot.hardware, true);
    const shutdown = hud({ pilot: pilot('shutting-down', 'shutdown-hud', { hudOpacity: 0.3, blackout: 1 }) });
    assert.equal(shutdown.scope, true); assert.equal(shutdown.scopeOpacity, 0.3);
    assert.equal(hud({ thirdPerson: true, pilot: pilot('startup', 'hud') }).scope, false);
    const ready = hud({ pilot: pilot('piloted', 'ready', { targetingReady: true }) });
    assert.equal(ready.locator, true);
    assert.equal(ready.ordinary, true); assert.equal(ready.accelerometer, true);
    assert.equal(ready.scope, true); assert.equal(ready.crosshair, false); assert.equal(ready.powerJump, false);
    const open = hud({ pilot: pilot('piloted', 'open') }); assert.equal(open.crosshair, true); assert.equal(open.scope, false);
    assert.equal(hud({ pilot: pilot('piloted', 'closing-black', { blackout: 1 }) }).ordinary, true);
});

test('helmet toggles keep ordinary telemetry steady through partial/full blackout and rapid reversals', () => {
    const phases = new Set<string>();
    for (const step of [1 / 30, 1 / 60, 1 / 144, 0.047]) {
        const head = new MechaHeadView(); head.begin(); head.updateStartup(10, 7);
        const sample = () => {
            phases.add(head.phase);
            for (const thirdPerson of [false, true]) for (const scoped of [false, true]) for (const touch of [false, true]) {
                const presentation = hud({ thirdPerson, scoped, touch, pilot: pilot('piloted', head.phase,
                    { blackout: head.blackout, targetingReady: head.targetingReady, hudOpacity: head.hudOpacity }) });
                assert.equal(presentation.ordinary, true, `${head.phase} hid telemetry`);
                assert.equal(presentation.locator, true, `${head.phase} hid locator`);
                assert.equal(presentation.fps, true);
                assert.equal(presentation.accelerometer, !scoped && !touch);
                assert.equal(presentation.speedlines, !scoped);
                if (thirdPerson) {
                    assert.equal(presentation.crosshair, true); assert.equal(presentation.scope, false); assert.equal(presentation.hardware, false);
                } else if (head.blackout > 1e-9) {
                    assert.equal(presentation.crosshair, false); assert.equal(presentation.scope, false);
                }
            }
        };
        const advance = (seconds: number) => {
            for (let t = 0; t < seconds - 1e-9; t += step) { head.update(Math.min(step, seconds - t)); sample(); }
        };
        sample(); head.toggle(); advance(1.4); head.toggle(); advance(1.4);
        head.toggle(); advance(0.06); head.toggle(); advance(0.08); head.toggle(); advance(0.7);
        head.toggle(); advance(0.3); head.toggle(); advance(1.4); head.toggle(); advance(1.4);
    }
    for (const phase of ['opening-black', 'opening-move', 'opening', 'open', 'closing', 'closing-black', 'closing-move', 'closing-reveal', 'ready']) assert.ok(phases.has(phase), phase);
});

test('external entry and exit hide all head hardware, including video/HUD phases and recovery boot', () => {
    for (const mode of ['boarding', 'startup', 'shutting-down'] as const) {
        for (const phase of ['mount', 'loading', 'hud', 'reveal', 'shutdown-reveal', 'shutdown-hud', 'shutdown', 'shutdown-opening'] as const) {
            const presentation = hud({ thirdPerson: true, pilot: pilot(mode, phase, { blackout: 1, hudOpacity: 0.5 }) });
            for (const key of visibility) assert.equal(presentation[key], false, `${mode}/${phase} leaked ${key}`);
        }
    }
    const recovery = hud({ thirdPerson: true, pilot: pilot('startup', 'hud', { recoveringExit: true }) });
    assert.equal(recovery.hardware, true, 'only the neutral recovery cover is available');
    assert.equal(recovery.scope, false); assert.equal(recovery.mechaScope, false);
});

test('the real HUD applicator clears stale DOM state and initializes both Power Jump controls', () => {
    const nodes = new Map<string, any>();
    const node = (id: string) => {
        if (!nodes.has(id)) nodes.set(id, { hidden: false, textContent: '', style: { display: 'block', opacity: '1' }, attributes: {},
            classList: { toggle() {} }, setAttribute(key: string, value: string) { this.attributes[key] = value; } });
        return nodes.get(id);
    };
    Object.assign(globalThis, { document: { getElementById: node, querySelector: () => node('touch-powerJump') } });
    applyHudPresentation(hud({ loading: true, reveal: true }), true);
    assert.equal(node('weapon-indicator').style.display, 'block');
    assert.equal(node('accelerometer').style.display, 'block');
    assert.equal(node('powerjump-toggle').hidden, false);
    assert.equal(node('powerjump-toggle').textContent, 'POWER JUMP ON');
    assert.equal(node('powerjump-toggle').attributes['aria-pressed'], 'true');
    node('npc-interaction').hidden = false;
    for (const mounted of [null, pilot('piloted', 'ready'), pilot('shutting-down', 'shutdown-hud')]) {
        applyHudPresentation(hud({ input: false, pilot: mounted }), false);
        for (const id of ['crosshair', 'ui', 'locator-bar', 'health-container', 'reload-container', 'hover-container', 'weapon-indicator', 'goggles-scope', 'fps-counter', 'accelerometer', 'pvp-stats', 'world-border-overlay']) {
            assert.equal(node(id).style.display, 'none', `${id} survived pause`);
        }
        assert.equal(node('npc-interaction').hidden, true); assert.equal(node('powerjump-toggle').hidden, true);
        assert.equal(node('touch-powerJump').hidden, true);
    }
    applyHudPresentation(hud({ touch: true }), false);
    assert.equal(node('touch-powerJump').hidden, false); assert.equal(node('touch-powerJump').textContent, 'POWER JUMP OFF');
    for (const context of [{ scoped: true }, { alive: false }, { loading: true }, { pilot: pilot('boarding', 'mount') },
        { pilot: pilot('startup', 'hud') }, { pilot: pilot('shutting-down', 'shutdown-hud') }]) {
        applyHudPresentation(hud(context), false);
        assert.equal(node('weapon-indicator').style.display, 'none');
    }

    node('health-bar').style.width = '63%'; node('reload-bar').style.width = '45%'; node('hover-bar').style.height = '72%';
    node('accelerometer-value').textContent = '1.8'; node('accelerometer-dot').style.transform = 'translate(4px, -8px)';
    for (const thirdPerson of [false, true]) for (const blackout of [0, 0.5, 1]) {
        applyHudPresentation(hud({ thirdPerson, pilot: pilot('piloted', 'opening-black', { blackout }) }), false);
        for (const id of ['ui', 'health-container', 'reload-container', 'hover-container', 'weapon-indicator', 'fps-counter', 'accelerometer']) assert.notEqual(node(id).style.display, 'none', id);
        assert.equal(node('health-bar').style.width, '63%'); assert.equal(node('reload-bar').style.width, '45%');
        assert.equal(node('hover-bar').style.height, '72%'); assert.equal(node('accelerometer-value').textContent, '1.8');
        assert.equal(node('accelerometer-dot').style.transform, 'translate(4px, -8px)');
    }
});
