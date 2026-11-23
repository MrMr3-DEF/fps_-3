import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { ForgottenMecha } from '../src/forgottenMecha.ts';
import { loadIronmawTestAsset } from './ironmawTestAsset.ts';
import { MechaPilot } from '../src/mechaPilot.ts';
import { MechaCombat } from '../src/mechaCombat.ts';
import { applyLookInput, setLookInputHandler } from '../src/lookInput.ts';
import { attachPlayerAvatar } from '../src/playerAvatar.ts';
import { loadCyborgTestAssets, visitArmorVertices } from './cyborgTestAsset.ts';
import { updateHook } from '../src/grapple.ts';
import { state } from '../src/state.ts';
import { playerTouchesWorldBox } from '../src/playerHitbox.ts';
import { MECHA_PILOT_LEG_TURN_SPEED, MECHA_PILOT_SPEED_MULTIPLIER, MECHA_PILOT_TORSO_YAW_SPEED, MECHA_LEG_TURN_SPEED, MECHA_TORSO_YAW_SPEED } from '../src/config.ts';

const absent = { position: new THREE.Vector3(), alive: false, grounded: false };
function advance(actor: ForgottenMecha, seconds: number) { for (let t = 0; t < seconds - 1e-9; t += 1 / 60) actor.update(Math.min(1 / 60, seconds - t), absent); }
async function robot(onDeath = () => {}) {
    const actor = new ForgottenMecha([], [], 42, { impact() {}, stompPlayer() {}, gameOver() {}, pilotReleased: onDeath });
    actor.install(await loadIronmawTestAsset()); actor.group.position.set(0, 0, 0); actor.group.rotation.y = 0; return actor;
}
async function defeated() { const actor = await robot(); actor.damage(50); advance(actor, 6.05); return actor; }

test('only the completed defeated cockpit accepts a front interior ray; armor, rear, excessive range and startup reject it', async () => {
    const actor = await robot(); const aim = new THREE.Ray(new THREE.Vector3(0, 10, 30), new THREE.Vector3(0, 0, -1));
    assert.equal(actor.cockpitHit(aim, 300), null); actor.combat.shieldPhase = 'down'; assert.equal(actor.canMount, false);
    actor.damage(50); advance(actor, 5); assert.equal(actor.cockpitHit(aim, 300), null); advance(actor, 1.1);
    const seat = actor.seatAnchor.getWorldPosition(new THREE.Vector3()); aim.origin.copy(seat).z += 25;
    assert.ok(actor.cockpitHit(aim, 300)); assert.equal(actor.cockpitHit(aim, 10), null);
    aim.origin.x = 4; assert.equal(actor.cockpitHit(aim, 300), null);
    aim.origin.copy(seat).z -= 20; aim.direction.z = 1; assert.equal(actor.cockpitHit(aim, 300), null);
    assert.equal(actor.beginBoarding(seat, new THREE.Quaternion()), true); assert.equal(actor.canMount, false);
    assert.equal(actor.damage(10).accepted, false); assert.equal(actor.beginBoarding(seat, new THREE.Quaternion()), false); actor.dispose();
});

test('boarding eases for 0.45s, plays full Mount and protected boot/reveal, and separates seat from the actual eye', async () => {
    const actor = await defeated(); const seat = actor.seatAnchor.getWorldPosition(new THREE.Vector3()); actor.beginBoarding(seat, new THREE.Quaternion());
    actor.update(0.2, absent); assert.equal(actor.mode, 'boarding'); assert.ok(actor.pilot.cameraPosition.distanceTo(seat) > 0);
    advance(actor, 0.25); assert.equal(actor.mode, 'startup'); assert.equal(actor.combat.shieldActive, false);
    const helmet = actor.group.getObjectByName('M_HelmetShell')!;
    actor.preparePilotView(true); assert.equal(helmet.visible, true); actor.restorePilotView(); advance(actor, 1.9);
    actor.preparePilotView(true); assert.equal(helmet.visible, false); actor.restorePilotView(); assert.equal(helmet.visible, true);
    advance(actor, 5.15); assert.equal(actor.mode, 'startup'); assert.equal(actor.headView.phase, 'hud');
    assert.equal(actor.headView.loadingProgress, 1); assert.equal(actor.damage(50).accepted, false); assert.equal(actor.requestRocket(), false);
    advance(actor, 0.39); assert.equal(actor.headView.phase, 'hud'); advance(actor, 0.02); assert.equal(actor.headView.phase, 'reveal');
    advance(actor, 0.3); assert.equal(actor.mode, 'piloted'); assert.equal(actor.targetingReady, true);
    const mountedSeat = actor.seatAnchor.getWorldPosition(new THREE.Vector3()); assert.ok(actor.pilot.cameraPosition.y - mountedSeat.y > 5);
    assert.ok(Math.abs(actor.pilot.cameraPosition.y - 23.309739) < 0.001); assert.equal(actor.hp, 50); assert.equal(actor.combat.energy, 1);
    actor.preparePilotView(false); assert.equal(helmet.visible, true); actor.restorePilotView(); actor.dispose();
});

test('full-size pilot settles onto the cushion and clears the moving cockpit armor', async () => {
    await loadCyborgTestAssets();
    const actor = await defeated(), pilot = new THREE.Group(), avatar = attachPlayerAvatar(pilot, 0x55cc33)!;
    const standingScale = avatar.rig.root.getWorldScale(new THREE.Vector3());
    actor.beginBoarding(actor.seatAnchor.getWorldPosition(new THREE.Vector3()), new THREE.Quaternion());
    const triangle = new THREE.Triangle(), inverse = new THREE.Matrix4(), pilotBox = new THREE.Box3();
    const verify = () => {
        if (!actor.ownsPilot) return;
        actor.placePilot(pilot);
        avatar.update(1 / 24, { weapon:'AR', alive:true, lifeId:1, grounded:false, hover:false, hook:'IDLE',
            velocity:absent.position, yaw:0, pitch:0, pilot:actor.pilotAvatarPhase, pilotProgress:actor.pilotAvatarProgress });
        pilot.updateWorldMatrix(true, true);
        assert.ok(avatar.rig.root.getWorldScale(new THREE.Vector3()).distanceTo(standingScale) < 1e-5);
        inverse.copy(pilot.matrixWorld).invert();
        // The pan and backrest are two convex rigid pieces within the cavity mesh.
        // Test the deformed suit against their faces; the space between the boots is empty.
        const solids = new Map<string, THREE.Plane[]>();
        const readTriangle = (mesh: THREE.SkinnedMesh, i: number) => {
            const index = mesh.geometry.index!;
            for (const [offset, point] of [[0,triangle.a], [1,triangle.b], [2,triangle.c]] as const)
                mesh.getVertexPosition(index.getX(i + offset), point).applyMatrix4(mesh.matrixWorld).applyMatrix4(inverse);
        };
        for (const name of ['M_UpperTorso_Cavity', 'M_Abdomen']) {
            const mesh = actor.group.getObjectByName(name) as THREE.SkinnedMesh, index = mesh.geometry.index!;
            for (let i=0; i<index.count; i+=3) {
                const bone = mesh.skeleton.bones[mesh.geometry.attributes.skinIndex.getX(index.getX(i))].name;
                if (name === 'M_UpperTorso_Cavity' && !['PART_UpperTorso_Cavity_20','PART_UpperTorso_Cavity_19'].includes(bone)) continue;
                let faces = solids.get(bone);
                if (!faces) solids.set(bone, faces = []);
                readTriangle(mesh, i);
                const plane = triangle.getPlane(new THREE.Plane());
                if (!faces.some(p => p.normal.dot(plane.normal) > .999)) faces.push(plane);
            }
        }
        const pan = solids.get('PART_UpperTorso_Cavity_20');
        let support = Infinity, penetration = 0;
        pilotBox.makeEmpty();
        visitArmorVertices(pilot, (point, bone) => {
            pilotBox.expandByPoint(point);
            for (const faces of solids.values()) {
                let separation = -Infinity;
                for (const plane of faces) separation = Math.max(separation, plane.distanceToPoint(point));
                penetration = Math.min(penetration, separation);
                if (faces === pan && /^(thigh|pelvis)/.test(bone)) support = Math.min(support, separation);
            }
        });
        assert.ok(penetration > -.045, `pilot goes through chair during ${actor.pilotAvatarPhase} at ${actor.pilotAvatarProgress}: ${penetration}`);
        if (actor.pilotAvatarPhase === 'Seated') assert.ok(support < .045, 'hips or thighs rest on the cushion');
        for (const name of ['M_ChestDoor_L', 'M_ChestDoor_R', 'M_HelmetShell', 'M_EyeLens']) {
            const mesh = actor.group.getObjectByName(name) as THREE.SkinnedMesh;
            for (let i=0; i<mesh.geometry.index!.count; i+=3) {
                readTriangle(mesh, i);
                assert.equal(pilotBox.intersectsTriangle(triangle), false, `${name} clips pilot during ${actor.mode}`);
            }
        }
    };
    const sample = (seconds: number) => {
        for (let t=0; t<seconds-1e-9; t+=1/12) { advance(actor, Math.min(1/12, seconds-t)); verify(); }
    };
    verify(); sample(8.3);
    actor.toggleHelmet(); sample(1.4); actor.toggleHelmet(); sample(1.4);
    actor.requestRocket();
    const camera = new THREE.PerspectiveCamera();
    for (let t=0; t<3.2; t+=.1) {
        advance(actor, .1);
        actor.fireRocket(camera, [], (_sx, _sz, _ex, _ez, out) => { out.length = 0; return out; });
        verify();
    }
    assert.equal(actor.requestExit(), true); sample(8);
    assert.equal(actor.canMount, true);
    actor.dispose(); assert.equal(pilot.parent, null); avatar.dispose();
});

test('mounted destruction releases the living pilot at immediate breakup, then finishes independently without remounting', async () => {
    let releases = 0; const actor = await robot(() => releases++); actor.damage(50); advance(actor, 6.1);
    actor.beginBoarding(actor.seatAnchor.getWorldPosition(new THREE.Vector3()), new THREE.Quaternion()); advance(actor, 8.3);
    actor.damage(50); assert.equal(actor.mode, 'destroying'); assert.equal(actor.combat.shieldActive, false); assert.equal(actor.pilot.rockets.activeCount, 0);
    assert.equal(releases, 1); assert.equal(actor.ownsPilot, false); assert.equal(actor.pilotVisible, false); assert.equal(actor.solidColliders.length, 0);
    assert.equal(actor.animationTime, 1.25); const view = actor.pilot.cameraPosition.clone();
    advance(actor, 3.7); assert.equal(actor.mode, 'destroying'); assert.deepEqual(actor.pilot.cameraPosition.toArray(), view.toArray());
    advance(actor, 0.1); assert.equal(actor.mode, 'destroyed'); assert.equal(releases, 1); advance(actor, 20); assert.equal(releases, 1); assert.equal(actor.canMount, false); actor.dispose();
});

test('cockpit enemy pull clamps a stalled-frame arrival to the exact seat and releases its grapple ownership', async () => {
    const actor = await defeated(), camera = new THREE.PerspectiveCamera(); const seat = actor.seatAnchor.getWorldPosition(new THREE.Vector3());
    const oldDocument = globalThis.document, oldControls = state.controls;
    globalThis.document = { getElementById: () => null } as unknown as Document;
    state.controls = { getObject: () => camera } as unknown as typeof state.controls;
    state.hookTargetCockpit = actor; state.hookState = 'PULLING'; state.hookIsEnemy = true; state.hookWillHit = true;
    camera.position.copy(seat).z += 10;
    try {
        updateHook(0); assert.equal(actor.mode, 'dead'); updateHook(0.05);
        assert.deepEqual(camera.position.toArray(), seat.toArray()); assert.equal(actor.mode, 'boarding'); assert.equal(state.hookState, 'IDLE'); assert.equal(state.hookTargetCockpit, null); assert.equal(state.velocity.length(), 0);
    } finally { globalThis.document = oldDocument; state.controls = oldControls; actor.dispose(); }
});

test('world torso yaw remains capped while legs align, walk, reverse and respect 12m radius and blocked destinations', () => {
    const pilot = new MechaPilot(), position = new THREE.Vector3(); pilot.reset(0); pilot.look(Math.PI / 2, 0.2);
    let heading = 0, previousYaw = 0;
    for (let i = 0; i < 300; i++) {
        const before = position.clone(); const move = pilot.update(1 / 60, position, heading, 6.095, 1, (_start, end, _heading, out) => out.copy(end));
        assert.ok(Math.abs(pilot.yaw - previousYaw) <= MECHA_PILOT_TORSO_YAW_SPEED / 60 + 1e-9);
        if (move.clip === 'Walk' && before.distanceTo(position) > 0) assert.ok(Math.abs(move.heading - heading) <= before.distanceTo(position) / 12 + 1e-9);
        heading = move.heading; previousYaw = pilot.yaw;
    }
    assert.ok(position.length() > 10); const before = position.clone(); const reverse = pilot.update(0.05, position, heading, 6.095, -1, (_start, end, _heading, out) => out.copy(end));
    assert.equal(reverse.clip, 'Walk'); assert.ok(reverse.rate < 0); assert.ok(position.clone().sub(before).dot(new THREE.Vector3(Math.sin(heading), 0, Math.cos(heading))) < 0);
    const blocked = position.clone(); const move = pilot.update(0.05, position, heading, 6.095, -1, (start, _end, _heading, out) => out.copy(start)); assert.equal(move.clip, 'Idle'); assert.deepEqual(position.toArray(), blocked.toArray()); pilot.dispose();
});

test('mounted walking, torso turn and leg catch-up run 50% faster while the enemy actor keeps base speed', async () => {
    assert.equal(MECHA_PILOT_SPEED_MULTIPLIER, 1.5);
    assert.equal(MECHA_PILOT_TORSO_YAW_SPEED, MECHA_TORSO_YAW_SPEED * MECHA_PILOT_SPEED_MULTIPLIER);
    assert.equal(MECHA_PILOT_LEG_TURN_SPEED, MECHA_LEG_TURN_SPEED * MECHA_PILOT_SPEED_MULTIPLIER);
    const actor = new ForgottenMecha([], [], 42, { impact() {}, stompPlayer() {}, gameOver() {} });
    actor.install(await loadIronmawTestAsset());
    try {
        // Unmounted enemy locomotion still integrates against this.speed only.
        const spawn = actor.group.position.clone(); advance(actor, 1);
        const enemyDistance = actor.group.position.distanceTo(spawn);
        assert.ok(enemyDistance > 3 && enemyDistance <= actor.speed + 1e-5);
        actor.group.position.set(0, 0, 0); actor.group.rotation.y = 0;
        actor.damage(50); advance(actor, 6.1);
        actor.beginBoarding(actor.seatAnchor.getWorldPosition(new THREE.Vector3()), new THREE.Quaternion()); advance(actor, 8.3);
        assert.equal(actor.mode, 'piloted');
        actor.setPilotInput(1, false); advance(actor, 1);
        const start = actor.group.position.clone(), phase = (actor as any).phase;
        advance(actor, 0.5);
        assert.ok(Math.abs(actor.group.position.distanceTo(start) - actor.speed * MECHA_PILOT_SPEED_MULTIPLIER * 0.5) < 0.05);
        assert.equal((actor as any).locomotion, 'Walk');
        assert.ok(Math.abs((actor as any).action!.getEffectiveTimeScale() - MECHA_PILOT_SPEED_MULTIPLIER) < 1e-9);
        const advanced = (((actor as any).phase - phase) % 1 + 1) % 1;
        assert.ok(Math.abs(advanced - 0.5 * MECHA_PILOT_SPEED_MULTIPLIER / (4 / 3)) < 1e-6, 'animation phase matches the faster clip rate');
    } finally { actor.dispose(); }
    const pilot = new MechaPilot(); pilot.look(Math.PI, 0, 0);
    pilot.update(0.05, new THREE.Vector3(), 0, 6.095, 0, (_start, end, _heading, out) => out.copy(end));
    assert.ok(Math.abs(pilot.yaw - MECHA_PILOT_TORSO_YAW_SPEED * 0.05) < 1e-9);
    assert.ok(pilot.yaw > MECHA_TORSO_YAW_SPEED * 0.05);
    pilot.reset(0); pilot.yaw = Math.PI / 2;
    const step = 1 / 60, position = new THREE.Vector3();
    const move = pilot.update(step, position, 0, 6.095, 1, (_start, end, _heading, out) => out.copy(end));
    const firstFrameRate = step / 0.4;
    assert.equal(move.clip, 'TurnRight');
    assert.ok(Math.abs(move.heading - MECHA_PILOT_LEG_TURN_SPEED * step * firstFrameRate) < 1e-9);
    assert.ok(move.heading > MECHA_LEG_TURN_SPEED * step * firstFrameRate, 'legs align at the mounted rate from standstill');
    pilot.dispose();
});

test('manual shield requires full build, reverses partially, recharges immediately, and exhausts without automatic reactivation', () => {
    const combat = new MechaCombat(); combat.enterManualShield(); combat.updateManualShield(0.25, true); assert.equal(combat.shieldActive, false); assert.equal(combat.manualBuild, 0.5);
    const energy = combat.energy; combat.updateManualShield(0.1, false); assert.ok(combat.energy > energy); assert.ok(Math.abs(combat.manualBuild - 0.3) < 1e-9);
    combat.updateManualShield(0.35, true); assert.equal(combat.shieldActive, true); assert.equal(combat.frozen, false);
    combat.updateManualShield(5, true); assert.equal(combat.shieldActive, false); assert.equal(combat.energy, 0);
    combat.updateManualShield(3, true); assert.equal(combat.energy, 1); assert.equal(combat.shieldActive, false);
    combat.updateManualShield(0.01, false); combat.updateManualShield(0.5, true); assert.equal(combat.shieldActive, true);
    combat.shieldCenter.set(0, 14, 0); assert.ok(combat.shieldContactT(new THREE.Vector3(0, 14, 30), new THREE.Vector3(0, 14, 0), new THREE.Vector3(0, 14, 30)) !== null);
    assert.equal(combat.shieldContactT(new THREE.Vector3(0, 14, 3), new THREE.Vector3(0, 14, 30), new THREE.Vector3(0, 14, 3)), null);
    const clock = combat.clock, fuel = combat.energy; combat.updateManualShield(0, true); assert.equal(combat.clock, clock); assert.equal(combat.energy, fuel);
    combat.updateManualShield(0.01, false); assert.equal(combat.shieldActive, false); assert.ok(combat.manualBuild > 0); combat.dispose();
});

test('shared look routing retains vehicle intent without changing actual view and restores normal camera input', () => {
    const camera = new THREE.PerspectiveCamera(); const pilot = new MechaPilot(); setLookInputHandler((yaw, pitch) => { pilot.look(yaw, pitch); return true; });
    applyLookInput(camera, 1, 0.2); pilot.update(0.01, new THREE.Vector3(), 0, 6.095, 0, (_start, end, _heading, out) => out.copy(end)); assert.ok(pilot.yaw > 0 && pilot.yaw <= MECHA_PILOT_TORSO_YAW_SPEED * 0.01); assert.ok(camera.quaternion.equals(new THREE.Quaternion()));
    setLookInputHandler(null); applyLookInput(camera, 0.5, 0.2); assert.ok(camera.quaternion.angleTo(new THREE.Quaternion()) > 0.5); pilot.dispose();
});

test('exit closes a folding helmet, reverses Mount behind shutdown bar and releases once before remounting', async () => {
    let releases = 0; const actor = await robot(() => releases++);
    assert.equal(actor.requestExit(), false); actor.damage(50); advance(actor, 6.1);
    actor.beginBoarding(actor.seatAnchor.getWorldPosition(new THREE.Vector3()), new THREE.Quaternion());
    assert.equal(actor.requestExit(), false); advance(actor, 8.3);
    actor.toggleHelmet(); advance(actor, 0.7); assert.ok(actor.helmetProgress > 0);
    assert.equal(actor.requestExit(), true); assert.equal(actor.requestExit(), false);
    assert.equal(actor.damage(50).accepted, false); assert.equal(actor.requestRocket(), false); assert.equal(actor.targetingReady, false);
    advance(actor, 2); assert.equal(actor.mode, 'shutting-down'); assert.equal(actor.headView.phase, 'shutdown');
    assert.ok(actor.headView.loadingProgress > 0 && actor.headView.loadingProgress < 1);
    const clock = actor.animationTime, progress = actor.headView.loadingProgress;
    actor.update(0, absent); assert.equal(actor.animationTime, clock); assert.equal(actor.headView.loadingProgress, progress);
    advance(actor, 7); assert.equal(releases, 1); assert.equal(actor.ownsPilot, false); assert.equal(actor.canMount, true);
    advance(actor, 1); assert.equal(releases, 1);
    assert.equal(actor.beginBoarding(actor.seatAnchor.getWorldPosition(new THREE.Vector3()), new THREE.Quaternion()), true);
    advance(actor, 8.3); assert.equal(actor.mode, 'piloted'); assert.equal(actor.hp, 50); assert.equal(actor.combat.energy, 1); actor.dispose();
});

test('shutdown reverses goggles before Mount and finds a safe side release when a wall blocks the front', async () => {
    const wall = new THREE.Mesh(new THREE.BoxGeometry(60, 60, 2), new THREE.MeshBasicMaterial());
    wall.userData = { halfW: 30, halfH: 30, halfD: 1, height: 60 }; wall.position.set(0, 30, 10); wall.updateMatrixWorld(true);
    let release: THREE.Vector3 | null = null, releases = 0;
    const actor = new ForgottenMecha([wall], [], 42, { impact() {}, stompPlayer() {}, gameOver() {}, pilotReleased: pose => { release = pose.position.clone(); releases++; } });
    actor.install(await loadIronmawTestAsset()); actor.group.position.set(0, 0, 0); actor.group.rotation.y = 0;
    try {
        actor.damage(50); advance(actor, 6.1); actor.beginBoarding(actor.seatAnchor.getWorldPosition(new THREE.Vector3()), new THREE.Quaternion()); advance(actor, 8.3);
        actor.requestExit(); advance(actor, 0.15);
        assert.equal(actor.headView.phase, 'shutdown-reveal'); assert.ok(Math.abs(actor.headView.revealProgress - 0.5) < 1e-8);
        const standingTime = (actor as any).action.time;
        advance(actor, 0.35); assert.equal(actor.headView.phase, 'shutdown-hud'); assert.ok(Math.abs(actor.headView.hudOpacity - 0.5) < 1e-8);
        assert.equal((actor as any).action.time, standingTime, 'reverse clip waits for reversed goggles');
        advance(actor, 0.3); assert.equal(actor.headView.phase, 'shutdown'); assert.ok((actor as any).action.time < standingTime);
        advance(actor, 8); assert.equal(actor.mode, 'dead'); assert.equal(actor.canMount, true); assert.equal(releases, 1); assert.ok(release);
        for (const object of [wall, ...actor.colliders]) {
            const d = object.userData, hh = d.halfH ?? d.height / 2;
            assert.equal(playerTouchesWorldBox(release!, Math.PI, new THREE.Vector3(object.position.x - d.halfW, object.position.y - hh, object.position.z - d.halfD),
                new THREE.Vector3(object.position.x + d.halfW, object.position.y + hh, object.position.z + d.halfD), 0.1), false);
        }
        advance(actor, 1); assert.equal(releases, 1);
    } finally { actor.dispose(); wall.geometry.dispose(); (wall.material as THREE.Material).dispose(); }
});

test('a fully blocked real-asset exit returns control and can retry after the obstruction moves', async () => {
    const enclosure = new THREE.Object3D();
    enclosure.userData = { halfW: 80, halfD: 80, halfH: 40, height: 80 };
    enclosure.position.set(500, 20, 0);
    let releases = 0, blocked = 0;
    const actor = new ForgottenMecha([enclosure], [], 42, { impact() {}, stompPlayer() {}, gameOver() {},
        pilotReleased() { releases++; }, exitBlocked() { blocked++; } });
    actor.install(await loadIronmawTestAsset()); actor.group.position.set(0, 0, 0); actor.group.rotation.y = 0;
    try {
        actor.damage(50); advance(actor, 6.1);
        actor.beginBoarding(actor.seatAnchor.getWorldPosition(new THREE.Vector3()), new THREE.Quaternion()); advance(actor, 8.3);
        const energy = actor.combat.energy = 0.4;
        actor.pilot.pitch = 0.2;
        assert.equal(actor.requestExit(), true);
        enclosure.position.x = 0; // The final check must see a new obstruction.
        advance(actor, 9);
        assert.equal(actor.mode, 'piloted');
        assert.equal(actor.controlsFrozen, false);
        assert.equal(actor.targetingReady, true);
        assert.equal(actor.pilot.pitch, 0.2);
        assert.equal(blocked, 1); assert.equal(releases, 0);
        assert.ok(actor.combat.energy >= energy, 'cancellation preserves rather than refills shield fuel');
        assert.ok(actor.combat.energy < 1);
        assert.equal(actor.requestExit(), false, 'a preflight failure does not start another shutdown');
        assert.equal(actor.mode, 'piloted'); assert.equal(blocked, 2);
        enclosure.position.x = 500;
        assert.equal(actor.requestExit(), true);
        advance(actor, 8);
        assert.equal(actor.mode, 'dead'); assert.equal(releases, 1);
        advance(actor, 3); assert.equal(releases, 1);
    } finally { actor.dispose(); }
});
