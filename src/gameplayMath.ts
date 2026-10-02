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

const roundedBoxCuts = new Float64Array(8);
const boxAxes = ['x', 'y', 'z'] as const;

const cylinderPoints = new Float64Array(64);
const cylinderHull = new Int32Array(64);
const boxCorners = new Float64Array(24);

/** Exact finite-cylinder overlap with a box. Clip the box to the beam's two
 * end planes, project the remaining vertices onto its radial plane, and test
 * their convex hull against the visible circular cross-section. Fixed scratch
 * buffers bound the cost and avoid capsule damage beyond the flat beam ends. */
export function cylinderIntersectsBox(start: Vec3Like, end: Vec3Like, min: Vec3Like, max: Vec3Like, radius: number): boolean {
    const dx = end.x - start.x, dy = end.y - start.y, dz = end.z - start.z;
    const length = Math.hypot(dx, dy, dz);
    if (length <= 0 || radius <= 0) return false;
    const nx = dx / length, ny = dy / length, nz = dz / length;
    const radialLength = Math.hypot(nx, nz);
    const ux = radialLength > 1e-9 ? nz / radialLength : 1;
    const uy = 0, uz = radialLength > 1e-9 ? -nx / radialLength : 0;
    const vx = ny * uz, vy = nz * ux - nx * uz, vz = -ny * ux;
    let count = 0;
    const append = (x: number, y: number, z: number) => {
        cylinderPoints[count * 2] = x * ux + y * uy + z * uz;
        cylinderPoints[count * 2 + 1] = x * vx + y * vy + z * vz;
        count++;
    };
    for (let i = 0; i < 8; i++) {
        const x = (i & 1 ? max.x : min.x) - start.x;
        const y = (i & 2 ? max.y : min.y) - start.y;
        const z = (i & 4 ? max.z : min.z) - start.z;
        boxCorners[i * 3] = x; boxCorners[i * 3 + 1] = y; boxCorners[i * 3 + 2] = z;
        const projection = x * nx + y * ny + z * nz;
        if (projection >= 0 && projection <= length) append(x, y, z);
    }
    // Each of twelve box edges can cross either parallel end plane.
    for (let i = 0; i < 8; i++) for (let bit = 1; bit <= 4; bit *= 2) {
        if (i & bit) continue;
        const j = i | bit;
        const x = boxCorners[i * 3], y = boxCorners[i * 3 + 1], z = boxCorners[i * 3 + 2];
        const ex = boxCorners[j * 3] - x, ey = boxCorners[j * 3 + 1] - y, ez = boxCorners[j * 3 + 2] - z;
        const projection = x * nx + y * ny + z * nz, span = ex * nx + ey * ny + ez * nz;
        if (Math.abs(span) < 1e-12) continue;
        for (let plane = 0; plane < 2; plane++) {
            const t = ((plane ? length : 0) - projection) / span;
            if (t > 0 && t < 1) append(x + ex * t, y + ey * t, z + ez * t);
        }
    }
    if (!count) return false;
    for (let i = 1; i < count; i++) {
        const x = cylinderPoints[i * 2], y = cylinderPoints[i * 2 + 1]; let j = i;
        while (j > 0 && (cylinderPoints[(j - 1) * 2] > x || cylinderPoints[(j - 1) * 2] === x && cylinderPoints[(j - 1) * 2 + 1] > y)) {
            cylinderPoints[j * 2] = cylinderPoints[(j - 1) * 2]; cylinderPoints[j * 2 + 1] = cylinderPoints[(j - 1) * 2 + 1]; j--;
        }
        cylinderPoints[j * 2] = x; cylinderPoints[j * 2 + 1] = y;
    }
    const cross = (a: number, b: number, c: number) =>
        (cylinderPoints[b * 2] - cylinderPoints[a * 2]) * (cylinderPoints[c * 2 + 1] - cylinderPoints[a * 2 + 1])
        - (cylinderPoints[b * 2 + 1] - cylinderPoints[a * 2 + 1]) * (cylinderPoints[c * 2] - cylinderPoints[a * 2]);
    let size = 0;
    for (let i = 0; i < count; i++) {
        while (size >= 2 && cross(cylinderHull[size - 2], cylinderHull[size - 1], i) <= 0) size--;
        cylinderHull[size++] = i;
    }
    const lower = size;
    for (let i = count - 2; i >= 0; i--) {
        while (size > lower && cross(cylinderHull[size - 2], cylinderHull[size - 1], i) <= 0) size--;
        cylinderHull[size++] = i;
    }
    if (size > 1) size--;
    let inside = size >= 3;
    for (let i = 0; i < size; i++) {
        const a = cylinderHull[i], b = cylinderHull[(i + 1) % size];
        const x = cylinderPoints[a * 2], y = cylinderPoints[a * 2 + 1];
        const ex = cylinderPoints[b * 2] - x, ey = cylinderPoints[b * 2 + 1] - y;
        if (ex * -y - ey * -x < -1e-10) inside = false;
        const span = ex * ex + ey * ey;
        const t = span ? Math.max(0, Math.min(1, (-x * ex - y * ey) / span)) : 0;
        if ((x + ex * t) ** 2 + (y + ey * t) ** 2 <= radius * radius + 1e-10) return true;
    }
    return inside;
}

/** First contact of a swept sphere with a box, including rounded edges.
 * Expanding all three box axes alone makes a thick beam hit empty corner space.
 * Between the six face crossings, squared distance is one quadratic. */
export function segmentRoundedBoxHitT(start: Vec3Like, end: Vec3Like, min: Vec3Like, max: Vec3Like, radius: number): number | null {
    let count = 2;
    roundedBoxCuts[0] = 0; roundedBoxCuts[1] = 1;
    for (const axis of boxAxes) {
        const delta = end[axis] - start[axis];
        if (Math.abs(delta) < 1e-12) continue;
        for (let i = 0; i < 2; i++) {
            const face = i ? max[axis] : min[axis];
            const t = (face - start[axis]) / delta;
            if (t > 0 && t < 1) roundedBoxCuts[count++] = t;
        }
    }
    // Only eight values; insertion sorting avoids allocating a per-frame array.
    for (let i = 1; i < count; i++) {
        const value = roundedBoxCuts[i]; let j = i;
        while (j > 0 && roundedBoxCuts[j - 1] > value) { roundedBoxCuts[j] = roundedBoxCuts[j - 1]; j--; }
        roundedBoxCuts[j] = value;
    }
    for (let i = 1; i < count; i++) {
        const lo = roundedBoxCuts[i - 1], hi = roundedBoxCuts[i], middle = (lo + hi) / 2;
        let a = 0, b = 0, c = -radius * radius;
        for (const axis of boxAxes) {
            const delta = end[axis] - start[axis], value = start[axis] + delta * middle;
            if (value >= min[axis] && value <= max[axis]) continue;
            const offset = start[axis] - (value < min[axis] ? min[axis] : max[axis]);
            a += delta * delta; b += 2 * delta * offset; c += offset * offset;
        }
        if (a * lo * lo + b * lo + c <= 1e-10) return lo;
        if (a < 1e-12) continue;
        const discriminant = b * b - 4 * a * c;
        if (discriminant < 0) continue;
        const t = (-b - Math.sqrt(discriminant)) / (2 * a);
        if (t >= lo - 1e-10 && t <= hi + 1e-10) return Math.max(lo, Math.min(hi, t));
    }
    return null;
}
