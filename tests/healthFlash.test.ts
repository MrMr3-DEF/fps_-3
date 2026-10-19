import test from 'node:test';
import assert from 'node:assert/strict';
import { updateHealthBar, resetHealthBarFlash } from '../src/hud.ts';

let color = '';
const style = { width: '', get backgroundColor() { return color; }, set backgroundColor(value: string) {
    color = value === '#ff4757' ? 'rgb(255, 71, 87)' : value === '#2ed573' ? 'rgb(46, 213, 115)' : value;
} };
Object.assign(globalThis, { document: { getElementById: (id: string) => id === 'health-bar' ? { style } : null } });

test('normalized CSS and ordinary width/regen ticks cannot erase a damage flash', t => {
    t.mock.timers.enable({ apis: ['setTimeout'] });
    resetHealthBarFlash(); updateHealthBar(70, '#ff4757');
    updateHealthBar(80); assert.equal(style.width, '80%'); assert.equal(color, 'rgb(255, 71, 87)');
    t.mock.timers.tick(50); updateHealthBar(60, '#ff4757');
    t.mock.timers.tick(99); assert.equal(color, 'rgb(255, 71, 87)');
    t.mock.timers.tick(1); assert.equal(color, 'rgb(46, 213, 115)');
});

test('stale expiry cannot recolor a new life or a new health owner', t => {
    const expiries: (() => void)[] = [];
    t.mock.method(globalThis, 'setTimeout', (callback: () => void) => { expiries.push(callback); return 1 as any; });
    t.mock.method(globalThis, 'clearTimeout', () => {});
    resetHealthBarFlash(); updateHealthBar(0, '#ff4757');
    resetHealthBarFlash(); updateHealthBar(100); expiries[0]();
    assert.equal(color, 'rgb(46, 213, 115)', 'release/respawn is neutral even at full health');
    updateHealthBar(50, 'blue'); expiries[0](); assert.equal(color, 'blue');
    expiries[1](); assert.equal(color, 'rgb(46, 213, 115)'); resetHealthBarFlash();
});
