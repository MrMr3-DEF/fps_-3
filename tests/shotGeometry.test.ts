import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { shotObstructionT } from '../src/multiplayer.ts';
import { state } from '../src/state.ts';
import { ForgottenMecha } from '../src/forgottenMecha.ts';
import { prepareForgottenMecha, forgottenMecha, disposeWorld, queryObstaclesAlongSegment } from '../src/world.ts';
import { loadIronmawTestAsset } from './ironmawTestAsset.ts';
import { PROJECTILE_RADIUS } from '../src/config.ts';

test('host broad phase retains an adjacent-cell projectile graze while sniper stays a zero-radius ray', async () => {
    const load = ForgottenMecha.prototype.load;
    ForgottenMecha.prototype.load = async function () { this.install(await loadIronmawTestAsset()); };
    Object.assign(globalThis, { document: { getElementById: () => null } });
    state.scene = new THREE.Scene(); state.renderer = null; state.obstacles = []; state.lavaPools = [];
    try {
        await prepareForgottenMecha(undefined, async () => {});
        const actor = forgottenMecha!;
        actor.colliders.forEach(object => object.position.set(1000, 1000, 1000));
        const edge = actor.colliders[0];
        edge.position.set(32.04, 10, 0); edge.scale.set(0.04, 4, 2);
        Object.assign(edge.userData, { halfW: 0.02, halfH: 2, halfD: 1, height: 4 }); edge.updateMatrixWorld(true);
        const start = new THREE.Vector3(31.97, 10, -5), end = new THREE.Vector3(31.97, 10, 5);
        assert.equal(queryObstaclesAlongSegment(start.x, start.z, end.x, end.z).includes(edge), false);
        assert.ok(queryObstaclesAlongSegment(start.x, start.z, end.x, end.z, [], PROJECTILE_RADIUS).includes(edge));
        assert.notEqual(shotObstructionT(start, end, PROJECTILE_RADIUS), null);
        assert.equal(shotObstructionT(start, end, 0), null);
        assert.equal(shotObstructionT(new THREE.Vector3(0, 2, 0), new THREE.Vector3(0, -2, 0), 0), 0.5);
    } finally { disposeWorld(); ForgottenMecha.prototype.load = load; }
});
