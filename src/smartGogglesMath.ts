import * as THREE from 'three';

export interface ScreenBounds {
    left: number;
    top: number;
    right: number;
    bottom: number;
    width: number;
    height: number;
}

export interface ScreenPoint {
    x: number;
    y: number;
}

export type CalloutHorizontalDirection = 'left' | 'right';
export type CalloutVerticalDirection = 'up' | 'down';

export interface SmartGogglesCalloutOptions {
    diagonalLength: number;
    horizontalLength: number;
    labelWidth: number;
    margin: number;
}

export interface SmartGogglesCalloutLayout {
    horizontal: CalloutHorizontalDirection;
    vertical: CalloutVerticalDirection;
    anchor: ScreenPoint;
    elbow: ScreenPoint;
    end: ScreenPoint;
    /** Left edge of the label box. */
    labelX: number;
    /** Y coordinate of the horizontal leader line. */
    labelY: number;
    /** Smart-goggles readouts always hang below their leader rule. */
    labelPlacement: 'above' | 'below';
}

export const DEFAULT_SMART_GOGGLES_CALLOUT_OPTIONS: Readonly<SmartGogglesCalloutOptions> = Object.freeze({
    diagonalLength: 20,
    horizontalLength: 112,
    labelWidth: 112,
    margin: 12,
});

const EPSILON = 1e-9;

const _inverseWorld = new THREE.Matrix4();
const _localPoint = new THREE.Vector3();
const _closestLocalPoint = new THREE.Vector3();
const _closestWorldPoint = new THREE.Vector3();
const _stableWorldCenter = new THREE.Vector3();
const _stableCameraCenter = new THREE.Vector3();
const _stableProjectedCenter = new THREE.Vector3();

export function createScreenBounds(): ScreenBounds {
    return { left: 0, top: 0, right: 0, bottom: 0, width: 0, height: 0 };
}

export function createSmartGogglesCalloutLayout(): SmartGogglesCalloutLayout {
    return {
        horizontal: 'right',
        vertical: 'down',
        anchor: { x: 0, y: 0 },
        elbow: { x: 0, y: 0 },
        end: { x: 0, y: 0 },
        labelX: 0,
        labelY: 0,
        labelPlacement: 'below',
    };
}

function clearBounds(out: ScreenBounds): void {
    out.left = 0;
    out.top = 0;
    out.right = 0;
    out.bottom = 0;
    out.width = 0;
    out.height = 0;
}

/**
 * Project one fixed maximum target envelope into a square screen-space frame.
 * Its center follows the target, while its size is derived only from camera
 * distance, FOV and object scale. Local or world rotation therefore cannot make
 * the frame pulse around a spinning or animated model.
 *
 * Bounds deliberately remain unclipped. The overlay layer clips them at the
 * viewport edge, so a partially departing target keeps the same frame size
 * until the complete envelope leaves the goggles.
 */
export function projectStableTargetSphereToScreen(
    localSphere: THREE.Sphere,
    worldMatrix: THREE.Matrix4,
    camera: THREE.PerspectiveCamera,
    viewportWidth: number,
    viewportHeight: number,
    out: ScreenBounds,
): boolean {
    if (localSphere.isEmpty() || !Number.isFinite(viewportWidth) || !Number.isFinite(viewportHeight) ||
        viewportWidth <= 0 || viewportHeight <= 0) {
        clearBounds(out);
        return false;
    }

    _stableWorldCenter.copy(localSphere.center).applyMatrix4(worldMatrix);
    const worldRadius = localSphere.radius * worldMatrix.getMaxScaleOnAxis();
    _stableCameraCenter.copy(_stableWorldCenter).applyMatrix4(camera.matrixWorldInverse);
    const depth = -_stableCameraCenter.z;
    const distance = _stableCameraCenter.length();
    if (!Number.isFinite(worldRadius) || worldRadius < 0 || !Number.isFinite(distance) ||
        depth <= EPSILON || depth + worldRadius < camera.near || depth - worldRadius > camera.far) {
        clearBounds(out);
        return false;
    }

    _stableProjectedCenter.copy(_stableWorldCenter).project(camera);
    const centerX = (_stableProjectedCenter.x * 0.5 + 0.5) * viewportWidth;
    const centerY = (0.5 - _stableProjectedCenter.y * 0.5) * viewportHeight;
    const focalPixels = Math.max(
        Math.abs(camera.projectionMatrix.elements[0]) * viewportWidth * 0.5,
        Math.abs(camera.projectionMatrix.elements[5]) * viewportHeight * 0.5,
    );
    const tangentDistance = Math.sqrt(Math.max(EPSILON, distance * distance - worldRadius * worldRadius));
    const halfSize = worldRadius >= distance
        ? Math.max(viewportWidth, viewportHeight)
        : focalPixels * worldRadius / tangentDistance;
    if (!Number.isFinite(centerX) || !Number.isFinite(centerY) || !Number.isFinite(halfSize)) {
        clearBounds(out);
        return false;
    }

    out.left = centerX - halfSize;
    out.top = centerY - halfSize;
    out.right = centerX + halfSize;
    out.bottom = centerY + halfSize;
    out.width = halfSize * 2;
    out.height = halfSize * 2;
    if (out.right <= 0 || out.left >= viewportWidth || out.bottom <= 0 || out.top >= viewportHeight) {
        clearBounds(out);
        return false;
    }
    return true;
}

/**
 * Places a callout from an outward-facing box corner when it fits, falling
 * back to the side with more usable room near a viewport edge.
 * The first leader segment always has equal absolute x/y deltas (45 degrees),
 * and the second segment is horizontal. Lengths shrink only when required to
 * keep the leader inside the viewport margin.
 */
export function layoutSmartGogglesCallout(
    bounds: ScreenBounds,
    viewportWidth: number,
    viewportHeight: number,
    out: SmartGogglesCalloutLayout,
    options: Partial<SmartGogglesCalloutOptions> = {},
): SmartGogglesCalloutLayout {
    const margin = Math.max(0, options.margin ?? DEFAULT_SMART_GOGGLES_CALLOUT_OPTIONS.margin);
    const desiredDiagonal = Math.max(0, options.diagonalLength ?? DEFAULT_SMART_GOGGLES_CALLOUT_OPTIONS.diagonalLength);
    const labelWidth = Math.max(0, options.labelWidth ?? DEFAULT_SMART_GOGGLES_CALLOUT_OPTIONS.labelWidth);
    const desiredHorizontal = Math.max(
        labelWidth,
        options.horizontalLength ?? DEFAULT_SMART_GOGGLES_CALLOUT_OPTIONS.horizontalLength,
        0,
    );
    const leftRoom = Math.max(0, bounds.left - margin);
    const rightRoom = Math.max(0, viewportWidth - margin - bounds.right);
    const topRoom = Math.max(0, bounds.top - margin);
    const bottomRoom = Math.max(0, viewportHeight - margin - bounds.bottom);

    // Fan labels away from the screen center when that side can fit the full
    // leader. This keeps nearby target callouts from converging on each other;
    // edge targets still flip inward when the outward side would clip.
    const outwardHorizontal: CalloutHorizontalDirection =
        (bounds.left + bounds.right) / 2 < viewportWidth / 2 ? 'left' : 'right';
    const outwardRoom = outwardHorizontal === 'right' ? rightRoom : leftRoom;
    const inwardRoom = outwardHorizontal === 'right' ? leftRoom : rightRoom;
    const desiredRoom = desiredDiagonal + desiredHorizontal;
    out.horizontal = outwardRoom >= desiredRoom || outwardRoom >= inwardRoom
        ? outwardHorizontal
        : (outwardHorizontal === 'right' ? 'left' : 'right');
    out.vertical = bottomRoom >= topRoom ? 'down' : 'up';

    const horizontalSign = out.horizontal === 'right' ? 1 : -1;
    const verticalSign = out.vertical === 'down' ? 1 : -1;
    const horizontalRoom = out.horizontal === 'right' ? rightRoom : leftRoom;
    const verticalRoom = out.vertical === 'down' ? bottomRoom : topRoom;

    out.anchor.x = out.horizontal === 'right' ? bounds.right : bounds.left;
    out.anchor.y = out.vertical === 'down' ? bounds.bottom : bounds.top;

    let diagonalLength = Math.min(desiredDiagonal, horizontalRoom, verticalRoom);
    let horizontalLength = Math.min(desiredHorizontal, Math.max(0, horizontalRoom - diagonalLength));
    if (diagonalLength > 0 && horizontalLength <= EPSILON && horizontalRoom > EPSILON) {
        // Preserve both recognizable segments in very tight horizontal space.
        diagonalLength = Math.min(diagonalLength, horizontalRoom * 0.5);
        horizontalLength = horizontalRoom - diagonalLength;
    }

    out.elbow.x = out.anchor.x + horizontalSign * diagonalLength;
    out.elbow.y = out.anchor.y + verticalSign * diagonalLength;
    out.end.x = out.elbow.x + horizontalSign * horizontalLength;
    out.end.y = out.elbow.y;
    out.labelY = out.elbow.y;
    out.labelPlacement = 'below';

    const naturalLabelX = out.horizontal === 'right' ? out.elbow.x : out.elbow.x - labelWidth;
    const maximumLabelX = Math.max(margin, viewportWidth - margin - labelWidth);
    out.labelX = THREE.MathUtils.clamp(naturalLabelX, margin, maximumLabelX);
    return out;
}

/** Return the shortest world-space distance from a point to an oriented box. */
export function distanceToOrientedBox(
    worldPoint: THREE.Vector3,
    localBox: THREE.Box3,
    worldMatrix: THREE.Matrix4,
): number {
    if (localBox.isEmpty()) return Number.POSITIVE_INFINITY;
    const determinant = worldMatrix.determinant();
    if (!Number.isFinite(determinant) || Math.abs(determinant) <= EPSILON) {
        return Number.POSITIVE_INFINITY;
    }

    _inverseWorld.copy(worldMatrix).invert();
    _localPoint.copy(worldPoint).applyMatrix4(_inverseWorld);
    _closestLocalPoint.copy(_localPoint).clamp(localBox.min, localBox.max);
    _closestWorldPoint.copy(_closestLocalPoint).applyMatrix4(worldMatrix);
    return _closestWorldPoint.distanceTo(worldPoint);
}

/** Classify reachability at the exact shared projectile endpoint. */
export function classifyOutOfRange(
    distance: number,
    maximumDistance: number,
): boolean {
    if (!Number.isFinite(distance)) return true;
    return distance > Math.max(0, maximumDistance);
}
