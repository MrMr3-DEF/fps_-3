import * as THREE from 'three';
import { state } from './state.js';
import { LASER_BEAM_FADE_TIME, MAX_PARTICLES } from './config.js';
import { getParticleLimit, scaleParticleCount } from './settings.js';

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

const materialPool: THREE.MeshBasicMaterial[] = [];
const shockwaveMaterialPool: THREE.MeshBasicMaterial[] = [];

let boxParticleMesh: THREE.InstancedMesh | null = null;

function ensureBoxParticleMesh(): THREE.InstancedMesh | null {
    if (!state.scene) return null;
    if (!boxParticleMesh) {
        const mat = new THREE.MeshBasicMaterial({
            vertexColors: true,
            transparent: true,
            opacity: 0.95
        });
        boxParticleMesh = new THREE.InstancedMesh(SHARED_BOX_GEO, mat, MAX_PARTICLES);
        boxParticleMesh.frustumCulled = false;
        boxParticleMesh.count = 0;
        for (let i = 0; i < MAX_PARTICLES; i++) {
            boxParticleMesh.setColorAt(i, _instanceColor.setHex(0xffaa00));
        }
        if (boxParticleMesh.instanceColor) {
            boxParticleMesh.instanceColor.needsUpdate = true;
        }
        state.scene.add(boxParticleMesh);
    }
    return boxParticleMesh;
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

export type ParticleKind = 'spark' | 'sniper-trail' | 'shockwave' | 'lightbeam' | 'rocket-flame' | 'maneuvering';

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
    color?: number;
    targetScale?: number;
}

const SHARED_BEAM_GEO = new THREE.CylinderGeometry(2.5, 2.5, 120, 16);
const SHARED_BEAM_MAT = new THREE.MeshBasicMaterial({
    color: 0x00aaff,
    transparent: true,
    opacity: 0.8,
    side: THREE.DoubleSide
});

function isBoxParticle(kind: ParticleKind): boolean {
    return kind === 'spark' || kind === 'rocket-flame' || kind === 'maneuvering';
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
): void {
    ensureBoxParticleMesh();
    state.activeParticles.push({
        kind,
        x: position.x,
        y: position.y,
        z: position.z,
        vx,
        vy,
        vz,
        gravity,
        size,
        color,
        life: maxLife,
        maxLife
    });
}

function availableParticleSlots(): number {
    return Math.max(0, getParticleLimit() - state.activeParticles.length);
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

export function spawnLightBeam(position: THREE.Vector3): void {
    if (availableParticleSlots() <= 0 || !state.scene) return;

    const beamHeight = 120;
    const beam = new THREE.Mesh(SHARED_BEAM_GEO, SHARED_BEAM_MAT);
    beam.position.set(position.x, beamHeight / 2, position.z);

    state.scene.add(beam);

    const maxLife = 1.2;
    state.activeParticles.push({
        mesh: beam,
        kind: 'lightbeam',
        life: maxLife,
        maxLife
    });

    _instancePosition.set(position.x, 0.5, position.z);
    spawnParticles(_instancePosition, 0x00aaff, 20, 14.0, 0.4, -6.0);
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

function updateBoxInstances(): void {
    const mesh = ensureBoxParticleMesh();
    if (!mesh) return;

    const limit = getParticleLimit();
    if (mesh.count > limit) mesh.count = limit;

    let instanceIndex = 0;
    for (let i = 0; i < state.activeParticles.length; i++) {
        const p = state.activeParticles[i];
        if (!isBoxParticle(p.kind)) continue;
        if (instanceIndex >= limit) break;

        const ratio = Math.max(0, p.life / p.maxLife);
        const scale = (p.size || 0.1) * ratio;
        _instancePosition.set(p.x || 0, p.y || 0, p.z || 0);
        _instanceScale.set(scale, scale, scale);
        _instanceMatrix.compose(_instancePosition, _instanceQuaternion, _instanceScale);
        mesh.setMatrixAt(instanceIndex, _instanceMatrix);
        mesh.setColorAt(instanceIndex, _instanceColor.setHex(p.color || 0xffffff));
        instanceIndex++;
    }

    mesh.count = instanceIndex;
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) {
        mesh.instanceColor.needsUpdate = true;
    }
}

export function updateParticles(delta: number): void {
    for (let i = state.activeParticles.length - 1; i >= 0; i--) {
        const p = state.activeParticles[i];
        p.life -= delta;

        if (p.life <= 0) {
            releaseMeshParticle(p);
            state.activeParticles[i] = state.activeParticles[state.activeParticles.length - 1];
            state.activeParticles.pop();
            continue;
        }

        const ratio = Math.max(0, p.life / p.maxLife);

        if (isBoxParticle(p.kind)) {
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
        } else if (p.mesh && p.kind === 'lightbeam') {
            p.mesh.scale.x = ratio;
            p.mesh.scale.z = ratio;
        }
    }

    updateBoxInstances();
}

export function spawnRocketFlame(position: THREE.Vector3, count: number, isBurst: boolean): void {
    const spawnCount = Math.min(scaleParticleCount(count), availableParticleSlots());
    if (spawnCount <= 0) return;

    for (let i = 0; i < spawnCount; i++) {
        const color = isBurst ? (Math.random() > 0.5 ? 0xffea00 : 0xffcc00) : (Math.random() > 0.4 ? 0xffd700 : 0xffaa00);
        const px = position.x + (Math.random() - 0.5) * 0.3;
        const py = position.y + (Math.random() - 0.5) * 0.1;
        const pz = position.z + (Math.random() - 0.5) * 0.3;
        const size = isBurst ? (0.25 + Math.random() * 0.25) : (0.15 + Math.random() * 0.15);
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
    if (boxParticleMesh && state.scene) {
        state.scene.remove(boxParticleMesh);
        (boxParticleMesh.material as THREE.Material).dispose();
        boxParticleMesh = null;
    }

    for (let i = state.activeParticles.length - 1; i >= 0; i--) {
        releaseMeshParticle(state.activeParticles[i]);
    }
    state.activeParticles.length = 0;
    materialPool.splice(0).forEach((mat) => mat.dispose());
    shockwaveMaterialPool.splice(0).forEach((mat) => mat.dispose());
}
