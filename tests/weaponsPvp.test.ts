import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { state } from '../src/state.ts';
import { createAkimboGuns, fireProjectile, disposePlayerVisuals } from '../src/weapons.ts';
import { disposeParticles } from '../src/particles.ts';
import { setWeaponNetworkPort } from '../src/weaponNetworkPort.ts';
import type { NetworkPacket } from '../src/networkTypes.ts';

test('sniper ignores dead bodies and decorations, and hits the live body with its current life', () => {
    state.scene = new THREE.Scene();
    state.camera = new THREE.PerspectiveCamera();
    state.camera.position.y = 2;
    state.isMultiplayer = true;
    state.username = 'Guest1';
    createAkimboGuns();
    state.activeWeaponName = 'SNIPER';
    state.rightGun = state.sniperMesh;
    state.scene.updateMatrixWorld(true);
    const packets: NetworkPacket[] = [];
    setWeaponNetworkPort({ broadcastToAll: packet => packets.push(packet), broadcastLocalFire: () => {}, flashPeerMesh: () => {} });
    const peer = (x: number, z: number, hp: number, visible = true) => {
        const mesh = new THREE.Group();
        mesh.position.set(x, 1.65, z);
        mesh.visible = visible;
        // Decoration crossing the ray must never count as a hit on an offset body.
        const decoration = new THREE.Mesh(new THREE.BoxGeometry(2, 2, 2), new THREE.MeshBasicMaterial());
        decoration.position.x = -x;
        mesh.add(decoration);
        state.scene!.add(mesh);
        return { mesh, hp, lifeId: 7 } as any;
    };
    state.peers = { dead: peer(0, -5, 0, false), label: peer(10, -10, 10), live: peer(0, -20, 10) };
    state.peerIds = Object.keys(state.peers);
    state.scene.updateMatrixWorld(true);
    try {
        fireProjectile();
        const hit = packets.find(p => p.type === 'player_hit');
        assert.equal(hit?.type, 'player_hit');
        if (hit?.type === 'player_hit') {
            assert.equal(hit.targetPeerId, 'live');
            assert.equal(hit.targetLifeId, 7);
            assert.equal(hit.attackerName, 'Guest1');
        }
    } finally {
        disposeParticles();
        disposePlayerVisuals();
        state.peers = {}; state.peerIds = []; state.isMultiplayer = false;
    }
});
