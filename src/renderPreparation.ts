import * as THREE from 'three';
import { state } from './state.js';
import { prepareParticleResources } from './particles.js';
import { prepareWorldInstanceBuffers, updateEnvironmentVisibility, updateLavaLights, updateTownLanterns } from './world.js';
import type { DayNightCycle } from './dayNightCycle.js';
import { userSettings } from './settings.js';

/** Compile actual lighting variants and upload resources behind the loading UI. */
export async function prepareRenderer(cycle: DayNightCycle, checkpoint: () => Promise<void>): Promise<void> {
    const { scene, camera, renderer } = state;
    if (!scene || !camera || !renderer) return;
    const elapsed = cycle.elapsedTimeSeconds;
    const previousTarget = renderer.getRenderTarget();
    const target = new THREE.WebGLRenderTarget(32, 32);
    const effects = prepareParticleResources();
    const projectile = state.projectilePool[0];
    const representatives: THREE.Object3D[] = [...effects];
    if (projectile && !projectile.parent) representatives.push(projectile);
    if (state.hookMesh && !state.hookMesh.parent) representatives.push(state.hookMesh);
    for (const object of representatives) scene.add(object);
    const visibility = new Map<THREE.Object3D, { visible: boolean; frustumCulled: boolean }>();
    const warmObject = (object: THREE.Object3D) => {
        if (!visibility.has(object)) visibility.set(object, { visible: object.visible, frustumCulled: object.frustumCulled });
        object.visible = true;
        object.frustumCulled = false;
    };
    // Hidden weapon/effect geometry otherwise waits until the first switch/shot
    // to reach WebGL. Draw it only into the tiny offscreen preparation target.
    for (const object of [...representatives, state.leftGun, state.pistolMesh, state.shotgunMesh,
        state.arMesh, state.sniperMesh, state.minigunMesh]) object?.traverse(warmObject);
    const textures = new Set<THREE.Texture>();
    scene.traverse(object => {
        const material = (object as THREE.Mesh).material;
        for (const mat of Array.isArray(material) ? material : material ? [material] : []) {
            for (const value of Object.values(mat)) if (value instanceof THREE.Texture) textures.add(value);
        }
    });
    try {
        let uploads = 0;
        for (const texture of textures) {
            renderer.initTexture(texture);
            if (++uploads % 8 === 0) await checkpoint();
        }
        prepareWorldInstanceBuffers();
        // Noon, twilight (sun + lanterns), and night use different light counts.
        for (const phase of [150, 22, 390]) {
            await checkpoint();
            cycle.synchronizeElapsedSeconds(phase, true);
            const darkness = cycle.update(0, camera.position);
            updateTownLanterns(0, darkness);
            updateLavaLights(0, camera.position, darkness, userSettings.lavaGlow);
            await renderer.compileAsync(scene, camera);
            await checkpoint();
            renderer.setRenderTarget(target);
            renderer.render(scene, camera);
            renderer.setRenderTarget(previousTarget);
        }
    } finally {
        renderer.setRenderTarget(previousTarget);
        target.dispose();
        for (const [object, original] of visibility) {
            object.visible = original.visible;
            object.frustumCulled = original.frustumCulled;
        }
        for (const object of representatives) scene.remove(object);
        // Cancellation may already have disposed/replaced the arena.
        if (state.scene === scene) {
            cycle.synchronizeElapsedSeconds(elapsed, true);
            const darkness = cycle.update(0, camera.position);
            updateTownLanterns(0, darkness);
            updateEnvironmentVisibility(camera.position, userSettings.renderDistanceChunks);
            updateLavaLights(0, camera.position, darkness, userSettings.lavaGlow);
        }
    }
}
