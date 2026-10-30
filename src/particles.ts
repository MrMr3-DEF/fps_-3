import * as THREE from 'three';
import { state } from './state.js';
import { LASER_BEAM_FADE_TIME, MAX_PARTICLES, MECHA_ARMOR_IMPACT } from './config.js';
import { getParticleLimit, scaleParticleCount } from './settings.js';
import type { Vec3Like } from './gameplayMath.js';

const SHARED_BOX_GEO = new THREE.BoxGeometry(1, 1, 1);
const SHARED_CYL_GEO = new THREE.CylinderGeometry(0.025, 0.025, 1, 6);
SHARED_CYL_GEO.rotateX(Math.PI / 2);
const SHARED_RING_GEO = new THREE.RingGeometry(0.9, 1.0, 32);
SHARED_RING_GEO.rotateX(-Math.PI / 2);

const _instanceMatrix = new THREE.Matrix4();
const _instancePosition = new THREE.Vector3();
const _instanceQuaternion = new THREE.Quaternion();
const _instanceScale = new THREE.Vector3();
const _instanceColor = new THREE.Color();
const _laserMidPoint = new THREE.Vector3();
const _impactAxis = new THREE.Vector3();
const _impactTangent = new THREE.Vector3();
const _impactBitangent = new THREE.Vector3();
const _particleDirection = new THREE.Vector3();
const _sparkAxis = new THREE.Vector3(0, 1, 0);
const _cooledSparkColor = new THREE.Color(MECHA_ARMOR_IMPACT.cooledSparkColor);

const materialPool: THREE.MeshBasicMaterial[] = [];
const shockwaveMaterialPool: THREE.MeshBasicMaterial[] = [];
const boxParticlePool: Particle[] = [];

let boxParticleMesh: THREE.InstancedMesh | null = null;

function ensureBoxParticleMesh(): THREE.InstancedMesh | null {
    if (!state.scene) return null;
    if (!boxParticleMesh) {
        const mat = new THREE.MeshBasicMaterial({
            color: 0xffffff,
            transparent: true,
            opacity: 0.95,
            depthTest: true,
            depthWrite: false,
        });
        boxParticleMesh = new THREE.InstancedMesh(SHARED_BOX_GEO, mat, MAX_PARTICLES);
        boxParticleMesh.frustumCulled = false;
        boxParticleMesh.renderOrder = 20;
        boxParticleMesh.count = 0;
        state.scene.add(boxParticleMesh);
    }
    return boxParticleMesh;
}

/** Allocate first-use effects while the loading screen is visible. */
export function prepareParticleResources(): THREE.Mesh[] {
    const box = ensureBoxParticleMesh();
    if (!box) return [];
    box.setColorAt(0, new THREE.Color(0xffffff));
    while (boxParticlePool.length < getParticleLimit()) boxParticlePool.push({} as Particle);
    while (materialPool.length < 32) materialPool.push(new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true }));
    while (shockwaveMaterialPool.length < 8) shockwaveMaterialPool.push(new THREE.MeshBasicMaterial({
        color: 0xffffff, transparent: true, opacity: 0.8, side: THREE.DoubleSide, depthWrite: false,
    }));
    // Temporary representatives compile the same variants used by pooled effects.
    return [new THREE.Mesh(SHARED_CYL_GEO, materialPool[0]), new THREE.Mesh(SHARED_RING_GEO, shockwaveMaterialPool[0])];
}

function acquireBasicMaterial(colorHex: number): THREE.MeshBasicMaterial {
    if (materialPool.length > 0) {
        const mat = materialPool.pop()!;
        mat.color.setHex(colorHex);
        mat.opacity = 1.0;
        return mat;
    }
    return new THREE.MeshBasicMaterial({
        color: colorHex,
        transparent: true,
        opacity: 1.0
    });
}

function releaseBasicMaterial(mat: THREE.MeshBasicMaterial): void {
    if (materialPool.length < 128) {
        materialPool.push(mat);
    } else {
        mat.dispose();
    }
}

function acquireShockwaveMaterial(colorHex: number): THREE.MeshBasicMaterial {
    if (shockwaveMaterialPool.length > 0) {
        const mat = shockwaveMaterialPool.pop()!;
        mat.color.setHex(colorHex);
        mat.opacity = 0.8;
        return mat;
    }
    return new THREE.MeshBasicMaterial({
        color: colorHex,
        transparent: true,
        opacity: 0.8,
        side: THREE.DoubleSide,
        depthWrite: false
    });
}

function releaseShockwaveMaterial(mat: THREE.MeshBasicMaterial): void {
    if (shockwaveMaterialPool.length < 50) {
        shockwaveMaterialPool.push(mat);
    } else {
        mat.dispose();
    }
}

export type ParticleKind = 'spark' | 'armor-spark' | 'dust' | 'sniper-trail' | 'shockwave' | 'rocket-flame' | 'maneuvering';

export interface Particle {
    kind: ParticleKind;
    life: number;
    maxLife: number;
    mesh?: THREE.Mesh;
    x?: number;
    y?: number;
    z?: number;
    vx?: number;
    vy?: number;
    vz?: number;
    gravity?: number;
    size?: number;
    length?: number;
    color?: number;
    targetScale?: number;
}

function isBoxParticle(kind: ParticleKind): boolean {
    return kind === 'spark' || kind === 'armor-spark' || kind === 'dust' || kind === 'rocket-flame' || kind === 'maneuvering';
}

function pushBoxParticle(
    kind: ParticleKind,
    position: THREE.Vector3,
    color: number,
    size: number,
    vx: number,
    vy: number,
    vz: number,
    gravity: number,
    maxLife: number
): Particle {
    ensureBoxParticleMesh();
    const particle = boxParticlePool.pop() || ({} as Particle);
    particle.kind = kind;
    particle.mesh = undefined;
    particle.x = position.x;
    particle.y = position.y;
    particle.z = position.z;
    particle.vx = vx;
    particle.vy = vy;
    particle.vz = vz;
    particle.gravity = gravity;
    particle.size = size;
    particle.length = undefined;
    particle.color = color;
    particle.targetScale = undefined;
    particle.life = maxLife;
    particle.maxLife = maxLife;
    state.activeParticles.push(particle);
    return particle;
}

function availableParticleSlots(): number {
    return Math.max(0, getParticleLimit() - state.activeParticles.length);
}

function sampleParticleRange(range: readonly [number, number]): number {
    return range[0] + Math.random() * (range[1] - range[0]);
}

/** One accepted armor hit; all viewers use the canonical incoming segment.
 * World-space pooled particles survive a lethal hit without following the wreck. */
export function spawnMechaArmorImpact(position: Vec3Like, incoming: Vec3Like): void {
    if (!state.scene) return;
    _impactAxis.set(-incoming.x, -incoming.y, -incoming.z);
    if (!_impactAxis.lengthSq() || !Number.isFinite(_impactAxis.lengthSq())) return;
    _impactAxis.normalize();
    _impactTangent.set(Math.abs(_impactAxis.y) < 0.9 ? 0 : 1, Math.abs(_impactAxis.y) < 0.9 ? 1 : 0, 0)
        .cross(_impactAxis).normalize();
    _impactBitangent.crossVectors(_impactAxis, _impactTangent);
    const tuning = MECHA_ARMOR_IMPACT;
    const sparks = scaleParticleCount(tuning.sparks), dust = scaleParticleCount(tuning.dust);
    const count = Math.min(sparks + dust, availableParticleSlots());
    for (let i = 0; i < count; i++) {
        // Interleave the two kinds instead of spending the budget on sparks first.
        const isDust = Math.floor((i + 1) * dust / (sparks + dust)) > Math.floor(i * dust / (sparks + dust));
        const angle = Math.random() * Math.PI * 2, spread = Math.sqrt(Math.random()) * (isDust ? tuning.dustSpread : tuning.sparkSpread);
        _particleDirection.copy(_impactAxis)
            .addScaledVector(_impactTangent, Math.cos(angle) * spread)
            .addScaledVector(_impactBitangent, Math.sin(angle) * spread).normalize();
        const speed = sampleParticleRange(isDust ? tuning.dustSpeed : tuning.sparkSpeed);
        _instancePosition.set(position.x, position.y, position.z).addScaledVector(_impactAxis, tuning.surfaceOffset);
        const colors = isDust ? tuning.dustColors : tuning.sparkColors;
        const p = pushBoxParticle(isDust ? 'dust' : 'armor-spark', _instancePosition,
            colors[Math.floor(Math.random() * colors.length)], sampleParticleRange(isDust ? tuning.dustSize : tuning.sparkWidth),
            _particleDirection.x * speed, _particleDirection.y * speed, _particleDirection.z * speed,
            isDust ? tuning.dustGravity : tuning.sparkGravity, sampleParticleRange(isDust ? tuning.dustLife : tuning.sparkLife));
        if (!isDust) p.length = sampleParticleRange(tuning.sparkLength);
    }
}

export function spawnParticles(position: THREE.Vector3, color: number, count: number, speed: number, size: number, gravity: number): void {
    const spawnCount = Math.min(scaleParticleCount(count), availableParticleSlots());
    if (spawnCount <= 0) return;

    for (let i = 0; i < spawnCount; i++) {
        const px = position.x + (Math.random() - 0.5) * 0.5;
        const py = position.y + (Math.random() - 0.5) * 0.5;
        const pz = position.z + (Math.random() - 0.5) * 0.5;

        const vxDir = (Math.random() - 0.5) * 2;
        const vyDir = (Math.random() - 0.3) * 2;
        const vzDir = (Math.random() - 0.5) * 2;
        const len = Math.sqrt(vxDir * vxDir + vyDir * vyDir + vzDir * vzDir);
        const norm = len > 0 ? 1 / len : 0;
        const speedScale = speed * (0.4 + Math.random() * 0.8);
        const maxLife = 0.4 + Math.random() * 0.5;

        _instancePosition.set(px, py, pz);
        pushBoxParticle(
            'spark',
            _instancePosition,
            color,
            size,
            vxDir * norm * speedScale,
            vyDir * norm * speedScale,
            vzDir * norm * speedScale,
            gravity,
            maxLife
        );
    }
}

/** Radial dust and stone chips share the existing instance pool and user budget;
 * a giant footfall must not create a mesh/material for every speck of debris. */
export function spawnGroundImpact(position: THREE.Vector3, radius: number, heavy: boolean): void {
    const count = Math.min(scaleParticleCount(heavy ? 64 : 12), availableParticleSlots());
    for (let i = 0; i < count; i++) {
        const angle = Math.random() * Math.PI * 2;
        const dust = i % 3 !== 0;
        const speed = radius * (0.4 + Math.random() * 0.6);
        _instancePosition.set(position.x + Math.sin(angle) * radius * 0.12, position.y + 0.3, position.z + Math.cos(angle) * radius * 0.12);
        pushBoxParticle(dust ? 'dust' : 'spark', _instancePosition, dust ? 0x938976 : 0x68645b,
            dust ? 0.5 + Math.random() * (heavy ? 1.2 : 0.35) : 0.12 + Math.random() * 0.28,
            Math.sin(angle) * speed, dust ? 1 + Math.random() * 2 : 5 + Math.random() * 7, Math.cos(angle) * speed,
            dust ? 0.4 : 24, dust ? 1.1 + Math.random() * 0.8 : 0.6 + Math.random() * 0.5);
    }
    if (heavy) createShockwave(position, radius, 0xc9b998);
}

export function createLaserBeam(startPos: THREE.Vector3, endPos: THREE.Vector3, color: number = 0x00d2ff): void {
    if (availableParticleSlots() <= 0 || !state.scene) return;

    const distance = startPos.distanceTo(endPos);
    if (distance <= 0) return;

    const cylMat = acquireBasicMaterial(color);
    cylMat.opacity = 0.95;

    const mesh = new THREE.Mesh(SHARED_CYL_GEO, cylMat);
    _laserMidPoint.addVectors(startPos, endPos).multiplyScalar(0.5);
    mesh.position.copy(_laserMidPoint);
    mesh.scale.set(1, 1, distance);
    mesh.lookAt(endPos);

    state.scene.add(mesh);

    state.activeParticles.push({
        mesh,
        kind: 'sniper-trail',
        life: LASER_BEAM_FADE_TIME,
        maxLife: LASER_BEAM_FADE_TIME
    });
}

function releaseMeshParticle(p: Particle): void {
    if (!p.mesh || !state.scene) return;

    state.scene.remove(p.mesh);
    if (p.kind === 'sniper-trail') {
        releaseBasicMaterial(p.mesh.material as THREE.MeshBasicMaterial);
    } else if (p.kind === 'shockwave') {
        releaseShockwaveMaterial(p.mesh.material as THREE.MeshBasicMaterial);
    }
}

function updateBoxInstances(hasBoxParticles: boolean): void {
    // Do not create an InstancedMesh or upload its buffers before the first
    // actual particle. The main loop calls this path while menus are open.
    if (!boxParticleMesh) return;
    if (!hasBoxParticles) {
        if (boxParticleMesh.count !== 0) boxParticleMesh.count = 0;
        return;
    }

    const mesh = boxParticleMesh;

    const limit = getParticleLimit();
    if (mesh.count > limit) mesh.count = limit;

    let instanceIndex = 0;
    for (let i = 0; i < state.activeParticles.length; i++) {
        const p = state.activeParticles[i];
        if (!isBoxParticle(p.kind)) continue;
        if (instanceIndex >= limit) break;

        const ratio = Math.max(0, p.life / p.maxLife);
        const scale = (p.size || 0.1) * (p.kind === 'dust' ? Math.sin(Math.PI * ratio) : ratio);
        _instancePosition.set(p.x || 0, p.y || 0, p.z || 0);
        _instanceScale.set(scale, scale, scale);
        _instanceQuaternion.identity();
        _instanceColor.setHex(p.color || 0xffffff);
        if (p.kind === 'armor-spark') {
            _particleDirection.set(p.vx || 0, p.vy || 0, p.vz || 0).normalize();
            _instanceQuaternion.setFromUnitVectors(_sparkAxis, _particleDirection);
            _instanceScale.y = (p.length || scale) * Math.sqrt(ratio);
            _instanceColor.lerp(_cooledSparkColor, 1 - ratio);
        }
        _instanceMatrix.compose(_instancePosition, _instanceQuaternion, _instanceScale);
        mesh.setMatrixAt(instanceIndex, _instanceMatrix);
        mesh.setColorAt(instanceIndex, _instanceColor);
        instanceIndex++;
    }

    mesh.count = instanceIndex;
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) {
        mesh.instanceColor.needsUpdate = true;
    }
}

export function updateParticles(delta: number): void {
    let hasBoxParticles = false;
    for (let i = state.activeParticles.length - 1; i >= 0; i--) {
        const p = state.activeParticles[i];
        p.life -= delta;

        if (p.life <= 0) {
            releaseMeshParticle(p);
            if (isBoxParticle(p.kind) && boxParticlePool.length < MAX_PARTICLES) {
                boxParticlePool.push(p);
            }
            state.activeParticles[i] = state.activeParticles[state.activeParticles.length - 1];
            state.activeParticles.pop();
            continue;
        }

        const ratio = Math.max(0, p.life / p.maxLife);

        if (isBoxParticle(p.kind)) {
            hasBoxParticles = true;
            if (p.vx !== undefined && p.vy !== undefined && p.vz !== undefined && p.gravity !== undefined) {
                p.vy -= p.gravity * delta;
                p.x = (p.x || 0) + p.vx * delta;
                p.y = (p.y || 0) + p.vy * delta;
                p.z = (p.z || 0) + p.vz * delta;
            }
        } else if (p.mesh && p.kind === 'sniper-trail') {
            (p.mesh.material as THREE.MeshBasicMaterial).opacity = ratio * 0.95;
            p.mesh.scale.x = ratio;
            p.mesh.scale.y = ratio;
        } else if (p.mesh && p.kind === 'shockwave') {
            const currentScale = 1.0 + (p.targetScale! - 1.0) * (1.0 - ratio);
            p.mesh.scale.setScalar(currentScale);
            (p.mesh.material as THREE.MeshBasicMaterial).opacity = ratio * 0.7;

        }
    }

    updateBoxInstances(hasBoxParticles);
}

export function spawnRocketFlame(position: THREE.Vector3, count: number, isBurst: boolean): void {
    const spawnCount = Math.min(scaleParticleCount(count), availableParticleSlots());
    if (spawnCount <= 0) return;

    for (let i = 0; i < spawnCount; i++) {
        const color = isBurst
            ? (Math.random() > 0.5 ? 0xfff06a : 0xffb21f)
            : (Math.random() > 0.35 ? 0xff8a00 : 0xffc400);
        const px = position.x + (Math.random() - 0.5) * 0.3;
        const py = position.y + (Math.random() - 0.5) * 0.1;
        const pz = position.z + (Math.random() - 0.5) * 0.3;
        const size = isBurst ? (0.25 + Math.random() * 0.25) : (0.26 + Math.random() * 0.18);
        const vx = (Math.random() - 0.5) * (isBurst ? 22.0 : 4.0);
        const vy = isBurst ? (-8.0 - Math.random() * 20.0) : (-18.0 - Math.random() * 12.0);
        const vz = (Math.random() - 0.5) * (isBurst ? 22.0 : 4.0);
        const maxLife = isBurst ? (0.3 + Math.random() * 0.3) : (0.25 + Math.random() * 0.25);

        _instancePosition.set(px, py, pz);
        pushBoxParticle('rocket-flame', _instancePosition, color, size, vx, vy, vz, 0.0, maxLife);
    }
}

export function spawnManeuveringBeam(position: THREE.Vector3, count: number, dir: THREE.Vector3): void {
    if (!dir || dir.lengthSq() === 0) return;
    const spawnCount = Math.min(scaleParticleCount(count), availableParticleSlots());
    if (spawnCount <= 0) return;

    for (let i = 0; i < spawnCount; i++) {
        const color = Math.random() > 0.5 ? 0xffea00 : 0xffcc00;
        const px = position.x + dir.x * 0.3 + (Math.random() - 0.5) * 0.1;
        const py = position.y + (Math.random() - 0.5) * 0.1;
        const pz = position.z + dir.z * 0.3 + (Math.random() - 0.5) * 0.1;
        const size = 0.06 + Math.random() * 0.06;
        const speedScale = 12.0 + Math.random() * 6.0;
        const vx = dir.x * speedScale + (Math.random() - 0.5) * 1.5;
        const vy = -3.0 - Math.random() * 4.0;
        const vz = dir.z * speedScale + (Math.random() - 0.5) * 1.5;
        const maxLife = 0.12 + Math.random() * 0.12;

        _instancePosition.set(px, py, pz);
        pushBoxParticle('maneuvering', _instancePosition, color, size, vx, vy, vz, 0.0, maxLife);
    }
}

export function createShockwave(position: THREE.Vector3, targetRadius: number, color: number = 0xffcc00): void {
    if (availableParticleSlots() <= 0 || !state.scene) return;

    const ringMat = acquireShockwaveMaterial(color);
    const mesh = new THREE.Mesh(SHARED_RING_GEO, ringMat);
    mesh.position.copy(position);
    mesh.position.y += 0.05;

    state.scene.add(mesh);

    state.activeParticles.push({
        mesh,
        kind: 'shockwave',
        targetScale: targetRadius,
        life: 0.4,
        maxLife: 0.4
    });
}

export function disposeParticles(): void {
    if (boxParticleMesh) {
        state.scene?.remove(boxParticleMesh);
        boxParticleMesh.dispose();
        (boxParticleMesh.material as THREE.Material).dispose();
        boxParticleMesh = null;
    }

    for (let i = state.activeParticles.length - 1; i >= 0; i--) {
        releaseMeshParticle(state.activeParticles[i]);
    }
    state.activeParticles.length = 0;
    boxParticlePool.length = 0;
    materialPool.splice(0).forEach((mat) => mat.dispose());
    shockwaveMaterialPool.splice(0).forEach((mat) => mat.dispose());
}
