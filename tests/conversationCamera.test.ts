import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { ConversationCamera, CONVERSATION_MOVE_SECONDS } from '../src/conversationCamera.js';
import { GothGirlfriend, getGothConversationPose, getGothPlacement, GOTH_MODEL_HEIGHT, GOTH_FACE_HEIGHT, GOTH_CONVERSATION_DISTANCE, GOTH_HITBOX_DEPTH, GOTH_HITBOX_WIDTH } from '../src/gothGirlfriend.js';
import { generateTownLayout, createTownBoxes } from '../src/town.js';
import { PLAYER_HEIGHT, PLAYER_RADIUS } from '../src/config.js';

import { state } from '../src/state.js';
import { obstacleData } from '../src/userDataTypes.js';

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
        near(pose.lookAt, group.position.clone().add(new THREE.Vector3(0, GOTH_FACE_HEIGHT, 0)));
        for (const box of createTownBoxes(buildings)) {
            const overlaps = box.solid && box.y + box.height / 2 > .1 && box.y - box.height / 2 < PLAYER_HEIGHT
                && Math.abs(pose.position.x - box.x) < box.width / 2 + PLAYER_RADIUS
                && Math.abs(pose.position.z - box.z) < box.depth / 2 + PLAYER_RADIUS;
            assert.equal(overlaps, false, `blocked destination at seed ${seed}`);
        }
    }
});

test('girlfriend uses one fixed box hitbox and ignores it during her own interaction ray', () => {
    const building = generateTownLayout(42).find(candidate => candidate.name === 'goth house')!;
    const girlfriend = new GothGirlfriend(building);
    const hitbox = girlfriend.hitbox;
    const geometry = hitbox.geometry as THREE.BoxGeometry;
    assert.equal(geometry.parameters.width, GOTH_HITBOX_WIDTH);
    assert.equal(geometry.parameters.height, GOTH_MODEL_HEIGHT);
    assert.equal(geometry.parameters.depth, GOTH_HITBOX_DEPTH);
    assert.equal(hitbox.visible, false);
    assert.deepEqual(obstacleData(hitbox), {
        height: GOTH_MODEL_HEIGHT,
        halfW: GOTH_HITBOX_WIDTH / 2,
        halfD: GOTH_HITBOX_DEPTH / 2,
        halfH: GOTH_MODEL_HEIGHT / 2,
    });

    // The gameplay proxy blocks the world but must not make conversation with
    // its own character fail the visibility test.
    girlfriend.animator = {} as any;
    state.isMultiplayer = false;
    const pose = getGothConversationPose(girlfriend.group);
    const camera = new THREE.PerspectiveCamera();
    camera.position.copy(pose.position);
    camera.lookAt(pose.lookAt);
    camera.updateMatrixWorld(true);
    hitbox.updateMatrixWorld(true);
    const selfRay = new THREE.Raycaster(
        camera.position,
        pose.lookAt.clone().sub(camera.position).normalize(),
        0,
        camera.position.distanceTo(pose.lookAt),
    );
    assert.ok(selfRay.intersectObject(hitbox).length > 0, 'interaction ray crosses the physical proxy');
    assert.equal(girlfriend.canInteract(camera, [hitbox]), true);

    girlfriend.dispose();
    geometry.dispose();
    (hitbox.material as THREE.Material).dispose();
});
