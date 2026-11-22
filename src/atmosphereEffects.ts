import * as THREE from 'three';
import { ATMOSPHERE, BIOME_FOG_MULTIPLIER, GROUND_VISUAL_SIZE } from './config.js';
import { DAY_NIGHT_CYCLE_SECONDS } from './dayNightCycle.js';

export interface AtmosphereSettings { fog: boolean; motionBlur: boolean }
export interface AtmosphereFrame {
    elapsed: number;
    delta: number;
    blurAllowed: boolean;
    /** Change on discrete camera modes/lives, even when their poses happen to match. */
    cameraKey: string;
    fogMultiplier?: number;
}

/** Camera matrices, never old color frames: resets cannot leak a previous life/view. */
export class AtmosphereHistory {
    readonly previousViewProjection = new THREE.Matrix4();
    private readonly position = new THREE.Vector3();
    private readonly rotation = new THREE.Quaternion();
    private readonly projection = new THREE.Matrix4();
    private valid = false;
    private key = '';
    reset(): void { this.valid = false; }
    advance(camera: THREE.PerspectiveCamera, delta: number, key: string): boolean {
        const continuous = this.valid && key === this.key && delta > 0 && delta < 0.1 &&
            this.position.distanceToSquared(camera.position) < ATMOSPHERE.cutDistance ** 2 &&
            this.rotation.angleTo(camera.quaternion) < ATMOSPHERE.cutAngle &&
            this.projection.elements.every((v, i) => Math.abs(v - camera.projectionMatrix.elements[i]) < 0.00001);
        const moving = this.position.distanceToSquared(camera.position) > 0.000001 || this.rotation.angleTo(camera.quaternion) > 0.00001;
        // The caller copies previousViewProjection before advancing the history.
        this.previousViewProjection.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
        this.position.copy(camera.position); this.rotation.copy(camera.quaternion);
        this.projection.copy(camera.projectionMatrix); this.key = key; this.valid = true;
        return continuous && moving;
    }
}

function noiseTexture(seed: number): THREE.DataTexture {
    const size = ATMOSPHERE.noiseSize, bytes = new Uint8Array(size * size * 4);
    let rng = (seed ^ 0xa341316c) >>> 0;
    for (let i = 0; i < bytes.length; i += 4) {
        rng = (Math.imul(rng, 1664525) + 1013904223) >>> 0;
        bytes[i] = bytes[i + 1] = bytes[i + 2] = rng >>> 24; bytes[i + 3] = 255;
    }
    const texture = new THREE.DataTexture(bytes, size, size);
    texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
    texture.magFilter = texture.minFilter = THREE.LinearFilter;
    texture.generateMipmaps = false; texture.needsUpdate = true;
    return texture;
}

function neutralBiomeTexture(): THREE.DataTexture {
    // A warm, town-free texel keeps the shader at its original 1.0x fog when
    // no world biome map has been supplied.
    const texture = new THREE.DataTexture(new Uint8Array([255, 0, 0, 255]), 1, 1);
    texture.colorSpace = THREE.NoColorSpace;
    texture.wrapS = texture.wrapT = THREE.ClampToEdgeWrapping;
    texture.magFilter = texture.minFilter = THREE.LinearFilter;
    texture.generateMipmaps = false;
    texture.needsUpdate = true;
    return texture;
}

const fragmentShader = `
uniform sampler2D picture, sceneDepth, weather;
uniform sampler2D biomeMap;
uniform mat4 inverseViewProjection, previousViewProjection;
uniform vec3 eye, haze;
uniform vec2 resolution;
uniform float weatherPhase, exposure, nearPlane, farPlane;
uniform bool fogEnabled, blurEnabled;
varying vec2 screenUv;
float viewDepth(float z) { return nearPlane * farPlane / (farPlane - z * (farPlane - nearPlane)); }
float density(vec3 p) {
    vec2 uv = (p.xz + vec2(-weatherPhase * ${ATMOSPHERE.fieldSize.toFixed(1)}, 0.0) + p.y * vec2(1.3, .7)) / ${ATMOSPHERE.fieldSize.toFixed(1)};
    float n = texture2D(weather, uv).r * .7 + texture2D(weather, uv * 2.0 + vec2(.37, .19)).r * .3;
    float height = smoothstep(0.0, ${ATMOSPHERE.altitude.toFixed(1)}, p.y);
    float banks = smoothstep(.32, .75, n + height * .20);
    float holes = smoothstep(.25, .48, n);
    float groundBank = smoothstep(.58, .85, n);
    vec4 bw = texture2D(biomeMap, clamp(p.xz / ${GROUND_VISUAL_SIZE.toFixed(1)} + 0.5, 0.0, 1.0));
    float biomeFog = mix(bw.r * ${BIOME_FOG_MULTIPLIER.warm.toFixed(3)} + bw.g * ${BIOME_FOG_MULTIPLIER.cool.toFixed(3)} + bw.b * ${BIOME_FOG_MULTIPLIER.sand.toFixed(3)}, 1.0, bw.a);
    return holes * (mix(${ATMOSPHERE.groundDensity}, ${ATMOSPHERE.upperDensity}, height) * banks +
        ${ATMOSPHERE.groundBankDensity} * groundBank * groundBank * (1.0 - height * .5)) * biomeFog;
}
void main() {
    float z = texture2D(sceneDepth, screenUv).x;
    vec4 worldH = inverseViewProjection * vec4(screenUv * 2.0 - 1.0, z * 2.0 - 1.0, 1.0);
    vec3 world = worldH.xyz / worldH.w;
    vec3 color = texture2D(picture, screenUv).rgb;
    if (blurEnabled) {
        // Infinite sky has rotation but no parallax from camera translation.
        vec4 oldClip = previousViewProjection * (z > .999999 ? vec4(world - eye, 0.0) : vec4(world, 1.0));
        if (oldClip.w > 0.0) {
            vec2 velocity = (screenUv - (oldClip.xy / oldClip.w * .5 + .5)) * exposure;
            velocity *= smoothstep(2.0, 5.0, viewDepth(z));
            float pixels = length(velocity * resolution);
            velocity *= min(1.0, ${ATMOSPHERE.maxBlurPixels.toFixed(1)} / max(pixels, .001));
            float weight = 1.0;
            for (int i = 1; i < 5; i++) {
                vec2 uv = screenUv - velocity * (float(i) / 4.0);
                if (uv.x <= 0.0 || uv.y <= 0.0 || uv.x >= 1.0 || uv.y >= 1.0) continue;
                float sampleZ = texture2D(sceneDepth, uv).x;
                float accepted = (z > .999999 && sampleZ > .999999) ||
                    abs(viewDepth(sampleZ) - viewDepth(z)) < max(.3, viewDepth(z) * .03) ? 1.0 : 0.0;
                color += texture2D(picture, uv).rgb * accepted; weight += accepted;
            }
            color /= weight;
        }
    }
    if (fogEnabled) {
        vec3 ray = world - eye;
        float distance = min(length(ray), farPlane);
        ray = normalize(ray) * distance;
        float opticalDepth = 0.0;
        // Fixed quadrature over broad banks; no volumetric particle draw calls.
        for (int i = 0; i < 4; i++) {
            float t = (float(i) + .5) / 4.0;
            opticalDepth += density(eye + ray * t) * smoothstep(${ATMOSPHERE.nearFade.toFixed(1)}, ${ATMOSPHERE.farFade.toFixed(1)}, distance * t);
        }
        color = mix(color, haze, 1.0 - exp(-opticalDepth * distance * .25));
    }
    gl_FragColor = vec4(color, 1.0);
    #include <colorspace_fragment>
}`;

/** One scene draw and one composite, shared by fog and camera blur. */
export class AtmosphereEffects {
    readonly history = new AtmosphereHistory();
    private readonly scene = new THREE.Scene();
    private readonly camera = new THREE.Camera();
    private readonly size = new THREE.Vector2();
    private readonly viewport = new THREE.Vector4();
    private readonly scissor = new THREE.Vector4();
    private readonly fallbackFog = new THREE.FogExp2(0xd0dbf0, .002);
    private readonly material: THREE.ShaderMaterial;
    private readonly quad: THREE.Mesh<THREE.PlaneGeometry, THREE.ShaderMaterial>;
    private readonly weather: THREE.DataTexture;
    private readonly neutralBiome: THREE.DataTexture;
    private target: THREE.WebGLRenderTarget | null = null;
    private captureTarget: THREE.WebGLRenderTarget | null = null;
    private targetResized = false;
    private fog = true;
    private blur = true;
    private disposed = false;
    constructor(seed: number) {
        this.weather = noiseTexture(seed);
        this.neutralBiome = neutralBiomeTexture();
        this.material = new THREE.ShaderMaterial({
            depthTest: false, depthWrite: false, toneMapped: false,
            uniforms: {
                picture: { value: null }, sceneDepth: { value: null }, weather: { value: this.weather },
                biomeMap: { value: this.neutralBiome },
                inverseViewProjection: { value: new THREE.Matrix4() }, previousViewProjection: { value: new THREE.Matrix4() },
                eye: { value: new THREE.Vector3() }, haze: { value: new THREE.Color() }, resolution: { value: new THREE.Vector2() },
                weatherPhase: { value: 0 }, exposure: { value: 0 }, nearPlane: { value: .1 }, farPlane: { value: 1500 },
                fogEnabled: { value: true }, blurEnabled: { value: true },
            },
            vertexShader: 'varying vec2 screenUv; void main() { screenUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }',
            fragmentShader,
        });
        this.quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.material);
        this.quad.frustumCulled = false; this.scene.add(this.quad);
    }
    applySettings(settings: AtmosphereSettings): void {
        this.fog = settings.fog; this.blur = settings.motionBlur; this.resetHistory();
        if (!this.fog && !this.blur) this.releaseTarget();
    }
    setBiomeMap(texture: THREE.DataTexture | null): void {
        // The world owns its baked map; this only borrows the binding.
        this.material.uniforms.biomeMap.value = texture ?? this.neutralBiome;
    }
    resetHistory(): void { this.history.reset(); }
    private releaseTarget(): void {
        this.target?.dispose(); this.captureTarget?.dispose(); this.target = this.captureTarget = null;
    }
    private supportsDepth(renderer: THREE.WebGLRenderer): boolean {
        return renderer.capabilities.isWebGL2 || renderer.extensions.has('WEBGL_depth_texture');
    }
    private ensureTarget(renderer: THREE.WebGLRenderer, capture = renderer.getRenderTarget() !== null): THREE.WebGLRenderTarget {
        const output = renderer.getRenderTarget();
        if (capture && output) this.size.set(output.width, output.height); else renderer.getDrawingBufferSize(this.size);
        if (capture) this.size.multiplyScalar(Math.min(1, 1920 / Math.max(this.size.x, this.size.y))).round();
        this.size.x = Math.max(1, this.size.x); this.size.y = Math.max(1, this.size.y);
        const key = capture ? 'captureTarget' : 'target';
        let target = this[key];
        this.targetResized = !target || target.width !== this.size.x || target.height !== this.size.y;
        if (!target) {
            target = this[key] = new THREE.WebGLRenderTarget(this.size.x, this.size.y, {
                depthTexture: new THREE.DepthTexture(this.size.x, this.size.y, THREE.UnsignedIntType),
                samples: renderer.capabilities.isWebGL2 ? Math.min(2, renderer.capabilities.maxSamples) : 0,
            });
            target.texture.generateMipmaps = false;
        } else if (this.targetResized) target.setSize(this.size.x, this.size.y);
        return target;
    }
    async prepare(renderer: THREE.WebGLRenderer): Promise<void> {
        if (this.disposed || (!this.fog && !this.blur) || !this.supportsDepth(renderer)) return;
        renderer.initTexture(this.weather);
        // Allocates framebuffer storage under loading cover, not on the first turn.
        const previous = renderer.getRenderTarget();
        try {
            for (const capture of [false, true]) {
                renderer.setRenderTarget(previous);
                const target = this.ensureTarget(renderer, capture);
                renderer.setRenderTarget(target); renderer.clear();
            }
        }
        finally { renderer.setRenderTarget(previous); }
        await renderer.compileAsync(this.scene, this.camera); this.resetHistory();
    }
    render(renderer: THREE.WebGLRenderer, scene: THREE.Scene, camera: THREE.PerspectiveCamera, frame: AtmosphereFrame): void {
        const previousFog = scene.fog;
        const supported = this.supportsDepth(renderer);
        const fallbackDensity = 0.002 * Math.max(0, frame.fogMultiplier ?? 1);
        this.fallbackFog.density = fallbackDensity;
        // A sand biome can request zero fog; stock fog must then stay absent.
        scene.fog = !this.disposed && this.fog && !supported && fallbackDensity > 0 ? this.fallbackFog : null;
        if (scene.background instanceof THREE.Color) this.fallbackFog.color.copy(scene.background);
        try {
            if (this.disposed || !supported || (!this.fog && !this.blur)) {
                this.resetHistory(); renderer.render(scene, camera); return;
            }
            camera.updateMatrixWorld(true);
            const u = this.material.uniforms;
            u.previousViewProjection.value.copy(this.history.previousViewProjection);
            const moving = this.history.advance(camera, frame.delta, frame.cameraKey);
            let blur = this.blur && frame.blurAllowed && moving;
            if (!frame.blurAllowed) this.resetHistory();
            if (!this.fog && !blur) { renderer.render(scene, camera); return; }
            const target = this.ensureTarget(renderer);
            if (this.targetResized) {
                this.resetHistory(); this.history.advance(camera, frame.delta, frame.cameraKey); blur = false;
            }
            u.picture.value = target.texture; u.sceneDepth.value = target.depthTexture;
            u.inverseViewProjection.value.multiplyMatrices(camera.matrixWorld, camera.projectionMatrixInverse);
            u.eye.value.copy(camera.position); u.resolution.value.copy(this.size);
            u.haze.value.copy(scene.background instanceof THREE.Color ? scene.background : this.fallbackFog.color).multiplyScalar(1.08).addScalar(.002);
            u.weatherPhase.value = ((frame.elapsed / DAY_NIGHT_CYCLE_SECONDS) % 1 + 1) % 1;
            u.exposure.value = Math.min(1, ATMOSPHERE.exposureSeconds / Math.max(frame.delta, .001));
            u.nearPlane.value = camera.near; u.farPlane.value = camera.far;
            u.fogEnabled.value = this.fog; u.blurEnabled.value = blur;
            const previous = renderer.getRenderTarget();
            const autoClear = renderer.autoClear, scissorTest = renderer.getScissorTest();
            renderer.getViewport(this.viewport); renderer.getScissor(this.scissor);
            try {
                renderer.setRenderTarget(target); renderer.setScissorTest(false); renderer.autoClear = true;
                renderer.render(scene, camera);
                renderer.setScissorTest(scissorTest);
                renderer.setRenderTarget(previous);
                renderer.render(this.scene, this.camera);
            } finally {
                renderer.setViewport(this.viewport); renderer.setScissor(this.scissor);
                renderer.setScissorTest(scissorTest); renderer.autoClear = autoClear;
                // Set the target last: its physical viewport differs from the
                // canvas viewport at high DPR and during bounded helmet capture.
                renderer.setRenderTarget(previous);
            }
        } finally { scene.fog = previousFog; }
    }
    dispose(): void {
        if (this.disposed) return;
        this.disposed = true; this.releaseTarget(); this.resetHistory(); this.weather.dispose();
        this.neutralBiome.dispose();
        this.quad.geometry.dispose(); this.material.dispose(); this.scene.clear();
    }
}
