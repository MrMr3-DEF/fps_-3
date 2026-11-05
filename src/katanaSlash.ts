import * as THREE from 'three';
import { KATANA } from './config.js';

/** A fixed, tapered blade of energy, rather than an expanding ripple. Its
 * whole swept shape stays inside the forward damage semicircle. */
export function createKatanaSlash(): THREE.Mesh<THREE.ExtrudeGeometry, THREE.MeshBasicMaterial> {
    const width = KATANA.chargedRadius / 2;
    const depth = KATANA.chargedRadius / 4;
    const shape = new THREE.Shape();
    shape.moveTo(-width, 0);
    shape.quadraticCurveTo(0, depth * 2, width, 0);
    shape.quadraticCurveTo(0, depth * 1.25, -width, 0);
    const geometry = new THREE.ExtrudeGeometry(shape, { depth: 0.24, bevelEnabled: false, curveSegments: 32 });
    geometry.rotateX(-Math.PI / 2);
    geometry.translate(0, -0.12, 0);
    return new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({
        color: 0xffffff, transparent: true, opacity: 0.95, depthWrite: false, side: THREE.DoubleSide,
    }));
}

export function katanaSlashDistance(progress: number): number {
    return THREE.MathUtils.lerp(0.6, KATANA.chargedRadius * 0.75, THREE.MathUtils.clamp(progress, 0, 1));
}
