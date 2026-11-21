import test from 'node:test';
import assert from 'node:assert/strict';
import { WeaponHandling } from '../src/weaponHandling.ts';
import { GRAPPLE_DRAW_TIME, HEAVY_HANDOFF_TIME } from '../src/config.ts';

test('one shotgun blast spends one shell, partial reloads require the complete deadline and survive neither cancel nor switch', () => {
    const h = new WeaponHandling();
    assert.ok(h.spendShot('SHOTGUN', 0));
    assert.equal(h.rounds.SHOTGUN, 11);
    assert.ok(h.beginReload('SHOTGUN', .6));
    assert.equal(h.spendShot('SHOTGUN', 2.9), false);
    h.interrupt('SHOTGUN', 3);
    assert.equal(h.rounds.SHOTGUN, 11);
    assert.ok(h.beginReload('SHOTGUN', 4));
    assert.equal(h.queuedReload, 'SHOTGUN');
    h.advance(6.499 + GRAPPLE_DRAW_TIME);
    assert.equal(h.rounds.SHOTGUN, 11);
    h.advance(6.5 + GRAPPLE_DRAW_TIME);
    assert.equal(h.hand, 'drawing');
    assert.equal(h.takeLaunch(7.5), false);
    assert.equal(h.hand, 'drawn');
    assert.equal(h.rounds.SHOTGUN, 12);
});

test('an empty magazine stays empty until manual reload, then charges from its existing stage', () => {
    const h = new WeaponHandling();
    for (let i=0; i<15; ++i) assert.ok(h.spendShot('PISTOL', i));
    assert.equal(h.spendShot('PISTOL', 80), false);
    assert.equal(h.reload, null);
    assert.equal(h.chargeStage('PISTOL', 80), 0);
    assert.ok(h.beginReload('PISTOL', 80));
    assert.ok(h.chargeStage('PISTOL', 81) > 0);
    assert.equal(h.rounds.PISTOL, 0);
    h.advance(81.5);
    assert.equal(h.rounds.PISTOL, 15);
});

test('a partial reload keeps its remaining fill on extraction, including on an observer and after interruption', () => {
    const owner = new WeaponHandling(), observer = new WeaponHandling();
    for (const [rounds, expected] of [[0,0], [1,1], [26,1], [50,2], [75,3], [99,3], [100,4]]) {
        owner.rounds.MINIGUN = rounds;
        assert.equal(owner.chargeStage('MINIGUN', 0), expected);
    }
    owner.rounds.MINIGUN = 99;
    assert.ok(owner.beginReload('MINIGUN', 10));
    observer.restore(owner.snapshot(11.5), 50);
    assert.equal(owner.chargeStage('MINIGUN', 11.5), 3);
    assert.equal(observer.chargeStage('MINIGUN', 50), 3);
    assert.equal(owner.chargeStage('MINIGUN', 13.5), 4, 'cell charges before the drawer seats');
    owner.interrupt('MINIGUN', 13.5);
    assert.equal(owner.chargeStage('MINIGUN', 13.5), 3);
    assert.equal(owner.rounds.MINIGUN, 99);
});

test('real heavy discharge extends the draw; cancellation and stale updates never launch a second hook', () => {
    const h = new WeaponHandling();
    h.spendShot('AR', 1);
    h.pressGrapple('AR', 1.1);
    assert.equal(h.takeLaunch(1.21), false);
    h.pressGrapple('AR', 1.22);
    assert.equal(h.takeLaunch(2), false);
    h.pressGrapple('AR', 3);
    const drawing = h.snapshot(3.05);
    const deadline = 3 + GRAPPLE_DRAW_TIME;
    h.restore({...drawing, hand:'drawn', handAge:0, handRemaining:0}, 3.06);
    assert.equal(h.takeLaunch(deadline - .001), false, 'early confirmation cannot skip the rest of the draw');
    assert.ok(h.takeLaunch(deadline));
    h.restore(drawing, deadline + .01);
    assert.equal(h.takeLaunch(4), false);
    assert.ok(h.spendShot('SHOTGUN', 4));
    assert.equal(h.spendShot('AR', 4), false);
    assert.ok(h.requestHeavyFire('AR', 4));
    assert.equal(h.requestHeavyFire('AR', 4.1), false);
    assert.equal(h.spendShot('AR', 4 + HEAVY_HANDOFF_TIME - .001), false);
    assert.ok(h.spendShot('AR', 4 + HEAVY_HANDOFF_TIME));
    assert.equal(h.pendingFire, null);
});

test('a reload press leaves the whole grapple handoff intact and requires a fresh press after return', () => {
    const h = new WeaponHandling();
    h.spendShot('SNIPER', 0);
    h.pressGrapple('SNIPER', 2);
    assert.equal(h.beginReload('SNIPER', 2.05), false);
    assert.ok(h.takeLaunch(2 + GRAPPLE_DRAW_TIME), 'the ignored press preserves the launch');
    assert.equal(h.beginReload('SNIPER', 2 + GRAPPLE_DRAW_TIME + .01, true), false);
    assert.equal(h.hand, 'drawn');
    h.requestHeavyFire('SNIPER', 3);
    assert.equal(h.beginReload('SNIPER', 3.1), false);
    assert.equal(h.pendingFire, 'SNIPER');
    assert.ok(h.spendShot('SNIPER', 3 + HEAVY_HANDOFF_TIME));
    h.advance(8);
    assert.equal(h.rounds.SNIPER, 6);
    assert.equal(h.reload, null);
    assert.ok(h.beginReload('SNIPER', 8));
    h.advance(10.99);
    assert.equal(h.rounds.SNIPER, 6);
    h.advance(11);
    assert.equal(h.rounds.SNIPER, 8);
});

test('each held-launcher shot costs one input and equipping never fires the launcher', () => {
    const h = new WeaponHandling('PISTOL');
    assert.equal(h.hand, 'drawn');
    assert.equal(h.takeLaunch(0), false);
    h.equip('SHOTGUN', 1);
    assert.ok(h.pressGrapple('SHOTGUN', 1));
    assert.ok(h.takeLaunch(1));
    assert.equal(h.takeLaunch(1.1), false);
    h.releaseGrapple('SHOTGUN', 2);
    assert.equal(h.hand, 'drawn');
    assert.ok(h.pressGrapple('SHOTGUN', 2.1));
    assert.ok(h.takeLaunch(2.1));

    h.equip('SNIPER', 3);
    assert.ok(h.requestHeavyFire('SNIPER', 3.1, true));
    assert.equal(h.spendShot('SNIPER', 3.3), false, 'primary switch finished before the left hand returned');
    assert.ok(h.spendShot('SNIPER', 3 + HEAVY_HANDOFF_TIME));
    assert.equal(h.pendingFire, null);
    h.equip('PISTOL', 4);
    assert.ok(h.pressGrapple('PISTOL', 4.1));
    assert.ok(h.releaseGrapple('PISTOL', 4.2));
    assert.equal(h.takeLaunch(4.5), false);
    assert.equal(h.hand, 'drawn');
});

test('a late observer advances a queued manual reload through stow, refill and passive redraw', () => {
    const owner = new WeaponHandling('PISTOL'), observer = new WeaponHandling();
    owner.spendShot('PISTOL', 0);
    assert.ok(owner.beginReload('PISTOL', 1));
    assert.equal(owner.spendShot('PISTOL', 1.1), false);
    observer.restore(owner.snapshot(1.1), 5);
    const stowed = 5 + GRAPPLE_DRAW_TIME - .1;
    observer.advance(stowed + .05);
    assert.equal(observer.rounds.PISTOL, 14);
    assert.equal(observer.reload?.weapon, 'PISTOL');
    assert.equal(observer.takeLaunch(stowed + 2.5), false);
    assert.equal(observer.hand, 'drawn');
    assert.equal(observer.rounds.PISTOL, 15);
});

test('heavy grapple mode changes grip without queuing a hook or a shot', () => {
    const h = new WeaponHandling('AR');
    assert.equal(h.toggleGrappleMode('AR', 0), true);
    assert.equal(h.takeLaunch(1), false);
    assert.equal(h.hand, 'drawn');
    assert.equal(h.canFire('AR', 1), false);
    assert.ok(h.pressGrapple('AR', 1));
    assert.ok(h.toggleGrappleMode('AR', 1));
    assert.equal(h.takeLaunch(2), false);
    assert.equal(h.canFire('AR', 2), true);
    assert.equal(h.pendingFire, null);
    assert.equal(h.toggleGrappleMode('SHOTGUN', 2), false);
});
