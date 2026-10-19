import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { MechaTransitionCamera } from '../src/mechaTransitionCamera.ts';
import { MechaCameraHandoff, resolveCameraObstruction, resolveThirdPersonCameraPosition } from '../src/thirdPersonCamera.ts';
import { MECHA_HEIGHT, MECHA_BOARD_TIME, MECHA_RELEASE_CAMERA_TIME, THIRD_PERSON_CAMERA_COLLISION_RADIUS } from '../src/config.ts';
import { ForgottenMecha } from '../src/forgottenMecha.ts';
import { loadIronmawTestAsset } from './ironmawTestAsset.ts';
import { state } from '../src/state.ts';
import { prepareForgottenMecha, forgottenMecha, disposeWorld } from '../src/world.ts';
import { setThirdPerson, syncThirdPersonPresentation } from '../src/weapons.ts';

const absent = { position: new THREE.Vector3(), alive: false, grounded: false };
const origin = new THREE.Vector3(), follow = new THREE.Vector3(8, 33, -45), identity = new THREE.Quaternion();
function begin(thirdPerson = true) {
    const controller = new MechaTransitionCamera();
    controller.recordView(follow, identity); controller.begin('entry', thirdPerson, origin, identity);
    return controller;
}
function advance(actor: ForgottenMecha, seconds: number, step = 1 / 60) {
    for (let elapsed = 0; elapsed < seconds - 1e-9; elapsed += step) actor.update(Math.min(step, seconds - elapsed), absent);
}

test('front framing fits the complete fitted envelope at varied headings, FOVs and aspect ratios', () => {
    for (const heading of [0, Math.PI / 2, -2.4]) for (const fov of [30, 75, 110]) for (const aspect of [0.6, 1, 2.2]) {
        const controller = begin(); controller.update(MECHA_BOARD_TIME);
        const root = new THREE.Vector3(31, 2, -42), radius = 13;
        controller.resolve(root, heading, radius, fov, aspect, follow, identity, []);
        const camera = new THREE.PerspectiveCamera(fov, aspect, 0.1, 2000);
        camera.position.copy(controller.position); camera.quaternion.copy(controller.quaternion); camera.updateMatrixWorld(true);
        const front = camera.position.clone().sub(root);
        assert.ok(front.x * Math.sin(heading) + front.z * Math.cos(heading) > 0);
        for (let angle = 0; angle < Math.PI * 2; angle += Math.PI / 8) for (const height of [0, MECHA_HEIGHT]) {
            const point = root.clone().add(new THREE.Vector3(Math.sin(angle) * radius, height, Math.cos(angle) * radius)).project(camera);
            assert.ok(Math.abs(point.x) < 1 && Math.abs(point.y) < 1 && point.z < 1, `cropped at ${heading}/${fov}/${aspect}: ${point.toArray()}`);
        }
        assert.ok(controller.queryRadius(root, radius, fov, aspect) > Math.hypot(front.x, front.z));
    }
});

test('swivel preserves its captured start and returns by an orbit to the exact follow pose without mutating it', () => {
    const controller = begin(), position = follow.clone(), quaternion = identity.clone();
    controller.resolve(origin, 0, 13, 75, 16 / 9, position, quaternion, []);
    assert.ok(controller.position.distanceTo(follow) < 1e-8); assert.ok(controller.quaternion.angleTo(identity) < 1e-8);
    controller.update(MECHA_BOARD_TIME); controller.resolve(origin, 0, 13, 75, 16 / 9, position, quaternion, []);
    const front = controller.position.clone();
    for (const progress of [0, 0.5, 1]) {
        controller.sync('startup', 'reveal', progress, false);
        controller.resolve(origin, 0, 13, 75, 16 / 9, position, quaternion, []);
        if (progress === 0) assert.ok(controller.position.distanceTo(front) < 1e-8);
        if (progress === 0.5) assert.ok(Math.hypot(controller.position.x, controller.position.z) > 25, 'orbit stays outside the body');
        if (progress === 1) { assert.ok(controller.position.distanceTo(follow) < 1e-8); assert.ok(controller.quaternion.angleTo(identity) < 1e-8); }
    }
    assert.ok(position.equals(follow)); assert.ok(quaternion.equals(identity));
    controller.sync('piloted', 'ready', 1, false); assert.equal(controller.locked, false);
});

test('camera obstruction supports both in-place sweep endpoints and a zero-length segment', () => {
    const wall = new THREE.Object3D(); wall.position.set(0, 10, 10);
    Object.assign(wall.userData, { halfW: 10, halfD: 1, halfH: 10, height: 20 });
    const start = new THREE.Vector3(0, 10, 0), end = new THREE.Vector3(0, 10, 20);
    const expected = resolveCameraObstruction(start, end, [wall], new THREE.Vector3());
    assert.ok(expected.z > 0 && expected.z < 9 - THIRD_PERSON_CAMERA_COLLISION_RADIUS);
    const outStart = start.clone(), outEnd = end.clone();
    resolveCameraObstruction(outStart, end, [wall], outStart); resolveCameraObstruction(start, outEnd, [wall], outEnd);
    assert.ok(outStart.equals(expected)); assert.ok(outEnd.equals(expected));
    resolveCameraObstruction(start, start, [], outStart); assert.ok(outStart.equals(start));
});

test('swivel checks travel between camera frames as well as the final boom', () => {
    const source = new THREE.Vector3(45, 30, 0), free = new MechaTransitionCamera();
    free.recordView(source, identity); free.begin('entry', true, origin, identity); free.update(MECHA_BOARD_TIME / 2);
    free.resolve(origin, 0, 13, 75, 16 / 9, follow, identity, []);
    const wall = new THREE.Object3D(); wall.position.lerpVectors(source, free.position, 0.5);
    Object.assign(wall.userData, { halfW: 1, halfD: 1, halfH: 40, height: 80 });
    const blocked = new MechaTransitionCamera(); blocked.recordView(source, identity); blocked.begin('entry', true, origin, identity); blocked.update(MECHA_BOARD_TIME / 2);
    blocked.resolve(origin, 0, 13, 75, 16 / 9, follow, identity, [wall]);
    assert.ok(blocked.position.distanceTo(free.position) > 1);
    assert.ok(blocked.position.distanceTo(source) < wall.position.distanceTo(source));
    assert.ok(blocked.position.y >= THIRD_PERSON_CAMERA_COLLISION_RADIUS);
});

test('capture locks either saved perspective, ignores scope until release and freezes with a paused clock', () => {
    for (const thirdPerson of [false, true]) {
        const controller = begin(thirdPerson);
        assert.equal(controller.external, thirdPerson); assert.equal(controller.locked, true);
        assert.equal(controller.acceptSecondary(true), false);
        controller.update(0); assert.equal(controller.phase, 'swivel');
        controller.update(MECHA_BOARD_TIME); controller.sync('startup', 'loading', 0, false);
        assert.equal(controller.locked, true);
        controller.sync('piloted', 'ready', 1, false); assert.equal(controller.locked, false);
        assert.equal(controller.acceptSecondary(true), false, 'held input cannot scope after unlocking');
        assert.equal(controller.acceptSecondary(false), false); assert.equal(controller.acceptSecondary(true), true);
        controller.begin('exit', thirdPerson, origin, identity); controller.sync('startup', 'hud', 0, true);
        assert.equal(controller.recovering, true); controller.sync('piloted', 'ready', 1, false);
        assert.equal(controller.recovering, false); controller.reset(); assert.equal(controller.external, false);
    }
    const fresh = begin(); fresh.sync('piloted', 'ready', 1, false);
    assert.equal(fresh.acceptSecondary(true), true, 'a new press after entry works immediately');
    fresh.begin('exit', true, origin, identity, true); fresh.sync('piloted', 'ready', 1, false);
    assert.equal(fresh.acceptSecondary(true), false, 'a press already held at sequence start must be released');
});

test('voluntary handoff starts at the rendered pose, follows falling, sweeps walls and ends at the ordinary boom', () => {
    const handoff = new MechaCameraHandoff(), player = new THREE.Vector3(0, 18, 6);
    const position = new THREE.Vector3(10, 25, 45), quaternion = new THREE.Quaternion().setFromEuler(new THREE.Euler(-0.2, 0.3, 0));
    handoff.beginFromPose(position, quaternion, player);
    const camera = new THREE.PerspectiveCamera(); camera.position.copy(resolveThirdPersonCameraPosition(player, identity, [], new THREE.Vector3()));
    handoff.applyPose(player, [], camera.position, camera.quaternion);
    assert.ok(camera.position.equals(position)); assert.ok(camera.quaternion.equals(quaternion));
    const frozen = camera.position.clone(); handoff.update(0); handoff.applyPose(player, [], camera.position, camera.quaternion); assert.ok(camera.position.equals(frozen));
    player.y -= 2; handoff.update(MECHA_RELEASE_CAMERA_TIME / 2);
    const normal = resolveThirdPersonCameraPosition(player, identity, [], new THREE.Vector3()); camera.position.copy(normal); camera.quaternion.copy(identity);
    handoff.applyPose(player, [], camera.position, camera.quaternion);
    assert.ok(camera.position.y < position.y); assert.ok(camera.position.distanceTo(normal) > 1);
    assert.ok(camera.quaternion.angleTo(identity) > 0 && camera.quaternion.angleTo(identity) < quaternion.angleTo(identity));
    handoff.update(MECHA_RELEASE_CAMERA_TIME / 2); assert.equal(handoff.fromRenderPose, false);
    const wall = new THREE.Object3D(); wall.position.set(0, 18, 25); Object.assign(wall.userData, { halfW: 20, halfD: 1, halfH: 40, height: 80 });
    handoff.beginFromPose(position, quaternion, player); camera.position.copy(normal); handoff.applyPose(player, [wall], camera.position, camera.quaternion);
    assert.ok(camera.position.z < 24 - THIRD_PERSON_CAMERA_COLLISION_RADIUS || camera.position.z > 26 + THIRD_PERSON_CAMERA_COLLISION_RADIUS);
    handoff.reset(); assert.equal(handoff.active, false);
});

test('actual Mount and control-ready frame are identical for either perspective at varied frame rates', async () => {
    for (const step of [1 / 30, 1 / 144, 0.047]) {
        const records: string[][] = [];
        for (const thirdPerson of [false, true]) {
            const actor = new ForgottenMecha([], [], 42); actor.install(await loadIronmawTestAsset());
            actor.group.position.set(0, 0, 0); actor.group.rotation.y = 0;
            try {
                actor.damage(50); advance(actor, 6.1);
                actor.beginBoarding(actor.seatAnchor.getWorldPosition(new THREE.Vector3()), identity, thirdPerson);
                const frames: string[] = [];
                for (let frame = 0; frame < 1500; frame++) {
                    actor.update(step, absent);
                    frames.push(`${actor.mode}/${actor.headView.phase}/${actor.animationTime.toFixed(6)}/${actor.controlsFrozen}`);
                    if (actor.mode === 'piloted') break;
                    assert.equal(actor.damage(1).accepted, false); assert.equal(actor.transitionCamera.locked, true);
                }
                assert.equal(actor.mode, 'piloted'); assert.equal(actor.transitionCamera.locked, false);
                records.push(frames);
                assert.equal(actor.requestExit(thirdPerson), true); advance(actor, 9);
                assert.equal(actor.mode, 'dead'); assert.equal(actor.transitionCamera.locked, false);
                actor.beginBoarding(actor.seatAnchor.getWorldPosition(new THREE.Vector3()), identity, thirdPerson);
                assert.equal(actor.transitionCamera.locked, true);
            } finally { actor.dispose(); assert.equal(actor.transitionCamera.locked, false); }
        }
        assert.deepEqual(records[0], records[1]);
    }
});

test('production perspective setter cannot change or queue P during entry, exit or the release handoff', async () => {
    const saved = { ...state }, originalLoad = ForgottenMecha.prototype.load;
    ForgottenMecha.prototype.load = async function () { this.install(await loadIronmawTestAsset()); };
    state.scene = new THREE.Scene(); state.renderer = null; state.isMultiplayer = false; state.obstacles = []; state.targets = []; state.lavaPools = [];
    state.camera = new THREE.PerspectiveCamera(); state.playerMesh = new THREE.Group(); state.leftGun = new THREE.Group(); state.rightGunContainer = new THREE.Group();
    state.playerHp = 10;
    try {
        await prepareForgottenMecha({ impact() {}, stompPlayer() {}, gameOver() {} }, async () => {});
        const actor = forgottenMecha!; actor.group.position.set(0, 0, 0); actor.group.rotation.y = 0;
        actor.damage(50); advance(actor, 6.1);
        setThirdPerson(true); state.keyCActive = state.rightClickActive = true;
        actor.beginBoarding(actor.seatAnchor.getWorldPosition(new THREE.Vector3()), identity, state.isThirdPerson);
        for (const seconds of [0, 0.45, 2, 4]) {
            advance(actor, seconds); setThirdPerson(false); syncThirdPersonPresentation();
            assert.equal(state.isThirdPerson, true); assert.equal(state.isThirdPersonView, true);
        }
        advance(actor, 3); state.keyCActive = state.rightClickActive = false;
        assert.equal(actor.requestExit(state.isThirdPerson), true);
        setThirdPerson(false); assert.equal(state.isThirdPerson, true);
        while (actor.ownsPilot) actor.update(1 / 60, absent);
        assert.equal(actor.transitionCamera.phase, 'release'); setThirdPerson(false); assert.equal(state.isThirdPerson, true);
        actor.update(0, absent); assert.equal(actor.transitionCamera.locked, true);
        advance(actor, MECHA_RELEASE_CAMERA_TIME); setThirdPerson(false); assert.equal(state.isThirdPerson, false);
    } finally { disposeWorld(); ForgottenMecha.prototype.load = originalLoad; Object.assign(state, saved); }
});

test('newly blocked third-person release recovers without refilling energy or retaining a camera lock', async () => {
    const wall = new THREE.Object3D(); wall.position.set(500, 20, 0);
    Object.assign(wall.userData, { halfW: 80, halfD: 80, halfH: 40, height: 80 });
    let blocked = 0, released = 0;
    const actor = new ForgottenMecha([wall], [], 42, { impact() {}, stompPlayer() {}, gameOver() {},
        exitBlocked() { blocked++; }, pilotReleased() { released++; } });
    actor.install(await loadIronmawTestAsset()); actor.group.position.set(0, 0, 0); actor.group.rotation.y = 0;
    try {
        actor.damage(50); advance(actor, 6.1);
        actor.beginBoarding(actor.seatAnchor.getWorldPosition(new THREE.Vector3()), identity, true); advance(actor, 8.3);
        actor.combat.energy = 0.4;
        assert.equal(actor.requestExit(true), true); wall.position.x = 0;
        for (let i = 0; i < 600 && actor.mode === 'shutting-down'; i++) actor.update(1 / 60, absent);
        assert.equal(actor.mode, 'startup'); assert.equal(actor.transitionCamera.recovering, true);
        assert.equal(actor.transitionCamera.external, true); assert.equal(actor.transitionCamera.locked, true);
        const phase = actor.headView.phase; actor.update(0, absent); assert.equal(actor.headView.phase, phase);
        advance(actor, 0.8); assert.equal(actor.mode, 'piloted'); assert.equal(actor.transitionCamera.locked, false);
        assert.ok(actor.combat.energy >= 0.4 && actor.combat.energy < 1); assert.equal(blocked, 1); assert.equal(released, 0);
        assert.equal(actor.requestExit(true), false); assert.equal(actor.transitionCamera.locked, false);
    } finally { actor.dispose(); }
});
