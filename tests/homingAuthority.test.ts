import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { state } from '../src/state.ts';
import { ShotLedger } from '../src/shotAuthority.ts';
import { TargetMotionHistory, homingReplayCandidates } from '../src/projectileFlight.ts';
import { PROJECTILE_GUIDANCE_STEP, HOMING_HISTORY_SAMPLES, HOMING_REPLAY_CANDIDATES, HOMING_VERIFICATION_STEPS_PER_SECOND, MINIGUN_RAMP_TIME, WEAPON_STATS } from '../src/config.ts';
import { createAkimboGuns, disposePlayerVisuals, fireProjectile } from '../src/weapons.ts';
import { setProjectileHomingTarget, resolveProjectileHomingTarget, isHomingTargetInRange } from '../src/projectileHoming.ts';
import { resetProjectiles, updateProjectiles } from '../src/projectiles.ts';
import { setWeaponNetworkPort } from '../src/weaponNetworkPort.ts';
import { rebuildTargetHash } from '../src/world.ts';
import { disposeParticles } from '../src/particles.ts';
import { segmentAabbHitT, segmentGroundHitT } from '../src/gameplayMath.ts';
import type { FirePacket, HitTargetPacket, WeaponName } from '../src/networkTypes.ts';

const v = (x = 0, y = 3, z = 0) => new THREE.Vector3(x, y, z);
const fire = (target: THREE.Vector3, rest = {}): FirePacket => ({ type: 'fire', shotId: 1, spreadSeed: 42, weapon: 'AR',
    barrelPos: v(), dir: v(0, 0, -1), homingTarget: { kind: 'npc', targetIndex: 0, targetRevision: 0 },
    homingStartDistance: target.distanceTo(v()) / 3, ...rest });
function context(position: THREE.Vector3) {
    const history = new TargetMotionHistory(); history.add(1000, position);
    return { history, kind: 'sphere' as const, radius: 1.6, aimRadius: Math.sqrt(3), canAcquire: () => true };
}

test('real client weapon flights remain host-verifiable at fixed and variable frame rates', t => {
    t.mock.method(crypto, 'getRandomValues', (array: Uint32Array) => { array[0] = 42; return array; });
    let accepted = 0;
    try {
        for (const weapon of ['PISTOL', 'AR', 'SHOTGUN', 'MINIGUN'] as WeaponName[]) {
            for (const frames of [[1 / 240], [1 / 60], [0.006, 0.023, 0.014, 0.041]]) {
                for (const [distance, speed, lag = 0, edge = 0] of [[9, 0], [120, 0], [240, 35], [240, 35, 60], [400, 150], [620, 0], [700, 5, 0, 1]]) {
                    state.scene = new THREE.Scene(); state.camera = new THREE.PerspectiveCamera();
                    state.camera.position.copy(v()); state.camera.lookAt(v(0, 3, -100));
                    Object.assign(state, { isScoped: true, isMultiplayer: true, isHost: false, projectiles: [], projectilePool: [], peers: {}, peerIds: [], obstacles: [] });
                    createAkimboGuns(); state.activeWeaponName = weapon;
                    state.rightGun = ({ PISTOL: state.pistolMesh, AR: state.arMesh, SHOTGUN: state.shotgunMesh, MINIGUN: state.minigunMesh } as any)[weapon];
                    state.minigunRamp = MINIGUN_RAMP_TIME;
                    const target = new THREE.Group(), body = new THREE.Mesh(new THREE.BoxGeometry(2, 2, 2));
                    target.position.copy(v(distance === 9 ? 0 : 1.5, 3, -distance)); target.add(body);
                    if (edge) {
                        state.scene.updateMatrixWorld(true);
                        const barrel = state.rightGun!.getWorldPosition(new THREE.Vector3());
                        target.position.z = barrel.z + WEAPON_STATS[weapon].recoil - (700 + Math.sqrt(3) - 0.02);
                        body.quaternion.setFromUnitVectors(v(1, 1, 1).normalize(), v(0, 0, 1));
                    }
                    target.userData = { index: 0, hp: 100, scale: 1, eliminationRevision: 0, bodyMesh: body };
                    state.targets = [target]; rebuildTargetHash();
                    const initial = target.position.clone(), authority = context(initial), ledger = new ShotLedger();
                    if (weapon === 'MINIGUN') ledger.updateTrigger(true, -3000);
                    const claims: HitTargetPacket[] = []; let packet!: FirePacket;
                    setWeaponNetworkPort({ broadcastLocalFire: (barrelPos, dir, _hit, shotId, spreadSeed, homingTarget, homingStartDistance) => {
                        packet = { type: 'fire', barrelPos: barrelPos.clone(), dir: dir.clone(), shotId, spreadSeed, weapon, homingTarget, homingStartDistance };
                    }, broadcastToAll: claim => { if (claim.type === 'hit_target') claims.push(claim); }, flashPeerMesh: () => {} });
                    setProjectileHomingTarget({ kind: 'npc', object: target, targetIndex: 0, targetRevision: 0 });
                    state.scene.updateMatrixWorld(true); fireProjectile();
                    assert.ok(ledger.record(packet, 1000, false, authority), `${weapon} acquisition at ${distance}`);
                    const count = state.projectiles.length;
                    let elapsed = 0, frame = 0;
                    while (state.projectiles.length && elapsed < 0.95) {
                        const delta = frames[frame++ % frames.length]; elapsed += delta;
                        const velocity = speed === 150 || speed === 5 ? v(0, 0, speed) : v(speed, 0, 0);
                        target.position.copy(initial).addScaledVector(velocity, Math.max(0, elapsed - lag / 1000));
                        authority.history.add(1000 + elapsed * 1000, initial.clone().addScaledVector(velocity, elapsed));
                        rebuildTargetHash(); updateProjectiles(delta, 'Pilot');
                    }
                    assert.ok(claims.length, `${weapon} should hit ${distance}m target moving ${speed}m/s with ${frames}`);
                    for (const claim of claims) {
                        assert.ok(ledger.consumeHomingNpc(claim.shotId, claim.pelletIndex, 0, 0, authority.history.samples.at(-1)!.position, 1.6, claim.damage,
                            1000 + elapsed * 1000, () => false), `${weapon} actual curved client hit rejected (${distance}, ${speed}, ${frames})`);
                        accepted++;
                    }
                    assert.equal(state.projectilePool.length, count, 'each retired guided pellet returns to the pool exactly once');
                    resetProjectiles(); disposeParticles(); disposePlayerVisuals(); body.geometry.dispose(); (body.material as THREE.Material).dispose();
                }
            }
        }
        t.diagnostic(`${accepted} real client pellet claims accepted across 84 weapon/distance/motion/observation-lag/frame combinations`);
    } finally {
        setProjectileHomingTarget(null); resetProjectiles(); disposeParticles(); disposePlayerVisuals();
        Object.assign(state, { targets: [], scene: null, camera: null, isMultiplayer: false, isScoped: false }); rebuildTargetHash();
    }
});

test('guided authority rejects invented distance, early arrival, wrong life, replay and curved-path cover', () => {
    const target = v(4, 3, -240), ctx = context(target), packet = fire(target), ledger = new ShotLedger();
    for (const threshold of [0, -1, Infinity, packet.homingStartDistance! + 10]) {
        assert.equal(ledger.record({ ...packet, homingStartDistance: threshold }, 1000, false, ctx), false);
    }
    assert.ok(ledger.record(packet, 1000, false, ctx));
    assert.equal(ledger.consumeHomingNpc(1, 0, 0, 0, target, 1.6, 1, 1001, () => false), false, '240m cannot be reached in 101ms');
    assert.equal(ledger.consumeHomingNpc(1, 0, 0, 1, target, 1.6, 1, 1400, () => false), false);
    const wallMin = v(-100, -10, -125), wallMax = v(100, 20, -120);
    assert.equal(ledger.consumeHomingNpc(1, 0, 0, 0, target, 1.6, 1, 1400,
        (a, b) => segmentAabbHitT(a, b, wallMin, wallMax) !== null), false);
    assert.equal(ledger.consume(1, 0, v(80, 3, -80), 1.6, 1, 1400, () => false), false, 'off-path fallback cannot bypass flight');
    assert.equal(ledger.consume(1, 0, target, 1.6, 1, 1400, () => false,
        { kind: 'npc', targetIndex: 0, targetRevision: 1 }), false, 'a replacement life cannot use incidental-hit fallback');
    assert.ok(ledger.consumeHomingNpc(1, 0, 0, 0, target, 1.6, 1, 1400, () => false));
    assert.equal(ledger.consumeHomingNpc(1, 0, 0, 0, target, 1.6, 1, 1400, () => false), false);
    const below = v(0, -3, -20), floorLedger = new ShotLedger(), floorCtx = context(below);
    assert.ok(floorLedger.record(fire(below, { dir: v(0, -0.2, -1).normalize() }), 1000, false, floorCtx));
    assert.equal(floorLedger.consumeHomingNpc(1, 0, 0, 0, below, 1.6, 1, 1200,
        (a, b, radius) => segmentGroundHitT(a, b, radius) !== null), false);
});

test('bounded target history tolerates observation lag, retains ten-shot samples and caps repeated verification work', t => {
    const target = v(0, 3, -120), ctx = context(target), ledger = new ShotLedger();
    ledger.updateTrigger(true, -3000);
    const packet = fire(target, { weapon: 'MINIGUN' });
    assert.ok(ledger.record(packet, 1000, false, ctx));
    for (let i = 1; i <= 9; i++) {
        target.z -= 3; ctx.history.add(1000 + i * 70, target);
        assert.ok(ledger.record({ ...packet, shotId: i + 1 }, 1000 + i * 70, false, ctx), 'sample reuse inside the ten-shot batch');
    }
    target.z -= 30; ctx.history.add(1700, target);
    assert.equal(ledger.record({ ...packet, shotId: 11 }, 1700, false, ctx), false, 'an eleventh stale sample must match recent host history');
    assert.ok(ledger.record({ ...packet, shotId: 11, homingStartDistance: target.distanceTo(v()) / 3 }, 1700, false, ctx));
    const moving = new TargetMotionHistory(); moving.add(900, v(0, 3, -120)); moving.add(1000, v(3.5, 3, -120));
    const distance = v(1.75, 3, -120).distanceTo(v());
    const candidates = homingReplayCandidates(moving, v(), distance, 1000);
    assert.ok(candidates.some(c => Math.abs(c.lagMs - 50) < 1e-6 && !c.filtered));
    assert.ok(candidates.length <= HOMING_REPLAY_CANDIDATES);
    const invalidFire = new ShotLedger(); let contexts = 0;
    for (let id = 1; id <= 1000; id++) assert.equal(invalidFire.record({ ...fire(v(0, 3, -120)), shotId: id, homingStartDistance: 1 },
        1000, false, () => { contexts++; return context(v(0, 3, -120)); }), false);
    assert.ok(contexts <= Math.floor(HOMING_VERIFICATION_STEPS_PER_SECOND / (HOMING_HISTORY_SAMPLES * 2)),
        'zero-candidate forged fires must not bypass the acquisition-work budget');
    const flood = new TargetMotionHistory();
    for (let i = 0; i < 20_000; i++) flood.add(i / 10, v(i / 1000));
    assert.equal(flood.samples.length, HOMING_HISTORY_SAMPLES);
    assert.ok(flood.samples.at(-1)!.at - flood.samples[0].at > 1000, 'packet floods cannot erase flight history');
    const attack = new ShotLedger(), far = v(1, 3, -650), attackCtx = context(far);
    assert.ok(attack.record(fire(far), 1000, false, attackCtx));
    let sweeps = 0; const started = performance.now();
    for (let i = 0; i < 1000; i++) attack.consume(1, 0, v(80, 3, -80), 1.6, 1, 1800, () => { sweeps++; return false; });
    assert.ok(sweeps <= HOMING_VERIFICATION_STEPS_PER_SECOND, `unbounded replay work: ${sweeps}`);
    t.diagnostic(`1000 invalid claims: ${sweeps} collision sweeps in ${(performance.now() - started).toFixed(1)}ms; at most ${Math.ceil(700 / (900 * PROJECTILE_GUIDANCE_STEP)) * HOMING_REPLAY_CANDIDATES} steps per claim`);
});

test('a fast lateral escape cannot be converted into a guaranteed guided hit', () => {
    const initial = v(1.5, 3, -400), ctx = context(initial), ledger = new ShotLedger();
    assert.ok(ledger.record(fire(initial), 1000, false, ctx));
    for (let elapsed = 10; elapsed <= 700; elapsed += 10) ctx.history.add(1000 + elapsed, initial.clone().addScaledVector(v(150, 0, 0), elapsed / 1000));
    const current = initial.clone().add(v(105, 0, 0));
    assert.equal(ledger.consumeHomingNpc(1, 0, 0, 0, current, 1.6, 1, 1700, () => false), false);
});

test('physical homing survives peer render culling but stops on a new peer life', () => {
    const mesh = new THREE.Group(); mesh.position.copy(v(0, 3, -100)); mesh.visible = false;
    const target = { kind: 'peer' as const, object: mesh, targetPeerId: 'peer', targetLifeId: 1 };
    const peers = { peer: { mesh, hp: 10, lifeId: 1 } };
    assert.ok(resolveProjectileHomingTarget(target, [], peers, v()));
    assert.equal(isHomingTargetInRange(target, v(), 700), true);
    peers.peer.lifeId = 2;
    assert.equal(resolveProjectileHomingTarget(target, [], peers, v()), null);
});
