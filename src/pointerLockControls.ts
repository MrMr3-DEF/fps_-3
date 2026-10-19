import { Camera, EventDispatcher } from 'three';
import { MouseMovementFilter, MouseMovementResampler } from './mouseMovement.js';
import { applyLookInput } from './lookInput.js';
import { POINTER_RADIANS_PER_UNIT } from './config.js';

type LockElement = HTMLElement & {
    requestPointerLock(options?: { unadjustedMovement?: boolean }): Promise<void> | void;
};

/** Shared mouse/trackpad aim with adaptive resampling and optional raw input. */
export class PointerLockControls extends EventDispatcher<{ lock: {}; unlock: {}; change: {} }> {
    isLocked = false;
    pointerSpeed = 1;
    rawMouseInput = false;
    mouseSpikeProtection = false;
    minPolarAngle = 0;
    maxPolarAngle = Math.PI;
    private readonly filter = new MouseMovementFilter();
    private readonly resampler = new MouseMovementResampler();
    private pending = false;
    private generation = 0;

    readonly camera: Camera;
    readonly domElement: HTMLElement;

    constructor(camera: Camera, domElement: HTMLElement) {
        super();
        this.camera = camera;
        this.domElement = domElement;
        const doc = domElement.ownerDocument;
        doc.addEventListener('mousemove', this.onMove);
        doc.addEventListener('pointerlockchange', this.onLockChange);
        doc.addEventListener('pointerlockerror', this.onLockError);
    }

    getObject(): Camera { return this.camera; }

    lock(): void {
        if (this.isLocked || this.pending) return;
        this.pending = true;
        const generation = ++this.generation;
        void this.request(generation);
    }

    private async request(generation: number): Promise<void> {
        try {
            try {
                if (this.rawMouseInput) await (this.domElement as LockElement).requestPointerLock({ unadjustedMovement: true });
                else await this.domElement.requestPointerLock();
            } catch (error) {
                // Unsupported raw input can fall back; focus/permission failures cannot.
                if (!(error instanceof Error) || error.name !== 'NotSupportedError' || generation !== this.generation) throw error;
                await this.domElement.requestPointerLock();
            }
        } catch (error) {
            if (generation === this.generation) console.warn('Pointer lock request failed:', error);
        } finally {
            if (generation === this.generation) this.pending = false;
        }
    }

    unlock(): void {
        this.generation++;
        this.pending = false;
        this.resetLook();
        this.domElement.ownerDocument.exitPointerLock();
    }

    dispose(): void {
        this.generation++;
        const doc = this.domElement.ownerDocument;
        doc.removeEventListener('mousemove', this.onMove);
        doc.removeEventListener('pointerlockchange', this.onLockChange);
        doc.removeEventListener('pointerlockerror', this.onLockError);
        this.resetLook();
    }

    resetLook(): void { this.filter.reset(); this.resampler.reset(); }

    /** Publish one aim pose for rendering, homing and every between-frame action. */
    update(time = performance.now()): void {
        if (!this.isLocked) return;
        const movement = this.resampler.advance(time);
        if (!movement.x && !movement.y) return;
        applyLookInput(this.camera, -movement.x * POINTER_RADIANS_PER_UNIT * this.pointerSpeed,
            -movement.y * POINTER_RADIANS_PER_UNIT * this.pointerSpeed,
            Math.PI / 2 - this.maxPolarAngle, Math.PI / 2 - this.minPolarAngle, time);
        this.dispatchEvent({ type: 'change' });
    }

    private onLockError = (): void => {
        // Some browsers report failure through the event without settling the
        // returned promise. A subsequent Resume click must be allowed to retry.
        this.pending = false;
        this.resetLook();
    };

    private onLockChange = (): void => {
        const locked = this.domElement.ownerDocument.pointerLockElement === this.domElement;
        this.resetLook();
        if (locked === this.isLocked) return;
        // Set state before listeners update the HUD or inspect input activation.
        this.isLocked = locked;
        this.dispatchEvent({ type: locked ? 'lock' : 'unlock' });
    };

    private onMove = (event: MouseEvent): void => {
        if (!this.isLocked) return;
        const movement = this.filter.sample(event.movementX, event.movementY, event.timeStamp, this.mouseSpikeProtection);
        if (!movement) return;
        this.resampler.add(movement.x, movement.y, event.timeStamp, performance.now());
    };
}
