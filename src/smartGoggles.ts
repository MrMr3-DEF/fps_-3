import * as THREE from 'three';
import { BULLET_TRAVEL_DISTANCE } from './config.js';
import {
    classifyOutOfRange,
    createScreenBounds,
    createSmartGogglesCalloutLayout,
    distanceToOrientedBox,
    layoutSmartGogglesCallout,
    projectStableTargetSphereToScreen,
    type ScreenBounds,
    type SmartGogglesCalloutLayout,
} from './smartGogglesMath.js';
import {
    collectVisiblePeerMeshes,
    distanceToVisiblePeerMeshes,
    getStablePeerSphere,
    someVisiblePeerMeshBounds,
} from './smartGogglesPeerMath.js';
import { targetData } from './userDataTypes.js';
import { queryObstaclesAlongSegment } from './world.js';
import type { CelestialScanTarget } from './dayNightCycle.js';

const SVG_NS = 'http://www.w3.org/2000/svg';
const CORNER_SIZE = 15;
const BOX_PADDING = 6;
const MIN_BOX_SIZE = 20;
const LABEL_WIDTH = 168;
const LABEL_GLYPH_WIDTH = 9.85;
const LABEL_HORIZONTAL_PADDING = 16;
const LABEL_VIEWPORT_MARGIN = 12;
const CALLOUT_DIAGONAL_LENGTH = 54;
const ENTER_DELAY_MS = 16;
const TYPE_START_DELAY_MS = 310;
const TYPE_CHARACTER_MS = 8;
const TYPE_LINE_PAUSE_CHARACTERS = 2;
const EXIT_DURATION_MS = 180;
const ELIMINATION_DURATION_MS = 540;
const TELEPORT_DISTANCE_SQ = 40 * 40;
const OCCLUSION_SURFACE_EPSILON = 0.02;
const CORRUPTED_HEALTH_FRAMES = [
    'HEALTH ?? / ##',
    'HEALTH #? / ?#',
    'HEALTH // / ??',
    'HEALTH ?# / //',
] as const;
const CORRUPTED_IDENTIFIER_FRAMES = [
    '██████████',
    '???//???//',
    '[REDACTED]',
    '██?█//?███',
] as const;

export type SmartGogglesObstacleQuery = (
    startX: number,
    startZ: number,
    endX: number,
    endZ: number,
    out: THREE.Object3D[],
) => THREE.Object3D[];

type LockPhase = 'entering' | 'tracking' | 'leaving' | 'eliminated';
type ReadoutMode = 'facts' | 'warning';
type TargetVariant = 'enemy' | 'peer' | 'anomaly' | 'celestial';

export interface SmartGogglesPeerTarget {
    username: string;
    mesh: THREE.Group;
    hp: number;
    maxHp: number;
}

export type SmartGogglesPeerTargets = Readonly<Record<string, SmartGogglesPeerTarget>>;

export interface SmartGogglesAnomalyTarget {
    /** Fixed world-space gameplay proxy; animated render meshes are not traced. */
    hitbox: THREE.Mesh;
}

interface TargetLockRecord {
    targetKey: string;
    root: HTMLDivElement;
    corners: [HTMLDivElement, HTMLDivElement, HTMLDivElement, HTMLDivElement];
    killMark: SVGSVGElement;
    path: SVGPathElement;
    label: HTMLDivElement;
    labelWidth: number;
    identifier: HTMLSpanElement;
    distanceFact: HTMLSpanElement;
    healthFact: HTMLSpanElement;
    warning: HTMLSpanElement;
    bounds: ScreenBounds;
    layout: SmartGogglesCalloutLayout;
    lastWorldPosition: THREE.Vector3;
    lastWorldRadius: number;
    targetRevision: number;
    phase: LockPhase;
    seenFrame: number;
    activateAt: number;
    removeAt: number;
    lastDistanceText: string;
    lastHealthText: string;
    lastIdentifierText: string;
    readoutMode: ReadoutMode | null;
    typeStartedAt: number;
}

const _bodyCenter = new THREE.Vector3();
const _peerRootPosition = new THREE.Vector3();
const _toBody = new THREE.Vector3();
const _sightSample = new THREE.Vector3();
const _eliminatedWorldSphere = new THREE.Sphere();
const _worldIdentity = new THREE.Matrix4();
const _cameraFrustum = new THREE.Frustum();
const _viewProjection = new THREE.Matrix4();
const _occlusionRaycaster = new THREE.Raycaster();
const _occlusionCandidates: THREE.Object3D[] = [];
const _occlusionHits: THREE.Intersection[] = [];
const _enemyOccluders: THREE.Object3D[] = [];
const _visiblePeerMeshes: THREE.Mesh[] = [];
const NO_ADDITIONAL_OCCLUDERS: THREE.Object3D[] = [];

// A 3 x 3 x 3 lattice without its interior point covers face centers, edge
// midpoints and corners. Face centers make the common case cheap; silhouette
// corners and edges preserve acquisition when only a slice of a target peeks
// around cover.
const OCCLUSION_SAMPLE_FRACTIONS: ReadonlyArray<readonly [number, number, number]> = (() => {
    const samples: Array<readonly [number, number, number]> = [];
    for (let boundaryCount = 1; boundaryCount <= 3; boundaryCount++) {
        for (let ix = 0; ix < 3; ix++) {
            for (let iy = 0; iy < 3; iy++) {
                for (let iz = 0; iz < 3; iz++) {
                    const boundaries = Number(ix !== 1) + Number(iy !== 1) + Number(iz !== 1);
                    if (boundaries === boundaryCount) samples.push([ix / 2, iy / 2, iz / 2]);
                }
            }
        }
    }
    return samples;
})();

function setCornerGeometry(
    corner: HTMLElement,
    x: number,
    y: number,
    centerX: number,
    centerY: number,
): void {
    corner.style.left = `${x.toFixed(1)}px`;
    corner.style.top = `${y.toFixed(1)}px`;
    corner.style.setProperty('--goggles-collapse-x', `${(centerX - x - CORNER_SIZE / 2).toFixed(1)}px`);
    corner.style.setProperty('--goggles-collapse-y', `${(centerY - y - CORNER_SIZE / 2).toFixed(1)}px`);
}

function padBounds(bounds: ScreenBounds): void {
    bounds.left -= BOX_PADDING;
    bounds.top -= BOX_PADDING;
    bounds.right += BOX_PADDING;
    bounds.bottom += BOX_PADDING;

    if (bounds.right - bounds.left < MIN_BOX_SIZE) {
        const center = (bounds.left + bounds.right) / 2;
        bounds.left = center - MIN_BOX_SIZE / 2;
        bounds.right = bounds.left + MIN_BOX_SIZE;
    }
    if (bounds.bottom - bounds.top < MIN_BOX_SIZE) {
        const center = (bounds.top + bounds.bottom) / 2;
        bounds.top = center - MIN_BOX_SIZE / 2;
        bounds.bottom = bounds.top + MIN_BOX_SIZE;
    }
    bounds.width = Math.max(0, bounds.right - bounds.left);
    bounds.height = Math.max(0, bounds.bottom - bounds.top);
}

function formatCelestialDistance(distanceKm: number): string {
    return `DISTANCE ${Math.round(distanceKm).toLocaleString('en-US')} KM`;
}

function getCelestialLabelWidth(distanceText: string, viewportWidth: number): number {
    const desiredWidth = Math.ceil(distanceText.length * LABEL_GLYPH_WIDTH + LABEL_HORIZONTAL_PADDING);
    const availableWidth = Math.max(LABEL_WIDTH, viewportWidth - LABEL_VIEWPORT_MARGIN * 2);
    return Math.min(Math.max(LABEL_WIDTH, desiredWidth), availableWidth);
}

function setFactVisibility(record: TargetLockRecord, outOfRange: boolean): void {
    record.distanceFact.hidden = outOfRange;
    record.healthFact.hidden = outOfRange || record.root.classList.contains('is-celestial');
    record.warning.hidden = !outOfRange;
    record.root.classList.toggle('is-out-of-range', outOfRange);
}

function ensureAnomalyTearFilters(layer: HTMLElement): void {
    if (document.getElementById('goggles-anomaly-tear-a')) return;

    const svg = document.createElementNS(SVG_NS, 'svg');
    svg.classList.add('goggles-anomaly-filter-defs');
    svg.setAttribute('aria-hidden', 'true');
    const defs = document.createElementNS(SVG_NS, 'defs');
    for (const [id, seed] of [['goggles-anomaly-tear-a', '7'], ['goggles-anomaly-tear-b', '19']]) {
        const filter = document.createElementNS(SVG_NS, 'filter');
        filter.setAttribute('id', id);
        filter.setAttribute('x', '-20%');
        filter.setAttribute('y', '-10%');
        filter.setAttribute('width', '140%');
        filter.setAttribute('height', '120%');

        const turbulence = document.createElementNS(SVG_NS, 'feTurbulence');
        turbulence.setAttribute('type', 'fractalNoise');
        turbulence.setAttribute('baseFrequency', '0.006 0.15');
        turbulence.setAttribute('numOctaves', '1');
        turbulence.setAttribute('seed', seed);
        turbulence.setAttribute('result', 'noise');

        // Preserve high-frequency horizontal bands while neutralizing vertical
        // displacement, then quantize them into hard scanline offsets.
        const horizontalNoise = document.createElementNS(SVG_NS, 'feColorMatrix');
        horizontalNoise.setAttribute('in', 'noise');
        horizontalNoise.setAttribute('type', 'matrix');
        horizontalNoise.setAttribute('values', [
            '1 0 0 0 0',
            '0 0 0 0 0.5',
            '0 0 0 0 0',
            '0 0 0 1 0',
        ].join(' '));
        horizontalNoise.setAttribute('result', 'horizontal-noise');

        const steppedNoise = document.createElementNS(SVG_NS, 'feComponentTransfer');
        steppedNoise.setAttribute('in', 'horizontal-noise');
        steppedNoise.setAttribute('result', 'stepped-noise');
        const redSteps = document.createElementNS(SVG_NS, 'feFuncR');
        redSteps.setAttribute('type', 'discrete');
        redSteps.setAttribute('tableValues', '0 0.18 0.18 0.5 0.5 0.82 0.82 1');
        const greenCenter = document.createElementNS(SVG_NS, 'feFuncG');
        greenCenter.setAttribute('type', 'linear');
        greenCenter.setAttribute('slope', '0');
        greenCenter.setAttribute('intercept', '0.5');
        steppedNoise.append(redSteps, greenCenter);

        const displacement = document.createElementNS(SVG_NS, 'feDisplacementMap');
        displacement.setAttribute('in', 'SourceGraphic');
        displacement.setAttribute('in2', 'stepped-noise');
        displacement.setAttribute('scale', '28');
        displacement.setAttribute('xChannelSelector', 'R');
        displacement.setAttribute('yChannelSelector', 'G');
        filter.append(turbulence, horizontalNoise, steppedNoise, displacement);
        defs.appendChild(filter);
    }
    svg.appendChild(defs);
    layer.appendChild(svg);
}

/** One DOM overlay per visible NPC or remote-player enemy. */
export class SmartGogglesHud {
    private readonly records = new Map<string, TargetLockRecord>();
    private readonly retiringRecords = new Set<TargetLockRecord>();
    private readonly hiddenHealthBars = new Map<THREE.Object3D, boolean>();
    private readonly layer: HTMLElement;
    private readonly reducedMotion: boolean;
    private frame = 0;
    private active = false;
    private anomalyDetectedThisFrame = false;

    constructor(layer: HTMLElement) {
        this.layer = layer;
        this.reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
        ensureAnomalyTearFilters(layer);
    }

    get isAnomalyDetected(): boolean {
        return this.anomalyDetectedThisFrame;
    }

    update(
        camera: THREE.PerspectiveCamera,
        playerPosition: THREE.Vector3,
        weaponOrigin: THREE.Vector3,
        targets: readonly THREE.Group[],
        peers: SmartGogglesPeerTargets,
        enabled: boolean,
        now = performance.now(),
        anomalyTarget: SmartGogglesAnomalyTarget | null = null,
        celestialTargets: readonly CelestialScanTarget[] = [],
    ): void {
        this.anomalyDetectedThisFrame = false;
        if (!enabled) {
            if (this.active || this.records.size > 0 || this.retiringRecords.size > 0) this.reset();
            return;
        }

        this.active = true;
        this.frame++;
        const viewportWidth = this.layer.clientWidth || window.innerWidth;
        const viewportHeight = this.layer.clientHeight || window.innerHeight;
        if (viewportWidth <= 0 || viewportHeight <= 0) return;
        _cameraFrustum.setFromProjectionMatrix(
            _viewProjection.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse),
        );

        // Recognition respects other rendered enemies as well as buildings.
        // Restrict NPC occluders to this narrow camera frustum; remote rooms add
        // at most four peer avatars.
        _enemyOccluders.length = 0;
        for (let index = 0; index < targets.length; index++) {
            const target = targets[index];
            const bodyMesh = targetData(target).bodyMesh;
            if (!target.visible || !bodyMesh?.visible) continue;
            bodyMesh.updateWorldMatrix(true, false);
            if (_cameraFrustum.intersectsObject(bodyMesh)) _enemyOccluders.push(bodyMesh);
        }
        for (const peer of Object.values(peers)) {
            if (!peer.mesh.visible || peer.hp <= 0) continue;
            collectVisiblePeerMeshes(peer.mesh, _visiblePeerMeshes);
            for (let i = 0; i < _visiblePeerMeshes.length; i++) _enemyOccluders.push(_visiblePeerMeshes[i]);
        }

        for (let index = 0; index < targets.length; index++) {
            const target = targets[index];
            const data = targetData(target);
            const targetKey = `npc:${data.index}`;
            const targetRevision = data.eliminationRevision ?? 0;
            const previousRecord = this.records.get(targetKey);
            if (previousRecord && previousRecord.targetRevision !== targetRevision) {
                this.eliminate(previousRecord, now);
                this.records.delete(targetKey);
            }
            this.hideWorldHealthBar(data.healthBarGroup);
            if (!target.visible || !data.bodyMesh?.visible) continue;

            const geometry = data.bodyMesh.geometry;
            if (!geometry.boundingBox) geometry.computeBoundingBox();
            if (!geometry.boundingSphere) geometry.computeBoundingSphere();
            const localBox = geometry.boundingBox;
            const localSphere = geometry.boundingSphere;
            if (!localBox || !localSphere) continue;

            data.bodyMesh.updateWorldMatrix(true, false);
            if (!_cameraFrustum.intersectsObject(data.bodyMesh)) continue;
            _bodyCenter.copy(localSphere.center).applyMatrix4(data.bodyMesh.matrixWorld);
            if (!hasLineOfSightToOrientedBox(
                camera.position,
                localBox,
                data.bodyMesh.matrixWorld,
                queryObstaclesAlongSegment,
                _enemyOccluders,
                data.bodyMesh,
            )) continue;

            const record = this.records.get(targetKey);
            const projectionBounds = record?.bounds ?? createScreenBounds();
            if (!projectStableTargetSphereToScreen(
                localSphere,
                data.bodyMesh.matrixWorld,
                camera,
                viewportWidth,
                viewportHeight,
                projectionBounds,
            )) continue;

            const reachableDistance = distanceToOrientedBox(
                weaponOrigin,
                localBox,
                data.bodyMesh.matrixWorld,
            );
            this.trackTarget(
                targetKey,
                targetRevision,
                'enemy',
                'Enemy',
                projectionBounds,
                _bodyCenter,
                localSphere.radius * data.bodyMesh.matrixWorld.getMaxScaleOnAxis(),
                playerPosition.distanceTo(_bodyCenter),
                reachableDistance,
                data.hp,
                data.maxHp,
                viewportWidth,
                viewportHeight,
                now,
            );
        }

        for (const [peerId, peer] of Object.entries(peers)) {
            const targetKey = `peer:${peerId}`;
            if (peer.hp <= 0) {
                const previousRecord = this.records.get(targetKey);
                if (previousRecord) {
                    this.eliminate(previousRecord, now);
                    this.records.delete(targetKey);
                }
                continue;
            }
            if (!peer.mesh.visible) continue;

            const record = this.records.get(targetKey);
            const projectionBounds = record?.bounds ?? createScreenBounds();
            const stablePeerSphere = getStablePeerSphere(peer.mesh);
            if (!stablePeerSphere || !projectStableTargetSphereToScreen(
                stablePeerSphere,
                peer.mesh.matrixWorld,
                camera,
                viewportWidth,
                viewportHeight,
                projectionBounds,
            )) continue;
            if (!someVisiblePeerMeshBounds(
                peer.mesh,
                (localBox, worldMatrix) => hasLineOfSightToOrientedBox(
                    camera.position,
                    localBox,
                    worldMatrix,
                    queryObstaclesAlongSegment,
                    _enemyOccluders,
                    peer.mesh,
                ),
            )) continue;

            _bodyCenter.copy(stablePeerSphere.center).applyMatrix4(peer.mesh.matrixWorld);
            peer.mesh.getWorldPosition(_peerRootPosition);
            this.trackTarget(
                targetKey,
                0,
                'peer',
                peer.username,
                projectionBounds,
                _bodyCenter,
                stablePeerSphere.radius * peer.mesh.matrixWorld.getMaxScaleOnAxis(),
                playerPosition.distanceTo(_peerRootPosition),
                distanceToVisiblePeerMeshes(weaponOrigin, peer.mesh),
                peer.hp,
                peer.maxHp,
                viewportWidth,
                viewportHeight,
                now,
            );
        }

        if (anomalyTarget) {
            const hitbox = anomalyTarget.hitbox;
            const geometry = hitbox.geometry;
            if (!geometry.boundingBox) geometry.computeBoundingBox();
            if (!geometry.boundingSphere) geometry.computeBoundingSphere();
            const localBox = geometry.boundingBox;
            const localSphere = geometry.boundingSphere;
            if (localBox && localSphere) {
                hitbox.updateWorldMatrix(true, false);
                const targetKey = 'anomaly:goth-girlfriend';
                const record = this.records.get(targetKey);
                const projectionBounds = record?.bounds ?? createScreenBounds();
                if (_cameraFrustum.intersectsObject(hitbox) && hasLineOfSightToOrientedBox(
                    camera.position,
                    localBox,
                    hitbox.matrixWorld,
                    queryObstaclesAlongSegment,
                    _enemyOccluders,
                    hitbox,
                ) && projectStableTargetSphereToScreen(
                    localSphere,
                    hitbox.matrixWorld,
                    camera,
                    viewportWidth,
                    viewportHeight,
                    projectionBounds,
                )) {
                    _bodyCenter.copy(localSphere.center).applyMatrix4(hitbox.matrixWorld);
                    this.trackTarget(
                        targetKey,
                        0,
                        'anomaly',
                        CORRUPTED_IDENTIFIER_FRAMES[
                            this.reducedMotion ? 0 : Math.floor(now / 72) % CORRUPTED_IDENTIFIER_FRAMES.length
                        ],
                        projectionBounds,
                        _bodyCenter,
                        localSphere.radius * hitbox.matrixWorld.getMaxScaleOnAxis(),
                        playerPosition.distanceTo(_bodyCenter),
                        distanceToOrientedBox(weaponOrigin, localBox, hitbox.matrixWorld),
                        0,
                        0,
                        viewportWidth,
                        viewportHeight,
                        now,
                    );
                    this.anomalyDetectedThisFrame = true;
                }
            }
        }

        for (const celestial of celestialTargets) {
            const mesh = celestial.mesh;
            if (!mesh.visible) continue;
            const geometry = mesh.geometry;
            if (!geometry.boundingBox) geometry.computeBoundingBox();
            if (!geometry.boundingSphere) geometry.computeBoundingSphere();
            const localBox = geometry.boundingBox;
            const localSphere = geometry.boundingSphere;
            if (!localBox || !localSphere) continue;

            mesh.updateWorldMatrix(true, false);
            if (!_cameraFrustum.intersectsObject(mesh) || !hasLineOfSightToOrientedBox(
                camera.position,
                localBox,
                mesh.matrixWorld,
                queryObstaclesAlongSegment,
                _enemyOccluders,
                mesh,
            )) continue;

            const targetKey = `celestial:${celestial.key}`;
            const record = this.records.get(targetKey);
            const projectionBounds = record?.bounds ?? createScreenBounds();
            if (!projectStableTargetSphereToScreen(
                localSphere,
                mesh.matrixWorld,
                camera,
                viewportWidth,
                viewportHeight,
                projectionBounds,
            )) continue;

            _bodyCenter.copy(localSphere.center).applyMatrix4(mesh.matrixWorld);
            this.trackTarget(
                targetKey,
                0,
                'celestial',
                celestial.key,
                projectionBounds,
                _bodyCenter,
                localSphere.radius * mesh.matrixWorld.getMaxScaleOnAxis(),
                celestial.distanceKm,
                0,
                0,
                0,
                viewportWidth,
                viewportHeight,
                now,
            );
        }

        for (const [targetKey, record] of this.records) {
            if (record.seenFrame === this.frame) continue;
            if (record.phase !== 'leaving') this.beginLeaving(record, now);
            if (now >= record.removeAt) {
                record.root.remove();
                this.records.delete(targetKey);
            }
        }
        for (const record of this.retiringRecords) {
            if (now >= record.removeAt || (
                record.phase === 'eliminated' &&
                !this.updateEliminatedGeometry(record, camera, viewportWidth, viewportHeight)
            )) {
                record.root.remove();
                this.retiringRecords.delete(record);
            }
        }
    }

    private trackTarget(
        targetKey: string,
        targetRevision: number,
        variant: TargetVariant,
        identifierText: string,
        bounds: ScreenBounds,
        worldPosition: THREE.Vector3,
        worldRadius: number,
        centerDistance: number,
        reachableDistance: number,
        hp: number,
        maxHp: number,
        viewportWidth: number,
        viewportHeight: number,
        now: number,
    ): void {
        let record = this.records.get(targetKey);
        if (record && record.lastWorldPosition.distanceToSquared(worldPosition) > TELEPORT_DISTANCE_SQ) {
            this.retire(record, now);
            this.records.delete(targetKey);
            record = undefined;
        }
        if (!record) {
            record = this.createRecord(targetKey, targetRevision, variant, bounds, now);
            this.records.set(targetKey, record);
        }

        record.seenFrame = this.frame;
        record.lastIdentifierText = identifierText;
        record.lastWorldPosition.copy(worldPosition);
        record.lastWorldRadius = worldRadius;
        const distanceText = variant === 'celestial'
            ? formatCelestialDistance(centerDistance)
            : `DISTANCE ${Math.round(centerDistance)} M`;
        record.labelWidth = variant === 'celestial'
            ? getCelestialLabelWidth(distanceText, viewportWidth)
            : LABEL_WIDTH;
        padBounds(record.bounds);
        layoutSmartGogglesCallout(
            record.bounds,
            viewportWidth,
            viewportHeight,
            record.layout,
            { labelWidth: record.labelWidth, diagonalLength: CALLOUT_DIAGONAL_LENGTH },
        );
        this.updateGeometry(record);

        const outOfRange = (variant === 'enemy' || variant === 'peer') && classifyOutOfRange(
            reachableDistance,
            BULLET_TRAVEL_DISTANCE,
        );
        setFactVisibility(record, outOfRange);
        const readoutMode: ReadoutMode = outOfRange ? 'warning' : 'facts';
        if (record.readoutMode !== readoutMode) {
            record.readoutMode = readoutMode;
            record.typeStartedAt = now + TYPE_START_DELAY_MS;
            record.identifier.textContent = '';
            record.distanceFact.textContent = '';
            record.healthFact.textContent = '';
            record.warning.textContent = '';
        }
        if (!outOfRange) {
            record.lastDistanceText = distanceText;
            record.lastHealthText = variant === 'celestial'
                ? ''
                : variant === 'anomaly'
                    ? CORRUPTED_HEALTH_FRAMES[
                        this.reducedMotion ? 0 : Math.floor(now / 72) % CORRUPTED_HEALTH_FRAMES.length
                    ]
                    : `HEALTH ${Math.max(0, hp)} / ${Math.max(0, maxHp)}`;
        }
        this.updateTypedReadout(record, now);

        if (record.phase === 'leaving') {
            record.root.classList.remove('is-leaving');
            record.root.classList.add('is-active');
            record.phase = 'tracking';
        } else if (record.phase === 'entering' && now >= record.activateAt) {
            record.root.classList.add('is-active');
            record.phase = 'tracking';
        }
    }

    private updateTypedReadout(record: TargetLockRecord, now: number): void {
        const characterBudget = this.reducedMotion
            ? Number.POSITIVE_INFINITY
            : Math.max(0, Math.floor((now - record.typeStartedAt) / TYPE_CHARACTER_MS));
        const visibleIdentifier = record.lastIdentifierText.slice(0, characterBudget);
        if (record.identifier.textContent !== visibleIdentifier) record.identifier.textContent = visibleIdentifier;
        const readoutBudget = Math.max(
            0,
            characterBudget - record.lastIdentifierText.length - TYPE_LINE_PAUSE_CHARACTERS,
        );

        if (record.readoutMode === 'warning') {
            const warningText = 'OUT OF RANGE';
            const visibleWarning = warningText.slice(0, readoutBudget);
            if (record.warning.textContent !== visibleWarning) record.warning.textContent = visibleWarning;
            return;
        }

        const visibleDistance = record.lastDistanceText.slice(0, readoutBudget);
        const healthBudget = Math.max(
            0,
            readoutBudget - record.lastDistanceText.length - TYPE_LINE_PAUSE_CHARACTERS,
        );
        const visibleHealth = record.lastHealthText.slice(0, healthBudget);
        if (record.distanceFact.textContent !== visibleDistance) record.distanceFact.textContent = visibleDistance;
        if (record.healthFact.textContent !== visibleHealth) record.healthFact.textContent = visibleHealth;
    }

    reset(): void {
        for (const record of this.records.values()) record.root.remove();
        for (const record of this.retiringRecords) record.root.remove();
        this.records.clear();
        this.retiringRecords.clear();
        for (const [healthBar, wasVisible] of this.hiddenHealthBars) healthBar.visible = wasVisible;
        this.hiddenHealthBars.clear();
        this.active = false;
        this.anomalyDetectedThisFrame = false;
    }

    private createRecord(
        targetKey: string,
        targetRevision: number,
        variant: TargetVariant,
        bounds: ScreenBounds,
        now: number,
    ): TargetLockRecord {
        const root = document.createElement('div');
        root.className = 'goggles-target-lock';
        root.dataset.targetKey = targetKey;
        root.classList.toggle('is-peer', variant === 'peer');
        root.classList.toggle('is-anomalous', variant === 'anomaly');
        root.classList.toggle('is-celestial', variant === 'celestial');

        const cornerClasses = ['tl', 'tr', 'bl', 'br'] as const;
        const corners = cornerClasses.map((cornerName) => {
            const corner = document.createElement('div');
            corner.className = `goggles-target-corner goggles-target-corner--${cornerName}`;
            root.appendChild(corner);
            return corner;
        }) as TargetLockRecord['corners'];

        const killMark = document.createElementNS(SVG_NS, 'svg');
        killMark.classList.add('goggles-target-killmark');
        killMark.setAttribute('viewBox', '0 0 100 100');
        killMark.setAttribute('preserveAspectRatio', 'none');
        killMark.setAttribute('aria-hidden', 'true');
        for (const line of ['M 22 22 L 78 78', 'M 78 22 L 22 78']) {
            const strike = document.createElementNS(SVG_NS, 'path');
            strike.setAttribute('d', line);
            killMark.appendChild(strike);
        }
        root.appendChild(killMark);

        const leader = document.createElementNS(SVG_NS, 'svg');
        leader.classList.add('goggles-target-leader');
        leader.setAttribute('aria-hidden', 'true');
        const path = document.createElementNS(SVG_NS, 'path');
        path.setAttribute('pathLength', '1');
        leader.appendChild(path);
        root.appendChild(leader);

        const label = document.createElement('div');
        label.className = 'goggles-target-label';
        const identifier = document.createElement('span');
        identifier.className = 'goggles-target-identifier';
        identifier.classList.toggle('is-corrupted', variant === 'anomaly');
        const panel = document.createElement('div');
        panel.className = 'goggles-target-label-panel';
        const distanceFact = this.createFact();
        const healthFact = this.createFact();
        healthFact.classList.toggle('is-corrupted', variant === 'anomaly');
        healthFact.hidden = variant === 'celestial';
        const warning = document.createElement('span');
        warning.className = 'goggles-target-warning';
        warning.hidden = true;
        panel.append(distanceFact, healthFact, warning);
        label.append(identifier, panel);
        root.appendChild(label);
        this.layer.appendChild(root);

        return {
            targetKey,
            root,
            corners,
            killMark,
            path,
            label,
            labelWidth: LABEL_WIDTH,
            identifier,
            distanceFact,
            healthFact,
            warning,
            bounds,
            layout: createSmartGogglesCalloutLayout(),
            lastWorldPosition: new THREE.Vector3(),
            lastWorldRadius: 0,
            targetRevision,
            phase: 'entering',
            seenFrame: this.frame,
            activateAt: now + ENTER_DELAY_MS,
            removeAt: Infinity,
            lastDistanceText: '',
            lastHealthText: '',
            lastIdentifierText: '',
            readoutMode: null,
            typeStartedAt: now + TYPE_START_DELAY_MS,
        };
    }

    private createFact(): HTMLSpanElement {
        const fact = document.createElement('span');
        fact.className = 'goggles-target-fact';
        return fact;
    }

    private updateGeometry(record: TargetLockRecord): void {
        const { bounds, layout } = record;
        const centerX = (bounds.left + bounds.right) / 2;
        const centerY = (bounds.top + bounds.bottom) / 2;
        const rightX = bounds.right - CORNER_SIZE;
        const bottomY = bounds.bottom - CORNER_SIZE;
        setCornerGeometry(record.corners[0], bounds.left, bounds.top, centerX, centerY);
        setCornerGeometry(record.corners[1], rightX, bounds.top, centerX, centerY);
        setCornerGeometry(record.corners[2], bounds.left, bottomY, centerX, centerY);
        setCornerGeometry(record.corners[3], rightX, bottomY, centerX, centerY);
        record.killMark.style.left = `${bounds.left.toFixed(1)}px`;
        record.killMark.style.top = `${bounds.top.toFixed(1)}px`;
        record.killMark.style.width = `${bounds.width.toFixed(1)}px`;
        record.killMark.style.height = `${bounds.height.toFixed(1)}px`;

        record.path.setAttribute(
            'd',
            `M ${layout.anchor.x.toFixed(1)} ${layout.anchor.y.toFixed(1)} ` +
            `L ${layout.elbow.x.toFixed(1)} ${layout.elbow.y.toFixed(1)} ` +
            `L ${layout.end.x.toFixed(1)} ${layout.end.y.toFixed(1)}`,
        );
        record.root.classList.toggle('is-left', layout.horizontal === 'left');
        record.root.classList.toggle('is-up', layout.vertical === 'up');
        record.label.style.left = `${layout.labelX.toFixed(1)}px`;
        record.label.style.top = `${layout.labelY.toFixed(1)}px`;
        record.label.style.width = `${record.labelWidth}px`;
        // The readout always hangs beneath the single horizontal leader rule.
        record.label.style.transform = 'translateY(5px)';
        record.label.style.setProperty('--goggles-label-shift', '-3px');
        record.label.style.setProperty('--goggles-label-origin', 'top');
        record.label.style.setProperty(
            '--goggles-label-align',
            layout.horizontal === 'left' ? 'flex-end' : 'flex-start',
        );
    }

    private updateEliminatedGeometry(
        record: TargetLockRecord,
        camera: THREE.PerspectiveCamera,
        viewportWidth: number,
        viewportHeight: number,
    ): boolean {
        // Once the eliminated target's fixed world-space center leaves the
        // camera frustum, the kill confirmation no longer belongs on screen.
        if (!_cameraFrustum.containsPoint(record.lastWorldPosition)) return false;

        _eliminatedWorldSphere.center.copy(record.lastWorldPosition);
        _eliminatedWorldSphere.radius = record.lastWorldRadius;
        if (!projectStableTargetSphereToScreen(
            _eliminatedWorldSphere,
            _worldIdentity,
            camera,
            viewportWidth,
            viewportHeight,
            record.bounds,
        )) return false;

        padBounds(record.bounds);
        layoutSmartGogglesCallout(
            record.bounds,
            viewportWidth,
            viewportHeight,
            record.layout,
            { labelWidth: record.labelWidth, diagonalLength: CALLOUT_DIAGONAL_LENGTH },
        );
        this.updateGeometry(record);
        return true;
    }

    private hideWorldHealthBar(healthBar: THREE.Object3D): void {
        if (!this.hiddenHealthBars.has(healthBar)) this.hiddenHealthBars.set(healthBar, healthBar.visible);
        healthBar.visible = false;
    }

    private beginLeaving(record: TargetLockRecord, now: number): void {
        record.phase = 'leaving';
        record.removeAt = now + EXIT_DURATION_MS;
        record.root.classList.remove('is-active');
        record.root.classList.add('is-leaving');
    }

    private eliminate(record: TargetLockRecord, now: number): void {
        if (record.phase === 'eliminated') return;
        record.phase = 'eliminated';
        record.removeAt = now + (this.reducedMotion ? 40 : ELIMINATION_DURATION_MS);
        record.root.classList.remove('is-leaving', 'is-out-of-range');
        record.root.classList.add('is-active', 'is-eliminated');
        this.retiringRecords.add(record);
    }

    private retire(record: TargetLockRecord, now: number): void {
        this.beginLeaving(record, now);
        this.retiringRecords.add(record);
    }
}

/**
 * Returns true when at least one representative point on an oriented box is
 * visible from the observer. Each obstacle ray ends at its own target sample;
 * it never borrows the shorter distance of another point on the box.
 *
 * The optional query seam keeps the geometry behavior directly testable while
 * production uses the world's spatial hash broad phase.
 */
export function hasLineOfSightToOrientedBox(
    origin: THREE.Vector3,
    localBox: THREE.Box3,
    worldMatrix: THREE.Matrix4,
    obstacleQuery: SmartGogglesObstacleQuery = queryObstaclesAlongSegment,
    additionalOccluders: THREE.Object3D[] = NO_ADDITIONAL_OCCLUDERS,
    ignoredTargetRoot?: THREE.Object3D,
): boolean {
    if (localBox.isEmpty()) return false;
    const determinant = worldMatrix.determinant();
    if (!Number.isFinite(determinant) || Math.abs(determinant) <= Number.EPSILON) return false;

    const sizeX = localBox.max.x - localBox.min.x;
    const sizeY = localBox.max.y - localBox.min.y;
    const sizeZ = localBox.max.z - localBox.min.z;
    for (let i = 0; i < OCCLUSION_SAMPLE_FRACTIONS.length; i++) {
        const fraction = OCCLUSION_SAMPLE_FRACTIONS[i];
        _sightSample.set(
            localBox.min.x + sizeX * fraction[0],
            localBox.min.y + sizeY * fraction[1],
            localBox.min.z + sizeZ * fraction[2],
        ).applyMatrix4(worldMatrix);

        _toBody.subVectors(_sightSample, origin);
        const sampleDistance = _toBody.length();
        if (sampleDistance <= OCCLUSION_SURFACE_EPSILON) return true;

        _occlusionRaycaster.set(origin, _toBody.multiplyScalar(1 / sampleDistance));
        _occlusionRaycaster.near = 0;
        _occlusionRaycaster.far = Math.max(0, sampleDistance - OCCLUSION_SURFACE_EPSILON);
        const candidates = obstacleQuery(
            origin.x,
            origin.z,
            _sightSample.x,
            _sightSample.z,
            _occlusionCandidates,
        );
        _occlusionHits.length = 0;
        _occlusionRaycaster.intersectObjects(candidates, false, _occlusionHits);
        if (additionalOccluders.length > 0) {
            _occlusionRaycaster.intersectObjects(additionalOccluders, true, _occlusionHits);
        }
        let blocked = false;
        for (let hitIndex = 0; hitIndex < _occlusionHits.length; hitIndex++) {
            let hitObject: THREE.Object3D | null = _occlusionHits[hitIndex].object;
            if (ignoredTargetRoot) {
                while (hitObject && hitObject !== ignoredTargetRoot) hitObject = hitObject.parent;
                if (hitObject === ignoredTargetRoot) continue;
            }
            blocked = true;
            break;
        }
        if (!blocked) return true;
    }
    return false;
}
