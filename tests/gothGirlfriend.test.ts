import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as THREE from 'three';
import { GothAnimator, GothGirlfriend, getGothPlacement } from '../src/gothGirlfriend.ts';
import { generateTownLayout, createTownBoxes } from '../src/town.ts';
import { state } from '../src/state.js';

// Read the shipped rig's real hierarchy/transforms without requiring image decoding or WebGL.
function rig() {
    const data = readFileSync(new URL('../blender_assets/goth_girlfriend/Goth Girl - Makeup Rigged.glb', import.meta.url));
    const gltf = JSON.parse(data.subarray(20, 20 + data.readUInt32LE(12)).toString());
    const joints = new Set(gltf.skins[0].joints);
    const nodes = gltf.nodes.map((node: any, index: number) => {
        const object = joints.has(index) ? new THREE.Bone() : new THREE.Group();
        object.name = THREE.PropertyBinding.sanitizeNodeName(node.name);
        if (node.translation) object.position.fromArray(node.translation);
        if (node.rotation) object.quaternion.fromArray(node.rotation);
        if (node.scale) object.scale.fromArray(node.scale);
        return object;
    });
    gltf.nodes.forEach((node: any, index: number) => node.children?.forEach((child: number) => nodes[index].add(nodes[child])));
    const model = new THREE.Group();
    gltf.scenes[gltf.scene].nodes.forEach((index: number) => model.add(nodes[index]));
    model.updateMatrixWorld(true);
    return model;
}
const bone = (model: THREE.Object3D, name: string) => model.getObjectByName(THREE.PropertyBinding.sanitizeNodeName(name))!;
const position = (model: THREE.Object3D, name: string) => bone(model, name).getWorldPosition(new THREE.Vector3());

test('only singleplayer and the lobby creator can get a prompt or trigger an interaction', () => {
    const previous = { isMultiplayer: state.isMultiplayer, isHost: state.isHost };
    const building = generateTownLayout(42).find(b => b.name === 'goth house')!;
    const npc = new GothGirlfriend(building);
    npc.animator = new GothAnimator(rig());
    const camera = new THREE.PerspectiveCamera();
    camera.position.copy(npc.group.position).add(new THREE.Vector3(0, 2, 3));
    camera.lookAt(npc.group.position.clone().add(new THREE.Vector3(0, 3.2, 0)));
    try {
        for (const session of [
            { isMultiplayer: true, isHost: false, allowed: false },
            { isMultiplayer: true, isHost: true, allowed: true },
            { isMultiplayer: false, isHost: false, allowed: true },
        ]) {
            state.isMultiplayer = session.isMultiplayer;
            state.isHost = session.isHost;
            npc.update(5);
            assert.equal(npc.canInteract(camera, []), session.allowed, 'the HUD uses this same eligibility check');
            assert.equal(npc.interact(camera, []), session.allowed, 'F cannot bypass the hidden prompt');
            assert.equal(npc.animator.gesture, session.allowed ? 'Wave' : null);
            assert.equal(npc.group.visible, true, 'guests can still see her');
        }
        state.isMultiplayer = true;
        state.isHost = false;
        npc.update(5);
        assert.equal(npc.canInteract(camera, []), false, 'access follows a changed lobby role');
        assert.equal(npc.interact(camera, []), false);
        assert.equal(npc.animator.gesture, null);
    } finally {
        Object.assign(state, previous);
        npc.dispose();
    }
});

test('interaction requires a loaded nearby visible character and stops after disposal', () => {
    const b = generateTownLayout(42).find(b => b.name === 'goth house')!;
    const npc = new GothGirlfriend(b);
    const camera = new THREE.PerspectiveCamera();
    camera.position.copy(npc.group.position).add(new THREE.Vector3(0, 2, 3));
    const target = npc.group.position.clone().add(new THREE.Vector3(0, 1.65, 0));
    camera.lookAt(target);
    assert.equal(npc.canInteract(camera, []), false);
    npc.animator = new GothAnimator(rig());
    assert.equal(npc.interact(camera, []), true);
    assert.equal(npc.interact(camera, []), true, 'reopening can interrupt the previous gesture with a greeting');
    assert.equal(npc.animator.gesture, 'Wave');
    const wall = new THREE.Mesh(new THREE.BoxGeometry(5, 5, .5), new THREE.MeshBasicMaterial());
    wall.position.copy(npc.group.position).add(new THREE.Vector3(0, 2, 1.5));
    wall.visible = false;
    wall.updateMatrixWorld(true);
    assert.equal(npc.canInteract(camera, [wall]), false, 'invisible collision wall blocks interaction');
    camera.lookAt(camera.position.clone().add(new THREE.Vector3(0, 0, 1)));
    assert.equal(npc.canInteract(camera, []), false, 'looking away');
    camera.position.z += 4;
    camera.lookAt(target);
    assert.equal(npc.canInteract(camera, []), false, 'out of range');
    npc.dispose();
    assert.equal(npc.canInteract(camera, []), false);
    wall.geometry.dispose();
    wall.material.dispose();
});

test('NPC stands clear of furniture and faces the doorway across 1,000 town seeds', () => {
    for (let seed = 0; seed < 1000; seed++) {
        const buildings = generateTownLayout(seed);
        const b = buildings.find(b => b.name === 'goth house')!;
        const { position: p, yaw } = getGothPlacement(b);
        assert.ok(!createTownBoxes(buildings).some(box => box.solid && Math.abs(p.x - box.x) < box.width / 2 + .6 && Math.abs(p.z - box.z) < box.depth / 2 + .6 && box.y + box.height / 2 > .1 && box.y - box.height / 2 < 2.4));
        const forward = new THREE.Vector3(0, 0, 1).applyAxisAngle(new THREE.Vector3(0, 1, 0), yaw);
        assert.ok(Math.abs(forward[b.doorAxis] + b.doorSide) < 1e-6);
    }
});
