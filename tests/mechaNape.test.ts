import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { MechaNape } from '../src/mechaNape.ts';
import { katanaBoxContacts } from '../src/katanaCombat.ts';
import { ForgottenMecha } from '../src/forgottenMecha.ts';
import { loadIronmawTestAsset } from './ironmawTestAsset.ts';

test('nape fit uses helmet proportions, rear approach and animated anatomical frame', () => {
    const head = new THREE.Group(), helmet = new THREE.Mesh(new THREE.BoxGeometry(10, 10, 10)), eye = new THREE.Object3D();
    eye.position.z = 6; head.add(helmet, eye); head.updateMatrixWorld(true);
    const nape = new MechaNape(head, helmet, eye);
    assert.deepEqual(nape.box.getSize(new THREE.Vector3()).toArray(), [6, 3, 3]);
    assert.deepEqual(nape.box.getCenter(new THREE.Vector3()).toArray(), [0, -5, -5]);
    assert.ok(nape.fromBehind(new THREE.Vector3(0, -5, -8)));
    assert.equal(nape.fromBehind(new THREE.Vector3(0, -5, 8)), false);
    assert.equal(nape.fromBehind(new THREE.Vector3(8, -5, 0)), false);
    assert.ok(nape.fromBehind(new THREE.Vector3(0, -5, -5.1)), 'close rear contact inside the expanded box is accepted');
    assert.equal(nape.fromBehind(new THREE.Vector3(0, -5, -4.9)), false);
    head.rotation.y = Math.PI; head.position.set(10, 4, 0); head.updateMatrixWorld(true);
    assert.ok(nape.fromBehind(new THREE.Vector3(10, -1, 8)));
    assert.equal(nape.fromBehind(new THREE.Vector3(10, -1, -8)), false);
    nape.dispose(); assert.equal(nape.anchor.parent, null); helmet.geometry.dispose();
});
test('real animated head nape intersects only within range; lethal damage retains protections', async () => {
    const actor = new ForgottenMecha([], [], 42); actor.install(await loadIronmawTestAsset());
    try {
        const nape = actor.nape!; assert.ok(nape);
        nape.anchor.updateWorldMatrix(true, false);
        const center = nape.box.getCenter(new THREE.Vector3()).applyMatrix4(nape.anchor.matrixWorld);
        const rear = new THREE.Vector3(0, 0, -1).transformDirection(nape.anchor.matrixWorld);
        const origin = center.clone().addScaledVector(rear, 3);
        assert.ok(nape.fromBehind(origin));
        const rotation = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, -1), rear.clone().negate());
        assert.ok(katanaBoxContacts(nape.box, nape.anchor.matrixWorld, { origin, rotation }, 10, 1.65).length);
        assert.equal(katanaBoxContacts(nape.box, nape.anchor.matrixWorld, { origin: center.clone().addScaledVector(rear, 20), rotation }, 10, 1.65).length, 0);
        const head = actor.group.getObjectByName('CTRL_Head')!;
        const before = nape.anchor.getWorldPosition(new THREE.Vector3());
        head.rotation.x += .2; head.updateWorldMatrix(true, true);
        assert.ok(before.distanceTo(nape.anchor.getWorldPosition(new THREE.Vector3())) > .001);
        const hp = actor.hp;
        assert.equal(actor.damage(hp, { origin: center.clone().addScaledVector(rear, 60), point: center, surface: 'body' }).accepted, false);
        actor.mode = 'boarding';
        assert.equal(actor.damage(hp, { origin: actor.combat.shieldCenter, point: center, surface: 'body' }).accepted, false);
        actor.mode = 'walking';
        const result = actor.damage(hp, { origin: actor.combat.shieldCenter, point: center, surface: 'body' });
        assert.ok(result.accepted); assert.ok(result.killed); assert.equal(actor.hp, 0);
    } finally { actor.dispose(); }
});
