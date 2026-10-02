import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { ForgottenMecha } from '../src/forgottenMecha.ts';
import { MechaPilot } from '../src/mechaPilot.ts';
import { MechaNavigation } from '../src/mechaNavigation.ts';
import { loadIronmawTestAsset } from './ironmawTestAsset.ts';
import { applyLookInput, setLookInputHandler } from '../src/lookInput.ts';
import { toggleGrapplingHook, updateHook, resetHook } from '../src/grapple.ts';
import { prepareForgottenMecha, forgottenMecha, disposeWorld } from '../src/world.ts';
import { state } from '../src/state.ts';

const absent = { position: new THREE.Vector3(), alive: false, grounded: false };
const empty = (_sx: number, _sz: number, _ex: number, _ez: number, out: THREE.Object3D[]) => { out.length = 0; return out; };
function advance(actor: ForgottenMecha, seconds: number, step = 1 / 60) { for (let t = 0; t < seconds - 1e-9; t += step) actor.update(Math.min(step, seconds - t), absent); }
async function mounted(lava: THREE.Object3D[] = []) {
    const actor = new ForgottenMecha([], lava, 42); actor.install(await loadIronmawTestAsset());
    actor.group.position.set(0, 0, 0); actor.group.rotation.y = 0; actor.damage(50); advance(actor, 6.1);
    actor.beginBoarding(actor.seatAnchor.getWorldPosition(new THREE.Vector3()), new THREE.Quaternion()); advance(actor, 8.3); return actor;
}
function view(actor: ForgottenMecha) { const camera = new THREE.PerspectiveCamera(75, 16 / 9, 0.1, 2000); camera.position.copy(actor.pilot.cameraPosition); camera.quaternion.copy(actor.pilot.cameraQuaternion); return camera; }

test('export includes eleven timed clips and anatomical right cassette socket with legacy L parent', async () => {
    const asset = await loadIronmawTestAsset(); assert.equal(asset.animations.length, 11);
    for (const [name, duration] of [['HeadOpen', 1], ['HeadClose', 1], ['RocketFire', 3]] as const) assert.equal(asset.animations.find(a => a.name === name)!.duration, duration);
    const slide = asset.scene.getObjectByName('CTRL_RocketSlide_R')!;
    assert.equal(slide.parent!.name, 'PART_Forearm_L_02'); assert.equal(slide.userData.anatomical_arm, 'right');
    assert.equal(slide.userData.muzzle_rest_position.length, 3); assert.equal(slide.userData.muzzle_rest_direction.length, 3);
    assert.equal(asset.animations.find(a => a.name === 'RocketFire')!.tracks.some(t => t.name.startsWith('CTRL_WaistYaw.')), false);
});

test('windup freezes travel and look, samples animated bore at 1.5s, releases once, then permits recoil locomotion and 3.5s release interval', async () => {
    const actor = await mounted(), camera = view(actor), position = actor.group.position.clone();
    actor.setPilotInput(1, false); actor.look(1, 0.3, 100); assert.equal(actor.requestRocket(), true);
    actor.look(-1, 0.7, 110); const yaw = actor.pilot.yaw, pitch = actor.pilot.pitch;
    advance(actor, 1.49); assert.ok(actor.group.position.equals(position)); assert.equal(actor.pilot.yaw, yaw); assert.equal(actor.pilot.pitch, pitch);
    assert.equal(actor.fireRocket(camera, [], empty), false); assert.equal(actor.pilot.rockets.activeCount, 0);
    advance(actor, 0.01); assert.equal(actor.fireRocket(camera, [], empty), true); assert.equal(actor.fireRocket(camera, [], empty), false);
    assert.equal(actor.pilot.cooldown, 2); assert.equal(actor.controlsFrozen, false); assert.ok(Math.abs(actor.pilot.rockets.radius - 0.95075) < 0.0001);
    const axis = new THREE.Vector3(0, 0, 1).transformDirection(actor.muzzleAnchor.matrixWorld);
    assert.ok(axis.angleTo(new THREE.Vector3(0, 0, 1)) < 0.00001); assert.ok(actor.muzzleAnchor.getWorldPosition(new THREE.Vector3()).x < -7);
    actor.look(-0.1, -0.2, 200); advance(actor, 0.3); assert.ok(actor.group.position.distanceTo(position) > 0); assert.ok(actor.pilot.yaw < yaw);
    const ankle = actor.group.getObjectByName('CTRL_Ankle_L')!.getWorldPosition(new THREE.Vector3()); assert.ok(ankle.y < 2, 'rocket layer leaves planted legs at ground height');
    advance(actor, 1.19); assert.equal(actor.requestRocket(), false); advance(actor, 0.51); assert.equal(actor.requestRocket(), true);
    advance(actor, 1.5); assert.equal(actor.fireRocket(camera, [], empty), true); assert.equal(actor.pilot.rockets.activeCount, 2);
    actor.dispose();
});

test('helmet transitions reverse continuously, layer over walking/recoil, hide only fully closed FP viewport, and defer windup toggles', async () => {
    const actor = await mounted(); const helmet = actor.group.getObjectByName('M_HelmetShell')!, hinge = actor.group.getObjectByName('CTRL_Helmet_Rear')!;
    actor.preparePilotView(true); assert.equal(helmet.visible, false); actor.restorePilotView(); actor.toggleHelmet(); assert.equal(actor.helmetClosed, false);
    actor.setPilotInput(1, false); advance(actor, 0.6); const hingePose = hinge.quaternion.clone(), position = actor.group.position.clone();
    assert.ok(Math.abs(actor.helmetProgress - 0.4) < 1e-8); actor.preparePilotView(true); assert.equal(helmet.visible, true); actor.restorePilotView();
    actor.toggleHelmet(); actor.update(0.001, absent); assert.ok(hinge.quaternion.angleTo(hingePose) < 0.01, 'reversal has no pose snap'); advance(actor, 0.41); assert.equal(actor.helmetClosed, true);
    assert.ok(actor.group.position.distanceTo(position) > 0); assert.equal(actor.targetingReady, false); advance(actor, 0.32);
    actor.requestRocket(); actor.toggleHelmet(); advance(actor, 1.5); assert.equal(actor.helmetClosed, true);
    actor.fireRocket(view(actor), [], empty); assert.equal(actor.helmetClosed, false); advance(actor, 0.7); assert.ok(actor.helmetProgress > 0.49);
    actor.toggleHelmet(); advance(actor, 0.6); assert.equal(actor.helmetClosed, true); actor.preparePilotView(false); assert.equal(helmet.visible, true); actor.restorePilotView(); actor.dispose();
});

test('pointer speed is frame/event-rate independent, world capped, settles within 100ms and clears on reset', () => {
    for (const hz of [30, 60, 120]) for (const inputHz of [60, 240]) {
        const pilot = new MechaPilot(); pilot.reset(0); let next = 0;
        for (let frame = 0; frame < hz; frame++) {
            while (next < (frame + 1) / hz - 1e-9) { pilot.look(1 / inputHz, 0, next * 1000); next += 1 / inputHz; }
            const old = pilot.yaw; pilot.update(1 / hz, new THREE.Vector3(), 0, 6.095, 0, (_start, end, _heading, out) => out.copy(end));
            assert.ok(pilot.yaw - old <= 0.366 / hz + 1e-9);
        }
        assert.ok(pilot.yaw > 0.3); pilot.update(0.1, new THREE.Vector3(), 0, 6.095, 0, (_start, end, _heading, out) => out.copy(end)); const stopped = pilot.yaw;
        pilot.update(1, new THREE.Vector3(), 0, 6.095, 0, (_start, end, _heading, out) => out.copy(end)); assert.equal(pilot.yaw, stopped);
        pilot.look(1, 0, 2000); pilot.clearLookMotion(); pilot.update(1, new THREE.Vector3(), 0, 6.095, 0, (_start, end, _heading, out) => out.copy(end)); assert.equal(pilot.yaw, stopped); pilot.dispose();
    }
    const pilot = new MechaPilot(); pilot.look(0.001, 0, 0); pilot.update(0.01, new THREE.Vector3(), 0, 1, 0, (_start, end, _heading, out) => out.copy(end)); assert.ok(pilot.yaw < 0.0003); pilot.dispose();
});

test('shared mouse/touch sample timestamps reach vehicle routing and windup discards both axes', async () => {
    const actor = await mounted(), camera = view(actor); const old = camera.quaternion.clone();
    setLookInputHandler((yaw, pitch, time) => { actor.look(yaw, pitch, time); return true; });
    try { applyLookInput(camera, 0.002, 0.1, -1, 1, 1234); actor.update(0.01, absent); assert.ok(actor.pilot.yaw > 0); assert.ok(camera.quaternion.equals(old));
        actor.requestRocket(); const yaw = actor.pilot.yaw; applyLookInput(camera, 0.2, 1, -1, 1, 1240); advance(actor, 0.3); assert.equal(actor.pilot.yaw, yaw); assert.equal(actor.pilot.pitch, 0.1);
    } finally { setLookInputHandler(null); actor.dispose(); }
});

test('piloted lava traversal preserves solids/border clearance, once-per-tick foot damage bypasses shield, pause and destruction cancel pending release', async () => {
    const pool = new THREE.Object3D(); pool.position.set(0, 0, 0);
    const actor = await mounted([pool]); actor.setPilotInput(0, true); advance(actor, 0.5); assert.equal(actor.combat.shieldActive, true); assert.equal(actor.hp, 49);
    actor.update(0, absent); assert.equal(actor.hp, 49); advance(actor, 1); assert.equal(actor.hp, 47, 'two feet do not double damage');
    actor.requestRocket(); actor.hp = 1; advance(actor, 0.5); assert.equal(actor.mode, 'destroying'); assert.equal(actor.fireRocket(view(actor), [], empty), false); assert.equal(actor.pilot.rockets.activeCount, 0); actor.dispose();
    const lava = [{ x: 0, z: 100, halfW: 8, halfD: 8, bottom: 0, top: 0.15 }];
    const solids = [{ x: 30, z: 100, halfW: 4, halfD: 4, bottom: 0, top: 30 }]; const nav = new MechaNavigation(solids, lava, 10, 20);
    assert.equal(nav.segmentClear({ x: 0, z: 80 }, { x: 0, z: 120 }), false); assert.equal(nav.segmentClear({ x: 0, z: 80 }, { x: 0, z: 120 }, true), true);
    assert.equal(nav.segmentClear({ x: 30, z: 80 }, { x: 30, z: 120 }, true), false); assert.equal(nav.segmentClear({ x: nav.limit, z: 0 }, { x: nav.limit + 1, z: 0 }, true), false);
});

test('real grapple binding accepts high cabin interior from ground, rejects armor and clamps low-rate pull arrival', async () => {
    const originalLoad = ForgottenMecha.prototype.load, originalDocument = globalThis.document;
    ForgottenMecha.prototype.load = async function () { this.install(await loadIronmawTestAsset()); };
    globalThis.document = { getElementById: () => null } as unknown as Document;
    state.scene = new THREE.Scene(); state.renderer = null; state.isMultiplayer = false; state.obstacles = []; state.targets = []; state.lavaPools = [];
    const camera = new THREE.PerspectiveCamera(75, 1, 0.1, 1000); state.camera = camera; state.controls = { getObject: () => camera } as unknown as typeof state.controls;
    state.leftGun = new THREE.Group(); camera.add(state.leftGun); state.hookMesh = new THREE.Group() as typeof state.hookMesh;
    try {
        await prepareForgottenMecha({ impact() {}, stompPlayer() {}, gameOver() {} }, async () => {});
        const actor = forgottenMecha!; actor.group.position.set(0, 0, 0); actor.group.rotation.y = 0; actor.damage(50); advance(actor, 6.1);
        const seat = actor.seatAnchor.getWorldPosition(new THREE.Vector3()); const interior = seat.clone(); interior.y += 3;
        camera.position.set(0, 2, 60); camera.lookAt(interior); camera.updateMatrixWorld(true);
        toggleGrapplingHook(); assert.ok(state.hookTargetCockpit === actor); assert.equal(state.hookIsEnemy, true);
        toggleGrapplingHook(); assert.equal(Boolean(state.hookTargetCockpit), false);
        camera.lookAt(seat.clone().add(new THREE.Vector3(6, 0, 0))); camera.updateMatrixWorld(true); toggleGrapplingHook(); assert.equal(Boolean(state.hookTargetCockpit), false); resetHook();
        camera.lookAt(interior); camera.updateMatrixWorld(true); toggleGrapplingHook(); assert.ok(state.hookTargetCockpit === actor); for (let i = 0; i < 10 && actor.mode === 'dead'; i++) updateHook(0.1);
        assert.equal(actor.mode, 'boarding'); assert.ok(camera.position.equals(seat)); assert.equal(state.hookState, 'IDLE');
    } finally { resetHook(); disposeWorld(); ForgottenMecha.prototype.load = originalLoad; globalThis.document = originalDocument; }
});

test('nearer static geometry rejects an otherwise valid open-cabin hit and completed startup preserves yellow eye through helmet and shield states', async () => {
    const wall = new THREE.Mesh(new THREE.BoxGeometry(30, 30, 1), new THREE.MeshBasicMaterial()); wall.position.set(0, 15, 30); wall.updateMatrixWorld(true);
    wall.userData = { halfW: 15, halfD: 0.5, halfH: 15, height: 30 };
    const asset = await loadIronmawTestAsset();
    const lens = asset.scene.getObjectByName('M_EyeLens') as THREE.SkinnedMesh; lens.material = new THREE.MeshStandardMaterial({name:'IRONMAW_Eye_State', emissiveIntensity:1.35});
    const actor = new ForgottenMecha([wall], [], 42); actor.install(asset); actor.group.position.set(0, 0, 0); actor.group.rotation.y = 0;
    actor.damage(50); advance(actor, 6.1); const seat = actor.seatAnchor.getWorldPosition(new THREE.Vector3()); const origin = new THREE.Vector3(0, 2, 60);
    const ray = new THREE.Ray(origin, seat.clone().sub(origin).normalize()); assert.equal(actor.cockpitHit(ray, 300), null);
    wall.position.x = 100; wall.updateMatrixWorld(true); assert.ok(actor.cockpitHit(ray, 300));
    actor.beginBoarding(seat, new THREE.Quaternion()); advance(actor, 2); assert.notEqual((lens.material as THREE.MeshStandardMaterial).color.getHex(), 0xffd34d);
    advance(actor, 6.3); assert.equal(actor.mode, 'piloted'); const material = lens.material as THREE.MeshStandardMaterial;
    assert.equal(material.color.getHex(), 0xffd34d); assert.equal(material.emissive.getHex(), 0xffd34d); assert.equal(material.emissiveIntensity, 1.35);
    actor.toggleHelmet(); actor.setPilotInput(0, true); advance(actor, 1); assert.equal(material.color.getHex(), 0xffd34d); assert.equal(actor.combat.shieldActive, true);
    actor.damage(50); actor.update(0.01, absent);
    assert.equal(material.emissiveIntensity, 0); actor.dispose(); wall.geometry.dispose(); (wall.material as THREE.Material).dispose();
});
