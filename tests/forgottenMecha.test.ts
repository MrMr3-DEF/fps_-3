import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { ForgottenMecha, navigationBoxes, type MechaPlayer, type MechaImpact } from '../src/forgottenMecha.ts';
import { MechaNavigation } from '../src/mechaNavigation.ts';
import { MECHA_HEIGHT, MECHA_HP, MECHA_STOMP_RADIUS, LAVA_POOL_HALF_SIZE, MAP_HALF_SIZE, TOWN_HALF_SIZE, TOWN_WALL_THICKNESS } from '../src/config.ts';
import { loadIronmawTestAsset } from './ironmawTestAsset.ts';
import { resolveProjectileHomingTarget, toHomingTargetPacket, type ProjectileHomingTarget } from '../src/projectileHoming.ts';
import { state } from '../src/state.ts';
import { userSettings } from '../src/settings.ts';
import { createEnvironment, disposeWorld, setWorldSeed, prepareForgottenMecha, forgottenMecha, queryObstaclesNear } from '../src/world.ts';
import { CameraShake } from '../src/cameraShake.ts';
import { SmartGogglesHud } from '../src/smartGoggles.ts';
import { HudElement } from './fakeHudDom.ts';
import { getProjectileHomingTarget } from '../src/projectileHoming.ts';
import { updateProjectiles, disposeProjectiles } from '../src/projectiles.ts';
import { disposeParticles } from '../src/particles.ts';
import { setDamageHandlers } from '../src/damage.ts';

async function robot(obstacles: THREE.Object3D[] = []) {
    const impacts: MechaImpact[] = [];
    let kills = 0, gameOvers = 0;
    const laserDamage: number[] = [];
    const actor = new ForgottenMecha(obstacles, [], 42, {
        impact: kind => impacts.push(kind), stompPlayer: () => kills++, gameOver: () => gameOvers++,
        laserPlayer: damage => laserDamage.push(damage),
    });
    actor.install(await loadIronmawTestAsset());
    return { actor, impacts, laserDamage, kills: () => kills, gameOvers: () => gameOvers };
}
function advance(actor: ForgottenMecha, seconds: number, player: MechaPlayer) {
    for (let elapsed = 0; elapsed < seconds - 1e-9; elapsed += 1 / 60) {
        actor.flushRenderedDamage(player.lifeId ?? 0); actor.update(Math.min(1 / 60, seconds - elapsed), player);
        const beam = actor.combat.effects.group.getObjectByName('Forgotten Mecha laser beam') as THREE.Mesh;
        if (beam.visible) (beam.onAfterRender as () => void)();
        actor.acknowledgeRendered();
    }
}
function near(actor: ForgottenMecha, distance = 30): MechaPlayer {
    return { position: actor.group.position.clone().add(new THREE.Vector3(0, 2, distance)), grounded: true, alive: true };
}
const absent: MechaPlayer = { position: new THREE.Vector3(), grounded: false, alive: false };

test('real lens anchors pitched beam; close entry waits for committed laser before stomping', async () => {
    const { actor, laserDamage } = await robot(); actor.group.rotation.y = 0;
    const player = near(actor, 60); player.position.y = 28; player.grounded = false;
    advance(actor, 3.15, player);
    assert.equal(actor.combat.laserPhase, 'firing'); assert.deepEqual(laserDamage, []); actor.flushRenderedDamage(0); assert.deepEqual(laserDamage, [10]);
    assert.ok(Math.abs(actor.combat.eyeRadius * 2 - 2.622338) < 1e-5);
    assert.ok(Math.abs(actor.combat.beamOrigin.y - 23.30974) < 1e-4);
    assert.ok(actor.combat.beamDirection.y > 0);
    player.position.z = actor.group.position.z + 25; actor.update(1 / 60, player);
    assert.equal(actor.mode, 'tracking'); assert.equal(actor.combat.laserPhase, 'firing');
    advance(actor, 1.25, player); assert.equal(actor.combat.laserPhase, 'idle'); assert.equal(actor.combat.shotCount, 1);
    advance(actor, 3.1, player); assert.equal(actor.mode, 'tracking');
    advance(actor, 0.5, player); assert.equal(actor.mode, 'tracking', 'close exclusion remains even while stomp is cooling down');
    assert.equal(actor.combat.laserPhase, 'idle'); actor.dispose();
});

test('victim sees beam interior before lethal damage, and a scene acknowledgment alone cannot deliver it', async () => {
    let hp = 10;
    const actor = new ForgottenMecha([], [], 42, { impact() {}, stompPlayer() {}, gameOver() {}, laserPlayer: damage => { hp -= damage; } });
    actor.install(await loadIronmawTestAsset()); actor.group.rotation.y = 0;
    const player = near(actor, 80); player.lifeId = 7;
    try {
        for (let frame = 0; frame < 240 && actor.combat.shotCount === 0; frame++) actor.update(1 / 60, player);
        const beam = actor.combat.effects.group.getObjectByName('Forgotten Mecha laser beam') as THREE.Mesh;
        actor.combat.effects.group.updateMatrixWorld(true);
        const direction = actor.combat.beamOrigin.clone().sub(player.position).normalize().add(new THREE.Vector3(0.05, 0, 0)).normalize();
        assert.ok(new THREE.Raycaster(player.position, direction, 0.1, 700).intersectObject(beam).length, 'inside-facing surface is visible from the victim');
        actor.acknowledgeRendered(); actor.flushRenderedDamage(7); assert.equal(hp, 10, 'beam has not drawn');
        actor.update(0, player); assert.equal(hp, 10, 'pause keeps captured damage pending');
        (beam.onAfterRender as () => void)(); actor.acknowledgeRendered(); assert.equal(hp, 10, 'draw precedes damage');
        const clock = actor.combat.clock, scale = beam.scale.clone();
        actor.flushRenderedDamage(7); assert.equal(hp, 0);
        assert.equal(actor.combat.clock, clock); assert.ok(beam.visible); assert.ok(beam.scale.equals(scale), 'lethal delivery retains drawn beam');
        actor.flushRenderedDamage(7); assert.equal(hp, 0, 'single delivery');
    } finally { actor.dispose(); }
});

test('real torso keeps up with walking circles at 50m and farther, while close circles and grappling evade', async () => {
    for (const [radius, speed, catches] of [[50, 18.261, true], [75, 18.261, true], [30, 18.261, false], [50, 70, false]] as const) {
        const { actor } = await robot(); actor.group.rotation.y = 0;
        const player = near(actor, radius); player.position.y = 29;
        for (let frame = 1; frame <= 60; frame++) {
            const angle = speed / radius * frame / 60;
            player.position.x = actor.group.position.x + Math.sin(angle) * radius;
            player.position.z = actor.group.position.z + Math.cos(angle) * radius;
            actor.update(1 / 60, player);
        }
        const waist = actor.group.getObjectByName('CTRL_WaistYaw')!;
        const yaw = 2 * Math.atan2(waist.quaternion.z, waist.quaternion.w);
        const error = Math.abs(speed / radius - yaw);
        assert.ok(catches ? error < 0.001 : error > 0.2, `radius ${radius}, speed ${speed}, error ${error}`);
        actor.dispose();
    }
});

test('shield shutdown freezes the complete live actor and death prevents recovery', async () => {
    const { actor } = await robot(); actor.group.rotation.y = 0;
    const player = near(actor, 60); advance(actor, 3.15 + 1.2 + (8.15 + 3 + 1.2) * 3 + 1.6, player);
    assert.equal(actor.combat.shieldPhase, 'down');
    const position = actor.group.position.clone(), waist = actor.group.getObjectByName('CTRL_WaistYaw')!.quaternion.clone();
    player.position.x += 60; advance(actor, 5, player);
    assert.deepEqual(actor.group.position.toArray(), position.toArray());
    assert.ok(waist.angleTo(actor.group.getObjectByName('CTRL_WaistYaw')!.quaternion) < 1e-8);
    assert.equal(actor.damage(50).killed, true); advance(actor, 20, player);
    assert.equal(actor.mode, 'dead'); assert.equal(actor.combat.shieldPhase, 'disabled'); assert.equal(actor.hp, 0); actor.dispose();
});

test('real Ironmaw skin fits 28m, preserves proportional stride, and starts on a reachable border', async () => {
    const { actor } = await robot();
    assert.ok(Math.abs(actor.hitbox.scale.y - MECHA_HEIGHT) < 1e-5);
    assert.ok(Math.abs(actor.speed - 6.09455452) < 1e-5);
    assert.equal(actor.colliders.length, 25);
    assert.equal(actor.hp, MECHA_HP);
    assert.ok(Math.max(Math.abs(actor.group.position.x), Math.abs(actor.group.position.z)) >= MAP_HALF_SIZE - 40);
    const spawn = actor.group.position.clone();
    advance(actor, 1, absent);
    assert.ok(actor.group.position.distanceTo(spawn) > 3);
    assert.ok(actor.group.position.distanceTo(spawn) <= actor.speed + 1e-5);
    actor.dispose();
});

test('detection stops translation, tracks independently, and resumes on range/LOS loss', async () => {
    const blocker = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial());
    blocker.position.set(0, 15, 0); blocker.scale.set(20, 30, 2);
    blocker.userData = { halfW: 10, halfD: 1, halfH: 15, height: 30 };
    blocker.updateMatrixWorld(true);
    const { actor } = await robot([blocker]);
    const spawn = actor.group.position.clone(), heading = actor.group.rotation.y;
    // Hold laser reload to isolate tracking. Above 28m is now an attackable
    // rocket region, rather than a height loophole for a passive fixture.
    actor.combat.reloadRemaining = Infinity;
    const player = near(actor, 100);
    advance(actor, 0.8, player);
    assert.equal(actor.mode, 'tracking');
    assert.deepEqual(actor.group.position.toArray(), spawn.toArray());
    assert.equal(actor.group.rotation.y, heading);
    const waist = actor.group.getObjectByName('CTRL_WaistYaw')!;
    const firstYaw = waist.quaternion.clone();
    advance(actor, 0.5, player);
    assert.ok(firstYaw.angleTo(waist.quaternion) <= 0.366 * 0.5 + 1e-6, 'torso stays within the angular speed cap');
    advance(actor, 5, player);
    const settledYaw = waist.quaternion.clone(); advance(actor, 0.5, player);
    assert.ok(settledYaw.angleTo(waist.quaternion) < 0.001, 'aim converges without accumulating quaternion offsets');
    blocker.position.set(spawn.x, 15, spawn.z + 15); blocker.updateMatrixWorld(true);
    advance(actor, 0.05, player);
    assert.equal(actor.mode, 'walking', 'a solid pillar blocks detection');
    blocker.position.set(0, 15, 0); blocker.updateMatrixWorld(true);
    player.position.copy(spawn).add(new THREE.Vector3(0, 2, 100)); player.grounded = false;
    advance(actor, 0.1, player);
    assert.equal(actor.mode, 'tracking');
    player.position.copy(spawn).add(new THREE.Vector3(0, 2, 131));
    advance(actor, 0.05, player);
    assert.equal(actor.mode, 'walking');
    actor.dispose(); blocker.geometry.dispose(); (blocker.material as THREE.Material).dispose();
});

test('stomp hits once at exported foot contact and cooldown starts after completion for five seconds', async () => {
    const { actor, impacts, kills } = await robot();
    const player = near(actor, MECHA_STOMP_RADIUS - 1);
    advance(actor, 1.6, player);
    assert.equal(kills(), 0);
    advance(actor, 0.05, player);
    assert.equal(kills(), 1);
    assert.equal(impacts.filter(kind => kind === 'stomp').length, 1);
    advance(actor, 1.4, player);
    assert.equal(actor.mode, 'tracking');
    advance(actor, 4.9, player);
    assert.equal(actor.mode, 'tracking');
    advance(actor, 0.15, player);
    assert.equal(actor.mode, 'stomping');
    actor.dispose();
});

test('stopping from either support phase settles both feet onto the floor', async () => {
    for (const walkSeconds of [0.4, 0.7, 1.1, 1.4]) {
        const { actor } = await robot();
        advance(actor, walkSeconds, absent);
        advance(actor, 1, near(actor, 60));
        for (const side of ['L', 'R']) {
            const foot = actor.group.getObjectByName(`M_Foot_${side}`)!;
            assert.ok(Math.abs(new THREE.Box3().setFromObject(foot, true).min.y) < 0.005, `grounded ${side} after stopping at ${walkSeconds}s`);
        }
        actor.dispose();
    }
});

test('jumping or leaving the damage radius during wind-up avoids stomp damage', async () => {
    for (const escape of ['jump', 'range']) {
        const { actor, impacts, kills } = await robot();
        const player = near(actor, 8);
        advance(actor, 1, player);
        if (escape === 'jump') { player.grounded = false; player.position.y += 5; }
        else player.position.z = actor.group.position.z + MECHA_STOMP_RADIUS + 1;
        advance(actor, 0.8, player);
        assert.equal(kills(), 0);
        assert.equal(impacts.filter(kind => kind === 'stomp').length, 1);
        actor.dispose();
    }
});

test('a close airborne player still triggers the stomp impact without taking ground damage', async () => {
    const { actor, impacts, kills } = await robot();
    const player = near(actor, 8);
    player.grounded = false;
    player.position.y += 5;
    advance(actor, 0.1, player);
    assert.equal(actor.mode, 'stomping');
    advance(actor, 1.6, player);
    assert.equal(impacts.filter(kind => kind === 'stomp').length, 1);
    assert.equal(kills(), 0);
    actor.dispose();
});

test('ordinary Death emits knee/fist impacts once, cancels attacks and homing, and holds a solid corpse', async () => {
    const { actor, impacts, gameOvers, kills } = await robot();
    const lock: ProjectileHomingTarget = { kind: 'mecha', actor, object: actor.group, targetRevision: actor.revision };
    assert.equal(toHomingTargetPacket(lock), undefined);
    assert.ok(resolveProjectileHomingTarget(lock, [], {}, new THREE.Vector3()));
    const player = near(actor, 8);
    advance(actor, 0.2, player);
    assert.deepEqual(actor.damage(50), { accepted: true, killed: true });
    assert.equal(resolveProjectileHomingTarget(lock, [], {}, new THREE.Vector3()), null);
    advance(actor, 7, player);
    assert.equal(actor.mode, 'dead');
    assert.deepEqual(impacts.filter(kind => kind !== 'step'), ['knees', 'fists']);
    assert.equal(gameOvers(), 0); assert.equal(kills(), 0);
    const position = actor.hitbox.position.clone();
    advance(actor, 10, player);
    assert.deepEqual(actor.hitbox.position.toArray(), position.toArray());
    assert.equal(actor.colliders.length, 25);
    assert.equal(actor.damage(10).accepted, false);
    actor.dispose();
});

test('wall punch becomes invulnerable immediately and game over waits for the whole clip', async () => {
    const { actor, impacts, gameOvers } = await robot();
    const point = { x: actor.group.position.x, z: actor.group.position.z };
    actor.route = { points: [point, point], heading: 0 };
    actor.update(1 / 60, absent);
    assert.equal(actor.mode, 'punching');
    assert.equal(actor.damage(1000).accepted, false);
    assert.equal(actor.hp, 50);
    advance(actor, 1.5, absent);
    assert.equal(impacts.filter(kind => kind === 'punch').length, 1);
    assert.equal(gameOvers(), 0);
    advance(actor, 2.1, absent);
    assert.equal(actor.mode, 'game-over'); assert.equal(gameOvers(), 1);
    advance(actor, 10, absent); assert.equal(gameOvers(), 1);
    actor.dispose();
});

test('seeded real worlds offer repeatable border routes with footprint clearance around lava and pillars', () => {
    const context = new Proxy({}, { get: () => () => {} });
    Object.assign(globalThis, { document: { getElementById: () => null, createElement: () => ({ getContext: () => context }) } });
    for (const seed of [0, 1, 42, 12345, 987654321, 0xffffffff]) {
        state.scene = new THREE.Scene(); state.isMultiplayer = false; setWorldSeed(seed); createEnvironment(true);
        const obstacles = navigationBoxes(state.obstacles);
        const lava = state.lavaPools.map(pool => ({ x: pool.position.x, z: pool.position.z, halfW: LAVA_POOL_HALF_SIZE, halfD: LAVA_POOL_HALF_SIZE, bottom: 0, top: 0.15 }));
        const radius = 14.8, nav = new MechaNavigation(obstacles, lava, radius, 19.953);
        const route = nav.borderSpawn(seed);
        assert.deepEqual(nav.borderSpawn(seed), route);
        for (let i = 1; i < route.points.length; i++) {
            const a = route.points[i - 1], b = route.points[i];
            if (i < route.points.length - 1) assert.equal(nav.segmentClear(a, b), true);
            for (let step = 0; step <= Math.ceil(Math.hypot(a.x - b.x, a.z - b.z)); step++) {
                const t = step / Math.max(1, Math.ceil(Math.hypot(a.x - b.x, a.z - b.z))), x = a.x + (b.x - a.x) * t, z = a.z + (b.z - a.z) * t;
                assert.ok(![...obstacles, ...lava].some(box => box.bottom < 28 && box.top > 0 && Math.abs(x - box.x) < box.halfW + radius && Math.abs(z - box.z) < box.halfD + radius), `footprint seed ${seed} segment ${i}`);
            }
        }
        const end = route.points.at(-1)!;
        assert.ok(Math.abs(Math.max(Math.abs(end.x), Math.abs(end.z)) - (TOWN_HALF_SIZE + TOWN_WALL_THICKNESS / 2 + 19.953)) < 0.01);
        disposeWorld();
    }
});

test('shake is temporary and only changes the render quaternion', () => {
    const shake = new CameraShake(), camera = new THREE.PerspectiveCamera();
    camera.position.set(1, 2, 3); const before = camera.quaternion.clone();
    shake.trigger(0.06, 0.8); shake.update(0.1); shake.apply(camera);
    assert.ok(before.angleTo(camera.quaternion) > 0.01);
    assert.deepEqual(camera.position.toArray(), [1, 2, 3]);
    camera.quaternion.copy(before); shake.update(0.8); shake.apply(camera);
    assert.ok(before.angleTo(camera.quaternion) < 1e-10);
});

test('world preparation registers moving body proxies, routes bullets to health, and disposes the actor', async () => {
    const context = new Proxy({}, { get: () => () => {} });
    Object.assign(globalThis, { document: { getElementById: () => null, createElement: () => ({ getContext: () => context }) } });
    state.scene = new THREE.Scene(); state.renderer = null; state.isMultiplayer = false;
    setWorldSeed(42); createEnvironment(true);
    const originalLoad = ForgottenMecha.prototype.load;
    ForgottenMecha.prototype.load = async function () { this.install(await loadIronmawTestAsset()); };
    const events = { impact() {}, stompPlayer() {}, gameOver() {} };
    try {
        await prepareForgottenMecha(events, async () => {});
        const actor = forgottenMecha!;
        assert.ok(actor.ready);
        const nearby = queryObstaclesNear(actor.group.position.x, actor.group.position.z, 25);
        assert.ok(actor.colliders.every(collider => nearby.includes(collider)));
        setDamageHandlers(() => {}, () => {}, (damage, hit) => actor.damage(damage, hit));
        const bullet = new THREE.Mesh(new THREE.SphereGeometry(0.1), new THREE.MeshBasicMaterial());
        bullet.position.copy(actor.hitbox.position).add(new THREE.Vector3(0, 60, 0));
        bullet.userData = { dx: 0, dy: -1, dz: 0, age: 0, distanceTraveled: 0, visualOnly: false, damage: 3 };
        state.projectiles = [bullet]; state.projectilePool = [];
        updateProjectiles(0.05, 'Guest'); updateProjectiles(0.05, 'Guest');
        assert.equal(actor.hp, 50, 'external projectile is stopped at the shield');
        assert.equal(state.projectiles.length, 0);
        bullet.position.copy(actor.combat.shieldCenter).add(new THREE.Vector3(0, 10, 0));
        bullet.userData = { dx: 0, dy: -1, dz: 0, age: 0, distanceTraveled: 0, visualOnly: false, damage: 3 };
        state.projectiles.push(bullet);
        updateProjectiles(0.03, 'Guest');
        assert.equal(actor.hp, 47, 'inside-origin projectile can hit the body');
        disposeProjectiles(); bullet.geometry.dispose(); disposeParticles(); disposeWorld();
        assert.equal(actor.disposed, true); assert.equal(forgottenMecha, null);
        assert.equal(actor.colliders.length, 0);
        state.isMultiplayer = true;
        await prepareForgottenMecha(events, async () => {});
        assert.equal(forgottenMecha, null, 'multiplayer cannot create a robot');
        state.isMultiplayer = false;
    } finally { ForgottenMecha.prototype.load = originalLoad; disposeWorld(); }
});

test('leaving during a pending asset load disposes the late model and cannot attach to a replacement scene', async () => {
    state.scene = new THREE.Scene(); state.renderer = null; state.isMultiplayer = false;
    let release!: () => void;
    const pending = new Promise<void>(resolve => { release = resolve; });
    const asset = await loadIronmawTestAsset();
    let disposals = 0;
    asset.scene.traverse(node => { if (node instanceof THREE.Mesh) node.geometry.addEventListener('dispose', () => disposals++); });
    const originalLoad = ForgottenMecha.prototype.load;
    ForgottenMecha.prototype.load = async function () { await pending; this.install(asset); };
    try {
        const preparation = prepareForgottenMecha({ impact() {}, stompPlayer() {}, gameOver() {} }, async () => {});
        const cancelled = assert.rejects(preparation, { name: 'AbortError' });
        const old = forgottenMecha!;
        disposeWorld(); state.scene = new THREE.Scene();
        release(); await cancelled;
        assert.equal(old.disposed, true); assert.equal(forgottenMecha, null);
        assert.equal(state.scene.children.length, 0); assert.equal(disposals, 25);
    } finally { ForgottenMecha.prototype.load = originalLoad; }
});

test('goggles use an orange enemy scan, the exact mecha name/health and an offline homing identity', async () => {
    Object.assign(globalThis, {
        document: { getElementById: (id: string) => id === 'goggles-anomaly-tear-a' ? {} : null, createElement: () => new HudElement(), createElementNS: () => new HudElement() },
        window: { innerWidth: 1280, innerHeight: 720, matchMedia: () => ({ matches: false }) },
    });
    const { actor } = await robot();
    const camera = new THREE.PerspectiveCamera(25, 1280 / 720, 0.1, 1500);
    camera.position.copy(actor.hitbox.position).add(new THREE.Vector3(0, 0, 120));
    camera.lookAt(actor.hitbox.position); camera.updateProjectionMatrix(); camera.updateMatrixWorld(true);
    const layer = new HudElement(), hud = new SmartGogglesHud(layer as any);
    for (const time of [1000, 1200, 1600, 2100]) hud.update(camera, camera.position, camera.position, [], {}, true, time, null, [], true, actor);
    const record = layer.children.find(child => child.dataset.targetKey === 'mecha:forgotten');
    assert.ok(record);
    assert.ok(record.texts().includes('Forgotten Mecha'));
    assert.ok(record.texts().includes('HEALTH: 50 / 50'));
    assert.equal(record.classList.contains('is-peer'), false);
    assert.equal(record.classList.contains('is-anomalous'), false);
    assert.equal(getProjectileHomingTarget()?.kind, 'mecha');
    camera.fov = 8;
    camera.position.copy(actor.hitbox.position).add(new THREE.Vector3(0, 0, 35));
    camera.lookAt(actor.hitbox.position); camera.updateProjectionMatrix(); camera.updateMatrixWorld(true);
    hud.update(camera, camera.position, camera.position, [], {}, true, 2150, null, [], true, actor);
    hud.update(camera, camera.position, camera.position, [], {}, true, 2170, null, [], true, actor);
    const closeRecord = layer.children.find(child => child.dataset.targetKey === 'mecha:forgotten' && child.classList.contains('is-active'))!;
    const label = closeRecord.children.find(child => child.className === 'goggles-target-label')!;
    assert.ok(Number.parseFloat(label.style.width) > 100, 'oversized scope target keeps a readable callout');
    assert.ok(Number.parseFloat(label.style.left) >= 0);
    assert.ok(Number.parseFloat(label.style.top) >= 0 && Number.parseFloat(label.style.top) < 600);
    actor.damage(50);
    hud.update(camera, camera.position, camera.position, [], {}, true, 2200, null, [], true, actor);
    assert.equal(getProjectileHomingTarget(), null);
    assert.equal(closeRecord.classList.contains('is-eliminated'), true);
    hud.reset(); actor.dispose();
});

test('stomp contact must be rendered before guaranteed damage; stale lives and disposal discard it', async () => {
    for (const cancel of ['none', 'life', 'defeat', 'dispose']) {
        const { actor, kills } = await robot(); const player = near(actor, 20); player.lifeId = 7;
        actor.update(0.01, player); actor.update(39 / 24 - 0.01, player);
        assert.equal(kills(), 0); actor.flushRenderedDamage(7); assert.equal(kills(), 0, 'no render acknowledgement');
        actor.acknowledgeRendered(); player.position.z += 100; player.grounded = false;
        if (cancel === 'defeat') actor.damage(50);
        if (cancel === 'dispose') actor.dispose();
        actor.flushRenderedDamage(cancel === 'life' ? 8 : 7);
        assert.equal(kills(), cancel === 'none' ? 1 : 0);
        actor.flushRenderedDamage(7); assert.equal(kills(), cancel === 'none' ? 1 : 0, 'single delivery'); actor.dispose();
    }
});

test('enemy rocket uses real aimed socket and weaker launch profile to hit constant sideways walking across its band', async () => {
    const query = (_sx: number, _sz: number, _ex: number, _ez: number, out: THREE.Object3D[]) => { out.length = 0; return out; };
    for (const dt of [1 / 30, 1 / 144]) for (const range of [25.01, 35, 59.99]) for (const speed of [-18.261, 18.261]) {
        const { actor } = await robot(); actor.group.position.set(0, 0, 0); actor.group.rotation.y = 0;
        const player = { position: new THREE.Vector3(0, 2, range), velocity: new THREE.Vector3(speed, 0, 0), grounded: true, alive: true, lifeId: 7 };
        const hits: number[] = [];
        for (let t = 0; t < 4 && !hits.length; t += dt) {
            actor.update(dt, player);
            actor.pilot.rockets.update(dt, [], query, () => assert.fail('enemy fire cannot damage NPCs'), actor.rocketPlayer, damage => hits.push(damage));
            player.position.x += speed * dt;
        }
        assert.deepEqual(hits, [9], `range ${range}, speed ${speed}, dt ${dt}`);
        assert.equal(actor.combat.shotCount, 1); actor.dispose();
    }
});

test('range boundaries select stomp, rocket or laser and rocket commitment survives close range', async () => {
    for (const [distance, mode] of [[25, 'stomping'], [25.01, 'rocketing'], [59.99, 'rocketing'], [60, 'tracking'], [130, 'tracking'], [130.01, 'walking']] as const) {
        const { actor } = await robot(); actor.group.rotation.y = 0; const player = near(actor, distance);
        actor.update(0.15, player); assert.equal(actor.mode, mode, `${distance}m`);
        if (mode === 'rocketing') {
            player.position.z = actor.group.position.z + 20; advance(actor, 1.4, player);
            assert.equal(actor.mode, 'rocketing'); assert.equal(actor.combat.shotCount, 1);
            advance(actor, 1.5, player); assert.equal(actor.mode, 'stomping');
        }
        actor.dispose();
    }
});

test('real actor selects attacks through the cylinder ceiling and spherical dome, and cover still blocks acquisition', async () => {
    for (const [r, height, mode] of [[25, 28, 'stomping'], [25, 28.001, 'rocketing'], [60, 28, 'tracking'],
        [60, 28.001, 'rocketing'], [130, 28, 'tracking'], [130, 28.001, 'walking'],
        [0, 130, 'rocketing'], [0, 130.001, 'walking'], [120, 50, 'rocketing'], [120, 50.001, 'walking'],
        [100, 100, 'walking'], [45, -0.001, 'walking']] as const) {
        const { actor } = await robot(); actor.group.position.set(37, 12, -81); actor.group.rotation.y = 0;
        const player = { position: actor.group.position.clone().add(new THREE.Vector3(0, height, r)), alive: true, grounded: false };
        try {
            actor.update(0.15, player); assert.equal(actor.mode, mode, `radius ${r}, height ${height}`);
            assert.equal(actor.combat.laserPhase, mode === 'tracking' ? 'charging' : 'idle');
        } finally { actor.dispose(); }
    }
    const cover = new THREE.Mesh(new THREE.BoxGeometry(80, 80, 2), new THREE.MeshBasicMaterial());
    cover.userData = { halfW: 40, halfH: 40, halfD: 1, height: 80 }; cover.position.set(0, 40, 30); cover.updateMatrixWorld(true);
    const { actor } = await robot([cover]); actor.group.position.set(0, 0, 0); actor.group.rotation.y = 0;
    try {
        actor.update(0.15, { position: new THREE.Vector3(0, 80, 60), alive: true, grounded: false });
        assert.equal(actor.mode, 'walking'); assert.equal(actor.combat.shotCount, 0);
    } finally { actor.dispose(); cover.geometry.dispose(); (cover.material as THREE.Material).dispose(); }
});

test('dome rockets aim the animated launcher upward and hit a stationary airborne player', async () => {
    const query = (_sx: number, _sz: number, _ex: number, _ez: number, out: THREE.Object3D[]) => { out.length = 0; return out; };
    for (const [r, height] of [[0, 28.001], [0, 130], [80, 80], [120, 50]]) {
        const { actor } = await robot(); actor.group.position.set(0, 0, 0); actor.group.rotation.y = 0;
        const player = { position: new THREE.Vector3(0, height, r), velocity: new THREE.Vector3(), lifeId: 7, alive: true, grounded: false };
        try {
            for (let frame = 0; frame < 120 && actor.combat.shotCount === 0; frame++) actor.update(1 / 60, player);
            const rocket = (actor.pilot.rockets as any).rockets.find((value: any) => value.active);
            assert.ok(rocket); assert.equal(rocket.mode, 'guided');
            assert.ok(rocket.start.distanceTo(actor.muzzleAnchor.getWorldPosition(new THREE.Vector3())) < 1e-6);
            assert.ok(rocket.forward.distanceTo(new THREE.Vector3(0, 0, 1).transformDirection(actor.muzzleAnchor.matrixWorld)) < 1e-6);
            const intercept = actor.rocketPlayer.position.clone().sub(rocket.start).normalize();
            assert.ok(rocket.forward.dot(intercept) > 0.99, `actual launcher points at radius ${r}, height ${height}`);
            if (height >= 50) assert.ok(rocket.forward.y > 0, 'elevated target gets upward aim');
            const hits: number[] = [];
            for (let frame = 0; frame < 180 && !hits.length; frame++) actor.pilot.rockets.update(1 / 60, [], query, () => assert.fail('enemy rocket cannot hit NPCs'), actor.rocketPlayer, damage => hits.push(damage));
            assert.deepEqual(hits, [9]);
        } finally { actor.dispose(); }
    }
});

test('committed attacks survive vertical region changes and leaving the dome, then allow a ready stomp', async () => {
    const laser = await robot(); laser.actor.group.position.set(0, 0, 0); laser.actor.group.rotation.y = 0;
    const target = { position: new THREE.Vector3(0, 28, 60), alive: true, grounded: false };
    try {
        laser.actor.update(0.15, target); assert.equal(laser.actor.combat.laserPhase, 'charging');
        target.position.y = 80; advance(laser.actor, 1.5, target); assert.equal(laser.actor.combat.laserPhase, 'charging');
        target.position.y = 140; advance(laser.actor, 1.5, target);
        assert.equal(laser.actor.combat.laserPhase, 'firing'); assert.equal(laser.actor.combat.shotCount, 1);
        assert.equal(laser.actor.pilot.rockets.activeCount, 0);
    } finally { laser.actor.dispose(); }
    const { actor } = await robot(); actor.group.position.set(0, 0, 0); actor.group.rotation.y = 0;
    try {
        target.position.set(0, 80, 60); actor.update(0.1, target); assert.equal(actor.mode, 'rocketing');
        target.position.set(0, 28, 25); advance(actor, 1.4, target);
        assert.equal(actor.mode, 'rocketing'); assert.equal(actor.combat.shotCount, 1);
        advance(actor, 1.5, target); advance(actor, 0.02, target); assert.equal(actor.mode, 'stomping');
    } finally { actor.dispose(); }
});

test('LOS loss during rocket windup commits a wandering shot and restoration cannot retarget it', async () => {
    const blocker = new THREE.Mesh(new THREE.BoxGeometry(80, 80, 2), new THREE.MeshBasicMaterial());
    blocker.userData = { halfW: 40, halfH: 40, halfD: 1, height: 80 }; blocker.position.set(400, 40, 400); blocker.updateMatrixWorld(true);
    const { actor } = await robot([blocker]); actor.group.position.set(0, 0, 0); actor.group.rotation.y = 0;
    const player = near(actor, 45); actor.update(0.5, player); assert.equal(actor.mode, 'rocketing');
    blocker.position.set(0, 30, 25); blocker.updateMatrixWorld(true); advance(actor, 1.1, player);
    const rocket = (actor.pilot.rockets as any).rockets.find((r: any) => r.active);
    assert.ok(rocket); assert.equal(rocket.mode, 'wandering'); assert.equal(rocket.player, null); assert.equal(actor.combat.shotCount, 1);
    blocker.position.x = 400; blocker.updateMatrixWorld(true); advance(actor, 0.2, player);
    assert.equal(rocket.player, null); actor.dispose(); blocker.geometry.dispose(); (blocker.material as THREE.Material).dispose();
});

test('covered rocket uses the authored open-helmet socket and cannot track hidden movement', async () => {
    let first: { start: THREE.Vector3; forward: THREE.Vector3 } | null = null;
    for (const hiddenX of [-20, 20]) {
        const blocker = new THREE.Mesh(new THREE.BoxGeometry(80, 80, 2), new THREE.MeshBasicMaterial());
        blocker.userData = { halfW: 40, halfH: 40, halfD: 1, height: 80 }; blocker.position.set(400, 40, 400); blocker.updateMatrixWorld(true);
        const { actor } = await robot([blocker]); actor.group.position.set(0, 0, 0); actor.group.rotation.y = 0;
        try {
            const player = near(actor, 45); actor.update(0.5, player);
            blocker.position.set(0, 30, 25); blocker.updateMatrixWorld(true); player.position.x = hiddenX;
            advance(actor, 1, player);
            const rocket = (actor.pilot.rockets as any).rockets.find((r: any) => r.active);
            assert.equal(rocket.mode, 'wandering');
            // Evaluate the exported cue without the enemy shoulder correction.
            (actor as any).rocketAction.time = 1.5; (actor as any).rocketMixer.update(0); actor.group.updateMatrixWorld(true);
            assert.ok(rocket.start.distanceTo(actor.muzzleAnchor.getWorldPosition(new THREE.Vector3())) < 1e-6);
            assert.ok(rocket.forward.distanceTo(new THREE.Vector3(0, 0, 1).transformDirection(actor.muzzleAnchor.matrixWorld)) < 1e-6);
            if (first) {
                assert.ok(first.start.distanceTo(rocket.start) < 1e-6);
                assert.ok(first.forward.distanceTo(rocket.forward) < 1e-6, 'hidden player cannot steer the release');
            } else first = { start: rocket.start.clone(), forward: rocket.forward.clone() };
        } finally { actor.dispose(); blocker.geometry.dispose(); (blocker.material as THREE.Material).dispose(); }
    }
});

test('covered goggles retain only a presence hint, release homing and honor photosensitivity', async () => {
    Object.assign(globalThis, {
        document: { getElementById: (id: string) => id === 'goggles-anomaly-tear-a' ? {} : null, createElement: () => new HudElement(), createElementNS: () => new HudElement() },
        window: { innerWidth: 1280, innerHeight: 720, matchMedia: () => ({ matches: false }) },
    });
    const { actor } = await robot(); const camera = new THREE.PerspectiveCamera(25, 1280 / 720, 0.1, 2000);
    camera.position.copy(actor.hitbox.position).add(new THREE.Vector3(0, 0, 120)); camera.lookAt(actor.hitbox.position); camera.updateMatrixWorld(true);
    const layer = new HudElement(), hud = new SmartGogglesHud(layer as any);
    for (const time of [1000, 1600, 2100]) hud.update(camera, camera.position, camera.position, [], {}, true, time, null, [], true, actor);
    assert.equal(getProjectileHomingTarget()?.kind, 'mecha');
    const cover = new THREE.Group(), body = new THREE.Mesh(new THREE.BoxGeometry(80, 80, 2), new THREE.MeshBasicMaterial());
    cover.position.copy(actor.hitbox.position).z += 60; cover.add(body); cover.userData = { index: 0, hp: 50, maxHp: 50, bodyMesh: body, healthBarGroup: new THREE.Group() }; cover.updateMatrixWorld(true);
    hud.update(camera, camera.position, camera.position, [cover], {}, true, 2200, null, [], true, actor);
    const record = layer.children.find(child => child.dataset.targetKey === 'mecha:forgotten')!;
    assert.equal(record.classList.contains('is-mecha-hidden'), true); assert.equal(getProjectileHomingTarget(), null);
    assert.equal(layer.children.filter(child => child.dataset.targetKey === 'mecha:forgotten').length, 1, 'reuse one overlay');
    const previous = userSettings.photosensitivityMode; userSettings.photosensitivityMode = true;
    try {
        hud.update(camera, camera.position, camera.position, [cover], {}, true, 2300, null, [], true, actor);
        assert.equal(record.classList.contains('is-mecha-steady'), true);
        hud.update(camera, camera.position, camera.position, [], {}, true, 2400, null, [], true, actor);
        assert.equal(record.classList.contains('is-mecha-hidden'), false);
    } finally { userSettings.photosensitivityMode = previous; hud.reset(); actor.dispose(); body.geometry.dispose(); (body.material as THREE.Material).dispose(); }
});
