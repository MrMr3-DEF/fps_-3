import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { state } from '../src/state.ts';
import { DayNightCycle } from '../src/dayNightCycle.ts';
import { prepareRenderer } from '../src/renderPreparation.ts';
import { disposeParticles } from '../src/particles.ts';

for (const fail of [false, true]) test(`render preparation restores lighting and render target (failure=${fail})`, async () => {
    const scene = state.scene = new THREE.Scene();
    state.camera = new THREE.PerspectiveCamera();
    state.projectilePool = [];
    const cycle = new DayNightCycle(scene, { shadows: true, shadowMapSize: 1024 });
    cycle.synchronizeElapsedSeconds(87, true);
    let target: THREE.WebGLRenderTarget | null = null;
    let compiled = 0;
    let rendered = 0;
    state.renderer = {
        getRenderTarget: () => target,
        setRenderTarget: (value: typeof target) => { target = value; },
        initTexture: () => {},
        compileAsync: async () => { compiled++; if (fail) throw new Error('compile failed'); },
        render: () => { assert.ok(target); rendered++; },
    } as unknown as THREE.WebGLRenderer;
    try {
        const preparation = prepareRenderer(cycle, async () => {});
        if (fail) await assert.rejects(preparation, /compile failed/);
        else { await preparation; assert.equal(compiled, 3); assert.equal(rendered, 3); }
        assert.equal(target, null);
        assert.equal(cycle.elapsedTimeSeconds, 87);
        assert.equal(state.activeParticles.length, 0);
        assert.equal(scene.children.filter(object => (object as THREE.Mesh).isMesh).length, 3,
            'only sun, moon and the prepared particle buffer remain');
    } finally {
        disposeParticles(); cycle.dispose(); state.renderer = null; state.scene = null; state.camera = null;
    }
});
