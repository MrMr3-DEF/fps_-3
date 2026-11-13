import test from 'node:test';
import assert from 'node:assert/strict';
import { applyHitmarkerSettings, flashHitmarker } from '../src/hitmarker.ts';
import { userSettings } from '../src/settings.ts';

test('white confirmations cannot extend or downgrade the original kill feedback deadline', t => {
    const original = globalThis.document, classes = new Set<string>(), pulses: any[] = [];
    let now = 0; t.mock.method(performance, 'now', () => now); t.mock.timers.enable({ apis: ['setTimeout'] });
    const marker = { innerHTML: '', style: { setProperty() {} },
        classList: { remove: (name: string) => classes.delete(name), toggle: (name: string, enabled: boolean) => enabled ? classes.add(name) : classes.delete(name) },
        animate: (_frames: any, options: any) => { const pulse = { cancelled: false, cancel() { this.cancelled = true; }, duration: options.duration }; pulses.push(pulse); return pulse; },
    };
    (globalThis as any).document = { getElementById: () => marker };
    try {
        applyHitmarkerSettings(); flashHitmarker(true); assert.ok(classes.has('is-kill'));
        now = 40; t.mock.timers.tick(40); flashHitmarker(false);
        assert.ok(classes.has('is-kill')); assert.equal(pulses[0].cancelled, true);
        now = userSettings.crosshair.hitmarkerDuration; t.mock.timers.tick(now - 40);
        assert.equal(classes.has('is-kill'), false, 'the white pulse cannot extend red feedback');
        applyHitmarkerSettings(); assert.ok(pulses.at(-1).cancelled);
    } finally { applyHitmarkerSettings(); (globalThis as any).document = original; }
});
