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

let fpsFrames = 0;
let fpsLastTime = performance.now();
const fpsCounterEl = document.getElementById('fps-counter');

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

    if (blocker) {
        blocker.addEventListener('click', () => state.controls.lock());
    }

    state.controls.addEventListener('lock', () => {
        if (blocker) blocker.style.display = 'none';
        const healthContainer = document.getElementById('health-container');
        if (healthContainer) healthContainer.style.display = 'block';
    });

    state.controls.addEventListener('unlock', () => {
        if (blocker) blocker.style.display = 'flex';
        state.isSprinting = false;
        state.isMouseDown = false;
        const healthContainer = document.getElementById('health-container');
        if (healthContainer) healthContainer.style.display = 'none';
        resetHook();
    });

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

    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('keyup', onKeyUp);

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
                target.userData.hp -= 1; 

                const hpRatio = Math.max(0, target.userData.hp / target.userData.maxHp);
                target.userData.healthBarFg.scale.x = hpRatio;

                if (target.userData.hp <= 0) {
                    // Outward burst of 35 particles matching enemy color
                    const enemyColor = target.userData.color || 0xff4500;
                    spawnParticles(target.position, enemyColor, 35, 30, 0.35, 15.0);

                    // Sphere mesh death shockwave
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

                    // Dead target safety hook disengage
                    if (state.hookState === 'PULLING' && state.hookIsEnemy && state.hookTargetEnemy === target) {
                        resetHook();
                    }

                    respawnTarget(target);
                    state.score++;
                    const scoreEl = document.getElementById('score');
                    if (scoreEl) scoreEl.innerText = state.score;
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
    if (state.controls) {
        state.controls.unlock();
    }

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

// Automatically bootstrap the game
init();
animate();
