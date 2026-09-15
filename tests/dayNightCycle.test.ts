import test from 'node:test';
import assert from 'node:assert/strict';
import {
    DAY_DURATION_SECONDS,
    DAY_NIGHT_CYCLE_SECONDS,
    MOON_MEAN_DISTANCE_KM,
    NIGHT_DURATION_SECONDS,
    SUN_MEAN_DISTANCE_KM,
    DayNightCycle,
    getCelestialOrbitalElevation,
    getDayNightPhase,
} from '../src/dayNightCycle.ts';
import * as THREE from 'three';
import { getGasLanternFlicker } from '../src/world.ts';

test('day lasts five minutes and night lasts three minutes', () => {
    assert.equal(DAY_DURATION_SECONDS, 300);
    assert.equal(NIGHT_DURATION_SECONDS, 180);
    assert.equal(DAY_NIGHT_CYCLE_SECONDS, 480);

    assert.equal(getDayNightPhase(0).phase, 'day');
    assert.equal(getDayNightPhase(DAY_DURATION_SECONDS - 0.001).phase, 'day');
    assert.equal(getDayNightPhase(DAY_DURATION_SECONDS).phase, 'night');
    assert.equal(getDayNightPhase(DAY_NIGHT_CYCLE_SECONDS - 0.001).phase, 'night');
    assert.equal(getDayNightPhase(DAY_NIGHT_CYCLE_SECONDS).phase, 'day');
});

test('celestial scans report rounded mean distances from Earth', () => {
    assert.equal(SUN_MEAN_DISTANCE_KM, 149_600_000);
    assert.equal(MOON_MEAN_DISTANCE_KM, 384_400);
});

test('sun and moon each cross their sky arc from horizon to peak to horizon', () => {
    const morning = getDayNightPhase(0);
    const noon = getDayNightPhase(DAY_DURATION_SECONDS / 2);
    const sunset = getDayNightPhase(DAY_DURATION_SECONDS - 0.001);
    assert.ok(morning.elevation < 0.001);
    assert.ok(Math.abs(noon.elevation - 1) < 1e-12);
    assert.ok(sunset.elevation < 0.001);

    const moonrise = getDayNightPhase(DAY_DURATION_SECONDS);
    const midnight = getDayNightPhase(DAY_DURATION_SECONDS + NIGHT_DURATION_SECONDS / 2);
    const moonset = getDayNightPhase(DAY_NIGHT_CYCLE_SECONDS - 0.001);
    assert.ok(moonrise.elevation < 0.001);
    assert.ok(Math.abs(midnight.elevation - 1) < 1e-12);
    assert.ok(moonset.elevation < 0.001);
});

test('celestial arcs begin and end fully below the horizon', () => {
    assert.ok(getCelestialOrbitalElevation(0) < 0);
    assert.ok(Math.abs(getCelestialOrbitalElevation(1) - 1) < 1e-12);

    const scene = new THREE.Scene();
    const cycle = new DayNightCycle(scene, { shadows: false, shadowMapSize: 1024 });
    const observer = new THREE.Vector3(0, 10, 0);
    const sun = cycle.celestialScanTargets.find((target) => target.key === 'sun')!.mesh;
    const moon = cycle.celestialScanTargets.find((target) => target.key === 'moon')!.mesh;

    cycle.update(DAY_DURATION_SECONDS - 0.001, observer);
    assert.equal(sun.visible, true);
    assert.ok(sun.position.y + sun.scale.y < observer.y);

    const nightStrength = cycle.update(0.001, observer);
    assert.equal(sun.visible, false);
    assert.equal(moon.visible, true);
    assert.ok(moon.position.y + moon.scale.y < observer.y);
    assert.equal(cycle.moonLight.intensity, 0);
    assert.equal(nightStrength, 1);

    cycle.dispose();

    const resetCycle = new DayNightCycle(scene, { shadows: false, shadowMapSize: 1024 });
    const resetSun = resetCycle.celestialScanTargets.find((target) => target.key === 'sun')!.mesh;
    const resetMoon = resetCycle.celestialScanTargets.find((target) => target.key === 'moon')!.mesh;
    assert.equal(resetSun.visible, true);
    assert.equal(resetMoon.visible, false);
    assert.ok(resetSun.position.y + resetSun.scale.y < 0);
    assert.equal(resetCycle.sunLight.intensity, 0);
    resetCycle.dispose();
});

test('cycle calculations wrap cleanly in either direction', () => {
    assert.deepEqual(getDayNightPhase(DAY_NIGHT_CYCLE_SECONDS + 75), getDayNightPhase(75));
    assert.equal(getDayNightPhase(-1).phase, 'night');
});

test('room clock synchronization snaps large drift and ignores network jitter', () => {
    const scene = new THREE.Scene();
    const cycle = new DayNightCycle(scene, { shadows: false, shadowMapSize: 1024 });
    const observer = new THREE.Vector3();
    cycle.update(30, observer);
    cycle.synchronizeElapsedSeconds(30.1);
    assert.equal(cycle.elapsedTimeSeconds, 30, 'sub-quarter-second latency does not rewind the sky');
    cycle.synchronizeElapsedSeconds(90);
    assert.equal(cycle.elapsedTimeSeconds, 90, 'meaningful drift follows the host');
    cycle.synchronizeElapsedSeconds(12, true);
    assert.equal(cycle.elapsedTimeSeconds, 12, 'join snapshots apply immediately');
    cycle.dispose();
});

test('gas lantern flicker stays subtle and deterministic', () => {
    const samples = Array.from({ length: 240 }, (_, index) => getGasLanternFlicker(index / 60, 2.3));
    assert.deepEqual(samples, Array.from({ length: 240 }, (_, index) => getGasLanternFlicker(index / 60, 2.3)));
    assert.ok(Math.min(...samples) >= 0.81);
    assert.ok(Math.max(...samples) <= 1.02);
    assert.ok(Math.max(...samples) - Math.min(...samples) > 0.08);
});
