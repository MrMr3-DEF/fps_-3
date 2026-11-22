import * as THREE from 'three';
import { PILLAR_WIDTH } from './config.js';
import { sampleBiomeBarkColor, sampleBiomeLeafColor, type BiomeWeights } from './biomes.js';
import {
    createBarkTexture,
    createRingsTexture,
    createSculptedFoliageGeometry,
} from './seededScenery.js';

export type MenuForestVariety = 'warm' | 'cool' | 'sand';

export interface MenuForest {
    readonly group: THREE.Group;
    readonly counts: {
        trunks: number;
        branches: number;
        foliage: number;
        varieties: Record<MenuForestVariety, number>;
    };
    update(timeSeconds: number, reducedMotion: boolean): void;
    dispose(): void;
}

const UP = new THREE.Vector3(0, 1, 0);

const BIOME_WEIGHTS: Record<MenuForestVariety, BiomeWeights> = {
    warm: { warm: 1, cool: 0, sand: 0, town: 0 },
    cool: { warm: 0, cool: 1, sand: 0, town: 0 },
    sand: { warm: 0, cool: 0, sand: 1, town: 0 },
};

const MENU_SKY_TOP = new THREE.Color('#55afe0');
const MENU_SKY_MID = new THREE.Color('#83cbed');
const MENU_SKY_BOTTOM = new THREE.Color('#b7e4f7');

const FOG_VERTEX_DECLS = `
varying float vMenuFogDepth;
varying vec4 vMenuClipPos;
`;

const FOG_VERTEX_ASSIGN = `
#include <project_vertex>
vMenuFogDepth = length(mvPosition.xyz);
vMenuClipPos = gl_Position;
`;

const FOG_FRAGMENT_DECLS = `
uniform float uMenuFogNear;
uniform float uMenuFogFar;
uniform vec3 uMenuSkyTop;
uniform vec3 uMenuSkyMid;
uniform vec3 uMenuSkyBottom;
varying float vMenuFogDepth;
varying vec4 vMenuClipPos;
`;

const FOG_FRAGMENT_BLEND = `
#include <fog_fragment>
float menuFogFactor = smoothstep(uMenuFogNear, uMenuFogFar, vMenuFogDepth);
float menuSkyTopDown = clamp(1.0 - (vMenuClipPos.y / max(vMenuClipPos.w, 0.0001) * 0.5 + 0.5), 0.0, 1.0);
vec3 menuFogColor = menuSkyTopDown < 0.58
    ? mix(uMenuSkyTop, uMenuSkyMid, menuSkyTopDown / 0.58)
    : mix(uMenuSkyMid, uMenuSkyBottom, (menuSkyTopDown - 0.58) / 0.42);
gl_FragColor.rgb = mix(gl_FragColor.rgb, menuFogColor, menuFogFactor);
`;

const FOLIAGE_WIND_VERTEX_DECLS = `
attribute float aLeafWeight;
uniform float uWindTime;
`;

const FOLIAGE_WIND_BEGIN_VERTEX = `
#include <begin_vertex>
float windFlex = clamp(aLeafWeight, 0.0, 1.0);
if (uWindTime > 0.0 && windFlex > 0.001) {
    vec3 windWorldPos = transformed;
    #ifdef USE_INSTANCING
        windWorldPos = (instanceMatrix * vec4(transformed, 1.0)).xyz;
    #endif
    float phase = uWindTime * 1.15 + windWorldPos.x * 0.045 + windWorldPos.z * 0.052;
    float swayX = sin(phase) * 0.28 + sin(phase * 2.1 + windWorldPos.y * 0.22) * 0.09;
    float swayY = sin(uWindTime * 1.9 + windWorldPos.x * 0.06 + windWorldPos.z * 0.04) * 0.07;
    float swayZ = cos(phase * 0.85 + 1.4) * 0.22;
    vec3 windOffset = vec3(swayX, swayY, swayZ) * windFlex;
    #ifdef USE_INSTANCING
        vec3 instScale = vec3(
            length(instanceMatrix[0].xyz),
            length(instanceMatrix[1].xyz),
            length(instanceMatrix[2].xyz)
        );
        vec3 axisX = instanceMatrix[0].xyz / max(instScale.x, 0.0001);
        vec3 axisY = instanceMatrix[1].xyz / max(instScale.y, 0.0001);
        vec3 axisZ = instanceMatrix[2].xyz / max(instScale.z, 0.0001);
        transformed += vec3(
            dot(axisX, windOffset),
            dot(axisY, windOffset),
            dot(axisZ, windOffset)
        ) / max(instScale, vec3(0.0001));
    #else
        transformed += windOffset;
    #endif
}
`;

function createMulberry32(seed: number): () => number {
    let state = seed >>> 0;
    return () => {
        state = (state + 0x6d2b79f5) >>> 0;
        let t = Math.imul(state ^ (state >>> 15), 1 | state);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

function injectFogShader(
    material: THREE.Material,
    cacheKey: string,
    windTimeUniform?: { value: number },
): void {
    material.onBeforeCompile = (shader) => {
        shader.uniforms.uMenuFogNear = { value: 20.0 };
        shader.uniforms.uMenuFogFar = { value: 128.0 };
        shader.uniforms.uMenuSkyTop = { value: MENU_SKY_TOP };
        shader.uniforms.uMenuSkyMid = { value: MENU_SKY_MID };
        shader.uniforms.uMenuSkyBottom = { value: MENU_SKY_BOTTOM };

        const vertexHeader = windTimeUniform
            ? `${FOG_VERTEX_DECLS}${FOLIAGE_WIND_VERTEX_DECLS}`
            : FOG_VERTEX_DECLS;

        shader.vertexShader = shader.vertexShader.includes('#include <common>')
            ? shader.vertexShader.replace('#include <common>', `#include <common>${vertexHeader}`)
            : vertexHeader + shader.vertexShader;

        if (windTimeUniform) {
            shader.uniforms.uWindTime = windTimeUniform;
            shader.vertexShader = shader.vertexShader.replace(
                '#include <begin_vertex>',
                FOLIAGE_WIND_BEGIN_VERTEX,
            );
        }

        shader.vertexShader = shader.vertexShader.replace(
            '#include <project_vertex>',
            FOG_VERTEX_ASSIGN,
        );

        shader.fragmentShader = shader.fragmentShader.includes('#include <common>')
            ? shader.fragmentShader.replace('#include <common>', `#include <common>${FOG_FRAGMENT_DECLS}`)
            : FOG_FRAGMENT_DECLS + shader.fragmentShader;

        shader.fragmentShader = shader.fragmentShader.replace(
            '#include <fog_fragment>',
            FOG_FRAGMENT_BLEND,
        );
    };
    material.customProgramCacheKey = () => cacheKey;
    material.needsUpdate = true;
}

interface TreePlacement {
    x: number;
    baseY: number;
    z: number;
    height: number;
    variety: MenuForestVariety;
}

interface DepthBand {
    count: number;
    zMin: number;
    zMax: number;
    xSpan: number;
    baseYMin: number;
    baseYMax: number;
    heightMin: number;
    heightMax: number;
    centerClearance: number;
}

const DEPTH_BANDS: readonly DepthBand[] = [
    {
        count: 9,
        zMin: -36,
        zMax: -20,
        xSpan: 38,
        baseYMin: -18,
        baseYMax: -14,
        heightMin: 18,
        heightMax: 24,
        centerClearance: 6.5,
    },
    {
        count: 13,
        zMin: -72,
        zMax: -38,
        xSpan: 72,
        baseYMin: -28,
        baseYMax: -21,
        heightMin: 24,
        heightMax: 35,
        centerClearance: 0,
    },
    {
        count: 12,
        zMin: -115,
        zMax: -74,
        xSpan: 112,
        baseYMin: -38,
        baseYMax: -29,
        heightMin: 32,
        heightMax: 46,
        centerClearance: 0,
    },
];

const VARIETY_CYCLE: readonly MenuForestVariety[] = ['warm', 'cool', 'sand'];

export function createMenuForest(): MenuForest {
    const random = createMulberry32(0x4d454e55);
    const group = new THREE.Group();
    group.name = 'menu-forest';

    const barkTex = createBarkTexture(random);
    const ringsTex = createRingsTexture(random);

    const uWindTime = { value: 0 };

    const barkMat = new THREE.MeshStandardMaterial({
        map: barkTex,
        roughness: 0.9,
        metalness: 0.1,
    });
    injectFogShader(barkMat, 'menu-forest-bark-fog-v1');

    const ringsMat = new THREE.MeshStandardMaterial({
        map: ringsTex,
        roughness: 0.8,
        metalness: 0.1,
    });
    injectFogShader(ringsMat, 'menu-forest-rings-fog-v1');

    const foliageMat = new THREE.MeshLambertMaterial({
        color: 0xffffff,
        flatShading: true,
    });
    injectFogShader(foliageMat, 'menu-forest-foliage-fog-wind-v1', uWindTime);

    const trunkGeo = new THREE.BoxGeometry(PILLAR_WIDTH, 1, PILLAR_WIDTH);
    const indices = trunkGeo.index!;
    const reordered: number[] = [];
    for (const face of [0, 1, 4, 5, 2, 3]) {
        for (let i = face * 6; i < face * 6 + 6; i++) reordered.push(indices.getX(i));
    }
    trunkGeo.setIndex(reordered);
    trunkGeo.clearGroups();
    trunkGeo.addGroup(0, 24, 0);
    trunkGeo.addGroup(24, 12, 1);

    const branchGeo = new THREE.CylinderGeometry(0.42, 1.0, 1.0, 6);
    const foliageGeo = createSculptedFoliageGeometry();

    const placements: TreePlacement[] = [];
    const varieties: Record<MenuForestVariety, number> = { warm: 0, cool: 0, sand: 0 };
    let varietyCursor = 0;

    for (const band of DEPTH_BANDS) {
        for (let i = 0; i < band.count; i++) {
            const t = (i + 0.2 + random() * 0.6) / band.count;
            let x = (t - 0.5) * 2 * band.xSpan;
            if (band.centerClearance > 0 && Math.abs(x) < band.centerClearance) {
                x = (x >= 0 ? 1 : -1) * (band.centerClearance + random() * 4.5);
            }
            const z = THREE.MathUtils.lerp(band.zMin, band.zMax, random());
            const baseY = THREE.MathUtils.lerp(band.baseYMin, band.baseYMax, random());
            const height = THREE.MathUtils.lerp(band.heightMin, band.heightMax, random());
            const variety = VARIETY_CYCLE[varietyCursor % VARIETY_CYCLE.length];
            varietyCursor++;
            varieties[variety]++;
            placements.push({ x, baseY, z, height, variety });
        }
    }

    const trunkMatrices: THREE.Matrix4[] = [];
    const trunkColors: THREE.Color[] = [];
    const branchMatrices: THREE.Matrix4[] = [];
    const branchColors: THREE.Color[] = [];
    const foliageMatrices: THREE.Matrix4[] = [];
    const foliageColors: THREE.Color[] = [];

    const trunkDummy = new THREE.Object3D();
    const branchDummy = new THREE.Object3D();
    const foliageDummy = new THREE.Object3D();
    const branchDirection = new THREE.Vector3();
    const foliageAxis = new THREE.Vector3();
    const foliageRoll = new THREE.Quaternion();

    function pushBranch(
        baseX: number,
        baseY: number,
        baseZ: number,
        yaw: number,
        tilt: number,
        length: number,
        thickness: number,
        color: THREE.Color,
    ): { dirX: number; dirY: number; dirZ: number } {
        const dirX = Math.sin(tilt) * Math.cos(yaw);
        const dirY = Math.cos(tilt);
        const dirZ = Math.sin(tilt) * Math.sin(yaw);
        branchDirection.set(dirX, dirY, dirZ);
        branchDummy.position.set(
            baseX + (dirX * length) / 2,
            baseY + (dirY * length) / 2,
            baseZ + (dirZ * length) / 2,
        );
        branchDummy.quaternion.setFromUnitVectors(UP, branchDirection);
        branchDummy.scale.set(thickness, length, thickness);
        branchDummy.updateMatrix();
        branchMatrices.push(branchDummy.matrix.clone());
        branchColors.push(color.clone());
        return { dirX, dirY, dirZ };
    }

    function pushFoliage(
        anchorX: number,
        anchorY: number,
        anchorZ: number,
        axisX: number,
        axisY: number,
        axisZ: number,
        scaleRadius: number,
        weights: BiomeWeights,
    ): void {
        foliageAxis.set(axisX, axisY, axisZ).normalize();
        foliageDummy.position.set(anchorX, anchorY, anchorZ);
        foliageDummy.quaternion.setFromUnitVectors(UP, foliageAxis);
        foliageRoll.setFromAxisAngle(foliageAxis, random() * Math.PI * 2);
        foliageDummy.quaternion.premultiply(foliageRoll);
        foliageDummy.scale.set(
            scaleRadius * (0.9 + random() * 0.24),
            scaleRadius * (0.82 + random() * 0.22),
            scaleRadius * (0.9 + random() * 0.24),
        );
        foliageDummy.updateMatrix();
        foliageMatrices.push(foliageDummy.matrix.clone());
        foliageColors.push(sampleBiomeLeafColor(weights, random(), new THREE.Color()));
    }

    for (const tree of placements) {
        const weights = BIOME_WEIGHTS[tree.variety];
        const barkColor = sampleBiomeBarkColor(weights, new THREE.Color());
        const isSand = tree.variety === 'sand';

        trunkDummy.position.set(tree.x, tree.baseY + tree.height / 2, tree.z);
        trunkDummy.rotation.set(0, 0, 0);
        trunkDummy.scale.set(1, tree.height, 1);
        trunkDummy.updateMatrix();
        trunkMatrices.push(trunkDummy.matrix.clone());
        trunkColors.push(barkColor);

        const topY = tree.baseY + tree.height;
        const crownBand = Math.min(9, tree.height * 0.34);
        const primaryCount = 5 + Math.floor(random() * 3);
        const baseAngle = random() * Math.PI * 2;

        for (let b = 0; b < primaryCount; b++) {
            const yaw =
                baseAngle +
                (b / primaryCount) * Math.PI * 2 +
                (random() - 0.5) * ((Math.PI * 1.05) / primaryCount);
            const tilt = THREE.MathUtils.degToRad(34 + random() * 34);
            const length = isSand ? 15 + random() * 9 : 13 + random() * 8;
            const thickness = isSand ? 1.15 + random() * 0.5 : 0.98 + random() * 0.45;
            const branchY = topY - crownBand + random() * Math.max(0.5, crownBand - 0.5);
            const baseRadius = 1.6 + random() * 0.9;
            const branchX = tree.x + Math.cos(yaw) * baseRadius;
            const branchZ = tree.z + Math.sin(yaw) * baseRadius;
            const primaryDir = pushBranch(
                branchX,
                branchY,
                branchZ,
                yaw,
                tilt,
                length,
                thickness,
                barkColor,
            );

            if (!isSand) {
                const midT = 0.58 + random() * 0.2;
                pushFoliage(
                    branchX + primaryDir.dirX * length * midT,
                    branchY + primaryDir.dirY * length * midT,
                    branchZ + primaryDir.dirZ * length * midT,
                    primaryDir.dirX * 0.45,
                    primaryDir.dirY * 0.45 + 0.55,
                    primaryDir.dirZ * 0.45,
                    4.2 + random() * 1.5,
                    weights,
                );
            }

            const subCount = 2 + Math.floor(random() * 2);
            for (let s = 0; s < subCount; s++) {
                const forkT = Math.min(0.92, 0.45 + (s / subCount) * 0.4 + random() * 0.08);
                const forkX = branchX + primaryDir.dirX * length * forkT;
                const forkY = branchY + primaryDir.dirY * length * forkT;
                const forkZ = branchZ + primaryDir.dirZ * length * forkT;
                const side = s % 2 === 0 ? 1 : -1;
                const subYaw =
                    yaw +
                    side * (0.42 + random() * 0.52) +
                    (s === 2 ? (random() - 0.5) * 0.7 : 0);
                const subTilt = THREE.MathUtils.degToRad(34 + random() * 38);
                const subLength = length * (isSand ? 0.48 + random() * 0.24 : 0.42 + random() * 0.22);
                const subThickness = thickness * (isSand ? 0.52 + random() * 0.14 : 0.46 + random() * 0.14);
                const subDir = pushBranch(
                    forkX,
                    forkY,
                    forkZ,
                    subYaw,
                    subTilt,
                    subLength,
                    subThickness,
                    barkColor,
                );

                if (!isSand) {
                    const tipT = 0.84 + random() * 0.1;
                    pushFoliage(
                        forkX + subDir.dirX * subLength * tipT,
                        forkY + subDir.dirY * subLength * tipT,
                        forkZ + subDir.dirZ * subLength * tipT,
                        subDir.dirX * 0.5,
                        subDir.dirY * 0.5 + 0.5,
                        subDir.dirZ * 0.5,
                        4.4 + random() * 1.8,
                        weights,
                    );
                }
            }
        }

        if (!isSand) {
            for (let cap = 0; cap < 2; cap++) {
                const capAngle = random() * Math.PI * 2;
                const capOffset = random() * 2.0;
                pushFoliage(
                    tree.x + Math.cos(capAngle) * capOffset,
                    topY - 1.2 + random() * 1.2,
                    tree.z + Math.sin(capAngle) * capOffset,
                    (random() - 0.5) * 0.25,
                    1.0,
                    (random() - 0.5) * 0.25,
                    5.6 + random() * 1.6,
                    weights,
                );
            }
        }
    }

    function buildInstancedMesh(
        geometry: THREE.BufferGeometry,
        material: THREE.Material | THREE.Material[],
        matrices: THREE.Matrix4[],
        colors: THREE.Color[],
        name: string,
    ): THREE.InstancedMesh {
        const mesh = new THREE.InstancedMesh(geometry, material, matrices.length);
        mesh.name = name;
        mesh.frustumCulled = false;
        for (let i = 0; i < matrices.length; i++) {
            mesh.setMatrixAt(i, matrices[i]);
            mesh.setColorAt(i, colors[i]);
        }
        mesh.instanceMatrix.needsUpdate = true;
        if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
        return mesh;
    }

    const trunkMesh = buildInstancedMesh(
        trunkGeo,
        [barkMat, ringsMat],
        trunkMatrices,
        trunkColors,
        'menu-forest-trunks',
    );
    const branchMesh = buildInstancedMesh(
        branchGeo,
        barkMat,
        branchMatrices,
        branchColors,
        'menu-forest-branches',
    );
    const foliageMesh = buildInstancedMesh(
        foliageGeo,
        foliageMat,
        foliageMatrices,
        foliageColors,
        'menu-forest-foliage',
    );

    group.add(trunkMesh, branchMesh, foliageMesh);

    return {
        group,
        counts: {
            trunks: trunkMatrices.length,
            branches: branchMatrices.length,
            foliage: foliageMatrices.length,
            varieties,
        },
        update(timeSeconds: number, reducedMotion: boolean): void {
            uWindTime.value = reducedMotion ? 0 : timeSeconds;
        },
        dispose(): void {
            trunkMesh.dispose();
            branchMesh.dispose();
            foliageMesh.dispose();
            trunkGeo.dispose();
            branchGeo.dispose();
            foliageGeo.dispose();
            barkMat.dispose();
            ringsMat.dispose();
            foliageMat.dispose();
            barkTex.dispose();
            ringsTex.dispose();
            group.clear();
        },
    };
}
