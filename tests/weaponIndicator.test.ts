import test from 'node:test';
import assert from 'node:assert/strict';
import { WeaponIndicator, selectedWeaponIcon } from '../src/weaponIndicator.ts';

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
    indicator.update('MINIGUN', 'stomp'); assert.equal(node.dataset.weapon, 'STOMP');
    assert.equal(node.attributes['aria-label'], 'Selected weapon: Mecha stomp');
    indicator.update('MINIGUN', false); assert.equal(node.dataset.weapon, 'MINIGUN');
    indicator.reset(); assert.equal(html, ''); assert.equal(node.dataset.weapon, undefined);
    indicator.update('PISTOL', false); assert.equal(node.dataset.weapon, 'PISTOL');
    assert.equal(selectedWeaponIcon('unknown', false), 'PISTOL');
});
