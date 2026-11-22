import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {
    createBiomeField,
    createBiomeMapTexture,
    getDominantBiome,
    sampleBiomeBarkColor,
    sampleBiomeBushColor,
    sampleBiomeFogMultiplier,
    sampleBiomeLeafColor,
    sampleBiomeSkyTint,
    type BiomeId,
    type BiomeWeights,
} from '../src/biomes.ts';
import { BIOME_FOG_MULTIPLIER, BIOME_MAP_SIZE, TOWN_HALF_SIZE } from '../src/config.ts';

const SEEDS = [0, 1, 42, 91234];

function pureWeights(biome: BiomeId): BiomeWeights {
    return {
        warm: biome === 'warm' ? 1 : 0,
        cool: biome === 'cool' ? 1 : 0,
        sand: biome === 'sand' ? 1 : 0,
        town: 0,
    };
}

test('biome fields are deterministic per seed and differ between seeds', () => {
    const first = createBiomeField(42), repeat = createBiomeField(42), other = createBiomeField(43);
    assert.deepEqual(first.sites, repeat.sites);
    assert.notDeepEqual(first.sites, other.sites);
    for (let z = -1000; z <= 1000; z += 137) {
        for (let x = -1000; x <= 1000; x += 149) {
            assert.deepEqual(first.sample(x, z), repeat.sample(x, z));
        }
    }
    assert.equal(first.dominant(0, 0), repeat.dominant(0, 0));
});

test('every generated layout exposes all three biomes on the playable map', () => {
    for (const seed of SEEDS) {
        const field = createBiomeField(seed), found = new Set<BiomeId>(), sitesFound = new Set<BiomeId>();
        for (let z = -1000; z <= 1000; z += 20) {
            for (let x = -1000; x <= 1000; x += 20) found.add(field.dominant(x, z));
        }
        for (const site of field.sites) sitesFound.add(field.dominant(site.x, site.z));
        assert.deepEqual([...found].sort(), ['cool', 'sand', 'warm'], `seed ${seed}`);
        assert.deepEqual([...sitesFound].sort(), ['cool', 'sand', 'warm'], `seed ${seed} site cores`);
        assert.equal(field.sites.length, 5);
    }
});

test('weights stay normalized and cross biome borders smoothly', () => {
    const field = createBiomeField(42);
    for (let z = -1000; z <= 1000; z += 13) {
        for (let x = -1000; x <= 1000; x += 17) {
            const weights = field.sample(x, z);
            const total = weights.warm + weights.cool + weights.sand;
            assert.ok(Math.abs(total - 1) < 1e-12, `seed 42 weights at ${x},${z}`);
            assert.ok(weights.warm >= 0 && weights.cool >= 0 && weights.sand >= 0);
            assert.ok(weights.town >= 0 && weights.town <= 1);
        }
    }

    let largestStep = 0;
    const before = { warm: 0, cool: 0, sand: 0, town: 0 }, after = { warm: 0, cool: 0, sand: 0, town: 0 };
    for (let z = -1000; z <= 1000; z += 29) {
        for (let x = -1000; x < 1000; x += 1) {
            field.sample(x, z, before);
            field.sample(x + 1, z, after);
            largestStep = Math.max(
                largestStep,
                Math.abs(after.warm - before.warm) +
                Math.abs(after.cool - before.cool) +
                Math.abs(after.sand - before.sand),
            );
        }
    }
    assert.ok(largestStep < 0.1, `one-unit weight step ${largestStep}`);
});

test('the town interior stays neutral for fog and sky presentation', () => {
    const field = createBiomeField(7);
    const points: [number, number][] = [
        [0, 0],
        [TOWN_HALF_SIZE, TOWN_HALF_SIZE],
        [-TOWN_HALF_SIZE, 0],
        [0, -TOWN_HALF_SIZE],
    ];
    for (const [x, z] of points) {
        const weights = field.sample(x, z);
        assert.equal(weights.town, 1);
        assert.ok(Math.abs(sampleBiomeFogMultiplier(weights) - 1) < 1e-12);
        assert.equal(sampleBiomeSkyTint(weights).strength, 0);
    }
    const fading = field.sample(TOWN_HALF_SIZE + 40, 0);
    assert.ok(fading.town > 0 && fading.town < 1);
});

test('biomes continue outside the playable border with valid weights', () => {
    const field = createBiomeField(91234);
    let previous = field.sample(1000, 120);
    for (let x = 1001; x <= 1500; x += 1) {
        const weights = field.sample(x, 120);
        const total = weights.warm + weights.cool + weights.sand;
        assert.ok(Math.abs(total - 1) < 1e-12);
        assert.ok(Number.isFinite(weights.warm) && Number.isFinite(weights.cool) && Number.isFinite(weights.sand));
        const step = Math.abs(weights.warm - previous.warm) +
            Math.abs(weights.cool - previous.cool) +
            Math.abs(weights.sand - previous.sand);
        assert.ok(step < 0.1, `outer border step at ${x}`);
        previous = weights;
    }
});

test('fog multipliers follow sand < warm < cool and town neutralizes them', () => {
    assert.equal(sampleBiomeFogMultiplier(pureWeights('sand')), BIOME_FOG_MULTIPLIER.sand);
    assert.equal(sampleBiomeFogMultiplier(pureWeights('warm')), BIOME_FOG_MULTIPLIER.warm);
    assert.equal(sampleBiomeFogMultiplier(pureWeights('cool')), BIOME_FOG_MULTIPLIER.cool);
    assert.ok(BIOME_FOG_MULTIPLIER.sand < BIOME_FOG_MULTIPLIER.warm);
    assert.ok(BIOME_FOG_MULTIPLIER.warm < BIOME_FOG_MULTIPLIER.cool);

    const town = { ...pureWeights('cool'), town: 1 };
    assert.ok(Math.abs(sampleBiomeFogMultiplier(town) - 1) < 1e-12);
    assert.equal(getDominantBiome(town), 'cool');
});

test('bark, leaf and bush tints keep the biome palette distinct', () => {
    const warm = pureWeights('warm'), cool = pureWeights('cool'), sand = pureWeights('sand');
    const warmBark = sampleBiomeBarkColor(warm), coolBark = sampleBiomeBarkColor(cool), sandBark = sampleBiomeBarkColor(sand);
    assert.ok(warmBark.r >= warmBark.g && warmBark.g >= warmBark.b);
    assert.ok(coolBark.r + coolBark.g + coolBark.b < warmBark.r + warmBark.g + warmBark.b);
    assert.ok(sandBark.r + sandBark.g + sandBark.b > warmBark.r + warmBark.g + warmBark.b);

    const warmLeaf = sampleBiomeLeafColor(warm, 0.5), coolLeaf = sampleBiomeLeafColor(cool, 0.5);
    assert.ok(warmLeaf.g > warmLeaf.b);
    assert.ok(coolLeaf.g < warmLeaf.g && coolLeaf.r < warmLeaf.r);
    const darkLeaf = sampleBiomeLeafColor(warm, 0), brightLeaf = sampleBiomeLeafColor(warm, 1);
    assert.ok(brightLeaf.r > darkLeaf.r && brightLeaf.g > darkLeaf.g);

    const warmBush = sampleBiomeBushColor(warm, 0.5, false), amberBush = sampleBiomeBushColor(warm, 0.5, true);
    assert.ok(amberBush.r > warmBush.r);
    assert.ok(sampleBiomeBushColor(cool, 0.5, true).r < warmBush.r);
});

test('the baked biome map covers the visual ground with the documented texels', () => {
    const field = createBiomeField(42), texture = createBiomeMapTexture(field);
    assert.equal(texture.image.width, BIOME_MAP_SIZE);
    assert.equal(texture.image.height, BIOME_MAP_SIZE);
    assert.equal(texture.wrapS, THREE.ClampToEdgeWrapping);
    assert.equal(texture.wrapT, THREE.ClampToEdgeWrapping);
    assert.equal(texture.magFilter, THREE.LinearFilter);
    assert.equal(texture.minFilter, THREE.LinearFilter);
    assert.equal(texture.generateMipmaps, false);

    const data = texture.image.data as Uint8Array;
    const center = (BIOME_MAP_SIZE / 2 * BIOME_MAP_SIZE + BIOME_MAP_SIZE / 2) * 4;
    assert.equal(data[center + 3], 255, 'town alpha at the map centre');
    assert.ok(Math.abs(data[center] + data[center + 1] + data[center + 2] - 255) <= 1);
    texture.dispose();
});
