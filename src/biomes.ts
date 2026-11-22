import * as THREE from 'three';
import {
    BIOME_BLEND_WIDTH,
    BIOME_FOG_MULTIPLIER,
    BIOME_MAP_SIZE,
    BIOME_SITE_COUNT,
    BIOME_TOWN_FADE,
    BIOME_WARP_AMPLITUDE,
    GROUND_VISUAL_SIZE,
    TOWN_HALF_SIZE,
} from './config.js';

export type BiomeId = 'warm' | 'cool' | 'sand';

export interface BiomeWeights {
    warm: number;
    cool: number;
    sand: number;
    town: number;
}

export interface BiomeSite {
    x: number;
    z: number;
    biome: BiomeId;
}

export interface BiomeField {
    readonly seed: number;
    readonly sites: readonly BiomeSite[];
    sample(x: number, z: number, out?: BiomeWeights): BiomeWeights;
    dominant(x: number, z: number): BiomeId;
}

const BIOME_IDS: readonly BiomeId[] = ['warm', 'cool', 'sand'];
const QUADRANT_SIGNS = [[-1, -1], [-1, 1], [1, -1], [1, 1]] as const;
const CENTER_RADIUS = 45;
const CENTER_JITTER = 55;
const QUADRANT_DISTANCE = 650;
const QUADRANT_JITTER = 100;
const WARP_FREQUENCY_X = 0.0028;
const WARP_FREQUENCY_Z = 0.0031;

// Separate from the world-placement stream so adding biomes cannot move scenery.
function mulberry32(seed: number): () => number {
    let state = seed >>> 0;
    return () => {
        state = (state + 0x6d2b79f5) >>> 0;
        let value = state;
        value = Math.imul(value ^ (value >>> 15), value | 1);
        value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
        return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
    };
}

function smoothstep(edge0: number, edge1: number, value: number): number {
    const t = Math.min(1, Math.max(0, (value - edge0) / (edge1 - edge0)));
    return t * t * (3 - 2 * t);
}

function blendWeight(distanceFromNearest: number): number {
    // Reversed edges map the nearest site to 1 and the blend rim to 0.
    return smoothstep(BIOME_BLEND_WIDTH, 0, distanceFromNearest);
}

function createSites(random: () => number): BiomeSite[] {
    const centerAngle = random() * Math.PI * 2;
    const centerRadius = CENTER_RADIUS + random() * CENTER_JITTER;
    const sites: BiomeSite[] = [{
        x: Math.cos(centerAngle) * centerRadius,
        z: Math.sin(centerAngle) * centerRadius,
        biome: 'warm',
    }];
    for (const [signX, signZ] of QUADRANT_SIGNS) {
        sites.push({
            x: signX * QUADRANT_DISTANCE + (random() * 2 - 1) * QUADRANT_JITTER,
            z: signZ * QUADRANT_DISTANCE + (random() * 2 - 1) * QUADRANT_JITTER,
            biome: 'warm',
        });
    }

    // The first three entries are a shuffle, so every seed has all biomes.
    const shuffled: BiomeId[] = [...BIOME_IDS];
    for (let i = shuffled.length - 1; i > 0; i--) {
        const swap = Math.floor(random() * (i + 1));
        const value = shuffled[i];
        shuffled[i] = shuffled[swap];
        shuffled[swap] = value;
    }
    const assigned = [
        ...shuffled,
        shuffled[Math.floor(random() * shuffled.length)],
        shuffled[Math.floor(random() * shuffled.length)],
    ];
    for (let i = 0; i < sites.length; i++) sites[i].biome = assigned[i];
    return sites;
}

export function createBiomeField(seed: number): BiomeField {
    const random = mulberry32(((seed >>> 0) ^ 0x62696f6d) >>> 0);
    const sites = createSites(random);
    const warpPhaseX = random() * Math.PI * 2;
    const warpPhaseZ = random() * Math.PI * 2;
    const distances = new Float64Array(BIOME_SITE_COUNT);
    const dominantWeights: BiomeWeights = { warm: 0, cool: 0, sand: 0, town: 0 };

    const sample = (x: number, z: number, out?: BiomeWeights): BiomeWeights => {
        const weights = out ?? { warm: 0, cool: 0, sand: 0, town: 0 };
        const warpedX = x + BIOME_WARP_AMPLITUDE * Math.sin(z * WARP_FREQUENCY_X + warpPhaseX);
        const warpedZ = z + BIOME_WARP_AMPLITUDE * Math.cos(x * WARP_FREQUENCY_Z + warpPhaseZ);

        let nearestSquared = Infinity;
        for (let i = 0; i < sites.length; i++) {
            const dx = warpedX - sites[i].x;
            const dz = warpedZ - sites[i].z;
            const distanceSquared = dx * dx + dz * dz;
            distances[i] = distanceSquared;
            if (distanceSquared < nearestSquared) nearestSquared = distanceSquared;
        }

        const nearest = Math.sqrt(nearestSquared);
        let warm = 0;
        let cool = 0;
        let sand = 0;
        for (let i = 0; i < sites.length; i++) {
            const distanceFromNearest = Math.sqrt(distances[i]) - nearest;
            if (distanceFromNearest >= BIOME_BLEND_WIDTH) continue;
            const weight = blendWeight(distanceFromNearest);
            if (sites[i].biome === 'warm') warm += weight;
            else if (sites[i].biome === 'cool') cool += weight;
            else sand += weight;
        }

        const total = warm + cool + sand;
        if (total > 0) {
            const inverse = 1 / total;
            weights.warm = warm * inverse;
            weights.cool = cool * inverse;
            weights.sand = sand * inverse;
        } else {
            weights.warm = 1;
            weights.cool = 0;
            weights.sand = 0;
        }

        const townDistance = Math.max(Math.abs(x), Math.abs(z)) - TOWN_HALF_SIZE;
        weights.town = townDistance <= 0
            ? 1
            : townDistance >= BIOME_TOWN_FADE
                ? 0
                : 1 - smoothstep(0, BIOME_TOWN_FADE, townDistance);
        return weights;
    };

    return {
        seed,
        sites,
        sample,
        dominant(x: number, z: number): BiomeId {
            sample(x, z, dominantWeights);
            return getDominantBiome(dominantWeights);
        },
    };
}

export function createBiomeMapTexture(field: BiomeField): THREE.DataTexture {
    const size = BIOME_MAP_SIZE;
    const data = new Uint8Array(size * size * 4);
    const weights: BiomeWeights = { warm: 0, cool: 0, sand: 0, town: 0 };
    for (let v = 0; v < size; v++) {
        const z = ((v + 0.5) / size - 0.5) * GROUND_VISUAL_SIZE;
        for (let u = 0; u < size; u++) {
            const x = ((u + 0.5) / size - 0.5) * GROUND_VISUAL_SIZE;
            field.sample(x, z, weights);
            const index = (v * size + u) * 4;
            data[index] = Math.round(weights.warm * 255);
            data[index + 1] = Math.round(weights.cool * 255);
            data[index + 2] = Math.round(weights.sand * 255);
            data[index + 3] = Math.round(weights.town * 255);
        }
    }

    const texture = new THREE.DataTexture(data, size, size, THREE.RGBAFormat, THREE.UnsignedByteType);
    texture.colorSpace = THREE.NoColorSpace;
    texture.wrapS = texture.wrapT = THREE.ClampToEdgeWrapping;
    texture.magFilter = texture.minFilter = THREE.LinearFilter;
    texture.generateMipmaps = false;
    texture.needsUpdate = true;
    return texture;
}

export function getDominantBiome(weights: BiomeWeights): BiomeId {
    if (weights.warm >= weights.cool && weights.warm >= weights.sand) return 'warm';
    return weights.cool >= weights.sand ? 'cool' : 'sand';
}

export function sampleBiomeFogMultiplier(weights: BiomeWeights): number {
    const biomeMultiplier = weights.warm * BIOME_FOG_MULTIPLIER.warm +
        weights.cool * BIOME_FOG_MULTIPLIER.cool +
        weights.sand * BIOME_FOG_MULTIPLIER.sand;
    return THREE.MathUtils.lerp(biomeMultiplier, 1.0, weights.town);
}

const WARM_SKY_TINT = new THREE.Color(0xffd2a1);
const COOL_SKY_TINT = new THREE.Color(0x9fc8f2);
const SAND_SKY_TINT = new THREE.Color(0xdfc28d);
const SKY_TINT_STRENGTH = 0.18;

export function sampleBiomeSkyTint(
    weights: BiomeWeights,
    target: THREE.Color = new THREE.Color(),
): { color: THREE.Color; strength: number } {
    target.setRGB(
        WARM_SKY_TINT.r * weights.warm + COOL_SKY_TINT.r * weights.cool + SAND_SKY_TINT.r * weights.sand,
        WARM_SKY_TINT.g * weights.warm + COOL_SKY_TINT.g * weights.cool + SAND_SKY_TINT.g * weights.sand,
        WARM_SKY_TINT.b * weights.warm + COOL_SKY_TINT.b * weights.cool + SAND_SKY_TINT.b * weights.sand,
    );
    return { color: target, strength: SKY_TINT_STRENGTH * Math.max(0, 1 - weights.town) };
}

// Multipliers over the bright neutral bark texture: warm brown, cold charcoal, bleached tan.
const WARM_BARK_TINT = new THREE.Color(0x4a2f1b);
const COOL_BARK_TINT = new THREE.Color(0x22252b);
const SAND_BARK_TINT = new THREE.Color(0x96744c);

function blendTint(
    weights: BiomeWeights,
    warm: THREE.Color,
    cool: THREE.Color,
    sand: THREE.Color,
    target: THREE.Color,
): THREE.Color {
    return target.setRGB(
        warm.r * weights.warm + cool.r * weights.cool + sand.r * weights.sand,
        warm.g * weights.warm + cool.g * weights.cool + sand.g * weights.sand,
        warm.b * weights.warm + cool.b * weights.cool + sand.b * weights.sand,
    );
}

export function sampleBiomeBarkColor(
    weights: BiomeWeights,
    target: THREE.Color = new THREE.Color(),
): THREE.Color {
    return blendTint(weights, WARM_BARK_TINT, COOL_BARK_TINT, SAND_BARK_TINT, target);
}

const WARM_LEAF_COLOR = new THREE.Color(0x2f7a37);
const COOL_LEAF_COLOR = new THREE.Color(0x173b3d);
const SAND_LEAF_COLOR = new THREE.Color(0x5f6630);

function shadeVariationFactor(shadeVariation: number): number {
    return 0.84 + 0.24 * THREE.MathUtils.clamp(shadeVariation, 0, 1);
}

export function sampleBiomeLeafColor(
    weights: BiomeWeights,
    shadeVariation: number,
    target: THREE.Color = new THREE.Color(),
): THREE.Color {
    blendTint(weights, WARM_LEAF_COLOR, COOL_LEAF_COLOR, SAND_LEAF_COLOR, target);
    return target.multiplyScalar(shadeVariationFactor(shadeVariation));
}

const WARM_BUSH_COLOR = new THREE.Color(0x2c652b);
const COOL_BUSH_COLOR = new THREE.Color(0x153529);
const SAND_BUSH_COLOR = new THREE.Color(0x766b36);
const WARM_BUSH_ACCENT = new THREE.Color(0xb5681f);

export function sampleBiomeBushColor(
    weights: BiomeWeights,
    shadeVariation: number,
    rareAccent: boolean,
    target: THREE.Color = new THREE.Color(),
): THREE.Color {
    blendTint(weights, WARM_BUSH_COLOR, COOL_BUSH_COLOR, SAND_BUSH_COLOR, target);
    if (rareAccent && weights.warm > 0) target.lerp(WARM_BUSH_ACCENT, 0.78 * Math.min(1, weights.warm));
    return target.multiplyScalar(shadeVariationFactor(shadeVariation));
}
