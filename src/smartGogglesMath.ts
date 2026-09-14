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

// Corner order uses the low bit for x, the middle bit for y and the high bit
// for z. These edges cover both the target box and the camera frustum.
const BOX_EDGES: ReadonlyArray<readonly [number, number]> = [
    [0, 1], [2, 3], [4, 5], [6, 7],
    [0, 2], [1, 3], [4, 6], [5, 7],
    [0, 4], [1, 5], [2, 6], [3, 7],
];

const _viewProjection = new THREE.Matrix4();
const _modelViewProjection = new THREE.Matrix4();
const _inverseModelViewProjection = new THREE.Matrix4();
const _inverseWorld = new THREE.Matrix4();
const _boxClipCorners = Array.from({ length: 8 }, () => new THREE.Vector4());
const _frustumLocalCorners = Array.from({ length: 8 }, () => new THREE.Vector4());
const _clippedStart = new THREE.Vector4();
const _clippedEnd = new THREE.Vector4();
const _localPoint = new THREE.Vector3();
const _closestLocalPoint = new THREE.Vector3();
const _closestWorldPoint = new THREE.Vector3();

const _clipInterval = { min: 0, max: 1 };
const _screenAccumulator = {
    minX: Number.POSITIVE_INFINITY,
    minY: Number.POSITIVE_INFINITY,
    maxX: Number.NEGATIVE_INFINITY,
    maxY: Number.NEGATIVE_INFINITY,
    count: 0,
};

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

function resetScreenAccumulator(): void {
    _screenAccumulator.minX = Number.POSITIVE_INFINITY;
    _screenAccumulator.minY = Number.POSITIVE_INFINITY;
    _screenAccumulator.maxX = Number.NEGATIVE_INFINITY;
    _screenAccumulator.maxY = Number.NEGATIVE_INFINITY;
    _screenAccumulator.count = 0;
}

function includeClipPoint(point: THREE.Vector4, viewportWidth: number, viewportHeight: number): void {
    if (!Number.isFinite(point.w) || point.w <= EPSILON) return;

    const ndcX = THREE.MathUtils.clamp(point.x / point.w, -1, 1);
    const ndcY = THREE.MathUtils.clamp(point.y / point.w, -1, 1);
    if (!Number.isFinite(ndcX) || !Number.isFinite(ndcY)) return;

    const screenX = (ndcX * 0.5 + 0.5) * viewportWidth;
    const screenY = (0.5 - ndcY * 0.5) * viewportHeight;
    _screenAccumulator.minX = Math.min(_screenAccumulator.minX, screenX);
    _screenAccumulator.minY = Math.min(_screenAccumulator.minY, screenY);
    _screenAccumulator.maxX = Math.max(_screenAccumulator.maxX, screenX);
    _screenAccumulator.maxY = Math.max(_screenAccumulator.maxY, screenY);
    _screenAccumulator.count++;
}

function clipAgainstHalfSpace(valueAtStart: number, valueDelta: number): boolean {
    if (Math.abs(valueDelta) <= EPSILON) return valueAtStart >= -EPSILON;

    const crossing = -valueAtStart / valueDelta;
    if (valueDelta > 0) {
        _clipInterval.min = Math.max(_clipInterval.min, crossing);
    } else {
        _clipInterval.max = Math.min(_clipInterval.max, crossing);
    }
    return _clipInterval.min <= _clipInterval.max + EPSILON;
}

/** Clip a homogeneous segment to Three.js' WebGL clip volume. */
function clipClipSpaceSegment(
    start: THREE.Vector4,
    end: THREE.Vector4,
    outStart: THREE.Vector4,
    outEnd: THREE.Vector4,
): boolean {
    const dx = end.x - start.x;
    const dy = end.y - start.y;
    const dz = end.z - start.z;
    const dw = end.w - start.w;
    _clipInterval.min = 0;
    _clipInterval.max = 1;

    if (!clipAgainstHalfSpace(start.x + start.w, dx + dw) ||
        !clipAgainstHalfSpace(start.w - start.x, dw - dx) ||
        !clipAgainstHalfSpace(start.y + start.w, dy + dw) ||
        !clipAgainstHalfSpace(start.w - start.y, dw - dy) ||
        !clipAgainstHalfSpace(start.z + start.w, dz + dw) ||
        !clipAgainstHalfSpace(start.w - start.z, dw - dz)) {
        return false;
    }

    const min = THREE.MathUtils.clamp(_clipInterval.min, 0, 1);
    const max = THREE.MathUtils.clamp(_clipInterval.max, 0, 1);
    outStart.set(start.x + dx * min, start.y + dy * min, start.z + dz * min, start.w + dw * min);
    outEnd.set(start.x + dx * max, start.y + dy * max, start.z + dz * max, start.w + dw * max);
    return outStart.w > EPSILON || outEnd.w > EPSILON;
}

/** Clip a local-space segment to an axis-aligned local box. */
function clipLocalSegmentToBox(
    start: THREE.Vector4,
    end: THREE.Vector4,
    box: THREE.Box3,
    outStart: THREE.Vector4,
    outEnd: THREE.Vector4,
): boolean {
    const dx = end.x - start.x;
    const dy = end.y - start.y;
    const dz = end.z - start.z;
    _clipInterval.min = 0;
    _clipInterval.max = 1;

    if (!clipAgainstHalfSpace(start.x - box.min.x, dx) ||
        !clipAgainstHalfSpace(box.max.x - start.x, -dx) ||
        !clipAgainstHalfSpace(start.y - box.min.y, dy) ||
        !clipAgainstHalfSpace(box.max.y - start.y, -dy) ||
        !clipAgainstHalfSpace(start.z - box.min.z, dz) ||
        !clipAgainstHalfSpace(box.max.z - start.z, -dz)) {
        return false;
    }

    const min = THREE.MathUtils.clamp(_clipInterval.min, 0, 1);
    const max = THREE.MathUtils.clamp(_clipInterval.max, 0, 1);
    outStart.set(start.x + dx * min, start.y + dy * min, start.z + dz * min, 1);
    outEnd.set(start.x + dx * max, start.y + dy * max, start.z + dz * max, 1);
    return true;
}

function setBoxClipCorners(box: THREE.Box3, transform: THREE.Matrix4): void {
    for (let i = 0; i < 8; i++) {
        _boxClipCorners[i].set(
            (i & 1) === 0 ? box.min.x : box.max.x,
            (i & 2) === 0 ? box.min.y : box.max.y,
            (i & 4) === 0 ? box.min.z : box.max.z,
            1,
        ).applyMatrix4(transform);
    }
}

function setFrustumLocalCorners(inverseTransform: THREE.Matrix4): boolean {
    for (let i = 0; i < 8; i++) {
        const point = _frustumLocalCorners[i].set(
            (i & 1) === 0 ? -1 : 1,
            (i & 2) === 0 ? -1 : 1,
            (i & 4) === 0 ? -1 : 1,
            1,
        ).applyMatrix4(inverseTransform);
        if (!Number.isFinite(point.w) || Math.abs(point.w) <= EPSILON) return false;
        point.multiplyScalar(1 / point.w);
        point.w = 1;
    }
    return true;
}

/**
 * Projects the visible intersection of an oriented local box and the camera
 * frustum into clipped viewport-pixel bounds. Returns false when no part of the
 * box is visible. Both box and frustum edges are clipped, so near-plane cuts
 * and cases where the frustum lies inside a large box remain well-defined. The
 * caller must update the camera's world matrix once before projecting a batch.
 */
export function projectOrientedBoxToScreen(
    localBox: THREE.Box3,
    worldMatrix: THREE.Matrix4,
    camera: THREE.PerspectiveCamera,
    viewportWidth: number,
    viewportHeight: number,
    out: ScreenBounds,
): boolean {
    if (localBox.isEmpty() || !Number.isFinite(viewportWidth) || !Number.isFinite(viewportHeight) ||
        viewportWidth <= 0 || viewportHeight <= 0) {
        clearBounds(out);
        return false;
    }

    _viewProjection.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
    _modelViewProjection.multiplyMatrices(_viewProjection, worldMatrix);
    const determinant = _modelViewProjection.determinant();
    if (!Number.isFinite(determinant) || Math.abs(determinant) <= EPSILON) {
        clearBounds(out);
        return false;
    }

    resetScreenAccumulator();
    setBoxClipCorners(localBox, _modelViewProjection);

    // Box edges contribute vertices when the target lies in or crosses the
    // frustum, including intersections with the near plane and screen edges.
    for (let i = 0; i < BOX_EDGES.length; i++) {
        const edge = BOX_EDGES[i];
        if (!clipClipSpaceSegment(
            _boxClipCorners[edge[0]],
            _boxClipCorners[edge[1]],
            _clippedStart,
            _clippedEnd,
        )) continue;
        includeClipPoint(_clippedStart, viewportWidth, viewportHeight);
        includeClipPoint(_clippedEnd, viewportWidth, viewportHeight);
    }

    // Frustum edges supply the complementary intersection vertices for a box
    // whose faces cover a viewport edge without any box corner being visible.
    _inverseModelViewProjection.copy(_modelViewProjection).invert();
    if (setFrustumLocalCorners(_inverseModelViewProjection)) {
        for (let i = 0; i < BOX_EDGES.length; i++) {
            const edge = BOX_EDGES[i];
            if (!clipLocalSegmentToBox(
                _frustumLocalCorners[edge[0]],
                _frustumLocalCorners[edge[1]],
                localBox,
                _clippedStart,
                _clippedEnd,
            )) continue;
            _clippedStart.applyMatrix4(_modelViewProjection);
            _clippedEnd.applyMatrix4(_modelViewProjection);
            includeClipPoint(_clippedStart, viewportWidth, viewportHeight);
            includeClipPoint(_clippedEnd, viewportWidth, viewportHeight);
        }
    }

    if (_screenAccumulator.count === 0) {
        clearBounds(out);
        return false;
    }

    out.left = THREE.MathUtils.clamp(_screenAccumulator.minX, 0, viewportWidth);
    out.top = THREE.MathUtils.clamp(_screenAccumulator.minY, 0, viewportHeight);
    out.right = THREE.MathUtils.clamp(_screenAccumulator.maxX, 0, viewportWidth);
    out.bottom = THREE.MathUtils.clamp(_screenAccumulator.maxY, 0, viewportHeight);
    out.width = Math.max(0, out.right - out.left);
    out.height = Math.max(0, out.bottom - out.top);
    return out.width > EPSILON && out.height > EPSILON;
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
