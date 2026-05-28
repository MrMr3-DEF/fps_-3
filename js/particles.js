import * as THREE from 'three';
import { state } from './state.js';

export function spawnParticles(position, color, count, speed, size, gravity) {
    const geom = new THREE.BoxGeometry(size, size, size);
    for (let i = 0; i < count; i++) {
        const mat = new THREE.MeshBasicMaterial({
            color: color,
            transparent: true,
            opacity: 1.0
        });
        const mesh = new THREE.Mesh(geom, mat);
        mesh.position.copy(position);
        
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
            maxLife: maxLife
        });
    }
}

export function createLaserBeam(startPos, endPos) {
    const distance = startPos.distanceTo(endPos);
    if (distance <= 0) return;

    const cylGeo = new THREE.CylinderGeometry(0.025, 0.025, 1, 6);
    cylGeo.rotateX(Math.PI / 2); // Rotate so height is along Z axis

    const cylMat = new THREE.MeshBasicMaterial({
        color: 0x00d2ff, // glowing neon blue
        transparent: true,
        opacity: 0.95
    });

    const mesh = new THREE.Mesh(cylGeo, cylMat);
    const midPoint = new THREE.Vector3().addVectors(startPos, endPos).multiplyScalar(0.5);
    mesh.position.copy(midPoint);
    mesh.scale.set(1, 1, distance);
    mesh.lookAt(endPos);

    state.scene.add(mesh);

    state.activeParticles.push({
        mesh: mesh,
        isSniperTrail: true,
        life: 0.25,
        maxLife: 0.25
    });
}

export function updateParticles(delta) {
    for (let i = state.activeParticles.length - 1; i >= 0; i--) {
        const p = state.activeParticles[i];
        p.life -= delta;

        if (p.life <= 0) {
            state.scene.remove(p.mesh);
            if (p.mesh.geometry) p.mesh.geometry.dispose();
            if (p.mesh.material) p.mesh.material.dispose();
            state.activeParticles.splice(i, 1);
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
            } else {
                // Flying spark particle under gravity
                p.velocity.y -= p.gravity * delta;
                p.mesh.position.addScaledVector(p.velocity, delta);
                p.mesh.scale.setScalar(ratio);
                p.mesh.material.opacity = ratio;
            }
        }
    }
}

