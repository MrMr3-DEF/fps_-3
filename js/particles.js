import * as THREE from 'three';
import { state } from './state.js';
import { LASER_BEAM_FADE_TIME, MAX_PARTICLES } from './config.js';

// Module-level shared geometries to eliminate GC overhead
const SHARED_BOX_GEO = new THREE.BoxGeometry(1, 1, 1);
const SHARED_CYL_GEO = new THREE.CylinderGeometry(0.025, 0.025, 1, 6);
SHARED_CYL_GEO.rotateX(Math.PI / 2); // Rotate Z axis forward
const SHARED_RING_GEO = new THREE.RingGeometry(0.9, 1.0, 32);
SHARED_RING_GEO.rotateX(-Math.PI / 2); // Rotate to lie flat horizontally in X-Z plane

// Material pool for basic particles to avoid shader recompilations and heap allocations
const materialPool = [];

function acquireBasicMaterial(colorHex) {
    if (materialPool.length > 0) {
        const mat = materialPool.pop();
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

function releaseBasicMaterial(mat) {
    if (materialPool.length < 500) {
        materialPool.push(mat);
    } else {
        mat.dispose();
    }
}

// Material pool for double-sided depth-write-disabled shockwave rings
const shockwaveMaterialPool = [];

function acquireShockwaveMaterial(colorHex) {
    if (shockwaveMaterialPool.length > 0) {
        const mat = shockwaveMaterialPool.pop();
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

function releaseShockwaveMaterial(mat) {
    if (shockwaveMaterialPool.length < 50) {
        shockwaveMaterialPool.push(mat);
    } else {
        mat.dispose();
    }
}

export function spawnParticles(position, color, count, speed, size, gravity) {
    if (state.activeParticles.length >= MAX_PARTICLES) return;
    
    // Cap count to not exceed MAX_PARTICLES limit
    const spawnCount = Math.min(count, MAX_PARTICLES - state.activeParticles.length);

    for (let i = 0; i < spawnCount; i++) {
        const mat = acquireBasicMaterial(color);
        const mesh = new THREE.Mesh(SHARED_BOX_GEO, mat);
        mesh.position.copy(position);
        mesh.scale.setScalar(size);
        
        // Add tiny random offset to position
        mesh.position.x += (Math.random() - 0.5) * 0.5;
        mesh.position.y += (Math.random() - 0.5) * 0.5;
        mesh.position.z += (Math.random() - 0.5) * 0.5;
        
        state.scene.add(mesh);
        
        // Outward velocity vector
        const velocity = new THREE.Vector3(
            (Math.random() - 0.5) * 2,
            (Math.random() - 0.3) * 2, // slightly biased upwards
            (Math.random() - 0.5) * 2
        ).normalize().multiplyScalar(speed * (0.4 + Math.random() * 0.8));
        
        const maxLife = 0.4 + Math.random() * 0.5; // lifetime between 0.4s and 0.9s
        state.activeParticles.push({
            mesh: mesh,
            velocity: velocity,
            gravity: gravity,
            life: maxLife,
            maxLife: maxLife,
            isSharedGeo: true,
            isBasicParticle: true
        });
    }
}

export function createLaserBeam(startPos, endPos, color = 0x00d2ff) {
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

    state.scene.add(mesh);

    state.activeParticles.push({
        mesh: mesh,
        isSniperTrail: true,
        isSharedGeo: true,
        isBasicParticle: true,
        life: LASER_BEAM_FADE_TIME,
        maxLife: LASER_BEAM_FADE_TIME
    });
}

export function spawnLightBeam(position) {
    if (state.activeParticles.length >= MAX_PARTICLES) return;

    const beamHeight = 120; // higher than pillars (as high as max spawn height of enemies)
    const beamGeo = new THREE.CylinderGeometry(2.5, 2.5, beamHeight, 16);
    const beamMat = new THREE.MeshBasicMaterial({
        color: 0x00aaff,
        transparent: true,
        opacity: 0.8,
        side: THREE.DoubleSide
    });
    const beam = new THREE.Mesh(beamGeo, beamMat);
    beam.position.set(position.x, beamHeight / 2, position.z); // go from ground (0) to 120
    
    state.scene.add(beam);
    
    const maxLife = 1.2; // 1.2s spawn animation
    state.activeParticles.push({
        mesh: beam,
        isLightBeam: true,
        life: maxLife,
        maxLife: maxLife
    });
    
    // Spawn secondary upward visual particles around the spawn footprint
    const sparkPos = new THREE.Vector3(position.x, 0.5, position.z);
    spawnParticles(sparkPos, 0x00aaff, 20, 14.0, 0.4, -6.0); // low upwards gravity drift
}

export function updateParticles(delta) {
    for (let i = state.activeParticles.length - 1; i >= 0; i--) {
        const p = state.activeParticles[i];
        p.life -= delta;

        if (p.life <= 0) {
            state.scene.remove(p.mesh);
            // Dispose of material, but do NOT dispose shared geometry
            if (p.mesh.geometry && !p.isSharedGeo) {
                p.mesh.geometry.dispose();
            }
            if (p.mesh.material) {
                if (p.isBasicParticle) {
                    releaseBasicMaterial(p.mesh.material);
                } else if (p.isShockwaveMaterial) {
                    releaseShockwaveMaterial(p.mesh.material);
                } else {
                    p.mesh.material.dispose();
                }
            }
            
            // Swap-and-pop O(1) removal
            state.activeParticles[i] = state.activeParticles[state.activeParticles.length - 1];
            state.activeParticles.pop();
        } else {
            const ratio = Math.max(0, p.life / p.maxLife);
            
            if (p.isSniperTrail) {
                p.mesh.material.opacity = ratio * 0.95;
                p.mesh.scale.x = ratio;
                p.mesh.scale.y = ratio;
            } else if (p.isShockwave) {
                // Expanding shockwave sphere
                const currentScale = 1.0 + (p.targetScale - 1.0) * (1.0 - ratio);
                p.mesh.scale.setScalar(currentScale);
                p.mesh.material.opacity = ratio * 0.7;
            } else if (p.isLightBeam) {
                // Fades out and shrinks
                p.mesh.material.opacity = ratio * 0.8;
                p.mesh.scale.x = ratio;
                p.mesh.scale.z = ratio;
            } else {
                // Flying spark particle under gravity
                p.velocity.y -= p.gravity * delta;
                p.mesh.position.addScaledVector(p.velocity, delta);
                p.mesh.scale.setScalar(ratio * p.maxLife); // Maintain original particle scale ratio
                p.mesh.material.opacity = ratio;
            }
        }
    }
}

export function spawnRocketFlame(position, count, isBurst) {
    if (state.activeParticles.length >= MAX_PARTICLES) return;
    const spawnCount = Math.min(count, MAX_PARTICLES - state.activeParticles.length);

    for (let i = 0; i < spawnCount; i++) {
        const color = isBurst ? (Math.random() > 0.5 ? 0xffea00 : 0xffcc00) : (Math.random() > 0.4 ? 0xffd700 : 0xffaa00);
        const mat = acquireBasicMaterial(color);
        mat.opacity = 0.95;
        const mesh = new THREE.Mesh(SHARED_BOX_GEO, mat);
        mesh.position.copy(position);
        
        // Add tiny offset around booster nozzle
        mesh.position.x += (Math.random() - 0.5) * 0.3;
        mesh.position.y += (Math.random() - 0.5) * 0.1;
        mesh.position.z += (Math.random() - 0.5) * 0.3;
        
        const size = isBurst ? (0.25 + Math.random() * 0.25) : (0.15 + Math.random() * 0.15);
        mesh.scale.setScalar(size);
        
        state.scene.add(mesh);
        
        // Velocity vectors pointing down and outwards at a very wide angle
        const velocity = new THREE.Vector3(
            (Math.random() - 0.5) * (isBurst ? 22.0 : 4.0),
            isBurst ? (-8.0 - Math.random() * 20.0) : (-18.0 - Math.random() * 12.0),
            (Math.random() - 0.5) * (isBurst ? 22.0 : 4.0)
        );
        
        const maxLife = isBurst ? (0.3 + Math.random() * 0.3) : (0.25 + Math.random() * 0.25);
        state.activeParticles.push({
            mesh: mesh,
            velocity: velocity,
            gravity: 0.0, // Let them just shoot down under their own velocity
            life: maxLife,
            maxLife: maxLife,
            isSharedGeo: true,
            isBasicParticle: true
        });
    }
}

export function spawnManeuveringBeam(position, count, dir) {
    if (!dir || dir.lengthSq() === 0) return;
    if (state.activeParticles.length >= MAX_PARTICLES) return;
    const spawnCount = Math.min(count, MAX_PARTICLES - state.activeParticles.length);

    for (let i = 0; i < spawnCount; i++) {
        const color = Math.random() > 0.5 ? 0xffea00 : 0xffcc00; // shades of yellow
        const mat = acquireBasicMaterial(color);
        mat.opacity = 0.95;
        const mesh = new THREE.Mesh(SHARED_BOX_GEO, mat);
        mesh.position.copy(position);
        
        // Offset slightly in the direction of the nozzle
        mesh.position.x += dir.x * 0.3 + (Math.random() - 0.5) * 0.1;
        mesh.position.y += (Math.random() - 0.5) * 0.1;
        mesh.position.z += dir.z * 0.3 + (Math.random() - 0.5) * 0.1;
        
        const size = 0.06 + Math.random() * 0.06;
        mesh.scale.setScalar(size);
        
        state.scene.add(mesh);
        
        // Velocity: pointing in the 'dir' direction with some dispersion
        const velocity = dir.clone().multiplyScalar(12.0 + Math.random() * 6.0);
        velocity.y = -3.0 - Math.random() * 4.0; // shoot slightly downwards as well as sideways
        velocity.x += (Math.random() - 0.5) * 1.5;
        velocity.z += (Math.random() - 0.5) * 1.5;
        
        const maxLife = 0.12 + Math.random() * 0.12;
        state.activeParticles.push({
            mesh: mesh,
            velocity: velocity,
            gravity: 0.0,
            life: maxLife,
            maxLife: maxLife,
            isSharedGeo: true,
            isBasicParticle: true
        });
    }
}

export function createShockwave(position, targetRadius, color = 0xffcc00) {
    if (state.activeParticles.length >= MAX_PARTICLES) return;

    const ringMat = acquireShockwaveMaterial(color);
    const mesh = new THREE.Mesh(SHARED_RING_GEO, ringMat);
    mesh.position.copy(position);
    mesh.position.y += 0.05; // slightly elevate to prevent clipping
    
    state.scene.add(mesh);
    
    state.activeParticles.push({
        mesh: mesh,
        isShockwave: true,
        isSharedGeo: true,
        isShockwaveMaterial: true,
        targetScale: targetRadius,
        life: 0.4,
        maxLife: 0.4
    });
}

