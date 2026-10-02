import * as THREE from 'three';
import { BULLET_TRAVEL_DISTANCE, MECHA_ROCKET_SPEED, MECHA_ROCKET_RADIUS, MECHA_ROCKET_BLAST_RADIUS, MECHA_ROCKET_POOL_SIZE, MECHA_ROCKET_STRAIGHT_DISTANCE,
    MECHA_ROCKET_TURN_SPEED, MECHA_ROCKET_GUIDANCE_RESPONSE, MECHA_ROCKET_LANDING_MIN, MECHA_ROCKET_LANDING_MAX, MECHA_ROCKET_GROUND_MIN_DISTANCE, WEAPON_STATS } from './config.js';
import { segmentRoundedBoxHitT } from './gameplayMath.js';
import { distanceToOrientedBox } from './smartGogglesMath.js';
import { obstacleData, targetData } from './userDataTypes.js';
import { getParticleLimit, scaleParticleCount, userSettings } from './settings.js';
import { state } from './state.js';
import { closestPlayerBodyPoint, segmentPlayerHitboxHitT } from './playerHitbox.js';

export interface RocketLock { object: THREE.Group; index: number; revision: number }
export type RocketObstacleQuery = (sx: number, sz: number, ex: number, ez: number, out: THREE.Object3D[], padding?: number) => THREE.Object3D[];
export type RocketFlightMode = 'guided' | 'straight' | 'wandering';
export interface RocketPlayer { position: THREE.Vector3; yaw: number; lifeId: number; alive: boolean; velocity: THREE.Vector3 }
export interface RocketLaunch { mode: RocketFlightMode; target?: RocketLock | null; seed?: number;
    player?: RocketPlayer; damage?: number; turnSpeed?: number; guidanceResponse?: number }
interface Rocket { mesh: THREE.Group; active: boolean; start: THREE.Vector3; position: THREE.Vector3; forward: THREE.Vector3;
    end: THREE.Vector3; direction: THREE.Vector3; target: RocketLock | null; travel: number; age: number; smoke: number;
    mode: RocketFlightMode; targetPosition: THREE.Vector3; velocity: THREE.Vector3; landingDistance: number; noise: number;
    enemy: boolean; playerLife: number | null; player: RocketPlayer | null; damage: number; turnSpeed: number; response: number; }
interface Spark { position: THREE.Vector3; velocity: THREE.Vector3; age: number; life: number; size: number; smoke: boolean }
const FORWARD = new THREE.Vector3(0, 0, 1);
const IDENTITY = new THREE.Quaternion();

/** Guidance, collision and rendering share the same sampled curve. A separate
 * fixed pool avoids inheriting the bean bullets' delayed, finite homing or HUD
 * acquisition delay. Target revisions prevent following recycled NPC bodies. */
export class MechaRockets {
    readonly group = new THREE.Group();
    selected: RocketLock | null = null;
    clock = 0;
    private readonly rockets: Rocket[] = [];
    private readonly sparks: Spark[] = Array.from({ length: 192 }, () => ({ position: new THREE.Vector3(), velocity: new THREE.Vector3(), age: 10, life: 0, size: 0, smoke: false }));
    private readonly particles: THREE.InstancedMesh;
    private nextSpark = 0;
    private readonly candidates: THREE.Object3D[] = [];
    private readonly inverse = new THREE.Matrix4();
    private readonly localStart = new THREE.Vector3();
    private readonly localEnd = new THREE.Vector3();
    private readonly minimum = new THREE.Vector3();
    private readonly maximum = new THREE.Vector3();
    private readonly point = new THREE.Vector3();
    private readonly projected = new THREE.Vector3();
    private readonly desired = new THREE.Vector3();
    private readonly steering = new THREE.Quaternion();
    private readonly side = new THREE.Vector3();
    private readonly line = new THREE.Vector3();
    private readonly next = new THREE.Vector3();
    private readonly dummy = new THREE.Object3D();
    private readonly particleColor = new THREE.Color();
    private readonly frustum = new THREE.Frustum();
    private readonly projection = new THREE.Matrix4();
    private readonly ray = new THREE.Raycaster();
    private readonly hits: THREE.Intersection[] = [];
    radius = MECHA_ROCKET_RADIUS;
    private launchSerial = 0;
    setRadius(radius: number): void { this.radius = radius; for (const r of this.rockets) r.mesh.scale.set(radius / 0.4, radius / 0.4, 1); }
    constructor() {
        this.group.name = 'Mecha rockets and smoke';
        const body = new THREE.CylinderGeometry(0.32, 0.4, 2.4, 10).rotateX(Math.PI / 2);
        const tip = new THREE.ConeGeometry(0.32, 0.8, 10).rotateX(Math.PI / 2);
        const hull = new THREE.MeshStandardMaterial({ color: 0x929ca5, metalness: 0.65, roughness: 0.3 });
        const nose = new THREE.MeshStandardMaterial({ color: 0xd35432, roughness: 0.4 });
        const flameGeo = new THREE.SphereGeometry(0.4, 8, 6);
        const flameMat = new THREE.MeshBasicMaterial({ color: 0xffb32d, toneMapped: false });
        for (let i = 0; i < MECHA_ROCKET_POOL_SIZE; i++) {
            const mesh = new THREE.Group(); const a = new THREE.Mesh(body, hull), b = new THREE.Mesh(tip, nose), c = new THREE.Mesh(flameGeo, flameMat);
            b.position.z = 1.6; c.position.z = -1.5; c.scale.set(1, 1, 2); mesh.add(a, b, c); mesh.visible = false; this.group.add(mesh);
            this.rockets.push({ mesh, active: false, start: new THREE.Vector3(), position: new THREE.Vector3(), forward: new THREE.Vector3(), end: new THREE.Vector3(), direction: new THREE.Vector3(), target: null, travel: 0, age: 0, smoke: 0, mode: 'straight', targetPosition: new THREE.Vector3(), velocity: new THREE.Vector3(), landingDistance: 85, noise: 0,
                enemy: false, playerLife: null, player: null, damage: WEAPON_STATS.SNIPER.damage, turnSpeed: MECHA_ROCKET_TURN_SPEED, response: MECHA_ROCKET_GUIDANCE_RESPONSE });
        }
        this.setRadius(this.radius);
        this.particles = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.45, depthWrite: false }), this.sparks.length);
        this.particles.instanceMatrix.setUsage(THREE.DynamicDrawUsage); this.particles.frustumCulled = false; this.particles.visible = false; this.group.add(this.particles);
        // Allocate colors before renderer preparation; the first muzzle burst
        // must not introduce a new instancing shader variant during gameplay.
        this.particles.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(this.sparks.length * 3).fill(1), 3).setUsage(THREE.DynamicDrawUsage);
    }
    get activeCount(): number { return this.rockets.filter(r => r.active).length; }
    private valid(lock: RocketLock | null, targets: readonly THREE.Group[]): lock is RocketLock {
        if (!lock || targets[lock.index] !== lock.object) return false;
        const data = targetData(lock.object);
        return data.hp > 0 && (data.eliminationRevision ?? 0) === lock.revision;
    }
    private bodyPoint(target: THREE.Group, from: THREE.Vector3, out: THREE.Vector3): THREE.Vector3 {
        const body = targetData(target).bodyMesh;
        body.updateWorldMatrix(true, false); if (!body.geometry.boundingBox) body.geometry.computeBoundingBox();
        this.inverse.copy(body.matrixWorld).invert();
        return out.copy(from).applyMatrix4(this.inverse).clamp(body.geometry.boundingBox!.min, body.geometry.boundingBox!.max).applyMatrix4(body.matrixWorld);
    }
    private obstacleT(start: THREE.Vector3, end: THREE.Vector3, query: RocketObstacleQuery, radius = 0): number | null {
        let nearest: number | null = null;
        for (const object of query(start.x, start.z, end.x, end.z, this.candidates, radius)) {
            if (object.userData.damageTarget === 'forgotten-mecha') continue;
            const d = obstacleData(object), hh = d.halfH ?? d.height / 2;
            this.minimum.set(object.position.x - d.halfW, object.position.y - hh, object.position.z - d.halfD);
            this.maximum.set(object.position.x + d.halfW, object.position.y + hh, object.position.z + d.halfD);
            const t = segmentRoundedBoxHitT(start, end, this.minimum, this.maximum, radius);
            if (t !== null && (nearest === null || t < nearest)) nearest = t;
        }
        if (end.y < radius && end.y < start.y) { const t = Math.max(0, (start.y - radius) / (start.y - end.y)); if (nearest === null || t < nearest) nearest = t; }
        return nearest;
    }
    select(camera: THREE.PerspectiveCamera, origin: THREE.Vector3, targets: readonly THREE.Group[], query: RocketObstacleQuery): RocketLock | null {
        camera.updateMatrixWorld(true); this.projection.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse); this.frustum.setFromProjectionMatrix(this.projection);
        let score = Infinity; this.selected = null;
        for (const target of targets) {
            const d = targetData(target), body = d.bodyMesh;
            if (d.hp <= 0 || !target.visible || !body?.visible) continue;
            body.updateWorldMatrix(true, false); if (!body.geometry.boundingBox) body.geometry.computeBoundingBox();
            if (!this.frustum.intersectsObject(body) || distanceToOrientedBox(origin, body.geometry.boundingBox!, body.matrixWorld) > BULLET_TRAVEL_DISTANCE) continue;
            body.geometry.boundingBox!.getCenter(this.point).applyMatrix4(body.matrixWorld);
            this.projected.copy(this.point).project(camera);
            const candidateScore = this.projected.x ** 2 + this.projected.y ** 2;
            if (candidateScore >= score) continue;
            // Try the center and box corners so partial cover does not hide a
            // genuinely visible target. Other enemy bodies can occlude it too.
            let visible = false;
            for (let sample = 0; sample < 9 && !visible; sample++) {
                if (sample) this.point.set(sample & 1 ? body.geometry.boundingBox!.min.x : body.geometry.boundingBox!.max.x,
                    sample & 2 ? body.geometry.boundingBox!.min.y : body.geometry.boundingBox!.max.y,
                    sample & 4 ? body.geometry.boundingBox!.min.z : body.geometry.boundingBox!.max.z).applyMatrix4(body.matrixWorld);
                this.line.subVectors(this.point, camera.position); const distance = this.line.length();
                if (this.obstacleT(camera.position, this.point, query) !== null) continue;
                this.ray.set(camera.position, this.line.normalize()); this.ray.far = Math.max(0, distance - 0.05); this.hits.length = 0;
                for (const other of targets) if (other !== target && targetData(other).hp > 0) this.ray.intersectObject(targetData(other).bodyMesh, false, this.hits);
                visible = !this.hits.length;
            }
            if (visible) { score = candidateScore; this.selected = { object: target, index: d.index, revision: d.eliminationRevision ?? 0 }; }
        }
        return this.selected;
    }
    fire(origin: THREE.Vector3, direction: THREE.Vector3, targets: readonly THREE.Group[], launch: RocketLaunch = { mode: 'guided' }): boolean {
        const rocket = this.rockets.find(r => !r.active); if (!rocket) return false;
        rocket.active = rocket.mesh.visible = true; rocket.start.copy(origin); rocket.position.copy(origin);
        rocket.forward.copy(direction).normalize(); rocket.direction.copy(rocket.forward);
        const lock = launch.target === undefined ? this.selected : launch.target;
        rocket.target = launch.mode === 'guided' && this.valid(lock, targets) ? { ...lock } : null;
        rocket.mode = launch.mode; rocket.travel = rocket.age = rocket.smoke = 0; rocket.velocity.set(0, 0, 0);
        // Profiles and target lives belong to each launch. A later mount or
        // helmet toggle cannot change a rocket already in flight.
        rocket.enemy = launch.player !== undefined;
        rocket.playerLife = launch.player?.lifeId ?? null;
        rocket.player = launch.mode === 'guided' ? launch.player ?? null : null;
        rocket.damage = launch.damage ?? WEAPON_STATS.SNIPER.damage;
        rocket.turnSpeed = launch.turnSpeed ?? MECHA_ROCKET_TURN_SPEED;
        rocket.response = launch.guidanceResponse ?? MECHA_ROCKET_GUIDANCE_RESPONSE;
        if (rocket.target) {
            this.bodyPoint(rocket.target.object, origin, rocket.end);
            rocket.targetPosition.copy(rocket.target.object.position);
            if (origin.distanceTo(rocket.end) > BULLET_TRAVEL_DISTANCE) rocket.target = null;
        }
        if (rocket.mode === 'wandering') {
            // A launch-owned random path never changes when the helmet closes.
            const serial = launch.seed ?? ++this.launchSerial;
            let hash = Math.imul(serial ^ 0x726f636b, 0x45d9f3b);
            hash = Math.imul(hash ^ hash >>> 16, 0x45d9f3b);
            const random = ((hash ^ hash >>> 16) >>> 0) / 0x100000000;
            rocket.noise = random * Math.PI * 2; rocket.landingDistance = THREE.MathUtils.lerp(MECHA_ROCKET_LANDING_MIN, MECHA_ROCKET_LANDING_MAX, random);
            this.line.copy(direction); this.line.y = 0;
            if (this.line.lengthSq() < 0.01) this.line.set(0, 0, 1);
            this.line.normalize().applyAxisAngle(new THREE.Vector3(0, 1, 0), (random - 0.5) * 0.6);
            rocket.end.copy(origin).addScaledVector(this.line, rocket.landingDistance); rocket.end.y = 0;
        }
        rocket.mesh.position.copy(origin); rocket.mesh.quaternion.setFromUnitVectors(FORWARD, rocket.forward);
        if (userSettings.muzzleFlashes) this.emit(origin, 10, false); return true;
    }
    private guide(rocket: Rocket, step: number): void {
        if (rocket.travel < MECHA_ROCKET_STRAIGHT_DISTANCE - 1e-8) return;
        if (rocket.target || rocket.player) {
            if (rocket.player) closestPlayerBodyPoint(rocket.position, rocket.player.position, rocket.player.yaw, this.desired);
            else this.bodyPoint(rocket.target!.object, rocket.position, this.desired);
            const distance = rocket.position.distanceTo(this.desired);
            this.desired.addScaledVector(rocket.velocity, Math.min(1.5, distance / MECHA_ROCKET_SPEED));
            // A modest loft fades at long range, reserving the physical budget
            // for the target rather than extending flight beyond 700m.
            const range = rocket.start.distanceTo(this.desired);
            const loft = rocket.enemy ? 0 : Math.min(10, distance * 0.06) * Math.max(0, 1 - range / BULLET_TRAVEL_DISTANCE);
            this.desired.y += loft;
        } else if (rocket.mode === 'wandering') {
            const horizontal = Math.hypot(rocket.position.x - rocket.start.x, rocket.position.z - rocket.start.z);
            const ahead = Math.min(rocket.landingDistance, horizontal + 10);
            const progress = ahead / rocket.landingDistance;
            this.line.subVectors(rocket.end, rocket.start); this.line.y = 0; this.line.normalize();
            this.side.set(this.line.z, 0, -this.line.x);
            this.desired.copy(rocket.start).addScaledVector(this.line, ahead)
                .addScaledVector(this.side, Math.sin(progress * Math.PI * 3 + rocket.noise) * Math.sin(progress * Math.PI) * 9);
            const descent = THREE.MathUtils.smoothstep(ahead, MECHA_ROCKET_GROUND_MIN_DISTANCE, rocket.landingDistance);
            this.desired.y = rocket.start.y * (1 - descent) + Math.sin(progress * Math.PI) * 6;
        } else return;
        this.desired.sub(rocket.position).normalize();
        // Rotate velocity, never recompute position from a moving launch curve.
        // Small simulation steps bound both acceleration and collision curvature.
        const difference = rocket.direction.angleTo(this.desired);
        if (difference > 1e-8) {
            const turn = Math.min(difference * (1 - Math.exp(-rocket.response * step)), rocket.turnSpeed * step);
            this.steering.setFromUnitVectors(rocket.direction, this.desired);
            this.steering.slerp(IDENTITY, 1 - turn / difference);
            rocket.direction.applyQuaternion(this.steering).normalize();
        }
    }
    private emit(position: THREE.Vector3, count: number, smoke: boolean): void {
        const amount = Math.min(scaleParticleCount(count), Math.max(0, getParticleLimit() - state.activeParticles.length));
        for (let i = 0; i < amount; i++) { const p = this.sparks[this.nextSpark++ % this.sparks.length]; p.position.copy(position); p.age = 0; p.life = smoke ? 0.9 : 0.6;
            const a = this.nextSpark * 2.399963; p.velocity.set(Math.cos(a), (i % 5) / 5, Math.sin(a)).multiplyScalar(smoke ? 1.2 : 12); p.size = smoke ? 0.8 : 0.45; p.smoke = smoke; }
    }
    private explode(rocket: Rocket, point: THREE.Vector3, targets: readonly THREE.Group[], query: RocketObstacleQuery, hit: (index: number, damage: number) => void,
        player: RocketPlayer | undefined, playerHit: (damage: number) => void): void {
        this.emit(point, 48, false); this.emit(point, 24, true);
        if (rocket.enemy) {
            if (player?.alive && player.lifeId === rocket.playerLife) {
                closestPlayerBodyPoint(point, player.position, player.yaw, this.point);
                if (point.distanceTo(this.point) <= MECHA_ROCKET_BLAST_RADIUS && this.obstacleT(point, this.point, query) === null) playerHit(rocket.damage);
            }
            return;
        }
        // Snapshot every victim before dispatch: hit handlers may respawn and
        // recycle objects immediately. Each life receives at most one blast hit.
        const victims: number[] = [];
        for (const target of targets) {
            const d = targetData(target); if (d.hp <= 0) continue;
            this.bodyPoint(target, point, this.point);
            if (point.distanceTo(this.point) <= MECHA_ROCKET_BLAST_RADIUS && this.obstacleT(point, this.point, query) === null) victims.push(d.index);
        }
        for (const index of victims) hit(index, rocket.damage);
    }
    update(delta: number, targets: readonly THREE.Group[], query: RocketObstacleQuery, hit: (index: number, damage: number) => void,
        player?: RocketPlayer, playerHit: (damage: number) => void = () => {}): void {
        if (!Number.isFinite(delta) || delta <= 0) return; this.clock += delta;
        for (const rocket of this.rockets) {
            if (!rocket.active) continue;
            if (rocket.enemy && (!player?.alive || player.lifeId !== rocket.playerLife)) {
                rocket.active = rocket.mesh.visible = false; rocket.player = null; continue;
            }
            if (rocket.player && player) { rocket.player = player; rocket.velocity.copy(player.velocity); }
            rocket.age += delta;
            if (rocket.target && !this.valid(rocket.target, targets)) rocket.target = null;
            if (rocket.target) {
                this.line.subVectors(rocket.target.object.position, rocket.targetPosition).multiplyScalar(1 / delta);
                rocket.velocity.lerp(this.line, 1 - Math.exp(-delta * 12));
                rocket.targetPosition.copy(rocket.target.object.position);
            }
            let remainingTime = delta;
            while (remainingTime > 1e-9 && rocket.active) {
                let step = Math.min(remainingTime, 1 / 240);
                if (rocket.travel < MECHA_ROCKET_STRAIGHT_DISTANCE - 1e-8)
                    step = Math.min(step, (MECHA_ROCKET_STRAIGHT_DISTANCE - rocket.travel) / MECHA_ROCKET_SPEED);
                this.guide(rocket, step);
                let distance = Math.min(MECHA_ROCKET_SPEED * step, BULLET_TRAVEL_DISTANCE - rocket.travel);
                this.next.copy(rocket.position).addScaledVector(rocket.direction, distance);
                // The visible hull is 3.2m long. Sweep its center and both ends,
                // with the fitted bore radius, rather than a thin bullet ray.
                let contact: number | null = null;
                for (const offset of [-1.2 + this.radius, 0, 2 - this.radius]) {
                    this.localStart.copy(rocket.position).addScaledVector(rocket.direction, offset);
                    this.localEnd.copy(this.next).addScaledVector(rocket.direction, offset);
                    const obstacle = this.obstacleT(this.localStart, this.localEnd, query, this.radius);
                    if (obstacle !== null && (contact === null || obstacle < contact)) contact = obstacle;
                    if (rocket.enemy && player) {
                        const value = segmentPlayerHitboxHitT(this.localStart, this.localEnd, player.position, player.yaw, this.radius);
                        if (value !== null && (contact === null || value < contact)) contact = value;
                    }
                    for (const target of rocket.enemy ? [] : targets) {
                        const d = targetData(target); if (d.hp <= 0 || !d.bodyMesh) continue;
                        const body = d.bodyMesh; body.updateWorldMatrix(true, false); if (!body.geometry.boundingBox) body.geometry.computeBoundingBox();
                        this.inverse.copy(body.matrixWorld).invert();
                        this.point.copy(this.localStart).applyMatrix4(this.inverse); this.projected.copy(this.localEnd).applyMatrix4(this.inverse);
                        const value = segmentRoundedBoxHitT(this.point, this.projected, body.geometry.boundingBox!.min, body.geometry.boundingBox!.max,
                            this.radius / body.matrixWorld.getMaxScaleOnAxis());
                        if (value !== null && (contact === null || value < contact)) contact = value;
                    }
                }
                if (contact !== null) {
                    // Place the blast on the contacted hull surface. This avoids
                    // exploding on the far side of thin cover due to the nose.
                    const impact = rocket.position.clone().lerp(this.next, contact);
                    this.explode(rocket, impact, targets, query, hit, player, playerHit); rocket.active = false;
                } else { rocket.position.copy(this.next); rocket.travel += distance; }
                if (rocket.travel >= BULLET_TRAVEL_DISTANCE - 1e-6 || rocket.age > 8) rocket.active = false;
                remainingTime -= step;
            }
            rocket.mesh.visible = rocket.active; rocket.mesh.position.copy(rocket.position); rocket.mesh.quaternion.setFromUnitVectors(FORWARD, rocket.direction);
            rocket.smoke += delta; if (rocket.active && rocket.smoke >= 0.025) { this.emit(rocket.position, 2, true); rocket.smoke = 0; }
        }
        const limit = Math.min(this.sparks.length, Math.max(0, getParticleLimit() - state.activeParticles.length));
        let count = 0;
        for (const p of this.sparks) {
            p.age += delta; if (p.age >= p.life || count >= limit) continue;
            p.position.addScaledVector(p.velocity, delta); p.velocity.y -= (p.smoke ? -1 : 12) * delta;
            this.dummy.position.copy(p.position); this.dummy.scale.setScalar(p.size * (p.smoke ? 1 + p.age * 2 : 1) * (1 - p.age / p.life)); this.dummy.updateMatrix();
            this.particles.setMatrixAt(count, this.dummy.matrix); this.particles.setColorAt(count++, this.particleColor.setHex(p.smoke ? 0x777c85 : 0xffa52c));
        }
        this.particles.count = count; this.particles.visible = count > 0; this.particles.instanceMatrix.needsUpdate = true; if (this.particles.instanceColor) this.particles.instanceColor.needsUpdate = true;
    }
    clear(): void { this.selected = null; for (const r of this.rockets) r.active = r.mesh.visible = false; for (const p of this.sparks) p.age = 10; this.particles.visible = false; }
    dispose(): void {
        this.clear(); this.group.removeFromParent(); const geometries = new Set<THREE.BufferGeometry>(), materials = new Set<THREE.Material>();
        this.group.traverse(n => { if (n instanceof THREE.Mesh) { geometries.add(n.geometry); for (const m of Array.isArray(n.material) ? n.material : [n.material]) materials.add(m); } });
        this.particles.dispose(); for (const g of geometries) g.dispose(); for (const m of materials) m.dispose();
    }
}
