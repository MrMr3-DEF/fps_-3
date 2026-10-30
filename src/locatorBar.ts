import * as THREE from 'three';
import { PEER_Y_OFFSET } from './config.js';
import type { ForgottenMecha } from './forgottenMecha.js';
import type { PlayerListEntry } from './networkTypes.js';
import type { PeerData } from './state.js';
import { projectLocatorTarget, type LocatorView } from './locatorBarMath.js';

type LocatorPeer = Pick<PeerData, 'mesh' | 'hp' | 'deathReported'>;
type LocatorPlayer = Pick<PlayerListEntry, 'peerId' | 'bodyColor'>;
type LocatorMecha = Pick<ForgottenMecha, 'ready' | 'disposed' | 'mode' | 'ownsLocalPilot' | 'ownsPilot' | 'pilotPeerId' | 'hitbox'>;

/** Match presentation only: consume confirmed identities and already-replicated
 * poses, never visibility masks or another source of multiplayer authority. */
export class LocatorBar {
    private readonly layer: HTMLElement;
    private readonly markers = new Map<string, HTMLElement>();
    private readonly seen = new Set<string>();
    private readonly position = new THREE.Vector3();
    private readonly rotation = new THREE.Euler(0, 0, 0, 'YXZ');
    private readonly view: LocatorView = { position: new THREE.Vector3(), yaw: 0, pitch: 0, verticalFov: 1 };

    constructor(layer: HTMLElement) { this.layer = layer; }

    update(camera: THREE.PerspectiveCamera, peers: Readonly<Record<string, LocatorPeer>>,
        players: readonly LocatorPlayer[], localPeerId: string | undefined, mecha: LocatorMecha | null): void {
        this.rotation.setFromQuaternion(camera.quaternion, 'YXZ');
        this.view.position = camera.position;
        this.view.yaw = this.rotation.y;
        this.view.pitch = this.rotation.x;
        this.view.verticalFov = THREE.MathUtils.degToRad(camera.getEffectiveFOV());
        this.seen.clear();
        for (const player of players) {
            const peer = peers[player.peerId];
            if (player.peerId === localPeerId || !peer || peer.hp <= 0 || peer.deathReported ||
                mecha?.ownsPilot && mecha.pilotPeerId === player.peerId) continue;
            peer.mesh.getWorldPosition(this.position);
            this.position.y += PEER_Y_OFFSET;
            this.updateMarker(`player:${player.peerId}`, 'player', `#${player.bodyColor.toString(16).padStart(6, '0')}`);
        }
        // Zero enemy HP leaves a mountable vehicle. Only final destruction or
        // local occupancy removes it; hp/mesh.visible would hide valid targets.
        if (mecha?.ready && !mecha.disposed && !mecha.ownsLocalPilot &&
            mecha.mode !== 'destroying' && mecha.mode !== 'destroyed') {
            mecha.hitbox.getWorldPosition(this.position);
            this.updateMarker('mecha', 'mecha', '#c5cbd0');
        }
        for (const [id, marker] of this.markers) if (!this.seen.has(id)) {
            marker.remove(); this.markers.delete(id);
        }
    }

    private updateMarker(id: string, kind: 'player' | 'mecha', color: string): void {
        const projection = projectLocatorTarget(this.position, this.view);
        if (!projection) return;
        this.seen.add(id);
        let marker = this.markers.get(id);
        if (!marker) {
            marker = this.layer.ownerDocument.createElement('span');
            marker.className = `locator-dot locator-dot-${kind}`;
            marker.setAttribute('aria-hidden', 'true');
            this.layer.append(marker); this.markers.set(id, marker);
        }
        marker.style.left = `${projection.position * 100}%`;
        marker.style.setProperty('--locator-color', color);
        marker.dataset.elevation = projection.elevation;
    }

    reset(): void {
        this.layer.replaceChildren(); this.markers.clear(); this.seen.clear();
    }
}
