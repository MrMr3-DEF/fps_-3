import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { AtmosphereEffects, AtmosphereHistory } from '../src/atmosphereEffects.ts';
import { sampleBiomeFogMultiplier, type BiomeId, type BiomeWeights } from '../src/biomes.ts';

function pureWeights(biome: BiomeId): BiomeWeights {
    return {
        warm: biome === 'warm' ? 1 : 0,
        cool: biome === 'cool' ? 1 : 0,
        sand: biome === 'sand' ? 1 : 0,
        town: 0,
    };
}

test('camera blur rejects stale lives, projections, cuts and paused clocks', () => {
    const history = new AtmosphereHistory(), camera = new THREE.PerspectiveCamera(70, 1, .1, 1500);
    const advance = (delta = 1 / 60, key = 'life1') => { camera.updateMatrixWorld(true); return history.advance(camera, delta, key); };
    assert.equal(advance(), false);
    camera.position.x = 1; assert.equal(advance(), true);
    assert.equal(advance(), false, 'stationary frames bypass blur');
    camera.position.x = 2; assert.equal(advance(1 / 60, 'life2'), false);
    camera.position.x = 100; assert.equal(advance(), false);
    camera.rotateY(Math.PI / 2); assert.equal(advance(), false);
    camera.position.x++; assert.equal(advance(0), false);
    camera.position.x++; assert.equal(advance(.2), false);
    camera.fov = 40; camera.updateProjectionMatrix(); camera.position.x++; assert.equal(advance(), false);
    history.reset(); camera.position.x++; assert.equal(advance(), false);
    camera.position.x++; assert.equal(advance(), true);
});

test('nested atmosphere rendering restores target, viewport, fog and flags on failure', () => {
    const effects = new AtmosphereEffects(42), world = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(70, 1, .1, 1500);
    world.fog = new THREE.FogExp2();
    const originalFog = world.fog, output = new THREE.WebGLRenderTarget(100, 80);
    const viewport = new THREE.Vector4(1, 2, 50, 40), scissor = new THREE.Vector4(3, 4, 20, 10);
    let current: THREE.WebGLRenderTarget | null = output, scissorTest = true, draws = 0;
    const renderer = {
        capabilities: { isWebGL2: true, maxSamples: 2 }, autoClear: false,
        getRenderTarget: () => current,
        setRenderTarget: (target: THREE.WebGLRenderTarget | null) => { current = target; },
        getViewport: (v: THREE.Vector4) => v.copy(viewport), setViewport: (v: THREE.Vector4) => { viewport.copy(v); },
        getScissor: (v: THREE.Vector4) => v.copy(scissor), setScissor: (v: THREE.Vector4) => { scissor.copy(v); },
        getScissorTest: () => scissorTest, setScissorTest: (value: boolean) => { scissorTest = value; },
        render: () => { draws++; throw new Error('draw failed'); },
    } as unknown as THREE.WebGLRenderer;
    const frame = { elapsed: 100, delta: 1 / 60, blurAllowed: true, cameraKey: 'life1' };
    try {
        assert.throws(() => effects.render(renderer, world, camera, frame), /draw failed/);
        assert.equal(current, output); assert.equal(world.fog, originalFog);
        assert.equal(renderer.autoClear, false); assert.equal(scissorTest, true);
        assert.deepEqual(viewport.toArray(), [1, 2, 50, 40]); assert.deepEqual(scissor.toArray(), [3, 4, 20, 10]);
        assert.equal(draws, 1);
        effects.applySettings({ fog: false, motionBlur: false });
        renderer.render = scene => { draws++; assert.equal(scene.fog, null); assert.equal(current, output); };
        effects.render(renderer, world, camera, frame);
        assert.equal(draws, 2); assert.equal(world.fog, originalFog);
    } finally { effects.dispose(); effects.dispose(); output.dispose(); }
});

test('biome fog multiplier drives fallback fog and setBiomeMap borrows the world map', () => {
    const effects = new AtmosphereEffects(3), world = new THREE.Scene(), camera = new THREE.Camera();
    const map = new THREE.DataTexture(new Uint8Array([255, 0, 0, 255]), 1, 1);
    map.needsUpdate = true;
    effects.setBiomeMap(map);
    assert.equal((effects as any).material.uniforms.biomeMap.value, map);

    const warm = sampleBiomeFogMultiplier(pureWeights('warm'));
    const cool = sampleBiomeFogMultiplier(pureWeights('cool'));
    const sand = sampleBiomeFogMultiplier(pureWeights('sand'));
    assert.equal(sand, 0, 'sand disables fog');
    assert.equal(cool, 1.75, 'cool carries the strongest fog');
    assert.ok(cool > warm && warm > sand);

    const seen: (number | null)[] = [];
    const renderer = {
        capabilities: { isWebGL2: false, maxSamples: 0 },
        extensions: { has: () => false },
        render: (scene: THREE.Scene) => {
            seen.push(scene.fog ? (scene.fog as THREE.FogExp2).density : null);
        },
    } as unknown as THREE.WebGLRenderer;
    const frame = { elapsed: 1, delta: 1 / 60, blurAllowed: true, cameraKey: 'biome', fogMultiplier: warm };
    effects.applySettings({ fog: true, motionBlur: false });
    try {
        effects.render(renderer, world, camera, frame);
        effects.render(renderer, world, camera, { ...frame, fogMultiplier: cool });
        effects.render(renderer, world, camera, { ...frame, fogMultiplier: sand });
        effects.render(renderer, world, camera, { ...frame, fogMultiplier: cool, fogTimeMultiplier: 0.8 });
        effects.render(renderer, world, camera, { ...frame, fogMultiplier: warm, fogTimeMultiplier: 1.2 });
        effects.render(renderer, world, camera, { ...frame, fogMultiplier: sand, fogTimeMultiplier: 1.2 });
        assert.equal(seen[0], 0.002 * warm);
        assert.equal(seen[1], 0.002 * cool);
        assert.equal(seen[2], null, 'zero biome fog removes the fallback entirely');
        assert.ok(Math.abs((seen[3] ?? 0) - 0.002 * cool * 0.8) < 1e-12, 'daytime scales cool fog down 20%');
        assert.ok(Math.abs((seen[4] ?? 0) - 0.002 * warm * 1.2) < 1e-12, 'sunrise/sundown scales warm fog up 20%');
        assert.equal(seen[5], null, 'sand stays at zero fog even during sunrise/sundown boost');
        assert.equal(world.fog, null, 'the borrowed scene fog is restored after drawing');

        effects.setBiomeMap(null);
        assert.notEqual((effects as any).material.uniforms.biomeMap.value, map);
    } finally { effects.dispose(); map.dispose(); }
});

test('helmet captures retain independent targets and stationary blur creates none', () => {
    const effects = new AtmosphereEffects(1), world = new THREE.Scene(), camera = new THREE.PerspectiveCamera();
    const output = new THREE.WebGLRenderTarget(1920, 1080), seen: THREE.WebGLRenderTarget[] = [];
    let current: THREE.WebGLRenderTarget | null = null;
    const viewport = new THREE.Vector4(), scissor = new THREE.Vector4();
    const renderer = { capabilities: { isWebGL2: true, maxSamples: 2 }, autoClear: true,
        getRenderTarget: () => current, setRenderTarget: (value: typeof current) => { current = value; },
        getDrawingBufferSize: (v: THREE.Vector2) => v.set(3840, 2160),
        getViewport: (v: THREE.Vector4) => v.copy(viewport), setViewport() {},
        getScissor: (v: THREE.Vector4) => v.copy(scissor), setScissor() {}, getScissorTest: () => false, setScissorTest() {},
        render: (scene: THREE.Scene) => { if (scene === world && current && current !== output) seen.push(current); },
    } as unknown as THREE.WebGLRenderer;
    const frame = { elapsed: 1, delta: 1 / 60, blurAllowed: true, cameraKey: 'life1' };
    try {
        effects.applySettings({ fog: false, motionBlur: true }); effects.render(renderer, world, camera, frame);
        assert.equal(seen.length, 0); assert.equal((effects as any).target, null); assert.equal((effects as any).captureTarget, null);
        effects.applySettings({ fog: true, motionBlur: false }); effects.render(renderer, world, camera, frame);
        const main = seen.at(-1)!; let disposed = 0; main.addEventListener('dispose', () => disposed++);
        current = output; effects.render(renderer, world, camera, frame);
        const capture = seen.at(-1)!; assert.notEqual(capture, main);
        current = null; effects.render(renderer, world, camera, frame);
        assert.equal(seen.at(-1), main); assert.equal(main.width, 3840); assert.equal(capture.width, 1920); assert.equal(disposed, 0);
        capture.addEventListener('dispose', () => disposed++);
        effects.applySettings({ fog: false, motionBlur: false }); assert.equal(disposed, 2);
    } finally { effects.dispose(); output.dispose(); }
});
