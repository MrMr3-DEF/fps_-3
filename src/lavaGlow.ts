import * as THREE from 'three';
import { LAVA_POOL_HALF_SIZE, MAP_SIZE, RENDER_CHUNK_SIZE } from './config.js';

export const LAVA_GLOW_SIZE = MAP_SIZE + 64;
const GLOW_RESOLUTION = 1024;
const SPILL_WIDTH = 10;

/** Bake the maximum spill, rather than adding overlapping square halos.
 * Green/blue retain the source chunk, so visibility uses the game's chunk range.
 * This 4 MB map is built once per world; camera movement only updates uniforms.
 */
export function createLavaGlowTexture(pools: readonly THREE.Object3D[]): THREE.DataTexture {
    const data = new Uint8Array(GLOW_RESOLUTION * GLOW_RESOLUTION * 4);
    const pixelSize = LAVA_GLOW_SIZE / GLOW_RESOLUTION;
    const half = LAVA_GLOW_SIZE / 2;
    const reach = LAVA_POOL_HALF_SIZE + SPILL_WIDTH;
    for (const { position } of pools) {
        const minX = Math.max(0, Math.floor((position.x - reach + half) / pixelSize));
        const maxX = Math.min(GLOW_RESOLUTION - 1, Math.ceil((position.x + reach + half) / pixelSize));
        const minZ = Math.max(0, Math.floor((position.z - reach + half) / pixelSize));
        const maxZ = Math.min(GLOW_RESOLUTION - 1, Math.ceil((position.z + reach + half) / pixelSize));
        for (let z = minZ; z <= maxZ; z++) {
            const dz = Math.max(0, Math.abs((z + 0.5) * pixelSize - half - position.z) - LAVA_POOL_HALF_SIZE);
            for (let x = minX; x <= maxX; x++) {
                const dx = Math.max(0, Math.abs((x + 0.5) * pixelSize - half - position.x) - LAVA_POOL_HALF_SIZE);
                const spill = 1 - THREE.MathUtils.smoothstep(Math.hypot(dx, dz), 0, SPILL_WIDTH);
                const value = Math.round(spill * spill * 255);
                const index = (z * GLOW_RESOLUTION + x) * 4;
                if (value <= data[index]) continue;
                data[index] = value;
                data[index + 1] = Math.floor(position.x / RENDER_CHUNK_SIZE) + 128;
                data[index + 2] = Math.floor(position.z / RENDER_CHUNK_SIZE) + 128;
                data[index + 3] = 255;
            }
        }
    }
    const texture = new THREE.DataTexture(data, GLOW_RESOLUTION, GLOW_RESOLUTION);
    texture.minFilter = THREE.LinearFilter;
    texture.magFilter = THREE.LinearFilter;
    texture.generateMipmaps = false;
    texture.needsUpdate = true;
    return texture;
}

export function getLavaDarknessStrength(nightStrength: number): number {
    return THREE.MathUtils.smoothstep(nightStrength, 0.05, 0.85);
}
