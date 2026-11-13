import { createCornerScan, createInfoOverview, setScanStyle, setScanAttribute } from './gogglesScanTemplates.js';
import { worldGeneration } from './world.js';
import { hasLineOfSightToOrientedBox as boxLineOfSight, type TargetObstacleQuery } from './targetVisibility.js';
import * as THREE from 'three';
import { userSettings } from './settings.js';
import { BULLET_TRAVEL_DISTANCE, GOGGLES_SCAN_DISTANCE, GOGGLES_MAX_CALLOUTS, GOGGLES_MAX_TARGETS, MECHA_HEIGHT } from './config.js';
import type { ForgottenMecha } from './forgottenMecha.js';
import type { RocketLock } from './mechaRockets.js';
import {
    classifyOutOfRange,
    createScreenBounds,
    createSmartGogglesCalloutLayout,
    distanceToOrientedBox,
    layoutLobbyCallout,
    placeLobbyCallout,
    layoutSmartGogglesCallout,
    projectStableTargetEnvelopeToScreen,
    projectStableTargetSphereToScreen,
    type CalloutHorizontalDirection,
    type CalloutVerticalDirection,
    type CalloutLabelBox,
    type LobbyCalloutPlan,
    type ScreenBounds,
    type StableTargetEnvelope,
    type SmartGogglesCalloutLayout,
} from './smartGogglesMath.js';
import { lobbyCalloutPreset } from './lobbyLineup.js';
import {
    collectVisiblePeerMeshes,
    distanceToVisiblePeerMeshes,
    getStablePeerEnvelope,
    someVisiblePeerMeshBounds,
} from './smartGogglesPeerMath.js';
import { targetData } from './userDataTypes.js';
import { queryObstaclesAlongSegment } from './world.js';
import type { CelestialScanTarget } from './dayNightCycle.js';
import {
    setProjectileHomingTarget,
    type ProjectileHomingTarget,
} from './projectileHoming.js';

const SVG_NS = 'http://www.w3.org/2000/svg';
const CORNER_SIZE = 15;
const BOX_PADDING = 6;
const MIN_BOX_SIZE = 20;
// Used only if the DOM cannot measure the full readout (for example in tests).
const LABEL_WIDTH = 224;
const LABEL_GLYPH_WIDTH = 14;
const LABEL_HORIZONTAL_PADDING = 16;
const LABEL_VIEWPORT_MARGIN = 12;
const CALLOUT_DIAGONAL_LENGTH = 54;
const ENTER_DELAY_MS = 16;
const SCAN_BRACKET_DURATION_MS = 180;
const HOMING_LOCK_DURATION_MS = 220;
export const SCAN_TYPE_START_DELAY_MS = 310;
export const SCAN_TYPE_CHARACTER_MS = 8;
export const SCAN_TYPE_LINE_PAUSE_CHARACTERS = 2;
const EXIT_DURATION_MS = 180;
const ELIMINATION_DURATION_MS = 540;
const TELEPORT_DISTANCE_SQ = 40 * 40;
const CORRUPTED_HEALTH_FRAMES = [
    'HEALTH: ?? / ##',
    'HEALTH: #? / ?#',
    'HEALTH: // / ??',
    'HEALTH: ?# / //',
] as const;
const CORRUPTED_IDENTIFIER_FRAMES = [
    '██████████',
    '???//???//',
    '[REDACTED]',
    '██?█//?███',
] as const;

export type { TargetObstacleQuery as SmartGogglesObstacleQuery } from './targetVisibility.js';

type LockPhase = 'entering' | 'tracking' | 'leaving' | 'eliminated';
type ReadoutMode = 'facts' | 'warning';
type TargetVariant = 'enemy' | 'peer' | 'anomaly' | 'celestial';

export interface SmartGogglesPeerTarget {
    username: string;
    mesh: THREE.Group;
    hp: number;
    maxHp: number;
    lifeId?: number;
    /** Position in the host's waiting-room roster, including the host. */
    lobbyOrder?: number;
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
    homingCorners: [HTMLDivElement, HTMLDivElement, HTMLDivElement, HTMLDivElement];
    killMark: SVGSVGElement;
    path: SVGPathElement;
    label: HTMLDivElement;
    panel: HTMLDivElement;
    measure: HTMLSpanElement;
    labelWidth: number;
    naturalLabelWidth: number;
    sizedFor: string;
    identifier: HTMLSpanElement;
    distanceFact: HTMLSpanElement;
    healthFact: HTMLSpanElement;
    warning: HTMLSpanElement;
    bounds: ScreenBounds;
    layout: SmartGogglesCalloutLayout;
    lastWorldPosition: THREE.Vector3;
    // Peers display root distance; their projected envelope may be offset.
    lastDistancePosition: THREE.Vector3;
    lastWorldHalfWidth: number;
    lastWorldHalfHeight: number;
    targetRevision: number;
    phase: LockPhase;
    seenFrame: number;
    activateAt: number;
    scanCompleteAt: number;
    removeAt: number;
    lastDistanceText: string;
    lastHealthText: string;
    lastIdentifierText: string;
    readoutMode: ReadoutMode | null;
    typeStartedAt: number;
    calloutSelected: boolean;
    calloutActivateAt: number;
    calloutLeavingUntil: number;
    calloutAimScore: number;
    lobbyOrder: number;
    lobbyPlan?: LobbyCalloutPlan;
}

type ScanArguments = [
    targetKey: string, targetRevision: number, variant: TargetVariant, identifierText: string,
    bounds: ScreenBounds, worldPosition: THREE.Vector3, worldHalfWidth: number, worldHalfHeight: number,
    centerDistance: number, reachableDistance: number, hp: number, maxHp: number,
    viewportWidth: number, viewportHeight: number, now: number, lobbyOrder?: number,
];

interface ScanObservation {
    args: ScanArguments;
    distancePosition: THREE.Vector3;
    homingTarget?: ProjectileHomingTarget;
    mechaHidden?: boolean;
}

interface HomingCandidate {
    record: TargetLockRecord;
    target: ProjectileHomingTarget;
    score: number;
}

const _bodyCenter = new THREE.Vector3();
const _peerRootPosition = new THREE.Vector3();
const _envelopeSize = new THREE.Vector3();
const _anomalyEnvelope: StableTargetEnvelope = {
    center: new THREE.Vector3(),
    halfWidth: 0,
    halfHeight: 0,
};
const _eliminatedWorldEnvelope: StableTargetEnvelope = {
    center: new THREE.Vector3(),
    halfWidth: 0,
    halfHeight: 0,
};
const _worldIdentity = new THREE.Matrix4();
const _mechaCalloutBounds = createScreenBounds();
const _cameraFrustum = new THREE.Frustum();
const _viewProjection = new THREE.Matrix4();
const _enemyOccluders: THREE.Object3D[] = [];
const _visiblePeerMeshes: THREE.Mesh[] = [];

function queryMechaOccluders(startX: number, startZ: number, endX: number, endZ: number, out: THREE.Object3D[]): THREE.Object3D[] {
    queryObstaclesAlongSegment(startX, startZ, endX, endZ, out);
    // Scan visibility must ignore all twenty of its own body proxies.
    for (let i = out.length - 1; i >= 0; i--) if (out[i].userData.damageTarget === 'forgotten-mecha') out.splice(i, 1);
    return out;
}

export function isAimInsideScanBox(bounds: ScreenBounds, viewportWidth: number, viewportHeight: number): boolean {
    const aimX = viewportWidth / 2;
    const aimY = viewportHeight / 2;
    return aimX >= bounds.left && aimX <= bounds.right && aimY >= bounds.top && aimY <= bounds.bottom;
}

/**
 * The scope FOV eases exponentially and snaps into place once its remaining
 * gap is small. This threshold is the FOV reached about halfway through that
 * settle time, so the scan can begin earlier without changing either animation.
 */
export function isGogglesScanZoomReady(
    currentFov: number,
    normalFov: number,
    scopedFov: number,
    settleTolerance = 0.1,
): boolean {
    const initialGap = Math.abs(normalFov - scopedFov);
    if (initialGap <= settleTolerance) return true;
    const halfwayRemainingGap = Math.sqrt(initialGap * settleTolerance);
    return Math.abs(currentFov - scopedFov) <= halfwayRemainingGap;
}



function setCornerGeometry(
    corner: HTMLElement,
    x: number,
    y: number,
    centerX: number,
    centerY: number,
): void {
    setScanStyle(corner, 'left', `${x.toFixed(1)}px`);
    setScanStyle(corner, 'top', `${y.toFixed(1)}px`);
    setScanStyle(corner, '--goggles-collapse-x', `${(centerX - x - CORNER_SIZE / 2).toFixed(1)}px`);
    setScanStyle(corner, '--goggles-collapse-y', `${(centerY - y - CORNER_SIZE / 2).toFixed(1)}px`);
}

function setHomingCornerGeometry(
    corner: HTMLElement,
    centerX: number,
    centerY: number,
    radius: number,
    directionX: number,
    directionY: number,
): void {
    // Each red marker is an L rotated into a chevron. Keep its outer vertex on
    // the same notional circle as the four yellow box-corner vertices.
    const vertexOffset = Math.SQRT2 * CORNER_SIZE / 2;
    const markerCenterRadius = Math.max(0, radius - vertexOffset);
    const x = centerX + directionX * markerCenterRadius - CORNER_SIZE / 2;
    const y = centerY + directionY * markerCenterRadius - CORNER_SIZE / 2;
    setScanStyle(corner, 'left', `${x.toFixed(1)}px`);
    setScanStyle(corner, 'top', `${y.toFixed(1)}px`);
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
    return `DISTANCE: ${Math.round(distanceKm).toLocaleString('en-US')} KM`;
}

function getFallbackLabelWidth(distanceText: string, variant: TargetVariant): number {
    return variant === 'celestial'
        ? Math.max(LABEL_WIDTH, Math.ceil(distanceText.length * LABEL_GLYPH_WIDTH + LABEL_HORIZONTAL_PADDING))
        : LABEL_WIDTH;
}

function setFactVisibility(record: TargetLockRecord, outOfRange: boolean): void {
    record.distanceFact.hidden = outOfRange;
    record.healthFact.hidden = outOfRange || record.root.classList.contains('is-celestial');
    record.warning.hidden = !outOfRange;
    record.root.classList.toggle('is-out-of-range', outOfRange);
}

function ensureAnomalyTearFilters(layer: HTMLElement): void {
    const document = layer.ownerDocument ?? globalThis.document;
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
    private readonly availableRecords: TargetLockRecord[] = [];
    private readonly observations: ScanObservation[] = [];
    private readonly selectionCandidates: Array<ScanObservation | TargetLockRecord> = [];
    private readonly observedKeys = new Set<string>();
    private readonly selectedCandidates = new Set<ScanObservation | TargetLockRecord>();
    private readonly selectedObservations = new Set<ScanObservation>();
    private readonly selectedKeys = new Set<string>();
    private readonly selectionOrigin = new THREE.Vector3();
    private readonly compareCandidates = (a: ScanObservation | TargetLockRecord, b: ScanObservation | TargetLockRecord) => {
        const distance = this.selectionOrigin.distanceToSquared('args' in a ? a.distancePosition : a.lastDistancePosition)
            - this.selectionOrigin.distanceToSquared('args' in b ? b.distancePosition : b.lastDistancePosition);
        const ak = 'args' in a ? a.args[0] : a.targetKey, bk = 'args' in b ? b.args[0] : b.targetKey;
        return distance || ak.localeCompare(bk);
    };
    private readonly textContext: CanvasRenderingContext2D | null;
    private textFontKey = '';
    private letterSpacing = 0;
    private customReadoutVersion = 0;
    private worldGeneration = -1;
    private readonly hiddenHealthBars = new Map<THREE.Object3D, boolean>();
    private readonly layer: HTMLElement;
    private readonly reducedMotion: boolean;
    private readonly calloutDirection?: Readonly<{ horizontal: CalloutHorizontalDirection; vertical: CalloutVerticalDirection }>;
    private readonly customPeerReadout?: HTMLElement;
    private readonly lobbyPreview: boolean;
    private readonly gameplayLimits: boolean;
    private readonly calloutCandidates: TargetLockRecord[] = [];
    private readonly lobbyAvoidElements: readonly HTMLElement[];
    private readonly occupiedLobbyLabels: CalloutLabelBox[] = [];
    private lobbyTotalPlayers = 1;
    private lobbyRosterKey = '';
    private lobbyViewportKey = '';
    private frame = 0;
    private active = false;
    private anomalyDetectedThisFrame = false;
    private homingAimScore = Infinity;
    private bestHomingCandidate: HomingCandidate | null = null;
    private homingLockKey: string | null = null;
    private homingLockStartedAt = Infinity;

    constructor(layer: HTMLElement, options?: Readonly<{ horizontal?: CalloutHorizontalDirection; vertical?: CalloutVerticalDirection; customPeerReadout?: HTMLElement; lobbyPreview?: boolean; gameplayLimits?: boolean; lobbyAvoidElements?: readonly HTMLElement[] }>) {
        this.layer = layer;
        this.textContext = (layer.ownerDocument ?? document).createElement('canvas').getContext?.('2d') ?? null;
        this.calloutDirection = options?.horizontal && options.vertical
            ? { horizontal: options.horizontal, vertical: options.vertical } : undefined;
        this.customPeerReadout = options?.customPeerReadout;
        if (this.customPeerReadout && typeof ResizeObserver !== 'undefined') new ResizeObserver(() => {
            this.customReadoutVersion++;
        }).observe(this.customPeerReadout);
        this.lobbyPreview = options?.lobbyPreview ?? false;
        this.gameplayLimits = options?.gameplayLimits ?? !this.lobbyPreview;
        this.lobbyAvoidElements = options?.lobbyAvoidElements ?? [];
        this.reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
        ensureAnomalyTearFilters(layer);
        for (let i = 0; i < GOGGLES_MAX_TARGETS; i++) this.availableRecords.push(this.buildRecord());
    }

    get isAnomalyDetected(): boolean {
        return this.anomalyDetectedThisFrame;
    }

    configureLobby(totalPlayers: number, rosterKey: string): void {
        if (!this.lobbyPreview) return;
        this.lobbyTotalPlayers = totalPlayers;
        if (rosterKey === this.lobbyRosterKey) return;
        this.lobbyRosterKey = rosterKey;
        for (const record of this.records.values()) record.lobbyPlan = undefined;
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
        homingEnabled = true,
        mecha: ForgottenMecha | null = null,
        mountedLock?: RocketLock | null,
    ): void {
        if (this.gameplayLimits && this.worldGeneration !== worldGeneration) { this.reset(); this.worldGeneration = worldGeneration; }
        this.anomalyDetectedThisFrame = false;
        this.homingAimScore = Infinity;
        this.bestHomingCandidate = null;
        if (!enabled) {
            if (this.active || this.records.size > 0 || this.retiringRecords.size > 0) this.reset();
            return;
        }

        this.active = true;
        this.observations.length = 0;
        this.frame++;
        this.occupiedLobbyLabels.length = 0;
        if (this.lobbyPreview) {
            const layerRect = this.layer.getBoundingClientRect();
            for (const element of this.lobbyAvoidElements) {
                const rect = element.getBoundingClientRect();
                if (rect.width <= 0 || rect.height <= 0) continue;
                this.occupiedLobbyLabels.push({ left: rect.left - layerRect.left, top: rect.top - layerRect.top,
                    right: rect.right - layerRect.left, bottom: rect.bottom - layerRect.top });
            }
        }
        const viewportWidth = this.layer.clientWidth || window.innerWidth;
        const viewportHeight = this.layer.clientHeight || window.innerHeight;
        if (viewportWidth <= 0 || viewportHeight <= 0) return;
        if (this.lobbyPreview) {
            const viewportKey = `${viewportWidth}:${viewportHeight}`;
            if (viewportKey !== this.lobbyViewportKey) {
                this.lobbyViewportKey = viewportKey;
                for (const record of this.records.values()) record.lobbyPlan = undefined;
            }
        }
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
            _bodyCenter.copy(localSphere.center).applyMatrix4(data.bodyMesh.matrixWorld);
            if (this.rejectBeyondScanRange(targetKey, playerPosition.distanceTo(_bodyCenter))) continue;
            if (!_cameraFrustum.intersectsObject(data.bodyMesh)) continue;
            if (!hasLineOfSightToOrientedBox(
                camera.position,
                localBox,
                data.bodyMesh.matrixWorld,
                mountedLock !== undefined ? queryMechaOccluders : queryObstaclesAlongSegment,
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
            const trackedRecord = this.observeTarget(
                targetKey,
                targetRevision,
                'enemy',
                'Enemy',
                projectionBounds,
                _bodyCenter,
                localSphere.radius * data.bodyMesh.matrixWorld.getMaxScaleOnAxis(),
                localSphere.radius * data.bodyMesh.matrixWorld.getMaxScaleOnAxis(),
                playerPosition.distanceTo(_bodyCenter),
                reachableDistance,
                data.hp,
                data.maxHp,
                viewportWidth,
                viewportHeight,
                now,
            );
            trackedRecord.homingTarget = {
                    kind: 'npc',
                    object: target,
                    targetIndex: data.index,
                    targetRevision,
            };
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
            peer.mesh.getWorldPosition(_peerRootPosition);
            if (this.rejectBeyondScanRange(targetKey, playerPosition.distanceTo(_peerRootPosition))) continue;

            const record = this.records.get(targetKey);
            const projectionBounds = record?.bounds ?? createScreenBounds();
            const stablePeerEnvelope = getStablePeerEnvelope(peer.mesh);
            if (!stablePeerEnvelope || !projectStableTargetEnvelopeToScreen(
                stablePeerEnvelope,
                peer.mesh.matrixWorld,
                camera,
                viewportWidth,
                viewportHeight,
                projectionBounds,
            )) continue;
            if (!this.lobbyPreview && !someVisiblePeerMeshBounds(
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

            _bodyCenter.copy(stablePeerEnvelope.center).applyMatrix4(peer.mesh.matrixWorld);
            const peerWorldScale = peer.mesh.matrixWorld.getMaxScaleOnAxis();
            const trackedRecord = this.observeTarget(
                targetKey,
                0,
                'peer',
                peer.username,
                projectionBounds,
                _bodyCenter,
                stablePeerEnvelope.halfWidth * peerWorldScale,
                stablePeerEnvelope.halfHeight * peerWorldScale,
                playerPosition.distanceTo(_peerRootPosition),
                distanceToVisiblePeerMeshes(weaponOrigin, peer.mesh),
                peer.hp,
                peer.maxHp,
                viewportWidth,
                viewportHeight,
                now,
                peer.lobbyOrder ?? 0,
            );
            trackedRecord.distancePosition.copy(_peerRootPosition);
            if (!this.lobbyPreview) trackedRecord.homingTarget = {
                    kind: 'peer',
                    object: peer.mesh,
                    targetPeerId: peerId,
                    targetLifeId: peer.lifeId ?? 0,
            };
        }

        if (mecha?.ready) {
            const key = 'mecha:forgotten';
            const previous = this.records.get(key);
            if (previous && previous.targetRevision !== mecha.revision) { this.eliminate(previous, now); this.records.delete(key); }
            const hitbox = mecha.hitbox;
            if (!hitbox.geometry.boundingBox) hitbox.geometry.computeBoundingBox();
            const box = hitbox.geometry.boundingBox!;
            const bounds = this.records.get(key)?.bounds ?? createScreenBounds();
            _anomalyEnvelope.center.copy(mecha.group.position);
            _anomalyEnvelope.center.y += MECHA_HEIGHT / 2;
            _anomalyEnvelope.halfWidth = mecha.radius;
            _anomalyEnvelope.halfHeight = MECHA_HEIGHT / 2;
            if (!this.rejectBeyondScanRange(key, playerPosition.distanceTo(hitbox.position)) && mecha.hp > 0 && _cameraFrustum.intersectsObject(hitbox) && projectStableTargetEnvelopeToScreen(_anomalyEnvelope, _worldIdentity, camera, viewportWidth, viewportHeight, bounds)) {
                const visible = hasLineOfSightToOrientedBox(camera.position, box, hitbox.matrixWorld, queryMechaOccluders, _enemyOccluders);
                const record = this.observeTarget(key, mecha.revision, 'enemy', 'Forgotten Mecha', bounds, hitbox.position,
                    mecha.radius, MECHA_HEIGHT / 2, playerPosition.distanceTo(hitbox.position), distanceToOrientedBox(weaponOrigin, box, hitbox.matrixWorld),
                    mecha.hp, mecha.maxHp, viewportWidth, viewportHeight, now);
                record.mechaHidden = !visible;
                if (visible) record.homingTarget = { kind: 'mecha', object: mecha.group, actor: mecha, targetRevision: mecha.revision };
            }
        }

        if (anomalyTarget) {
            const hitbox = anomalyTarget.hitbox;
            const geometry = hitbox.geometry;
            if (!geometry.boundingBox) geometry.computeBoundingBox();
            const localBox = geometry.boundingBox;
            if (localBox) {
                localBox.getCenter(_anomalyEnvelope.center);
                localBox.getSize(_envelopeSize);
                _anomalyEnvelope.halfWidth = Math.hypot(_envelopeSize.x, _envelopeSize.z) * 0.5;
                _anomalyEnvelope.halfHeight = _envelopeSize.y * 0.5;
                hitbox.updateWorldMatrix(true, false);
                const targetKey = 'anomaly:goth-girlfriend';
                const record = this.records.get(targetKey);
                const projectionBounds = record?.bounds ?? createScreenBounds();
                _bodyCenter.copy(_anomalyEnvelope.center).applyMatrix4(hitbox.matrixWorld);
                if (!this.rejectBeyondScanRange(targetKey, playerPosition.distanceTo(_bodyCenter)) && _cameraFrustum.intersectsObject(hitbox) && hasLineOfSightToOrientedBox(
                    camera.position,
                    localBox,
                    hitbox.matrixWorld,
                    queryObstaclesAlongSegment,
                    _enemyOccluders,
                    hitbox,
                ) && projectStableTargetEnvelopeToScreen(
                    _anomalyEnvelope,
                    hitbox.matrixWorld,
                    camera,
                    viewportWidth,
                    viewportHeight,
                    projectionBounds,
                )) {
                    const anomalyWorldScale = hitbox.matrixWorld.getMaxScaleOnAxis();
                    this.observeTarget(
                        targetKey,
                        0,
                        'anomaly',
                        CORRUPTED_IDENTIFIER_FRAMES[
                            this.reducedMotion ? 0 : Math.floor(now / 72) % CORRUPTED_IDENTIFIER_FRAMES.length
                        ],
                        projectionBounds,
                        _bodyCenter,
                        _anomalyEnvelope.halfWidth * anomalyWorldScale,
                        _anomalyEnvelope.halfHeight * anomalyWorldScale,
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
            this.observeTarget(
                targetKey,
                0,
                'celestial',
                celestial.key,
                projectionBounds,
                _bodyCenter,
                localSphere.radius * mesh.matrixWorld.getMaxScaleOnAxis(),
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

        this.assignVisualTargets(playerPosition);
        if (this.gameplayLimits) this.updateCalloutSelection(viewportWidth, viewportHeight, now);

        // Clear the candidate through the normal lock lifecycle so switching to
        // a hitscan weapon also cancels a pending or completed red lock.
        if (!homingEnabled) this.bestHomingCandidate = null;
        this.updateHomingLock(now);
        if (mountedLock !== undefined) {
            // Vehicle acquisition is immediate and remains active without this
            // DOM overlay. These red brackets merely display its chosen target.
            for (const record of this.records.values()) record.root.classList.remove('is-homing-locking', 'is-homing-locked');
            if (mountedLock) this.records.get(`npc:${mountedLock.index}`)?.root.classList.add('is-homing-locked');
        }

        for (const [targetKey, record] of this.records) {
            // Also enforce the hard cutoff for a stale/FOV-exiting overlay when
            // the observer moves; range rejection has no lingering exit scan.
            if (this.rejectBeyondScanRange(targetKey, playerPosition.distanceTo(record.lastDistancePosition))) continue;
            if (record.seenFrame === this.frame) continue;
            if (record.phase !== 'leaving') this.beginLeaving(record, now);
            if (now >= record.removeAt) {
                this.releaseRecord(record);
                this.records.delete(targetKey);
            }
        }
        for (const record of this.retiringRecords) {
            if ((this.gameplayLimits && !record.root.classList.contains('is-celestial') &&
                playerPosition.distanceTo(record.lastDistancePosition) > GOGGLES_SCAN_DISTANCE) || now >= record.removeAt || (
                record.phase === 'eliminated' &&
                !this.updateEliminatedGeometry(record, camera, viewportWidth, viewportHeight)
            )) {
                this.releaseRecord(record);
                this.retiringRecords.delete(record);
            }
        }
    }

    private observeTarget(...args: ScanArguments): ScanObservation {
        const [targetKey, , , , bounds, worldPosition] = args;
        const previous = this.records.get(targetKey);
        if (previous && previous.lastWorldPosition.distanceToSquared(worldPosition) > TELEPORT_DISTANCE_SQ) {
            this.retire(previous, args[14]);
            this.records.delete(targetKey);
        }
        // Projection and center scratch objects are shared across the detection pass.
        args[4] = { ...bounds };
        args[5] = worldPosition.clone();
        const observation = { args, distancePosition: worldPosition.clone() };
        this.observations.push(observation);
        return observation;
    }

    private trackTarget(
        targetKey: string,
        targetRevision: number,
        variant: TargetVariant,
        identifierText: string,
        bounds: ScreenBounds,
        worldPosition: THREE.Vector3,
        worldHalfWidth: number,
        worldHalfHeight: number,
        centerDistance: number,
        reachableDistance: number,
        hp: number,
        maxHp: number,
        viewportWidth: number,
        viewportHeight: number,
        now: number,
        lobbyOrder = 0,
    ): TargetLockRecord {
        let record = this.records.get(targetKey);
        if (!record) {
            record = this.createRecord(targetKey, targetRevision, variant, bounds, now);
            this.records.set(targetKey, record);
        }

        Object.assign(record.bounds, bounds);
        record.seenFrame = this.frame;
        record.lobbyOrder = lobbyOrder;
        record.lastIdentifierText = identifierText;
        record.lastWorldPosition.copy(worldPosition);
        record.lastDistancePosition.copy(worldPosition);
        record.lastWorldHalfWidth = worldHalfWidth;
        record.lastWorldHalfHeight = worldHalfHeight;
        const customReadout = variant === 'peer' ? this.customPeerReadout : undefined;
        const emptyPeerFacts = variant === 'peer' && this.lobbyPreview;
        const distanceText = variant === 'celestial'
            ? formatCelestialDistance(centerDistance)
            : `DISTANCE: ${Math.round(centerDistance)} M`;
        const outOfRange = !customReadout && !emptyPeerFacts && (variant === 'enemy' || variant === 'peer') && classifyOutOfRange(
            reachableDistance,
            BULLET_TRAVEL_DISTANCE,
        );
        setFactVisibility(record, outOfRange);
        if (customReadout || emptyPeerFacts) {
            record.distanceFact.hidden = true;
            record.healthFact.hidden = true;
            record.warning.hidden = true;
        }
        const readoutMode: ReadoutMode = outOfRange ? 'warning' : 'facts';
        if (record.readoutMode !== readoutMode) {
            record.readoutMode = readoutMode;
            record.typeStartedAt = now + SCAN_TYPE_START_DELAY_MS;
            record.identifier.textContent = '';
            record.distanceFact.textContent = '';
            record.healthFact.textContent = '';
            record.warning.textContent = '';
        }
        if (!outOfRange) {
            record.lastDistanceText = customReadout || emptyPeerFacts ? '' : distanceText;
            record.lastHealthText = customReadout || emptyPeerFacts || variant === 'celestial'
                ? ''
                : variant === 'anomaly'
                    ? CORRUPTED_HEALTH_FRAMES[
                        this.reducedMotion ? 0 : Math.floor(now / 72) % CORRUPTED_HEALTH_FRAMES.length
                    ]
                    : `HEALTH: ${Math.max(0, hp)} / ${Math.max(0, maxHp)}`;
        }
        const fullReadout = outOfRange
            ? 'OUT OF RANGE'
            : `${record.lastDistanceText}\n${record.lastHealthText}`;
        const fontKey = `${viewportWidth}:${viewportHeight}:${document.fonts?.status ?? ''}`;
        if (this.textFontKey !== fontKey && this.textContext && typeof getComputedStyle === 'function') {
            const style = getComputedStyle(record.measure);
            this.textContext.font = style.font || `${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
            this.letterSpacing = Number.parseFloat(style.letterSpacing) || 0;
            this.textFontKey = fontKey;
        }
        const measurementText = variant === 'anomaly' && !outOfRange
            ? `${record.lastDistanceText}\n${CORRUPTED_HEALTH_FRAMES.join('\n')}` : fullReadout;
        const sizingKey = `${emptyPeerFacts ? identifierText : customReadout ? this.customReadoutVersion : measurementText}:${fontKey}`;
        if (record.sizedFor !== sizingKey) {
            let contentWidth = 0;
            if (customReadout) contentWidth = customReadout.getBoundingClientRect?.().width ?? 0;
            else if (this.textContext) for (const line of (emptyPeerFacts ? identifierText : measurementText).split('\n')) {
                contentWidth = Math.max(contentWidth, this.textContext.measureText(line).width + line.length * this.letterSpacing);
            }
            record.naturalLabelWidth = emptyPeerFacts
                ? Math.max(82, identifierText.length * 11 + LABEL_HORIZONTAL_PADDING)
                : contentWidth > 0 ? Math.ceil(contentWidth + LABEL_HORIZONTAL_PADDING) : getFallbackLabelWidth(distanceText, variant);
            record.sizedFor = sizingKey;
        }
        record.labelWidth = Math.min(
            record.naturalLabelWidth,
            Math.max(0, viewportWidth - LABEL_VIEWPORT_MARGIN * 2),
        );
        if (!this.gameplayLimits) this.updateTypedReadout(record, now);
        padBounds(record.bounds);
        this.layoutRecord(record, viewportWidth, viewportHeight);

        if (record.phase === 'leaving') {
            record.root.classList.remove('is-leaving');
            record.root.classList.add('is-active');
            record.phase = 'tracking';
        } else if (record.phase === 'entering' && now >= record.activateAt) {
            record.root.classList.remove('is-resetting');
            record.root.classList.add('is-active');
            record.phase = 'tracking';
        }
        return record;
    }

    /** Range and callout visibility never change weapon reachability. */
    private rejectBeyondScanRange(targetKey: string, distance: number): boolean {
        if (!this.gameplayLimits || targetKey.startsWith('celestial:') || distance <= GOGGLES_SCAN_DISTANCE) return false;
        const record = this.records.get(targetKey);
        if (record) this.releaseRecord(record);
        this.records.delete(targetKey);
        for (const record of this.retiringRecords) {
            if (record.targetKey !== targetKey) continue;
            this.releaseRecord(record);
            this.retiringRecords.delete(record);
        }
        return true;
    }

    private assignVisualTargets(playerPosition: THREE.Vector3): void {
        const candidates = this.selectionCandidates, observedKeys = this.observedKeys;
        const selected = this.selectedCandidates, selectedObservations = this.selectedObservations, selectedKeys = this.selectedKeys;
        candidates.length = 0; observedKeys.clear(); selected.clear(); selectedObservations.clear(); selectedKeys.clear();
        for (const observation of this.observations) { observedKeys.add(observation.args[0]); candidates.push(observation); }
        for (const record of this.records.values()) if (!observedKeys.has(record.targetKey)) candidates.push(record);
        for (const record of this.retiringRecords) candidates.push(record);
        this.selectionOrigin.copy(playerPosition);
        if (this.gameplayLimits) candidates.sort(this.compareCandidates);
        const limit = this.gameplayLimits ? Math.min(candidates.length, GOGGLES_MAX_TARGETS) : candidates.length;
        for (let i = 0; i < limit; i++) {
            const entry = candidates[i]; selected.add(entry);
            if ('args' in entry) { selectedObservations.add(entry); selectedKeys.add(entry.args[0]); }
        }
        // Release losers before binding incoming targets: even crowded scenes never
        // allocate beyond the gameplay pool, including outgoing confirmations.
        for (const [targetKey, record] of this.records) {
            if (selected.has(record) || selectedKeys.has(targetKey)) continue;
            this.releaseRecord(record);
            this.records.delete(targetKey);
        }
        for (const record of this.retiringRecords) {
            if (selected.has(record)) continue;
            this.releaseRecord(record);
            this.retiringRecords.delete(record);
        }
        for (const observation of this.observations) {
            if (!selectedObservations.has(observation)) continue;
            const record = this.trackTarget(...observation.args);
            record.lastDistancePosition.copy(observation.distancePosition);
            if (observation.mechaHidden !== undefined) {
                record.root.classList.toggle('is-mecha-hidden', observation.mechaHidden);
                record.root.classList.toggle('is-mecha-steady', this.reducedMotion || userSettings.photosensitivityMode);
            }
            if (observation.homingTarget) this.considerHomingTarget(record, record.bounds,
                observation.args[12], observation.args[13], observation.args[8], observation.homingTarget);
        }
        this.observations.length = candidates.length = 0;
        observedKeys.clear(); selected.clear(); selectedObservations.clear(); selectedKeys.clear();
        if (this.gameplayLimits && !this.records.has('anomaly:goth-girlfriend')) this.anomalyDetectedThisFrame = false;
    }

    private updateCalloutSelection(viewportWidth: number, viewportHeight: number, now: number): void {
        const candidates = this.calloutCandidates;
        candidates.length = 0;
        for (const record of this.records.values()) {
            if (record.seenFrame !== this.frame || record.root.classList.contains('is-mecha-hidden')) continue;
            const x = (record.bounds.left + record.bounds.right - viewportWidth) / 2;
            const y = (record.bounds.top + record.bounds.bottom - viewportHeight) / 2;
            record.calloutAimScore = x * x + y * y;
            let index = 0;
            while (index < candidates.length && (
                candidates[index].calloutAimScore < record.calloutAimScore ||
                (candidates[index].calloutAimScore === record.calloutAimScore && candidates[index].targetKey < record.targetKey)
            )) index++;
            // Keep a bounded top three rather than sorting every detected enemy.
            if (index >= GOGGLES_MAX_CALLOUTS) continue;
            candidates.splice(index, 0, record);
            if (candidates.length > GOGGLES_MAX_CALLOUTS) candidates.pop();
        }
        for (const record of this.records.values()) {
            const selected = candidates.includes(record);
            if (selected && !record.calloutSelected) {
                // Restart only this callout. Corner acquisition and homing keep
                // their own clocks even when a target crosses the third slot.
                const reversingExit = now < record.calloutLeavingUntil;
                record.calloutActivateAt = now + (this.reducedMotion || reversingExit ? 0 : ENTER_DELAY_MS);
                record.typeStartedAt = now + (this.reducedMotion ? 0 : SCAN_TYPE_START_DELAY_MS);
                record.identifier.textContent = '';
                record.distanceFact.textContent = '';
                record.healthFact.textContent = '';
                record.warning.textContent = '';
                record.root.classList.remove('is-callout-leaving');
                record.root.classList.toggle('is-callout-reentering', reversingExit);
                record.calloutLeavingUntil = -Infinity;
            } else if (!selected && record.calloutSelected) {
                record.root.classList.remove('is-callout-active', 'is-callout-reentering');
                record.root.classList.add('is-callout-leaving');
                record.calloutLeavingUntil = now + (this.reducedMotion ? 1 : EXIT_DURATION_MS);
            }
            record.calloutSelected = selected;
            if (selected) {
                record.root.classList.toggle('is-callout-active', now >= record.calloutActivateAt);
                this.updateTypedReadout(record, now);
            } else if (now >= record.calloutLeavingUntil) {
                record.root.classList.remove('is-callout-leaving');
            }
        }
    }

    private updateTypedReadout(record: TargetLockRecord, now: number): void {
        const characterBudget = this.reducedMotion
            ? Number.POSITIVE_INFINITY
            : Math.max(0, Math.floor((now - record.typeStartedAt) / SCAN_TYPE_CHARACTER_MS));
        const visibleIdentifier = record.lastIdentifierText.slice(0, characterBudget);
        if (record.identifier.textContent !== visibleIdentifier) record.identifier.textContent = visibleIdentifier;
        const readoutBudget = Math.max(
            0,
            characterBudget - record.lastIdentifierText.length - SCAN_TYPE_LINE_PAUSE_CHARACTERS,
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
            readoutBudget - record.lastDistanceText.length - SCAN_TYPE_LINE_PAUSE_CHARACTERS,
        );
        const visibleHealth = record.lastHealthText.slice(0, healthBudget);
        if (record.distanceFact.textContent !== visibleDistance) record.distanceFact.textContent = visibleDistance;
        if (record.healthFact.textContent !== visibleHealth) record.healthFact.textContent = visibleHealth;
    }

    reset(): void {
        for (const record of this.records.values()) this.releaseRecord(record);
        for (const record of this.retiringRecords) this.releaseRecord(record);
        this.records.clear();
        this.calloutCandidates.length = 0;
        this.observations.length = 0;
        this.retiringRecords.clear();
        for (const [healthBar, wasVisible] of this.hiddenHealthBars) healthBar.visible = wasVisible;
        this.hiddenHealthBars.clear();
        this.active = false;
        this.anomalyDetectedThisFrame = false;
        this.homingAimScore = Infinity;
        this.bestHomingCandidate = null;
        this.homingLockKey = null;
        this.homingLockStartedAt = Infinity;
        setProjectileHomingTarget(null);
    }

    private considerHomingTarget(
        record: TargetLockRecord,
        bounds: ScreenBounds,
        viewportWidth: number,
        viewportHeight: number,
        distance: number,
        target: ProjectileHomingTarget,
    ): void {
        if (record.readoutMode === 'warning') return;
        if (!isAimInsideScanBox(bounds, viewportWidth, viewportHeight)) return;
        const boxCenterX = (bounds.left + bounds.right) / 2;
        const boxCenterY = (bounds.top + bounds.bottom) / 2;
        const offsetX = boxCenterX - viewportWidth / 2;
        const offsetY = boxCenterY - viewportHeight / 2;
        const score = offsetX * offsetX + offsetY * offsetY + Math.max(0, distance) * 1e-6;
        if (score >= this.homingAimScore) return;
        this.homingAimScore = score;
        this.bestHomingCandidate = { record, target, score };
    }

    private updateHomingLock(now: number): void {
        const candidate = this.bestHomingCandidate;
        const candidateKey = candidate?.record.targetKey ?? null;
        if (candidateKey !== this.homingLockKey) {
            this.clearHomingLockVisual();
            this.homingLockKey = candidateKey;
            this.homingLockStartedAt = candidate
                ? Math.max(now, candidate.record.scanCompleteAt)
                : Infinity;
        }

        if (!candidate) {
            setProjectileHomingTarget(null);
            return;
        }

        const record = candidate.record;
        if (now < this.homingLockStartedAt) {
            record.root.classList.remove('is-homing-locking', 'is-homing-locked');
            setProjectileHomingTarget(null);
            return;
        }

        const lockDuration = this.reducedMotion ? 1 : HOMING_LOCK_DURATION_MS;
        if (now < this.homingLockStartedAt + lockDuration) {
            record.root.classList.add('is-homing-locking');
            record.root.classList.remove('is-homing-locked');
            setProjectileHomingTarget(null);
            return;
        }

        record.root.classList.remove('is-homing-locking');
        record.root.classList.add('is-homing-locked');
        setProjectileHomingTarget(candidate.target);
    }

    private clearHomingLockVisual(): void {
        if (!this.homingLockKey) return;
        this.records.get(this.homingLockKey)?.root.classList.remove('is-homing-locking', 'is-homing-locked');
    }

    private createRecord(targetKey: string, targetRevision: number, variant: TargetVariant,
        bounds: ScreenBounds, now: number): TargetLockRecord {
        // Preview callers may explicitly opt out of the six-target budget.
        const record = this.availableRecords.pop() ?? this.buildRecord();
        // A respawn or teleport can retain the key while its old view retracts.
        // Its new incarnation must still complete both acquisition animations.
        if (this.homingLockKey === targetKey) {
            this.homingLockKey = null;
            this.homingLockStartedAt = Infinity;
            setProjectileHomingTarget(null);
        }
        Object.assign(record, {
            targetKey, targetRevision, bounds, phase: 'entering', seenFrame: this.frame,
            labelWidth: LABEL_WIDTH, naturalLabelWidth: LABEL_WIDTH, sizedFor: '',
            activateAt: now + ENTER_DELAY_MS,
            scanCompleteAt: now + ENTER_DELAY_MS + (this.reducedMotion ? 1 : SCAN_BRACKET_DURATION_MS),
            removeAt: Infinity, lastDistanceText: '', lastHealthText: '', lastIdentifierText: '', readoutMode: null,
            typeStartedAt: now + SCAN_TYPE_START_DELAY_MS, calloutSelected: false,
            calloutActivateAt: Infinity, calloutLeavingUntil: -Infinity, calloutAimScore: Infinity,
            lobbyOrder: 0, lobbyPlan: undefined, lastWorldHalfWidth: 0, lastWorldHalfHeight: 0,
        });
        const { root, identifier, healthFact, distanceFact, warning, label, measure, panel } = record;
        root.className = 'goggles-target-lock is-resetting';
        root.dataset.targetKey = targetKey;
        root.classList.toggle('is-callout-managed', this.gameplayLimits);
        root.classList.toggle('is-peer', variant === 'peer');
        root.classList.toggle('is-lobby-peer', variant === 'peer' && this.lobbyPreview);
        root.classList.toggle('is-anomalous', variant === 'anomaly');
        root.classList.toggle('is-celestial', variant === 'celestial');
        identifier.classList.toggle('is-corrupted', variant === 'anomaly');
        healthFact.classList.toggle('is-corrupted', variant === 'anomaly');
        for (const text of [identifier, measure, distanceFact, healthFact, warning]) text.textContent = '';
        distanceFact.hidden = false;
        healthFact.hidden = variant === 'celestial';
        warning.hidden = true;
        if (variant === 'peer' && this.customPeerReadout) {
            this.customPeerReadout.hidden = false;
            panel.append(this.customPeerReadout);
        }
        if (variant === 'peer' && this.lobbyPreview) {
            panel.remove();
            label.append(measure, identifier);
        } else {
            // Keep measurement first, followed by the unchanged live typing nodes.
            panel.insertBefore(measure, distanceFact);
            label.append(identifier, panel);
        }
        this.layer.appendChild(root);
        return record;
    }

    private releaseRecord(record: TargetLockRecord): void {
        record.root.remove();
        // The interactive color picker belongs to the menu, never to a pooled target.
        if (this.customPeerReadout?.parentElement === record.panel) this.customPeerReadout.remove();
        if (this.homingLockKey === record.targetKey &&
            (!this.records.has(record.targetKey) || this.records.get(record.targetKey) === record)) {
            this.homingLockKey = null;
            this.homingLockStartedAt = Infinity;
            setProjectileHomingTarget(null);
        }
        this.availableRecords.push(record);
    }

    private buildRecord(): TargetLockRecord {
        const root = document.createElement('div');
        root.className = 'goggles-target-lock';
        const corners = createCornerScan(root);
        const homingCornerClasses = ['top', 'right', 'bottom', 'left'] as const;
        const homingCorners = homingCornerClasses.map((cornerName) => {
            const corner = document.createElement('div');
            corner.className = `goggles-homing-corner goggles-homing-corner--${cornerName}`;
            root.appendChild(corner);
            return corner;
        }) as TargetLockRecord['homingCorners'];

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

        const { path, label, identifier, panel } = createInfoOverview(root);
        const measure = document.createElement('span');
        measure.className = 'goggles-target-label-measure';
        measure.setAttribute('aria-hidden', 'true');
        const distanceFact = this.createFact();
        const healthFact = this.createFact();
        const warning = document.createElement('span');
        warning.className = 'goggles-target-warning';
        warning.hidden = true;
        panel.append(measure, distanceFact, healthFact, warning);

        return {
            targetKey: '',
            root,
            corners,
            homingCorners,
            killMark,
            path,
            label,
            panel,
            measure,
            labelWidth: LABEL_WIDTH,
            naturalLabelWidth: LABEL_WIDTH,
            sizedFor: '',
            identifier,
            distanceFact,
            healthFact,
            warning,
            bounds: createScreenBounds(),
            layout: createSmartGogglesCalloutLayout(),
            lastWorldPosition: new THREE.Vector3(),
            lastDistancePosition: new THREE.Vector3(),
            lastWorldHalfWidth: 0,
            lastWorldHalfHeight: 0,
            targetRevision: 0,
            phase: 'entering',
            seenFrame: this.frame,
            activateAt: Infinity,
            scanCompleteAt: Infinity,
            removeAt: Infinity,
            lastDistanceText: '',
            lastHealthText: '',
            lastIdentifierText: '',
            readoutMode: null,
            typeStartedAt: Infinity,
            calloutSelected: false,
            calloutActivateAt: Infinity,
            calloutLeavingUntil: -Infinity,
            calloutAimScore: Infinity,
            lobbyOrder: 0,
        };
    }

    private createFact(): HTMLSpanElement {
        const fact = document.createElement('span');
        fact.className = 'goggles-target-fact';
        return fact;
    }

    private layoutRecord(record: TargetLockRecord, viewportWidth: number, viewportHeight: number): void {
        if (this.lobbyPreview && record.targetKey.startsWith('peer:')) {
            let placement: { labelWidth: number; box: CalloutLabelBox };
            if (record.lobbyPlan) placement = placeLobbyCallout(record.bounds, viewportWidth, viewportHeight,
                record.labelWidth, record.layout, record.lobbyPlan);
            else {
                const selected = layoutLobbyCallout(record.bounds, viewportWidth, viewportHeight,
                    record.labelWidth, this.occupiedLobbyLabels, record.layout,
                    lobbyCalloutPreset(this.lobbyTotalPlayers, record.lobbyOrder));
                record.lobbyPlan = selected.plan;
                placement = selected;
            }
            record.labelWidth = placement.labelWidth;
            this.occupiedLobbyLabels.push(placement.box);
            this.updateGeometry(record);
            return;
        }
        let calloutBounds = record.bounds;
        if (record.targetKey === 'mecha:forgotten' && Math.max(record.bounds.left, viewportWidth - record.bounds.right) < record.labelWidth + CALLOUT_DIAGONAL_LENGTH) {
            // The giant body can fill the entire zoomed scope. Keep its real
            // bounds for acquisition, but lead inward from the visible edge so
            // the name and health do not collapse to zero width or leave view.
            _mechaCalloutBounds.left = _mechaCalloutBounds.right = viewportWidth - LABEL_VIEWPORT_MARGIN;
            _mechaCalloutBounds.top = _mechaCalloutBounds.bottom = THREE.MathUtils.clamp(record.bounds.top, LABEL_VIEWPORT_MARGIN + 24, Math.max(LABEL_VIEWPORT_MARGIN + 24, viewportHeight - 140));
            calloutBounds = _mechaCalloutBounds;
        }
        const place = () => layoutSmartGogglesCallout(
            calloutBounds,
            viewportWidth,
            viewportHeight,
            record.layout,
            {
                labelWidth: record.labelWidth,
                horizontalLength: record.labelWidth,
                diagonalLength: CALLOUT_DIAGONAL_LENGTH,
                horizontal: this.calloutDirection?.horizontal,
                vertical: this.calloutDirection?.vertical,
            },
        );
        place();
        // Near a viewport edge the diagonal consumes some of the available
        // run. Let the panel wrap to that remaining length so its border and
        // the horizontal leader still end together.
        const lineWidth = Math.abs(record.layout.end.x - record.layout.elbow.x);
        if (lineWidth < record.labelWidth) {
            record.labelWidth = lineWidth;
            place();
        }
        this.updateGeometry(record);
    }

    private updateGeometry(record: TargetLockRecord): void {
        const { bounds, layout } = record;
        const centerX = (bounds.left + bounds.right) / 2;
        const centerY = (bounds.top + bounds.bottom) / 2;
        const cornerRadius = Math.hypot(bounds.width / 2, bounds.height / 2);
        const rightX = bounds.right - CORNER_SIZE;
        const bottomY = bounds.bottom - CORNER_SIZE;
        setCornerGeometry(record.corners[0], bounds.left, bounds.top, centerX, centerY);
        setCornerGeometry(record.corners[1], rightX, bounds.top, centerX, centerY);
        setCornerGeometry(record.corners[2], bounds.left, bottomY, centerX, centerY);
        setCornerGeometry(record.corners[3], rightX, bottomY, centerX, centerY);
        setHomingCornerGeometry(record.homingCorners[0], centerX, centerY, cornerRadius, 0, -1);
        setHomingCornerGeometry(record.homingCorners[1], centerX, centerY, cornerRadius, 1, 0);
        setHomingCornerGeometry(record.homingCorners[2], centerX, centerY, cornerRadius, 0, 1);
        setHomingCornerGeometry(record.homingCorners[3], centerX, centerY, cornerRadius, -1, 0);
        setScanStyle(record.killMark, 'left', `${bounds.left.toFixed(1)}px`);
        setScanStyle(record.killMark, 'top', `${bounds.top.toFixed(1)}px`);
        setScanStyle(record.killMark, 'width', `${bounds.width.toFixed(1)}px`);
        setScanStyle(record.killMark, 'height', `${bounds.height.toFixed(1)}px`);

        setScanAttribute(record.path,
            'd',
            `M ${layout.anchor.x.toFixed(1)} ${layout.anchor.y.toFixed(1)} ` +
            `L ${layout.elbow.x.toFixed(1)} ${layout.elbow.y.toFixed(1)} ` +
            `L ${layout.end.x.toFixed(1)} ${layout.end.y.toFixed(1)}`,
        );
        record.root.classList.toggle('is-left', layout.horizontal === 'left');
        record.root.classList.toggle('is-up', layout.vertical === 'up');
        setScanStyle(record.label, 'left', `${layout.labelX.toFixed(1)}px`);
        setScanStyle(record.label, 'top', `${layout.labelY.toFixed(1)}px`);
        setScanStyle(record.label, 'width', `${record.labelWidth}px`);
        // The readout always hangs beneath the single horizontal leader rule.
        setScanStyle(record.label, 'transform', 'translateY(5px)');
        setScanStyle(record.label, '--goggles-label-shift', '-3px');
        setScanStyle(record.label, '--goggles-label-origin', 'top');
        setScanStyle(record.label,
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

        _eliminatedWorldEnvelope.center.copy(record.lastWorldPosition);
        _eliminatedWorldEnvelope.halfWidth = record.lastWorldHalfWidth;
        _eliminatedWorldEnvelope.halfHeight = record.lastWorldHalfHeight;
        if (!projectStableTargetEnvelopeToScreen(
            _eliminatedWorldEnvelope,
            _worldIdentity,
            camera,
            viewportWidth,
            viewportHeight,
            record.bounds,
        )) return false;

        padBounds(record.bounds);
        this.layoutRecord(record, viewportWidth, viewportHeight);
        return true;
    }

    private hideWorldHealthBar(healthBar: THREE.Object3D): void {
        if (!this.hiddenHealthBars.has(healthBar)) this.hiddenHealthBars.set(healthBar, healthBar.visible);
        healthBar.visible = false;
    }

    private beginLeaving(record: TargetLockRecord, now: number): void {
        record.phase = 'leaving';
        record.removeAt = now + EXIT_DURATION_MS;
        record.root.classList.remove('is-active', 'is-resetting');
        record.root.classList.remove('is-homing-locking', 'is-homing-locked');
        record.root.classList.add('is-leaving');
    }

    private eliminate(record: TargetLockRecord, now: number): void {
        if (record.phase === 'eliminated') return;
        record.phase = 'eliminated';
        record.removeAt = now + (this.reducedMotion ? 40 : ELIMINATION_DURATION_MS);
        record.root.classList.remove('is-leaving', 'is-out-of-range', 'is-resetting');
        record.root.classList.remove('is-homing-locking', 'is-homing-locked');
        record.root.classList.add('is-active', 'is-eliminated');
        this.retiringRecords.add(record);
    }

    private retire(record: TargetLockRecord, now: number): void {
        this.beginLeaving(record, now);
        this.retiringRecords.add(record);
    }
}


/** The gameplay HUD supplies its world query; authority shares the geometry. */
export function hasLineOfSightToOrientedBox(origin: THREE.Vector3, localBox: THREE.Box3, worldMatrix: THREE.Matrix4,
    obstacleQuery: TargetObstacleQuery = queryObstaclesAlongSegment, additionalOccluders: THREE.Object3D[] = [], ignoredTargetRoot?: THREE.Object3D): boolean {
    return boxLineOfSight(origin, localBox, worldMatrix, obstacleQuery, additionalOccluders, ignoredTargetRoot);
}
