import test from 'node:test';
import assert from 'node:assert/strict';
import { WeaponIndicator, selectedWeaponIcon } from '../src/weaponIndicator.ts';
import { WEAPON_INDICATOR_ICONS } from '../src/weaponIndicatorIcons.ts';
import { getTouchControlRect, getWeaponIndicatorTouchBottom, type TouchLayout } from '../src/mobileControlLayout.ts';

test('all five weapons and the rocket have distinct, flat vector silhouettes', () => {
    const icons = Object.values(WEAPON_INDICATOR_ICONS);
    assert.equal(icons.length, 6);
    assert.equal(new Set(icons.map(icon => icon.svg)).size, 6);
    for (const { svg } of icons) {
        assert.match(svg, /fill="#fff"/);
        const dimensions = svg.match(/viewBox="([^"]+)"/)![1].split(' ').map(Number);
        assert.equal(dimensions.length, 4);
        assert.ok(dimensions.every(Number.isFinite));
        assert.ok(dimensions[2] > 0 && dimensions[3] > 0);
        assert.match(svg, /<path d="M/);
        assert.doesNotMatch(svg, /<image|<text|filter=|gradient|NaN|Infinity/);
    }
});

test('indicator caches its current SVG and restores the equipped gun after mecha release/reset', () => {
    let html = '', writes = 0;
    const node = { dataset: {} as Record<string, string>, attributes: {} as Record<string, string>,
        get innerHTML() { return html; }, set innerHTML(value: string) { html = value; writes++; },
        setAttribute(key: string, value: string) { this.attributes[key] = value; },
        replaceChildren() { html = ''; },
    };
    const indicator = new WeaponIndicator(node as unknown as HTMLElement);
    for (const kind of ['PISTOL', 'SHOTGUN', 'AR', 'SNIPER', 'MINIGUN']) {
        indicator.update(kind, false); assert.equal(node.dataset.weapon, kind);
    }
    const before = writes;
    for (let frame = 0; frame < 120; frame++) indicator.update('MINIGUN', false);
    assert.equal(writes, before);
    indicator.update('MINIGUN', true); assert.equal(node.dataset.weapon, 'ROCKET');
    assert.equal(node.attributes['aria-label'], 'Selected weapon: Mecha rocket');
    indicator.update('MINIGUN', false); assert.equal(node.dataset.weapon, 'MINIGUN');
    indicator.reset(); assert.equal(html, ''); assert.equal(node.dataset.weapon, undefined);
    indicator.update('PISTOL', false); assert.equal(node.dataset.weapon, 'PISTOL');
    assert.equal(selectedWeaponIcon('unknown', false), 'PISTOL');
});

test('touch weapon panel clears the actual action cluster and preserves saved controls', () => {
    const layout: TouchLayout = { aim: { x: 0.82, y: 0.65, scale: 1.2 } };
    const before = structuredClone(layout);
    for (const bounds of [{ width: 821, height: 400, left: 0, right: 0, top: 0, bottom: 0 },
        { width: 844, height: 390, left: 44, right: 21, top: 0, bottom: 21 }]) {
        for (const mode of ['button', 'joystick'] as const) {
            const bottom = getWeaponIndicatorTouchBottom(layout, bounds, 44, mode);
            const panelTop = bounds.height - bottom - 44;
            const actionTop = Math.min(...(['fire', 'jump', 'aim', 'hover', 'grapple'] as const)
                .map(id => getTouchControlRect(id, layout, bounds, mode).top));
            assert.equal(panelTop + 44 + 10, actionTop);
            assert.ok(panelTop >= bounds.top);
            assert.ok(bottom >= bounds.bottom);
        }
    }
    assert.deepEqual(layout, before);
    const bounds = { width: 568, height: 320, left: 0, right: 34, top: 12, bottom: 21 };
    const bottom = getWeaponIndicatorTouchBottom({ fire: { x: 1, y: 0, scale: 2.5 } }, bounds, 44, 'joystick');
    assert.equal(bounds.height - bottom - 44, bounds.top, 'extreme custom controls never push the panel outside the safe top');
});
