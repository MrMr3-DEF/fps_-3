import test from 'node:test';
import assert from 'node:assert/strict';
import { DAY_DURATION_SECONDS, DAY_NIGHT_CYCLE_SECONDS, NIGHT_DURATION_SECONDS, DayNightCycle, getDayNightPhase } from '../src/dayNightCycle.ts';
import * as THREE from 'three';

test('day/night transitions follow configured durations', () => {
    assert.equal(DAY_NIGHT_CYCLE_SECONDS, DAY_DURATION_SECONDS + NIGHT_DURATION_SECONDS);

    assert.equal(getDayNightPhase(0).phase, 'day');
    assert.equal(getDayNightPhase(DAY_DURATION_SECONDS - 0.001).phase, 'day');
    assert.equal(getDayNightPhase(DAY_DURATION_SECONDS).phase, 'night');
    assert.equal(getDayNightPhase(DAY_NIGHT_CYCLE_SECONDS - 0.001).phase, 'night');
    assert.equal(getDayNightPhase(DAY_NIGHT_CYCLE_SECONDS).phase, 'day');
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
