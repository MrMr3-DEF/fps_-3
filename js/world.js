import * as THREE from 'three';
import { state } from './state.js';
import {
    MAP_SIZE,
    PILLAR_COUNT,
    PILLAR_WIDTH,
    MAX_PILLAR_HEIGHT,
    MAX_ENEMY_HEIGHT,
    ENEMY_CLASSES,
    LAVA_POOL_HALF_SIZE
} from './config.js';

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

// Helper to check if a square center (sqX, sqZ) overlaps with any spawned pillar
function overlapsWithPillars(sqX, sqZ) {
    const halfPillar = PILLAR_WIDTH / 2; // 3.0
    const checkDist = LAVA_POOL_HALF_SIZE + halfPillar; // 12.8 + 3.0 = 15.8
    for (let i = 0; i < state.obstacles.length; i++) {
        const obs = state.obstacles[i];
        const dx = Math.abs(sqX - obs.position.x);
        const dz = Math.abs(sqZ - obs.position.z);
        if (dx < checkDist && dz < checkDist) {
            return true;
        }
    }
    return false;
}

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
    drawFacetedCluster(centerX + 15, centerY - 105, 35, baseColorHex);

    const texture = new THREE.CanvasTexture(canvas);
    return texture;
}

function overlapsWithPillarsOrLava(x, z, checkRadius) {
    // 1. Check pillars
    const halfPillar = PILLAR_WIDTH / 2; // 3.0
    for (let i = 0; i < state.obstacles.length; i++) {
        const obs = state.obstacles[i];
        const dx = Math.abs(x - obs.position.x);
        const dz = Math.abs(z - obs.position.z);
        if (dx < halfPillar + checkRadius && dz < halfPillar + checkRadius) {
            return true;
        }
    }

    // 2. Check lava pools
    const halfLava = LAVA_POOL_HALF_SIZE; // 12.8
    for (let i = 0; i < state.lavaPools.length; i++) {
        const pool = state.lavaPools[i];
        const dx = Math.abs(x - pool.position.x);
        const dz = Math.abs(z - pool.position.z);
        if (dx < halfLava + checkRadius && dz < halfLava + checkRadius) {
            return true;
        }
    }

    // 3. Check player spawn area
    const distFromCenter = Math.sqrt(x * x + z * z);
    if (distFromCenter < 25) {
        return true;
    }

    return false;
}

function overlapsWithFakePillars(x, z, checkRadius) {
    if (!state.fakePillars) return false;
    const halfFakePillar = (PILLAR_WIDTH * 1.5) / 2; // 4.5
    for (let i = 0; i < state.fakePillars.length; i++) {
        const pillar = state.fakePillars[i];
        const dx = Math.abs(x - pillar.position.x);
        const dz = Math.abs(z - pillar.position.z);
        if (dx < halfFakePillar + checkRadius && dz < halfFakePillar + checkRadius) {
            return true;
        }
    }
    return false;
}

export function createEnvironment() {
    if (!state.scene) return;

    // Floor Mesh Setup (Extended significantly to look like an unlimited world fading into the fog)
    const floorGeo = new THREE.PlaneGeometry(3500, 3500);
    const grassTex = createGrassTexture();
    const floorMat = new THREE.MeshLambertMaterial({ map: grassTex, color: 0xffffff });
    const floor = new THREE.Mesh(floorGeo, floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true; 
    state.scene.add(floor);
    state.grappleSurfaces.push(floor);

    // Dynamic 2D distant world generation (Pillars and Lava Pools outside the playable area)
    state.fakePillars = [];
    const fakePillarGeo = new THREE.PlaneGeometry(PILLAR_WIDTH * 1.5, 1); // Plane width scaled, height scaled dynamically
    const fakePillarMat = new THREE.MeshLambertMaterial({ color: 0x909aab, side: THREE.DoubleSide }); // Reacts to lighting and fog

    // Generate 120 distant, widely spread 2D billboard pillars
    for (let i = 0; i < 120; i++) {
        const angle = Math.random() * Math.PI * 2;
        const radius = (MAP_SIZE / 2) + 20 + Math.random() * 1100; // From border edge to 1500 units out
        const x = Math.cos(angle) * radius;
        const z = Math.sin(angle) * radius;
        const height = 20 + Math.random() * (MAX_PILLAR_HEIGHT - 20);

        const mesh = new THREE.Mesh(fakePillarGeo, fakePillarMat);
        mesh.scale.set(1, height, 1);
        mesh.position.set(x, height / 2, z); // pivot is center, offset vertically by half height
        
        state.scene.add(mesh);
        state.fakePillars.push(mesh);
    }

    // Generate 80 distant, widely spread 3D thin lava pools (using BoxGeometry to prevent Z-fighting)
    const fakeLavaGeo = new THREE.BoxGeometry(LAVA_POOL_HALF_SIZE * 2, 0.15, LAVA_POOL_HALF_SIZE * 2);
    const fakeLavaMat = new THREE.MeshBasicMaterial({ color: 0xff3b00 }); // Bright, unlit lava color

    for (let i = 0; i < 80; i++) {
        const angle = Math.random() * Math.PI * 2;
        const radius = (MAP_SIZE / 2) + 20 + Math.random() * 1100;
        const x = Math.cos(angle) * radius;
        const z = Math.sin(angle) * radius;

        const mesh = new THREE.Mesh(fakeLavaGeo, fakeLavaMat);
        mesh.position.set(x, 0.075, z); // Center positioned at y = 0.075 so top is at y = 0.15 (above floor)
        
        state.scene.add(mesh);
    }

    // 1) Instanced pillars for excellent draw-call performance - SPAWNED FIRST to allow lava overlap checks
    const dummy = new THREE.Object3D();
    const boxGeo = new THREE.BoxGeometry(PILLAR_WIDTH, 1, PILLAR_WIDTH);
    const boxMat = new THREE.MeshStandardMaterial({ roughness: 0.3 });
    
    const pillarInstanced = new THREE.InstancedMesh(boxGeo, boxMat, PILLAR_COUNT);
    pillarInstanced.castShadow = true;
    pillarInstanced.receiveShadow = true;

    // Invisible collision boxes use a lightweight separate material so that
    // future changes to pillar visuals don't accidentally affect colliders.
    const colliderMat = new THREE.MeshBasicMaterial();

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

        // Keep invisible collision box
        const obstacle = new THREE.Mesh(new THREE.BoxGeometry(PILLAR_WIDTH, height, PILLAR_WIDTH), colliderMat);
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

    // 2) Spawn 30 glowing orange lava pool chains of 1 to 5 connected squares (completely avoiding pillars, using BoxGeometry to prevent Z-fighting)
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
            
            // Choose start position for the chain
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
            
            // Random amount of squares between 1 and 5
            const squareCount = 1 + Math.floor(Math.random() * 5); // 1 to 5
            
            let growthSuccess = true;
            for (let j = 1; j < squareCount; j++) {
                let spotFound = false;
                let spotAttempts = 0;
                
                while (!spotFound && spotAttempts < 30) {
                    spotAttempts++;
                    // Pick a random existing square in the chain
                    const parent = squares[Math.floor(Math.random() * squares.length)];
                    
                    // Pick random cardinal direction
                    const dir = Math.floor(Math.random() * 4);
                    let nextX = parent.x;
                    let nextZ = parent.z;
                    const step = LAVA_POOL_HALF_SIZE * 2; // adjacent placement
                    
                    if (dir === 0) nextX += step; // East
                    else if (dir === 1) nextX -= step; // West
                    else if (dir === 2) nextZ += step; // North
                    else nextZ -= step; // South
                    
                    // Check if already in the chain
                    const duplicate = squares.some(sq => Math.abs(sq.x - nextX) < 1.0 && Math.abs(sq.z - nextZ) < 1.0);
                    if (duplicate) continue;
                    
                    // Check map bounds
                    if (Math.abs(nextX) > (MAP_SIZE / 2 - LAVA_POOL_HALF_SIZE - 10) || 
                        Math.abs(nextZ) > (MAP_SIZE / 2 - LAVA_POOL_HALF_SIZE - 10)) {
                        continue;
                    }
                    
                    // Check player spawn safety
                    if (Math.sqrt(nextX * nextX + nextZ * nextZ) < 30) {
                        continue;
                    }
                    
                    // Check pillar overlap
                    if (overlapsWithPillars(nextX, nextZ)) {
                        continue;
                    }
                    
                    // Valid spot found!
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

        // If we successfully generated a valid chain configuration, instantiate all its squares
        if (chainValid) {
            for (const sq of squares) {
                const lavaMesh = new THREE.Mesh(lavaGeo, lavaMat);
                lavaMesh.position.set(sq.x, 0.075, sq.z); // Center at y = 0.075 so top is at y = 0.15 (above floor)
                state.scene.add(lavaMesh);
                state.lavaPools.push(lavaMesh);
                
                // Lava pools are also grappleable surfaces!
                state.grappleSurfaces.push(lavaMesh);
            }
        }
    }

    // Spawn 3D low poly bushes inside the world border (radius < 330)
    let spawned3DBushes = 0;
    const target3DBushes = 180;
    let attempts3D = 0;
    while (spawned3DBushes < target3DBushes && attempts3D < 1000) {
        attempts3D++;
        const angle = Math.random() * Math.PI * 2;
        const radius = Math.random() * 330;
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

    // Pre-generate 2D low-poly bush textures (one for each of the 5 extra dark green shades)
    const bushGreenShades = [0x153018, 0x1a331c, 0x162c18, 0x0f2010, 0x132815];
    const bush2DTextures = bushGreenShades.map(color => create2DLowPolyBushTexture(color));
    const spriteMaterials = bush2DTextures.map(tex => new THREE.SpriteMaterial({
        map: tex,
        transparent: true,
        color: 0xffffff
    }));

    // Spawn 2D billboard bushes outside the world border (radius between 345 and 1500)
    let spawned2DOutside = 0;
    const target2DOutside = 250;
    let attempts2DOutside = 0;
    while (spawned2DOutside < target2DOutside && attempts2DOutside < 1500) {
        attempts2DOutside++;
        const angle = Math.random() * Math.PI * 2;
        const radius = 345 + Math.random() * 1155; // 345 to 1500
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

    // Spawn 16 enemies
    for (let i = 0; i < 16; i++) {
        const targetGroup = new THREE.Group();

        const targetGeo = new THREE.BoxGeometry(2, 2, 2);
        const targetMat = new THREE.MeshStandardMaterial({ roughness: 0.2 });
        const bodyMesh = new THREE.Mesh(targetGeo, targetMat);
        bodyMesh.castShadow = true;    
        bodyMesh.receiveShadow = true;
        targetGroup.add(bodyMesh);
        targetGroup.userData.bodyMesh = bodyMesh;

        const healthBarGroup = new THREE.Group();
        healthBarGroup.position.y = 1.6;

        const barBgGeo = new THREE.PlaneGeometry(1.8, 0.15);
        const barBgMat = new THREE.MeshBasicMaterial({ color: 0x333333, side: THREE.DoubleSide });
        const barBg = new THREE.Mesh(barBgGeo, barBgMat);
        healthBarGroup.add(barBg);

        const barFgGeo = new THREE.PlaneGeometry(1.8, 0.15);
        barFgGeo.translate(0.9, 0, 0);
        const barFgMat = new THREE.MeshBasicMaterial({ color: 0x00ffcc, side: THREE.DoubleSide });
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

export function updateTargets(delta) {
    state.targets.forEach((target) => {
        target.userData.bodyMesh.rotation.x += 0.01;
        target.userData.bodyMesh.rotation.y += 0.015;
        if (state.camera) {
            target.userData.healthBarGroup.quaternion.copy(state.camera.quaternion);
        }
    });

    // Update 2D fake billboard pillars to face the player's horizontal position
    if (state.fakePillars && state.controls) {
        const playerObj = state.controls.getObject();
        state.fakePillars.forEach((pillar) => {
            pillar.lookAt(playerObj.position.x, pillar.position.y, playerObj.position.z);
        });
    }
}
