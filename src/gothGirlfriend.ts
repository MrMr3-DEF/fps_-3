import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import type { TownBuilding } from './town.js';
import { PLAYER_HEIGHT } from './config.js';
import { state } from './state.js';

/** The lobby creator is the host; joined players only see the idle character. */
export function canUseGothChat(session: { isMultiplayer: boolean; isHost: boolean }): boolean {
    return !session.isMultiplayer || session.isHost;
}

export const GOTH_GESTURES = ['Wave', 'Explain', 'Shrug', 'Agree'] as const;
export type GothGesture = typeof GOTH_GESTURES[number];
export const GOTH_INTERACTION_RANGE = 4;
// The visible bean avatar is 2.2 units tall at its 1.5 world scale (3.3 total).
export const GOTH_MODEL_HEIGHT = 3.3 * 1.08;
export const GOTH_FACE_HEIGHT = GOTH_MODEL_HEIGHT * 0.9;
export const GOTH_CONVERSATION_DISTANCE = 3.2;

/** Fit the supplied asset uniformly and keep the soles on the placement plane. */
export function fitGothModel(model: THREE.Object3D): void {
    model.updateMatrixWorld(true);
    const bounds = new THREE.Box3().setFromObject(model);
    const height = bounds.max.y - bounds.min.y;
    if (!Number.isFinite(height) || height <= 0) throw new Error('Goth character has invalid model bounds');
    const scale = GOTH_MODEL_HEIGHT / height;
    model.scale.multiplyScalar(scale);
    model.updateMatrixWorld(true);
    bounds.setFromObject(model);
    model.position.y -= bounds.min.y;
    model.updateMatrixWorld(true);
}

export function getGothConversationPose(group: THREE.Object3D): { position: THREE.Vector3; lookAt: THREE.Vector3 } {
    const position = new THREE.Vector3(0, 0, GOTH_CONVERSATION_DISTANCE).applyQuaternion(group.quaternion).add(group.position);
    position.y = PLAYER_HEIGHT;
    const lookAt = group.position.clone();
    lookAt.y += GOTH_FACE_HEIGHT;
    return { position, lookAt };
}
const durations: Record<GothGesture, number> = { Wave: 3.2, Explain: 3.8, Shrug: 3, Agree: 3.4 };
const modelUrl = new URL('../blender_assets/Goth Girl - Makeup Rigged.glb', import.meta.url).href;

export function getGothPlacement(building: TownBuilding): { position: THREE.Vector3; yaw: number } {
    const position = new THREE.Vector3(building.x, 0.035, building.z);
    position[building.doorAxis] += building.doorSide * 2;
    const yaw = building.doorAxis === 'x' ? -building.doorSide * Math.PI / 2 : building.doorSide === 1 ? Math.PI : 0;
    return { position, yaw };
}

/** The export has disconnected DEF chains (Rigify constraints aren't in glTF).
 * Reconnect them in the bind pose so fingers follow wrists and hair follows the head. */
export function connectGothRig(model: THREE.Object3D): Map<string, THREE.Bone> {
    const bones = new Map<string, THREE.Bone>();
    model.traverse(node => { if (node instanceof THREE.Bone) bones.set(node.name, node); });
    // GLTFLoader sanitizes dots in names; use the same normalization for lookup.
    const bone = (name: string) => {
        const found = bones.get(THREE.PropertyBinding.sanitizeNodeName(name));
        if (!found) throw new Error(`Goth character is missing rig bone ${name}`);
        return found;
    };
    model.updateMatrixWorld(true);
    for (const side of ['L', 'R']) {
        bone('DEF-spine.003').attach(bone(`DEF-shoulder.${side}`));
        bone(`DEF-shoulder.${side}`).attach(bone(`DEF-upper_arm.${side}`));
        for (const finger of ['f_index', 'f_middle', 'f_ring', 'f_pinky', 'thumb']) {
            bone(`DEF-hand.${side}`).attach(bone(`DEF-${finger}.01.${side}`));
        }
    }
    for (const name of ['back.C', 'back.L', 'back.R', 'front.L', 'front.R']) {
        bone('DEF-spine.006').attach(bone(`DEF-hair.${name}.01`));
    }
    model.updateMatrixWorld(true);
    return bones;
}

/** Procedural FK on the supplied skin; legs stay planted through every gesture. */
export class GothAnimator {
    private bones: Map<string, THREE.Bone>;
    private rest = new Map<THREE.Bone, THREE.Quaternion>();
    private elapsed = 0;
    private clock = 0;
    private lastGesture = -1;
    gesture: GothGesture | null = null;
    private direction = new THREE.Vector3();
    private currentDirection = new THREE.Vector3();
    private rotation = new THREE.Quaternion();
    private parentRotation = new THREE.Quaternion();
    private modelRotation = new THREE.Quaternion();
    private deltaRotation = new THREE.Quaternion();
    private euler = new THREE.Euler();
    private model: THREE.Object3D;

    constructor(model: THREE.Object3D) {
        this.model = model;
        this.bones = connectGothRig(model);
        this.bones.forEach(bone => this.rest.set(bone, bone.quaternion.clone()));
        this.update(0);
    }

    private bone(name: string): THREE.Bone {
        return this.bones.get(THREE.PropertyBinding.sanitizeNodeName(name))!;
    }

    play(gesture?: GothGesture, interrupt = false): boolean {
        if (this.gesture && !interrupt) return false;
        let index = gesture ? GOTH_GESTURES.indexOf(gesture) : Math.floor(Math.random() * (GOTH_GESTURES.length - (this.lastGesture >= 0 ? 1 : 0)));
        if (!gesture && this.lastGesture >= 0 && index >= this.lastGesture) index++;
        this.lastGesture = index;
        this.gesture = GOTH_GESTURES[index];
        this.elapsed = 0;
        return true;
    }

    private bend(name: string, x: number, y: number, z: number): void {
        this.bone(name).quaternion.multiply(this.deltaRotation.setFromEuler(this.euler.set(x, y, z)));
    }

    private aim(name: string, x: number, y: number, z: number): void {
        const bone = this.bone(name);
        bone.getWorldQuaternion(this.rotation);
        this.currentDirection.set(0, 1, 0).applyQuaternion(this.rotation);
        this.direction.set(x, y, z).normalize().applyQuaternion(this.modelRotation);
        this.deltaRotation.setFromUnitVectors(this.currentDirection, this.direction);
        bone.parent!.getWorldQuaternion(this.parentRotation).invert();
        bone.quaternion.copy(this.parentRotation.multiply(this.deltaRotation).multiply(this.rotation));
    }

    update(delta: number): void {
        this.clock += delta;
        this.elapsed += delta;
        if (this.gesture && this.elapsed >= durations[this.gesture]) this.gesture = null;
        this.rest.forEach((rotation, bone) => bone.quaternion.copy(rotation));
        const t = this.elapsed;
        const duration = this.gesture ? durations[this.gesture] : 0;
        const smooth = (x: number) => { const v = THREE.MathUtils.clamp(x, 0, 1); return v * v * (3 - 2 * v); };
        const weight = this.gesture ? smooth(t / 0.6) * smooth((duration - t) / 0.65) : 0;
        const beat = Math.sin(t * 5);
        this.bend('DEF-spine.003', Math.sin(this.clock * 1.8) * 0.009, 0, Math.sin(this.clock * 1.2) * 0.012);
        if (this.gesture === 'Agree') this.bend('DEF-spine.006', Math.sin(t * 5) * 0.10 * weight, 0, -0.04 * weight);
        if (this.gesture === 'Explain') this.bend('DEF-spine.003', 0.025 * weight, Math.sin(t * 2.2) * 0.055 * weight, 0);
        if (this.gesture === 'Shrug') this.bend('DEF-spine.006', 0, 0, 0.10 * weight);
        this.model.getWorldQuaternion(this.modelRotation);
        for (const side of ['L', 'R']) {
            const sign = side === 'L' ? 1 : -1;
            let upper = [sign * 0.23, -1, 0.03];
            let forearm = [sign * 0.08, -1, 0.18];
            if (this.gesture === 'Wave' && side === 'R') {
                upper = [-0.85, 0.1, 0.12];
                forearm = [-0.12 + Math.sin(t * 9) * 0.24, 1, 0.12];
            } else if (this.gesture === 'Explain') {
                upper = [sign * 0.4, -0.85, 0.25];
                forearm = [sign * (0.4 + beat * 0.12), 0.15 + Math.sin(t * 5 + sign) * 0.15, 0.9];
            } else if (this.gesture === 'Shrug') {
                upper = [sign * 0.65, -0.8, 0.08];
                forearm = [sign * 0.65, 0.6, 0.55];
            } else if (this.gesture === 'Agree' && side === 'L') {
                upper = [0.3, -1, 0.2];
                forearm = [-0.2, 0.35 + beat * 0.15, 0.9];
            }
            this.aim(`DEF-upper_arm.${side}`, THREE.MathUtils.lerp(sign * 0.23, upper[0], weight), THREE.MathUtils.lerp(-1, upper[1], weight), THREE.MathUtils.lerp(0.03, upper[2], weight));
            this.aim(`DEF-forearm.${side}`, THREE.MathUtils.lerp(sign * 0.08, forearm[0], weight), THREE.MathUtils.lerp(-1, forearm[1], weight), THREE.MathUtils.lerp(0.18, forearm[2], weight));
            // Roll the resting forearm so the palm faces the thigh, rather than forward.
            // Blend out only on a gesturing arm; the other hand keeps its relaxed pose.
            const gesturing = this.gesture === 'Explain' || this.gesture === 'Shrug'
                || (this.gesture === 'Wave' && side === 'R') || (this.gesture === 'Agree' && side === 'L');
            this.bend(`DEF-forearm.${side}`, 0, sign * Math.PI * 0.35 * (gesturing ? 1 - weight : 1), 0);
            if (this.gesture === 'Wave' && side === 'R') this.bend('DEF-hand.R', 0, 0, Math.sin(t * 9) * 0.17 * weight);
            if (this.gesture === 'Shrug' || this.gesture === 'Explain') this.bend(`DEF-hand.${side}`, -0.15 * weight, sign * 0.5 * weight, 0);
        }
        this.model.updateMatrixWorld(true);
    }
}

function disposeModel(model: THREE.Object3D): void {
    const resources = new Set<{ dispose(): void }>();
    model.traverse(node => {
        if (!(node instanceof THREE.Mesh)) return;
        resources.add(node.geometry);
        if (node instanceof THREE.SkinnedMesh) resources.add(node.skeleton);
        for (const material of Array.isArray(node.material) ? node.material : [node.material]) {
            resources.add(material);
            for (const value of Object.values(material)) if (value instanceof THREE.Texture) resources.add(value);
        }
    });
    resources.forEach(resource => resource.dispose());
}

export class GothGirlfriend {
    readonly group = new THREE.Group();
    animator: GothAnimator | null = null;
    loadError = false;
    private disposed = false;
    private model: THREE.Object3D | null = null;
    private target = new THREE.Vector3();
    private direction = new THREE.Vector3();
    private ray = new THREE.Raycaster();

    constructor(building: TownBuilding) {
        const placement = getGothPlacement(building);
        this.group.name = 'Goth girlfriend';
        this.group.position.copy(placement.position);
        this.group.rotation.y = placement.yaw;
        // Soft interior fill keeps her dark outfit readable under the house's roof.
        const fill = new THREE.PointLight(0xdac7ef, 9, 9, 2);
        fill.position.set(0, 2.8, 2);
        this.group.add(fill);
    }

    async load(): Promise<void> {
        try {
            const gltf = await new GLTFLoader().loadAsync(modelUrl);
            if (this.disposed) { disposeModel(gltf.scene); return; }
            this.model = gltf.scene;
            // Compare against the visible player model, rather than the camera's eye height.
            fitGothModel(this.model);
            this.group.add(this.model);
            this.animator = new GothAnimator(this.model);
            this.model.traverse(node => {
                if (node instanceof THREE.Mesh) {
                    node.castShadow = true;
                    node.receiveShadow = true;
                    // A single nearby NPC: avoid rest-pose bounds clipping raised hands.
                    node.frustumCulled = false;
                }
            });
        } catch (error) {
            if (!this.disposed) {
                this.loadError = true;
                console.error('Unable to load goth girlfriend', error);
            }
        }
    }

    canInteract(camera: THREE.Camera, obstacles: THREE.Object3D[]): boolean {
        if (!canUseGothChat(state) || !this.animator || this.disposed) return false;
        this.target.copy(this.group.position).y += GOTH_FACE_HEIGHT;
        this.direction.subVectors(this.target, camera.position);
        const distance = this.direction.length();
        if (distance > GOTH_INTERACTION_RANGE || distance < 0.01) return false;
        this.direction.divideScalar(distance);
        camera.getWorldDirection(this.target);
        if (this.target.dot(this.direction) < 0.75) return false;
        this.ray.set(camera.position, this.direction);
        this.ray.far = distance;
        // Collision proxies are deliberately invisible but still raycastable.
        return this.ray.intersectObjects(obstacles, false).length === 0;
    }

    interact(camera: THREE.Camera, obstacles: THREE.Object3D[]): boolean {
        if (!this.canInteract(camera, obstacles)) return false;
        this.talkingPending = false;
        return this.animator!.play('Wave', true);
    }

    private talkingPending = false;
    private lastTalk = -1;

    startTalking(): void { this.talkingPending = true; }

    update(delta: number): void {
        this.animator?.update(delta);
        if (delta > 0 && this.talkingPending && this.animator && !this.animator.gesture) {
            let index = Math.floor(Math.random() * (this.lastTalk < 0 ? 3 : 2));
            if (this.lastTalk >= 0 && index >= this.lastTalk) index++;
            this.lastTalk = index;
            this.animator.play((['Explain', 'Shrug', 'Agree'] as const)[index]);
            this.talkingPending = false;
        }
    }

    dispose(): void {
        this.disposed = true;
        this.group.removeFromParent();
        if (this.model) disposeModel(this.model);
        this.group.clear();
        this.animator = null;
        this.model = null;
    }
}
