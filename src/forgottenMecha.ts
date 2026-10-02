import * as THREE from 'three';
import { GLTFLoader, type GLTF } from 'three/addons/loaders/GLTFLoader.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { MECHA_HEIGHT, MECHA_HP, MECHA_STOMP_RADIUS, MECHA_STOMP_COOLDOWN, MECHA_TORSO_YAW_SPEED, LAVA_POOL_HALF_SIZE } from './config.js';
import { obstacleData } from './userDataTypes.js';
import { MechaNavigation, type NavigationBox, type MechaRoute } from './mechaNavigation.js';
import { MechaFootPlant } from './mechaFootPlant.js';
import { MechaCombat, classifyMechaAttack } from './mechaCombat.js';
import { segmentRoundedBoxHitT } from './gameplayMath.js';
import type { MechaWeaponHit } from './damage.js';
import { MECHA_BOARD_TIME, MECHA_HUD_FADE_TIME, MECHA_VISION_REVEAL_TIME, MECHA_INTERIOR_VIEW_BACK, MECHA_ROCKET_BORE_FIT, MECHA_ROCKET_SHOT_TIME, MECHA_ROCKET_FIRE_TIME, MECHA_LAVA_INTERVAL, MECHA_LAVA_DAMAGE, WEAPON_STATS } from './config.js';
import { MechaPilot } from './mechaPilot.js';
import { MechaHeadView } from './mechaHeadView.js';
import { MechaHeadEffects } from './mechaHeadEffects.js';
import type { RocketObstacleQuery, RocketPlayer } from './mechaRockets.js';
import { MECHA_ENEMY_ROCKET_DAMAGE, MECHA_ENEMY_ROCKET_TURN_SPEED, MECHA_ENEMY_ROCKET_GUIDANCE_RESPONSE, MECHA_ROCKET_SPEED } from './config.js';
import { MechaMovement } from './mechaMovement.js';
import { MECHA_MOVEMENT_MARGIN, MECHA_DEFEAT_YAW_SPEED, MECHA_DEFEAT_ALIGNMENT, MECHA_FINAL_BREAKUP_TIME } from './config.js';
import { PLAYER_BODY_CAMERA_OFFSET, PLAYER_HITBOX_BOUNDING_RADIUS, playerTouchesWorldBox } from './playerHitbox.js';
import type { MechaPilotRelease } from './mechaPilotRelease.js';

export type MechaMode = 'walking' | 'tracking' | 'rocketing' | 'stomping' | 'punching' | 'aligning' | 'dying' | 'dead' | 'game-over' | 'boarding' | 'startup' | 'piloted' | 'shutting-down' | 'destroying' | 'destroyed';
export type MechaImpact = 'step' | 'stomp' | 'knees' | 'fists' | 'punch';
export interface MechaPlayer { position: THREE.Vector3; yaw?: number; alive: boolean; grounded: boolean; lifeId?: number; velocity?: THREE.Vector3 }
export interface MechaEvents { impact(kind: MechaImpact, position: THREE.Vector3): void; stompPlayer(): void; gameOver(): void; laserPlayer?(damage: number): void; rocketPlayer?(damage: number): void; pilotReleased?(pose: MechaPilotRelease): void }
type ObstacleQuery = (startX: number, startZ: number, endX: number, endZ: number, out: THREE.Object3D[], padding?: number) => THREE.Object3D[];
const modelUrl = new URL('../blender_assets/ironmaw/ironmaw_siege_robot.glb', import.meta.url).href;
const LOOP = 4 / 3;
const IDENTITY_ROTATION = new THREE.Quaternion();
// The five legacy clips carry a 1/24-second lead-in in the GLB. Events use
// Blender frame / 24, not (frame - 1) / 24, to stay aligned with exported time.
const STOMP_IMPACT = 39 / 24;
const KNEE_IMPACT = 40 / 24;
const FIST_IMPACT = 64 / 24;
const PUNCH_IMPACT = 35 / 24;

export function navigationBoxes(objects: readonly THREE.Object3D[]): NavigationBox[] {
    return objects.map(object => {
        const data = obstacleData(object);
        const halfH = data.halfH ?? data.height / 2;
        return { x: object.position.x, z: object.position.z, halfW: data.halfW ?? 3, halfD: data.halfD ?? 3,
            bottom: object.position.y - halfH, top: object.position.y + halfH };
    });
}

/** A single offline actor owns its model, navigation and animation clock.
 * It never consumes world RNG or uses wall-clock timers, so offline pause
 * freezes movement, animation events and the post-stomp cooldown together. */
export class ForgottenMecha {
    readonly group = new THREE.Group();
    readonly hitbox = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial());
    readonly colliders: THREE.Mesh[] = [];
    readonly combat: MechaCombat;
    readonly pilot = new MechaPilot();
    readonly headView = new MechaHeadView();
    readonly headEffects = new MechaHeadEffects();
    readonly seatAnchor = new THREE.Group();
    readonly pilotAnchor = new THREE.Group();
    readonly pilotScale = 2;
    readonly rocketPlayer: RocketPlayer = { position: new THREE.Vector3(), yaw: 0, lifeId: 0, alive: false, velocity: new THREE.Vector3() };
    private playerSampled = false;
    private pendingHit: { kind: 'stomp' | 'laser'; damage: number; lifeId: number; beamDraw: number; rendered: boolean } | null = null;
    private enemyReload = 0;
    private enemyGuided = false;
    private shutdownReverse = false;
    private readonly rocketAim = new THREE.Vector3();
    private readonly armRotation = new THREE.Quaternion();
    private readonly armParentRotation = new THREE.Quaternion();
    private readonly armOrigin = new THREE.Vector3();
    private readonly armRay = new THREE.Vector3();
    private readonly aimCorrection = new THREE.Quaternion();
    readonly viewAnchor = new THREE.Group();
    readonly interiorAnchor = new THREE.Group();
    readonly muzzleAnchor = new THREE.Group();
    private movement: MechaMovement | null = null;
    private readonly movementParts: NavigationBox[] = [];
    private readonly legColliders: THREE.Mesh[] = [];
    private readonly releasePose: MechaPilotRelease = { position: new THREE.Vector3(), quaternion: new THREE.Quaternion(), viewPosition: new THREE.Vector3() };
    private deathTime = 0;
    private readonly deathEye = new THREE.Color();
    private deathEyeIntensity = 1.35;
    private pilotDirection = 0;
    private shieldHeld = false;
    private rocketMixer: THREE.AnimationMixer | null = null;
    private helmetMixer: THREE.AnimationMixer | null = null;
    private rocketAction: THREE.AnimationAction | null = null;
    private headOpenAction: THREE.AnimationAction | null = null;
    private headCloseAction: THREE.AnimationAction | null = null;
    private headAction: THREE.AnimationAction | null = null;
    private fireTime = Infinity;
    private releasePending = false;
    private released = false;
    private queuedHelmetToggle = false;
    private lavaTime = 0;
    private readonly barrelDirection = new THREE.Vector3();
    private readonly boardPosition = new THREE.Vector3();
    private readonly boardQuaternion = new THREE.Quaternion();
    private readonly cameraRotation = new THREE.Euler(0, 0, 0, 'YXZ');
    private readonly cameraTargetQuaternion = new THREE.Quaternion();
    private readonly interiorPosition = new THREE.Vector3();
    private readonly inverseSeat = new THREE.Matrix4();
    private readonly cockpitRay = new THREE.Ray();
    private readonly cockpitPoint = new THREE.Vector3();
    private readonly cockpitBox = new THREE.Box3(new THREE.Vector3(-2.1, -1.8, -1.1), new THREE.Vector3(2.1, 1.8, 1.1));
    private readonly headVisibility: boolean[] = [];
    private readonly headSides = new Map<THREE.Material, THREE.Side>();
    hp = MECHA_HP;
    readonly maxHp = MECHA_HP;
    revision = 0;
    mode: MechaMode = 'walking';
    disposed = false;
    ready = false;
    speed = 0;
    radius = 0;
    route: MechaRoute | null = null;
    private model: THREE.Group | null = null;
    private mixer: THREE.AnimationMixer | null = null;
    private readonly actions = new Map<string, THREE.AnimationAction>();
    private action: THREE.AnimationAction | null = null;
    private readonly meshes: THREE.SkinnedMesh[] = [];
    private readonly skeletons = new Set<THREE.Skeleton>();
    private readonly bones = new Map<string, THREE.Bone>();
    private footPlant: MechaFootPlant | null = null;
    private eye: THREE.MeshStandardMaterial | null = null;
    private environment: THREE.WebGLRenderTarget | null = null;
    private readonly reflectiveMaterials = new Set<THREE.MeshStandardMaterial>();
    private waypoint = 1;
    private elapsed = 0;
    private cooldown = 0;
    private waistYaw = 0;
    private phase = 0;
    private locomotionRate = 0;
    private locomotion = 'Idle';
    private stepCount = 0;
    private impactFired = false;
    private secondImpactFired = false;
    private readonly bounds = new THREE.Box3();
    private readonly meshBounds = new THREE.Box3();
    private readonly size = new THREE.Vector3();
    private readonly target = new THREE.Vector3();
    private readonly aim = new THREE.Vector3();
    private readonly eyePosition = new THREE.Vector3();
    private eyeDepth = 0;
    private readonly grayEye = new THREE.Color(0.24, 0.27, 0.30);
    private readonly mountedEye = new THREE.Color(0xffd34d);
    private readonly opticalForwardRotation = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI);
    private readonly beamMin = new THREE.Vector3();
    private readonly beamMax = new THREE.Vector3();
    private readonly beamCandidates: THREE.Object3D[] = [];
    private readonly ray = new THREE.Raycaster();
    private readonly rayHits: THREE.Intersection[] = [];
    private readonly yawRotation = new THREE.Quaternion();
    private readonly localYawAxis = new THREE.Vector3(0, 0, 1);
    private readonly obstacles: THREE.Object3D[];
    private readonly lava: readonly THREE.Object3D[];
    private readonly seed: number;
    private readonly events: MechaEvents;
    private readonly obstacleQuery?: ObstacleQuery;
    private readonly sightCandidates: THREE.Object3D[] = [];

    constructor(obstacles: readonly THREE.Object3D[], lava: readonly THREE.Object3D[], seed: number,
        events: MechaEvents = { impact() {}, stompPlayer() {}, gameOver() {} }, obstacleQuery?: ObstacleQuery) {
        this.group.name = 'Forgotten Mecha';
        this.obstacles = [...obstacles];
        this.lava = lava;
        this.seed = seed;
        this.events = events;
        this.combat = new MechaCombat(damage => this.captureHit('laser', damage));
        this.obstacleQuery = obstacleQuery;
        this.hitbox.name = 'forgotten-mecha-scan';
        this.hitbox.visible = false;
    }
    async load(): Promise<void> {
        const gltf = await new GLTFLoader().loadAsync(modelUrl);
        if (this.disposed) { this.disposeModel(gltf.scene); return; }
        this.install(gltf);
    }
    /** Also used by asset regression tests and the interactive review fixture. */
    install(gltf: GLTF): void {
        if (this.disposed) { this.disposeModel(gltf.scene); return; }
        this.model = gltf.scene;
        this.group.add(this.model);
        this.model.traverse(node => {
            if (node instanceof THREE.Bone) this.bones.set(node.name, node);
            if (node instanceof THREE.SkinnedMesh) {
                this.meshes.push(node);
                this.skeletons.add(node.skeleton);
                node.castShadow = node.receiveShadow = true;
                // Animated skin bounds are recomputed below; a bind-pose sphere
                // would incorrectly cull the falling body or an extended fist.
                node.frustumCulled = false;
                const collider = new THREE.Mesh(this.hitbox.geometry, this.hitbox.material);
                collider.visible = false;
                collider.name = `forgotten-mecha-${node.name}`;
                collider.userData.damageTarget = 'forgotten-mecha';
                this.colliders.push(collider);
                if (/^M_(Foot|LowerLeg|Thigh)_[LR]$/.test(node.name)) this.legColliders.push(collider);
                this.movementParts.push({ x: 0, z: 0, halfW: 0, halfD: 0, bottom: 0, top: 0 });
                const materials = Array.isArray(node.material) ? node.material : [node.material];
                for (const material of materials) if (material instanceof THREE.MeshStandardMaterial) {
                    if (material.name === 'IRONMAW_Eye_State') {
                        this.eye = material.clone();
                        node.material = Array.isArray(node.material) ? node.material.map(value => value === material ? this.eye! : value) : this.eye;
                        material.dispose();
                    } else this.reflectiveMaterials.add(material);
                }
            }
        });
        this.updateSkin();
        this.bounds.setFromObject(this.model, true);
        const scale = MECHA_HEIGHT / (this.bounds.max.y - this.bounds.min.y);
        this.model.scale.multiplyScalar(scale);
        this.updateSkin();
        this.bounds.setFromObject(this.model, true);
        this.model.position.y -= this.bounds.min.y;
        this.speed = 1.5 * scale;
        this.radius = Math.hypot(Math.max(Math.abs(this.bounds.min.x), Math.abs(this.bounds.max.x)), Math.max(Math.abs(this.bounds.min.z), Math.abs(this.bounds.max.z))) + 0.5;
        this.mixer = new THREE.AnimationMixer(this.model);
        for (const clip of gltf.animations) this.actions.set(clip.name, this.mixer.clipAction(clip));
        for (const name of ['Walk', 'TurnLeft', 'TurnRight', 'Stomp', 'HeavyPunch', 'Death', 'Mount', 'FinalDeath', 'RocketFire', 'HeadOpen', 'HeadClose']) if (!this.actions.has(name)) throw new Error(`Ironmaw is missing ${name}`);
        const idleTracks: THREE.KeyframeTrack[] = [];
        for (const bone of this.bones.values()) {
            if (!bone.name.startsWith('CTRL_') || bone.name === 'CTRL_Root' || bone.name === 'CTRL_WaistYaw') continue;
            idleTracks.push(new THREE.QuaternionKeyframeTrack(`${bone.name}.quaternion`, [0], bone.quaternion.toArray()));
            idleTracks.push(new THREE.VectorKeyframeTrack(`${bone.name}.position`, [0], bone.position.toArray()));
        }
        this.actions.set('Idle', this.mixer.clipAction(new THREE.AnimationClip('Idle', LOOP, idleTracks)));
        const descendants = (bone: THREE.Object3D) => { const names = new Set<string>(); bone.traverse(node => names.add(node.name)); return names; };
        const helmetNames = descendants(this.bones.get('CTRL_Helmet_Rear')!);
        const upperNames = descendants(this.bones.get('CTRL_Waist')!);
        const filtered = (name: string, names: Set<string>, exclude?: Set<string>) => {
            const source = this.actions.get(name)!.getClip();
            return new THREE.AnimationClip(`${name}Layer`, source.duration,
                source.tracks.filter(track => names.has(track.name.split('.')[0]) && !exclude?.has(track.name.split('.')[0])).map(track => track.clone()));
        };
        // Independent mixers evaluate masked tracks after locomotion. Blending
        // a full-body action would halve the recoil and overwrite planted feet.
        this.rocketMixer = new THREE.AnimationMixer(this.model);
        this.rocketAction = this.rocketMixer.clipAction(filtered('RocketFire', upperNames, helmetNames));
        this.rocketAction.setLoop(THREE.LoopOnce, 1); this.rocketAction.clampWhenFinished = true;
        this.helmetMixer = new THREE.AnimationMixer(this.model);
        this.headOpenAction = this.helmetMixer.clipAction(filtered('HeadOpen', helmetNames));
        this.headCloseAction = this.helmetMixer.clipAction(filtered('HeadClose', helmetNames));
        for (const action of [this.headOpenAction, this.headCloseAction]) { action.setLoop(THREE.LoopOnce, 1); action.clampWhenFinished = true; action.setEffectiveTimeScale(0); }

        // Measure the actual extended fist instead of guessing a wall distance.
        this.play('HeavyPunch', false);
        this.action!.time = PUNCH_IMPACT;
        this.mixer.update(0);
        this.updateSkin();
        const fist = this.meshes.find(mesh => mesh.name.includes('Forearm_R'));
        if (!fist) throw new Error('Ironmaw is missing its right fist');
        const punchReach = this.meshBounds.setFromObject(fist, true).max.z;
        this.mixer.stopAllAction();
        this.action = null;
        this.play('Idle', true);
        this.mixer.update(0);
        this.updateSkin();
        const lavaBoxes = this.lava.map(pool => ({ x: pool.position.x, z: pool.position.z, halfW: LAVA_POOL_HALF_SIZE, halfD: LAVA_POOL_HALF_SIZE, bottom: 0, top: 0.15 }));
        const nav = new MechaNavigation(navigationBoxes(this.obstacles), lavaBoxes, this.radius, punchReach);
        this.movement = new MechaMovement(navigationBoxes(this.obstacles));
        this.followRoute(nav.borderSpawn(this.seed ^ 0x4d454348));
        const spawn = this.route!.points[0];
        this.group.position.set(spawn.x, 0, spawn.z);
        const next = this.route!.points[1];
        this.group.rotation.y = Math.atan2(next.x - spawn.x, next.z - spawn.z);
        this.footPlant = new MechaFootPlant(this.bones);
        const lens = this.meshes.find(mesh => mesh.name === 'M_EyeLens');
        if (!lens || !this.bones.has('PART_EyeLens_01')) throw new Error('Ironmaw is missing its eye lens');
        // Skinned mesh origins are the model root. The exported lens joint
        // supplies its animated center, while its fitted bounds supply size.
        this.group.rotation.y = 0;
        this.updateSkin(); this.meshBounds.setFromObject(lens, true).getSize(this.size);
        this.combat.eyeRadius = this.size.y / 2; this.eyeDepth = this.size.z / 2;
        const chest = this.bones.get('CTRL_Chest')!;
        const frame = chest.getWorldQuaternion(new THREE.Quaternion()).invert();
        this.seatAnchor.name = 'Mecha pilot seat'; this.viewAnchor.name = 'Mecha eye viewport'; this.interiorAnchor.name = 'Mecha helmet interior'; this.muzzleAnchor.name = 'Mecha right forearm muzzle';
        // Exported joint axes are not game axes. Undo the neutral chest frame;
        // subsequent chest animation moves the seat and optical view together.
        this.seatAnchor.position.set(0, -0.55, 0.9432);
        this.seatAnchor.quaternion.copy(frame); this.seatAnchor.scale.setScalar(1 / scale); chest.add(this.seatAnchor);
        // The neutral lens center belongs to the optical viewport. Both camera
        // anchors follow the chest, not the folding lens/helmet hinge.
        this.bones.get('PART_EyeLens_01')!.getWorldPosition(this.target);
        this.viewAnchor.position.copy(chest.worldToLocal(this.target)); this.viewAnchor.quaternion.copy(frame); this.viewAnchor.scale.setScalar(1 / scale); chest.add(this.viewAnchor);
        this.viewAnchor.getWorldPosition(this.target); this.target.z -= MECHA_INTERIOR_VIEW_BACK;
        this.interiorAnchor.position.copy(chest.worldToLocal(this.target)); this.interiorAnchor.quaternion.copy(frame); this.interiorAnchor.scale.setScalar(1 / scale); chest.add(this.interiorAnchor);
        // Fit the visible occupant independently of the grapple seat and optics.
        // The visor faces +Z; its head center shares the neutral lens height.
        this.viewAnchor.getWorldPosition(this.target); this.target.set(this.group.position.x, this.target.y - 0.5 * this.pilotScale, this.group.position.z + 5);
        this.pilotAnchor.position.copy(chest.worldToLocal(this.target));
        this.pilotAnchor.quaternion.copy(frame); this.pilotAnchor.scale.setScalar(1 / scale); chest.add(this.pilotAnchor);
        const slide = this.bones.get('CTRL_RocketSlide_R')!;
        const metadata = slide.userData;
        if (!Array.isArray(metadata.muzzle_rest_position) || !Array.isArray(metadata.muzzle_rest_direction)) throw new Error('Ironmaw is missing cassette muzzle metadata');
        // Socket metadata is Blender armature-space, before glTF's Z-up to Y-up
        // root rotation. Convert once into the animated slide's local space.
        const toGame = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), -Math.PI / 2);
        this.target.fromArray(metadata.muzzle_rest_position).applyQuaternion(toGame); this.model.localToWorld(this.target);
        this.muzzleAnchor.position.copy(slide.worldToLocal(this.target));
        this.aim.fromArray(metadata.muzzle_rest_direction).applyQuaternion(toGame).transformDirection(this.model.matrixWorld);
        this.aim.transformDirection(this.inverseSeat.copy(slide.matrixWorld).invert());
        this.muzzleAnchor.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), this.aim);
        slide.add(this.muzzleAnchor);
        const cassette = this.model.getObjectByName('M_RocketCassette_R')!;
        this.pilot.rockets.setRadius(cassette.userData.barrel_bore_diameter_m * scale * MECHA_ROCKET_BORE_FIT / 2);
        // Fit the entrance in cabin coordinates, rather than using a tiny seat
        // target. Armor tracing below still rejects doors, frame and back wall.
        const cavity = this.meshes.find(mesh => mesh.name === 'M_UpperTorso_Cavity')!;
        this.play('Death', false); this.action!.time = this.action!.getClip().duration; this.mixer.update(0); this.updateSkin();
        this.meshBounds.setFromObject(cavity, true).applyMatrix4(this.inverseSeat.copy(this.seatAnchor.matrixWorld).invert());
        this.cockpitBox.copy(this.meshBounds);
        this.cockpitBox.min.x *= 0.7; this.cockpitBox.max.x *= 0.7;
        this.cockpitBox.min.y += 0.8; this.cockpitBox.max.y -= 0.8;
        this.cockpitBox.min.z = 0.7; this.cockpitBox.max.z -= 0.25;
        this.mixer.stopAllAction(); this.action = null; this.play('Idle', true); this.mixer.update(0); this.updateSkin();
        this.group.rotation.y = Math.atan2(next.x - spawn.x, next.z - spawn.z);
        this.ready = true;
        this.updateColliders();
        this.updateCombatAnchors();
    }
    followRoute(route: MechaRoute): void { this.route = route; this.waypoint = 1; }
    prepareLighting(renderer: THREE.WebGLRenderer): void {
        const generator = new THREE.PMREMGenerator(renderer);
        const room = new RoomEnvironment(renderer);
        try {
            // Metallic surfaces need reflected fill; hemisphere lights alone
            // leave them black. Bake once, with no extra gameplay lights.
            this.environment = generator.fromScene(room, 0.04);
            for (const material of this.reflectiveMaterials) {
                material.envMap = this.environment.texture;
                material.envMapIntensity = 0.6;
                material.needsUpdate = true;
            }
        } finally { room.dispose(); generator.dispose(); }
    }
    updateLighting(nightStrength: number): void {
        for (const material of this.reflectiveMaterials) material.envMapIntensity = 0.6 * (1 - nightStrength * 0.85);
    }
    private updateSkin(): void {
        this.group.updateMatrixWorld(true);
        for (const skeleton of this.skeletons) skeleton.update();
    }
    private play(name: string, loop: boolean, blend = 0): void {
        const next = this.actions.get(name)!;
        if (next === this.action) return;
        const previous = this.action;
        next.reset().setEffectiveWeight(1).setEffectiveTimeScale(1);
        next.setLoop(loop ? THREE.LoopRepeat : THREE.LoopOnce, loop ? Infinity : 1);
        next.clampWhenFinished = !loop;
        if (loop) next.time = this.phase * LOOP;
        next.play();
        if (previous) { if (blend) previous.crossFadeTo(next, blend, false); else previous.stop(); }
        this.action = next;
    }
    private begin(mode: MechaMode, clip: string, blend = 0.15): void {
        this.combat.cancelLaser();
        if (mode === 'dying' || mode === 'punching') this.combat.stop();
        this.mode = mode;
        this.elapsed = 0;
        this.impactFired = this.secondImpactFired = false;
        this.locomotionRate = 0;
        this.footPlant?.reset();
        this.play(clip, false, blend);
    }
    damage(amount: number, hit?: MechaWeaponHit): { accepted: boolean; killed: boolean } {
        if (!this.ready || this.disposed || this.hp <= 0 || this.mode === 'boarding' || this.mode === 'startup' || this.mode === 'shutting-down' || this.mode === 'punching' || this.mode === 'game-over' || !Number.isFinite(amount) || amount <= 0) return { accepted: false, killed: false };
        if (hit && this.combat.shieldActive && !this.combat.isInsideShield(hit.origin)) {
            this.combat.shieldImpact(hit.point);
            return { accepted: false, killed: false };
        }
        if (hit?.surface === 'shield') return { accepted: false, killed: false };
        this.hp = Math.max(0, this.hp - amount);
        const killed = this.hp === 0;
        if (killed) {
            this.clearPendingDamage(); this.cancelPilotLayers(); this.pilot.rockets.clear();
            this.revision++;
            if (this.mode === 'piloted') {
                this.pilotAnchor.getWorldPosition(this.releasePose.position);
                this.viewAnchor.getWorldPosition(this.releasePose.viewPosition);
                this.releasePose.quaternion.setFromEuler(this.cameraRotation.set(this.pilot.pitch, this.pilot.yaw + Math.PI, 0, 'YXZ'));
                this.combat.stop(); this.cancelPilotLayers(); this.pilot.rockets.clear();
                // Final destruction cannot board again, so its video buffers
                // need not remain allocated while the corpse stays in the arena.
                this.headEffects.dispose(); this.begin('destroying', 'FinalDeath', 0);
                this.elapsed = MECHA_FINAL_BREAKUP_TIME; this.action!.time = MECHA_FINAL_BREAKUP_TIME;
                this.mixer!.update(0); this.updateSkin(); this.updateEye();
                // Ownership ends before this callback. Incoming damage must
                // no longer route to the wreck, and release runs exactly once.
                this.events.pilotReleased?.(this.releasePose);
            }
            else {
                if (this.eye) { this.deathEye.copy(this.eye.color); this.deathEyeIntensity = this.eye.emissiveIntensity; }
                this.combat.stop(); this.deathTime = this.elapsed = 0;
                this.mode = 'aligning'; this.locomotion = 'Idle'; this.play('Idle', true, 0.15);
                if (Math.abs(Math.atan2(Math.sin(this.waistYaw), Math.cos(this.waistYaw))) <= MECHA_DEFEAT_ALIGNMENT) this.finishAlignment();
            }
        }
        return { accepted: true, killed };
    }
    get canMount(): boolean { return this.ready && !this.disposed && this.mode === 'dead'; }
    get ownsPilot(): boolean { return ['boarding', 'startup', 'piloted', 'shutting-down'].includes(this.mode); }
    get pilotVisible(): boolean { return this.ownsPilot; }
    get hudOpacity(): number { return this.headView.hudOpacity; }
    get boardProgress(): number { return this.mode === 'boarding' ? Math.min(1, this.elapsed / MECHA_BOARD_TIME) : 1; }
    get cockpitOpen(): boolean { return this.canMount; }
    get helmetClosed(): boolean { return !this.headView.wantedOpen && this.headView.fold <= 1e-9; }
    get helmetProgress(): number { return this.headView.fold; }
    get targetingReady(): boolean { return this.mode === 'piloted' && this.headView.targetingReady; }
    get firingTime(): number { return this.fireTime; }
    get controlsFrozen(): boolean { return this.mode !== 'piloted' || !this.released && this.fireTime < MECHA_ROCKET_FIRE_TIME; }
    look(yaw: number, pitch: number, time?: number): void { if (!this.controlsFrozen) this.pilot.look(yaw, pitch, time); }
    toggleHelmet(): void {
        if (this.mode !== 'piloted') return;
        if (this.controlsFrozen) { this.queuedHelmetToggle = !this.queuedHelmetToggle; return; }
        this.headView.toggle();
        this.pilot.rockets.selected = null;
    }
    private cancelPilotLayers(): void {
        this.fireTime = Infinity; this.releasePending = this.released = this.queuedHelmetToggle = false;
        this.rocketMixer?.stopAllAction(); this.helmetMixer?.stopAllAction(); this.headAction = null;
        this.pilot.clearLookMotion();
        const cameraBlend = this.headView.eyeBlend;
        this.headView.reset(); this.headView.eyeBlend = cameraBlend;
        this.restorePilotView();
    }
    get animationTime(): number { return this.elapsed; }
    get solidColliders(): readonly THREE.Mesh[] { return this.mode === 'destroyed' || this.mode === 'destroying' ? [] : this.colliders; }
    cockpitHit(ray: THREE.Ray, maximum: number): { point: THREE.Vector3; distance: number } | null {
        if (!this.canMount) return null;
        this.updateSkin(); this.inverseSeat.copy(this.seatAnchor.matrixWorld).invert();
        this.cockpitRay.copy(ray).applyMatrix4(this.inverseSeat);
        if (this.cockpitRay.origin.z <= this.cockpitBox.max.z || this.cockpitRay.direction.z >= -0.1) return null;
        if (!this.cockpitRay.intersectBox(this.cockpitBox, this.cockpitPoint)) return null;
        this.cockpitPoint.applyMatrix4(this.seatAnchor.matrixWorld);
        const distance = ray.origin.distanceTo(this.cockpitPoint); if (distance > maximum) return null;
        this.ray.set(ray.origin, ray.direction); this.ray.far = distance - 0.02; this.rayHits.length = 0;
        // Coarse gameplay proxies span the open doorway. Only this interaction
        // traces the small animated armor set, including the cavity's back wall.
        for (const mesh of this.meshes) { mesh.computeBoundingBox(); mesh.computeBoundingSphere(); this.ray.intersectObject(mesh, false, this.rayHits); }
        if (this.rayHits.length) return null;
        const world = this.obstacleQuery?.(ray.origin.x, ray.origin.z, this.cockpitPoint.x, this.cockpitPoint.z, this.sightCandidates) ?? this.obstacles;
        for (const object of world) if (object.userData.damageTarget !== 'forgotten-mecha') this.ray.intersectObject(object, false, this.rayHits);
        if (this.rayHits.length) return null;
        this.seatAnchor.getWorldPosition(this.target); this.aim.subVectors(this.target, ray.origin);
        this.ray.set(ray.origin, this.aim.clone().normalize()); this.ray.far = this.aim.length() - 0.15; this.rayHits.length = 0;
        this.ray.intersectObjects(this.meshes, false, this.rayHits);
        return this.rayHits.length ? null : { point: this.target.clone(), distance };
    }
    beginBoarding(position: THREE.Vector3, quaternion: THREE.Quaternion): boolean {
        if (!this.canMount) return false;
        this.clearPendingDamage(); this.combat.stop(); this.hp = this.maxHp; this.revision++;
        this.boardPosition.copy(position); this.boardQuaternion.copy(quaternion);
        this.cancelPilotLayers(); this.headView.begin(); this.lavaTime = this.deathTime = 0;
        this.waistYaw = 0; this.pilot.reset(this.group.rotation.y);
        this.mode = 'boarding'; this.elapsed = 0; return true;
    }
    setPilotInput(direction: number, shield: boolean): void { this.pilotDirection = Math.sign(direction); this.shieldHeld = shield; }
    private captureHit(kind: 'laser' | 'stomp', damage: number): void {
        if (!this.pendingHit) this.pendingHit = { kind, damage, lifeId: this.rocketPlayer.lifeId, beamDraw: this.combat.effects.beamDraws, rendered: false };
    }
    acknowledgeRendered(): void {
        const hit = this.pendingHit;
        // A scene draw alone cannot acknowledge a hidden/culled laser mesh.
        if (hit && (hit.kind === 'stomp' || this.combat.effects.beamDraws > hit.beamDraw)) hit.rendered = true;
    }
    clearPendingDamage(): void { this.pendingHit = null; }
    /** Called before the next active simulation frame. Collision was captured
     * already; movement after contact cannot evade a rendered impact. */
    flushRenderedDamage(lifeId: number): void {
        const hit = this.pendingHit;
        if (!hit || !hit.rendered) return;
        this.pendingHit = null;
        if (hit.lifeId !== lifeId || this.disposed || this.hp <= 0) return;
        if (hit.kind === 'stomp') this.events.stompPlayer(); else this.events.laserPlayer?.(hit.damage);
    }
    requestExit(): boolean {
        if (this.mode !== 'piloted') return false;
        this.clearPendingDamage(); this.combat.stop(); this.pilot.rockets.clear(); this.pilot.clearLookMotion();
        this.fireTime = Infinity; this.releasePending = this.released = this.queuedHelmetToggle = false;
        this.rocketMixer?.stopAllAction(); this.pilotDirection = 0; this.shieldHeld = false;
        this.play('Idle', true, 0.15); this.action!.setEffectiveTimeScale(1);
        if (this.headView.wantedOpen) this.headView.toggle();
        this.shutdownReverse = false; this.mode = 'shutting-down'; this.elapsed = 0;
        return true;
    }
    private updateShutdown(delta: number): void {
        if (!this.shutdownReverse) {
            const waist = this.bones.get('CTRL_WaistYaw')!;
            waist.quaternion.identity(); this.mixer!.update(delta);
            this.waistYaw += THREE.MathUtils.clamp(-this.waistYaw, -MECHA_DEFEAT_YAW_SPEED * delta, MECHA_DEFEAT_YAW_SPEED * delta);
            waist.quaternion.multiply(this.yawRotation.setFromAxisAngle(this.localYawAxis, this.waistYaw));
            this.updateHelmet(delta);
            if (!this.headView.targetingReady || Math.abs(this.waistYaw) > MECHA_DEFEAT_ALIGNMENT) { this.updateColliders(); this.updatePilotCamera(); return; }
            this.cancelPilotLayers(); this.waistYaw = 0; this.pilot.pitch = 0;
            this.pilot.yaw = this.group.rotation.y; this.footPlant?.reset();
            this.play('Mount', false, 0.15); this.action!.time = this.action!.getClip().duration;
            this.action!.setEffectiveTimeScale(0); this.shutdownReverse = true; this.elapsed = 0;
        }
        const duration = this.action!.getClip().duration;
        const presentationTime = MECHA_VISION_REVEAL_TIME + MECHA_HUD_FADE_TIME;
        this.elapsed = Math.min(duration + presentationTime, this.elapsed + delta);
        const reverseTime = Math.max(0, this.elapsed - presentationTime);
        this.action!.time = duration - reverseTime; this.mixer!.update(delta);
        this.headView.updateShutdown(this.elapsed, duration);
        this.updateColliders(); this.updateCombatAnchors(); this.updateEye(); this.updatePilotCamera();
        if (reverseTime >= duration - 1e-9) {
            this.pilotAnchor.getWorldPosition(this.releasePose.position);
            this.viewAnchor.getWorldPosition(this.releasePose.viewPosition);
            this.releasePose.quaternion.setFromEuler(this.cameraRotation.set(0, this.group.rotation.y + Math.PI, 0, 'YXZ'));
            // Prefer the front of the cabin, then its sides when parked at a wall.
            // Own coarse proxies remain solid; a release must clear them too.
            const start = this.releasePose.position.clone();
            this.aim.set(Math.sin(this.group.rotation.y), 0, Math.cos(this.group.rotation.y));
            let free = false;
            for (let distance = 1; distance <= this.radius + 8 && !free; distance += 0.5) {
                for (const [forward, side] of [[1, 0], [1, -1], [1, 1], [0, -1], [0, 1]]) {
                    this.target.copy(start).addScaledVector(this.aim, forward * distance);
                    this.target.x += side * distance * this.aim.z; this.target.z -= side * distance * this.aim.x;
                    free = ![...this.obstacles, ...this.colliders].some(object => {
                        const d = obstacleData(object), hh = d.halfH ?? d.height / 2;
                        this.beamMin.set(object.position.x - d.halfW, object.position.y - hh, object.position.z - d.halfD);
                        this.beamMax.set(object.position.x + d.halfW, object.position.y + hh, object.position.z + d.halfD);
                        return playerTouchesWorldBox(this.target, this.group.rotation.y + Math.PI, this.beamMin, this.beamMax, 0.1)
                            || d.damageTarget !== 'forgotten-mecha' && segmentRoundedBoxHitT(start, this.target, this.beamMin, this.beamMax, PLAYER_HITBOX_BOUNDING_RADIUS) !== null;
                    });
                    if (free) { this.releasePose.position.copy(this.target); break; }
                }
            }
            // A completely blocked exit waits rather than clipping/teleporting.
            if (!free) return;
            this.hp = 0; this.revision++; this.mode = 'dead'; this.deathEye.copy(this.grayEye); this.deathEyeIntensity = 0; this.deathTime = 2;
            this.cancelPilotLayers(); this.updateEye();
            this.events.pilotReleased?.(this.releasePose);
        }
    }
    requestRocket(): boolean {
        if (this.mode !== 'piloted' || this.pilot.cooldown > 1e-9 || this.fireTime < MECHA_ROCKET_FIRE_TIME || this.releasePending) return false;
        this.fireTime = 0; this.releasePending = this.released = false; this.pilot.clearLookMotion();
        this.rocketAction!.reset().setEffectiveTimeScale(1).play(); return true;
    }
    /** Release at the render boundary: acquisition must use the actual shoulder
     * camera, and the socket must reflect this frame's authored shot pose. */
    fireRocket(camera: THREE.PerspectiveCamera, targets: readonly THREE.Group[], query: RocketObstacleQuery): boolean {
        if (this.mode !== 'piloted' || !this.releasePending) return false;
        this.releasePending = false; this.released = true;
        this.muzzleAnchor.getWorldPosition(this.target);
        this.barrelDirection.set(0, 0, 1).transformDirection(this.muzzleAnchor.matrixWorld);
        const closed = this.targetingReady;
        const target = closed ? this.pilot.rockets.select(camera, this.target, targets, query) : null;
        const fired = this.pilot.rockets.fire(this.target, this.barrelDirection, targets, { mode: closed ? 'guided' : 'wandering', target });
        this.pilot.cooldown = WEAPON_STATS.SNIPER.fireRate;
        if (this.queuedHelmetToggle) { this.queuedHelmetToggle = false; this.toggleHelmet(); }
        return fired;
    }
    private updateHelmet(delta: number): void {
        this.headView.update(delta);
        const action = this.headView.wantedOpen ? this.headOpenAction! : this.headCloseAction!;
        if (this.headAction !== action) { this.headAction?.stop(); this.headAction = action; action.reset().setEffectiveTimeScale(0).play(); }
        action.time = (this.headView.wantedOpen ? this.headView.fold : 1 - this.headView.fold) * action.getClip().duration;
        this.helmetMixer!.update(0);
    }
    private updateLava(delta: number): void {
        let contact = false;
        for (const name of ['M_Foot_L', 'M_Foot_R']) {
            const foot = this.meshes.find(mesh => mesh.name === name)!;
            this.meshBounds.setFromObject(foot, true);
            if (this.meshBounds.min.y > 0.15) continue;
            contact ||= this.lava.some(pool => this.meshBounds.max.x >= pool.position.x - LAVA_POOL_HALF_SIZE && this.meshBounds.min.x <= pool.position.x + LAVA_POOL_HALF_SIZE
                && this.meshBounds.max.z >= pool.position.z - LAVA_POOL_HALF_SIZE && this.meshBounds.min.z <= pool.position.z + LAVA_POOL_HALF_SIZE);
        }
        if (!contact) { this.lavaTime = 0; return; }
        this.lavaTime += delta;
        while (this.lavaTime + 1e-9 >= MECHA_LAVA_INTERVAL && this.mode === 'piloted') { this.lavaTime -= MECHA_LAVA_INTERVAL; this.damage(MECHA_LAVA_DAMAGE); }
    }
    private updatePilot(delta: number): void {
        this.elapsed += delta;
        if (this.mode === 'boarding') {
            if (this.elapsed + 1e-9 >= MECHA_BOARD_TIME) { this.mode = 'startup'; this.elapsed = 0; this.play('Mount', false); this.mixer!.update(0); }
        } else if (this.mode === 'startup') {
            const duration = this.action!.getClip().duration;
            this.mixer!.update(Math.min(delta, Math.max(0, duration - this.action!.time)));
            const complete = this.headView.updateStartup(this.elapsed, duration);
            if (complete) {
                this.mode = 'piloted'; this.elapsed = 0; this.locomotion = 'Idle'; this.phase = 0; this.footPlant?.reset(); this.play('Idle', true); this.combat.enterManualShield(); this.updateHelmet(0);
            }
        } else {
            const move = this.pilot.update(delta, this.group.position, this.group.rotation.y, this.speed, this.controlsFrozen ? 0 : this.pilotDirection,
                this.resolvePilotMovement);
            this.group.rotation.y = move.heading;
            this.waistYaw = this.pilot.yaw - move.heading;
            if (move.clip !== this.locomotion) { this.locomotion = move.clip; this.play(move.clip, true, 0.4); }
            this.phase = ((this.phase + delta * move.rate / LOOP) % 1 + 1) % 1;
            this.action!.setEffectiveTimeScale(move.rate);
            const waist = this.bones.get('CTRL_WaistYaw')!; waist.quaternion.identity(); this.mixer!.update(delta);
            if (this.fireTime < MECHA_ROCKET_FIRE_TIME) {
                // Hold exactly at the cue until the rendered camera dispatches
                // the release; even a slow frame cannot sample a retracted tube.
                const nextTime = Math.min(MECHA_ROCKET_FIRE_TIME, this.fireTime + delta);
                this.fireTime = !this.released ? Math.min(MECHA_ROCKET_SHOT_TIME, nextTime) : nextTime;
                this.rocketAction!.time = this.fireTime; this.rocketMixer!.update(0);
                if (!this.released && this.fireTime >= MECHA_ROCKET_SHOT_TIME - 1e-9) {
                    this.fireTime = MECHA_ROCKET_SHOT_TIME; this.releasePending = true;
                }
            } else this.rocketAction!.stop();
            this.updateHelmet(delta);
            waist.quaternion.multiply(this.yawRotation.setFromAxisAngle(this.localYawAxis, this.waistYaw));
            this.group.updateMatrixWorld(true); this.footPlant?.update(this.phase, move.clip === 'Idle', delta);
            if (move.distance) { const contact = Math.floor(this.phase * 2); if (contact !== this.stepCount) { this.stepCount = contact; this.emitImpact('step', contact ? 'CTRL_Ankle_R' : 'CTRL_Ankle_L'); } }
        }
        this.updateColliders();
        this.updateCombatAnchors();
        if (this.mode === 'piloted') {
            this.combat.updateManualShield(delta, this.shieldHeld); this.updateLava(delta);
            if (!this.ownsPilot) return;
        }
        this.updateEye();
        this.updatePilotCamera();
    }
    private updatePilotCamera(): void {
        if (this.ownsPilot) {
            this.viewAnchor.getWorldPosition(this.pilot.cameraPosition);
            this.interiorAnchor.getWorldPosition(this.interiorPosition);
            this.pilot.cameraPosition.lerpVectors(this.interiorPosition, this.pilot.cameraPosition, this.headView.eyeBlend);
            if (this.mode === 'piloted') this.pilot.cameraQuaternion.setFromEuler(this.cameraRotation.set(this.pilot.pitch, this.pilot.yaw + Math.PI, 0, 'YXZ'));
            else { this.viewAnchor.getWorldQuaternion(this.pilot.cameraQuaternion); this.pilot.cameraQuaternion.multiply(this.opticalForwardRotation); }
            if (this.mode === 'boarding') {
                const t = this.boardProgress; const ease = t * t * (3 - 2 * t);
                this.pilot.cameraPosition.lerpVectors(this.boardPosition, this.pilot.cameraPosition, ease);
                this.cameraTargetQuaternion.copy(this.pilot.cameraQuaternion); this.pilot.cameraQuaternion.copy(this.boardQuaternion).slerp(this.cameraTargetQuaternion, ease);
            }
        }
    }
    private aimEnemyLauncher(): void {
        const shoulder = this.bones.get('CTRL_Shoulder_L')!;
        const weight = this.released ? Math.max(0, 1 - (this.fireTime - MECHA_ROCKET_SHOT_TIME) / (MECHA_ROCKET_FIRE_TIME - MECHA_ROCKET_SHOT_TIME))
            : Math.min(1, this.fireTime / (MECHA_ROCKET_SHOT_TIME - 0.3));
        // Rotate the real shoulder/socket as one rigid assembly. Solving the
        // ray from its pivot accounts for the muzzle moving with the arm;
        // simply pointing from the old muzzle oscillates for nearby overhead
        // targets. Repeated passes only refine the moving-player intercept.
        for (let pass = 0; pass < 3; pass++) {
            this.group.updateMatrixWorld(true); this.muzzleAnchor.getWorldPosition(this.target);
            this.barrelDirection.set(0, 0, 1).transformDirection(this.muzzleAnchor.matrixWorld);
            if (!this.released) this.rocketAim.copy(this.rocketPlayer.position).addScaledVector(this.rocketPlayer.velocity, this.target.distanceTo(this.rocketPlayer.position) / MECHA_ROCKET_SPEED);
            shoulder.getWorldPosition(this.armOrigin);
            this.aim.subVectors(this.rocketAim, this.armOrigin);
            this.armRay.subVectors(this.target, this.armOrigin);
            const axial = this.armRay.dot(this.barrelDirection);
            const radialSquared = Math.max(0, this.armRay.lengthSq() - axial * axial);
            // Inside the arm's reach, use the closest achievable forward point.
            const travel = Math.max(0, Math.sqrt(Math.max(0, this.aim.lengthSq() - radialSquared)) - axial);
            this.armRay.addScaledVector(this.barrelDirection, travel).normalize();
            this.aim.normalize();
            this.aimCorrection.setFromUnitVectors(this.armRay, this.aim).slerp(IDENTITY_ROTATION, 1 - weight);
            shoulder.getWorldQuaternion(this.armRotation);
            shoulder.parent!.getWorldQuaternion(this.armParentRotation).invert();
            shoulder.quaternion.copy(this.armParentRotation).multiply(this.aimCorrection).multiply(this.armRotation);
        }
    }
    private updateEnemyRocket(delta: number, player: MechaPlayer): void {
        const previous = this.fireTime;
        this.fireTime = Math.min(MECHA_ROCKET_FIRE_TIME, previous + delta);
        // Sample the exported release pose exactly, including on a slow frame.
        const cue = !this.released && this.fireTime >= MECHA_ROCKET_SHOT_TIME - 1e-9;
        this.rocketAction!.time = cue ? MECHA_ROCKET_SHOT_TIME : this.fireTime;
        if (cue) this.fireTime = MECHA_ROCKET_SHOT_TIME;
        const visible = this.hasLineOfSight(player);
        this.rocketMixer!.update(0);
        // Covered releases use the same authored socket/axis as an open-helmet
        // pilot. Do not aim the arm at live coordinates behind the obstruction.
        if (this.released ? this.enemyGuided : visible) this.aimEnemyLauncher();
        this.updateSkin();
        if (cue) {
            this.muzzleAnchor.getWorldPosition(this.target);
            this.barrelDirection.set(0, 0, 1).transformDirection(this.muzzleAnchor.matrixWorld);
            const fired = this.pilot.rockets.fire(this.target, this.barrelDirection, [], {
                mode: visible ? 'guided' : 'wandering', target: null, player: this.rocketPlayer,
                damage: MECHA_ENEMY_ROCKET_DAMAGE, turnSpeed: visible ? MECHA_ENEMY_ROCKET_TURN_SPEED : undefined,
                guidanceResponse: visible ? MECHA_ENEMY_ROCKET_GUIDANCE_RESPONSE : undefined,
            });
            this.released = true; this.enemyGuided = visible; this.enemyReload = WEAPON_STATS.SNIPER.fireRate;
            if (fired) this.combat.recordRangedShot();
            this.fireTime = Math.min(MECHA_ROCKET_FIRE_TIME, previous + delta);
        }
        if (this.fireTime >= MECHA_ROCKET_FIRE_TIME - 1e-9) {
            this.rocketAction!.stop(); this.mode = 'tracking'; this.combat.finishRangedAttack();
        }
    }
    updateRockets(delta: number, targets: readonly THREE.Group[], query: RocketObstacleQuery, hit: (index: number, damage: number) => void): void {
        this.pilot.rockets.update(delta, targets, query, hit, this.rocketPlayer, damage => this.events.rocketPlayer?.(damage));
    }
    preparePilotView(firstPerson: boolean, warmInterior = false): void {
        this.restorePilotView();
        const clear = firstPerson && this.ownsPilot && this.headView.viewportClear;
        for (const mesh of this.meshes) if (mesh.name === 'M_HelmetShell' || mesh.name === 'M_EyeLens') {
            this.headVisibility.push(mesh.visible);
            if (clear) mesh.visible = false;
            // The authoring material is one-sided. The occupant needs its inner
            // faces; this render-only override never changes the exterior view.
            if (warmInterior || firstPerson && this.ownsPilot && !clear) {
                for (const material of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) {
                    if (!this.headSides.has(material)) this.headSides.set(material, material.side);
                    material.side = THREE.DoubleSide;
                }
            }
        }
    }
    restorePilotView(): void {
        if (!this.headVisibility.length) return;
        let index = 0; for (const mesh of this.meshes) if (mesh.name === 'M_HelmetShell' || mesh.name === 'M_EyeLens') mesh.visible = this.headVisibility[index++] ?? true;
        this.headVisibility.length = 0;
        for (const [material, side] of this.headSides) material.side = side;
        this.headSides.clear();
    }
    private readonly resolvePilotMovement = (start: THREE.Vector3, end: THREE.Vector3, heading: number, out: THREE.Vector3): THREE.Vector3 => {
        this.group.rotation.y = heading;
        this.bones.get('CTRL_WaistYaw')!.quaternion.copy(this.yawRotation.setFromAxisAngle(this.localYawAxis, this.pilot.yaw - heading));
        this.updateColliders();
        for (let i = 0; i < this.colliders.length; i++) {
            const collider = this.colliders[i], data = obstacleData(collider), part = this.movementParts[i];
            part.x = collider.position.x; part.z = collider.position.z;
            part.halfW = data.halfW; part.halfD = data.halfD;
            part.bottom = collider.position.y - data.halfH!; part.top = collider.position.y + data.halfH!;
        }
        return this.movement!.resolve(start, end, this.movementParts, out);
    };
    private finishAlignment(): void {
        this.waistYaw = 0; this.bones.get('CTRL_WaistYaw')!.quaternion.identity();
        this.begin('dying', 'Death');
    }
    private updateAlignment(delta: number, player: MechaPlayer): void {
        const yaw = Math.atan2(Math.sin(this.waistYaw), Math.cos(this.waistYaw));
        const step = Math.min(delta, Math.max(0, (Math.abs(yaw) - MECHA_DEFEAT_ALIGNMENT) / MECHA_DEFEAT_YAW_SPEED));
        this.deathTime += step; this.elapsed += step;
        this.waistYaw = yaw - Math.sign(yaw) * MECHA_DEFEAT_YAW_SPEED * step;
        const waist = this.bones.get('CTRL_WaistYaw')!;
        waist.quaternion.identity(); this.mixer!.update(step);
        waist.quaternion.multiply(this.yawRotation.setFromAxisAngle(this.localYawAxis, this.waistYaw));
        this.group.updateMatrixWorld(true); this.footPlant?.update(this.phase, true, step);
        this.updateColliders(); this.updateCombatAnchors(); this.combat.updateEffects(); this.updateEye();
        if (Math.abs(this.waistYaw) <= MECHA_DEFEAT_ALIGNMENT + 1e-9) {
            this.finishAlignment();
            if (delta > step) this.update(delta - step, player);
        }
    }
    private playerTouchesLegs(player: MechaPlayer): boolean {
        this.target.copy(player.position); this.target.y -= PLAYER_BODY_CAMERA_OFFSET;
        for (const collider of this.legColliders) {
            this.beamMin.copy(collider.position).addScaledVector(collider.scale, -0.5);
            this.beamMax.copy(collider.position).addScaledVector(collider.scale, 0.5);
            if (playerTouchesWorldBox(this.target, player.yaw ?? 0, this.beamMin, this.beamMax, MECHA_MOVEMENT_MARGIN)) return true;
        }
        return false;
    }
    private hasLineOfSight(player: MechaPlayer): boolean {
        if (!player.alive) return false;
        const eyeBone = this.bones.get('PART_EyeLens_01')!;
        eyeBone.getWorldPosition(this.eyePosition);
        this.aim.subVectors(player.position, this.eyePosition);
        const distance = this.aim.length();
        this.ray.set(this.eyePosition, this.aim.normalize());
        this.ray.far = Math.max(0, distance - 0.1);
        this.rayHits.length = 0;
        // Static proxies are independent of render distance. Acquisition gates
        // the cylinder/dome separately; committed attacks keep range-free LOS.
        const candidates = this.obstacleQuery?.(this.eyePosition.x, this.eyePosition.z, player.position.x, player.position.z, this.sightCandidates) ?? this.obstacles;
        if (this.obstacleQuery) for (let i = candidates.length - 1; i >= 0; i--) if (candidates[i].userData.damageTarget === 'forgotten-mecha') candidates.splice(i, 1);
        this.ray.intersectObjects(candidates, false, this.rayHits);
        return this.rayHits.length === 0;
    }
    update(delta: number, player: MechaPlayer): void {
        if (this.rocketPlayer.lifeId !== (player.lifeId ?? 0) || !player.alive) this.clearPendingDamage();
        if (player.velocity) this.rocketPlayer.velocity.copy(player.velocity);
        else if (this.playerSampled && delta > 0) {
            this.rocketPlayer.velocity.subVectors(player.position, this.rocketPlayer.position);
            this.rocketPlayer.velocity.y -= PLAYER_BODY_CAMERA_OFFSET; this.rocketPlayer.velocity.multiplyScalar(1 / delta);
        }
        this.rocketPlayer.position.copy(player.position); this.rocketPlayer.position.y -= PLAYER_BODY_CAMERA_OFFSET;
        this.rocketPlayer.yaw = player.yaw ?? 0; this.rocketPlayer.lifeId = player.lifeId ?? 0; this.rocketPlayer.alive = player.alive;
        this.playerSampled = true;
        if (!this.ready || this.disposed || !this.mixer || !Number.isFinite(delta) || delta <= 0 || this.mode === 'game-over' || this.mode === 'dead' || this.mode === 'destroyed') return;
        if (this.mode === 'shutting-down') { this.updateShutdown(delta); return; }
        if (this.ownsPilot) { this.updatePilot(delta); return; }
        if (this.mode === 'destroying') {
            const duration = this.action!.getClip().duration;
            this.mixer.update(Math.min(delta, Math.max(0, duration - this.action!.time)));
            this.elapsed += delta; this.updateSkin(); this.updateEye();
            if (this.elapsed + 1e-9 >= duration) this.mode = 'destroyed';
            return;
        }
        if (this.mode === 'aligning') { this.updateAlignment(delta, player); return; }
        // Evaluate the leg pose at the exported contact, not a later animation
        // frame after a hitch. The remaining animation advances afterward.
        if (this.mode === 'stomping' && !this.impactFired && this.elapsed < STOMP_IMPACT && this.elapsed + delta > STOMP_IMPACT + 1e-9) {
            const toImpact = STOMP_IMPACT - this.elapsed;
            this.update(toImpact, player); this.update(delta - toImpact, player); return;
        }
        if (this.mode === 'dying') this.deathTime += delta;
        this.combat.advanceClock(delta);
        this.enemyReload = Math.max(0, this.enemyReload - delta);
        if (this.combat.frozen) { this.updateEye(); this.combat.updateEffects(); return; }
        this.cooldown = Math.max(0, this.cooldown - delta);
        const attack = this.mode === 'stomping' || this.mode === 'punching' || this.mode === 'dying' || this.mode === 'rocketing';
        const region = classifyMechaAttack(this.group.position, player.position);
        const detected = !attack && region !== null && this.hasLineOfSight(player);
        if (!attack) {
            this.mode = detected || this.combat.rangedCommitted ? 'tracking' : 'walking';
            if (detected && this.combat.canStartRanged && this.cooldown <= 0 && region === 'stomp') this.begin('stomping', 'Stomp');
            else if (detected && this.combat.canStartRanged && this.enemyReload <= 0 && region === 'rocket') {
                this.mode = 'rocketing'; this.fireTime = 0; this.released = false; this.move(0, true);
                this.rocketAction!.reset().setEffectiveTimeScale(0).play();
            }
            else this.move(delta, detected || this.combat.rangedCommitted || this.combat.aimFrozen);
        }
        if (!this.combat.aimFrozen && (this.mode === 'tracking' || this.mode === 'stomping' || this.mode === 'rocketing' && !this.released && this.hasLineOfSight(player))) {
            const desired = Math.atan2(player.position.x - this.group.position.x, player.position.z - this.group.position.z) - this.group.rotation.y;
            this.turnWaist(desired, delta);
        } else if (!this.combat.aimFrozen && this.mode === 'walking') this.turnWaist(0, delta);
        this.elapsed += delta;
        const waist = this.bones.get('CTRL_WaistYaw')!;
        // Walk/turn clips deliberately omit waist tracks. Reset their runtime
        // offset before evaluating, otherwise it would accumulate every frame.
        waist.quaternion.identity();
        this.mixer.update(delta);
        // Apply an offset after animation evaluation: attacks retain their
        // authored wind-up while the upper body follows its independent aim.
        if (this.mode === 'tracking' || this.mode === 'stomping' || this.mode === 'walking' || this.mode === 'rocketing') waist.quaternion.multiply(this.yawRotation.setFromAxisAngle(this.localYawAxis, this.waistYaw));
        if (this.mode === 'rocketing') this.updateEnemyRocket(delta, player);
        this.group.updateMatrixWorld(true);
        if (this.mode === 'walking' || this.mode === 'tracking') this.footPlant?.update(this.phase, this.locomotion === 'Idle', delta);
        this.updateColliders();
        this.updateCombatAnchors();
        this.combat.updateLaser(delta, {
            robotPosition: this.group.position, playerPosition: player.position, playerYaw: player.yaw ?? 0,
            playerAlive: player.alive, visible: this.hasLineOfSight(player), canCharge: this.mode === 'tracking',
            yaw: this.group.rotation.y + this.waistYaw,
            obstacleDistance: this.beamObstacleDistance,
        });
        this.combat.updateEffects();
        this.updateEye();
        if (this.mode === 'stomping' && !this.impactFired && this.elapsed >= STOMP_IMPACT) {
            this.impactFired = true;
            this.emitImpact('stomp', 'CTRL_Ankle_L');
            // Re-evaluate grounding and range at impact, not when wind-up starts.
            if (player.alive && (player.grounded && Math.hypot(player.position.x - this.group.position.x, player.position.z - this.group.position.z) <= MECHA_STOMP_RADIUS || this.playerTouchesLegs(player))) this.captureHit('stomp', 0);
        }
        if (this.mode === 'dying') {
            if (!this.impactFired && this.elapsed >= KNEE_IMPACT) { this.impactFired = true; this.emitImpact('knees', 'CTRL_Knee_L'); }
            if (!this.secondImpactFired && this.elapsed >= FIST_IMPACT) { this.secondImpactFired = true; this.emitImpact('fists', 'CTRL_Elbow_R'); }
        }
        if (this.mode === 'punching' && !this.impactFired && this.elapsed >= PUNCH_IMPACT) {
            this.impactFired = true;
            this.emitImpact('punch', 'CTRL_Elbow_R');
        }
        if (['stomping', 'punching', 'dying'].includes(this.mode) && this.elapsed >= this.action!.getClip().duration) {
            if (this.mode === 'stomping') { this.cooldown = MECHA_STOMP_COOLDOWN; this.mode = 'tracking'; this.play('Idle', true, 0.2); this.locomotion = 'Idle'; }
            else if (this.mode === 'punching') { this.mode = 'game-over'; this.events.gameOver(); }
            else this.mode = 'dead';
        }
    }
    private move(delta: number, tracking: boolean): void {
        if (!this.route) return;
        const point = this.route.points[this.waypoint];
        this.target.set(point.x - this.group.position.x, 0, point.z - this.group.position.z);
        const distance = this.target.length();
        if (!tracking && !this.combat.blocksNewAttacks && distance < 0.03 && this.waypoint === this.route.points.length - 1) {
            this.group.rotation.y = this.route.heading;
            this.waistYaw = 0;
            this.begin('punching', 'HeavyPunch');
            return;
        }
        const desired = Math.atan2(this.target.x, this.target.z);
        const difference = Math.atan2(Math.sin(desired - this.group.rotation.y), Math.cos(desired - this.group.rotation.y));
        const turning = !tracking && Math.abs(difference) > 0.04;
        const name = tracking ? 'Idle' : turning ? difference < 0 ? 'TurnLeft' : 'TurnRight' : 'Walk';
        if (name !== this.locomotion) { this.locomotion = name; this.play(name, true, 0.4); this.locomotionRate = 0; }
        this.locomotionRate = Math.min(1, this.locomotionRate + delta / 0.4);
        const rate = this.locomotionRate;
        if (name !== 'Idle') {
            this.phase = (this.phase + delta * rate / LOOP) % 1;
            this.action!.setEffectiveTimeScale(rate);
        }
        if (turning) this.group.rotation.y += Math.sign(difference) * Math.min(Math.abs(difference), Math.PI / 6 * delta * rate);
        else if (!tracking) {
            const advance = Math.min(distance, this.speed * delta * rate);
            this.group.position.addScaledVector(this.target.normalize(), advance);
            if (distance - advance < 0.03 && this.waypoint < this.route.points.length - 1) this.waypoint++;
            const contacts = Math.floor(this.phase * 2);
            if (contacts !== this.stepCount) { this.stepCount = contacts; this.emitImpact('step', contacts ? 'CTRL_Ankle_R' : 'CTRL_Ankle_L'); }
        }
    }
    private emitImpact(kind: MechaImpact, boneName: string): void {
        this.bones.get(boneName)!.getWorldPosition(this.target);
        if (kind !== 'punch') this.target.y = 0.06;
        this.events.impact(kind, this.target);
    }
    private updateEye(): void {
        if (!this.eye) return;
        if (this.ownsPilot || this.mode === 'destroying' || this.mode === 'destroyed') {
            const power = this.mode === 'boarding' || this.mode === 'destroying' || this.mode === 'destroyed' ? 0 : this.mode === 'startup' ? THREE.MathUtils.clamp((this.elapsed - 44 / 24) / (12 / 24), 0, 1)
                : this.mode === 'shutting-down' && this.shutdownReverse ? THREE.MathUtils.clamp((this.action!.time - 44 / 24) / (12 / 24), 0, 1) : 1;
            this.eye.color.copy(this.grayEye).lerp(this.mountedEye, power); this.eye.emissive.copy(this.eye.color); this.eye.emissiveIntensity = 1.35 * power; return;
        }
        const fade = this.hp > 0 ? this.mode === 'punching' || this.mode === 'game-over' ? 0 : 1 - this.combat.eyePower
            : THREE.MathUtils.clamp((this.deathTime - 12 / 24) / (16 / 24), 0, 1);
        if (this.hp <= 0) this.eye.color.copy(this.deathEye).lerp(this.grayEye, fade);
        else this.eye.color.setRGB(1, 0.018, 0.004).lerp(this.grayEye, fade);
        this.eye.emissive.copy(this.eye.color);
        this.eye.emissiveIntensity = (this.hp <= 0 ? this.deathEyeIntensity : 1.35) * (1 - fade);
    }
    private turnWaist(desired: number, delta: number): void {
        const difference = Math.atan2(Math.sin(desired - this.waistYaw), Math.cos(desired - this.waistYaw));
        this.waistYaw += THREE.MathUtils.clamp(difference, -MECHA_TORSO_YAW_SPEED * delta, MECHA_TORSO_YAW_SPEED * delta);
    }
    private updateCombatAnchors(): void {
        this.bones.get('CTRL_Chest')!.getWorldPosition(this.combat.shieldCenter);
        if (this.combat.laserPhase !== 'cancelling') {
            this.bones.get('PART_EyeLens_01')!.getWorldPosition(this.combat.orbPosition);
            const yaw = this.group.rotation.y + this.waistYaw;
            this.aim.set(Math.sin(yaw), 0, Math.cos(yaw));
            this.combat.orbPosition.addScaledVector(this.aim, this.eyeDepth + this.combat.eyeRadius + 0.12);
        }
    }
    private readonly beamObstacleDistance = (start: THREE.Vector3, end: THREE.Vector3, radius: number): number => {
        const length = start.distanceTo(end);
        let nearest = 1;
        const candidates = this.obstacleQuery?.(start.x, start.z, end.x, end.z, this.beamCandidates, radius) ?? this.obstacles;
        for (const object of candidates) {
            const data = obstacleData(object);
            if (data.damageTarget === 'forgotten-mecha') continue;
            const hw = data.halfW ?? 3, hd = data.halfD ?? 3, hh = data.halfH ?? data.height / 2;
            this.beamMin.set(object.position.x - hw, object.position.y - hh, object.position.z - hd);
            this.beamMax.set(object.position.x + hw, object.position.y + hh, object.position.z + hd);
            const t = segmentRoundedBoxHitT(start, end, this.beamMin, this.beamMax, radius);
            if (t !== null) nearest = Math.min(nearest, t);
        }
        // The floor also terminates a pitched beam; its visuals and damage
        // cannot continue underground or reach a player behind terrain.
        if (end.y < start.y) nearest = Math.min(nearest, Math.max(0, (start.y - radius) / (start.y - end.y)));
        return nearest * length;
    };
    private updateColliders(): void {
        this.updateSkin();
        this.bounds.makeEmpty();
        for (let i = 0; i < this.meshes.length; i++) {
            this.meshBounds.setFromObject(this.meshes[i], true);
            this.bounds.union(this.meshBounds);
            const collider = this.colliders[i];
            this.meshBounds.getCenter(collider.position);
            this.meshBounds.getSize(collider.scale);
            const data = obstacleData(collider);
            Object.assign(data, { height: collider.scale.y, halfW: collider.scale.x / 2, halfD: collider.scale.z / 2, halfH: collider.scale.y / 2 });
            collider.updateMatrixWorld(true);
        }
        this.bounds.getCenter(this.hitbox.position);
        this.bounds.getSize(this.size);
        this.hitbox.scale.copy(this.size);
        this.hitbox.updateMatrixWorld(true);
    }
    private disposeModel(model: THREE.Group): void {
        const geometries = new Set<THREE.BufferGeometry>(), materials = new Set<THREE.Material>(), textures = new Set<THREE.Texture>(), skeletons = new Set<THREE.Skeleton>();
        model.traverse(node => {
            if (!(node instanceof THREE.Mesh)) return;
            geometries.add(node.geometry);
            if (node instanceof THREE.SkinnedMesh) skeletons.add(node.skeleton);
            for (const material of Array.isArray(node.material) ? node.material : [node.material]) {
                materials.add(material);
                for (const value of Object.values(material)) if (value instanceof THREE.Texture && value !== this.environment?.texture) textures.add(value);
            }
        });
        geometries.forEach(value => value.dispose()); materials.forEach(value => value.dispose()); textures.forEach(value => value.dispose()); skeletons.forEach(value => value.dispose());
    }
    dispose(): void {
        if (this.disposed) return;
        this.clearPendingDamage();
        this.cancelPilotLayers();
        this.rocketMixer?.uncacheRoot(this.model!); this.helmetMixer?.uncacheRoot(this.model!);
        this.disposed = true;
        this.ready = false;
        this.mixer?.stopAllAction();
        // The seated bean belongs to player visuals, not the GLB. Detach before
        // disposing the skin so its shared geometry/material lifecycle survives.
        for (const child of [...this.seatAnchor.children]) child.removeFromParent();
        for (const child of [...this.pilotAnchor.children]) child.removeFromParent();
        if (this.model) { this.mixer?.uncacheRoot(this.model); this.disposeModel(this.model); }
        this.group.removeFromParent();
        this.colliders.forEach(collider => collider.removeFromParent());
        this.hitbox.geometry.dispose();
        (this.hitbox.material as THREE.Material).dispose();
        this.environment?.dispose();
        this.combat.dispose();
        this.pilot.dispose();
        this.headEffects.dispose();
        this.colliders.length = 0;
        this.legColliders.length = this.movementParts.length = 0;
        this.movement = null;
    }
}
