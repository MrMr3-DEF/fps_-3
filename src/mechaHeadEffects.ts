import * as THREE from 'three';

/** A single bounded capture and quad simulate bad video reception. World clocks
 * keep running: held pictures are intentional, not JavaScript/GPU stalls. */
export class MechaHeadEffects {
    private readonly target = new THREE.WebGLRenderTarget(32, 32);
    private readonly scene = new THREE.Scene();
    private readonly camera = new THREE.Camera();
    private readonly size = new THREE.Vector2();
    private captureStep = -1;
    private disposed = false;
    private readonly material = new THREE.ShaderMaterial({
        uniforms: { picture: { value: this.target.texture }, progress: { value: 0 } },
        depthTest: false, depthWrite: false,
        vertexShader: 'varying vec2 screenUv; void main() { screenUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }',
        fragmentShader: `
            uniform sampler2D picture;
            uniform float progress;
            varying vec2 screenUv;
            float hash(float n) { return fract(sin(n * 17.17 + 1.3) * 43758.5453); }
            void main() {
                float frame = floor(progress * 9.0);
                float band = floor(screenUv.y * 8.0 + frame * .37);
                float noise = hash(band + frame * 31.0);
                float strength = 1.0 - smoothstep(.65, 1.0, progress);
                vec2 source = screenUv;
                source.x += (noise - .5) * .24 * strength;
                vec3 color = texture2D(picture, clamp(source, .001, .999)).rgb;
                float connected = step(noise, mix(.2, 1.0, smoothstep(0.0, .85, progress)));
                color = mix(vec3(.025, .009, .001), color, connected);
                float tear = step(.96, fract(screenUv.y * 8.0 + frame * .37));
                color += vec3(.32, .105, .008) * tear * strength;
                gl_FragColor = vec4(color, 1.0);
                #include <tonemapping_fragment>
                #include <colorspace_fragment>
            }`,
    });
    private readonly quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.material);
    constructor() { this.quad.frustumCulled = false; this.scene.add(this.quad); }
    async prepare(renderer: THREE.WebGLRenderer): Promise<void> {
        if (this.disposed) return;
        const previous = renderer.getRenderTarget();
        try { renderer.setRenderTarget(this.target); renderer.clear(); }
        finally { renderer.setRenderTarget(previous); }
        await renderer.compileAsync(this.scene, this.camera);
    }
    render(renderer: THREE.WebGLRenderer, scene: THREE.Scene, camera: THREE.Camera, progress: number): void {
        if (this.disposed) { renderer.render(scene, camera); return; }
        const previous = renderer.getRenderTarget();
        renderer.getDrawingBufferSize(this.size);
        const scale = Math.min(1, 1920 / Math.max(this.size.x, this.size.y));
        const width = Math.max(1, Math.round(this.size.x * scale)), height = Math.max(1, Math.round(this.size.y * scale));
        if (width !== this.target.width || height !== this.target.height) { this.target.setSize(width, height); this.captureStep = -1; }
        const step = Math.floor(progress * 3);
        try {
            if (step !== this.captureStep) {
                renderer.setRenderTarget(this.target); renderer.render(scene, camera); this.captureStep = step;
            }
            renderer.setRenderTarget(previous); this.material.uniforms.progress.value = progress;
            renderer.render(this.scene, this.camera);
        } finally { renderer.setRenderTarget(previous); }
    }
    dispose(): void {
        if (this.disposed) return;
        this.disposed = true; this.captureStep = -1;
        this.target.dispose(); this.quad.geometry.dispose(); this.material.dispose(); this.scene.clear();
    }
}
