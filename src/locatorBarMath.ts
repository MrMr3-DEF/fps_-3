import { LOCATOR_HALF_ANGLE } from './config.js';

interface Point { x: number; y: number; z: number }
export interface LocatorView {
    position: Point;
    /** Three.js YXZ camera angles, in radians. */
    yaw: number;
    pitch: number;
    verticalFov: number;
}
export interface LocatorProjection {
    position: number;
    elevation: 'above' | 'below' | 'level';
}

/** Bearing is independent of zoom, distance, occlusion and render culling.
 * Only the elevation arrows use the current vertical field of view. */
export function projectLocatorTarget(target: Point, view: LocatorView): LocatorProjection | null {
    const dx = target.x - view.position.x;
    const dy = target.y - view.position.y;
    const dz = target.z - view.position.z;
    if (![dx, dy, dz, view.yaw, view.pitch, view.verticalFov].every(Number.isFinite) ||
        view.verticalFov <= 0 || view.verticalFov >= Math.PI) return null;
    const horizontal = Math.hypot(dx, dz);
    if (horizontal === 0 && dy === 0) return null;
    // A directly overhead/underfoot target has no horizontal bearing. Center it
    // and retain its elevation cue, including when the camera looks vertically.
    const angle = horizontal === 0 ? 0 : Math.atan2(dx, -dz) + view.yaw;
    const bearing = Math.atan2(Math.sin(angle), Math.cos(angle));
    if (Math.abs(bearing) > LOCATOR_HALF_ANGLE + 1e-10) return null;
    const forward = -dx * Math.sin(view.yaw) - dz * Math.cos(view.yaw);
    // Test the camera's vertical viewport rather than a world-height threshold.
    // At the sides of the bar, perspective can put a target above the view even
    // when its world elevation is less than half the camera's vertical FOV.
    const elevation = Math.atan2(dy * Math.cos(view.pitch) - forward * Math.sin(view.pitch),
        forward * Math.cos(view.pitch) + dy * Math.sin(view.pitch));
    return {
        position: Math.max(0, Math.min(1, 0.5 + bearing / (2 * LOCATOR_HALF_ANGLE))),
        elevation: elevation > view.verticalFov / 2 ? 'above' : elevation < -view.verticalFov / 2 ? 'below' : 'level',
    };
}
