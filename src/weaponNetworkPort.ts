import type * as THREE from 'three';
import type { HomingTargetPacket, NetworkPacket } from './networkTypes.js';
import type { PeerData } from './state.js';

export interface WeaponNetworkPort {
    broadcastLocalFire(barrelPos: THREE.Vector3, direction: THREE.Vector3, hitPoint: THREE.Vector3 | null, shotId: number, spreadSeed: number, homingTarget?: HomingTargetPacket, homingStartDistance?: number): void;
    broadcastToAll(packet: NetworkPacket): void;
    flashPeerMesh(peerData: PeerData, color?: number, durationMs?: number): void;
}

let activePort: WeaponNetworkPort | null = null;

export function setWeaponNetworkPort(port: WeaponNetworkPort): void {
    activePort = port;
}

function getPort(): WeaponNetworkPort {
    if (!activePort) {
        throw new Error('Weapon networking has not been initialized.');
    }
    return activePort;
}

export function broadcastLocalFire(barrelPos: THREE.Vector3, direction: THREE.Vector3, hitPoint: THREE.Vector3 | null, shotId: number, spreadSeed: number, homingTarget?: HomingTargetPacket, homingStartDistance?: number): void {
    getPort().broadcastLocalFire(barrelPos, direction, hitPoint, shotId, spreadSeed, homingTarget, homingStartDistance);
}

export function broadcastToAll(packet: NetworkPacket): void {
    getPort().broadcastToAll(packet);
}

export function flashPeerMesh(peerData: PeerData, color?: number, durationMs?: number): void {
    getPort().flashPeerMesh(peerData, color, durationMs);
}

export interface MeleePlayer {
    id: string; lifeId: number; alive: boolean; ready: boolean; name: string;
    position: THREE.Vector3; yaw: number; pitch: number;
}
export interface MeleeNetworkPort {
    players(): MeleePlayer[];
    ready(peerId: string): boolean;
    reserve(peerId: string): void;
    hitTarget(index: number, damage: number, attacker: MeleePlayer, sequence: number): void;
    sendCommand(packet: import('./networkTypes.js').MeleeCommand): void;
    emit(packet: import('./networkTypes.js').MeleeEvent): void;
    confirmHit(packet: import('./networkTypes.js').MeleeHitEvent): void;
    blocked(start: THREE.Vector3, end: THREE.Vector3, mecha: boolean): boolean;
    hitPlayer(player: MeleePlayer, attacker: MeleePlayer, damage: number, sequence: number): void;
    hitMecha(attacker: MeleePlayer, damage: number, origin: THREE.Vector3, point: THREE.Vector3): boolean;
}
let meleePort: MeleeNetworkPort | null = null;
export function setMeleeNetworkPort(port: MeleeNetworkPort): void { meleePort = port; }
export function getMeleeNetworkPort(): MeleeNetworkPort { if (!meleePort) throw new Error('Melee networking not initialized'); return meleePort; }
