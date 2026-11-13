import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { AtmosphereEffects, AtmosphereHistory } from '../src/atmosphereEffects.ts';

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
