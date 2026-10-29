import * as THREE from 'three';
import type { EndingPillar } from './mechaEndingDebris.js';

export interface EndingCameraAdjustment { yaw: number; height: number; distanceScale: number; blocked: number }
/** Choose once under black. The seeded scenery stays exactly where it belongs;
 * only this bounded camera search may change the approved close composition. */
export function avoidEndingPillars(camera: THREE.PerspectiveCamera, target: THREE.Vector3, robot: THREE.Vector3,
    contact: THREE.Vector3, framing: readonly THREE.Vector3[], pillars: readonly EndingPillar[]): EndingCameraAdjustment {
    const base = camera.position.clone(), offset = base.clone().sub(target), distance = offset.length();
    const ray = new THREE.Ray(), intersection = new THREE.Vector3(), point = new THREE.Vector3();
    const samples: THREE.Vector3[] = [], weights: number[] = [];
    const right = new THREE.Vector3(1, 0, 0).applyQuaternion(camera.quaternion);
    // Protect the body width and fist connection area, not only their center
    // rays: a narrow clear slit can otherwise score well while hiding the robot.
    for (const y of [2, 14, 27]) for (const side of [-9, 0, 9]) {
        samples.push(robot.clone().add(new THREE.Vector3(0, y, 0)).addScaledVector(right, side)); weights.push(side === 0 ? 16 : 2);
    }
    for (const side of [-3, 0, 3]) for (const y of [-2, 2]) {
        samples.push(contact.clone().addScaledVector(right, side).add(new THREE.Vector3(0, y, 0))); weights.push(side === 0 ? 10 : 3);
    }
    let best = Infinity, bestPosition = base.clone(), bestResult = { yaw: 0, height: 0, distanceScale: 1, blocked: 0 };
    for (const yaw of [0, -5, 5, -10, 10, -15, 15]) for (const height of [0, 5, 10]) for (const scale of [1, 1.05, 1.1]) {
        point.copy(offset).applyAxisAngle(THREE.Object3D.DEFAULT_UP, THREE.MathUtils.degToRad(yaw));
        point.x *= scale; point.z *= scale; point.add(target); point.y = base.y + height;
        if (point.distanceTo(target) > distance * 1.1 + 1e-7) continue;
        camera.position.copy(point); camera.lookAt(target); camera.updateMatrixWorld(true);
        let clipped = 0, blocked = 0;
        for (const corner of framing) {
            const projected = corner.clone().project(camera);
            if (Math.abs(projected.x) > .98 || Math.abs(projected.y) > .98 || projected.z < -1 || projected.z > 1) clipped++;
        }
        samples.forEach((sample, index) => {
            ray.origin.copy(point); ray.direction.subVectors(sample, point).normalize();
            const length = point.distanceTo(sample);
            if (pillars.some(pillar => ray.intersectBox(pillar.bounds, intersection) && point.distanceTo(intersection) < length - .05)) blocked += weights[index];
        });
        const score = clipped * 100000 + blocked * 1000 + Math.abs(yaw) + height * .5 + (scale - 1) * 100;
        if (score < best) {
            best = score; bestPosition = point.clone();
            bestResult = { yaw, height, distanceScale: point.distanceTo(target) / distance, blocked };
        }
    }
    camera.position.copy(bestPosition); camera.lookAt(target); camera.updateMatrixWorld(true); return bestResult;
}

/** Absolute-time envelope: fire lifetimes, rather than trigger durations, own
 * the sustained rumble so seeking never loses an earlier explosion's shake. */
export function sampleEndingShake(age: number, blasts: readonly { birth: number; power: number }[], fireEnd: number): number {
    if (age < 0 || age >= fireEnd) return 0;
    let amplitude = .05;
    for (const blast of blasts) {
        const elapsed = age - blast.birth;
        if (elapsed >= 0 && elapsed < .65) amplitude += .015 * blast.power * (1 - elapsed / .65) ** 2;
    }
    const tail = THREE.MathUtils.clamp((fireEnd - age) / .6, 0, 1);
    return Math.min(.11, amplitude) * tail * tail * (3 - 2 * tail);
}
