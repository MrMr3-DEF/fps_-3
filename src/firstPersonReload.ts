import * as THREE from 'three';
import { CYBORG_SCALE, PLAYER_HEIGHT } from './config.js';
import type { CyborgAvatar, CyborgPose } from './cyborgAvatar.js';

// Only the sleeve is fitted to the bottom of the holder frame. Keeping an
// exact wrist matrix preserves every independently animated finger and socket.
class CameraSleeve {
    private wrist?: THREE.Object3D;
    private readonly from = new THREE.Vector3();
    private readonly to = new THREE.Vector3();
    private readonly pivot = new THREE.Vector3();
    private readonly goal = new THREE.Vector3();
    private readonly rot = new THREE.Quaternion();
    private readonly map = new THREE.Matrix4();
    private readonly handWorld = new THREE.Matrix4();

    fit(hand: THREE.Object3D, side: number, camera: THREE.PerspectiveCamera): void {
        const sleeve = hand.parent!;
        hand.getWorldPosition(this.pivot);
        sleeve.getWorldPosition(this.from);
        this.goal.copy(this.from).applyMatrix4(camera.matrixWorldInverse);
        const elbowDepth = -this.goal.z;
        const lens = camera.projectionMatrix.elements;
        const elbowY = lens[5]*this.goal.y/Math.max(.001,elbowDepth)-lens[9];
        if (elbowDepth <= camera.near || elbowY < -1.32) return;
        this.goal.copy(this.pivot).applyMatrix4(camera.matrixWorldInverse);
        const wristDepth = -this.goal.z;
        if (wristDepth <= camera.near) return;
        const wristX = lens[0]*this.goal.x/wristDepth-lens[8];
        const x = THREE.MathUtils.clamp(wristX+side*.65/camera.aspect,-1.15,1.15);
        const depth = THREE.MathUtils.clamp(elbowDepth, Math.max(camera.near+.04,.65*wristDepth),wristDepth);
        this.goal.set((x+lens[8])*depth/lens[0],(-1.38+lens[9])*depth/lens[5],-depth).applyMatrix4(camera.matrixWorld);
        // Approaching the lower crop from below must not cause a sideways pop.
        this.goal.lerp(this.from,1-THREE.MathUtils.smoothstep(elbowY,-1.32,-1.04));
        this.from.sub(this.pivot); this.to.copy(this.goal).sub(this.pivot);
        const oldLength=this.from.length(), length=this.to.length();
        if (oldLength<1e-5 || length<1e-5) return;
        this.from.multiplyScalar(1/oldLength); this.to.multiplyScalar(1/length);
        this.rot.setFromUnitVectors(this.from,this.to);
        this.map.makeRotationFromQuaternion(this.rot);
        // Rotate around the cuff and extend only along its long axis. Cross
        // sections keep their original width, even on a narrow portrait lens.
        const elements = this.map.elements, stretch=length/oldLength-1;
        for (let col=0;col<3;col++) for (let row=0;row<3;row++) {
            elements[col*4+row] += stretch*this.to.getComponent(row)*this.from.getComponent(col);
        }
        this.map.setPosition(this.goal.copy(this.pivot).sub(this.to.copy(this.pivot).applyMatrix4(this.map)));
        this.handWorld.copy(hand.matrixWorld);
        this.map.multiply(sleeve.matrixWorld);
        sleeve.matrixAutoUpdate = hand.matrixAutoUpdate = false;
        sleeve.matrix.copy(sleeve.parent!.matrixWorld).invert().multiply(this.map);
        hand.matrix.copy(this.map).invert().multiply(this.handWorld);
        sleeve.updateWorldMatrix(false,true);
        this.wrist = hand;
    }

    restore(): void {
        if (!this.wrist) return;
        const sleeve = this.wrist.parent!;
        sleeve.matrixAutoUpdate = this.wrist.matrixAutoUpdate = true;
        sleeve.updateWorldMatrix(false,true);
        this.wrist = undefined;
    }
}

const faceForward = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,1,0),Math.PI);
type PublishedSockets = {
    camera: THREE.PerspectiveCamera; weapon: string; primary: THREE.Vector3; grapple: THREE.Vector3;
};
const published = new WeakMap<CyborgAvatar, PublishedSockets>();

/** Camera-local samples follow the current eye between frames. Each point projects onto
 * the visible aperture through the gameplay lens, including during optical zoom. */
export function getHolderMuzzlePosition(rig: CyborgAvatar, weapon: string, out: THREE.Vector3): boolean {
    const sockets = published.get(rig);
    if (!sockets || (weapon !== sockets.weapon && weapon !== 'GRAPPLE')) return false;
    out.copy(weapon === 'GRAPPLE' ? sockets.grapple : sockets.primary);
    sockets.camera.localToWorld(out);
    return true;
}

/** Present the fitted hands and prop as one rig. The physical pose and all its sockets
 * are restored before simulation, multiplayer and third-person rendering resume. */
export class FirstPersonReloadFrame {
    readonly camera = new THREE.PerspectiveCamera();
    private readonly scene = new THREE.Scene();
    private displayed?: CyborgAvatar;
    private pose?: CyborgPose;
    private drawn?: CyborgAvatar;
    private readonly originalRotation = new THREE.Quaternion();
    private readonly parentRotation = new THREE.Quaternion();
    private originalVisibility = true;
    private readonly sway = new THREE.Vector2();
    private readonly points = [new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()];
    private readonly offset = new THREE.Vector3();
    private readonly desired = new THREE.Vector3();
    private readonly releaseStart = new THREE.Vector3();
    private releaseTime = .12;
    private readonly original = new THREE.Vector3();
    private readonly position = new THREE.Vector3();
    private readonly sleeves = [new CameraSleeve(),new CameraSleeve()];

    clear(): void {
        this.restore();
        if (this.displayed) published.delete(this.displayed);
        this.displayed = undefined;
        this.sway.set(0,0);
        this.offset.set(0,0,0);
        this.releaseTime = .12;
        this.scene.environment = null;
    }

    begin(rig: CyborgAvatar, worldCamera: THREE.PerspectiveCamera, pose: CyborgPose, delta: number): void {
        this.restore();
        if (this.displayed !== rig) this.clear();
        const parent = rig.root.parent;
        if (!parent) return;
        this.drawn = this.displayed = rig;
        this.pose = pose;
        this.original.copy(rig.root.position);
        this.originalRotation.copy(rig.root.quaternion);
        this.originalVisibility = rig.root.visible;
        worldCamera.updateWorldMatrix(true,false);
        const camera = this.camera;
        camera.aspect = worldCamera.aspect;
        camera.near = worldCamera.near;
        camera.far = worldCamera.far;
        worldCamera.getWorldPosition(camera.position);
        worldCamera.getWorldQuaternion(camera.quaternion);
        camera.fov = Math.max(65,worldCamera.getEffectiveFOV());
        camera.zoom = 1;
        camera.updateProjectionMatrix();
        camera.updateMatrixWorld(true);
        const dt = THREE.MathUtils.clamp(delta,0,.1);
        const run = pose.body.startsWith('Run.') && !pose.reducedMotion ? pose.runWeight ?? 1 : 0;
        const phase = 2 * Math.PI * pose.bodyTime / .5; // one complete baked running cycle
        const ease = 1 - Math.exp(-14*dt);
        this.sway.x += (.010*CYBORG_SCALE*run*Math.sin(phase)-this.sway.x)*ease;
        this.sway.y += (.0076*CYBORG_SCALE*run*Math.cos(2*phase)-this.sway.y)*ease;
        // Keep the katana at its authored eye-relative reach so swings stay
        // aligned with the world slash arc, while still isolating it from
        // full-body locomotion twist and depth-based camera motion blur.
        const isKatana = pose.weapon === 'KATANA';
        this.position.set(
            this.sway.x,
            -PLAYER_HEIGHT + (isKatana ? 0 : .135 * CYBORG_SCALE) + this.sway.y,
            isKatana ? 0 : -.337 * CYBORG_SCALE,
        ).applyQuaternion(camera.quaternion).add(camera.position);
        rig.root.position.copy(parent.worldToLocal(this.position));
        parent.getWorldQuaternion(this.parentRotation);
        rig.root.quaternion.copy(this.parentRotation).invert().multiply(camera.quaternion).multiply(faceForward);
        // Full-body pitch pivots at the spine and locomotion swings the pelvis. Neither
        // belongs between an eye and its held objects. Sample the same upper-body clips.
        rig.pose({...pose, body:'Idle.Armed', bodyTime:0, actionTime:pose.actionTime ?? pose.bodyTime,
            bodyBlend:undefined, runWeight:undefined, pitch:0, hitTime:undefined});
        const progress = pose.reloadProgress;
        const drawer = rig.drawerGrip;
        if (progress !== undefined && drawer) {
            const [lid, right, left] = this.points;
            drawer.getWorldPosition(lid).applyMatrix4(camera.matrixWorldInverse);
            rig.grip.getWorldPosition(right).applyMatrix4(camera.matrixWorldInverse);
            rig.leftGrip.getWorldPosition(left).applyMatrix4(camera.matrixWorldInverse);
            const projection = camera.projectionMatrix.elements;
            const fx = projection[0], fy = projection[5], depth = -lid.z;
            // Keep some of the authored side-to-side motion. A close or pitched
            // socket can otherwise project behind the eye or across the reticle.
            const x = THREE.MathUtils.clamp(.55*(fx*lid.x/Math.max(.15,depth)-projection[8]),-.28,.32);
            const y = THREE.MathUtils.clamp(-.32+.14*(fy*lid.y/Math.max(.15,depth)-projection[9]+.32),-.46,-.20);
            const slopeX = (x+projection[8])/fx, slopeY = (y+projection[9])/fy;
            // Frame the drawer and both hands at their fitted size across aspect ratios.
            let forward = Math.max(0, .59 * CYBORG_SCALE * fy * Math.tan(THREE.MathUtils.degToRad(75/2)) - depth);
            for (const point of this.points) {
                const d = -point.z;
                // With the lid on its chosen screen ray, each other point's
                // projected offset is proportional to 1 / (d + forward).
                const dx = point.x-lid.x-slopeX*(d-depth), dy = point.y-lid.y-slopeY*(d-depth);
                const marginX = dx < 0 ? x+.86 : .86-x;
                const marginY = dy < 0 ? y+.82 : .48-y;
                forward = Math.max(forward, camera.near+.14-d,
                    (Math.abs(dx)+.055*CYBORG_SCALE)*fx/marginX-d,
                    (Math.abs(dy)+.055*CYBORG_SCALE)*fy/marginY-d);
            }
            const weight = THREE.MathUtils.smoothstep(progress,0,.16)*(1-THREE.MathUtils.smoothstep(progress,.83,1));
            this.desired.set(slopeX*(depth+forward)-lid.x,slopeY*(depth+forward)-lid.y,-forward).multiplyScalar(weight);
            this.offset.lerp(this.desired,1-Math.exp(-42*dt));
            this.releaseStart.copy(this.offset);
            this.releaseTime = 0;
        } else if (this.releaseTime < .12) {
            this.releaseTime = Math.min(.12,this.releaseTime+dt);
            this.offset.copy(this.releaseStart).multiplyScalar(1-THREE.MathUtils.smoothstep(this.releaseTime,0,.12));
        }
        if (this.offset.lengthSq() > 1e-10) {
            rig.root.getWorldPosition(this.position);
            this.position.add(this.desired.copy(this.offset).applyQuaternion(camera.quaternion));
            rig.root.position.copy(parent.worldToLocal(this.position));
        }
        this.sleeves[0].fit(rig.wrists[0],-1,camera);
        this.sleeves[1].fit(rig.wrists[1],1,camera);
        rig.root.updateMatrixWorld(true);
        let sockets = published.get(rig);
        if (!sockets) {
            sockets = {camera:worldCamera, weapon:pose.weapon, primary:new THREE.Vector3(), grapple:new THREE.Vector3()};
            published.set(rig,sockets);
        }
        sockets.camera = worldCamera;
        sockets.weapon = pose.weapon;
        rig.muzzle.getWorldPosition(sockets.primary).project(camera).applyMatrix4(worldCamera.projectionMatrixInverse);
        rig.grappleMuzzle.getWorldPosition(sockets.grapple).project(camera).applyMatrix4(worldCamera.projectionMatrixInverse);
        rig.root.visible = false;
    }

    render(renderer: THREE.WebGLRenderer, world: THREE.Scene): void {
        const rig = this.drawn;
        if (!rig || !this.originalVisibility) return;
        // The foreground scene references the fitted hierarchy in place. Its bones keep
        // their world matrices and the same sunlight as the rest of the arena.
        this.scene.matrixWorldAutoUpdate = false;
        this.scene.children.push(rig.root);
        for (const child of world.children) if (child instanceof THREE.Light) this.scene.children.push(child);
        this.scene.environment = world.environment;
        const clear = renderer.autoClear, shadows = renderer.shadowMap.autoUpdate, needsShadow = renderer.shadowMap.needsUpdate;
        try {
            rig.root.visible = true;
            renderer.autoClear = false;
            renderer.shadowMap.autoUpdate = renderer.shadowMap.needsUpdate = false;
            renderer.clearDepth();
            renderer.render(this.scene,this.camera);
        } finally {
            rig.root.visible = false;
            this.scene.children.length = 0;
            renderer.shadowMap.autoUpdate = shadows;
            renderer.shadowMap.needsUpdate = needsShadow;
            renderer.autoClear = clear;
        }
    }

    restore(): void {
        for (const sleeve of this.sleeves) sleeve.restore();
        const rig = this.drawn;
        if (!rig || !this.pose) return;
        rig.root.position.copy(this.original);
        rig.root.quaternion.copy(this.originalRotation);
        rig.root.visible = this.originalVisibility;
        rig.pose(this.pose);
        rig.root.updateMatrixWorld(true);
        this.drawn = undefined;
        this.pose = undefined;
    }
}
