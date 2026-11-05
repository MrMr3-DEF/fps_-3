import * as THREE from 'three';
import { KATANA } from './config.js';

const CAPACITY = 384;
// Crossed ribbons have physical width from every viewing angle, unlike WebGL lines.
// All buffers belong to one sword and are reused throughout its lifetime.
export function createKatanaLightning(): THREE.Group {
    const group = new THREE.Group();
    group.name = 'katana-lightning';
    for (const halo of [false, true]) {
        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(CAPACITY * 12 * 3), 3).setUsage(THREE.DynamicDrawUsage));
        geometry.setAttribute('color', new THREE.BufferAttribute(new Float32Array(CAPACITY * 12 * 3), 3).setUsage(THREE.DynamicDrawUsage));
        geometry.setDrawRange(0, 0);
        const material = new THREE.MeshBasicMaterial({ color: 0xffffff, vertexColors: true,
            transparent: true, opacity: halo ? .20 : 1, blending: THREE.AdditiveBlending,
            depthWrite: false, side: THREE.DoubleSide, toneMapped: false });
        const mesh = new THREE.Mesh(geometry, material);
        mesh.name = halo ? 'lightning-halo' : 'lightning-core';
        mesh.frustumCulled = false;
        group.add(mesh);
    }
    group.visible = false;
    return group;
}
function noise(seed: number, time: number): number {
    const frame = Math.floor(time), f = time - frame, smooth = f * f * (3 - 2 * f);
    const hash = (n: number) => { const v = Math.sin(n * 127.1 + seed * 311.7) * 43758.5453; return (v - Math.floor(v)) * 2 - 1; };
    return THREE.MathUtils.lerp(hash(frame), hash(frame + 1), smooth);
}
function center(t: number): number {
    return t <= 1.035 / 1.135 ? .125 * (t * 1.135 / 1.035) ** 2
        : THREE.MathUtils.lerp(.125, .18, (t * 1.135 - 1.035) / .1);
}
function width(t: number): number { return .045 * Math.min(1, (1 - t) / .088); }

export function updateKatanaLightning(group: THREE.Group, charge: number, time: number, gentle: boolean): void {
    // Leave the first 0.3 s visually quiet, then reach the tip at full charge.
    const progress = THREE.MathUtils.clamp((charge - .3) / (KATANA.charge - .3), 0, 1);
    group.visible = progress > 0;
    const clock = gentle ? 0 : time;
    for (let layer = 0; layer < 2; layer++) {
        const mesh = group.children[layer] as THREE.Mesh<THREE.BufferGeometry, THREE.MeshBasicMaterial>;
        const positions = mesh.geometry.getAttribute('position') as THREE.BufferAttribute;
        const colors = mesh.geometry.getAttribute('color') as THREE.BufferAttribute;
        let count = 0;
        mesh.material.opacity = gentle ? (layer ? .055 : .48) : (layer ? .20 : 1);
        const segment = (ax: number, ay: number, az: number, bx: number, by: number, bz: number, size: number, intensity: number) => {
            if (count >= CAPACITY) return;
            const radius = size * (layer ? 5 : 1);
            // Both ribbon planes keep their Y within the charged portion of the blade.
            for (let plane = 0; plane < 2; plane++) {
                const ox = plane === 0 ? radius : 0, oz = plane === 1 ? radius : 0;
                const offset = count * 12 + plane * 6;
                positions.setXYZ(offset, ax - ox, ay, az - oz);
                positions.setXYZ(offset + 1, ax + ox, ay, az + oz);
                positions.setXYZ(offset + 2, bx + ox, by, bz + oz);
                positions.setXYZ(offset + 3, ax - ox, ay, az - oz);
                positions.setXYZ(offset + 4, bx + ox, by, bz + oz);
                positions.setXYZ(offset + 5, bx - ox, by, bz - oz);
                for (let v = 0; v < 6; v++) colors.setXYZ(offset + v, intensity, intensity, intensity);
            }
            count++;
        };
        if (progress > 0) {
            // Longer connected leaders with attached forks overlap in three bands.
            // Bolts share their flash envelope; individual segments never blink apart.
            for (let patch = 0; patch < 24; patch++) {
                const tick = clock * (3 + patch % 5 * .31) + patch * .618;
                const generation = Math.floor(tick), life = tick - generation;
                const seed = patch * 101 + generation * 17;
                const band = Math.floor(patch / 8);
                const anchor = progress * (band + .5) / 3;
                const alpha = gentle ? .6 : .2 + .8 * Math.sin(Math.PI * life) ** .6;
                let ax = 0, ay = 0, az = 0;
                for (let j = 0; j < 9; j++) {
                    const t = band === 2 && j === 8 ? progress
                        : THREE.MathUtils.clamp(anchor + progress * ((j / 8 - .5) * .4 + noise(seed + j * 3, clock * 11) * .012), 0, progress);
                    // Distribute patches around all four faces and corners, without an orbit.
                    const angle = (patch % 8) * Math.PI / 4 + noise(seed + j * 13, clock * 9) * .65;
                    const c = Math.cos(angle), sn = Math.sin(angle), edge = Math.max(Math.abs(c), Math.abs(sn));
                    const x = center(t) + width(t) * c / edge + .012 * c;
                    const y = .165 + t * 1.135;
                    const z = .018 * sn / edge + .012 * sn;
                    if (j) segment(ax, ay, az, x, y, z, .0021, alpha);
                    if (j === 3 || j === 6) {
                        const side = noise(seed + j * 7, clock * 8) > 0 ? 1 : -1;
                        const bx = x - sn * .01 * side;
                        const bz = z + c * .01 * side;
                        const by = Math.max(.165, y - .018 * progress);
                        segment(x, y, z, bx, by, bz, .0013, alpha * .8);
                        segment(bx, by, bz, bx + sn * .006 * side,
                            Math.max(.165, by - .015 * progress), bz - c * .006 * side, .0008, alpha * .5);
                    }
                    ax = x; ay = y; az = z;
                }
            }
            if (!gentle) for (let spark = 0; spark < 20; spark++) {
                const tick = clock * 5.1 + spark * .618, life = tick - Math.floor(tick);
                const seed = spark * 31 + Math.floor(tick) * 13;
                const t = progress * (.5 + .5 * noise(seed, 0));
                const angle = (spark % 8) * Math.PI / 4 + noise(seed + 3, 0) * .3;
                const c = Math.cos(angle), sn = Math.sin(angle), edge = Math.max(Math.abs(c), Math.abs(sn));
                const offset = .012 + life * .004;
                const x = center(t) + width(t) * c / edge + offset * c;
                const y = .165 + t * 1.135;
                const z = .018 * sn / edge + offset * sn;
                segment(x - .002, y, z, x + .002, y, z, .0008, (1 - life) ** 2);
            }
        }
        mesh.geometry.setDrawRange(0, count * 12);
        positions.needsUpdate = true;
        colors.needsUpdate = true;
    }
}
