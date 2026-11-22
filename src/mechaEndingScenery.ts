import * as THREE from 'three';
import { createSceneryBuilder, SHARED_WORLD_GEOMETRIES, SHARED_WORLD_MATERIALS, type SceneryRole } from './seededScenery.js';
import { PILLAR_WIDTH } from './config.js';
import { createBiomeField, createBiomeMapTexture } from './biomes.js';
import { createLavaPitMaskTexture } from './lavaPools.js';
import type { EndingPillar } from './mechaEndingDebris.js';

interface InstanceSet { mesh: THREE.InstancedMesh; next: number; role?: SceneryRole }
export interface SceneryPillar extends EndingPillar { matrix: THREE.Matrix4 }

/** Owns only presentation meshes. No gameplay registry or singleton is touched. */
export class MechaEndingScenery {
    readonly group = new THREE.Group();
    readonly pillars: SceneryPillar[] = [];
    readonly fakePillars: THREE.Object3D[] = [];
    readonly lavaPools: THREE.Object3D[] = [];
    readonly fakeLavaPools: THREE.Object3D[] = [];
    pillarMesh!: THREE.InstancedMesh;
    lavaCount = 0;
    private readonly hidden: boolean[] = [];
    private readonly zero = new THREE.Matrix4().makeScale(0, 0, 0);
    private branchMesh: THREE.InstancedMesh | null = null;
    private canopyMesh: THREE.InstancedMesh | null = null;
    private readonly branchIndices = new Map<number, number[]>();
    private readonly canopyIndices = new Map<number, number[]>();
    private readonly branchMatrices: THREE.Matrix4[] = [];
    private readonly canopyMatrices: THREE.Matrix4[] = [];

    static async create(seed: number, scene: THREE.Scene, checkpoint: () => Promise<void>): Promise<MechaEndingScenery> {
        const result = new MechaEndingScenery();
        result.group.name = 'ending-seeded-scenery'; scene.add(result.group);
        const worldSeed = seed >>> 0;
        const biomeField = createBiomeField(worldSeed);
        const biomeMapTexture = createBiomeMapTexture(biomeField);
        let randomState = worldSeed;
        let fakePillars: THREE.Object3D[] = [];
        let fakeLava: THREE.Object3D[] = [];
        const ownedGeometries = new Map<THREE.BufferGeometry, THREE.BufferGeometry>();
        const ownedMaterials = new Map<THREE.Material, THREE.Material>();
        const material = (source: THREE.Material): THREE.Material => {
            if (!SHARED_WORLD_MATERIALS.has(source)) return source;
            if (!ownedMaterials.has(source)) ownedMaterials.set(source, source.clone());
            return ownedMaterials.get(source)!;
        };
        const builder = createSceneryBuilder<InstanceSet>({
            seed: worldSeed,
            biomeField,
            biomeMapTexture,
            random: () => {
                let n = randomState += 0x6d2b79f5;
                n = Math.imul(n ^ n >>> 15, n | 1); n ^= n + Math.imul(n ^ n >>> 7, n | 61);
                return ((n ^ n >>> 14) >>> 0) / 4294967296;
            },
            addObject: object => { result.group.add(object); return object; },
            instances: (source, materials, capacity, castShadow = false, receiveShadow = false, role) => {
                // Gameplay plants deliberately reuse process-wide assets. The
                // cinematic scene disposes its whole graph, so give it clones.
                let geometry = source;
                if (SHARED_WORLD_GEOMETRIES.has(source)) {
                    if (!ownedGeometries.has(source)) ownedGeometries.set(source, source.clone());
                    geometry = ownedGeometries.get(source)!;
                }
                const mesh = new THREE.InstancedMesh(geometry, Array.isArray(materials) ? materials.map(material) : material(materials), capacity);
                mesh.name = `ending-scenery-${role ?? source.type}`;
                mesh.count = 0; mesh.frustumCulled = false;
                mesh.castShadow = castShadow; mesh.receiveShadow = receiveShadow;
                result.group.add(mesh);
                if (role === 'pillars') { result.pillarMesh = mesh; mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage); }
                if (role === 'branches') result.branchMesh = mesh;
                if (role === 'canopy') result.canopyMesh = mesh;
                return { mesh, next: 0, role };
            },
            instance: (set, _x, _z, matrix, color, pillarId) => {
                const index = set.next++;
                set.mesh.setMatrixAt(index, matrix); set.mesh.count = set.next; set.mesh.instanceMatrix.needsUpdate = true;
                if (color) {
                    set.mesh.setColorAt(index, color);
                    if (set.mesh.instanceColor) set.mesh.instanceColor.needsUpdate = true;
                }
                if (pillarId === undefined) return;
                if (set.role === 'branches') {
                    let indices = result.branchIndices.get(pillarId);
                    if (!indices) {
                        indices = []; result.branchIndices.set(pillarId, indices);
                    }
                    indices.push(index);
                    result.branchMatrices[index] = matrix.clone();
                } else if (set.role === 'canopy') {
                    let indices = result.canopyIndices.get(pillarId);
                    if (!indices) {
                        indices = []; result.canopyIndices.set(pillarId, indices);
                    }
                    indices.push(index);
                    result.canopyMatrices[index] = matrix.clone();
                }
            },
            renderObject() {}, floor() {},
            pillar: object => {
                const size = new THREE.Vector3(PILLAR_WIDTH, object.scale.y, PILLAR_WIDTH);
                result.pillars.push({ id: result.pillars.length, position: object.position.clone(), size,
                    bounds: new THREE.Box3().setFromCenterAndSize(object.position, size), destroyedAt: Infinity,
                    matrix: new THREE.Matrix4().compose(object.position, object.quaternion, new THREE.Vector3(1, size.y, 1)) });
                result.hidden.push(false);
            },
            lava: object => { result.lavaPools.push(object); result.lavaCount++; },
            fakeLava: objects => { fakeLava = objects; },
            fakePillars: objects => { fakePillars = objects; },
        });
        // These must stay in the same order as the gameplay prefix. Texture
        // recipes consume random draws too, so layout-only resampling differs.
        for (const stage of [builder.createFloor, builder.createFakeBillboards, builder.createPillars, builder.createLavaPools, builder.createBushes]) {
            await checkpoint(); stage();
        }
        result.fakePillars.push(...fakePillars);
        result.fakeLavaPools.push(...fakeLava);
        // The cinematic floor owns the same recessed-pit cutout as the live
        // world, including the decorative pools beyond the arena border. Its
        // baked mask rides in extraTextures for whole-graph disposal.
        const floor = result.group.getObjectByName('grass-floor') as THREE.Mesh | undefined;
        const maskTexture = createLavaPitMaskTexture([...result.lavaPools, ...result.fakeLavaPools]);
        const maskUniform = (floor?.material as THREE.Material | undefined)?.userData.lavaPitMaskUniform as
            { value: THREE.Texture } | undefined;
        if (maskUniform) maskUniform.value = maskTexture;
        // The cinematic scene owns the biome map and the floor's procedural
        // textures even though shader uniforms hold them outside material fields.
        const extraTextures: THREE.Texture[] = [biomeMapTexture, maskTexture];
        result.group.traverse(node => {
            const textures = node.userData?.extraTextures as THREE.Texture[] | undefined;
            if (!textures) return;
            for (const texture of textures) if (!extraTextures.includes(texture)) extraTextures.push(texture);
        });
        result.group.userData.extraTextures = extraTextures;
        await checkpoint(); return result;
    }
    seek(age: number, camera: THREE.Camera): void {
        let changed = false;
        this.pillars.forEach((pillar, index) => {
            const hidden = age >= pillar.destroyedAt;
            if (hidden !== this.hidden[index]) {
                this.pillarMesh.setMatrixAt(index, hidden ? this.zero : pillar.matrix);
                this.hidden[index] = hidden; changed = true;
                const branchIndices = this.branchIndices.get(index);
                if (branchIndices && this.branchMesh) {
                    for (const branchIndex of branchIndices) {
                        this.branchMesh.setMatrixAt(branchIndex, hidden ? this.zero : this.branchMatrices[branchIndex]);
                    }
                    this.branchMesh.instanceMatrix.needsUpdate = true;
                }
                const canopyIndices = this.canopyIndices.get(index);
                if (canopyIndices && this.canopyMesh) {
                    for (const canopyIndex of canopyIndices) {
                        this.canopyMesh.setMatrixAt(canopyIndex, hidden ? this.zero : this.canopyMatrices[canopyIndex]);
                    }
                    this.canopyMesh.instanceMatrix.needsUpdate = true;
                }
            }
        });
        if (changed) this.pillarMesh.instanceMatrix.needsUpdate = true;
        for (const pillar of this.fakePillars) pillar.lookAt(camera.position.x, pillar.position.y, camera.position.z);
    }
}
