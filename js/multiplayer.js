import * as THREE from 'three';
import { state } from './state.js';
import { spawnParticles } from './particles.js';
import { respawnTarget } from './world.js';
import { resetHook } from './grapple.js';
import { PROJECTILE_LIFETIME } from './config.js';

let peerInstance = null;
let lastSentTime = 0;

export function generateRoomCode() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Avoid confusing characters
    let code = '';
    for (let i = 0; i < 4; i++) {
        code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
}

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
    
    const peerConfig = {
        debug: 2, // Prints warnings and errors in developer console
        config: {
            iceServers: [
                { urls: 'stun:stun.l.google.com:19302' },
                { urls: 'stun:stun1.l.google.com:19302' },
                { urls: 'stun:stun2.l.google.com:19302' },
                { urls: 'stun:stun.cloudflare.com:3478' }
            ]
        }
    };

    peerInstance = new Peer(hostPeerId, peerConfig);
    state.peer = peerInstance;

    peerInstance.on('open', (id) => {
        console.log('Host registered successfully on PeerJS with ID:', id);
        if (hostStatus) hostStatus.innerText = 'Warte auf Mitspieler (1/5)...';
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
                hostStatus.innerText = 'Fehler: Code bereits belegt! Bitte versuche es in 5 Sekunden erneut.';
            } else {
                hostStatus.innerText = `Fehler: ${err.type}`;
            }
        }
        disconnectMultiplayer();
    });
}

export async function joinGame(username, roomCode) {
    state.isMultiplayer = true;
    state.isHost = false;
    state.roomCode = roomCode.toUpperCase();

    const joinError = document.getElementById('join-error-log');
    if (joinError) joinError.innerText = 'Verbinde mit Server...';

    if (peerInstance) {
        peerInstance.destroy();
    }

    const { Peer } = await import('peerjs');
    
    const peerConfig = {
        debug: 2, // Prints warnings and errors in developer console
        config: {
            iceServers: [
                { urls: 'stun:stun.l.google.com:19302' },
                { urls: 'stun:stun1.l.google.com:19302' },
                { urls: 'stun:stun2.l.google.com:19302' },
                { urls: 'stun:stun.cloudflare.com:3478' }
            ]
        }
    };

    peerInstance = new Peer(peerConfig);
    state.peer = peerInstance;

    peerInstance.on('open', (clientId) => {
        console.log('Client registered with ID:', clientId);
        if (joinError) joinError.innerText = `Suche Raum ${state.roomCode}...`;
        const hostPeerId = `testfps-room-${state.roomCode}`;
        const conn = peerInstance.connect(hostPeerId, {
            reliable: false
        });

        setupConnection(conn);
    });

    peerInstance.on('error', (err) => {
        console.error('Client peer error:', err);
        if (joinError) {
            if (err.type === 'peer-unavailable') {
                joinError.innerText = 'Fehler: Raum nicht gefunden! Überprüfe den Code.';
            } else {
                joinError.innerText = `Fehler: ${err.type}`;
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
}

function setupConnection(conn) {
    const handleOpen = () => {
        if (state.connections.includes(conn)) return; // Prevent duplicate additions
        console.log('Direct WebRTC DataConnection open with peer:', conn.peer);
        state.connections.push(conn);

        // If host, announce username and add connections
        if (state.isHost) {
            const hostStatus = document.getElementById('host-lobby-status');
            const currentPlayers = state.connections.length + 1;
            if (hostStatus) hostStatus.innerText = `Warte auf Mitspieler (${currentPlayers}/5)...`;
            
            // Send initial lobby info
            conn.send({
                type: 'lobby_welcome',
                roomCode: state.roomCode
            });
        } else {
            // Client: transition to play state!
            console.log('Client successfully connected to room, locking pointer controls!');
            state.isPlaying = true;
            const blocker = document.getElementById('blocker');
            if (blocker) blocker.style.display = 'none';
            state.controls.lock();
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
            if (hostStatus) hostStatus.innerText = `Warte auf Mitspieler (${currentPlayers}/5)...`;
        } else {
            // If the host disconnected, drop client back to menu
            disconnectMultiplayer();
            state.controls.unlock();
        }
    });

    conn.on('error', (err) => {
        console.error('DataConnection error:', err);
    });
}

function handlePeerMessage(peerId, msg) {
    if (!state.isMultiplayer) return;

    if (msg.type === 'update') {
        // Retrieve or instantiate remote peer
        let peerData = state.peers[peerId];
        if (!peerData) {
            const username = msg.username || 'Gast';
            console.log(`Spawning remote peer bean model for: ${username}`);
            peerData = createPeerBean(username);
            state.peers[peerId] = peerData;
        }

        // Apply position updates
        peerData.mesh.position.copy(msg.pos);
        peerData.mesh.rotation.y = msg.yaw;

        // Apply weapon rotations (aiming pitches)
        peerData.leftGun.rotation.x = msg.pitch;
        peerData.rightGunContainer.rotation.x = msg.pitch;

        // Toggle active weapon mesh visibility
        peerData.pistolMesh.visible = (msg.activeWeapon === 'PISTOL');
        peerData.shotgunMesh.visible = (msg.activeWeapon === 'SHOTGUN');
        peerData.arMesh.visible = (msg.activeWeapon === 'AR');

        // Draw remote grapple hook lines
        if (msg.hookState !== 'IDLE' && msg.hookPos) {
            if (!peerData.hookLine) {
                const hookGeo = new THREE.CylinderGeometry(0.08, 0.08, 1, 8);
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

            const gunTip = new THREE.Vector3();
            peerData.leftGun.getWorldPosition(gunTip);
            const targetPos = new THREE.Vector3(msg.hookPos.x, msg.hookPos.y, msg.hookPos.z);
            const distance = gunTip.distanceTo(targetPos);

            if (distance > 0.05) {
                const midPoint = new THREE.Vector3().addVectors(gunTip, targetPos).multiplyScalar(0.5);
                peerData.hookLine.position.copy(midPoint);
                peerData.hookLine.scale.set(1, 1, distance);
                peerData.hookLine.lookAt(targetPos);
                peerData.hookLine.visible = true;
            }
        } else {
            if (peerData.hookLine) {
                peerData.hookLine.visible = false;
            }
        }
    } else if (msg.type === 'fire') {
        // Visual gun recoil flash/explosion locally on peer's barrel
        const barrelPos = new THREE.Vector3(msg.barrelPos.x, msg.barrelPos.y, msg.barrelPos.z);
        const dir = new THREE.Vector3(msg.dir.x, msg.dir.y, msg.dir.z);

        // Spawn a tracer bullet locally
        let bullet;
        const bulletColor = msg.weapon === 'PISTOL' ? 0xff0055 : (msg.weapon === 'SHOTGUN' ? 0xffaa00 : 0x00ff88);

        if (state.projectilePool.length > 0) {
            bullet = state.projectilePool.pop();
            bullet.visible = true;
            bullet.material.color.setHex(bulletColor);
        } else {
            bullet = new THREE.Mesh(new THREE.SphereGeometry(0.07, 8, 8), new THREE.MeshBasicMaterial({ color: bulletColor }));
            bullet.userData = {};
        }

        bullet.position.copy(barrelPos).addScaledVector(dir, 0.1);
        bullet.userData.direction = dir.clone();
        bullet.userData.age = 0;
        
        state.scene.add(bullet);
        state.projectiles.push(bullet);
    } else if (msg.type === 'kill_target') {
        // Sync targets authoritatively as informed by the host
        const target = state.targets[msg.targetIndex];
        if (target) {
            const enemyColor = msg.color || 0xff4500;
            // Spawn explosions locally
            spawnParticles(target.position, enemyColor, 35, 30, 0.35, 15.0);

            // Spawn shockwave locally
            const shockwave = new THREE.Mesh(
                new THREE.SphereGeometry(1, 16, 16),
                new THREE.MeshBasicMaterial({ color: 0xffaa00, wireframe: true, transparent: true, opacity: 0.8 })
            );
            shockwave.position.copy(target.position);
            state.scene.add(shockwave);

            state.activeParticles.push({
                mesh: shockwave,
                velocity: new THREE.Vector3(0, 0, 0),
                gravity: 0,
                life: 0.35,
                maxLife: 0.35,
                isShockwave: true,
                targetScale: 8.0 * (msg.scale || 1.0)
            });

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
            import('./main.js').then((main) => {
                main.processTargetHit(msg.targetIndex, msg.damage);
            });
        }
    }
}

function removePeer(peerId) {
    const peerData = state.peers[peerId];
    if (peerData) {
        if (peerData.mesh) {
            state.scene.remove(peerData.mesh);
            // Dispose geometries/materials
            peerData.mesh.traverse((child) => {
                if (child.isMesh) {
                    child.geometry.dispose();
                    child.material.dispose();
                }
            });
        }
        if (peerData.hookLine) {
            state.scene.remove(peerData.hookLine);
            peerData.hookLine.geometry.dispose();
            peerData.hookLine.material.dispose();
        }
        delete state.peers[peerId];
        console.log(`Disposed remote peer mesh for: ${peerId}`);
    }
}

export function sendLocalState() {
    if (!state.isMultiplayer || state.connections.length === 0) return;

    const now = performance.now();
    if (now - lastSentTime < 33) return; // Cap at ~30 packets per second to conserve bandwidth
    lastSentTime = now;

    const playerObj = state.controls.getObject();
    const camEuler = new THREE.Euler().setFromQuaternion(state.camera.quaternion, 'YXZ');

    const username = document.getElementById('input-username').value || 'Gast';

    const packet = {
        type: 'update',
        username: username,
        pos: { x: playerObj.position.x, y: playerObj.position.y, z: playerObj.position.z },
        yaw: camEuler.y,
        pitch: camEuler.x,
        activeWeapon: state.activeWeaponName,
        hookState: state.hookState,
        hookPos: state.hookState !== 'IDLE' ? { x: state.hookPosition.x, y: state.hookPosition.y, z: state.hookPosition.z } : null
    };

    state.connections.forEach((conn) => {
        if (conn.open) {
            conn.send(packet);
        }
    });
}

export function broadcastLocalFire(barrelPos, dir) {
    if (!state.isMultiplayer || state.connections.length === 0) return;

    const packet = {
        type: 'fire',
        weapon: state.activeWeaponName,
        barrelPos: { x: barrelPos.x, y: barrelPos.y, z: barrelPos.z },
        dir: { x: dir.x, y: dir.y, z: dir.z }
    };

    state.connections.forEach((conn) => {
        if (conn.open) {
            conn.send(packet);
        }
    });
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

    state.connections.forEach((conn) => {
        if (conn.open) {
            conn.send(packet);
        }
    });
}

function createPeerBean(username) {
    const peerGroup = new THREE.Group();

    // Body: bean color (standard purple 0x8c7ae6 for remote players)
    const bodyMat = new THREE.MeshStandardMaterial({ 
        color: 0x8c7ae6, 
        roughness: 0.3,
        metalness: 0.2
    });

    const cylinderGeo = new THREE.CylinderGeometry(0.6, 0.6, 1.0, 16);
    const cylinder = new THREE.Mesh(cylinderGeo, bodyMat);
    cylinder.castShadow = true;
    cylinder.receiveShadow = true;
    peerGroup.add(cylinder);
    
    const sphereGeo = new THREE.SphereGeometry(0.6, 16, 16);
    
    const topSphere = new THREE.Mesh(sphereGeo, bodyMat);
    topSphere.position.y = 0.5;
    topSphere.castShadow = true;
    topSphere.receiveShadow = true;
    peerGroup.add(topSphere);
    
    const bottomSphere = new THREE.Mesh(sphereGeo, bodyMat);
    bottomSphere.position.y = -0.5;
    bottomSphere.castShadow = true;
    bottomSphere.receiveShadow = true;
    peerGroup.add(bottomSphere);

    // Sleek dark shiny glass visor
    const visorGeo = new THREE.BoxGeometry(0.85, 0.25, 0.45);
    const visorMat = new THREE.MeshStandardMaterial({ 
        color: 0x1e272e, 
        roughness: 0.1,
        metalness: 0.9
    });
    const visor = new THREE.Mesh(visorGeo, visorMat);
    visor.position.set(0, 0.5, -0.35);
    visor.castShadow = true;
    visor.receiveShadow = true;
    peerGroup.add(visor);

    // Glowing neon pink horizontal visor strip
    const visorStripGeo = new THREE.BoxGeometry(0.5, 0.05, 0.47);
    const visorStripMat = new THREE.MeshBasicMaterial({ color: 0xff4757 });
    const visorStrip = new THREE.Mesh(visorStripGeo, visorStripMat);
    visorStrip.position.set(0, 0.5, -0.36);
    peerGroup.add(visorStrip);

    // Build remote peer weapons (Akimbo attachments)
    const buildGun = (color) => {
        const gun = new THREE.Group();
        const bMat = new THREE.MeshStandardMaterial({ color: 0x2f3542, roughness: 0.4 });
        const body = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.11, 0.38), bMat);
        body.castShadow = true;
        gun.add(body);
        const grip = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.16, 0.07), bMat);
        grip.position.set(0, -0.09, 0.09);
        grip.rotation.x = Math.PI / 6;
        gun.add(grip);
        const core = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.03, 0.36), new THREE.MeshBasicMaterial({ color: color }));
        core.position.set(0, 0.04, -0.04);
        gun.add(core);
        return gun;
    };
    
    const buildShotgun = () => {
        const shotgun = new THREE.Group();
        const bMat = new THREE.MeshStandardMaterial({ color: 0x2f3542, roughness: 0.4 });
        const body = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.12, 0.45), bMat);
        body.castShadow = true;
        shotgun.add(body);
        
        const leftB = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.55, 8), bMat);
        leftB.rotation.x = Math.PI / 2;
        leftB.position.set(-0.02, 0.02, -0.3);
        leftB.castShadow = true;
        shotgun.add(leftB);
        
        const rightB = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.55, 8), bMat);
        rightB.rotation.x = Math.PI / 2;
        rightB.position.set(0.02, 0.02, -0.3);
        rightB.castShadow = true;
        shotgun.add(rightB);
        
        const grip = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.12, 0.22), bMat);
        grip.position.set(0, -0.09, 0.15);
        grip.rotation.x = Math.PI / 6;
        shotgun.add(grip);
        
        const pump = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.08, 0.25), bMat);
        pump.position.set(0, -0.04, -0.15);
        shotgun.add(pump);
        
        const core = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.04, 0.42), new THREE.MeshBasicMaterial({ color: 0xffaa00 }));
        core.position.set(0, 0.05, -0.05);
        shotgun.add(core);
        return shotgun;
    };
    
    const buildAR = () => {
        const ar = new THREE.Group();
        const bMat = new THREE.MeshStandardMaterial({ color: 0x2f3542, roughness: 0.4 });
        const body = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.13, 0.52), bMat);
        body.castShadow = true;
        ar.add(body);
        
        const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.65, 8), bMat);
        barrel.rotation.x = Math.PI / 2;
        barrel.position.set(0, 0.02, -0.4);
        barrel.castShadow = true;
        ar.add(barrel);
        
        const grip = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.15, 0.07), bMat);
        grip.position.set(0, -0.1, 0.12);
        grip.rotation.x = Math.PI / 6;
        ar.add(grip);
        
        const mag = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.18, 0.08), bMat);
        mag.rotation.x = -Math.PI / 12;
        mag.position.set(0, -0.16, -0.05);
        ar.add(mag);
        
        const core = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.03, 0.48), new THREE.MeshBasicMaterial({ color: 0x00ff88 }));
        core.position.set(0, 0.05, -0.06);
        ar.add(core);
        return ar;
    };

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

    return {
        mesh: peerGroup,
        leftGun: leftGun,
        rightGunContainer: rightGunContainer,
        pistolMesh: pistolMesh,
        shotgunMesh: shotgunMesh,
        arMesh: arMesh,
        hookLine: null
    };
}
