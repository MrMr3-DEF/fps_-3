import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { ForgottenMecha, type MechaEvents, type MechaPlayer } from '../src/forgottenMecha.ts';
import { MechaStomp, cyclePilotWeapon, isPilotWeapon, stompContact } from '../src/mechaStomp.ts';
import { MECHA_STOMP_IMPACT_TIME, MECHA_STOMP_DAMAGE, MECHA_STOMP_COOLDOWN } from '../src/config.ts';
import { loadIronmawTestAsset } from './ironmawTestAsset.ts';
import { deriveHudPresentation } from '../src/hudPresentation.ts';

const absent: MechaPlayer = { position: new THREE.Vector3(), alive: false, grounded: false };
const empty = (_x: number, _z: number, _ex: number, _ez: number, out: THREE.Object3D[]) => { out.length = 0; return out; };
function advance(a: ForgottenMecha, seconds: number, step = 1 / 60, player = absent) {
    for (let t = 0; t < seconds - 1e-9; t += step) a.update(Math.min(step, seconds - t), player);
}
async function robot(events: Partial<MechaEvents> = {}, lava: THREE.Object3D[] = []) {
    const a = new ForgottenMecha([], lava, 42, { impact() {}, stompPlayer() {}, gameOver() {}, ...events });
    a.install(await loadIronmawTestAsset()); a.group.position.set(0, 0, 0); a.group.rotation.y = 0; return a;
}
async function mounted(events: Partial<MechaEvents> = {}, lava: THREE.Object3D[] = []) {
    const a = await robot(events, lava); a.damage(50); advance(a, 6.1);
    a.beginBoarding(a.seatAnchor.getWorldPosition(new THREE.Vector3()), new THREE.Quaternion()); advance(a, 8.3);
    assert.equal(a.mode, 'piloted'); return a;
}
function cube(index: number, x: number, y: number, z: number, hp = 50) {
    const group = new THREE.Group(), body = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1));
    group.add(body); group.position.set(x, y, z); group.updateMatrixWorld(true);
    Object.assign(group.userData, { index, hp, maxHp: hp, bodyMesh: body, eliminationRevision: 0 }); return group;
}

test('shared stomp clock stops at contact and clip end and starts cooldown after the full clip', () => {
    const clock = new MechaStomp(); assert.equal(clock.start(), true); assert.equal(clock.start(), false);
    assert.equal(clock.step(5, 3.041666746), MECHA_STOMP_IMPACT_TIME);
    assert.deepEqual(clock.advance(MECHA_STOMP_IMPACT_TIME, 3.041666746), { impact: true, finished: false });
    clock.tick(100); assert.equal(clock.cooldown, 0);
    const remaining = clock.step(5, 3.041666746);
    assert.deepEqual(clock.advance(remaining, 3.041666746), { impact: false, finished: true });
    assert.equal(clock.cooldown, MECHA_STOMP_COOLDOWN); assert.equal(clock.start(), false);
    clock.tick(4.99); assert.equal(clock.start(), false); clock.tick(.01); assert.equal(clock.start(), true);
    clock.reset(); assert.equal(clock.active, false); assert.equal(clock.cooldown, 0);
    assert.equal(cyclePilotWeapon('rocket'), 'stomp'); assert.equal(cyclePilotWeapon('stomp'), 'rocket');
    assert.equal(isPilotWeapon('laser'), false); assert.equal(isPilotWeapon('stomp'), true);
    for (const radius of [24.999, 25, 25.001]) {
        assert.equal(stompContact({ x: 0, z: 0 }, { x: radius, z: 0 }, true, false), radius <= 25);
        assert.equal(stompContact({ x: 0, z: 0 }, { x: radius, z: 0 }, false, false), false);
        assert.equal(stompContact({ x: 0, z: 0 }, { x: radius, z: 0 }, false, true), true);
    }
});

test('enemy and playable stomp sample identical leg poses at frame 39 across rates and a large hitch', async () => {
    for (const step of [1 / 30, 1 / 60, 1 / 144, 2.4]) {
        const poses: number[][] = [], contacts: number[] = [];
        for (const piloted of [false, true]) {
            let a: ForgottenMecha;
            const events = { impact(kind: string) {
                if (kind !== 'stomp') return;
                contacts.push(a.stomp.elapsed);
                poses.push(['M_Foot_L', 'M_Foot_R', 'M_LowerLeg_L', 'M_LowerLeg_R'].flatMap(name =>
                    a.group.getObjectByName(name)!.matrixWorld.elements));
            } };
            a = piloted ? await mounted(events) : await robot(events);
            try {
                if (piloted) { a.selectPilotWeapon('stomp'); assert.equal(a.requestAttack(), true); }
                advance(a, 2.5, step, piloted ? absent : { position: new THREE.Vector3(0, 2, 20), alive: true, grounded: true });
                assert.equal(a.mode, piloted ? 'piloted' : 'stomping');
                assert.equal(a.stomp.active, true); assert.equal(a.stomp.cooldown, 0);
                advance(a, 0.55, step, absent); assert.equal(a.stomp.active, false);
                assert.ok(Math.abs(a.stomp.cooldown - (5 - (3.05 - 3.041666746))) < .001);
            } finally { a.dispose(); }
        }
        assert.equal(contacts.length, 2); assert.ok(contacts.every(t => Math.abs(t - 1.625) < 1e-8));
        assert.ok(poses[0].every((n, i) => Math.abs(n - poses[1][i]) < 1e-5), `leg poses diverged at ${step}`);
    }
});

test('piloted contact damages each player/NPC once, preserves grounding rules and credits the pilot', async () => {
    const hits: string[] = [], amounts: number[] = [], owners: (string | null | undefined)[] = [];
    const a = await mounted({ playerHit(p, damage, attack, owner) { assert.equal(attack, 'stomp'); hits.push(p.peerId!); amounts.push(damage); owners.push(owner); } });
    const targets = [cube(0, 20, .5, 0), cube(1, 25, .5, 0), cube(2, 25.001, .5, 0), cube(3, 20, 4, 0), cube(4, 20, .5, 0, 10), cube(5, 0, 20, 0)];
    const npcHits: number[] = [];
    a.networked = true; a.pilotPeerId = 'pilot'; a.pilotLifeId = 1;
    const players: MechaPlayer[] = [
        { peerId: 'pilot', lifeId: 1, position: new THREE.Vector3(0, 2, 10), grounded: true, alive: true },
        ...['one', 'two'].map((peerId, i) => ({ peerId, lifeId: 2, position: new THREE.Vector3(25 - i, 2, 0), grounded: true, alive: true })),
        { peerId: 'jumping', lifeId: 2, position: new THREE.Vector3(20, 4, 0), grounded: false, alive: true },
        { peerId: 'elevated', lifeId: 2, position: new THREE.Vector3(20, 12, 0), grounded: false, alive: true },
        { peerId: 'outside', lifeId: 2, position: new THREE.Vector3(25.001, 2, 0), grounded: true, alive: true },
    ];
    a.setStompTargets(targets, (index, damage) => { npcHits.push(index); targets[index].userData.hp -= damage; });
    try {
        a.selectPilotWeapon('stomp'); a.requestAttack();
        a.updatePlayers(1.624, players); assert.equal(hits.length, 0); assert.equal(npcHits.length, 0);
        // A floating cube and airborne bean physically touching an animated leg
        // still receive contact damage. Reuse the exact-impact pose from a copy.
        const copy = await mounted(); copy.selectPilotWeapon('stomp'); copy.requestAttack(); copy.update(1.625, absent);
        const leg = copy.colliders.find(c => c.name.endsWith('-M_LowerLeg_R'))!;
        targets[5].position.copy(leg.position); targets[5].updateMatrixWorld(true);
        players.push({ peerId: 'leg', lifeId: 3, position: leg.position.clone().add(new THREE.Vector3(0, 1.1, 0)), alive: true, grounded: false }); copy.dispose();
        a.updatePlayers(.001, players); assert.deepEqual(hits.sort(), ['leg', 'one', 'two']);
        assert.ok(amounts.every(n => n === MECHA_STOMP_DAMAGE)); assert.ok(owners.every(id => id === 'pilot'));
        assert.deepEqual(npcHits, [0, 1, 4, 5]); assert.equal(targets[0].userData.hp, 40); assert.equal(targets[4].userData.hp, 0);
        a.updatePlayers(1.4, players); assert.equal(hits.length, 3); assert.equal(npcHits.length, 4); assert.equal(a.hp, 50);
    } finally { a.dispose(); for (const target of targets) { target.userData.bodyMesh.geometry.dispose(); target.userData.bodyMesh.material.dispose(); } }
});

test('stomp freezes travel and legs, keeps capped looking/helmet/shield and gameplay HUD, and owns its cooldown', async () => {
    const a = await mounted();
    try {
        a.pilot.cooldown = 1; a.selectPilotWeapon('stomp'); assert.equal(a.requestAttack(), true);
        a.setPilotInput(1, true); a.look(1, .3, 100); a.toggleHelmet();
        const start = a.group.position.clone(), heading = a.group.rotation.y;
        advance(a, .5); assert.ok(a.group.position.equals(start)); assert.equal(a.group.rotation.y, heading);
        assert.ok(a.pilot.yaw > 0 && a.pilot.yaw <= .366 * .05 + 1e-8); assert.equal(a.pilot.pitch, .3);
        assert.ok(a.helmetProgress > 0); assert.equal(a.combat.shieldActive, true);
        a.selectPilotWeapon('rocket'); assert.equal(a.requestAttack(), false); assert.equal(a.reloadProgress, 0);
        assert.equal(a.requestStomp(), false); const paused = a.stomp.elapsed; a.update(0, absent); assert.equal(a.stomp.elapsed, paused);
        advance(a, 2.55); assert.equal(a.pilot.cooldown, 0); assert.ok(a.stomp.cooldown > 4.98);
        assert.equal(a.requestRocket(), true); a.selectPilotWeapon('stomp'); assert.equal(a.requestStomp(), false);
        advance(a, 1.5); const camera = new THREE.PerspectiveCamera(); camera.position.copy(a.pilot.cameraPosition); camera.quaternion.copy(a.pilot.cameraQuaternion);
        assert.equal(a.fireRocket(camera, [], empty), true); assert.equal(a.pilot.cooldown, 2);
        advance(a, 1.5); const cooldown = a.stomp.cooldown;
        a.selectPilotWeapon('rocket'); a.selectPilotWeapon('stomp'); assert.equal(a.stomp.cooldown, cooldown);
        advance(a, cooldown); assert.equal(a.requestStomp(), true);
        const context = { runtime: true, playing: true, input: true, alive: true, ended: false, conversation: false, loading: false, reveal: false, editor: false,
            scoped: false, thirdPerson: false, touch: false, showFps: true, multiplayer: false,
            pilot: { mode: a.mode, phase: a.headView.phase, blackout: a.headView.blackout, hudOpacity: a.hudOpacity, targetingReady: a.targetingReady } };
        assert.equal(deriveHudPresentation(context).ordinary, true);
        assert.equal(deriveHudPresentation({ ...context, input: false }).ordinary, false);
        assert.equal(deriveHudPresentation({ ...context, loading: true }).ordinary, false);
    } finally { a.dispose(); }
});

test('exit waits for committed stomp or rocket recovery; destruction and ownership loss cancel unfinished attacks', async () => {
    for (const kind of ['stomp', 'rocket'] as const) {
        let impacts = 0; const a = await mounted({ impact(k) { if (k === 'stomp') impacts++; } });
        try {
            a.selectPilotWeapon(kind); a.requestAttack(); assert.equal(a.requestExit(), true); assert.equal(a.requestExit(), false);
            assert.equal(a.mode, 'piloted'); assert.equal(a.requestAttack(), false);
            advance(a, kind === 'stomp' ? 3.03 : 1.5); assert.equal(a.mode, 'piloted');
            if (kind === 'rocket') assert.equal(a.fireRocket(new THREE.PerspectiveCamera(), [], empty), true);
            advance(a, kind === 'stomp' ? .02 : 1.5); assert.equal(a.mode, 'shutting-down');
            assert.equal(impacts, kind === 'stomp' ? 1 : 0); advance(a, 10); assert.equal(a.canMount, true);
            a.beginBoarding(a.seatAnchor.getWorldPosition(new THREE.Vector3()), new THREE.Quaternion()); advance(a, 8.3);
            assert.equal(a.pilotWeapon, 'rocket'); assert.equal(a.stomp.cooldown, 0);
        } finally { a.dispose(); }
    }
    for (const cancel of ['destroy', 'ownership', 'dispose'] as const) {
        let impacts = 0; const a = await mounted({ impact(k) { if (k === 'stomp') impacts++; } });
        a.selectPilotWeapon('stomp'); a.requestAttack(); advance(a, 1);
        if (cancel === 'destroy') a.damage(50); else if (cancel === 'ownership') a.abandonPilot(); else a.dispose();
        advance(a, 2); assert.equal(a.stomp.active, false); assert.equal(impacts, 0); assert.equal(a.requestStomp(), false); a.dispose();
    }
});

test('lethal lava precedes a later stomp contact even when one frame crosses both events', async () => {
    let impacts = 0; const pool = new THREE.Object3D();
    const a = await mounted({ impact(kind) { if (kind === 'stomp') impacts++; } }, [pool]);
    try {
        a.hp = 1; a.selectPilotWeapon('stomp'); assert.equal(a.requestAttack(), true);
        a.update(2.5, absent); assert.equal(a.mode, 'destroying'); assert.equal(impacts, 0); assert.equal(a.stomp.active, false);
    } finally { a.dispose(); }
});
