import * as THREE from 'three';

// A 120 Hz homing arc adds three points per 7.5 m step, so the full 90 m
// length needs 36 vertices plus the straight prefix.
const TRAIL_POINT_LIMIT = 48;
const TRAIL_MAX_LENGTH = 90;
const TRAIL_FADE_SECONDS = 0.16;
const TRAIL_OPACITY = 0.95;
const STRAIGHT_EPSILON = 1 - 1e-6;

interface ProjectileTrail {
    line: THREE.Line<THREE.BufferGeometry, THREE.LineBasicMaterial>;
    positions: Float32Array;
    colors: Float32Array;
    points: THREE.Vector3[];
    pointCount: number;
    color: THREE.Color;
    fadeRemaining: number;
    hasCurved: boolean;
    // Set for a locally fired projectile until the renderer can resolve the
    // muzzle that belongs to the frame the shot was fired in.
    pendingOriginWeapon: string | null;
}

const activeTrails = new Map<THREE.Object3D, ProjectileTrail>();
const fadingTrails: ProjectileTrail[] = [];
const trailPool: ProjectileTrail[] = [];
const allTrails = new Set<ProjectileTrail>();
const _clippedTail = new THREE.Vector3();
const _curveControlA = new THREE.Vector3();
const _curveControlB = new THREE.Vector3();
const _curvePoint = new THREE.Vector3();
const _previousDirection = new THREE.Vector3();
const _nextDirection = new THREE.Vector3();
const _syncedOrigin = new THREE.Vector3();
const _trailArcLengths = new Float32Array(TRAIL_POINT_LIMIT);
let trailsEnabled = true;

function createTrail(): ProjectileTrail {
    const positions = new Float32Array(TRAIL_POINT_LIMIT * 3);
    const colors = new Float32Array(TRAIL_POINT_LIMIT * 3);
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geometry.setDrawRange(0, 0);
    const material = new THREE.LineBasicMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: TRAIL_OPACITY,
        vertexColors: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        toneMapped: false,
    });
    const line = new THREE.Line(geometry, material);
    line.frustumCulled = false;
    line.renderOrder = 2;
    const trail = {
        line,
        positions,
        colors,
        points: Array.from({ length: TRAIL_POINT_LIMIT }, () => new THREE.Vector3()),
        pointCount: 0,
        color: new THREE.Color(),
        fadeRemaining: 0,
        hasCurved: false,
        pendingOriginWeapon: null,
    };
    allTrails.add(trail);
    return trail;
}

function recycleTrail(trail: ProjectileTrail): void {
    trail.line.parent?.remove(trail.line);
    trail.line.visible = false;
    trail.line.geometry.setDrawRange(0, 0);
    trail.pointCount = 0;
    trail.fadeRemaining = 0;
    trail.hasCurved = false;
    trail.pendingOriginWeapon = null;
    trailPool.push(trail);
}

function writeTrailGeometry(trail: ProjectileTrail): void {
    if (trail.pointCount < 1) {
        trail.line.geometry.setDrawRange(0, 0);
        return;
    }

    let firstPoint = 0;
    let clipped = false;
    let lengthFromHead = 0;
    for (let index = trail.pointCount - 2; index >= 0; index--) {
        const segmentLength = trail.points[index].distanceTo(trail.points[index + 1]);
        if (lengthFromHead + segmentLength > TRAIL_MAX_LENGTH) {
            const remaining = TRAIL_MAX_LENGTH - lengthFromHead;
            if (remaining > 1e-6) {
                _clippedTail.copy(trail.points[index + 1]).lerp(
                    trail.points[index],
                    remaining / segmentLength,
                );
                clipped = true;
            }
            // An exact-length boundary already ends at this vertex; emitting the
            // clipped copy as well would leave a zero-length duplicate tail.
            firstPoint = index + 1;
            break;
        }
        lengthFromHead += segmentLength;
        firstPoint = index;
    }

    let outputCount = 0;
    let arcLength = 0;
    if (clipped) {
        trail.positions[0] = _clippedTail.x;
        trail.positions[1] = _clippedTail.y;
        trail.positions[2] = _clippedTail.z;
        _trailArcLengths[0] = 0;
        outputCount = 1;
    }
    for (let index = firstPoint; index < trail.pointCount; index++) {
        const offset = outputCount * 3;
        const point = trail.points[index];
        if (outputCount > 0) {
            const dx = point.x - trail.positions[offset - 3];
            const dy = point.y - trail.positions[offset - 2];
            const dz = point.z - trail.positions[offset - 1];
            arcLength += Math.sqrt(dx * dx + dy * dy + dz * dz);
        }
        _trailArcLengths[outputCount] = arcLength;
        trail.positions[offset] = point.x;
        trail.positions[offset + 1] = point.y;
        trail.positions[offset + 2] = point.z;
        outputCount++;
    }

    // Shade by arc length rather than vertex index so a dense homing tail and
    // its sparse straight prefix fade at the same visual rate.
    const totalLength = outputCount > 0 ? _trailArcLengths[outputCount - 1] : 0;
    for (let index = 0; index < outputCount; index++) {
        const brightness = totalLength > 1e-6
            ? 0.08 + 0.92 * _trailArcLengths[index] / totalLength
            : 1;
        const offset = index * 3;
        trail.colors[offset] = trail.color.r * brightness;
        trail.colors[offset + 1] = trail.color.g * brightness;
        trail.colors[offset + 2] = trail.color.b * brightness;
    }
    (trail.line.geometry.getAttribute('position') as THREE.BufferAttribute).needsUpdate = true;
    (trail.line.geometry.getAttribute('color') as THREE.BufferAttribute).needsUpdate = true;
    trail.line.geometry.setDrawRange(0, outputCount);
}

/** Attach a pooled, world-space afterimage to a newly fired projectile. */
export function beginProjectileTrail(
    projectile: THREE.Object3D,
    scene: THREE.Scene,
    color: THREE.ColorRepresentation,
    pendingOriginWeapon?: string,
): THREE.Line | null {
    if (!trailsEnabled) return null;
    const existing = activeTrails.get(projectile);
    if (existing) {
        activeTrails.delete(projectile);
        recycleTrail(existing);
    }
    const trail = trailPool.pop() ?? createTrail();
    trail.line.visible = true;
    trail.line.material.opacity = TRAIL_OPACITY;
    trail.color.set(color);
    trail.points[0].copy(projectile.position);
    trail.pointCount = 1;
    trail.fadeRemaining = 0;
    trail.hasCurved = false;
    trail.pendingOriginWeapon = pendingOriginWeapon ?? null;
    writeTrailGeometry(trail);
    scene.add(trail.line);
    activeTrails.set(projectile, trail);
    return trail.line;
}

/** Applied live from Graphics settings; disabling also clears existing afterimages. */
export function setProjectileTrailsEnabled(enabled: boolean): void {
    trailsEnabled = enabled;
    if (!enabled) resetProjectileTrails();
}

/** Record the resolved post-collision position, preserving visible turns. */
export function appendProjectileTrail(projectile: THREE.Object3D, straight = false): void {
    const trail = activeTrails.get(projectile);
    if (!trail) return;
    if (trail.points[trail.pointCount - 1].distanceToSquared(projectile.position) < Number.EPSILON) return;
    if (straight && trail.pointCount >= 2) {
        // Physical flight begins at the shot socket while points[0] is the
        // visible muzzle. Replacing the head keeps the offset as one straight
        // segment instead of freezing a corner at the first flight sample.
        if (!trail.hasCurved) {
            trail.points[trail.pointCount - 1].copy(projectile.position);
            writeTrailGeometry(trail);
            return;
        }
        // After a turn, only a collinear continuation may move the head; a new
        // heading still appends a vertex so the bend stays visible.
        const previous = trail.points[trail.pointCount - 2];
        const head = trail.points[trail.pointCount - 1];
        _previousDirection.subVectors(head, previous).normalize();
        _nextDirection.subVectors(projectile.position, head).normalize();
        if (_previousDirection.dot(_nextDirection) > STRAIGHT_EPSILON) {
            head.copy(projectile.position);
            writeTrailGeometry(trail);
            return;
        }
    }
    if (appendTrailPoint(trail, projectile.position)) writeTrailGeometry(trail);
}

function appendTrailPoint(trail: ProjectileTrail, point: THREE.Vector3): boolean {
    const latest = trail.points[trail.pointCount - 1];
    if (latest.distanceToSquared(point) < Number.EPSILON) return false;
    if (trail.pointCount < TRAIL_POINT_LIMIT) {
        trail.points[trail.pointCount++].copy(point);
    } else {
        for (let index = 1; index < TRAIL_POINT_LIMIT; index++) {
            trail.points[index - 1].copy(trail.points[index]);
        }
        trail.points[TRAIL_POINT_LIMIT - 1].copy(point);
    }
    return true;
}

/** Add two cheap cubic samples so a per-frame steering change reads as an arc. */
export function appendCurvedProjectileTrail(
    projectile: THREE.Object3D,
    segmentStart: THREE.Vector3,
    startDirection: THREE.Vector3,
    endDirection: THREE.Vector3,
): void {
    const trail = activeTrails.get(projectile);
    if (!trail) return;
    const segmentLength = segmentStart.distanceTo(projectile.position);
    if (segmentLength <= Number.EPSILON) return;
    const handleLength = segmentLength / 3;
    _curveControlA.copy(segmentStart).addScaledVector(startDirection, handleLength);
    _curveControlB.copy(projectile.position).addScaledVector(endDirection, -handleLength);
    for (let sample = 1; sample <= 2; sample++) {
        const t = sample / 3;
        const inverse = 1 - t;
        _curvePoint.set(0, 0, 0)
            .addScaledVector(segmentStart, inverse * inverse * inverse)
            .addScaledVector(_curveControlA, 3 * inverse * inverse * t)
            .addScaledVector(_curveControlB, 3 * inverse * t * t)
            .addScaledVector(projectile.position, t * t * t);
        appendTrailPoint(trail, _curvePoint);
    }
    appendTrailPoint(trail, projectile.position);
    trail.hasCurved = true;
    writeTrailGeometry(trail);
}

/** Replace birth-frame muzzle guesses with the muzzle of the frame that is about
 * to be drawn. Each trail is corrected once; later frames keep it in world space. */
export function syncPendingProjectileTrailOrigins(
    resolveOrigin: (weapon: string, out: THREE.Vector3) => boolean,
): void {
    for (const trail of activeTrails.values()) syncPendingOrigin(trail, resolveOrigin);
    for (const trail of fadingTrails) syncPendingOrigin(trail, resolveOrigin);
}

function syncPendingOrigin(
    trail: ProjectileTrail,
    resolveOrigin: (weapon: string, out: THREE.Vector3) => boolean,
): void {
    const weapon = trail.pendingOriginWeapon;
    if (weapon === null) return;
    // Clear even on failure: a stale weapon or missing rig must not keep
    // re-anchoring the tracer to a later frame's pose.
    trail.pendingOriginWeapon = null;
    if (!resolveOrigin(weapon, _syncedOrigin)) return;
    trail.points[0].copy(_syncedOrigin);
    writeTrailGeometry(trail);
}

/** Leave the completed curve visible briefly after impact or range retirement. */
export function retireProjectileTrail(projectile: THREE.Object3D): void {
    const trail = activeTrails.get(projectile);
    if (!trail) return;
    activeTrails.delete(projectile);
    trail.fadeRemaining = TRAIL_FADE_SECONDS;
    fadingTrails.push(trail);
}

export function updateProjectileTrails(delta: number): void {
    for (let index = fadingTrails.length - 1; index >= 0; index--) {
        const trail = fadingTrails[index];
        trail.fadeRemaining -= Math.max(0, delta);
        if (trail.fadeRemaining <= 0) {
            fadingTrails[index] = fadingTrails[fadingTrails.length - 1];
            fadingTrails.pop();
            recycleTrail(trail);
        } else {
            trail.line.material.opacity = TRAIL_OPACITY * trail.fadeRemaining / TRAIL_FADE_SECONDS;
        }
    }
}

export function resetProjectileTrails(): void {
    for (const trail of activeTrails.values()) recycleTrail(trail);
    activeTrails.clear();
    for (const trail of fadingTrails) recycleTrail(trail);
    fadingTrails.length = 0;
}

export function disposeProjectileTrails(): void {
    resetProjectileTrails();
    for (const trail of allTrails) {
        trail.line.geometry.dispose();
        trail.line.material.dispose();
    }
    allTrails.clear();
    trailPool.length = 0;
}
