import * as THREE from 'three';
import { createScreenBounds, createSmartGogglesCalloutLayout, layoutSmartGogglesCallout } from './smartGogglesMath.js';
import { SCAN_TYPE_CHARACTER_MS, SCAN_TYPE_LINE_PAUSE_CHARACTERS, SCAN_TYPE_START_DELAY_MS } from './smartGoggles.js';

const SVG_NS = 'http://www.w3.org/2000/svg';
const CORNER_SIZE = 15;
const SCAN_PADDING = 8;

export interface WeaponScanGeometry {
    radius: number;
}

const meshBounds = new THREE.Box3();

/** Preview framing excludes dormant muzzle effects attached to gameplay guns. */
export function getVisibleWeaponBounds(model: THREE.Object3D): THREE.Box3 {
    const bounds = new THREE.Box3();
    model.updateWorldMatrix(true, true);
    model.traverseVisible(object => {
        if (!(object instanceof THREE.Mesh)) return;
        if (!object.geometry.boundingBox) object.geometry.computeBoundingBox();
        if (!object.geometry.boundingBox) return;
        meshBounds.copy(object.geometry.boundingBox).applyMatrix4(object.matrixWorld);
        bounds.union(meshBounds);
    });
    return bounds;
}

const meshVertex = new THREE.Vector3();

/**
 * Every rotation sweeps each mesh vertex over a sphere about the preview pivot.
 * The farthest actual vertex gives the exact radius of that swept volume.
 */
export function createWeaponScanGeometry(model: THREE.Object3D): WeaponScanGeometry {
    let radiusSq = 0;
    model.updateWorldMatrix(true, true);
    model.traverseVisible(object => {
        if (!(object instanceof THREE.Mesh)) return;
        const positions = object.geometry.getAttribute('position');
        if (!positions) return;
        for (let i = 0; i < positions.count; i++) {
            meshVertex.fromBufferAttribute(positions, i).applyMatrix4(object.matrixWorld);
            radiusSq = Math.max(radiusSq, meshVertex.lengthSq());
        }
    });
    return { radius: Math.sqrt(radiusSq) };
}

/**
 * Fit the gun's rotation-invariant bounding sphere inside the right half.
 * The extra quarter-width term accounts for perspective at the off-axis
 * position used to center the gun at 75% of the viewport width.
 */
export function fitWeaponPreviewDistance(radius: number, width: number, height: number, fovDegrees: number): number {
    const focalPixels = height / (2 * Math.tan(THREE.MathUtils.degToRad(fovDegrees / 2)));
    const usableHalfSize = Math.max(32, Math.min(width * 0.19, height * 0.32) - SCAN_PADDING);
    return Math.max(3, radius + radius * (focalPixels + width / 4) / usableHalfSize);
}

export interface WeaponScreenBounds {
    left: number;
    top: number;
    right: number;
    bottom: number;
}

const sphereCenter = new THREE.Vector3();

/** Exact min/max tangent slopes from the camera to a sphere on one screen axis. */
function tangentSlopes(axisCenter: number, depth: number, radius: number): readonly [number, number] {
    const denominator = depth * depth - radius * radius;
    const spread = radius * Math.sqrt(axisCenter * axisCenter + denominator);
    return [(axisCenter * depth - spread) / denominator, (axisCenter * depth + spread) / denominator];
}

/**
 * Project the gun's complete rotation-swept sphere. The resulting box is fixed
 * for this gun and viewport, and is the smallest axis-aligned screen box that
 * contains its mesh at every rotation, apart from the scan's small padding.
 */
export function projectWeaponScanBounds(
    geometry: WeaponScanGeometry,
    camera: THREE.PerspectiveCamera,
    width: number,
    height: number,
    out: WeaponScreenBounds,
): boolean {
    sphereCenter.set(0, 0, 0).applyMatrix4(camera.matrixWorldInverse);
    const depth = -sphereCenter.z;
    const radius = geometry.radius;
    if (!(radius > 0 && depth > radius + camera.near)) return false;
    const [leftSlope, rightSlope] = tangentSlopes(sphereCenter.x, depth, radius);
    const [bottomSlope, topSlope] = tangentSlopes(sphereCenter.y, depth, radius);
    const projection = camera.projectionMatrix.elements;
    const focalX = projection[0] * width / 2;
    const focalY = projection[5] * height / 2;
    const screenCenterX = (1 - projection[8]) * width / 2;
    const screenCenterY = (1 + projection[9]) * height / 2;
    out.left = screenCenterX + focalX * leftSlope - SCAN_PADDING;
    out.right = screenCenterX + focalX * rightSlope + SCAN_PADDING;
    out.top = screenCenterY - focalY * topSlope - SCAN_PADDING;
    out.bottom = screenCenterY - focalY * bottomSlope + SCAN_PADDING;
    return true;
}

export class WeaponMenuScan {
    private readonly layer: HTMLElement;
    private readonly root: HTMLDivElement;
    private readonly corners: HTMLDivElement[];
    private readonly path: SVGPathElement;
    private readonly label: HTMLDivElement;
    private readonly panel: HTMLDivElement;
    private readonly identifier: HTMLSpanElement;
    private readonly reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
    private readonly bounds = createScreenBounds();
    private readonly callout = createSmartGogglesCalloutLayout();
    private facts: Array<{ text: string; typed: HTMLSpanElement }> = [];
    private activeName = '';
    private activateAt = Infinity;
    private typeStartedAt = Infinity;

    constructor(layer: HTMLElement, specs: HTMLElement) {
        this.layer = layer;
        this.root = document.createElement('div');
        this.root.className = 'goggles-target-lock is-peer is-left is-up weapon-scan-lock';
        this.corners = (['tl', 'tr', 'bl', 'br'] as const).map(name => {
            const corner = document.createElement('div');
            corner.className = `goggles-target-corner goggles-target-corner--${name}`;
            this.root.append(corner);
            return corner;
        });
        const leader = document.createElementNS(SVG_NS, 'svg');
        leader.classList.add('goggles-target-leader');
        leader.setAttribute('aria-hidden', 'true');
        this.path = document.createElementNS(SVG_NS, 'path');
        this.path.setAttribute('pathLength', '1');
        leader.append(this.path);
        this.root.append(leader);
        this.label = document.createElement('div');
        this.label.className = 'goggles-target-label';
        this.identifier = document.createElement('span');
        this.identifier.className = 'goggles-target-identifier';
        this.panel = document.createElement('div');
        this.panel.className = 'goggles-target-label-panel';
        this.panel.append(specs);
        this.label.append(this.identifier, this.panel);
        this.root.append(this.label);
        layer.append(this.root);
    }

    hide(): void {
        this.layer.hidden = true;
        this.root.classList.remove('is-active', 'is-resetting', 'is-leaving');
        this.activateAt = Infinity;
    }

    /** Reuse the in-game lock's corner collapse and leader retraction. */
    leave(): void {
        if (this.layer.hidden) return;
        this.root.classList.remove('is-active', 'is-resetting');
        this.root.classList.add('is-leaving');
    }

    update(
        name: string,
        geometry: WeaponScanGeometry,
        camera: THREE.PerspectiveCamera,
        width: number,
        height: number,
        navRight: number,
        navTop: number,
        now: number,
    ): void {
        const newScan = this.layer.hidden || this.activeName !== name;
        if (newScan) {
            this.layer.hidden = false;
            this.activeName = name;
            this.identifier.textContent = '';
            this.root.classList.remove('is-active', 'is-leaving');
            this.root.classList.add('is-resetting');
            this.activateAt = now + (this.reducedMotion ? 1 : 35);
            this.typeStartedAt = now + (this.reducedMotion ? 0 : SCAN_TYPE_START_DELAY_MS);
            this.facts = [...this.panel.querySelectorAll<HTMLSpanElement>('#weapon-specs .goggles-target-fact')].map(fact => {
                // Reopening Weapons can reuse the same facts after a prior
                // typing pass; read the untouched measuring copy in that case.
                const text = fact.querySelector('.weapon-fact-measure')?.textContent ?? fact.textContent ?? '';
                const measure = document.createElement('span');
                measure.className = 'weapon-fact-measure';
                measure.textContent = text;
                measure.setAttribute('aria-hidden', 'true');
                const typed = document.createElement('span');
                typed.className = 'weapon-fact-typed';
                fact.replaceChildren(measure, typed);
                return { text, typed };
            });
        }
        if (!projectWeaponScanBounds(geometry, camera, width, height, this.bounds)) return;

        const { left, top, right, bottom } = this.bounds;
        const positions: Array<readonly [number, number]> = [
            [left, top], [right - CORNER_SIZE, top],
            [left, bottom - CORNER_SIZE], [right - CORNER_SIZE, bottom - CORNER_SIZE],
        ];
        for (let i = 0; i < this.corners.length; i++) {
            this.corners[i].style.left = `${positions[i][0].toFixed(1)}px`;
            this.corners[i].style.top = `${positions[i][1].toFixed(1)}px`;
            this.corners[i].style.setProperty('--goggles-collapse-x', `${((left + right) / 2 - positions[i][0] - CORNER_SIZE / 2).toFixed(1)}px`);
            this.corners[i].style.setProperty('--goggles-collapse-y', `${((top + bottom) / 2 - positions[i][1] - CORNER_SIZE / 2).toFixed(1)}px`);
        }

        const compact = height < 560;
        // Landscape leaves a narrow lane between the navigation and the gun.
        // Shorten both leader segments there so the readout stays in that lane.
        const compactRoom = left - navRight - 12;
        const baseDiagonal = compact ? 16 : 54;
        const labelWidth = compact
            ? Math.max(100, Math.min(210, compactRoom - baseDiagonal))
            : Math.max(110, Math.min(300, left - 20 - baseDiagonal));
        this.label.style.width = `${labelWidth.toFixed(1)}px`;
        // Keep the in-game 45-degree callout. Only lengthen that diagonal when
        // the taller menu readout would otherwise cover the weapon buttons.
        const panelHeight = this.panel.getBoundingClientRect().height;
        const overlapsNavColumn = left - baseDiagonal - labelWidth < navRight + 8;
        const diagonalLength = overlapsNavColumn
            ? Math.max(baseDiagonal, top + 5 + panelHeight - navTop + 12)
            : baseDiagonal;
        this.bounds.width = right - left;
        this.bounds.height = bottom - top;
        const layout = layoutSmartGogglesCallout(this.bounds, width, height, this.callout, {
            horizontal: 'left',
            vertical: 'up',
            labelWidth,
            horizontalLength: labelWidth,
            diagonalLength,
        });
        this.path.setAttribute(
            'd',
            `M ${layout.anchor.x.toFixed(1)} ${layout.anchor.y.toFixed(1)} ` +
            `L ${layout.elbow.x.toFixed(1)} ${layout.elbow.y.toFixed(1)} ` +
            `L ${layout.end.x.toFixed(1)} ${layout.end.y.toFixed(1)}`,
        );
        this.label.style.left = `${layout.labelX.toFixed(1)}px`;
        this.label.style.top = `${layout.labelY.toFixed(1)}px`;
        this.label.style.transform = 'translateY(5px)';
        this.label.style.setProperty('--goggles-label-shift', '-3px');
        this.label.style.setProperty('--goggles-label-origin', 'top');
        this.label.style.setProperty('--goggles-label-align', 'flex-end');
        if (now >= this.activateAt) {
            this.root.classList.remove('is-resetting');
            this.root.classList.add('is-active');
        }
        const characterBudget = this.reducedMotion
            ? Number.POSITIVE_INFINITY
            : Math.max(0, Math.floor((now - this.typeStartedAt) / SCAN_TYPE_CHARACTER_MS));
        const visibleName = name.slice(0, characterBudget);
        if (this.identifier.textContent !== visibleName) this.identifier.textContent = visibleName;
        let factBudget = Math.max(0, characterBudget - name.length - SCAN_TYPE_LINE_PAUSE_CHARACTERS);
        for (const fact of this.facts) {
            const visibleText = fact.text.slice(0, factBudget);
            if (fact.typed.textContent !== visibleText) fact.typed.textContent = visibleText;
            factBudget = Math.max(0, factBudget - fact.text.length - SCAN_TYPE_LINE_PAUSE_CHARACTERS);
        }
    }
}
