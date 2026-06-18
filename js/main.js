import * as THREE from 'three';
import { PointerLockControls } from 'three/addons/controls/PointerLockControls.js';
import { state, resetPlayerState } from './state.js';
import {
    JUMP_FORCE,
    PROJECTILE_SPEED,
    PROJECTILE_LIFETIME,
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
    TARGET_HIT_RANGE_MULTIPLIER,
    REGEN_DELAY_MS,
    MAP_HALF_SIZE,
    BORDER_WARN_THRESHOLD,
    BORDER_PULSE_DISTANCE
} from './config.js';
import { spawnParticles, updateParticles, spawnLightBeam, spawnRocketFlame, createShockwave } from './particles.js';
import { updatePlayerPhysics } from './physics.js';
import { resetHook, toggleGrapplingHook, updateHook } from './grapple.js';
import { createAkimboGuns, fireProjectile, updateWeapons, createPlayerMesh, setThirdPerson, cancelInspect } from './weapons.js';
import { createEnvironment, respawnTarget, updateTargets } from './world.js';
import {
    sendLocalState,
    disconnectMultiplayer,
    broadcastLocalJump,
    generateRoomCode,
    hostGame,
    joinGame,
    broadcastTargetKill,
    flashPeerMesh
} from './multiplayer.js';

// Module-level cached vectors to prevent per-frame garbage collection
const _logicalCameraPos = new THREE.Vector3();
const _tpCamDir = new THREE.Vector3();
const _tpCamOffset = new THREE.Vector3();
const _lavaFeetPos = new THREE.Vector3();

// DOM caches
let healthBarEl, hoverBarEl, fpsCounterEl, reloadBarEl, gogglesScopeEl, crosshairEl, uiEl,
    healthContainerEl, reloadContainerEl, hoverContainerEl, pvpStatsEl, scoreEl,
    deathsEl, killsEl, blockerEl, deathOverlayEl, hoverBadgeEl, worldBorderOverlayEl,
    inputUsernameEl, sensSliderEl, sensValueEl, panelMainEl, panelMpEl, panelHostWaitingEl,
    panelJoinRoomEl, panelPauseEl, btnPlaySpEl, btnMenuMpEl, btnMpBackEl, btnMpHostViewEl,
    btnMpJoinViewEl, btnHostCancelEl, btnHostStartEl, btnJoinConnectEl, btnJoinCancelEl,
    btnPauseResumeEl, btnPauseLeaveEl, inputRoomCodeEl, roomCodeDisplayEl, joinErrorLogEl,
    pauseLobbyInfoEl, pauseRoomCodeEl, btnDeathRespawnEl, btnDeathLeaveEl, mpNameErrorEl,
    btnCopyCodeEl;

// Static Weapon cycles
const WEAPON_CYCLE = ['PISTOL', 'SHOTGUN', 'AR', 'SNIPER', 'MINIGUN'];

// Dirty flags for per-frame DOM write optimization
let lastReloadProgress = -1;
let lastHoverFuel = -1;
let lastFov = -1;
let lastScopedState = null;

// Updates the player's health bar width in the UI HUD overlay and plays a damage screen/bar color flash.
export function updateHealthBar(hpRatio, flashColor = null) {
    if (!healthBarEl) return;
    healthBarEl.style.width = `${hpRatio}%`;
    if (flashColor) {
        healthBarEl.style.backgroundColor = flashColor;
        setTimeout(() => {
            if (state.playerHp > 0 && healthBarEl.style.backgroundColor === flashColor) {
                healthBarEl.style.backgroundColor = '#2ed573';
            }
        }, 100);
    } else {
        healthBarEl.style.backgroundColor = '#2ed573';
    }
}

// Updates the hover fuel progress bar height in the UI HUD overlay to match current hover energy.
export function updateHoverBar(fuelRatio) {
    if (!hoverBarEl) return;
    if (fuelRatio !== lastHoverFuel) {
        hoverBarEl.style.height = `${fuelRatio * 100}%`;
        lastHoverFuel = fuelRatio;
    }
}

let fpsFrames = 0;
let fpsLastTime = performance.now();
let lastFrameTime = performance.now();
const targetFps = 120;
const frameMinTime = 1000 / targetFps; // 8.333 ms

// Caches DOM queries for all UI elements, overlays, menus, and game action buttons at initial startup.
function initDOMCache() {
    healthBarEl = document.getElementById('health-bar');
    hoverBarEl = document.getElementById('hover-bar');
    fpsCounterEl = document.getElementById('fps-counter');
    reloadBarEl = document.getElementById('reload-bar');
    gogglesScopeEl = document.getElementById('goggles-scope');
    crosshairEl = document.getElementById('crosshair');
    uiEl = document.getElementById('ui');
    healthContainerEl = document.getElementById('health-container');
    reloadContainerEl = document.getElementById('reload-container');
    hoverContainerEl = document.getElementById('hover-container');
    pvpStatsEl = document.getElementById('pvp-stats');
    scoreEl = document.getElementById('score');
    deathsEl = document.getElementById('deaths');
    killsEl = document.getElementById('kills');
    blockerEl = document.getElementById('blocker');
    deathOverlayEl = document.getElementById('death-overlay');
    hoverBadgeEl = document.getElementById('hover-badge');
    worldBorderOverlayEl = document.getElementById('world-border-overlay');
    inputUsernameEl = document.getElementById('input-username');
    sensSliderEl = document.getElementById('sensitivity');
    sensValueEl = document.getElementById('sens-value');
    panelMainEl = document.getElementById('panel-main');
    panelMpEl = document.getElementById('panel-mp');
    panelHostWaitingEl = document.getElementById('panel-host-waiting');
    panelJoinRoomEl = document.getElementById('panel-join-room');
    panelPauseEl = document.getElementById('panel-pause');
    btnPlaySpEl = document.getElementById('btn-play-sp');
    btnMenuMpEl = document.getElementById('btn-menu-mp');
    btnMpBackEl = document.getElementById('btn-mp-back');
    btnMpHostViewEl = document.getElementById('btn-mp-host-view');
    btnMpJoinViewEl = document.getElementById('btn-mp-join-view');
    btnHostCancelEl = document.getElementById('btn-host-cancel');
    btnHostStartEl = document.getElementById('btn-host-start');
    btnJoinConnectEl = document.getElementById('btn-join-connect');
    btnJoinCancelEl = document.getElementById('btn-join-cancel');
    btnPauseResumeEl = document.getElementById('btn-pause-resume');
    btnPauseLeaveEl = document.getElementById('btn-pause-leave');
    inputRoomCodeEl = document.getElementById('input-room-code');
    roomCodeDisplayEl = document.getElementById('room-code-display');
    joinErrorLogEl = document.getElementById('join-error-log');
    pauseLobbyInfoEl = document.getElementById('pause-lobby-info');
    pauseRoomCodeEl = document.getElementById('pause-room-code');
    btnDeathRespawnEl = document.getElementById('btn-death-respawn');
    btnDeathLeaveEl = document.getElementById('btn-death-leave');
    mpNameErrorEl = document.getElementById('mp-name-error');
    btnCopyCodeEl = document.getElementById('btn-copy-code');
}

// Validates player username: must contain only letters, cannot be empty, and has a maximum length of 10 characters.
function validateUsername(username) {
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

// Resets camera aspect ratios and updates renderer size on window resize events to keep visuals aligned.
function onWindowResize() {
    if (state.camera && state.renderer) {
        state.camera.aspect = window.innerWidth / window.innerHeight;
        state.camera.updateProjectionMatrix();
        state.renderer.setSize(window.innerWidth, window.innerHeight);
    }
}

// Creates Three.js camera, scene fog, ambient & directional lighting, configures shadow maps, and instantiates PointerLock controls.
function setupRenderer() {
    state.camera = new THREE.PerspectiveCamera(DEFAULT_FOV, window.innerWidth / window.innerHeight, 0.1, 1500);

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
    state.renderer.setPixelRatio(window.devicePixelRatio);
    state.renderer.setSize(window.innerWidth, window.innerHeight);
    
    state.renderer.shadowMap.enabled = true;
    state.renderer.shadowMap.type = THREE.PCFSoftShadowMap; 
    
    document.body.appendChild(state.renderer.domElement);

    state.controls = new PointerLockControls(state.camera, document.body);
}

// Binds all HTML button event listeners (singleplayer, hosting, joining lobby, pausing, respawns, and code copying).
function setupMenuListeners() {
    // Singleplayer Play
    if (btnPlaySpEl) {
        btnPlaySpEl.addEventListener('click', (e) => {
            e.stopPropagation();
            state.isMultiplayer = false;
            state.isHost = false;
            state.pendingPlay = true;
            state.controls.lock();
        });
    }

    // Multiplayer view toggle
    if (btnMenuMpEl) {
        btnMenuMpEl.addEventListener('click', (e) => {
            e.stopPropagation();
            if (panelMainEl) panelMainEl.style.display = 'none';
            if (panelMpEl) panelMpEl.style.display = 'flex';
        });
    }

    if (btnMpBackEl) {
        btnMpBackEl.addEventListener('click', (e) => {
            e.stopPropagation();
            if (mpNameErrorEl) mpNameErrorEl.innerText = '';
            if (panelMpEl) panelMpEl.style.display = 'none';
            if (panelMainEl) panelMainEl.style.display = 'flex';
        });
    }

    // Host Menu view
    if (btnMpHostViewEl) {
        btnMpHostViewEl.addEventListener('click', (e) => {
            e.stopPropagation();
            const username = inputUsernameEl ? inputUsernameEl.value.trim() : 'Guest';
            const nameError = validateUsername(username);

            if (nameError) {
                if (mpNameErrorEl) mpNameErrorEl.innerText = nameError;
                return;
            }

            if (mpNameErrorEl) mpNameErrorEl.innerText = '';
            if (panelMpEl) panelMpEl.style.display = 'none';
            if (panelHostWaitingEl) panelHostWaitingEl.style.display = 'flex';

            const code = generateRoomCode();
            if (roomCodeDisplayEl) roomCodeDisplayEl.innerText = code;
            hostGame(username, code);
        });
    }

    if (btnHostCancelEl) {
        btnHostCancelEl.addEventListener('click', (e) => {
            e.stopPropagation();
            disconnectMultiplayer();
            if (panelHostWaitingEl) panelHostWaitingEl.style.display = 'none';
            if (panelMpEl) panelMpEl.style.display = 'flex';
        });
    }

    if (btnHostStartEl) {
        btnHostStartEl.addEventListener('click', (e) => {
            e.stopPropagation();
            state.pendingPlay = true;
            if (blockerEl) blockerEl.style.display = 'none';
            state.controls.lock();
        });
    }

    // Join Menu view
    if (btnMpJoinViewEl) {
        btnMpJoinViewEl.addEventListener('click', (e) => {
            e.stopPropagation();
            const username = inputUsernameEl ? inputUsernameEl.value.trim() : 'Guest';
            const nameError = validateUsername(username);

            if (nameError) {
                if (mpNameErrorEl) mpNameErrorEl.innerText = nameError;
                return;
            }

            if (mpNameErrorEl) mpNameErrorEl.innerText = '';
            if (panelMpEl) panelMpEl.style.display = 'none';
            if (panelJoinRoomEl) panelJoinRoomEl.style.display = 'flex';
            if (joinErrorLogEl) joinErrorLogEl.innerText = '';
        });
    }

    if (btnJoinCancelEl) {
        btnJoinCancelEl.addEventListener('click', (e) => {
            e.stopPropagation();
            if (panelJoinRoomEl) panelJoinRoomEl.style.display = 'none';
            if (panelMpEl) panelMpEl.style.display = 'flex';
        });
    }

    if (btnJoinConnectEl) {
        btnJoinConnectEl.addEventListener('click', (e) => {
            e.stopPropagation();
            if (btnJoinConnectEl.dataset.connected === 'true') {
                state.pendingPlay = true;
                if (blockerEl) blockerEl.style.display = 'none';
                state.controls.lock();
                return;
            }

            const username = inputUsernameEl ? inputUsernameEl.value.trim() : 'Guest';
            const code = inputRoomCodeEl ? inputRoomCodeEl.value.trim().toUpperCase() : '';

            if (code.length !== 4) {
                if (joinErrorLogEl) joinErrorLogEl.innerText = 'Code must be 4 characters long!';
                return;
            }

            btnJoinConnectEl.disabled = true;
            btnJoinConnectEl.innerText = 'Connecting...';

            joinGame(username, code);
        });
    }

    // Pause Handlers
    if (btnPauseResumeEl) {
        btnPauseResumeEl.addEventListener('click', (e) => {
            e.stopPropagation();
            state.controls.lock();
        });
    }

    if (btnPauseLeaveEl) {
        btnPauseLeaveEl.addEventListener('click', (e) => {
            e.stopPropagation();
            state.isPlaying = false;
            if (state.isMultiplayer) {
                disconnectMultiplayer();
            }
            if (panelPauseEl) panelPauseEl.style.display = 'none';
            if (panelMainEl) panelMainEl.style.display = 'flex';
            resetHook();
        });
    }

    // Respawn / Death panel
    if (btnDeathRespawnEl) {
        btnDeathRespawnEl.addEventListener('click', (e) => {
            e.stopPropagation();
            performPlayerReset();
            spawnLightBeam(new THREE.Vector3(0, 2, 0));

            if (state.isThirdPerson && state.playerMesh) {
                state.playerMesh.visible = true;
            }

            if (deathOverlayEl) deathOverlayEl.style.display = 'none';
            state.controls.lock();
        });
    }

    if (btnDeathLeaveEl) {
        btnDeathLeaveEl.addEventListener('click', (e) => {
            e.stopPropagation();
            state.isPlaying = false;
            performPlayerReset();

            if (state.isMultiplayer) {
                disconnectMultiplayer();
            }

            if (deathOverlayEl) deathOverlayEl.style.display = 'none';
            if (panelPauseEl) panelPauseEl.style.display = 'none';
            if (panelMainEl) panelMainEl.style.display = 'flex';
        });
    }

    // Copy room code
    if (btnCopyCodeEl) {
        btnCopyCodeEl.addEventListener('click', (e) => {
            e.stopPropagation();
            const code = state.roomCode || (roomCodeDisplayEl ? roomCodeDisplayEl.innerText : '');
            if (code && code !== '----') {
                navigator.clipboard.writeText(code);
                btnCopyCodeEl.textContent = '✅ Kopiert';
                setTimeout(() => btnCopyCodeEl.textContent = '📋 Kopieren', 1500);
            }
        });
    }
}

// Sets up all mouse click, hover, window resize, and keyboard inputs (WASD, Space, Shift, C, X, E, 1-5).
function setupInputListeners() {
    // Keyboard inputs
    const onKeyDown = (e) => {
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
                if (state.hookState === 'PULLING') {
                    resetHook();
                    state.velocity.y = JUMP_FORCE * 0.8; 
                    state.canJump = false;
                    const boosterPos = state.controls.getObject().position.clone();
                    boosterPos.y -= 1.8;
                    spawnRocketFlame(boosterPos, 50, true);
                    createShockwave(boosterPos, 15.0);
                    broadcastLocalJump();
                } else if (state.canJump && state.hookState !== 'PULLING') {
                    state.velocity.y += JUMP_FORCE;
                    state.canJump = false;
                    const boosterPos = state.controls.getObject().position.clone();
                    boosterPos.y -= 1.8;
                    spawnRocketFlame(boosterPos, 50, true);
                    createShockwave(boosterPos, 15.0);
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

    const onKeyUp = (e) => {
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

    // Mouse inputs
    window.addEventListener('mousedown', (e) => {
        if (state.controls && state.controls.isLocked) {
            e.preventDefault();
        }
        if (e.button === 0) { // Left click
            state.isMouseDown = true;
            if (!state.controls || !state.controls.isLocked) return;
            if (state.inspectState === 'INSPECTING') {
                cancelInspect();
            }
            if (state.fireCooldown <= 0 && state.switchState === 'IDLE') {
                fireProjectile();
            }
        } else if (e.button === 2) { // Right click
            if (state.controls && state.controls.isLocked) {
                state.rightClickActive = true;
                state.isScoped = state.rightClickActive || state.keyCActive;
                cancelInspect();
            }
        }
    });

    window.addEventListener('mouseup', (e) => {
        if (state.controls && state.controls.isLocked) {
            e.preventDefault();
        }
        if (e.button === 0) {
            state.isMouseDown = false;
        } else if (e.button === 2) { // Right click release
            state.rightClickActive = false;
            state.isScoped = state.rightClickActive || state.keyCActive;
        }
    });

    window.addEventListener('contextmenu', (e) => {
        if (state.controls && state.controls.isLocked) {
            e.preventDefault();
        }
    });

    window.addEventListener('resize', onWindowResize);
}

// Initialises core runtime components: player mesh, weapons, procedural world border, and grappling hook cable.
function setupGameSystems() {
    state.scene.add(state.controls.getObject());

    createAkimboGuns();
    createPlayerMesh();
    createEnvironment();

    // Hook Mesh Cable setup
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
}

// Resets player state vectors, wipes HUD scores, restores health/fuel indicators, and respawns character.
function performPlayerReset() {
    resetPlayerState();
    if (scoreEl) scoreEl.innerText = '0';
    updateHealthBar(100);
    if (state.controls) {
        state.controls.getObject().position.set(0, 2, 0);
    }
    resetHook();
}

// Broadcasts client player death details to remote peer DataChannels
function broadcastPlayerDeath(victimName, killerName) {
    if (!state.isMultiplayer || state.connections.length === 0) return;
    const packet = {
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

// Bootstraps the entire game: renderer, menu layout, key/mouse listeners and gameplay modules.
export function init() {
    setupRenderer();
    initDOMCache();

    // Sensitivity slider setup
    let initialSens = 1.0;
    if (sensSliderEl) {
        let val = parseFloat(sensSliderEl.value);
        if (!isNaN(val)) {
            initialSens = val;
        }
    }
    state.baseSensitivity = initialSens;
    if (state.controls) {
        state.controls.pointerSpeed = state.baseSensitivity;
    }
    if (sensValueEl) {
        sensValueEl.innerText = state.baseSensitivity.toFixed(1);
    }

    if (sensSliderEl && sensValueEl) {
        sensSliderEl.addEventListener('input', (e) => {
            let val = parseFloat(e.target.value);
            if (isNaN(val)) val = 1.0;
            val = Math.max(0.1, Math.min(3.0, val));
            state.baseSensitivity = val;
            sensValueEl.innerText = val.toFixed(1);
            if (state.controls) {
                state.controls.pointerSpeed = val * (state.camera ? (state.camera.fov / DEFAULT_FOV) : 1.0);
            }
        });
        sensSliderEl.addEventListener('click', (e) => e.stopPropagation());
    }

    setupMenuListeners();

    // PointerLock controls change triggers
    state.controls.addEventListener('lock', () => {
        if (state.pendingPlay) {
            state.isPlaying = true;
            state.pendingPlay = false;
            spawnLightBeam(new THREE.Vector3(0, 2, 0));
        }
        if (blockerEl) blockerEl.style.display = 'none';
        if (panelPauseEl) panelPauseEl.style.display = 'none';
        if (healthContainerEl) healthContainerEl.style.display = 'block';
        if (reloadContainerEl) reloadContainerEl.style.display = 'block';
        if (hoverContainerEl) hoverContainerEl.style.display = 'block';

        if (pvpStatsEl) {
            pvpStatsEl.style.display = state.isMultiplayer ? 'block' : 'none';
        }

        if (crosshairEl) crosshairEl.style.display = 'block';
        if (uiEl) uiEl.style.display = 'flex';
        if (fpsCounterEl) fpsCounterEl.style.display = 'block';

        document.body.focus();
        if (state.renderer && state.renderer.domElement) {
            state.renderer.domElement.tabIndex = 1;
            state.renderer.domElement.focus();
        }
    });

    state.controls.addEventListener('unlock', () => {
        if (blockerEl) blockerEl.style.display = 'flex';
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
        if (healthContainerEl) healthContainerEl.style.display = 'none';
        if (reloadContainerEl) reloadContainerEl.style.display = 'none';
        if (hoverContainerEl) hoverContainerEl.style.display = 'none';
        if (hoverBadgeEl) hoverBadgeEl.style.display = 'none';

        if (panelMainEl) panelMainEl.style.display = 'none';
        if (panelMpEl) panelMpEl.style.display = 'none';
        if (panelHostWaitingEl) panelHostWaitingEl.style.display = 'none';
        if (panelJoinRoomEl) panelJoinRoomEl.style.display = 'none';

        if (state.isPlaying) {
            const isDead = (deathOverlayEl && deathOverlayEl.style.display === 'flex');
            
            if (panelPauseEl) {
                panelPauseEl.style.display = isDead ? 'none' : 'flex';
            }
            
            if (state.isMultiplayer) {
                if (pauseLobbyInfoEl) pauseLobbyInfoEl.style.display = isDead ? 'none' : 'inline';
                if (pauseRoomCodeEl) pauseRoomCodeEl.innerText = state.roomCode || '----';
                if (btnPauseLeaveEl) btnPauseLeaveEl.innerText = 'Leave Lobby';
            } else {
                if (pauseLobbyInfoEl) pauseLobbyInfoEl.style.display = 'none';
                if (btnPauseLeaveEl) btnPauseLeaveEl.innerText = 'Leave Game';
            }
        } else {
            if (panelPauseEl) panelPauseEl.style.display = 'none';
            if (panelMainEl) panelMainEl.style.display = 'flex';
            
            if (state.isMultiplayer) {
                disconnectMultiplayer();
            }
        }

        resetHook();
    });

    setupInputListeners();
    setupGameSystems();

    // Start the render loop only after all systems are initialised
    animate();
}

// Global render callback loop executing physics steps, weapons, network syncing, particles, and rendering frames at max 120 FPS.
export function animate() {
    requestAnimationFrame(animate);

    const time = performance.now();
    const elapsed = time - lastFrameTime;

    if (elapsed < frameMinTime) {
        return;
    }

    lastFrameTime = time - (elapsed % frameMinTime);

    const delta = (time - state.prevTime) / 1000;

    // 1) Update weapons recoil and switched models
    updateWeapons(delta);

    // Update reload bar UI (indicates cooldown recovery)
    if (reloadBarEl) {
        const stats = WEAPON_STATS[state.activeWeaponName];
        const maxCooldown = stats ? stats.fireRate : 0.1;

        const progress = Math.max(0, Math.min(1.0, 1.0 - (state.fireCooldown / maxCooldown)));
        if (progress !== lastReloadProgress) {
            reloadBarEl.style.width = `${progress * 100}%`;
            lastReloadProgress = progress;
        }
    }

    // 1.5) Automatic weapon firing
    if (state.controls && state.controls.isLocked && state.isMouseDown && (state.activeWeaponName === 'AR' || state.activeWeaponName === 'MINIGUN') && state.fireCooldown <= 0 && state.switchState === 'IDLE') {
        if (state.inspectState === 'INSPECTING') {
            cancelInspect();
        }
        fireProjectile();
    }

    // 2) Update player physics movements
    updatePlayerPhysics(delta);
    updateHoverBar(state.hoverFuel);

    // 2.5) Check lava hazard damage ticks
    checkLavaDamage(delta);

    // 2.6) Update passive health regeneration
    updateHealthRegen(delta);

    // 3) Update hook trajectories
    updateHook(delta);

    // Fetch peer IDs once outside the nested projectile loop to reduce GC pressure
    const peerIds = state.isMultiplayer ? Object.keys(state.peers) : [];
    const peerIdsLen = peerIds.length;
    const activeDamage = WEAPON_STATS[state.activeWeaponName]?.damage ?? 1;

    // 4) Update active bullets
    for (let i = state.projectiles.length - 1; i >= 0; i--) {
        const proj = state.projectiles[i];
        proj.userData.age += delta;
        proj.position.addScaledVector(proj.userData.direction, PROJECTILE_SPEED * delta);

        let projectileHit = false;

        const targetsLen = state.targets.length;
        for (let j = 0; j < targetsLen; j++) {
            const target = state.targets[j];
            const distance = proj.position.distanceTo(target.position);

            const hitRange = TARGET_HIT_RANGE_MULTIPLIER * (target.userData.scale || 1.0);
            if (distance < hitRange) {
                if (state.isMultiplayer) {
                    if (!state.isHost) {
                        state.connections.forEach((conn) => {
                            if (conn.open) {
                                try {
                                    conn.send({
                                        type: 'hit_target',
                                        targetIndex: j,
                                        damage: activeDamage
                                    });
                                } catch (err) {
                                    console.error('Error broadcasting hit_target:', err);
                                }
                            }
                        });
                    } else {
                        processTargetHit(j, activeDamage);
                    }
                } else {
                    processTargetHit(j, activeDamage);
                }
                
                projectileHit = true;
                spawnParticles(proj.position, 0xffaa00, 8, 12, 0.15, 20.0);
                break;
            }
        }

        // B) Check hits on Remote Players (PVP) in Multiplayer
        if (!projectileHit && state.isMultiplayer) {
            for (let j = 0; j < peerIdsLen; j++) {
                const peerId = peerIds[j];
                const peerData = state.peers[peerId];
                if (peerData && peerData.mesh) {
                    const distance = proj.position.distanceTo(peerData.mesh.position);
                    const hitRange = PLAYER_RADIUS;
                    
                    if (distance < hitRange) {
                        projectileHit = true;
                        spawnParticles(proj.position, 0x8c7ae6, 8, 12, 0.15, 20.0);
                        flashPeerMesh(peerData, 0xff3333, 150);
                        
                        const inputUsernameVal = inputUsernameEl ? inputUsernameEl.value.trim() : 'Guest';
                        const attackerName = inputUsernameVal || 'Guest';

                        state.connections.forEach((conn) => {
                            if (conn.open) {
                                try {
                                    conn.send({
                                        type: 'player_hit',
                                        targetPeerId: peerId,
                                        damage: activeDamage,
                                        attackerName: attackerName
                                    });
                                } catch (err) {
                                    console.error('Error broadcasting player_hit:', err);
                                }
                            }
                        });
                        break;
                    }
                }
            }
        }

        if (projectileHit || proj.userData.age > PROJECTILE_LIFETIME) {
            state.scene.remove(proj);
            proj.visible = false;
            state.projectilePool.push(proj);
            state.projectiles.splice(i, 1);
        }
    }

    // 5) Update targets bilboardings
    updateTargets(delta);

    // 6) Tick dynamic gravity particles
    updateParticles(delta);

    // 6.5) Stream multiplayer client sync packets
    if (state.isMultiplayer) {
        sendLocalState();
    }

    // 6.6) Update world border overlay warning opacity
    updateWorldBorderOverlay(delta);

    // 7) Frame pacing calculations
    fpsFrames++;
    if (time >= fpsLastTime + 1000) {
        if (fpsCounterEl) {
            fpsCounterEl.textContent = `FPS: ${Math.round((fpsFrames * 1000) / (time - fpsLastTime))}`;
        }
        fpsFrames = 0;
        fpsLastTime = time;
    }

    state.prevTime = time;

    // Lerp FOV for scoping
    if (state.camera) {
        const targetFov = state.isScoped ? SCOPED_FOV : DEFAULT_FOV;
        if (Math.abs(state.camera.fov - targetFov) > 0.1) {
            state.camera.fov += (targetFov - state.camera.fov) * FOV_LERP_SPEED * delta;
            state.camera.updateProjectionMatrix();
        } else if (state.camera.fov !== targetFov) {
            state.camera.fov = targetFov;
            state.camera.updateProjectionMatrix();
        }

        // Dynamic pointer speed scaling based on zoom level
        if (state.controls) {
            if (state.camera.fov !== lastFov) {
                state.controls.pointerSpeed = state.baseSensitivity * (state.camera.fov / DEFAULT_FOV);
                lastFov = state.camera.fov;
            }
        }

        // Toggle goggles, normal crosshair, and standard gameplay HUD overlays
        if (gogglesScopeEl && crosshairEl) {
            if (state.isScoped !== lastScopedState) {
                if (state.isScoped) {
                    gogglesScopeEl.style.display = 'block';
                    crosshairEl.style.display = 'none';
                    if (uiEl) uiEl.style.display = 'none';
                    if (fpsCounterEl) fpsCounterEl.style.display = 'none';
                    if (healthContainerEl) healthContainerEl.style.display = 'none';
                    if (reloadContainerEl) reloadContainerEl.style.display = 'none';
                    if (hoverContainerEl) hoverContainerEl.style.display = 'none';
                } else {
                    gogglesScopeEl.style.display = 'none';
                    crosshairEl.style.display = 'block';
                    if (uiEl) uiEl.style.display = 'flex';
                    if (fpsCounterEl) fpsCounterEl.style.display = 'block';
                    if (healthContainerEl) {
                        healthContainerEl.style.display = (state.controls && state.controls.isLocked) ? 'block' : 'none';
                    }
                    if (reloadContainerEl) {
                        reloadContainerEl.style.display = (state.controls && state.controls.isLocked) ? 'block' : 'none';
                    }
                    if (hoverContainerEl) {
                        hoverContainerEl.style.display = (state.controls && state.controls.isLocked) ? 'block' : 'none';
                    }
                }
                lastScopedState = state.isScoped;
            }
        }
    }

    if (state.renderer && state.scene && state.camera) {
        let logicalCameraPos = null;
        if (state.isThirdPerson) {
            logicalCameraPos = _logicalCameraPos.copy(state.camera.position);
            
            _tpCamDir.set(0, 0, -1).applyQuaternion(state.camera.quaternion);
            const offsetDist = 6.0;
            _tpCamOffset.copy(_tpCamDir).multiplyScalar(-offsetDist);
            _tpCamOffset.y += 1.5; // Offset camera upward slightly
            state.camera.position.add(_tpCamOffset);
        }

        state.renderer.render(state.scene, state.camera);

        if (state.isThirdPerson && logicalCameraPos) {
            state.camera.position.copy(logicalCameraPos);
        }
    }
}

// Computes local player damage, displays blood splatter particles, flashes HUD bar, and broadcasts deaths.
export function takePlayerDamage(damage, attackerName) {
    if (!state.isPlaying || state.playerHp <= 0) return;

    state.playerHp -= damage;
    state.lastDamageTime = performance.now(); // Reset passive regen ticker delay

    if (state.controls) {
        const myPos = _lavaFeetPos.copy(state.controls.getObject().position);
        myPos.y -= 0.5;
        spawnParticles(myPos, 0xff3300, 10, 15, 0.2, 12.0);
    }

    updateHealthBar(Math.max(0, state.playerHp / state.playerMaxHp) * 100, '#ff4757');

    if (state.playerHp <= 0) {
        triggerDeath();
        
        state.deaths++;
        if (deathsEl) deathsEl.innerText = state.deaths;

        const myName = inputUsernameEl ? inputUsernameEl.value.trim() : 'Guest';
        const victimName = myName || 'Guest';
        broadcastPlayerDeath(victimName, attackerName);
    }
}

// Triggers local player death sequence, displaying red menu screen, spawning explosion sparks, and releasing controls.
export function triggerDeath() {
    if (panelPauseEl) {
        panelPauseEl.style.display = 'none';
    }

    if (crosshairEl) crosshairEl.style.display = 'none';
    if (uiEl) uiEl.style.display = 'none';
    if (fpsCounterEl) fpsCounterEl.style.display = 'none';
    if (healthContainerEl) healthContainerEl.style.display = 'none';
    if (reloadContainerEl) reloadContainerEl.style.display = 'none';

    if (deathOverlayEl) {
        deathOverlayEl.style.display = 'flex';
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
    if (hoverBadgeEl) hoverBadgeEl.style.display = 'none';
}

// Processes hit confirmations on remote targets, updating hp ratios, spawning shockwaves and respawning target boxes.
export function processTargetHit(targetIndex, damage) {
    const target = state.targets[targetIndex];
    if (!target) return;
    
    target.userData.hp -= damage;
    const hpRatio = Math.max(0, target.userData.hp / target.userData.maxHp);
    target.userData.healthBarFg.scale.x = hpRatio;
    
    if (target.userData.hp <= 0) {
        const enemyColor = target.userData.color || 0xff4500;
        spawnParticles(target.position, enemyColor, 35, 30, 0.35, 15.0);
        
        // Call particles shockwave helper instead of allocating fresh geometries inline
        createShockwave(target.position, 8.0 * (target.userData.scale || 1.0), 0xffaa00);
        
        if (state.hookState === 'PULLING' && state.hookIsEnemy && state.hookTargetEnemy === target) {
            resetHook();
        }
        
        respawnTarget(target);
        state.score++;
        
        if (scoreEl) scoreEl.innerText = state.score;
        
        if (state.isMultiplayer && state.isHost) {
            broadcastTargetKill(targetIndex, state.score, target.position, target.userData);
        }
    }
}

// Detects if the player is standing inside a lava hazard pool and applies tick-based damage.
export function checkLavaDamage(delta) {
    if (!state.controls || (!state.controls.isLocked && !state.isMultiplayer)) return;

    const playerObj = state.controls.getObject();
    const feetY = playerObj.position.y - PLAYER_HEIGHT;

    if (feetY <= 0.15) {
        let standingOnLava = false;
        const len = state.lavaPools.length;
        for (let i = 0; i < len; i++) {
            const pool = state.lavaPools[i];
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

                    if (state.isMultiplayer && state.peer) {
                        state.deaths++;
                        if (deathsEl) deathsEl.innerText = state.deaths;

                        const myName = inputUsernameEl ? inputUsernameEl.value.trim() : 'Guest';
                        const victimName = myName || 'Guest';
                        broadcastPlayerDeath(victimName, 'Lava');
                    }
                }
            }
        }
    }
}

// Evaluates and updates passive health regeneration if the player has not taken damage recently.
export function updateHealthRegen(delta) {
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

// Updates the red border warning vignette opacity and pulsation depending on player proximity to boundaries.
export function updateWorldBorderOverlay(delta) {
    if (!state.isPlaying || !state.controls) return;
    const playerObj = state.controls.getObject();
    const pos = playerObj.position;
    
    const limit = MAP_HALF_SIZE;
    const distX = limit - Math.abs(pos.x);
    const distZ = limit - Math.abs(pos.z);
    const minDist = Math.min(distX, distZ);
    
    if (!worldBorderOverlayEl) return;
    
    if (minDist < BORDER_WARN_THRESHOLD) {
        worldBorderOverlayEl.style.display = "block";
        const distanceFactor = Math.max(0, Math.min(1.0, (BORDER_WARN_THRESHOLD - minDist) / BORDER_WARN_THRESHOLD));
        
        if (minDist <= BORDER_PULSE_DISTANCE) {
            const time = performance.now() / 1000;
            const pulse = 0.6 + 0.25 * Math.sin(time * 6);
            worldBorderOverlayEl.style.opacity = pulse;
        } else {
            worldBorderOverlayEl.style.opacity = distanceFactor * 0.45;
        }
    } else {
        worldBorderOverlayEl.style.opacity = 0;
        worldBorderOverlayEl.style.display = "none";
    }
}

// Automatically bootstrap the game
init();
