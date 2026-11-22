import * as THREE from 'three';
import { LEAF_REACTION_RADIUS } from './config.js';

export const uLeafTime: { value: number } = { value: 0 };
export const uLeafAnimStrength: { value: number } = { value: 1 };
export const uLeafPlayerPos: { value: THREE.Vector3 } = { value: new THREE.Vector3(0, -1000, 0) };
export const uLeafPlayerVel: { value: THREE.Vector3 } = { value: new THREE.Vector3() };
export const uLeafWakePos: { value: THREE.Vector3 } = { value: new THREE.Vector3(0, -1000, 0) };
export const uLeafWakeVel: { value: THREE.Vector3 } = { value: new THREE.Vector3() };
export const uLeafWakeStrength: { value: number } = { value: 0 };

const MAX_PLAYER_VELOCITY = 90;
const VELOCITY_RESPONSE = 14;
const WAKE_FOLLOW_RATE = 3.2;
const WAKE_DECAY_RATE = 1.45;
const WAKE_RISE_RATE = 10.0;
const WAKE_TELEPORT_DISTANCE_SQ = 36 * 36;

const vertexUniforms = `
attribute float aLeafWeight;
uniform float uLeafTime;
uniform float uLeafAnimStrength;
uniform vec3 uLeafPlayerPos;
uniform vec3 uLeafPlayerVel;
uniform vec3 uLeafWakePos;
uniform vec3 uLeafWakeVel;
uniform float uLeafWakeStrength;
`;

const beginVertexReplacement = `
#include <begin_vertex>
float leafFlex = clamp(aLeafWeight, 0.0, 1.0);
if (uLeafAnimStrength > 0.0 && leafFlex > 0.001) {
    vec3 leafWorldPos = transformed;
    #ifdef USE_INSTANCING
        leafWorldPos = (instanceMatrix * vec4(transformed, 1.0)).xyz;
    #endif

    // Organic travelling breeze waves and waxing gusts across the forest canopy.
    float gust = 0.72 + 0.36 * sin(uLeafTime * 0.44 + leafWorldPos.x * 0.011 - leafWorldPos.z * 0.014);
    float windPhase = uLeafTime * 1.25 + leafWorldPos.x * 0.028 + leafWorldPos.z * 0.037;
    float leafSway = (sin(windPhase) * 0.34 + sin(windPhase * 2.13 + leafWorldPos.y * 0.28) * 0.12) * gust;
    float leafCross = (cos(windPhase * 0.86 + 1.6) * 0.28 + cos(windPhase * 1.94 + leafWorldPos.x * 0.21) * 0.10) * gust;
    float leafFlutterIdle = sin(uLeafTime * 4.4 + leafWorldPos.x * 0.65 + leafWorldPos.y * 0.85 + leafWorldPos.z * 0.72) * 0.08;
    float leafBob = sin(uLeafTime * 2.2 + leafWorldPos.x * 0.07 + leafWorldPos.z * 0.05) * 0.09 * gust;
    vec3 leafOffset = vec3(leafSway + leafFlutterIdle * 0.5, leafBob + leafFlutterIdle * 0.35, leafCross - leafFlutterIdle * 0.5);

    // Direct player contact: part foliage around the body, bend along velocity,
    // and add energetic high-frequency rustle.
    vec3 leafDelta = leafWorldPos - uLeafPlayerPos;
    float leafDistance = length(leafDelta);
    float leafPush = 1.0 - smoothstep(0.4, ${LEAF_REACTION_RADIUS.toFixed(2)}, leafDistance);
    if (leafPush > 0.0) {
        vec2 leafAway = leafDelta.xz;
        float leafAwayLength = length(leafAway);
        leafAway = leafAwayLength > 0.001
            ? leafAway / leafAwayLength
            : vec2(cos(leafWorldPos.z * 1.7), sin(leafWorldPos.x * 1.7));
        float corePart = 1.0 - smoothstep(0.0, ${(LEAF_REACTION_RADIUS * 0.56).toFixed(2)}, leafDistance);
        float playerSpeed = length(uLeafPlayerVel);
        float verticalLift = clamp(leafDelta.y * 0.14 + 0.24, -0.35, 0.7);
        leafOffset += vec3(leafAway.x, verticalLift, leafAway.y) * (leafPush * 1.55 + corePart * 1.05);

        vec3 velBend = uLeafPlayerVel * (0.048 / (1.0 + playerSpeed * 0.022));
        velBend.y *= 0.45;
        leafOffset += velBend * leafPush;

        float flutterA = sin(uLeafTime * 18.0 + leafWorldPos.x * 2.1 + leafWorldPos.z * 1.9 + leafWorldPos.y * 1.4);
        float flutterB = cos(uLeafTime * 23.5 + leafWorldPos.z * 2.6 - leafWorldPos.x * 1.6);
        float flutterAmp = leafPush * (0.28 + min(playerSpeed, 45.0) * 0.012);
        leafOffset += vec3(flutterA, (flutterA + flutterB) * 0.26, flutterB) * flutterAmp;
    }

    // Trailing motion wake: leaves behind the player keep sweeping along the
    // recent path and spring back with a damped oscillation instead of snapping.
    if (uLeafWakeStrength > 0.005) {
        vec3 wakeDelta = leafWorldPos - uLeafWakePos;
        float wakeDistance = length(wakeDelta);
        float wakePush = (1.0 - smoothstep(0.4, ${(LEAF_REACTION_RADIUS * 1.18).toFixed(2)}, wakeDistance)) * uLeafWakeStrength;
        if (wakePush > 0.0) {
            vec2 wakeAway = wakeDelta.xz;
            float wakeAwayLen = length(wakeAway);
            wakeAway = wakeAwayLen > 0.001 ? wakeAway / wakeAwayLen : vec2(1.0, 0.0);
            float springWave = sin(uLeafTime * 10.5 + leafWorldPos.x * 1.3 + leafWorldPos.z * 1.1);
            float wakeSpeed = length(uLeafWakeVel);
            vec3 wakeSweep = uLeafWakeVel * (0.032 / (1.0 + wakeSpeed * 0.024));
            wakeSweep.y *= 0.35;
            leafOffset += wakeSweep * wakePush;
            leafOffset += vec3(wakeAway.x, 0.14, wakeAway.y) * (wakePush * (0.65 + 0.32 * springWave));
            leafOffset += vec3(springWave, springWave * 0.25, -springWave) * (wakePush * 0.22);
        }
    }

    // Vertices at the branch attachment root stay anchored (leafFlex == 0)
    // while outer foliage tufts bend freely.
    leafOffset *= uLeafAnimStrength * leafFlex;

    #ifdef USE_INSTANCING
        // Convert the world-space displacement back through the orthonormal
        // instance basis so cluster scaling never distorts or shrinks motion.
        vec3 leafScale = vec3(
            length(instanceMatrix[0].xyz),
            length(instanceMatrix[1].xyz),
            length(instanceMatrix[2].xyz)
        );
        vec3 leafAxisX = instanceMatrix[0].xyz / max(leafScale.x, 0.0001);
        vec3 leafAxisY = instanceMatrix[1].xyz / max(leafScale.y, 0.0001);
        vec3 leafAxisZ = instanceMatrix[2].xyz / max(leafScale.z, 0.0001);
        vec3 leafLocalOffset = vec3(
            dot(leafAxisX, leafOffset),
            dot(leafAxisY, leafOffset),
            dot(leafAxisZ, leafOffset)
        ) / max(leafScale, vec3(0.0001));
        transformed += leafLocalOffset;
    #else
        transformed += leafOffset;
    #endif
}
`;

export function installLeafAnimationShader(material: THREE.Material, cacheKey = 'leaf-wind-react-v3'): void {
    material.onBeforeCompile = (shader) => {
        shader.uniforms.uLeafTime = uLeafTime;
        shader.uniforms.uLeafAnimStrength = uLeafAnimStrength;
        shader.uniforms.uLeafPlayerPos = uLeafPlayerPos;
        shader.uniforms.uLeafPlayerVel = uLeafPlayerVel;
        shader.uniforms.uLeafWakePos = uLeafWakePos;
        shader.uniforms.uLeafWakeVel = uLeafWakeVel;
        shader.uniforms.uLeafWakeStrength = uLeafWakeStrength;

        if (shader.vertexShader.includes('#include <common>')) {
            shader.vertexShader = shader.vertexShader.replace(
                '#include <common>',
                `#include <common>${vertexUniforms}`,
            );
        } else {
            shader.vertexShader = vertexUniforms + shader.vertexShader;
        }
        shader.vertexShader = shader.vertexShader.replace('#include <begin_vertex>', beginVertexReplacement);
    };
    material.customProgramCacheKey = () => cacheKey;
    material.needsUpdate = true;
}

const velocityTarget = new THREE.Vector3();
let hasPreviousPlayerPos = false;
const previousPlayerPos = new THREE.Vector3();

export function updateLeafAnimation(
    deltaSeconds: number,
    elapsedSeconds: number,
    playerPos: THREE.Vector3 | null,
    playerVel: THREE.Vector3 | null,
    enabled: boolean,
): void {
    uLeafAnimStrength.value = enabled ? 1 : 0;
    if (!enabled) return;

    const delta = Number.isFinite(deltaSeconds) ? Math.max(0, deltaSeconds) : 0;
    const stepDelta = Math.min(0.1, delta);
    const elapsed = Number.isFinite(elapsedSeconds) ? Math.max(0, elapsedSeconds) : uLeafTime.value;
    // Follow a rewound session clock without snapping the wind forward on the
    // first frame of a new session.
    if (elapsed < uLeafTime.value) uLeafTime.value = elapsed;
    uLeafTime.value += delta;

    const response = 1 - Math.exp(-VELOCITY_RESPONSE * stepDelta);
    if (playerPos) {
        const teleported = !hasPreviousPlayerPos ||
            playerPos.distanceToSquared(previousPlayerPos) > WAKE_TELEPORT_DISTANCE_SQ;
        if (playerVel) {
            velocityTarget.copy(playerVel);
        } else if (!teleported && stepDelta > 1e-4) {
            velocityTarget.subVectors(playerPos, previousPlayerPos).divideScalar(stepDelta);
        } else {
            velocityTarget.set(0, 0, 0);
        }

        const targetSpeed = velocityTarget.length();
        if (targetSpeed > MAX_PLAYER_VELOCITY) velocityTarget.multiplyScalar(MAX_PLAYER_VELOCITY / targetSpeed);

        uLeafPlayerPos.value.copy(playerPos);
        if (teleported) {
            uLeafPlayerVel.value.copy(velocityTarget);
            uLeafWakePos.value.copy(playerPos);
            uLeafWakeVel.value.copy(velocityTarget);
            uLeafWakeStrength.value = 0;
        } else {
            uLeafPlayerVel.value.lerp(velocityTarget, response);
            const wakeFollow = 1 - Math.exp(-WAKE_FOLLOW_RATE * stepDelta);
            uLeafWakePos.value.lerp(playerPos, wakeFollow);
            uLeafWakeVel.value.lerp(uLeafPlayerVel.value, wakeFollow);
        }
        previousPlayerPos.copy(playerPos);
        hasPreviousPlayerPos = true;
    } else {
        uLeafPlayerPos.value.set(0, -1000, 0);
        uLeafPlayerVel.value.multiplyScalar(1 - response);
        uLeafWakeVel.value.multiplyScalar(1 - response);
        hasPreviousPlayerPos = false;
    }

    const currentSpeed = uLeafPlayerVel.value.length();
    if (currentSpeed > MAX_PLAYER_VELOCITY) {
        uLeafPlayerVel.value.multiplyScalar(MAX_PLAYER_VELOCITY / currentSpeed);
    }

    if (playerPos && currentSpeed > 0.75) {
        const targetWake = THREE.MathUtils.clamp((currentSpeed - 0.5) / 16, 0.25, 1.0);
        const rise = 1 - Math.exp(-WAKE_RISE_RATE * stepDelta);
        uLeafWakeStrength.value = Math.max(
            uLeafWakeStrength.value * Math.exp(-WAKE_DECAY_RATE * stepDelta),
            THREE.MathUtils.lerp(uLeafWakeStrength.value, targetWake, rise),
        );
    } else {
        uLeafWakeStrength.value *= Math.exp(-WAKE_DECAY_RATE * stepDelta);
        if (uLeafWakeStrength.value < 1e-4) uLeafWakeStrength.value = 0;
    }
}

export function resetLeafAnimation(): void {
    uLeafTime.value = 0;
    uLeafPlayerPos.value.set(0, -1000, 0);
    uLeafPlayerVel.value.set(0, 0, 0);
    uLeafWakePos.value.set(0, -1000, 0);
    uLeafWakeVel.value.set(0, 0, 0);
    uLeafWakeStrength.value = 0;
    hasPreviousPlayerPos = false;
    previousPlayerPos.set(0, 0, 0);
}
