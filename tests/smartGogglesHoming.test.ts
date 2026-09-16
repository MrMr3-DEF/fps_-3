import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { HudElement } from './fakeHudDom.ts';
import { isGogglesScanZoomReady, SmartGogglesHud } from '../src/smartGoggles.ts';
import { getProjectileHomingTarget } from '../src/projectileHoming.ts';

(globalThis as any).document = {
    getElementById: (id: string) => id === 'goggles-anomaly-tear-a' ? {} : null,
    createElement: () => new HudElement(),
    createElementNS: () => new HudElement(),
};
(globalThis as any).window = {
    innerWidth: 1280,
    innerHeight: 720,
    matchMedia: () => ({ matches: false }),
};

function camera(): THREE.PerspectiveCamera {
    const result = new THREE.PerspectiveCamera(15, 1280 / 720, 0.1, 1500);
    result.position.set(0, 2, 0);
    result.lookAt(0, 2, -20);
    result.updateProjectionMatrix();
    result.updateMatrixWorld(true);
    return result;
}

function enemy(index = 0, x = 0): THREE.Group {
    const target = new THREE.Group();
    target.position.set(x, 2, -20);
    const bodyMesh = new THREE.Mesh(new THREE.BoxGeometry(2, 2, 2), new THREE.MeshBasicMaterial());
    const healthBarGroup = new THREE.Group();
    target.add(bodyMesh, healthBarGroup);
    target.userData = {
        index, hp: 3, maxHp: 3, scale: 1, color: 0xffffff,
        eliminationRevision: 2, bodyMesh, healthBarGroup,
    };
    target.updateMatrixWorld(true);
    return target;
}

function record(layer: HudElement, targetKey: string): HudElement {
    const result = layer.children.find(child => child.dataset.targetKey === targetKey);
    assert.ok(result, `missing HUD record ${targetKey}`);
    return result;
}

test('scan begins around halfway through scope settling rather than after exact FOV convergence', () => {
    const normalFov = 75;
    const scopedFov = 15;
    assert.equal(isGogglesScanZoomReady(18, normalFov, scopedFov), false);
    assert.equal(isGogglesScanZoomReady(17, normalFov, scopedFov), true);
    assert.equal(isGogglesScanZoomReady(scopedFov, normalFov, scopedFov), true);

    let currentFov = normalFov;
    let readyFrame = -1;
    let settledFrame = -1;
    for (let frame = 1; frame < 120; frame++) {
        if (Math.abs(currentFov - scopedFov) > 0.1) {
            currentFov += (scopedFov - currentFov) * 15 / 60;
        } else {
            currentFov = scopedFov;
        }
        if (readyFrame < 0 && isGogglesScanZoomReady(currentFov, normalFov, scopedFov)) readyFrame = frame;
        if (currentFov === scopedFov) {
            settledFrame = frame;
            break;
        }
    }
    assert.ok(readyFrame > 0 && settledFrame > 0);
    assert.ok(readyFrame / settledFrame >= 0.4 && readyFrame / settledFrame <= 0.6);
});

test('homing remains disabled until the red target-lock animation completes', () => {
    const layer = new HudElement();
    const hud = new SmartGogglesHud(layer as any);
    const view = camera();
    const target = enemy();
    hud.update(view, view.position, view.position, [target], {}, true, 1000);
    assert.equal(getProjectileHomingTarget(), null, 'yellow scan animation does not enable homing');

    hud.update(view, view.position, view.position, [target], {}, true, 1250);
    const targetRecord = record(layer, 'npc:0');
    assert.deepEqual(
        targetRecord.children
            .map(child => child.className)
            .filter(className => className.startsWith('goggles-homing-corner')),
        [
            'goggles-homing-corner goggles-homing-corner--top',
            'goggles-homing-corner goggles-homing-corner--right',
            'goggles-homing-corner goggles-homing-corner--bottom',
            'goggles-homing-corner goggles-homing-corner--left',
        ],
    );
    assert.equal(targetRecord.classList.contains('is-homing-locking'), true);
    assert.equal(getProjectileHomingTarget(), null, 'red brackets must finish converging first');

    hud.update(view, view.position, view.position, [target], {}, true, 1500);
    const lock = getProjectileHomingTarget();
    assert.equal(lock?.kind, 'npc');
    assert.equal(lock?.object, target);
    assert.equal(targetRecord.classList.contains('is-homing-locked'), true);
    hud.reset();
});

test('a closer centered target immediately clears the previous red lock and reacquires', () => {
    const layer = new HudElement();
    const hud = new SmartGogglesHud(layer as any);
    const view = camera();
    const first = enemy(0, 0);
    const second = enemy(1, 0.5);
    hud.update(view, view.position, view.position, [first, second], {}, true, 1000);
    hud.update(view, view.position, view.position, [first, second], {}, true, 1250);
    hud.update(view, view.position, view.position, [first, second], {}, true, 1500);
    assert.equal(getProjectileHomingTarget()?.object, first);

    first.position.x = -0.5;
    second.position.x = 0;
    first.updateMatrixWorld(true);
    second.updateMatrixWorld(true);
    hud.update(view, view.position, view.position, [first, second], {}, true, 1510);
    assert.equal(getProjectileHomingTarget(), null, 'switching targets removes homing during the new lock');
    assert.equal(record(layer, 'npc:0').classList.contains('is-homing-locked'), false);
    assert.equal(record(layer, 'npc:1').classList.contains('is-homing-locking'), true);

    hud.update(view, view.position, view.position, [first, second], {}, true, 1750);
    assert.equal(getProjectileHomingTarget()?.object, second);
    hud.reset();
});

test('girlfriend and celestial scan boxes never become homing targets', () => {
    const hud = new SmartGogglesHud(new HudElement() as any);
    const view = camera();
    const girlfriend = new THREE.Mesh(new THREE.BoxGeometry(2, 4, 1), new THREE.MeshBasicMaterial());
    girlfriend.position.set(0, 2, -20);
    girlfriend.updateMatrixWorld(true);
    hud.update(view, view.position, view.position, [], {}, true, 1000, { hitbox: girlfriend });
    assert.equal(getProjectileHomingTarget(), null);

    const sun = new THREE.Mesh(new THREE.SphereGeometry(1), new THREE.MeshBasicMaterial());
    sun.position.set(0, 2, -20);
    sun.scale.setScalar(3);
    sun.updateMatrixWorld(true);
    hud.update(view, view.position, view.position, [], {}, true, 1016, null, [
        { key: 'sun', mesh: sun, distanceKm: 149_600_000 },
    ]);
    assert.equal(getProjectileHomingTarget(), null);
    hud.reset();
});
