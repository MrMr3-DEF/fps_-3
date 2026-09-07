import * as THREE from 'three';

export const CONVERSATION_MOVE_SECONDS = 0.55;

/** A short, frame-rate-independent move of the actual player camera into conversation. */
export class ConversationCamera {
    private camera: THREE.Camera | null = null;
    private elapsed = 0;
    private startPosition = new THREE.Vector3();
    private endPosition = new THREE.Vector3();
    private startRotation = new THREE.Quaternion();
    private endRotation = new THREE.Quaternion();
    private lookMatrix = new THREE.Matrix4();
    get active(): boolean { return this.camera !== null; }

    start(camera: THREE.Camera, position: THREE.Vector3, lookAt: THREE.Vector3): void {
        this.camera = camera;
        this.elapsed = 0;
        this.startPosition.copy(camera.position);
        this.endPosition.copy(position);
        this.startRotation.copy(camera.quaternion);
        this.lookMatrix.lookAt(position, lookAt, camera.up);
        this.endRotation.setFromRotationMatrix(this.lookMatrix);
    }

    update(delta: number): void {
        if (!this.camera || !Number.isFinite(delta) || delta <= 0) return;
        this.elapsed = Math.min(CONVERSATION_MOVE_SECONDS, this.elapsed + delta);
        const t = this.elapsed / CONVERSATION_MOVE_SECONDS;
        const eased = t * t * (3 - 2 * t);
        this.camera.position.lerpVectors(this.startPosition, this.endPosition, eased);
        this.camera.quaternion.slerpQuaternions(this.startRotation, this.endRotation, eased);
        this.camera.updateMatrixWorld(true);
        if (t === 1) this.cancel();
    }

    /** Escape/death/world changes stop at the current pose, without a later snap. */
    cancel(): void { this.camera = null; }
}
