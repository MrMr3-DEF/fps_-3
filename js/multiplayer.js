import * as THREE from 'three';
import { state } from './state.js';
import { spawnParticles, createLaserBeam, spawnLightBeam, spawnRocketFlame, spawnManeuveringBeam, createShockwave } from './particles.js';
import { respawnTarget } from './world.js';
import { resetHook } from './grapple.js';
import { processTargetHit, takePlayerDamage } from './main.js';
import {
    PROJECTILE_LIFETIME,
    NETWORK_TICK_MS,
    ROOM_CODE_LENGTH,
    PEER_Y_OFFSET,
    HIT_FLASH_DURATION_MS,
    PEER_BULLET_COLORS
} from './config.js';
import { buildGun, buildShotgun, buildAR, buildSniper, buildMinigun, buildBeanModel, SHARED_PROJECTILE_GEO } from './weapons.js';

const _stateEuler = new THREE.Euler();

// Module-level cached objects to prevent per-message heap allocations
const _boosterPos = new THREE.Vector3();
const _peerForward = new THREE.Vector3();
const _peerRight = new THREE.Vector3();
const _peerEuler = new THREE.Euler();
const _gunTip = new THREE.Vector3();
const _targetPos = new THREE.Vector3();
const _midPoint = new THREE.Vector3();
const _barrelPos = new THREE.Vector3();
const _dir = new THREE.Vector3();

// Gun tip offset constant matching grapple.js
const GUN_TIP_OFFSET = new THREE.Vector3(0, 0, -0.19);

// DOM caches
let inputUsernameEl = null;
let cachedUsername = 'Guest';

// Queries the TURN API server for dynamic TURN server configurations or falls back to public metered.ca servers.
async function getPeerConfig() {
    const config = {
        debug: 2,
        host: '0.peerjs.com',
        port: 443,
        path: '/',
        secure: true,
        config: {
            iceServers: [
                { urls: 'stun:stun.l.google.com:19302' },
                { urls: 'stun:stun1.l.google.com:19302' },
                { urls: 'stun:stun.cloudflare.com:3478' }
            ]
        }
    };

    try {
        const response = await fetch(`/api/turn?room=${state.roomCode || ''}`);
        if (response.ok) {
            const data = await response.json();
            if (data && data.iceServers) {
                config.config.iceServers = data.iceServers;
                console.log('Successfully loaded Cloudflare TURN servers.');
                return config;
            }
        }
    } catch (e) {
        console.warn('Failed to fetch Cloudflare TURN servers, using fallback ICE servers:', e);
    }

    // Fallback ICE/TURN servers if Cloudflare config is not set up or fails
    config.config.iceServers.push(
        {
            urls: 'turn:openrelay.metered.ca:80',
            username: 'openrelayproject',
            credential: 'openrelayproject'
        },
        {
            urls: 'turn:openrelay.metered.ca:443',
            username: 'openrelayproject',
            credential: 'openrelayproject'
        },
        {
            urls: 'turn:openrelay.metered.ca:443?transport=tcp',
            username: 'openrelayproject',
            credential: 'openrelayproject'
        }
    );
    return config;
}

// Direct helper to fetch or watch username input element changes
function getCachedUsername() {
    if (!inputUsernameEl) {
        inputUsernameEl = document.getElementById('input-username');
        if (inputUsernameEl) {
            inputUsernameEl.addEventListener('input', () => {
                cachedUsername = inputUsernameEl.value || 'Guest';
            });
            cachedUsername = inputUsernameEl.value || 'Guest';
        }
    }
    return cachedUsername;
}

export function broadcastToAll(packet, excludePeerId = null) {
    if (!state.isMultiplayer || state.connections.length === 0) return;
    state.connections.forEach((conn) => {
        if (conn.open && conn.peer !== excludePeerId) {
            try {
                conn.send(packet);
            } catch (err) {
                console.error(`Error broadcasting packet of type ${packet.type} to peer ${conn.peer}:`, err);
            }
        }
    });
}

export function flashPeerMesh(peerData, color = 0xff3333, durationMs = HIT_FLASH_DURATION_MS) {
    if (!peerData || !peerData.mesh) return;
    peerData.mesh.traverse((child) => {
        if (child.isMesh && child.material && child.material.color) {
            if (child.userData.originalColor === undefined) {
                child.userData.originalColor = child.material.color.getHex();
            }
            child.material.color.setHex(color);
        }
    });
    setTimeout(() => {
        if (!peerData || !peerData.mesh) return;
        peerData.mesh.traverse((child) => {
            if (child.isMesh && child.material && child.material.color && child.userData.originalColor !== undefined) {
                child.material.color.setHex(child.userData.originalColor);
            }
        });
    }, durationMs);
}

let peerInstance = null;
let lastSentTime = 0;

export function generateRoomCode() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Avoid confusing characters
    let code = '';
    for (let i = 0; i < ROOM_CODE_LENGTH; i++) {
        code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
}

// Initializes PeerJS as host, listens for incoming WebRTC client connections, and starts lobby listening.
export async function hostGame(username, roomCode) {
    state.isMultiplayer = true;
    state.isHost = true;
    state.roomCode = roomCode.toUpperCase();
    
    const hostPeerId = `testfps-room-${state.roomCode}`;
    const hostStatus = document.getElementById('host-lobby-status');

    if (peerInstance) {
        peerInstance.destroy();
    }

    const { Peer } = await import('peerjs');
    const activeConfig = await getPeerConfig();
    peerInstance = new Peer(hostPeerId, activeConfig);
    state.peer = peerInstance;

    peerInstance.on('open', (id) => {
        console.log('Host registered successfully on PeerJS with ID:', id);
        if (hostStatus) hostStatus.innerText = 'Waiting for players (1/5)...';
        const startBtn = document.getElementById('btn-host-start');
        if (startBtn) startBtn.style.display = 'inline-block';
    });

    peerInstance.on('connection', (conn) => {
        setupConnection(conn);
    });

    peerInstance.on('error', (err) => {
        console.error('Host peer error:', err);
        if (hostStatus) {
            if (err.type === 'unavailable-id') {
                hostStatus.innerText = 'Error: Code already in use! Please try again in 5 seconds.';
            } else {
                hostStatus.innerText = `Error: ${err.type}`;
            }
        }
        disconnectMultiplayer();
    });
}

// Initializes PeerJS as client and attempts connection to host player using room identifier.
export async function joinGame(username, roomCode) {
    state.isMultiplayer = true;
    state.isHost = false;
    state.roomCode = roomCode.toUpperCase();

    const joinError = document.getElementById('join-error-log');
    if (joinError) joinError.innerText = 'Connecting to server...';

    if (peerInstance) {
        peerInstance.destroy();
    }

    const { Peer } = await import('peerjs');
    const activeConfig = await getPeerConfig();
    peerInstance = new Peer(activeConfig);
    state.peer = peerInstance;

    peerInstance.on('open', (clientId) => {
        console.log('Client registered with ID:', clientId);
        if (joinError) joinError.innerText = `Searching room ${state.roomCode}...`;
        const hostPeerId = `testfps-room-${state.roomCode}`;
        const conn = peerInstance.connect(hostPeerId);

        setupConnection(conn);
    });

    peerInstance.on('error', (err) => {
        console.error('Client peer error:', err);
        if (joinError) {
            if (err.type === 'peer-unavailable') {
                joinError.innerText = 'Error: Room not found! Please check the code.';
            } else {
                joinError.innerText = `Error: ${err.type}`;
            }
        }
        disconnectMultiplayer();
    });
}

export function disconnectMultiplayer() {
    state.isMultiplayer = false;
    state.isHost = false;
    state.isPlaying = false;
    state.roomCode = null;
    state.kills = 0;
    state.deaths = 0;

    const pvpStats = document.getElementById('pvp-stats');
    if (pvpStats) pvpStats.style.display = 'none';

    if (state.connections.length > 0) {
        state.connections.forEach(conn => conn.close());
    }
    state.connections = [];

    if (peerInstance) {
        peerInstance.destroy();
        peerInstance = null;
        state.peer = null;
    }

    // Clean up peer meshes
    Object.keys(state.peers).forEach((peerId) => {
        removePeer(peerId);
    });
    state.peers = {};

    resetHook();

    const btnJoinConnect = document.getElementById('btn-join-connect');
    if (btnJoinConnect) {
        btnJoinConnect.innerText = 'Connect';
        btnJoinConnect.style.background = '';
        btnJoinConnect.disabled = false;
        btnJoinConnect.removeAttribute('data-connected');
    }
    const joinErrorLog = document.getElementById('join-error-log');
    if (joinErrorLog) {
        joinErrorLog.style.color = '';
        joinErrorLog.innerText = '';
    }
}

function showJoinError(msg) {
    const joinErrorLog = document.getElementById('join-error-log');
    if (joinErrorLog) {
        joinErrorLog.style.color = '#ff4757';
        joinErrorLog.innerText = msg;
    }
    const btnJoinConnect = document.getElementById('btn-join-connect');
    if (btnJoinConnect) {
        btnJoinConnect.innerText = 'Connect';
        btnJoinConnect.style.background = '';
        btnJoinConnect.disabled = false;
        btnJoinConnect.removeAttribute('data-connected');
    }
}

function setupConnection(conn) {
    let opened = false;

    // Timeout: if the DataChannel doesn't open within 10 seconds, surface an error
    const timeoutId = !state.isHost ? setTimeout(() => {
        if (!opened) {
            console.warn('Connection timed out — WebRTC DataChannel never opened.');
            showJoinError('Connection failed. Please check the code and try again.');
            disconnectMultiplayer();
        }
    }, 10000) : null;

    const handleOpen = () => {
        if (state.connections.includes(conn)) return;
        opened = true;
        if (timeoutId) clearTimeout(timeoutId);
        console.log('Direct WebRTC DataConnection open with peer:', conn.peer);
        state.connections.push(conn);

        if (state.isHost) {
            const hostStatus = document.getElementById('host-lobby-status');
            const currentPlayers = state.connections.length + 1;
            if (hostStatus) hostStatus.innerText = `Waiting for players (${currentPlayers}/5)...`;
        } else {
            const joinErrorLog = document.getElementById('join-error-log');
            if (joinErrorLog) {
                joinErrorLog.style.color = '#00ff88';
                joinErrorLog.innerText = 'Successfully connected!';
            }
            const btnJoinConnect = document.getElementById('btn-join-connect');
            if (btnJoinConnect) {
                btnJoinConnect.innerText = 'Join Game';
                btnJoinConnect.style.background = 'linear-gradient(135deg, #2ed573, #26af5f)';
                btnJoinConnect.disabled = false;
                btnJoinConnect.dataset.connected = 'true';
            }
        }
    };

    if (conn.open) {
        handleOpen();
    } else {
        conn.on('open', handleOpen);
    }

    conn.on('data', (data) => {
        handlePeerMessage(conn.peer, data);
    });

    conn.on('close', () => {
        console.log('Connection closed for peer:', conn.peer);
        const index = state.connections.indexOf(conn);
        if (index > -1) {
            state.connections.splice(index, 1);
        }

        removePeer(conn.peer);

        if (state.isHost) {
            const hostStatus = document.getElementById('host-lobby-status');
            const currentPlayers = state.connections.length + 1;
            if (hostStatus) hostStatus.innerText = `Waiting for players (${currentPlayers}/5)...`;
        } else {
            disconnectMultiplayer();
            state.controls.unlock();
            const blocker = document.getElementById('blocker');
            if (blocker) blocker.style.display = 'flex';
            const panels = ['panel-mp', 'panel-host-waiting', 'panel-join-room', 'panel-pause'];
            panels.forEach(id => { const el = document.getElementById(id); if (el) el.style.display = 'none'; });
            const panelMain = document.getElementById('panel-main');
            if (panelMain) panelMain.style.display = 'flex';
        }
    });

    conn.on('error', (err) => {
        console.error('DataConnection error:', err);
        if (!state.isHost) {
            showJoinError(`Connection error: ${err.type || err.message || 'unknown'}`);
            disconnectMultiplayer();
        }
    });
}

// Routes network packets, handles incoming player positions, syncs weapon changes, and spawns lasers/projectiles.
function handlePeerMessage(fromPeerId, msg) {
    if (!state.isMultiplayer) return;

    // Star-Topology Relay: Host broadcasts client messages in-place without reallocation
    if (state.isHost) {
        if (msg.type === 'update' || msg.type === 'fire' || msg.type === 'player_hit' || msg.type === 'player_died' || msg.type === 'jump') {
            msg.senderPeerId = fromPeerId;
            broadcastToAll(msg, fromPeerId);
        }
    }

    const senderId = msg.senderPeerId || fromPeerId;

    // Ignore game actions/updates if the local client is not yet active in the game world
    if (!state.isPlaying) return;

    if (msg.type === 'update') {
        // Retrieve or instantiate remote peer
        let peerData = state.peers[senderId];
        let justJoined = false;
        if (!peerData) {
            const username = msg.username || 'Guest';
            console.log(`Spawning remote peer bean model for: ${username}`);
            peerData = createPeerBean(username);
            state.peers[senderId] = peerData;
            justJoined = true;
        }

        // Apply position updates (with y-offset to align remote models with ground geometry)
        peerData.mesh.position.copy(msg.pos);
        peerData.mesh.position.y -= PEER_Y_OFFSET;
        peerData.mesh.rotation.y = msg.yaw;

        if (msg.isDead) {
            peerData.mesh.visible = false;
        } else {
            // If they just joined, play the spawn animation
            if (justJoined) {
                peerData.mesh.visible = true;
                spawnLightBeam(peerData.mesh.position);
            } else if (peerData.mesh.visible === false) {
                // If they were dead and are now alive (respawned!)
                peerData.mesh.visible = true;
                spawnLightBeam(peerData.mesh.position);
            }

            // Spawn hover thruster flame particles if active
            if (msg.isHovering) {
                _boosterPos.copy(peerData.mesh.position);
                _boosterPos.y -= 1.45;
                spawnRocketFlame(_boosterPos, 4, false);

                // Spawn maneuvering side thruster plumes if active keys are sent
                if (msg.hoverKeys) {
                    _peerEuler.set(0, msg.yaw, 0);
                    _peerForward.set(0, 0, -1).applyEuler(_peerEuler);
                    _peerRight.set(1, 0, 0).applyEuler(_peerEuler);

                    if (msg.hoverKeys.w) {
                        _peerForward.negate();
                        spawnManeuveringBeam(_boosterPos, 2, _peerForward);
                        _peerForward.negate(); // restore
                    }
                    if (msg.hoverKeys.s) spawnManeuveringBeam(_boosterPos, 2, _peerForward);
                    if (msg.hoverKeys.a) spawnManeuveringBeam(_boosterPos, 2, _peerRight);
                    if (msg.hoverKeys.d) {
                        _peerRight.negate();
                        spawnManeuveringBeam(_boosterPos, 2, _peerRight);
                    }
                }
            }
        }

        // Apply weapon rotations (aiming pitches)
        peerData.leftGun.rotation.x = msg.pitch;
        peerData.rightGunContainer.rotation.x = msg.pitch;

        // Toggle active weapon mesh visibility
        peerData.pistolMesh.visible = (msg.activeWeapon === 'PISTOL');
        peerData.shotgunMesh.visible = (msg.activeWeapon === 'SHOTGUN');
        peerData.arMesh.visible = (msg.activeWeapon === 'AR');
        peerData.sniperMesh.visible = (msg.activeWeapon === 'SNIPER');
        peerData.minigunMesh.visible = (msg.activeWeapon === 'MINIGUN');

        // Rotate remote peer minigun barrels if active and firing
        if (msg.activeWeapon === 'MINIGUN' && peerData.minigunMesh && peerData.minigunMesh.userData.barrels) {
            if (peerData.minigunRamp === undefined)      peerData.minigunRamp = 0.0;
            if (peerData.lastUpdateTime === undefined)   peerData.lastUpdateTime = performance.now();

            const now = performance.now();

            const dt = Math.min((now - peerData.lastUpdateTime) / 1000, 0.1);
            peerData.lastUpdateTime = now;

            if (msg.isMouseDown) {
                peerData.minigunRamp = Math.min(3.0, peerData.minigunRamp + dt);
            } else {
                peerData.minigunRamp = Math.max(0.0, peerData.minigunRamp - dt * 2.0);
            }
            
            const spinSpeed = (peerData.minigunRamp / 3.0) * 40.0 + (msg.isMouseDown ? 5.0 : 0.0);
            peerData.minigunMesh.userData.barrels.rotation.z += spinSpeed * dt;
        }

        // Draw remote grapple hook lines
        if (msg.hookState !== 'IDLE' && msg.hookPos) {
            if (!peerData.hookLine) {
                const hookGeo = new THREE.CylinderGeometry(0.035, 0.035, 1, 8);
                hookGeo.rotateX(Math.PI / 2);
                const hookMat = new THREE.MeshStandardMaterial({ 
                    color: 0x00aaff, 
                    roughness: 0.3,
                    metalness: 0.6
                });
                peerData.hookLine = new THREE.Mesh(hookGeo, hookMat);
                peerData.hookLine.castShadow = true;
                state.scene.add(peerData.hookLine);
            }

            peerData.leftGun.updateWorldMatrix(true, false);
            _gunTip.copy(GUN_TIP_OFFSET);
            peerData.leftGun.localToWorld(_gunTip);
            _targetPos.set(msg.hookPos.x, msg.hookPos.y, msg.hookPos.z);
            const distance = _gunTip.distanceTo(_targetPos);

            if (distance > 0.05) {
                _midPoint.addVectors(_gunTip, _targetPos).multiplyScalar(0.5);
                peerData.hookLine.position.copy(_midPoint);
                peerData.hookLine.scale.set(1, 1, distance);
                peerData.hookLine.lookAt(_targetPos);
                peerData.hookLine.visible = true;
            }
        } else {
            if (peerData.hookLine) {
                peerData.hookLine.visible = false;
            }
        }
    } else if (msg.type === 'fire') {
        // Visual gun recoil flash/explosion locally on peer's barrel
        _barrelPos.set(msg.barrelPos.x, msg.barrelPos.y, msg.barrelPos.z);
        _dir.set(msg.dir.x, msg.dir.y, msg.dir.z);

        if (msg.weapon === 'SNIPER') {
            const targetPos = _targetPos;
            if (msg.hitPoint) {
                targetPos.set(msg.hitPoint.x, msg.hitPoint.y, msg.hitPoint.z);
            } else {
                targetPos.copy(_barrelPos).addScaledVector(_dir, 500);
            }
            createLaserBeam(_barrelPos, targetPos, 0xffff00);

        } else {
            let bullet;
            const bulletColor = PEER_BULLET_COLORS[msg.weapon] ?? 0xffffff;

            if (state.projectilePool.length > 0) {
                bullet = state.projectilePool.pop();
                bullet.visible = true;
                bullet.material.color.setHex(bulletColor);
            } else {
                bullet = new THREE.Mesh(SHARED_PROJECTILE_GEO, new THREE.MeshBasicMaterial({ color: bulletColor }));
                bullet.userData = {};
            }

            bullet.position.copy(_barrelPos).addScaledVector(_dir, 0.1);
            bullet.userData.direction = _dir.clone();
            bullet.userData.age = 0;
            
            state.scene.add(bullet);
            state.projectiles.push(bullet);
        }
    } else if (msg.type === 'kill_target') {
        // Sync targets authoritatively as informed by the host
        const target = state.targets[msg.targetIndex];
        if (target) {
            const enemyColor = msg.color || 0xff4500;
            // Spawn explosions locally
            spawnParticles(target.position, enemyColor, 35, 30, 0.35, 15.0);

            // Spawn shockwave locally (using shared createShockwave function to prevent leaks)
            createShockwave(target.position, 8.0 * (msg.scale || 1.0), 0xffaa00);

            // Reposition and re-scale target
            target.position.set(msg.newPosition.x, msg.newPosition.y, msg.newPosition.z);
            target.userData.maxHp = msg.hp;
            target.userData.hp = msg.hp;
            target.userData.scale = msg.scale;
            target.userData.color = msg.color;
            target.userData.bodyMesh.material.color.setHex(msg.color);
            target.userData.bodyMesh.scale.set(msg.scale, msg.scale, msg.scale);
            target.userData.healthBarFg.scale.x = 1.0;
            target.userData.healthBarGroup.position.y = 1.6 * msg.scale;
            target.userData.healthBarGroup.scale.set(msg.scale, msg.scale, 1);

            state.score = msg.score;
            const scoreEl = document.getElementById('score');
            if (scoreEl) scoreEl.innerText = state.score;
        }
    } else if (msg.type === 'hit_target') {
        if (state.isMultiplayer && state.isHost) {
            processTargetHit(msg.targetIndex, msg.damage);
        }
    } else if (msg.type === 'player_hit') {
        const targetPeer = state.peers[msg.targetPeerId];
        if (targetPeer) {
            flashPeerMesh(targetPeer, 0xff3333, 150);
        }
        if (msg.targetPeerId === state.peer.id) {
            takePlayerDamage(msg.damage, msg.attackerName);
        }
    } else if (msg.type === 'player_died') {
        // Spawn remote player death particle effect (bean color purple 0x8c7ae6) and hide model
        const victimPeer = state.peers[msg.victimPeerId || senderId];
        if (victimPeer && victimPeer.mesh) {
            spawnParticles(victimPeer.mesh.position, 0x8c7ae6, 40, 30, 0.4, 18.0);
            victimPeer.mesh.visible = false;
        }

        const myName = getCachedUsername();
        if (msg.killerName === myName) {
            state.kills++;
            const killsEl = document.getElementById('kills');
            if (killsEl) killsEl.innerText = state.kills;
            
            // Spawn visual hit indicator green flash on crosshair
            const crosshair = document.getElementById('crosshair');
            if (crosshair) {
                crosshair.style.borderColor = '#00ff88';
                crosshair.style.transform = 'translate(-50%, -50%) scale(1.5)';
                setTimeout(() => {
                    crosshair.style.borderColor = '#ff0055';
                    crosshair.style.transform = 'translate(-50%, -50%) scale(1.0)';
                }, 180);
            }
        }
    } else if (msg.type === 'jump') {
        const peerData = state.peers[senderId];
        if (peerData && peerData.mesh && peerData.mesh.visible) {
            _boosterPos.copy(peerData.mesh.position);
            _boosterPos.y -= 1.45;
            spawnRocketFlame(_boosterPos, 50, true);
            createShockwave(_boosterPos, 15.0);
        }
    }
}

function removePeer(peerId) {
    const peerData = state.peers[peerId];
    if (peerData) {
        if (peerData.mesh) {
            state.scene.remove(peerData.mesh);
            // Dispose geometries/materials, including SpriteMaterial and CanvasTexture to resolve leaks
            peerData.mesh.traverse((child) => {
                if (child.isMesh) {
                    child.geometry?.dispose();
                    child.material?.dispose();
                }
                if (child.isSprite) {
                    child.material?.map?.dispose();
                    child.material?.dispose();
                }
            });
        }
        if (peerData.hookLine) {
            state.scene.remove(peerData.hookLine);
            peerData.hookLine.geometry?.dispose();
            peerData.hookLine.material?.dispose();
        }
        delete state.peers[peerId];
        console.log(`Disposed remote peer mesh for: ${peerId}`);
    }
}

// Serializes and transmits local player state vectors (position, yaw, pitch, weapon, hover keys) to everyone.
export function sendLocalState() {
    if (!state.isMultiplayer || !state.isPlaying || state.connections.length === 0 || !state.controls) return;

    const now = performance.now();
    if (now - lastSentTime < NETWORK_TICK_MS) return; // Cap at ~30 packets per second to conserve bandwidth
    lastSentTime = now;

    const playerObj = state.controls.getObject();
    const camEuler = _stateEuler.setFromQuaternion(state.camera.quaternion, 'YXZ');

    const username = getCachedUsername();

    const packet = {
        type: 'update',
        username: username,
        pos: { x: playerObj.position.x, y: playerObj.position.y, z: playerObj.position.z },
        yaw: camEuler.y,
        pitch: camEuler.x,
        activeWeapon: state.activeWeaponName,
        isMouseDown: state.isMouseDown,
        isDead: state.playerHp <= 0,
        hookState: state.hookState,
        hookPos: state.hookState !== 'IDLE' ? { x: state.hookPosition.x, y: state.hookPosition.y, z: state.hookPosition.z } : null,
        isHovering: state.isHovering,
        hoverKeys: state.isHovering ? {
            w: state.moveForward,
            s: state.moveBackward,
            a: state.moveLeft,
            d: state.moveRight
        } : null
    };

    broadcastToAll(packet);
}

export function broadcastLocalFire(barrelPos, dir, hitPoint = null) {
    if (!state.isMultiplayer || state.connections.length === 0) return;

    const packet = {
        type: 'fire',
        weapon: state.activeWeaponName,
        barrelPos: { x: barrelPos.x, y: barrelPos.y, z: barrelPos.z },
        dir: { x: dir.x, y: dir.y, z: dir.z }
    };

    if (hitPoint) {
        packet.hitPoint = { x: hitPoint.x, y: hitPoint.y, z: hitPoint.z };
    }

    broadcastToAll(packet);
}

export function broadcastTargetKill(targetIndex, score, newPos, targetData) {
    if (!state.isMultiplayer || !state.isHost || state.connections.length === 0) return;

    const packet = {
        type: 'kill_target',
        targetIndex: targetIndex,
        score: score,
        newPosition: { x: newPos.x, y: newPos.y, z: newPos.z },
        scale: targetData.scale,
        hp: targetData.hp,
        color: targetData.color
    };

    broadcastToAll(packet);
}

export function broadcastLocalJump() {
    if (!state.isMultiplayer || state.connections.length === 0) return;
    const packet = {
        type: 'jump'
    };
    broadcastToAll(packet);
}

// Spawns remote player bean visual components (cylinder body, sphere heads, visor strips, akimbo attachments, username tags).
function createPeerBean(username) {
    // Import and reuse shared buildBeanModel factory from weapons.js
    const peerGroup = buildBeanModel(0x8c7ae6, 0xff4757);

    // Build remote peer weapons (Akimbo attachments) using imported builders from weapons.js
    const leftGun = buildGun(0x00aaff);
    leftGun.position.set(-0.7, 0.0, -0.5);
    peerGroup.add(leftGun);

    const rightGunContainer = new THREE.Group();
    rightGunContainer.position.set(0.7, 0.0, -0.5);
    peerGroup.add(rightGunContainer);

    const pistolMesh = buildGun(0xff0055);
    rightGunContainer.add(pistolMesh);

    const shotgunMesh = buildShotgun();
    shotgunMesh.visible = false;
    rightGunContainer.add(shotgunMesh);

    const arMesh = buildAR();
    arMesh.visible = false;
    rightGunContainer.add(arMesh);

    const sniperMesh = buildSniper();
    sniperMesh.visible = false;
    rightGunContainer.add(sniperMesh);

    const minigunMesh = buildMinigun();
    minigunMesh.visible = false;
    rightGunContainer.add(minigunMesh);

    // Sprite username text label
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 64;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
    ctx.fillRect(0, 0, 256, 64);
    ctx.font = 'bold 24px Segoe UI, Arial';
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    ctx.fillText(username, 128, 40);
    
    const spriteMat = new THREE.SpriteMaterial({ 
        map: new THREE.CanvasTexture(canvas), 
        transparent: true 
    });
    const nameSprite = new THREE.Sprite(spriteMat);
    nameSprite.position.set(0, 1.6, 0);
    nameSprite.scale.set(3, 0.75, 1);
    peerGroup.add(nameSprite);

    state.scene.add(peerGroup);
    peerGroup.scale.set(1.5, 1.5, 1.5);

    return {
        mesh: peerGroup,
        leftGun: leftGun,
        rightGunContainer: rightGunContainer,
        pistolMesh: pistolMesh,
        shotgunMesh: shotgunMesh,
        arMesh: arMesh,
        sniperMesh: sniperMesh,
        minigunMesh: minigunMesh,
        hookLine: null
    };
}
