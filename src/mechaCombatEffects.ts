import * as THREE from 'three';
import { MECHA_SHIELD_RADIUS } from './config.js';
import { getParticleLimit, scaleParticleCount } from './settings.js';
import { state } from './state.js';
import type { Vec3Like } from './gameplayMath.js';
import type { ShieldPhase } from './mechaCombat.js';

interface CombatView {
    time: number; orbPosition: THREE.Vector3; orbRadius: number; charging: boolean;
    beamOrigin: THREE.Vector3; beamDirection: THREE.Vector3; beamRadius: number; beamLength: number;
    shieldCenter: THREE.Vector3; shieldPhase: ShieldPhase; collapse: number; build: number;
}
const PULSE_COUNT = 8;
const PIXEL_COUNT = 192;
const forward = new THREE.Vector3(0, 0, 1);

/** Fixed meshes and one instance buffer survive every attack. Surface pulses
 * are a bounded shader ring buffer, with no particle lights or timers. */
export class MechaCombatEffects {
    readonly group = new THREE.Group();
    private readonly orb: THREE.Mesh;
    private readonly glow: THREE.Mesh;
    private readonly beam: THREE.Mesh;
    private readonly beamCore: THREE.Mesh;
    private beamDrawCount = 0;
    get beamDraws(): number { return this.beamDrawCount; }
    private readonly shield: THREE.Mesh<THREE.SphereGeometry, THREE.ShaderMaterial>;
    private readonly pixels: THREE.InstancedMesh;
    private readonly pulseDirs = Array.from({ length: PULSE_COUNT }, () => new THREE.Vector3(0, 1, 0));
    private readonly pulseTimes = new Float32Array(PULSE_COUNT).fill(-100);
    private nextPulse = 0;
    private readonly dummy = new THREE.Object3D();
    private readonly direction = new THREE.Vector3();
    constructor() {
        this.group.name = 'Forgotten Mecha combat effects';
        const sphere = new THREE.SphereGeometry(1, 24, 16);
        const cylinder = new THREE.CylinderGeometry(1, 1, 1, 16, 1, true).rotateX(Math.PI / 2);
        const gold = new THREE.MeshBasicMaterial({ color: 0xffd522, transparent: true, opacity: 0.75, depthWrite: false, blending: THREE.AdditiveBlending });
        const core = new THREE.MeshBasicMaterial({ color: 0xfff7a3, transparent: true, opacity: 0.9, depthWrite: false, blending: THREE.AdditiveBlending });
        this.orb = new THREE.Mesh(sphere, gold);
        this.glow = new THREE.Mesh(sphere, core);
        // A hit can put the viewer inside the beam. Outward-only faces vanish
        // there; separate, single-pass materials keep its interior visible
        // without changing the charging orb or doubling transparent draws.
        const beamGold = gold.clone(), beamWhite = core.clone();
        beamGold.side = beamWhite.side = THREE.DoubleSide;
        beamGold.forceSinglePass = beamWhite.forceSinglePass = true;
        this.beam = new THREE.Mesh(cylinder, beamGold);
        this.beamCore = new THREE.Mesh(cylinder, beamWhite);
        this.beam.name = 'Forgotten Mecha laser beam';
        // Contact may be behind the viewer's near plane. These two fixed draws
        // still acknowledge that frame instead of stranding its captured hit.
        this.beam.frustumCulled = this.beamCore.frustumCulled = false;
        this.beam.onAfterRender = () => { this.beamDrawCount++; };
        const shader = new THREE.ShaderMaterial({
            transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending,
            uniforms: { time: { value: 0 }, shieldRadius: { value: MECHA_SHIELD_RADIUS }, pulseDirs: { value: this.pulseDirs }, pulseTimes: { value: this.pulseTimes },
                fullMode: { value: 0 }, collapse: { value: 0 }, build: { value: 0 } },
            vertexShader: `varying vec3 surface; varying vec2 tex; varying vec3 worldPos;
                void main() { surface = position; tex = uv; worldPos = (modelMatrix * vec4(position, 1.0)).xyz;
                    gl_Position = projectionMatrix * viewMatrix * vec4(worldPos, 1.0); }`,
            fragmentShader: `uniform float time; uniform float shieldRadius; uniform vec3 pulseDirs[8]; uniform float pulseTimes[8];
                uniform float fullMode; uniform float collapse; uniform float build;
                varying vec3 surface; varying vec2 tex; varying vec3 worldPos;
                float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
                void main() {
                    vec3 n = normalize(surface); float alpha = 0.0;
                    for (int i = 0; i < 8; i++) {
                        float age = time - pulseTimes[i];
                        if (age >= 0.0 && age < 1.4) {
                            float d = acos(clamp(dot(n, pulseDirs[i]), -1.0, 1.0)) * shieldRadius;
                            float wave = exp(-pow((d - age * 26.0) / 0.8, 2.0));
                            alpha += (wave * 0.27 + exp(-d * d / 16.0) * 0.16) * (1.0 - age / 1.4);
                        }
                    }
                    float fresnel = pow(1.0 - abs(dot(n, normalize(cameraPosition - worldPos))), 2.0);
                    if (fullMode > 0.5 && fullMode < 1.5) {
                        if (hash(floor(tex * vec2(52.0, 26.0))) < collapse) discard;
                        alpha += 0.07 + fresnel * 0.10;
                    }
                    if (fullMode > 1.5) {
                        float height = (n.y + 1.0) * 0.5;
                        if (height > build) discard;
                        alpha += 0.07 + fresnel * 0.10 + exp(-pow((height - build) / 0.025, 2.0)) * 0.3;
                    }
                    if (alpha < 0.002) discard;
                    gl_FragColor = vec4(0.28, 0.73, 1.0, min(alpha, 0.48));
                }`,
        });
        this.shield = new THREE.Mesh(new THREE.SphereGeometry(MECHA_SHIELD_RADIUS, 48, 32), shader);
        this.pixels = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1),
            new THREE.MeshBasicMaterial({ color: 0x70c7ff, transparent: true, opacity: 0.4, depthWrite: false, blending: THREE.AdditiveBlending }), PIXEL_COUNT);
        this.pixels.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
        this.pixels.frustumCulled = false;
        this.group.add(this.orb, this.glow, this.beam, this.beamCore, this.shield, this.pixels);
        for (const child of this.group.children) child.visible = false;
    }
    shieldImpact(point: Vec3Like, center: THREE.Vector3, time: number): void {
        this.pulseDirs[this.nextPulse].set(point.x - center.x, point.y - center.y, point.z - center.z).normalize();
        this.pulseTimes[this.nextPulse] = time;
        this.nextPulse = (this.nextPulse + 1) % PULSE_COUNT;
    }
    update(view: CombatView): void {
        this.orb.visible = this.glow.visible = view.orbRadius > 0;
        this.orb.position.copy(view.orbPosition); this.glow.position.copy(view.orbPosition);
        this.orb.scale.setScalar(view.orbRadius); this.glow.scale.setScalar(view.orbRadius * 0.55);
        this.beam.visible = this.beamCore.visible = view.beamRadius > 0 && view.beamLength > 0;
        this.beam.position.copy(view.beamOrigin).addScaledVector(view.beamDirection, view.beamLength / 2);
        this.beam.quaternion.setFromUnitVectors(forward, view.beamDirection);
        this.beam.scale.set(view.beamRadius, view.beamRadius, view.beamLength);
        this.beamCore.position.copy(this.beam.position); this.beamCore.quaternion.copy(this.beam.quaternion);
        this.beamCore.scale.set(view.beamRadius * 0.45, view.beamRadius * 0.45, view.beamLength);
        const collapsing = view.shieldPhase === 'down' && view.collapse < 1;
        const rebuilding = view.shieldPhase === 'rebuilding';
        let hasPulse = false;
        for (const time of this.pulseTimes) if (view.time - time >= 0 && view.time - time < 1.4) hasPulse = true;
        // The normally invisible shield issues no draw at all until an impact
        // or transition needs it. Physics protection is independent of this.
        this.shield.visible = collapsing || rebuilding || hasPulse && (view.shieldPhase === 'powered' || view.shieldPhase === 'warning');
        this.shield.position.copy(view.shieldCenter);
        const uniforms = this.shield.material.uniforms;
        uniforms.time.value = view.time; uniforms.fullMode.value = collapsing ? 1 : rebuilding ? 2 : 0;
        uniforms.collapse.value = view.collapse; uniforms.build.value = view.build;
        const budget = Math.max(0, getParticleLimit() - state.activeParticles.length);
        const count = Math.min(budget, scaleParticleCount(collapsing ? PIXEL_COUNT : 48), PIXEL_COUNT);
        this.pixels.visible = count > 0 && (collapsing || view.charging && view.orbRadius > 0);
        this.pixels.count = this.pixels.visible ? count : 0;
        (this.pixels.material as THREE.MeshBasicMaterial).color.setHex(collapsing ? 0x70c7ff : 0xffd522);
        (this.pixels.material as THREE.MeshBasicMaterial).opacity = collapsing ? 0.4 * (1 - view.collapse) : 0.85;
        for (let i = 0; i < this.pixels.count; i++) {
            const y = 1 - 2 * (i + 0.5) / count;
            const angle = i * 2.3999632297 + (collapsing ? 0 : view.time * (1.5 + i % 4 * 0.2));
            const horizontal = Math.sqrt(1 - y * y);
            this.direction.set(Math.cos(angle) * horizontal, y, Math.sin(angle) * horizontal);
            this.dummy.position.copy(collapsing ? view.shieldCenter : view.orbPosition)
                .addScaledVector(this.direction, collapsing ? MECHA_SHIELD_RADIUS : view.orbRadius * (1.35 + i % 3 * 0.15));
            if (collapsing) this.dummy.position.y -= view.collapse * view.collapse * (5 + i % 7);
            this.dummy.rotation.set(angle, angle * 0.7, angle * 0.3);
            this.dummy.scale.setScalar(collapsing ? (0.35 + i % 3 * 0.16) * (1 - view.collapse) : 0.08 + view.orbRadius * 0.035);
            this.dummy.updateMatrix(); this.pixels.setMatrixAt(i, this.dummy.matrix);
        }
        if (this.pixels.count) this.pixels.instanceMatrix.needsUpdate = true;
    }
    dispose(): void {
        this.group.removeFromParent();
        const geometries = new Set<THREE.BufferGeometry>(), materials = new Set<THREE.Material>();
        this.group.traverse(object => {
            if (object instanceof THREE.Mesh) {
                geometries.add(object.geometry);
                for (const material of Array.isArray(object.material) ? object.material : [object.material]) materials.add(material);
            }
        });
        this.pixels.dispose(); geometries.forEach(value => value.dispose()); materials.forEach(value => value.dispose());
    }
}
