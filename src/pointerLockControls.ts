import { Camera, Euler, EventDispatcher } from 'three';
import { MouseMovementFilter } from './mouseMovement.js';

type LockElement = HTMLElement & {
    requestPointerLock(options?: { unadjustedMovement?: boolean }): Promise<void> | void;
};

/** Pointer-lock camera input with raw-input negotiation and movement-spike protection. */
export class PointerLockControls extends EventDispatcher<{ lock: {}; unlock: {}; change: {} }> {
    isLocked = false;
    pointerSpeed = 1;
    minPolarAngle = 0;
    maxPolarAngle = Math.PI;
    private readonly filter = new MouseMovementFilter();
    private readonly rotation = new Euler(0, 0, 0, 'YXZ');
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
                await (this.domElement as LockElement).requestPointerLock({ unadjustedMovement: true });
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
        this.domElement.ownerDocument.exitPointerLock();
    }

    dispose(): void {
        this.generation++;
        const doc = this.domElement.ownerDocument;
        doc.removeEventListener('mousemove', this.onMove);
        doc.removeEventListener('pointerlockchange', this.onLockChange);
        doc.removeEventListener('pointerlockerror', this.onLockError);
        this.filter.reset();
    }

    private onLockError = (): void => {
        this.filter.reset();
    };

    private onLockChange = (): void => {
        const locked = this.domElement.ownerDocument.pointerLockElement === this.domElement;
        this.filter.reset();
        if (locked === this.isLocked) return;
        // Set state before listeners update the HUD or inspect input activation.
        this.isLocked = locked;
        this.dispatchEvent({ type: locked ? 'lock' : 'unlock' });
    };

    private onMove = (event: MouseEvent): void => {
        if (!this.isLocked) return;
        const movement = this.filter.sample(event.movementX, event.movementY, event.timeStamp);
        if (!movement) return;
        this.rotation.setFromQuaternion(this.camera.quaternion);
        this.rotation.y -= movement.x * 0.002 * this.pointerSpeed;
        this.rotation.x -= movement.y * 0.002 * this.pointerSpeed;
        this.rotation.x = Math.max(Math.PI / 2 - this.maxPolarAngle,
            Math.min(Math.PI / 2 - this.minPolarAngle, this.rotation.x));
        this.camera.quaternion.setFromEuler(this.rotation);
        this.dispatchEvent({ type: 'change' });
    };
}
