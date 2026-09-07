import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as THREE from 'three';
import { GothAnimator, GothGirlfriend, GOTH_GESTURES, getGothPlacement, connectGothRig } from '../src/gothGirlfriend.ts';
import { generateTownLayout, createTownBoxes } from '../src/town.ts';
import { state } from '../src/state.js';

// Read the shipped rig's real hierarchy/transforms without requiring image decoding or WebGL.
function rig() {
    const data = readFileSync(new URL('../blender_assets/Goth Girl - Makeup Rigged.glb', import.meta.url));
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

test('reconnecting exported Rigify chains preserves bind pose and attaches fingers/hair', () => {
    const model = rig();
    const original = new Map<THREE.Object3D, THREE.Matrix4>();
    model.traverse(node => original.set(node, node.matrixWorld.clone()));
    connectGothRig(model);
    original.forEach((matrix, node) => matrix.elements.forEach((value, i) => assert.ok(Math.abs(value - node.matrixWorld.elements[i]) < 1e-5)));
    assert.equal(bone(model, 'DEF-f_index.01.R').parent, bone(model, 'DEF-hand.R'));
    assert.equal(bone(model, 'DEF-hair.front.L.01').parent, bone(model, 'DEF-spine.006'));
});

test('all gestures animate the real rig, keep feet planted, and return arms to idle', () => {
    for (const gesture of GOTH_GESTURES) {
        const model = rig();
        const animator = new GothAnimator(model);
        const feet = ['L', 'R'].map(side => position(model, `DEF-foot.${side}`));
        const idleHand = position(model, 'DEF-hand.R');
        animator.play(gesture);
        assert.equal(animator.play(), false, 'do not restart an active gesture');
        animator.update(1.3);
        assert.equal(animator.gesture, gesture);
        if (gesture === 'Wave') assert.ok(position(model, 'DEF-hand.R').y > position(model, 'DEF-spine.006').y, 'wave raises hand above head base');
        for (const [i, side] of ['L', 'R'].entries()) assert.ok(position(model, `DEF-foot.${side}`).distanceTo(feet[i]) < 1e-6);
        model.traverse(node => assert.ok(node.matrixWorld.elements.every(Number.isFinite)));
        animator.update(5);
        assert.equal(animator.gesture, null);
        assert.ok(position(model, 'DEF-hand.R').distanceTo(idleHand) < 0.025);
    }
});

test('random interactions do not repeat the preceding gesture', () => {
    const animator = new GothAnimator(rig());
    let previous: string | null = null;
    for (let i = 0; i < 40; i++) {
        assert.equal(animator.play(), true);
        assert.ok(GOTH_GESTURES.includes(animator.gesture!));
        assert.notEqual(animator.gesture, previous);
        previous = animator.gesture;
        animator.update(5);
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

test('conversation greeting waves and queued replies use only talking gestures after the wave', () => {
    const b = generateTownLayout(42).find(b => b.name === 'goth house')!;
    const npc = new GothGirlfriend(b);
    npc.animator = new GothAnimator(rig());
    const camera = new THREE.PerspectiveCamera();
    camera.position.copy(npc.group.position).add(new THREE.Vector3(0, 2, 3));
    camera.lookAt(npc.group.position.clone().add(new THREE.Vector3(0, 1.65, 0)));
    assert.equal(npc.interact(camera, []), true);
    assert.equal(npc.animator.gesture, 'Wave');
    npc.startTalking();
    npc.update(1);
    assert.equal(npc.animator.gesture, 'Wave');
    npc.update(3);
    assert.ok(['Explain', 'Shrug', 'Agree'].includes(npc.animator.gesture!));
    const previous = npc.animator.gesture;
    npc.update(5);
    npc.startTalking();
    npc.update(0);
    assert.equal(npc.animator.gesture, null, 'paused frames do not start queued gestures');
    npc.update(.016);
    assert.notEqual(npc.animator.gesture, 'Wave');
    assert.notEqual(npc.animator.gesture, previous);
    npc.dispose();
});

test('idle palms face the body and inactive hands stay relaxed during gestures', () => {
    for (const yaw of [0, Math.PI / 2, Math.PI]) {
        const model = rig();
        model.rotation.y = yaw;
        const animator = new GothAnimator(model);
        const checkPalm = (side: string) => {
            const palm = new THREE.Vector3(0, 0, 1).applyQuaternion(bone(model, `DEF-hand.${side}`).getWorldQuaternion(new THREE.Quaternion()));
            const inward = new THREE.Vector3(side === 'L' ? -1 : 1, 0, 0).applyQuaternion(model.quaternion);
            assert.ok(palm.dot(inward) > .9, `${side} palm should face its thigh at yaw ${yaw}`);
        };
        checkPalm('L'); checkPalm('R');
        animator.play('Wave'); animator.update(1.3); checkPalm('L');
        animator.update(5); checkPalm('L'); checkPalm('R');
        animator.play('Agree'); animator.update(1.3); checkPalm('R');
        animator.update(5); checkPalm('L'); checkPalm('R');
    }
});
