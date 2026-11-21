import { updateKatanaLightning } from './katanaLightning.js';
import { DAY_DURATION_SECONDS, NIGHT_DURATION_SECONDS, KATANA } from './config.js';
import { KatanaEffects } from './katanaEffects.js';
import { createKatanaSlash } from './katanaSlash.js';
import * as THREE from 'three';
import { state } from './state.js';
import { prepareParticleResources } from './particles.js';
import { forgottenMecha, gothGirlfriend, infantry, prepareWorldInstanceBuffers, updateEnvironmentVisibility, updateLavaLights, updateTownLanterns } from './world.js';
import type { DayNightCycle } from './dayNightCycle.js';
import { userSettings } from './settings.js';

/** Warm WebGL resources before play and restore temporary render state on abort. */
export async function prepareRenderer(cycle: DayNightCycle, checkpoint: () => Promise<void>): Promise<void> {
    const { scene, camera, renderer } = state;
    if (!scene || !camera || !renderer) return;
    const elapsed = cycle.elapsedTimeSeconds;
    const previousTarget = renderer.getRenderTarget();
    let target: THREE.WebGLRenderTarget | undefined;
    let katanaEffects: KatanaEffects | null = null;
    let slash: ReturnType<typeof createKatanaSlash> | null = null;
    const representatives: THREE.Object3D[] = [];
    const visibility = new Map<THREE.Object3D, { visible: boolean; frustumCulled: boolean }>();
    const sword = state.katanaMesh;
    try {
        target = new THREE.WebGLRenderTarget(32, 32);
        representatives.push(...prepareParticleResources(), ...(infantry?.warmModels ?? []));
        if (sword?.userData.lightning) {
            katanaEffects = new KatanaEffects();
            slash = createKatanaSlash();
            updateKatanaLightning(sword.userData.lightning, KATANA.charge, 0, false);
            katanaEffects.sample('warm', 'warm', sword, KATANA.windup + KATANA.chargedSlash, 0, scene);
            katanaEffects.confirm('warm', 'warm', undefined, new THREE.Vector3(), 0, false);
            representatives.push(slash, katanaEffects.impactScene, ...katanaEffects.trails.map(trail => trail.mesh));
        }
        const projectile = state.projectilePool[0];
        if (projectile && !projectile.parent) representatives.push(projectile);
        if (state.hookMesh && !state.hookMesh.parent) representatives.push(state.hookMesh);
        for (const object of representatives) scene.add(object);
        const warmObject = (object: THREE.Object3D) => {
            if (!visibility.has(object)) visibility.set(object, { visible: object.visible, frustumCulled: object.frustumCulled });
            object.visible = true;
            object.frustumCulled = false;
        };
        // Hidden weapon/effect geometry otherwise waits until the first switch/shot
        // to reach WebGL. Draw it only into the tiny offscreen preparation target.
        for (const object of [...representatives, state.playerMesh, state.leftGun, state.pistolMesh, state.shotgunMesh,
            state.arMesh, state.sniperMesh, state.minigunMesh, state.katanaMesh, forgottenMecha?.combat.effects.group, forgottenMecha?.pilot.rockets.group,
            gothGirlfriend?.group]) object?.traverse(warmObject);
        const textures = new Set<THREE.Texture>();
        scene.traverse(object => {
            const material = (object as THREE.Mesh).material;
            for (const mat of Array.isArray(material) ? material : material ? [material] : []) {
                for (const value of Object.values(mat)) if (value instanceof THREE.Texture) textures.add(value);
            }
        });
        await forgottenMecha?.headEffects.prepare(renderer);
        await checkpoint();
        let uploads = 0;
        for (const texture of textures) {
            renderer.initTexture(texture);
            if (++uploads % 8 === 0) await checkpoint();
        }
        prepareWorldInstanceBuffers();
        // Noon, twilight (sun + lanterns), and night use different light counts.
        // Use real scene draws because compileAsync alone need not upload all
        // geometry/textures. Restore the authoritative phase in finally below.
        for (const phase of [DAY_DURATION_SECONDS / 2, DAY_DURATION_SECONDS * 0.07, DAY_DURATION_SECONDS + NIGHT_DURATION_SECONDS / 2]) {
            await checkpoint();
            cycle.synchronizeElapsedSeconds(phase, true);
            const darkness = cycle.update(0, camera.position);
            // Only this lighting variant bypasses the per-lantern chunk mask;
            // warming it must not make the rest of the arena visible.
            updateTownLanterns(0, darkness, true);
            updateLavaLights(0, camera.position, darkness, userSettings.lavaGlow);
            await renderer.compileAsync(scene, camera);
            await checkpoint();
            renderer.setRenderTarget(target);
            renderer.render(scene, camera);
            renderer.setRenderTarget(previousTarget);
            const actor = forgottenMecha;
            if (phase === 150 && actor) {
                // Compile the cockpit-facing material variant before its first
                // visible fold; the deliberate video lag must not be shader work.
                try {
                    actor.preparePilotView(true, true);
                    await renderer.compileAsync(scene, camera);
                    await checkpoint();
                    renderer.setRenderTarget(target); renderer.render(scene, camera);
                } finally { actor.restorePilotView(); renderer.setRenderTarget(previousTarget); }
            }
        }
    } finally {
        renderer.setRenderTarget(previousTarget);
        target?.dispose();
        katanaEffects?.dispose(); slash?.geometry.dispose(); slash?.material.dispose();
        for (const [object, original] of visibility) {
            object.visible = original.visible;
            object.frustumCulled = original.frustumCulled;
        }
        for (const object of representatives) scene.remove(object);
        if (sword?.userData.lightning) updateKatanaLightning(sword.userData.lightning, 0, 0, false);
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
