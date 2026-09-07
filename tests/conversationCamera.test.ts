import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { ConversationCamera, CONVERSATION_MOVE_SECONDS } from '../src/conversationCamera.js';
import { getGothConversationPose, getGothPlacement, fitGothModel, GOTH_MODEL_HEIGHT, GOTH_CONVERSATION_DISTANCE } from '../src/gothGirlfriend.js';
import { generateTownLayout, createTownBoxes } from '../src/town.js';
import { PLAYER_HEIGHT, PLAYER_RADIUS } from '../src/config.js';
import { createPlayerMesh, disposePlayerVisuals } from '../src/weapons.js';
import { state } from '../src/state.js';

const near = (a: THREE.Vector3, b: THREE.Vector3) => assert.ok(a.distanceTo(b) < 1e-6, `${a.toArray()} != ${b.toArray()}`);

test('conversation movement eases without an initial snap and reaches the same face-on pose at 30/60/144 Hz', () => {
    for (const fps of [30, 60, 144]) {
        const camera = new THREE.PerspectiveCamera();
        camera.position.set(2, 3, 2);
        camera.lookAt(0, 2, 0);
        const start = camera.position.clone();
        const end = new THREE.Vector3(0, 2, 3.2);
        const target = new THREE.Vector3(0, 3.2, 0);
        const move = new ConversationCamera();
        move.start(camera, end, target);
        near(camera.position, start);
        move.update(1 / fps);
        assert.ok(camera.position.distanceTo(start) > 0);
        assert.ok(camera.position.distanceTo(start) < start.distanceTo(end) / 4, 'gentle start');
        for (let i = 1; i <= Math.ceil(CONVERSATION_MOVE_SECONDS * fps); i++) move.update(1 / fps);
        assert.equal(move.active, false);
        near(camera.position, end);
        near(camera.getWorldDirection(new THREE.Vector3()), target.sub(end).normalize());
        near(camera.up.clone().applyQuaternion(camera.quaternion).cross(camera.getWorldDirection(new THREE.Vector3())).normalize(), new THREE.Vector3(-1, 0, 0));
    }
});

test('closing midway cancels translation and rotation; reopening starts from the current pose', () => {
    const camera = new THREE.PerspectiveCamera();
    camera.position.set(2, 2, 3);
    const move = new ConversationCamera();
    const end = new THREE.Vector3(0, 2, 3.2);
    const look = new THREE.Vector3(0, 3.2, 0);
    move.start(camera, end, look);
    move.update(.2);
    move.cancel();
    const stopped = camera.position.clone();
    const rotation = camera.quaternion.clone();
    move.update(10);
    near(camera.position, stopped);
    assert.ok(camera.quaternion.angleTo(rotation) < 1e-7);
    move.start(camera, end, look);
    move.update(NaN);
    move.update(-1);
    near(camera.position, stopped);
    move.update(CONVERSATION_MOVE_SECONDS);
    near(camera.position, end);
});

test('centered conversation positions face the NPC and clear room walls/furniture across 1,000 seeds', () => {
    for (let seed = 0; seed < 1000; seed++) {
        const buildings = generateTownLayout(seed);
        const building = buildings.find(b => b.name === 'goth house')!;
        const placement = getGothPlacement(building);
        const group = new THREE.Group();
        group.position.copy(placement.position);
        group.rotation.y = placement.yaw;
        const pose = getGothConversationPose(group);
        assert.equal(pose.position.y, PLAYER_HEIGHT);
        const offset = pose.position.clone().sub(group.position); offset.y = 0;
        near(offset, new THREE.Vector3(0, 0, GOTH_CONVERSATION_DISTANCE).applyQuaternion(group.quaternion));
        assert.ok(pose.lookAt.y > pose.position.y, 'look up toward her face');
        for (const box of createTownBoxes(buildings)) {
            const overlaps = box.solid && box.y + box.height / 2 > .1 && box.y - box.height / 2 < PLAYER_HEIGHT
                && Math.abs(pose.position.x - box.x) < box.width / 2 + PLAYER_RADIUS
                && Math.abs(pose.position.z - box.z) < box.depth / 2 + PLAYER_RADIUS;
            assert.equal(overlaps, false, `blocked destination at seed ${seed}`);
        }
    }
});

test('NPC fitting is uniform, grounds the asset and makes it 8% taller than the real player mesh', () => {
    state.scene = new THREE.Scene();
    createPlayerMesh();
    const playerBounds = new THREE.Box3().setFromObject(state.playerMesh!);
    const playerHeight = playerBounds.max.y - playerBounds.min.y;
    const model = new THREE.Group();
    const geometry = new THREE.BoxGeometry(.6, 1.85, .3);
    const material = new THREE.MeshBasicMaterial();
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.y = .8;
    model.position.y = .2;
    model.add(mesh);
    fitGothModel(model);
    const bounds = new THREE.Box3().setFromObject(model);
    assert.ok(Math.abs(bounds.min.y) < 1e-6);
    assert.ok(Math.abs(bounds.max.y - GOTH_MODEL_HEIGHT) < 1e-6);
    assert.ok(Math.abs(bounds.max.y / playerHeight - 1.08) < 1e-6);
    assert.equal(model.scale.x, model.scale.y);
    assert.equal(model.scale.y, model.scale.z);
    geometry.dispose(); material.dispose(); disposePlayerVisuals(); state.scene = null;
});
