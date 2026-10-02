import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { MechaHeadView } from '../src/mechaHeadView.ts';
import { MechaHeadEffects } from '../src/mechaHeadEffects.ts';
import { ForgottenMecha } from '../src/forgottenMecha.ts';
import { loadIronmawTestAsset } from './ironmawTestAsset.ts';
import { MECHA_INTERIOR_VIEW_BACK, MECHA_MOUNT_HELMET_CLOSE_TIME } from '../src/config.ts';

test('orange boot follows native Mount, moves only behind black and enables vision after HUD plus reveal', () => {
    const head = new MechaHeadView(), duration = 169 / 24;
    head.begin(); assert.equal(head.eyeBlend, 0);
    assert.equal(head.updateStartup(1.124, duration), false); assert.equal(head.phase, 'mount'); assert.equal(head.blackout, 0);
    head.updateStartup(1.125, duration); assert.equal(head.phase, 'loading'); assert.equal(head.blackout, 1); assert.equal(head.loadingProgress, 0);
    head.updateStartup(1.165, duration); assert.ok(Math.abs(head.eyeBlend - 0.5) < 1e-9); assert.equal(head.blackout, 1);
    head.updateStartup(1.205, duration); assert.equal(head.eyeBlend, 1);
    head.updateStartup(duration, duration); assert.equal(head.loadingProgress, 1); assert.equal(head.phase, 'hud'); assert.equal(head.hudOpacity, 0);
    head.updateStartup(duration + 0.2, duration); assert.ok(Math.abs(head.hudOpacity - 0.5) < 1e-9); assert.equal(head.blackout, 1);
    head.updateStartup(duration + 0.55, duration); assert.equal(head.phase, 'reveal'); assert.equal(head.hudOpacity, 1); assert.equal(head.targetingReady, false);
    assert.ok(Math.abs(head.revealProgress - 0.5) < 1e-9);
    assert.equal(head.updateStartup(duration + 0.7, duration), true); assert.equal(head.phase, 'ready'); assert.equal(head.targetingReady, true);
});

test('shutdown reverses video and HUD, fills the bar during reverse Mount and moves the camera under black', () => {
    const head = new MechaHeadView(), duration = 169 / 24, presentation = 0.7;
    head.updateShutdown(0, duration); assert.equal(head.phase, 'shutdown-reveal'); assert.equal(head.revealProgress, 1);
    head.updateShutdown(0.15, duration); assert.equal(head.revealProgress, 0.5); assert.equal(head.blackout, 0); assert.equal(head.eyeBlend, 1);
    head.updateShutdown(0.5, duration); assert.equal(head.phase, 'shutdown-hud'); assert.equal(head.blackout, 1); assert.ok(Math.abs(head.hudOpacity - 0.5) < 1e-9);
    head.updateShutdown(presentation, duration); assert.equal(head.phase, 'shutdown'); assert.equal(head.loadingProgress, 0); assert.equal(head.hudOpacity, 0);
    const opening = duration - MECHA_MOUNT_HELMET_CLOSE_TIME;
    head.updateShutdown(presentation + opening - 0.04, duration); assert.ok(Math.abs(head.eyeBlend - 0.5) < 1e-8); assert.equal(head.blackout, 1);
    head.updateShutdown(presentation + opening, duration); assert.equal(head.loadingProgress, 1); assert.equal(head.eyeBlend, 0); assert.equal(head.blackout, 1);
    head.updateShutdown(presentation + opening + 0.24, duration); assert.equal(head.phase, 'shutdown-opening'); assert.equal(head.blackout, 0); assert.equal(head.targetingReady, false);
});

test('opening relocates under black, native folding reverses, and closing restores targeting only after returning to eye', () => {
    for (const step of [1 / 30, 1 / 60, 1 / 144, 0.17]) {
        const head = new MechaHeadView(); head.begin(); head.updateStartup(10, 7);
        const advance = (seconds: number) => { for (let t = 0; t < seconds - 1e-9; t += step) head.update(Math.min(step, seconds - t)); };
        head.toggle(); assert.equal(head.targetingReady, false); advance(0.12);
        assert.equal(head.blackout, 1); assert.equal(head.eyeBlend, 1); assert.equal(head.fold, 0);
        advance(0.04); assert.ok(Math.abs(head.eyeBlend - 0.5) < 1e-9); assert.equal(head.blackout, 1);
        advance(0.04); assert.equal(head.eyeBlend, 0); assert.equal(head.fold, 0);
        advance(0.4); assert.ok(Math.abs(head.fold - 0.4) < 1e-8); assert.equal(head.blackout, 0);
        const before = { fold: head.fold, eye: head.eyeBlend, black: head.blackout }; head.toggle();
        assert.deepEqual({ fold: head.fold, eye: head.eyeBlend, black: head.blackout }, before);
        advance(0.4); assert.equal(head.fold, 0); assert.equal(head.targetingReady, false);
        advance(0.12); assert.equal(head.blackout, 1); advance(0.08); assert.equal(head.eyeBlend, 1);
        assert.equal(head.targetingReady, false); advance(0.12); assert.equal(head.targetingReady, true); assert.equal(head.blackout, 0);
        head.toggle(); advance(1.2); assert.equal(head.phase, 'open'); assert.equal(head.eyeBlend, 0); assert.equal(head.fold, 1);
        head.toggle(); advance(1.1); head.toggle(); const blend = head.eyeBlend, black = head.blackout;
        head.update(0); assert.equal(head.eyeBlend, blend); assert.equal(head.blackout, black);
        advance(1.4); assert.equal(head.phase, 'open'); assert.equal(head.fold, 1);
        head.reset(); assert.equal(head.phase, 'inactive'); assert.equal(head.blackout, 0); assert.equal(head.targetingReady, false);
    }
});

test('head camera matches actual eye, interior helmet blocks vision, and per-view overrides restore external model', async () => {
    const asset = await loadIronmawTestAsset();
    const hinge = asset.animations.find(clip => clip.name === 'Mount')!.tracks.find(track => track.name === 'CTRL_Helmet_Rear.quaternion')!;
    const final = new THREE.Quaternion().fromArray(hinge.values, hinge.values.length - 4);
    const interpolate = hinge.createInterpolant();
    assert.ok(new THREE.Quaternion().fromArray(interpolate.evaluate(MECHA_MOUNT_HELMET_CLOSE_TIME)).angleTo(final) < 1e-5);
    assert.ok(new THREE.Quaternion().fromArray(interpolate.evaluate(MECHA_MOUNT_HELMET_CLOSE_TIME - 1 / 24)).angleTo(final) > 1e-5);
    const actor = new ForgottenMecha([], [], 42); actor.install(asset); actor.group.position.set(0, 0, 0); actor.group.rotation.y = 0;
    const absent = { position: new THREE.Vector3(), alive: false, grounded: false };
    const advance = (seconds: number) => { for (let t = 0; t < seconds - 1e-9; t += 1 / 60) actor.update(Math.min(1 / 60, seconds - t), absent); };
    try {
        actor.damage(50); advance(6.1); actor.beginBoarding(actor.seatAnchor.getWorldPosition(new THREE.Vector3()), new THREE.Quaternion()); advance(0.45 + 1.05);
        const helmet = actor.group.getObjectByName('M_HelmetShell') as THREE.SkinnedMesh<THREE.BufferGeometry, THREE.Material>;
        const originalSide = helmet.material.side; actor.preparePilotView(true); assert.equal(helmet.visible, true); assert.equal(helmet.material.side, THREE.DoubleSide);
        helmet.computeBoundingBox(); helmet.computeBoundingSphere();
        const direction = new THREE.Vector3(0, 0, -1).applyQuaternion(actor.pilot.cameraQuaternion);
        assert.ok(new THREE.Raycaster(actor.pilot.cameraPosition, direction, 0.1, 5).intersectObject(helmet).length, 'physical helmet obstructs the interior camera');
        actor.restorePilotView(); assert.equal(helmet.material.side, originalSide); actor.preparePilotView(false); assert.equal(helmet.visible, true); actor.restorePilotView();
        advance(7); assert.equal(actor.mode, 'piloted');
        const eye = actor.group.getObjectByName('PART_EyeLens_01')!;
        assert.ok(actor.pilot.cameraPosition.distanceTo(eye.getWorldPosition(new THREE.Vector3())) < 1e-4);
        assert.ok(Math.abs(actor.viewAnchor.getWorldPosition(new THREE.Vector3()).distanceTo(actor.interiorAnchor.getWorldPosition(new THREE.Vector3())) - MECHA_INTERIOR_VIEW_BACK) < 1e-6);
        actor.setPilotInput(1, false);
        for (let i = 0; i < 60; i++) { actor.look(0.01, 0); actor.update(1 / 60, absent); assert.ok(actor.pilot.cameraPosition.distanceTo(eye.getWorldPosition(new THREE.Vector3())) < 1e-4); }
        actor.toggleHelmet(); actor.update(0.16, absent); const position = actor.pilot.cameraPosition.clone(), phase = actor.headView.phase;
        actor.update(0, absent); assert.equal(actor.headView.phase, phase); assert.ok(actor.pilot.cameraPosition.equals(position));
        actor.damage(50); assert.equal(actor.headView.phase, 'inactive'); assert.equal(actor.headView.blackout, 0); assert.equal(actor.targetingReady, false);
    } finally { actor.dispose(); }
});

test('video reveal holds captures without stopping simulation, caps target size and restores renderer target on failure', async () => {
    const effects = new MechaHeadEffects(), world = new THREE.Scene(), camera = new THREE.Camera(), original = new THREE.WebGLRenderTarget(1, 1);
    let target = original, captures = 0, screens = 0, fail = false;
    const renderer = {
        getRenderTarget: () => target,
        setRenderTarget: (value: THREE.WebGLRenderTarget) => { target = value; },
        getDrawingBufferSize: (size: THREE.Vector2) => size.set(3840, 2160),
        clear() {}, compileAsync: async () => {},
        render: (scene: THREE.Scene) => {
            if (scene === world) { captures++; assert.equal(target.width, 1920); assert.equal(target.height, 1080); if (fail) throw new Error('draw failed'); }
            else { screens++; assert.ok(target === original); }
        },
    } as unknown as THREE.WebGLRenderer;
    try {
        await effects.prepare(renderer); assert.ok(target === original);
        effects.render(renderer, world, camera, 0); effects.render(renderer, world, camera, 0.1); assert.equal(captures, 1); assert.equal(screens, 2);
        effects.render(renderer, world, camera, 0.4); assert.equal(captures, 2); fail = true;
        assert.throws(() => effects.render(renderer, world, camera, 0.8), /draw failed/); assert.ok(target === original);
        fail = false; let releases = 0;
        renderer.setRenderTarget = value => { if (value !== original) value.addEventListener('dispose', () => releases++); target = value!; };
        effects.render(renderer, world, camera, 0.8);
        const beforeReverse = captures;
        effects.render(renderer, world, camera, 1); effects.render(renderer, world, camera, 0.9);
        assert.equal(captures, beforeReverse + 2, 'reverse playback captures as the progress steps decrease');
        effects.render(renderer, world, camera, 0.8); assert.equal(captures, beforeReverse + 2, 'held reverse frame');
        effects.render(renderer, world, camera, 0.1); assert.equal(captures, beforeReverse + 3);
        effects.dispose(); effects.dispose(); assert.equal(releases, 4);
    } finally { effects.dispose(); original.dispose(); }
});
