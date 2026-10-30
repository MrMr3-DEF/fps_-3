import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { LocatorBar } from '../src/locatorBar.ts';
import { projectLocatorTarget, type LocatorView } from '../src/locatorBarMath.ts';
import { PEER_Y_OFFSET } from '../src/config.ts';
import type { MechaMode } from '../src/forgottenMecha.ts';

const radians = THREE.MathUtils.degToRad;
const view: LocatorView = { position: { x: 0, y: 0, z: 0 }, yaw: 0, pitch: 0, verticalFov: radians(60) };
const target = (angle: number, distance = 100, y = 0) => ({ x: Math.sin(radians(angle)) * distance, y, z: -Math.cos(radians(angle)) * distance });
const close = (actual: number, expected: number) => assert.ok(Math.abs(actual - expected) < 1e-8, `${actual} != ${expected}`);

test('locator maps the forward arc, includes its boundaries and wraps camera yaw', () => {
    for (const [angle, position] of [[-60, 0], [-30, 0.25], [0, 0.5], [30, 0.75], [60, 1]]) {
        close(projectLocatorTarget(target(angle), view)!.position, position);
    }
    for (const angle of [-180, -60.001, 60.001, 180]) assert.equal(projectLocatorTarget(target(angle), view), null);
    close(projectLocatorTarget(target(-90), { ...view, yaw: radians(90) })!.position, 0.5);
    close(projectLocatorTarget(target(-179), { ...view, yaw: radians(-179) })!.position, 0.5 + 2 / 120);
});

test('locator elevation uses the vertical viewport and camera pitch, including side perspective', () => {
    const above = { x: 0, y: 100, z: -100 };
    const below = { ...above, y: -100 };
    assert.equal(projectLocatorTarget(above, view)!.elevation, 'above');
    assert.equal(projectLocatorTarget(below, view)!.elevation, 'below');
    assert.equal(projectLocatorTarget(above, { ...view, pitch: radians(45) })!.elevation, 'level');
    assert.equal(projectLocatorTarget(below, { ...view, pitch: radians(-45) })!.elevation, 'level');
    assert.equal(projectLocatorTarget({ x: 0, y: 40, z: -100 }, view)!.elevation, 'level');
    assert.equal(projectLocatorTarget(target(60, 100, 40), view)!.elevation, 'above');
    assert.equal(projectLocatorTarget({ x: 0, y: 40, z: -100 }, { ...view, verticalFov: radians(20) })!.elevation, 'above');
});

test('locator handles overhead, coincident, steep and invalid views without unstable bearings', () => {
    assert.equal(projectLocatorTarget(view.position, view), null);
    assert.deepEqual(projectLocatorTarget({ x: 0, y: 1, z: 0 }, view), { position: 0.5, elevation: 'above' });
    assert.deepEqual(projectLocatorTarget({ x: 0, y: -1, z: 0 }, view), { position: 0.5, elevation: 'below' });
    for (const pitch of [89.999, 90, -89.999, -90]) {
        const projection = projectLocatorTarget(target(25), { ...view, pitch: radians(pitch) })!;
        close(projection.position, 0.5 + 25 / 120);
        assert.equal(projection.elevation, pitch > 0 ? 'below' : 'above');
    }
    assert.equal(projectLocatorTarget({ x: NaN, y: 0, z: -1 }, view), null);
    assert.equal(projectLocatorTarget(target(0), { ...view, verticalFov: 0 }), null);
    assert.deepEqual(projectLocatorTarget(target(30, 1), view), projectLocatorTarget(target(30, 1000000), view));
});

class Element {
    ownerDocument = { createElement: () => new Element() };
    children: Element[] = [];
    parent: Element | null = null;
    className = '';
    dataset: Record<string, string> = {};
    attributes: Record<string, string> = {};
    style = { left: '', setProperty: (key: string, value: string) => { this.properties[key] = value; } };
    properties: Record<string, string> = {};
    append(child: Element) { child.parent = this; this.children.push(child); }
    remove() { if (this.parent) this.parent.children = this.parent.children.filter(child => child !== this); this.parent = null; }
    replaceChildren() { for (const child of [...this.children]) child.remove(); }
    setAttribute(key: string, value: string) { this.attributes[key] = value; }
}
function fixture() {
    const layer = new Element();
    const bar = new LocatorBar(layer as unknown as HTMLElement);
    const camera = new THREE.PerspectiveCamera(60, 16 / 9, 0.1, 2000);
    const peer = (angle = 0, distance = 100) => {
        const mesh = new THREE.Group(); const point = target(angle, distance);
        mesh.position.set(point.x, -PEER_Y_OFFSET, point.z);
        return { mesh, hp: 100, deathReported: false };
    };
    const mecha = { ready: true, disposed: false, mode: 'walking' as MechaMode, ownsLocalPilot: false, ownsPilot: false,
        pilotPeerId: null as string | null, hitbox: new THREE.Mesh() };
    mecha.hitbox.position.set(0, 0, -200);
    return { layer, bar, camera, peer, mecha };
}

test('renderer preserves duplicate suit colors and overlap, reuses identities and updates colors', () => {
    const { layer, bar, camera, peer } = fixture();
    const peers = { a: peer(), b: peer(), self: peer() };
    const roster = [{ peerId: 'a', bodyColor: 0x0099aa }, { peerId: 'b', bodyColor: 0x0099aa }, { peerId: 'self', bodyColor: 0xff0000 }];
    bar.update(camera, peers, roster, 'self', null);
    assert.equal(layer.children.length, 2);
    const [first, second] = layer.children;
    assert.equal(first.style.left, second.style.left);
    assert.equal(first.properties['--locator-color'], '#0099aa');
    assert.equal(second.properties['--locator-color'], '#0099aa');
    roster[0].bodyColor = 0x000001;
    bar.update(camera, peers, roster, 'self', null);
    assert.equal(layer.children[0], first);
    assert.equal(first.properties['--locator-color'], '#000001');
    assert.equal(second.properties['--locator-color'], '#0099aa');
});

test('renderer uses interpolated world positions independently of culling, distance and camera mode', () => {
    const { layer, bar, camera, peer } = fixture();
    const player = peer(30, 1000000); player.mesh.visible = false;
    const parent = new THREE.Group(); parent.add(player.mesh);
    parent.position.y = 2000000;
    bar.update(camera, { a: player }, [{ peerId: 'a', bodyColor: 0xffffff }], undefined, null);
    close(Number.parseFloat(layer.children[0].style.left), 75);
    assert.equal(layer.children[0].dataset.elevation, 'above');
    // Shoulder/cockpit cameras are passed as the actual final view, including
    // its translated origin and yaw. There is no separate player-eye bearing.
    camera.position.copy(parent.position); camera.rotation.set(0, radians(-30), 0, 'YXZ');
    bar.update(camera, { a: player }, [{ peerId: 'a', bodyColor: 0xffffff }], undefined, null);
    close(Number.parseFloat(layer.children[0].style.left), 50);
    assert.equal(layer.children[0].dataset.elevation, 'level');
    camera.rotation.x = Math.PI / 2;
    bar.update(camera, { a: player }, [{ peerId: 'a', bodyColor: 0xffffff }], undefined, null);
    assert.ok(Number.isFinite(Number.parseFloat(layer.children[0].style.left)));
    assert.equal(layer.children[0].dataset.elevation, 'below');
});

test('dead, disconnected, unconfirmed and out-of-arc players retire; respawn and reset are clean', () => {
    const { layer, bar, camera, peer } = fixture();
    const player = peer(); const roster = [{ peerId: 'a', bodyColor: 0x123456 }];
    bar.update(camera, { a: player }, roster, undefined, null);
    player.hp = 0; bar.update(camera, { a: player }, roster, undefined, null);
    assert.equal(layer.children.length, 0);
    player.hp = 100; player.deathReported = true;
    bar.update(camera, { a: player }, roster, undefined, null); assert.equal(layer.children.length, 0);
    player.deathReported = false;
    bar.update(camera, { a: player }, roster, undefined, null); assert.equal(layer.children.length, 1);
    bar.update(camera, {}, roster, undefined, null); assert.equal(layer.children.length, 0);
    bar.update(camera, { a: player }, [], undefined, null); assert.equal(layer.children.length, 0);
    player.mesh.position.z = 100;
    bar.update(camera, { a: player }, roster, undefined, null); assert.equal(layer.children.length, 0);
    player.mesh.position.z = -100;
    bar.update(camera, { a: player }, roster, undefined, null); assert.equal(layer.children.length, 1);
    bar.reset(); assert.equal(layer.children.length, 0);
    bar.update(camera, {}, [], undefined, null); assert.equal(layer.children.length, 0);
});

test('mecha marker survives defeated state, replaces a remote pilot, and retires on local occupancy/destruction', () => {
    const { layer, bar, camera, peer, mecha } = fixture();
    const peers = { pilot: peer() }; const roster = [{ peerId: 'pilot', bodyColor: 0xc5cbd0 }];
    bar.update(camera, peers, roster, undefined, mecha);
    assert.equal(layer.children.length, 2);
    assert.equal(layer.children[1].className, 'locator-dot locator-dot-mecha');
    mecha.mode = 'dead'; bar.update(camera, {}, [], undefined, mecha);
    assert.equal(layer.children.length, 1);
    const marker = layer.children[0];
    mecha.mode = 'piloted'; mecha.ownsPilot = true; mecha.pilotPeerId = 'pilot';
    mecha.hitbox.position.x = 100;
    bar.update(camera, peers, roster, undefined, mecha);
    assert.deepEqual(layer.children, [marker]);
    assert.ok(Number.parseFloat(marker.style.left) > 50);
    mecha.ownsPilot = false; mecha.pilotPeerId = null;
    bar.update(camera, peers, roster, undefined, mecha); assert.equal(layer.children.length, 2);
    mecha.ownsLocalPilot = true;
    bar.update(camera, {}, [], undefined, mecha); assert.equal(layer.children.length, 0);
    mecha.ownsLocalPilot = false;
    for (const mode of ['destroying', 'destroyed'] as const) {
        mecha.mode = mode; bar.update(camera, {}, [], undefined, mecha); assert.equal(layer.children.length, 0);
    }
    mecha.mode = 'walking'; mecha.ready = false;
    bar.update(camera, {}, [], undefined, mecha); assert.equal(layer.children.length, 0);
    mecha.ready = true; mecha.disposed = true;
    bar.update(camera, {}, [], undefined, mecha); assert.equal(layer.children.length, 0);
});
