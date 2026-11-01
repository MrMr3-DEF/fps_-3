// Preview-only authoring: node --experimental-strip-types --import ./tests/register.mjs scripts/generate-stomp-icon-previews.mjs
import { mkdir, writeFile } from 'node:fs/promises';
import * as THREE from 'three';
import { loadIronmawTestAsset } from '../tests/ironmawTestAsset.ts';

const { scene } = await loadIronmawTestAsset();
scene.updateMatrixWorld(true);
scene.traverse(node => { if (node.isSkinnedMesh) node.skeleton.update(); });
const foot = scene.getObjectByName('M_Foot_L');
const ankle = scene.getObjectByName('M_LowerLeg_L');
if (!foot?.isMesh || !ankle?.isMesh) throw new Error('Ironmaw foot/ankle meshes are missing.');
const bounds = new THREE.Box3().setFromObject(foot, true);
// Include only the ankle edge, using actual skinned geometry rather than
// inventing a human boot. Its top is cropped for a compact HUD silhouette.
const cap = bounds.max.y + (bounds.max.y - bounds.min.y) * 0.55;
const scale = 90 / (bounds.max.z - bounds.min.z);
const vertex = new THREE.Vector3();
const projected = [];

function belowCap(polygon) {
    const clipped = [];
    for (let i = 0; i < polygon.length; i++) {
        const a = polygon[i], b = polygon[(i + 1) % polygon.length];
        const insideA = a.y <= cap, insideB = b.y <= cap;
        if (insideA) clipped.push(a);
        if (insideA !== insideB) {
            const t = (cap - a.y) / (b.y - a.y);
            clipped.push({ z: a.z + (b.z - a.z) * t, y: cap });
        }
    }
    return clipped;
}

for (const mesh of [foot, ankle]) {
    const vertices = [];
    for (let i = 0; i < mesh.geometry.attributes.position.count; i++) {
        mesh.getVertexPosition(i, vertex).applyMatrix4(mesh.matrixWorld);
        vertices.push({ z: vertex.z, y: vertex.y });
    }
    const index = mesh.geometry.index;
    const count = index?.count ?? vertices.length;
    for (let i = 0; i < count; i += 3) {
        const polygon = belowCap([0, 1, 2].map(offset => vertices[index ? index.getX(i + offset) : i + offset]));
        if (polygon.length < 3) continue;
        const area = polygon.reduce((sum, a, n) => {
            const b = polygon[(n + 1) % polygon.length]; return sum + a.z * b.y - b.z * a.y;
        }, 0);
        if (Math.abs(area) < 1e-8) continue;
        // Front/back faces project onto one another with opposite winding.
        // Normalize it so a compound SVG path fills their union, not a wireframe.
        if (area < 0) polygon.reverse();
        projected.push(polygon.map(p => [19 + (p.z - bounds.min.z) * scale, 11 + (cap - p.y) * scale]));
    }
}
if (!projected.length || projected.flat(2).some(n => !Number.isFinite(n))) throw new Error('Invalid foot silhouette.');
const number = n => Number(n.toFixed(3));
const footPath = projected.map(polygon => polygon.map((p, i) => `${i ? 'L' : 'M'}${number(p[0])} ${number(p[1])}`).join('') + 'Z').join('');
const footSvg = `<path d="${footPath}" fill="#fff" stroke="#fff" stroke-width=".12" stroke-linejoin="round"/>`;
const marks = paths => `<path d="${paths}" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="square" stroke-linejoin="miter"/>`;
const variants = {
    A: `<path d="M39 2h3v6h-3zM62 0h3v9h-3zM86 2h3v6h-3z" fill="#fff"/>` + footSvg + marks('M34 57l-5 4M94 57l5 4M48 61h32'),
    B: marks('M36 1l8 7 8-7M76 1l8 7 8-7') + footSvg + marks('M35 58h58'),
    C: footSvg + marks('M25 54l-8 3M43 56l-7 6M64 57v5M85 56l7 6M103 54l8 3'),
};
const destination = new URL('../tests/fixtures/stomp-icons/', import.meta.url);
await mkdir(destination, { recursive: true });
for (const [variant, content] of Object.entries(variants)) {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 64" fill="#fff"><!-- Draft ${variant}: actual Ironmaw M_Foot_L + cropped M_LowerLeg_L. Preview only. -->${content}</svg>\n`;
    await writeFile(new URL(`${variant}.svg`, destination), svg);
}
console.log('Generated three preview-only stomp SVGs from the actual foot and ankle.');
