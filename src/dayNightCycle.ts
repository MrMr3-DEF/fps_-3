import * as THREE from 'three';
import { MAP_HALF_SIZE, MAX_PILLAR_HEIGHT } from './config.js';

export const DAY_DURATION_SECONDS = 5 * 60;
export const NIGHT_DURATION_SECONDS = 3 * 60;
export const DAY_NIGHT_CYCLE_SECONDS = DAY_DURATION_SECONDS + NIGHT_DURATION_SECONDS;

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

/** Owns the scene lighting and visible sun/moon for one continuous eight-minute cycle. */
export class DayNightCycle {
    readonly sunLight: THREE.DirectionalLight;
    readonly moonLight: THREE.DirectionalLight;

    private readonly scene: THREE.Scene;
    private readonly ambientLight: THREE.AmbientLight;
    private readonly sunMesh: THREE.Mesh<THREE.SphereGeometry, THREE.MeshBasicMaterial>;
    private readonly moonMesh: THREE.Mesh<THREE.SphereGeometry, THREE.MeshBasicMaterial>;
    private readonly celestialGeometry: THREE.SphereGeometry;
    private readonly skyColor: THREE.Color;
    private readonly colorScratch = new THREE.Color();
    private readonly directionScratch = new THREE.Vector3();
    private elapsedSeconds = 0;

    constructor(scene: THREE.Scene, options: DayNightCycleOptions) {
        this.scene = scene;
        this.skyColor = scene.background instanceof THREE.Color ? scene.background : new THREE.Color();
        scene.background = this.skyColor;

        this.ambientLight = new THREE.AmbientLight(DAY_AMBIENT, 1);

        this.sunLight = new THREE.DirectionalLight(0xffffff, 1.2);
        this.sunLight.castShadow = options.shadows;
        this.sunLight.shadow.mapSize.set(options.shadowMapSize, options.shadowMapSize);
        this.sunLight.shadow.camera.near = 0.5;
        this.sunLight.shadow.camera.far = MAP_HALF_SIZE * 3.2;
        const shadowExtent = Math.SQRT2 * MAP_HALF_SIZE + MAX_PILLAR_HEIGHT;
        this.sunLight.shadow.camera.left = -shadowExtent;
        this.sunLight.shadow.camera.right = shadowExtent;
        this.sunLight.shadow.camera.top = shadowExtent;
        this.sunLight.shadow.camera.bottom = -shadowExtent;
        this.sunLight.shadow.camera.updateProjectionMatrix();
        this.sunLight.shadow.bias = -0.0005;

        this.moonLight = new THREE.DirectionalLight(0x9fb7ff, 0.25);
        this.moonLight.castShadow = false;

        this.celestialGeometry = new THREE.SphereGeometry(1, 24, 12);
        this.sunMesh = new THREE.Mesh(this.celestialGeometry, new THREE.MeshBasicMaterial({
            color: 0xfff0b0,
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

        scene.add(this.ambientLight, this.sunLight, this.moonLight, this.sunMesh, this.moonMesh);
        this.update(0, new THREE.Vector3());
    }

    update(deltaSeconds: number, observerPosition: THREE.Vector3): number {
        this.elapsedSeconds = positiveModulo(this.elapsedSeconds + Math.max(0, deltaSeconds), DAY_NIGHT_CYCLE_SECONDS);
        const state = getDayNightPhase(this.elapsedSeconds);
        const lightDistance = MAP_HALF_SIZE * 0.75;
        const skyDistance = 1200;
        const x = -Math.cos(state.phaseProgress * Math.PI);
        const y = Math.max(0.035, state.elevation);
        const z = state.phase === 'day' ? -0.22 : 0.18;
        this.directionScratch.set(x, y, z).normalize();

        if (state.phase === 'day') {
            const daylight = smoothstep(0, 0.5, state.elevation);
            this.skyColor.copy(TWILIGHT_SKY).lerp(DAY_SKY, daylight);
            this.colorScratch.copy(TWILIGHT_AMBIENT).lerp(DAY_AMBIENT, daylight);
            this.ambientLight.color.copy(this.colorScratch);
            this.ambientLight.intensity = THREE.MathUtils.lerp(0.65, 1, daylight);

            this.sunLight.color.copy(SUN_HORIZON).lerp(SUN_NOON, daylight);
            this.sunLight.intensity = THREE.MathUtils.lerp(0.12, 1.2, daylight);
            this.sunLight.position.copy(this.directionScratch).multiplyScalar(lightDistance);
            this.sunLight.visible = true;
            this.sunMesh.position.copy(observerPosition).addScaledVector(this.directionScratch, skyDistance);
            this.sunMesh.visible = true;

            this.moonLight.visible = false;
            this.moonMesh.visible = false;

            if (this.scene.fog) this.scene.fog.color.copy(this.skyColor);
            return 1 - daylight;
        } else {
            const moonlight = smoothstep(0, 0.7, state.elevation);
            const edgeDistance = Math.min(state.phaseProgress, 1 - state.phaseProgress);
            const twilight = 1 - smoothstep(0, 0.12, edgeDistance);
            this.skyColor.copy(NIGHT_SKY).lerp(MOONLIT_SKY, moonlight * 0.45).lerp(TWILIGHT_SKY, twilight);
            this.colorScratch.copy(NIGHT_AMBIENT).lerp(TWILIGHT_AMBIENT, twilight * 0.45);
            this.ambientLight.color.copy(this.colorScratch);
            this.ambientLight.intensity = 0.35 + moonlight * 0.15 + twilight * 0.2;

            this.moonLight.intensity = 0.08 + moonlight * 0.3;
            this.moonLight.position.copy(this.directionScratch).multiplyScalar(lightDistance);
            this.moonLight.visible = true;
            this.moonMesh.position.copy(observerPosition).addScaledVector(this.directionScratch, skyDistance);
            this.moonMesh.visible = true;

            this.sunLight.visible = false;
            this.sunMesh.visible = false;
        }

        if (this.scene.fog) this.scene.fog.color.copy(this.skyColor);
        return 1;
    }

    dispose(): void {
        this.scene.remove(this.ambientLight, this.sunLight, this.moonLight, this.sunMesh, this.moonMesh);
        this.celestialGeometry.dispose();
        this.sunMesh.material.dispose();
        this.moonMesh.material.dispose();
    }
}
