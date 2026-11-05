import { katanaEmission } from '../src/katanaFlicker.ts';
import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { KatanaClock, katanaBoxContacts } from '../src/katanaCombat.ts';
import { KATANA } from '../src/config.ts';
import { parseNetworkPacket } from '../src/networkTypes.ts';
import { buildKatana, updateKatanaModel } from '../src/katanaModel.ts';
const pose = { origin: new THREE.Vector3(), rotation: new THREE.Quaternion() };
const box = new THREE.Box3(new THREE.Vector3(-.1, -.1, -.1), new THREE.Vector3(.1, .1, .1));
const hits = (x: number, y: number, z: number, r = KATANA.radius, p = pose) => katanaBoxContacts(box, new THREE.Matrix4().makeTranslation(x, y, z), p, r, 1.65).length > 0;
test('tap, partial, exact full charge and indefinite hold have discrete power', () => {
    for (const [duration, charged] of [[0, false], [2.999, false], [3, true], [90, true]] as const) {
        const clock = new KatanaClock();
        assert.equal(clock.begin(0), true);
        assert.equal(clock.begin(1), false);
        assert.equal(clock.release(duration), true);
        assert.equal(clock.charged, charged);
        assert.equal(clock.release(duration), false);
    }
});
test('impact crosses frames once, recovery ignores presses, cancellation never releases', () => {
    for (const step of [1 / 144, 1 / 60, 1 / 20, .31]) {
        const clock = new KatanaClock();
        clock.begin(0);
        clock.release(0);
        let hits = 0;
        for (let t = 0; t < 1; t += step)
            hits += Number(clock.impact(t));
        assert.equal(hits, 1);
    }
    const clock = new KatanaClock();
    clock.begin(0);
    clock.release(0);
    assert.equal(clock.begin(.599), false);
    assert.equal(clock.begin(.6), true);
    clock.cancel();
    assert.equal(clock.release(4), false);
    clock.reset();
    clock.begin(5);
    clock.release(8);
    clock.cancel();
    assert.equal(clock.impact(9), false);
});
test('semicylinder tests exact body range, rear, height, side boundaries and aim pitch', () => {
    assert.equal(hits(0, 0, -4.1), true);
    assert.equal(hits(0, 0, -4.101), false);
    assert.equal(hits(0, 0, -10.1, KATANA.chargedRadius), true);
    assert.equal(hits(0, 0, -10.101, KATANA.chargedRadius), false);
    assert.equal(hits(0, 0, .101), false);
    assert.equal(hits(1, 0, 0), true);
    assert.equal(hits(0, 1.75, -1), true);
    assert.equal(hits(0, 1.751, -1), false);
    assert.equal(hits(0, -1.75, -1), true);
    assert.equal(hits(0, -1.751, -1), false);
    const up = { ...pose, rotation: new THREE.Quaternion().setFromEuler(new THREE.Euler(Math.PI / 2, 0, 0)) };
    assert.equal(hits(0, 2, 0, 2, up), true);
    assert.equal(hits(0, -2, 0, 2, up), false);
});
test('large enclosing and face-interior boxes intersect without broad-sphere false positives', () => {
    const huge = new THREE.Box3(new THREE.Vector3(-100, -100, -100), new THREE.Vector3(100, 100, 100));
    assert.ok(katanaBoxContacts(huge, new THREE.Matrix4(), pose, 2, 1.65).length);
    huge.min.y = .5;
    huge.max.y = .7;
    assert.ok(katanaBoxContacts(huge, new THREE.Matrix4(), pose, 2, 1.65).length);
    const contacts = katanaBoxContacts(box, new THREE.Matrix4().makeTranslation(.9, 0, -1), pose, 2, 1.65);
    assert.ok(contacts.some(p => p.x > .95), 'partial face has exposed witnesses');
    assert.ok(contacts.every(p => p.z <= 0 && Math.hypot(p.x, p.z) <= 2 + 1e-8));
});
test('melee parser rejects forged power, malformed sequence/life, angles and firearm impersonation', () => {
    const command = { type: 'melee_command', action: 'start', sequence: 1, lifeId: 1 };
    assert.ok(parseNetworkPacket(command));
    for (const fields of [{ damage: 10 }, { charged: true }, { radius: 6 }, { sequence: -1 }, { sequence: 1.2 }, { lifeId: Infinity }, { action: 'hit' }])
        assert.equal(parseNetworkPacket({ ...command, ...fields }), null);
    assert.equal(parseNetworkPacket({ type: 'fire', weapon: 'KATANA', shotId: 1, barrelPos: { x: 0, y: 0, z: 0 }, dir: { x: 0, y: 0, z: -1 }, spreadSeed: 1 }), null);
    const event = { ...command, type: 'melee_event', senderPeerId: 'peer-a', charged: false, origin: { x: 0, y: 0, z: 0 }, yaw: 0, pitch: 0 };
    assert.ok(parseNetworkPacket(event));
    for (const fields of [{ charged: 1 }, { pitch: Math.PI }, { origin: { x: NaN, y: 0, z: 0 } }, { senderPeerId: '../bad' }])
        assert.equal(parseNetworkPacket({ ...event, ...fields }), null);
});
test('shared katana has black blade, silver grip, progressive lightning and right-to-left slash', () => {
    const mesh = buildKatana();
    const blade = mesh.userData.blade;
    assert.equal(blade.material.color.getHex(), 0x080a0e);
    updateKatanaModel(mesh, 1.5, null, false, 0, false);
    assert.equal(mesh.userData.lightning.visible, true);
    updateKatanaModel(mesh, 3, null, true, 0, false);
    assert.ok(mesh.userData.lightning.children[0].geometry.drawRange.count > 0);
    updateKatanaModel(mesh, 3, null, true, 0, true);
    assert.equal(mesh.userData.pulse, undefined);
    updateKatanaModel(mesh, 0, .1, false, 0, false);
    const right = mesh.userData.sword.position.clone();
    updateKatanaModel(mesh, 0, .3, false, 0, false);
    assert.ok(mesh.userData.sword.position.x < right.x);
    assert.equal(mesh.userData.sword.position.y, right.y);
    updateKatanaModel(mesh, 0, KATANA.duration, false, 0, false);
    assert.equal(mesh.userData.sword.position.x, 0.22);
    mesh.traverse((child: any) => { child.geometry?.dispose(); child.material?.dispose(); });
});
test('melee reserves the firearm deadline and a weapon swap cannot shorten recovery', async () => {
    const { ShotLedger } = await import('../src/shotAuthority.ts');
    const ledger = new ShotLedger();
    ledger.reserveMelee(1000, .6);
    assert.equal(ledger.ready(1599), false);
    assert.equal(ledger.ready(1600), true);
    const fire = { type: 'fire', weapon: 'PISTOL', shotId: 1, barrelPos: { x: 0, y: 0, z: 0 }, dir: { x: 0, y: 0, z: -1 }, spreadSeed: 1 } as const;
    assert.equal(ledger.record(fire, 1400, false), false);
    assert.equal(ledger.record(fire, 1600, false), true);
    assert.equal(ledger.ready(1601), false);
});
test('katana damage context preserves Mecha shields and protected lifecycle phases', async () => {
    const { ForgottenMecha } = await import('../src/forgottenMecha.ts');
    const { loadIronmawTestAsset } = await import('./ironmawTestAsset.ts');
    const actor = new ForgottenMecha([], [], 42);
    actor.install(await loadIronmawTestAsset());
    try {
        const point = actor.combat.shieldCenter.clone();
        const outside = point.clone().add(new THREE.Vector3(0, 0, 60));
        const hp = actor.hp;
        assert.equal(actor.damage(KATANA.chargedDamage, { origin: outside, point, surface: 'body' }).accepted, false);
        assert.equal(actor.hp, hp);
        assert.equal(actor.damage(KATANA.damage, { origin: point, point, surface: 'body' }).accepted, true);
        assert.equal(actor.hp, hp - KATANA.damage);
        actor.mode = 'boarding';
        assert.equal(actor.damage(KATANA.chargedDamage, { origin: point, point, surface: 'body' }).accepted, false);
    }
    finally {
        actor.dispose();
    }
});

test('katana instances isolate charge materials and survive another instance disposal', () => {
    const first = buildKatana(), second = buildKatana();
    assert.notEqual(first.userData.blade.material, second.userData.blade.material);
    assert.notEqual(first.userData.blade.geometry, second.userData.blade.geometry);
    updateKatanaModel(first, KATANA.charge, null, true, 0, false);
    assert.ok(first.userData.blade.material.emissiveIntensity > 0);
    assert.equal(second.userData.blade.material.emissiveIntensity, 0);
    const grip = second.getObjectByName('grip') as any;
    assert.equal(grip.material.color.getHex(), 0xebf0f8);
    first.traverse((child: any) => { child.geometry?.dispose(); child.material?.dispose(); });
    updateKatanaModel(second, KATANA.charge, null, true, 0, true);
    assert.equal(second.userData.blade.material.emissiveIntensity, katanaEmission(0,true));
    second.traverse((child: any) => { child.geometry?.dispose(); child.material?.dispose(); });
});
