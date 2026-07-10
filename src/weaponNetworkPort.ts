import type * as THREE from 'three';
import type { NetworkPacket } from './networkTypes.js';

export interface WeaponNetworkPort {
    broadcastLocalFire(barrelPos: THREE.Vector3, direction: THREE.Vector3, hitPoint?: THREE.Vector3 | null): void;
    broadcastToAll(packet: NetworkPacket): void;
    flashPeerMesh(peerData: unknown, color?: number, durationMs?: number): void;
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

export function broadcastLocalFire(barrelPos: THREE.Vector3, direction: THREE.Vector3, hitPoint: THREE.Vector3 | null = null): void {
    getPort().broadcastLocalFire(barrelPos, direction, hitPoint);
}

export function broadcastToAll(packet: NetworkPacket): void {
    getPort().broadcastToAll(packet);
}

export function flashPeerMesh(peerData: unknown, color?: number, durationMs?: number): void {
    getPort().flashPeerMesh(peerData, color, durationMs);
}
