import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { MechaRockets } from '../src/mechaRockets.ts';
function enemy(index: number, x: number, z: number, y = 10) {
    const target = new THREE.Group(); target.position.set(x, y, z);
    const body = new THREE.Mesh(new THREE.BoxGeometry(2, 3, 2), new THREE.MeshBasicMaterial()); target.add(body);
    target.userData = { index, bodyMesh: body, hp: 50, maxHp: 50, eliminationRevision: 0 }; target.updateMatrixWorld(true); return target;
}
function world(objects: THREE.Object3D[] = []) { return (_sx: number, _sz: number, _ex: number, _ez: number, out: THREE.Object3D[]) => { out.length = 0; out.push(...objects); return out; }; }
function wall(z: number, x = 0, width = 20) {
    const object = new THREE.Mesh(new THREE.BoxGeometry(width, 30, 1), new THREE.MeshBasicMaterial()); object.position.set(x, 15, z);
    object.userData = { halfW: width / 2, halfD: 0.5, halfH: 15, height: 30 }; object.updateMatrixWorld(true); return object;
}
function camera() { const c = new THREE.PerspectiveCamera(75, 16 / 9, 0.1, 2000); c.position.set(0, 10, 0); c.lookAt(0, 10, 100); c.updateMatrixWorld(true); return c; }
function simulate(rockets: MechaRockets, targets: THREE.Group[], objects: THREE.Object3D[] = []) { const hits: [number, number][] = []; for (let i = 0; i < 450; i++) rockets.update(1 / 60, targets, world(objects), (index, damage) => hits.push([index, damage])); return hits; }

test('immediate selection picks nearest crosshair, honors visible range and cover, and ignores unrelated HUD state', () => {
    const rockets = new MechaRockets(), c = camera(), origin = c.position.clone(); const targets = [enemy(0, 10, 100), enemy(1, 0, 100), enemy(2, 0, 710), enemy(3, 0, -50)];
    assert.equal(rockets.select(c, origin, targets, world())?.index, 1); assert.equal(rockets.select(c, origin, targets, world([wall(50)])), null);
    targets[1].visible = false; assert.equal(rockets.select(c, origin, targets, world())?.index, 0); rockets.dispose();
});

test('guided rocket visibly curves into airborne target and applies 10 damage once to each enemy within 5m', () => {
    const rockets = new MechaRockets(), c = camera(), origin = c.position.clone(); const targets = [enemy(0, 8, 100, 12), enemy(1, 10, 101, 12), enemy(2, 20, 100, 12)];
    rockets.select(c, origin, targets, world()); assert.equal(rockets.fire(origin, new THREE.Vector3(0, 0, 1), targets), true);
    rockets.update(0.2, targets, world(), () => {}); const mesh = rockets.group.children.find(o => o instanceof THREE.Group && o.visible)!;
    assert.ok(mesh.position.y > 10.2, 'visible lofted curve'); const hits = simulate(rockets, targets); assert.deepEqual(hits.sort(), [[0, 10], [1, 10]]); assert.equal(rockets.activeCount, 0); rockets.dispose();
});

test('cover intercepts guided rockets and blocks splash through the wall; unguided rockets still hit enemies', () => {
    const rockets = new MechaRockets(), c = camera(), origin = c.position.clone(), targets = [enemy(0, 0, 100)];
    rockets.select(c, origin, targets, world()); rockets.fire(origin, new THREE.Vector3(0, 0, 1), targets);
    assert.deepEqual(simulate(rockets, targets, [wall(97)]), []);
    rockets.selected = null; rockets.fire(origin, new THREE.Vector3(0, 0, 1), targets); assert.deepEqual(simulate(rockets, targets), [[0, 10]]); rockets.dispose();
});

test('700m surface boundary remains hittable with reduced curvature, and stale target lives cannot capture a new shot', () => {
    const rockets = new MechaRockets(), c = camera(), origin = c.position.clone(), targets = [enemy(0, 0, 701)];
    assert.equal(rockets.select(c, origin, targets, world())?.index, 0); rockets.fire(origin, new THREE.Vector3(0, 0, 1), targets);
    assert.deepEqual(simulate(rockets, targets), [[0, 10]]);
    targets[0].position.z = 100; targets[0].updateMatrixWorld(true); rockets.select(c, origin, targets, world()); targets[0].userData.eliminationRevision++;
    targets[0].position.x = 20; targets[0].updateMatrixWorld(true); rockets.fire(origin, new THREE.Vector3(0, 0, 1), targets); assert.deepEqual(simulate(rockets, targets), []);
    rockets.clear(); assert.equal(rockets.activeCount, 0); assert.equal(rockets.selected, null); rockets.dispose();
});

test('a moving selected enemy is followed after leaving the acquisition view, while a recycled life cancels guidance', () => {
    const rockets = new MechaRockets(), c = camera(), origin = c.position.clone(), targets = [enemy(0, 5, 100)];
    rockets.select(c, origin, targets, world()); rockets.fire(origin, new THREE.Vector3(0, 0, 1), targets);
    const hits: number[] = [];
    for (let frame = 0; frame < 120; frame++) { targets[0].position.x += 0.15; targets[0].updateMatrixWorld(true); rockets.update(1 / 60, targets, world(), index => hits.push(index)); }
    assert.deepEqual(hits, [0]);
    targets[0].position.set(5, 10, 100); targets[0].updateMatrixWorld(true); rockets.select(c, origin, targets, world()); rockets.fire(origin, new THREE.Vector3(0, 0, 1), targets);
    rockets.update(0.1, targets, world(), () => {}); targets[0].userData.eliminationRevision++; targets[0].position.x = -50; targets[0].updateMatrixWorld(true);
    assert.deepEqual(simulate(rockets, targets), []); rockets.dispose();
});

test('launch preserves fitted size and exact barrel axis for 3m, sweeps that section, and guides continuously at 120m/s', () => {
    const rockets = new MechaRockets(), c = camera(), origin = c.position.clone(), targets = [enemy(0, 15, 100)];
    rockets.select(c, origin, targets, world()); rockets.fire(origin, new THREE.Vector3(0, 0, 1), targets);
    const mesh = rockets.group.children.find(o => o instanceof THREE.Group && o.visible)!;
    assert.ok(Math.abs(mesh.scale.x * 0.8 - 1.9) < 1e-9); rockets.update(0.025, targets, world(), () => {});
    assert.ok(mesh.position.distanceTo(new THREE.Vector3(0, 10, 3)) < 1e-8); const previous = mesh.position.clone(); let heading = mesh.quaternion.clone();
    for (let i = 0; i < 80 && rockets.activeCount; i++) {
        targets[0].position.x += 0.1; targets[0].updateMatrixWorld(true); rockets.update(1 / 120, targets, world(), () => {});
        if (!rockets.activeCount) break;
        assert.ok(mesh.position.distanceTo(previous) <= 1 + 1e-9, 'moving targets cannot teleport the projectile');
        assert.ok(mesh.position.distanceTo(previous) > 0.99, 'constant flight speed');
        assert.ok(mesh.quaternion.angleTo(heading) <= 6 / 120 + 1e-6, 'bounded angular speed'); previous.copy(mesh.position); heading.copy(mesh.quaternion);
    }
    rockets.clear(); rockets.selected = null; rockets.fire(origin, new THREE.Vector3(0, 0, 1), []); rockets.update(0.025, [], world([wall(3)]), () => {}); assert.equal(rockets.activeCount, 0, 'obstacle hits before guidance'); rockets.dispose();
});

test('open-helmet rockets wander smoothly and reach ground 75–100m away; cover can intercept before 50m', () => {
    const rockets = new MechaRockets(); const origin = new THREE.Vector3(0, 20, 0);
    for (const seed of [1, 2, 17, 99]) {
        rockets.fire(origin, new THREE.Vector3(0, 0, 1), [], { mode: 'wandering', seed });
        const mesh = rockets.group.children.find(o => o instanceof THREE.Group && o.visible)!; let last = origin.clone();
        for (let frame = 0; frame < 600 && rockets.activeCount; frame++) {
            rockets.update(1 / 120, [], world(), () => {});
            if (rockets.activeCount) {
                assert.ok(mesh.position.distanceTo(last) <= 1.000001); last.copy(mesh.position);
                if (Math.hypot(last.x, last.z) < 50) assert.ok(last.y > rockets.radius, 'cannot reach the ground early');
            }
        }
        assert.equal(rockets.activeCount, 0); const distance = Math.hypot(last.x, last.z);
        assert.ok(distance >= 73 && distance <= 103, `landing within fitted rocket footprint at ${distance}`);
    }
    rockets.fire(origin, new THREE.Vector3(0, 0, 1), [], { mode: 'wandering', seed: 1 });
    rockets.update(0.1, [], world([wall(10)]), () => {}); assert.equal(rockets.activeCount, 0); rockets.dispose();
});

test('enemy launch is life-bound, blocks splash through cover and wandering never acquires a player', () => {
    const rockets = new MechaRockets(), origin = new THREE.Vector3(0, 2, 0);
    const player = { position: new THREE.Vector3(0, 2, 60), yaw: 0, alive: true, lifeId: 7, velocity: new THREE.Vector3() };
    const hits: number[] = [], targets = [enemy(0, 0, 60, 2)];
    const launch = { mode: 'guided' as const, player, damage: 9, turnSpeed: 3, guidanceResponse: 4 };
    rockets.fire(origin, new THREE.Vector3(0, 0, 1), targets, launch);
    for (let i = 0; i < 120; i++) rockets.update(1 / 60, targets, world([wall(58)]), () => assert.fail('NPC collateral'), player, damage => hits.push(damage));
    assert.deepEqual(hits, [], 'cover blocks a blast within 5m');
    rockets.fire(origin, new THREE.Vector3(0, 0, 1), targets, launch); player.lifeId++;
    rockets.update(1 / 60, targets, world(), () => {}, player, damage => hits.push(damage)); assert.equal(rockets.activeCount, 0);
    rockets.fire(new THREE.Vector3(0, 20, 0), new THREE.Vector3(0, 0, 1), [], { ...launch, mode: 'wandering', seed: 99 });
    player.position.set(40, 2, 35);
    for (let i = 0; i < 300; i++) rockets.update(1 / 60, [], world(), () => {}, player, damage => hits.push(damage));
    assert.deepEqual(hits, []); rockets.dispose();
});
