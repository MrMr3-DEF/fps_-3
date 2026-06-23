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
    BUSH_2D_COUNT,
    BUSH_3D_COUNT,
    BUSH_3D_RADIUS_CAP,
    BUSH_2D_INNER_RADIUS,
    BUSH_2D_SPREAD
} from './config.js';

// Respawn targeted remote target at random location within map boundaries and randomize target scale/class/health.
export function respawnTarget(targetGroup) {
    targetGroup.position.x = (Math.random() - 0.5) * (MAP_SIZE - 40);
    targetGroup.position.y = 3.0 + Math.random() * (MAX_ENEMY_HEIGHT - 5.0);
    targetGroup.position.z = (Math.random() - 0.5) * (MAP_SIZE - 40);

    const randClass = ENEMY_CLASSES[Math.floor(Math.random() * ENEMY_CLASSES.length)];

    targetGroup.userData.maxHp = randClass.hp;
    targetGroup.userData.hp = randClass.hp;
    targetGroup.userData.scale = randClass.scale;
    targetGroup.userData.color = randClass.color; // Keep color for explosions
    targetGroup.userData.bodyMesh.material.color.setHex(randClass.color);
    
    targetGroup.userData.bodyMesh.scale.set(randClass.scale, randClass.scale, randClass.scale);
    targetGroup.userData.healthBarGroup.position.y = 1.6 * randClass.scale;
    targetGroup.userData.healthBarGroup.scale.set(randClass.scale, randClass.scale, 1);
    
    targetGroup.userData.healthBarFg.scale.x = 1;
}

// Unified AABB collision helper
function checkAABBOverlap(x, z, checkRadius, array, halfWidth) {
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

// Helper to check if a square center (sqX, sqZ) overlaps with any spawned pillar
function overlapsWithPillars(sqX, sqZ) {
    return checkAABBOverlap(sqX, sqZ, PILLAR_WIDTH / 2, state.obstacles, LAVA_POOL_HALF_SIZE);
}

// Procedurally generates grass texture by rendering randomized organic green HSL strokes on an offscreen HTML canvas.
function createGrassTexture() {
    const size = 512;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');

    // Base green: rich, vibrant dark grass green
    ctx.fillStyle = '#1e4620';
    ctx.fillRect(0, 0, size, size);

    // Populate with 20000 grass blades / flecks of varying shades
    for (let i = 0; i < 20000; i++) {
        const x = Math.random() * size;
        const y = Math.random() * size;
        const length = 2 + Math.random() * 5;
        const angle = -Math.PI / 2 + (Math.random() - 0.5) * 0.5; // Upward leaning

        // Palette of grass colors
        const hue = 90 + Math.random() * 25; // 90 to 115
        const sat = 45 + Math.random() * 15; // 45% to 60%
        const light = 22 + Math.random() * 18; // 22% to 40%

        ctx.strokeStyle = `hsl(${hue}, ${sat}%, ${light}%)`;
        ctx.lineWidth = 1 + Math.random() * 1.5;
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

// Procedurally generates bark texture by rendering organic vertical bark ridges and horizontal cracks on an offscreen HTML canvas.
function createBarkTexture() {
    const size = 512;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');

    // Base dark brown bark color
    ctx.fillStyle = '#3a2312';
    ctx.fillRect(0, 0, size, size);

    // Populate with vertical wood grain strokes of varying shades of brown
    for (let i = 0; i < 4000; i++) {
        const x = Math.random() * size;
        const y = Math.random() * size;
        const length = 40 + Math.random() * 120;
        
        // Random brown shade
        const hue = 22 + Math.random() * 8;       // 22 to 30 (browns)
        const sat = 25 + Math.random() * 15;      // 25% to 40%
        const light = 12 + Math.random() * 15;     // 12% to 27% (darker bark tones)

        ctx.strokeStyle = `hsl(${hue}, ${sat}%, ${light}%)`;
        ctx.lineWidth = 1.5 + Math.random() * 3.5;
        ctx.beginPath();
        ctx.moveTo(x, y);
        // Slightly jitter the x coordinate to make it look organic
        const jitter = (Math.random() - 0.5) * 2;
        ctx.lineTo(x + jitter, y + length);
        ctx.stroke();
    }

    // Add deep vertical dark cracks (bark fissures)
    ctx.strokeStyle = '#1a0d05';
    for (let i = 0; i < 40; i++) {
        let x = Math.random() * size;
        ctx.lineWidth = 2 + Math.random() * 4;
        ctx.beginPath();
        ctx.moveTo(x, 0);
        for (let y = 0; y < size; y += 20) {
            // Jitter the crack horizontally
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

// Procedurally generates aging tree rings texture by drawing concentric circles and radial splits on an offscreen HTML canvas.
function createRingsTexture() {
    const size = 512;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');

    const cx = size / 2;
    const cy = size / 2;

    // Base light wood core color (lighter warm brown/tan)
    ctx.fillStyle = '#e4c49f';
    ctx.fillRect(0, 0, size, size);

    // Draw concentric rings with wavy noise to simulate tree years growth
    const maxRadius = size * 0.75;
    const step = 6 + Math.random() * 4; // distance between rings

    for (let r = 10; r < maxRadius; r += step) {
        // Vary the color and opacity slightly for each ring
        const hue = 25 + Math.random() * 8;
        const sat = 30 + Math.random() * 15;
        const light = 35 + Math.random() * 10;
        ctx.strokeStyle = `hsl(${hue}, ${sat}%, ${light}%)`;
        ctx.lineWidth = 1 + Math.random() * 1.5;

        ctx.beginPath();
        // Generate a wavy circle path
        const segments = 120;
        for (let i = 0; i <= segments; i++) {
            const angle = (i / segments) * Math.PI * 2;
            
            // Generate some wavy noise using simple sine/cosine wave sum
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

    // Add fine wood grain details (concentric noise)
    ctx.fillStyle = 'rgba(150, 110, 80, 0.08)';
    for (let i = 0; i < 5000; i++) {
        const angle = Math.random() * Math.PI * 2;
        const radius = Math.random() * maxRadius;
        const px = cx + Math.cos(angle) * radius;
        const py = cy + Math.sin(angle) * radius;
        
        ctx.fillRect(px, py, 1.5, 1.5);
    }

    // Add radial cracks (split wood from aging/drying)
    const numCracks = 3 + Math.floor(Math.random() * 3); // 3 to 5 cracks
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

    // Add a dark central pith
    ctx.fillStyle = '#412814';
    ctx.beginPath();
    ctx.arc(cx, cy, 3 + Math.random() * 4, 0, Math.PI * 2);
    ctx.fill();

    const texture = new THREE.CanvasTexture(canvas);
    return texture;
}

// Procedurally constructs 3D low-poly tree geometries using cylinder trunk and multiple dodacahedron leaf meshes.
function createLowPolyBush() {
    const bushGroup = new THREE.Group();
    
    // Choose a green base shade for the leaves
    const greenShades = [0x2f6633, 0x3d7a42, 0x4b8e51, 0x224c25, 0x3c7841];
    const leafColor = greenShades[Math.floor(Math.random() * greenShades.length)];
    const leafMat = new THREE.MeshLambertMaterial({ 
        color: leafColor, 
        flatShading: true 
    });

    // Trunk: small cylinder
    const trunkGeo = new THREE.CylinderGeometry(0.15, 0.25, 1.0, 5);
    const trunkMat = new THREE.MeshLambertMaterial({ color: 0x5a3d28, flatShading: true });
    const trunk = new THREE.Mesh(trunkGeo, trunkMat);
    trunk.position.y = 0.5;
    trunk.castShadow = true;
    trunk.receiveShadow = true;
    bushGroup.add(trunk);

    // Leaves clusters: overlapping dodecahedrons
    const numClusters = 3 + Math.floor(Math.random() * 3); // 3 to 5 clusters
    for (let i = 0; i < numClusters; i++) {
        const radius = 0.7 + Math.random() * 0.7; // size of cluster
        const leafGeo = new THREE.DodecahedronGeometry(radius, 0);
        const leafMesh = new THREE.Mesh(leafGeo, leafMat);
        
        // Offset leaf mesh relative to trunk
        const ox = (Math.random() - 0.5) * 1.0;
        const oy = 0.7 + Math.random() * 0.9;
        const oz = (Math.random() - 0.5) * 1.0;
        leafMesh.position.set(ox, oy, oz);
        
        // Random rotation for low-poly look variation
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

// Procedurally generates 2D flat-shaded billboard bush texture using custom face triangulation and light scaling.
function create2DLowPolyBushTexture(baseColorHex) {
    const size = 256;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');

    ctx.clearRect(0, 0, size, size);

    const centerX = size / 2;
    const centerY = size * 0.9; // Shift leaves down since there is no trunk/stem

    // Helper to draw a faceted low-poly leaf cluster using a base color
    function drawFacetedCluster(cx, cy, radius, colorHex) {
        // Parse hex color string (e.g. '#2f6633') or hex number (e.g. 0x2f6633)
        let hex = colorHex;
        if (typeof hex === 'number') {
            hex = '#' + hex.toString(16).padStart(6, '0');
        }
        const r = parseInt(hex.slice(1, 3), 16);
        const g = parseInt(hex.slice(3, 5), 16);
        const b = parseInt(hex.slice(5, 7), 16);

        const numVertices = 6 + Math.floor(Math.random() * 3); // 6 to 8 vertices
        const vertices = [];
        for (let i = 0; i < numVertices; i++) {
            const angle = (i / numVertices) * Math.PI * 2 + (Math.random() - 0.5) * 0.1;
            const dist = radius * (0.85 + Math.random() * 0.3);
            vertices.push({
                x: cx + Math.cos(angle) * dist,
                y: cy + Math.sin(angle) * dist
            });
        }

        // Center vertex, slightly offset up-left to simulate light from top-right
        const centerOffsetX = (Math.random() - 0.3) * (radius * 0.25);
        const centerOffsetY = -radius * 0.15 + (Math.random() - 0.5) * (radius * 0.15);
        const center = { x: cx + centerOffsetX, y: cy + centerOffsetY };

        // Draw triangular faces
        for (let i = 0; i < numVertices; i++) {
            const v1 = vertices[i];
            const v2 = vertices[(i + 1) % numVertices];

            // Calculate angle of the face midpoint relative to the cluster center
            const midX = (v1.x + v2.x) / 2;
            const midY = (v1.y + v2.y) / 2;
            const faceAngle = Math.atan2(midY - cy, midX - cx);

            // Light comes from top-right (-Math.PI/4)
            const dot = Math.cos(faceAngle - (-Math.PI / 4));
            // Map dot [-1, 1] to light factor [0.75, 1.25]
            const lightFactor = 0.95 + dot * 0.25;

            // Apply light factor to color channels
            const newR = Math.min(255, Math.max(0, Math.round(r * lightFactor)));
            const newG = Math.min(255, Math.max(0, Math.round(g * lightFactor)));
            const newB = Math.min(255, Math.max(0, Math.round(b * lightFactor)));
            const colorStr = `rgb(${newR}, ${newG}, ${newB})`;

            ctx.fillStyle = colorStr;
            ctx.strokeStyle = colorStr; // prevent seams between triangles
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

    // Draw overlapping leaf clusters to simulate the 3D dodecahedrons
    // Left cluster
    drawFacetedCluster(centerX - 30, centerY - 35, 45, baseColorHex);
    // Right cluster
    drawFacetedCluster(centerX + 30, centerY - 35, 45, baseColorHex);
    // Top-middle cluster
    drawFacetedCluster(centerX, centerY - 80, 50, baseColorHex);
    // Top-most clusters
    drawFacetedCluster(centerX - 10, centerY - 110, 38, baseColorHex);
    // Top-most right cluster
    drawFacetedCluster(centerX + 15, centerY - 105, 35, baseColorHex);

    const texture = new THREE.CanvasTexture(canvas);
    return texture;
}

function overlapsWithPillarsOrLava(x, z, checkRadius) {
    if (checkAABBOverlap(x, z, checkRadius, state.obstacles, PILLAR_WIDTH / 2)) return true;
    if (checkAABBOverlap(x, z, checkRadius, state.lavaPools, LAVA_POOL_HALF_SIZE)) return true;
    if (x * x + z * z < 625) return true; // check player spawn area (< 25 units squared)
    return false;
}

function overlapsWithFakePillars(x, z, checkRadius) {
    if (!state.fakePillars) return false;
    return checkAABBOverlap(x, z, checkRadius, state.fakePillars, (PILLAR_WIDTH * 1.5) / 2);
}

// Environmental Generation Modular Sub-functions
function createFloor() {
    const floorGeo = new THREE.PlaneGeometry(3500, 3500);
    const grassTex = createGrassTexture();
    const floorMat = new THREE.MeshLambertMaterial({ map: grassTex, color: 0xffffff });
    const floor = new THREE.Mesh(floorGeo, floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true; 
    state.scene.add(floor);
    state.grappleSurfaces.push(floor);
}

function createFakeBillboards() {
    state.fakePillars = [];
    const fakePillarGeo = new THREE.PlaneGeometry(PILLAR_WIDTH * 1.5, 1);
    const fakePillarMat = new THREE.MeshLambertMaterial({ color: 0x483224, side: THREE.DoubleSide });

    for (let i = 0; i < 120; i++) {
        const angle = Math.random() * Math.PI * 2;
        const radius = (MAP_SIZE / 2) + 20 + Math.random() * 1100;
        const x = Math.cos(angle) * radius;
        const z = Math.sin(angle) * radius;
        const height = 20 + Math.random() * (MAX_PILLAR_HEIGHT - 20);

        const mesh = new THREE.Mesh(fakePillarGeo, fakePillarMat);
        mesh.scale.set(1, height, 1);
        mesh.position.set(x, height / 2, z);
        
        state.scene.add(mesh);
        state.fakePillars.push(mesh);
    }

    const fakeLavaGeo = new THREE.BoxGeometry(LAVA_POOL_HALF_SIZE * 2, 0.15, LAVA_POOL_HALF_SIZE * 2);
    const fakeLavaMat = new THREE.MeshBasicMaterial({ color: 0xff3b00 });

    for (let i = 0; i < 80; i++) {
        const angle = Math.random() * Math.PI * 2;
        const radius = (MAP_SIZE / 2) + 20 + Math.random() * 1100;
        const x = Math.cos(angle) * radius;
        const z = Math.sin(angle) * radius;

        const mesh = new THREE.Mesh(fakeLavaGeo, fakeLavaMat);
        mesh.position.set(x, 0.075, z);
        
        state.scene.add(mesh);
    }
}

function createPillars() {
    const dummy = new THREE.Object3D();
    const boxGeo = new THREE.BoxGeometry(PILLAR_WIDTH, 1, PILLAR_WIDTH);
    
    // Generate procedural wood bark and wood ring textures
    const barkTex = createBarkTexture();
    const ringsTex = createRingsTexture();
    
    // Materials for the chopped tree trunk
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
    
    // Multi-material setup for BoxGeometry:
    // Indices 0,1,4,5 are the sides (barkMat).
    // Indices 2,3 are the top/bottom (ringsMat).
    const materials = [
        barkMat,  // +X
        barkMat,  // -X
        ringsMat, // +Y (Top)
        ringsMat, // -Y (Bottom)
        barkMat,  // +Z
        barkMat   // -Z
    ];
    
    const pillarInstanced = new THREE.InstancedMesh(boxGeo, materials, PILLAR_COUNT);
    pillarInstanced.castShadow = true;
    pillarInstanced.receiveShadow = true;

    const colliderMat = new THREE.MeshBasicMaterial();
    // Shared unit box geometry to reduce heap garbage significantly
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
        obstacle.userData.height = height;
        obstacle.userData.halfW = PILLAR_WIDTH / 2;
        obstacle.userData.halfD = PILLAR_WIDTH / 2;
        obstacle.userData.halfH = height / 2;
        obstacle.visible = false; 
        state.scene.add(obstacle);
        state.obstacles.push(obstacle);
        state.grappleSurfaces.push(obstacle);
    }
    state.scene.add(pillarInstanced);
}

function createLavaPools() {
    const lavaGeo = new THREE.BoxGeometry(LAVA_POOL_HALF_SIZE * 2, 0.15, LAVA_POOL_HALF_SIZE * 2);
    const lavaMat = new THREE.MeshStandardMaterial({ 
        color: 0xff4500, 
        emissive: 0xff2200, 
        emissiveIntensity: 1.5,
        roughness: 0.5
    });

    for (let i = 0; i < 30; i++) {
        let chainValid = false;
        let squares = [];
        let attempts = 0;

        while (!chainValid && attempts < 100) {
            attempts++;
            squares = [];
            
            let startX, startZ;
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
                state.scene.add(lavaMesh);
                state.lavaPools.push(lavaMesh);
                state.grappleSurfaces.push(lavaMesh);
            }
        }
    }
}

function createBushes() {
    let spawned3DBushes = 0;
    let attempts3D = 0;
    while (spawned3DBushes < BUSH_3D_COUNT && attempts3D < 1000) {
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
            state.scene.add(bush);
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
    while (spawned2DOutside < BUSH_2D_COUNT && attempts2DOutside < 1500) {
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
            state.scene.add(sprite);
            spawned2DOutside++;
        }
    }
}

function createEnemies() {
    const targetGeo = new THREE.BoxGeometry(2, 2, 2);
    const targetMat = new THREE.MeshStandardMaterial({ roughness: 0.2 });

    const barBgGeo = new THREE.PlaneGeometry(1.8, 0.15);
    const barBgMat = new THREE.MeshBasicMaterial({ color: 0x333333, side: THREE.DoubleSide });
    
    // Shared and pre-translated geometry to prevent duplicate heap allocations
    const barFgGeo = new THREE.PlaneGeometry(1.8, 0.15).translate(0.9, 0, 0);
    const barFgMat = new THREE.MeshBasicMaterial({ color: 0x00ffcc, side: THREE.DoubleSide });

    for (let i = 0; i < 16; i++) {
        const targetGroup = new THREE.Group();

        const bodyMesh = new THREE.Mesh(targetGeo, targetMat.clone());
        bodyMesh.castShadow = true;    
        bodyMesh.receiveShadow = true;
        targetGroup.add(bodyMesh);
        targetGroup.userData.bodyMesh = bodyMesh;

        const healthBarGroup = new THREE.Group();
        healthBarGroup.position.y = 1.6;

        const barBg = new THREE.Mesh(barBgGeo, barBgMat);
        healthBarGroup.add(barBg);

        const barFg = new THREE.Mesh(barFgGeo, barFgMat);
        barFg.position.set(-0.9, 0, 0.01);
        healthBarGroup.add(barFg);

        targetGroup.add(healthBarGroup);
        targetGroup.userData.healthBarFg = barFg;
        targetGroup.userData.healthBarBg = barBg;
        targetGroup.userData.healthBarGroup = healthBarGroup;

        respawnTarget(targetGroup);
        state.scene.add(targetGroup);
        state.targets.push(targetGroup);
    }
}

// Creates the complete game floor geometry, instanced pillars, lava pools, 2D billboard environment and spawns enemies.
export function createEnvironment() {
    if (!state.scene) return;

    createFloor();
    createFakeBillboards();
    createPillars();
    createLavaPools();
    createBushes();
    createEnemies();
}

export function updateTargets(delta) {
    const targetsLen = state.targets.length;
    for (let i = 0; i < targetsLen; i++) {
        const target = state.targets[i];
        target.userData.bodyMesh.rotation.x += 0.01;
        target.userData.bodyMesh.rotation.y += 0.015;
        if (state.camera) {
            target.userData.healthBarGroup.quaternion.copy(state.camera.quaternion);
        }
    }

    // Update 2D fake billboard pillars to face the player's horizontal position
    if (state.fakePillars && state.controls) {
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
