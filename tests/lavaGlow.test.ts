import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createLavaGlowTexture, getLavaDarknessStrength, LAVA_GLOW_SIZE } from '../src/lavaGlow.ts';
import { LAVA_POOL_HALF_SIZE, RENDER_CHUNK_SIZE } from '../src/config.ts';

function pool(x: number, z: number): THREE.Object3D {
    const object = new THREE.Object3D();
    object.position.set(x, 0, z);
    return object;
}

test('joined pool glow uses the maximum spill without brighter overlap seams', () => {
    const a = pool(0, 0), b = pool(LAVA_POOL_HALF_SIZE * 2, 0);
    const left = createLavaGlowTexture([a]);
    const right = createLavaGlowTexture([b]);
    const joined = createLavaGlowTexture([a, b]);
    for (let i = 0; i < joined.image.data.length; i += 4) {
        assert.equal(joined.image.data[i], Math.max(left.image.data[i], right.image.data[i]));
    }
    left.dispose(); right.dispose(); joined.dispose();
});

test('glow records source chunks for the existing render-distance bounds', () => {
    const source = pool(-410, 230);
    const texture = createLavaGlowTexture([source]);
    const size = texture.image.width;
    const x = Math.floor((source.position.x / LAVA_GLOW_SIZE + 0.5) * size);
    const z = Math.floor((source.position.z / LAVA_GLOW_SIZE + 0.5) * size);
    const index = (z * size + x) * 4;
    assert.equal(texture.image.data[index], 255);
    assert.equal(texture.image.data[index + 1] - 128, Math.floor(source.position.x / RENDER_CHUNK_SIZE));
    assert.equal(texture.image.data[index + 2] - 128, Math.floor(source.position.z / RENDER_CHUNK_SIZE));
    texture.dispose();
});

test('lava lighting increases smoothly with darkness and is off in daylight', () => {
    assert.equal(getLavaDarknessStrength(0), 0);
    assert.equal(getLavaDarknessStrength(1), 1);
    let previous = 0;
    for (let i = 0; i <= 100; i++) {
        const value = getLavaDarknessStrength(i / 100);
        assert.ok(value >= previous && value - previous < 0.02);
        previous = value;
    }
});
