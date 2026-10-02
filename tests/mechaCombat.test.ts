import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { MechaCombat, classifyMechaAttack, type MechaLaserInput } from '../src/mechaCombat.ts';
import { MECHA_LASER_DAMAGE, MECHA_TORSO_YAW_SPEED } from '../src/config.ts';
import { segmentRoundedBoxHitT, cylinderIntersectsBox } from '../src/gameplayMath.ts';
import { segmentPlayerBeamHitT } from '../src/playerHitbox.ts';

function setup() {
    const damage: number[] = [];
    const combat = new MechaCombat(value => damage.push(value));
    combat.eyeRadius = 1.3; combat.orbPosition.set(0, 23, 10); combat.shieldCenter.set(0, 14.5, 0);
    const input: MechaLaserInput = { robotPosition: new THREE.Vector3(), playerPosition: new THREE.Vector3(0, 2, 60),
        playerYaw: 0, playerAlive: true, visible: true, canCharge: true, yaw: 0, obstacleDistance: () => 700 };
    function tick(seconds: number) {
        for (let elapsed = 0; elapsed < seconds - 1e-9; elapsed += 1 / 60) {
            const delta = Math.min(1 / 60, seconds - elapsed);
            combat.advanceClock(delta); combat.updateLaser(delta, input); combat.updateEffects();
        }
    }
    function fire() { tick(0.15); assert.equal(combat.laserPhase, 'charging'); tick(3); assert.equal(combat.laserPhase, 'firing'); }
    return { combat, input, damage, tick, fire };
}
test('laser requires continuous 1 degree alignment for .15s; charge takes 3s and hits immediately once', () => {
    const { combat, input, damage, tick } = setup();
    input.yaw = 2 * Math.PI / 180; tick(1); assert.equal(combat.laserPhase, 'idle');
    input.yaw = 0; tick(0.1); input.visible = false; tick(0.02); input.visible = true;
    tick(0.1); assert.equal(combat.laserPhase, 'idle'); tick(0.05); assert.equal(combat.laserPhase, 'charging');
    tick(2.99); assert.equal(combat.shotCount, 0); assert.equal(damage.length, 0);
    tick(0.01); assert.equal(combat.laserPhase, 'firing'); assert.deepEqual(damage, [MECHA_LASER_DAMAGE]);
    tick(1.1); assert.deepEqual(damage, [10]); assert.equal(combat.laserPhase, 'fading');
    assert.ok(Math.abs(combat.beamRadius - 1.3 * 0.75 / 2) < 1e-8);
    assert.equal(combat.reloadRemaining, 0); tick(0.1); assert.equal(combat.reloadRemaining, 8);
    tick(7.99); assert.equal(combat.laserPhase, 'idle'); tick(0.16); assert.equal(combat.laserPhase, 'charging');
    combat.dispose();
});
test('range and height boundaries gate acquisition, at 60–130m', () => {
    for (const [distance, y, eligible] of [[25, 2, false], [59.999, 2, false], [60, 2, true], [130, 2, true], [130.001, 2, false],
        [60, -0.001, false], [60, 0, true], [60, 28, true], [60, 28.001, false]] as const) {
        const { combat, input, tick } = setup(); input.playerPosition.set(0, y, distance); tick(0.15);
        assert.equal(combat.laserPhase, eligible ? 'charging' : 'idle', `distance ${distance}, height ${y}`); combat.dispose();
    }
});

test('attack regions meet at 25/60/28m and the upper dome is a ground-centered 130m sphere', () => {
    const ground = new THREE.Vector3(37, 12, -81);
    for (const [r, height, expected] of [[0, 0, 'stomp'], [25, 28, 'stomp'], [25.001, 28, 'rocket'],
        [59.999, 28, 'rocket'], [60, 28, 'laser'], [130, 28, 'laser'], [130.001, 28, null],
        [0, 28.001, 'rocket'], [25, 28.001, 'rocket'], [60, 28.001, 'rocket'], [128, 28.001, null],
        [120, 50, 'rocket'], [120, 50.001, null], [50, 120, 'rocket'], [50.001, 120, null],
        [0, 130, 'rocket'], [0, 130.001, null], [100, 100, null], [0, -0.001, null]] as const) {
        const player = ground.clone().add(new THREE.Vector3(r, height, 0));
        assert.equal(classifyMechaAttack(ground, player), expected, `radius ${r}, height ${height}`);
    }
});
test('only lost LOS or life cancels a committed charge with no shot or reload', () => {
    for (const cause of ['sight', 'life']) {
        const { combat, input, damage, tick } = setup(); tick(1.5);
        if (cause === 'sight') input.visible = false;
        if (cause === 'life') input.playerAlive = false;
        if (cause === 'height') input.playerPosition.y = 29;
        if (cause === 'stomp') input.canCharge = false;
        if (cause === 'close') input.playerPosition.z = 25;
        tick(0.01); assert.equal(combat.laserPhase, 'cancelling'); tick(0.2);
        assert.equal(combat.laserPhase, 'idle'); assert.equal(combat.shotCount, 0); assert.equal(combat.reloadRemaining, 0);
        assert.equal(damage.length, 0); combat.dispose();
    }
});
test('charging tolerates horizontal lag and pitches automatically; fired origin and angles stay fixed', () => {
    const { combat, input, damage, tick } = setup(); tick(0.15);
    input.playerPosition.set(60, 28, 0); input.yaw = 0.2; tick(3);
    assert.equal(combat.laserPhase, 'firing'); assert.equal(damage.length, 0);
    assert.ok(Math.abs(Math.atan2(combat.beamDirection.x, combat.beamDirection.z) - 0.2) < 1e-9);
    assert.ok(combat.beamDirection.y > 0);
    const direction = combat.beamDirection.clone(), origin = combat.beamOrigin.clone();
    input.yaw = 1.5; input.playerPosition.set(90, 2, 0); combat.orbPosition.set(15, 15, 15); tick(0.3);
    assert.deepEqual(combat.beamDirection.toArray(), direction.toArray()); assert.deepEqual(combat.beamOrigin.toArray(), origin.toArray());
    combat.dispose();
});
test('airborne players are hit and physical reach persists past detection after firing', () => {
    const { combat, input, damage, fire, tick } = setup(); input.playerPosition.y = 23;
    // Fire in the wrong yaw so the first-frame target is missed.
    tick(0.15); input.playerPosition.set(60, 23, 0); tick(3); assert.equal(damage.length, 0);
    input.playerPosition.set(0, 23, 600); input.visible = false; tick(0.01);
    assert.deepEqual(damage, [10]); assert.equal(combat.beamLength, 700); combat.dispose();
    const airborne = setup(); airborne.input.playerPosition.y = 28; airborne.fire(); assert.deepEqual(airborne.damage, [10]); airborne.combat.dispose();
});
test('range, height and priority changes do not cancel a charge; fired beam damages in close range', () => {
    const { combat, input, damage, tick } = setup(); tick(0.15);
    input.playerPosition.set(0, 23, 25); input.canCharge = false; tick(3);
    assert.equal(combat.laserPhase, 'firing'); assert.equal(combat.shotCount, 1); assert.deepEqual(damage, [10]);
    input.playerPosition.set(0, 29, 150); tick(0.1); assert.equal(combat.laserPhase, 'firing');
    tick(1.1); assert.equal(combat.reloadRemaining, 8); combat.dispose();
});
test('normal fade still damages with its shrinking radius; world obstacles truncate beam volume', () => {
    const { combat, input, damage, tick } = setup(); input.playerPosition.y = 23;
    tick(0.15); input.playerPosition.set(60, 23, 0); tick(4.05); assert.equal(combat.laserPhase, 'fading');
    input.playerPosition.set(0, 23, 60); tick(0.01); assert.deepEqual(damage, [10]); combat.dispose();
    const blocked = setup(); blocked.input.obstacleDistance = () => 30; blocked.fire();
    assert.equal(blocked.combat.beamLength, 30); assert.equal(blocked.damage.length, 0); blocked.combat.dispose();
});
test('shield intercepts a true 17m sphere, allows inside origins, and impacts consume no energy', () => {
    const { combat } = setup();
    const start = new THREE.Vector3(0, 14.5, 60), end = new THREE.Vector3(0, 14.5, 0);
    assert.ok(Math.abs(combat.shieldContactT(start, end, start)! - 43 / 60) < 1e-9);
    assert.equal(combat.shieldContactT(start, end, end), null, 'original inside origin survives steering');
    assert.equal(combat.shieldContactT(new THREE.Vector3(17.01, 14.5, 60), new THREE.Vector3(17.01, 14.5, -60), start), null);
    assert.equal(combat.isInsideShield(new THREE.Vector3(0, -2.5, 0)), true, 'sphere clips ground');
    for (let i = 0; i < 100; i++) combat.shieldImpact(new THREE.Vector3(0, 14.5, 17));
    assert.equal(combat.shotCount, 0); assert.equal(combat.shieldActive, true); combat.dispose();
});
test('fourth mixed ranged release triggers warning after fade, then shield drop, 5s freeze and .5s rebuild', () => {
    const { combat, input, fire, tick } = setup(); fire(); tick(1.2);
    for (let i = 0; i < 2; i++) { combat.recordRangedShot(); combat.finishRangedAttack(); }
    assert.equal(combat.shotCount, 3); assert.equal(combat.shieldPhase, 'powered');
    tick(8.15); tick(3);
    assert.equal(combat.shotCount, 4); assert.equal(combat.shieldPhase, 'powered'); tick(1.2);
    assert.equal(combat.shieldPhase, 'warning'); assert.equal(combat.blocksNewAttacks, true); assert.equal(combat.shieldActive, true);
    input.canCharge = false; tick(1); assert.equal(combat.eyePower, 0); tick(0.15); assert.equal(combat.eyePower, 1);
    tick(0.15); assert.equal(combat.eyePower, 0); tick(0.15); assert.equal(combat.eyePower, 1);
    tick(0.15); assert.equal(combat.shieldPhase, 'down'); assert.equal(combat.shieldActive, false); assert.equal(combat.frozen, true);
    tick(0.3); assert.ok(combat.eyePower < 1e-8); tick(4.699); assert.equal(combat.shieldPhase, 'down');
    tick(0.001); assert.equal(combat.shieldPhase, 'rebuilding');
    tick(0.25); assert.ok(Math.abs(combat.eyePower - 0.5) < 1e-8); assert.equal(combat.shieldActive, false);
    tick(0.25); assert.equal(combat.shieldPhase, 'powered'); assert.equal(combat.shotCount, 0); assert.equal(combat.frozen, false); combat.dispose();
});
test('rolling firing history uses simulation seconds and expires only outside the 60s window', () => {
    const { combat, input, fire, tick } = setup(); fire(); input.visible = false; tick(1.2);
    combat.advanceClock(58.8); assert.equal(combat.shotCount, 1); combat.advanceClock(0.001); assert.equal(combat.shotCount, 0);
    input.visible = true; fire(); assert.equal(combat.shotCount, 1); tick(1.2); assert.equal(combat.shieldPhase, 'powered'); combat.dispose();
});
test('pause does not advance clocks or effects; death cancels damage and can never recover', () => {
    const { combat, input, fire, tick, damage } = setup(); fire(); tick(1.2); combat.recordRangedShot(); combat.recordRangedShot(); tick(8.15); tick(4.2); tick(1.6);
    assert.equal(combat.shieldPhase, 'down'); const clock = combat.clock;
    combat.advanceClock(0); combat.updateLaser(0, input); assert.equal(combat.clock, clock); assert.equal(combat.shieldPhase, 'down');
    combat.stop(); const before = damage.length; tick(30);
    assert.equal(combat.shieldPhase, 'disabled'); assert.equal(combat.shieldActive, false); assert.equal(combat.laserPhase, 'idle'); assert.equal(damage.length, before);
    assert.ok(combat.effects.group.children.every(child => !child.visible)); combat.dispose();
});
test('fixed torso cap lets walking at 50m and farther keep up; a closer circle and grapple outrun it', () => {
    assert.ok(MECHA_TORSO_YAW_SPEED >= 18.261 / 50);
    assert.ok(MECHA_TORSO_YAW_SPEED > 18.261 / 75);
    assert.ok(MECHA_TORSO_YAW_SPEED < 18.261 / 30);
    assert.ok(MECHA_TORSO_YAW_SPEED < 70 / 50);
});
test('thick beam uses rounded box edges and cannot hit a body beyond its physical endpoint', () => {
    const min = { x: -1, y: -1, z: -1 }, max = { x: 1, y: 1, z: 1 };
    assert.equal(segmentRoundedBoxHitT({ x: 1.8, y: 1.8, z: -10 }, { x: 1.8, y: 1.8, z: 10 }, min, max, 1), null);
    assert.notEqual(segmentRoundedBoxHitT({ x: 1.6, y: 1.6, z: -10 }, { x: 1.6, y: 1.6, z: 10 }, min, max, 1), null);
    assert.equal(segmentPlayerBeamHitT({ x: 0, y: 23, z: 0 }, { x: 0, y: 23, z: 700 }, { x: 0, y: 23, z: 701.2 }, 0, 1), null);
    const start = { x: 0, y: 0, z: 0 }, end = { x: 0, y: 0, z: 10 };
    assert.equal(cylinderIntersectsBox(start, end, { x: -0.1, y: -0.1, z: 10.1 }, { x: 0.1, y: 0.1, z: 10.2 }, 1), false, 'flat cap has no capsule extension');
    assert.equal(cylinderIntersectsBox(start, end, { x: -0.1, y: -0.1, z: 9.9 }, { x: 0.1, y: 0.1, z: 10.2 }, 1), true);
    assert.equal(cylinderIntersectsBox({ x: 0, y: 0, z: 0 }, { x: 0, y: 10, z: 0 }, min, max, 0.1), true, 'vertical axis projection');
    assert.equal(cylinderIntersectsBox(start, { x: 10, y: 10, z: 10 }, { x: 4, y: 4, z: 4 }, { x: 6, y: 6, z: 6 }, 0.1), true, 'pitched diagonal crosses box interior');
});
