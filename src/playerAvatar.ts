import * as THREE from 'three';
import { CyborgAvatar, cyborgAssetsReady, type CyborgPose } from './cyborgAvatar.js';
import { APEX_VELOCITY_THRESHOLD, PLAYER_HEIGHT, GRAPPLE_SEAT_TIME, HEAVY_HANDOFF_TIME, SWITCH_DURATION, MINIGUN_RAMP_TIME, WEAPON_STATS, GRAPPLE_BLUE } from './config.js';
import { PILOT_LENS_OFFSET, PLAYER_BODY_CAMERA_OFFSET, PLAYER_HITBOX_MIN, PLAYER_HITBOX_MAX } from './playerHitbox.js';
import { attachGrappleMuzzleShockwave, attachMuzzleShockwave } from './muzzleFlash.js';
import type { LightWeapon } from './handlingNetworkTypes.js';
import type { WeaponName } from './networkTypes.js';
import { createKatanaLightning } from './katanaLightning.js';
import { setPeerScanBounds } from './smartGogglesPeerMath.js';

/** The armed visor is 1.685 authored metres above the soles. Gameplay owns eye height. */
export const CYBORG_SCALE = PLAYER_HEIGHT / 1.685;
export const CYBORG_SEATED_OFFSET = PILOT_LENS_OFFSET - 1.347 * CYBORG_SCALE;
const actors = new WeakMap<THREE.Group, PlayerAvatarController>();
const scanBounds = new THREE.Box3(new THREE.Vector3(PLAYER_HITBOX_MIN.x, PLAYER_HITBOX_MIN.y, PLAYER_HITBOX_MIN.z), new THREE.Vector3(PLAYER_HITBOX_MAX.x, PLAYER_HITBOX_MAX.y, PLAYER_HITBOX_MAX.z));
// Distances between touchdown and toe-off in the exported Run clips, in model metres.
const RUN_TRAVEL = {forward:.66, backward:.54, lateral:.43};
const RUN_DURATION = .50;
const RUN_STANCE = .30;
const fireFrames: Record<string, number> = { PISTOL: 10, SHOTGUN: 31, AR: 14, SNIPER: 40, MINIGUN: 6 };
const titles: Record<string, string> = { PISTOL:'Pistol', SHOTGUN:'Shotgun', AR:'AssaultRifle', SNIPER:'Sniper', MINIGUN:'Minigun', KATANA:'Katana' };
export interface AvatarHandling {
    hand: 'holstered'|'drawing'|'drawn'|'returning';
    handProgress: number;
    handWeapon?: WeaponName;
    outgoingLight?: LightWeapon | null;
    reloadProgress?: number;
    chargeStage: number;
}
export interface AvatarFrame {
    weapon: string; grounded: boolean; velocity: THREE.Vector3; yaw: number; pitch: number;
    hover: boolean; hook: 'IDLE'|'FIRING'|'PULLING'; hookMoving?: boolean; scoped?: boolean;
    inspectTime?: number; switchState?: string; switchTime?: number; minigunRamp?: number;
    alive: boolean; lifeId: number; handling?: AvatarHandling; pilot?: 'Board'|'Seated'|'Exit'|'Eject';
    pilotProgress?: number; katana?: {action: string; time: number}; gentle?: boolean;
}

export class PlayerAvatarController {
    readonly rig: CyborgAvatar;
    private readonly effects: THREE.Object3D[] = [];
    private readonly shell: THREE.Group;
    private age = 0;
    private entered = 0;
    private body = '';
    private fired = -Infinity;
    private hurt = -Infinity;
    private powered = -Infinity;
    private lastLife = -1;
    private ground = true;
    private hover = false;
    private hook = false;
    private pilot = '';
    private yaw = 0;
    private spin = 0;
    private lastRamp = 0;
    private spinStart = 0;
    private spinningUp = false;
    private lastSpeed = 0;
    private runPhase = 0;
    private lastPose?: CyborgPose;
    private interruptedReload?: number;
    private gripPhase = '';
    private gripEntered = 0;
    private drawWeapon = '';
    private returnReaction?: 'Grapple.Retract' | 'Grapple.Miss';
    constructor(shell: THREE.Group, color: number) {
        this.shell = shell;
        this.rig = new CyborgAvatar(color);
        this.rig.root.scale.setScalar(CYBORG_SCALE);
        this.rig.root.rotation.y = Math.PI;
        this.rig.root.position.y = PLAYER_BODY_CAMERA_OFFSET - PLAYER_HEIGHT;
        shell.add(this.rig.root);
        setPeerScanBounds(shell, scanBounds);
    }
    setColor(color: number): void { this.rig.setColor(color); }
    shot(): void { this.fired = this.age; }
    hit(): void { this.hurt = this.age; }
    powerJump(): void { this.powered = this.age; }
    private chooseBody(f: AvatarFrame, lateral: number, forward: number, speed: number, turn: number): string {
        const elapsed = this.age - this.entered;
        if (!f.alive) return 'Death';
        if (f.pilot) return 'Pilot.' + f.pilot;
        if (this.pilot && this.pilot !== 'Exit') return 'Pilot.Eject';
        if (this.body === 'Pilot.Eject' && elapsed < .38) return this.body;
        if (f.grounded && this.body === 'Spawn' && elapsed < .54 && speed < .7 && Math.abs(f.velocity.y) < 1 &&
            !f.hover && f.hook === 'IDLE' && f.handling?.reloadProgress === undefined && (f.handling?.hand ?? 'holstered') === 'holstered' && this.fired < this.entered) return 'Spawn';
        if (f.hook === 'PULLING') return f.hookMoving ? 'Grapple.PullMoving' : 'Grapple.PullFixed';
        if (!f.grounded && this.age - this.powered < .34) return 'Jump.PowerTakeoff';
        if (f.hover) {
            if (!this.hover || this.body === 'Jump.PowerTakeoff' || this.body === 'Hover.Ignite' && elapsed < .24) return 'Hover.Ignite';
            if (speed + 1.5 < this.lastSpeed || this.body === 'Hover.Brake' && elapsed < .36) return 'Hover.Brake';
            return speed < 1 ? 'Hover.Hold' : 'Hover.' + direction(lateral, forward);
        }
        if (!f.grounded) {
            if (f.velocity.y > 0 && (this.ground || this.hook || this.body === 'Jump.Takeoff' && elapsed < .075)) return 'Jump.Takeoff';
            if (this.hover || this.body === 'Hover.Shutdown' && elapsed < .29) return 'Hover.Shutdown';
            if (this.hook || this.body === 'Grapple.ReleaseBody' && elapsed < .28) return 'Grapple.ReleaseBody';
            if (this.ground && f.velocity.y <= 0 || this.body === 'Jump.Fall' && f.velocity.y < 0) return 'Jump.Fall';
            return Math.abs(f.velocity.y) < APEX_VELOCITY_THRESHOLD ? 'Jump.Apex' : f.velocity.y > 0 ? 'Jump.Rise' : 'Jump.Fall';
        }
        if (this.hover || this.body === 'Hover.Shutdown' && elapsed < .29) return 'Hover.Shutdown';
        if (!this.ground || this.body === 'Jump.Land' && elapsed < .38) return 'Jump.Land';
        if (speed > .7) return 'Run.' + direction(lateral, forward);
        if (Math.abs(turn) > .3) return turn > 0 ? 'Turn.Left' : 'Turn.Right';
        return 'Idle.Armed';
    }
    update(delta: number, f: AvatarFrame): void {
        const dt = Math.max(0, Math.min(delta, .1));
        this.age += dt;
        if (this.lastLife !== f.lifeId) {
            this.lastLife = f.lifeId; this.body = 'Spawn'; this.entered = this.age;
            this.fired = this.hurt = -Infinity; this.ground = f.grounded; this.yaw = f.yaw;
            this.hover = this.hook = false; this.pilot = this.gripPhase = '';
            this.returnReaction = undefined; this.drawWeapon = ''; this.spin = this.lastRamp = this.lastSpeed = 0;
            this.powered = -Infinity;
            this.lastPose = undefined;
            this.interruptedReload = undefined;
        }
        const c = Math.cos(f.yaw), s = Math.sin(f.yaw);
        const lateral = c*f.velocity.x - s*f.velocity.z, forward = -s*f.velocity.x - c*f.velocity.z;
        const speed = Math.hypot(lateral, forward);
        const turn = Math.atan2(Math.sin(f.yaw-this.yaw), Math.cos(f.yaw-this.yaw)) / Math.max(dt,.001);
        const next = this.chooseBody(f, lateral, forward, speed, turn);
        if (next !== this.body) {
            this.entered = this.age;
            if (!this.body.startsWith('Run.')) this.runPhase = 0;
            this.body = next;
        }
        const phase = f.handling?.hand ?? 'holstered';
        const gripPhase = phase === 'drawn' ? f.hook : phase;
        if (gripPhase !== this.gripPhase) {
            // The outgoing foregrip can change halfway through a switch. Finish
            // the draw from the same grip the glove originally left.
            if (phase === 'drawing') this.drawWeapon = f.weapon;
            this.returnReaction = gripPhase === 'IDLE' && this.gripPhase === 'PULLING' ? 'Grapple.Retract'
                : gripPhase === 'IDLE' && this.gripPhase === 'FIRING' ? 'Grapple.Miss' : undefined;
            this.gripPhase = gripPhase;
            this.gripEntered = this.age;
        }
        const phaseTime = this.age - this.gripEntered;
        const handTime = THREE.MathUtils.clamp(f.handling?.handProgress ?? 0,0,1);
        const ramp = f.minigunRamp ?? 0;
        if ((ramp > this.lastRamp) !== this.spinningUp && ramp !== this.lastRamp) {
            this.spinningUp = ramp > this.lastRamp; this.spinStart = this.age;
        }
        this.spin += dt * ramp/MINIGUN_RAMP_TIME * 40;
        const pose: CyborgPose = {body:next, bodyTime:this.age-this.entered, weapon:f.weapon, action:f.scoped?'Aim':'Ready',
            actionTime:this.age, pitch:f.pitch, spin:this.spin, reducedMotion:f.gentle, chargeStage:f.handling?.chargeStage ?? 4};
        if (next.startsWith('Run.')) this.sampleRun(pose, dt, speed, lateral, forward);
        if (next === 'Jump.Apex') {
            // Blend through zero vertical speed. Walking off a ledge enters Fall directly.
            pose.bodyBlend = {
                name: f.velocity.y > 0 ? 'Jump.Rise' : 'Jump.Fall',
                weight: THREE.MathUtils.smoothstep(Math.abs(f.velocity.y), 0, APEX_VELOCITY_THRESHOLD),
            };
        }
        if (f.pilot === 'Board') pose.bodyTime = (f.pilotProgress ?? 0)*.45;
        if (f.pilot === 'Exit' && f.pilotProgress !== undefined) pose.bodyTime = f.pilotProgress*.66;
        if (f.weapon === 'MINIGUN' && ramp > 0) { pose.action = this.spinningUp?'SpinUp':'SpinDown'; pose.actionTime = this.age-this.spinStart; }
        if (this.age-this.fired < (fireFrames[f.weapon] ?? 0)/120) { pose.action = 'Fire'; pose.actionTime = this.age-this.fired; }
        if (f.inspectTime !== undefined) { pose.action = 'Inspect'; pose.actionTime = f.inspectTime; }
        if (f.katana && f.weapon === 'KATANA') { pose.action = f.katana.action; pose.actionTime = f.katana.time; }
        if (f.switchState === 'WITHDRAWING' || f.switchState === 'BRINGING_IN') {
            pose.action = f.switchState === 'WITHDRAWING'?'Withdraw':'Equip'; pose.actionTime = f.switchTime ?? 0;
        }
        if (f.handling?.reloadProgress !== undefined) {
            pose.action = 'Reload';
            pose.reloadProgress = f.handling.reloadProgress;
        }
        if (phase === 'drawing' || phase === 'returning') {
            const drawing = phase === 'drawing';
            const name = titles[f.handling?.handWeapon ?? (drawing ? this.drawWeapon : f.weapon)] ?? 'Pistol';
            pose.grapple = 'Grapple.' + (drawing ? 'Draw.' : 'Return.') + name;
            // Both tracks are exact time reversals. The handling clock also
            // carries partial progress across a reversal or an observer snapshot.
            pose.grappleTime = HEAVY_HANDOFF_TIME * handTime;
            const outgoing = f.handling?.outgoingLight;
            if (!drawing && outgoing) {
                // The logical primary swaps at the ordinary switch midpoint.
                // Keep its visual predecessor until the grapple belongs to the hip.
                const t = pose.grappleTime;
                if (t < GRAPPLE_SEAT_TIME || f.weapon === outgoing) {
                    pose.weapon = outgoing;
                    pose.action = 'Withdraw';
                    pose.actionTime = THREE.MathUtils.clamp(t - (GRAPPLE_SEAT_TIME - SWITCH_DURATION), 0, SWITCH_DURATION);
                } else {
                    pose.action = 'Equip';
                    pose.actionTime = SWITCH_DURATION * (t - GRAPPLE_SEAT_TIME) / (HEAVY_HANDOFF_TIME - GRAPPLE_SEAT_TIME);
                }
            }
        } else if (phase === 'drawn') {
            if (f.hook === 'PULLING') {
                const latched = phaseTime >= .15;
                pose.grapple = latched ? 'Grapple.Pull' : 'Grapple.Latch';
                pose.grappleTime = latched ? phaseTime - .15 : phaseTime;
            } else if (f.hook === 'FIRING') {
                pose.grapple = 'Grapple.Fire';
                pose.grappleTime = Math.min(phaseTime, 11/120);
            } else {
                pose.grapple = this.returnReaction && phaseTime < .25 ? this.returnReaction : 'Grapple.Held';
                pose.grappleTime = phaseTime;
            }
        }
        // Release the drawer from its current extension during the first part of
        // a draw or switch. Both meshes share this blend before holster contact.
        if (f.alive && !f.pilot && this.lastPose?.weapon === f.weapon &&
            (phase === 'drawing' || f.switchState === 'WITHDRAWING')) {
            if (this.lastPose.reloadProgress !== undefined) this.interruptedReload = this.lastPose.reloadProgress;
            const weight = phase === 'drawing' ? 1 - THREE.MathUtils.smoothstep(handTime, 0, .38)
                : 1 - THREE.MathUtils.smoothstep(f.switchTime ?? 0, 0, .06);
            if (this.interruptedReload !== undefined && weight > 0) {
                pose.reloadRelease = { progress: this.interruptedReload, weight };
            }
        } else this.interruptedReload = undefined;
        if (this.age-this.hurt < .26 && f.alive) pose.hitTime = this.age-this.hurt;
        this.rig.setPrimaryVisible(!f.pilot && f.alive);
        this.rig.root.position.y = f.pilot ? CYBORG_SEATED_OFFSET : PLAYER_BODY_CAMERA_OFFSET-PLAYER_HEIGHT;
        this.rig.pose(pose);
        this.lastPose = pose;
        this.ground=f.grounded; this.hover=f.hover; this.hook=f.hook==='PULLING'; this.pilot=f.pilot ?? '';
        this.yaw=f.yaw; this.lastSpeed=speed; this.lastRamp=ramp;
    }
    private sampleRun(pose: CyborgPose, dt: number, speed: number, lateral: number, forward: number): void {
        const side = Math.abs(lateral) / RUN_TRAVEL.lateral;
        const along = Math.abs(forward) / (forward >= 0 ? RUN_TRAVEL.forward : RUN_TRAVEL.backward);
        const total = side + along;
        if (side && along) {
            const sideIsPrimary = Math.abs(lateral) > Math.abs(forward);
            pose.bodyBlend = {
                name: 'Run.' + (sideIsPrimary ? (forward > 0 ? 'Forward' : 'Backward') : (lateral > 0 ? 'Right' : 'Left')),
                weight: (sideIsPrimary ? along : side) / total,
            };
        }

        // Match sole travel to world velocity during contact. A faster pilot spends
        // less time planted while keeping a readable airborne recovery between steps.
        const stride = CYBORG_SCALE * speed / total;
        const cadence = Math.min(2.6, 1.05 + .34 * Math.sqrt(speed));
        const fullStrideStance = stride * cadence / speed;
        const contact = Math.min(RUN_STANCE, fullStrideStance);
        pose.runWeight = Math.min(1, RUN_STANCE / fullStrideStance);
        this.runPhase = (this.runPhase + dt * cadence) % 1;
        const offset = this.runPhase < .5 ? 0 : .5;
        const step = this.runPhase - offset;
        const phase = step <= contact ? RUN_STANCE * step / contact
            : RUN_STANCE + (.5 - RUN_STANCE) * (step - contact) / (.5 - contact);
        pose.bodyTime = (offset + phase) * RUN_DURATION;
    }
    /** Sample the authored curved cut at fixed times for the charged ribbon. */
    bladePoints(seconds: number): THREE.Vector3[] {
        if (this.lastPose) this.rig.pose({...this.lastPose,weapon:'KATANA',action:'ChargedSwing',actionTime:seconds});
        const bottom = this.rig.grip.localToWorld(new THREE.Vector3(0,0,.135));
        const top = this.rig.tip.getWorldPosition(new THREE.Vector3());
        return [bottom,top];
    }
    get poseForView(): CyborgPose | undefined { return this.lastPose; }

    restorePose(): void { if (this.lastPose) this.rig.pose(this.lastPose); }
    ownEffect(object: THREE.Object3D): void { this.effects.push(object); }
    dispose(): void {
        actors.delete(this.shell);
        for (const effect of this.effects) {
            effect.removeFromParent();
            effect.traverse(node => {
                if (!(node instanceof THREE.Mesh)) return;
                node.geometry.dispose();
                const materials = Array.isArray(node.material) ? node.material : [node.material];
                for (const material of materials) material.dispose();
            });
        }
        this.effects.length = 0;
        this.rig.dispose();
    }
}

function direction(lateral: number, forward: number): string {
    return Math.abs(lateral)>Math.abs(forward) ? lateral>0?'Right':'Left' : forward>0?'Forward':'Backward';
}

export function attachPlayerAvatar(shell: THREE.Group, color: number): PlayerAvatarController | undefined {
    let avatar = actors.get(shell);
    if (!avatar && cyborgAssetsReady()) { avatar = new PlayerAvatarController(shell,color); actors.set(shell,avatar); }
    return avatar;
}
export function getPlayerAvatar(shell?: THREE.Group | null): PlayerAvatarController | undefined {
    return shell ? actors.get(shell) : undefined;
}

export function bindAvatarEffects(controller:PlayerAvatarController, left:THREE.Object3D, weapons:Record<string,THREE.Object3D>): void {
    const rig = controller.rig;
    if (left.userData.grappleMuzzle) return;
    left.userData.grappleMuzzle = rig.grappleMuzzle;
    function fitFlash(logical:THREE.Object3D,muzzle:THREE.Object3D):void {
        const fx=logical.userData.muzzleFlashEffect;
        for (const ring of fx?.frames ?? []) {
            controller.ownEffect(ring); muzzle.add(ring); ring.position.set(0,0,0); ring.rotation.x=Math.PI/2;
        }
    }
    attachGrappleMuzzleShockwave(left,[0,0,0],GRAPPLE_BLUE);
    fitFlash(left,rig.grappleMuzzle);
    for (const [key,logical] of Object.entries(weapons)) {
        logical.userData.onAvatarFire=()=>controller.shot();
        if (key==='KATANA') {
            const light=createKatanaLightning();
            light.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(
                new THREE.Vector3(0,-1,0),new THREE.Vector3(0,0,1),new THREE.Vector3(-1,0,0)));
            light.scale.setScalar(.82);
            controller.ownEffect(light);
            rig.props.KATANA.add(light);
            logical.userData.lightning = light;
            logical.userData.fittedBlade = rig.bladeMaterial;
            logical.userData.avatar = controller;
        } else {
            const stats=WEAPON_STATS[key];
            attachMuzzleShockwave(logical,[0,0,0],stats.bulletColor,stats.muzzleFlashSize);
            fitFlash(logical,rig.muzzleFor(key));
        }
    }
}
