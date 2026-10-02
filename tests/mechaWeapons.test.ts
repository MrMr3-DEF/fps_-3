import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { state } from '../src/state.ts';
import { ForgottenMecha } from '../src/forgottenMecha.ts';
import { forgottenMecha, prepareForgottenMecha, disposeWorld, createEnvironment, setWorldSeed } from '../src/world.ts';
import { createAkimboGuns, disposePlayerVisuals, fireProjectile } from '../src/weapons.ts';
import { setDamageHandlers, type MechaWeaponHit } from '../src/damage.ts';
import { updateProjectiles, disposeProjectiles } from '../src/projectiles.ts';
import { disposeParticles } from '../src/particles.ts';
import { loadIronmawTestAsset } from './ironmawTestAsset.ts';

test('sniper and curved bullets hit the shield before the body; inside shots damage, terrain wins nearer contacts', async () => {
    const context = new Proxy({}, { get: () => () => {} });
    Object.assign(globalThis, { document: { getElementById: () => null, createElement: () => ({ getContext: () => context }) } });
    state.scene = new THREE.Scene(); state.camera = new THREE.PerspectiveCamera(); state.renderer = null; state.isMultiplayer = false;
    state.projectiles = []; state.projectilePool = []; state.targets = []; state.peers = {};
    setWorldSeed(42); createEnvironment(true);
    const originalLoad = ForgottenMecha.prototype.load;
    ForgottenMecha.prototype.load = async function () { this.install(await loadIronmawTestAsset()); };
    const hits: MechaWeaponHit[] = [];
    try {
        await prepareForgottenMecha({ impact() {}, stompPlayer() {}, gameOver() {} }, async () => {});
        const actor = forgottenMecha!;
        createAkimboGuns(); state.activeWeaponName = 'SNIPER'; state.rightGun = state.sniperMesh;
        setDamageHandlers(() => {}, () => {}, (damage, hit) => {
            if (hit) hits.push({ ...hit, origin: { ...hit.origin }, point: { ...hit.point } });
            actor.damage(damage, hit);
        });
        function aim(distance: number) {
            state.camera!.position.copy(actor.combat.shieldCenter).add(new THREE.Vector3(0, 0, distance));
            state.camera!.lookAt(actor.combat.shieldCenter); state.scene!.updateMatrixWorld(true);
        }
        aim(60); fireProjectile();
        assert.equal(hits.at(-1)?.surface, 'shield'); assert.equal(actor.hp, 50);
        assert.ok(Math.abs(new THREE.Vector3().copy(hits.at(-1)!.point as THREE.Vector3).distanceTo(actor.combat.shieldCenter) - 17) < 1e-6);
        aim(12); fireProjectile(); assert.equal(hits.at(-1)?.surface, 'body'); assert.equal(actor.hp, 40);
        const bullet = new THREE.Mesh(new THREE.SphereGeometry(0.1), new THREE.MeshBasicMaterial());
        bullet.position.copy(actor.combat.shieldCenter).add(new THREE.Vector3(0, 0, 60));
        bullet.userData = { dx: 0, dy: 0, dz: -1, age: 0, distanceTraveled: 100, visualOnly: false, damage: 3,
            shotOrigin: bullet.position.clone(), homingTarget: { kind: 'mecha', actor, object: actor.group, targetRevision: actor.revision }, homingStartDistance: 0 };
        state.projectiles.push(bullet); state.scene!.add(bullet);
        for (let i = 0; i < 5 && state.projectiles.length; i++) updateProjectiles(0.03, 'Guest');
        assert.equal(state.projectiles.length, 0); assert.equal(hits.at(-1)?.surface, 'shield'); assert.equal(actor.hp, 40);
        const pillar = state.obstacles.find(object => object.userData.height >= 50 && !object.userData.damageTarget)!;
        actor.group.position.set(pillar.position.x, 0, pillar.position.z - 40); actor.group.rotation.y = 0;
        actor.update(1 / 60, { position: actor.group.position.clone().add(new THREE.Vector3(0, 14.5, 80)), alive: true, grounded: false });
        const before = hits.length; aim(80); fireProjectile();
        assert.equal(hits.length, before, 'closer pillar prevents shield or body contact'); assert.equal(actor.hp, 40);
        disposeProjectiles(); bullet.geometry.dispose();
    } finally {
        ForgottenMecha.prototype.load = originalLoad; disposeParticles(); disposePlayerVisuals(); disposeWorld();
        state.camera = null; state.scene = null; state.targets = []; state.peers = {};
    }
});
