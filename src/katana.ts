import { KatanaEffects } from './katanaEffects.js';
import { createKatanaSlash, katanaSlashDistance } from './katanaSlash.js';
import * as THREE from 'three';
import { state, onHeldInputReset } from './state.js';
import { KATANA } from './config.js';
import { KatanaClock, katanaBoxContacts, type KatanaPose } from './katanaCombat.js';
import { updateKatanaModel } from './katanaModel.js';
import { PLAYER_HITBOX_MIN, PLAYER_HITBOX_MAX, PLAYER_BODY_CAMERA_OFFSET } from './playerHitbox.js';
import { getMeleeNetworkPort, type MeleePlayer } from './weaponNetworkPort.js';
import { targetData } from './userDataTypes.js';
import { forgottenMecha } from './world.js';
import { userSettings } from './settings.js';
import { isInputActive } from './inputSession.js';
import { cancelInspect } from './weapons.js';
import { flashHitmarker } from './hitmarker.js';
import type { MeleeCommand, MeleeEvent, MeleeHitEvent } from './networkTypes.js';
let time = 0, sequence = 0, held = false;
const local = new KatanaClock();
const effects = new KatanaEffects();
interface Attack {
    clock: KatanaClock;
    sequence: number;
    lifeId: number;
    pose?: KatanaPose;
    player: MeleePlayer;
    victims?: Set<string>;
    damaged: Set<string>;
}
const authorities = new Map<string, Attack>();
const visuals = new Map<string, {
    clock: KatanaClock;
    sequence: number;
    lifeId: number;
    pose?: KatanaPose;
}>();
const waves: Array<{
    mesh: ReturnType<typeof createKatanaSlash>;
    start: number;
    origin: THREE.Vector3;
    forward: THREE.Vector3;
}> = [];
const playerBox = new THREE.Box3(new THREE.Vector3(PLAYER_HITBOX_MIN.x, PLAYER_HITBOX_MIN.y, PLAYER_HITBOX_MIN.z), new THREE.Vector3(PLAYER_HITBOX_MAX.x, PLAYER_HITBOX_MAX.y, PLAYER_HITBOX_MAX.z));
const halfHeight = (PLAYER_HITBOX_MAX.y - PLAYER_HITBOX_MIN.y) / 2;
const rotation = (yaw: number, pitch: number) => new THREE.Quaternion().setFromEuler(new THREE.Euler(pitch, yaw, 0, 'YXZ'));
const poseOf = (p: MeleePlayer): KatanaPose => ({ origin: p.position.clone().add(new THREE.Vector3(0, -PLAYER_BODY_CAMERA_OFFSET, 0)), rotation: rotation(p.yaw, p.pitch) });
const id = () => state.peer?.id ?? 'local';
export function localMeleePlayer(): MeleePlayer {
    const e = new THREE.Euler().setFromQuaternion(state.camera?.quaternion ?? new THREE.Quaternion(), 'YXZ');
    return { id: id(), lifeId: state.lifeId, alive: state.playerHp > 0 && !forgottenMecha?.ownsLocalPilot, ready: state.activeWeaponName === 'KATANA' && state.desiredWeaponName === 'KATANA' && state.switchState === 'IDLE' && !forgottenMecha?.ownsLocalPilot,
        name: state.username, position: state.controls?.getObject().position.clone() ?? new THREE.Vector3(), yaw: e.y, pitch: e.x };
}
function command(action: MeleeCommand['action']): void {
    const packet: MeleeCommand = { type: 'melee_command', action, sequence: ++sequence, lifeId: state.lifeId };
    if (state.isMultiplayer && !state.isHost)
        getMeleeNetworkPort().sendCommand(packet);
    else
        acceptMeleeCommand(id(), packet);
}
export function cancelKatana(): void {
    if (local.started !== null || !local.cancelled && local.damageActive(time))
        command('cancel');
    local.cancel();
    effects.cancel(id(), true);
    held = false;
}
onHeldInputReset(cancelKatana);
export function katanaInput(down: boolean): void {
    if (down === held)
        return;
    held = down;
    if (!isInputActive() || !state.isPlaying || !localMeleePlayer().ready || state.playerHp <= 0) {
        cancelKatana();
        return;
    }
    if (down) {
        if (state.fireCooldown > 0 || !local.begin(time))
            return;
        cancelInspect();
        command('start');
    }
    else if (local.release(time)) {
        state.fireCooldown = KATANA.duration;
        command('release');
    }
}
export function validateKatanaInput(): void {
    if (!isInputActive() || !state.isPlaying || state.matchEnded || !localMeleePlayer().ready || state.playerHp <= 0)
        cancelKatana();
}
/** Host derives every combat value; no caller-provided geometry or damage. */
export function acceptMeleeCommand(peerId: string, packet: MeleeCommand): boolean {
    if (state.isMultiplayer && !state.isHost || !state.isPlaying || state.matchEnded)
        return false;
    const player = peerId === id() ? localMeleePlayer() : getMeleeNetworkPort().players().find(p => p.id === peerId);
    if (!player || packet.lifeId !== player.lifeId || !Number.isFinite(player.pitch) || Math.abs(player.pitch) > Math.PI / 2)
        return false;
    let attack = authorities.get(peerId);
    if (!attack || attack.lifeId !== player.lifeId) {
        attack = { clock: new KatanaClock(), sequence: -1, lifeId: player.lifeId, player, damaged: new Set() };
        authorities.set(peerId, attack);
    }
    if (packet.sequence <= attack.sequence)
        return false;
    attack.sequence = packet.sequence;
    if (packet.action === 'cancel')
        attack.clock.cancel();
    else {
        if (!player.alive || !player.ready)
            return false;
        if (packet.action === 'start') {
            if (!getMeleeNetworkPort().ready(peerId) || !attack.clock.begin(time))
                return false;
        }
        else {
            if (!attack.clock.release(time))
                return false;
            getMeleeNetworkPort().reserve(peerId);
            attack.pose = poseOf(player);
            attack.player = player;
            // Capture eligible lives independently of hits: replacement lives never inherit a swing.
            attack.damaged.clear();
            attack.victims = new Set(state.targets.map((target, i) => `npc:${i}:${targetData(target).eliminationRevision ?? 0}`));
            for (const p of getMeleeNetworkPort().players())
                if (p.alive)
                    attack.victims.add(`peer:${p.id}:${p.lifeId}`);
            if (forgottenMecha)
                attack.victims.add(`mecha:${forgottenMecha.revision}`);
        }
    }
    const pose = poseOf(player);
    const event: MeleeEvent = { type: 'melee_event', action: packet.action, sequence: packet.sequence, lifeId: player.lifeId, senderPeerId: peerId, charged: attack.clock.charged,
        origin: { x: pose.origin.x, y: pose.origin.y, z: pose.origin.z }, yaw: player.yaw, pitch: player.pitch };
    receiveMeleeEvent(event);
    if (state.isMultiplayer)
        getMeleeNetworkPort().emit(event);
    if (packet.action === 'release' && attack.clock.damageActive(time)) resolve(attack);
    return true;
}
export function receiveMeleeEvent(event: MeleeEvent): void {
    let visual = visuals.get(event.senderPeerId);
    if (visual && (event.lifeId < visual.lifeId || event.lifeId === visual.lifeId && event.sequence <= visual.sequence))
        return;
    if (!visual || visual.lifeId !== event.lifeId) {
        visual = { clock: new KatanaClock(), sequence: -1, lifeId: event.lifeId };
        visuals.set(event.senderPeerId, visual);
    }
    visual.sequence = event.sequence;
    visual.pose = { origin: new THREE.Vector3(event.origin.x, event.origin.y, event.origin.z), rotation: rotation(event.yaw, event.pitch) };
    if (event.action === 'start')
        visual.clock.begin(time);
    if (event.action === 'cancel') {
        visual.clock.cancel();
        effects.cancel(event.senderPeerId, event.senderPeerId === id());
    }
    if (event.action === 'release') {
        visual.clock.chargeAtRelease = visual.clock.started === null ? KATANA.charge : time - visual.clock.started;
        visual.clock.started = null;
        visual.clock.released = time;
        visual.clock.cancelled = false;
        visual.clock.impacted = false;
        visual.clock.charged = event.charged;
        if (event.senderPeerId === id())
            local.charged = event.charged;
    }
}
/** Only the authenticated host route calls this on clients; swing/life gates reject replays. */
export function receiveMeleeHit(event: MeleeHitEvent): void {
    const visual = visuals.get(event.senderPeerId);
    if (event.senderPeerId !== id() || event.lifeId !== state.lifeId || !visual ||
        visual.lifeId !== event.lifeId || visual.sequence !== event.sequence || !visual.clock.charged ||
        visual.clock.cancelled || visual.clock.released === null || time - visual.clock.released > KATANA.duration || !state.isPlaying || state.playerHp <= 0) return;
    const parts = event.target.split(':');
    let object: THREE.Object3D | undefined;
    if (parts[0] === 'npc') {
        const target = state.targets[Number(parts[1])];
        if (target && (targetData(target).eliminationRevision ?? 0) === Number(parts[2])) object = target;
    } else if (parts[0] === 'peer') {
        const player = getMeleeNetworkPort().players().find(p => p.id === parts[1] && p.lifeId === Number(parts[2]));
        if (player) object = state.peers[player.id]?.mesh;
    } else if (forgottenMecha && (forgottenMecha.revision === Number(parts[1]) || forgottenMecha.hp <= 0 && forgottenMecha.revision === Number(parts[1]) + 1)) object = forgottenMecha.group;
    if (!object) return;
    effects.confirm(`${event.lifeId}:${event.sequence}`, event.target, object,
        new THREE.Vector3(event.contact.x, event.contact.y, event.contact.z), time, userSettings.photosensitivityMode, visual.pose?.rotation);
}
function confirmed(attack: Attack, target: string, point: THREE.Vector3, execution = false): void {
    if (!attack.clock.charged) return;
    const event: MeleeHitEvent = { type: 'melee_hit', senderPeerId: attack.player.id, sequence: attack.sequence,
        lifeId: attack.lifeId, target, contact: { x: point.x, y: point.y, z: point.z }, execution };
    receiveMeleeHit(event);
    if (state.isMultiplayer) getMeleeNetworkPort().confirmHit(event);
}
export function renderKatanaImpact(renderer: THREE.WebGLRenderer, camera: THREE.Camera): void { effects.render(renderer, camera, time); }
function contact(box: THREE.Box3, matrix: THREE.Matrix4, attack: Attack, mecha = false): THREE.Vector3 | undefined {
    const pose = attack.pose!, radius = attack.clock.charged ? KATANA.chargedRadius : KATANA.radius;
    return katanaBoxContacts(box, matrix, pose, radius, halfHeight).find(point => !getMeleeNetworkPort().blocked(pose.origin, point, mecha));
}
function resolve(attack: Attack): void {
    const amount = attack.clock.charged ? KATANA.chargedDamage : KATANA.damage;
    let hit = false;
    state.targets.forEach((target, index) => {
        const data = targetData(target), body = data.bodyMesh;
        const key = `npc:${index}:${data.eliminationRevision ?? 0}`;
        if (!attack.clock.damageActive(time) || attack.damaged.has(key) || data.hp <= 0 || !body || !attack.victims?.has(key))
            return;
        body.updateWorldMatrix(true, false);
        if (!body.geometry.boundingBox)
            body.geometry.computeBoundingBox();
        const point = contact(body.geometry.boundingBox!, body.matrixWorld, attack);
        if (point) {
            attack.damaged.add(key);
            confirmed(attack, key, point);
            getMeleeNetworkPort().hitTarget(index, amount, attack.player, attack.sequence);
            hit = true;
        }
    });
    for (const player of getMeleeNetworkPort().players()) {
        const key = `peer:${player.id}:${player.lifeId}`;
        if (!attack.clock.damageActive(time) || attack.damaged.has(key) || !player.alive || player.id === attack.player.id || !attack.victims?.has(key))
            continue;
        const matrix = new THREE.Matrix4().compose(poseOf(player).origin, rotation(player.yaw, 0), new THREE.Vector3(1, 1, 1));
        const point = contact(playerBox, matrix, attack);
        if (point) {
            attack.damaged.add(key);
            confirmed(attack, key, point);
            getMeleeNetworkPort().hitPlayer(player, attack.player, amount, attack.sequence);
            hit = true;
        }
    }
    const actor = forgottenMecha;
    const mechaKey = `mecha:${actor?.revision}`;
    if (attack.clock.damageActive(time) && !attack.damaged.has(mechaKey) && actor?.ready && actor.hp > 0 && !(actor.ownsPilot && actor.pilotPeerId === attack.player.id) && attack.victims?.has(`mecha:${actor.revision}`)) {
        actor.hitbox.updateWorldMatrix(true, false);
        actor.hitbox.geometry.computeBoundingBox();
        const nape = actor.nape;
        const executionPoint = attack.clock.charged && nape?.fromBehind(attack.pose!.origin)
            ? contact(nape.box, nape.anchor.matrixWorld, attack, true) : undefined;
        const point = executionPoint ?? contact(actor.hitbox.geometry.boundingBox!, actor.hitbox.matrixWorld, attack, true);
        if (point) {
            // Reserve before callbacks; a shield/protected-phase rejection leaves it eligible.
            attack.damaged.add(mechaKey);
            if (!getMeleeNetworkPort().hitMecha(attack.player, executionPoint ? actor.hp : amount, attack.pose!.origin, point))
                attack.damaged.delete(mechaKey);
            else confirmed(attack, mechaKey, point, Boolean(executionPoint));
        }
    }
    if (hit && attack.player.id === id())
        flashHitmarker(false);
}
function wave(pose: KatanaPose): void {
    if (!state.scene)
        return;
    const mesh = createKatanaSlash();
    mesh.quaternion.copy(pose.rotation);
    const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(pose.rotation);
    mesh.position.copy(pose.origin).addScaledVector(forward, katanaSlashDistance(0));
    state.scene.add(mesh);
    waves.push({ mesh, start: time, origin: pose.origin.clone(), forward });
}
export function updateKatana(delta: number): void {
    time += delta;
    validateKatanaInput();
    if (local.started !== null || local.released !== null && time - local.released < KATANA.duration)
        cancelInspect();
    if (!state.isMultiplayer || state.isHost)
        for (const [peerId, attack] of authorities) {
            if (attack.clock.started === null && !attack.clock.damageActive(time))
                continue;
            const player = peerId === id() ? localMeleePlayer() : getMeleeNetworkPort().players().find(p => p.id === peerId);
            if (!player || !player.alive || !player.ready || player.lifeId !== attack.lifeId) {
                invalidateMeleePeer(peerId);
                continue;
            }
            if (attack.clock.damageActive(time)) {
                attack.pose = poseOf(player);
                attack.player = player;
                resolve(attack);
            }
        }
    local.impact(time);
    for (const [peerId, visual] of visuals) {
        const mesh = peerId === id() ? state.katanaMesh : state.peers[peerId]?.katanaMesh;
        if (!mesh)
            continue;
        const clock = peerId === id() ? local : visual.clock;
        if (visual.clock.impact(time) && visual.clock.charged) {
            if (visual.pose)
                wave(visual.pose);
        }
        updateKatanaModel(mesh, clock.started === null ? 0 : time - clock.started, clock.cancelled || clock.released === null ? null : time - clock.released, clock.charged, time, userSettings.photosensitivityMode, Math.max(0, (clock.started === null ? clock.chargeAtRelease + (time - (clock.released ?? time)) : time - clock.started) - KATANA.charge));
    }
    for (const [peerId, visual] of visuals) {
        const mesh = peerId === id() ? state.katanaMesh : state.peers[peerId]?.katanaMesh;
        const clock = peerId === id() ? local : visual.clock;
        if (mesh && state.scene && clock.charged && !clock.cancelled && clock.released !== null)
            effects.sample(peerId, `${visual.lifeId}:${visual.sequence}`, mesh, time - clock.released, time, state.scene);
    }
    effects.update(time, userSettings.photosensitivityMode);
    // Local prediction is independent of an eventual host acknowledgment.
    if (state.katanaMesh)
        updateKatanaModel(state.katanaMesh, local.started === null ? 0 : time - local.started, local.cancelled || local.released === null ? null : time - local.released, local.charged, time, userSettings.photosensitivityMode, Math.max(0, (local.started === null ? local.chargeAtRelease + (time - (local.released ?? time)) : time - local.started) - KATANA.charge));
    for (let i = waves.length - 1; i >= 0; i--) {
        const w = waves[i], t = (time - w.start) / KATANA.waveDuration;
        if (t >= 1) {
            w.mesh.removeFromParent();
            w.mesh.geometry.dispose();
            w.mesh.material.dispose();
            waves.splice(i, 1);
        }
        else {
            w.mesh.position.copy(w.origin).addScaledVector(w.forward, katanaSlashDistance(t));
            // Keep the strike readable throughout travel; dissolve only at its endpoint.
            w.mesh.material.opacity = (userSettings.photosensitivityMode ? 0.55 : 0.95)
                * (1 - THREE.MathUtils.smoothstep(t, 0.8, 1));
        }
    }
}
export function applyKatanaShake(camera: THREE.Camera): void {
    if (local.started === null || time - local.started < KATANA.charge || userSettings.photosensitivityMode)
        return;
    camera.rotateX(Math.sin(time * 57) * KATANA.shake);
    camera.rotateZ(Math.sin(time * 43) * KATANA.shake * 0.6);
}
export function resetKatana(): void {
    time = 0;
    effects.reset();
    local.reset();
    held = false;
    authorities.clear();
    visuals.clear();
    for (const w of waves) {
        w.mesh.removeFromParent();
        w.mesh.geometry.dispose();
        w.mesh.material.dispose();
    }
    waves.length = 0;
}
/** Accepted switches/deaths retire a charge immediately, even between frames. */
export function invalidateMeleePeer(peerId: string): void {
    effects.cancel(peerId, peerId === id());
    visuals.get(peerId)?.clock.cancel();
    const attack = authorities.get(peerId);
    if (!attack)
        return;
    attack.clock.cancel();
}
export function forgetMeleePeer(peerId: string): void { effects.cancel(peerId, peerId === id()); authorities.delete(peerId); visuals.delete(peerId); }
