import test from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_KEYBINDS, DEFAULT_CROSSHAIR, BIND_ACTIONS, assignKey, gameplayCode, readKeybinds, readCrosshair, crosshairSvg } from '../src/controlSettings.ts';
import { cloneSettings, DEFAULT_USER_SETTINGS, loadUserSettings, saveUserSettings, userSettings } from '../src/settings.ts';

test('rebinding swaps conflicts and disables the old physical key', () => {
    const swapped = assignKey(DEFAULT_KEYBINDS, 'forward', 'KeyS');
    assert.equal(gameplayCode('KeyS', swapped), 'KeyW');
    assert.equal(gameplayCode('KeyW', swapped), 'KeyS');
    const custom = assignKey(DEFAULT_KEYBINDS, 'jump', 'KeyJ');
    assert.equal(gameplayCode('KeyJ', custom), 'Space');
    assert.equal(gameplayCode('Space', custom), '');
    assert.equal(gameplayCode('Escape', custom), 'Escape');
    assert.equal(DEFAULT_KEYBINDS.jump, 'Space');
});

test('modifier sides remain equivalent and reserved keys cannot be assigned', () => {
    assert.equal(gameplayCode('ShiftRight', DEFAULT_KEYBINDS), 'ShiftLeft');
    const custom = assignKey(DEFAULT_KEYBINDS, 'jump', 'ControlRight');
    assert.equal(custom.jump, 'ControlLeft');
    assert.equal(custom.powerJump, 'Space');
    assert.deepEqual(assignKey(custom, 'jump', 'Escape'), custom);
    assert.deepEqual(assignKey(custom, 'jump', 'Tab'), custom);
});

test('stored keybinds round-trip permutations and sanitize malformed input', () => {
    let bindings = { ...DEFAULT_KEYBINDS };
    for (const [action, , code] of [...BIND_ACTIONS].reverse()) bindings = assignKey(bindings, 'forward', code);
    assert.deepEqual(readKeybinds(JSON.parse(JSON.stringify(bindings))), bindings);
    const malformed = readKeybinds({ jump: 'Escape', forward: '<bad>', hover: null, aim: 'KeyW' });
    assert.equal(new Set(Object.values(malformed)).size, BIND_ACTIONS.length);
    assert.equal(malformed.jump, 'Space');
    assert.deepEqual(readKeybinds(null), DEFAULT_KEYBINDS);
});

test('draft edits and reset never mutate applied settings or defaults', () => {
    const draft = cloneSettings(DEFAULT_USER_SETTINGS);
    draft.keybinds.jump = 'KeyJ';
    draft.crosshair.color = '#00ff00';
    assert.equal(DEFAULT_USER_SETTINGS.keybinds.jump, 'Space');
    assert.equal(DEFAULT_USER_SETTINGS.crosshair.color, '#ff0055');
    const applied = cloneSettings(draft);
    draft.crosshair.size = 42;
    assert.equal(applied.crosshair.size, DEFAULT_CROSSHAIR.size);
});

test('crosshair bounds and SVG reject invalid stored data', () => {
    const settings = readCrosshair({ size: 999, gap: -1, thickness: NaN, opacity: 0, style: 'bad', color: '"><script>', outline: 'true' });
    assert.equal(settings.size, 48);
    assert.equal(settings.gap, 0);
    assert.equal(settings.thickness, 2);
    assert.equal(settings.opacity, 0.1);
    assert.equal(settings.style, 'ring');
    assert.equal(settings.color, '#ff0055');
    assert.equal(settings.shadow, false);
    for (const style of ['ring', 'dot', 'cross'] as const) {
        const svg = crosshairSvg({ ...DEFAULT_CROSSHAIR, style, shadow: true, centerDot: true });
        assert.ok(svg.includes('<svg'));
        assert.ok(!svg.includes('NaN'));
        assert.ok(svg.includes('data-layer="shadow"'));
        assert.ok(svg.includes('#101820'));
    }
});

test('legacy storage retains existing values and adds new defaults; new settings persist', () => {
    const previousStorage = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
    const previousSettings = cloneSettings(userSettings);
    let raw = JSON.stringify({ sensitivity: 2, fov: 90, shadows: false });
    Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: {
        getItem: () => raw, setItem: (_key: string, value: string) => { raw = value; },
    } });
    try {
        loadUserSettings();
        assert.equal(userSettings.sensitivity, 2);
        assert.equal(userSettings.fov, 90);
        assert.equal(userSettings.shadows, false);
        assert.equal(userSettings.muzzleFlashes, true);
        assert.equal(userSettings.muzzleFlashOpacity, 1);
        assert.deepEqual(userSettings.keybinds, DEFAULT_KEYBINDS);
        assert.deepEqual(userSettings.crosshair, DEFAULT_CROSSHAIR);
        userSettings.keybinds = assignKey(userSettings.keybinds, 'jump', 'KeyJ');
        userSettings.crosshair = { ...DEFAULT_CROSSHAIR, style: 'cross', color: '#00ffff' };
        userSettings.muzzleFlashOpacity = 0.35;
        saveUserSettings();
        Object.assign(userSettings, cloneSettings(DEFAULT_USER_SETTINGS));
        loadUserSettings();
        assert.equal(userSettings.keybinds.jump, 'KeyJ');
        assert.equal(userSettings.crosshair.style, 'cross');
        assert.equal(userSettings.crosshair.color, '#00ffff');
        assert.equal(userSettings.muzzleFlashOpacity, 0.35);
    } finally {
        Object.assign(userSettings, previousSettings);
        if (previousStorage) Object.defineProperty(globalThis, 'localStorage', previousStorage);
        else Reflect.deleteProperty(globalThis, 'localStorage');
    }
});


test('legacy outline and center dot appearance migrate to independent controls', () => {
    const saved = readCrosshair({ outline: true, centerDot: true, color: '#12abcd', thickness: 4, opacity: 0.6 });
    assert.equal(saved.shadow, true);
    assert.equal(saved.shadowThickness, 1);
    assert.equal(saved.shadowOpacity, 0.6);
    assert.equal(saved.centerDotSize, 12);
    assert.equal(saved.centerDotColor, '#12abcd');
    assert.equal(saved.centerDotOpacity, 0.6);
    assert.equal(readCrosshair({ shadow: false, outline: true }).shadow, false);
});

test('shadow and center dot retain independent colors, sizes and opacity', () => {
    const settings = { ...DEFAULT_CROSSHAIR, style: 'cross' as const, shadow: true, centerDot: true,
        shadowThickness: 3, shadowColor: '#112233', shadowOpacity: 0.35,
        centerDotSize: 10, centerDotColor: '#abcdef', centerDotOpacity: 0.75, opacity: 0.2 };
    assert.deepEqual(readCrosshair(JSON.parse(JSON.stringify(settings))), settings);
    const svg = crosshairSvg(settings);
    assert.match(svg, /data-layer="shadow" opacity="0.35"/);
    assert.match(svg, /stroke="#112233" stroke-width="8"/);
    assert.match(svg, /r="8" fill="#112233"/);
    assert.match(svg, /data-layer="center-dot" opacity="0.75"><circle cx="40" cy="40" r="5" fill="#abcdef"/);
    assert.match(svg, /data-layer="reticle" opacity="0.2"/);
    assert.ok(!crosshairSvg({ ...settings, shadow: false }).includes('data-layer="shadow"'));
    assert.ok(!crosshairSvg({ ...settings, centerDot: false }).includes('data-layer="center-dot"'));
});

test('invalid layer controls use defaults and safe bounds', () => {
    const saved = readCrosshair({ shadowThickness: 999, shadowColor: 'bad', shadowOpacity: -1,
        centerDotSize: -3, centerDotColor: '"><script>', centerDotOpacity: 10 });
    assert.equal(saved.shadowThickness, 8);
    assert.equal(saved.shadowColor, DEFAULT_CROSSHAIR.shadowColor);
    assert.equal(saved.shadowOpacity, 0);
    assert.equal(saved.centerDotSize, 1);
    assert.equal(saved.centerDotColor, DEFAULT_CROSSHAIR.centerDotColor);
    assert.equal(saved.centerDotOpacity, 1);
});
