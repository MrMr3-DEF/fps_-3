import * as THREE from 'three';
import { LAVA_POOL_HALF_SIZE, MAP_SIZE, RENDER_CHUNK_SIZE } from './config.js';
import { getLavaPoolDescriptor, sampleLavaPoolSdf } from './lavaPools.js';

export const LAVA_GLOW_SIZE = MAP_SIZE + 64;
const GLOW_RESOLUTION = 1024;
const SPILL_WIDTH = 14;

/** Bake the maximum spill, rather than adding overlapping square halos.
 * Green/blue retain the source chunk, so visibility uses the game's chunk range.
 * This 4 MB map is built once per world; camera movement only updates uniforms.
 */
export function createLavaGlowTexture(pools: readonly THREE.Object3D[]): THREE.DataTexture {
    const data = new Uint8Array(GLOW_RESOLUTION * GLOW_RESOLUTION * 4);
    const pixelSize = LAVA_GLOW_SIZE / GLOW_RESOLUTION;
    const half = LAVA_GLOW_SIZE / 2;
    for (const pool of pools) {
        const { position } = pool;
        const desc = getLavaPoolDescriptor(pool);
        // Descriptor bounds already include the pool's uniform scale.
        const reach = desc
            ? desc.boundRadius + SPILL_WIDTH
            : LAVA_POOL_HALF_SIZE + SPILL_WIDTH;
        const minX = Math.max(0, Math.floor((position.x - reach + half) / pixelSize));
        const maxX = Math.min(GLOW_RESOLUTION - 1, Math.ceil((position.x + reach + half) / pixelSize));
        const minZ = Math.max(0, Math.floor((position.z - reach + half) / pixelSize));
        const maxZ = Math.min(GLOW_RESOLUTION - 1, Math.ceil((position.z + reach + half) / pixelSize));
        for (let z = minZ; z <= maxZ; z++) {
            const worldZ = (z + 0.5) * pixelSize - half;
            for (let x = minX; x <= maxX; x++) {
                const worldX = (x + 0.5) * pixelSize - half;
                let spill: number;
                if (desc) {
                    const sdf = sampleLavaPoolSdf(desc, worldX, worldZ);
                    // Keep full glow right up to the outer rim while clearing
                    // the recessed pit interior (the floor shader also clips at sdf < 0).
                    if (sdf < -pixelSize) continue;
                    const outer = 1 - THREE.MathUtils.smoothstep(Math.max(0, sdf), 0, SPILL_WIDTH);
                    const rimKeep = 1 - THREE.MathUtils.smoothstep(-sdf, pixelSize * 0.25, pixelSize);
                    spill = outer * rimKeep;
                } else {
                    const distance = Math.hypot(
                        Math.max(0, Math.abs(worldX - position.x) - LAVA_POOL_HALF_SIZE),
                        Math.max(0, Math.abs(worldZ - position.z) - LAVA_POOL_HALF_SIZE),
                    );
                    spill = 1 - THREE.MathUtils.smoothstep(distance, 0, SPILL_WIDTH);
                }
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
    const texture = new THREE.DataTexture(data, GLOW_RESOLUTION, GLOW_RESOLUTION, THREE.RGBAFormat, THREE.UnsignedByteType);
    texture.colorSpace = THREE.NoColorSpace;
    texture.flipY = false;
    texture.minFilter = THREE.LinearFilter;
    texture.magFilter = THREE.LinearFilter;
    texture.generateMipmaps = false;
    texture.needsUpdate = true;
    return texture;
}

export function getLavaDarknessStrength(nightStrength: number): number {
    return THREE.MathUtils.smoothstep(nightStrength, 0.05, 0.85);
}
