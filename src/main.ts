import { katanaInput, cancelKatana, resetLocalKatana, updateKatana, validateKatanaInput, applyKatanaShake, renderKatanaImpact, resetKatana } from './katana.js';
import { MechaEndingAuthority, type MechaEndingState } from './mechaEndingTimeline.js';
import { MechaEndingPlayback } from './mechaEndingPlayback.js';
import { multiplayerMechaEvents, initializeNetworkMecha, updateMechaNetwork, submitMechaInput, queueMechaLook, requestMechaAction, releaseMechaInput, setMechaPresentation, flushMechaDamage, acknowledgeMechaRender, resetMechaNetwork, markMechaEndingReady, updateMechaEndingNetwork, selectMechaWeapon, localMechaWeapon, previewRocketPeer, commitNetworkWallEnding } from './mechaNetwork.js';
import { cyclePilotWeapon, type PilotWeapon } from './mechaStomp.js';
import { deriveHudPresentation } from './hudPresentation.js';
import { cancelWorldLoading, isWorldLoading, isWorldReveal, withWorldLoading, type WorldLoadingMode } from './worldLoading.js';
import { getPlayerAvatar } from './playerAvatar.js';
import { FirstPersonReloadFrame, getHolderMuzzlePosition } from './firstPersonReload.js';
import { loadCyborgAssets } from './cyborgAvatar.js';
import { prepareRenderer } from './renderPreparation.js';
import { setupSettingsMenu } from './settingsMenu.js';
import { gameplayCode, keyLabel, crosshairSvg } from './controlSettings.js';
import { updateHealthRegen } from './healthRegen.js';
import { checkLavaDamage } from './lavaDamage.js';
export { checkLavaDamage } from './lavaDamage.js';
import { GothChat } from './gothChat.js';
import { ConversationCamera } from './conversationCamera.js';
import { canUseGothChat, getGothConversationPose } from './gothGirlfriend.js';
import { mountSettingsLivePreview, setupMainMenu, updateMenuPreview } from './mainMenu.js';
import { setPlayerListVisible } from './playerList.js';
import { LocatorBar } from './locatorBar.js';
import { WeaponIndicator } from './weaponIndicator.js';
import { setupMobileControls } from './mobileControls.js';
import { MobileControlsEditor } from './mobileControlsEditor.js';
import { cloneTouchLayout } from './mobileControlLayout.js';
import { onInputStarted, onInputEnded, isInputActive, resumeInputAfterOverlay, beginInput, endInput, releaseInputControls, touchMode, touchMove } from './inputSession.js';
import { scopedPointerSensitivity, setLookInputHandler } from './lookInput.js';
import { getEscapePauseAction, shouldPauseOfflineSimulation } from './pauseShortcut.js';
import { broadcastToAll } from './multiplayer.js';
import * as THREE from 'three';
import { PointerLockControls } from './pointerLockControls.js';
import { state, resetMatchStats, resetPlayerState } from './state.js';
import { resetPlayerAtTownSpawn, placePlayerAtTownSpawn } from './playerSpawn.js';
import { updatePowerJumpOnCastleExit } from './powerJump.js';
import {
    JUMP_FORCE,
    NORMAL_JUMP_FORCE,
    PLAYER_HEIGHT,
    DEFAULT_FOV,
    SCOPED_FOV,
    FOV_LERP_SPEED,
    MAX_FRAME_DELTA,
    ROOM_CODE_LENGTH,
    MAP_HALF_SIZE,
    BORDER_WARN_THRESHOLD,
    BORDER_PULSE_DISTANCE,
    MAX_RENDER_DISTANCE_CHUNKS,
    THIRD_PERSON_CAMERA_QUERY_RADIUS,
    GRAPPLE_BLUE,
    MECHA_HEIGHT,
    MECHA_CAMERA_DISTANCE, MECHA_CAMERA_HEIGHT, MECHA_CAMERA_SHOULDER, BULLET_TRAVEL_DISTANCE,
} from './config.js';
import { spawnParticles, spawnGroundImpact, spawnMechaArmorImpact, updateParticles, createShockwave, disposeParticles } from './particles.js';
import { disposeProjectiles, updateProjectiles } from './projectiles.js';
import { applyHudPresentation, setFpsText, updateAccelerometer, updateHealthBar, resetHealthBarFlash, updateHoverBar, updateReloadBar, updateSpeedlines } from './hud.js';
import { updatePlayerPhysics } from './physics.js';
import { resetHook, toggleGrapplingHook, updateHook, updateGrappleCable } from './grapple.js';
import { createAkimboGuns, requestPrimaryFire, toggleHeavyGrapple, requestReload, cancelWeaponHandling, weaponHudFraction, updateWeapons, createPlayerMesh, prepareLocalPlayerAvatar, setThirdPerson, syncThirdPersonPresentation, cancelInspect, resetWeaponPresentation, updatePlayerAvatarPose, SHARED_PROJECTILE_GEO, disposePlayerVisuals } from './weapons.js';
import { isFirearm } from './weaponHandling.js';
import { forgottenMecha, prepareForgottenMecha, gothGirlfriend, createEnvironmentAsync, generateWorldSeed, disposeWorld, getWorldSeed, getWorldBiomeField, getWorldBiomeMapTexture, queryObstaclesNear, queryObstaclesAlongSegment, rebuildTargetHash, respawnTarget, updateEnvironmentVisibility, updateLavaLights, updateTargets, updateTownLanterns, infantry, prepareInfantry, rebuildInfantryHash, isLookingAtTownWell } from './world.js';
import { CameraShake } from './cameraShake.js';
import { triggerMechaImpactShake } from './mechaImpactShake.js';
import type { MechaImpact } from './forgottenMecha.js';
import { DAY_NIGHT_CYCLE_SECONDS, PLAYER_NAME_LAYER, INFANTRY_WARNING_TIME, MECHA_APPROACH_WARNING_TIME, MECHA_STOMP_RADIUS, TOWN_WALL_HP, REGEN_DELAY_MS } from './config.js';
import { setDamageHandlers, type TargetHitResult } from './damage.js';
import {
    sendLocalState, requestMultiplayerRespawn, setMultiplayerLifePresentation, presentMultiplayerHealth,
    startHostMatch,
    onMultiplayerStarted,
    onMultiplayerDisconnected,
    setMultiplayerWorldLoader,
    disconnectMultiplayer,
    broadcastLocalJump,
    generateRoomCode,
    hostGame,
    joinGame,
    broadcastTargetKill,
    updateRemotePeers, infantryAttack, infantryPlayers, publishInfantryKill, publishInfantryState
} from './multiplayer.js';
import { applyRendererSettings, cloneSettings, DEFAULT_USER_SETTINGS, loadUserSettings, saveUserSettings, userSettings, type UserSettings } from './settings.js';
import { setProjectileTrailsEnabled, syncPendingProjectileTrailOrigins } from './projectileTrails.js';
import { targetData } from './userDataTypes.js';
import { clampFrameDelta } from './gameplayMath.js';
import { decodeMouseButtons, MOUSE_BUTTON_EVENT_TYPES } from './mouseButtons.js';
import { RoomAccessChallenge } from './turnSecurity.js';
import { DayNightCycle, getDayNightFogMultiplier } from './dayNightCycle.js';
import { AtmosphereEffects, type AtmosphereFrame } from './atmosphereEffects.js';
import { sampleBiomeFogMultiplier } from './biomes.js';
import { resetLeafAnimation, updateLeafAnimation } from './leafAnimation.js';
import { isGogglesScanZoomReady, SmartGogglesHud } from './smartGoggles.js';
import {
    finishGogglesShutdown,
    resolveGogglesScopeAttempt,
    updateGogglesFailureScan,
} from './gogglesFailure.js';
import { resolveThirdPersonAimTarget, resolveThirdPersonCameraPosition, MechaCameraHandoff } from './thirdPersonCamera.js';
import { releaseMechaPilot, type MechaPilotRelease } from './mechaPilotRelease.js';
import { applyHitmarkerSettings, flashHitmarker, resetHitmarker } from './hitmarker.js';

let endingPlayback: MechaEndingPlayback | null = null;
let offlineEnding: MechaEndingAuthority | null = null;
let endingCover: HTMLDivElement | null = null;
let gothChat: GothChat | null = null;
let chatCharacter: typeof gothGirlfriend = null;
let dayNightCycle: DayNightCycle | null = null;
let lastLanternStrength = 0;
let atmosphere: AtmosphereEffects | null = null;
const atmosphereFrame: AtmosphereFrame = { elapsed: 0, delta: 0, blurAllowed: false, cameraKey: '' };
function drawAtmosphere(): void {
    if (!state.renderer || !state.scene || !state.camera) return;
    if (atmosphere) atmosphere.render(state.renderer, state.scene, state.camera, atmosphereFrame);
    else state.renderer.render(state.scene, state.camera);
}
let smartGoggles: SmartGogglesHud | null = null;
let locatorBar: LocatorBar | null = null;
let weaponIndicator: WeaponIndicator | null = null;
const conversationCamera = new ConversationCamera();
const cameraShake = new CameraShake();
const lastRenderedAimRay = new THREE.Ray();
let hasRenderedAim = false;
function currentThirdPersonAimRay(): THREE.Ray | undefined {
    return state.isThirdPersonView && hasRenderedAim ? lastRenderedAimRay : undefined;
}
let mountedFireRequested = false;
let mountedBoardFov = DEFAULT_FOV;
let mountedControlsPresented = false;
let lastMountedHp: number | null = null;
const mechCameraDimensions = { distance: MECHA_CAMERA_DISTANCE, height: MECHA_CAMERA_HEIGHT, shoulder: MECHA_CAMERA_SHOULDER };
const mechaCameraHandoff = new MechaCameraHandoff();
let lastMechaVideoPhase: string | null = null;
const reducedHeadMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
reducedHeadMotion.addEventListener('change', () => {
    atmosphere?.applySettings({ fog: userSettings.fog, motionBlur: userSettings.motionBlur && !userSettings.photosensitivityMode && !reducedHeadMotion.matches });
});
let approachWarningRemaining = 0;
let exitWarningRemaining = 0;
let defenseWarningRemaining = 0, defenseWarningShown = false;

function clearApproachWarning(): void {
    approachWarningRemaining = 0;
    exitWarningRemaining = 0;
    defenseWarningRemaining = 0;
    const exitWarning = document.getElementById('mecha-exit-warning');
    if (exitWarning) exitWarning.hidden = true;
    const warning = document.getElementById('mecha-approach-warning');
    if (warning) warning.hidden = true;
    const defenseWarning = document.getElementById('defend-town-warning');
    if (defenseWarning) defenseWarning.hidden = true;
}

function updateApproachWarning(delta: number, active: boolean): void {
    const exitWarning = document.getElementById('mecha-exit-warning');
    if (exitWarning) exitWarning.hidden = !active || exitWarningRemaining <= 0;
    if (active) exitWarningRemaining = Math.max(0, exitWarningRemaining - delta);
    if (active && infantry && !defenseWarningShown) {
        defenseWarningShown = true;
        defenseWarningRemaining = INFANTRY_WARNING_TIME;
    }
    const defending = defenseWarningRemaining > 0;
    const warning = document.getElementById('mecha-approach-warning');
    const defenseWarning = document.getElementById('defend-town-warning');
    if (warning) warning.hidden = !active || defending || approachWarningRemaining <= 0;
    if (defenseWarning) defenseWarning.hidden = !active || !defending;
    const visible = defending ? defenseWarning : warning;
    if (visible && !visible.hidden) {
        const elapsed = defending ? INFANTRY_WARNING_TIME - defenseWarningRemaining : MECHA_APPROACH_WARNING_TIME - approachWarningRemaining;
        visible.style.opacity = userSettings.photosensitivityMode || reducedHeadMotion.matches
            ? '1' : String(0.85 + 0.15 * Math.cos(elapsed * Math.PI * 2));
    }
    // Both lifetime and pulse use active gameplay time: pausing hides the
    // message without consuming it or letting an independent animation run.
    if (active && defending) defenseWarningRemaining = Math.max(0, defenseWarningRemaining - delta);
    else if (active) approachWarningRemaining = Math.max(0, approachWarningRemaining - delta);
}

function clearMechaHeadPresentation(): void {
    const screen = document.getElementById('mecha-head-screen');
    if (screen) {
        screen.hidden = true; screen.style.opacity = '0'; screen.setAttribute('aria-hidden', 'true');
        screen.classList.remove('is-helmet-toggle');
    }
    const loading = document.getElementById('mecha-head-loading');
    if (loading) loading.hidden = true;
    UI.gogglesScope?.classList.remove('mecha-head-display');
}

function syncMechaHeadPresentation(): void {
    const actor = forgottenMecha, head = actor?.headView;
    if (!actor?.ownsLocalPilot || !head || head.phase === 'inactive' || state.isThirdPersonView && !actor.transitionCamera.recovering || state.playerHp <= 0) {
        clearMechaHeadPresentation(); return;
    }
    if (state.isThirdPersonView) {
        // Final exit clearance can fail after reverse Mount. Its protected
        // recovery restores the standing pose immediately; mask that jump with
        // a neutral fade, without replaying first-person boot hardware.
        clearMechaHeadPresentation();
        const screen = document.getElementById('mecha-head-screen');
        const opacity = 1 - head.hudOpacity;
        if (screen) { screen.hidden = opacity <= 1e-9; screen.style.opacity = String(opacity); }
        return;
    }
    const safeReveal = userSettings.photosensitivityMode || reducedHeadMotion.matches;
    const opacity = (head.phase === 'reveal' || head.phase === 'shutdown-reveal') && safeReveal ? 1 - head.revealProgress : head.blackout;
    const screen = document.getElementById('mecha-head-screen');
    if (screen) {
        screen.hidden = opacity <= 1e-9; screen.style.opacity = String(opacity);
        screen.classList.toggle('is-helmet-toggle', actor.mode === 'piloted');
        screen.setAttribute('aria-hidden', String(head.phase !== 'loading' && head.phase !== 'hud' && head.phase !== 'shutdown-hud' && head.phase !== 'shutdown'));
    }
    const loading = document.getElementById('mecha-head-loading');
    if (loading) {
        // The completed bar remains visible while boot content crossfades into
        // the hardware layout, so 100% is actually drawn at the standing cue.
        loading.hidden = head.phase !== 'loading' && head.phase !== 'hud' && head.phase !== 'shutdown-hud' && head.phase !== 'shutdown';
        const label = loading.querySelector<HTMLElement>('.world-loading-boot-label');
        if (label) label.textContent = actor.mode === 'shutting-down' ? 'Shutting down...' : 'Loading...';
        loading.style.opacity = String(head.phase === 'hud' || head.phase === 'shutdown-hud' ? 1 - head.hudOpacity : 1);
        const fill = loading.querySelector<HTMLElement>('.world-loading-boot-fill');
        if (fill) fill.style.transform = `scaleX(${head.loadingProgress})`;
        loading.querySelector('[role="progressbar"]')?.setAttribute('aria-valuenow', String(Math.round(head.loadingProgress * 100)));
    }
    UI.gogglesScope?.classList.toggle('mecha-head-display', actor.mode === 'startup' || actor.mode === 'shutting-down');
}

function syncMountedControls(mounted: boolean): void {
    if (!mounted) { UI.gogglesScope?.classList.remove('mecha-goggles'); clearMechaHeadPresentation(); }
    if (mounted === mountedControlsPresented) return;
    state.controls?.resetLook();
    resetHealthBarFlash();
    lastMountedHp = null;
    mountedControlsPresented = mounted;
    if (mounted) {
        cancelWeaponHandling();
        state.weaponHandling.cancelActions();
    } else if (state.playerHp > 0) state.weaponHandling.equip(state.activeWeaponName, state.weaponTime);
    for (const id of ['inspect', 'grapple', 'jump', 'powerJump', 'reload']) {
        const button = document.querySelector<HTMLButtonElement>(`#mobile-controls [data-control="${id}"]`);
        if (button) button.hidden = mounted;
    }
    const shield = document.querySelector<HTMLButtonElement>('#mobile-controls [data-control="hover"]');
    if (shield) { shield.textContent = mounted ? 'Shield' : 'Hover'; shield.setAttribute('aria-label', mounted ? 'Shield' : 'Hover'); }
    const helmet = document.querySelector<HTMLButtonElement>('#mobile-controls [data-control="helmet"]');
    if (helmet) helmet.hidden = !mounted;
    const exit = document.querySelector<HTMLButtonElement>('#mobile-controls [data-control="exit"]');
    if (exit) exit.hidden = !mounted;
    if (UI.hoverContainer) UI.hoverContainer.title = mounted ? 'Shield energy' : 'Hover energy';
}

function mechaImpact(kind: MechaImpact, position: THREE.Vector3, radius?: number): void {
    const actor = forgottenMecha;
    if (!actor || !state.controls) return;
    if (kind === 'punch') { spawnParticles(position, 0x8b887d, 55, 20, 0.65, 35); return; }
    spawnGroundImpact(position, kind === 'step' ? 3 : kind === 'stomp' ? radius ?? MECHA_STOMP_RADIUS : 7, kind !== 'step');
    triggerMechaImpactShake(cameraShake, kind, state.controls.getObject().position, actor.group.position, radius);
}

const mechaImpactDirection = new THREE.Vector3();
function processMechaDamage(damage: number, context?: import('./damage.js').MechaWeaponHit): void {
    if (state.isMultiplayer) {
        if (context?.shotId !== undefined && forgottenMecha) broadcastToAll({ type: 'hit_mecha', revision: forgottenMecha.revision,
            shotId: context.shotId, pelletIndex: context.pelletIndex ?? 0, damage });
        return;
    }
    const mounted = forgottenMecha?.ownsLocalPilot;
    const hit = forgottenMecha?.damage(damage, context);
    if (!hit?.accepted) return;
    if (context?.surface === 'body') spawnMechaArmorImpact(context.point, context.direction ?? mechaImpactDirection.set(
        context.point.x - context.origin.x, context.point.y - context.origin.y, context.point.z - context.origin.z));
    if (mounted) {
        if (forgottenMecha!.ownsLocalPilot) {
            lastMountedHp = forgottenMecha!.hp;
            updateHealthBar(forgottenMecha!.hp / forgottenMecha!.maxHp * 100, '#ff4757');
        }
        return;
    }
    flashHitmarker(hit.killed);
    if (hit.killed) { state.score++; if (UI.score) UI.score.innerText = String(state.score); }
}

function onMechaPilotReleased(pose: MechaPilotRelease): void {
    releaseMechaPilot(pose);
    resetHook(); mountedFireRequested = false;
    mechaCameraHandoff.reset();
    if (state.isThirdPerson && state.camera) {
        const transition = forgottenMecha?.transitionCamera;
        if (transition?.external && transition.phase === 'release') {
            mechaCameraHandoff.beginFromPose(transition.position, transition.quaternion, state.camera.position);
        } else mechaCameraHandoff.begin(pose.viewPosition, state.camera.position, pose.quaternion);
    }
    syncMountedControls(false); smartGoggles?.reset(); syncThirdPersonPresentation();
    resetHealthBarFlash();
    updateHealthBar(state.playerHp / state.playerMaxHp * 100);
    lastFov = -1;
    syncGameHud();
}

// Camera and hazard math reuse scratch vectors across render frames.
const _logicalCameraPos = new THREE.Vector3();
const _logicalCameraQuaternion = new THREE.Quaternion();
const lastViewRotation = new THREE.Quaternion();
let collapseRemaining = 0;
const reloadFrame = new FirstPersonReloadFrame();
const renderedGrappleTip = new THREE.Vector3();
const _thirdPersonAimTarget = new THREE.Vector3();
const _mechaFollowPosition = new THREE.Vector3();
const _mechaFollowQuaternion = new THREE.Quaternion();
const _gogglesWeaponOrigin = new THREE.Vector3();
const _lavaFeetPos = new THREE.Vector3();
const _leafBodyPos = new THREE.Vector3();
const _jumpBoosterPos = new THREE.Vector3();

/** Resolve a tracer's birth-frame muzzle against the rig posed for this draw. */
function resolveSyncedTrailOrigin(weapon: string, out: THREE.Vector3): boolean {
    const rig = getPlayerAvatar(state.playerMesh)?.rig;
    if (!rig || !isFirearm(weapon)) return false;
    // The fitted first-person frame publishes camera-local sockets only while
    // it is active; otherwise the avatar's world-space muzzle is authoritative.
    if (getHolderMuzzlePosition(rig, weapon, out)) return true;
    rig.muzzleFor(weapon).getWorldPosition(out);
    return true;
}

function getLeafInteractionPosition(): THREE.Vector3 | null {
    if (forgottenMecha?.ownsLocalPilot) {
        return _leafBodyPos.copy(forgottenMecha.group.position).setY(
            forgottenMecha.group.position.y + MECHA_HEIGHT * 0.55,
        );
    }
    const source = state.controls?.getObject().position ?? state.camera?.position;
    if (!source) return null;
    // Center foliage interaction on the cyborg's chest rather than eye height
    // so both ground bushes and overhead canopies part naturally around the body.
    return _leafBodyPos.copy(source).setY(source.y - PLAYER_HEIGHT * 0.42);
}
const _lastMotionVelocity = new THREE.Vector3();
const _motionAccel = new THREE.Vector3();
const _motionRight = new THREE.Vector3();
const _thirdPersonObstacleCandidates: THREE.Object3D[] = [];

// Lazily cache HUD/menu elements. Most code paths touch the UI every frame.
const UI_cache: Record<string, HTMLElement | null> = {};
const getUI = <T extends HTMLElement>(id: string): T | null => {
    return (UI_cache[id] || (UI_cache[id] = document.getElementById(id))) as T | null;
};
const UI = {
    get gogglesScope() { return getUI<HTMLElement>('goggles-scope'); },
    get gogglesTargetLayer() { return getUI<HTMLElement>('goggles-target-layer'); },
    get crosshair() { return getUI<HTMLElement>('crosshair'); },
    get hoverContainer() { return getUI<HTMLElement>('hover-container'); },
    get score() { return getUI<HTMLElement>('score'); },
    get deaths() { return getUI<HTMLElement>('deaths'); },
    get kills() { return getUI<HTMLElement>('kills'); },
    get blocker() { return getUI<HTMLElement>('blocker'); },
    get deathOverlay() { return getUI<HTMLElement>('death-overlay'); },
    get worldBorderOverlay() { return getUI<HTMLElement>('world-border-overlay'); },
    get sensSlider() { return getUI<HTMLInputElement>('sensitivity'); },
    get sensValue() { return getUI<HTMLElement>('sens-value'); },
    get settingRawMouseInput() { return getUI<HTMLInputElement>('setting-raw-mouse-input'); },
    get settingRawMouseInputValue() { return getUI<HTMLElement>('setting-raw-mouse-input-value'); },
    get settingMouseSpikeProtection() { return getUI<HTMLInputElement>('setting-mouse-spike-protection'); },
    get settingMouseSpikeProtectionValue() { return getUI<HTMLElement>('setting-mouse-spike-protection-value'); },
    get settingFov() { return getUI<HTMLInputElement>('setting-fov'); },
    get settingFovValue() { return getUI<HTMLElement>('setting-fov-value'); },
    get settingScopedFov() { return getUI<HTMLInputElement>('setting-scoped-fov'); },
    get settingScopedFovValue() { return getUI<HTMLElement>('setting-scoped-fov-value'); },
    get settingRenderScale() { return getUI<HTMLInputElement>('setting-render-scale'); },
    get settingRenderScaleValue() { return getUI<HTMLElement>('setting-render-scale-value'); },
    get settingParticles() { return getUI<HTMLInputElement>('setting-particles'); },
    get settingParticlesValue() { return getUI<HTMLElement>('setting-particles-value'); },
    get settingRenderDistance() { return getUI<HTMLInputElement>('setting-render-distance'); },
    get settingRenderDistanceValue() { return getUI<HTMLElement>('setting-render-distance-value'); },
    get settingWebLLMDownload() { return getUI<HTMLInputElement>('setting-webllm-download'); },
    get settingWebLLMDownloadValue() { return getUI<HTMLElement>('setting-webllm-download-value'); },
    get settingShadows() { return getUI<HTMLInputElement>('setting-shadows'); },
    get settingFog() { return getUI<HTMLInputElement>('setting-fog'); },
    get settingFogValue() { return getUI<HTMLElement>('setting-fog-value'); },
    get settingMotionBlur() { return getUI<HTMLInputElement>('setting-motion-blur'); },
    get settingMotionBlurValue() { return getUI<HTMLElement>('setting-motion-blur-value'); },
    get settingShadowsValue() { return getUI<HTMLElement>('setting-shadows-value'); },
    get settingLavaGlow() { return getUI<HTMLInputElement>('setting-lava-glow'); },
    get settingLavaGlowValue() { return getUI<HTMLElement>('setting-lava-glow-value'); },
    get settingMuzzleFlashes() { return getUI<HTMLInputElement>('setting-muzzle-flashes'); },
    get settingMuzzleFlashesValue() { return getUI<HTMLElement>('setting-muzzle-flashes-value'); },
    get settingMuzzleFlashOpacity() { return getUI<HTMLInputElement>('setting-muzzle-flash-opacity'); },
    get settingMuzzleFlashOpacityValue() { return getUI<HTMLElement>('setting-muzzle-flash-opacity-value'); },
    get settingBulletTrails() { return getUI<HTMLInputElement>('setting-bullet-trails'); },
    get settingBulletTrailsValue() { return getUI<HTMLElement>('setting-bullet-trails-value'); },
    get settingLeafAnimation() { return getUI<HTMLInputElement>('setting-leaf-animation'); },
    get settingLeafAnimationValue() { return getUI<HTMLElement>('setting-leaf-animation-value'); },
    get settingShadowQuality() { return getUI<HTMLSelectElement>('setting-shadow-quality'); },
    get settingFps() { return getUI<HTMLInputElement>('setting-fps'); },
    get settingFpsValue() { return getUI<HTMLElement>('setting-fps-value'); },
    get settingPhotosensitivity() { return getUI<HTMLInputElement>('setting-photosensitivity'); },
    get settingPhotosensitivityValue() { return getUI<HTMLElement>('setting-photosensitivity-value'); },
    get panelMain() { return getUI<HTMLElement>('panel-main'); },
    get panelSettings() { return getUI<HTMLElement>('panel-settings'); },
    get panelMp() { return getUI<HTMLElement>('panel-mp'); },
    get panelHostWaiting() { return getUI<HTMLElement>('panel-host-waiting'); },
    get panelJoinRoom() { return getUI<HTMLElement>('panel-join-room'); },
    get panelPause() { return getUI<HTMLElement>('panel-pause'); },
    get btnPlaySp() { return getUI<HTMLElement>('btn-play-sp'); },
    get btnMenuMp() { return getUI<HTMLElement>('btn-menu-mp'); },
    get btnMenuSettings() { return getUI<HTMLElement>('btn-menu-settings'); },
    get btnSettingsBack() { return getUI<HTMLElement>('btn-settings-back'); },
    get btnSettingsReset() { return getUI<HTMLElement>('btn-settings-reset'); },
    get btnSettingsApply() { return getUI<HTMLElement>('btn-settings-apply'); },
    get btnSettingsDiscard() { return getUI<HTMLElement>('btn-settings-discard'); },
    get btnMpBack() { return getUI<HTMLElement>('btn-mp-back'); },
    get btnMpHostView() { return getUI<HTMLElement>('btn-mp-host-view'); },
    get btnMpJoinView() { return getUI<HTMLElement>('btn-mp-join-view'); },
    get btnHostCancel() { return getUI<HTMLElement>('btn-host-cancel'); },
    get btnHostStart() { return getUI<HTMLElement>('btn-host-start'); },
    get btnJoinConnect() { return getUI<HTMLButtonElement>('btn-join-connect'); },
    get btnJoinCancel() { return getUI<HTMLElement>('btn-join-cancel'); },
    get btnPauseResume() { return getUI<HTMLElement>('btn-pause-resume'); },
    get btnPauseSettings() { return getUI<HTMLButtonElement>('btn-pause-settings'); },
    get btnPauseLeave() { return getUI<HTMLButtonElement>('btn-pause-leave'); },
    get inputRoomCode() { return getUI<HTMLInputElement>('input-room-code'); },
    get roomCodeDisplay() { return getUI<HTMLElement>('room-code-display'); },
    get roomCodeCopyLabel() { return getUI<HTMLElement>('room-code-copy-label'); },
    get joinErrorLog() { return getUI<HTMLElement>('join-error-log'); },
    get pauseLobbyInfo() { return getUI<HTMLElement>('pause-lobby-info'); },
    get pauseRoomCode() { return getUI<HTMLElement>('pause-room-code'); },
    get btnDeathRespawn() { return getUI<HTMLElement>('btn-death-respawn'); },
    get btnDeathLeave() { return getUI<HTMLElement>('btn-death-leave'); },
    get btnCopyCode() { return getUI<HTMLButtonElement>('btn-copy-code'); },
    get hostLobbyStatus() { return getUI<HTMLElement>('host-lobby-status'); },
    get turnstileHostChallenge() { return getUI<HTMLElement>('turnstile-host-challenge'); },
    get turnstileJoinChallenge() { return getUI<HTMLElement>('turnstile-join-challenge'); },
};
// Sequential cycling order for the wheel and touch Weapon control. Number keys below use a different, FPS-style layout.
const WEAPON_CYCLE = ['PISTOL', 'SHOTGUN', 'AR', 'SNIPER', 'MINIGUN', 'KATANA'];

let lastFov = -1;
let pendingSettings: UserSettings = cloneSettings(userSettings);
let syncSettingsMenu: ((settings: UserSettings) => void) | undefined;
let syncMobileControls: (() => void) | undefined;
const mobileControlsEditor = new MobileControlsEditor();
let middleMouseChordActive = false;
let motionHudInitialized = false;
let smoothedGRight = 0;
let smoothedGUp = 0;
let roomFlowGeneration = 0;
let copyFeedbackTimeout: number | null = null;
let settingsOrigin: 'main' | 'pause' = 'main';

const COPY_BUTTON_DEFAULT_TEXT = 'Copy';

const hostRoomChallenge = new RoomAccessChallenge('create-room');
const joinRoomChallenge = new RoomAccessChallenge('join-room');

let fpsFrames = 0;
let fpsLastTime = performance.now();

// Loading and pause overlays stop the loop; restart the sample window so the
// next reading measures play frames instead of idle wall time.
function resetFpsCounters(): void {
    fpsFrames = 0;
    fpsLastTime = performance.now();
}

function validateRoomCode(code: string): string | null {
    if (code.length !== ROOM_CODE_LENGTH) {
        return `Code must be ${ROOM_CODE_LENGTH} characters long!`;
    }
    const allowedCharacters = /^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]+$/;
    if (!allowedCharacters.test(code)) {
        return 'Use only the letters and numbers shown in the room code.';
    }
    return null;
}

function errorMessage(error: unknown, fallback: string): string {
    return error instanceof Error && error.message ? error.message : fallback;
}

function resetHostLobbyUi(): void {
    if (UI.roomCodeDisplay) UI.roomCodeDisplay.innerText = '-'.repeat(ROOM_CODE_LENGTH);
    if (copyFeedbackTimeout !== null) {
        window.clearTimeout(copyFeedbackTimeout);
        copyFeedbackTimeout = null;
    }
    if (UI.btnCopyCode) {
        UI.btnCopyCode.disabled = true;
    }
    if (UI.roomCodeCopyLabel) UI.roomCodeCopyLabel.textContent = COPY_BUTTON_DEFAULT_TEXT;
    if (UI.btnHostStart) UI.btnHostStart.style.display = 'none';
}

async function beginHosting(username: string): Promise<void> {
    const generation = ++roomFlowGeneration;
    const challengeContainer = UI.turnstileHostChallenge;
    resetHostLobbyUi();
    if (UI.hostLobbyStatus) UI.hostLobbyStatus.innerText = 'Complete human verification to create a secure room...';

    if (!challengeContainer) {
        if (UI.hostLobbyStatus) UI.hostLobbyStatus.innerText = 'Secure room verification is unavailable.';
        return;
    }

    try {
        const turnstileToken = await hostRoomChallenge.requestToken(challengeContainer);
        if (generation !== roomFlowGeneration) return;
        hostRoomChallenge.cancel();

        const code = generateRoomCode();
        if (UI.roomCodeDisplay) UI.roomCodeDisplay.innerText = code;
        if (UI.hostLobbyStatus) UI.hostLobbyStatus.innerText = 'Creating secure room...';
        createGameRuntime();
        await hostGame(username, code, turnstileToken);
        if (generation !== roomFlowGeneration || !state.isHost || state.roomCode !== code) return;
        if (UI.btnCopyCode) UI.btnCopyCode.disabled = false;
    } catch (error) {
        if (generation !== roomFlowGeneration) return;
        disposeGameRuntime({ disconnect: false });
        const message = errorMessage(error, 'Unable to create a secure room. Please retry.');
        if (message !== 'Room verification was cancelled.' && UI.hostLobbyStatus) {
            UI.hostLobbyStatus.innerText = message;
        }
        resetHostLobbyUi();
    }
}

async function beginJoining(username: string, roomCode: string): Promise<void> {
    const generation = ++roomFlowGeneration;
    const challengeContainer = UI.turnstileJoinChallenge;
    if (!challengeContainer) {
        if (UI.joinErrorLog) UI.joinErrorLog.innerText = 'Secure room verification is unavailable.';
        return;
    }

    if (UI.joinErrorLog) {
        UI.joinErrorLog.style.color = '#57606f';
        UI.joinErrorLog.innerText = 'Complete human verification to join this room...';
    }
    if (UI.btnJoinConnect) {
        UI.btnJoinConnect.disabled = true;
        UI.btnJoinConnect.innerText = 'Verifying...';
    }

    try {
        const turnstileToken = await joinRoomChallenge.requestToken(challengeContainer);
        if (generation !== roomFlowGeneration) return;
        joinRoomChallenge.cancel();
        createGameRuntime();
        await joinGame(username, roomCode, turnstileToken);
    } catch (error) {
        if (generation !== roomFlowGeneration) return;
        disposeGameRuntime({ disconnect: false });
        const message = errorMessage(error, 'Unable to join the secure room. Please retry.');
        if (message !== 'Room verification was cancelled.' && UI.joinErrorLog) {
            UI.joinErrorLog.style.color = '#ff4757';
            UI.joinErrorLog.innerText = message;
        }
        if (UI.btnJoinConnect) {
            UI.btnJoinConnect.disabled = false;
            UI.btnJoinConnect.innerText = 'Connect';
            UI.btnJoinConnect.removeAttribute('data-connected');
        }
    }
}

function onWindowResize(): void {
    atmosphere?.resetHistory();
    if (state.camera && state.renderer) {
        state.camera.aspect = window.innerWidth / window.innerHeight;
        state.camera.updateProjectionMatrix();
        applyRendererSettings(state.renderer);
    }
    if (UI.panelSettings?.style.display === 'flex' && state.isPlaying && !state.isMultiplayer) {
        requestAnimationFrame(() => renderPausedSettingsPreview());
    }
}

// Renderer and camera setup is intentionally centralized because pointer lock,
// third-person mode and weapon attachments all share the same camera object.
function setupRenderer(): void {
    if (state.camera || state.scene || state.renderer || state.controls) return;
    state.camera = new THREE.PerspectiveCamera(userSettings.fov, window.innerWidth / window.innerHeight, 0.1, 1500);

    state.scene = new THREE.Scene();
    state.scene.background = new THREE.Color(0xd0dbf0);

    const shadowMapSize = userSettings.shadowQuality === 'high' ? 2048 : 1024;
    dayNightCycle = new DayNightCycle(state.scene, {
        shadows: userSettings.shadows,
        shadowMapSize,
    });

    state.renderer = new THREE.WebGLRenderer({ antialias: true });
    applyRendererSettings(state.renderer);
    
    state.renderer.domElement.id = 'game-canvas';
    document.body.appendChild(state.renderer.domElement);

    state.controls = new PointerLockControls(state.camera, document.body);
}

function setupMenuListeners(): void {
    if (UI.btnPlaySp) {
        UI.btnPlaySp.addEventListener('click', (e) => {
            e.stopPropagation();
            startOfflineGame();
        });
    }

    if (UI.btnMenuMp) {
        UI.btnMenuMp.addEventListener('click', (e) => {
            e.stopPropagation();
            if (UI.panelMain) UI.panelMain.style.display = 'none';
            if (UI.panelMp) UI.panelMp.style.display = 'flex';
        });
    }

    if (UI.btnMenuSettings) {
        UI.btnMenuSettings.addEventListener('click', (e) => {
            e.stopPropagation();
            settingsOrigin = 'main';
            resetPendingSettings();
            if (UI.panelMain) UI.panelMain.style.display = 'none';
            if (UI.panelSettings) UI.panelSettings.style.display = 'flex';
        });
    }

    if (UI.btnSettingsBack) {
        UI.btnSettingsBack.addEventListener('click', (e) => {
            e.stopPropagation();
            resetPendingSettings();
            if (UI.panelSettings) UI.panelSettings.style.display = 'none';
            const returnToPause = settingsOrigin === 'pause' && state.isPlaying && !state.isMultiplayer;
            if (returnToPause && state.camera) {
                applyLiveSettings();
                updateEnvironmentVisibility(state.camera.position, userSettings.renderDistanceChunks);
                updateLavaLights(state.dayNightElapsedSeconds, state.camera.position, lastLanternStrength, userSettings.lavaGlow);
            }
            if (UI.panelPause) UI.panelPause.style.display = returnToPause ? 'flex' : 'none';
            if (UI.panelMain) UI.panelMain.style.display = returnToPause ? 'none' : 'flex';
            settingsOrigin = 'main';
        });
    }

    if (UI.btnSettingsReset) {
        UI.btnSettingsReset.addEventListener('click', (e) => {
            e.stopPropagation();
            pendingSettings = cloneSettings(DEFAULT_USER_SETTINGS);
            syncSettingsControls();
            renderPausedSettingsPreview();
        });
    }

    if (UI.btnSettingsApply) {
        UI.btnSettingsApply.addEventListener('click', (e) => {
            e.stopPropagation();
            applyPendingSettings();
        });
    }

    UI.btnSettingsDiscard?.addEventListener('click', (e) => {
        e.stopPropagation();
        resetPendingSettings();
        // The preview mutates the live renderer/world, so restore the committed
        // settings and repaint even though the draft is already discarded.
        renderPausedSettingsPreview();
    });

    if (UI.btnMpBack) {
        UI.btnMpBack.addEventListener('click', (e) => {
            e.stopPropagation();
            if (UI.panelMp) UI.panelMp.style.display = 'none';
            if (UI.panelMain) UI.panelMain.style.display = 'flex';
        });
    }

    if (UI.btnMpHostView) {
        UI.btnMpHostView.addEventListener('click', (e) => {
            e.stopPropagation();
            if (UI.panelMp) UI.panelMp.style.display = 'none';
            if (UI.panelHostWaiting) UI.panelHostWaiting.style.display = 'flex';
            void beginHosting('Guest1');
        });
    }

    if (UI.btnHostCancel) {
        UI.btnHostCancel.addEventListener('click', (e) => {
            e.stopPropagation();
            roomFlowGeneration++;
            hostRoomChallenge.cancel();
            disposeGameRuntime();
            resetHostLobbyUi();
            if (UI.panelHostWaiting) UI.panelHostWaiting.style.display = 'none';
            if (UI.panelMp) UI.panelMp.style.display = 'flex';
        });
    }

    if (UI.btnHostStart) {
        UI.btnHostStart.addEventListener('click', (e) => {
            e.stopPropagation();
            if (startHostMatch() && state.controls) beginInput();
        });
    }

    if (UI.btnMpJoinView) {
        UI.btnMpJoinView.addEventListener('click', (e) => {
            e.stopPropagation();
            if (UI.panelMp) UI.panelMp.style.display = 'none';
            if (UI.panelJoinRoom) UI.panelJoinRoom.style.display = 'flex';
            joinRoomChallenge.cancel();
            if (UI.joinErrorLog) {
                UI.joinErrorLog.style.color = '';
                UI.joinErrorLog.innerText = '';
            }
        });
    }

    if (UI.btnJoinCancel) {
        UI.btnJoinCancel.addEventListener('click', (e) => {
            e.stopPropagation();
            roomFlowGeneration++;
            joinRoomChallenge.cancel();
            disposeGameRuntime();
            if (UI.panelJoinRoom) UI.panelJoinRoom.style.display = 'none';
            if (UI.panelMp) UI.panelMp.style.display = 'flex';
        });
    }

    if (UI.btnJoinConnect) {
        UI.btnJoinConnect.addEventListener('click', (e) => {
            e.stopPropagation();
            const code = UI.inputRoomCode ? UI.inputRoomCode.value.trim().toUpperCase() : '';

            const roomCodeError = validateRoomCode(code);
            if (roomCodeError) {
                if (UI.joinErrorLog) UI.joinErrorLog.innerText = roomCodeError;
                return;
            }
            void beginJoining('Guest', code);
        });
    }

    if (UI.btnPauseResume) {
        UI.btnPauseResume.addEventListener('click', (e) => {
            e.stopPropagation();
            if (state.controls) beginInput();
        });
    }

    if (UI.btnPauseSettings) {
        UI.btnPauseSettings.addEventListener('click', (e) => {
            e.stopPropagation();
            if (!state.isPlaying || state.isMultiplayer || isInputActive()) return;
            settingsOrigin = 'pause';
            resetPendingSettings();
            if (UI.panelPause) UI.panelPause.style.display = 'none';
            if (UI.panelSettings) UI.panelSettings.style.display = 'flex';
            renderPausedSettingsPreview();
        });
    }

    if (UI.btnPauseLeave) {
        UI.btnPauseLeave.addEventListener('click', (e) => {
            e.stopPropagation();
            leaveCurrentGame();
            if (UI.panelPause) UI.panelPause.style.display = 'none';
            if (UI.panelMain) UI.panelMain.style.display = 'flex';
        });
    }

    if (UI.btnDeathRespawn) {
        UI.btnDeathRespawn.addEventListener('click', (e) => {
            e.stopPropagation();
            if (state.isMultiplayer) {
                requestMultiplayerRespawn();
                // The click is the browser gesture for reacquiring input.
                if (state.controls) beginInput();
                return;
            }
            finishLocalRespawn();
        });
    }

    if (UI.btnDeathLeave) {
        UI.btnDeathLeave.addEventListener('click', (e) => {
            e.stopPropagation();
            leaveCurrentGame();
            if (UI.deathOverlay) UI.deathOverlay.style.display = 'none';
            if (UI.blocker) UI.blocker.style.display = 'flex';
            if (UI.panelPause) UI.panelPause.style.display = 'none';
            if (UI.panelMain) UI.panelMain.style.display = 'flex';
        });
    }
    document.getElementById('btn-game-over-leave')?.addEventListener('click', event => {
        event.stopPropagation();
        leaveCurrentGame();
        if (UI.blocker) UI.blocker.style.display = 'flex';
        if (UI.panelPause) UI.panelPause.style.display = 'none';
        if (UI.panelMain) UI.panelMain.style.display = 'flex';
    });

    if (UI.btnCopyCode) {
        UI.btnCopyCode.addEventListener('click', async (e) => {
            e.stopPropagation();
            const button = UI.btnCopyCode;
            const code = state.isMultiplayer && state.isHost ? state.roomCode : null;
            const generation = roomFlowGeneration;

            if (!button || !code || validateRoomCode(code)) {
                if (button) button.disabled = true;
                if (UI.hostLobbyStatus) UI.hostLobbyStatus.innerText = 'The room code is not ready to copy.';
                return;
            }

            try {
                if (!navigator.clipboard?.writeText) throw new Error('Clipboard API unavailable');
                await navigator.clipboard.writeText(code);
                if (generation !== roomFlowGeneration) return;
                if (UI.roomCodeCopyLabel) UI.roomCodeCopyLabel.textContent = 'Copied';
                if (copyFeedbackTimeout !== null) window.clearTimeout(copyFeedbackTimeout);
                copyFeedbackTimeout = window.setTimeout(() => {
                    if (UI.roomCodeCopyLabel) UI.roomCodeCopyLabel.textContent = COPY_BUTTON_DEFAULT_TEXT;
                    copyFeedbackTimeout = null;
                }, 1500);
            } catch {
                if (generation !== roomFlowGeneration) return;
                if (UI.roomCodeCopyLabel) UI.roomCodeCopyLabel.textContent = COPY_BUTTON_DEFAULT_TEXT;
                if (UI.hostLobbyStatus) {
                    UI.hostLobbyStatus.innerText = 'Clipboard access was blocked. Select the displayed code and copy it manually.';
                }
            }
        });
    }
}

// Pointer lock means keyboard and mouse state must be tracked globally, then
// consumed by the physics/weapons systems during the frame update.
function setupInputListeners(): void {
    setLookInputHandler((yaw, pitch, time) => {
        const actor = forgottenMecha;
        if (!actor?.ownsLocalPilot) return false;
        if (state.isMultiplayer) queueMechaLook(yaw, pitch); else actor.look(yaw, pitch, time);
        return true;
    });
    // Reacquire after key release so Escape cannot immediately unlock the new session.
    let resumeOnEscapeUp = false;
    const onKeyDown = (e: Pick<KeyboardEvent, 'code' | 'repeat'> & { preventDefault?: () => void }, code = e.code) => {
        if (state.matchEnded) return;
        // O is a vehicle-only binding, outside the bean's rebindable actions.
        if (e.code === 'KeyO' && forgottenMecha?.ownsLocalPilot) code = 'KeyO';
        if (e.code === 'Tab' && state.isMultiplayer && state.isPlaying && isInputActive()) {
            e.preventDefault?.();
            if (!e.repeat && !gothChat?.isOpen) setPlayerListVisible(true);
            return;
        }
        // Movement state is already held between key events; repeated keydown
        // events must not toggle hook/view/weapon actions multiple times.
        if (e.repeat || gothChat?.isOpen) return;
        if (code !== 'Escape' && !isInputActive()) return;
        if (e.code === 'F2' && state.isPlaying) {
            e.preventDefault?.();
            cinematicMode = !cinematicMode;
            applyCinematicMode(cinematicMode);
            return;
        }
        if (code && code !== 'Escape') e.preventDefault?.();
        if (forgottenMecha?.ownsLocalPilot) {
            if (code === 'Digit1' || code === 'Digit2') { selectMountedWeapon(code === 'Digit1' ? 'rocket' : 'stomp'); return; }
            if (!['Escape', 'KeyW', 'KeyS', 'KeyC', 'KeyP', 'KeyO', 'KeyR', 'KeyE', 'TouchWeapon', 'ShiftLeft', 'ShiftRight'].includes(code)) return;
        }

        switch (code) {
            case 'Escape':
                // Use the visible screen's button so Escape shares its cleanup and
                // return destination. Keybind capture and chat consume Escape first.
                const backButton = [...document.querySelectorAll<HTMLButtonElement>('[data-menu-back]')]
                    .find(button => !button.disabled && button.getClientRects().length > 0);
                if (backButton) {
                    e.preventDefault?.();
                    backButton.click();
                    break;
                }
                if (!state.controls) break;
                const pauseAction = getEscapePauseAction(e.code, {
                    isPlaying: state.isPlaying,
                    isAlive: state.playerHp > 0,
                    isInputActive: isInputActive(),
                    isPauseMenuVisible: UI.panelPause?.style.display === 'flex',
                });
                if (pauseAction) {
                    e.preventDefault?.();
                    if (pauseAction === 'pause') endInput();
                    else resumeOnEscapeUp = true;
                }
                break;
            case 'KeyW': state.moveForward = true; break;
            case 'KeyO': if (state.isMultiplayer) requestMechaAction('helmet'); else forgottenMecha?.toggleHelmet(); break;
            case 'KeyA': state.moveLeft = true; break;
            case 'KeyS': state.moveBackward = true; break;
            case 'KeyD': state.moveRight = true; break;
            case 'ShiftLeft':
            case 'ShiftRight':
                if (state.controls && isInputActive()) {
                    state.isShiftDown = true;
                }
                break;
            case 'ControlLeft':
            case 'ControlRight':
                if (isInputActive()) state.powerJumpEnabled = !state.powerJumpEnabled;
                break;
            case 'Space':
                if (!state.controls) break;
                if (!isInputActive()) break;
                if (state.canJump || state.hookState === 'PULLING') {
                    const fromHook = state.hookState === 'PULLING';
                    if (fromHook) resetHook();
                    state.normalJumpActive = !state.powerJumpEnabled;
                    state.velocity.y = state.powerJumpEnabled
                        ? (fromHook ? JUMP_FORCE * 0.8 : state.velocity.y + JUMP_FORCE)
                        : NORMAL_JUMP_FORCE;
                    state.canJump = false;
                    if (state.powerJumpEnabled) {
                        _jumpBoosterPos.copy(state.controls.getObject().position);
                        _jumpBoosterPos.y -= 1.8;
                        getPlayerAvatar(state.playerMesh)?.powerJump();
                        createShockwave(_jumpBoosterPos, 15.0);
                    }
                    broadcastLocalJump(state.powerJumpEnabled);
                }
                cancelInspect();
                break;
            case 'KeyF':
                interactWithGirlfriend(e);
                break;
            case 'KeyG':
                toggleHeavyGrapple();
                break;
            case 'KeyE':
                if (state.controls && isInputActive()) {
                    if (forgottenMecha?.ownsLocalPilot) {
                        if (state.isMultiplayer) { requestMechaAction('exit'); break; }
                        if (forgottenMecha.requestExit(state.isThirdPerson, state.rightClickActive)) {
                            state.isMouseDown = state.keyCActive = state.rightClickActive = state.isScoped = state.isShiftDown = false;
                            mountedFireRequested = false;
                        }
                        break;
                    }
                    cancelInspect();
                    toggleGrapplingHook();
                }
                break;
            case 'KeyR':
                if (forgottenMecha?.ownsLocalPilot) cycleWeapon(1);
                else requestReload();
                break;
            case 'TouchWeapon':
                cycleWeapon(1);
                break;
            case 'Digit1':
                if (state.controls && isInputActive()) {
                    state.desiredWeaponName = 'PISTOL';
                    cancelInspect();
                }
                break;
            case 'Digit2':
                if (state.controls && isInputActive()) {
                    state.desiredWeaponName = 'SHOTGUN';
                    cancelInspect();
                }
                break;
            case 'Digit3':
                if (state.controls && isInputActive()) {
                    state.desiredWeaponName = 'AR';
                    cancelInspect();
                }
                break;
            case 'Digit4':
                if (state.controls && isInputActive()) {
                    state.desiredWeaponName = 'SNIPER';
                    cancelInspect();
                }
                break;
            case 'KeyV':
                if (state.controls && isInputActive() && !forgottenMecha?.ownsLocalPilot) { state.desiredWeaponName = 'KATANA'; cancelInspect(); }
                break;
            case 'Digit5':
                if (state.controls && isInputActive()) {
                    state.desiredWeaponName = 'MINIGUN';
                    cancelInspect();
                }
                break;
            case 'KeyX':
                if (state.controls && isInputActive() && state.switchState === 'IDLE') {
                    if (state.weaponHandling.reload) break;
                    state.inspectState = 'INSPECTING';
                    state.inspectTimer = 0.0;
                }
                break;
            case 'KeyC':
                if (state.controls && isInputActive() && !forgottenMecha?.localTransition?.locked) {
                    state.keyCActive = true;
                    syncThirdPersonPresentation();
                    refreshScopedState();
                    cancelInspect();
                }
                break;
            case 'KeyP':
                if (state.controls && isInputActive()) {
                    setThirdPerson(!state.isThirdPerson);
                }
                break;
        }
    };

    const onKeyUp = (e: Pick<KeyboardEvent, 'code'> & { preventDefault?: () => void }, code = e.code) => {
        if (e.code === 'Tab') {
            setPlayerListVisible(false);
            if (state.isMultiplayer && state.isPlaying && isInputActive()) e.preventDefault?.();
            return;
        }
        switch (code) {
            case 'Escape':
                if (!resumeOnEscapeUp) break;
                resumeOnEscapeUp = false;
                e.preventDefault?.();
                if (state.controls && getEscapePauseAction(e.code, {
                    isPlaying: state.isPlaying,
                    isAlive: state.playerHp > 0,
                    isInputActive: isInputActive(),
                    isPauseMenuVisible: UI.panelPause?.style.display === 'flex',
                }) === 'resume') beginInput();
                break;
            case 'KeyW': state.moveForward = false; break;
            case 'KeyA': state.moveLeft = false; break;
            case 'KeyS': state.moveBackward = false; break;
            case 'KeyD': state.moveRight = false; break;
            case 'KeyC':
                state.keyCActive = false;
                syncThirdPersonPresentation();
                refreshScopedState();
                break;
            case 'ShiftLeft':
            case 'ShiftRight':
                state.isShiftDown = false;
                break;
        }
    };

    syncMobileControls = setupMobileControls({
        keyDown: code => onKeyDown({ code, repeat: false }),
        keyUp: code => onKeyUp({ code }),
        cancelFire: () => { cancelKatana(); if (state.weaponHandling.pendingFire) cancelWeaponHandling(); },
        fire: held => {
            state.isMouseDown = held;
            if (!held && state.isMultiplayer && (state.weaponHandling.hand !== 'holstered' || state.weaponHandling.pendingFire)) sendLocalState(true);
            if (forgottenMecha?.ownsLocalPilot) { mountedFireRequested ||= held; return; }
            if (state.activeWeaponName === 'KATANA' && state.desiredWeaponName === 'KATANA') { katanaInput(held); return; }
            if (held) requestPrimaryFire(true, currentThirdPersonAimRay());
        },
        layout: bounds => weaponIndicator?.placeTouch(userSettings.touchLayout, bounds, userSettings.touchFireMode),
    });
    document.getElementById('npc-interaction')?.addEventListener('click', event => {
        event.preventDefault();
        event.stopPropagation();
        interactWithGirlfriend();
    });
    document.getElementById('powerjump-toggle')?.addEventListener('click', () => {
        if (isInputActive() && !forgottenMecha?.ownsLocalPilot) state.powerJumpEnabled = !state.powerJumpEnabled;
    });
    window.addEventListener('keydown', e => onKeyDown(e, gameplayCode(e.code, userSettings.keybinds)));
    window.addEventListener('keyup', e => onKeyUp(e, gameplayCode(e.code, userSettings.keybinds)));
    window.addEventListener('blur', () => setPlayerListVisible(false));

    // Mouse down/up fires for every button transition, including pressing Aim
    // while Fire remains held. Pointer down/up only covers the first/last button.
    for (const eventType of MOUSE_BUTTON_EVENT_TYPES) {
        window.addEventListener(eventType, handleGameMouseButtons, true);
    }
    window.addEventListener('pointercancel', handleGameMouseButtons, true);
    window.addEventListener('contextmenu', preventLockedMouseDefault, true);
    window.addEventListener('auxclick', preventLockedMouseDefault, true);
    window.addEventListener('wheel', handleWeaponWheel, { passive: false });

    window.addEventListener('resize', onWindowResize);
}

function interactWithGirlfriend(trigger?: { code: string; preventDefault?: () => void }): void {
    if (forgottenMecha?.ownsLocalPilot) return;
    if (!state.camera || !state.isPlaying || state.playerHp <= 0 || !isInputActive() || gothChat?.isOpen) return;
    if (!canUseGothChat(state) || !gothGirlfriend?.interact(state.camera, state.obstacles)) return;
    chatCharacter = gothGirlfriend;
    gothChat?.open(trigger);
}

// Build match-owned systems after controls exist because several meshes attach to the camera.
function setupGameSystems(): void {
    if (!state.scene || !state.controls) return;
    state.scene.add(state.controls.getObject());

    createAkimboGuns();
    createPlayerMesh();

    const hookGeo = new THREE.CylinderGeometry(0.035, 0.035, 1, 8);
    hookGeo.rotateX(Math.PI / 2);
    const hookMat = new THREE.MeshBasicMaterial({ color: GRAPPLE_BLUE, toneMapped: false });
    state.hookMesh = new THREE.Mesh(hookGeo, hookMat);
    state.hookMesh.castShadow = true;
    state.hookMesh.receiveShadow = true;

    // Bullets are pooled because rapid-fire weapons can otherwise cause frame spikes.
    const preAllocCount = 128;
    for (let i = 0; i < preAllocCount; i++) {
        const projMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
        const projectile = new THREE.Mesh(SHARED_PROJECTILE_GEO, projMat);
        projectile.userData = {};
        projectile.visible = false;
        state.projectilePool.push(projectile);
    }
}

function disposeHookMesh(): void {
    if (!state.hookMesh) return;
    state.hookMesh.parent?.remove(state.hookMesh);
    state.hookMesh.geometry.dispose();
    const materials = Array.isArray(state.hookMesh.material) ? state.hookMesh.material : [state.hookMesh.material];
    materials.forEach((mat) => mat.dispose());
    state.hookMesh = null;
}

function createGameRuntime(): void {
    if (state.scene && state.camera && state.renderer && state.controls) return;
    if (state.scene || state.camera || state.renderer || state.controls) disposeGameRuntime();
    setupRenderer();
    setupGameSystems();
    applyLiveSettings();
    state.prevTime = performance.now();
    resetFpsCounters();
}

interface DisposeGameRuntimeOptions {
    disconnect?: boolean;
}
let disposingGameRuntime = false;
let cinematicMode = false;

function applyCinematicMode(active: boolean): void {
    document.body.classList.toggle('cinematic-mode', active);
    if (active) state.camera?.layers.disable(PLAYER_NAME_LAYER);
    else state.camera?.layers.enable(PLAYER_NAME_LAYER);
}

function currentHudPresentation() {
    const pilot = forgottenMecha?.ownsLocalPilot ? forgottenMecha : null;
    return deriveHudPresentation({
        runtime: Boolean(state.scene && state.camera && state.renderer && state.controls),
        playing: state.isPlaying, input: isInputActive(), alive: state.playerHp > 0,
        ended: state.matchEnded, conversation: gothChat?.isOpen ?? false,
        loading: isWorldLoading, reveal: isWorldReveal, editor: mobileControlsEditor.isOpen,
        scoped: state.isScoped, thirdPerson: state.isThirdPersonView, touch: touchMode,
        showFps: userSettings.showFps, multiplayer: state.isMultiplayer,
        pilot: pilot ? { mode: pilot.mode, phase: pilot.headView.phase, blackout: pilot.headView.blackout,
            targetingReady: pilot.targetingReady, hudOpacity: pilot.hudOpacity, recoveringExit: pilot.transitionCamera.recovering } : null,
    });
}

function syncGameHud(): void {
    const presentation = currentHudPresentation();
    applyHudPresentation(presentation, state.powerJumpEnabled);
    if (!presentation.locator) updateWallHud(false);
    if (!presentation.accelerometer || !motionHudInitialized) updateLocalAccelerometer(0);
    updateSpeedlines(state.velocity.length(), presentation.speedlines);
    updateWorldBorderOverlay(presentation.border);
    const pilot = forgottenMecha?.ownsLocalPilot ? forgottenMecha : null;
    if (presentation.ordinary) weaponIndicator?.update(state.activeWeaponName, pilot ? pilot.pilotWeapon : false);
    updateHealthBar(pilot ? pilot.hp / pilot.maxHp * 100 : state.playerHp / state.playerMaxHp * 100);
    updateReloadBar(pilot ? pilot.reloadProgress : weaponHudFraction());
    updateHoverBar(pilot ? pilot.combat.energy : state.hoverFuel, presentation.ordinary && (pilot ? pilot.combat.shieldActive : state.isHovering));
    if (presentation.hardware) syncMechaHeadPresentation(); else clearMechaHeadPresentation();
}

const wallHudAnchor = new THREE.Vector3();

function updateWallHud(visible: boolean): void {
    const status = getUI<HTMLElement>('wall-durability');
    if (!status) return;
    status.hidden = !visible || !infantry || !state.camera || !isLookingAtTownWell(state.camera, wallHudAnchor);
    if (!status.hidden && state.camera) {
        wallHudAnchor.project(state.camera);
        status.hidden = wallHudAnchor.z < -1 || wallHudAnchor.z > 1;
        status.style.left = `${(wallHudAnchor.x + 1) * 50}%`;
        status.style.top = `${(1 - wallHudAnchor.y) * 50}%`;
    }
    if (!status.hidden) {
        const progress = getUI<HTMLProgressElement>('wall-durability-bar');
        if (progress) { progress.max = TOWN_WALL_HP; progress.value = infantry!.wallHp; }
    }
}

function hideGameHud(): void { syncGameHud(); }

function disposeGameRuntime(options: DisposeGameRuntimeOptions = {}): void {
    if (disposingGameRuntime) return;
    disposingGameRuntime = true;
    try {
        cinematicMode = false;
        applyCinematicMode(false);
        endingPlayback?.dispose(); endingPlayback = null; offlineEnding = null;
        defenseWarningShown = false;
        const gameOverReason = getUI<HTMLElement>('game-over-reason');
        if (gameOverReason) gameOverReason.textContent = 'Forgotten Mecha reached the castle.';
        endingCover?.remove(); endingCover = null; document.body.classList.remove('mecha-ending');
        mobileControlsEditor.cancel();
        clearApproachWarning();
        hasRenderedAim = false;
        mechaCameraHandoff.reset();
        mountedFireRequested = false;
        syncMountedControls(false);
        resetMechaNetwork();
        cancelWorldLoading();
        state.isPlaying = false;
        state.pendingPlay = false;
        endInput();
        middleMouseChordActive = false;
        hideGameHud();
        resetHealthBarFlash();
        cameraShake.reset(); resetKatana();
        const gameOverOverlay = document.getElementById('game-over-overlay');
        if (gameOverOverlay) gameOverOverlay.style.display = 'none';
        if (UI.deathOverlay) UI.deathOverlay.style.display = 'none';
        gothChat?.reset({ preserveLoadedModel: userSettings.downloadWebLLMImmediately });
        smartGoggles?.reset();
        locatorBar?.reset();
        weaponIndicator?.reset();
        conversationCamera.cancel();
        chatCharacter = null;
        if (options.disconnect !== false) disconnectMultiplayer({ notifyRuntime: false });
        resetHook();
        disposeProjectiles();
        disposeParticles();
        disposePlayerVisuals();
        disposeHookMesh();
        disposeWorld();
        resetLeafAnimation();
        atmosphere?.dispose(); atmosphere = null;
        dayNightCycle?.dispose();
        dayNightCycle = null;

        const controls = state.controls;
        const scene = state.scene;
        const renderer = state.renderer;
        controls?.dispose();
        scene?.clear();
        if (renderer) {
            renderer.renderLists.dispose();
            renderer.dispose();
            renderer.forceContextLoss();
            renderer.domElement.remove();
        }
        state.controls = null;
        releaseInputControls(controls);
        state.camera = null;
        state.scene = null;
        state.renderer = null;

        state.activeWeaponName = 'PISTOL';
        resetPlayerState();
        resetMatchStats();
        state.desiredWeaponName = 'PISTOL';
        state.nextWeaponName = null;
        state.switchState = 'IDLE';
        state.switchTimer = 0;
        state.isThirdPerson = false;
        state.isThirdPersonView = false;
        state.prevTime = performance.now();
        lastFov = -1;
        syncHudCounters();
    } finally { reloadFrame.clear(); disposingGameRuntime = false; }
}

// Shared by offline start, host registration, and client snapshots. The scene
// identity and caller's session check keep an old async load out of a new match.
async function loadPreparedWorld(
    seed: number,
    current: () => boolean = () => true,
    loadingMode: WorldLoadingMode = 'world',
    onPrepared?: () => void,
    spawnSlot = 0,
): Promise<void> {
    const scene = state.scene;
    await withWorldLoading(async paint => {
        const checkpoint = async () => {
            await paint();
            if (state.scene !== scene || !current()) throw new DOMException('Loading cancelled', 'AbortError');
        };
        await loadCyborgAssets();
        await checkpoint();
        prepareLocalPlayerAvatar();
        await createEnvironmentAsync(seed, checkpoint);
        atmosphere?.dispose();
        atmosphere = new AtmosphereEffects(seed);
        atmosphere.setBiomeMap(getWorldBiomeMapTexture());
        atmosphere.applySettings({ fog: userSettings.fog, motionBlur: userSettings.motionBlur && !userSettings.photosensitivityMode && !reducedHeadMotion.matches });
        await prepareForgottenMecha(state.isMultiplayer ? multiplayerMechaEvents() : {
            impact: mechaImpact,
            stompPlayer: () => takePlayerDamage(state.playerMaxHp, 'Forgotten Mecha'),
            laserPlayer: damage => takePlayerDamage(damage, 'Forgotten Mecha'),
            rocketPlayer: damage => takePlayerDamage(damage, 'Forgotten Mecha'),
            gameOver: () => triggerDeath(true),
            wallPunchStarted: () => commitOfflineEnding(),
            pilotReleased: pose => { if (state.scene === scene) onMechaPilotReleased(pose); },
            exitBlocked: () => { if (state.scene === scene) exitWarningRemaining = 3; },
        }, checkpoint);
        await prepareInfantry({ attack: infantryAttack, wallLost: (position, heading) => {
            if (state.isMultiplayer) {
                publishInfantryState(true);
                commitNetworkWallEnding(position, heading);
            } else commitOfflineEnding({ position, heading });
        } }, checkpoint);
        if (state.isMultiplayer) initializeNetworkMecha();
        placePlayerAtTownSpawn(seed, 'house', spawnSlot);
        if (dayNightCycle) await prepareRenderer(dayNightCycle, checkpoint);
        if (state.renderer && atmosphere) { await atmosphere.prepare(state.renderer); await checkpoint(); }
        if (onPrepared) {
            if (state.scene !== scene || !current()) throw new DOMException('Loading cancelled', 'AbortError');
            onPrepared();
        }
    }, loadingMode);
    // No simulation ran during preparation; discard that wall time before play.
    state.prevTime = performance.now();
    resetFpsCounters();
}

async function startOfflineGame(): Promise<void> {
    if (isWorldLoading) return;
    // A denied initial pointer-lock request can be retried without regenerating.
    if (state.pendingPlay && state.scene && !state.isMultiplayer) { beginInput(); return; }
    disposeGameRuntime();
    const startupError = document.getElementById('startup-error');
    if (startupError) startupError.hidden = true;
    settingsOrigin = 'main';
    createGameRuntime();
    state.isMultiplayer = false;
    state.isHost = false;
    const scene = state.scene;
    const loading = loadPreparedWorld(generateWorldSeed(), () => true, 'boot', () => {
        // Finish spawn and HUD state while the boot overlay is still opaque.
        performPlayerReset(true);
        syncGogglesFailureVisuals();
    });
    state.pendingPlay = true;
    // Keep pointer lock/fullscreen in the original click gesture, before awaits.
    beginInput();
    try {
        await loading;
        if (state.scene !== scene) return;
        // Arm only this fresh offline match after its boot overlay has gone.
        // Input retries and respawns never replay the one-time warning.
        approachWarningRemaining = MECHA_APPROACH_WARNING_TIME;
        state.prevTime = performance.now();
    } catch (error) {
        if (state.scene !== scene) return;
        disposeGameRuntime();
        if (UI.blocker) UI.blocker.style.display = 'flex';
        if (UI.panelMain) UI.panelMain.style.display = 'flex';
        if (startupError) {
            startupError.textContent = 'The world could not finish loading. Please try again.';
            startupError.hidden = false;
        }
        console.error('Unable to prepare the arena:', error);
    }
}

function leaveCurrentGame(): void {
    setPlayerListVisible(false);
    state.isPlaying = false;
    state.pendingPlay = false;
    settingsOrigin = 'main';
    endInput();
    disposeGameRuntime();
}

function performPlayerReset(resetMatch = false): void {
    atmosphere?.resetHistory();
    state.controls?.resetLook();
    resetHealthBarFlash();
    resetHitmarker();
    clearApproachWarning();
    if (!state.isMultiplayer) { forgottenMecha?.clearPendingDamage(); forgottenMecha?.pilot.rockets.clear(); }
    resetPlayerAtTownSpawn(getWorldSeed(), resetMatch ? 'house' : 'church');
    resetLocalKatana();
    syncMountedControls(false);
    syncThirdPersonPresentation();
    resetWeaponPresentation();
    if (resetMatch) resetMatchStats();
    syncHudCounters();
    updateHealthBar(100);
    resetHook();
}

function finishLocalRespawn(): void {
    performPlayerReset();
    if (state.isThirdPersonView && state.playerMesh) state.playerMesh.visible = true;
    if (UI.deathOverlay) UI.deathOverlay.style.display = 'none';
    if (state.controls && !isInputActive()) beginInput();
}

function formatPercent(value: number): string {
    return `${Math.round(value * 100)}%`;
}

function clampNumber(value: number, min: number, max: number, fallback: number): number {
    if (!Number.isFinite(value)) return fallback;
    return Math.max(min, Math.min(max, value));
}

function setCheckboxLabel(el: HTMLElement | null, enabled: boolean): void {
    if (el) el.innerText = enabled ? 'On' : 'Off';
}

function isGameInputLocked(): boolean {
    return !gothChat?.isOpen && isInputActive();
}

function preventLockedMouseDefault(e: Event): void {
    if (isGameInputLocked()) {
        e.preventDefault();
    }
}

function handleGameMouseButtons(e: MouseEvent | PointerEvent): void {
    if (touchMode || ('pointerType' in e && e.pointerType === 'touch')) return;
    preventLockedMouseDefault(e);
    if (!isGameInputLocked()) return;

    const wasMouseDown = state.isMouseDown;
    updateMouseButtonStateFromChange(e);
    // A quick release and repress between movement ticks must still give the
    // host the new trigger edge required to take the grapple hand back.
    if (wasMouseDown && !state.isMouseDown && state.isMultiplayer &&
        (state.weaponHandling.hand !== 'holstered' || state.weaponHandling.pendingFire)) sendLocalState(true);
    if (e.type === 'pointercancel') {
        cancelKatana();
        if (state.weaponHandling.pendingFire) cancelWeaponHandling();
        return;
    }
    if (state.activeWeaponName === 'KATANA' && wasMouseDown !== state.isMouseDown) katanaInput(state.isMouseDown);

    if (!wasMouseDown && state.isMouseDown) {
        if (forgottenMecha?.ownsLocalPilot) { mountedFireRequested = true; return; }
        if (state.inspectState === 'INSPECTING') {
            cancelInspect();
        }
        requestPrimaryFire(true, currentThirdPersonAimRay());
    }

    if (state.rightClickActive) {
        cancelInspect();
    }
}

function handleWeaponWheel(e: WheelEvent): void {
    if (!isGameInputLocked()) return;

    e.preventDefault();
    const direction = Math.sign(e.deltaY);
    if (direction !== 0) {
        cycleWeapon(direction);
    }
}

function cycleWeapon(direction: number): void {
    if (forgottenMecha?.ownsLocalPilot) {
        if (direction) selectMountedWeapon(cyclePilotWeapon(state.isMultiplayer ? localMechaWeapon() : forgottenMecha.pilotWeapon));
        return;
    }
    const currentIndex = WEAPON_CYCLE.indexOf(state.desiredWeaponName);
    const safeIndex = currentIndex >= 0 ? currentIndex : WEAPON_CYCLE.indexOf(state.activeWeaponName);
    const nextIndex = (safeIndex + Math.sign(direction) + WEAPON_CYCLE.length) % WEAPON_CYCLE.length;
    state.desiredWeaponName = WEAPON_CYCLE[nextIndex];
    cancelInspect();
}

function selectMountedWeapon(weapon: PilotWeapon): void {
    if (state.isMultiplayer) selectMechaWeapon(weapon); else forgottenMecha?.selectPilotWeapon(weapon);
}

function updateLocalAccelerometer(delta: number): void {
    const isVisible = currentHudPresentation().accelerometer;

    if (!isVisible || delta <= 0 || !state.camera) {
        _lastMotionVelocity.copy(state.velocity);
        motionHudInitialized = false;
        smoothedGRight = 0;
        smoothedGUp = 0;
        updateAccelerometer(0, 0);
        return;
    }

    let gRight = 0;
    let gUp = 0;
    if (motionHudInitialized) {
        _motionAccel.copy(state.velocity).sub(_lastMotionVelocity).divideScalar(delta);
        _motionRight.set(1, 0, 0).applyQuaternion(state.camera.quaternion);
        _motionRight.y = 0;
        if (_motionRight.lengthSq() > 0) {
            _motionRight.normalize();
        }

        const unitsPerG = 98.0665;
        gRight = _motionAccel.dot(_motionRight) / unitsPerG;
        gUp = _motionAccel.y / unitsPerG;
    } else {
        motionHudInitialized = true;
    }

    _lastMotionVelocity.copy(state.velocity);

    const smoothing = Math.min(1, delta * 8);
    smoothedGRight += (gRight - smoothedGRight) * smoothing;
    smoothedGUp += (gUp - smoothedGUp) * smoothing;
    updateAccelerometer(smoothedGRight, smoothedGUp);
}

function updateMouseButtonStateFromChange(e: MouseEvent | PointerEvent): void {
    const previousPrimary = state.isMouseDown;
    const previousSecondary = state.rightClickActive;
    const buttons = decodeMouseButtons(e.type === 'pointercancel' ? 0 : e.buttons);

    // Some mouse drivers expose left+right emulation as a middle-button chord.
    // Preserve that compatibility path, but derive normal left/right state from
    // the complete bitmask on every event—including button-less mousemove.
    middleMouseChordActive = buttons.middle && (
        middleMouseChordActive || buttons.primary || buttons.secondary || previousPrimary || previousSecondary
    );

    if (middleMouseChordActive) {
        state.isMouseDown = true;
        state.rightClickActive = true;
    } else {
        state.isMouseDown = buttons.primary;
        state.rightClickActive = buttons.secondary;
    }

    if (forgottenMecha?.localTransition) state.rightClickActive = forgottenMecha.localTransition.acceptSecondary(state.rightClickActive);

    refreshScopedState();
}

function refreshScopedState(): void {
    if (forgottenMecha?.localTransition?.locked) {
        state.keyCActive = state.rightClickActive = state.isScoped = false;
        syncThirdPersonPresentation();
    } else if (!isInputActive()) state.isScoped = false;
    else if (forgottenMecha?.ownsLocalPilot) {
        // Keep ADS intent/FOV stable while O relocates the cockpit camera.
        // Scan acquisition and reticles still require unobscured vision.
        state.isScoped = forgottenMecha.mode === 'piloted' && (state.rightClickActive || state.keyCActive);
        syncThirdPersonPresentation();
    } else state.isScoped = resolveGogglesScopeAttempt(state.gogglesFailure, state.rightClickActive || state.keyCActive);
    syncGameHud();
}

function syncGogglesFailureVisuals(): void {
    const scope = UI.gogglesScope;
    if (!scope) return;
    const shuttingDown = !forgottenMecha?.ownsLocalPilot && state.gogglesFailure.shutdownUntil > 0;
    scope.classList.toggle('is-tv-off', shuttingDown);
    scope.classList.toggle('is-bricked-noise', !forgottenMecha?.ownsLocalPilot && state.gogglesFailure.bricked && !shuttingDown);
    scope.classList.toggle('is-photosensitivity-mode', userSettings.photosensitivityMode);
}

function syncHudCounters(): void {
    if (UI.score) UI.score.innerText = state.score.toString();
    if (UI.kills) UI.kills.innerText = state.kills.toString();
    if (UI.deaths) UI.deaths.innerText = state.deaths.toString();
}

function settingsEqual(a: UserSettings, b: UserSettings): boolean {
    return a.mobileInput === b.mobileInput &&
        a.touchFireMode === b.touchFireMode &&
        JSON.stringify(a.touchLayout) === JSON.stringify(b.touchLayout) &&
        a.sensitivity === b.sensitivity &&
        a.rawMouseInput === b.rawMouseInput &&
        a.mouseSpikeProtection === b.mouseSpikeProtection &&
        a.fov === b.fov &&
        a.scopedFov === b.scopedFov &&
        a.renderScale === b.renderScale &&
        a.particleAmount === b.particleAmount &&
        a.renderDistanceChunks === b.renderDistanceChunks &&
        a.shadows === b.shadows &&
        a.fog === b.fog &&
        a.motionBlur === b.motionBlur &&
        a.lavaGlow === b.lavaGlow &&
        a.muzzleFlashes === b.muzzleFlashes &&
        a.muzzleFlashOpacity === b.muzzleFlashOpacity &&
        a.bulletTrails === b.bulletTrails &&
        a.leafAnimation === b.leafAnimation &&
        a.shadowQuality === b.shadowQuality &&
        a.showFps === b.showFps &&
        a.photosensitivityMode === b.photosensitivityMode &&
        a.downloadWebLLMImmediately === b.downloadWebLLMImmediately &&
        JSON.stringify(a.keybinds) === JSON.stringify(b.keybinds) &&
        JSON.stringify(a.crosshair) === JSON.stringify(b.crosshair);
}

function updateSettingsActions(): void {
    const changed = !settingsEqual(pendingSettings, userSettings);
    const actions = [UI.btnSettingsBack, UI.btnSettingsApply, UI.btnSettingsDiscard];
    const focusedAction = actions.find(button => button === document.activeElement);
    if (UI.btnSettingsBack) UI.btnSettingsBack.hidden = changed;
    if (UI.btnSettingsApply) UI.btnSettingsApply.hidden = !changed;
    if (UI.btnSettingsDiscard) UI.btnSettingsDiscard.hidden = !changed;
    // A completed action disappears; keep keyboard focus in the same location.
    if (focusedAction?.hidden) (changed ? UI.btnSettingsApply : UI.btnSettingsBack)?.focus();
}

function syncSettingsControls(settings: UserSettings = pendingSettings): void {
    if (UI.sensSlider) UI.sensSlider.value = settings.sensitivity.toFixed(1);
    if (UI.sensValue) UI.sensValue.innerText = settings.sensitivity.toFixed(1);
    if (UI.settingRawMouseInput) UI.settingRawMouseInput.checked = settings.rawMouseInput;
    setCheckboxLabel(UI.settingRawMouseInputValue, settings.rawMouseInput);
    if (UI.settingMouseSpikeProtection) UI.settingMouseSpikeProtection.checked = settings.mouseSpikeProtection;
    setCheckboxLabel(UI.settingMouseSpikeProtectionValue, settings.mouseSpikeProtection);
    if (UI.settingFov) UI.settingFov.value = settings.fov.toFixed(0);
    if (UI.settingFovValue) UI.settingFovValue.innerText = settings.fov.toFixed(0);
    if (UI.settingScopedFov) UI.settingScopedFov.value = settings.scopedFov.toFixed(0);
    if (UI.settingScopedFovValue) UI.settingScopedFovValue.innerText = settings.scopedFov.toFixed(0);
    if (UI.settingRenderScale) UI.settingRenderScale.value = settings.renderScale.toFixed(2);
    if (UI.settingRenderScaleValue) UI.settingRenderScaleValue.innerText = formatPercent(settings.renderScale);
    if (UI.settingParticles) UI.settingParticles.value = settings.particleAmount.toFixed(2);
    if (UI.settingParticlesValue) UI.settingParticlesValue.innerText = formatPercent(settings.particleAmount);
    if (UI.settingRenderDistance) UI.settingRenderDistance.value = settings.renderDistanceChunks.toFixed(0);
    if (UI.settingRenderDistanceValue) UI.settingRenderDistanceValue.innerText = settings.renderDistanceChunks.toFixed(0);
    if (UI.settingWebLLMDownload) UI.settingWebLLMDownload.checked = settings.downloadWebLLMImmediately;
    setCheckboxLabel(UI.settingWebLLMDownloadValue, settings.downloadWebLLMImmediately);
    if (UI.settingShadows) UI.settingShadows.checked = settings.shadows;
    if (UI.settingFog) UI.settingFog.checked = settings.fog;
    setCheckboxLabel(UI.settingFogValue, settings.fog);
    if (UI.settingMotionBlur) UI.settingMotionBlur.checked = settings.motionBlur;
    setCheckboxLabel(UI.settingMotionBlurValue, settings.motionBlur);
    setCheckboxLabel(UI.settingShadowsValue, settings.shadows);
    if (UI.settingLavaGlow) UI.settingLavaGlow.checked = settings.lavaGlow;
    setCheckboxLabel(UI.settingLavaGlowValue, settings.lavaGlow);
    if (UI.settingMuzzleFlashes) UI.settingMuzzleFlashes.checked = settings.muzzleFlashes;
    setCheckboxLabel(UI.settingMuzzleFlashesValue, settings.muzzleFlashes);
    if (UI.settingMuzzleFlashOpacity) {
        UI.settingMuzzleFlashOpacity.value = settings.muzzleFlashOpacity.toFixed(2);
        UI.settingMuzzleFlashOpacity.disabled = !settings.muzzleFlashes;
    }
    if (UI.settingMuzzleFlashOpacityValue) UI.settingMuzzleFlashOpacityValue.innerText = formatPercent(settings.muzzleFlashOpacity);
    if (UI.settingBulletTrails) UI.settingBulletTrails.checked = settings.bulletTrails;
    setCheckboxLabel(UI.settingBulletTrailsValue, settings.bulletTrails);
    if (UI.settingLeafAnimation) UI.settingLeafAnimation.checked = settings.leafAnimation;
    setCheckboxLabel(UI.settingLeafAnimationValue, settings.leafAnimation);
    if (UI.settingShadowQuality) {
        UI.settingShadowQuality.value = settings.shadowQuality;
        UI.settingShadowQuality.disabled = !settings.shadows;
    }
    if (UI.settingFps) UI.settingFps.checked = settings.showFps;
    setCheckboxLabel(UI.settingFpsValue, settings.showFps);
    if (UI.settingPhotosensitivity) UI.settingPhotosensitivity.checked = settings.photosensitivityMode;
    setCheckboxLabel(UI.settingPhotosensitivityValue, settings.photosensitivityMode);
    syncSettingsMenu?.(settings);
    updateSettingsActions();
}

function resetPendingSettings(): void {
    pendingSettings = cloneSettings(userSettings);
    syncSettingsControls();
}

function applyPendingSettings(): void {
    Object.assign(userSettings, cloneSettings(pendingSettings));
    saveUserSettings();
    applyLiveSettings();
    syncSettingsControls();
    // Apply is also reached from the mobile-controls editor; repaint the paused
    // preview so render distance and lava glow always match the committed values.
    renderPausedSettingsPreview();
    if (userSettings.downloadWebLLMImmediately) gothChat?.preload();
    else gothChat?.reset({ preserveLoadedModel: false });
}

function updatePendingSettings(mutator: (settings: UserSettings) => void): void {
    mutator(pendingSettings);
    syncSettingsControls();
    renderPausedSettingsPreview();
}

function renderPausedSettingsPreview(fromRaf = false): void {
    if (
        UI.panelSettings?.style.display !== 'flex' ||
        !state.isPlaying ||
        state.isMultiplayer ||
        !state.renderer ||
        !state.scene ||
        !state.camera
    ) {
        return;
    }
    const livePreviewCanvas = mountSettingsLivePreview();
    if (!livePreviewCanvas) return;
    const previewWidth = livePreviewCanvas.clientWidth;
    const previewHeight = livePreviewCanvas.clientHeight;
    if (!previewWidth || !previewHeight) {
        if (!fromRaf) requestAnimationFrame(() => renderPausedSettingsPreview(true));
        return;
    }

    atmosphere?.applySettings({ fog: pendingSettings.fog, motionBlur: false });
    dayNightCycle?.applySettings({
        shadows: pendingSettings.shadows,
        shadowMapSize: pendingSettings.shadowQuality === 'high' ? 2048 : 1024,
    });
    updateEnvironmentVisibility(state.camera.position, pendingSettings.renderDistanceChunks);
    updateLavaLights(state.dayNightElapsedSeconds, state.camera.position, lastLanternStrength, pendingSettings.lavaGlow);
    updateLeafAnimation(
        0,
        state.dayNightElapsedSeconds,
        getLeafInteractionPosition(),
        forgottenMecha?.ownsLocalPilot ? null : state.velocity,
        pendingSettings.leafAnimation,
    );
    state.camera.fov = state.isScoped ? pendingSettings.scopedFov : pendingSettings.fov;
    state.camera.updateProjectionMatrix();
    applyRendererSettings(state.renderer, pendingSettings);

    const biomeWeights = getWorldBiomeField()?.sample(state.camera.position.x, state.camera.position.z);
    atmosphereFrame.elapsed = state.dayNightElapsedSeconds;
    atmosphereFrame.delta = 0;
    atmosphereFrame.blurAllowed = false;
    atmosphereFrame.fogMultiplier = biomeWeights ? sampleBiomeFogMultiplier(biomeWeights) : 1;
    atmosphereFrame.fogTimeMultiplier = getDayNightFogMultiplier(state.dayNightElapsedSeconds);

    const playerVisible = state.playerMesh?.visible;
    const leftGunVisible = state.leftGun?.visible;
    const rightGunVisible = state.rightGunContainer?.visible;
    _logicalCameraPos.copy(state.camera.position);
    _logicalCameraQuaternion.copy(state.camera.quaternion);
    try {
        const pilot = forgottenMecha?.ownsLocalPilot ? forgottenMecha : null;
        const gogglesView = state.isScoped && !pilot;
        if (gothChat?.isOpen || gogglesView) {
            if (state.playerMesh) state.playerMesh.visible = false;
            if (state.leftGun) state.leftGun.visible = false;
            if (state.rightGunContainer) state.rightGunContainer.visible = false;
        }
        if (state.isThirdPersonView && !gothChat?.isOpen && hasRenderedAim) {
            state.camera.position.copy(lastRenderedAimRay.origin);
            state.camera.quaternion.copy(lastViewRotation);
        }
        state.camera.updateMatrixWorld(true);
        if (pilot) {
            if (state.playerMesh && !state.isThirdPersonView) state.playerMesh.visible = false;
            pilot.preparePilotView(!state.isThirdPersonView);
        }
        const holder = !state.isThirdPersonView && !pilot && !gothChat?.isOpen &&
            state.playerHp > 0 && state.playerMesh?.visible ? getPlayerAvatar(state.playerMesh) : undefined;
        if (holder?.poseForView) {
            reloadFrame.begin(holder.rig, state.camera, holder.poseForView, 0);
        } else {
            reloadFrame.clear();
        }
        drawAtmosphere();
        reloadFrame.render(state.renderer, state.scene);
        renderKatanaImpact(state.renderer, state.camera);
    } finally {
        reloadFrame.restore();
        forgottenMecha?.restorePilotView();
        if (state.playerMesh && playerVisible !== undefined) state.playerMesh.visible = playerVisible;
        if (state.leftGun && leftGunVisible !== undefined) state.leftGun.visible = leftGunVisible;
        if (state.rightGunContainer && rightGunVisible !== undefined) state.rightGunContainer.visible = rightGunVisible;
        state.camera.position.copy(_logicalCameraPos);
        state.camera.quaternion.copy(_logicalCameraQuaternion);
    }

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const targetW = Math.max(1, Math.round(previewWidth * dpr));
    const targetH = Math.max(1, Math.round(previewHeight * dpr));
    if (livePreviewCanvas.width !== targetW || livePreviewCanvas.height !== targetH) {
        livePreviewCanvas.width = targetW;
        livePreviewCanvas.height = targetH;
    }
    const ctx = livePreviewCanvas.getContext('2d');
    const src = state.renderer.domElement;
    if (ctx && src.width > 0 && src.height > 0) {
        const srcAspect = src.width / src.height;
        const dstAspect = targetW / targetH;
        let sx = 0, sy = 0, sw = src.width, sh = src.height;
        if (srcAspect > dstAspect) {
            sw = src.height * dstAspect;
            sx = (src.width - sw) * 0.5;
        } else if (srcAspect < dstAspect) {
            sh = src.width / dstAspect;
            sy = (src.height - sh) * 0.5;
        }
        ctx.drawImage(src, sx, sy, sw, sh, 0, 0, targetW, targetH);
    }
}

function applyLiveSettings(): void {
    atmosphere?.applySettings({ fog: userSettings.fog, motionBlur: userSettings.motionBlur && !userSettings.photosensitivityMode && !reducedHeadMotion.matches });
    syncMobileControls?.();
    updateLeafAnimation(0, state.dayNightElapsedSeconds,
        getLeafInteractionPosition(), forgottenMecha?.ownsLocalPilot ? null : state.velocity, userSettings.leafAnimation);
    if (UI.crosshair) UI.crosshair.innerHTML = crosshairSvg(userSettings.crosshair);
    applyHitmarkerSettings();
    state.baseSensitivity = userSettings.sensitivity;

    if (state.camera) {
        const targetFov = state.isScoped ? userSettings.scopedFov : userSettings.fov;
        state.camera.fov = targetFov;
        state.camera.updateProjectionMatrix();
    }

    if (state.controls && state.camera) {
        state.controls.resetLook();
        state.controls.rawMouseInput = userSettings.rawMouseInput;
        state.controls.mouseSpikeProtection = userSettings.mouseSpikeProtection;
        state.controls.pointerSpeed = scopedPointerSensitivity(state.baseSensitivity, state.camera.fov, userSettings.fov);
    }

    if (state.renderer) {
        applyRendererSettings(state.renderer);
    }

    dayNightCycle?.applySettings({
        shadows: userSettings.shadows,
        shadowMapSize: userSettings.shadowQuality === 'high' ? 2048 : 1024,
    });

    syncGameHud();
    setProjectileTrailsEnabled(userSettings.bulletTrails);

    lastFov = -1;
}

function setupSettingsControls(): void {
    syncSettingsMenu = setupSettingsMenu(() => pendingSettings, updatePendingSettings, () => {
        mobileControlsEditor.open(pendingSettings.touchLayout, pendingSettings.touchFireMode, (layout, fireMode) => {
            // Editor Apply commits the shared draft, including the Touch selection.
            // Returning from this submenu must not require a second Apply.
            pendingSettings.touchLayout = cloneTouchLayout(layout);
            pendingSettings.touchFireMode = fireMode;
            applyPendingSettings();
        });
    });
    resetPendingSettings();

    UI.sensSlider?.addEventListener('input', (e) => {
        const val = parseFloat((e.target as HTMLInputElement).value);
        updatePendingSettings((settings) => {
            settings.sensitivity = clampNumber(val, 0.1, 3.0, DEFAULT_USER_SETTINGS.sensitivity);
        });
    });

    UI.settingRawMouseInput?.addEventListener('change', (e) => {
        updatePendingSettings(settings => { settings.rawMouseInput = (e.target as HTMLInputElement).checked; });
    });
    UI.settingMouseSpikeProtection?.addEventListener('change', (e) => {
        updatePendingSettings(settings => { settings.mouseSpikeProtection = (e.target as HTMLInputElement).checked; });
    });

    UI.settingFov?.addEventListener('input', (e) => {
        const val = parseFloat((e.target as HTMLInputElement).value);
        updatePendingSettings((settings) => {
            settings.fov = clampNumber(val, 55, 105, DEFAULT_FOV);
        });
    });

    UI.settingScopedFov?.addEventListener('input', (e) => {
        const val = parseFloat((e.target as HTMLInputElement).value);
        updatePendingSettings((settings) => {
            settings.scopedFov = clampNumber(val, 8, 35, SCOPED_FOV);
        });
    });

    UI.settingRenderScale?.addEventListener('input', (e) => {
        const val = parseFloat((e.target as HTMLInputElement).value);
        updatePendingSettings((settings) => {
            settings.renderScale = clampNumber(val, 0.5, 1.0, DEFAULT_USER_SETTINGS.renderScale);
        });
    });

    UI.settingParticles?.addEventListener('input', (e) => {
        const val = parseFloat((e.target as HTMLInputElement).value);
        updatePendingSettings((settings) => {
            settings.particleAmount = clampNumber(val, 0.2, 1.0, DEFAULT_USER_SETTINGS.particleAmount);
        });
    });

    UI.settingRenderDistance?.addEventListener('input', (e) => {
        const val = parseFloat((e.target as HTMLInputElement).value);
        updatePendingSettings((settings) => {
            settings.renderDistanceChunks = Math.round(clampNumber(val, 1, MAX_RENDER_DISTANCE_CHUNKS, DEFAULT_USER_SETTINGS.renderDistanceChunks));
        });
    });

    UI.settingWebLLMDownload?.addEventListener('change', (event) => {
        const checked = (event.target as HTMLInputElement).checked;
        if (!checked) {
            updatePendingSettings(settings => { settings.downloadWebLLMImmediately = false; });
            return;
        }
        gothChat?.requestDownloadApproval(approved => {
            updatePendingSettings(settings => { settings.downloadWebLLMImmediately = approved; });
            UI.settingWebLLMDownload?.focus();
        });
    });

    UI.settingShadows?.addEventListener('change', (e) => {
        updatePendingSettings((settings) => {
            settings.shadows = (e.target as HTMLInputElement).checked;
        });
    });

    UI.settingFog?.addEventListener('change', e => {
        updatePendingSettings(settings => { settings.fog = (e.target as HTMLInputElement).checked; });
    });
    UI.settingMotionBlur?.addEventListener('change', e => {
        updatePendingSettings(settings => { settings.motionBlur = (e.target as HTMLInputElement).checked; });
    });

    UI.settingLavaGlow?.addEventListener('change', (e) => {
        updatePendingSettings((settings) => {
            settings.lavaGlow = (e.target as HTMLInputElement).checked;
        });
    });

    UI.settingMuzzleFlashes?.addEventListener('change', (e) => {
        updatePendingSettings((settings) => {
            settings.muzzleFlashes = (e.target as HTMLInputElement).checked;
        });
    });

    UI.settingMuzzleFlashOpacity?.addEventListener('input', (e) => {
        const val = parseFloat((e.target as HTMLInputElement).value);
        updatePendingSettings((settings) => {
            settings.muzzleFlashOpacity = clampNumber(val, 0, 1, DEFAULT_USER_SETTINGS.muzzleFlashOpacity);
        });
    });

    UI.settingBulletTrails?.addEventListener('change', (e) => {
        updatePendingSettings((settings) => {
            settings.bulletTrails = (e.target as HTMLInputElement).checked;
        });
    });

    UI.settingLeafAnimation?.addEventListener('change', (e) => {
        updatePendingSettings((settings) => {
            settings.leafAnimation = (e.target as HTMLInputElement).checked;
        });
    });

    UI.settingShadowQuality?.addEventListener('change', (e) => {
        updatePendingSettings((settings) => {
            settings.shadowQuality = (e.target as HTMLSelectElement).value === 'high' ? 'high' : 'low';
        });
    });

    UI.settingFps?.addEventListener('change', (e) => {
        updatePendingSettings((settings) => {
            settings.showFps = (e.target as HTMLInputElement).checked;
        });
    });

    UI.settingPhotosensitivity?.addEventListener('change', (e) => {
        updatePendingSettings((settings) => {
            settings.photosensitivityMode = (e.target as HTMLInputElement).checked;
        });
    });
}

function init(): void {
    setDamageHandlers(processTargetHit, takePlayerDamage, processMechaDamage);
    setMultiplayerLifePresentation(renderLocalHealthChange, packet => {
        finishLocalRespawn();
        state.lifeId = packet.lifeId;
        state.fireCooldown = packet.cooldownMs / 1000;
    });
    setMechaPresentation({ impact: mechaImpact, release: onMechaPilotReleased,
        ending: startMechaEnding,
        blocked: () => { exitWarningRemaining = 3; }, gameOver: () => triggerDeath(true),
        damage: (_damage, _attacker, sequence) => presentMultiplayerHealth(sequence),
        hit: (killed, score, local) => { if (local) flashHitmarker(killed); if (UI.score) UI.score.innerText = String(score); },
    });
    loadUserSettings();
    setupSettingsControls();
    applyLiveSettings();
    if (UI.gogglesTargetLayer) smartGoggles = new SmartGogglesHud(UI.gogglesTargetLayer);
    const locatorMarkers = document.getElementById('locator-markers');
    if (locatorMarkers) locatorBar = new LocatorBar(locatorMarkers);
    const weaponPanel = document.getElementById('weapon-indicator');
    if (weaponPanel) weaponIndicator = new WeaponIndicator(weaponPanel);

    setupMenuListeners();
    gothChat = new GothChat({
        onOpen: () => {
            resetHook();
            state.velocity.set(0, 0, 0);
            state.normalJumpActive = false;
            cancelInspect();
            if (state.camera && chatCharacter) {
                const pose = getGothConversationPose(chatCharacter.group);
                conversationCamera.start(state.camera, pose.position, pose.lookAt);
            }
            endInput();
            syncGameHud();
        },
        onClose: resume => {
            conversationCamera.cancel();
            state.velocity.set(0, 0, 0);
            if (state.isPlaying && state.playerHp > 0) resumeInputAfterOverlay(resume);
            syncGameHud();
        },
        onReplyStart: () => chatCharacter?.startTalking(),
    });

    if (userSettings.downloadWebLLMImmediately) gothChat.preload();

    // Desktop pointer lock and touch sessions share the play/pause/death UI lifecycle.
    // The callbacks are registered before match controls exist; beginInput binds
    // whichever freshly-created controls belong to the current match.
    onMultiplayerStarted(() => {
        // Network start cannot acquire desktop pointer lock without a user gesture.
        // Spawn and replicate immediately; the overlay only enables local controls.
        for (const panel of [UI.panelMain, UI.panelMp, UI.panelHostWaiting, UI.panelJoinRoom]) {
            if (panel) panel.style.display = 'none';
        }
        if (UI.blocker) UI.blocker.style.display = 'flex';
        if (UI.panelPause) UI.panelPause.style.display = 'flex';
        if (UI.btnPauseResume) UI.btnPauseResume.innerText = 'Click to play';
        if (UI.btnPauseSettings) UI.btnPauseSettings.hidden = true;
        if (UI.pauseLobbyInfo) UI.pauseLobbyInfo.style.display = 'inline';
        if (UI.pauseRoomCode) UI.pauseRoomCode.innerText = state.roomCode ?? '';
        if (UI.btnPauseLeave) UI.btnPauseLeave.innerText = 'Leave Lobby';
    });
    onInputStarted(() => {
        resetFpsCounters();
        atmosphere?.resetHistory();
        if (state.matchEnded) { endInput(); return; }
        applyCinematicMode(cinematicMode);
        if (UI.btnPauseResume) UI.btnPauseResume.innerText = 'Resume';
        if (state.pendingPlay) {
            state.isPlaying = true;
            state.pendingPlay = false;
        }
        if (UI.blocker) UI.blocker.style.display = 'none';
        if (UI.panelPause) UI.panelPause.style.display = 'none';
        syncGameHud();

        document.body.focus();
        if (state.renderer && state.renderer.domElement) {
            state.renderer.domElement.tabIndex = -1;
            state.renderer.domElement.focus();
        }
    });

    onInputEnded(() => {
        applyCinematicMode(false);
        cancelWeaponHandling();
        resetHitmarker();
        atmosphere?.resetHistory();
        if (state.isMultiplayer) releaseMechaInput();
        if (disposingGameRuntime) return;
        updateApproachWarning(0, false);
        mountedFireRequested = false;
        if (!state.isMultiplayer || forgottenMecha?.ownsLocalPilot) forgottenMecha?.pilot.clearLookMotion();
        setPlayerListVisible(false);
        const isDead = state.matchEnded || UI.deathOverlay?.style.display === 'flex';
        if (UI.blocker) UI.blocker.style.display = gothChat?.isOpen || isDead ? 'none' : 'flex';
        state.moveForward = false;
        state.moveBackward = false;
        state.moveLeft = false;
        state.moveRight = false;
        state.isShiftDown = false;
        state.isHovering = false;
        state.isMouseDown = false;
        state.isScoped = false;
        state.rightClickActive = false;
        state.keyCActive = false;
        syncThirdPersonPresentation();
        middleMouseChordActive = false;
        smartGoggles?.reset();
        cancelInspect();
        syncGameHud();

        if (UI.panelMain) UI.panelMain.style.display = 'none';
        if (UI.panelSettings) UI.panelSettings.style.display = 'none';
        if (UI.panelMp) UI.panelMp.style.display = 'none';
        if (UI.panelHostWaiting) UI.panelHostWaiting.style.display = 'none';
        if (UI.panelJoinRoom) UI.panelJoinRoom.style.display = 'none';

        if (gothChat?.isOpen) {
            if (UI.panelPause) UI.panelPause.style.display = 'none';
            gothChat.focus();
            return;
        }
        if (state.isPlaying) {
            if (UI.panelPause) {
                UI.panelPause.style.display = isDead ? 'none' : 'flex';
            }
            if (UI.btnPauseSettings) UI.btnPauseSettings.hidden = state.isMultiplayer || isDead;

            if (state.isMultiplayer) {
                if (UI.pauseLobbyInfo) UI.pauseLobbyInfo.style.display = isDead ? 'none' : 'inline';
                if (UI.pauseRoomCode) UI.pauseRoomCode.innerText = state.roomCode || '-'.repeat(ROOM_CODE_LENGTH);
                if (UI.btnPauseLeave) UI.btnPauseLeave.innerText = 'Leave Lobby';
            } else {
                if (UI.pauseLobbyInfo) UI.pauseLobbyInfo.style.display = 'none';
                if (UI.btnPauseLeave) UI.btnPauseLeave.innerText = 'Leave Game';
            }
        } else {
            if (UI.panelPause) UI.panelPause.style.display = 'none';
            if (UI.panelMain) UI.panelMain.style.display = 'flex';

            if (state.isMultiplayer) {
                disconnectMultiplayer();
            }
        }

        resetHook();
    });

    setMultiplayerWorldLoader((seed, current, slot) => loadPreparedWorld(seed, current, 'world', undefined, slot));
    onMultiplayerDisconnected(({ wasHost, reason }) => {
        roomFlowGeneration++;
        hostRoomChallenge.cancel(); joinRoomChallenge.cancel();
        disposeGameRuntime({ disconnect: false });
        settingsOrigin = 'main';
        for (const panel of [UI.panelMain, UI.panelSettings, UI.panelMp, UI.panelPause, UI.panelHostWaiting, UI.panelJoinRoom]) {
            if (panel) panel.style.display = 'none';
        }
        if (UI.blocker) UI.blocker.style.display = 'flex';
        const panel = wasHost ? UI.panelHostWaiting : UI.panelJoinRoom;
        if (panel) panel.style.display = 'flex';
        const error = wasHost ? UI.hostLobbyStatus : UI.joinErrorLog;
        if (error) { error.innerText = reason ?? 'The session ended. Please try again.'; error.style.color = '#ff4757'; }
        resetHostLobbyUi();
    });
    setupInputListeners();
    setupMainMenu();
    window.addEventListener('pagehide', event => {
        disposeGameRuntime();
        if (!event.persisted) gothChat?.dispose();
    });
    window.addEventListener('pageshow', event => {
        if (!event.persisted) return;
        if (UI.blocker) UI.blocker.style.display = 'flex';
        for (const panel of [UI.panelPause, UI.panelSettings, UI.panelMp, UI.panelHostWaiting, UI.panelJoinRoom, UI.deathOverlay]) {
            if (panel) panel.style.display = 'none';
        }
        if (UI.panelMain) UI.panelMain.style.display = 'flex';
    });

    animate();
}

/** A committed loss freezes the live canvas immediately. Asset preparation may
 * overlap fade-out, but castle duplication and GPU warming start only under black. */
function startMechaEnding(scene: MechaEndingState): void {
    const now = performance.now();
    if (endingPlayback) { endingPlayback.receive(scene, now); return; }
    state.matchEnded = true;
    document.body.classList.add('mecha-ending');
    mobileControlsEditor.cancel();
    endInput(); setPlayerListVisible(false); clearApproachWarning(); clearMechaHeadPresentation();
    mountedFireRequested = false; hasRenderedAim = false;
    cameraShake.reset(); resetKatana(); mechaCameraHandoff.reset(); conversationCamera.cancel();
    gothChat?.close(false); smartGoggles?.reset(); resetHook(); state.weaponHandling.cancelActions(); cancelInspect();
    state.velocity.set(0, 0, 0); state.isHovering = false;
    for (const panel of [UI.blocker, UI.panelMain, UI.panelSettings, UI.panelMp, UI.panelPause, UI.panelHostWaiting, UI.panelJoinRoom, UI.deathOverlay]) {
        if (panel) panel.style.display = 'none';
    }
    const gameOver = document.getElementById('game-over-overlay');
    if (gameOver) gameOver.style.display = 'none';
    const reason = getUI<HTMLElement>('game-over-reason');
    if (reason) reason.textContent = scene.cause === 'wall' ? 'The town walls fell.' : 'Forgotten Mecha reached the castle.';
    endingCover = document.createElement('div'); endingCover.id = 'mecha-ending-cover';
    endingCover.setAttribute('aria-hidden', 'true'); document.body.append(endingCover);
    syncGameHud();
    endingPlayback = new MechaEndingPlayback(scene, now, {
        prepare: async committed => {
            const { MechaGameOverScene } = await import('./mechaGameOverScene.js');
            return MechaGameOverScene.prepare({ seed: committed.seed, effectsSeed: committed.effectsSeed,
                position: new THREE.Vector3(committed.position.x, committed.position.y, committed.position.z),
                heading: committed.heading, wallOffset: 0, lightingElapsed: committed.lightingElapsed, cause: committed.cause,
                particleAmount: userSettings.particleAmount, photosensitivity: userSettings.photosensitivityMode,
                reducedMotion: reducedHeadMotion.matches, seededScenery: true });
        },
        cover: opacity => { if (endingCover) endingCover.style.opacity = String(opacity); },
        ready: id => {
            if (state.isMultiplayer) markMechaEndingReady(id);
            else offlineEnding?.markLocalReady(performance.now());
        },
        complete: () => triggerDeath(true),
        failed: error => console.error('Unable to prepare the mecha ending', error),
    });
}
function commitOfflineEnding(wall?: { position: THREE.Vector3; heading: number }): void {
    const actor = forgottenMecha;
    if (!actor || state.matchEnded) return;
    const seed = getWorldSeed();
    const position = wall?.position ?? actor.group.position;
    offlineEnding = new MechaEndingAuthority({ id: 1, seed, effectsSeed: (seed ^ 0x6d2b79f5) >>> 0,
        position: { x: position.x, y: position.y, z: position.z }, ...(wall ? { cause: 'wall' } : {}),
        heading: wall?.heading ?? actor.group.rotation.y, lightingElapsed: ((state.dayNightElapsedSeconds % DAY_NIGHT_CYCLE_SECONDS) + DAY_NIGHT_CYCLE_SECONDS) % DAY_NIGHT_CYCLE_SECONDS }, performance.now());
    startMechaEnding(offlineEnding.snapshot(performance.now()));
}

// Main frame loop. Order matters: input-driven systems update first, then gameplay
// collisions/damage, then remote sync and rendering.
function animate(): void {
    requestAnimationFrame(animate);
    syncGameHud();
    // This terminal presentation bypasses ordinary pause, death and input gates.
    if (endingPlayback && state.renderer) {
        const now = performance.now();
        if (state.isMultiplayer) updateMechaEndingNetwork();
        else if (offlineEnding) endingPlayback.receive(offlineEnding.snapshot(now), now);
        endingPlayback.update(now, state.renderer); state.prevTime = now; return;
    }
    if (mobileControlsEditor.isOpen) {
        state.controls?.resetLook();
        updateApproachWarning(0, false);
        state.prevTime = performance.now();
        return;
    }
    if (!isWorldLoading) updateMenuPreview();

    const time = performance.now();
    if (state.matchEnded) { state.controls?.resetLook(); clearApproachWarning(); state.prevTime = time; return; }
    if (isWorldLoading) {
        // Start may already hold pointer lock. Movement during boot/reveal must
        // not collect into a delayed turn on the first playable frame.
        state.controls?.resetLook();
        updateApproachWarning(0, false);
        if (isWorldReveal && state.scene && state.camera && state.renderer) {
            atmosphereFrame.elapsed = state.dayNightElapsedSeconds; atmosphereFrame.delta = 0; atmosphereFrame.blurAllowed = false;
            atmosphereFrame.fogTimeMultiplier = getDayNightFogMultiplier(state.dayNightElapsedSeconds);
            drawAtmosphere();
        }
        state.prevTime = time;
        return;
    }
    const frameDelta = (time - state.prevTime) / 1000;
    const delta = clampFrameDelta(frameDelta, MAX_FRAME_DELTA);
    if (!state.scene || !state.camera || !state.renderer || !state.controls) {
        updateApproachWarning(0, false);
        state.prevTime = time;
        return;
    }
    validateKatanaInput();
    if (shouldPauseOfflineSimulation({
        isPlaying: state.isPlaying,
        isMultiplayer: state.isMultiplayer,
        isInputActive: isInputActive(),
        isConversationOpen: gothChat?.isOpen ?? false,
    })) {
        if (collapseRemaining > 0 && state.playerHp <= 0 && state.isThirdPersonView) {
            // Freeze the world and the lethal camera frame while the suit settles.
            updatePlayerAvatarPose(delta);
            collapseRemaining = Math.max(0, collapseRemaining - delta);
            _logicalCameraPos.copy(state.camera.position);
            _logicalCameraQuaternion.copy(state.camera.quaternion);
            try {
                state.camera.position.copy(lastRenderedAimRay.origin);
                state.camera.quaternion.copy(lastViewRotation);
                state.renderer.render(state.scene, state.camera);
            } finally {
                state.camera.position.copy(_logicalCameraPos);
                state.camera.quaternion.copy(_logicalCameraQuaternion);
            }
        }
        atmosphere?.resetHistory();
        updateApproachWarning(0, false);
        state.prevTime = time;
        return;
    }
    if (state.isMultiplayer) { flushMechaDamage(); presentMultiplayerHealth(); }
    if (!state.isMultiplayer && state.isPlaying && state.playerHp > 0 && isInputActive() && !gothChat?.isOpen) {
        forgottenMecha?.flushRenderedDamage(state.lifeId);
        // Keep the already rendered lethal beam/contact as the death backdrop.
        // Advancing the actor here would shrink it before the frozen screen.
        if (state.playerHp <= 0) { state.prevTime = time; return; }
    }
    updateApproachWarning(delta, state.isPlaying && state.playerHp > 0 && isInputActive() && !gothChat?.isOpen);
    finishGogglesShutdown(state.gogglesFailure, time);
    refreshScopedState();
    syncGogglesFailureVisuals();
    if (dayNightCycle && state.dayNightSyncPending) {
        dayNightCycle.synchronizeElapsedSeconds(
            state.dayNightElapsedSeconds,
            state.dayNightSyncImmediate,
        );
        state.dayNightSyncPending = false;
        state.dayNightSyncImmediate = false;
    }
    // Biome identity follows the observer, not the logical player pose: fog and
    // sky should match what the current camera is actually looking through.
    const observerPosition = state.camera.position;
    const biomeWeights = getWorldBiomeField()?.sample(observerPosition.x, observerPosition.z);
    const simDelta = state.isPlaying || state.isMultiplayer ? delta : 0;
    // A multiplayer room owns one continuous clock, including while an
    // individual player is still in the lobby or has released mouse capture.
    const lanternStrength = dayNightCycle?.update(
        simDelta,
        observerPosition,
        biomeWeights,
    ) ?? 0;
    lastLanternStrength = lanternStrength;
    if (dayNightCycle) state.dayNightElapsedSeconds = dayNightCycle.elapsedTimeSeconds;
    atmosphereFrame.fogMultiplier = biomeWeights ? sampleBiomeFogMultiplier(biomeWeights) : 1;
    atmosphereFrame.fogTimeMultiplier = getDayNightFogMultiplier(state.dayNightElapsedSeconds);
    if (state.camera) {
        updateTownLanterns(time / 1000, lanternStrength);
    }

    const previousWeaponPhase = state.switchState;
    updateWeapons(delta);
    updateKatana(delta);
    // The host times switching from the first received withdrawal intent. Do
    // not let the ordinary movement throttle delay that intent by another tick
    // and reject the first legal shot when the local animation completes.
    if (state.switchState !== previousWeaponPhase && state.switchState !== 'WITHDRAWING') sendLocalState(true);

    if (!forgottenMecha?.ownsLocalPilot) updateReloadBar(weaponHudFraction());
    const automatic = state.isMouseDown && (touchMode || state.activeWeaponName === 'AR' || state.activeWeaponName === 'MINIGUN');
    if (state.controls && (automatic || state.weaponHandling.pendingFire)) requestPrimaryFire(false, currentThirdPersonAimRay());

    if (gothChat?.isOpen) {
        // The conversation owns the player pose; gravity must not fight the eased move.
        conversationCamera.update(delta);
        state.velocity.set(0, 0, 0);
    } else if (!forgottenMecha?.ownsLocalPilot && !(state.hookTargetCockpit && state.hookState === 'PULLING')) {
        updatePlayerPhysics(delta);
    }
    if (state.controls) {
        updatePowerJumpOnCastleExit(state.controls.getObject().position);
        updateEnvironmentVisibility(state.controls.getObject().position, userSettings.renderDistanceChunks);
    }
    if (state.camera) {
        updateLavaLights(time / 1000, state.camera.position, lanternStrength, userSettings.lavaGlow);
    }
    updateHoverBar(forgottenMecha?.ownsLocalPilot ? forgottenMecha.combat.energy : state.hoverFuel,
        isInputActive() && (forgottenMecha?.ownsLocalPilot ? forgottenMecha.combat.shieldActive : state.isHovering));
    updateLocalAccelerometer(delta);

    if (!state.isMultiplayer && !forgottenMecha?.ownsLocalPilot) { checkLavaDamage(delta); updateHealthRegen(delta); }

    updateHook(delta, currentThirdPersonAimRay(), updatePlayerAvatarPose);
    updateRemotePeers(delta);

    if (infantry && state.isPlaying) {
        if (!state.isMultiplayer || state.isHost) {
            infantry.update(delta, state.dayNightElapsedSeconds, infantryPlayers());
            publishInfantryState();
        } else infantry.advanceReplica(delta);
        rebuildInfantryHash();
        const counter = getUI<HTMLElement>('defense-day');
        const day = String(Math.max(1, infantry.day));
        if (counter && counter.textContent !== day) counter.textContent = day;
        const remainingCounter = getUI<HTMLElement>('enemies-remaining');
        const remaining = String(infantry.enemiesRemaining);
        if (remainingCounter && remainingCounter.textContent !== remaining) remainingCounter.textContent = remaining;
    }
    if (state.matchEnded) { state.prevTime = time; return; }

    const attackerName = state.username;
    updateProjectiles(delta, attackerName);

    updateTargets(delta);
    if (chatCharacter && (chatCharacter !== gothGirlfriend || !canUseGothChat(state))) {
        gothChat?.reset();
        chatCharacter = null;
    }
    const npcInputActive = state.isPlaying && state.playerHp > 0 && isInputActive();
    if (npcInputActive) mechaCameraHandoff.update(delta);
    forgottenMecha?.updateLighting(lanternStrength);
    if (!state.isMultiplayer) forgottenMecha?.setPilotInput((state.moveForward ? 1 : 0) - (state.moveBackward ? 1 : 0) - touchMove.y, state.isShiftDown);
    gothGirlfriend?.update(npcInputActive || gothChat?.isOpen ? delta : 0);
    if (!state.isMultiplayer && npcInputActive) forgottenMecha?.setStompTargets(state.targets, processTargetHit);
    if (!state.isMultiplayer && npcInputActive && state.controls) forgottenMecha?.update(delta, {
        position: state.controls.getObject().position,
        yaw: state.controls.getObject().rotation.y,
        alive: state.playerHp > 0,
        lifeId: state.lifeId, velocity: state.velocity,
        // Roofs and pillars provide support for jumping, but only the arena
        // floor transmits this shockwave. A jump/hover is checked at impact.
        grounded: state.canJump && state.controls.getObject().position.y <= PLAYER_HEIGHT + 0.15,
    });
    if (state.isMultiplayer) {
        submitMechaInput((state.moveForward ? 1 : 0) - (state.moveBackward ? 1 : 0) - touchMove.y, state.isShiftDown,
            state.isMouseDown || mountedFireRequested, isInputActive() && state.playerHp > 0);
        updateMechaNetwork(delta);
    }
    if (state.matchEnded) { state.prevTime = time; return; }
    const mountedActor = forgottenMecha?.ownsLocalPilot ? forgottenMecha : null;
    syncMountedControls(Boolean(mountedActor));
    if (mountedActor && state.camera) {
        state.velocity.set(0, 0, 0);
        state.camera.position.copy(mountedActor.pilot.cameraPosition); state.camera.quaternion.copy(mountedActor.pilot.cameraQuaternion);
        if (state.playerMesh) {
            if (state.playerMesh.parent !== mountedActor.pilotAnchor) {
                mountedBoardFov = state.camera.fov;
                state.camera.add(state.leftGun!, state.rightGunContainer!); state.leftGun!.visible = state.rightGunContainer!.visible = false;
                cancelInspect(); smartGoggles?.reset();
            }
            mountedActor.placePilot(state.playerMesh);
            state.playerMesh.visible = mountedActor.pilotVisible;
        }
        syncThirdPersonPresentation();
        // Actor-owned hazards can reduce HP without the on-foot damage adapter.
        // Detect the value transition once, rather than restarting a timer each frame.
        updateHealthBar(mountedActor.hp / mountedActor.maxHp * 100,
            lastMountedHp !== null && mountedActor.hp < lastMountedHp ? '#ff4757' : null);
        lastMountedHp = mountedActor.hp;
        updateReloadBar(mountedActor.reloadProgress);
    }
    if (!state.isMultiplayer && forgottenMecha && npcInputActive) forgottenMecha.updateRockets(delta, state.targets, queryObstaclesAlongSegment, processTargetHit);
    // Update foliage reaction after physics, grapple, and mecha pose resolve
    // so canopies and bushes part around the body with zero frame lag.
    updateLeafAnimation(
        simDelta,
        state.dayNightElapsedSeconds,
        getLeafInteractionPosition(),
        mountedActor ? null : state.velocity,
        userSettings.leafAnimation,
    );
    cameraShake.update(delta);
    const interactionPrompt = getUI<HTMLElement>('npc-interaction');
    if (interactionPrompt) {
        const nearby = currentHudPresentation().prompt && state.camera && gothGirlfriend?.canInteract(state.camera, state.obstacles);
        interactionPrompt.hidden = !nearby;
        if (nearby) interactionPrompt.textContent = gothGirlfriend?.animator?.gesture
            ? 'Goth girlfriend · ' + gothGirlfriend.animator.gesture
            : touchMode ? 'Tap to talk to goth girlfriend' : `[${keyLabel(userSettings.keybinds.interact)}] Talk to goth girlfriend`;
    }

    updateParticles(delta);

    if (state.isMultiplayer) {
        sendLocalState();
    }

    fpsFrames++;
    if (time - fpsLastTime > 2000) {
        // A pause or hidden tab leaves a long gap; start a fresh window instead
        // of reporting a bogus idle-averaged reading.
        fpsFrames = 0;
        fpsLastTime = time;
    } else if (time >= fpsLastTime + 1000) {
        if (userSettings.showFps) {
            setFpsText(`FPS: ${Math.round((fpsFrames * 1000) / (time - fpsLastTime))}`);
        }
        fpsFrames = 0;
        fpsLastTime = time;
    }

    state.prevTime = time;

    if (state.camera) {
        const targetFov = state.isScoped ? userSettings.scopedFov : userSettings.fov;
        if (forgottenMecha?.ownsLocalPilot && forgottenMecha.mode === 'startup') {
            state.camera.fov = userSettings.fov; state.camera.updateProjectionMatrix();
        } else if (forgottenMecha?.ownsLocalPilot && forgottenMecha.mode === 'boarding') {
            const t = forgottenMecha.boardProgress;
            state.camera.fov = THREE.MathUtils.lerp(mountedBoardFov, userSettings.fov, t * t * (3 - 2 * t)); state.camera.updateProjectionMatrix();
        } else if (Math.abs(state.camera.fov - targetFov) > 0.1) {
            state.camera.fov += (targetFov - state.camera.fov) * FOV_LERP_SPEED * delta;
            state.camera.updateProjectionMatrix();
        } else if (state.camera.fov !== targetFov) {
            state.camera.fov = targetFov;
            state.camera.updateProjectionMatrix();
        }

        // Scope zoom also reduces pointer speed so aiming does not feel twitchy.
        if (state.controls) {
            if (state.camera.fov !== lastFov) {
                state.controls.pointerSpeed = scopedPointerSensitivity(state.baseSensitivity, state.camera.fov, userSettings.fov);
                lastFov = state.camera.fov;
            }
        }

    }

    syncGameHud();
    if (state.renderer && state.scene && state.camera) {
        // Actions above and between frames use the last published view and its
        // homing lock. Advance the shared aim immediately before goggles/drawing,
        // so smoothing never creates a separate hidden firing or grapple direction.
        state.controls?.update();
        // The shoulder boom stays centered on the eye; the cabin camera blend
        // belongs only to first-person viewing of the physical folding helmet.
        if (state.isThirdPersonView && forgottenMecha?.ownsLocalPilot) forgottenMecha.viewAnchor.getWorldPosition(state.camera.position);
        updatePlayerAvatarPose(delta);
        updateGrappleCable();
        const logicalCameraPos = _logicalCameraPos.copy(state.camera.position);
        _gogglesWeaponOrigin.copy(logicalCameraPos);
        (getPlayerAvatar(state.playerMesh)?.rig.muzzle ?? state.rightGun)?.getWorldPosition(_gogglesWeaponOrigin);
        _logicalCameraQuaternion.copy(state.camera.quaternion);
        const playerVisible = state.playerMesh?.visible;
        const leftGunVisible = state.leftGun?.visible;
        const rightGunVisible = state.rightGunContainer?.visible;
        try {
            const gogglesView = state.isScoped && !forgottenMecha?.ownsLocalPilot;
            // Goggles see the world directly, from the first frame of zoom.
            // Simulation and observers still use the current equipped rig.
            if (gothChat?.isOpen || gogglesView) {
                if (state.playerMesh) state.playerMesh.visible = false;
                if (state.leftGun) state.leftGun.visible = false;
                if (state.rightGunContainer) state.rightGunContainer.visible = false;
            }
            if (state.isThirdPersonView && !gothChat?.isOpen) {
                const actor = forgottenMecha, transition = actor?.localTransition;
                const radius = transition?.external && actor?.ownsLocalPilot
                    ? transition.queryRadius(actor.group.position, actor.radius, state.camera.fov, state.camera.aspect)
                    : mechaCameraHandoff.fromRenderPose ? mechaCameraHandoff.queryRadius
                        : actor?.ownsLocalPilot || mechaCameraHandoff.active ? 65 : THIRD_PERSON_CAMERA_QUERY_RADIUS;
                // Framing/queryRadius is measured from the mech center, which
                // differs from the animated cockpit eye during Mount.
                const queryCenter = transition?.external && actor?.ownsLocalPilot ? actor.group.position : logicalCameraPos;
                const candidates = queryObstaclesNear(queryCenter.x, queryCenter.z, radius, _thirdPersonObstacleCandidates);
                const obstacles = actor?.ownsLocalPilot ? candidates.filter(object => object.userData.damageTarget !== 'forgotten-mecha') : candidates;
                // Pull the shoulder camera forward when nearby architecture
                // would otherwise enter the camera or block the player view.
                resolveThirdPersonCameraPosition(
                    logicalCameraPos,
                    state.camera.quaternion,
                    obstacles,
                    state.camera.position,
                    forgottenMecha?.ownsLocalPilot ? mechCameraDimensions : mechaCameraHandoff.active ? mechaCameraHandoff.dimensions : undefined,
                );
                state.camera.lookAt(resolveThirdPersonAimTarget(
                    logicalCameraPos,
                    _logicalCameraQuaternion,
                    _thirdPersonAimTarget,
                    forgottenMecha?.ownsLocalPilot ? BULLET_TRAVEL_DISTANCE : undefined,
                ));
                if (transition?.external && actor?.ownsLocalPilot) {
                    _mechaFollowPosition.copy(state.camera.position); _mechaFollowQuaternion.copy(state.camera.quaternion);
                    transition.resolve(actor.group.position, actor.group.rotation.y, actor.radius,
                        state.camera.fov, state.camera.aspect, _mechaFollowPosition, _mechaFollowQuaternion,
                        obstacles);
                    state.camera.position.copy(transition.position); state.camera.quaternion.copy(transition.quaternion);
                } else if (mechaCameraHandoff.fromRenderPose) {
                    mechaCameraHandoff.applyPose(logicalCameraPos, obstacles, state.camera.position, state.camera.quaternion);
                }
            }

            // Capture the actual external pose before cosmetic shake. Boarding
            // may begin in the next simulation frame, after the grapple snaps
            // the logical player eye to the seat.
            forgottenMecha?.transitionCamera.recordView(state.camera.position, state.camera.quaternion);

            // Use the final shoulder/cockpit view, before impact shake. This
            // matches the displayed direction without making the dots jitter.
            if (currentHudPresentation().locator) {
                locatorBar?.update(state.camera, state.peers, state.playerList, state.peer?.id, forgottenMecha);
            }

            // Match the exact camera pose used for this draw. In third person,
            // distance still comes from the logical player position rather than
            // the temporary render offset.
            cameraShake.apply(state.camera);
            state.camera.updateMatrixWorld(true);
            // Input events run after the render camera is restored to its logical
            // pose. Keep the visible shoulder ray for screen-center firing and grappling.
            lastRenderedAimRay.origin.copy(state.camera.position);
            state.camera.getWorldDirection(lastRenderedAimRay.direction);
            hasRenderedAim = true;
            lastViewRotation.copy(state.camera.quaternion);
            applyKatanaShake(state.camera);
            state.camera.updateMatrixWorld(true);
            const pilot = forgottenMecha?.ownsLocalPilot ? forgottenMecha : null;
            let rocketPeer: string | undefined;
            if (pilot) {
                if (state.playerMesh && !state.isThirdPersonView) state.playerMesh.visible = false;
                pilot.preparePilotView(!state.isThirdPersonView);
                pilot.muzzleAnchor.getWorldPosition(_gogglesWeaponOrigin);
                if (pilot.mode === 'piloted') {
                    if (pilot.targetingReady && pilot.pilotWeapon === 'rocket') {
                        pilot.pilot.rockets.select(state.camera, _gogglesWeaponOrigin, state.targets, queryObstaclesAlongSegment);
                        rocketPeer = previewRocketPeer(pilot, state.camera, _gogglesWeaponOrigin);
                    }
                    else pilot.pilot.rockets.selected = null;
                    if (!state.isMultiplayer && isInputActive()) {
                        pilot.fireRocket(state.camera, state.targets, queryObstaclesAlongSegment);
                        if (state.isMouseDown || mountedFireRequested) pilot.requestAttack();
                    }
                }
                mountedFireRequested = false;
            }
            const gogglesPlayerPosition = logicalCameraPos;
            updateWallHud(currentHudPresentation().locator);
            if (pilot) pilot.muzzleAnchor.getWorldPosition(_gogglesWeaponOrigin);
            // Begin the scan about halfway through the scope's settle time. The
            // scan animation keeps its original pace, but no longer sits behind
            // the slow final part of the FOV easing.
            const gogglesAcquisitionReady = pilot ? pilot.mode === 'piloted' && !state.isThirdPersonView && pilot.headView.blackout <= 1e-9 && (pilot.targetingReady || state.isScoped) : state.isScoped && isGogglesScanZoomReady(
                state.camera.fov,
                userSettings.fov,
                userSettings.scopedFov,
            );
            const gogglesHudReady = gogglesAcquisitionReady && (
                pilot || !state.gogglesFailure.bricked || state.gogglesFailure.shutdownUntil > 0
            );
            smartGoggles?.update(
                state.camera,
                gogglesPlayerPosition,
                _gogglesWeaponOrigin,
                state.targets,
                state.peers,
                Boolean(gogglesHudReady && state.isPlaying && state.playerHp > 0 && isInputActive()),
                time,
                gothGirlfriend?.animator ? gothGirlfriend : null,
                dayNightCycle?.celestialScanTargets,
                !pilot && state.activeWeaponName !== 'SNIPER',
                pilot ? null : forgottenMecha,
                pilot ? rocketPeer ?? pilot.pilot.rockets.selected : undefined,
            );
            const gogglesBrickedThisFrame = updateGogglesFailureScan(
                state.gogglesFailure,
                Boolean(!pilot && gogglesHudReady && smartGoggles?.isAnomalyDetected),
                delta * 1000,
                time,
            );
            if (gogglesBrickedThisFrame) syncGogglesFailureVisuals();

            const videoReveal = !state.isThirdPersonView && (pilot?.headView.phase === 'reveal' || pilot?.headView.phase === 'shutdown-reveal') && !userSettings.photosensitivityMode && !reducedHeadMotion.matches;
            // Blur rejects long gaps using wall time; simulation still uses its
            // bounded delta so returning to a backgrounded tab cannot smear.
            atmosphereFrame.elapsed = state.dayNightElapsedSeconds; atmosphereFrame.delta = frameDelta;
            atmosphereFrame.blurAllowed = !videoReveal && isInputActive() && !gothChat?.isOpen && !userSettings.photosensitivityMode && !reducedHeadMotion.matches;
            atmosphereFrame.cameraKey = `${state.lifeId}/${state.isThirdPersonView}/${gogglesView}/${gothChat?.isOpen}/${pilot?.headView.phase ?? 'on-foot'}`;
            const holder = !state.isThirdPersonView && !pilot && !gothChat?.isOpen &&
                state.playerHp > 0 && state.playerMesh?.visible ? getPlayerAvatar(state.playerMesh) : undefined;
            if (holder?.poseForView) {
                reloadFrame.begin(holder.rig,state.camera,holder.poseForView,delta);
                if (state.hookState !== 'IDLE' && getHolderMuzzlePosition(holder.rig,'GRAPPLE',renderedGrappleTip))
                    updateGrappleCable(renderedGrappleTip);
            } else reloadFrame.clear();
            // A shot fired earlier this frame recorded its muzzle before the
            // fitted pose moved. Re-anchor that one birth-frame point now so
            // later frames do not drag the trail behind the rendered weapon.
            syncPendingProjectileTrailOrigins(resolveSyncedTrailOrigin);
            if (videoReveal && pilot) {
                if (lastMechaVideoPhase !== pilot.headView.phase) pilot.headEffects.resetCapture();
                lastMechaVideoPhase = pilot.headView.phase;
                atmosphere?.resetHistory();
                pilot.headEffects.render(state.renderer, state.scene, state.camera, pilot.headView.revealProgress, drawAtmosphere);
            } else {
                lastMechaVideoPhase = null;
                drawAtmosphere();
            }
            reloadFrame.render(state.renderer,state.scene);
            renderKatanaImpact(state.renderer, state.camera);
            if (state.isMultiplayer) acknowledgeMechaRender(); else forgottenMecha?.acknowledgeRendered();
        } finally {
            reloadFrame.restore();
            forgottenMecha?.restorePilotView();
            if (state.playerMesh && playerVisible !== undefined) state.playerMesh.visible = playerVisible;
            if (state.leftGun && leftGunVisible !== undefined) state.leftGun.visible = leftGunVisible;
            if (state.rightGunContainer && rightGunVisible !== undefined) state.rightGunContainer.visible = rightGunVisible;
            state.camera.position.copy(logicalCameraPos);
            state.camera.quaternion.copy(_logicalCameraQuaternion);
        }
    }
}

export function takePlayerDamage(damage: number, _attackerName: string, _attackerPeerId?: string): void {
    if (!state.isPlaying || state.matchEnded || state.playerHp <= 0) return;
    if (forgottenMecha?.ownsLocalPilot) { processMechaDamage(damage); return; }
    const previousHp = state.playerHp;
    state.playerHp = Math.max(0, state.playerHp - damage);
    state.regenTimer = 0;
    state.regenDelayMs = REGEN_DELAY_MS;
    renderLocalHealthChange(previousHp, true);
}

function renderLocalHealthChange(previousHp: number, feedback: boolean): void {
    const damaged = state.playerHp < previousHp;
    if (damaged) getPlayerAvatar(state.playerMesh)?.hit();
    if (feedback && damaged && state.controls) {
        const position = _lavaFeetPos.copy(state.controls.getObject().position);
        position.y -= 0.5;
        spawnParticles(position, 0xff3300, 10, 15, 0.2, 12.0);
    }

    updateHealthBar(Math.max(0, state.playerHp / state.playerMaxHp * 100), feedback && damaged ? '#ff4757' : null);
    if (state.playerHp <= 0 && previousHp > 0) {
        triggerDeath();
        state.deaths++;
        if (UI.deaths) UI.deaths.innerText = state.deaths.toString();
    }
}

export function triggerDeath(gameOver = false): void {
    if (state.matchEnded && !gameOver) return;
    resetHealthBarFlash();
    resetHitmarker();
    clearApproachWarning();
    if (!state.isMultiplayer) {
        forgottenMecha?.clearPendingDamage(); forgottenMecha?.pilot.rockets.clear(); forgottenMecha?.transitionCamera.reset();
    }
    mechaCameraHandoff.reset();
    clearMechaHeadPresentation();
    if (gameOver) state.matchEnded = true;
    setPlayerListVisible(false);
    gothChat?.close(false);
    smartGoggles?.reset();
    // The death overlay sits directly over the world, including when already paused.
    if (UI.blocker) UI.blocker.style.display = 'none';
    if (UI.panelPause) {
        UI.panelPause.style.display = 'none';
    }

    if (UI.deathOverlay) UI.deathOverlay.style.display = gameOver ? 'none' : 'flex';
    if (gameOver) {
        const overlay = document.getElementById('game-over-overlay');
        if (overlay) overlay.style.display = 'flex';
    }

    if (state.controls) {
        endInput();
        // Local death freezes offline simulation immediately. A burst centered
        // on this camera would remain frozen across the death-screen backdrop.
    }

    if (state.playerMesh) state.playerMesh.visible = state.isThirdPersonView;
    collapseRemaining = !gameOver && !state.isMultiplayer && hasRenderedAim && state.isThirdPersonView ? 1.05 : 0;

    state.velocity.set(0, 0, 0);
    resetHook();
    state.weaponHandling.cancelActions();
    state.isHovering = false;
    syncGameHud();
    if (gameOver) document.getElementById('btn-game-over-leave')?.focus();
}

// Host/singleplayer authority for target health. Clients ask the host to call this.
export function processTargetHit(targetIndex: number, damage: number, attackerPeerId?: string): TargetHitResult {
    const target = state.targets[targetIndex];
    if (!target || targetData(target).hp <= 0) return { accepted: false, killed: false };
    const data = targetData(target);
    if (data.infantry) {
        if (!infantry || state.matchEnded || state.isMultiplayer && !state.isHost) return { accepted: false, killed: false };
        const revision = data.eliminationRevision;
        const result = infantry.damage(targetIndex, damage);
        if (result.accepted && (!state.isMultiplayer || !attackerPeerId || attackerPeerId === state.peer?.id)) flashHitmarker(result.killed);
        if (result.killed) {
            state.score++;
            syncHudCounters();
            publishInfantryKill(targetIndex, revision, attackerPeerId);
        }
        return result;
    }
    const killed = data.hp - damage <= 0;
    if (!state.isMultiplayer || !attackerPeerId || attackerPeerId === state.peer?.id) {
        flashHitmarker(killed);
    }

    data.hp -= damage;
    const hpRatio = Math.max(0, data.hp / data.maxHp);
    data.healthBarFg.scale.x = hpRatio;
    
    if (data.hp <= 0) {
        data.eliminationRevision = (data.eliminationRevision ?? 0) + 1;
        const enemyColor = data.color || 0xff4500;
        spawnParticles(target.position, enemyColor, 35, 30, 0.35, 15.0);
        
        createShockwave(target.position, 8.0 * (data.scale || 1.0), 0xffaa00);
        
        respawnTarget(target);
        rebuildTargetHash();
        state.score++;
        
        if (UI.score) UI.score.innerText = state.score.toString();
        
        if (state.isMultiplayer && state.isHost) {
            broadcastTargetKill(targetIndex, state.score, target.position, data, attackerPeerId ?? state.peer?.id ?? null);
        }
    }
    return { accepted: true, killed };
}


export function updateWorldBorderOverlay(visible = currentHudPresentation().border): void {
    if (!visible || !state.controls) {
        if (UI.worldBorderOverlay) { UI.worldBorderOverlay.style.display = 'none'; UI.worldBorderOverlay.style.opacity = '0'; }
        return;
    }
    const playerObj = state.controls.getObject();
    const pos = playerObj.position;
    
    const limit = MAP_HALF_SIZE;
    const distX = limit - Math.abs(pos.x);
    const distZ = limit - Math.abs(pos.z);
    const minDist = Math.min(distX, distZ);
    
    if (!UI.worldBorderOverlay) return;
    
    if (minDist < BORDER_WARN_THRESHOLD) {
        UI.worldBorderOverlay.style.display = "block";
        const distanceFactor = Math.max(0, Math.min(1.0, (BORDER_WARN_THRESHOLD - minDist) / BORDER_WARN_THRESHOLD));
        
        if (minDist <= BORDER_PULSE_DISTANCE) {
            // Photosensitivity and reduced-motion users get a steady warning
            // instead of a flashing border.
            const pulse = userSettings.photosensitivityMode || reducedHeadMotion.matches
                ? 0.75
                : 0.6 + 0.25 * Math.sin(performance.now() / 1000 * 6);
            UI.worldBorderOverlay.style.opacity = pulse.toString();
        } else {
            UI.worldBorderOverlay.style.opacity = (distanceFactor * 0.45).toString();
        }
    } else {
        UI.worldBorderOverlay.style.opacity = "0";
        UI.worldBorderOverlay.style.display = "none";
    }
}

init();
