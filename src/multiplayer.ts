import * as THREE from 'three';
import { state, type PeerData } from './state.js';
import { spawnParticles, createLaserBeam, spawnLightBeam, spawnRocketFlame, spawnManeuveringBeam, createShockwave } from './particles.js';
import { rebuildTargetHash } from './world.js';
import { resetHook, GUN_TIP_OFFSET } from './grapple.js';
import { processTargetHit, takePlayerDamage } from './damage.js';
import {
    PROJECTILE_LIFETIME,
    NETWORK_TICK_MS,
    ROOM_CODE_LENGTH,
    PEER_Y_OFFSET,
    HIT_FLASH_DURATION_MS,
    WEAPON_STATS,
    MAX_PROJECTILES
} from './config.js';
import { buildGun, buildShotgun, buildAR, buildSniper, buildMinigun, buildBeanModel, isSharedGeometry, SHARED_BODY_MAT, SHARED_PROJECTILE_GEO } from './weapons.js';
import type { FirePacket, JumpPacket, KillTargetPacket, NetworkPacket, UpdatePacket } from './networkTypes.js';
import { projectileData, targetData, type TargetUserData } from './userDataTypes.js';

const _stateEuler = new THREE.Euler();

// Scratch objects reused while applying remote packets.
const _boosterPos = new THREE.Vector3();
const _peerForward = new THREE.Vector3();
const _peerRight = new THREE.Vector3();
const _peerEuler = new THREE.Euler();
const _gunTip = new THREE.Vector3();
const _targetPos = new THREE.Vector3();
const _midPoint = new THREE.Vector3();
const _barrelPos = new THREE.Vector3();
const _dir = new THREE.Vector3();

const SHARED_HOOK_GEO = new THREE.CylinderGeometry(0.035, 0.035, 1, 8);
SHARED_HOOK_GEO.rotateX(Math.PI / 2);
const SHARED_HOOK_MAT = new THREE.MeshStandardMaterial({
    color: 0x00aaff,
    roughness: 0.3,
    metalness: 0.6
});

export interface PeerJSConfig {
    debug: number;
    host: string;
    port: number;
    path: string;
    secure: boolean;
    config: { iceServers: RTCIceServer[] };
}

// Lazily cached menu/HUD elements touched by networking callbacks.
const UI = {
    inputUsername: null as HTMLInputElement | null,
    hostLobbyStatus: null as HTMLElement | null,
    btnHostStart: null as HTMLButtonElement | null,
    joinErrorLog: null as HTMLElement | null,
    pvpStats: null as HTMLElement | null,
    btnJoinConnect: null as HTMLButtonElement | null,
    blocker: null as HTMLElement | null,
    panelMain: null as HTMLElement | null,
    score: null as HTMLElement | null,
    kills: null as HTMLElement | null,
    crosshair: null as HTMLElement | null,
};

const DOM = {
    inputUsername: () => (UI.inputUsername || (UI.inputUsername = document.getElementById('input-username') as HTMLInputElement | null)),
    hostLobbyStatus: () => (UI.hostLobbyStatus || (UI.hostLobbyStatus = document.getElementById('host-lobby-status'))),
    btnHostStart: () => (UI.btnHostStart || (UI.btnHostStart = document.getElementById('btn-host-start') as HTMLButtonElement | null)),
    joinErrorLog: () => (UI.joinErrorLog || (UI.joinErrorLog = document.getElementById('join-error-log'))),
    pvpStats: () => (UI.pvpStats || (UI.pvpStats = document.getElementById('pvp-stats'))),
    btnJoinConnect: () => (UI.btnJoinConnect || (UI.btnJoinConnect = document.getElementById('btn-join-connect') as HTMLButtonElement | null)),
    blocker: () => (UI.blocker || (UI.blocker = document.getElementById('blocker'))),
    panelMain: () => (UI.panelMain || (UI.panelMain = document.getElementById('panel-main'))),
    score: () => (UI.score || (UI.score = document.getElementById('score'))),
    kills: () => (UI.kills || (UI.kills = document.getElementById('kills'))),
    crosshair: () => (UI.crosshair || (UI.crosshair = document.getElementById('crosshair'))),
};

let cachedUsername = 'Guest';

// Try project-provided ICE servers first, then fall back to public relay/STUN
// entries so multiplayer can still work in local/dev setups.
async function getPeerConfig(): Promise<PeerJSConfig> {
    const config: PeerJSConfig = {
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

function getCachedUsername(): string {
    const inputUsernameEl = DOM.inputUsername();
    if (inputUsernameEl && cachedUsername === 'Guest') {
        inputUsernameEl.addEventListener('input', () => {
            cachedUsername = inputUsernameEl.value || 'Guest';
        });
        cachedUsername = inputUsernameEl.value || 'Guest';
    }
    return cachedUsername;
}

export function broadcastToAll(packet: NetworkPacket, excludePeerId: string | null = null): void {
    if (!state.isMultiplayer || state.connections.length === 0) return;
    const connLen = state.connections.length;
    for (let i = 0; i < connLen; i++) {
        const conn = state.connections[i];
        if (conn.open && conn.peer !== excludePeerId) {
            try {
                conn.send(packet);
            } catch (err) {
                console.error(`Error broadcasting packet of type ${packet.type} to peer ${conn.peer}:`, err);
                try {
                    conn.close();
                } catch (closeErr) {
                }
            }
        }
    }
}

export function flashPeerMesh(peerData: any, color = 0xff3333, durationMs = HIT_FLASH_DURATION_MS): void {
    if (!peerData || !peerData.mesh) return;
    peerData.mesh.traverse((child: any) => {
        if (child.isMesh && child.material && child.material.color) {
            if (child.material === SHARED_BODY_MAT) {
                child.material = SHARED_BODY_MAT.clone();
            }
            if (child.userData.originalColor === undefined) {
                child.userData.originalColor = child.material.color.getHex();
            }
            child.material.color.setHex(color);
        }
    });
    setTimeout(() => {
        if (!peerData || !peerData.mesh) return;
        peerData.mesh.traverse((child: any) => {
            if (child.isMesh && child.material && child.material.color && child.userData.originalColor !== undefined) {
                child.material.color.setHex(child.userData.originalColor);
            }
        });
    }, durationMs);
}

let peerInstance: any = null;
let lastSentTime = 0;
let lastForceSendTime = 0;
let lastSentSnapshot: {
    x: number;
    y: number;
    z: number;
    yaw: number;
    pitch: number;
    weapon: string;
    flags: number;
    hookX: number;
    hookY: number;
    hookZ: number;
} | null = null;

export function generateRoomCode(): string {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';
    for (let i = 0; i < ROOM_CODE_LENGTH; i++) {
        code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
}

// The host owns the stable room peer ID. Clients connect to that ID, and the
// host relays client packets to the rest of the room.
export async function hostGame(username: string, roomCode: string): Promise<void> {
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

    peerInstance.on('open', (id: string) => {
        console.log('Host registered successfully on PeerJS with ID:', id);
        if (hostStatus) hostStatus.innerText = 'Waiting for players (1/5)...';
        const startBtn = document.getElementById('btn-host-start');
        if (startBtn) startBtn.style.display = 'inline-block';
    });

    peerInstance.on('connection', (conn: any) => {
        setupConnection(conn);
    });

    peerInstance.on('error', (err: any) => {
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

export async function joinGame(username: string, roomCode: string): Promise<void> {
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

    peerInstance.on('open', (clientId: string) => {
        console.log('Client registered with ID:', clientId);
        if (joinError) joinError.innerText = `Searching room ${state.roomCode}...`;
        const hostPeerId = `testfps-room-${state.roomCode}`;
        const conn = peerInstance.connect(hostPeerId);

        setupConnection(conn);
    });

    peerInstance.on('error', (err: any) => {
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

export function disconnectMultiplayer(): void {
    state.isMultiplayer = false;
    state.isHost = false;
    state.isPlaying = false;
    state.roomCode = null;
    state.kills = 0;
    state.deaths = 0;
    lastSentSnapshot = null;
    lastSentTime = 0;
    lastForceSendTime = 0;

    const pvpStats = DOM.pvpStats();
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

    Object.keys(state.peers).forEach((peerId) => {
        removePeer(peerId);
    });
    state.peers = {};
    state.peerIds = [];

    resetHook();

    const btnJoinConnect = DOM.btnJoinConnect();
    if (btnJoinConnect) {
        btnJoinConnect.innerText = 'Connect';
        btnJoinConnect.style.background = '';
        btnJoinConnect.disabled = false;
        btnJoinConnect.removeAttribute('data-connected');
    }
    const joinErrorLog = DOM.joinErrorLog();
    if (joinErrorLog) {
        joinErrorLog.style.color = '';
        joinErrorLog.innerText = '';
    }
}

function showJoinError(msg: string): void {
    const joinErrorLog = document.getElementById('join-error-log');
    if (joinErrorLog) {
        joinErrorLog.style.color = '#ff4757';
        joinErrorLog.innerText = msg;
    }
    const btnJoinConnect = document.getElementById('btn-join-connect') as HTMLButtonElement | null;
    if (btnJoinConnect) {
        btnJoinConnect.innerText = 'Connect';
        btnJoinConnect.style.background = '';
        btnJoinConnect.disabled = false;
        btnJoinConnect.removeAttribute('data-connected');
    }
}

function setupConnection(conn: any): void {
    let opened = false;

    // PeerJS can resolve a peer ID before the WebRTC DataChannel is usable.
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
            const hostStatus = DOM.hostLobbyStatus();
            if (hostStatus) hostStatus.innerText = `Waiting for players (${state.connections.length + 1}/5)...`;
        } else {
            const joinErrorLog = document.getElementById('join-error-log');
            if (joinErrorLog) {
                joinErrorLog.style.color = '#00ff88';
                joinErrorLog.innerText = 'Successfully connected!';
            }
            const btnJoinConnect = document.getElementById('btn-join-connect') as HTMLButtonElement | null;
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

    conn.on('data', (data: NetworkPacket) => {
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
            const hostStatus = DOM.hostLobbyStatus();
            const currentPlayers = state.connections.length + 1;
            if (hostStatus) hostStatus.innerText = `Waiting for players (${currentPlayers}/5)...`;
        } else {
            disconnectMultiplayer();
            if (state.controls) state.controls.unlock();
            const blocker = DOM.blocker();
            if (blocker) blocker.style.display = 'flex';
            const panels = ['panel-mp', 'panel-host-waiting', 'panel-join-room', 'panel-pause'];
            panels.forEach(id => { const el = document.getElementById(id); if (el) el.style.display = 'none'; });
            const panelMain = DOM.panelMain();
            if (panelMain) panelMain.style.display = 'flex';
        }
    });

    conn.on('error', (err: any) => {
        console.error('DataConnection error:', err);
        if (!state.isHost) {
            showJoinError(`Connection error: ${err.type || err.message || 'unknown'}`);
            disconnectMultiplayer();
        }
    });
}

// Packet router. The host is authoritative for target health/respawns and also
// relays client gameplay packets in a star topology.
function handlePeerMessage(fromPeerId: string, msg: NetworkPacket): void {
    if (!state.isMultiplayer) return;

    if (state.isHost) {
        if (msg.type === 'update' || msg.type === 'fire' || msg.type === 'player_hit' || msg.type === 'player_died' || msg.type === 'jump') {
            msg.senderPeerId = fromPeerId;
            broadcastToAll(msg, fromPeerId);
        }
    }

    const senderId = msg.senderPeerId || fromPeerId;

    if (!state.isPlaying) return;

    if (msg.type === 'update') {
        let peerData = state.peers[senderId] as PeerData | undefined;
        let justJoined = false;
        if (!peerData) {
            const username = msg.username || 'Guest';
            console.log(`Spawning remote peer bean model for: ${username}`);
            peerData = createPeerBean(username);
            state.peers[senderId] = peerData;
            state.peerIds = Object.keys(state.peers);
            justJoined = true;
        }

        _targetPos.set(msg.pos.x, msg.pos.y - PEER_Y_OFFSET, msg.pos.z);
        peerData.targetPosition.copy(_targetPos);
        peerData.targetYaw = msg.yaw;
        if (justJoined) {
            peerData.mesh.position.copy(peerData.targetPosition);
            peerData.mesh.rotation.y = msg.yaw;
        }

        if (msg.isDead) {
            peerData.mesh.visible = false;
        } else {
            if (justJoined) {
                peerData.mesh.visible = true;
                spawnLightBeam(peerData.mesh.position);
            } else if (peerData.mesh.visible === false) {
                peerData.mesh.visible = true;
                spawnLightBeam(peerData.mesh.position);
            }

            if (msg.isHovering) {
                _boosterPos.copy(peerData.mesh.position);
                _boosterPos.y -= 1.45;
                spawnRocketFlame(_boosterPos, 4, false);

                if (msg.hoverKeys) {
                    _peerEuler.set(0, msg.yaw, 0);
                    _peerForward.set(0, 0, -1).applyEuler(_peerEuler);
                    _peerRight.set(1, 0, 0).applyEuler(_peerEuler);

                    if (msg.hoverKeys.w) {
                        _peerForward.negate();
                        spawnManeuveringBeam(_boosterPos, 2, _peerForward);
                        _peerForward.negate();
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

        peerData.leftGun.rotation.x = msg.pitch;
        peerData.rightGunContainer.rotation.x = msg.pitch;

        peerData.pistolMesh.visible = (msg.activeWeapon === 'PISTOL');
        peerData.shotgunMesh.visible = (msg.activeWeapon === 'SHOTGUN');
        peerData.arMesh.visible = (msg.activeWeapon === 'AR');
        peerData.sniperMesh.visible = (msg.activeWeapon === 'SNIPER');
        peerData.minigunMesh.visible = (msg.activeWeapon === 'MINIGUN');

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

        if (msg.hookState !== 'IDLE' && msg.hookPos) {
            if (!peerData.hookLine) {
                peerData.hookLine = new THREE.Mesh(SHARED_HOOK_GEO, SHARED_HOOK_MAT);
                peerData.hookLine.castShadow = true;
                state.scene!.add(peerData.hookLine);
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
            if (state.projectiles.length >= MAX_PROJECTILES) return;

            let bullet: THREE.Mesh;
            const bulletColor = WEAPON_STATS[msg.weapon as string]?.bulletColor ?? 0xffffff;

            if (state.projectilePool.length > 0) {
                bullet = state.projectilePool.pop() as THREE.Mesh;
                bullet.visible = true;
                (bullet.material as THREE.MeshBasicMaterial).color.setHex(bulletColor);
            } else {
                bullet = new THREE.Mesh(SHARED_PROJECTILE_GEO, new THREE.MeshBasicMaterial({ color: bulletColor }));
                bullet.userData = {};
            }

            bullet.position.copy(_barrelPos).addScaledVector(_dir, 0.1);
            const data = projectileData(bullet);
            data.dx = _dir.x;
            data.dy = _dir.y;
            data.dz = _dir.z;
            data.age = 0;
            data.visualOnly = true;
            data.damage = undefined;
            
            state.scene!.add(bullet);
            state.projectiles.push(bullet);
        }
    } else if (msg.type === 'kill_target') {
        // Host broadcast: all clients apply the same target respawn and score.
        const target = state.targets[msg.targetIndex];
        if (target) {
            const enemyColor = msg.color || 0xff4500;
            spawnParticles(target.position, enemyColor, 35, 30, 0.35, 15.0);

            createShockwave(target.position, 8.0 * (msg.scale || 1.0), 0xffaa00);

            target.position.set(msg.newPosition.x, msg.newPosition.y, msg.newPosition.z);
            const data = targetData(target);
            data.maxHp = msg.hp;
            data.hp = msg.hp;
            data.scale = msg.scale;
            data.color = msg.color;
            (data.bodyMesh.material as THREE.MeshStandardMaterial).color.setHex(msg.color);
            data.bodyMesh.scale.set(msg.scale, msg.scale, msg.scale);
            data.healthBarFg.scale.x = 1.0;
            data.healthBarGroup.position.y = 1.6 * msg.scale;
            data.healthBarGroup.scale.set(msg.scale, msg.scale, 1);
            rebuildTargetHash();

            state.score = msg.score;
            const scoreEl = document.getElementById('score');
            if (scoreEl) scoreEl.innerText = state.score.toString();
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
        if (state.peer && msg.targetPeerId === state.peer.id) {
            takePlayerDamage(msg.damage, msg.attackerName);
        }
    } else if (msg.type === 'player_died') {
        const victimPeer = state.peers[msg.victimPeerId || senderId];
        if (victimPeer && victimPeer.mesh) {
            spawnParticles(victimPeer.mesh.position, 0x8c7ae6, 40, 30, 0.4, 18.0);
            victimPeer.mesh.visible = false;
        }

        const myName = getCachedUsername();
        if (msg.killerName === myName) {
            state.kills++;
            const killsEl = DOM.kills();
            if (killsEl) killsEl.innerText = state.kills.toString();
            
            const crosshair = DOM.crosshair();
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

// Peer avatars own cloned weapon/name-tag resources, so leaving a room must
// dispose those objects instead of only removing them from the scene.
function removePeer(peerId: string): void {
    const peerData = state.peers[peerId];
    if (peerData) {
        if (peerData.mesh) {
            state.scene!.remove(peerData.mesh);
            peerData.mesh.traverse((child: any) => {
                if (child.isMesh) {
                    if (child.geometry && !isSharedGeometry(child.geometry)) {
                        child.geometry.dispose();
                    }
                    if (child.material && child.material !== SHARED_BODY_MAT) {
                        child.material.dispose();
                    }
                }
                if (child.isSprite) {
                    child.material?.map?.dispose();
                    child.material?.dispose();
                }
            });
        }
        if (peerData.hookLine) {
            state.scene!.remove(peerData.hookLine);
        }
        delete state.peers[peerId];
        state.peerIds = Object.keys(state.peers);
        console.log(`Disposed remote peer mesh for: ${peerId}`);
    }
}

export function sendLocalState(): void {
    if (!state.isMultiplayer || !state.isPlaying || state.connections.length === 0 || !state.controls || !state.camera) return;

    const now = performance.now();
    if (now - lastSentTime < NETWORK_TICK_MS) return;

    const playerObj = state.controls.getObject();
    const camEuler = _stateEuler.setFromQuaternion(state.camera.quaternion, 'YXZ');

    const username = getCachedUsername();
    const q2 = (value: number) => Math.round(value * 100) / 100;
    const q3 = (value: number) => Math.round(value * 1000) / 1000;
    const flags =
        (state.isMouseDown ? 1 : 0) |
        (state.playerHp <= 0 ? 2 : 0) |
        (state.isHovering ? 4 : 0) |
        (state.moveForward ? 8 : 0) |
        (state.moveBackward ? 16 : 0) |
        (state.moveLeft ? 32 : 0) |
        (state.moveRight ? 64 : 0);

    const pos = playerObj.position;
    const hookX = state.hookState !== 'IDLE' ? q2(state.hookPosition.x) : 0;
    const hookY = state.hookState !== 'IDLE' ? q2(state.hookPosition.y) : 0;
    const hookZ = state.hookState !== 'IDLE' ? q2(state.hookPosition.z) : 0;
    const snapshot = {
        x: q2(pos.x),
        y: q2(pos.y),
        z: q2(pos.z),
        yaw: q3(camEuler.y),
        pitch: q3(camEuler.x),
        weapon: state.activeWeaponName,
        flags,
        hookX,
        hookY,
        hookZ
    };

    const changed = !lastSentSnapshot ||
        Math.abs(snapshot.x - lastSentSnapshot.x) > 0.01 ||
        Math.abs(snapshot.y - lastSentSnapshot.y) > 0.01 ||
        Math.abs(snapshot.z - lastSentSnapshot.z) > 0.01 ||
        Math.abs(snapshot.yaw - lastSentSnapshot.yaw) > 0.002 ||
        Math.abs(snapshot.pitch - lastSentSnapshot.pitch) > 0.002 ||
        snapshot.weapon !== lastSentSnapshot.weapon ||
        snapshot.flags !== lastSentSnapshot.flags ||
        snapshot.hookX !== lastSentSnapshot.hookX ||
        snapshot.hookY !== lastSentSnapshot.hookY ||
        snapshot.hookZ !== lastSentSnapshot.hookZ;

    if (!changed && now - lastForceSendTime < 250) return;
    lastSentTime = now;
    lastForceSendTime = now;
    lastSentSnapshot = snapshot;

    const packet: UpdatePacket = {
        type: 'update',
        username: username,
        pos: { x: snapshot.x, y: snapshot.y, z: snapshot.z },
        yaw: snapshot.yaw,
        pitch: snapshot.pitch,
        activeWeapon: state.activeWeaponName,
        isMouseDown: state.isMouseDown,
        isDead: state.playerHp <= 0,
        hookState: state.hookState,
        hookPos: state.hookState !== 'IDLE' ? { x: hookX, y: hookY, z: hookZ } : null,
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

export function updateRemotePeers(delta: number): void {
    if (!state.isMultiplayer) return;

    const peerIds = state.peerIds;
    const alpha = 1 - Math.exp(-14 * delta);

    for (let i = 0; i < peerIds.length; i++) {
        const peerData = state.peers[peerIds[i]];
        if (!peerData) continue;

        peerData.mesh.position.lerp(peerData.targetPosition, alpha);

        const currentYaw = peerData.mesh.rotation.y;
        let yawDelta = peerData.targetYaw - currentYaw;
        yawDelta = Math.atan2(Math.sin(yawDelta), Math.cos(yawDelta));
        peerData.mesh.rotation.y = currentYaw + yawDelta * alpha;
    }
}

export function broadcastLocalFire(barrelPos: THREE.Vector3, dir: THREE.Vector3, hitPoint: THREE.Vector3 | null = null): void {
    if (!state.isMultiplayer || state.connections.length === 0) return;

    const packet: FirePacket = {
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

export function broadcastTargetKill(targetIndex: number, score: number, newPos: THREE.Vector3, data: TargetUserData): void {
    if (!state.isMultiplayer || !state.isHost || state.connections.length === 0) return;

    const packet: KillTargetPacket = {
        type: 'kill_target',
        targetIndex: targetIndex,
        score: score,
        newPosition: { x: newPos.x, y: newPos.y, z: newPos.z },
        scale: data.scale,
        hp: data.hp,
        color: data.color
    };

    broadcastToAll(packet);
}

export function broadcastLocalJump(): void {
    if (!state.isMultiplayer || state.connections.length === 0) return;
    const packet: JumpPacket = {
        type: 'jump'
    };
    broadcastToAll(packet);
}

// Remote players use the same bean/weapon builders as the local player, but with
// a canvas-generated name tag attached as a Sprite.
function createPeerBean(username: string): PeerData {
    if (!state.scene) throw new Error('Scene not initialized');

    const peerGroup = buildBeanModel(0x8c7ae6, 0xff4757);

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

    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 64;
    const ctx = canvas.getContext('2d');
    if (ctx) {
        ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
        ctx.fillRect(0, 0, 256, 64);
        ctx.font = 'bold 24px Segoe UI, Arial';
        ctx.fillStyle = '#ffffff';
        ctx.textAlign = 'center';
        ctx.fillText(username, 128, 40);
    }
    
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
        targetPosition: peerGroup.position.clone(),
        targetYaw: 0,
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
