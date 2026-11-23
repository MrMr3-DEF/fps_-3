import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {
    GROUND_DETAIL_ALBEDO_GLSL,
    GROUND_DETAIL_NORMAL_GLSL,
    GROUND_DETAIL_PARS_GLSL,
    GROUND_DETAIL_VERTEX_GLSL,
    GROUND_DETAIL_VERTEX_PARS_GLSL,
    installSurfaceDetailShader,
    type SurfaceDetailProfile,
} from '../src/surfaceDetail.ts';

const profiles: SurfaceDetailProfile[] = [
    'stone', 'gothStone', 'trim', 'gothTrim', 'road', 'plaza', 'roof', 'gothRoof',
    'plaster', 'door', 'window', 'water', 'bark', 'rings',
];

interface ShaderLike {
    vertexShader: string;
    fragmentShader: string;
    uniforms: Record<string, unknown>;
}

function compileStandard(material: THREE.MeshStandardMaterial): ShaderLike {
    const shader: ShaderLike = {
        vertexShader: THREE.ShaderLib.standard.vertexShader,
        fragmentShader: THREE.ShaderLib.standard.fragmentShader,
        uniforms: {},
    };
    (material.onBeforeCompile as unknown as (shader: ShaderLike) => void)(shader);
    return shader;
}

test('surface detail gives every profile a distinct cache key and a composable shader', () => {
    const cacheKeys = new Set<string>();
    const fragmentShaders = new Set<string>();
    for (const profile of profiles) {
        const map = new THREE.CanvasTexture();
        const material = new THREE.MeshStandardMaterial({
            color: 0x62513f,
            map,
            roughness: 0.86,
            metalness: 0.1,
        });
        installSurfaceDetailShader(material, profile);

        const cacheKey = material.customProgramCacheKey();
        assert.equal(cacheKey, `surface-detail-v1:${profile}`);
        cacheKeys.add(cacheKey);

        // Shading-only installation must not replace authoring values.
        assert.equal(material.color.getHex(), 0x62513f);
        assert.equal(material.map, map);
        assert.equal(material.roughness, 0.86);
        assert.equal(material.metalness, 0.1);

        const shader = compileStandard(material);
        fragmentShaders.add(shader.fragmentShader);

        assert.match(shader.vertexShader, /vDetailWorldPos/);
        assert.match(shader.vertexShader, /vDetailWorldNormal/);
        assert.match(shader.vertexShader, /#ifdef USE_INSTANCING/,
            'instanced town boxes and trunks need real-world scale');
        assert.match(shader.vertexShader, /instanceMatrix/);

        assert.match(shader.fragmentShader, /perturbNormalArb/);
        assert.match(shader.fragmentShader, /dFdx\( surfaceDetailHeight \)/);
        assert.match(shader.fragmentShader, /smoothstep\( 14\.0, 42\.0, viewDist \)/);
        assert.match(shader.fragmentShader, /smoothstep\( 55\.0, 175\.0, viewDist \)/);
        assert.match(shader.fragmentShader, /surfaceDetailSample/);
        assert.match(shader.fragmentShader, /roughnessFactor = clamp\( roughnessFactor/);
        assert.match(shader.fragmentShader, /surfaceDetailViewDist = length\( vViewPosition \)/);
        map.dispose();
    }
    assert.equal(cacheKeys.size, profiles.length);
    assert.equal(fragmentShaders.size, profiles.length, 'each profile injects its own pattern');
});

test('ground detail helpers compose biome-weighted relief with distance LOD', () => {
    assert.match(GROUND_DETAIL_VERTEX_PARS_GLSL, /vGroundDetailWorldPos/);
    assert.match(GROUND_DETAIL_VERTEX_GLSL, /instanceMatrix/);
    assert.match(GROUND_DETAIL_VERTEX_GLSL, /modelMatrix/);
    assert.match(GROUND_DETAIL_PARS_GLSL, /vGroundDetailWorldNormal/);
    assert.match(GROUND_DETAIL_PARS_GLSL, /weights\.b/, 'sand weight drives ripple relief');
    assert.match(GROUND_DETAIL_PARS_GLSL, /weights\.r \+ weights\.g/, 'grass and moss share tufted relief');
    assert.match(GROUND_DETAIL_PARS_GLSL, /smoothstep\( 14\.0, 42\.0, viewDist \)/);
    assert.match(GROUND_DETAIL_PARS_GLSL, /smoothstep\( 55\.0, 175\.0, viewDist \)/);
    assert.match(GROUND_DETAIL_PARS_GLSL, /perturbNormalArb/);
    assert.match(GROUND_DETAIL_PARS_GLSL, /fwidth\( worldPos\.x \)/);
    assert.match(GROUND_DETAIL_ALBEDO_GLSL, /groundDetailBiomeWeights/);
    assert.match(GROUND_DETAIL_ALBEDO_GLSL, /diffuseColor\.rgb/);
    assert.match(GROUND_DETAIL_NORMAL_GLSL, /groundDetailPerturbNormal/);
    assert.match(GROUND_DETAIL_NORMAL_GLSL, /groundDetailHeightValue/);
});
