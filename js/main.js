import * as THREE from 'three';
import { PointerLockControls } from 'three/addons/controls/PointerLockControls.js';
import { state } from './state.js';
import {
    JUMP_FORCE,
    PROJECTILE_SPEED,
    PROJECTILE_LIFETIME
} from './config.js';
import { spawnParticles, updateParticles } from './particles.js';
import { updatePlayerPhysics } from './physics.js';
import { resetHook, toggleGrapplingHook, updateHook } from './grapple.js';
import { createAkimboGuns, fireProjectile, updateWeapons, createPlayerMesh, setThirdPerson } from './weapons.js';
import { createEnvironment, respawnTarget, updateTargets } from './world.js';
import { sendLocalState, disconnectMultiplayer } from './multiplayer.js';

let fpsFrames = 0;
let fpsLastTime = performance.now();
const fpsCounterEl = document.getElementById('fps-counter');

function validateUsername(username) {
    if (!username) {
        return 'Spielername darf nicht leer sein!';
    }
    if (username.length > 10) {
        return 'Spielername darf max. 10 Zeichen lang sein!';
    }
    const lettersOnly = /^[A-Za-zÄäÖöÜüß]+$/;
    if (!lettersOnly.test(username)) {
        return 'Spielername darf nur Buchstaben enthalten!';
    }
    return null;
}

function onWindowResize() {
    if (state.camera && state.renderer) {
        state.camera.aspect = window.innerWidth / window.innerHeight;
        state.camera.updateProjectionMatrix();
        state.renderer.setSize(window.innerWidth, window.innerHeight);
    }
}

export function init() {
    state.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1500);

    state.scene = new THREE.Scene();
    state.scene.background = new THREE.Color(0xd0dbf0);
    state.scene.fog = new THREE.FogExp2(0xd0dbf0, 0.002);

    const ambientLight = new THREE.AmbientLight(0x777777);
    state.scene.add(ambientLight);

    // Casting shadow directional light setup
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

    const blocker = document.getElementById('blocker');
    const sensSlider = document.getElementById('sensitivity');
    const sensValue = document.getElementById('sens-value');

    if (sensSlider && sensValue) {
        sensSlider.addEventListener('input', (e) => {
            const val = parseFloat(e.target.value);
            sensValue.innerText = val.toFixed(1);
            state.controls.pointerSpeed = val;
        });
        sensSlider.addEventListener('click', (e) => e.stopPropagation());
    }

    // Setup multiplayer/singleplayer menu controls
    const panelMain = document.getElementById('panel-main');
    const panelMp = document.getElementById('panel-mp');
    const panelHostWaiting = document.getElementById('panel-host-waiting');
    const panelJoinRoom = document.getElementById('panel-join-room');
    const panelPause = document.getElementById('panel-pause');

    const btnPlaySp = document.getElementById('btn-play-sp');
    const btnMenuMp = document.getElementById('btn-menu-mp');
    
    const btnMpBack = document.getElementById('btn-mp-back');
    const btnMpHostView = document.getElementById('btn-mp-host-view');
    const btnMpJoinView = document.getElementById('btn-mp-join-view');

    const btnHostCancel = document.getElementById('btn-host-cancel');
    const btnHostStart = document.getElementById('btn-host-start');

    const btnJoinConnect = document.getElementById('btn-join-connect');
    const btnJoinCancel = document.getElementById('btn-join-cancel');

    const btnPauseResume = document.getElementById('btn-pause-resume');
    const btnPauseLeave = document.getElementById('btn-pause-leave');

    const inputUsername = document.getElementById('input-username');
    const inputRoomCode = document.getElementById('input-room-code');
    const roomCodeDisplay = document.getElementById('room-code-display');
    const joinErrorLog = document.getElementById('join-error-log');
    
    const pauseLobbyInfo = document.getElementById('pause-lobby-info');
    const pauseRoomCode = document.getElementById('pause-room-code');

    const deathOverlay = document.getElementById('death-overlay');
    const btnDeathRespawn = document.getElementById('btn-death-respawn');
    const btnDeathLeave = document.getElementById('btn-death-leave');

    const mpNameError = document.getElementById('mp-name-error');
    
    if (btnPlaySp) {
        btnPlaySp.addEventListener('click', (e) => {
            e.stopPropagation();
            state.isMultiplayer = false;
            state.isHost = false;
            state.isPlaying = true;
            state.controls.lock();
        });
    }

    if (btnMenuMp) {
        btnMenuMp.addEventListener('click', (e) => {
            e.stopPropagation();
            panelMain.style.display = 'none';
            panelMp.style.display = 'flex';
        });
    }

    if (btnMpBack) {
        btnMpBack.addEventListener('click', (e) => {
            e.stopPropagation();
            if (mpNameError) mpNameError.innerText = '';
            panelMp.style.display = 'none';
            panelMain.style.display = 'flex';
        });
    }

    if (btnMpHostView) {
        btnMpHostView.addEventListener('click', (e) => {
            e.stopPropagation();
            const username = inputUsername.value.trim();
            const nameError = validateUsername(username);

            if (nameError) {
                if (mpNameError) mpNameError.innerText = nameError;
                return;
            }

            if (mpNameError) mpNameError.innerText = '';
            panelMp.style.display = 'none';
            panelHostWaiting.style.display = 'flex';

            import('./multiplayer.js').then((mp) => {
                const code = mp.generateRoomCode();
                if (roomCodeDisplay) roomCodeDisplay.innerText = code;
                mp.hostGame(username, code);
            });
        });
    }

    if (btnHostCancel) {
        btnHostCancel.addEventListener('click', (e) => {
            e.stopPropagation();
            import('./multiplayer.js').then((mp) => {
                mp.disconnectMultiplayer();
            });
            panelHostWaiting.style.display = 'none';
            panelMp.style.display = 'flex';
        });
    }

    if (btnHostStart) {
        btnHostStart.addEventListener('click', (e) => {
            e.stopPropagation();
            state.isPlaying = true;
            if (blocker) blocker.style.display = 'none';
            state.controls.lock();
        });
    }

    if (btnMpJoinView) {
        btnMpJoinView.addEventListener('click', (e) => {
            e.stopPropagation();
            const username = inputUsername.value.trim();
            const nameError = validateUsername(username);

            if (nameError) {
                if (mpNameError) mpNameError.innerText = nameError;
                return;
            }

            if (mpNameError) mpNameError.innerText = '';
            panelMp.style.display = 'none';
            panelJoinRoom.style.display = 'flex';
            if (joinErrorLog) joinErrorLog.innerText = '';
        });
    }

    if (btnJoinCancel) {
        btnJoinCancel.addEventListener('click', (e) => {
            e.stopPropagation();
            panelJoinRoom.style.display = 'none';
            panelMp.style.display = 'flex';
        });
    }

    if (btnJoinConnect) {
        btnJoinConnect.addEventListener('click', (e) => {
            e.stopPropagation();
            const username = inputUsername.value.trim() || 'Gast';
            const code = inputRoomCode.value.trim().toUpperCase();

            if (code.length !== 4) {
                if (joinErrorLog) joinErrorLog.innerText = 'Code muss 4 Zeichen lang sein!';
                return;
            }

            import('./multiplayer.js').then((mp) => {
                mp.joinGame(username, code);
            });
        });
    }

    state.controls.addEventListener('lock', () => {
        if (blocker) blocker.style.display = 'none';
        if (panelPause) panelPause.style.display = 'none';
        const healthContainer = document.getElementById('health-container');
        if (healthContainer) healthContainer.style.display = 'block';

        // Safari Keyboard Focus Fix: Force active focus on the body and canvas
        document.body.focus();
        if (state.renderer && state.renderer.domElement) {
            state.renderer.domElement.tabIndex = 1; // Ensure canvas is explicitly focusable
            state.renderer.domElement.focus();
        }
    });

    state.controls.addEventListener('unlock', () => {
        if (blocker) blocker.style.display = 'flex';
        state.isSprinting = false;
        state.isMouseDown = false;
        const healthContainer = document.getElementById('health-container');
        if (healthContainer) healthContainer.style.display = 'none';
        
        // Hide all starting panels
        if (panelMain) panelMain.style.display = 'none';
        if (panelMp) panelMp.style.display = 'none';
        if (panelHostWaiting) panelHostWaiting.style.display = 'none';
        if (panelJoinRoom) panelJoinRoom.style.display = 'none';

        if (state.isPlaying) {
            const isDead = (deathOverlay && deathOverlay.style.display === 'flex');
            
            // Show pause panel if playing and NOT dead
            if (panelPause) {
                panelPause.style.display = isDead ? 'none' : 'flex';
            }
            
            if (state.isMultiplayer) {
                if (pauseLobbyInfo) pauseLobbyInfo.style.display = isDead ? 'none' : 'inline';
                if (pauseRoomCode) pauseRoomCode.innerText = state.roomCode || '----';
                if (btnPauseLeave) btnPauseLeave.innerText = 'Lobby verlassen';
            } else {
                if (pauseLobbyInfo) pauseLobbyInfo.style.display = 'none';
                if (btnPauseLeave) btnPauseLeave.innerText = 'Spiel verlassen';
            }
        } else {
            // Return to primary main selection screen
            if (panelPause) panelPause.style.display = 'none';
            if (panelMain) panelMain.style.display = 'flex';
            
            if (state.isMultiplayer) {
                import('./multiplayer.js').then((mp) => {
                    mp.disconnectMultiplayer();
                });
            }
        }

        resetHook();
    });

    if (btnPauseResume) {
        btnPauseResume.addEventListener('click', (e) => {
            e.stopPropagation();
            state.controls.lock();
        });
    }

    if (btnPauseLeave) {
        btnPauseLeave.addEventListener('click', (e) => {
            e.stopPropagation();
            state.isPlaying = false;
            if (state.isMultiplayer) {
                import('./multiplayer.js').then((mp) => {
                    mp.disconnectMultiplayer();
                });
            }
            if (panelPause) panelPause.style.display = 'none';
            if (panelMain) panelMain.style.display = 'flex';
            resetHook();
        });
    }

    if (btnDeathRespawn) {
        btnDeathRespawn.addEventListener('click', (e) => {
            e.stopPropagation();
            
            // Reset player stats
            state.playerHp = state.playerMaxHp;
            state.score = 0;
            const scoreEl = document.getElementById('score');
            if (scoreEl) scoreEl.innerText = '0';

            const healthBar = document.getElementById('health-bar');
            if (healthBar) {
                healthBar.style.width = '100%';
                healthBar.style.backgroundColor = '#2ed573';
            }

            if (state.controls) {
                const playerObj = state.controls.getObject();
                playerObj.position.set(0, 2, 0);
            }
            state.velocity.set(0, 0, 0);
            resetHook();

            // Hide death screen
            if (deathOverlay) deathOverlay.style.display = 'none';

            // Lock controls to resume playing
            state.controls.lock();
        });
    }

    if (btnDeathLeave) {
        btnDeathLeave.addEventListener('click', (e) => {
            e.stopPropagation();
            state.isPlaying = false;
            
            // Reset stats
            state.playerHp = state.playerMaxHp;
            state.score = 0;
            const scoreEl = document.getElementById('score');
            if (scoreEl) scoreEl.innerText = '0';

            const healthBar = document.getElementById('health-bar');
            if (healthBar) {
                healthBar.style.width = '100%';
                healthBar.style.backgroundColor = '#2ed573';
            }

            if (state.controls) {
                const playerObj = state.controls.getObject();
                playerObj.position.set(0, 2, 0);
            }
            state.velocity.set(0, 0, 0);
            resetHook();

            if (state.isMultiplayer) {
                import('./multiplayer.js').then((mp) => {
                    mp.disconnectMultiplayer();
                });
            }

            // Hide death screen and return to main panel
            if (deathOverlay) deathOverlay.style.display = 'none';
            if (panelPause) panelPause.style.display = 'none';
            if (panelMain) panelMain.style.display = 'flex';
        });
    }

    state.scene.add(state.controls.getObject());

    // Generate sub-systems
    createAkimboGuns();
    createPlayerMesh();
    createEnvironment();

    // Hook Mesh Cable
    const hookGeo = new THREE.CylinderGeometry(0.08, 0.08, 1, 8);
    hookGeo.rotateX(Math.PI / 2);
    const hookMat = new THREE.MeshStandardMaterial({ 
        color: 0x00aaff,
        roughness: 0.3,
        metalness: 0.6
    });
    state.hookMesh = new THREE.Mesh(hookGeo, hookMat);
    state.hookMesh.castShadow = true;
    state.hookMesh.receiveShadow = true;

    // Keyboard bindings
    const onKeyDown = (e) => {
        switch (e.code) {
            case 'KeyW': state.moveForward = true; break;
            case 'KeyA': state.moveLeft = true; break;
            case 'KeyS': state.moveBackward = true; break;
            case 'KeyD': state.moveRight = true; break;
            case 'ShiftLeft':
            case 'ShiftRight':
                if (state.controls.isLocked && state.hookState !== 'PULLING' && (state.moveForward || state.moveBackward || state.moveLeft || state.moveRight)) {
                    state.isSprinting = !state.isSprinting;
                }
                break;
            case 'Space':
                if (state.hookState === 'PULLING') {
                    resetHook();
                    state.velocity.y = JUMP_FORCE * 0.8; 
                    state.canJump = false;
                } else if (state.canJump === true && state.hookState !== 'PULLING') {
                    state.velocity.y += JUMP_FORCE;
                    state.canJump = false;
                }
                break;
            case 'KeyR':
                if (state.controls.isLocked) {
                    toggleGrapplingHook();
                }
                break;
            case 'KeyE':
                if (state.controls.isLocked) {
                    const weaponCycle = ['PISTOL', 'SHOTGUN', 'AR'];
                    const currentIndex = weaponCycle.indexOf(state.desiredWeaponName);
                    const nextIndex = (currentIndex + 1) % weaponCycle.length;
                    state.desiredWeaponName = weaponCycle[nextIndex];
                }
                break;
            case 'Digit1':
                if (state.controls.isLocked) {
                    state.desiredWeaponName = 'PISTOL';
                }
                break;
            case 'Digit2':
                if (state.controls.isLocked) {
                    state.desiredWeaponName = 'AR';
                }
                break;
            case 'Digit3':
                if (state.controls.isLocked) {
                    state.desiredWeaponName = 'SHOTGUN';
                }
                break;
            case 'KeyP':
                if (state.controls.isLocked) {
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
        }
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);

    window.addEventListener('mousedown', (e) => {
        if (e.button === 0) { // Left click
            state.isMouseDown = true;
            if (!state.controls.isLocked) return;
            if (state.fireCooldown <= 0 && state.switchState === 'IDLE') {
                fireProjectile();
            }
        }
    });

    window.addEventListener('mouseup', (e) => {
        if (e.button === 0) {
            state.isMouseDown = false;
        }
    });

    window.addEventListener('resize', onWindowResize);
}

export function animate() {
    requestAnimationFrame(animate);

    const time = performance.now();
    const delta = (time - state.prevTime) / 1000;

    // 1) Update weapons recoil and switched models
    updateWeapons(delta);

    // 1.5) Automatic weapon firing
    if (state.controls.isLocked && state.isMouseDown && state.activeWeaponName === 'AR' && state.fireCooldown <= 0 && state.switchState === 'IDLE') {
        fireProjectile();
    }

    // 2) Update player physics movements
    updatePlayerPhysics(delta);

    // 2.5) Check lava hazard damage ticks
    checkLavaDamage(delta);

    // 2.6) Update passive health regeneration
    updateHealthRegen(delta);

    // 3) Update hook trajectories
    updateHook(delta);

    // 4) Update active bullets
    for (let i = state.projectiles.length - 1; i >= 0; i--) {
        const proj = state.projectiles[i];
        proj.userData.age += delta;
        proj.position.addScaledVector(proj.userData.direction, PROJECTILE_SPEED * delta);

        let projectileHit = false;

        for (let j = 0; j < state.targets.length; j++) {
            const target = state.targets[j];
            const distance = proj.position.distanceTo(target.position);

            const hitRange = 1.6 * (target.userData.scale || 1.0);
            if (distance < hitRange) {
                if (state.isMultiplayer) {
                    if (!state.isHost) {
                        state.connections.forEach((conn) => {
                            if (conn.open) {
                                conn.send({
                                    type: 'hit_target',
                                    targetIndex: j,
                                    damage: 1
                                });
                            }
                        });
                    } else {
                        processTargetHit(j, 1);
                    }
                } else {
                    processTargetHit(j, 1);
                }
                
                projectileHit = true;
                // dynamic sparks hit sparks
                spawnParticles(proj.position, 0xffaa00, 8, 12, 0.15, 20.0);
                break;
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
    if (state.renderer && state.scene && state.camera) {
        let logicalCameraPos = null;
        if (state.isThirdPerson) {
            logicalCameraPos = state.camera.position.clone();
            
            const camDir = new THREE.Vector3(0, 0, -1).applyQuaternion(state.camera.quaternion);
            const offsetDist = 6.0;
            const camOffset = camDir.clone().multiplyScalar(-offsetDist);
            camOffset.y += 1.5; // Offset camera upward slightly
            state.camera.position.add(camOffset);
        }

        state.renderer.render(state.scene, state.camera);

        if (state.isThirdPerson && logicalCameraPos) {
            state.camera.position.copy(logicalCameraPos);
        }
    }
}

export function triggerDeath() {
    // Show the red Death Screen overlay
    const deathOverlay = document.getElementById('death-overlay');
    if (deathOverlay) {
        deathOverlay.style.display = 'flex';
    }

    if (state.controls) {
        state.controls.unlock();
    }

    // Immediately stop character physics movement and reset hook
    state.velocity.set(0, 0, 0);
    resetHook();
}

export function processTargetHit(targetIndex, damage) {
    const target = state.targets[targetIndex];
    if (!target) return;
    
    target.userData.hp -= damage;
    const hpRatio = Math.max(0, target.userData.hp / target.userData.maxHp);
    target.userData.healthBarFg.scale.x = hpRatio;
    
    if (target.userData.hp <= 0) {
        const enemyColor = target.userData.color || 0xff4500;
        spawnParticles(target.position, enemyColor, 35, 30, 0.35, 15.0);
        
        const shockwaveGeom = new THREE.SphereGeometry(1, 16, 16);
        const shockwaveMat = new THREE.MeshBasicMaterial({
            color: 0xffaa00,
            wireframe: true,
            transparent: true,
            opacity: 0.8
        });
        const shockwave = new THREE.Mesh(shockwaveGeom, shockwaveMat);
        shockwave.position.copy(target.position);
        state.scene.add(shockwave);
        
        state.activeParticles.push({
            mesh: shockwave,
            velocity: new THREE.Vector3(0, 0, 0),
            gravity: 0,
            life: 0.35,
            maxLife: 0.35,
            isShockwave: true,
            targetScale: 8.0 * (target.userData.scale || 1.0)
        });
        
        if (state.hookState === 'PULLING' && state.hookIsEnemy && state.hookTargetEnemy === target) {
            resetHook();
        }
        
        respawnTarget(target);
        state.score++;
        
        const scoreEl = document.getElementById('score');
        if (scoreEl) scoreEl.innerText = state.score;
        
        if (state.isMultiplayer && state.isHost) {
            import('./multiplayer.js').then((mp) => {
                mp.broadcastTargetKill(targetIndex, state.score, target.position, target.userData);
            });
        }
    }
}

export function checkLavaDamage(delta) {
    if (!state.controls || !state.controls.isLocked) return;

    const playerObj = state.controls.getObject();
    const feetY = playerObj.position.y - 2.0;

    if (feetY <= 0.15) {
        let standingOnLava = false;
        for (let i = 0; i < state.lavaPools.length; i++) {
            const pool = state.lavaPools[i];
            const dx = Math.abs(playerObj.position.x - pool.position.x);
            const dz = Math.abs(playerObj.position.z - pool.position.z);
            if (dx < 12.8 && dz < 12.8) {
                standingOnLava = true;
                break;
            }
        }

        if (standingOnLava) {
            const now = performance.now();
            if (now - state.lastDamageTime >= 500) {
                state.playerHp -= 1;
                state.lastDamageTime = now;

                const feetPos = playerObj.position.clone();
                feetPos.y -= 1.8;
                spawnParticles(feetPos, 0xff3300, 6, 10, 0.15, 5.0);

                const healthBar = document.getElementById('health-bar');
                if (healthBar) {
                    const hpRatio = Math.max(0, state.playerHp / state.playerMaxHp) * 100;
                    healthBar.style.width = `${hpRatio}%`;
                    healthBar.style.backgroundColor = '#ff4757';
                    setTimeout(() => {
                        if (state.playerHp > 0) {
                            healthBar.style.backgroundColor = '#2ed573';
                        }
                    }, 100);
                }

                if (state.playerHp <= 0) {
                    triggerDeath();
                }
            }
        }
    }
}

export function updateHealthRegen(delta) {
    if (!state.isPlaying || state.playerHp <= 0 || state.playerHp >= state.playerMaxHp) {
        state.regenTimer = 0;
        return;
    }

    const now = performance.now();
    if (now - state.lastDamageTime >= 4000) {
        state.regenTimer += delta;
        if (state.regenTimer >= 1.0) {
            state.playerHp = Math.min(state.playerMaxHp, state.playerHp + 1);
            state.regenTimer -= 1.0;

            // Update the health bar UI
            const healthBar = document.getElementById('health-bar');
            if (healthBar) {
                const hpRatio = (state.playerHp / state.playerMaxHp) * 100;
                healthBar.style.width = `${hpRatio}%`;
                healthBar.style.backgroundColor = '#2ed573';
            }
        }
    } else {
        state.regenTimer = 0;
    }
}

// Automatically bootstrap the game
init();
animate();
