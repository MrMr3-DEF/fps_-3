import * as THREE from 'three';

/**
 * World-space procedural relief for the shared town, pillar and ground
 * materials. Detail is evaluated from world position so stretched instance
 * boxes and very tall trunks keep one real-world scale instead of inheriting
 * UV density. Every pattern fades with view distance, which keeps distant
 * surfaces from alias-shimmering and avoids extra texture fetches.
 */
export type SurfaceDetailProfile =
    | 'stone'
    | 'gothStone'
    | 'trim'
    | 'gothTrim'
    | 'road'
    | 'plaza'
    | 'roof'
    | 'gothRoof'
    | 'plaster'
    | 'door'
    | 'window'
    | 'water'
    | 'bark'
    | 'rings';

const DETAIL_VERTEX_PARS_GLSL = /* glsl */`
varying vec3 vDetailWorldPos;
varying vec3 vDetailWorldNormal;
varying vec3 vDetailLocalPos;
`;

const DETAIL_BEGIN_VERTEX_GLSL = /* glsl */`
#include <begin_vertex>
vDetailLocalPos = transformed;
vec4 detailWorldPos = vec4( transformed, 1.0 );
vec3 detailObjectNormal = objectNormal;
#ifdef USE_INSTANCING
    detailWorldPos = instanceMatrix * detailWorldPos;
    // Dividing by the squared instance basis lengths applies the inverse
    // transpose, so non-uniform instance scales (wide town boxes, 225 m tall
    // trunks) do not shear the world normal that orients the noise.
    vec3 detailInstanceScaleSq = vec3(
        dot( instanceMatrix[0].xyz, instanceMatrix[0].xyz ),
        dot( instanceMatrix[1].xyz, instanceMatrix[1].xyz ),
        dot( instanceMatrix[2].xyz, instanceMatrix[2].xyz )
    );
    detailObjectNormal = mat3( instanceMatrix ) * ( detailObjectNormal / max( detailInstanceScaleSq, vec3( 1e-6 ) ) );
#endif
vDetailWorldPos = ( modelMatrix * detailWorldPos ).xyz;
vDetailWorldNormal = normalize( mat3( modelMatrix ) * normalize( detailObjectNormal ) );
`;

const DETAIL_COMMON_GLSL = /* glsl */`
varying vec3 vDetailWorldPos;
varying vec3 vDetailWorldNormal;
varying vec3 vDetailLocalPos;

#if !defined( USE_BUMPMAP )
// Same algorithm as three's screen-space bump helper. These materials carry no
// bump texture, so the world-space height field remains the only normal source.
vec3 perturbNormalArb( vec3 surf_pos, vec3 surf_norm, vec2 dHdxy, float faceDirection ) {
    vec3 dPosX = dFdx( surf_pos.xyz );
    vec3 dPosY = dFdy( surf_pos.xyz );
    float lenX = length( dPosX );
    float lenY = length( dPosY );
    if ( lenX < 1e-6 || lenY < 1e-6 ) return surf_norm;
    vec3 vSigmaX = dPosX / lenX;
    vec3 vSigmaY = dPosY / lenY;
    vec3 vN = surf_norm;
    vec3 R1 = cross( vSigmaY, vN );
    vec3 R2 = cross( vN, vSigmaX );
    float fDet = dot( vSigmaX, R1 ) * faceDirection;
    vec3 vGrad = sign( fDet ) * ( dHdxy.x * R1 + dHdxy.y * R2 );
    vec3 perturbed = abs( fDet ) * surf_norm - vGrad;
    float perturbedLen = length( perturbed );
    return perturbedLen > 1e-6 ? perturbed / perturbedLen : surf_norm;
}
#endif

float detailHash21( vec2 p ) {
    p = fract( p * vec2( 123.34, 456.21 ) );
    p += dot( p, p + 45.32 );
    return fract( p.x * p.y );
}

float detailNoise21( vec2 p ) {
    vec2 i = floor( p );
    vec2 f = fract( p );
    vec2 u = f * f * ( 3.0 - 2.0 * f );
    return mix(
        mix( detailHash21( i ), detailHash21( i + vec2( 1.0, 0.0 ) ), u.x ),
        mix( detailHash21( i + vec2( 0.0, 1.0 ) ), detailHash21( i + vec2( 1.0, 1.0 ) ), u.x ),
        u.y
    );
}

float detailFbm21( vec2 p ) {
    return detailNoise21( p ) * 0.62
        + detailNoise21( p * 2.17 + vec2( 13.7, 5.1 ) ) * 0.28
        + detailNoise21( p * 4.31 + vec2( 2.3, 9.4 ) ) * 0.10;
}

vec2 detailPlanarUv( vec3 worldPos, vec3 worldNormal ) {
    vec3 weight = abs( worldNormal );
    if ( weight.y >= weight.x && weight.y >= weight.z ) return worldPos.xz;
    if ( weight.x >= weight.z ) return worldPos.zy;
    return worldPos.xy;
}

float detailNearLod( float viewDist ) { return 1.0 - smoothstep( 14.0, 42.0, viewDist ); }
float detailMidLod( float viewDist ) { return 1.0 - smoothstep( 55.0, 175.0, viewDist ); }
`;

const PROFILE_BODIES: Record<SurfaceDetailProfile, string> = {
    stone: /* glsl */`
        vec2 uv = detailPlanarUv( worldPos, worldNormal );
        float row = floor( uv.y / 1.15 );
        float blockWidth = 2.35;
        vec2 cell = vec2( uv.x / blockWidth + mod( row, 2.0 ) * 0.5, row );
        vec2 blockUv = fract( cell );
        float edge = min( min( blockUv.x * blockWidth, ( 1.0 - blockUv.x ) * blockWidth ),
            min( blockUv.y * 1.15, ( 1.0 - blockUv.y ) * 1.15 ) );
        float dressed = smoothstep( 0.0, 0.075, edge );
        float shade = detailHash21( floor( cell ) );
        float pit = detailFbm21( uv * 26.0 );
        detailHeight = dressed * 0.034 * midLod + ( pit - 0.5 ) * 0.006 * nearLod;
        detailTone = ( shade - 0.5 ) * 0.20 * midLod + ( dressed - 0.88 ) * 0.8 * midLod
            + ( pit - 0.5 ) * 0.09 * nearLod;
        detailRoughness = ( 0.9 - dressed ) * 0.55 * midLod + ( pit - 0.5 ) * 0.22 * nearLod;
    `,
    gothStone: /* glsl */`
        vec2 uv = detailPlanarUv( worldPos, worldNormal );
        float row = floor( uv.y / 0.85 );
        float blockWidth = 1.65;
        vec2 cell = vec2( uv.x / blockWidth + mod( row, 2.0 ) * 0.5, row );
        vec2 blockUv = fract( cell );
        float edge = min( min( blockUv.x * blockWidth, ( 1.0 - blockUv.x ) * blockWidth ),
            min( blockUv.y * 0.85, ( 1.0 - blockUv.y ) * 0.85 ) );
        float dressed = smoothstep( 0.0, 0.055, edge );
        float shade = detailHash21( floor( cell ) );
        float pit = detailFbm21( uv * 30.0 );
        detailHeight = dressed * 0.040 * midLod + ( pit - 0.5 ) * 0.007 * nearLod;
        detailTone = ( shade - 0.5 ) * 0.26 * midLod + ( dressed - 0.9 ) * 0.9 * midLod
            + ( pit - 0.5 ) * 0.12 * nearLod;
        detailRoughness = ( 0.9 - dressed ) * 0.6 * midLod + ( pit - 0.5 ) * 0.24 * nearLod;
    `,
    trim: /* glsl */`
        vec2 uv = detailPlanarUv( worldPos, worldNormal );
        float row = floor( uv.y / 0.9 );
        float blockWidth = 1.4;
        vec2 cell = vec2( uv.x / blockWidth + mod( row, 2.0 ) * 0.5, row );
        vec2 blockUv = fract( cell );
        float edge = min( min( blockUv.x * blockWidth, ( 1.0 - blockUv.x ) * blockWidth ),
            min( blockUv.y * 0.9, ( 1.0 - blockUv.y ) * 0.9 ) );
        float dressed = smoothstep( 0.0, 0.09, edge );
        float shade = detailHash21( floor( cell ) + 4.7 );
        float pit = detailNoise21( uv * 22.0 );
        detailHeight = dressed * 0.020 * midLod + ( pit - 0.5 ) * 0.004 * nearLod;
        detailTone = ( shade - 0.5 ) * 0.16 * midLod + ( dressed - 0.92 ) * 0.7 * midLod
            + ( pit - 0.5 ) * 0.08 * nearLod;
        detailRoughness = ( 0.9 - dressed ) * 0.4 * midLod + ( pit - 0.5 ) * 0.18 * nearLod;
    `,
    gothTrim: /* glsl */`
        vec2 uv = detailPlanarUv( worldPos, worldNormal );
        float row = floor( uv.y / 0.7 );
        float blockWidth = 1.1;
        vec2 cell = vec2( uv.x / blockWidth + mod( row, 2.0 ) * 0.5, row );
        vec2 blockUv = fract( cell );
        float edge = min( min( blockUv.x * blockWidth, ( 1.0 - blockUv.x ) * blockWidth ),
            min( blockUv.y * 0.7, ( 1.0 - blockUv.y ) * 0.7 ) );
        float dressed = smoothstep( 0.0, 0.06, edge );
        float shade = detailHash21( floor( cell ) + 8.3 );
        float pit = detailNoise21( uv * 26.0 );
        detailHeight = dressed * 0.024 * midLod + ( pit - 0.5 ) * 0.004 * nearLod;
        detailTone = ( shade - 0.5 ) * 0.2 * midLod + ( dressed - 0.9 ) * 0.8 * midLod
            + ( pit - 0.5 ) * 0.08 * nearLod;
        detailRoughness = ( 0.9 - dressed ) * 0.45 * midLod + ( pit - 0.5 ) * 0.18 * nearLod;
    `,
    road: /* glsl */`
        vec2 uv = worldPos.xz;
        vec2 cellUv = uv / vec2( 1.5, 1.15 );
        vec2 cell = floor( cellUv );
        vec2 local = fract( cellUv );
        vec2 jitter = vec2( detailHash21( cell ), detailHash21( cell + 17.3 ) ) * 0.32 - 0.16;
        vec2 centered = local - 0.5 - jitter;
        float distanceToEdge = max( abs( centered.x ), abs( centered.y ) );
        float flag = 1.0 - smoothstep( 0.34, 0.46, distanceToEdge );
        float shade = detailHash21( cell );
        float grit = detailFbm21( uv * 18.0 );
        detailHeight = flag * 0.030 * midLod + ( grit - 0.5 ) * 0.007 * nearLod;
        detailTone = ( shade - 0.5 ) * 0.22 * midLod + ( flag - 0.85 ) * 0.7 * midLod
            + ( grit - 0.5 ) * 0.12 * nearLod;
        detailRoughness = ( 0.9 - flag ) * 0.45 * midLod + ( grit - 0.5 ) * 0.2 * nearLod;
    `,
    plaza: /* glsl */`
        vec2 uv = worldPos.xz;
        vec2 rotated = vec2( uv.x * 0.94 - uv.y * 0.34, uv.x * 0.34 + uv.y * 0.94 );
        vec2 cellUv = rotated / vec2( 0.62, 0.54 );
        vec2 cell = floor( cellUv );
        vec2 local = fract( cellUv );
        vec2 jitter = vec2( detailHash21( cell + 2.1 ), detailHash21( cell + 9.4 ) ) * 0.24 - 0.12;
        vec2 centered = local - 0.5 - jitter;
        float cobbleDistance = length( centered * vec2( 1.0, 1.15 ) );
        float cobble = 1.0 - smoothstep( 0.26, 0.4, cobbleDistance );
        float shade = detailHash21( cell + 5.6 );
        float grit = detailNoise21( uv * 24.0 );
        detailHeight = cobble * 0.022 * midLod + ( grit - 0.5 ) * 0.006 * nearLod;
        detailTone = ( shade - 0.5 ) * 0.3 * midLod + ( cobble - 0.8 ) * 0.8 * midLod
            + ( grit - 0.5 ) * 0.12 * nearLod;
        detailRoughness = ( 0.88 - cobble ) * 0.45 * midLod + ( grit - 0.5 ) * 0.2 * nearLod;
    `,
    roof: /* glsl */`
        vec2 uv = detailPlanarUv( worldPos, worldNormal );
        float row = floor( uv.y / 0.42 );
        vec2 tile = vec2( uv.x / 0.52 + mod( row, 2.0 ) * 0.5, row );
        vec2 tileUv = fract( tile );
        float edge = min( min( tileUv.x, 1.0 - tileUv.x ), min( tileUv.y, 1.0 - tileUv.y ) );
        float lift = smoothstep( 0.0, 0.16, edge );
        float shade = detailHash21( floor( tile ) );
        float grit = detailNoise21( uv * 34.0 );
        detailHeight = lift * 0.026 * midLod + ( grit - 0.5 ) * 0.005 * nearLod;
        detailTone = ( shade - 0.5 ) * 0.24 * midLod + ( lift - 0.9 ) * 0.9 * midLod
            + ( grit - 0.5 ) * 0.1 * nearLod;
        detailRoughness = ( 0.88 - lift ) * 0.4 * midLod + ( grit - 0.5 ) * 0.2 * nearLod;
    `,
    gothRoof: /* glsl */`
        vec2 uv = detailPlanarUv( worldPos, worldNormal );
        float row = floor( uv.y / 0.34 );
        vec2 tile = vec2( uv.x / 0.42 + mod( row, 2.0 ) * 0.5, row );
        vec2 tileUv = fract( tile );
        float edge = min( min( tileUv.x, 1.0 - tileUv.x ), min( tileUv.y, 1.0 - tileUv.y ) );
        float lift = smoothstep( 0.0, 0.1, edge );
        float shade = detailHash21( floor( tile ) + 3.3 );
        float grit = detailNoise21( uv * 40.0 );
        detailHeight = lift * 0.018 * midLod + ( grit - 0.5 ) * 0.004 * nearLod;
        detailTone = ( shade - 0.5 ) * 0.30 * midLod + ( lift - 0.9 ) * 0.9 * midLod
            + ( grit - 0.5 ) * 0.1 * nearLod;
        detailRoughness = ( 0.88 - lift ) * 0.45 * midLod + ( grit - 0.5 ) * 0.2 * nearLod;
    `,
    plaster: /* glsl */`
        vec2 uv = detailPlanarUv( worldPos, worldNormal );
        float trowel = detailFbm21( uv * 0.9 + 2.0 );
        float swirl = detailNoise21( uv * 3.3 + trowel * 2.4 );
        float grit = detailNoise21( uv * 38.0 );
        detailHeight = ( trowel - 0.5 ) * 0.05 * midLod + ( grit - 0.5 ) * 0.004 * nearLod;
        detailTone = ( trowel - 0.5 ) * 0.4 * midLod + ( swirl - 0.5 ) * 0.3 * midLod
            + ( grit - 0.5 ) * 0.16 * nearLod;
        detailRoughness = ( 0.5 - swirl ) * 0.3 * midLod + ( grit - 0.5 ) * 0.25 * nearLod;
    `,
    door: /* glsl */`
        vec2 uv = detailPlanarUv( worldPos, worldNormal );
        float plank = floor( uv.x / 0.34 );
        float across = fract( uv.x / 0.34 );
        float groove = smoothstep( 0.0, 0.07, min( across, 1.0 - across ) );
        float fiber = detailNoise21( vec2( uv.x * 42.0, uv.y * 3.2 + plank * 5.3 ) );
        float shade = detailHash21( vec2( plank, 3.7 ) );
        detailHeight = groove * 0.024 * midLod + ( fiber - 0.5 ) * 0.005 * nearLod;
        detailTone = ( shade - 0.5 ) * 0.26 * midLod + ( groove - 0.9 ) * 0.7 * midLod
            + ( fiber - 0.5 ) * 0.25 * nearLod;
        detailRoughness = ( 0.9 - groove ) * 0.4 * midLod + ( fiber - 0.5 ) * 0.25 * nearLod;
    `,
    window: /* glsl */`
        vec2 uv = detailPlanarUv( worldPos, worldNormal );
        vec2 paneUv = uv / vec2( 0.72, 0.86 );
        vec2 cell = floor( paneUv );
        vec2 local = fract( paneUv );
        float edge = min( min( local.x, 1.0 - local.x ), min( local.y, 1.0 - local.y ) );
        float bevel = smoothstep( 0.0, 0.09, edge );
        float shade = detailHash21( cell );
        float grain = detailNoise21( uv * 48.0 );
        detailHeight = bevel * 0.014 * midLod + ( grain - 0.5 ) * 0.0025 * nearLod;
        detailTone = ( shade - 0.5 ) * 0.06 * midLod + ( bevel - 0.94 ) * 0.5 * midLod
            + ( grain - 0.5 ) * 0.1 * nearLod;
        detailRoughness = ( 0.88 - bevel ) * 0.3 * midLod + ( grain - 0.5 ) * 0.18 * nearLod;
    `,
    water: /* glsl */`
        vec2 uv = worldPos.xz;
        float flowA = dot( uv, vec2( 1.7, 0.9 ) ) * 2.1 + detailNoise21( uv * 0.7 ) * 3.0;
        float flowB = dot( uv, vec2( -0.8, 1.6 ) ) * 1.4 + detailNoise21( uv * 1.3 + 7.0 ) * 4.0;
        float ripple = sin( flowA ) * 0.6 + sin( flowB ) * 0.4;
        float chop = detailNoise21( uv * 7.0 ) - 0.5;
        detailHeight = ripple * 0.02 * midLod + chop * 0.006 * nearLod;
        detailTone = ripple * 0.12 * midLod + chop * 0.12 * nearLod;
        detailRoughness = ripple * 0.35 * midLod + chop * 0.2 * nearLod;
    `,
    bark: /* glsl */`
        vec2 planar = detailPlanarUv( worldPos, worldNormal );
        // Stretch the horizontal frequency and compress vertical spacing so
        // furrows run up the trunk in real-world metres, not in local box UVs.
        vec2 barkUv = vec2( planar.x * 1.1, planar.y * 0.5 );
        float furrow = detailFbm21( vec2( barkUv.x * 5.0, barkUv.y * 1.6 ) );
        float fibre = detailNoise21( vec2( barkUv.x * 26.0, barkUv.y * 12.0 ) );
        float split = abs( detailNoise21( vec2( barkUv.x * 3.1, barkUv.y * 0.8 ) ) - 0.5 ) * 2.0;
        float crease = smoothstep( 0.55, 0.92, split );
        detailHeight = ( ( furrow - 0.5 ) * 0.085 - crease * 0.02 ) * midLod
            + ( fibre - 0.5 ) * 0.012 * nearLod;
        detailTone = ( ( 0.5 - furrow ) * 0.55 - crease * 0.35 ) * midLod
            + ( fibre - 0.5 ) * 0.3 * nearLod;
        detailRoughness = ( ( 0.5 - furrow ) * 0.5 + crease * 0.25 ) * midLod
            + ( fibre - 0.5 ) * 0.25 * nearLod;
    `,
    rings: /* glsl */`
        float radial = length( localPos.xz );
        float ring = sin( radial * 46.0 + detailNoise21( localPos.xz * 5.0 ) * 5.0 );
        float grain = detailNoise21( localPos.xz * 30.0 + localPos.y * 9.0 );
        detailHeight = ring * 0.007 * midLod + ( grain - 0.5 ) * 0.006 * nearLod;
        detailTone = ring * 0.35 * midLod + ( grain - 0.5 ) * 0.25 * nearLod;
        detailRoughness = ring * 0.35 * midLod + ( grain - 0.5 ) * 0.2 * nearLod;
    `,
};

function surfaceSampleGlsl(profile: SurfaceDetailProfile): string {
    return /* glsl */`
void surfaceDetailSample( vec3 worldPos, vec3 worldNormal, vec3 localPos, float nearLod, float midLod,
    out float detailHeight, out float detailTone, out float detailRoughness ) {
    ${PROFILE_BODIES[profile]}
}
`;
}

const DETAIL_COLOR_GLSL = /* glsl */`
#include <color_fragment>
float surfaceDetailViewDist = length( vViewPosition );
float surfaceDetailNearLod = detailNearLod( surfaceDetailViewDist );
float surfaceDetailMidLod = detailMidLod( surfaceDetailViewDist );
float surfaceDetailHeight = 0.0;
float surfaceDetailTone = 0.0;
float surfaceDetailRoughness = 0.0;
surfaceDetailSample(
    vDetailWorldPos,
    normalize( vDetailWorldNormal ),
    vDetailLocalPos,
    surfaceDetailNearLod,
    surfaceDetailMidLod,
    surfaceDetailHeight,
    surfaceDetailTone,
    surfaceDetailRoughness
);
diffuseColor.rgb *= 1.0 + surfaceDetailTone * 0.35;
`;

const DETAIL_ROUGHNESS_GLSL = /* glsl */`
#include <roughnessmap_fragment>
roughnessFactor = clamp( roughnessFactor + surfaceDetailRoughness * 0.16, 0.05, 1.0 );
`;

const DETAIL_NORMAL_GLSL = /* glsl */`
#include <normal_fragment_maps>
{
    float surfaceDetailFootprint = max( fwidth( vDetailWorldPos.x ),
        max( fwidth( vDetailWorldPos.y ), fwidth( vDetailWorldPos.z ) ) );
    // A world-space height gradient per pixel is divided by the pixel's world
    // footprint to recover slope. Detail octaves fade once one pixel spans
    // several centimetres, and the slope is capped so grazing views cannot
    // turn sub-pixel noise into shimmering normal bands.
    vec2 surfaceDetailGradient = vec2( dFdx( surfaceDetailHeight ), dFdy( surfaceDetailHeight ) )
        / max( surfaceDetailFootprint, 0.0001 );
    float surfaceDetailBand = ( 1.0 - smoothstep( 0.03, 0.16, surfaceDetailFootprint ) )
        * ( 0.55 * surfaceDetailNearLod + 0.45 * surfaceDetailMidLod );
    float surfaceDetailSlope = 1.2 * surfaceDetailBand;
    surfaceDetailGradient = clamp( surfaceDetailGradient,
        vec2( -surfaceDetailSlope ), vec2( surfaceDetailSlope ) );
    normal = perturbNormalArb( -vViewPosition, normal, surfaceDetailGradient, faceDirection );
}
`;

/**
 * Injects world-space procedural relief into a standard material. Geometry,
 * textures, repeat values and generated colors stay untouched; only shader
 * shading changes, so seeded world fingerprints remain identical.
 */
export function installSurfaceDetailShader(
    material: THREE.MeshStandardMaterial,
    profile: SurfaceDetailProfile,
): void {
    material.onBeforeCompile = (shader) => {
        shader.vertexShader = shader.vertexShader.replace(
            '#include <common>',
            `#include <common>\n${DETAIL_VERTEX_PARS_GLSL}`,
        );
        shader.vertexShader = shader.vertexShader.replace(
            '#include <begin_vertex>',
            DETAIL_BEGIN_VERTEX_GLSL,
        );
        shader.fragmentShader = shader.fragmentShader.replace(
            '#include <common>',
            `#include <common>\n${DETAIL_COMMON_GLSL}\n${surfaceSampleGlsl(profile)}`,
        );
        shader.fragmentShader = shader.fragmentShader.replace(
            '#include <color_fragment>',
            DETAIL_COLOR_GLSL,
        );
        shader.fragmentShader = shader.fragmentShader.replace(
            '#include <roughnessmap_fragment>',
            DETAIL_ROUGHNESS_GLSL,
        );
        shader.fragmentShader = shader.fragmentShader.replace(
            '#include <normal_fragment_maps>',
            DETAIL_NORMAL_GLSL,
        );
    };
    material.customProgramCacheKey = () => `surface-detail-v1:${profile}`;
    material.needsUpdate = true;
}

/*
 * Composable ground relief for the Lambert grass floor and lava basins.
 * Integration contract:
 *   vertex:  add GROUND_DETAIL_VERTEX_PARS_GLSL to <common>, then
 *            GROUND_DETAIL_VERTEX_GLSL after <begin_vertex>.
 *   fragment: add GROUND_DETAIL_PARS_GLSL to <common>, declare
 *            `vec3 groundDetailBiomeWeights` from the biome map inside the
 *            USE_MAP block, then append GROUND_DETAIL_ALBEDO_GLSL there and
 *            GROUND_DETAIL_NORMAL_GLSL after <normal_fragment_maps>.
 */
export const GROUND_DETAIL_VERTEX_PARS_GLSL = /* glsl */`
varying vec3 vGroundDetailWorldPos;
varying vec3 vGroundDetailWorldNormal;
`;

export const GROUND_DETAIL_VERTEX_GLSL = /* glsl */`
vec4 groundDetailWorldPos = vec4( transformed, 1.0 );
vec3 groundDetailObjectNormal = objectNormal;
#ifdef USE_INSTANCING
    groundDetailWorldPos = instanceMatrix * groundDetailWorldPos;
    vec3 groundDetailScaleSq = vec3(
        dot( instanceMatrix[0].xyz, instanceMatrix[0].xyz ),
        dot( instanceMatrix[1].xyz, instanceMatrix[1].xyz ),
        dot( instanceMatrix[2].xyz, instanceMatrix[2].xyz )
    );
    groundDetailObjectNormal = mat3( instanceMatrix ) * ( groundDetailObjectNormal / max( groundDetailScaleSq, vec3( 1e-6 ) ) );
#endif
vGroundDetailWorldPos = ( modelMatrix * groundDetailWorldPos ).xyz;
vGroundDetailWorldNormal = normalize( mat3( modelMatrix ) * normalize( groundDetailObjectNormal ) );
`;

export const GROUND_DETAIL_PARS_GLSL = /* glsl */`
${GROUND_DETAIL_VERTEX_PARS_GLSL}

#if !defined( USE_BUMPMAP )
vec3 perturbNormalArb( vec3 surf_pos, vec3 surf_norm, vec2 dHdxy, float faceDirection ) {
    vec3 dPosX = dFdx( surf_pos.xyz );
    vec3 dPosY = dFdy( surf_pos.xyz );
    float lenX = length( dPosX );
    float lenY = length( dPosY );
    if ( lenX < 1e-6 || lenY < 1e-6 ) return surf_norm;
    vec3 vSigmaX = dPosX / lenX;
    vec3 vSigmaY = dPosY / lenY;
    vec3 vN = surf_norm;
    vec3 R1 = cross( vSigmaY, vN );
    vec3 R2 = cross( vN, vSigmaX );
    float fDet = dot( vSigmaX, R1 ) * faceDirection;
    vec3 vGrad = sign( fDet ) * ( dHdxy.x * R1 + dHdxy.y * R2 );
    vec3 perturbed = abs( fDet ) * surf_norm - vGrad;
    float perturbedLen = length( perturbed );
    return perturbedLen > 1e-6 ? perturbed / perturbedLen : surf_norm;
}
#endif

float groundDetailHash21( vec2 p ) {
    p = fract( p * vec2( 123.34, 456.21 ) );
    p += dot( p, p + 45.32 );
    return fract( p.x * p.y );
}

float groundDetailNoise21( vec2 p ) {
    vec2 i = floor( p );
    vec2 f = fract( p );
    vec2 u = f * f * ( 3.0 - 2.0 * f );
    return mix(
        mix( groundDetailHash21( i ), groundDetailHash21( i + vec2( 1.0, 0.0 ) ), u.x ),
        mix( groundDetailHash21( i + vec2( 0.0, 1.0 ) ), groundDetailHash21( i + vec2( 1.0, 1.0 ) ), u.x ),
        u.y
    );
}

float groundDetailFbm21( vec2 p ) {
    return groundDetailNoise21( p ) * 0.62
        + groundDetailNoise21( p * 2.17 + vec2( 13.7, 5.1 ) ) * 0.28
        + groundDetailNoise21( p * 4.31 + vec2( 2.3, 9.4 ) ) * 0.10;
}

float groundDetailNearLod( float viewDist ) { return 1.0 - smoothstep( 14.0, 42.0, viewDist ); }
float groundDetailMidLod( float viewDist ) { return 1.0 - smoothstep( 55.0, 175.0, viewDist ); }

void groundDetailSample(
    vec3 worldPos,
    vec3 weights,
    float nearLod,
    float midLod,
    out float detailHeight,
    out float detailTone
) {
    vec2 uv = worldPos.xz;
    // The macro breakup has a ~31 m period, above the 14 m ground texture
    // tile, so adjacent copies no longer repeat the same motif.
    float macro = groundDetailFbm21( uv * 0.032 + vec2( 11.3, 4.7 ) );
    float macroFine = groundDetailNoise21( uv * 0.085 + vec2( 3.1, 17.9 ) );

    // Directional wind ripples keep sand reading as dune-carved rather than flat.
    vec2 windDirection = vec2( 0.82, 0.57 );
    float ripplePhase = dot( uv, windDirection ) * 2.7 + macroFine * 4.0;
    float ripple = sin( ripplePhase ) * 0.65
        + sin( dot( uv, vec2( -0.42, 0.91 ) ) * 3.9 + ripplePhase * 0.4 ) * 0.35;
    float grain = groundDetailNoise21( uv * 52.0 ) - 0.5;

    // Tufted grass and moss relief; the sharpened noise edges read as clumps.
    float tuft = abs( groundDetailNoise21( uv * 5.4 ) - 0.5 ) * 2.0;
    float tuftFine = abs( groundDetailNoise21( uv * 12.3 + vec2( 4.3, 9.1 ) ) - 0.5 ) * 2.0;
    float tufts = tuft * 0.65 + tuftFine * 0.35;

    float sandWeight = clamp( weights.b, 0.0, 1.0 );
    float grassWeight = clamp( weights.r + weights.g, 0.0, 1.0 );
    float totalWeight = max( sandWeight + grassWeight, 0.001 );

    float sandHeight = ripple * 0.016 * midLod + grain * 0.008 * nearLod;
    float grassHeight = ( tufts - 0.5 ) * 0.03 * midLod + grain * 0.008 * nearLod;
    float sandTone = ( macro - 0.5 ) * 0.18 + ripple * 0.14 * midLod + grain * 0.22 * nearLod;
    float grassTone = ( macro - 0.5 ) * 0.22 + ( macroFine - 0.5 ) * 0.12
        + ( tufts - 0.5 ) * 0.22 * midLod + grain * 0.16 * nearLod;

    detailHeight = ( sandHeight * sandWeight + grassHeight * grassWeight ) / totalWeight;
    detailTone = ( sandTone * sandWeight + grassTone * grassWeight ) / totalWeight;
}

vec3 groundDetailPerturbNormal(
    vec3 viewPosition,
    vec3 viewNormal,
    vec3 worldPos,
    float height,
    float nearLod,
    float midLod
) {
    float footprint = max( fwidth( worldPos.x ), max( fwidth( worldPos.y ), fwidth( worldPos.z ) ) );
    vec2 gradient = vec2( dFdx( height ), dFdy( height ) ) / max( footprint, 0.0001 );
    float bandLimit = ( 1.0 - smoothstep( 0.03, 0.16, footprint ) )
        * ( 0.45 * nearLod + 0.55 * midLod );
    float slope = 1.1 * bandLimit;
    gradient = clamp( gradient, vec2( -slope ), vec2( slope ) );
    return perturbNormalArb( viewPosition, viewNormal, gradient, gl_FrontFacing ? 1.0 : -1.0 );
}
`;

export const GROUND_DETAIL_ALBEDO_GLSL = /* glsl */`
    float groundDetailNear = groundDetailNearLod( length( vViewPosition ) );
    float groundDetailMid = groundDetailMidLod( length( vViewPosition ) );
    float groundDetailHeightValue = 0.0;
    float groundDetailToneValue = 0.0;
    groundDetailSample(
        vGroundDetailWorldPos,
        groundDetailBiomeWeights,
        groundDetailNear,
        groundDetailMid,
        groundDetailHeightValue,
        groundDetailToneValue
    );
    diffuseColor.rgb *= 1.0 + groundDetailToneValue;
`;

export const GROUND_DETAIL_NORMAL_GLSL = /* glsl */`
    normal = groundDetailPerturbNormal(
        -vViewPosition,
        normal,
        vGroundDetailWorldPos,
        groundDetailHeightValue,
        groundDetailNear,
        groundDetailMid
    );
`;
