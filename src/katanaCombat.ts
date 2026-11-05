import * as THREE from 'three';
import { KATANA } from './config.js';
/** Receipt/simulation time only; callers never supply a claimed charge level. */
export class KatanaClock {
    started: number | null = null;
    released: number | null = null;
    charged = false;
    impacted = false;
    cancelled = false;
    chargeAtRelease = 0;
    begin(now: number): boolean {
        if (this.started !== null || this.released !== null && now < this.released + KATANA.duration)
            return false;
        this.cancelled = false;
        this.chargeAtRelease = 0;
        this.started = now;
        this.released = null;
        this.impacted = false;
        return true;
    }
    release(now: number): boolean {
        if (this.started === null)
            return false;
        this.chargeAtRelease = now - this.started;
        this.charged = this.chargeAtRelease >= KATANA.charge;
        this.started = null;
        this.released = now;
        this.impacted = false;
        return true;
    }
    damageActive(now: number): boolean {
        return !this.cancelled && this.released !== null && now >= this.released
            && now - this.released <= KATANA.damageWindow + 1e-9;
    }
    impact(now: number): boolean {
        if (this.released === null || this.impacted || now < this.released + (this.charged ? KATANA.chargedImpact : KATANA.impact))
            return false;
        this.impacted = true;
        return true;
    }
    cancel(): void { this.started = null; this.impacted = true; this.cancelled = true; }
    reset(): void { this.cancel(); this.released = null; this.charged = false; }
}
export interface KatanaPose {
    origin: THREE.Vector3;
    rotation: THREE.Quaternion;
}
/** Clip the actual oriented box against the half-cylinder's flat planes, then
 * minimize radial distance over its projected faces. No enclosing hit sphere
 * can extend the attack behind the player or beyond its height. */
export function katanaBoxContacts(box: THREE.Box3, matrix: THREE.Matrix4, pose: KatanaPose, radius: number, halfHeight: number): THREE.Vector3[] {
    const inverse = new THREE.Matrix4().compose(pose.origin, pose.rotation, new THREE.Vector3(1, 1, 1)).invert();
    const transform = inverse.clone().multiply(matrix);
    const corners: THREE.Vector3[] = [];
    for (let i = 0; i < 8; i++)
        corners.push(new THREE.Vector3(i & 1 ? box.max.x : box.min.x, i & 2 ? box.max.y : box.min.y, i & 4 ? box.max.z : box.min.z).applyMatrix4(transform));
    const bounds = new THREE.Box3().setFromPoints(corners);
    if (bounds.max.x < -radius || bounds.min.x > radius || bounds.max.y < -halfHeight || bounds.min.y > halfHeight || bounds.max.z < -radius || bounds.min.z > 0)
        return [];
    const faces = [[0, 1, 3, 2], [4, 6, 7, 5], [0, 4, 5, 1], [2, 3, 7, 6], [0, 2, 6, 4], [1, 5, 7, 3]];
    const contacts: THREE.Vector3[] = [];
    const world = inverse.clone().invert();
    if (box.containsPoint(pose.origin.clone().applyMatrix4(matrix.clone().invert())))
        contacts.push(pose.origin.clone());
    const add = (p: THREE.Vector3) => { if (p.x * p.x + p.z * p.z <= radius * radius + 1e-8)
        contacts.push(p.clone().applyMatrix4(world)); };
    for (const face of faces) {
        let polygon = face.map(i => corners[i].clone());
        for (const distance of [(p: THREE.Vector3) => halfHeight - p.y, (p: THREE.Vector3) => halfHeight + p.y, (p: THREE.Vector3) => -p.z]) {
            const clipped: THREE.Vector3[] = [];
            for (let i = 0; i < polygon.length; i++) {
                const a = polygon[i], b = polygon[(i + 1) % polygon.length], da = distance(a), db = distance(b);
                if (da >= 0)
                    clipped.push(a);
                if ((da >= 0) !== (db >= 0))
                    clipped.push(a.clone().lerp(b, da / (da - db)));
            }
            polygon = clipped;
        }
        for (let j = 1; j < polygon.length - 1; j++) {
            const a = polygon[0], b = polygon[j], c = polygon[j + 1];
            const bx = b.x - a.x, bz = b.z - a.z, cx = c.x - a.x, cz = c.z - a.z;
            const det = bx * cz - bz * cx;
            if (Math.abs(det) > 1e-12) {
                const u = (-a.x * cz + a.z * cx) / det, v = (-bx * a.z + bz * a.x) / det;
                if (u >= 0 && v >= 0 && u + v <= 1)
                    add(a.clone().addScaledVector(b.clone().sub(a), u).addScaledVector(c.clone().sub(a), v));
            }
            // Bounded face witnesses support partially exposed silhouettes.
            for (let u = 0; u <= 4; u++)
                for (let v = 0; v <= 4 - u; v++)
                    add(a.clone().multiplyScalar(1 - (u + v) / 4).addScaledVector(b, u / 4).addScaledVector(c, v / 4));
        }
        for (let i = 0; i < polygon.length; i++) {
            const a = polygon[i], b = polygon[(i + 1) % polygon.length], dx = b.x - a.x, dz = b.z - a.z;
            add(a);
            add(a.clone().lerp(b, THREE.MathUtils.clamp(-(a.x * dx + a.z * dz) / (dx * dx + dz * dz || 1), 0, 1)));
        }
    }
    return contacts;
}
