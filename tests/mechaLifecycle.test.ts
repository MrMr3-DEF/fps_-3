import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { MechaMovement } from '../src/mechaMovement.ts';
import { MechaPilot } from '../src/mechaPilot.ts';
import { ForgottenMecha, type MechaPlayer } from '../src/forgottenMecha.ts';
import { loadIronmawTestAsset } from './ironmawTestAsset.ts';
import { releaseMechaPilot, type MechaPilotRelease } from '../src/mechaPilotRelease.ts';
import { MechaCameraHandoff, resolveThirdPersonCameraPosition } from '../src/thirdPersonCamera.ts';
import { syncThirdPersonPresentation } from '../src/weapons.ts';
import { state } from '../src/state.ts';
import { updatePlayerPhysics } from '../src/physics.ts';
import { playerTouchesWorldBox, PLAYER_BODY_CAMERA_OFFSET } from '../src/playerHitbox.ts';

const absent: MechaPlayer = { position: new THREE.Vector3(), alive: false, grounded: false };
const part = (x = 0, z = 0, bottom = 0, top = 2) => ({ x, z, halfW: 1, halfD: 1, bottom, top });
const box = { x: 5, z: 0, halfW: 1, halfD: 2, bottom: 0, top: 5 };
const wrap = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));
function advance(actor: ForgottenMecha, seconds: number, player = absent, step = 1 / 60) {
    for (let t = 0; t < seconds - 1e-9; t += step) { actor.flushRenderedDamage(player.lifeId ?? 0); actor.update(Math.min(step, seconds - t), player); actor.acknowledgeRendered(); }
}
async function robot(onStomp = () => {}, onRelease = (_pose: MechaPilotRelease) => {}, obstacles: THREE.Object3D[] = []) {
    const actor = new ForgottenMecha(obstacles, [], 42, { impact() {}, stompPlayer: onStomp, gameOver() {}, pilotReleased: onRelease });
    const asset = await loadIronmawTestAsset();
    // The Node loader omits browser texture decoding/materials. Restore only
    // the semantic eye material so these tests exercise the real power fade.
    (asset.scene.getObjectByName('M_EyeLens') as THREE.Mesh).material = new THREE.MeshStandardMaterial({ name: 'IRONMAW_Eye_State' });
    actor.install(asset); actor.group.position.set(0, 0, 0); actor.group.rotation.y = 0;
    return actor;
}
function torso(actor: ForgottenMecha) { const q = actor.group.getObjectByName('CTRL_WaistYaw')!.quaternion; return wrap(2 * Math.atan2(q.z, q.w)); }
async function board(actor: ForgottenMecha) {
    actor.damage(50); advance(actor, 6.1);
    actor.beginBoarding(actor.seatAnchor.getWorldPosition(new THREE.Vector3()), new THREE.Quaternion()); advance(actor, 8.3);
}

test('fitted sweeps slide, stop at corners, cannot tunnel, and allow backing out of existing overlap', () => {
    const movement = new MechaMovement([box]), out = new THREE.Vector3();
    movement.resolve(new THREE.Vector3(), new THREE.Vector3(100, 0, 0), [part()], out);
    assert.ok(Math.abs(out.x - 2.9) < 1e-8);
    movement.resolve(new THREE.Vector3(), new THREE.Vector3(10, 0, 5), [part()], out);
    assert.ok(Math.abs(out.x - 2.9) < 1e-8); assert.equal(out.z, 5);
    const overlapping = new THREE.Vector3(3.5, 0, 0);
    movement.resolve(overlapping, new THREE.Vector3(0, 0, 0), [part(3.5)], out); assert.equal(out.x, 0);
    movement.resolve(overlapping, new THREE.Vector3(4, 0, 0), [part(3.5)], out); assert.equal(out.x, 3.5);
    const corner = new MechaMovement([box, { ...box, x: 0, z: 5, halfW: 10, halfD: 1 }]);
    corner.resolve(new THREE.Vector3(), new THREE.Vector3(10, 0, 10), [part()], out);
    assert.ok(out.x <= 2.9 + 1e-9 && out.z <= 2.9 + 1e-9);
});

test('height-aware parts and fitted border remove route setbacks without ignoring solid geometry', () => {
    const out = new THREE.Vector3();
    new MechaMovement([box]).resolve(new THREE.Vector3(), new THREE.Vector3(10, 0, 0), [part(0, 0, 10, 12)], out);
    assert.equal(out.x, 10);
    const border = new MechaMovement([], 20);
    border.resolve(new THREE.Vector3(), new THREE.Vector3(100, 0, 0), [part()], out); assert.ok(Math.abs(out.x - 18.9) < 1e-8);
    border.resolve(new THREE.Vector3(19.5, 0, 0), new THREE.Vector3(18, 0, 0), [part(19.5)], out); assert.equal(out.x, 18);
    border.resolve(new THREE.Vector3(19.5, 0, 0), new THREE.Vector3(20, 0, 0), [part(19.5)], out); assert.equal(out.x, 19.5);
});

test('blocked movement retains acceleration and alignment intent; accepted distance drives walk/reverse playback', () => {
    const pilot = new MechaPilot(), position = new THREE.Vector3(); pilot.reset(0);
    const blocked = (start: THREE.Vector3, _end: THREE.Vector3, _heading: number, out: THREE.Vector3) => out.copy(start);
    for (let i = 0; i < 60; i++) assert.equal(pilot.update(1 / 60, position, 0, 6.095, 1, blocked).rate, 0);
    const move = pilot.update(1 / 60, position, 0, 6.095, 1, (_a, end, _h, out) => out.copy(end));
    assert.equal(move.rate, 1); assert.ok(move.distance > 0.1);
    const before = position.clone(); const reverse = pilot.update(0.1, position, 0, 6.095, -1, (a, b, _h, out) => out.copy(a).lerp(b, 0.5));
    assert.ok(reverse.rate < 0); assert.ok(Math.abs(reverse.distance) - before.distanceTo(position) < 1e-9); pilot.dispose();
});

test('real piloted legs travel and reverse near a low obstacle inside the old navigation exclusion', async () => {
    const obstacle = new THREE.Object3D(); obstacle.position.set(20, 2.5, 0);
    Object.assign(obstacle.userData, { halfW: 3, halfD: 3, halfH: 2.5, height: 5 });
    const actor = await robot(undefined, undefined, [obstacle]); actor.group.position.x = 10; actor.group.rotation.y = Math.PI / 2;
    await board(actor); const start = actor.group.position.clone(); actor.setPilotInput(1, false); advance(actor, 0.5);
    assert.ok(actor.group.position.x > start.x + 0.5, 'low obstacle does not reserve a 15m circle');
    const forward = actor.group.position.x; actor.setPilotInput(-1, false); advance(actor, 0.5);
    assert.ok(actor.group.position.x < forward - 0.5); actor.dispose();
});

test('enemy defeat aligns both ways at 90 degrees/s, preserves legs, pauses, then plays complete Death', async () => {
    for (const desired of [-Math.PI + 0.001, -Math.PI / 2, 0, Math.PI / 2, Math.PI - 0.001]) {
        const actor = await robot();
        // Dome heights now acquire rockets. Hold laser reload in its cylinder
        // to isolate torso tracking/defeat from committed attack recovery.
        actor.combat.reloadRemaining = Infinity;
        const player = { position: new THREE.Vector3(Math.sin(desired) * 70, 2, Math.cos(desired) * 70), alive: true, grounded: false };
        advance(actor, Math.abs(desired) / 0.366 + 0.5, player); assert.ok(Math.abs(wrap(torso(actor) - desired)) < 0.001);
        const before = torso(actor), position = actor.group.position.clone(), heading = actor.group.rotation.y, revision = actor.revision;
        actor.damage(50); assert.equal(actor.revision, revision + 1); assert.equal(actor.canMount, false);
        assert.ok(Math.abs(wrap(torso(actor) - before)) < 0.001); assert.equal(actor.combat.shieldActive, false);
        actor.update(0, player); assert.ok(Math.abs(wrap(torso(actor) - before)) < 0.001);
        let old = torso(actor), elapsed = 0, previousPower = 1.35;
        while (actor.mode === 'aligning') {
            actor.update(0.01, player); elapsed += 0.01;
            const current = torso(actor); assert.ok(Math.abs(wrap(current - old)) <= Math.PI / 2 * 0.01 + Math.PI / 180 + 1e-8); old = current;
            const eye = actor.group.getObjectByName('M_EyeLens') as THREE.Mesh<THREE.BufferGeometry, THREE.MeshStandardMaterial>;
            assert.ok(eye.material.emissiveIntensity <= previousPower + 1e-8); previousPower = eye.material.emissiveIntensity;
        }
        assert.ok(elapsed <= 2.01); assert.equal(actor.mode, 'dying'); assert.ok(Math.abs(torso(actor)) < 1e-8);
        assert.deepEqual(actor.group.position.toArray(), position.toArray()); assert.equal(actor.group.rotation.y, heading);
        advance(actor, 5.99); assert.equal(actor.canMount, false); advance(actor, 0.06); assert.equal(actor.canMount, true); actor.dispose();
    }
});

test('defeat during stomp cancels its damage and starts Death only after torso alignment', async () => {
    let kills = 0; const actor = await robot(() => kills++);
    actor.combat.reloadRemaining = Infinity;
    const player = { position: new THREE.Vector3(60, 2, 0), alive: true, grounded: false }; advance(actor, 5, player);
    player.position.set(8, 2, 0); player.grounded = true; advance(actor, 0.4, player); assert.equal(actor.mode, 'stomping');
    actor.damage(50); assert.equal(actor.mode, 'aligning'); advance(actor, 10, player);
    assert.equal(kills, 0); assert.equal(actor.mode, 'dead'); actor.dispose();
});

test('defeat of an already gray powered-down eye never flashes red again', async () => {
    const actor = await robot(); actor.combat.shieldPhase = 'down'; actor.combat.advanceClock(0.4);
    actor.update(0.01, absent); const eye = actor.group.getObjectByName('M_EyeLens') as THREE.Mesh<THREE.BufferGeometry, THREE.MeshStandardMaterial>;
    assert.equal(eye.material.emissiveIntensity, 0); const gray = eye.material.color.clone(); actor.damage(50); actor.update(0.2, absent);
    assert.equal(eye.material.emissiveIntensity, 0); assert.ok(eye.material.color.equals(gray)); actor.dispose();
});

test('impact kills on either animated foot, shin/knee or thigh at varied frame rates; leg-free jumps survive', async () => {
    const sample = await robot(); const near = { position: new THREE.Vector3(0, 2, 8), alive: true, grounded: true };
    sample.update(0.01, near); advance(sample, 1.615, absent);
    for (const name of ['M_Foot_L', 'M_Foot_R', 'M_LowerLeg_L', 'M_LowerLeg_R', 'M_Thigh_L', 'M_Thigh_R']) {
        const collider = sample.colliders.find(c => c.name.endsWith(`-${name}`))!, point = collider.position.clone(); point.y += collider.scale.y / 2 + 2;
        for (const step of [1 / 30, 1 / 144, 0.4]) {
            let kills = 0; const actor = await robot(() => kills++); const player = { ...near, position: near.position.clone() };
            advance(actor, 1.2, player); player.position.copy(point); player.grounded = false; player.yaw = Math.PI / 3;
            advance(actor, 0.6, player, step); actor.flushRenderedDamage(0); assert.equal(kills, 1, `${name} at ${step}`); advance(actor, 1, player); assert.equal(kills, 1); actor.dispose();
        }
    }
    let kills = 0; const actor = await robot(() => kills++); advance(actor, 1.2, near);
    advance(actor, 0.7, { position: new THREE.Vector3(0, 20, 20), alive: true, grounded: false }, 0.4); assert.equal(kills, 0);
    sample.dispose(); actor.dispose();
});

test('oriented leg contact rejects height gaps and space between legs', () => {
    const min = new THREE.Vector3(1.5, 0, -1), max = new THREE.Vector3(3, 6, 1);
    assert.equal(playerTouchesWorldBox(new THREE.Vector3(1.5, 7.65, 0), 0, min, max, 0.1), true);
    assert.equal(playerTouchesWorldBox(new THREE.Vector3(1.5, 7.8, 0), 0, min, max, 0.1), false);
    assert.equal(playerTouchesWorldBox(new THREE.Vector3(0, 2, 0), 0, min, max, 0.1), false);
});

test('release preserves health, life, fuel and third person, restores bean/weapon parenting and normal falling', async () => {
    const original = { ...state }, oldVelocity = state.velocity.clone(); const scene = new THREE.Scene(), camera = new THREE.PerspectiveCamera(), bean = new THREE.Group();
    const actor = await robot(undefined, pose => releaseMechaPilot(pose));
    try {
        state.scene = scene; state.camera = camera; state.playerMesh = bean; state.controls = { getObject: () => camera, isLocked: true } as typeof state.controls;
        state.obstacles = []; state.playerHp = 7; state.lifeId = 12; state.hoverFuel = 0.42; state.isPlaying = true;
        state.isThirdPerson = true; state.isThirdPersonView = false; state.deaths = 3; state.activeWeaponName = 'SNIPER';
        state.leftGun = new THREE.Group(); state.rightGunContainer = new THREE.Group(); camera.add(state.leftGun, state.rightGunContainer);
        await board(actor); actor.pilotAnchor.add(bean); bean.scale.setScalar(actor.pilotScale);
        const seat = actor.pilotAnchor.getWorldPosition(new THREE.Vector3()); state.keyCActive = state.rightClickActive = state.isMouseDown = true;
        state.isShiftDown = true; actor.requestRocket(); actor.damage(50); syncThirdPersonPresentation();
        assert.equal(actor.ownsPilot, false); assert.equal(bean.parent, scene); assert.equal(bean.scale.x, 1.5);
        assert.deepEqual(bean.position.toArray(), seat.toArray()); assert.equal(camera.position.y, seat.y + PLAYER_BODY_CAMERA_OFFSET);
        assert.equal(state.playerHp, 7); assert.equal(state.lifeId, 12); assert.equal(state.hoverFuel, 0.42); assert.equal(state.deaths, 3); assert.equal(state.activeWeaponName, 'SNIPER');
        assert.equal(state.isThirdPersonView, true); assert.equal(state.leftGun.parent, bean); assert.equal(state.rightGunContainer.parent, bean);
        assert.equal(state.isScoped, false); assert.equal(state.isMouseDown, false); assert.equal(state.isShiftDown, false);
        const height = camera.position.y; updatePlayerPhysics(0.05); assert.ok(camera.position.y < height); assert.equal(state.playerHp, 7);
        advance(actor, 4); assert.equal(actor.mode, 'destroyed'); assert.equal(state.isThirdPersonView, true);
    } finally { actor.dispose(); Object.assign(state, original); state.velocity.copy(oldVelocity); }
});

test('third-person release starts at the old eye boom, follows falling, pauses and ends collision-safe at normal size', () => {
    const handoff = new MechaCameraHandoff(), eye = new THREE.Vector3(0, 23, 8), beanEye = new THREE.Vector3(0, 17, 3.5);
    const quaternion = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI);
    const previous = resolveThirdPersonCameraPosition(eye, quaternion, [], new THREE.Vector3(), { distance: 45, height: 10, shoulder: 8 });
    handoff.begin(eye, beanEye, quaternion); const initial = resolveThirdPersonCameraPosition(beanEye, quaternion, [], new THREE.Vector3(), handoff.dimensions);
    assert.ok(previous.distanceTo(initial) < 1e-8); const dims = { ...handoff.dimensions }; handoff.update(0); assert.deepEqual(handoff.dimensions, dims);
    beanEye.y -= 2; handoff.update(0.15); assert.ok(handoff.dimensions.distance > 5.5 && handoff.dimensions.distance < 45);
    const wall = new THREE.Object3D(); wall.position.set(0, 18, -2); Object.assign(wall.userData, { height: 40, halfH: 20, halfW: 30, halfD: 0.5 });
    const collision = resolveThirdPersonCameraPosition(beanEye, quaternion, [wall], new THREE.Vector3(), handoff.dimensions); assert.ok(collision.z > wall.position.z + 0.5);
    handoff.update(0.15); assert.equal(handoff.active, false); assert.deepEqual(handoff.dimensions, { distance: 5.5, height: 1.2, shoulder: 1.5 });
    handoff.begin(eye, beanEye, quaternion); handoff.reset(); assert.equal(handoff.active, false);
});
