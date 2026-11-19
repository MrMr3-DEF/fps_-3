import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { MechaGameOverScene, MECHA_ENDING_TIMING, sampleMechaEnding } from '../src/mechaGameOverScene.ts';
import { loadIronmawTestAsset } from './ironmawTestAsset.ts';

const defaults = { seed: 42, heading: 0, wallOffset: 40, lightingElapsed: 150 };
const cold = async (rest = {}) => MechaGameOverScene.prepare({ ...defaults, ...rest }, await loadIronmawTestAsset());
const prepare = async (rest = {}) => { const scene = await cold(rest); await scene.begin(undefined, async () => {}); return scene; };
const meshes = (scene: MechaGameOverScene) => scene.scene.children.filter(node => node.name.startsWith('ending-fragments-')) as THREE.InstancedMesh[];
const matrix = (scene: MechaGameOverScene) => meshes(scene).flatMap(mesh => [...mesh.instanceMatrix.array]);
const near = (a: number, b: number, epsilon = 1e-6) => assert.ok(Math.abs(a - b) < epsilon, `${a} != ${b}`);

test('wall loss plays the shared collapse and reaches Game Over without loading Ironmaw', async () => {
    const impact = new THREE.Vector3(95, 2, 40);
    const scene = await MechaGameOverScene.prepare({ ...defaults, heading: -Math.PI / 2, cause: 'wall', position: impact });
    try {
        assert.equal(scene.robot.parent, null);
        assert.deepEqual(scene.contact.toArray(), impact.toArray());
        await scene.begin(undefined, async () => {});
        scene.seek(scene.impactTime - .01);
        const intact = matrix(scene);
        assert.ok(intact.length > 0);
        assert.equal(scene.seek(scene.impactTime + .65).gameOver, false);
        assert.notDeepEqual(matrix(scene), intact);
        assert.equal(scene.seek(scene.duration).gameOver, true);
    } finally { scene.dispose(); }
});

test('Game Over waits for punch and aftermath, and seeks clamp invalid clocks', async () => {
    const scene = await prepare();
    try {
        assert.ok(scene.impactTime > scene.punchStart);
        assert.ok(scene.duration > scene.punchStart + scene.punchDuration);
        assert.equal(scene.seek(scene.punchStart).gameOver, false);
        assert.equal(scene.seek(scene.punchStart + scene.punchDuration).gameOver, false);
        assert.equal(scene.seek(scene.duration).gameOver, true);
        assert.equal(scene.seek(scene.duration + 1).time, scene.duration);
        assert.equal(sampleMechaEnding(NaN, scene.punchDuration).time, 0);
        assert.equal(scene.seek(-1).time, 0);
    } finally { scene.dispose(); }
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
        assert.ok((gentle.scene.getObjectByName('ending-sparks') as THREE.InstancedMesh).count <=
            (normal.scene.getObjectByName('ending-sparks') as THREE.InstancedMesh).count);
        assert.equal(gentle.scene.getObjectByName('ending-sparks')!.visible, false);
        const light = (s: MechaGameOverScene) => (s.scene.children.find(n => n instanceof THREE.PointLight) as THREE.PointLight).intensity;
        assert.ok(light(gentle) < light(normal));
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
    scene.seek(scene.impactTime + .9);
    const rotation = scene.camera.quaternion.toArray(), cameraMatrix = scene.camera.matrixWorld.toArray();
    const inverse = scene.camera.matrixWorldInverse.toArray();
    for (const throwOnDraw of [false, true]) {
        fail = throwOnDraw;
        if (fail) assert.throws(() => scene.render(fake), /draw failed/); else scene.render(fake);
        assert.deepEqual(viewport.toArray(), [2, 3, 400, 500]);
        assert.deepEqual(scissor.toArray(), [4, 5, 200, 300]);
        assert.equal(scissorTest, true); assert.equal(fake.autoClear, true); near(alpha, .3);
        assert.equal(color.getHex(), 0x123456);
        assert.deepEqual(scene.camera.quaternion.toArray(), rotation);
        assert.deepEqual(scene.camera.matrixWorld.toArray(), cameraMatrix);
        assert.deepEqual(scene.camera.matrixWorldInverse.toArray(), inverse);
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

function captureCamera(scene: MechaGameOverScene): THREE.Quaternion {
    let rotation: THREE.Quaternion | undefined;
    const renderer = {
        autoClear: true,
        getViewport: (v: THREE.Vector4) => v.set(0, 0, 1600, 900),
        getScissor: (v: THREE.Vector4) => v.set(0, 0, 1600, 900), getScissorTest: () => false,
        getClearColor: (c: THREE.Color) => c.set(0), getClearAlpha: () => 1,
        getSize: (v: THREE.Vector2) => v.set(1600, 900),
        setViewport() {}, setScissor() {}, setScissorTest() {}, setClearColor() {}, clear() {},
        render: (world: THREE.Scene, camera: THREE.Camera) => {
            if (world === scene.scene) rotation = camera.quaternion.clone();
        },
    } as unknown as THREE.WebGLRenderer;
    scene.render(renderer);
    assert.ok(rotation); return rotation;
}

test('photosensitivity and reduced motion each disable cinematic shake', async () => {
    for (const options of [{ photosensitivity: true }, { reducedMotion: true }]) {
        const scene = await prepare(options);
        try {
            const base = scene.camera.quaternion.toArray();
            for (const age of [0, .4, .85, 1.2, 3.8]) {
                scene.seek(scene.impactTime + age);
                assert.deepEqual(captureCamera(scene).toArray(), base);
            }
        } finally { scene.dispose(); }
    }
});
