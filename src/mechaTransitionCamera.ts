import * as THREE from 'three';
import { MECHA_BOARD_TIME, MECHA_CAMERA_DISTANCE, MECHA_CAMERA_HEIGHT, MECHA_HEIGHT,
    MECHA_RELEASE_CAMERA_TIME, MECHA_TRANSITION_CAMERA_MARGIN, THIRD_PERSON_CAMERA_COLLISION_RADIUS } from './config.js';
import { resolveCameraObstruction } from './thirdPersonCamera.js';
import type { MechaMode } from './forgottenMecha.js';
import type { MechaHeadPhase } from './mechaHeadView.js';

const ease = (t: number) => { t = THREE.MathUtils.clamp(t, 0, 1); return t * t * (3 - 2 * t); };

/** Presentation follows the actor clock without delaying Mount or control
 * ownership. Captured perspective also locks first-person transitions. */
export class MechaTransitionCamera {
    phase: 'inactive' | 'swivel' | 'front' | 'return' | 'release' = 'inactive';
    thirdPerson = false;
    recovering = false;
    readonly position = new THREE.Vector3();
    readonly quaternion = new THREE.Quaternion();
    private kind: 'entry' | 'exit' = 'entry';
    private elapsed = 0;
    private blend = 0;
    private hasView = false;
    private secondaryBlocked = false;
    private readonly start = new THREE.Vector3();
    private readonly startQuaternion = new THREE.Quaternion();
    private readonly targetQuaternion = new THREE.Quaternion();
    private readonly center = new THREE.Vector3();
    private readonly front = new THREE.Vector3();
    private readonly relative = new THREE.Vector3();
    private readonly desired = new THREE.Vector3();
    private readonly matrix = new THREE.Matrix4();
    get locked(): boolean { return this.phase !== 'inactive'; }
    get external(): boolean { return this.locked && this.thirdPerson; }
    recordView(position: THREE.Vector3, quaternion: THREE.Quaternion): void {
        this.position.copy(position); this.quaternion.copy(quaternion); this.hasView = true;
    }
    begin(kind: 'entry' | 'exit', thirdPerson: boolean, position: THREE.Vector3, quaternion: THREE.Quaternion, secondaryHeld = false): void {
        this.kind = kind; this.thirdPerson = thirdPerson; this.recovering = false;
        this.start.copy(this.hasView ? this.position : position);
        this.startQuaternion.copy(this.hasView ? this.quaternion : quaternion);
        this.phase = 'swivel'; this.elapsed = this.blend = 0;
        // A secondary button held before boarding must be released before it
        // can scope again; an ignored press must not become a delayed zoom.
        this.secondaryBlocked ||= secondaryHeld;
    }
    acceptSecondary(held: boolean): boolean {
        if (!held) this.secondaryBlocked = false;
        else if (this.locked) this.secondaryBlocked = true;
        return held && !this.locked && !this.secondaryBlocked;
    }
    update(delta: number): void {
        if (!this.locked || !Number.isFinite(delta) || delta <= 0) return;
        this.elapsed += delta;
        if (this.phase === 'release') {
            if (this.elapsed + 1e-9 >= MECHA_RELEASE_CAMERA_TIME) this.finish();
        } else if (this.phase === 'swivel' && this.elapsed + 1e-9 >= MECHA_BOARD_TIME) this.phase = 'front';
    }
    sync(mode: MechaMode, phase: MechaHeadPhase, reveal: number, recovering: boolean): void {
        if (!this.locked || this.phase === 'release') return;
        if (mode === 'piloted') { this.finish(); return; }
        if (mode === 'startup' && this.kind === 'exit') this.recovering = recovering;
        if (mode === 'startup' && phase === 'reveal') { this.phase = 'return'; this.blend = reveal; }
        if (!['boarding', 'startup', 'shutting-down'].includes(mode)) this.reset();
    }
    release(): void {
        if (!this.thirdPerson) { this.finish(); return; }
        this.phase = 'release'; this.elapsed = 0;
    }
    private finish(): void { this.phase = 'inactive'; this.recovering = false; }
    reset(): void { this.finish(); this.hasView = this.secondaryBlocked = false; this.elapsed = this.blend = 0; }
    framingDistance(radius: number, fov: number, aspect: number): number {
        const vertical = THREE.MathUtils.degToRad(fov) / 2;
        const horizontal = Math.atan(Math.tan(vertical) * aspect);
        return Math.hypot(radius, MECHA_HEIGHT / 2) * MECHA_TRANSITION_CAMERA_MARGIN / Math.sin(Math.min(vertical, horizontal));
    }
    queryRadius(origin: THREE.Vector3, radius: number, fov: number, aspect: number): number {
        return Math.max(65, this.framingDistance(radius, fov, aspect) + 5,
            this.start.distanceTo(origin) + 5, this.position.distanceTo(origin) + 5);
    }
    private orbit(from: THREE.Vector3, to: THREE.Vector3, t: number): void {
        this.relative.subVectors(from, this.center);
        const length = this.relative.length(), yaw = Math.atan2(this.relative.x, this.relative.z);
        const elevation = Math.atan2(this.relative.y, Math.hypot(this.relative.x, this.relative.z));
        this.relative.subVectors(to, this.center);
        const endYaw = Math.atan2(this.relative.x, this.relative.z);
        const turn = THREE.MathUtils.euclideanModulo(endYaw - yaw + Math.PI, Math.PI * 2) - Math.PI;
        const angle = yaw + turn * t;
        const pitch = THREE.MathUtils.lerp(elevation, Math.atan2(this.relative.y, Math.hypot(this.relative.x, this.relative.z)), t);
        const distance = THREE.MathUtils.lerp(length, this.relative.length(), t);
        this.desired.set(Math.sin(angle) * Math.cos(pitch), Math.sin(pitch), Math.cos(angle) * Math.cos(pitch))
            .multiplyScalar(distance).add(this.center);
    }
    /** Normal follow pose is an endpoint, never the logical player camera.
     * A second sweep stops the swivel crossing cover between rendered frames. */
    resolve(origin: THREE.Vector3, heading: number, radius: number, fov: number, aspect: number,
        normalPosition: THREE.Vector3, normalQuaternion: THREE.Quaternion, obstacles: readonly THREE.Object3D[]): void {
        this.center.copy(origin); this.center.y += MECHA_HEIGHT / 2;
        const distance = this.framingDistance(radius, fov, aspect);
        const elevation = Math.atan2(MECHA_CAMERA_HEIGHT, MECHA_CAMERA_DISTANCE);
        this.front.set(Math.sin(heading) * Math.cos(elevation), Math.sin(elevation), Math.cos(heading) * Math.cos(elevation))
            .multiplyScalar(distance).add(this.center);
        const t = this.phase === 'swivel' ? ease(this.elapsed / MECHA_BOARD_TIME) : this.phase === 'return' ? ease(this.blend) : 1;
        if (this.phase === 'return') this.orbit(this.front, normalPosition, t);
        else this.orbit(this.start, this.front, t);
        this.desired.y = Math.max(THIRD_PERSON_CAMERA_COLLISION_RADIUS, this.desired.y);
        resolveCameraObstruction(this.center, this.desired, obstacles, this.desired);
        resolveCameraObstruction(this.hasView ? this.position : this.start, this.desired, obstacles, this.position);
        this.matrix.lookAt(this.position, this.center, THREE.Object3D.DEFAULT_UP);
        this.quaternion.setFromRotationMatrix(this.matrix);
        if (this.phase === 'swivel') {
            this.targetQuaternion.copy(this.quaternion);
            this.quaternion.slerpQuaternions(this.startQuaternion, this.targetQuaternion, t);
        }
        else if (this.phase === 'return') this.quaternion.slerp(normalQuaternion, t);
    }
}
