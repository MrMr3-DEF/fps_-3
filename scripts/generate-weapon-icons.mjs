// Run: node --experimental-strip-types --import ./tests/register.mjs scripts/generate-weapon-icons.mjs
// Flatten the convex component meshes of the production models into static
// side-view SVGs. Runtime HUD rendering needs neither models nor a WebGL pass.
import { readFile, writeFile } from 'node:fs/promises';
import * as THREE from 'three';
import { buildGun, buildShotgun, buildAR, buildSniper, buildMinigun } from '../src/weapons.ts';
import { MechaRockets } from '../src/mechaRockets.ts';

function hull(points) {
    const sorted = [...new Map(points.map(p => [p.join(','), p])).values()].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
    const cross = (a, b, c) => (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
    const half = list => {
        const result = [];
        for (const p of list) { while (result.length >= 2 && cross(result.at(-2), result.at(-1), p) <= 1e-8) result.pop(); result.push(p); }
        return result.slice(0, -1);
    };
    return [...half(sorted), ...half([...sorted].reverse())];
}

function silhouette(meshes, forward) {
    const vertex = new THREE.Vector3();
    const polygons = meshes.map(mesh => {
        mesh.updateWorldMatrix(true, false);
        const positions = mesh.geometry.getAttribute('position'), points = [];
        for (let i = 0; i < positions.count; i++) {
            vertex.fromBufferAttribute(positions, i).applyMatrix4(mesh.matrixWorld);
            points.push([forward * vertex.z * 100, -vertex.y * 100]);
        }
        return hull(points);
    }).filter(points => points.length >= 3);
    const points = polygons.flat();
    const minX = Math.min(...points.map(p => p[0])), minY = Math.min(...points.map(p => p[1]));
    const width = Math.max(...points.map(p => p[0])) - minX, height = Math.max(...points.map(p => p[1])) - minY;
    const number = n => Number(n.toFixed(3));
    const paths = [...new Set(polygons.map(polygon => polygon.map((p, i) => `${i ? 'L' : 'M'}${number(p[0] - minX)} ${number(p[1] - minY)}`).join('') + 'Z'))];
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-0.1 -0.1 ${number(width + 0.2)} ${number(height + 0.2)}" fill="#fff" aria-hidden="true" focusable="false">${paths.map(d => `<path d="${d}"/>`).join('')}</svg>`;
}

const icons = {};
for (const [kind, label, build] of [
    ['PISTOL', 'Pistol', () => buildGun(0xffffff)], ['SHOTGUN', 'Shotgun', buildShotgun],
    ['AR', 'Assault rifle', buildAR], ['SNIPER', 'Sniper rifle', buildSniper], ['MINIGUN', 'Minigun', buildMinigun],
]) {
    const model = build(), meshes = [];
    model.traverseVisible(node => { if (node.isMesh) meshes.push(node); });
    icons[kind] = { label, svg: silhouette(meshes, -1) };
}
const rockets = new MechaRockets();
try {
    // Production rockets contain hull, nose and flame in that order. Only the
    // solid hull/nose belong to the icon; there are no fins on this projectile.
    icons.ROCKET = { label: 'Mecha rocket', svg: silhouette(rockets.group.children[0].children.slice(0, 2), 1) };
} finally { rockets.dispose(); }
icons.STOMP = { label: 'Mecha stomp', svg: (await readFile(new URL('../src/mechaStompIcon.svg', import.meta.url), 'utf8')).trim() };
const source = '// Generated from production geometry by scripts/generate-weapon-icons.mjs.\n' +
    'export const WEAPON_INDICATOR_ICONS = ' + JSON.stringify(icons, null, 4) + ' as const;\n' +
    'export type WeaponIndicatorKind = keyof typeof WEAPON_INDICATOR_ICONS;\n';
await writeFile(new URL('../src/weaponIndicatorIcons.ts', import.meta.url), source);
console.log('Generated seven static weapon silhouettes.');
