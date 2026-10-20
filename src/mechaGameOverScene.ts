import * as THREE from 'three';
import { GLTFLoader, type GLTF } from 'three/addons/loaders/GLTFLoader.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { MECHA_HEIGHT, TOWN_HALF_SIZE, TOWN_WALL_HEIGHT, TOWN_WALL_THICKNESS } from './config.js';
import type { TownBox, TownMaterial } from './town.js';
import { createEndingCastle } from './mechaEndingCastle.js';
import { MechaEndingScenery } from './mechaEndingScenery.js';
import { prepareEndingDebris, sampleEndingStone, type EndingStone, type EndingDebrisPaths, type PillarContact } from './mechaEndingDebris.js';
import { avoidEndingPillars, type EndingCameraAdjustment } from './mechaEndingCamera.js';
import { DayNightCycle } from './dayNightCycle.js';

import { MECHA_ENDING_TIMING, sampleMechaEnding, type MechaEndingFrame } from './mechaEndingTimeline.js';
export { MECHA_ENDING_TIMING, sampleMechaEnding } from './mechaEndingTimeline.js';
export type { MechaEndingFrame, MechaEndingPhase } from './mechaEndingTimeline.js';

export const MECHA_ENDING_ASPECT = 16 / 9;
export const MECHA_ENDING_LIMITS = { fragments: 4096, fire: 96, smoke: 112, sparks: 480 } as const;
const GRAVITY = 36;
const yieldPreparation = () => new Promise<void>(resolve => {
    // Posted tasks yield to rendering without a timer/RAF throttle stretching
    // every preparation batch to a second when a review tab loses focus.
    const channel = new MessageChannel();
    channel.port1.onmessage = () => { channel.port1.close(); channel.port2.close(); resolve(); };
    channel.port2.postMessage(null);
});
const modelUrl = new URL('../blender_assets/ironmaw/ironmaw_siege_robot.glb', import.meta.url).href;
const UP = new THREE.Vector3(0, 1, 0);

export interface MechaGameOverOptions {
    seed: number;
    /** Cardinal approach heading, using the same +Z forward axis as Ironmaw. */
    heading: number;
    wallOffset: number;
    lightingElapsed: number;
    effectsSeed?: number;
    particleAmount?: number;
    photosensitivity?: boolean;
    reducedMotion?: boolean;
    /** Rebuild seeded scenery and bake pillar collisions during activation. */
    seededScenery?: boolean;
    /** Supplied by the committed actor; the standalone preview measures its reach. */
    position?: THREE.Vector3;
}

interface FragmentBatch { mesh: THREE.InstancedMesh; pieces: EndingStone[] }
interface Spark { position: THREE.Vector3; velocity: THREE.Vector3; birth: number; life: number }
interface Blast { position: THREE.Vector3; birth: number; power: number }
interface Puff {
    position: THREE.Vector3; velocity: THREE.Vector3;
    birth: number; life: number; radius: number; stretch: number; seed: number;
}

// Match the existing town palette without importing world.ts or its singleton.
const TOWN_COLORS: Record<TownMaterial, number> = {
    stone: 0x727a80, trim: 0xc6bca5, roof: 0x995940, door: 0x654531,
    window: 0x273c46, road: 0xb9ac8e, plaza: 0x8e9076,
    plaster0: 0xd5bd93, plaster1: 0xb9c2b2, plaster2: 0xc6997c, water: 0x2a9ab5,
    gothStone: 0x36313f, gothTrim: 0x797180, gothRoof: 0x34243f,
};

function randomStream(seed: number): () => number {
    let value = seed >>> 0;
    return () => {
        value += 0x6d2b79f5;
        let n = Math.imul(value ^ value >>> 15, 1 | value);
        n ^= n + Math.imul(n ^ n >>> 7, 61 | n);
        return ((n ^ n >>> 14) >>> 0) / 4294967296;
    };
}
const clamp = THREE.MathUtils.clamp;
const smooth = (value: number) => { const t = clamp(value, 0, 1); return t * t * (3 - 2 * t); };

function puffMaterial(kind: 'fire' | 'smoke' | 'glow'): THREE.ShaderMaterial {
    return new THREE.ShaderMaterial({
        transparent: true, depthWrite: false, toneMapped: false,
        blending: kind === 'glow' ? THREE.AdditiveBlending : THREE.NormalBlending,
        uniforms: { clock: { value: 0 }, kind: { value: kind === 'fire' ? 0 : kind === 'smoke' ? 1 : 2 } },
        vertexShader: `
            attribute vec4 puff;
            varying vec2 vUv;
            varying vec4 vPuff;
            void main() {
                vUv = uv; vPuff = puff;
                gl_Position = projectionMatrix * modelViewMatrix * instanceMatrix * vec4(position, 1.0);
            }`,
        fragmentShader: `
            uniform float clock;
            uniform float kind;
            varying vec2 vUv;
            varying vec4 vPuff;
            float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
            float noise(vec2 p) {
                vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
                return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x),
                    mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y);
            }
            float fbm(vec2 p) { return noise(p) * .57 + noise(p * 2.1) * .28 + noise(p * 4.3) * .15; }
            void main() {
                if (vPuff.x <= .001) discard;
                vec2 p = (vUv - .5) * 2.0;
                float n = fbm(p * 3.6 + vec2(vPuff.y, -clock * .85));
                float r = length(p) + (n - .5) * .34;
                float edge = 1.0 - smoothstep(.65, 1.0, r);
                vec3 color;
                float alpha;
                if (kind > 1.5) {
                    alpha = pow(max(0.0, 1.0 - length(p)), 2.3) * vPuff.x;
                    color = vec3(1.0, .24, .025);
                } else if (kind > .5) {
                    float light = clamp(.34 + n * .47 - p.y * .13, 0.0, 1.0);
                    color = mix(vec3(.035, .031, .028), vec3(.35, .30, .24), light);
                    color = mix(color, vec3(.32, .255, .17), vPuff.z);
                    alpha = edge * vPuff.x;
                } else {
                    float heat = clamp((1.0 - r) * 1.3 + n * .8 - .15, 0.0, 1.0);
                    color = mix(vec3(.52, .035, .002), vec3(1.0, .34, .008), smoothstep(.1, .55, heat));
                    color = mix(color, vec3(1.0, .91, .40), smoothstep(.5, .94, heat));
                    alpha = edge * vPuff.x;
                }
                if (alpha < .005) discard;
                gl_FragColor = vec4(color, alpha);
                #include <colorspace_fragment>
            }`,
    });
}

export class MechaGameOverScene {
    readonly scene = new THREE.Scene();
    readonly camera = new THREE.PerspectiveCamera(42, MECHA_ENDING_ASPECT, .1, 3000);
    readonly introCamera = new THREE.PerspectiveCamera(75, MECHA_ENDING_ASPECT, .1, 3000);
    readonly robot = new THREE.Group();
    readonly contact = new THREE.Vector3();
    readonly framingPoints: THREE.Vector3[] = [];
    readonly punchDuration: number;
    readonly duration: number;
    readonly punchStart = MECHA_ENDING_TIMING.fadeOut + MECHA_ENDING_TIMING.fadeIn + MECHA_ENDING_TIMING.establish;
    readonly impactTime = this.punchStart + MECHA_ENDING_TIMING.impact;
    frame: MechaEndingFrame;

    private scenery: MechaEndingScenery | null = null;
    private debrisPaths: EndingDebrisPaths | null = null;
    cameraAdjustment: EndingCameraAdjustment = { yaw: 0, height: 0, distanceScale: 1, blocked: 0 };
    private readonly options: MechaGameOverOptions;
    private readonly forward: THREE.Vector3;
    private readonly tangent: THREE.Vector3;
    private readonly mixer: THREE.AnimationMixer;
    private readonly action: THREE.AnimationAction;
    private readonly model: THREE.Group;
    private readonly cycle: DayNightCycle;
    private readonly fragmentBatches: FragmentBatch[] = [];
    private readonly fires: Puff[] = [];
    private readonly smoke: Puff[] = [];
    private fireMesh: THREE.InstancedMesh<THREE.PlaneGeometry, THREE.ShaderMaterial> | null = null;
    private glowMesh: THREE.InstancedMesh<THREE.PlaneGeometry, THREE.ShaderMaterial> | null = null;
    private smokeMesh: THREE.InstancedMesh<THREE.PlaneGeometry, THREE.ShaderMaterial> | null = null;
    private readonly sparks: Spark[] = [];
    private sparkMesh: THREE.InstancedMesh | null = null;
    private shockwave: THREE.Mesh<THREE.RingGeometry, THREE.MeshBasicMaterial> | null = null;
    private groundWave: THREE.Mesh<THREE.RingGeometry, THREE.MeshBasicMaterial> | null = null;
    private readonly blastLights: Array<{ light: THREE.PointLight; birth: number; strength: number }> = [];
    private readonly coverScene = new THREE.Scene();
    private readonly coverCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    private readonly coverMaterial = new THREE.MeshBasicMaterial({ color: 0, transparent: true, depthTest: false, depthWrite: false });
    private readonly dummy = new THREE.Object3D();
    private readonly viewport = new THREE.Vector4();
    private readonly scissor = new THREE.Vector4();
    private readonly clearColor = new THREE.Color();
    private readonly size = new THREE.Vector2();
    private readonly gentle: boolean;
    private environment: THREE.WebGLRenderTarget | null = null;
    private activation: Promise<void> | null = null;
    private activated = false;
    private disposed = false;

    get pillarContacts(): readonly PillarContact[] { return this.debrisPaths?.contacts ?? []; }

    get ready(): boolean { return this.activated && !this.disposed; }
    get resources() {
        return { fragments: this.fragmentBatches.filter(batch => batch.mesh.name !== 'ending-pillar-fragments').reduce((sum, batch) => sum + batch.pieces.length, 0),
            pillars: this.scenery?.pillars.length ?? 0, pillarFragments: this.debrisPaths?.secondary.length ?? 0,
            bounces: this.debrisPaths?.bounces ?? 0, shatters: this.debrisPaths?.shatters ?? 0,
            fire: this.fires.length, smoke: this.smoke.length, sparks: this.sparks.length };
    }

    /** Asset-only preparation. No castle, fragments, particles or blast lights
     * exist here; the normal match keeps its original batched world. */
    static async prepare(options: MechaGameOverOptions, asset?: GLTF): Promise<MechaGameOverScene> {
        return new MechaGameOverScene(options, asset ?? await new GLTFLoader().loadAsync(modelUrl));
    }

    private constructor(options: MechaGameOverOptions, asset: GLTF) {
        this.options = { ...options };
        this.gentle = Boolean(options.photosensitivity || options.reducedMotion);
        this.forward = new THREE.Vector3(Math.sin(options.heading), 0, Math.cos(options.heading));
        this.tangent = new THREE.Vector3(this.forward.z, 0, -this.forward.x);
        this.scene.fog = new THREE.Fog(0xd0dbf0, 550, 1800);
        this.scene.add(this.robot);
        this.model = asset.scene;
        this.robot.add(this.model);
        this.model.updateMatrixWorld(true);
        const bounds = new THREE.Box3().setFromObject(this.model, true);
        this.model.scale.multiplyScalar(MECHA_HEIGHT / (bounds.max.y - bounds.min.y));
        this.model.updateMatrixWorld(true);
        bounds.setFromObject(this.model, true);
        this.model.position.y -= bounds.min.y;
        this.model.traverse(node => {
            if (node instanceof THREE.SkinnedMesh) { node.frustumCulled = false; node.castShadow = node.receiveShadow = true; }
        });
        this.mixer = new THREE.AnimationMixer(this.model);
        const clip = asset.animations.find(value => value.name === 'HeavyPunch');
        if (!clip) throw new Error('Ironmaw is missing HeavyPunch');
        this.punchDuration = clip.duration;
        this.duration = this.punchStart + clip.duration + MECHA_ENDING_TIMING.aftermath;
        this.action = this.mixer.clipAction(clip);
        this.action.setLoop(THREE.LoopOnce, 1); this.action.clampWhenFinished = true;
        this.pose(MECHA_ENDING_TIMING.impact);
        const fist = this.model.getObjectByName('M_Forearm_R');
        if (!fist) throw new Error('Ironmaw is missing the punching fist');
        bounds.setFromObject(fist, true);
        this.contact.set((bounds.min.x + bounds.max.x) / 2, (bounds.min.y + bounds.max.y) / 2, bounds.max.z);
        const reach = bounds.max.z;
        this.robot.rotation.y = options.heading;
        this.robot.position.copy(options.position ?? this.forward.clone().multiplyScalar(-TOWN_HALF_SIZE - TOWN_WALL_THICKNESS / 2 - reach)
            .addScaledVector(this.tangent, options.wallOffset));
        this.contact.applyAxisAngle(UP, options.heading).add(this.robot.position);
        this.pose(0); this.frameCamera();
        this.coverScene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.coverMaterial));
        this.cycle = new DayNightCycle(this.scene, { shadows: true, shadowMapSize: 1024 });
        this.cycle.synchronizeElapsedSeconds(options.lightingElapsed, true);
        this.cycle.update(0, this.camera.position);
        this.frame = sampleMechaEnding(0, this.punchDuration);
    }

    /** Call only after the cutscene's fade-out has reached black. The caller
     * keeps that frozen view covered until this promise resolves. Duplicate
     * calls share the same activation; disposal invalidates every checkpoint. */
    begin(renderer?: THREE.WebGLRenderer, checkpoint: () => Promise<void> = yieldPreparation): Promise<void> {
        if (this.disposed) return Promise.reject(new DOMException('Ending disposed', 'AbortError'));
        if (this.activation) return this.activation;
        const step = async () => {
            await checkpoint();
            if (this.disposed) throw new DOMException('Ending cancelled', 'AbortError');
        };
        this.seek(MECHA_ENDING_TIMING.fadeOut);
        this.activation = (async () => {
            try {
                // Paint opaque cover before allocating the replacement world.
                await step();
                await this.createCastle(step);
                if (this.options.seededScenery) {
                    this.scenery = await MechaEndingScenery.create(this.options.seed, this.scene, step);
                    const target = this.contact.clone(); target.y = 32;
                    this.cameraAdjustment = avoidEndingPillars(this.camera, target, this.robot.position, this.contact, this.framingPoints, this.scenery.pillars);
                    this.debrisPaths = await prepareEndingDebris(this.fragmentBatches.flatMap(batch => batch.pieces), this.scenery.pillars,
                        this.duration - this.impactTime, this.options.effectsSeed ?? this.options.seed, step);
                    if (this.debrisPaths.secondary.length) {
                        const mesh = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), this.scenery.pillarMesh.material, this.debrisPaths.secondary.length);
                        mesh.name = 'ending-pillar-fragments'; mesh.frustumCulled = false;
                        mesh.castShadow = mesh.receiveShadow = true; mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
                        this.fragmentBatches.push({ mesh, pieces: this.debrisPaths.secondary }); this.scene.add(mesh);
                    }
                }
                await step();
                this.createEffects();
                await step();
                if (renderer) await this.prepareRenderer(renderer);
                await step();
                this.activated = true;
                this.seek(MECHA_ENDING_TIMING.fadeOut);
            } catch (error) { this.dispose(); throw error; }
        })();
        return this.activation;
    }

    private pose(time: number): void {
        // LoopOnce pauses at completion; reset before every absolute seek.
        this.action.reset().play(); this.action.time = time; this.mixer.update(0);
        this.robot.updateMatrixWorld(true);
        this.model.traverse(node => { if (node instanceof THREE.SkinnedMesh) node.skeleton.update(); });
    }

    private async prepareRenderer(renderer: THREE.WebGLRenderer): Promise<void> {
        const generator = new THREE.PMREMGenerator(renderer), room = new RoomEnvironment(renderer);
        try { this.environment = generator.fromScene(room, .04); }
        finally { room.dispose(); generator.dispose(); }
        const texture = this.environment.texture;
        this.model.traverse(node => {
            if (!(node instanceof THREE.Mesh)) return;
            for (const material of Array.isArray(node.material) ? node.material : [node.material]) {
                if (material instanceof THREE.MeshStandardMaterial) {
                    material.envMap = texture;
                    material.envMapIntensity = this.options.lightingElapsed >= 300 ? .12 : .6;
                    material.needsUpdate = true;
                }
            }
        });
        // Warm the real effect variants privately while the public timeline is
        // held at black. Pending callers can never seek into the punch early.
        const held = this.frame;
        try {
            this.applyFrame(sampleMechaEnding(this.impactTime + 1.3, this.punchDuration), false);
            await renderer.compileAsync(this.scene, this.camera);
        } finally { if (!this.disposed) this.applyFrame(held, false); }
    }

    private frameCamera(): void {
        const target = this.contact.clone(); target.y = 32;
        const outward = this.tangent.clone().multiplyScalar(-1.25).addScaledVector(this.forward, -1).addScaledVector(UP, .24).normalize();
        this.camera.position.copy(target).add(outward); this.camera.lookAt(target); this.camera.updateMatrixWorld(true);
        const right = new THREE.Vector3(1, 0, 0).applyQuaternion(this.camera.quaternion);
        const up = new THREE.Vector3(0, 1, 0).applyQuaternion(this.camera.quaternion);
        // Preserve the original close shot: frame the mecha and struck wall
        // section even though destruction now propagates across the compound.
        for (const side of [-1, 1]) for (const y of [0, TOWN_WALL_HEIGHT + 4]) {
            const p = this.contact.clone().addScaledVector(this.tangent, side * 48); p.y = y;
            this.framingPoints.push(p);
        }
        for (const side of [-1, 1]) for (const y of [0, MECHA_HEIGHT + 3]) {
            const p = this.robot.position.clone().addScaledVector(this.tangent, side * 15).addScaledVector(this.forward, -8); p.y = y;
            this.framingPoints.push(p);
        }
        const tan = Math.tan(THREE.MathUtils.degToRad(this.camera.fov / 2));
        let distance = 105;
        for (const point of this.framingPoints) {
            const relative = point.clone().sub(target);
            distance = Math.max(distance, relative.dot(outward) + Math.abs(relative.dot(up)) / tan,
                relative.dot(outward) + Math.abs(relative.dot(right)) / (tan * MECHA_ENDING_ASPECT));
        }
        this.camera.position.copy(target).addScaledVector(outward, distance * 1.13); this.camera.updateMatrixWorld(true);
        this.introCamera.position.copy(this.robot.position).addScaledVector(this.forward, -60).addScaledVector(this.tangent, -25);
        this.introCamera.position.y = 2; this.introCamera.lookAt(this.contact); this.introCamera.updateMatrixWorld(true);
    }

    private async createCastle(checkpoint: () => Promise<void>): Promise<void> {
        const { structures, paving } = createEndingCastle(this.options.seed);
        const random = randomStream((this.options.effectsSeed ?? this.options.seed) ^ 0x4353544c);
        const farthest = Math.max(...structures.map(p => Math.hypot(p.x - this.contact.x, p.z - this.contact.z))) + 15;
        const estimate = (step: number) => structures.reduce((sum, part) => sum +
            Math.ceil(part.width / step) * Math.ceil(part.height / step) * Math.ceil(part.depth / step), 0);
        let step = 9;
        while (estimate(step) > MECHA_ENDING_LIMITS.fragments) step *= 1.25;
        const batches = new Map<TownMaterial, EndingStone[]>();
        let processed = 0;
        for (const part of structures) {
            const nx = Math.ceil(part.width / step), ny = Math.ceil(part.height / step), nz = Math.ceil(part.depth / step);
            const size = new THREE.Vector3(part.width / nx, part.height / ny, part.depth / nz);
            const pieces = batches.get(part.material) ?? []; batches.set(part.material, pieces);
            for (let x = 0; x < nx; x++) for (let y = 0; y < ny; y++) for (let z = 0; z < nz; z++) {
                const position = new THREE.Vector3(part.x - part.width / 2 + (x + .5) * size.x,
                    part.y - part.height / 2 + (y + .5) * size.y, part.z - part.depth / 2 + (z + .5) * size.z);
                const outward = new THREE.Vector3(position.x + (random() - .5) * 20, 0, position.z + (random() - .5) * 20).normalize();
                const velocity = outward.multiplyScalar(25 + random() * 53).addScaledVector(UP, 18 + random() * 34);
                const floor = size.length() / 2;
                pieces.push({ id: processed, position, size: size.clone(), velocity,
                    birth: clamp((Math.hypot(position.x - this.contact.x, position.z - this.contact.z) - 12) / (farthest - 12), 0, 1) * MECHA_ENDING_TIMING.chain,
                    landing: (velocity.y + Math.sqrt(velocity.y ** 2 + 2 * GRAVITY * Math.max(0, position.y - floor))) / GRAVITY,
                    spin: new THREE.Vector3(random() - .5, random() - .5, random() - .5).multiplyScalar(3),
                });
                if (++processed % 256 === 0) await checkpoint();
            }
        }
        await checkpoint();
        const geometry = new THREE.BoxGeometry(1, 1, 1);
        for (const [name, pieces] of batches) {
            const mesh = new THREE.InstancedMesh(geometry, new THREE.MeshStandardMaterial({ color: TOWN_COLORS[name], roughness: .97 }), pieces.length);
            mesh.name = `ending-fragments-${name}`; mesh.frustumCulled = false;
            mesh.castShadow = mesh.receiveShadow = true; mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
            this.fragmentBatches.push({ mesh, pieces }); this.scene.add(mesh);
        }
        // Ground remains a handful of static material batches. All above-ground
        // shells, including the church cross and lookout roofs, are fragments.
        for (const name of new Set(paving.map(part => part.material))) {
            const parts = paving.filter(part => part.material === name);
            this.addStaticBoxes(parts, geometry, name);
        }
        if (this.options.seededScenery) return;
        const ground = new THREE.Mesh(new THREE.PlaneGeometry(2600, 2600), new THREE.MeshStandardMaterial({ color: 0x354924, roughness: 1 }));
        ground.name = 'ending-ground'; ground.rotation.x = -Math.PI / 2; ground.position.y = -.025; ground.receiveShadow = true;
        this.scene.add(ground);
    }

    private addStaticBoxes(parts: TownBox[], geometry: THREE.BufferGeometry, material: TownMaterial): void {
        const mesh = new THREE.InstancedMesh(geometry, new THREE.MeshStandardMaterial({ color: TOWN_COLORS[material], roughness: .97 }), parts.length);
        mesh.name = `ending-paving-${material}`; mesh.receiveShadow = true;
        parts.forEach((part, index) => {
            this.dummy.position.set(part.x, part.y, part.z); this.dummy.rotation.set(part.rotationX ?? 0, 0, 0);
            this.dummy.scale.set(part.width, part.height, part.depth); this.dummy.updateMatrix(); mesh.setMatrixAt(index, this.dummy.matrix);
        });
        mesh.instanceMatrix.needsUpdate = true; this.scene.add(mesh);
    }

    private createEffects(): void {
        const random = randomStream((this.options.effectsSeed ?? this.options.seed) ^ 0x424c4153);
        const amount = clamp(this.options.particleAmount ?? 1, .2, 1);
        const birthAt = (x: number, z: number) => clamp(Math.hypot(x - this.contact.x, z - this.contact.z) / 245, 0, 1) * .8;
        const blasts: Blast[] = [{ position: this.contact.clone().addScaledVector(this.forward, -10), birth: 0, power: 1 }];
        for (const x of [-78, 0, 78]) for (const z of [-78, 0, 78]) {
            blasts.push({ position: new THREE.Vector3(x, 20 + random() * 24, z), birth: birthAt(x, z), power: 1.15 });
        }
        for (const x of [-25, 25]) for (const z of [-22, 22]) {
            blasts.push({ position: new THREE.Vector3(x, 32, z), birth: MECHA_ENDING_TIMING.detonation, power: 2.5 });
        }
        const fireCount = Math.ceil(MECHA_ENDING_LIMITS.fire * (.5 + amount * .5));
        for (let i = 0; i < fireCount; i++) {
            const blast = blasts[i % blasts.length];
            const core = i < blasts.length;
            const position = blast.position.clone().add(new THREE.Vector3((random() - .5) * 14, (random() - .5) * 10, (random() - .5) * 14));
            this.fires.push({ position, birth: blast.birth + (core ? 0 : random() * .45), life: 2.2 + random() * 1.2,
                velocity: new THREE.Vector3((random() - .5) * 7, 10 + random() * 13, (random() - .5) * 7),
                radius: (13 + random() * 12) * blast.power, stretch: .85 + random() * .5, seed: random() * 200 });
        }
        for (let i = 0; i < Math.ceil(MECHA_ENDING_LIMITS.smoke * amount); i++) {
            const dust = i % 3 === 0, angle = random() * Math.PI * 2;
            const radius = dust ? 75 + random() * 25 : random() * 95;
            const x = Math.sin(angle) * radius, z = Math.cos(angle) * radius;
            this.smoke.push({ position: new THREE.Vector3(x, dust ? 3 : 18 + random() * 40, z),
                birth: birthAt(x, z) + .4 + random() * .7, life: 5 + random() * 3,
                velocity: new THREE.Vector3(Math.sin(angle) * (dust ? 25 : 3), dust ? 2 : 10 + random() * 13, Math.cos(angle) * (dust ? 25 : 3)),
                radius: dust ? 18 + random() * 14 : 20 + random() * 20, stretch: dust ? .4 : 1.2, seed: random() * 200 });
        }
        this.fireMesh = this.makePuffs('fire', this.fires.length); this.fireMesh.renderOrder = 2;
        this.glowMesh = this.makePuffs('glow', this.fires.length); this.glowMesh.renderOrder = 1;
        this.smokeMesh = this.makePuffs('smoke', this.smoke.length); this.smokeMesh.renderOrder = 3;
        for (let i = 0; i < Math.ceil(MECHA_ENDING_LIMITS.sparks * amount); i++) {
            const blast = blasts[i % blasts.length];
            this.sparks.push({ position: blast.position, birth: blast.birth, life: .7 + random() * 1.8,
                velocity: new THREE.Vector3((random() - .5) * 130, 12 + random() * 65, (random() - .5) * 130) });
        }
        this.sparkMesh = new THREE.InstancedMesh(new THREE.BoxGeometry(.28, .28, 1.6), new THREE.MeshBasicMaterial({ color: 0xffc15b, toneMapped: false }), this.sparks.length);
        this.sparkMesh.name = 'ending-sparks'; this.sparkMesh.frustumCulled = false;
        this.sparkMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage); this.scene.add(this.sparkMesh);
        const waveMaterial = new THREE.MeshBasicMaterial({ color: 0xffb156, transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, toneMapped: false });
        this.shockwave = new THREE.Mesh(new THREE.RingGeometry(.93, 1, 96), waveMaterial);
        this.shockwave.position.copy(this.contact).addScaledVector(this.forward, -.6); this.shockwave.rotation.y = this.options.heading;
        this.groundWave = new THREE.Mesh(this.shockwave.geometry, waveMaterial.clone());
        this.groundWave.position.set(0, .15, 0); this.groundWave.rotation.x = -Math.PI / 2;
        this.scene.add(this.shockwave, this.groundWave);
        for (const [position, birth, strength] of [
            [this.contact.clone().addScaledVector(this.forward, -9), 0, 7000],
            [new THREE.Vector3(0, 65, 0), .85, 30000],
            [new THREE.Vector3(-65, 55, -45), .3, 12000],
            [new THREE.Vector3(65, 55, 45), .65, 12000],
        ] as const) {
            const light = new THREE.PointLight(0xff8b26, 0, 260, 2); light.position.copy(position);
            this.blastLights.push({ light, birth, strength }); this.scene.add(light);
        }
    }

    private makePuffs(kind: 'fire' | 'smoke' | 'glow', count: number): THREE.InstancedMesh<THREE.PlaneGeometry, THREE.ShaderMaterial> {
        const geometry = new THREE.PlaneGeometry(2, 2);
        geometry.setAttribute('puff', new THREE.InstancedBufferAttribute(new Float32Array(count * 4), 4).setUsage(THREE.DynamicDrawUsage));
        const mesh = new THREE.InstancedMesh(geometry, puffMaterial(kind), count);
        mesh.name = `ending-${kind}`; mesh.frustumCulled = false; mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
        this.scene.add(mesh); return mesh;
    }

    seek(time: number): MechaEndingFrame {
        if (this.disposed) throw new Error('Cannot seek a disposed ending scene');
        const sampled = sampleMechaEnding(time, this.punchDuration);
        if (!this.ready) {
            this.frame = sampled.time < MECHA_ENDING_TIMING.fadeOut ? sampled
                : { ...sampleMechaEnding(MECHA_ENDING_TIMING.fadeOut, this.punchDuration), phase: 'preparing', blackout: 1 };
            this.pose(0); return this.frame;
        }
        this.applyFrame(sampled); return this.frame;
    }

    private applyFrame(frame: MechaEndingFrame, publish = true): void {
        if (publish) this.frame = frame;
        this.pose(frame.punchTime);
        const age = frame.impactAge;
        this.scenery?.seek(age, this.camera);
        for (const { mesh, pieces } of this.fragmentBatches) {
            pieces.forEach((stone, index) => {
                const local = age - stone.birth, fractured = local >= 0;
                const t = stone.segments ? sampleEndingStone(stone, age, this.dummy.position) : fractured ? Math.min(local, stone.landing) : 0;
                if (!stone.segments) {
                    this.dummy.position.copy(stone.position).addScaledVector(stone.velocity, t);
                    this.dummy.position.y -= GRAVITY / 2 * t * t;
                }
                this.dummy.rotation.set(stone.spin.x * t, stone.spin.y * t, stone.spin.z * t);
                this.dummy.scale.copy(stone.size);
                if (stone.sourcePillar !== undefined && !fractured) this.dummy.scale.setScalar(0);
                this.dummy.updateMatrix();
                if (fractured) {
                    const e = this.dummy.matrix.elements;
                    const support = (Math.abs(e[1]) + Math.abs(e[5]) + Math.abs(e[9])) / 2;
                    const onGround = stone.segments ? stone.grounded && age >= stone.stopAt! : local >= stone.landing;
                    this.dummy.position.y = onGround ? support : Math.max(support, this.dummy.position.y);
                    this.dummy.updateMatrix();
                }
                mesh.setMatrixAt(index, this.dummy.matrix);
            });
            mesh.instanceMatrix.needsUpdate = true;
        }
        if (this.fireMesh) this.updatePuffs(this.fireMesh, this.fires, age, 'fire');
        if (this.glowMesh) this.updatePuffs(this.glowMesh, this.fires, age, 'glow');
        if (this.smokeMesh) this.updatePuffs(this.smokeMesh, this.smoke, age, 'smoke');
        if (this.sparkMesh) {
            this.sparkMesh.visible = age >= 0 && !this.gentle;
            this.sparks.forEach((spark, index) => {
                const t = age - spark.birth, visible = t >= 0 && t < spark.life;
                this.dummy.position.copy(spark.position).addScaledVector(spark.velocity, Math.max(0, t));
                this.dummy.position.y -= GRAVITY / 2 * Math.max(0, t) ** 2;
                this.dummy.rotation.set(0, this.options.heading, Math.max(0, t) * 3);
                this.dummy.scale.setScalar(visible ? 1 - t / spark.life * .6 : 0);
                this.dummy.updateMatrix(); this.sparkMesh!.setMatrixAt(index, this.dummy.matrix);
            });
            this.sparkMesh.instanceMatrix.needsUpdate = true;
        }
        if (this.shockwave && this.groundWave) {
            const main = age - MECHA_ENDING_TIMING.detonation;
            this.shockwave.visible = age >= 0 && age < 1.1;
            this.groundWave.visible = main >= 0 && main < 1.7;
            this.shockwave.scale.setScalar(1 + Math.max(0, age) * 58);
            this.groundWave.scale.setScalar(20 + Math.max(0, main) * 160);
            this.shockwave.material.opacity = Math.max(0, 1 - age / 1.1) * (this.gentle ? .06 : .4);
            this.groundWave.material.opacity = Math.max(0, 1 - main / 1.7) * (this.gentle ? .04 : .24);
        }
        for (const { light, birth, strength } of this.blastLights) {
            const t = age - birth;
            light.intensity = t < 0 ? 0 : smooth(t / (this.gentle ? .5 : .12)) * Math.exp(-t * 1.65) * strength * (this.gentle ? .12 : 1);
        }
        this.coverMaterial.opacity = frame.blackout;
    }

    private updatePuffs(mesh: THREE.InstancedMesh<THREE.PlaneGeometry, THREE.ShaderMaterial>, puffs: Puff[], age: number, kind: 'fire' | 'smoke' | 'glow'): void {
        const data = mesh.geometry.getAttribute('puff') as THREE.InstancedBufferAttribute;
        mesh.material.uniforms.clock.value = Math.max(0, age); mesh.visible = age >= 0;
        puffs.forEach((puff, index) => {
            const t = age - puff.birth, progress = clamp(t / puff.life, 0, 1);
            const visible = t >= 0 && t < puff.life;
            const attack = smooth(t / (kind === 'smoke' ? .85 : this.gentle ? .5 : .2));
            const fade = 1 - smooth((progress - (kind === 'smoke' ? .55 : .3)) / (kind === 'smoke' ? .45 : .7));
            const opacity = visible ? attack * fade * (kind === 'glow' ? this.gentle ? .035 : .18 : kind === 'smoke' ? .5 : this.gentle ? .6 : .98) : 0;
            const radius = puff.radius * (kind === 'smoke' ? .35 + progress * 1.35 : .2 + Math.sqrt(progress) * 1.05) * (kind === 'glow' ? 1.9 : 1);
            this.dummy.position.copy(puff.position).addScaledVector(puff.velocity, Math.max(0, t));
            this.dummy.quaternion.copy(this.camera.quaternion); this.dummy.scale.set(radius, radius * puff.stretch, 1);
            this.dummy.updateMatrix(); mesh.setMatrixAt(index, this.dummy.matrix);
            data.setXYZW(index, opacity, puff.seed, kind === 'smoke' && index % 3 === 0 ? .65 : 0, 0);
        });
        mesh.instanceMatrix.needsUpdate = true; data.needsUpdate = true;
    }

    /** Reuse a renderer without leaking a viewport, clear color, target, or
     * autoClear change into its next gameplay/menu draw. Output stays 16:9. */
    render(renderer: THREE.WebGLRenderer): void {
        if (this.disposed) return;
        renderer.getViewport(this.viewport); renderer.getScissor(this.scissor);
        const scissorTest = renderer.getScissorTest(), autoClear = renderer.autoClear;
        renderer.getClearColor(this.clearColor); const alpha = renderer.getClearAlpha();
        renderer.getSize(this.size);
        const width = Math.min(this.size.x, this.size.y * MECHA_ENDING_ASPECT), height = width / MECHA_ENDING_ASPECT;
        const x = (this.size.x - width) / 2, y = (this.size.y - height) / 2;
        try {
            renderer.autoClear = false; renderer.setScissorTest(false);
            renderer.setViewport(0, 0, this.size.x, this.size.y); renderer.setClearColor(0, 1); renderer.clear();
            renderer.setViewport(x, y, width, height); renderer.setScissor(x, y, width, height); renderer.setScissorTest(true);
            if (this.ready) {
                renderer.render(this.scene, this.frame.phase === 'fade-out' ? this.introCamera : this.camera);
                if (this.frame.blackout > 0) renderer.render(this.coverScene, this.coverCamera);
            }
        } finally {
            renderer.setViewport(this.viewport); renderer.setScissor(this.scissor); renderer.setScissorTest(scissorTest);
            renderer.setClearColor(this.clearColor, alpha); renderer.autoClear = autoClear;
        }
    }

    dispose(): void {
        if (this.disposed) return;
        this.disposed = true; this.activated = false;
        this.mixer.stopAllAction(); this.mixer.uncacheRoot(this.model);
        this.cycle.dispose();
        const geometries = new Set<THREE.BufferGeometry>(), materials = new Set<THREE.Material>();
        const textures = new Set<THREE.Texture>(), skeletons = new Set<THREE.Skeleton>();
        const collect = (root: THREE.Object3D) => root.traverse(node => {
            if (node instanceof THREE.SkinnedMesh) skeletons.add(node.skeleton);
            if (node instanceof THREE.Mesh || node instanceof THREE.Sprite) {
                if (node instanceof THREE.Mesh) geometries.add(node.geometry);
                for (const material of Array.isArray(node.material) ? node.material : [node.material]) {
                    materials.add(material);
                    for (const value of Object.values(material)) if (value instanceof THREE.Texture && value !== this.environment?.texture) textures.add(value);
                }
                if (node instanceof THREE.InstancedMesh) node.dispose();
            }
        });
        collect(this.scene); collect(this.coverScene);
        skeletons.forEach(skeleton => skeleton.dispose()); textures.forEach(texture => texture.dispose());
        materials.forEach(material => material.dispose()); geometries.forEach(geometry => geometry.dispose());
        this.environment?.dispose(); this.environment = null;
        this.scene.clear(); this.coverScene.clear();
        this.fragmentBatches.length = this.fires.length = this.smoke.length = this.sparks.length = this.blastLights.length = 0;
        this.fireMesh = this.glowMesh = this.smokeMesh = null; this.sparkMesh = null;
        this.shockwave = this.groundWave = null; this.scenery = null; this.debrisPaths = null;
    }
}
