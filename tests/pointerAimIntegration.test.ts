import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { PointerLockControls } from '../src/pointerLockControls.js';
import { SmartGogglesHud } from '../src/smartGoggles.js';
import { getProjectileHomingTarget } from '../src/projectileHoming.js';
import { state } from '../src/state.js';
import { createAkimboGuns, disposePlayerVisuals, fireProjectile } from '../src/weapons.js';
import { resetProjectiles } from '../src/projectiles.js';
import { disposeParticles } from '../src/particles.js';
import { resetHook, toggleGrapplingHook } from '../src/grapple.js';
import { rebuildTargetHash } from '../src/world.js';
import { setWeaponNetworkPort } from '../src/weaponNetworkPort.js';
import { HudElement } from './fakeHudDom.ts';

test('smoothed aim, actual goggles acquisition, shot capture and grappling share the published crosshair', t => {
    let now = 1000;
    t.mock.method(performance, 'now', () => now);
    t.mock.method(crypto, 'getRandomValues', (array: Uint32Array) => { array[0] = 42; return array; });
    const oldDocument = Object.getOwnPropertyDescriptor(globalThis, 'document');
    const oldWindow = Object.getOwnPropertyDescriptor(globalThis, 'window');
    Object.defineProperty(globalThis, 'document', { configurable: true, value: {
        getElementById: (id: string) => id === 'goggles-anomaly-tear-a' ? {} : null,
        createElement: () => new HudElement(), createElementNS: () => new HudElement(),
    } });
    Object.defineProperty(globalThis, 'window', { configurable: true, value: {
        innerWidth: 1280, innerHeight: 720, matchMedia: () => ({ matches: false }),
    } });
    const doc = Object.assign(new EventTarget(), { pointerLockElement: null as unknown });
    const element = { ownerDocument: doc, requestPointerLock() {} };
    const camera = new THREE.PerspectiveCamera(15, 1280 / 720, 0.1, 1500);
    camera.position.set(0, 3, 0);
    const controls = new PointerLockControls(camera, element as unknown as HTMLElement);
    const hud = new SmartGogglesHud(new HudElement() as any);
    const target = new THREE.Group();
    const hookMesh = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.1, 1), new THREE.MeshBasicMaterial());
    const body = new THREE.Mesh(new THREE.BoxGeometry(2, 2, 2), new THREE.MeshBasicMaterial());
    target.add(body); target.position.set(0, 3, -120);
    target.userData = { index: 0, hp: 100, maxHp: 100, scale: 1, eliminationRevision: 0, bodyMesh: body, healthBarGroup: new THREE.Group() };
    Object.assign(state, { scene: new THREE.Scene(), camera, controls, targets: [target], obstacles: [], peers: {}, peerIds: [],
        isScoped: true, isMultiplayer: true, isHost: false, isThirdPersonView: false, projectiles: [], projectilePool: [], hookMesh, hookState: 'IDLE' });
    state.scene!.add(target); createAkimboGuns(); state.activeWeaponName = 'PISTOL';
    const shots: Array<{ direction: THREE.Vector3; homing: unknown }> = [];
    setWeaponNetworkPort({ broadcastToAll() {}, flashPeerMesh() {}, broadcastLocalFire(_origin, direction, _hit, _id, _seed, homing) {
        shots.push({ direction: direction.clone(), homing });
    } });
    const project = (time: number) => {
        now = time; camera.updateMatrixWorld(true); target.updateMatrixWorld(true);
        hud.update(camera, camera.position, camera.position, [target], {}, true, time, null, [], state.activeWeaponName !== 'SNIPER');
    };
    try {
        doc.pointerLockElement = element; doc.dispatchEvent(new Event('pointerlockchange'));
        rebuildTargetHash();
        for (const time of [1000, 1200, 1600, 2100]) project(time);
        assert.ok(getProjectileHomingTarget()?.object === target, 'real goggles lock completes');
        now = 2110;
        const event = new Event('mousemove');
        Object.defineProperties(event, { movementX: { value: 120 }, movementY: { value: 0 }, timeStamp: { value: now } });
        doc.dispatchEvent(event);
        fireProjectile();
        assert.ok(shots[0].homing, 'queued motion does not invalidate the still-visible red lock');
        assert.ok(shots[0].direction.distanceTo(new THREE.Vector3(0, 0, -1)) < 1e-9);
        const guided = state.projectiles[0];
        assert.ok(guided.userData.homingTarget.object === target);
        toggleGrapplingHook();
        assert.ok(state.hookTargetEnemy === target, 'between-frame grapple uses the displayed center ray');
        resetHook();

        controls.update(2130); project(2130);
        assert.equal(getProjectileHomingTarget(), null, 'published turn clears an off-center lock');
        const publishedDirection = camera.getWorldDirection(new THREE.Vector3());
        assert.ok(publishedDirection.distanceTo(shots[0].direction) > 0.2);
        fireProjectile();
        assert.equal(shots[1].homing, undefined, 'turning away cannot reuse the previous lock');
        assert.ok(shots[1].direction.distanceTo(publishedDirection) < 1e-9);
        assert.ok(guided.userData.homingTarget.object === target, 'an already fired guided bullet keeps its captured target');
        toggleGrapplingHook();
        assert.ok(state.hookTargetEnemy !== target);
        resetHook();

        target.position.copy(camera.position).addScaledVector(publishedDirection, 120);
        rebuildTargetHash();
        for (const time of [2200, 2400, 2800, 3200]) project(time);
        assert.ok(getProjectileHomingTarget()?.object === target, 'new published view can reacquire normally');
        state.activeWeaponName = 'SNIPER'; state.rightGun = state.sniperMesh;
        fireProjectile();
        assert.equal(shots.at(-1)!.homing, undefined, 'sniper never inherits a projectile lock');
        assert.ok(shots.at(-1)!.direction.distanceTo(publishedDirection) < 1e-9);
    } finally {
        hud.reset(); controls.dispose(); resetHook(); resetProjectiles(); disposeParticles(); disposePlayerVisuals();
        body.geometry.dispose(); (body.material as THREE.Material).dispose();
        hookMesh.geometry.dispose(); hookMesh.material.dispose(); state.hookMesh = null;
        Object.assign(state, { scene: null, camera: null, controls: null, targets: [], obstacles: [], isScoped: false, isMultiplayer: false });
        rebuildTargetHash();
        if (oldDocument) Object.defineProperty(globalThis, 'document', oldDocument); else Reflect.deleteProperty(globalThis, 'document');
        if (oldWindow) Object.defineProperty(globalThis, 'window', oldWindow); else Reflect.deleteProperty(globalThis, 'window');
    }
});
