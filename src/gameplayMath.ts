export interface Vec3Like {
    x: number;
    y: number;
    z: number;
}

/** Keep simulation steps stable after backgrounding or a long render stall. */
export function clampFrameDelta(delta: number, maxDelta: number): number {
    if (!Number.isFinite(delta) || !Number.isFinite(maxDelta) || maxDelta <= 0) return 0;
    return Math.max(0, Math.min(maxDelta, delta));
}

/**
 * Returns the first normalized point of contact between a line segment and a
 * sphere, or null when the segment misses. A start point already inside the
 * sphere counts as an immediate hit.
 */
export function segmentSphereHitT(
    start: Vec3Like,
    end: Vec3Like,
    center: Vec3Like,
    radius: number
): number | null {
    const dx = end.x - start.x;
    const dy = end.y - start.y;
    const dz = end.z - start.z;
    const fx = start.x - center.x;
    const fy = start.y - center.y;
    const fz = start.z - center.z;
    const radiusSq = radius * radius;
    const startDistanceSq = fx * fx + fy * fy + fz * fz;

    if (startDistanceSq <= radiusSq) return 0;

    const a = dx * dx + dy * dy + dz * dz;
    if (a === 0) return null;

    const b = 2 * (fx * dx + fy * dy + fz * dz);
    const c = startDistanceSq - radiusSq;
    const discriminant = b * b - 4 * a * c;
    if (discriminant < 0) return null;

    const root = Math.sqrt(discriminant);
    const near = (-b - root) / (2 * a);
    const far = (-b + root) / (2 * a);
    if (near >= 0 && near <= 1) return near;
    if (far >= 0 && far <= 1) return far;
    return null;
}

/**
 * Returns the first normalized point of contact between a segment and an AABB
 * using the slab method. The bounds are expected to be expanded by a moving
 * object's radius before calling this helper.
 */
export function segmentAabbHitT(
    start: Vec3Like,
    end: Vec3Like,
    min: Vec3Like,
    max: Vec3Like
): number | null {
    let enter = 0;
    let exit = 1;

    const dx = end.x - start.x;
    if (Math.abs(dx) < Number.EPSILON) {
        if (start.x < min.x || start.x > max.x) return null;
    } else {
        const first = (min.x - start.x) / dx;
        const second = (max.x - start.x) / dx;
        enter = Math.max(enter, Math.min(first, second));
        exit = Math.min(exit, Math.max(first, second));
        if (enter > exit) return null;
    }

    const dy = end.y - start.y;
    if (Math.abs(dy) < Number.EPSILON) {
        if (start.y < min.y || start.y > max.y) return null;
    } else {
        const first = (min.y - start.y) / dy;
        const second = (max.y - start.y) / dy;
        enter = Math.max(enter, Math.min(first, second));
        exit = Math.min(exit, Math.max(first, second));
        if (enter > exit) return null;
    }

    const dz = end.z - start.z;
    if (Math.abs(dz) < Number.EPSILON) {
        if (start.z < min.z || start.z > max.z) return null;
    } else {
        const first = (min.z - start.z) / dz;
        const second = (max.z - start.z) / dz;
        enter = Math.max(enter, Math.min(first, second));
        exit = Math.min(exit, Math.max(first, second));
        if (enter > exit) return null;
    }

    return enter >= 0 && enter <= 1 ? enter : null;
}
