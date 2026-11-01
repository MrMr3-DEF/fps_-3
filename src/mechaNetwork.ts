import * as THREE from 'three';
import { state } from './state.js';
import { spawnMechaArmorImpact } from './particles.js';
import { resolveThirdPersonCameraPosition, resolveThirdPersonAimTarget } from './thirdPersonCamera.js';
import { forgottenMecha, getWorldSeed, queryObstaclesNear, queryObstaclesAlongSegment } from './world.js';
import { MECHA_ROCKET_SHOT_TIME, MECHA_ROCKET_FIRE_TIME, MECHA_CAMERA_DISTANCE, MECHA_CAMERA_HEIGHT, MECHA_CAMERA_SHOULDER, BULLET_TRAVEL_DISTANCE, NETWORK_TICK_MS, MECHA_NETWORK_INPUT_TIMEOUT_MS, MECHA_NETWORK_REFRESH_MS, PLAYER_HEIGHT, NETWORK_POSITION_RESPONSE } from './config.js';
import { isPilotWeapon, type PilotWeapon } from './mechaStomp.js';
import { PLAYER_BODY_CAMERA_OFFSET } from './playerHitbox.js';
import type { ForgottenMecha, MechaEvents, MechaPlayer } from './forgottenMecha.js';
import type { MechaPilotRelease } from './mechaPilotRelease.js';
import type { MechaBoardPacket, MechaInputPacket, MechaState, MechaEvent, MechaEventPacket } from './mechaNetworkTypes.js';
import { MechaEndingAuthority, type MechaEndingState } from './mechaEndingTimeline.js';
import type { MechaEndingReadyPacket } from './mechaNetworkTypes.js';
import type { NetworkPacket } from './networkTypes.js';

export interface MechaNetworkPort {
    send(packet: NetworkPacket): void;
    players(): MechaPlayer[];
    endingPeers?(): string[];
    hitTarget(index: number, damage: number, owner: string | null): void;
    acceptedDamage(peerId: string, lifeId: number, attacker: string | null): void;
}
export interface MechaPresentation {
    impact: MechaEvents['impact']; release(pose: MechaPilotRelease): void; blocked(): void;
    damage(damage: number, attackerPeerId: string | null): void; gameOver(): void;
    hit(killed: boolean, score: number, local: boolean): void;
    ending?(scene: MechaEndingState): void;
}
let endingAuthority: MechaEndingAuthority | null = null;
let endingId = 0;
let activeActor: ForgottenMecha | null = null;
let port: MechaNetworkPort | null = null;
let presentation: MechaPresentation | null = null;
let sequence = 0, eventSequence = 0, inputSequence = 0, receivedSequence = -1, receivedEvent = -1;
let lastPublish = -Infinity, lastInputSent = -Infinity, lastInputReceived = -Infinity;
let previousFingerprint = '', previousPhase = '';
let replica: MechaState | null = null;
let input: MechaInputPacket | null = null;
let yaw = 0, pitch = 0, helmet = false, exit = false;
let requestedWeapon: PilotWeapon | null = null;
let boardStart: { lifeId: number; position: THREE.Vector3; quaternion: THREE.Quaternion } | null = null;
const commandSequences = new Map<string, number>();
const approaches = new Map<string, THREE.Vector3>();
const pendingDamage: { packet: MechaEventPacket; beamDraw: number; rendered: boolean }[] = [];
const aimCamera = new THREE.PerspectiveCamera(75, 1, 0.1, 1000);
const aimRotation = new THREE.Euler(0, 0, 0, 'YXZ');
const seat = new THREE.Vector3(), ray = new THREE.Ray();
const logicalAim = new THREE.Vector3(), aimPoint = new THREE.Vector3();
const aimDimensions = { distance: MECHA_CAMERA_DISTANCE, height: MECHA_CAMERA_HEIGHT, shoulder: MECHA_CAMERA_SHOULDER };
const aimObstacles: THREE.Object3D[] = [];

export function setMechaNetworkPort(next: MechaNetworkPort): void { port = next; }
export function setMechaPresentation(next: MechaPresentation): void { presentation = next; }
export function resetMechaNetwork(): void {
    activeActor = null; endingAuthority = null; endingId = 0;
    sequence = eventSequence = inputSequence = 0; receivedSequence = receivedEvent = -1;
    lastPublish = lastInputSent = lastInputReceived = -Infinity; previousFingerprint = previousPhase = '';
    replica = input = null; boardStart = null; yaw = pitch = 0; helmet = exit = false;
    requestedWeapon = null;
    commandSequences.clear(); approaches.clear(); pendingDamage.length = 0;
}
export function captureMechaSnapshot(): MechaState | undefined {
    const actor = activeActor;
    return actor?.ready && actor.networked ? endingSnapshot(actor.captureNetworkState(++sequence, state.matchEnded)) : undefined;
}
function endingSnapshot(snapshot: MechaState): MechaState {
    if (endingAuthority) snapshot.ending = endingAuthority.snapshot(performance.now());
    return snapshot;
}
function commitEnding(): void {
    const actor = activeActor;
    if (!state.isHost || state.matchEnded || !actor) return;
    state.matchEnded = true;
    actor.clearPendingDamage(); actor.pilot.rockets.clear(); pendingDamage.length = 0; input = null;
    const seed = getWorldSeed();
    endingAuthority = new MechaEndingAuthority({ id: ++endingId, seed, effectsSeed: (seed ^ 0x6d2b79f5) >>> 0,
        position: vector(actor.group.position), heading: actor.group.rotation.y,
        lightingElapsed: ((state.dayNightElapsedSeconds % 480) + 480) % 480 }, performance.now(),
        port?.endingPeers?.() ?? port?.players().flatMap(p => p.peerId && p.peerId !== state.peer?.id ? [p.peerId] : []) ?? []);
    publish(true);
}
export function markMechaEndingReady(id: number): void {
    if (!activeActor || id !== (endingAuthority?.snapshot(performance.now()).id ?? replica?.ending?.id)) return;
    if (state.isHost) {
        if (endingAuthority?.markLocalReady(performance.now())) publish(true);
    } else port?.send({ type: 'mecha_ending_ready', id, revision: activeActor.revision });
}
/** Admission is checked by the router; ownership and scene identity are checked
 * here as well. Readiness is independent of the viewer's player life/health. */
export function acceptMechaEndingReady(peerId: string, packet: MechaEndingReadyPacket): boolean {
    if (!state.isHost || !endingAuthority || !activeActor || packet.revision !== activeActor.revision ||
        packet.senderPeerId !== undefined && packet.senderPeerId !== peerId ||
        packet.id !== endingAuthority.snapshot(performance.now()).id || !endingAuthority.markPeerReady(peerId)) return false;
    publish(true); return true;
}
export function updateMechaEndingNetwork(): void { if (state.isHost && endingAuthority) publish(); }
function publish(force = false): void {
    const actor = activeActor, now = performance.now();
    if (!actor?.ready || !state.isHost) return;
    const firing = actor.firingTime < MECHA_ROCKET_SHOT_TIME ? 'windup' : actor.firingTime < MECHA_ROCKET_FIRE_TIME ? 'recovery' : 'idle';
    const phase = `${actor.pilotWeapon}:${actor.stomp.active}:${firing}:${actor.pilot.rockets.activeCount}:${actor.revision}:${actor.mode}:${actor.combat.laserPhase}:${actor.combat.shieldPhase}:${actor.pilotPeerId}:${actor.headView.phase}`;
    force ||= phase !== previousPhase;
    if (!force && now - lastPublish < NETWORK_TICK_MS) return;
    const snapshot = endingSnapshot(actor.captureNetworkState(sequence + 1, state.matchEnded));
    const fingerprint = JSON.stringify({ ...snapshot, sequence: 0 });
    if (!force && fingerprint === previousFingerprint && now - lastPublish < MECHA_NETWORK_REFRESH_MS) return;
    sequence++; previousPhase = phase; previousFingerprint = fingerprint; lastPublish = now;
    port?.send({ type: 'mecha_state', state: snapshot });
    if (snapshot.ending) presentation?.ending?.(snapshot.ending);
}
function emit(event: MechaEvent): void {
    if (!state.isHost || endingAuthority) return;
    const snapshot = captureMechaSnapshot(); if (!snapshot) return;
    const packet: MechaEventPacket = { type: 'mecha_event', sequence: ++eventSequence, state: snapshot, event };
    if (event.kind === 'damage') port?.acceptedDamage(event.peerId, event.lifeId, event.attackerPeerId);
    port?.send(packet); applyEvent(packet);
}
const vector = (p: THREE.Vector3) => ({ x: p.x, y: p.y, z: p.z });
export function multiplayerMechaEvents(): MechaEvents {
    return {
        impact: (impact, position) => emit({ kind: 'impact', impact, position: vector(position) }),
        stompPlayer() {},
        wallPunchStarted: commitEnding,
        playerHit: (player, damage, attack, attackerPeerId = null) => {
            if (player.peerId) emit({ kind: 'damage', peerId: player.peerId, lifeId: player.lifeId ?? 0, damage, attack, attackerPeerId });
        },
        gameOver: () => { emit({ kind: 'end' }); state.matchEnded = true; publish(true); },
        pilotReleased: pose => {
            const actor = activeActor;
            if (actor?.pilotPeerId) emit({ kind: 'release', peerId: actor.pilotPeerId, lifeId: actor.pilotLifeId,
                pose: { position: vector(pose.position), viewPosition: vector(pose.viewPosition), quaternion: pose.quaternion.toArray() } });
            if (actor) actor.pilotPeerId = null;
            input = null;
        },
        exitBlocked: () => { if (activeActor?.pilotPeerId) emit({ kind: 'blocked', peerId: activeActor.pilotPeerId }); },
    };
}
export function initializeNetworkMecha(actor = forgottenMecha): void {
    activeActor = actor; if (!actor) return;
    actor.networked = true; actor.localPeerId = state.peer?.id ?? null;
    actor.pilot.rockets.onExplosion = position => emit({ kind: 'blast', position: vector(position) });
}
export function receiveMechaState(snapshot: MechaState): void {
    if (snapshot.sequence <= receivedSequence || !activeActor?.ready) return;
    // Once committed, a delayed normal snapshot cannot resume the match or
    // replace the scene identity. Sequence checks alone do not express this.
    if (replica?.ending && (!snapshot.ending || snapshot.ending.id !== replica.ending.id ||
        snapshot.ending.elapsed < replica.ending.elapsed ||
        JSON.stringify({ ...snapshot.ending, phase: '', elapsed: 0 }) !== JSON.stringify({ ...replica.ending, phase: '', elapsed: 0 }))) return;
    receivedSequence = snapshot.sequence;
    const actor = activeActor, previousMode = actor.mode, wasLocal = actor.ownsLocalPilot, changed = !replica || actor.mode !== snapshot.mode || actor.revision !== snapshot.revision;
    replica = snapshot; actor.localPeerId = state.peer?.id ?? null;
    if (changed) actor.applyNetworkState(snapshot);
    if (wasLocal && snapshot.mode === 'shutting-down' && previousMode !== 'shutting-down') {
        state.isMouseDown = state.isShiftDown = state.keyCActive = state.rightClickActive = state.isScoped = false;
        actor.transitionCamera.begin('exit', state.isThirdPerson, actor.pilot.cameraPosition, actor.pilot.cameraQuaternion, state.rightClickActive);
    }
    if (!wasLocal && snapshot.pilotPeerId === state.peer?.id && state.camera) {
        actor.localPilotPresentation = true; boardStart = null;
        actor.transitionCamera.begin('entry', state.isThirdPerson, state.camera.position, state.camera.quaternion, state.rightClickActive);
    }
    if (snapshot.ending) {
        state.matchEnded = true; pendingDamage.length = 0; actor.clearPendingDamage(); actor.pilot.rockets.clear();
        presentation?.ending?.(snapshot.ending);
    } else if (snapshot.matchEnded) { state.matchEnded = true; presentation?.gameOver(); }
}
export function receiveMechaEvent(packet: MechaEventPacket): void {
    if (packet.sequence <= receivedEvent) return;
    receivedEvent = packet.sequence; receiveMechaState(packet.state); applyEvent(packet);
}
function applyEvent(packet: MechaEventPacket): void {
    if (endingAuthority || replica?.ending) return;
    const event = packet.event;
    if (event.kind === 'end') { state.matchEnded = true; presentation?.gameOver(); return; }
    if (event.kind === 'impact') { presentation?.impact(event.impact, new THREE.Vector3(event.position.x, event.position.y, event.position.z)); return; }
    if (event.kind === 'shield') { activeActor?.combat.shieldImpact(event.position); return; }
    if (event.kind === 'blast') {
        if (!state.isHost) activeActor?.pilot.rockets.showExplosion(new THREE.Vector3(event.position.x, event.position.y, event.position.z));
        return;
    }
    if (event.kind === 'hit') {
        state.score = event.score;
        // The event owns the contact even if its snapshot has already killed
        // the actor or restored its shield by the time this viewer receives it.
        spawnMechaArmorImpact(event.position, event.direction);
        presentation?.hit(event.killed, event.score, event.peerId === state.peer?.id);
        return;
    }
    if (event.peerId !== state.peer?.id) {
        if (event.kind === 'release') detachRemotePilot(event.peerId, event.pose.position);
        return;
    }
    if (event.kind === 'board_denied') {
        if (event.lifeId !== state.lifeId || activeActor?.ownsLocalPilot) return;
        if (boardStart?.lifeId === state.lifeId) {
            const position = boardStart.position.clone(); position.y -= PLAYER_BODY_CAMERA_OFFSET;
            presentation?.release({ position, quaternion: boardStart.quaternion, viewPosition: boardStart.position }); boardStart = null;
        }
        presentation?.blocked(); return;
    }
    if (event.kind === 'blocked') { presentation?.blocked(); return; }
    if (event.lifeId !== state.lifeId) return;
    if (event.kind === 'release') {
        if (packet.state.mode === 'dead') activeActor?.transitionCamera.release();
        presentation?.release({ position: new THREE.Vector3(event.pose.position.x, event.pose.position.y, event.pose.position.z),
            viewPosition: new THREE.Vector3(event.pose.viewPosition.x, event.pose.viewPosition.y, event.pose.viewPosition.z), quaternion: new THREE.Quaternion().fromArray(event.pose.quaternion) });
        return;
    }
    if (pendingDamage.length < 32 && state.playerHp > 0) pendingDamage.push({ packet, beamDraw: activeActor?.combat.effects.beamDraws ?? 0, rendered: false });
}
export function acknowledgeMechaRender(): void {
    for (const hit of pendingDamage) {
        const event = hit.packet.event;
        if (event.kind === 'damage' && (event.attack !== 'laser' || (activeActor?.combat.effects.beamDraws ?? 0) > hit.beamDraw)) hit.rendered = true;
    }
}
export function flushMechaDamage(): void {
    if (state.matchEnded) { pendingDamage.length = 0; return; }
    for (let i = 0; i < pendingDamage.length;) {
        const hit = pendingDamage[i], event = hit.packet.event;
        if (event.kind !== 'damage' || event.lifeId !== state.lifeId || state.playerHp <= 0 || hit.packet.state.revision !== activeActor?.revision) { pendingDamage.splice(i, 1); continue; }
        if (!hit.rendered) { i++; continue; }
        pendingDamage.splice(i, 1); presentation?.damage(event.damage, event.attackerPeerId);
    }
}
export function queueMechaLook(yawDelta: number, pitchDelta: number): void { yaw += yawDelta; pitch += pitchDelta; }
export function requestMechaAction(action: 'helmet' | 'exit'): void { if (action === 'helmet') helmet = !helmet; else exit = true; lastInputSent = -Infinity; }
export function selectMechaWeapon(weapon: PilotWeapon): void {
    if (!activeActor?.ownsLocalPilot || activeActor.mode !== 'piloted') return;
    requestedWeapon = weapon; lastInputSent = -Infinity;
}
export function localMechaWeapon(): PilotWeapon { return requestedWeapon ?? activeActor?.pilotWeapon ?? 'rocket'; }
export function submitMechaInput(direction: number, shield: boolean, fire: boolean, active: boolean): void {
    const actor = activeActor, now = performance.now();
    if (!actor?.ownsLocalPilot || now - lastInputSent < NETWORK_TICK_MS) return;
    const packet: MechaInputPacket = { type: 'mecha_input', sequence: ++inputSequence, revision: actor.revision, lifeId: state.lifeId,
        direction: active ? Math.max(-1, Math.min(1, direction)) : 0, yaw: active ? Math.max(-10, Math.min(10, yaw)) : 0,
        pitch: active ? Math.max(-Math.PI, Math.min(Math.PI, pitch)) : 0, shield: active && shield, fire: active && fire, weapon: localMechaWeapon(),
        helmet: active && helmet, exit: active && exit, thirdPerson: state.isThirdPerson, secondaryHeld: state.rightClickActive, viewThirdPerson: state.isThirdPersonView,
        fov: state.camera?.fov ?? 75, aspect: Math.max(0.1, Math.min(10, state.camera?.aspect ?? 1)) };
    yaw = pitch = 0; helmet = exit = false; lastInputSent = now;
    if (state.isHost && state.peer) acceptMechaCommand(state.peer.id, packet); else port?.send(packet);
}
export function releaseMechaInput(): void { lastInputSent = -Infinity; submitMechaInput(0, false, false, false); }
export function rememberMechaApproach(): void {
    if (state.camera) boardStart = { lifeId: state.lifeId, position: state.camera.position.clone(), quaternion: state.camera.quaternion.clone() };
}
export function requestMechaBoard(): void {
    const actor = activeActor; if (!actor?.canMount) return;
    requestedWeapon = null;
    const packet: MechaBoardPacket = { type: 'mecha_board', sequence: ++inputSequence, revision: actor.revision, lifeId: state.lifeId, thirdPerson: state.isThirdPerson, secondaryHeld: state.rightClickActive };
    if (state.isHost && state.peer) acceptMechaCommand(state.peer.id, packet); else port?.send(packet);
}
export function acceptMechaCommand(peerId: string, packet: MechaInputPacket | MechaBoardPacket): boolean {
    const actor = activeActor, player = port?.players().find(p => p.peerId === peerId);
    if (!state.isHost || !state.isPlaying || state.matchEnded || !actor?.ready || !player?.alive || player.lifeId !== packet.lifeId ||
        packet.senderPeerId !== undefined && packet.senderPeerId !== peerId || packet.type === 'mecha_input' && !isPilotWeapon(packet.weapon) ||
        packet.sequence <= (commandSequences.get(peerId) ?? -1)) return false;
    commandSequences.set(peerId, packet.sequence);
    if (packet.type === 'mecha_board') {
        const denied = () => { emit({ kind: 'board_denied', peerId, lifeId: packet.lifeId }); return false; };
        if (actor.revision !== packet.revision) return denied();
        actor.seatAnchor.getWorldPosition(seat);
        const approach = approaches.get(peerId) ?? player.position;
        // Only a recent, unobstructed arrival through the real opening grants
        // ownership. Receiving a request never teleports a distant player.
        ray.origin.copy(approach); ray.direction.subVectors(seat, approach).normalize();
        if (!actor.canMount || player.position.distanceTo(seat) > 20 || !actor.cockpitHit(ray, 40)) return denied();
        actor.pilotPeerId = peerId; actor.pilotLifeId = packet.lifeId;
        actor.localPilotPresentation = peerId === state.peer?.id;
        const rotation = new THREE.Quaternion().setFromEuler(aimRotation.set(0, player.yaw ?? 0, 0));
        if (!actor.beginBoarding(player.position, rotation, packet.thirdPerson, packet.secondaryHeld)) { actor.pilotPeerId = null; return false; }
        input = null; publish(true); return true;
    }
    if (actor.revision !== packet.revision || actor.pilotPeerId !== peerId || actor.pilotLifeId !== packet.lifeId || !actor.ownsPilot) return false;
    input = packet; lastInputReceived = performance.now();
    actor.selectPilotWeapon(packet.weapon);
    actor.look(packet.yaw, packet.pitch, lastInputReceived);
    if (packet.helmet) actor.toggleHelmet();
    if (packet.exit) {
        const accepted = actor.requestExit(packet.thirdPerson, packet.secondaryHeld);
        if (accepted) {
            input = { ...packet, direction: 0, fire: false, shield: false, yaw: 0, pitch: 0 };
            if (actor.ownsLocalPilot) state.isMouseDown = state.isShiftDown = false;
        }
    }
    publish(); return true;
}
function detachRemotePilot(peerId: string, position?: { x: number; y: number; z: number }): void {
    const peer = state.peers[peerId]; if (!peer || !state.scene) return;
    state.scene.add(peer.mesh); peer.mesh.scale.setScalar(1.5); peer.leftGun.visible = peer.rightGunContainer.visible = true;
    if (position) { peer.mesh.position.set(position.x, position.y, position.z); peer.targetPosition.copy(peer.mesh.position); }
}
export function syncRemoteMechaPilot(): void {
    const actor = activeActor;
    for (const id of state.peerIds) {
        const peer = state.peers[id]; if (!peer || !actor) continue;
        if (actor.ownsPilot && actor.pilotPeerId === id) {
            if (peer.mesh.parent !== actor.pilotAnchor) actor.pilotAnchor.add(peer.mesh);
            peer.mesh.position.set(0, 0, 0); peer.mesh.rotation.set(0, Math.PI * actor.boardProgress, 0); peer.mesh.scale.setScalar(actor.pilotScale);
            peer.mesh.visible = true; peer.leftGun.visible = peer.rightGunContainer.visible = false;
            if (peer.hookLine) peer.hookLine.visible = false;
        } else if (peer.mesh.parent === actor.pilotAnchor) {
            actor.pilotAnchor.getWorldPosition(seat); detachRemotePilot(id, seat); peer.leftGun.visible = peer.rightGunContainer.visible = true;
        }
    }
}
export function mechaPeerLeft(peerId: string): void {
    if (endingAuthority) { endingAuthority.removePeer(peerId); publish(true); }
    approaches.delete(peerId); commandSequences.delete(peerId);
    if (state.isHost && activeActor?.pilotPeerId === peerId) { detachRemotePilot(peerId); activeActor.abandonPilot(); input = null; publish(true); }
}
export function announceMechaHit(peerId: string, killed: boolean, position: THREE.Vector3, direction: THREE.Vector3): void {
    emit({ kind: 'hit', peerId, killed, score: state.score, position: vector(position), direction: vector(direction) }); publish(true);
}
export function updateMechaNetwork(delta: number): void {
    const actor = activeActor; if (!state.isMultiplayer || !actor?.ready) return;
    actor.localPeerId = state.peer?.id ?? null;
    if (state.isHost && state.isPlaying && !state.matchEnded) {
        const players = port?.players() ?? [];
        actor.seatAnchor.getWorldPosition(seat);
        for (const p of players) if (p.peerId && p.position.distanceTo(seat) > 2 && p.position.distanceTo(seat) < 40) approaches.set(p.peerId, p.position.clone());
        if (actor.pilotPeerId && !players.some(p => p.peerId === actor.pilotPeerId && p.lifeId === actor.pilotLifeId && p.alive)) { actor.abandonPilot(); input = null; }
        const activeInput = input && performance.now() - lastInputReceived <= MECHA_NETWORK_INPUT_TIMEOUT_MS ? input : null;
        actor.setPilotInput(activeInput?.direction ?? 0, activeInput?.shield ?? false);
        actor.setStompTargets(state.targets, (index, damage) => port?.hitTarget(index, damage, actor.pilotPeerId));
        actor.updatePlayers(delta, players);
        // Shutdown, lava destruction and the wall callback can synchronously
        // revoke ownership/input or end the room during this update.
        if (state.matchEnded) return;
        if (activeInput && input === activeInput && activeInput.fire) actor.requestAttack();
        if (actor.mode === 'piloted') {
            aimCamera.fov = input?.fov ?? 75; aimCamera.aspect = input?.aspect ?? 1; aimCamera.updateProjectionMatrix();
            logicalAim.copy(actor.pilot.cameraPosition); aimCamera.quaternion.copy(actor.pilot.cameraQuaternion);
            if (input?.viewThirdPerson) {
                actor.viewAnchor.getWorldPosition(logicalAim);
                queryObstaclesNear(logicalAim.x, logicalAim.z, 65, aimObstacles);
                for (let i = aimObstacles.length - 1; i >= 0; i--) if (aimObstacles[i].userData.damageTarget === 'forgotten-mecha') aimObstacles.splice(i, 1);
                resolveThirdPersonCameraPosition(logicalAim, actor.pilot.cameraQuaternion, aimObstacles, aimCamera.position, aimDimensions);
                aimCamera.lookAt(resolveThirdPersonAimTarget(logicalAim, actor.pilot.cameraQuaternion, aimPoint, BULLET_TRAVEL_DISTANCE));
            } else aimCamera.position.copy(logicalAim);
            aimCamera.updateMatrixWorld(true);
            actor.fireRocket(aimCamera, state.targets, queryObstaclesAlongSegment);
        }
        actor.updateRockets(delta, state.targets, queryObstaclesAlongSegment, (index, damage) => port?.hitTarget(index, damage, actor.pilotPeerId));
        publish();
    } else if (!state.isHost && replica) {
        const pending = pendingDamage.find(d => !d.rendered && d.packet.event.kind === 'damage' && d.packet.event.attack !== 'rocket');
        actor.applyNetworkState(pending?.packet.state ?? replica, pending ? 1 : 1 - Math.exp(-NETWORK_POSITION_RESPONSE * delta));
        actor.pilot.rockets.update(delta, [], queryObstaclesAlongSegment, () => {});
        actor.transitionCamera.update(delta);
        actor.transitionCamera.sync(actor.mode, actor.headView.phase, actor.headView.revealProgress, replica.recoveringExit);
    }
    syncRemoteMechaPilot();
}
/** Networked bean coordinates remain camera anchors, matching ordinary updates. */
export function mechaPlayer(peerId: string, position: THREE.Vector3, yaw: number, lifeId: number, alive: boolean, velocity?: THREE.Vector3): MechaPlayer {
    return { peerId, position, yaw, lifeId, alive, velocity, grounded: position.y <= PLAYER_HEIGHT + 0.15 && position.y >= PLAYER_HEIGHT - 0.15 };
}
export function mountedPeerPosition(peerId: string): THREE.Vector3 | null {
    const actor = activeActor;
    if (!actor?.ownsPilot || actor.pilotPeerId !== peerId) return null;
    return actor.pilotAnchor.getWorldPosition(new THREE.Vector3()).add(new THREE.Vector3(0, PLAYER_BODY_CAMERA_OFFSET, 0));
}

export function announceMechaShield(position: THREE.Vector3): void { emit({ kind: 'shield', position: vector(position) }); }
