import type * as THREE from 'three';
import type { CameraShake } from './cameraShake.js';
import type { MechaImpact } from './forgottenMecha.js';
import { MECHA_DEFEAT_SHAKE, MECHA_STOMP_SHAKE } from './config.js';

/** Shared by local and host-replicated impacts; damage eligibility is separate. */
export function triggerMechaImpactShake(shake: CameraShake, kind: MechaImpact,
    player: THREE.Vector3, center: THREE.Vector3): void {
    if (kind !== 'stomp' && kind !== 'knees' && kind !== 'fists') return;
    const profile = kind === 'stomp' ? MECHA_STOMP_SHAKE : MECHA_DEFEAT_SHAKE;
    // Horizontal reach deliberately includes jumping, hovering and rooftop
    // observers. Ground/leg contact gates stomp damage, never camera feedback.
    const distance = Math.hypot(player.x - center.x, player.z - center.z);
    if (distance > profile.radius) return;
    // Retain a readable pulse at the outer edge, with stronger feedback nearby.
    shake.trigger(profile.strength * (1 - distance / profile.radius * 0.65), profile.duration);
}
