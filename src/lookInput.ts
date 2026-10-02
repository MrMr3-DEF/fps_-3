import { Camera, Euler } from 'three';

type LookHandler = (yawDelta: number, pitchDelta: number, sampleTime: number) => boolean;
let handler: LookHandler | null = null;
const rotation = new Euler(0, 0, 0, 'YXZ');

/** Mouse and touch share event timing as well as look deltas. Vehicle motion
 * follows recent input speed; render-camera restoration must not queue angles. */
export function setLookInputHandler(next: LookHandler | null): void { handler = next; }
export function applyLookInput(camera: Camera, yaw: number, pitch: number, minPitch = -Math.PI / 2, maxPitch = Math.PI / 2, sampleTime = performance.now()): void {
    if (handler?.(yaw, pitch, sampleTime)) return;
    rotation.setFromQuaternion(camera.quaternion);
    rotation.y += yaw;
    rotation.x = Math.max(minPitch, Math.min(maxPitch, rotation.x + pitch));
    camera.quaternion.setFromEuler(rotation);
}
