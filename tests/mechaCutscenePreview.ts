// Standalone development fixture. No main.ts, world singleton or networking.
import * as THREE from 'three';
import { MechaGameOverScene, MECHA_ENDING_TIMING } from '/src/mechaGameOverScene.ts';
import { loadUserSettings } from '/src/settings.ts';

const element = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const stage = element<HTMLDivElement>('stage');
const play = element<HTMLButtonElement>('play');
const replay = element<HTMLButtonElement>('replay');
const timeline = element<HTMLInputElement>('timeline');
const clock = element<HTMLOutputElement>('clock');
const status = element<HTMLParagraphElement>('status');
const loading = element<HTMLDivElement>('loading');
const overlay = element<HTMLDivElement>('game-over-overlay');
const approach = element<HTMLSelectElement>('approach');
const offset = element<HTMLSelectElement>('offset');
const lighting = element<HTMLSelectElement>('lighting');
const seed = element<HTMLInputElement>('seed');
const particles = element<HTMLInputElement>('particles');
const gentle = element<HTMLInputElement>('gentle');
const beats = [...document.querySelectorAll<HTMLButtonElement>('[data-beat]')];
const settings = loadUserSettings();
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
gentle.checked = settings.photosensitivityMode || reducedMotion.matches;
gentle.disabled = reducedMotion.matches;
particles.value = String(settings.particleAmount);

const renderer = new THREE.WebGLRenderer({ canvas: element<HTMLCanvasElement>('scene'), antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio * settings.renderScale, 2));
renderer.shadowMap.enabled = settings.shadows;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.info.autoReset = false;
let scene: MechaGameOverScene | null = null;
let playing = false, elapsed = MECHA_ENDING_TIMING.fadeOut + MECHA_ENDING_TIMING.fadeIn, generation = 0, closed = false;
let restartAtBlack = false, activationMs = 0, geometryMs = 0;
let previous = performance.now(), statsAt = previous, frames = 0;
let animationId = 0;
const beatTime = (name: string) => {
    if (!scene) return 0;
    if (name === 'pillar-bounce' || name === 'pillar-breakup') {
        const shattered = name === 'pillar-breakup';
        const contacts = scene.pillarContacts.filter(contact => {
            const point = contact.point.clone().project(scene!.camera);
            return contact.shattered === shattered && contact.at > 1 && Math.abs(point.x) < .9 && Math.abs(point.y) < .8 && point.z > -1 && point.z < 1;
        }).sort((a, b) => scene!.camera.position.distanceToSquared(a.point) - scene!.camera.position.distanceToSquared(b.point));
        const contact = contacts[0] ?? scene.pillarContacts.find(contact => contact.shattered === shattered);
        return scene.impactTime + (contact?.at ?? 1) + .15;
    }
    return ({ 'fade-out': 0, 'fade-in': MECHA_ENDING_TIMING.fadeOut + .25,
        establish: MECHA_ENDING_TIMING.fadeOut + MECHA_ENDING_TIMING.fadeIn,
        punch: scene.punchStart + .5, contact: scene.impactTime,
        chain: scene.impactTime + .4, explosion: scene.impactTime + MECHA_ENDING_TIMING.detonation + .8,
        aftermath: scene.punchStart + scene.punchDuration + .6,
        'game-over': scene.duration } as Record<string, number>)[name] ?? 0;
};

function draw(): void {
    if (!scene || closed) return;
    const frame = scene.seek(elapsed);
    elapsed = frame.time;
    stage.dataset.bounces = String(scene.resources.bounces); stage.dataset.shatters = String(scene.resources.shatters);
    renderer.info.reset();
    scene.render(renderer);
    timeline.value = String(elapsed);
    clock.value = `${elapsed.toFixed(2)} / ${scene.duration.toFixed(2)}`;
    overlay.style.display = frame.gameOver ? 'flex' : 'none';
    stage.dataset.phase = frame.phase;
    play.textContent = playing ? 'Pause' : 'Play';
    status.textContent = playing ? `Playing · ${frame.phase.replaceAll('-', ' ')}` : `Paused · ${frame.phase.replaceAll('-', ' ')} · ${elapsed.toFixed(2)} s`;
    for (const button of beats) {
        const current = button.dataset.beat === frame.phase || button.dataset.beat === 'chain' && frame.impactAge >= 0 && frame.impactAge < MECHA_ENDING_TIMING.detonation
            || button.dataset.beat === 'explosion' && frame.impactAge >= MECHA_ENDING_TIMING.detonation && frame.phase === 'punch';
        if (current) button.setAttribute('aria-current', 'step'); else button.removeAttribute('aria-current');
    }
}

async function rebuild(time = elapsed, resume = false): Promise<void> {
    const current = ++generation;
    playing = false; restartAtBlack = false;
    loading.hidden = false; loading.textContent = 'Preparing Ironmaw…';
    stage.dataset.ready = 'false'; stage.dataset.activation = 'assets';
    overlay.style.display = 'none'; scene?.dispose(); scene = null;
    play.disabled = replay.disabled = timeline.disabled = true;
    element<HTMLOutputElement>('particle-value').value = `${Math.round(Number(particles.value) * 100)}%`;
    let prepared: MechaGameOverScene | null = null;
    try {
        const reviewSeed = Number(seed.value) >>> 0;
        prepared = await MechaGameOverScene.prepare({
            seed: reviewSeed, effectsSeed: (reviewSeed ^ 0x6d2b79f5) >>> 0, heading: Number(approach.value), wallOffset: Number(offset.value),
            lightingElapsed: Number(lighting.value), particleAmount: Number(particles.value),
            photosensitivity: gentle.checked, reducedMotion: reducedMotion.matches, seededScenery: true,
        });
        if (closed || current !== generation) { prepared.dispose(); return; }
        loading.textContent = 'Rebuilding the seeded landscape and baking rubble collisions under black…';
        stage.dataset.activation = 'building';
        const started = performance.now();
        geometryMs = 0;
        await prepared.begin(renderer, async () => {
            if (!geometryMs && prepared!.resources.fragments > 0) geometryMs = performance.now() - started;
            await new Promise<void>(resolve => {
                const channel = new MessageChannel();
                channel.port1.onmessage = () => { channel.port1.close(); channel.port2.close(); resolve(); };
                channel.port2.postMessage(null);
            });
            if (closed || current !== generation) throw new DOMException('Preview replaced', 'AbortError');
        });
        if (closed || current !== generation) { prepared.dispose(); return; }
        activationMs = performance.now() - started;
        scene = prepared; elapsed = Math.min(time, scene.duration); playing = resume;
        previous = performance.now();
        // Round the slider limit up so its millisecond steps can reach the
        // fractional GLB endpoint; seek() clamps that final step exactly.
        timeline.max = String(Math.ceil(scene.duration * 1000) / 1000);
        loading.hidden = true; stage.dataset.ready = 'true'; stage.dataset.activation = 'ready';
        play.disabled = replay.disabled = timeline.disabled = false;
        draw();
    } catch (error) {
        prepared?.dispose();
        if (closed || current !== generation) return;
        loading.textContent = `Unable to prepare scene: ${error instanceof Error ? error.message : String(error)}`;
        status.textContent = 'Preview could not load. Reload to retry.';
        console.error(error);
    }
}

function resize(): void {
    renderer.setSize(stage.clientWidth, stage.clientHeight, false); draw();
}
const observer = new ResizeObserver(resize);
observer.observe(stage);
element<HTMLSelectElement>('viewport').onchange = event => {
    stage.dataset.viewport = (event.target as HTMLSelectElement).value;
};
play.onclick = () => {
    if (!scene) return;
    if (elapsed >= scene.duration) { replay.click(); return; }
    playing = !playing; previous = performance.now(); draw();
};
replay.onclick = () => { elapsed = 0; restartAtBlack = true; playing = true; previous = performance.now(); draw(); };
timeline.oninput = () => { restartAtBlack = false; playing = false; elapsed = Number(timeline.value); draw(); };
beats.forEach(button => button.onclick = () => { if (!scene) return; restartAtBlack = false; playing = false; elapsed = beatTime(button.dataset.beat!); draw(); });
for (const control of [approach, offset, lighting, seed, particles, gentle]) control.onchange = () => { void rebuild(); };
reducedMotion.onchange = () => { gentle.checked ||= reducedMotion.matches; gentle.disabled = reducedMotion.matches; void rebuild(); };
element<HTMLButtonElement>('preview-leave').onclick = () => { location.href = '/'; };

document.addEventListener('keydown', event => {
    if (event.code !== 'Space' || event.target instanceof HTMLInputElement || event.target instanceof HTMLSelectElement || event.target instanceof HTMLButtonElement) return;
    event.preventDefault(); if (!play.disabled) play.click();
});
document.addEventListener('visibilitychange', () => { previous = performance.now(); });
function animate(now: number): void {
    if (closed) return;
    animationId = requestAnimationFrame(animate);
    if (document.hidden) { previous = now; return; }
    if (playing && scene) {
        elapsed = Math.min(scene.duration, elapsed + Math.min((now - previous) / 1000, .1));
        if (restartAtBlack && elapsed >= MECHA_ENDING_TIMING.fadeOut) {
            elapsed = MECHA_ENDING_TIMING.fadeOut; draw();
            void rebuild(elapsed, true); previous = now; return;
        }
        if (elapsed >= scene.duration) playing = false;
        draw();
    }
    previous = now; frames++;
    if (scene && now - statsAt > 700) {
        element<HTMLSpanElement>('metrics').textContent = playing
            ? `${Math.round(frames * 1000 / (now - statsAt))} fps · ${scene.resources.fragments} fragments · ${renderer.info.render.calls} draws`
            : `${scene.resources.fragments} castle fragments · ${scene.resources.pillars} pillars · ${scene.resources.bounces} bounces / ${scene.resources.shatters} shattered · ${Math.round(geometryMs)} ms geometry / ${Math.round(activationMs)} ms activation · camera ${scene.cameraAdjustment.yaw}° / +${scene.cameraAdjustment.height} m`;
        statsAt = now; frames = 0;
    }
}
window.addEventListener('pagehide', () => {
    closed = true; generation++; playing = false; cancelAnimationFrame(animationId); observer.disconnect();
    reducedMotion.onchange = null; scene?.dispose(); scene = null;
    renderer.dispose(); renderer.forceContextLoss();
}, { once: true });
resize(); void rebuild(); animationId = requestAnimationFrame(animate);
