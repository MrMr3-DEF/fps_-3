import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { BULLET_TRAVEL_DISTANCE } from '../src/config.ts';
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

test('goggles panel and leader use the full readout width before typing starts', () => {
    const layer = new HudElement();
    const hud = new SmartGogglesHud(layer as any);
    const view = camera();
    const target = enemy();
    hud.update(view, view.position, view.position, [target], {}, true, 1000);

    const targetRecord = record(layer, 'npc:0');
    const label = targetRecord.children.find(child => child.className === 'goggles-target-label');
    const leader = targetRecord.children.find(child => child.classList.contains('goggles-target-leader'));
    assert.ok(label && leader);
    const panel = label.children[1];
    assert.ok(panel.children[0].textContent.includes('DISTANCE:'));
    assert.ok(panel.children[0].textContent.includes('HEALTH: 3 / 3'));
    assert.equal(panel.children[1].textContent, '');
    assert.equal((label.style as any).width, '196px');

    const leaderWidth = () => {
        const points = [...leader.children[0].attributes.d.matchAll(/[ML] (-?\d+(?:\.\d+)?) (-?\d+(?:\.\d+)?)/g)];
        assert.equal(points.length, 3);
        return Math.abs(Number(points[2][1]) - Number(points[1][1]));
    };
    assert.ok(Math.abs(leaderWidth() - 196) <= 0.1);

    hud.update(view, view.position, view.position, [target], {}, true, 2000);
    assert.ok(panel.children[1].textContent.startsWith('DISTANCE'));
    assert.equal((label.style as any).width, '196px');
    assert.ok(Math.abs(leaderWidth() - 196) <= 0.1);
    hud.reset();
});

test('lobby peer scan retains goggles animation and name without a stats panel', () => {
    const layer = new HudElement();
    const hud = new SmartGogglesHud(layer as any, { lobbyPreview: true });
    const view = camera();
    const mesh = enemy();
    const peers = { other: { mesh, hp: 10, maxHp: 10, username: 'Other' } };
    hud.update(view, view.position, view.position, [], peers, true, 1000, null, [], false);
    hud.update(view, view.position, view.position, [], peers, true, 2000, null, [], false);
    const target = record(layer, 'peer:other');
    assert.equal(target.classList.contains('is-active'), true);
    assert.equal(target.classList.contains('is-lobby-peer'), true);
    const label = target.children.find(child => child.className === 'goggles-target-label')!;
    assert.equal(label.children.some(child => child.className === 'goggles-target-label-panel'), false);
    assert.ok(label.texts().includes('Other'));
    assert.equal(getProjectileHomingTarget(), null);
    hud.reset();
});

test('lobby scan corner and leader run stay latched while an avatar moves', () => {
    const layer = new HudElement();
    const hud = new SmartGogglesHud(layer as any, { lobbyPreview: true });
    hud.configureLobby(3, 'host|left|right');
    const view = camera();
    const mesh = enemy();
    mesh.position.x = -1;
    mesh.updateMatrixWorld(true);
    const peers = { left: { mesh, hp: 10, maxHp: 10, username: 'Left', lobbyOrder: 1 } };
    hud.update(view, view.position, view.position, [], peers, true, 1000, null, [], false);
    const target = record(layer, 'peer:left');
    const leader = target.children.find(child => child.classList.contains('goggles-target-leader'))!;
    const firstPath = leader.children[0].attributes.d;
    const firstLeft = target.classList.contains('is-left');
    const firstUp = target.classList.contains('is-up');
    mesh.position.x = 1;
    mesh.position.y += 0.1;
    mesh.updateMatrixWorld(true);
    hud.update(view, view.position, view.position, [], peers, true, 1033, null, [], false);
    const secondPath = leader.children[0].attributes.d;
    assert.equal(target.classList.contains('is-left'), firstLeft);
    assert.equal(target.classList.contains('is-up'), firstUp);
    const segmentLength = (path: string) => {
        const points = [...path.matchAll(/[ML] (-?\d+(?:\.\d+)?) (-?\d+(?:\.\d+)?)/g)];
        return Math.abs(Number(points[1][1]) - Number(points[0][1]));
    };
    assert.equal(segmentLength(secondPath), segmentLength(firstPath), 'leader run does not switch on movement');
    hud.reset();
});

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

for (const kind of ['npc', 'peer'] as const) {
    test(`${kind} out-of-range warnings cannot acquire a red lock and clear an existing lock`, () => {
        const layer = new HudElement();
        const hud = new SmartGogglesHud(layer as any);
        const view = camera();
        const target = enemy();
        const targets = kind === 'npc' ? [target] : [];
        const peers = kind === 'peer'
            ? { remote: { mesh: target, hp: 3, maxHp: 3, username: 'Remote', lifeId: 1 } }
            : {};
        const key = kind === 'npc' ? 'npc:0' : 'peer:remote';
        const update = (time: number) => hud.update(view, view.position, view.position, targets, peers, true, time);
        target.position.z = -BULLET_TRAVEL_DISTANCE - 10;
        target.updateMatrixWorld(true);
        update(1000);
        update(2000);
        assert.equal(record(layer, key).classList.contains('is-out-of-range'), true);
        assert.equal(record(layer, key).classList.contains('is-homing-locking'), false);
        assert.equal(record(layer, key).classList.contains('is-homing-locked'), false);
        assert.equal(getProjectileHomingTarget(), null);

        target.position.z = -BULLET_TRAVEL_DISTANCE;
        target.updateMatrixWorld(true);
        update(2100);
        update(3000);
        assert.equal(getProjectileHomingTarget()?.object, target);

        target.position.z -= 10;
        target.updateMatrixWorld(true);
        update(3010);
        assert.equal(getProjectileHomingTarget(), null);
        assert.equal(record(layer, key).classList.contains('is-homing-locked'), false);
        hud.reset();
    });
}

for (const kind of ['npc', 'peer'] as const) {
    test(`${kind} locks clear for the sniper and reacquire after switching back`, () => {
        const layer = new HudElement();
        const hud = new SmartGogglesHud(layer as any);
        const view = camera();
        const target = enemy();
        const targets = kind === 'npc' ? [target] : [];
        const peers = kind === 'peer'
            ? { remote: { mesh: target, hp: 3, maxHp: 3, username: 'Remote', lifeId: 1 } }
            : {};
        const key = kind === 'npc' ? 'npc:0' : 'peer:remote';
        const update = (time: number, homingEnabled: boolean) => hud.update(
            view, view.position, view.position, targets, peers, true, time, null, [], homingEnabled,
        );
        update(1000, false);
        update(2000, false);
        const targetRecord = record(layer, key);
        assert.equal(getProjectileHomingTarget(), null);
        assert.equal(targetRecord.classList.contains('is-homing-locking'), false);
        assert.equal(targetRecord.classList.contains('is-homing-locked'), false);

        update(2100, true);
        assert.equal(targetRecord.classList.contains('is-homing-locking'), true);
        update(2110, false);
        assert.equal(targetRecord.classList.contains('is-homing-locking'), false);
        assert.equal(getProjectileHomingTarget(), null);

        update(2200, true);
        update(2500, true);
        assert.equal(getProjectileHomingTarget()?.object, target);
        update(2510, false);
        assert.equal(targetRecord.classList.contains('is-homing-locked'), false);
        assert.equal(getProjectileHomingTarget(), null);

        update(2600, true);
        assert.equal(getProjectileHomingTarget(), null, 'switching back requires a fresh lock');
        update(2900, true);
        assert.equal(getProjectileHomingTarget()?.object, target);
        hud.reset();
    });
}
