import * as THREE from 'three';
import { state } from './state.js';
import {
    MAP_SIZE,
    PILLAR_COUNT,
    PILLAR_WIDTH,
    MAX_PILLAR_HEIGHT,
    MAX_ENEMY_HEIGHT,
    ENEMY_CLASSES,
    LAVA_POOL_HALF_SIZE,
    TARGET_HIT_RANGE_MULTIPLIER,
    FAKE_PILLAR_COUNT,
    FAKE_LAVA_POOL_COUNT,
    LAVA_CHAIN_COUNT,
    BUSH_2D_COUNT,
    BUSH_3D_COUNT,
    BUSH_3D_RADIUS_CAP,
    BUSH_2D_INNER_RADIUS,
    BUSH_2D_SPREAD,
    GROUND_VISUAL_SIZE,
    RENDER_CHUNK_SIZE
} from './config.js';
import { SpatialHash } from './spatialHash.js';
import { obstacleData, targetData } from './userDataTypes.js';

const obstacleHash = new SpatialHash<THREE.Object3D>(32);
const lavaHash = new SpatialHash<THREE.Object3D>(32);
const targetHash = new SpatialHash<THREE.Group>(48);
const worldObjects: THREE.Object3D[] = [];
const renderChunks = new Map<string, THREE.Object3D[]>();
const activeRenderChunks = new Set<string>();
let targetUpdateFrame = 0;
let lastRenderChunkX = Number.NaN;
let lastRenderChunkZ = Number.NaN;
let lastRenderDistanceChunks = -1;

function addWorldObject<T extends THREE.Object3D>(obj: T): T {
    state.scene!.add(obj);
    worldObjects.push(obj);
    return obj;
}

function getRenderChunkKey(x: number, z: number): string {
    return `${Math.floor(x / RENDER_CHUNK_SIZE)},${Math.floor(z / RENDER_CHUNK_SIZE)}`;
}

function addChunkedRenderObject(obj: THREE.Object3D): void {
    const key = getRenderChunkKey(obj.position.x, obj.position.z);
    const chunk = renderChunks.get(key);
    if (chunk) {
        chunk.push(obj);
    } else {
        renderChunks.set(key, [obj]);
    }
    obj.visible = false;
}

function setRenderChunkVisible(key: string, visible: boolean): void {
    const objects = renderChunks.get(key);
    if (!objects) return;
    for (let i = 0; i < objects.length; i++) {
        objects[i].visible = visible;
    }
}

export function updateEnvironmentVisibility(position: THREE.Vector3, distanceChunks: number): void {
    const centerX = Math.floor(position.x / RENDER_CHUNK_SIZE);
    const centerZ = Math.floor(position.z / RENDER_CHUNK_SIZE);
    const radius = Math.max(1, Math.min(8, Math.round(distanceChunks)));
    if (centerX === lastRenderChunkX && centerZ === lastRenderChunkZ && radius === lastRenderDistanceChunks) return;

    lastRenderChunkX = centerX;
    lastRenderChunkZ = centerZ;
    lastRenderDistanceChunks = radius;

    const nextActive = new Set<string>();

    for (let dz = -radius; dz <= radius; dz++) {
        for (let dx = -radius; dx <= radius; dx++) {
            const key = `${centerX + dx},${centerZ + dz}`;
            nextActive.add(key);
            if (!activeRenderChunks.has(key)) {
                setRenderChunkVisible(key, true);
            }
        }
    }

    activeRenderChunks.forEach((key) => {
        if (!nextActive.has(key)) {
            setRenderChunkVisible(key, false);
        }
    });

    activeRenderChunks.clear();
    nextActive.forEach((key) => activeRenderChunks.add(key));
}

export function queryObstaclesNear(x: number, z: number, radius: number, out?: THREE.Object3D[]): THREE.Object3D[] {
    return obstacleHash.query(x, z, radius, out);
}

export function queryLavaPoolsNear(x: number, z: number, radius: number, out?: THREE.Object3D[]): THREE.Object3D[] {
    return lavaHash.query(x, z, radius, out);
}

export function queryTargetsNear(x: number, z: number, radius: number, out?: THREE.Group[]): THREE.Group[] {
    return targetHash.query(x, z, radius, out);
}

export function rebuildTargetHash(): void {
    targetHash.clear();
    for (let i = 0; i < state.targets.length; i++) {
        const target = state.targets[i];
        const radius = TARGET_HIT_RANGE_MULTIPLIER * (targetData(target).scale || 1.0);
        targetHash.insert(target.position.x, target.position.z, radius, target);
    }
}

export function respawnTarget(targetGroup: THREE.Group): void {
    targetGroup.position.x = (Math.random() - 0.5) * (MAP_SIZE - 40);
    targetGroup.position.y = 3.0 + Math.random() * (MAX_ENEMY_HEIGHT - 5.0);
    targetGroup.position.z = (Math.random() - 0.5) * (MAP_SIZE - 40);

    const randClass = ENEMY_CLASSES[Math.floor(Math.random() * ENEMY_CLASSES.length)];

    const data = targetData(targetGroup);
    data.maxHp = randClass.hp;
    data.hp = randClass.hp;
    data.scale = randClass.scale;
    data.color = randClass.color;
    (data.bodyMesh.material as THREE.MeshStandardMaterial).color.setHex(randClass.color);
    
    data.bodyMesh.scale.set(randClass.scale, randClass.scale, randClass.scale);
    data.healthBarGroup.position.y = 1.6 * randClass.scale;
    data.healthBarGroup.scale.set(randClass.scale, randClass.scale, 1);
    
    data.healthBarFg.scale.x = 1;
}

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
    return checkAABBOverlap(sqX, sqZ, PILLAR_WIDTH / 2, state.obstacles, LAVA_POOL_HALF_SIZE);
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
        const x = Math.random() * size;
        const y = Math.random() * size;
        const length = 2 + Math.random() * 5;
        const angle = -Math.PI / 2 + (Math.random() - 0.5) * 0.5;

        const hue = 90 + Math.random() * 25;
        const sat = 45 + Math.random() * 15;
        const light = 22 + Math.random() * 18;

        ctx.strokeStyle = `hsl(${hue}, ${sat}%, ${light}%)`;
        ctx.lineWidth = 1.5 + Math.random() * 2.0;
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
        const x = Math.random() * size;
        const y = Math.random() * size;
        const length = 40 + Math.random() * 120;
        
        const hue = 22 + Math.random() * 8;
        const sat = 25 + Math.random() * 15;
        const light = 12 + Math.random() * 15;

        ctx.strokeStyle = `hsl(${hue}, ${sat}%, ${light}%)`;
        ctx.lineWidth = 1.5 + Math.random() * 3.5;
        ctx.beginPath();
        ctx.moveTo(x, y);
        const jitter = (Math.random() - 0.5) * 2;
        ctx.lineTo(x + jitter, y + length);
        ctx.stroke();
    }

    ctx.strokeStyle = '#1a0d05';
    for (let i = 0; i < 40; i++) {
        let x = Math.random() * size;
        ctx.lineWidth = 2 + Math.random() * 4;
        ctx.beginPath();
        ctx.moveTo(x, 0);
        for (let y = 0; y < size; y += 20) {
            x += (Math.random() - 0.5) * 4;
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
    const step = 6 + Math.random() * 4;

    for (let r = 10; r < maxRadius; r += step) {
        const hue = 25 + Math.random() * 8;
        const sat = 30 + Math.random() * 15;
        const light = 35 + Math.random() * 10;
        ctx.strokeStyle = `hsl(${hue}, ${sat}%, ${light}%)`;
        ctx.lineWidth = 1 + Math.random() * 1.5;

        ctx.beginPath();
        const segments = 120;
        for (let i = 0; i <= segments; i++) {
            const angle = (i / segments) * Math.PI * 2;
            
            const wave = Math.sin(angle * 6) * 3 + Math.cos(angle * 3) * 2 + Math.sin(angle * 12) * 0.8;
            const radialJitter = wave + (Math.random() - 0.5) * 0.5;
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
        const angle = Math.random() * Math.PI * 2;
        const radius = Math.random() * maxRadius;
        const px = cx + Math.cos(angle) * radius;
        const py = cy + Math.sin(angle) * radius;
        
        ctx.fillRect(px, py, 1.5, 1.5);
    }

    const numCracks = 3 + Math.floor(Math.random() * 3);
    ctx.strokeStyle = 'rgba(65, 40, 20, 0.85)';
    
    for (let i = 0; i < numCracks; i++) {
        const baseAngle = Math.random() * Math.PI * 2;
        const startRad = 15 + Math.random() * 30;
        const endRad = maxRadius * (0.6 + Math.random() * 0.4);
        
        ctx.lineWidth = 1.5 + Math.random() * 2;
        ctx.beginPath();
        
        let currentX = cx + Math.cos(baseAngle) * startRad;
        let currentY = cy + Math.sin(baseAngle) * startRad;
        ctx.moveTo(currentX, currentY);
        
        const steps = 15;
        for (let j = 1; j <= steps; j++) {
            const t = j / steps;
            const r = startRad + t * (endRad - startRad);
            const angleJitter = baseAngle + (Math.random() - 0.5) * 0.15;
            
            currentX = cx + Math.cos(angleJitter) * r;
            currentY = cy + Math.sin(angleJitter) * r;
            ctx.lineTo(currentX, currentY);
        }
        ctx.stroke();
    }

    ctx.fillStyle = '#412814';
    ctx.beginPath();
    ctx.arc(cx, cy, 3 + Math.random() * 4, 0, Math.PI * 2);
    ctx.fill();

    const texture = new THREE.CanvasTexture(canvas);
    return texture;
}

// Bushes use shared geometry/materials because there can be hundreds of them.
const SHARED_TRUNK_GEO = new THREE.CylinderGeometry(0.15, 0.25, 1.0, 5);
const SHARED_LEAF_GEO = new THREE.DodecahedronGeometry(1.0, 0);
const SHARED_TRUNK_MAT = new THREE.MeshLambertMaterial({ color: 0x5a3d28, flatShading: true });
const SHARED_WORLD_GEOMETRIES = new Set<THREE.BufferGeometry>([
    SHARED_TRUNK_GEO,
    SHARED_LEAF_GEO
]);
const SHARED_WORLD_MATERIALS = new Set<THREE.Material>([
    SHARED_TRUNK_MAT
]);

function createLowPolyBush(): THREE.Group {
    const bushGroup = new THREE.Group();
    
    const greenShades = [0x2f6633, 0x3d7a42, 0x4b8e51, 0x224c25, 0x3c7841];
    const leafColor = greenShades[Math.floor(Math.random() * greenShades.length)];
    const leafMat = new THREE.MeshLambertMaterial({ 
        color: leafColor, 
        flatShading: true 
    });

    const trunk = new THREE.Mesh(SHARED_TRUNK_GEO, SHARED_TRUNK_MAT);
    trunk.position.y = 0.5;
    trunk.castShadow = true;
    trunk.receiveShadow = true;
    bushGroup.add(trunk);

    const numClusters = 3 + Math.floor(Math.random() * 3);
    for (let i = 0; i < numClusters; i++) {
        const radius = 0.7 + Math.random() * 0.7;
        const leafMesh = new THREE.Mesh(SHARED_LEAF_GEO, leafMat);
        leafMesh.scale.setScalar(radius);
        
        const ox = (Math.random() - 0.5) * 1.0;
        const oy = 0.7 + Math.random() * 0.9;
        const oz = (Math.random() - 0.5) * 1.0;
        leafMesh.position.set(ox, oy, oz);
        
        leafMesh.rotation.set(
            Math.random() * Math.PI,
            Math.random() * Math.PI,
            Math.random() * Math.PI
        );
        
        leafMesh.castShadow = true;
        leafMesh.receiveShadow = true;
        bushGroup.add(leafMesh);
    }
    
    return bushGroup;
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

        const numVertices = 6 + Math.floor(Math.random() * 3);
        const vertices: { x: number, y: number }[] = [];
        for (let i = 0; i < numVertices; i++) {
            const angle = (i / numVertices) * Math.PI * 2 + (Math.random() - 0.5) * 0.1;
            const dist = radius * (0.85 + Math.random() * 0.3);
            vertices.push({
                x: cx + Math.cos(angle) * dist,
                y: cy + Math.sin(angle) * dist
            });
        }

        const centerOffsetX = (Math.random() - 0.3) * (radius * 0.25);
        const centerOffsetY = -radius * 0.15 + (Math.random() - 0.5) * (radius * 0.15);
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
    if (checkAABBOverlap(x, z, checkRadius, state.obstacles, PILLAR_WIDTH / 2)) return true;
    if (checkAABBOverlap(x, z, checkRadius, state.lavaPools, LAVA_POOL_HALF_SIZE)) return true;
    if (x * x + z * z < 625) return true;
    return false;
}

function overlapsWithFakePillars(x: number, z: number, checkRadius: number): boolean {
    if (!state.fakePillars) return false;
    return checkAABBOverlap(x, z, checkRadius, state.fakePillars, (PILLAR_WIDTH * 1.5) / 2);
}

function createFloor(): void {
    const floorGeo = new THREE.PlaneGeometry(GROUND_VISUAL_SIZE, GROUND_VISUAL_SIZE);
    const grassTex = createGrassTexture();
    const floorMat = new THREE.MeshLambertMaterial({ map: grassTex, color: 0xffffff });
    const floor = new THREE.Mesh(floorGeo, floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true; 
    addWorldObject(floor);
    state.grappleSurfaces.push(floor);
}

function createFakeBillboards(): void {
    // Background-only props outside the playable square. They add scale without
    // participating in physics or gameplay.
    state.fakePillars = [];
    const fakePillarGeo = new THREE.PlaneGeometry(PILLAR_WIDTH * 1.5, 1);
    const fakePillarMat = new THREE.MeshLambertMaterial({ color: 0x483224, side: THREE.DoubleSide });

    for (let i = 0; i < FAKE_PILLAR_COUNT; i++) {
        const angle = Math.random() * Math.PI * 2;
        const radius = (MAP_SIZE / 2) + 20 + Math.random() * 700;
        const x = Math.cos(angle) * radius;
        const z = Math.sin(angle) * radius;
        const height = 20 + Math.random() * (MAX_PILLAR_HEIGHT - 20);

        const mesh = new THREE.Mesh(fakePillarGeo, fakePillarMat);
        mesh.scale.set(1, height, 1);
        mesh.position.set(x, height / 2, z);
        
        addWorldObject(mesh);
        state.fakePillars.push(mesh);
    }

    const fakeLavaGeo = new THREE.BoxGeometry(LAVA_POOL_HALF_SIZE * 2, 0.15, LAVA_POOL_HALF_SIZE * 2);
    const fakeLavaMat = new THREE.MeshBasicMaterial({ color: 0xff3b00 });

    for (let i = 0; i < FAKE_LAVA_POOL_COUNT; i++) {
        const angle = Math.random() * Math.PI * 2;
        const radius = (MAP_SIZE / 2) + 20 + Math.random() * 700;
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
    
    const pillarInstanced = new THREE.InstancedMesh(boxGeo, materials, PILLAR_COUNT);
    pillarInstanced.castShadow = true;
    pillarInstanced.receiveShadow = true;

    const colliderMat = new THREE.MeshBasicMaterial();
    const sharedUnitBoxGeo = new THREE.BoxGeometry(1, 1, 1);

    for (let i = 0; i < PILLAR_COUNT; i++) {
        const height = 20.0 + Math.random() * (MAX_PILLAR_HEIGHT - 20.0);
        dummy.scale.set(1, height, 1);
        dummy.position.set(
            (Math.random() - 0.5) * (MAP_SIZE - 40),
            height / 2,
            (Math.random() - 0.5) * (MAP_SIZE - 40)
        );
        dummy.updateMatrix();
        pillarInstanced.setMatrixAt(i, dummy.matrix);

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
        state.obstacles.push(obstacle);
        state.grappleSurfaces.push(obstacle);
        obstacleHash.insert(obstacle.position.x, obstacle.position.z, PILLAR_WIDTH, obstacle);
    }
    addWorldObject(pillarInstanced);
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
                startX = (Math.random() - 0.5) * (MAP_SIZE - 80);
                startZ = (Math.random() - 0.5) * (MAP_SIZE - 80);
                posAttempts++;
            } while (
                (Math.sqrt(startX * startX + startZ * startZ) < 30 || overlapsWithPillars(startX, startZ)) && 
                posAttempts < 50
            );
            
            if (posAttempts >= 50) continue;
            
            squares.push({ x: startX, z: startZ });
            
            const squareCount = 1 + Math.floor(Math.random() * 5);
            
            let growthSuccess = true;
            for (let j = 1; j < squareCount; j++) {
                let spotFound = false;
                let spotAttempts = 0;
                
                while (!spotFound && spotAttempts < 30) {
                    spotAttempts++;
                    const parent = squares[Math.floor(Math.random() * squares.length)];
                    const dir = Math.floor(Math.random() * 4);
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
                    
                    if (Math.sqrt(nextX * nextX + nextZ * nextZ) < 30) {
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
                const lavaMesh = new THREE.Mesh(lavaGeo, lavaMat);
                lavaMesh.position.set(sq.x, 0.075, sq.z);
                addWorldObject(lavaMesh);
                addChunkedRenderObject(lavaMesh);
                state.lavaPools.push(lavaMesh);
                state.grappleSurfaces.push(lavaMesh);
                lavaHash.insert(lavaMesh.position.x, lavaMesh.position.z, LAVA_POOL_HALF_SIZE, lavaMesh);
            }
        }
    }
}

function createBushes(): void {
    // Near-field bushes are geometry; far-field bushes are sprites. Both avoid
    // blockers/hazards so the arena remains readable.
    let spawned3DBushes = 0;
    let attempts3D = 0;
    while (spawned3DBushes < BUSH_3D_COUNT && attempts3D < BUSH_3D_COUNT * 10) {
        attempts3D++;
        const angle = Math.random() * Math.PI * 2;
        const radius = Math.random() * BUSH_3D_RADIUS_CAP;
        const x = Math.cos(angle) * radius;
        const z = Math.sin(angle) * radius;

        if (!overlapsWithPillarsOrLava(x, z, 3.5)) {
            const bush = createLowPolyBush();
            const s = 0.75 + Math.random() * 0.5;
            bush.scale.set(s, s, s);
            bush.position.set(x, 0, z);
            addWorldObject(bush);
            addChunkedRenderObject(bush);
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
        const angle = Math.random() * Math.PI * 2;
        const radius = BUSH_2D_INNER_RADIUS + Math.random() * BUSH_2D_SPREAD;
        const x = Math.cos(angle) * radius;
        const z = Math.sin(angle) * radius;

        if (!overlapsWithFakePillars(x, z, 3.5)) {
            const mat = spriteMaterials[Math.floor(Math.random() * spriteMaterials.length)];
            const sprite = new THREE.Sprite(mat);
            const height = 4.0 + Math.random() * 2.0;
            const width = height * (0.8 + Math.random() * 0.3);
            sprite.scale.set(width, height, 1.0);
            sprite.position.set(x, height / 2, z);
            addWorldObject(sprite);
            addChunkedRenderObject(sprite);
            spawned2DOutside++;
        }
    }
}

function createEnemies(): void {
    const targetGeo = new THREE.BoxGeometry(2, 2, 2);
    const targetMat = new THREE.MeshStandardMaterial({ roughness: 0.2 });

    const barBgGeo = new THREE.PlaneGeometry(1.8, 0.15);
    const barBgMat = new THREE.MeshBasicMaterial({ color: 0x333333, side: THREE.DoubleSide });
    
    const barFgGeo = new THREE.PlaneGeometry(1.8, 0.15).translate(0.9, 0, 0);
    const barFgMat = new THREE.MeshBasicMaterial({ color: 0x00ffcc, side: THREE.DoubleSide });

    for (let i = 0; i < 16; i++) {
        const targetGroup = new THREE.Group();
        const data = targetData(targetGroup);
        data.index = i;

        const bodyMesh = new THREE.Mesh(targetGeo, targetMat.clone());
        bodyMesh.castShadow = true;    
        bodyMesh.receiveShadow = true;
        targetGroup.add(bodyMesh);
        data.bodyMesh = bodyMesh;

        const healthBarGroup = new THREE.Group();
        healthBarGroup.position.y = 1.6;

        const barBg = new THREE.Mesh(barBgGeo, barBgMat);
        healthBarGroup.add(barBg);

        const barFg = new THREE.Mesh(barFgGeo, barFgMat);
        barFg.position.set(-0.9, 0, 0.01);
        healthBarGroup.add(barFg);

        targetGroup.add(healthBarGroup);
        data.healthBarFg = barFg;
        data.healthBarBg = barBg;
        data.healthBarGroup = healthBarGroup;

        respawnTarget(targetGroup);
        addWorldObject(targetGroup);
        state.targets.push(targetGroup);
    }
    rebuildTargetHash();
}

export function createEnvironment(): void {
    if (!state.scene) return;

    createFloor();
    createFakeBillboards();
    createPillars();
    createLavaPools();
    createBushes();
    createEnemies();
}

export function disposeWorld(): void {
    if (!state.scene) return;
    const disposedGeometries = new Set<THREE.BufferGeometry>();
    const disposedMaterials = new Set<THREE.Material>();
    const disposedTextures = new Set<THREE.Texture>();

    const disposeMaterial = (mat: THREE.Material) => {
        if (SHARED_WORLD_MATERIALS.has(mat) || disposedMaterials.has(mat)) return;
        disposedMaterials.add(mat);

        const texture = (mat as any).map as THREE.Texture | undefined;
        if (texture && !disposedTextures.has(texture)) {
            disposedTextures.add(texture);
            texture.dispose();
        }

        mat.dispose();
    };

    const disposeObject = (obj: THREE.Object3D) => {
        state.scene!.remove(obj);
        obj.traverse((child: any) => {
            if (child.isMesh || child.isSprite) {
                if (child.geometry && !SHARED_WORLD_GEOMETRIES.has(child.geometry) && !disposedGeometries.has(child.geometry)) {
                    disposedGeometries.add(child.geometry);
                    child.geometry.dispose();
                }
                if (Array.isArray(child.material)) {
                    child.material.forEach(disposeMaterial);
                } else {
                    const mat = child.material as THREE.Material | undefined;
                    if (mat) disposeMaterial(mat);
                }
            }
        });
    };

    worldObjects.forEach(disposeObject);
    worldObjects.length = 0;
    state.targets = [];
    state.obstacles = [];
    state.grappleSurfaces = [];
    state.lavaPools = [];
    state.fakePillars = [];
    obstacleHash.clear();
    lavaHash.clear();
    targetHash.clear();
    renderChunks.clear();
    activeRenderChunks.clear();
    lastRenderChunkX = Number.NaN;
    lastRenderChunkZ = Number.NaN;
    lastRenderDistanceChunks = -1;
}

export function updateTargets(delta: number): void {
    targetUpdateFrame++;
    const updateBillboards = (targetUpdateFrame % 2) === 0;
    const targetsLen = state.targets.length;
    for (let i = 0; i < targetsLen; i++) {
        const target = state.targets[i];
        const data = targetData(target);
        data.bodyMesh.rotation.x += 1.0 * delta;
        data.bodyMesh.rotation.y += 1.5 * delta;
        if (updateBillboards && state.camera) {
            data.healthBarGroup.quaternion.copy(state.camera.quaternion);
        }
    }

    // Billboard pillars face the player horizontally, not the full camera pitch.
    if (updateBillboards && state.fakePillars && state.controls) {
        const playerObj = state.controls.getObject();
        const px = playerObj.position.x;
        const pz = playerObj.position.z;
        const pillarsLen = state.fakePillars.length;
        for (let i = 0; i < pillarsLen; i++) {
            const pillar = state.fakePillars[i];
            pillar.lookAt(px, pillar.position.y, pz);
        }
    }
}
