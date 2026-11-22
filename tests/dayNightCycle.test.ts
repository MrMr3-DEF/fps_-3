import test from 'node:test';
import assert from 'node:assert/strict';
import { DAY_DURATION_SECONDS, DAY_NIGHT_CYCLE_SECONDS, NIGHT_DURATION_SECONDS, DayNightCycle, getDayNightPhase } from '../src/dayNightCycle.ts';
import type { BiomeId, BiomeWeights } from '../src/biomes.ts';
import * as THREE from 'three';

function pureWeights(biome: BiomeId, town = 0): BiomeWeights {
    return {
        warm: biome === 'warm' ? 1 : 0,
        cool: biome === 'cool' ? 1 : 0,
        sand: biome === 'sand' ? 1 : 0,
        town,
    };
}

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

test('biome sky tints differ across regions and stay neutral inside town', () => {
    const scene = new THREE.Scene();
    const cycle = new DayNightCycle(scene, { shadows: false, shadowMapSize: 1024 });
    const observer = new THREE.Vector3();
    cycle.synchronizeElapsedSeconds(DAY_DURATION_SECONDS / 2, true);
    cycle.update(0, observer);
    const neutral = (scene.background as THREE.Color).getHex();
    const tinted = new Map<BiomeId, number>();
    for (const biome of ['warm', 'cool', 'sand'] as const) {
        cycle.update(0, observer, pureWeights(biome));
        tinted.set(biome, (scene.background as THREE.Color).getHex());
    }
    assert.notEqual(tinted.get('warm'), tinted.get('cool'));
    assert.notEqual(tinted.get('warm'), tinted.get('sand'));
    assert.notEqual(tinted.get('cool'), tinted.get('sand'));
    for (const biome of ['warm', 'cool', 'sand'] as const) assert.notEqual(tinted.get(biome), neutral);

    cycle.update(0, observer, pureWeights('cool', 1));
    assert.equal((scene.background as THREE.Color).getHex(), neutral, 'the town keeps the plain sky');
    cycle.dispose();
});

test('sand biome gives a brighter yellow sun and stays neutral inside town', () => {
    const scene = new THREE.Scene();
    const cycle = new DayNightCycle(scene, { shadows: false, shadowMapSize: 1024 });
    const observer = new THREE.Vector3();
    const sunMesh = cycle.celestialScanTargets.find(target => target.key === 'sun')!.mesh;
    cycle.synchronizeElapsedSeconds(DAY_DURATION_SECONDS / 2, true);

    cycle.update(0, observer, pureWeights('warm'));
    const warmIntensity = cycle.sunLight.intensity;
    const warmLightColor = cycle.sunLight.color.clone();
    const warmDiscColor = sunMesh.material.color.clone();

    cycle.update(0, observer, pureWeights('sand'));
    assert.ok(cycle.sunLight.intensity > warmIntensity, 'sand sun light is brighter');
    assert.ok(
        cycle.sunLight.color.r >= cycle.sunLight.color.g && cycle.sunLight.color.b < warmLightColor.b,
        'sand sun light shifts warmer yellow',
    );
    assert.ok(
        sunMesh.material.color.r >= sunMesh.material.color.g && sunMesh.material.color.b < warmDiscColor.b,
        'sand sun disc shifts deeper yellow',
    );

    cycle.update(0, observer, pureWeights('sand', 1));
    assert.equal(cycle.sunLight.intensity, warmIntensity, 'town neutralizes sand sun intensity');
    assert.equal(cycle.sunLight.color.getHex(), warmLightColor.getHex(), 'town neutralizes sand sun light color');
    assert.equal(sunMesh.material.color.getHex(), warmDiscColor.getHex(), 'town neutralizes sand sun disc color');
    cycle.dispose();
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
