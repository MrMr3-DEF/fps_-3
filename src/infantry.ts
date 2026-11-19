import * as THREE from 'three';
import { GLTFLoader, type GLTF } from 'three/addons/loaders/GLTFLoader.js';
import { clone } from 'three/addons/utils/SkeletonUtils.js';
import {
    ENEMY_COUNT, INFANTRY, INFANTRY_DEBRIS_TIME, INFANTRY_LIMIT, INFANTRY_RANGE, LAVA_POOL_HALF_SIZE,
    MAP_HALF_SIZE, NETWORK_POSITION_RESPONSE, TOWN_WALL_HP, type InfantryKind,
} from './config.js';
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
const ACTOR_CLEARANCE = 0.9;
const WALL_STANDOFF = .95;
const RIGHT_HAND = THREE.PropertyBinding.sanitizeNodeName('hand.R');
const X_AXIS = new THREE.Vector3(1, 0, 0);
const Y_AXIS = new THREE.Vector3(0, 1, 0);

export interface InfantryPlayer {
    id: string;
    lifeId: number;
    position: THREE.Vector3;
    yaw: number;
    mounted?: { revision: number; bounds: THREE.Box3 };
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
    actions: Record<InfantryPhase, THREE.AnimationAction>;
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
    cooldown: number;
    victim?: Pick<InfantryPlayer, 'id' | 'lifeId'> & { mountedRevision?: number };
    wall?: { point: THREE.Vector3; heading: number };
}

export function infantryWave(day: number): [number, number, number] {
    return [5 + Math.max(0, day - 3), day >= 2 ? 3 + Math.max(0, day - 3) : 0,
        day >= 3 ? 3 + day - 3 : 0];
}

export function nearestInfantryPlayer(origin: THREE.Vector3, players: readonly InfantryPlayer[],
    visible: (player: InfantryPlayer, point: THREE.Vector3) => boolean): InfantryPlayer | undefined {
    let best: InfantryPlayer | undefined;
    let distance = INFANTRY_RANGE ** 2;
    const point = new THREE.Vector3();
    for (const player of players) {
        if (player.mounted) player.mounted.bounds.clampPoint(origin, point); else point.copy(player.position);
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
    private readonly parentRotation = new THREE.Quaternion();
    private readonly axis = new THREE.Vector3();
    private readonly scene: THREE.Scene;
    private readonly seed: number;
    private readonly environment: InfantryEnvironment;
    private readonly nav: MechaNavigation | null;
    private disposed = false;

    constructor(scene: THREE.Scene, targets: THREE.Group[], seed: number,
        obstacles: readonly THREE.Object3D[], lava: readonly THREE.Object3D[], environment: InfantryEnvironment,
        authoritative: boolean) {
        this.scene = scene;
        this.seed = seed;
        this.environment = environment;
        this.nav = authoritative ? new MechaNavigation(obstacles.map(object => {
            const { height, halfH = height / 2, halfW, halfD } = obstacleData(object);
            const { x, y, z } = object.position;
            return { x, z, halfW, halfD, bottom: y - halfH, top: y + halfH };
        }), lava.map(pool => ({
            x: pool.position.x, z: pool.position.z, halfW: LAVA_POOL_HALF_SIZE, halfD: LAVA_POOL_HALF_SIZE, bottom: 0, top: .15,
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
            for (const name of ['Idle', stats.move, stats.attack, 'Death']) {
                if (!asset.animations.some(clip => clip.name === name)) throw new Error(`Infantry ${kind} is missing ${name}`);
            }
            if (!asset.scene.getObjectByName(kind === 'base' ? 'muzzle' : RIGHT_HAND)) throw new Error(`Infantry ${kind} is missing its attack joint`);
        }
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
        const route = this.nav!.borderSpawn(this.seed ^ Math.imul(serial, 0x9e3779b9),
            point => this.bots.every(other => !other.pose || Math.hypot(other.group.position.x - point.x, other.group.position.z - point.z) > 4), 12);
        const [first, next] = route.points;
        const { index, eliminationRevision } = targetData(bot.group);
        const kind = KINDS[selected];
        this.install(bot, { slot: index - ENEMY_COUNT, revision: eliminationRevision + 1, kind, hp: INFANTRY[kind].hp,
            position: { ...first, y: 0 }, yaw: Math.atan2(next.x - first.x, next.z - first.z), pitch: 0, phase: 'moving', time: 0 });
        this.setRoute(bot, route);
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
            const aim = pose.kind === 'base' ? model.getObjectByName('torso_yaw') : undefined;
            bot.visual = { model, mixer, actions: {
                idle: makeAction('Idle', true), moving: makeAction(stats.move, true),
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
        targetData(bot.group).hp = pose.hp;
    }

    private setPhase(bot: Bot, phase: InfantryPhase): void {
        const pose = bot.pose!;
        if (phase !== pose.phase) { pose.phase = phase; pose.time = 0; }
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
        const action = visual.actions[pose.phase];
        for (const other of Object.values(visual.actions)) if (other !== action && other.isScheduled()) other.stop();
        if (!action.isScheduled()) action.reset().play();
        action.time = Math.min(time, action.getClip().duration);
        if (visual.aimRest) visual.aim!.quaternion.copy(visual.aimRest);
        visual.model.rotation.y = pose.yaw;
        visual.mixer.update(0);
        if (visual.aim?.parent) {
            visual.aim.parent.getWorldQuaternion(this.parentRotation).invert();
            this.axis.copy(X_AXIS).applyAxisAngle(Y_AXIS, pose.yaw).applyQuaternion(this.parentRotation);
            visual.aim.quaternion.premultiply(this.aimRotation.setFromAxisAngle(this.axis, -pose.pitch));
        }
        bot.group.updateWorldMatrix(true, true);
    }

    private sightPoint(bot: Bot): THREE.Vector3 {
        return this.origin.copy(bot.group.position).setY(INFANTRY[bot.pose!.kind].height * .72);
    }

    private playerPoint(player: InfantryPlayer, origin: THREE.Vector3, out: THREE.Vector3): THREE.Vector3 {
        return player.mounted ? player.mounted.bounds.clampPoint(origin, out) : closestPlayerBodyPoint(origin, player.position, player.yaw, out);
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
        if (bot.pose!.kind !== 'base' && Math.hypot(start.x - bot.wall.point.x, start.z - bot.wall.point.z) > WALL_STANDOFF + .06) {
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
        if (pose.phase === 'attack') {
            const previous = pose.time;
            pose.time += delta;
            if (previous < stats.contact && pose.time >= stats.contact) this.strike(bot, players, stats.contact);
            if (pose.time >= bot.visual!.actions.attack.getClip().duration) this.setPhase(bot, 'idle');
        } else {
            const origin = this.sightPoint(bot);
            const player = nearestInfantryPlayer(origin, players, (candidate, point) => !this.environment.trace(origin, point, Boolean(candidate.mounted)));
            const target = player ? this.playerPoint(player, origin, this.target) : bot.wall?.point;
            const inReach = player ? Boolean(target && origin.distanceToSquared(target) <= stats.engage ** 2) : this.wallInReach(bot, stats.range);
            if (target && inReach) {
                this.aimAt(bot, target);
                if (bot.cooldown <= 0) {
                    this.setPhase(bot, 'attack');
                    bot.victim = player ? { id: player.id, lifeId: player.lifeId, mountedRevision: player.mounted?.revision } : undefined;
                    bot.cooldown = stats.interval;
                    if (stats.contact === 0) this.strike(bot, players, 0);
                } else this.setPhase(bot, 'idle');
            } else if (player && this.move(bot, player.position, delta, true)) {
                bot.route = undefined;
            } else {
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

    private followWallRoute(bot: Bot, delta: number): void {
        if (!bot.route) {
            const position = bot.group.position;
            // A chase may end between cells next to a blocked rounded cell.
            for (const [dx, dz] of [[0, 0], [4, 0], [-4, 0], [0, 4], [0, -4], [4, 4], [4, -4], [-4, 4], [-4, -4]]) {
                const route = this.nav!.routeFrom({ x: position.x + dx, z: position.z + dz }, 12);
                if (route && this.nav!.segmentClear(position, route.points[0])) { this.setRoute(bot, route); break; }
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

    private move(bot: Bot, target: NavigationPoint, delta: number, check: boolean): boolean {
        const position = bot.group.position;
        const dx = target.x - position.x, dz = target.z - position.z;
        const length = Math.hypot(dx, dz);
        if (length < .015) return false;
        const advance = Math.min(1, INFANTRY[bot.pose!.kind].speed * delta / length);
        const next = this.step.set(position.x + dx * advance, position.y, position.z + dz * advance);
        if (check && !this.nav!.segmentClear(position, next)) return false;
        this.setPhase(bot, 'moving');
        bot.pose!.yaw = Math.atan2(dx, dz);
        bot.pose!.pitch = 0;
        position.copy(next);
        bot.pose!.position = { x: position.x, y: 0, z: position.z };
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
        const firing = pose.kind === 'base';
        const joint = firing ? bot.visual!.muzzle : bot.visual!.hand;
        const contact = joint!.getWorldPosition(this.contact);
        const start = firing ? contact : center;
        const wall = player ? undefined : bot.wall;
        const end = this.end.copy(target);
        const fistRadius = pose.kind === 'fast' ? .7 : 1.05;
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
        return { sequence: this.nextSequence(), day: this.day, wallHp: this.wallHp, bots };
    }

    acceptSequence(sequence: number): boolean {
        if (sequence <= this.received) return false;
        this.received = sequence;
        return true;
    }

    receive(snapshot: InfantryState): void {
        if (snapshot.day < this.day || snapshot.wallHp > this.wallHp || !this.acceptSequence(snapshot.sequence)) return;
        this.day = snapshot.day;
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
            const duration = bot.visual.actions[pose.phase].getClip().duration;
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
        bot.pose = bot.route = bot.wall = undefined;
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
