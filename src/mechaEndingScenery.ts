import * as THREE from 'three';
import { createSceneryBuilder, SHARED_WORLD_GEOMETRIES, SHARED_WORLD_MATERIALS } from './seededScenery.js';
import { PILLAR_WIDTH } from './config.js';
import type { EndingPillar } from './mechaEndingDebris.js';

interface InstanceSet { mesh: THREE.InstancedMesh; next: number }
export interface SceneryPillar extends EndingPillar { matrix: THREE.Matrix4 }

/** Owns only presentation meshes. No gameplay registry or singleton is touched. */
export class MechaEndingScenery {
    readonly group = new THREE.Group();
    readonly pillars: SceneryPillar[] = [];
    readonly fakePillars: THREE.Object3D[] = [];
    pillarMesh!: THREE.InstancedMesh;
    lavaCount = 0;
    private readonly hidden: boolean[] = [];
    private readonly zero = new THREE.Matrix4().makeScale(0, 0, 0);

    static async create(seed: number, scene: THREE.Scene, checkpoint: () => Promise<void>): Promise<MechaEndingScenery> {
        const result = new MechaEndingScenery();
        result.group.name = 'ending-seeded-scenery'; scene.add(result.group);
        let randomState = seed >>> 0;
        let fakePillars: THREE.Object3D[] = [];
        const ownedGeometries = new Map<THREE.BufferGeometry, THREE.BufferGeometry>();
        const ownedMaterials = new Map<THREE.Material, THREE.Material>();
        const material = (source: THREE.Material): THREE.Material => {
            if (!SHARED_WORLD_MATERIALS.has(source)) return source;
            if (!ownedMaterials.has(source)) ownedMaterials.set(source, source.clone());
            return ownedMaterials.get(source)!;
        };
        const builder = createSceneryBuilder<InstanceSet>({
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
                return { mesh, next: 0 };
            },
            instance: (set, _x, _z, matrix) => {
                set.mesh.setMatrixAt(set.next++, matrix); set.mesh.count = set.next; set.mesh.instanceMatrix.needsUpdate = true;
            },
            renderObject() {}, floor() {},
            pillar: object => {
                const size = new THREE.Vector3(PILLAR_WIDTH, object.scale.y, PILLAR_WIDTH);
                result.pillars.push({ id: result.pillars.length, position: object.position.clone(), size,
                    bounds: new THREE.Box3().setFromCenterAndSize(object.position, size), destroyedAt: Infinity,
                    matrix: new THREE.Matrix4().compose(object.position, object.quaternion, new THREE.Vector3(1, size.y, 1)) });
                result.hidden.push(false);
            },
            lava: () => { result.lavaCount++; },
            fakePillars: objects => { fakePillars = objects; },
        });
        // These must stay in the same order as the gameplay prefix. Texture
        // recipes consume random draws too, so layout-only resampling differs.
        for (const stage of [builder.createFloor, builder.createFakeBillboards, builder.createPillars, builder.createLavaPools, builder.createBushes]) {
            await checkpoint(); stage();
        }
        result.fakePillars.push(...fakePillars);
        await checkpoint(); return result;
    }
    seek(age: number, camera: THREE.Camera): void {
        let changed = false;
        this.pillars.forEach((pillar, index) => {
            const hidden = age >= pillar.destroyedAt;
            if (hidden !== this.hidden[index]) {
                this.pillarMesh.setMatrixAt(index, hidden ? this.zero : pillar.matrix);
                this.hidden[index] = hidden; changed = true;
            }
        });
        if (changed) this.pillarMesh.instanceMatrix.needsUpdate = true;
        for (const pillar of this.fakePillars) pillar.lookAt(camera.position.x, pillar.position.y, camera.position.z);
    }
}
