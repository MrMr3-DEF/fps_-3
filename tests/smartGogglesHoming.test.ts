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

function selectedCallouts(layer: HudElement): string[] {
    return layer.children.filter(child => child.classList.contains('is-callout-active'))
        .map(child => child.dataset.targetKey).sort();
}

function calloutLabel(target: HudElement): HudElement {
    return target.children.find(child => child.className === 'goggles-target-label')!;
}

function crowdedEnemies(): THREE.Group[] {
    // Each body has a separate sightline. The closest-to-reticle enemies are
    // deliberately farther away than some peripheral enemies.
    return [-0.185, -0.13, -0.075, -0.03, 0.025, 0.07, 0.12, 0.18].map((slope, index) => {
        const target = enemy(index);
        const depth = index >= 2 && index <= 6 ? 500 : 200;
        target.position.set(slope * depth, 2, -depth);
        target.updateMatrixWorld(true);
        return target;
    });
}

for (const kind of ['npc', 'peer'] as const) {
    test(`${kind} scans include exactly 1200m and immediately discard farther tracked overlays`, () => {
        const layer = new HudElement(), hud = new SmartGogglesHud(layer as any), view = camera();
        const target = enemy();
        const targets = kind === 'npc' ? [target] : [];
        const peers = kind === 'peer' ? { remote: { mesh: target, hp: 3, maxHp: 3, username: 'Remote' } } : {};
        const key = kind === 'npc' ? 'npc:0' : 'peer:remote';
        const update = (distance: number, now: number) => {
            target.position.z = -distance; target.updateMatrixWorld(true);
            hud.update(view, view.position, view.position, targets, peers, true, now);
        };
        update(1199, 1000); update(1199, 2000);
        const initial = record(layer, key);
        assert.equal(initial.classList.contains('is-active'), true);
        assert.equal(initial.classList.contains('is-out-of-range'), true, 'weapon warning remains separate from scan range');
        update(1200, 2100);
        assert.equal(record(layer, key), initial);
        update(1200.001, 2200);
        assert.equal(layer.children.some(child => child.dataset.targetKey === key), false, 'hard cutoff has no exit tail');
        assert.equal(getProjectileHomingTarget(), null);
        update(1200, 2300); update(1200, 2400);
        assert.notEqual(record(layer, key), initial, 'range reentry reacquires a fresh scan');
        hud.reset();
    });
}

test('five nearest screen centers receive callouts while every enemy retains its corners', () => {
    const layer = new HudElement(), hud = new SmartGogglesHud(layer as any), view = camera();
    const targets = crowdedEnemies().reverse();
    for (const now of [1000, 2000]) hud.update(view, view.position, view.position, targets, {}, true, now);
    assert.equal(layer.children.filter(child => child.dataset.targetKey).length, 8);
    assert.deepEqual(selectedCallouts(layer), ['npc:2', 'npc:3', 'npc:4', 'npc:5', 'npc:6']);
    for (const target of targets) assert.equal(record(layer, `npc:${target.userData.index}`).classList.contains('is-active'), true);
    assert.equal(calloutLabel(record(layer, 'npc:0')).children[0].textContent, '', 'peripheral target never types a hidden callout');
    hud.reset();
});

test('camera movement swaps callouts, keeps corners alive and replays typing only on entry', () => {
    const layer = new HudElement(), hud = new SmartGogglesHud(layer as any), view = camera();
    const targets = crowdedEnemies();
    const update = (now: number) => hud.update(view, view.position, view.position, targets, {}, true, now);
    update(1000); update(2000);
    const outgoing = record(layer, 'npc:6'), incoming = record(layer, 'npc:0');
    const held = record(layer, 'npc:3');
    const heldText = calloutLabel(held).texts();
    view.rotation.y = 0.08; view.updateMatrixWorld(true);
    update(2100); update(2120);
    assert.deepEqual(selectedCallouts(layer), ['npc:0', 'npc:1', 'npc:2', 'npc:3', 'npc:4']);
    assert.equal(outgoing.classList.contains('is-callout-leaving'), true);
    assert.equal(outgoing.classList.contains('is-active'), true, 'corners do not exit with the callout');
    assert.equal(incoming.classList.contains('is-callout-active'), true);
    assert.equal(calloutLabel(incoming).children[0].textContent, '', 'incoming typing waits for its own leader');
    assert.deepEqual(calloutLabel(held).texts(), heldText, 'unchanged target does not restart typing');
    view.rotation.y = 0; view.updateMatrixWorld(true);
    update(2160);
    assert.equal(outgoing.classList.contains('is-callout-reentering'), true);
    assert.equal(outgoing.classList.contains('is-callout-leaving'), false);
    assert.equal(outgoing.classList.contains('is-callout-active'), true, 'quick reselection reverses immediately');
    assert.equal(calloutLabel(outgoing).children[0].textContent, '');
    update(2480);
    assert.equal(calloutLabel(outgoing).children[0].textContent, 'E', 'typing clock is relative to reselection');
    update(3000);
    assert.equal(calloutLabel(outgoing).children[0].textContent, 'Enemy');
    assert.equal(incoming.classList.contains('is-callout-leaving'), false, 'completed exit state clears');
    hud.reset();
    assert.equal(layer.children.filter(child => child.dataset.targetKey).length, 0);
});

test('exact screen-distance ties use target keys rather than iteration order', () => {
    const layer = new HudElement(), hud = new SmartGogglesHud(layer as any), view = camera();
    const targets = [-30, -20, -10, 10, 20, 30].map((x, index) => {
        const target = enemy(index, x); target.position.z = -300; target.updateMatrixWorld(true); return target;
    }).reverse();
    for (const now of [1000, 2000]) hud.update(view, view.position, view.position, targets, {}, true, now);
    assert.deepEqual(selectedCallouts(layer), ['npc:0', 'npc:1', 'npc:2', 'npc:3', 'npc:4']);
    hud.reset();
});

test('sun and moon ignore range while celestial, peer and anomaly scans share the five slots', () => {
    const layer = new HudElement(), hud = new SmartGogglesHud(layer as any), view = camera();
    view.far = 10000; view.updateProjectionMatrix();
    const targets = crowdedEnemies();
    const sky = (x: number) => {
        const mesh = new THREE.Mesh(new THREE.SphereGeometry(4), new THREE.MeshBasicMaterial());
        mesh.position.set(x, 2, -2000); mesh.updateMatrixWorld(true); return mesh;
    };
    const celestial = [
        { key: 'sun' as const, mesh: sky(-12), distanceKm: 149600000 },
        { key: 'moon' as const, mesh: sky(12), distanceKm: 384400 },
    ];
    const hitbox = new THREE.Mesh(new THREE.BoxGeometry(2, 2, 2), new THREE.MeshBasicMaterial());
    hitbox.position.set(3, 2, -300); hitbox.updateMatrixWorld(true);
    const peer = enemy(50, -3); peer.position.z = -300; peer.updateMatrixWorld(true);
    const peers = { remote: { mesh: peer, hp: 3, maxHp: 3, username: 'Remote' } };
    for (const now of [1000, 2000]) hud.update(view, view.position, view.position, targets, peers, true, now, { hitbox }, celestial);
    assert.deepEqual(selectedCallouts(layer), ['anomaly:goth-girlfriend', 'celestial:moon', 'celestial:sun', 'npc:4', 'peer:remote']);
    assert.equal(hud.isAnomalyDetected, true);
    hitbox.position.x = 30; hitbox.updateMatrixWorld(true);
    hud.update(view, view.position, view.position, targets, peers, true, 2100, { hitbox }, celestial);
    assert.equal(record(layer, 'anomaly:goth-girlfriend').classList.contains('is-callout-active'), false);
    assert.equal(hud.isAnomalyDetected, true, 'corners-only anomaly still drives failure detection');
    hitbox.position.set(0, 2, -1201); hitbox.updateMatrixWorld(true);
    hud.update(view, view.position, view.position, targets, peers, true, 2200, { hitbox }, celestial);
    assert.equal(hud.isAnomalyDetected, false);
    assert.equal(layer.children.some(child => child.dataset.targetKey === 'anomaly:goth-girlfriend'), false);
    hud.reset();
});

test('a corners-only target can still acquire homing and exits immediately beyond scan range', () => {
    const layer = new HudElement(), hud = new SmartGogglesHud(layer as any), view = camera();
    const targets = [0.012, 0.018, 0.024, 0.030, 0.036].map((slope, index) => {
        const target = enemy(index); target.position.set(slope * 200, 2, -200); target.children[0].scale.setScalar(0.05); target.updateMatrixWorld(true); return target;
    });
    // The large enemy contains the crosshair, but its box center ranks sixth.
    const lockTarget = enemy(9); lockTarget.position.set(30, 2, -600);
    lockTarget.children[0].scale.setScalar(40); lockTarget.updateMatrixWorld(true);
    targets.push(lockTarget);
    for (const now of [1000, 1250, 1600]) hud.update(view, view.position, view.position, targets, {}, true, now);
    assert.equal(record(layer, 'npc:9').classList.contains('is-callout-active'), false);
    assert.equal(getProjectileHomingTarget()?.object, lockTarget);
    lockTarget.position.z = -1300; lockTarget.updateMatrixWorld(true);
    hud.update(view, view.position, view.position, targets, {}, true, 1700);
    assert.equal(layer.children.some(child => child.dataset.targetKey === 'npc:9'), false, 'also clears old teleport/elimination overlays');
    assert.notEqual(getProjectileHomingTarget()?.object, lockTarget);
    hud.reset();
});

test('elimination does not reveal a callout that was never selected', () => {
    const layer = new HudElement(), hud = new SmartGogglesHud(layer as any), view = camera(), targets = crowdedEnemies();
    for (const now of [1000, 2000]) hud.update(view, view.position, view.position, targets, {}, true, now);
    const peripheral = record(layer, 'npc:0');
    targets[0].userData.eliminationRevision++; targets[0].visible = false;
    hud.update(view, view.position, view.position, targets, {}, true, 2100);
    assert.equal(peripheral.classList.contains('is-eliminated'), true);
    assert.equal(peripheral.classList.contains('is-callout-active'), false);
    assert.equal(calloutLabel(peripheral).children[0].textContent, '');
    hud.reset();
});

test('gameplay limit opt-out preserves unrestricted preview callouts and distances', () => {
    const layer = new HudElement(), hud = new SmartGogglesHud(layer as any, { gameplayLimits: false }), view = camera();
    const targets = crowdedEnemies();
    const far = enemy(99); far.position.set(0, 40, -1300); far.updateMatrixWorld(true); targets.push(far);
    for (const now of [1000, 2000]) hud.update(view, view.position, view.position, targets, {}, true, now);
    assert.equal(layer.children.filter(child => child.dataset.targetKey).length, 9);
    for (const target of targets) {
        const scan = record(layer, `npc:${target.userData.index}`);
        assert.equal(scan.classList.contains('is-callout-managed'), false);
        assert.equal(calloutLabel(scan).children[0].textContent, 'Enemy');
    }
    hud.reset();
});

test('reduced motion reveals selected callouts immediately and still applies the five-target cap', () => {
    (globalThis as any).window.matchMedia = () => ({ matches: true });
    const layer = new HudElement(), hud = new SmartGogglesHud(layer as any), view = camera();
    try {
        hud.update(view, view.position, view.position, crowdedEnemies(), {}, true, 1000);
        assert.equal(selectedCallouts(layer).length, 5);
        assert.equal(calloutLabel(record(layer, 'npc:3')).children[0].textContent, 'Enemy');
    } finally {
        hud.reset();
        (globalThis as any).window.matchMedia = () => ({ matches: false });
    }
});

test('covered Mecha does not consume a slot needed by visible enemy callouts', () => {
    const layer = new HudElement(), hud = new SmartGogglesHud(layer as any), view = camera();
    const targets = [-0.10, -0.05, 0, 0.05, 0.10].map((slope, index) => {
        const target = enemy(index, slope * 100); target.position.z = -100; target.updateMatrixWorld(true); return target;
    });
    const cover = enemy(8); cover.position.set(0, 14, -250); cover.children[0].scale.setScalar(50); cover.updateMatrixWorld(true);
    targets.push(cover);
    const group = new THREE.Group(); group.position.set(0, 0, -500);
    const hitbox = new THREE.Mesh(new THREE.BoxGeometry(20, 28, 20), new THREE.MeshBasicMaterial());
    hitbox.position.set(0, 14, -500); hitbox.updateMatrixWorld(true);
    const mecha = { ready: true, revision: 0, hp: 50, maxHp: 50, radius: 14, group, hitbox };
    for (const now of [1000, 2000]) hud.update(view, view.position, view.position, targets, {}, true, now, null, [], false, mecha as any);
    const scan = record(layer, 'mecha:forgotten');
    assert.equal(scan.classList.contains('is-mecha-hidden'), true);
    assert.equal(scan.classList.contains('is-callout-active'), false);
    assert.equal(selectedCallouts(layer).length, 5, 'covered Mecha leaves five slots for visible targets');
    hud.reset();
});

test('observer movement clears unseen and eliminated scans at the hard cutoff', () => {
    for (const eliminated of [false, true]) {
        const layer = new HudElement(), hud = new SmartGogglesHud(layer as any), view = camera(), target = enemy();
        for (const now of [1000, 2000]) hud.update(view, view.position, view.position, [target], {}, true, now);
        if (eliminated) target.userData.eliminationRevision++;
        target.visible = false;
        hud.update(view, view.position, view.position, [target], {}, true, 2100);
        assert.ok(layer.children.some(child => child.dataset.targetKey === 'npc:0'));
        const observer = new THREE.Vector3(0, 2, 1300);
        hud.update(view, observer, observer, [target], {}, true, 2110);
        assert.equal(layer.children.some(child => child.dataset.targetKey === 'npc:0'), false);
        assert.equal(getProjectileHomingTarget(), null);
        hud.reset();
    }
});
