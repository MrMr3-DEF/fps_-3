import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { MechaGameOverScene, MECHA_ENDING_TIMING, MECHA_ENDING_LIMITS, sampleMechaEnding } from '../src/mechaGameOverScene.ts';
import { loadIronmawTestAsset } from './ironmawTestAsset.ts';
import { generateTownLayout } from '../src/town.ts';
import { createEndingCastle } from '../src/mechaEndingCastle.ts';
import { TOWN_HALF_SIZE, TOWN_WALL_THICKNESS } from '../src/config.ts';

const defaults = { seed: 42, heading: 0, wallOffset: 40, lightingElapsed: 150 };
const cold = async (rest = {}) => MechaGameOverScene.prepare({ ...defaults, ...rest }, await loadIronmawTestAsset());
const prepare = async (rest = {}) => { const scene = await cold(rest); await scene.begin(undefined, async () => {}); return scene; };
const meshes = (scene: MechaGameOverScene) => scene.scene.children.filter(node => node.name.startsWith('ending-fragments-')) as THREE.InstancedMesh[];
const matrix = (scene: MechaGameOverScene) => meshes(scene).flatMap(mesh => [...mesh.instanceMatrix.array]);
const near = (a: number, b: number, epsilon = 1e-6) => assert.ok(Math.abs(a - b) < epsilon, `${a} != ${b}`);

test('ending owns its fade, establishment, authored impact and full-clip aftermath clocks', async () => {
    const scene = await prepare();
    try {
        near(scene.punchDuration, 85 / 24);
        near(scene.impactTime, .45 + .6 + .5 + 35 / 24);
        near(scene.duration, .45 + .6 + .5 + 85 / 24 + 3);
        assert.equal(scene.seek(0).blackout, 0);
        assert.equal(scene.seek(.45).blackout, 1);
        assert.equal(scene.seek(.45).phase, 'fade-in');
        assert.equal(scene.seek(1.05).blackout, 0);
        assert.equal(scene.seek(1.3).punchTime, 0);
        assert.equal(scene.seek(scene.punchStart).phase, 'punch');
        const fire = scene.scene.getObjectByName('ending-fire')!;
        const light = scene.scene.children.find(node => node instanceof THREE.PointLight) as THREE.PointLight;
        assert.equal(scene.seek(scene.impactTime - .00001).impactAge < 0, true);
        assert.equal(fire.visible, false); assert.equal(light.intensity, 0);
        near(scene.seek(scene.impactTime).impactAge, 0); assert.equal(fire.visible, true);
        assert.equal(scene.seek(scene.punchStart + scene.punchDuration + 2.99).gameOver, false);
        assert.equal(scene.seek(scene.duration).gameOver, true);
        assert.equal(scene.seek(100).time, scene.duration);
        assert.equal(sampleMechaEnding(NaN, scene.punchDuration).time, 0);
        assert.equal(scene.seek(-1).time, 0);
    } finally { scene.dispose(); }
});

test('actual fist contacts every route wall; original close shot frames the mecha and impact at all sixteen goals', async () => {
    for (const heading of [0, Math.PI / 2, Math.PI, -Math.PI / 2]) for (const wallOffset of [-56, -40, 40, 56]) {
        const scene = await prepare({ heading, wallOffset, seed: wallOffset === 40 ? 91234 : 42 });
        try {
            scene.seek(scene.impactTime);
            const forward = new THREE.Vector3(Math.sin(heading), 0, Math.cos(heading));
            const axis = Math.abs(forward.x) > .5 ? 'x' : 'z';
            near(scene.contact[axis], -forward[axis] * (TOWN_HALF_SIZE + TOWN_WALL_THICKNESS / 2));
            const fist = scene.robot.getObjectByName('M_Forearm_R')!;
            const bounds = new THREE.Box3().setFromObject(fist, true);
            near(forward[axis] > 0 ? bounds.max[axis] : bounds.min[axis], scene.contact[axis], .0001);
            for (const point of scene.framingPoints) {
                const p = point.clone().project(scene.camera);
                assert.ok(Math.abs(p.x) < .95 && Math.abs(p.y) < .95 && p.z < 1 && p.z > -1,
                    `clipped framing at heading ${heading}, offset ${wallOffset}: ${p.toArray()}`);
            }
            assert.ok(scene.camera.position.distanceTo(scene.contact) < 220, 'stay close to the punch instead of pulling back for the whole castle');
            assert.ok(scene.camera.position.y < 70, 'keep the original low three-quarter angle');
            const distantCorners = [-90, 90].flatMap(x => [-90, 90].map(z => new THREE.Vector3(x, 70, z).project(scene.camera)));
            assert.ok(distantCorners.some(p => Math.abs(p.x) > 1 || Math.abs(p.y) > 1 || p.z > 1), 'the whole castle must not determine framing');
            assert.ok(scene.resources.fragments > 1500 && scene.resources.fragments <= MECHA_ENDING_LIMITS.fragments);
        } finally { scene.dispose(); }
    }
});

test('absolute seeks and replay reconstruct intact castle, pose and deterministic debris without changing the camera', async () => {
    const scene = await prepare(), copy = await prepare();
    const different = await prepare({ effectsSeed: 123 });
    try {
        const camera = scene.camera.matrixWorld.toArray();
        scene.seek(scene.impactTime - .01); const intact = matrix(scene);
        scene.seek(scene.impactTime + .65); const flying = matrix(scene);
        assert.notDeepEqual(flying, intact);
        copy.seek(copy.impactTime + .65); assert.deepEqual(matrix(copy), flying);
        different.seek(different.impactTime + .65); assert.notDeepEqual(matrix(different), flying);
        scene.seek(scene.duration);
        const settled = matrix(scene);
        for (let i = 0; i < settled.length; i += 16) {
            near(settled[i + 13], (Math.abs(settled[i + 1]) + Math.abs(settled[i + 5]) + Math.abs(settled[i + 9])) / 2, .00001);
        }
        scene.seek(scene.impactTime - .01); assert.deepEqual(matrix(scene), intact);
        for (let t = 0; t < scene.impactTime + .65; t += 1 / 37) scene.seek(t);
        scene.seek(scene.impactTime + .65); assert.deepEqual(matrix(scene), flying);
        assert.deepEqual(scene.camera.matrixWorld.toArray(), camera);
        scene.seek(scene.punchStart); const start = new THREE.Box3().setFromObject(scene.robot, true);
        scene.seek(scene.duration); scene.seek(0);
        const replay = new THREE.Box3().setFromObject(scene.robot, true);
        near(start.min.distanceTo(replay.min), 0); near(start.max.distanceTo(replay.max), 0);
    } finally { scene.dispose(); copy.dispose(); different.dispose(); }
});

test('quality bounds cosmetic counts; gentle mode preserves breach timing but reduces bright effects', async () => {
    const normal = await prepare(), gentle = await prepare({ photosensitivity: true, particleAmount: .2 });
    try {
        normal.seek(normal.impactTime + .5); gentle.seek(gentle.impactTime + .5);
        assert.deepEqual(matrix(normal), matrix(gentle), 'quality and safety settings cannot change the breach');
        assert.equal((normal.scene.getObjectByName('ending-sparks') as THREE.InstancedMesh).count, 480);
        assert.equal((gentle.scene.getObjectByName('ending-sparks') as THREE.InstancedMesh).count, 96);
        assert.equal(gentle.scene.getObjectByName('ending-sparks')!.visible, false);
        assert.equal((gentle.scene.getObjectByName('ending-smoke') as THREE.InstancedMesh).count, 23);
        const light = (s: MechaGameOverScene) => (s.scene.children.find(n => n instanceof THREE.PointLight) as THREE.PointLight).intensity;
        assert.ok(light(gentle) < light(normal) / 4);
        assert.equal(gentle.frame.phase, normal.frame.phase);
    } finally { normal.dispose(); gentle.dispose(); }
});

test('letterboxing and render failures preserve caller renderer state; disposal releases shared buffers once', async () => {
    const scene = await prepare();
    let viewport = new THREE.Vector4(2, 3, 400, 500), scissor = new THREE.Vector4(4, 5, 200, 300);
    let scissorTest = true, color = new THREE.Color(0x123456), alpha = .3, draws = 0, fail = false;
    const renderedViewports: number[][] = [];
    const fake = {
        autoClear: true,
        getViewport: (v: THREE.Vector4) => v.copy(viewport), getScissor: (v: THREE.Vector4) => v.copy(scissor),
        getScissorTest: () => scissorTest,
        getClearColor: (v: THREE.Color) => v.copy(color), getClearAlpha: () => alpha,
        getSize: (v: THREE.Vector2) => v.set(900, 1000),
        setViewport: (x: number | THREE.Vector4, y: number, w: number, h: number) => { viewport = x instanceof THREE.Vector4 ? x.clone() : new THREE.Vector4(x, y, w, h); },
        setScissor: (x: number | THREE.Vector4, y: number, w: number, h: number) => { scissor = x instanceof THREE.Vector4 ? x.clone() : new THREE.Vector4(x, y, w, h); },
        setScissorTest: (v: boolean) => { scissorTest = v; },
        setClearColor: (c: number | THREE.Color, a: number) => { color = new THREE.Color(c); alpha = a; }, clear() {},
        render: () => { draws++; renderedViewports.push(viewport.toArray()); if (fail) throw new Error('draw failed'); },
    } as unknown as THREE.WebGLRenderer;
    scene.seek(.45);
    scene.render(fake);
    near(renderedViewports[0][2] / renderedViewports[0][3], 16 / 9);
    assert.equal(draws, 2, 'world and black cover both draw at the hidden camera switch');
    for (const throwOnDraw of [false, true]) {
        fail = throwOnDraw;
        if (fail) assert.throws(() => scene.render(fake), /draw failed/); else scene.render(fake);
        assert.deepEqual(viewport.toArray(), [2, 3, 400, 500]);
        assert.deepEqual(scissor.toArray(), [4, 5, 200, 300]);
        assert.equal(scissorTest, true); assert.equal(fake.autoClear, true); near(alpha, .3);
        assert.equal(color.getHex(), 0x123456);
    }
    const geometry = (scene.scene.getObjectByName('ending-fragments-stone') as THREE.Mesh).geometry;
    let disposals = 0; geometry.addEventListener('dispose', () => disposals++);
    scene.dispose(); scene.dispose();
    assert.equal(disposals, 1); assert.equal(scene.scene.children.length, 0);
    assert.throws(() => scene.seek(MECHA_ENDING_TIMING.fadeOut), /disposed/);
    const before = draws; scene.render(fake); assert.equal(draws, before);
});


test('asset preparation allocates no castle or effects; activation is shared and holds the timeline under black until ready', async () => {
    const scene = await cold();
    try {
        assert.deepEqual(scene.resources, { fragments: 0, pillars: 0, pillarFragments: 0, bounces: 0, shatters: 0, fire: 0, smoke: 0, sparks: 0 });
        assert.equal(scene.ready, false);
        assert.equal(scene.scene.children.some(node => node instanceof THREE.InstancedMesh), false);
        let resume!: () => void;
        let checkpoints = 0;
        const activation = scene.begin(undefined, async () => {
            if (++checkpoints === 1) await new Promise<void>(resolve => { resume = resolve; });
            assert.equal(scene.seek(scene.duration).blackout, 1);
            assert.equal(scene.frame.gameOver, false); assert.equal(scene.frame.punchTime, 0);
        });
        assert.equal(scene.begin(), activation);
        assert.equal(scene.frame.phase, 'preparing');
        assert.equal(scene.resources.fragments, 0);
        resume(); await activation;
        assert.ok(checkpoints >= 8, 'creation must yield between geometry/effect batches');
        assert.equal(scene.ready, true);
        assert.equal(scene.frame.blackout, 1);
        assert.equal(scene.frame.time, MECHA_ENDING_TIMING.fadeOut);
        assert.ok(scene.resources.fragments > 0);
        const resources = scene.resources;
        await scene.begin(); assert.deepEqual(scene.resources, resources);
        assert.equal(scene.seek(scene.punchStart).phase, 'punch');
    } finally { scene.dispose(); }
});

test('cancellation and failed activation dispose partial castle buffers and cannot resume the punch', async () => {
    for (const fail of [false, true]) {
        const scene = await cold();
        let disposed = 0;
        const activation = scene.begin(undefined, async () => {
            if (scene.resources.fragments === 0) return;
            meshes(scene)[0].geometry.addEventListener('dispose', () => disposed++);
            if (fail) throw new Error('Preparation failed');
            scene.dispose();
        });
        await assert.rejects(activation, fail ? /Preparation failed/ : { name: 'AbortError' });
        assert.equal(disposed, 1);
        assert.equal(scene.ready, false); assert.equal(scene.scene.children.length, 0);
        assert.deepEqual(scene.resources, { fragments: 0, pillars: 0, pillarFragments: 0, bounces: 0, shatters: 0, fire: 0, smoke: 0, sparks: 0 });
        await assert.rejects(scene.begin(), { name: 'AbortError' });
        assert.throws(() => scene.seek(scene.duration), /disposed/);
        scene.dispose(); assert.equal(disposed, 1);
    }
});

test('all four walls, lookout towers, houses and church detonate within one second, with seed-preserving simplified shells', async () => {
    for (const seed of [0, 42, 91234, 0xffffffff]) {
        const { structures } = createEndingCastle(seed);
        assert.ok(structures.some(part => part.kind === 'church-tower'));
        assert.equal(structures.some(part => part.kind === 'detail' || part.kind === 'stair' || part.kind === 'railing'), false);
        for (const building of generateTownLayout(seed)) {
            assert.ok(structures.some(part => part.kind === 'building' && Math.abs(part.x - building.x) < .1 && Math.abs(part.z - building.z) < .1));
        }
        const scene = await prepare({ seed });
        try {
            scene.seek(scene.impactTime - .001); const before = matrix(scene);
            scene.seek(scene.impactTime + 1); const after = matrix(scene);
            let changed = 0;
            const wallSides = new Set<string>();
            for (let i = 0; i < before.length; i += 16) {
                if (before.slice(i, i + 16).some((v, j) => v !== after[i + j])) changed++;
                if (Math.abs(before[i + 12]) >= 85) wallSides.add(before[i + 12] > 0 ? 'east' : 'west');
                if (Math.abs(before[i + 14]) >= 85) wallSides.add(before[i + 14] > 0 ? 'south' : 'north');
            }
            assert.equal(changed, scene.resources.fragments, 'no above-ground fragment may remain intact');
            assert.equal(wallSides.size, 4);
            for (const [kind, limit] of Object.entries(MECHA_ENDING_LIMITS)) {
                const count = scene.resources[kind as keyof typeof scene.resources];
                assert.ok(count <= limit, `${kind} exceeds its resource cap`);
            }
            assert.equal(scene.scene.children.filter(node => node instanceof THREE.PointLight).length, 4);
        } finally { scene.dispose(); }
    }
});

// Scenery uses the real shared canvas recipes; the context records no pixels in
// Node, but consumes exactly the same random draws as browser generation.
const sceneryContext = new Proxy({}, { get: () => () => {} });
const installSceneryCanvas = () => { (globalThis as any).document = { createElement: () => ({ getContext: () => sceneryContext }) }; };

test('seeded scenery is opt-in, allocated under black, and keeps bounded close framing at all sixteen approaches', async () => {
    installSceneryCanvas();
    for (const heading of [0, Math.PI / 2, Math.PI, -Math.PI / 2]) for (const wallOffset of [-56, -40, 40, 56]) {
        const scene = await cold({ heading, wallOffset, seed: wallOffset < 0 ? 0 : 42, seededScenery: true });
        const originalCamera = scene.camera.position.clone();
        try {
            assert.equal(scene.resources.pillars, 0);
            await scene.begin(undefined, async () => {
                assert.equal(scene.frame.blackout, 1); assert.equal(scene.frame.punchTime, 0); assert.equal(scene.ready, false);
            });
            assert.equal(scene.resources.pillars, 900);
            assert.ok(scene.resources.fragments <= 4096); assert.equal(scene.resources.pillarFragments, scene.resources.shatters * 4);
            assert.ok(scene.resources.pillarFragments <= 3600);
            assert.ok(Math.abs(scene.cameraAdjustment.yaw) <= 15 && scene.cameraAdjustment.height <= 10 && scene.cameraAdjustment.distanceScale <= 1.1 + 1e-7);
            near(scene.camera.position.y - originalCamera.y, scene.cameraAdjustment.height);
            for (const point of scene.framingPoints.slice(4)) {
                const p = point.clone().project(scene.camera); assert.ok(Math.abs(p.x) <= .98 && Math.abs(p.y) <= .98 && p.z < 1);
            }
            assert.ok(scene.pillarContacts.length > 0);
            assert.ok(scene.pillarContacts.every((hit, index, hits) => index === 0 || hit.at >= hits[index - 1].at));
        } finally { scene.dispose(); }
        assert.equal(scene.resources.pillars, 0); assert.equal(scene.resources.pillarFragments, 0);
    }
});

test('pillar trajectories, hide times and camera survive arbitrary seeks and quality/lighting changes', async () => {
    installSceneryCanvas();
    const normal = await prepare({ seededScenery: true }), gentle = await prepare({ seededScenery: true, particleAmount: .2, photosensitivity: true, lightingElapsed: 360 });
    const snapshots = (scene: MechaGameOverScene) => {
        const all: number[][] = [];
        scene.scene.traverse(node => { if (node instanceof THREE.InstancedMesh && (node.name.includes('fragments') || node.name === 'ending-scenery-pillars')) all.push([...node.instanceMatrix.array]); });
        return all;
    };
    try {
        assert.deepEqual(normal.pillarContacts, gentle.pillarContacts);
        assert.equal(normal.resources.pillarFragments, gentle.resources.pillarFragments);
        assert.deepEqual(normal.camera.position.toArray(), gentle.camera.position.toArray());
        normal.seek(normal.impactTime - .01); const intact = snapshots(normal);
        const time = normal.impactTime + 2.25; normal.seek(time); const debris = snapshots(normal);
        gentle.seek(time); assert.deepEqual(snapshots(gentle), debris);
        normal.seek(normal.duration); normal.seek(0); normal.seek(time); assert.deepEqual(snapshots(normal), debris);
        normal.seek(normal.impactTime - .01); assert.deepEqual(snapshots(normal), intact);
        const pillarMesh = normal.scene.getObjectByName('ending-scenery-pillars') as THREE.InstancedMesh;
        const first = normal.pillarContacts.find(hit => hit.shattered)!;
        normal.seek(normal.impactTime + first.at + .001);
        const matrix = new THREE.Matrix4(); pillarMesh.getMatrixAt(first.pillarId, matrix);
        assert.equal(matrix.elements[0], 0);
        normal.seek(normal.impactTime + first.at - .001); pillarMesh.getMatrixAt(first.pillarId, matrix); assert.equal(matrix.elements[0], 1);
    } finally { normal.dispose(); gentle.dispose(); }
});

test('cancellation during seeded construction or collision baking disposes private meshes and sprite textures', async () => {
    installSceneryCanvas();
    for (const duringBake of [false, true]) {
        const scene = await cold({ seededScenery: true });
        let texture: THREE.Texture | undefined, disposals = 0;
        await assert.rejects(scene.begin(undefined, async () => {
            const group = scene.scene.getObjectByName('ending-seeded-scenery');
            if (!group || duringBake && scene.resources.pillars === 0) return;
            if (!duringBake && !group.children.length) return;
            group.traverse(node => { if (node instanceof THREE.Sprite) texture = node.material.map ?? undefined; });
            if (texture) texture.addEventListener('dispose', () => disposals++);
            throw new Error('cancel scenery');
        }), /cancel scenery/);
        assert.equal(scene.ready, false); assert.equal(scene.scene.children.length, 0); assert.equal(scene.resources.pillars, 0);
        if (duringBake) { assert.ok(texture); assert.equal(disposals, 1); }
        scene.dispose(); if (duringBake) assert.equal(disposals, 1);
    }
});
