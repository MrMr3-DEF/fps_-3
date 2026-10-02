// Development-only controls exercise the real match, weapon and UI lifecycle.
// Loaded only by mecha-preview.html; never imported into the production entry.
import * as THREE from 'three';
import { state } from '/src/state.ts';
import { forgottenMecha, queryObstaclesAlongSegment, rebuildTargetHash } from '/src/world.ts';
import { userSettings } from '/src/settings.ts';
import { setTouchMode, beginInput, endInput, isInputActive } from '/src/inputSession.ts';
import { processMechaHit, takePlayerDamage } from '/src/damage.ts';
import { fireProjectile, setThirdPerson } from '/src/weapons.ts';
import { toggleGrapplingHook } from '/src/grapple.ts';
import { applyLookInput } from '/src/lookInput.ts';

const status = parent.document.getElementById('status')!;
const distanceInput = parent.document.getElementById('distance') as HTMLInputElement;
const heightInput = parent.document.getElementById('height') as HTMLInputElement;
const hoverInput = parent.document.getElementById('hover') as HTMLInputElement;
const evadeInput = parent.document.getElementById('evade') as HTMLInputElement;
const shieldInput = parent.document.getElementById('shield') as HTMLInputElement;
const pauseAt = parent.document.getElementById('pause-at') as HTMLSelectElement;
const history = parent.document.getElementById('history')!;
const transitions: string[] = [];
let previous = '', dodged = false;
let scanned = false;
let paused = false;
let walking = false, reversing = false, firing = false;
let previouslyMounted = false;
let turnUntil = 0, frontReview = false;
let observedRenderer: THREE.WebGLRenderer | null = null;
const frontCamera = new THREE.PerspectiveCamera(60, 16 / 9, 0.1, 2000);
// This is an in-memory fixture preference; no saved user setting is changed.
userSettings.mobileInput = 'touch';
setTouchMode(true);
// Keep the review toolbar visible; fullscreen itself is tested by normal play.
document.documentElement.requestFullscreen = async () => {};
window.addEventListener('mecha-review-action', event => {
    const action = (event as CustomEvent<string>).detail;
    if (action === 'front') frontReview = !frontReview;
    if (action === 'player-death') takePlayerDamage(50, 'Review');
    if (action === 'start' || action === 'leave') frontReview = false;
    if (action === 'start') document.getElementById('btn-play-sp')!.click();
    if (action === 'leave') document.getElementById('btn-pause-leave')!.click();
    if (action === 'pause') { if (paused) { paused = false; beginInput(); } else pauseReview(); }
    // Toolbar clicks intentionally blur the iframe, exercising its normal
    // input-release path. Resume before an action that needs live gameplay.
    if (!['pause', 'leave', 'start'].includes(action) && state.isPlaying && state.playerHp > 0) { paused = false; beginInput(); }
    if (action === 'noon') { state.dayNightElapsedSeconds = 150; state.dayNightSyncPending = state.dayNightSyncImmediate = true; }
    if (action === 'head-safe') userSettings.photosensitivityMode = !userSettings.photosensitivityMode;
    const actor = forgottenMecha;
    if (!actor?.ready || !state.camera) return;
    if (action === 'find') {
        const distance = Number(distanceInput.value);
        const point = actor.group.position.clone().add(new THREE.Vector3(Math.sin(actor.group.rotation.y) * distance, Number(heightInput.value), Math.cos(actor.group.rotation.y) * distance));
        state.camera.position.copy(point);
        state.camera.lookAt(actor.hitbox.position);
        state.velocity.set(0, 0, 0);
        if (!isInputActive() && state.playerHp > 0) beginInput();
    }
    if (action === 'scan') scanned = !scanned;
    if (action === 'shoot') fireProjectile();
    if (action === 'sniper') { state.desiredWeaponName = 'SNIPER'; }
    if (action === 'kill') processMechaHit(50);
    if (action === 'cockpit' && actor.canMount) {
        const seat = actor.seatAnchor.getWorldPosition(new THREE.Vector3());
        const forward = new THREE.Vector3(Math.sin(actor.group.rotation.y), 0, Math.cos(actor.group.rotation.y));
        state.camera.position.copy(seat).addScaledVector(forward, 25); state.camera.lookAt(seat); state.velocity.set(0, 0, 0);
        heightInput.value = String(seat.y); hoverInput.checked = true; scanned = false;
    }
    if (action === 'cockpit-ground' && actor.canMount) {
        const seat = actor.seatAnchor.getWorldPosition(new THREE.Vector3());
        const forward = new THREE.Vector3(Math.sin(actor.group.rotation.y), 0, Math.cos(actor.group.rotation.y));
        state.camera.position.copy(seat).addScaledVector(forward, 60); state.camera.position.y = 2;
        state.camera.lookAt(seat.clone().add(new THREE.Vector3(0, 3, 0))); state.velocity.set(0, 0, 0);
        hoverInput.checked = false; scanned = false;
    }
    if (action === 'grapple') toggleGrapplingHook();
    if (action === 'turn') turnUntil = performance.now() + 1000;
    if (action === 'helmet') { window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyO' })); window.dispatchEvent(new KeyboardEvent('keyup', { code: 'KeyO' })); }
    if (action === 'lava' && actor.mode === 'piloted') {
        const pool = state.lavaPools.find(pool => { return !state.obstacles.some(object => object.userData.damageTarget !== 'forgotten-mecha' && Math.abs(object.position.x - pool.position.x) < (object.userData.halfW ?? 3) + actor.radius && Math.abs(object.position.z - pool.position.z) < (object.userData.halfD ?? 3) + actor.radius); });
        if (pool) { actor.group.position.set(pool.position.x, 0, pool.position.z); walking = reversing = false; }
    }
    if (action === 'walk') { walking = !walking; reversing = false; }
    if (action === 'pillar-clearance' && actor.mode === 'piloted') {
        const pillar = state.obstacles.find(object => object.userData.damageTarget !== 'forgotten-mecha' && object.userData.height >= 28
            && object.userData.halfW <= 3.01 && object.userData.halfD <= 3.01
            && Math.abs(object.position.x) < 450 && Math.abs(object.position.z) < 450);
        if (pillar) {
            actor.group.position.set(pillar.position.x + pillar.userData.halfW + actor.radius * 0.85, 0, pillar.position.z - 5);
            actor.group.rotation.y = 0; actor.pilot.reset(0); walking = reversing = false;
        }
    }
    if (action === 'defeat-turn' && actor.hp > 0 && !actor.ownsPilot) {
        state.camera.position.copy(actor.group.position).add(new THREE.Vector3(60, 40, 0)); state.camera.lookAt(actor.hitbox.position);
        state.velocity.set(0, 0, 0); heightInput.value = '40'; hoverInput.checked = true; scanned = false;
    }
    if (action === 'stomp-leg' && actor.hp > 0 && !actor.ownsPilot) {
        const foot = actor.colliders.find(c => c.name.endsWith('-M_Foot_R'))!;
        state.camera.position.copy(foot.position); state.camera.position.y += foot.scale.y / 2 + 2;
        state.camera.lookAt(actor.hitbox.position); state.velocity.set(0, 0, 0); state.canJump = false;
        heightInput.value = String(state.camera.position.y); hoverInput.checked = true; scanned = false;
    }
    if (action === 'reverse') { reversing = !reversing; walking = false; }
    if (action === 'third') setThirdPerson(!state.isThirdPerson);
    if (action === 'rockets') firing = !firing;
    if (action === 'targets' && actor.mode === 'piloted') {
        const direction = state.camera.getWorldDirection(new THREE.Vector3());
        const ray = new THREE.Raycaster(), candidates: THREE.Object3D[] = [];
        let point = new THREE.Vector3();
        for (const distance of [60, 90, 120, 180]) {
            point.copy(state.camera.position).addScaledVector(direction, distance); ray.set(state.camera.position, direction); ray.far = distance;
            const obstacles = queryObstaclesAlongSegment(state.camera.position.x, state.camera.position.z, point.x, point.z, candidates).filter(o => o.userData.damageTarget !== 'forgotten-mecha');
            if (!ray.intersectObjects(obstacles, false).length) break;
        }
        const right = new THREE.Vector3(direction.z, 0, -direction.x).normalize();
        for (let i = 0; i < 3; i++) {
            const target = state.targets[i]; target.position.copy(point).addScaledVector(right, (i - 1) * 3); target.userData.hp = target.userData.maxHp = 50;
            target.visible = target.userData.bodyMesh.visible = true; target.updateMatrixWorld(true);
        }
        rebuildTargetHash();
    }
    if (action === 'jump') { state.canJump = false; state.velocity.y = 70; }
    if (action === 'dodge') dodge();
    if (action === 'punch') {
        const goal = actor.route!.points.at(-1)!;
        actor.group.position.set(goal.x, 0, goal.z);
        // Preserve the actor's real destination, approach heading and animation.
        const heading = actor.route!.heading;
        actor.followRoute({ points: [goal, goal], heading });
        state.camera.position.set(goal.x - Math.sin(heading) * 135, 45, goal.z - Math.cos(heading) * 135);
        state.camera.lookAt(goal.x, 16, goal.z);
        state.velocity.set(0, 0, 0);
    }
});
function dodge() {
    const actor = forgottenMecha;
    if (!actor || !state.camera) return;
    const waist = actor.group.getObjectByName('CTRL_WaistYaw')!;
    const facing = actor.group.rotation.y + 2 * Math.atan2(waist.quaternion.z, waist.quaternion.w);
    const distance = Number(distanceInput.value);
    const eye = actor.group.getObjectByName('PART_EyeLens_01')!.getWorldPosition(new THREE.Vector3());
    const obstacles = state.obstacles.filter(object => object.userData.damageTarget !== 'forgotten-mecha');
    const ray = new THREE.Raycaster(), point = new THREE.Vector3();
    // Choose a clear sideways review point: a pillar would correctly cancel
    // the charge, hiding the horizontal tracking miss we want to inspect.
    for (const offset of [Math.PI / 12, -Math.PI / 12, Math.PI / 6, -Math.PI / 6, Math.PI / 2, -Math.PI / 2]) {
        const yaw = facing + offset;
        point.copy(actor.group.position).add(new THREE.Vector3(Math.sin(yaw) * distance, Number(heightInput.value), Math.cos(yaw) * distance));
        const direction = point.clone().sub(eye); ray.set(eye, direction.clone().normalize()); ray.far = direction.length() - 0.1;
        if (!ray.intersectObjects(obstacles, false).length) break;
    }
    state.camera.position.copy(point);
    state.camera.lookAt(actor.hitbox.position); state.velocity.set(0, 0, 0);
}
function pauseReview() {
    endInput(); paused = true;
    // Keep the ordinary simulation pause, but expose its last rendered frame
    // for effect inspection instead of covering it with the review menu.
    const blocker = document.getElementById('blocker');
    if (blocker) blocker.style.display = 'none';
}
function report() {
    const actor = forgottenMecha;
    if (state.renderer && observedRenderer !== state.renderer) {
        observedRenderer = state.renderer;
        const draw = observedRenderer.render.bind(observedRenderer);
        // A visible asset-review control observes the live actor from the front;
        // normal gameplay camera/targeting are unchanged when it is off.
        observedRenderer.render = (scene, camera) => {
            if (frontReview && forgottenMecha?.mode === 'piloted') {
                const current = forgottenMecha; current.restorePilotView();
                const center = current.group.position.clone().add(new THREE.Vector3(0, 17, 0));
                const facing = new THREE.Vector3(Math.sin(current.pilot.yaw), 0, Math.cos(current.pilot.yaw));
                frontCamera.position.copy(center).addScaledVector(facing, 40); frontCamera.position.y += 7;
                frontCamera.aspect = state.camera!.aspect; frontCamera.updateProjectionMatrix(); frontCamera.lookAt(center);
                draw(scene, frontCamera);
            } else draw(scene, camera);
        };
    }
    if (actor && state.camera && isInputActive()) {
        if (previouslyMounted && !actor.ownsPilot) {
            // Review automation must not pin the released bean at cabin height
            // or keep replaying scope/fire input after the real handoff clears it.
            walking = reversing = firing = scanned = false; hoverInput.checked = shieldInput.checked = false;
        }
        previouslyMounted = actor.ownsPilot;
        if (performance.now() < turnUntil) applyLookInput(state.camera, -0.01, 0);
        if (pauseAt.value === 'aligning' && actor.mode === 'aligning' || pauseAt.value === 'breakup' && actor.mode === 'destroying') { pauseReview(); pauseAt.value = 'none'; }
        if (pauseAt.value === 'rocket' && actor.firingTime >= 1.25 && actor.firingTime < 1.5 || pauseAt.value === 'helmet' && actor.helmetProgress > 0.4 && actor.helmetProgress < 0.6) { pauseReview(); pauseAt.value = 'none'; }
        const head = actor.headView;
        if (pauseAt.value === 'head-mount' && actor.mode === 'startup' && actor.animationTime >= 1.05 && head.phase === 'mount'
            || pauseAt.value === 'head-loading' && head.phase === 'loading' && head.loadingProgress >= 0.35
            || pauseAt.value === 'head-hud' && head.phase === 'hud' && head.hudOpacity >= 0.5
            || pauseAt.value === 'head-reveal' && head.phase === 'reveal' && head.revealProgress >= 0.3
            || pauseAt.value === 'head-black' && actor.mode === 'piloted' && head.blackout >= 0.99) { pauseReview(); pauseAt.value = 'none'; }
        if (hoverInput.checked && !actor.ownsPilot && !state.hookTargetCockpit) { state.camera.position.y = Number(heightInput.value); state.velocity.y = 0; state.canJump = false; }
        if (actor.ownsPilot) { state.moveForward = walking; state.moveBackward = reversing; state.isShiftDown = shieldInput.checked; state.isMouseDown = firing; }
        if (actor.combat.laserPhase !== 'charging') dodged = false;
        if (evadeInput.checked && !dodged && actor.combat.laserPhase === 'charging' && actor.combat.orbRadius / actor.combat.eyeRadius > 0.985) { dodge(); dodged = true; }
        const phase = pauseAt.value;
        if (phase !== 'none' && (phase === actor.combat.laserPhase || phase === actor.combat.shieldPhase)
            && (phase !== 'charging' || actor.combat.orbRadius / actor.combat.eyeRadius > 0.7)
            && (phase !== 'rebuilding' || actor.combat.eyePower >= 0.45)) {
            pauseReview(); pauseAt.value = 'none';
        }
    }
    if (isInputActive()) state.keyCActive = scanned;
    status.textContent = actor ? `Mode: ${actor.mode} | HP: ${actor.hp}/50 | Height: 28 m | Walk: ${actor.speed.toFixed(3)} m/s\nPosition: ${actor.group.position.x.toFixed(1)}, ${actor.group.position.z.toFixed(1)} | Player HP: ${state.playerHp} | Active: ${isInputActive()} | Ended: ${state.matchEnded}`
        : `No mecha | Playing: ${state.isPlaying} | Scene: ${Boolean(state.scene)} | Ended: ${state.matchEnded}`;
    if (actor && state.camera) {
        status.textContent += `\nCockpit available: ${actor.canMount} | Hook: ${state.hookState}${state.hookTargetCockpit ? ' cockpit' : ''} | Mounted: ${actor.ownsPilot} | Clip time: ${actor.animationTime.toFixed(2)}s | Eye: #${(actor.group.getObjectByName('M_EyeLens') as THREE.Mesh<THREE.BufferGeometry, THREE.MeshStandardMaterial> | undefined)?.material.color.getHexString() ?? 'loading'} | Energy: ${(actor.combat.energy * 100).toFixed(1)}% | Shield build: ${actor.combat.manualBuild.toFixed(2)} | Rockets: ${actor.pilot.rockets.activeCount} | Fire phase: ${Number.isFinite(actor.firingTime) ? actor.firingTime.toFixed(2) : 'idle'}s | Helmet: ${actor.helmetClosed ? 'closed' : actor.helmetProgress.toFixed(2)} | Rocket reload: ${actor.pilot.cooldown.toFixed(2)}s | Lock: ${actor.pilot.rockets.selected?.index ?? 'none'} | FOV: ${state.camera.fov.toFixed(1)} | Third person: ${state.isThirdPersonView} | Score: ${state.score}`;
        status.textContent += `\nLaser: ${actor.combat.laserPhase} | Reload: ${actor.combat.reloadRemaining.toFixed(2)} s | Shots: ${actor.combat.shotCount} | Shield: ${actor.combat.shieldPhase} | Protected: ${actor.combat.shieldActive} | Combat clock: ${actor.combat.clock.toFixed(2)} s\nPlayer body height: ${state.camera.position.y.toFixed(2)} m | Range: ${Math.hypot(state.camera.position.x - actor.group.position.x, state.camera.position.z - actor.group.position.z).toFixed(2)} m | Beam: ${actor.combat.beamLength.toFixed(1)} m | Direction: ${actor.combat.beamDirection.toArray().map(n => n.toFixed(3)).join(', ')}`;
        const waist = actor.group.getObjectByName('CTRL_WaistYaw')?.quaternion;
        if (waist) status.textContent += `\nLeg heading: ${(actor.group.rotation.y * 180 / Math.PI).toFixed(1)}° | Torso offset: ${(Math.atan2(waist.z, waist.w) * 360 / Math.PI).toFixed(1)}°`;
        status.textContent += `\nHead view: ${actor.headView.phase} | Eye blend: ${actor.headView.eyeBlend.toFixed(2)} | Black: ${actor.headView.blackout.toFixed(2)} | Loading: ${(actor.headView.loadingProgress * 100).toFixed(1)}% | HUD: ${actor.headView.hudOpacity.toFixed(2)} | Reveal: ${actor.headView.revealProgress.toFixed(2)} | Target ready: ${actor.targetingReady} | Gentle reveal: ${userSettings.photosensitivityMode}`;
        const next = `${actor.combat.laserPhase}/${actor.combat.shieldPhase}/${state.playerHp}`;
        if (next !== previous) {
            transitions.push(`${actor.combat.clock.toFixed(2)}s ${next}`); if (transitions.length > 12) transitions.shift();
            history.textContent = transitions.join(' → '); previous = next;
        }
    } else { previous = ''; transitions.length = 0; history.textContent = ''; }
    requestAnimationFrame(report);
}
report();
