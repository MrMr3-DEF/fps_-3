import * as THREE from 'three';
import { state } from './state.js';
import { LASER_BEAM_FADE_TIME, MAX_PARTICLES } from './config.js';

// Shared geometries/material pools matter here because particles are created and
// destroyed constantly during combat, jumping and spawning.
const SHARED_BOX_GEO = new THREE.BoxGeometry(1, 1, 1);
const SHARED_CYL_GEO = new THREE.CylinderGeometry(0.025, 0.025, 1, 6);
SHARED_CYL_GEO.rotateX(Math.PI / 2);
const SHARED_RING_GEO = new THREE.RingGeometry(0.9, 1.0, 32);
SHARED_RING_GEO.rotateX(-Math.PI / 2);

const materialPool: THREE.MeshBasicMaterial[] = [];

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
    if (materialPool.length < 500) {
        materialPool.push(mat);
    } else {
        mat.dispose();
    }
}

const shockwaveMaterialPool: THREE.MeshBasicMaterial[] = [];

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
    mesh: THREE.Mesh;
    kind: ParticleKind;
    life: number;
    maxLife: number;
    vx?: number;
    vy?: number;
    vz?: number;
    gravity?: number;
    targetScale?: number;
}

const SHARED_BEAM_GEO = new THREE.CylinderGeometry(2.5, 2.5, 120, 16);
const SHARED_BEAM_MAT = new THREE.MeshBasicMaterial({
    color: 0x00aaff,
    transparent: true,
    opacity: 0.8,
    side: THREE.DoubleSide
});

export function spawnParticles(position: THREE.Vector3, color: number, count: number, speed: number, size: number, gravity: number): void {
    if (state.activeParticles.length >= MAX_PARTICLES) return;
    
    const spawnCount = Math.min(count, MAX_PARTICLES - state.activeParticles.length);

    for (let i = 0; i < spawnCount; i++) {
        const mat = acquireBasicMaterial(color);
        const mesh = new THREE.Mesh(SHARED_BOX_GEO, mat);
        mesh.position.copy(position);
        mesh.scale.setScalar(size);
        
        mesh.position.x += (Math.random() - 0.5) * 0.5;
        mesh.position.y += (Math.random() - 0.5) * 0.5;
        mesh.position.z += (Math.random() - 0.5) * 0.5;
        
        state.scene!.add(mesh);
        
        const vx_dir = (Math.random() - 0.5) * 2;
        const vy_dir = (Math.random() - 0.3) * 2;
        const vz_dir = (Math.random() - 0.5) * 2;
        const len = Math.sqrt(vx_dir * vx_dir + vy_dir * vy_dir + vz_dir * vz_dir);
        const norm = len > 0 ? 1 / len : 0;
        const speedScale = speed * (0.4 + Math.random() * 0.8);
        const vx = vx_dir * norm * speedScale;
        const vy = vy_dir * norm * speedScale;
        const vz = vz_dir * norm * speedScale;
        
        const maxLife = 0.4 + Math.random() * 0.5;
        state.activeParticles.push({
            mesh: mesh,
            kind: 'spark',
            vx: vx,
            vy: vy,
            vz: vz,
            gravity: gravity,
            life: maxLife,
            maxLife: maxLife
        });
    }
}

export function createLaserBeam(startPos: THREE.Vector3, endPos: THREE.Vector3, color: number = 0x00d2ff): void {
    if (state.activeParticles.length >= MAX_PARTICLES) return;

    const distance = startPos.distanceTo(endPos);
    if (distance <= 0) return;

    const cylMat = acquireBasicMaterial(color);
    cylMat.opacity = 0.95;

    const mesh = new THREE.Mesh(SHARED_CYL_GEO, cylMat);
    const midPoint = new THREE.Vector3().addVectors(startPos, endPos).multiplyScalar(0.5);
    mesh.position.copy(midPoint);
    mesh.scale.set(1, 1, distance);
    mesh.lookAt(endPos);

    state.scene!.add(mesh);

    state.activeParticles.push({
        mesh: mesh,
        kind: 'sniper-trail',
        life: LASER_BEAM_FADE_TIME,
        maxLife: LASER_BEAM_FADE_TIME
    });
}

export function spawnLightBeam(position: THREE.Vector3): void {
    if (state.activeParticles.length >= MAX_PARTICLES) return;

    const beamHeight = 120;
    const beam = new THREE.Mesh(SHARED_BEAM_GEO, SHARED_BEAM_MAT);
    beam.position.set(position.x, beamHeight / 2, position.z);
    
    state.scene!.add(beam);
    
    const maxLife = 1.2;
    state.activeParticles.push({
        mesh: beam,
        kind: 'lightbeam',
        life: maxLife,
        maxLife: maxLife
    });
    
    const sparkPos = new THREE.Vector3(position.x, 0.5, position.z);
    spawnParticles(sparkPos, 0x00aaff, 20, 14.0, 0.4, -6.0);
}

export function updateParticles(delta: number): void {
    for (let i = state.activeParticles.length - 1; i >= 0; i--) {
        const p: Particle = state.activeParticles[i];
        p.life -= delta;

        if (p.life <= 0) {
            state.scene!.remove(p.mesh);
            
            if (p.kind === 'spark' || p.kind === 'rocket-flame' || p.kind === 'maneuvering') {
                releaseBasicMaterial(p.mesh.material as THREE.MeshBasicMaterial);
            } else if (p.kind === 'sniper-trail') {
                releaseBasicMaterial(p.mesh.material as THREE.MeshBasicMaterial);
            } else if (p.kind === 'shockwave') {
                releaseShockwaveMaterial(p.mesh.material as THREE.MeshBasicMaterial);
            }
            
            state.activeParticles[i] = state.activeParticles[state.activeParticles.length - 1];
            state.activeParticles.pop();
        } else {
            const ratio = Math.max(0, p.life / p.maxLife);
            
            if (p.kind === 'sniper-trail') {
                (p.mesh.material as THREE.MeshBasicMaterial).opacity = ratio * 0.95;
                p.mesh.scale.x = ratio;
                p.mesh.scale.y = ratio;
            } else if (p.kind === 'shockwave') {
                const currentScale = 1.0 + (p.targetScale! - 1.0) * (1.0 - ratio);
                p.mesh.scale.setScalar(currentScale);
                (p.mesh.material as THREE.MeshBasicMaterial).opacity = ratio * 0.7;
            } else if (p.kind === 'lightbeam') {
                p.mesh.scale.x = ratio;
                p.mesh.scale.z = ratio;
            } else {
                if (p.vx !== undefined && p.vy !== undefined && p.vz !== undefined && p.gravity !== undefined) {
                    p.vy -= p.gravity * delta;
                    p.mesh.position.x += p.vx * delta;
                    p.mesh.position.y += p.vy * delta;
                    p.mesh.position.z += p.vz * delta;
                }
                p.mesh.scale.setScalar(ratio * p.maxLife);
                (p.mesh.material as THREE.MeshBasicMaterial).opacity = ratio;
            }
        }
    }
}

export function spawnRocketFlame(position: THREE.Vector3, count: number, isBurst: boolean): void {
    if (state.activeParticles.length >= MAX_PARTICLES) return;
    const spawnCount = Math.min(count, MAX_PARTICLES - state.activeParticles.length);

    for (let i = 0; i < spawnCount; i++) {
        const color = isBurst ? (Math.random() > 0.5 ? 0xffea00 : 0xffcc00) : (Math.random() > 0.4 ? 0xffd700 : 0xffaa00);
        const mat = acquireBasicMaterial(color);
        mat.opacity = 0.95;
        const mesh = new THREE.Mesh(SHARED_BOX_GEO, mat);
        mesh.position.copy(position);
        
        mesh.position.x += (Math.random() - 0.5) * 0.3;
        mesh.position.y += (Math.random() - 0.5) * 0.1;
        mesh.position.z += (Math.random() - 0.5) * 0.3;
        
        const size = isBurst ? (0.25 + Math.random() * 0.25) : (0.15 + Math.random() * 0.15);
        mesh.scale.setScalar(size);
        
        state.scene!.add(mesh);
        
        const vx = (Math.random() - 0.5) * (isBurst ? 22.0 : 4.0);
        const vy = isBurst ? (-8.0 - Math.random() * 20.0) : (-18.0 - Math.random() * 12.0);
        const vz = (Math.random() - 0.5) * (isBurst ? 22.0 : 4.0);
        
        const maxLife = isBurst ? (0.3 + Math.random() * 0.3) : (0.25 + Math.random() * 0.25);
        state.activeParticles.push({
            mesh: mesh,
            kind: 'rocket-flame',
            vx: vx,
            vy: vy,
            vz: vz,
            gravity: 0.0,
            life: maxLife,
            maxLife: maxLife
        });
    }
}

export function spawnManeuveringBeam(position: THREE.Vector3, count: number, dir: THREE.Vector3): void {
    if (!dir || dir.lengthSq() === 0) return;
    if (state.activeParticles.length >= MAX_PARTICLES) return;
    const spawnCount = Math.min(count, MAX_PARTICLES - state.activeParticles.length);

    for (let i = 0; i < spawnCount; i++) {
        const color = Math.random() > 0.5 ? 0xffea00 : 0xffcc00;
        const mat = acquireBasicMaterial(color);
        mat.opacity = 0.95;
        const mesh = new THREE.Mesh(SHARED_BOX_GEO, mat);
        mesh.position.copy(position);
        
        mesh.position.x += dir.x * 0.3 + (Math.random() - 0.5) * 0.1;
        mesh.position.y += (Math.random() - 0.5) * 0.1;
        mesh.position.z += dir.z * 0.3 + (Math.random() - 0.5) * 0.1;
        
        const size = 0.06 + Math.random() * 0.06;
        mesh.scale.setScalar(size);
        
        state.scene!.add(mesh);
        
        const speedScale = 12.0 + Math.random() * 6.0;
        const vx = dir.x * speedScale + (Math.random() - 0.5) * 1.5;
        const vy = -3.0 - Math.random() * 4.0;
        const vz = dir.z * speedScale + (Math.random() - 0.5) * 1.5;
        
        const maxLife = 0.12 + Math.random() * 0.12;
        state.activeParticles.push({
            mesh: mesh,
            kind: 'maneuvering',
            vx: vx,
            vy: vy,
            vz: vz,
            gravity: 0.0,
            life: maxLife,
            maxLife: maxLife
        });
    }
}

export function createShockwave(position: THREE.Vector3, targetRadius: number, color: number = 0xffcc00): void {
    if (state.activeParticles.length >= MAX_PARTICLES) return;

    const ringMat = acquireShockwaveMaterial(color);
    const mesh = new THREE.Mesh(SHARED_RING_GEO, ringMat);
    mesh.position.copy(position);
    mesh.position.y += 0.05;
    
    state.scene!.add(mesh);
    
    state.activeParticles.push({
        mesh: mesh,
        kind: 'shockwave',
        targetScale: targetRadius,
        life: 0.4,
        maxLife: 0.4
    });
}
