import * as THREE from 'three';
import { GLTFLoader, type GLTF } from 'three/addons/loaders/GLTFLoader.js';
import { clone } from 'three/addons/utils/SkeletonUtils.js';
import {
    ENEMY_COUNT, INFANTRY, INFANTRY_AIM_ANGLE, INFANTRY_STEERING_ANGLE, INFANTRY_TURN_ANGLE, INFANTRY_DEBRIS_TIME, INFANTRY_LIMIT, INFANTRY_RANGE, LAVA_POOL_HALF_SIZE,
    LAVA_SPEED_MULTIPLIER, MAP_HALF_SIZE, NETWORK_POSITION_RESPONSE, TOWN_WALL_HP, type InfantryKind,
} from './config.js';
import { getLavaPitFloorY, getLavaPoolDescriptor, isPointInLava } from './lavaPools.js';
import { MechaNavigation, type MechaRoute, type NavigationPoint } from './mechaNavigation.js';
import { cancelHookForTarget } from './hookLifecycle.js';
import { closestPlayerBodyPoint } from './playerHitbox.js';
import { obstacleData, targetData } from './userDataTypes.js';
import type { InfantryEvent, InfantryPhase, InfantryPose, InfantryState } from './infantryNetworkTypes.js';

const KINDS = ['base', 'fast', 'big'] as const;
const URLS = {
    base: new URL('../blender_assets/enemy_base/enemy_base.glb', import.meta.url).href,
    fast: new URL('../blender_assets/enemy_fast/enemy_fast.glb', import.meta.url).href,
    big: new URL('../blender_assets/enemy_big/enemy_big.glb', import.meta.url).href,
};
// The same route grid must clear the widest footprint even when a bot turns.
const ACTOR_CLEARANCE = Math.max(...KINDS.map(kind => Math.hypot(INFANTRY[kind].width, INFANTRY[kind].depth) / 2));
// Leave the route just outside the footprint so the Fast swing can reach the wall.
const WALL_STANDOFF = ACTOR_CLEARANCE + .025;

export function botFootprintRadius(kind: InfantryKind): number {
    return Math.hypot(INFANTRY[kind].width, INFANTRY[kind].depth) * .52 + .35;
}
const RIGHT_HAND = THREE.PropertyBinding.sanitizeNodeName('hand.R');
const X_AXIS = new THREE.Vector3(1, 0, 0);
const Y_AXIS = new THREE.Vector3(0, 1, 0);

export interface InfantryPlayer {
    id: string;
    lifeId: number;
    position: THREE.Vector3;
    yaw: number;
    mounted?: { revision: number; bounds: THREE.Box3; closestPoint?(origin: THREE.Vector3, out: THREE.Vector3): THREE.Vector3 };
}

interface Impact {
    position: THREE.Vector3;
    obstacle?: THREE.Object3D;
}
export interface InfantryEnvironment {
    trace(start: THREE.Vector3, end: THREE.Vector3, ignoreMecha?: boolean): Impact | null;
    visible(position: THREE.Vector3): boolean;
    attack(kind: InfantryKind, start: THREE.Vector3, end: THREE.Vector3, victim?: InfantryPlayer): void;
    wallLost(position: THREE.Vector3, heading: number): void;
}

interface BotVisual {
    model: THREE.Object3D;
    mixer: THREE.AnimationMixer;
    actions: Record<Exclude<InfantryPhase, 'turn'> | 'turnLeft' | 'turnRight', THREE.AnimationAction>;
    hand: THREE.Object3D | undefined;
    muzzle: THREE.Object3D | undefined;
    aim: THREE.Object3D | undefined;
    aimRest: THREE.Quaternion | undefined;
}

interface Bot {
    group: THREE.Group;
    visual?: BotVisual;
    pose?: InfantryPose;
    route?: MechaRoute;
    waypoint: number;
    chase?: { points: NavigationPoint[]; waypoint: number; targetX: number; targetZ: number };
    cooldown: number;
    victim?: Pick<InfantryPlayer, 'id' | 'lifeId'> & { mountedRevision?: number };
    wall?: { point: THREE.Vector3; heading: number };
    variationSeed?: number;
}

function poseAction(visual: BotVisual, pose: InfantryPose): THREE.AnimationAction {
    if (pose.phase === 'turn') return visual.actions[pose.turnAngle! > 0 ? 'turnLeft' : 'turnRight'];
    return visual.actions[pose.phase];
}

function facingAt(pose: InfantryPose, time: number, duration: number): number {
    if (pose.phase !== 'turn') return pose.yaw;
    const t = Math.min(time / duration, 1);
    return pose.yaw - pose.turnAngle! * (1 - t * t * (3 - 2 * t));
}

function wrapYaw(angle: number): number {
    return Math.atan2(Math.sin(angle), Math.cos(angle));
}

export function infantryWave(day: number): [number, number, number] {
    return [5 + Math.max(0, day - 3), day >= 2 ? 3 + Math.max(0, day - 3) : 0,
        day >= 3 ? 3 + day - 3 : 0];
}

function nearestArmorPoint(mounted: NonNullable<InfantryPlayer['mounted']>, origin: THREE.Vector3, out: THREE.Vector3): THREE.Vector3 {
    return mounted.closestPoint?.(origin, out) ?? mounted.bounds.clampPoint(origin, out);
}

export function nearestInfantryPlayer(origin: THREE.Vector3, players: readonly InfantryPlayer[],
    visible: (player: InfantryPlayer, point: THREE.Vector3) => boolean): InfantryPlayer | undefined {
    let best: InfantryPlayer | undefined;
    let distance = INFANTRY_RANGE ** 2;
    const point = new THREE.Vector3();
    for (const player of players) {
        if (player.mounted) nearestArmorPoint(player.mounted, origin, point); else point.copy(player.position);
        const squared = origin.distanceToSquared(point);
        if (squared > distance || best && squared === distance || !visible(player, point)) continue;
        distance = squared;
        best = player;
    }
    return best;
}

function disposeAssets(assets: readonly GLTF[]): void {
    const geometries = new Set<THREE.BufferGeometry>(), materials = new Set<THREE.Material>();
    const textures = new Set<THREE.Texture>();
    for (const asset of assets) asset.scene.traverse(node => {
        if (!(node instanceof THREE.Mesh)) return;
        if (node instanceof THREE.SkinnedMesh) node.skeleton.dispose();
        geometries.add(node.geometry);
        for (const material of Array.isArray(node.material) ? node.material : [node.material]) {
            materials.add(material);
            for (const value of Object.values(material)) if (value instanceof THREE.Texture) textures.add(value);
        }
    });
    geometries.forEach(geometry => geometry.dispose());
    materials.forEach(material => material.dispose());
    textures.forEach(texture => texture.dispose());
}

export class InfantryDefense {
    day = 0;
    wallHp = TOWN_WALL_HP;
    private previousClock = 0;
    private sequence = 0;
    private received = -1;
    private spawnSerial = 0;
    private nextKind = 0;
    private readonly pending = [0, 0, 0];
    private readonly bots: Bot[] = [];
    private readonly assets = new Map<InfantryKind, GLTF>();
    private readonly geometry = new THREE.BoxGeometry(1, 1, 1);
    // The proxy remains raycastable for weapons and goggles while the rig draws.
    private readonly proxyMaterial = new THREE.MeshBasicMaterial({ visible: false });
    private readonly origin = new THREE.Vector3();
    private readonly target = new THREE.Vector3();
    private readonly end = new THREE.Vector3();
    private readonly contact = new THREE.Vector3();
    private readonly step = new THREE.Vector3();
    private readonly aimRotation = new THREE.Quaternion();
    private readonly swingRotation = new THREE.Quaternion();
    private readonly parentRotation = new THREE.Quaternion();
    private readonly axis = new THREE.Vector3();
    private readonly scene: THREE.Scene;
    private readonly seed: number;
    private readonly environment: InfantryEnvironment;
    private readonly lava: readonly THREE.Object3D[];
    private readonly nav: MechaNavigation | null;
    private disposed = false;

    constructor(scene: THREE.Scene, targets: THREE.Group[], seed: number,
        obstacles: readonly THREE.Object3D[], lava: readonly THREE.Object3D[], environment: InfantryEnvironment,
        authoritative: boolean) {
        this.scene = scene;
        this.seed = seed;
        this.environment = environment;
        this.lava = lava;
        this.nav = authoritative ? new MechaNavigation(obstacles.map(object => {
            const { height, halfH = height / 2, halfW, halfD } = obstacleData(object);
            const { x, y, z } = object.position;
            return { x, z, halfW, halfD, bottom: y - halfH, top: y + halfH };
        }), lava.map(pool => ({
            x: pool.position.x, z: pool.position.z,
            halfW: getLavaPoolDescriptor(pool)?.boundRadius ?? LAVA_POOL_HALF_SIZE,
            halfD: getLavaPoolDescriptor(pool)?.boundRadius ?? LAVA_POOL_HALF_SIZE,
            bottom: 0, top: .15,
        })), ACTOR_CLEARANCE, WALL_STANDOFF, MAP_HALF_SIZE, INFANTRY.big.height) : null;

        for (let slot = 0; slot < INFANTRY_LIMIT; slot++) {
            const group = new THREE.Group();
            group.name = 'Infantry';
            group.visible = false;
            const bodyMesh = new THREE.Mesh(this.geometry, this.proxyMaterial);
            bodyMesh.visible = false;
            const healthBarGroup = new THREE.Group();
            Object.assign(targetData(group), {
                index: ENEMY_COUNT + slot, infantry: true, hp: 0, maxHp: 1, scale: 1, color: 0, eliminationRevision: 0,
                bodyMesh, healthBarGroup, healthBarFg: new THREE.Mesh(this.geometry, this.proxyMaterial),
            });
            group.add(bodyMesh, healthBarGroup);
            this.bots.push({ group, cooldown: 0, waypoint: 0 });
            targets.push(group);
        }
    }

    async load(loader: Pick<GLTFLoader, 'loadAsync'> = new GLTFLoader()): Promise<void> {
        const results = await Promise.allSettled(KINDS.map(kind => loader.loadAsync(URLS[kind])));
        const loaded = results.flatMap(result => result.status === 'fulfilled' ? [result.value] : []);
        if (this.disposed || loaded.length !== KINDS.length) {
            disposeAssets(loaded);
            if (this.disposed) throw new DOMException('Loading cancelled', 'AbortError');
            const failure = results.find(result => result.status === 'rejected');
            throw new Error('Unable to load town infantry models', { cause: failure?.reason });
        }
        KINDS.forEach((kind, index) => this.assets.set(kind, loaded[index]));
        for (const [kind, asset] of this.assets) {
            const stats = INFANTRY[kind];
            for (const name of ['Idle', stats.move, stats.attack, 'TurnLeft', 'TurnRight', 'Death']) {
                if (!asset.animations.some(clip => clip.name === name)) throw new Error(`Infantry ${kind} is missing ${name}`);
            }
            if (!asset.scene.getObjectByName(kind === 'base' ? 'muzzle' : RIGHT_HAND)) throw new Error(`Infantry ${kind} is missing its attack joint`);
        }
    }

    private replicaQueued = 0;

    private get queued(): number {
        return this.nav ? this.pending[0] + this.pending[1] + this.pending[2] : this.replicaQueued;
    }

    get enemiesRemaining(): number {
        let count = this.queued;
        for (const bot of this.bots) {
            if (bot.pose && bot.pose.hp > 0) count++;
        }
        return count;
    }

    get warmModels(): THREE.Group[] {
        return [...this.assets.values()].map(asset => asset.scene);
    }

    update(delta: number, clock: number, players: readonly InfantryPlayer[]): void {
        if (!this.nav || this.wallHp === 0) return;
        if (this.day === 0 || clock < this.previousClock) {
            infantryWave(++this.day).forEach((count, index) => { this.pending[index] += count; });
        }
        this.previousClock = clock;
        for (const bot of this.bots) {
            if (!bot.pose) this.spawn(bot);
            else if (bot.pose.phase === 'death') {
                bot.pose.time += delta;
                if (bot.pose.time >= INFANTRY_DEBRIS_TIME) this.remove(bot);
                else this.present(bot);
            } else this.updateBot(bot, delta, players);
            if (this.wallHp === 0) break;
        }
    }

    private spawn(bot: Bot): void {
        let selected = this.nextKind;
        for (let step = 0; step < KINDS.length && !this.pending[selected]; step++) selected = (selected + 1) % KINDS.length;
        if (!this.pending[selected]) return;
        this.pending[selected]--;
        this.nextKind = (selected + 1) % KINDS.length;
        const serial = ++this.spawnSerial;
        const kind = KINDS[selected], radius = botFootprintRadius(kind);
        const variationSeed = (this.seed ^ Math.imul(serial, 0x517cc1b7)) >>> 0;
        const route = this.nav!.borderSpawn(this.seed ^ Math.imul(serial, 0x9e3779b9),
            point => this.bots.every(other => !other.pose || other.pose.phase === 'death' ||
                Math.hypot(other.group.position.x - point.x, other.group.position.z - point.z) >=
                    radius + botFootprintRadius(other.pose.kind) + 1.5), 12, variationSeed);
        const [first, next] = route.points;
        const { index, eliminationRevision } = targetData(bot.group);
        this.install(bot, { slot: index - ENEMY_COUNT, revision: eliminationRevision + 1, kind, hp: INFANTRY[kind].hp,
            position: { ...first, y: 0 }, yaw: Math.atan2(next.x - first.x, next.z - first.z), pitch: 0, phase: 'moving', time: 0 });
        this.setRoute(bot, route);
        bot.variationSeed = variationSeed;
        bot.victim = undefined;
        bot.cooldown = 0;
        this.present(bot);
    }

    private setRoute(bot: Bot, route: MechaRoute): void {
        bot.route = route;
        bot.waypoint = 0;
        const last = route.points.at(-1)!;
        const point = new THREE.Vector3(last.x + Math.sin(route.heading) * WALL_STANDOFF,
            INFANTRY[bot.pose!.kind].height * .67, last.z + Math.cos(route.heading) * WALL_STANDOFF);
        bot.wall = { point, heading: route.heading };
    }

    private install(bot: Bot, pose: InfantryPose): void {
        if (bot.pose?.revision !== pose.revision || bot.pose.kind !== pose.kind) {
            cancelHookForTarget(bot.group);
            this.removeVisual(bot);
            const asset = this.assets.get(pose.kind)!;
            const stats = INFANTRY[pose.kind];
            const model = clone(asset.scene);
            model.scale.multiplyScalar(stats.modelScale);
            model.position.y = -stats.height / 2;
            model.traverse(node => {
                if (node instanceof THREE.SkinnedMesh) {
                    node.frustumCulled = false;
                    node.castShadow = node.receiveShadow = true;
                }
            });
            const mixer = new THREE.AnimationMixer(model);
            const makeAction = (name: string, loop: boolean) => {
                const action = mixer.clipAction(THREE.AnimationClip.findByName(asset.animations, name));
                action.setLoop(loop ? THREE.LoopRepeat : THREE.LoopOnce, loop ? Infinity : 1);
                action.clampWhenFinished = !loop;
                return action;
            };
            const aim = pose.kind !== 'fast' ? model.getObjectByName('torso_yaw') : undefined;
            bot.visual = { model, mixer, actions: {
                idle: makeAction('Idle', true), moving: makeAction(stats.move, true),
                turnLeft: makeAction('TurnLeft', false), turnRight: makeAction('TurnRight', false),
                attack: makeAction(stats.attack, false), death: makeAction('Death', false),
            }, hand: model.getObjectByName(RIGHT_HAND), muzzle: model.getObjectByName('muzzle'), aim, aimRest: aim?.quaternion.clone() };
            bot.group.add(model);
            this.scene.add(bot.group);
            const data = targetData(bot.group);
            data.maxHp = stats.hp;
            data.scale = stats.height / 3;
            data.color = stats.color;
            data.eliminationRevision = pose.revision;
            data.bodyMesh.scale.set(stats.width, stats.height, stats.depth);
            bot.group.position.set(pose.position.x, stats.height / 2, pose.position.z);
            model.rotation.y = pose.yaw;
        }
        if (pose.hp <= 0 && targetData(bot.group).hp > 0) cancelHookForTarget(bot.group);
        bot.pose = { ...pose, position: { ...pose.position } };
        // Spawned and replicated poses invalidate any route computed from an
        // earlier position.
        bot.chase = undefined;
        targetData(bot.group).hp = pose.hp;
    }

    private setPhase(bot: Bot, phase: InfantryPhase): void {
        const pose = bot.pose!;
        if (phase === pose.phase) return;
        if (pose.phase === 'turn') {
            // An interrupted step (including death) keeps the facing reached so far.
            pose.yaw = wrapYaw(facingAt(pose, pose.time, poseAction(bot.visual!, pose).getClip().duration));
            delete pose.turnAngle;
        }
        pose.phase = phase;
        pose.time = 0;
    }

    private present(bot: Bot): void {
        const { pose, visual, group } = bot;
        if (!pose || !visual) return;
        group.visible = this.environment.visible(group.position);
        targetData(group).bodyMesh.visible = pose.hp > 0;
        // Authoritative contact explicitly samples the action even off-screen.
        if (group.visible) this.samplePose(bot, pose.time);
        else targetData(group).bodyMesh.updateWorldMatrix(true, false);
    }

    private samplePose(bot: Bot, time: number): void {
        const { pose, visual } = bot;
        if (!pose || !visual) return;
        const action = poseAction(visual, pose);
        for (const other of Object.values(visual.actions)) if (other !== action && other.isScheduled()) other.stop();
        if (!action.isScheduled()) action.reset().play();
        const duration = action.getClip().duration;
        action.time = Math.min(time, duration);
        if (pose.phase === 'turn') action.setEffectiveWeight(Math.abs(pose.turnAngle!) / INFANTRY_TURN_ANGLE);
        if (visual.aimRest) visual.aim!.quaternion.copy(visual.aimRest);
        visual.model.rotation.y = facingAt(pose, time, duration);
        visual.mixer.update(0);
        if (visual.aim?.parent && (pose.kind === 'base' || pose.phase === 'attack')) {
            visual.aim.parent.getWorldQuaternion(this.parentRotation).invert();
            let pitch = pose.pitch;
            if (pose.kind === 'big') {
                // The enlarged heavy swing would pass above an on-foot player.
                // Aim the swing through contact, then blend back into recovery.
                const { contact, swingYaw } = INFANTRY.big;
                const blend = Math.min(action.time / contact, (duration - action.time) / (duration - contact));
                this.axis.copy(Y_AXIS).applyQuaternion(this.parentRotation);
                visual.aim.quaternion.premultiply(this.swingRotation.setFromAxisAngle(this.axis, swingYaw * blend));
                pitch *= blend;
            }
            this.axis.copy(X_AXIS).applyAxisAngle(Y_AXIS, pose.yaw).applyQuaternion(this.parentRotation);
            visual.aim.quaternion.premultiply(this.aimRotation.setFromAxisAngle(this.axis, -pitch));
        }
        bot.group.updateWorldMatrix(true, true);
    }

    private sightPoint(bot: Bot): THREE.Vector3 {
        return this.origin.copy(bot.group.position).setY(INFANTRY[bot.pose!.kind].height * .72);
    }

    private playerPoint(player: InfantryPlayer, origin: THREE.Vector3, out: THREE.Vector3): THREE.Vector3 {
        return player.mounted ? nearestArmorPoint(player.mounted, origin, out) : closestPlayerBodyPoint(origin, player.position, player.yaw, out);
    }

    private beginTurn(bot: Bot, heading: number, threshold: number): boolean {
        const pose = bot.pose!;
        const difference = wrapYaw(heading - pose.yaw);
        if (Math.abs(difference) <= threshold) return false;
        const angle = THREE.MathUtils.clamp(difference, -INFANTRY_TURN_ANGLE, INFANTRY_TURN_ANGLE);
        this.setPhase(bot, 'turn');
        pose.turnAngle = angle;
        pose.yaw = wrapYaw(pose.yaw + angle);
        pose.pitch = 0;
        return true;
    }

    private aimAt(bot: Bot, target: THREE.Vector3): void {
        const origin = this.sightPoint(bot);
        const dx = target.x - origin.x, dz = target.z - origin.z;
        const horizontal = Math.hypot(dx, dz);
        if (horizontal > 1e-6) bot.pose!.yaw = Math.atan2(dx, dz);
        bot.pose!.pitch = Math.atan2(target.y - origin.y, horizontal);
    }

    private wallInReach(bot: Bot, distance: number): boolean {
        if (!bot.wall) return false;
        const start = this.sightPoint(bot);
        // Walking to the wall's approach endpoint puts the authored punch
        // inside contact range. Starting at its broader hit limit can whiff forever.
        if (bot.pose!.kind !== 'base' && Math.hypot(start.x - bot.wall.point.x, start.z - bot.wall.point.z) > WALL_STANDOFF + .015) {
            return false;
        }
        if (start.distanceToSquared(bot.wall.point) > distance ** 2) return false;
        const hit = this.environment.trace(start, this.end.copy(bot.wall.point).addScaledVector(
            this.step.set(Math.sin(bot.wall.heading), 0, Math.cos(bot.wall.heading)), .05));
        return hit?.obstacle?.name === 'town-wall';
    }

    private updateBot(bot: Bot, delta: number, players: readonly InfantryPlayer[]): void {
        const pose = bot.pose!, stats = INFANTRY[pose.kind];
        bot.cooldown = Math.max(0, bot.cooldown - delta);
        if (pose.phase === 'turn') {
            pose.time += delta;
            if (pose.time >= poseAction(bot.visual!, pose).getClip().duration) this.setPhase(bot, 'idle');
        } else if (pose.phase === 'attack') {
            const previous = pose.time;
            pose.time += delta;
            if (previous < stats.contact && pose.time >= stats.contact) this.strike(bot, players, stats.contact);
            if (pose.time >= bot.visual!.actions.attack.getClip().duration) this.setPhase(bot, 'idle');
        } else {
            const origin = this.sightPoint(bot);
            const player = nearestInfantryPlayer(origin, players, (candidate, point) => !this.environment.trace(origin, point, Boolean(candidate.mounted)));
            const target = player ? this.playerPoint(player, origin, this.target) : bot.wall?.point;
            // The heavy's punch originates below its sightline. Short targets can
            // be within arm's reach even when their crown is outside its eye sphere.
            const reachOrigin = pose.kind === 'big' ? this.step.copy(origin).setY(stats.height * INFANTRY.big.reachHeight) : origin;
            const inReach = player ? Boolean(target && reachOrigin.distanceToSquared(target) <= stats.engage ** 2) : this.wallInReach(bot, stats.range);
            if (target && inReach) {
                bot.chase = undefined;
                const dx = target.x - origin.x, dz = target.z - origin.z;
                if (Math.hypot(dx, dz) > 1e-6 && this.beginTurn(bot, Math.atan2(dx, dz), INFANTRY_AIM_ANGLE)) {
                    this.present(bot);
                    return;
                }
                if (bot.cooldown <= 0) {
                    this.aimAt(bot, target);
                    if (pose.kind === 'big') {
                        // At contact the fist is above its torso pivot. Aim that
                        // authored arc down onto a player; the wall spans its full height.
                        const { swingPivotHeight, swingElevation } = INFANTRY.big;
                        pose.pitch = player ? Math.max(-Math.PI / 2,
                            Math.atan2(target.y - stats.height * swingPivotHeight, Math.hypot(dx, dz)) - swingElevation) : 0;
                    }
                    this.setPhase(bot, 'attack');
                    bot.victim = player ? { id: player.id, lifeId: player.lifeId, mountedRevision: player.mounted?.revision } : undefined;
                    bot.cooldown = stats.interval;
                    if (stats.contact === 0) this.strike(bot, players, 0);
                } else this.setPhase(bot, 'idle');
            } else if (player && pose.kind !== 'base') {
                if (!this.chasePlayer(bot, player, delta)) {
                    bot.chase = undefined;
                    this.followWallRoute(bot, delta);
                }
            } else if (!player || !this.move(bot, player.position, delta, true)) {
                bot.chase = undefined;
                this.followWallRoute(bot, delta);
            }
            this.advanceLocomotionClock(bot, delta);
        }
        this.present(bot);
    }

    private advanceLocomotionClock(bot: Bot, delta: number): void {
        const pose = bot.pose!;
        if (pose.phase === 'idle' || pose.phase === 'moving') {
            pose.time = (pose.time + delta) % bot.visual!.actions[pose.phase].getClip().duration;
        }
    }

    /** Fast and Big robots close on a visible player along the shortest clear
     * grid route; the seeded wall route resumes only when chasing cannot step. */
    private chasePlayer(bot: Bot, player: InfantryPlayer, delta: number): boolean {
        const position = bot.group.position;
        // Losing the player mid-chase must rebuild the wall route from here
        // rather than walk back to a waypoint chosen before the chase began.
        bot.route = undefined;
        if (this.nav!.segmentClear(position, player.position)) {
            bot.chase = undefined;
            return this.move(bot, player.position, delta, true);
        }
        let chase = bot.chase;
        if (chase && (!chase.points[chase.waypoint] ||
            Math.hypot(player.position.x - chase.targetX, player.position.z - chase.targetZ) > 4 ||
            !this.nav!.segmentClear(position, chase.points[chase.waypoint]))) {
            bot.chase = chase = undefined;
        }
        if (!chase) {
            const points = this.nav!.routeTo(position, player.position, 12);
            if (!points?.length) return false;
            chase = bot.chase = { points, waypoint: 0, targetX: player.position.x, targetZ: player.position.z };
        }
        while (chase.waypoint < chase.points.length &&
            Math.hypot(chase.points[chase.waypoint].x - position.x, chase.points[chase.waypoint].z - position.z) < .015) chase.waypoint++;
        if (chase.waypoint >= chase.points.length) {
            bot.chase = undefined;
            return false;
        }
        const waypoint = chase.points[chase.waypoint];
        return this.move(bot, waypoint, delta, false);
    }

    private followWallRoute(bot: Bot, delta: number): void {
        if (!bot.route) {
            const position = bot.group.position;
            const variationSeed = bot.variationSeed ??
                ((this.seed ^ Math.imul(targetData(bot.group).index - ENEMY_COUNT + 1, 0x517cc1b7)) >>> 0);
            // A chase may end between cells next to a blocked rounded cell.
            for (const [dx, dz] of [[0, 0], [4, 0], [-4, 0], [0, 4], [0, -4], [4, 4], [4, -4], [-4, 4], [-4, -4]]) {
                const route = this.nav!.routeFrom({ x: position.x + dx, z: position.z + dz }, 12, variationSeed);
                if (route && this.nav!.segmentClear(position, route.points[0])) {
                    this.setRoute(bot, route);
                    // Rejoin the forward segment without turning back to the snapped grid center.
                    if (this.nav!.segmentClear(position, route.points[1])) bot.waypoint = 1;
                    break;
                }
            }
        }
        const route = bot.route;
        if (route && bot.waypoint < route.points.length) {
            const waypoint = route.points[bot.waypoint];
            if (Math.hypot(waypoint.x - bot.group.position.x, waypoint.z - bot.group.position.z) < .015) bot.waypoint++;
            if (bot.waypoint < route.points.length) {
                this.move(bot, route.points[bot.waypoint], delta, false);
                return;
            }
        }
        this.setPhase(bot, 'idle');
    }

    private overlapsLiving(bot: Bot, x: number, z: number, radius: number, tolerance: number): boolean {
        for (const other of this.bots) {
            const pose = other.pose;
            if (other === bot || !pose || pose.phase === 'death') continue;
            const distance = radius + botFootprintRadius(pose.kind) - tolerance;
            if ((x - other.group.position.x) ** 2 + (z - other.group.position.z) ** 2 < distance ** 2) return true;
        }
        return false;
    }

    private move(bot: Bot, target: NavigationPoint, delta: number, check: boolean): boolean {
        const pose = bot.pose!, position = bot.group.position, stats = INFANTRY[pose.kind];
        const dx = target.x - position.x, dz = target.z - position.z;
        const length = Math.hypot(dx, dz);
        if (length < .015) return false;
        const radius = botFootprintRadius(pose.kind);
        // Repulsion plus a right-hand tangent lets converging robots arc past
        // one another instead of locking head-on or marching through a peer.
        let steerX = 0, steerZ = 0;
        for (const other of this.bots) {
            const otherPose = other.pose;
            if (other === bot || !otherPose || otherPose.phase === 'death') continue;
            const ox = other.group.position.x - position.x, oz = other.group.position.z - position.z;
            const distance = Math.hypot(ox, oz), room = radius + botFootprintRadius(otherPose.kind) + 2.2;
            if (distance >= room || distance < 1e-4) continue;
            const influence = 1 - distance / room;
            steerX += (-ox / distance * .9 + oz / distance * .45) * influence;
            steerZ += (-oz / distance * .9 - ox / distance * .45) * influence;
        }
        const desiredX = dx / length + steerX, desiredZ = dz / length + steerZ;
        const desired = Math.hypot(desiredX, desiredZ);
        const dirX = desired > 1e-6 ? desiredX / desired : dx / length;
        const dirZ = desired > 1e-6 ? desiredZ / desired : dz / length;
        // Infantry wade through lava at the shared reduced speed, using their
        // feet rather than the group's centre of mass.
        const inLava = isPointInLava(position.x, position.z, position.y - stats.height / 2, ACTOR_CLEARANCE, this.lava);
        const step = Math.min(length, stats.speed * (inLava ? LAVA_SPEED_MULTIPLIER : 1) * delta);
        let nextX = position.x + dirX * step, nextZ = position.z + dirZ * step;
        if (check && !this.nav!.segmentClear(position, { x: nextX, z: nextZ })) return false;
        // Resolve any remaining footprint overlap before committing the step.
        for (let pass = 0; pass < 3; pass++) {
            let moved = false;
            for (const other of this.bots) {
                const otherPose = other.pose;
                if (other === bot || !otherPose || otherPose.phase === 'death') continue;
                const ox = nextX - other.group.position.x, oz = nextZ - other.group.position.z;
                const distance = Math.hypot(ox, oz), clearance = radius + botFootprintRadius(otherPose.kind);
                if (distance >= clearance) continue;
                let pushX: number, pushZ: number;
                if (distance < 1e-4) {
                    // A stable slot-derived direction separates coincident bots.
                    const angle = (targetData(bot.group).index - ENEMY_COUNT + 1) * 2.399963229728653;
                    pushX = Math.cos(angle); pushZ = Math.sin(angle);
                } else {
                    pushX = ox / distance; pushZ = oz / distance;
                }
                const push = clearance - distance + 1e-3;
                nextX += pushX * push;
                nextZ += pushZ * push;
                moved = true;
            }
            if (!moved) break;
        }
        let clear = this.nav!.segmentClear(position, { x: nextX, z: nextZ }, true) &&
            !this.overlapsLiving(bot, nextX, nextZ, radius, 1e-3);
        if (!clear) {
            // A peer beside an obstacle can pin the full step. Slide sideways
            // for one frame instead of pushing through either blocker.
            for (const side of [1, -1]) {
                const slideX = position.x - dirZ * side * step, slideZ = position.z + dirX * side * step;
                if (!this.nav!.segmentClear(position, { x: slideX, z: slideZ }, true) ||
                    this.overlapsLiving(bot, slideX, slideZ, radius, 1e-3)) continue;
                nextX = slideX;
                nextZ = slideZ;
                clear = true;
                break;
            }
        }
        if (!clear) {
            this.setPhase(bot, 'idle');
            return false;
        }
        const heading = Math.atan2(nextX - position.x, nextZ - position.z);
        if (this.beginTurn(bot, heading, INFANTRY_STEERING_ANGLE)) return true;
        this.setPhase(bot, 'moving');
        pose.yaw = heading;
        pose.pitch = 0;
        position.x = nextX;
        position.z = nextZ;
        // Follow the recessed organic floor so bots visibly step into and out
        // of lava basins without changing the network pose's ground-relative y.
        position.y = stats.height / 2 + getLavaPitFloorY(position.x, position.z, this.lava);
        pose.position = { x: position.x, y: 0, z: position.z };
        return true;
    }

    private strike(bot: Bot, players: readonly InfantryPlayer[], sampleTime: number): void {
        const pose = bot.pose!, stats = INFANTRY[pose.kind], lock = bot.victim;
        const player = lock ? players.find(candidate => candidate.id === lock.id && candidate.lifeId === lock.lifeId &&
            candidate.mounted?.revision === lock.mountedRevision) : undefined;
        if (lock && !player) return;
        const center = this.sightPoint(bot);
        const target = player ? this.playerPoint(player, center, this.target) : bot.wall?.point;
        if (!target) return;
        if (pose.kind === 'base') this.aimAt(bot, target);
        this.samplePose(bot, sampleTime);
        const kind = pose.kind;
        const firing = kind === 'base';
        const joint = firing ? bot.visual!.muzzle : bot.visual!.hand;
        const contact = joint!.getWorldPosition(this.contact);
        const start = firing ? contact : center;
        const wall = player ? undefined : bot.wall;
        const end = this.end.copy(target);
        const fistRadius = firing ? 0 : INFANTRY[kind].fistRadius;
        if (wall) {
            const heading = this.step.set(Math.sin(wall.heading), 0, Math.cos(wall.heading));
            // A wall presents a whole plane to the swing. Sample the section
            // beneath the animated fist, including the heavy's wide windup.
            if (!firing) end.copy(contact).addScaledVector(heading, target.dot(heading) - contact.dot(heading));
            end.addScaledVector(heading, .06);
        }
        if (start.distanceToSquared(end) > stats.range ** 2) return;
        const hit = this.environment.trace(start, end, Boolean(player?.mounted));
        if (player) {
            if (hit) return;
            if (!firing && contact.distanceToSquared(this.playerPoint(player, contact, this.target)) > fistRadius ** 2) return;
            this.environment.attack(pose.kind, contact, end, player);
        } else if (wall && hit?.obstacle?.name === 'town-wall' &&
            (firing || contact.distanceToSquared(hit.position) <= fistRadius ** 2)) {
            this.wallHp = Math.max(0, this.wallHp - stats.damage);
            this.environment.attack(pose.kind, contact, hit.position);
            if (this.wallHp === 0) this.environment.wallLost(hit.position, wall.heading);
        }
    }

    damage(index: number, damage: number): { accepted: boolean; killed: boolean } {
        const bot = this.bots[index - ENEMY_COUNT];
        if (!bot?.pose || bot.pose.hp <= 0 || this.wallHp === 0 || !Number.isFinite(damage) || damage <= 0) {
            return { accepted: false, killed: false };
        }
        const pose = bot.pose;
        pose.hp = Math.max(0, pose.hp - damage);
        const data = targetData(bot.group);
        data.hp = pose.hp;
        if (pose.hp > 0) return { accepted: true, killed: false };
        cancelHookForTarget(bot.group);
        this.setPhase(bot, 'death');
        data.eliminationRevision++;
        this.present(bot);
        return { accepted: true, killed: true };
    }

    nextSequence(): number { return ++this.sequence; }

    snapshot(): InfantryState {
        const round = (value: number) => Math.round(value * 1000) / 1000;
        const bots = this.bots.flatMap(({ pose }) => pose ? [{
            ...pose, position: { x: round(pose.position.x), y: 0, z: round(pose.position.z) },
            yaw: THREE.MathUtils.clamp(round(pose.yaw), -Math.PI, Math.PI),
            pitch: THREE.MathUtils.clamp(round(pose.pitch), -Math.PI / 2, Math.PI / 2), time: round(pose.time),
        }] : []);
        return { sequence: this.nextSequence(), day: this.day, wallHp: this.wallHp, queued: this.queued, bots };
    }

    acceptSequence(sequence: number): boolean {
        if (sequence <= this.received) return false;
        this.received = sequence;
        return true;
    }

    receive(snapshot: InfantryState): void {
        if (snapshot.day < this.day || snapshot.wallHp > this.wallHp || !this.acceptSequence(snapshot.sequence)) return;
        this.day = snapshot.day;
        this.replicaQueued = snapshot.queued ?? 0;
        this.wallHp = snapshot.wallHp;
        const slots = new Set(snapshot.bots.map(pose => pose.slot));
        for (const pose of snapshot.bots) {
            const bot = this.bots[pose.slot];
            this.install(bot, pose);
            if (pose.hp <= 0) targetData(bot.group).eliminationRevision = pose.revision + 1;
            this.present(bot);
        }
        this.bots.forEach((bot, slot) => { if (!slots.has(slot) && bot.pose) this.remove(bot); });
    }

    advanceReplica(delta: number): void {
        for (const bot of this.bots) {
            if (!bot.pose || !bot.visual) continue;
            const pose = bot.pose;
            const position = bot.group.position;
            const response = pose.phase === 'death' ? 1 : 1 - Math.exp(-NETWORK_POSITION_RESPONSE * delta);
            position.x = THREE.MathUtils.lerp(position.x, pose.position.x, response);
            position.z = THREE.MathUtils.lerp(position.z, pose.position.z, response);
            // Remote copies follow the same seeded basin floor as the host so
            // they visibly sink and climb without extra network fields.
            position.y = INFANTRY[pose.kind].height / 2 + getLavaPitFloorY(position.x, position.z, this.lava);
            const duration = poseAction(bot.visual, pose).getClip().duration;
            pose.time = pose.phase === 'moving' || pose.phase === 'idle' ? (pose.time + delta) % duration : Math.min(pose.time + delta, duration);
            this.present(bot);
        }
    }

    acceptKill(event: Extract<InfantryEvent, { kind: 'kill' }>): void {
        const bot = this.bots[event.slot];
        if (!bot.pose || bot.pose.revision !== event.revision || bot.pose.hp <= 0) return;
        this.damage(ENEMY_COUNT + event.slot, bot.pose.hp);
    }

    private removeVisual(bot: Bot): void {
        if (!bot.visual) return;
        const { model, mixer } = bot.visual;
        mixer.stopAllAction();
        mixer.uncacheRoot(model);
        model.traverse(node => { if (node instanceof THREE.SkinnedMesh) node.skeleton.dispose(); });
        model.removeFromParent();
        bot.visual = undefined;
    }

    private remove(bot: Bot): void {
        cancelHookForTarget(bot.group);
        this.removeVisual(bot);
        bot.group.removeFromParent();
        bot.group.visible = targetData(bot.group).bodyMesh.visible = false;
        targetData(bot.group).hp = 0;
        bot.pose = bot.route = bot.wall = bot.chase = undefined;
    }

    dispose(): void {
        this.disposed = true;
        for (const bot of this.bots) this.remove(bot);
        disposeAssets([...this.assets.values()]);
        this.assets.clear();
        this.geometry.dispose();
        this.proxyMaterial.dispose();
    }
}
