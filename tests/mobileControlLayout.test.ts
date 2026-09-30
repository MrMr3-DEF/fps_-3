import test from 'node:test';
import assert from 'node:assert/strict';
import { TOUCH_CONTROLS, cloneTouchLayout, getTouchControlRect, placeTouchControl, readTouchLayout, type TouchLayout } from '../src/mobileControlLayout.js';
import { cloneSettings, DEFAULT_USER_SETTINGS, loadUserSettings, saveUserSettings, userSettings } from '../src/settings.js';

const bounds = { width: 844, height: 390, left: 44, right: 0, top: 0, bottom: 21 };

test('device input defaults migrate older settings; input mode and layout round-trip independently', () => {
    const previousSettings = cloneSettings(userSettings);
    const previousStorage = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
    let raw = JSON.stringify({ sensitivity: 1 });
    Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: {
        getItem: () => raw, setItem: (_key: string, value: string) => { raw = value; },
    } });
    try {
        loadUserSettings();
        assert.equal(userSettings.mobileInput, DEFAULT_USER_SETTINGS.mobileInput);
        assert.equal(userSettings.touchFireMode, 'joystick');
        assert.deepEqual(userSettings.touchLayout, {});
        userSettings.mobileInput = 'keyboard';
        userSettings.touchFireMode = 'button';
        userSettings.touchLayout = { fire: { x: 0.8, y: 0.6, scale: 2.5 }, stick: { x: 0.2, y: 0.8, scale: 0.5 } };
        saveUserSettings();
        Object.assign(userSettings, cloneSettings(DEFAULT_USER_SETTINGS));
        loadUserSettings();
        assert.equal(userSettings.mobileInput, 'keyboard');
        assert.equal(userSettings.touchFireMode, 'button');
        assert.deepEqual(userSettings.touchLayout.fire, { x: 0.8, y: 0.6, scale: 2.5 });
        raw = JSON.stringify({ mobileInput: 'invalid', touchFireMode: 'invalid', touchLayout: [] });
        loadUserSettings();
        assert.equal(userSettings.mobileInput, DEFAULT_USER_SETTINGS.mobileInput);
        assert.equal(userSettings.touchFireMode, 'joystick');
        assert.deepEqual(userSettings.touchLayout, {});
    } finally {
        Object.assign(userSettings, previousSettings);
        if (previousStorage) Object.defineProperty(globalThis, 'localStorage', previousStorage);
        else Reflect.deleteProperty(globalThis, 'localStorage');
    }
});

test('layout storage rejects nonfinite and unknown controls and clamps valid overrides', () => {
    assert.deepEqual(readTouchLayout(null), {});
    const layout = readTouchLayout({
        fire: { x: -1, y: 4, scale: 9 }, jump: { x: 0.4, y: 0.8, scale: 0.1 },
        aim: { x: NaN, y: 1, scale: 1 }, stick: { x: 0.1, y: Infinity, scale: 1 },
        weapon: { x: '0.2', y: 0.5, scale: 1 }, bogus: { x: 0.2, y: 0.5, scale: 1 },
    });
    assert.deepEqual(layout, { fire: { x: 0, y: 1, scale: 2.5 }, jump: { x: 0.4, y: 0.8, scale: 0.5 } });
});

test('editor drafts never mutate the applied layout or global reset defaults', () => {
    const saved = { fire: { x: 0.8, y: 0.7, scale: 1 } };
    const draft = cloneTouchLayout(saved);
    placeTouchControl('fire', draft, bounds, 300, 120, 2);
    assert.deepEqual(saved.fire, { x: 0.8, y: 0.7, scale: 1 });
    const settings = cloneSettings({ ...DEFAULT_USER_SETTINGS, touchLayout: saved });
    settings.touchLayout.fire!.scale = 0.5;
    assert.equal(saved.fire.scale, 1);
    assert.deepEqual(DEFAULT_USER_SETTINGS.touchLayout, {});
});

test('dragging and resizing keep every control inside safe areas across viewport changes', () => {
    for (const { id } of TOUCH_CONTROLS) {
        const layout: TouchLayout = {};
        for (const scale of [0.5, 1, 2.5]) {
            for (const [x, y] of [[-100, -100], [900, 450], [420, 190]]) {
                placeTouchControl(id, layout, bounds, x, y, scale);
                for (const viewport of [bounds, { width: 568, height: 320, left: 0, right: 34, top: 0, bottom: 21 }]) {
                    const rect = getTouchControlRect(id, layout, viewport);
                    assert.ok(rect.left >= viewport.left);
                    assert.ok(rect.top >= viewport.top);
                    assert.ok(rect.left + rect.width <= viewport.width - viewport.right + 0.00001);
                    assert.ok(rect.top + rect.height <= viewport.height - viewport.bottom + 0.00001);
                }
            }
        }
        const short = getTouchControlRect(id, { [id]: { x: 0.5, y: 0.5, scale: 2.5 } }, { ...bounds, height: 200 });
        const original = getTouchControlRect(id, {}, bounds);
        assert.ok(Math.abs(short.width / short.height - original.width / original.height) < 0.00001, 'viewport fitting preserves control proportions');
    }
});

test('size limits apply to actual button dimensions and normalized placement follows the viewport', () => {
    const layout: TouchLayout = { fire: { x: 0.5, y: 0.5, scale: 0.5 } };
    const small = getTouchControlRect('fire', layout, bounds);
    assert.equal(small.width, 41);
    assert.equal(small.height, 41);
    layout.fire!.scale = 2.5;
    const large = getTouchControlRect('fire', layout, bounds);
    assert.equal(large.width, 205);
    assert.equal(large.height, 205);
    assert.equal(large.left + large.width / 2, bounds.left + (bounds.width - bounds.left) / 2);
    assert.equal(large.top + large.height / 2, (bounds.height - bounds.bottom) / 2);
    assert.equal(getTouchControlRect('fire', layout, bounds, 'button').height, 175);
});

test('switching fire type preserves its center and scale and default controls leave clearance', () => {
    const layout: TouchLayout = { fire: { x: 0.6, y: 0.5, scale: 1.5 } };
    const joystick = getTouchControlRect('fire', layout, bounds);
    placeTouchControl('fire', layout, bounds, joystick.left + joystick.width / 2, joystick.top + joystick.height / 2, 1.5, 'button');
    const button = getTouchControlRect('fire', layout, bounds, 'button');
    assert.equal(button.left + button.width / 2, joystick.left + joystick.width / 2);
    assert.equal(button.top + button.height / 2, joystick.top + joystick.height / 2);
    assert.equal(layout.fire!.scale, 1.5);
    for (const mode of ['joystick', 'button'] as const) {
        const fire = getTouchControlRect('fire', {}, bounds, mode);
        const aim = getTouchControlRect('aim', {}, bounds, mode);
        assert.ok(aim.top + aim.height + 12 <= fire.top);
    }
    for (const id of ['grapple', 'hover', 'aim', 'jump'] as const) {
        assert.deepEqual(getTouchControlRect(id, {}, bounds, 'joystick'), getTouchControlRect(id, {}, bounds, 'button'));
    }
});
