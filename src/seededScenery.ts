import * as THREE from 'three';
import { MAP_SIZE, PILLAR_COUNT, PILLAR_WIDTH, MAX_PILLAR_HEIGHT, LAVA_POOL_HALF_SIZE, FAKE_PILLAR_COUNT, FAKE_LAVA_POOL_COUNT, LAVA_CHAIN_COUNT, BUSH_2D_COUNT, BUSH_3D_COUNT, BUSH_3D_RADIUS_CAP, BUSH_2D_INNER_RADIUS, BUSH_2D_SPREAD, GROUND_VISUAL_SIZE } from './config.js';
import { getTownPavingOutline, overlapsTown } from './town.js';
import { obstacleData } from './userDataTypes.js';
import { SpatialHash } from './spatialHash.js';

export interface SceneryInstances { mesh: THREE.InstancedMesh }
export interface SceneryPort<T extends SceneryInstances> {
    random(): number;
    addObject<O extends THREE.Object3D>(object: O): O;
    instances(geometry: THREE.BufferGeometry, material: THREE.Material | THREE.Material[], capacity: number, castShadow?: boolean, receiveShadow?: boolean, role?: 'pillars' | 'lava'): T;
    instance(set: T, x: number, z: number, matrix: THREE.Matrix4): void;
    renderObject(object: THREE.Object3D): void;
    floor(object: THREE.Mesh): void;
    pillar(object: THREE.Mesh): void;
    lava(object: THREE.Mesh): void;
    fakePillars(objects: THREE.Object3D[]): void;
}

// Bushes use shared geometry/materials because there can be hundreds of them.
const SHARED_TRUNK_GEO = new THREE.CylinderGeometry(0.15, 0.25, 1.0, 5);
const SHARED_LEAF_GEO = new THREE.DodecahedronGeometry(1.5, 0);
const SHARED_TRUNK_MAT = new THREE.MeshLambertMaterial({ color: 0x5a3d28, flatShading: true });
const SHARED_LEAF_MATERIALS = [
    0x244f28,
    0x2f6633,
    0x3d7a42,
    0x4b8e51,
    0x1f5a37,
    0x5f7f32,
    0xb16824,
    0xd47a1e
].map((color) => new THREE.MeshLambertMaterial({ color, flatShading: true }));
export const SHARED_WORLD_GEOMETRIES = new Set<THREE.BufferGeometry>([
    SHARED_TRUNK_GEO,
    SHARED_LEAF_GEO
]);
export const SHARED_WORLD_MATERIALS = new Set<THREE.Material>([
    SHARED_TRUNK_MAT,
    ...SHARED_LEAF_MATERIALS
]);

/** The existing texture and placement draws deliberately share one stream.
 * Both callers run these stages in the original order; separating cosmetic RNG
 * would silently move pillars, lava, plants and every later enemy for old seeds. */
export function createSceneryBuilder<T extends SceneryInstances>(port: SceneryPort<T>) {
    const worldRandom = port.random;
    const addWorldObject = port.addObject;
    const createChunkedInstanceSet = port.instances;
    const addChunkedInstance = port.instance;
    const addChunkedRenderObject = port.renderObject;
    const obstacleHash = new SpatialHash<THREE.Object3D>(32), lavaHash = new SpatialHash<THREE.Object3D>(32);
    const _placementObstacleCandidates: THREE.Object3D[] = [], _placementLavaCandidates: THREE.Object3D[] = [];
    let fakePillars: THREE.Object3D[] = [];

    function checkAABBOverlap(x: number, z: number, checkRadius: number, array: THREE.Object3D[], halfWidth: number): boolean {
        const len = array.length;
        for (let i = 0; i < len; i++) {
            const item = array[i];
            const dx = Math.abs(x - item.position.x);
            const dz = Math.abs(z - item.position.z);
            if (dx < halfWidth + checkRadius && dz < halfWidth + checkRadius) {
                return true;
            }
        }
        return false;
    }

    function overlapsWithPillars(sqX: number, sqZ: number): boolean {
        const candidates = obstacleHash.query(
            sqX,
            sqZ,
            LAVA_POOL_HALF_SIZE + PILLAR_WIDTH,
            _placementObstacleCandidates
        );
        return checkAABBOverlap(sqX, sqZ, PILLAR_WIDTH / 2, candidates, LAVA_POOL_HALF_SIZE);
    }

    // Small canvas textures keep the game self-contained: no external art assets are
    // needed for the arena floor or pillar surfaces.
    function createGrassTexture(): THREE.CanvasTexture {
        const size = 512;
        const canvas = document.createElement('canvas');
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext('2d')!;

        ctx.fillStyle = '#1e4620';
        ctx.fillRect(0, 0, size, size);

        for (let i = 0; i < 5000; i++) {
            const x = worldRandom() * size;
            const y = worldRandom() * size;
            const length = 2 + worldRandom() * 5;
            const angle = -Math.PI / 2 + (worldRandom() - 0.5) * 0.5;

            const hue = 90 + worldRandom() * 25;
            const sat = 45 + worldRandom() * 15;
            const light = 22 + worldRandom() * 18;

            ctx.strokeStyle = `hsl(${hue}, ${sat}%, ${light}%)`;
            ctx.lineWidth = 1.5 + worldRandom() * 2.0;
            ctx.beginPath();
            ctx.moveTo(x, y);
            ctx.lineTo(x + Math.cos(angle) * length, y + Math.sin(angle) * length);
            ctx.stroke();
        }

        const texture = new THREE.CanvasTexture(canvas);
        texture.wrapS = THREE.RepeatWrapping;
        texture.wrapT = THREE.RepeatWrapping;
        texture.repeat.set(250, 250);
        return texture;
    }

    function createBarkTexture(): THREE.CanvasTexture {
        const size = 512;
        const canvas = document.createElement('canvas');
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext('2d')!;

        ctx.fillStyle = '#3a2312';
        ctx.fillRect(0, 0, size, size);

        for (let i = 0; i < 4000; i++) {
            const x = worldRandom() * size;
            const y = worldRandom() * size;
            const length = 40 + worldRandom() * 120;

            const hue = 22 + worldRandom() * 8;
            const sat = 25 + worldRandom() * 15;
            const light = 12 + worldRandom() * 15;

            ctx.strokeStyle = `hsl(${hue}, ${sat}%, ${light}%)`;
            ctx.lineWidth = 1.5 + worldRandom() * 3.5;
            ctx.beginPath();
            ctx.moveTo(x, y);
            const jitter = (worldRandom() - 0.5) * 2;
            ctx.lineTo(x + jitter, y + length);
            ctx.stroke();
        }

        ctx.strokeStyle = '#1a0d05';
        for (let i = 0; i < 40; i++) {
            let x = worldRandom() * size;
            ctx.lineWidth = 2 + worldRandom() * 4;
            ctx.beginPath();
            ctx.moveTo(x, 0);
            for (let y = 0; y < size; y += 20) {
                x += (worldRandom() - 0.5) * 4;
                ctx.lineTo(x, y);
            }
            ctx.stroke();
        }

        const texture = new THREE.CanvasTexture(canvas);
        texture.wrapS = THREE.RepeatWrapping;
        texture.wrapT = THREE.RepeatWrapping;
        texture.repeat.set(1, 4);
        return texture;
    }

    function createRingsTexture(): THREE.CanvasTexture {
        const size = 512;
        const canvas = document.createElement('canvas');
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext('2d')!;

        const cx = size / 2;
        const cy = size / 2;

        ctx.fillStyle = '#e4c49f';
        ctx.fillRect(0, 0, size, size);

        const maxRadius = size * 0.75;
        const step = 6 + worldRandom() * 4;

        for (let r = 10; r < maxRadius; r += step) {
            const hue = 25 + worldRandom() * 8;
            const sat = 30 + worldRandom() * 15;
            const light = 35 + worldRandom() * 10;
            ctx.strokeStyle = `hsl(${hue}, ${sat}%, ${light}%)`;
            ctx.lineWidth = 1 + worldRandom() * 1.5;

            ctx.beginPath();
            const segments = 120;
            for (let i = 0; i <= segments; i++) {
                const angle = (i / segments) * Math.PI * 2;

                const wave = Math.sin(angle * 6) * 3 + Math.cos(angle * 3) * 2 + Math.sin(angle * 12) * 0.8;
                const radialJitter = wave + (worldRandom() - 0.5) * 0.5;
                const currentRadius = r + radialJitter;

                const px = cx + Math.cos(angle) * currentRadius;
                const py = cy + Math.sin(angle) * currentRadius;

                if (i === 0) {
                    ctx.moveTo(px, py);
                } else {
                    ctx.lineTo(px, py);
                }
            }
            ctx.stroke();
        }

        ctx.fillStyle = 'rgba(150, 110, 80, 0.08)';
        for (let i = 0; i < 5000; i++) {
            const angle = worldRandom() * Math.PI * 2;
            const radius = worldRandom() * maxRadius;
            const px = cx + Math.cos(angle) * radius;
            const py = cy + Math.sin(angle) * radius;

            ctx.fillRect(px, py, 1.5, 1.5);
        }

        const numCracks = 3 + Math.floor(worldRandom() * 3);
        ctx.strokeStyle = 'rgba(65, 40, 20, 0.85)';

        for (let i = 0; i < numCracks; i++) {
            const baseAngle = worldRandom() * Math.PI * 2;
            const startRad = 15 + worldRandom() * 30;
            const endRad = maxRadius * (0.6 + worldRandom() * 0.4);

            ctx.lineWidth = 1.5 + worldRandom() * 2;
            ctx.beginPath();

            let currentX = cx + Math.cos(baseAngle) * startRad;
            let currentY = cy + Math.sin(baseAngle) * startRad;
            ctx.moveTo(currentX, currentY);

            const steps = 15;
            for (let j = 1; j <= steps; j++) {
                const t = j / steps;
                const r = startRad + t * (endRad - startRad);
                const angleJitter = baseAngle + (worldRandom() - 0.5) * 0.15;

                currentX = cx + Math.cos(angleJitter) * r;
                currentY = cy + Math.sin(angleJitter) * r;
                ctx.lineTo(currentX, currentY);
            }
            ctx.stroke();
        }

        ctx.fillStyle = '#412814';
        ctx.beginPath();
        ctx.arc(cx, cy, 3 + worldRandom() * 4, 0, Math.PI * 2);
        ctx.fill();

        const texture = new THREE.CanvasTexture(canvas);
        return texture;
    }

    function pickBushLeafMaterialIndex(): number {
        const rareAutumnStart = SHARED_LEAF_MATERIALS.length - 2;
        return worldRandom() < 0.08
            ? rareAutumnStart + Math.floor(worldRandom() * 2)
            : Math.floor(worldRandom() * rareAutumnStart);
    }

    function appendLowPolyBush(
        trunkInstances: T,
        leafInstances: T[],
        x: number,
        z: number,
        scale: number,
        root: THREE.Object3D,
        part: THREE.Object3D,
        matrix: THREE.Matrix4
    ): void {
        root.position.set(x, 0, z);
        root.rotation.set(0, 0, 0);
        root.scale.setScalar(scale);
        root.updateMatrix();

        part.position.set(0, 0.5, 0);
        part.rotation.set(0, 0, 0);
        part.scale.set(1, 1, 1);
        part.updateMatrix();
        matrix.multiplyMatrices(root.matrix, part.matrix);
        addChunkedInstance(trunkInstances, x, z, matrix);

        const leafMaterialIndex = pickBushLeafMaterialIndex();
        const numClusters = 1 + Math.floor(worldRandom() * 3);
        for (let i = 0; i < numClusters; i++) {
            const radius = 0.85 + worldRandom() * 0.8;
            const ox = numClusters === 1 ? 0 : (worldRandom() - 0.5) * 1.1;
            const oy = 0.75 + worldRandom() * 0.85;
            const oz = numClusters === 1 ? 0 : (worldRandom() - 0.5) * 1.1;
            part.position.set(ox, oy, oz);
            part.rotation.set(
                worldRandom() * Math.PI,
                worldRandom() * Math.PI,
                worldRandom() * Math.PI
            );
            part.scale.setScalar(radius);
            part.updateMatrix();
            matrix.multiplyMatrices(root.matrix, part.matrix);
            addChunkedInstance(leafInstances[leafMaterialIndex], x, z, matrix);
        }
    }

    // Distant vegetation is rendered as sprites to fill the horizon without a huge
    // mesh count. Nearby bushes remain real 3D objects.
    function create2DLowPolyBushTexture(baseColorHex: number | string): THREE.CanvasTexture {
        const size = 256;
        const canvas = document.createElement('canvas');
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext('2d')!;

        ctx.clearRect(0, 0, size, size);

        const centerX = size / 2;
        const centerY = size * 0.9;

        function drawFacetedCluster(cx: number, cy: number, radius: number, colorHex: number | string) {
            let hex = colorHex;
            if (typeof hex === 'number') {
                hex = '#' + hex.toString(16).padStart(6, '0');
            }
            const r = parseInt(hex.slice(1, 3), 16);
            const g = parseInt(hex.slice(3, 5), 16);
            const b = parseInt(hex.slice(5, 7), 16);

            const numVertices = 6 + Math.floor(worldRandom() * 3);
            const vertices: { x: number, y: number }[] = [];
            for (let i = 0; i < numVertices; i++) {
                const angle = (i / numVertices) * Math.PI * 2 + (worldRandom() - 0.5) * 0.1;
                const dist = radius * (0.85 + worldRandom() * 0.3);
                vertices.push({
                    x: cx + Math.cos(angle) * dist,
                    y: cy + Math.sin(angle) * dist
                });
            }

            const centerOffsetX = (worldRandom() - 0.3) * (radius * 0.25);
            const centerOffsetY = -radius * 0.15 + (worldRandom() - 0.5) * (radius * 0.15);
            const center = { x: cx + centerOffsetX, y: cy + centerOffsetY };

            for (let i = 0; i < numVertices; i++) {
                const v1 = vertices[i];
                const v2 = vertices[(i + 1) % numVertices];

                const midX = (v1.x + v2.x) / 2;
                const midY = (v1.y + v2.y) / 2;
                const faceAngle = Math.atan2(midY - cy, midX - cx);

                const dot = Math.cos(faceAngle - (-Math.PI / 4));
                const lightFactor = 0.95 + dot * 0.25;

                const newR = Math.min(255, Math.max(0, Math.round(r * lightFactor)));
                const newG = Math.min(255, Math.max(0, Math.round(g * lightFactor)));
                const newB = Math.min(255, Math.max(0, Math.round(b * lightFactor)));
                const colorStr = `rgb(${newR}, ${newG}, ${newB})`;

                ctx.fillStyle = colorStr;
                ctx.strokeStyle = colorStr;
                ctx.lineWidth = 1;
                ctx.beginPath();
                ctx.moveTo(center.x, center.y);
                ctx.lineTo(v1.x, v1.y);
                ctx.lineTo(v2.x, v2.y);
                ctx.closePath();
                ctx.fill();
                ctx.stroke();
            }
        }

        drawFacetedCluster(centerX - 30, centerY - 35, 45, baseColorHex);
        drawFacetedCluster(centerX + 30, centerY - 35, 45, baseColorHex);
        drawFacetedCluster(centerX, centerY - 80, 50, baseColorHex);
        drawFacetedCluster(centerX - 10, centerY - 110, 38, baseColorHex);
        drawFacetedCluster(centerX + 15, centerY - 105, 35, baseColorHex);

        const texture = new THREE.CanvasTexture(canvas);
        return texture;
    }

    function overlapsWithPillarsOrLava(x: number, z: number, checkRadius: number): boolean {
        if (overlapsTown(x, z, checkRadius)) return true;
        const obstacleCandidates = obstacleHash.query(
            x,
            z,
            PILLAR_WIDTH + checkRadius,
            _placementObstacleCandidates
        );
        if (checkAABBOverlap(x, z, checkRadius, obstacleCandidates, PILLAR_WIDTH / 2)) return true;

        const lavaCandidates = lavaHash.query(
            x,
            z,
            LAVA_POOL_HALF_SIZE + checkRadius,
            _placementLavaCandidates
        );
        if (checkAABBOverlap(x, z, checkRadius, lavaCandidates, LAVA_POOL_HALF_SIZE)) return true;
        if (x * x + z * z < 625) return true;
        return false;
    }

    function overlapsWithFakePillars(x: number, z: number, checkRadius: number): boolean {
        if (!fakePillars) return false;
        return checkAABBOverlap(x, z, checkRadius, fakePillars, (PILLAR_WIDTH * 1.5) / 2);
    }

    function createFloor(): void {
        // Grass and town paving meet at y=0 without competing depth-buffer layers.
        const half = GROUND_VISUAL_SIZE / 2;
        const shape = new THREE.Shape([
            new THREE.Vector2(-half, -half), new THREE.Vector2(half, -half),
            new THREE.Vector2(half, half), new THREE.Vector2(-half, half),
        ]);
        shape.holes.push(new THREE.Path(getTownPavingOutline().map(([x, z]) => new THREE.Vector2(x, -z))));
        const floorGeo = new THREE.ShapeGeometry(shape);
        const positions = floorGeo.getAttribute('position');
        const uv = floorGeo.getAttribute('uv');
        for (let i = 0; i < uv.count; i++) {
            uv.setXY(i, positions.getX(i) / GROUND_VISUAL_SIZE + 0.5, positions.getY(i) / GROUND_VISUAL_SIZE + 0.5);
        }
        const grassTex = createGrassTexture();
        const floorMat = new THREE.MeshLambertMaterial({ map: grassTex, color: 0xffffff });
        const floor = new THREE.Mesh(floorGeo, floorMat);
        floor.name = 'grass-floor';
        floor.rotation.x = -Math.PI / 2;
        floor.receiveShadow = true;
        addWorldObject(floor);
        // The gameplay floor remains continuous, including beneath culled objects.
        const collider = new THREE.Mesh(new THREE.PlaneGeometry(GROUND_VISUAL_SIZE, GROUND_VISUAL_SIZE), new THREE.MeshBasicMaterial());
        collider.rotation.x = -Math.PI / 2;
        collider.visible = false;
        collider.name = 'ground-collider';
        port.floor(addWorldObject(collider));
    }

    function createFakeBillboards(): void {
        // Background-only props outside the playable square. They add scale without
        // participating in physics or gameplay.
        fakePillars = []; port.fakePillars(fakePillars);
        const fakePillarGeo = new THREE.PlaneGeometry(PILLAR_WIDTH * 1.5, 1);
        const fakePillarMat = new THREE.MeshLambertMaterial({ color: 0x483224, side: THREE.DoubleSide });

        for (let i = 0; i < FAKE_PILLAR_COUNT; i++) {
            const angle = worldRandom() * Math.PI * 2;
            const directionX = Math.cos(angle);
            const directionZ = Math.sin(angle);
            const borderRadius = (MAP_SIZE / 2) / Math.max(Math.abs(directionX), Math.abs(directionZ));
            const radius = borderRadius + 20 + worldRandom() * 700;
            const x = directionX * radius;
            const z = directionZ * radius;
            const height = 20 + worldRandom() * (MAX_PILLAR_HEIGHT - 20);

            const mesh = new THREE.Mesh(fakePillarGeo, fakePillarMat);
            mesh.scale.set(1, height, 1);
            mesh.position.set(x, height / 2, z);

            addWorldObject(mesh);
            fakePillars.push(mesh);
        }

        const fakeLavaGeo = new THREE.BoxGeometry(LAVA_POOL_HALF_SIZE * 2, 0.15, LAVA_POOL_HALF_SIZE * 2);
        const fakeLavaMat = new THREE.MeshBasicMaterial({ color: 0xff3b00 });

        for (let i = 0; i < FAKE_LAVA_POOL_COUNT; i++) {
            const angle = worldRandom() * Math.PI * 2;
            const radius = (MAP_SIZE / 2) + 20 + worldRandom() * 700;
            const x = Math.cos(angle) * radius;
            const z = Math.sin(angle) * radius;

            const mesh = new THREE.Mesh(fakeLavaGeo, fakeLavaMat);
            mesh.position.set(x, 0.075, z);

            addWorldObject(mesh);
            addChunkedRenderObject(mesh);
        }
    }

    function createPillars(): void {
        obstacleHash.clear();
        const dummy = new THREE.Object3D();
        const boxGeo = new THREE.BoxGeometry(PILLAR_WIDTH, 1, PILLAR_WIDTH);

        const barkTex = createBarkTexture();
        const ringsTex = createRingsTexture();

        const barkMat = new THREE.MeshStandardMaterial({
            map: barkTex,
            roughness: 0.9,
            metalness: 0.1
        });

        const ringsMat = new THREE.MeshStandardMaterial({
            map: ringsTex,
            roughness: 0.8,
            metalness: 0.1
        });

        const materials = [barkMat, barkMat, ringsMat, ringsMat, barkMat, barkMat];

        const pillarInstances = createChunkedInstanceSet(boxGeo, materials, PILLAR_COUNT, true, true, 'pillars');

        const colliderMat = new THREE.MeshBasicMaterial();
        const sharedUnitBoxGeo = new THREE.BoxGeometry(1, 1, 1);

        for (let i = 0; i < PILLAR_COUNT; i++) {
            const height = 20.0 + worldRandom() * (MAX_PILLAR_HEIGHT - 20.0);
            dummy.scale.set(1, height, 1);
            dummy.position.set(
                (worldRandom() - 0.5) * (MAP_SIZE - 40),
                height / 2,
                (worldRandom() - 0.5) * (MAP_SIZE - 40)
            );
            let attempts = 0;
            while (overlapsTown(dummy.position.x, dummy.position.z, PILLAR_WIDTH / 2) && attempts++ < 100) {
                dummy.position.x = (worldRandom() - 0.5) * (MAP_SIZE - 40);
                dummy.position.z = (worldRandom() - 0.5) * (MAP_SIZE - 40);
            }
            if (overlapsTown(dummy.position.x, dummy.position.z, PILLAR_WIDTH / 2)) continue;
            dummy.updateMatrix();
            addChunkedInstance(pillarInstances, dummy.position.x, dummy.position.z, dummy.matrix);

            const obstacle = new THREE.Mesh(sharedUnitBoxGeo, colliderMat);
            obstacle.scale.set(PILLAR_WIDTH, height, PILLAR_WIDTH);
            obstacle.position.copy(dummy.position);
            const data = obstacleData(obstacle);
            data.height = height;
            data.halfW = PILLAR_WIDTH / 2;
            data.halfD = PILLAR_WIDTH / 2;
            data.halfH = height / 2;
            // Invisible meshes are the gameplay colliders and grapple targets; the
            // visible pillars are batched in the InstancedMesh above.
            obstacle.visible = false;
            addWorldObject(obstacle);
            port.pillar(obstacle);
            obstacleHash.insert(obstacle.position.x, obstacle.position.z, PILLAR_WIDTH, obstacle);
        }
    }

    function createLavaPools(): void {
        lavaHash.clear();
        const lavaGeo = new THREE.BoxGeometry(LAVA_POOL_HALF_SIZE * 2, 0.15, LAVA_POOL_HALF_SIZE * 2);
        const lavaMat = new THREE.MeshStandardMaterial({
            color: 0xff4500,
            emissive: 0xff2200,
            emissiveIntensity: 1.5,
            roughness: 0.5
        });
        const lavaInstances = createChunkedInstanceSet(lavaGeo, lavaMat, LAVA_CHAIN_COUNT * 5, false, false, 'lava');
        const lavaColliderMat = new THREE.MeshBasicMaterial();
        const lavaDummy = new THREE.Object3D();

        for (let i = 0; i < LAVA_CHAIN_COUNT; i++) {
            let chainValid = false;
            let squares: { x: number, z: number }[] = [];
            let attempts = 0;

            while (!chainValid && attempts < 100) {
                attempts++;
                squares = [];

                let startX = 0, startZ = 0;
                let posAttempts = 0;
                do {
                    startX = (worldRandom() - 0.5) * (MAP_SIZE - 80);
                    startZ = (worldRandom() - 0.5) * (MAP_SIZE - 80);
                    posAttempts++;
                } while (
                    (overlapsTown(startX, startZ, LAVA_POOL_HALF_SIZE) || overlapsWithPillars(startX, startZ)) &&
                    posAttempts < 50
                );

                if (posAttempts >= 50) continue;

                squares.push({ x: startX, z: startZ });

                const squareCount = 1 + Math.floor(worldRandom() * 5);

                let growthSuccess = true;
                for (let j = 1; j < squareCount; j++) {
                    let spotFound = false;
                    let spotAttempts = 0;

                    while (!spotFound && spotAttempts < 30) {
                        spotAttempts++;
                        const parent = squares[Math.floor(worldRandom() * squares.length)];
                        const dir = Math.floor(worldRandom() * 4);
                        let nextX = parent.x;
                        let nextZ = parent.z;
                        const step = LAVA_POOL_HALF_SIZE * 2;

                        if (dir === 0) nextX += step;
                        else if (dir === 1) nextX -= step;
                        else if (dir === 2) nextZ += step;
                        else nextZ -= step;

                        const duplicate = squares.some(sq => Math.abs(sq.x - nextX) < 1.0 && Math.abs(sq.z - nextZ) < 1.0);
                        if (duplicate) continue;

                        if (Math.abs(nextX) > (MAP_SIZE / 2 - LAVA_POOL_HALF_SIZE - 10) ||
                            Math.abs(nextZ) > (MAP_SIZE / 2 - LAVA_POOL_HALF_SIZE - 10)) {
                            continue;
                        }

                        if (overlapsTown(nextX, nextZ, LAVA_POOL_HALF_SIZE)) {
                            continue;
                        }

                        if (overlapsWithPillars(nextX, nextZ)) {
                            continue;
                        }

                        squares.push({ x: nextX, z: nextZ });
                        spotFound = true;
                    }

                    if (!spotFound) {
                        growthSuccess = false;
                        break;
                    }
                }

                if (growthSuccess) {
                    chainValid = true;
                }
            }

            if (chainValid) {
                const sqLen = squares.length;
                for (let k = 0; k < sqLen; k++) {
                    const sq = squares[k];
                    lavaDummy.position.set(sq.x, 0.075, sq.z);
                    lavaDummy.scale.set(1, 1, 1);
                    lavaDummy.rotation.set(0, 0, 0);
                    lavaDummy.updateMatrix();
                    addChunkedInstance(lavaInstances, sq.x, sq.z, lavaDummy.matrix);

                    // Keep lightweight invisible meshes for the existing collision
                    // and grappling registries; the visible pools are batched above.
                    const lavaCollider = new THREE.Mesh(lavaGeo, lavaColliderMat);
                    lavaCollider.position.copy(lavaDummy.position);
                    lavaCollider.visible = false;
                    addWorldObject(lavaCollider);
                    port.lava(lavaCollider);
                    lavaHash.insert(lavaCollider.position.x, lavaCollider.position.z, LAVA_POOL_HALF_SIZE, lavaCollider);
                }
            }
        }

    }

    function createBushes(): void {
        // Near-field bushes are geometry; far-field bushes are sprites. Both avoid
        // blockers/hazards so the arena remains readable.
        const trunkInstances = createChunkedInstanceSet(
            SHARED_TRUNK_GEO,
            SHARED_TRUNK_MAT,
            BUSH_3D_COUNT
        );
        const leafInstances = SHARED_LEAF_MATERIALS.map((material) => createChunkedInstanceSet(
            SHARED_LEAF_GEO,
            material,
            BUSH_3D_COUNT * 3
        ));
        const bushRoot = new THREE.Object3D();
        const bushPart = new THREE.Object3D();
        const bushMatrix = new THREE.Matrix4();

        let spawned3DBushes = 0;
        let attempts3D = 0;
        while (spawned3DBushes < BUSH_3D_COUNT && attempts3D < BUSH_3D_COUNT * 10) {
            attempts3D++;
            const angle = worldRandom() * Math.PI * 2;
            const radius = worldRandom() * BUSH_3D_RADIUS_CAP;
            const x = Math.cos(angle) * radius;
            const z = Math.sin(angle) * radius;

            if (!overlapsWithPillarsOrLava(x, z, 3.5)) {
                const s = 0.75 + worldRandom() * 0.5;
                appendLowPolyBush(
                    trunkInstances,
                    leafInstances,
                    x,
                    z,
                    s,
                    bushRoot,
                    bushPart,
                    bushMatrix
                );
                spawned3DBushes++;
            }
        }

        const bushGreenShades = [0x153018, 0x1a331c, 0x162c18, 0x0f2010, 0x132815];
        const bush2DTextures = bushGreenShades.map(color => create2DLowPolyBushTexture(color));
        const spriteMaterials = bush2DTextures.map(tex => new THREE.SpriteMaterial({
            map: tex,
            transparent: true,
            color: 0xffffff
        }));

        let spawned2DOutside = 0;
        let attempts2DOutside = 0;
        while (spawned2DOutside < BUSH_2D_COUNT && attempts2DOutside < BUSH_2D_COUNT * 8) {
            attempts2DOutside++;
            const angle = worldRandom() * Math.PI * 2;
            const radius = BUSH_2D_INNER_RADIUS + worldRandom() * BUSH_2D_SPREAD;
            const x = Math.cos(angle) * radius;
            const z = Math.sin(angle) * radius;

            if (!overlapsWithFakePillars(x, z, 3.5)) {
                const mat = spriteMaterials[Math.floor(worldRandom() * spriteMaterials.length)];
                const sprite = new THREE.Sprite(mat);
                const height = 4.0 + worldRandom() * 2.0;
                const width = height * (0.8 + worldRandom() * 0.3);
                sprite.scale.set(width, height, 1.0);
                sprite.position.set(x, height / 2, z);
                addWorldObject(sprite);
                addChunkedRenderObject(sprite);
                spawned2DOutside++;
            }
        }
    }


    const reset = () => {
        obstacleHash.clear(); lavaHash.clear(); fakePillars = [];
        _placementObstacleCandidates.length = _placementLavaCandidates.length = 0;
    };
    return { createFloor, createFakeBillboards, createPillars, createLavaPools, createBushes, reset };
}
