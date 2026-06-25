import * as THREE from 'three';
import { PointerLockControls } from 'three/examples/jsm/controls/PointerLockControls.js';
import { state, resetPlayerState } from './state.js';
import {
    JUMP_FORCE,
    PLAYER_HEIGHT,
    PLAYER_MAX_HP,
    LAVA_DAMAGE_TICK_MS,
    LAVA_DAMAGE_PER_TICK,
    LAVA_POOL_HALF_SIZE,
    DEFAULT_FOV,
    SCOPED_FOV,
    FOV_LERP_SPEED,
    PLAYER_RADIUS,
    WEAPON_STATS,
    REGEN_DELAY_MS,
    MAP_HALF_SIZE,
    BORDER_WARN_THRESHOLD,
    BORDER_PULSE_DISTANCE
} from './config.js';
import { spawnParticles, updateParticles, spawnLightBeam, spawnRocketFlame, createShockwave, disposeParticles } from './particles.js';
import { disposeProjectiles, updateProjectiles } from './projectiles.js';
import { setFpsText, setFpsVisible, updateHealthBar, updateHoverBar, updateReloadBar } from './hud.js';
import { updatePlayerPhysics } from './physics.js';
import { resetHook, toggleGrapplingHook, updateHook } from './grapple.js';
import { createAkimboGuns, fireProjectile, updateWeapons, createPlayerMesh, setThirdPerson, cancelInspect, SHARED_PROJECTILE_GEO, disposePlayerVisuals } from './weapons.js';
import { createEnvironment, disposeWorld, queryLavaPoolsNear, rebuildTargetHash, respawnTarget, updateTargets } from './world.js';
import { setDamageHandlers } from './damage.js';
import {
    sendLocalState,
    disconnectMultiplayer,
    broadcastLocalJump,
    generateRoomCode,
    hostGame,
    joinGame,
    broadcastTargetKill,
    updateRemotePeers
} from './multiplayer.js';
import { applyRendererSettings, DEFAULT_USER_SETTINGS, loadUserSettings, saveUserSettings, userSettings, type UserSettings } from './settings.js';
import { targetData } from './userDataTypes.js';
import type { PlayerDiedPacket } from './networkTypes.js';

// Reused scratch vectors keep the hot render loop from allocating every frame.
const _logicalCameraPos = new THREE.Vector3();
const _tpCamDir = new THREE.Vector3();
const _tpCamOffset = new THREE.Vector3();
const _lavaFeetPos = new THREE.Vector3();
const _jumpBoosterPos = new THREE.Vector3();
const _lavaCandidates: THREE.Object3D[] = [];

// Lazily cache HUD/menu elements. Most code paths touch the UI every frame.
const UI_cache: Record<string, HTMLElement | null> = {};
const getUI = <T extends HTMLElement>(id: string): T | null => {
    return (UI_cache[id] || (UI_cache[id] = document.getElementById(id))) as T | null;
};
const UI = {
    get healthBar() { return getUI<HTMLElement>('health-bar'); },
    get hoverBar() { return getUI<HTMLElement>('hover-bar'); },
    get fpsCounter() { return getUI<HTMLElement>('fps-counter'); },
    get reloadBar() { return getUI<HTMLElement>('reload-bar'); },
    get gogglesScope() { return getUI<HTMLElement>('goggles-scope'); },
    get crosshair() { return getUI<HTMLElement>('crosshair'); },
    get ui() { return getUI<HTMLElement>('ui'); },
    get healthContainer() { return getUI<HTMLElement>('health-container'); },
    get reloadContainer() { return getUI<HTMLElement>('reload-container'); },
    get hoverContainer() { return getUI<HTMLElement>('hover-container'); },
    get pvpStats() { return getUI<HTMLElement>('pvp-stats'); },
    get score() { return getUI<HTMLElement>('score'); },
    get deaths() { return getUI<HTMLElement>('deaths'); },
    get kills() { return getUI<HTMLElement>('kills'); },
    get blocker() { return getUI<HTMLElement>('blocker'); },
    get deathOverlay() { return getUI<HTMLElement>('death-overlay'); },
    get hoverBadge() { return getUI<HTMLElement>('hover-badge'); },
    get worldBorderOverlay() { return getUI<HTMLElement>('world-border-overlay'); },
    get inputUsername() { return getUI<HTMLInputElement>('input-username'); },
    get sensSlider() { return getUI<HTMLInputElement>('sensitivity'); },
    get sensValue() { return getUI<HTMLElement>('sens-value'); },
    get settingFov() { return getUI<HTMLInputElement>('setting-fov'); },
    get settingFovValue() { return getUI<HTMLElement>('setting-fov-value'); },
    get settingScopedFov() { return getUI<HTMLInputElement>('setting-scoped-fov'); },
    get settingScopedFovValue() { return getUI<HTMLElement>('setting-scoped-fov-value'); },
    get settingRenderScale() { return getUI<HTMLInputElement>('setting-render-scale'); },
    get settingRenderScaleValue() { return getUI<HTMLElement>('setting-render-scale-value'); },
    get settingParticles() { return getUI<HTMLInputElement>('setting-particles'); },
    get settingParticlesValue() { return getUI<HTMLElement>('setting-particles-value'); },
    get settingShadows() { return getUI<HTMLInputElement>('setting-shadows'); },
    get settingShadowsValue() { return getUI<HTMLElement>('setting-shadows-value'); },
    get settingFps() { return getUI<HTMLInputElement>('setting-fps'); },
    get settingFpsValue() { return getUI<HTMLElement>('setting-fps-value'); },
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
    get btnMpBack() { return getUI<HTMLElement>('btn-mp-back'); },
    get btnMpHostView() { return getUI<HTMLElement>('btn-mp-host-view'); },
    get btnMpJoinView() { return getUI<HTMLElement>('btn-mp-join-view'); },
    get btnHostCancel() { return getUI<HTMLElement>('btn-host-cancel'); },
    get btnHostStart() { return getUI<HTMLElement>('btn-host-start'); },
    get btnJoinConnect() { return getUI<HTMLButtonElement>('btn-join-connect'); },
    get btnJoinCancel() { return getUI<HTMLElement>('btn-join-cancel'); },
    get btnPauseResume() { return getUI<HTMLElement>('btn-pause-resume'); },
    get btnPauseLeave() { return getUI<HTMLButtonElement>('btn-pause-leave'); },
    get inputRoomCode() { return getUI<HTMLInputElement>('input-room-code'); },
    get roomCodeDisplay() { return getUI<HTMLElement>('room-code-display'); },
    get joinErrorLog() { return getUI<HTMLElement>('join-error-log'); },
    get pauseLobbyInfo() { return getUI<HTMLElement>('pause-lobby-info'); },
    get pauseRoomCode() { return getUI<HTMLElement>('pause-room-code'); },
    get btnDeathRespawn() { return getUI<HTMLElement>('btn-death-respawn'); },
    get btnDeathLeave() { return getUI<HTMLElement>('btn-death-leave'); },
    get mpNameError() { return getUI<HTMLElement>('mp-name-error'); },
    get btnCopyCode() { return getUI<HTMLElement>('btn-copy-code'); },
};
// Sequential cycling order for E. Number keys below use a different, FPS-style layout.
const WEAPON_CYCLE = ['PISTOL', 'SHOTGUN', 'AR', 'SNIPER', 'MINIGUN'];

let lastFov = -1;
let lastScopedState: boolean | null = null;
let pendingSettings: UserSettings = { ...userSettings };

let fpsFrames = 0;
let fpsLastTime = performance.now();

function validateUsername(username: string | null): string | null {
    if (!username) {
        return 'Username cannot be empty!';
    }
    if (username.length > 10) {
        return 'Username must be 10 characters or less!';
    }
    const lettersOnly = /^[A-Za-z]+$/;
    if (!lettersOnly.test(username)) {
        return 'Username must contain letters only!';
    }
    return null;
}

function onWindowResize(): void {
    if (state.camera && state.renderer) {
        state.camera.aspect = window.innerWidth / window.innerHeight;
        state.camera.updateProjectionMatrix();
        applyRendererSettings(state.renderer);
    }
}

// Renderer and camera setup is intentionally centralized because pointer lock,
// third-person mode and weapon attachments all share the same camera object.
function setupRenderer(): void {
    state.camera = new THREE.PerspectiveCamera(userSettings.fov, window.innerWidth / window.innerHeight, 0.1, 1500);

    state.scene = new THREE.Scene();
    state.scene.background = new THREE.Color(0xd0dbf0);
    state.scene.fog = new THREE.FogExp2(0xd0dbf0, 0.002);

    const ambientLight = new THREE.AmbientLight(0x777777);
    state.scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 1.2);
    directionalLight.position.set(200, 400, 200); 
    directionalLight.castShadow = true;
    
    directionalLight.shadow.mapSize.width = 1024;
    directionalLight.shadow.mapSize.height = 1024;
    directionalLight.shadow.camera.near = 0.5;
    directionalLight.shadow.camera.far = 1200;
    
    const d = 450;
    directionalLight.shadow.camera.left = -d;
    directionalLight.shadow.camera.right = d;
    directionalLight.shadow.camera.top = d;
    directionalLight.shadow.camera.bottom = -d;
    
    directionalLight.shadow.bias = -0.0005;
    state.scene.add(directionalLight);

    state.renderer = new THREE.WebGLRenderer({ antialias: true });
    applyRendererSettings(state.renderer);
    
    document.body.appendChild(state.renderer.domElement);

    state.controls = new PointerLockControls(state.camera, document.body);
}

function setupMenuListeners(): void {
    if (UI.btnPlaySp) {
        UI.btnPlaySp.addEventListener('click', (e) => {
            e.stopPropagation();
            state.isMultiplayer = false;
            state.isHost = false;
            state.pendingPlay = true;
            if (state.controls) state.controls.lock();
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
            if (UI.panelMain) UI.panelMain.style.display = 'flex';
        });
    }

    if (UI.btnSettingsReset) {
        UI.btnSettingsReset.addEventListener('click', (e) => {
            e.stopPropagation();
            pendingSettings = { ...DEFAULT_USER_SETTINGS };
            syncSettingsControls();
        });
    }

    if (UI.btnSettingsApply) {
        UI.btnSettingsApply.addEventListener('click', (e) => {
            e.stopPropagation();
            applyPendingSettings();
        });
    }

    if (UI.btnMpBack) {
        UI.btnMpBack.addEventListener('click', (e) => {
            e.stopPropagation();
            if (UI.mpNameError) UI.mpNameError.innerText = '';
            if (UI.panelMp) UI.panelMp.style.display = 'none';
            if (UI.panelMain) UI.panelMain.style.display = 'flex';
        });
    }

    if (UI.btnMpHostView) {
        UI.btnMpHostView.addEventListener('click', (e) => {
            e.stopPropagation();
            const username = UI.inputUsername ? UI.inputUsername.value.trim() : 'Guest';
            const nameError = validateUsername(username);

            if (nameError) {
                if (UI.mpNameError) UI.mpNameError.innerText = nameError;
                return;
            }

            if (UI.mpNameError) UI.mpNameError.innerText = '';
            if (UI.panelMp) UI.panelMp.style.display = 'none';
            if (UI.panelHostWaiting) UI.panelHostWaiting.style.display = 'flex';

            const code = generateRoomCode();
            if (UI.roomCodeDisplay) UI.roomCodeDisplay.innerText = code;
            hostGame(username, code);
        });
    }

    if (UI.btnHostCancel) {
        UI.btnHostCancel.addEventListener('click', (e) => {
            e.stopPropagation();
            disconnectMultiplayer();
            if (UI.panelHostWaiting) UI.panelHostWaiting.style.display = 'none';
            if (UI.panelMp) UI.panelMp.style.display = 'flex';
        });
    }

    if (UI.btnHostStart) {
        UI.btnHostStart.addEventListener('click', (e) => {
            e.stopPropagation();
            state.pendingPlay = true;
            if (UI.blocker) UI.blocker.style.display = 'none';
            if (state.controls) state.controls.lock();
        });
    }

    if (UI.btnMpJoinView) {
        UI.btnMpJoinView.addEventListener('click', (e) => {
            e.stopPropagation();
            const username = UI.inputUsername ? UI.inputUsername.value.trim() : 'Guest';
            const nameError = validateUsername(username);

            if (nameError) {
                if (UI.mpNameError) UI.mpNameError.innerText = nameError;
                return;
            }

            if (UI.mpNameError) UI.mpNameError.innerText = '';
            if (UI.panelMp) UI.panelMp.style.display = 'none';
            if (UI.panelJoinRoom) UI.panelJoinRoom.style.display = 'flex';
            if (UI.joinErrorLog) UI.joinErrorLog.innerText = '';
        });
    }

    if (UI.btnJoinCancel) {
        UI.btnJoinCancel.addEventListener('click', (e) => {
            e.stopPropagation();
            if (UI.panelJoinRoom) UI.panelJoinRoom.style.display = 'none';
            if (UI.panelMp) UI.panelMp.style.display = 'flex';
        });
    }

    if (UI.btnJoinConnect) {
        UI.btnJoinConnect.addEventListener('click', (e) => {
            e.stopPropagation();
            if (UI.btnJoinConnect && UI.btnJoinConnect.dataset.connected === 'true') {
                state.pendingPlay = true;
                if (UI.blocker) UI.blocker.style.display = 'none';
                if (state.controls) state.controls.lock();
                return;
            }

            const username = UI.inputUsername ? UI.inputUsername.value.trim() : 'Guest';
            const code = UI.inputRoomCode ? UI.inputRoomCode.value.trim().toUpperCase() : '';

            if (code.length !== 4) {
                if (UI.joinErrorLog) UI.joinErrorLog.innerText = 'Code must be 4 characters long!';
                return;
            }

            if (UI.btnJoinConnect) {
                UI.btnJoinConnect.disabled = true;
                UI.btnJoinConnect.innerText = 'Connecting...';
            }

            joinGame(username, code);
        });
    }

    if (UI.btnPauseResume) {
        UI.btnPauseResume.addEventListener('click', (e) => {
            e.stopPropagation();
            if (state.controls) state.controls.lock();
        });
    }

    if (UI.btnPauseLeave) {
        UI.btnPauseLeave.addEventListener('click', (e) => {
            e.stopPropagation();
            state.isPlaying = false;
            if (state.isMultiplayer) {
                disconnectMultiplayer();
            }
            prepareFreshArena();
            if (UI.panelPause) UI.panelPause.style.display = 'none';
            if (UI.panelMain) UI.panelMain.style.display = 'flex';
        });
    }

    if (UI.btnDeathRespawn) {
        UI.btnDeathRespawn.addEventListener('click', (e) => {
            e.stopPropagation();
            performPlayerReset();
            spawnLightBeam(new THREE.Vector3(0, 2, 0));

            if (state.isThirdPerson && state.playerMesh) {
                state.playerMesh.visible = true;
            }

            if (UI.deathOverlay) UI.deathOverlay.style.display = 'none';
            if (state.controls) state.controls.lock();
        });
    }

    if (UI.btnDeathLeave) {
        UI.btnDeathLeave.addEventListener('click', (e) => {
            e.stopPropagation();
            state.isPlaying = false;
            performPlayerReset();

            if (state.isMultiplayer) {
                disconnectMultiplayer();
            }

            prepareFreshArena();
            if (UI.deathOverlay) UI.deathOverlay.style.display = 'none';
            if (UI.panelPause) UI.panelPause.style.display = 'none';
            if (UI.panelMain) UI.panelMain.style.display = 'flex';
        });
    }

    if (UI.btnCopyCode) {
        UI.btnCopyCode.addEventListener('click', (e) => {
            e.stopPropagation();
            const code = state.roomCode || (UI.roomCodeDisplay ? UI.roomCodeDisplay.innerText : '');
            if (code && code !== '----' && UI.btnCopyCode) {
                navigator.clipboard.writeText(code);
                UI.btnCopyCode.textContent = '✅ Kopiert';
                setTimeout(() => {
                    if (UI.btnCopyCode) UI.btnCopyCode.textContent = '📋 Kopieren';
                }, 1500);
            }
        });
    }
}

// Pointer lock means keyboard and mouse state must be tracked globally, then
// consumed by the physics/weapons systems during the frame update.
function setupInputListeners(): void {
    const onKeyDown = (e: KeyboardEvent) => {
        switch (e.code) {
            case 'KeyW': state.moveForward = true; break;
            case 'KeyA': state.moveLeft = true; break;
            case 'KeyS': state.moveBackward = true; break;
            case 'KeyD': state.moveRight = true; break;
            case 'ShiftLeft':
            case 'ShiftRight':
                if (state.controls && state.controls.isLocked) {
                    state.isShiftDown = true;
                }
                break;
            case 'Space':
                if (!state.controls) break;
                if (!state.controls.isLocked) break;
                if (state.hookState === 'PULLING') {
                    resetHook();
                    state.velocity.y = JUMP_FORCE * 0.8; 
                    state.canJump = false;
                    _jumpBoosterPos.copy(state.controls.getObject().position);
                    _jumpBoosterPos.y -= 1.8;
                    spawnRocketFlame(_jumpBoosterPos, 50, true);
                    createShockwave(_jumpBoosterPos, 15.0);
                    broadcastLocalJump();
                } else if (state.canJump) {
                    state.velocity.y += JUMP_FORCE;
                    state.canJump = false;
                    _jumpBoosterPos.copy(state.controls.getObject().position);
                    _jumpBoosterPos.y -= 1.8;
                    spawnRocketFlame(_jumpBoosterPos, 50, true);
                    createShockwave(_jumpBoosterPos, 15.0);
                    broadcastLocalJump();
                }
                cancelInspect();
                break;
            case 'KeyR':
                if (state.controls && state.controls.isLocked) {
                    cancelInspect();
                    toggleGrapplingHook();
                }
                break;
            case 'KeyE':
                if (state.controls && state.controls.isLocked) {
                    const currentIndex = WEAPON_CYCLE.indexOf(state.desiredWeaponName);
                    const nextIndex = (currentIndex + 1) % WEAPON_CYCLE.length;
                    state.desiredWeaponName = WEAPON_CYCLE[nextIndex];
                    cancelInspect();
                }
                break;
            case 'Digit1':
                if (state.controls && state.controls.isLocked) {
                    state.desiredWeaponName = 'PISTOL';
                    cancelInspect();
                }
                break;
            case 'Digit2':
                if (state.controls && state.controls.isLocked) {
                    state.desiredWeaponName = 'AR';
                    cancelInspect();
                }
                break;
            case 'Digit3':
                if (state.controls && state.controls.isLocked) {
                    state.desiredWeaponName = 'SHOTGUN';
                    cancelInspect();
                }
                break;
            case 'Digit4':
                if (state.controls && state.controls.isLocked) {
                    state.desiredWeaponName = 'SNIPER';
                    cancelInspect();
                }
                break;
            case 'Digit5':
                if (state.controls && state.controls.isLocked) {
                    state.desiredWeaponName = 'MINIGUN';
                    cancelInspect();
                }
                break;
            case 'KeyX':
                if (state.controls && state.controls.isLocked && state.switchState === 'IDLE') {
                    state.inspectState = 'INSPECTING';
                    state.inspectTimer = 0.0;
                }
                break;
            case 'KeyC':
                if (state.controls && state.controls.isLocked) {
                    state.keyCActive = true;
                    state.isScoped = state.rightClickActive || state.keyCActive;
                    cancelInspect();
                }
                break;
            case 'KeyP':
                if (state.controls && state.controls.isLocked) {
                    setThirdPerson(!state.isThirdPerson);
                }
                break;
        }
    };

    const onKeyUp = (e: KeyboardEvent) => {
        switch (e.code) {
            case 'KeyW': state.moveForward = false; break;
            case 'KeyA': state.moveLeft = false; break;
            case 'KeyS': state.moveBackward = false; break;
            case 'KeyD': state.moveRight = false; break;
            case 'KeyC':
                state.keyCActive = false;
                state.isScoped = state.rightClickActive || state.keyCActive;
                break;
            case 'ShiftLeft':
            case 'ShiftRight':
                state.isShiftDown = false;
                break;
        }
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);

    window.addEventListener('mousedown', handleGameMouseButtons, true);
    window.addEventListener('mouseup', handleGameMouseButtons, true);
    window.addEventListener('pointerdown', handleGameMouseButtons, true);
    window.addEventListener('pointerup', handleGameMouseButtons, true);
    window.addEventListener('contextmenu', preventLockedMouseDefault, true);
    window.addEventListener('auxclick', preventLockedMouseDefault, true);

    window.addEventListener('resize', onWindowResize);
}

// Build scene systems after controls exist because several meshes attach to the camera.
function setupGameSystems(): void {
    if (!state.scene || !state.controls) return;
    state.scene.add(state.controls.getObject());

    createAkimboGuns();
    createPlayerMesh();
    createEnvironment();

    const hookGeo = new THREE.CylinderGeometry(0.035, 0.035, 1, 8);
    hookGeo.rotateX(Math.PI / 2);
    const hookMat = new THREE.MeshStandardMaterial({ 
        color: 0x00aaff,
        roughness: 0.3,
        metalness: 0.6
    });
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

function disposeGameRuntime(): void {
    disconnectMultiplayer();
    resetHook();
    disposeProjectiles();
    disposeParticles();
    disposePlayerVisuals();
    disposeHookMesh();
    disposeWorld();
}

function prepareFreshArena(): void {
    resetHook();
    disposeProjectiles();
    disposeParticles();
    disposeWorld();
    createEnvironment();
    performPlayerReset();
    resetHudCounters();
    state.prevTime = performance.now();
}

function performPlayerReset(): void {
    resetPlayerState();
    resetHudCounters();
    updateHealthBar(100);
    if (state.controls) {
        state.controls.getObject().position.set(0, 2, 0);
    }
    resetHook();
}

function broadcastPlayerDeath(victimName: string, killerName: string): void {
    if (!state.isMultiplayer || state.connections.length === 0) return;
    const packet: PlayerDiedPacket = {
        type: 'player_died',
        victimName: victimName,
        killerName: killerName,
        victimPeerId: state.peer?.id
    };
    state.connections.forEach((conn) => {
        if (conn.open) {
            try {
                conn.send(packet);
            } catch (err) {
                console.error('Error broadcasting player_died:', err);
            }
        }
    });
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
    return Boolean(state.controls?.isLocked);
}

function preventLockedMouseDefault(e: Event): void {
    if (isGameInputLocked()) {
        e.preventDefault();
    }
}

function handleGameMouseButtons(e: MouseEvent | PointerEvent): void {
    preventLockedMouseDefault(e);
    if (!isGameInputLocked()) return;

    const wasMouseDown = state.isMouseDown;
    updateMouseButtonState(e);

    if (!wasMouseDown && state.isMouseDown) {
        if (state.inspectState === 'INSPECTING') {
            cancelInspect();
        }
        if (state.fireCooldown <= 0 && state.switchState === 'IDLE') {
            fireProjectile();
        }
    }

    if (state.rightClickActive) {
        cancelInspect();
    }
}

function updateMouseButtonState(e: MouseEvent | PointerEvent): void {
    state.isMouseDown = (e.buttons & 1) !== 0;
    state.rightClickActive = (e.buttons & 2) !== 0;
    state.isScoped = state.rightClickActive || state.keyCActive;
}

function resetHudCounters(): void {
    if (UI.score) UI.score.innerText = '0';
    if (UI.kills) UI.kills.innerText = '0';
    if (UI.deaths) UI.deaths.innerText = '0';
}

function settingsEqual(a: UserSettings, b: UserSettings): boolean {
    return a.sensitivity === b.sensitivity &&
        a.fov === b.fov &&
        a.scopedFov === b.scopedFov &&
        a.renderScale === b.renderScale &&
        a.particleAmount === b.particleAmount &&
        a.shadows === b.shadows &&
        a.showFps === b.showFps;
}

function updateApplyButton(): void {
    if (UI.btnSettingsApply) {
        UI.btnSettingsApply.style.display = settingsEqual(pendingSettings, userSettings) ? 'none' : 'inline-block';
    }
}

function syncSettingsControls(settings: UserSettings = pendingSettings): void {
    if (UI.sensSlider) UI.sensSlider.value = settings.sensitivity.toFixed(1);
    if (UI.sensValue) UI.sensValue.innerText = settings.sensitivity.toFixed(1);
    if (UI.settingFov) UI.settingFov.value = settings.fov.toFixed(0);
    if (UI.settingFovValue) UI.settingFovValue.innerText = settings.fov.toFixed(0);
    if (UI.settingScopedFov) UI.settingScopedFov.value = settings.scopedFov.toFixed(0);
    if (UI.settingScopedFovValue) UI.settingScopedFovValue.innerText = settings.scopedFov.toFixed(0);
    if (UI.settingRenderScale) UI.settingRenderScale.value = settings.renderScale.toFixed(2);
    if (UI.settingRenderScaleValue) UI.settingRenderScaleValue.innerText = formatPercent(settings.renderScale);
    if (UI.settingParticles) UI.settingParticles.value = settings.particleAmount.toFixed(2);
    if (UI.settingParticlesValue) UI.settingParticlesValue.innerText = formatPercent(settings.particleAmount);
    if (UI.settingShadows) UI.settingShadows.checked = settings.shadows;
    setCheckboxLabel(UI.settingShadowsValue, settings.shadows);
    if (UI.settingFps) UI.settingFps.checked = settings.showFps;
    setCheckboxLabel(UI.settingFpsValue, settings.showFps);
    updateApplyButton();
}

function resetPendingSettings(): void {
    pendingSettings = { ...userSettings };
    syncSettingsControls();
}

function applyPendingSettings(): void {
    Object.assign(userSettings, pendingSettings);
    saveUserSettings();
    applyLiveSettings();
    syncSettingsControls();
}

function updatePendingSettings(mutator: (settings: UserSettings) => void): void {
    mutator(pendingSettings);
    syncSettingsControls();
}

function applyLiveSettings(): void {
    state.baseSensitivity = userSettings.sensitivity;

    if (state.camera) {
        const targetFov = state.isScoped ? userSettings.scopedFov : userSettings.fov;
        state.camera.fov = targetFov;
        state.camera.updateProjectionMatrix();
    }

    if (state.controls && state.camera) {
        state.controls.pointerSpeed = state.baseSensitivity * (state.camera.fov / userSettings.fov);
    }

    if (state.renderer) {
        applyRendererSettings(state.renderer);
    }

    setFpsVisible(userSettings.showFps && Boolean(state.controls?.isLocked) && !state.isScoped);

    lastFov = -1;
}

function setupSettingsControls(): void {
    resetPendingSettings();

    UI.sensSlider?.addEventListener('input', (e) => {
        const val = parseFloat((e.target as HTMLInputElement).value);
        updatePendingSettings((settings) => {
            settings.sensitivity = clampNumber(val, 0.1, 3.0, DEFAULT_USER_SETTINGS.sensitivity);
        });
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

    UI.settingShadows?.addEventListener('change', (e) => {
        updatePendingSettings((settings) => {
            settings.shadows = (e.target as HTMLInputElement).checked;
        });
    });

    UI.settingFps?.addEventListener('change', (e) => {
        updatePendingSettings((settings) => {
            settings.showFps = (e.target as HTMLInputElement).checked;
        });
    });
}

export function init(): void {
    setDamageHandlers(processTargetHit, takePlayerDamage);
    loadUserSettings();
    setupRenderer();
    setupSettingsControls();
    applyLiveSettings();

    setupMenuListeners();

    // Lock/unlock events are the main UI state machine for playing, pausing and death menus.
    if (state.controls) {
        state.controls.addEventListener('lock', () => {
            if (state.pendingPlay) {
                state.isPlaying = true;
                state.pendingPlay = false;
                spawnLightBeam(new THREE.Vector3(0, 2, 0));
            }
            if (UI.blocker) UI.blocker.style.display = 'none';
            if (UI.panelPause) UI.panelPause.style.display = 'none';
            if (UI.healthContainer) UI.healthContainer.style.display = 'block';
            if (UI.reloadContainer) UI.reloadContainer.style.display = 'block';
            if (UI.hoverContainer) UI.hoverContainer.style.display = 'block';

            if (UI.pvpStats) {
                UI.pvpStats.style.display = state.isMultiplayer ? 'block' : 'none';
            }

            if (UI.crosshair) UI.crosshair.style.display = 'block';
            if (UI.ui) UI.ui.style.display = 'flex';
            setFpsVisible(userSettings.showFps);

            document.body.focus();
            if (state.renderer && state.renderer.domElement) {
                state.renderer.domElement.tabIndex = 1;
                state.renderer.domElement.focus();
            }
        });

        state.controls.addEventListener('unlock', () => {
            if (UI.blocker) UI.blocker.style.display = 'flex';
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
            cancelInspect();
            if (UI.healthContainer) UI.healthContainer.style.display = 'none';
            if (UI.reloadContainer) UI.reloadContainer.style.display = 'none';
            if (UI.hoverContainer) UI.hoverContainer.style.display = 'none';
            if (UI.hoverBadge) UI.hoverBadge.style.display = 'none';

            if (UI.panelMain) UI.panelMain.style.display = 'none';
            if (UI.panelSettings) UI.panelSettings.style.display = 'none';
            if (UI.panelMp) UI.panelMp.style.display = 'none';
            if (UI.panelHostWaiting) UI.panelHostWaiting.style.display = 'none';
            if (UI.panelJoinRoom) UI.panelJoinRoom.style.display = 'none';

            if (state.isPlaying) {
                const isDead = (UI.deathOverlay && UI.deathOverlay.style.display === 'flex');
                
                if (UI.panelPause) {
                    UI.panelPause.style.display = isDead ? 'none' : 'flex';
                }
                
                if (state.isMultiplayer) {
                    if (UI.pauseLobbyInfo) UI.pauseLobbyInfo.style.display = isDead ? 'none' : 'inline';
                    if (UI.pauseRoomCode) UI.pauseRoomCode.innerText = state.roomCode || '----';
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
    }

    setupInputListeners();
    setupGameSystems();
    window.addEventListener('beforeunload', disposeGameRuntime, { once: true });

    animate();
}

// Main frame loop. Order matters: input-driven systems update first, then gameplay
// collisions/damage, then remote sync and rendering.
export function animate(): void {
    requestAnimationFrame(animate);

    const time = performance.now();
    const delta = (time - state.prevTime) / 1000;

    updateWeapons(delta);

    const stats = WEAPON_STATS[state.activeWeaponName];
    const maxCooldown = stats ? stats.fireRate : 0.1;
    updateReloadBar(Math.max(0, Math.min(1.0, 1.0 - (state.fireCooldown / maxCooldown))));

    if (state.controls && state.controls.isLocked && state.isMouseDown && (state.activeWeaponName === 'AR' || state.activeWeaponName === 'MINIGUN') && state.fireCooldown <= 0 && state.switchState === 'IDLE') {
        if (state.inspectState === 'INSPECTING') {
            cancelInspect();
        }
        fireProjectile();
    }

    updatePlayerPhysics(delta);
    updateHoverBar(state.hoverFuel);

    checkLavaDamage(delta);

    updateHealthRegen(delta);

    updateHook(delta);
    updateRemotePeers(delta);

    const attackerName = UI.inputUsername ? UI.inputUsername.value.trim() || 'Guest' : 'Guest';
    updateProjectiles(delta, attackerName);

    updateTargets(delta);

    updateParticles(delta);

    if (state.isMultiplayer) {
        sendLocalState();
    }

    updateWorldBorderOverlay(delta);

    fpsFrames++;
    if (time >= fpsLastTime + 1000) {
        if (userSettings.showFps) {
            setFpsText(`FPS: ${Math.round((fpsFrames * 1000) / (time - fpsLastTime))}`);
        }
        fpsFrames = 0;
        fpsLastTime = time;
    }

    state.prevTime = time;

    if (state.camera) {
        const targetFov = state.isScoped ? userSettings.scopedFov : userSettings.fov;
        if (Math.abs(state.camera.fov - targetFov) > 0.1) {
            state.camera.fov += (targetFov - state.camera.fov) * FOV_LERP_SPEED * delta;
            state.camera.updateProjectionMatrix();
        } else if (state.camera.fov !== targetFov) {
            state.camera.fov = targetFov;
            state.camera.updateProjectionMatrix();
        }

        // Scope zoom also reduces pointer speed so aiming does not feel twitchy.
        if (state.controls) {
            if (state.camera.fov !== lastFov) {
                state.controls.pointerSpeed = state.baseSensitivity * (state.camera.fov / userSettings.fov);
                lastFov = state.camera.fov;
            }
        }

        if (UI.gogglesScope && UI.crosshair) {
            if (state.isScoped !== lastScopedState) {
                if (state.isScoped) {
                    UI.gogglesScope.style.display = 'block';
                    UI.crosshair.style.display = 'none';
                    if (UI.ui) UI.ui.style.display = 'none';
                    setFpsVisible(false);
                    if (UI.healthContainer) UI.healthContainer.style.display = 'none';
                    if (UI.reloadContainer) UI.reloadContainer.style.display = 'none';
                    if (UI.hoverContainer) UI.hoverContainer.style.display = 'none';
                } else {
                    UI.gogglesScope.style.display = 'none';
                    UI.crosshair.style.display = 'block';
                    if (UI.ui) UI.ui.style.display = 'flex';
                    setFpsVisible(userSettings.showFps);
                    if (UI.healthContainer) {
                        UI.healthContainer.style.display = (state.controls && state.controls.isLocked) ? 'block' : 'none';
                    }
                    if (UI.reloadContainer) {
                        UI.reloadContainer.style.display = (state.controls && state.controls.isLocked) ? 'block' : 'none';
                    }
                    if (UI.hoverContainer) {
                        UI.hoverContainer.style.display = (state.controls && state.controls.isLocked) ? 'block' : 'none';
                    }
                }
                lastScopedState = state.isScoped;
            }
        }
    }

    if (state.renderer && state.scene && state.camera) {
        let logicalCameraPos = null;
        try {
            if (state.isThirdPerson) {
                logicalCameraPos = _logicalCameraPos.copy(state.camera.position);
                
                _tpCamDir.set(0, 0, -1).applyQuaternion(state.camera.quaternion);
                const offsetDist = 6.0;
                _tpCamOffset.copy(_tpCamDir).multiplyScalar(-offsetDist);
                _tpCamOffset.y += 1.5;
                state.camera.position.add(_tpCamOffset);
            }

            state.renderer.render(state.scene, state.camera);
        } finally {
            if (state.isThirdPerson && logicalCameraPos) {
                state.camera.position.copy(logicalCameraPos);
            }
        }
    }
}

export function takePlayerDamage(damage: number, attackerName: string): void {
    if (!state.isPlaying || state.playerHp <= 0) return;

    state.playerHp -= damage;
    state.lastDamageTime = performance.now();

    if (state.controls) {
        const myPos = _lavaFeetPos.copy(state.controls.getObject().position);
        myPos.y -= 0.5;
        spawnParticles(myPos, 0xff3300, 10, 15, 0.2, 12.0);
    }

    updateHealthBar(Math.max(0, state.playerHp / state.playerMaxHp) * 100, '#ff4757');

    if (state.playerHp <= 0) {
        triggerDeath();
        
        state.deaths++;
        if (UI.deaths) UI.deaths.innerText = state.deaths.toString();

        const myName = UI.inputUsername ? UI.inputUsername.value.trim() : 'Guest';
        const victimName = myName || 'Guest';
        broadcastPlayerDeath(victimName, attackerName);
    }
}

export function triggerDeath(): void {
    if (UI.panelPause) {
        UI.panelPause.style.display = 'none';
    }

    if (UI.crosshair) UI.crosshair.style.display = 'none';
    if (UI.ui) UI.ui.style.display = 'none';
    setFpsVisible(false);
    if (UI.healthContainer) UI.healthContainer.style.display = 'none';
    if (UI.reloadContainer) UI.reloadContainer.style.display = 'none';

    if (UI.deathOverlay) {
        UI.deathOverlay.style.display = 'flex';
    }

    if (state.controls) {
        state.controls.unlock();
        const playerObj = state.controls.getObject();
        spawnParticles(playerObj.position, 0x3b5998, 40, 16.0, 0.45, 6.0);
    }

    if (state.playerMesh) {
        state.playerMesh.visible = false;
    }

    state.velocity.set(0, 0, 0);
    resetHook();
    state.isHovering = false;
    if (UI.hoverBadge) UI.hoverBadge.style.display = 'none';
}

// Host/singleplayer authority for target health. Clients ask the host to call this.
export function processTargetHit(targetIndex: number, damage: number): void {
    const target = state.targets[targetIndex];
    if (!target) return;
    const data = targetData(target);
    
    data.hp -= damage;
    const hpRatio = Math.max(0, data.hp / data.maxHp);
    data.healthBarFg.scale.x = hpRatio;
    
    if (data.hp <= 0) {
        const enemyColor = data.color || 0xff4500;
        spawnParticles(target.position, enemyColor, 35, 30, 0.35, 15.0);
        
        createShockwave(target.position, 8.0 * (data.scale || 1.0), 0xffaa00);
        
        if (state.hookState === 'PULLING' && state.hookIsEnemy && state.hookTargetEnemy === target) {
            resetHook();
        }
        
        respawnTarget(target);
        rebuildTargetHash();
        state.score++;
        
        if (UI.score) UI.score.innerText = state.score.toString();
        
        if (state.isMultiplayer && state.isHost) {
            broadcastTargetKill(targetIndex, state.score, target.position, data);
        }
    }
}

export function checkLavaDamage(delta: number): void {
    if (!state.controls || (!state.controls.isLocked && !state.isMultiplayer)) return;

    const playerObj = state.controls.getObject();
    const feetY = playerObj.position.y - PLAYER_HEIGHT;

    if (feetY <= 0.15) {
        let standingOnLava = false;
        const pools = queryLavaPoolsNear(playerObj.position.x, playerObj.position.z, LAVA_POOL_HALF_SIZE + PLAYER_RADIUS, _lavaCandidates);
        const len = pools.length;
        for (let i = 0; i < len; i++) {
            const pool = pools[i];
            const dx = Math.abs(playerObj.position.x - pool.position.x);
            const dz = Math.abs(playerObj.position.z - pool.position.z);
            if (dx < LAVA_POOL_HALF_SIZE + PLAYER_RADIUS && dz < LAVA_POOL_HALF_SIZE + PLAYER_RADIUS) {
                standingOnLava = true;
                break;
            }
        }

        if (standingOnLava) {
            const now = performance.now();
            if (now - state.lastDamageTime >= LAVA_DAMAGE_TICK_MS) {
                state.playerHp -= LAVA_DAMAGE_PER_TICK;
                state.lastDamageTime = now;
                state.regenTimer = 0;

                const feetPos = _lavaFeetPos.copy(playerObj.position);
                feetPos.y -= 1.8;
                spawnParticles(feetPos, 0xff3300, 6, 10, 0.15, 5.0);

                updateHealthBar(Math.max(0, state.playerHp / state.playerMaxHp) * 100, '#ff4757');

                if (state.playerHp <= 0) {
                    triggerDeath();
                    state.deaths++;
                    if (UI.deaths) UI.deaths.innerText = state.deaths.toString();

                    if (state.isMultiplayer && state.peer) {
                        const myName = UI.inputUsername ? UI.inputUsername.value.trim() : 'Guest';
                        const victimName = myName || 'Guest';
                        broadcastPlayerDeath(victimName, 'Lava');
                    }
                }
            }
        }
    }
}

export function updateHealthRegen(delta: number): void {
    if (!state.isPlaying || state.playerHp <= 0 || state.playerHp >= state.playerMaxHp) {
        state.regenTimer = 0;
        return;
    }

    const now = performance.now();
    if (now - state.lastDamageTime >= REGEN_DELAY_MS) {
        state.regenTimer += delta;
        if (state.regenTimer >= 1.0) {
            state.playerHp = Math.min(state.playerMaxHp, state.playerHp + 1);
            state.regenTimer -= 1.0;

            updateHealthBar((state.playerHp / state.playerMaxHp) * 100);
        }
    } else {
        state.regenTimer = 0;
    }
}

export function updateWorldBorderOverlay(delta: number): void {
    if (!state.isPlaying || !state.controls) return;
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
            const time = performance.now() / 1000;
            const pulse = 0.6 + 0.25 * Math.sin(time * 6);
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
