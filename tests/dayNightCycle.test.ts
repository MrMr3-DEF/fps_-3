import test from 'node:test';
import assert from 'node:assert/strict';
import {
    DAY_DURATION_SECONDS,
    DAY_NIGHT_CYCLE_SECONDS,
    NIGHT_DURATION_SECONDS,
    getDayNightPhase,
} from '../src/dayNightCycle.ts';
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

test('cycle calculations wrap cleanly in either direction', () => {
    assert.deepEqual(getDayNightPhase(DAY_NIGHT_CYCLE_SECONDS + 75), getDayNightPhase(75));
    assert.equal(getDayNightPhase(-1).phase, 'night');
});

test('gas lantern flicker stays subtle and deterministic', () => {
    const samples = Array.from({ length: 240 }, (_, index) => getGasLanternFlicker(index / 60, 2.3));
    assert.deepEqual(samples, Array.from({ length: 240 }, (_, index) => getGasLanternFlicker(index / 60, 2.3)));
    assert.ok(Math.min(...samples) >= 0.81);
    assert.ok(Math.max(...samples) <= 1.02);
    assert.ok(Math.max(...samples) - Math.min(...samples) > 0.08);
});
