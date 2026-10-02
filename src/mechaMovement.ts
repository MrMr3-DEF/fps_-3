import * as THREE from 'three';
import { MAP_HALF_SIZE, MECHA_MOVEMENT_MARGIN } from './config.js';
import type { NavigationBox } from './mechaNavigation.js';

/** Pilot collision uses separate animated parts, not the enemy's route circle.
 * Heights matter: an elevated arm must not reserve ground beside a small wall.
 * The returned position is caller-owned; the hot sweep allocates no objects. */
export class MechaMovement {
    private hitTime = 1;
    private normalX = 0;
    private normalZ = 0;
    private readonly obstacles: readonly NavigationBox[];
    private readonly limit: number;
    constructor(obstacles: readonly NavigationBox[], limit = MAP_HALF_SIZE) { this.obstacles = obstacles; this.limit = limit; }

    resolve(start: THREE.Vector3, end: THREE.Vector3, parts: readonly NavigationBox[], out: THREE.Vector3): THREE.Vector3 {
        out.copy(start);
        let dx = end.x - start.x, dz = end.z - start.z;
        // Axis-aligned world boxes need at most two independent slide normals.
        // A small fixed budget also bounds corner/overlap recovery work.
        for (let pass = 0; pass < 4 && Math.abs(dx) + Math.abs(dz) > 1e-9; pass++) {
            this.hitTime = 1; this.normalX = this.normalZ = 0;
            for (const part of parts) {
                const x = part.x + out.x - start.x, z = part.z + out.z - start.z;
                const halfW = part.halfW + MECHA_MOVEMENT_MARGIN, halfD = part.halfD + MECHA_MOVEMENT_MARGIN;
                if (dx > 0) this.contact((this.limit - halfW - x) / dx, -1, 0);
                if (dx < 0) this.contact((-this.limit + halfW - x) / dx, 1, 0);
                if (dz > 0) this.contact((this.limit - halfD - z) / dz, 0, -1);
                if (dz < 0) this.contact((-this.limit + halfD - z) / dz, 0, 1);
                for (const box of this.obstacles) {
                    if (part.bottom >= box.top + MECHA_MOVEMENT_MARGIN || part.top <= box.bottom - MECHA_MOVEMENT_MARGIN) continue;
                    this.sweep(x, z, dx, dz, box.x - box.halfW - halfW, box.x + box.halfW + halfW,
                        box.z - box.halfD - halfD, box.z + box.halfD + halfD);
                }
            }
            out.x += dx * this.hitTime; out.z += dz * this.hitTime;
            if (!this.normalX && !this.normalZ) break;
            dx *= 1 - this.hitTime; dz *= 1 - this.hitTime;
            const inward = dx * this.normalX + dz * this.normalZ;
            if (inward < 0) { dx -= inward * this.normalX; dz -= inward * this.normalZ; }
        }
        return out;
    }
    private contact(time: number, x: number, z: number): void {
        if (time > this.hitTime || time > 1) return;
        this.hitTime = Math.max(0, time); this.normalX = x; this.normalZ = z;
    }
    private sweep(x: number, z: number, dx: number, dz: number, minX: number, maxX: number, minZ: number, maxZ: number): void {
        const penetrationX = Math.min(x - minX, maxX - x), penetrationZ = Math.min(z - minZ, maxZ - z);
        if (penetrationX > 1e-8 && penetrationZ > 1e-8) {
            // Pose changes or boarding can already overlap a proxy. Reject
            // deeper penetration, while allowing escape and tangential motion.
            const middleX = (minX + maxX) / 2, middleZ = (minZ + maxZ) / 2;
            const nx = Math.abs(x - middleX) < 1e-8 ? Math.sign(dx) || 1 : x < middleX ? -1 : 1;
            const nz = Math.abs(z - middleZ) < 1e-8 ? Math.sign(dz) || 1 : z < middleZ ? -1 : 1;
            if (penetrationX <= penetrationZ) { if (dx * nx < 0) this.contact(0, nx, 0); }
            else if (dz * nz < 0) this.contact(0, 0, nz);
            return;
        }
        let enter = -Infinity, exit = Infinity, nx = 0, nz = 0;
        if (Math.abs(dx) < 1e-10) { if (x <= minX || x >= maxX) return; }
        else {
            const a = (minX - x) / dx, b = (maxX - x) / dx;
            enter = Math.min(a, b); exit = Math.max(a, b); nx = dx > 0 ? -1 : 1;
        }
        if (Math.abs(dz) < 1e-10) { if (z <= minZ || z >= maxZ) return; }
        else {
            const a = (minZ - z) / dz, b = (maxZ - z) / dz, near = Math.min(a, b);
            if (near > enter) { enter = near; nx = 0; nz = dz > 0 ? -1 : 1; }
            exit = Math.min(exit, Math.max(a, b));
        }
        if (enter >= -1e-8 && enter <= exit && exit > 1e-8) this.contact(enter, nx, nz);
    }
}
