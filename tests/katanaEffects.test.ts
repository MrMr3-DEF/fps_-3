import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { KatanaEffects } from '../src/katanaEffects.ts';
import { parseNetworkPacket } from '../src/networkTypes.ts';

test('charged ribbon samples a curved world-fixed sweep and expires after sniper lifetime', () => {
    const fx = new KatanaEffects(), scene = new THREE.Scene(), root = new THREE.Group(); scene.add(root);
    fx.sample('a', '1', root, .09, .09, scene); assert.equal(fx.trails.length, 0);
    fx.sample('a', '1', root, .18, .18, scene);
    const trail = fx.trails[0], points = [...trail.mesh.geometry.attributes.position.array];
    assert.equal(points.length, 24 * 18);
    root.position.set(100, 20, 60); root.updateMatrixWorld(true);
    fx.sample('a', '1', root, .3, .3, scene);
    assert.deepEqual([...trail.mesh.geometry.attributes.position.array], points);
    fx.update(.479, false); assert.equal(fx.trails.length, 1);
    fx.update(.481, false); assert.equal(fx.trails.length, 0);
    fx.sample('a', '2', root, .15, 1, scene); fx.cancel('a', true);
    assert.equal(fx.trails.length, 0); fx.dispose();
});
test('confirmed snapshots survive target movement; hits group without extending or replaying flash', () => {
    const fx = new KatanaEffects(), enemy = new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshBasicMaterial());
    enemy.position.set(1, 2, 3);
    assert.equal(fx.impactScene.children.length, 0);
    assert.ok(fx.confirm('swing', 'enemy:1', enemy, enemy.position, 0, false));
    const snapshot = fx.impactScene.children[0].children[0] as THREE.Mesh;
    const points = [...snapshot.geometry.attributes.position.array];
    enemy.position.x = 100;
    assert.deepEqual([...snapshot.geometry.attributes.position.array], points);
    assert.equal(fx.confirm('swing', 'enemy:1', enemy, enemy.position, .02, false), false);
    fx.confirm('swing', 'enemy:2', enemy, enemy.position, .06, false);
    assert.equal(fx.impactScene.children.length, 2);
    fx.update(.119, false); assert.equal(fx.impactScene.children.length, 2);
    fx.update(.12, false); assert.equal(fx.impactScene.children.length, 0);
    assert.equal(fx.confirm('swing', 'enemy:3', enemy, enemy.position, .13, false), false);
    fx.confirm('next', 'enemy:1', enemy, enemy.position, .2, true);
    assert.equal(fx.impactScene.background, null);
    const material = (fx.impactScene.children[0].children[0] as THREE.Mesh).material as THREE.MeshBasicMaterial;
    assert.equal(material.wireframe, true); assert.equal(material.opacity, .35);
    fx.reset(); assert.equal(fx.impactScene.children.length, 0); fx.dispose(); enemy.geometry.dispose(); enemy.material.dispose();
});
test('impact render restores renderer state even when drawing throws', () => {
    const fx = new KatanaEffects(), enemy = new THREE.Mesh(new THREE.BoxGeometry());
    fx.confirm('s', 'e', enemy, new THREE.Vector3(), 0, false);
    const target = {}, color = new THREE.Color('red');
    const renderer = { autoClear: true, getRenderTarget: () => target, getClearColor: (c: THREE.Color) => c.copy(color), getClearAlpha: () => .4,
        clearDepth() {}, render() { throw new Error('render failed'); }, setRenderTarget(t: unknown) { assert.equal(t, target); }, setClearColor(c: THREE.Color, a: number) { assert.ok(c.equals(color)); assert.equal(a, .4); } };
    assert.throws(() => fx.render(renderer as any, new THREE.Camera(), 0)); assert.equal(renderer.autoClear, true);
    fx.dispose(); enemy.geometry.dispose();
});
test('confirmed feedback parser rejects forged damage, malformed contacts and unbounded identities', () => {
    const event = { type: 'melee_hit', senderPeerId: 'attacker', sequence: 2, lifeId: 1, target: 'mecha:2', contact: { x: 1, y: 2, z: 3 }, execution: true };
    assert.ok(parseNetworkPacket(event));
    for (const patch of [{ damage: 999 }, { target: 'mecha:9007199254740992' }, { sequence: -1 }, { contact: { x: NaN, y: 0, z: 0 } }, { target: 'peer:enemy:1' }, { target: 'npc:4096:0' }, { execution: 1 }]) assert.equal(parseNetworkPacket({ ...event, ...patch }), null);
    assert.ok(parseNetworkPacket({ ...event, target: 'peer:enemy:1', execution: false }));
});
