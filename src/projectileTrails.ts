import * as THREE from 'three';

const TRAIL_POINT_LIMIT = 16;
const TRAIL_MAX_LENGTH = 90;
const TRAIL_FADE_SECONDS = 0.16;
const TRAIL_OPACITY = 0.95;

interface ProjectileTrail {
    line: THREE.Line<THREE.BufferGeometry, THREE.LineBasicMaterial>;
    positions: Float32Array;
    colors: Float32Array;
    points: THREE.Vector3[];
    pointCount: number;
    color: THREE.Color;
    fadeRemaining: number;
}

const activeTrails = new Map<THREE.Object3D, ProjectileTrail>();
const fadingTrails: ProjectileTrail[] = [];
const trailPool: ProjectileTrail[] = [];
const allTrails = new Set<ProjectileTrail>();
const _clippedTail = new THREE.Vector3();
const _curveControlA = new THREE.Vector3();
const _curveControlB = new THREE.Vector3();
const _curvePoint = new THREE.Vector3();
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
            _clippedTail.copy(trail.points[index + 1]).lerp(
                trail.points[index],
                segmentLength > 0 ? remaining / segmentLength : 0,
            );
            firstPoint = index + 1;
            clipped = true;
            break;
        }
        lengthFromHead += segmentLength;
        firstPoint = index;
    }

    let outputCount = 0;
    if (clipped) {
        trail.positions[0] = _clippedTail.x;
        trail.positions[1] = _clippedTail.y;
        trail.positions[2] = _clippedTail.z;
        outputCount = 1;
    }
    for (let index = firstPoint; index < trail.pointCount; index++) {
        const offset = outputCount * 3;
        const point = trail.points[index];
        trail.positions[offset] = point.x;
        trail.positions[offset + 1] = point.y;
        trail.positions[offset + 2] = point.z;
        outputCount++;
    }

    for (let index = 0; index < outputCount; index++) {
        const brightness = outputCount <= 1 ? 1 : 0.08 + 0.92 * index / (outputCount - 1);
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
export function appendProjectileTrail(projectile: THREE.Object3D): void {
    const trail = activeTrails.get(projectile);
    if (!trail) return;
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
