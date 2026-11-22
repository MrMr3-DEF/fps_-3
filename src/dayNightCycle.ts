import * as THREE from 'three';
import { DAY_DURATION_SECONDS, NIGHT_DURATION_SECONDS, DAY_NIGHT_CYCLE_SECONDS, MAP_HALF_SIZE, MAX_PILLAR_HEIGHT } from './config.js';
import { sampleBiomeSkyTint, type BiomeWeights } from './biomes.js';

export { DAY_DURATION_SECONDS, NIGHT_DURATION_SECONDS, DAY_NIGHT_CYCLE_SECONDS } from './config.js';
export const SUN_MEAN_DISTANCE_KM = 149_600_000;
export const MOON_MEAN_DISTANCE_KM = 384_400;

export interface CelestialScanTarget {
    key: 'sun' | 'moon';
    mesh: THREE.Mesh<THREE.SphereGeometry, THREE.MeshBasicMaterial>;
    distanceKm: number;
}

export interface DayNightPhase {
    phase: 'day' | 'night';
    phaseProgress: number;
    elevation: number;
}

export interface DayNightCycleOptions {
    shadows: boolean;
    shadowMapSize: number;
}

const DAY_SKY = new THREE.Color(0xd0dbf0);
const TWILIGHT_SKY = new THREE.Color(0x9a6070);
const NIGHT_SKY = new THREE.Color(0x030712);
const MOONLIT_SKY = new THREE.Color(0x111d38);
const DAY_AMBIENT = new THREE.Color(0x777777);
const TWILIGHT_AMBIENT = new THREE.Color(0x8a5e52);
const NIGHT_AMBIENT = new THREE.Color(0x4c5d82);
const SUN_NOON = new THREE.Color(0xffffff);
const SUN_HORIZON = new THREE.Color(0xffa46b);
const SUN_DISC_COLOR = new THREE.Color(0xfff0b0);
const SAND_SUN_LIGHT = new THREE.Color(0xffdc36);
const SAND_SUN_DISC = new THREE.Color(0xffee38);
const SAND_SUN_LIGHT_TINT = 0.75;
const SAND_SUN_INTENSITY_MULTIPLIER = 1.45;
const CELESTIAL_HORIZON_DIP = 0.045;
const CELESTIAL_SKY_DISTANCE = 1200;
const SUN_SHADOW_EXTENT = 256;
const SUN_SHADOW_DISTANCE = 1100;

// This mutates Three.js shader chunks process-wide, so install it only once.
// Fade the border of directional shadow maps so camera-following coverage does
// not end in a hard moving rectangle. Recheck the replacements on Three upgrades.
let shadowFadeInstalled = false;
function installSunShadowFade(): void {
    if (shadowFadeInstalled) return;
    const chunk = THREE.ShaderChunk.shadowmap_pars_fragment;
    THREE.ShaderChunk.shadowmap_pars_fragment = chunk + `
#if defined( USE_SHADOWMAP ) && NUM_DIR_LIGHT_SHADOWS > 0
float getSunShadow( sampler2D map, vec2 size, float bias, float radius, vec4 coord ) {
    vec2 uv = coord.xy / coord.w;
    float edge = max(abs(uv.x - 0.5), abs(uv.y - 0.5));
    return mix(getShadow(map, size, bias, radius, coord), 1.0, smoothstep(0.38, 0.49, edge));
}
#endif
`;
    THREE.ShaderChunk.lights_fragment_begin = THREE.ShaderChunk.lights_fragment_begin.replace(
        'getShadow( directionalShadowMap', 'getSunShadow( directionalShadowMap',
    );
    // Lambert materials evaluate their direct shadow in this separate chunk.
    THREE.ShaderChunk.shadowmask_pars_fragment = THREE.ShaderChunk.shadowmask_pars_fragment.replace(
        'getShadow( directionalShadowMap', 'getSunShadow( directionalShadowMap',
    );
    shadowFadeInstalled = true;
}

function positiveModulo(value: number, modulus: number): number {
    return ((value % modulus) + modulus) % modulus;
}

export function getDayNightPhase(elapsedSeconds: number): DayNightPhase {
    const cycleTime = positiveModulo(elapsedSeconds, DAY_NIGHT_CYCLE_SECONDS);
    if (cycleTime < DAY_DURATION_SECONDS) {
        const phaseProgress = cycleTime / DAY_DURATION_SECONDS;
        return {
            phase: 'day',
            phaseProgress,
            elevation: Math.sin(phaseProgress * Math.PI),
        };
    }

    const phaseProgress = (cycleTime - DAY_DURATION_SECONDS) / NIGHT_DURATION_SECONDS;
    return {
        phase: 'night',
        phaseProgress,
        elevation: Math.sin(phaseProgress * Math.PI),
    };
}

function smoothstep(min: number, max: number, value: number): number {
    const normalized = Math.max(0, Math.min(1, (value - min) / (max - min)));
    return normalized * normalized * (3 - 2 * normalized);
}

/**
 * Extends an otherwise horizon-to-horizon arc just far enough below the ground
 * plane for the whole celestial disc to clear the horizon at each phase edge.
 */
export function getCelestialOrbitalElevation(elevation: number): number {
    return elevation * (1 + CELESTIAL_HORIZON_DIP) - CELESTIAL_HORIZON_DIP;
}

/** Owns the scene lighting and visible sun/moon for one continuous five-minute cycle. */
export class DayNightCycle {
    readonly sunLight: THREE.DirectionalLight;
    readonly moonLight: THREE.DirectionalLight;
    readonly celestialScanTargets: readonly CelestialScanTarget[];

    private readonly scene: THREE.Scene;
    private readonly ambientLight: THREE.AmbientLight;
    private readonly sunMesh: THREE.Mesh<THREE.SphereGeometry, THREE.MeshBasicMaterial>;
    private readonly moonMesh: THREE.Mesh<THREE.SphereGeometry, THREE.MeshBasicMaterial>;
    private readonly celestialGeometry: THREE.SphereGeometry;
    private readonly skyColor: THREE.Color;
    private readonly colorScratch = new THREE.Color();
    private readonly biomeTintScratch = new THREE.Color();
    private readonly directionScratch = new THREE.Vector3();
    private readonly shadowRight = new THREE.Vector3();
    private readonly shadowUp = new THREE.Vector3();
    private readonly shadowCenter = new THREE.Vector3();
    private elapsedSeconds = 0;

    get elapsedTimeSeconds(): number {
        return this.elapsedSeconds;
    }

    constructor(scene: THREE.Scene, options: DayNightCycleOptions) {
        installSunShadowFade();
        this.scene = scene;
        this.skyColor = scene.background instanceof THREE.Color ? scene.background : new THREE.Color();
        scene.background = this.skyColor;

        this.ambientLight = new THREE.AmbientLight(DAY_AMBIENT, 1);

        this.sunLight = new THREE.DirectionalLight(0xffffff, 1.2);
        this.applySettings(options);
        this.sunLight.shadow.camera.near = 0.5;
        this.sunLight.shadow.camera.far = SUN_SHADOW_DISTANCE * 2;
        const shadowExtent = SUN_SHADOW_EXTENT;
        this.sunLight.shadow.camera.left = -shadowExtent;
        this.sunLight.shadow.camera.right = shadowExtent;
        this.sunLight.shadow.camera.top = shadowExtent;
        this.sunLight.shadow.camera.bottom = -shadowExtent;
        this.sunLight.shadow.camera.updateProjectionMatrix();
        this.sunLight.shadow.bias = -0.00008;
        this.sunLight.shadow.normalBias = 0.25;

        this.moonLight = new THREE.DirectionalLight(0x9fb7ff, 0.25);
        this.moonLight.castShadow = false;

        this.celestialGeometry = new THREE.SphereGeometry(1, 24, 12);
        this.sunMesh = new THREE.Mesh(this.celestialGeometry, new THREE.MeshBasicMaterial({
            color: SUN_DISC_COLOR.clone(),
            fog: false,
            toneMapped: false,
        }));
        this.sunMesh.name = 'sun';
        this.sunMesh.scale.setScalar(34);

        this.moonMesh = new THREE.Mesh(this.celestialGeometry, new THREE.MeshBasicMaterial({
            color: 0xdce6ff,
            fog: false,
            toneMapped: false,
        }));
        this.moonMesh.name = 'moon';
        this.moonMesh.scale.setScalar(25);

        this.celestialScanTargets = [
            { key: 'sun', mesh: this.sunMesh, distanceKm: SUN_MEAN_DISTANCE_KM },
            { key: 'moon', mesh: this.moonMesh, distanceKm: MOON_MEAN_DISTANCE_KM },
        ];

        scene.add(this.ambientLight, this.sunLight, this.sunLight.target, this.moonLight, this.sunMesh, this.moonMesh);
        this.update(0, new THREE.Vector3());
    }

    applySettings(options: DayNightCycleOptions): void {
        const shadow = this.sunLight.shadow;
        const mapSizeChanged = shadow.mapSize.x !== options.shadowMapSize ||
            shadow.mapSize.y !== options.shadowMapSize;

        if (mapSizeChanged || !options.shadows) {
            // Three.js only allocates a new render target when the old one is absent.
            shadow.map?.dispose();
            shadow.map = null;
            shadow.mapPass?.dispose();
            shadow.mapPass = null;
            shadow.mapSize.set(options.shadowMapSize, options.shadowMapSize);
        }

        this.sunLight.castShadow = options.shadows;
        shadow.needsUpdate = options.shadows;
    }

    /** Align to the host clock, ignoring tiny packet-latency differences. */
    synchronizeElapsedSeconds(elapsedSeconds: number, immediate = false): void {
        if (!Number.isFinite(elapsedSeconds)) return;
        const target = positiveModulo(elapsedSeconds, DAY_NIGHT_CYCLE_SECONDS);
        const difference = positiveModulo(
            target - this.elapsedSeconds + DAY_NIGHT_CYCLE_SECONDS / 2,
            DAY_NIGHT_CYCLE_SECONDS,
        ) - DAY_NIGHT_CYCLE_SECONDS / 2;
        if (immediate || Math.abs(difference) > 0.25) this.elapsedSeconds = target;
    }

    update(deltaSeconds: number, observerPosition: THREE.Vector3, biomeWeights?: BiomeWeights): number {
        this.elapsedSeconds = positiveModulo(this.elapsedSeconds + Math.max(0, deltaSeconds), DAY_NIGHT_CYCLE_SECONDS);
        const state = getDayNightPhase(this.elapsedSeconds);
        const lightDistance = MAP_HALF_SIZE * 0.75;
        const x = -Math.cos(state.phaseProgress * Math.PI);
        const y = getCelestialOrbitalElevation(state.elevation);
        const z = state.phase === 'day' ? -0.22 : 0.18;
        this.directionScratch.set(x, y, z).normalize();
        let nightAmount: number;
        let tintScale = 1;

        if (state.phase === 'day') {
            const sunGlow = smoothstep(-CELESTIAL_HORIZON_DIP, 0.04, y);
            const daylight = smoothstep(0, 0.5, y);
            const sandStrength = biomeWeights
                ? THREE.MathUtils.clamp(biomeWeights.sand, 0, 1) * Math.max(0, 1 - biomeWeights.town)
                : 0;
            this.skyColor.copy(NIGHT_SKY).lerp(TWILIGHT_SKY, sunGlow).lerp(DAY_SKY, daylight);
            this.colorScratch.copy(NIGHT_AMBIENT).lerp(TWILIGHT_AMBIENT, sunGlow).lerp(DAY_AMBIENT, daylight);
            this.ambientLight.color.copy(this.colorScratch);
            this.ambientLight.intensity = THREE.MathUtils.lerp(
                THREE.MathUtils.lerp(0.35, 0.65, sunGlow),
                1,
                daylight,
            );

            this.sunLight.color.copy(SUN_HORIZON).lerp(SUN_NOON, daylight);
            if (sandStrength > 0) this.sunLight.color.lerp(SAND_SUN_LIGHT, SAND_SUN_LIGHT_TINT * sandStrength);
            this.sunLight.intensity = THREE.MathUtils.lerp(
                THREE.MathUtils.lerp(0, 0.12, sunGlow),
                1.2,
                daylight,
            ) * THREE.MathUtils.lerp(1, SAND_SUN_INTENSITY_MULTIPLIER, sandStrength);
            this.sunMesh.material.color.copy(SUN_DISC_COLOR);
            if (sandStrength > 0) this.sunMesh.material.color.lerp(SAND_SUN_DISC, sandStrength);
            // Snap in the light's plane, not world X/Z, to keep camera motion
            // from sliding the shadow texel grid over stationary surfaces.
            this.shadowRight.set(0, 1, 0).cross(this.directionScratch).normalize();
            this.shadowUp.crossVectors(this.directionScratch, this.shadowRight);
            this.shadowCenter.copy(observerPosition);
            this.shadowCenter.y = Math.max(MAX_PILLAR_HEIGHT * 0.25, observerPosition.y);
            const texel = SUN_SHADOW_EXTENT * 2 / this.sunLight.shadow.mapSize.x;
            const right = this.shadowCenter.dot(this.shadowRight);
            const up = this.shadowCenter.dot(this.shadowUp);
            this.shadowCenter.addScaledVector(this.shadowRight, Math.round(right / texel) * texel - right);
            this.shadowCenter.addScaledVector(this.shadowUp, Math.round(up / texel) * texel - up);
            this.sunLight.target.position.copy(this.shadowCenter);
            this.sunLight.position.copy(this.shadowCenter).addScaledVector(this.directionScratch, SUN_SHADOW_DISTANCE);
            this.sunLight.visible = true;
            this.sunMesh.position.copy(observerPosition).addScaledVector(this.directionScratch, CELESTIAL_SKY_DISTANCE);
            this.sunMesh.visible = true;

            this.moonLight.visible = false;
            this.moonMesh.visible = false;

            nightAmount = 1 - daylight;
            tintScale = 0.35 + 0.65 * daylight;
        } else {
            const moonlight = smoothstep(-CELESTIAL_HORIZON_DIP, 0.7, y);
            this.skyColor.copy(NIGHT_SKY).lerp(MOONLIT_SKY, moonlight * 0.45);
            this.colorScratch.copy(NIGHT_AMBIENT);
            this.ambientLight.color.copy(this.colorScratch);
            this.ambientLight.intensity = 0.35 + moonlight * 0.15;

            this.moonLight.intensity = moonlight * 0.38;
            this.moonLight.position.copy(this.directionScratch).multiplyScalar(lightDistance);
            this.moonLight.visible = true;
            this.moonMesh.position.copy(observerPosition).addScaledVector(this.directionScratch, CELESTIAL_SKY_DISTANCE);
            this.moonMesh.visible = true;

            this.sunLight.visible = false;
            this.sunMesh.visible = false;
            nightAmount = 1;
            // Keep the biome hue at night without washing out the deep sky.
            tintScale = 0.12 + 0.18 * moonlight;
        }

        if (biomeWeights) this.applyBiomeTint(biomeWeights, tintScale);
        if (this.scene.fog) this.scene.fog.color.copy(this.skyColor);
        return nightAmount;
    }

    private applyBiomeTint(weights: BiomeWeights, scale: number): void {
        const tint = sampleBiomeSkyTint(weights, this.biomeTintScratch);
        const strength = tint.strength * scale;
        if (strength <= 0) return;
        // The helper fades out at the town; the phase scale keeps the deep night
        // sky from washing out while regions retain their identity.
        this.skyColor.lerp(tint.color, strength);
        this.ambientLight.color.lerp(tint.color, strength * 0.18);
    }

    dispose(): void {
        this.scene.remove(this.ambientLight, this.sunLight, this.sunLight.target, this.moonLight, this.sunMesh, this.moonMesh);
        this.sunLight.shadow.dispose();
        this.celestialGeometry.dispose();
        this.sunMesh.material.dispose();
        this.moonMesh.material.dispose();
    }
}
