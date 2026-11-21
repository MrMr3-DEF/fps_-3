// Run: node --experimental-strip-types --import ./tests/register.mjs scripts/generate-weapon-icons.mjs
// Project the closed, skinned GLBs in their grip coordinate frame. The HUD
// uses the generated vector paths without loading models or a second renderer.
import { readFile, writeFile } from 'node:fs/promises';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { createCyborgProp, disposeCyborgProp, loadCyborgAssets } from '../src/cyborgAvatar.ts';
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

// Interior edges of two front-facing triangles cancel. Retain the directed
// boundary loops and paint them together with SVG's nonzero winding rule:
// overlapping shells unite and real openings (such as carry handles) stay open.
function fittedSilhouette(model) {
    model.updateMatrixWorld(true);
    const triangles = [], bounds = new THREE.Box2(), v = new THREE.Vector3();
    model.traverseVisible(mesh => {
        if (!mesh.isMesh) return;
        const geo = mesh.geometry;
        const points = Array.from({length: geo.attributes.position.count}, (_, i) => {
            mesh.getVertexPosition(i, v).applyMatrix4(mesh.matrixWorld);
            const point = new THREE.Vector2(-v.z, -v.y);
            bounds.expandByPoint(point);
            return point;
        });
        for (let i = 0; i < (geo.index?.count ?? points.length); i += 3)
            triangles.push([0, 1, 2].map(j => points[geo.index ? geo.index.getX(i+j) : i+j]));
    });

    const scale = 200 / bounds.getSize(new THREE.Vector2()).x;
    const project = p => [Math.round((p.x-bounds.min.x)*scale*10), Math.round((p.y-bounds.min.y)*scale*10)];
    const boundary = new Map();
    function addEdge(from, to) {
        const back = boundary.get(to), count = back?.get(from) ?? 0;
        if (count) {
            if (count === 1) back.delete(from);
            else back.set(from, count-1);
            if (!back.size) boundary.delete(to);
        } else {
            if (!boundary.has(from)) boundary.set(from, new Map());
            const next = boundary.get(from);
            next.set(to, (next.get(to) ?? 0) + 1);
        }
    }
    for (const tri of triangles) {
        const [a,b,c] = tri.map(project);
        if ((b[0]-a[0])*(c[1]-a[1]) <= (c[0]-a[0])*(b[1]-a[1])) continue;
        const keys = [a,b,c].map(p => p.join(','));
        for (let i = 0; i < 3; i++) addEdge(keys[i], keys[(i+1)%3]);
    }
    const paths = [];
    while (boundary.size) {
        const start = boundary.keys().next().value;
        const points = [];
        let from = start;
        do {
            points.push(from.split(',').map(Number));
            const next = boundary.get(from);
            const [to, count] = next.entries().next().value;
            if (count === 1) next.delete(to);
            else next.set(to, count-1);
            if (!next.size) boundary.delete(from);
            from = to;
        } while (from !== start);
        const corners = points.filter((p, i) => {
            const a = points[(i+points.length-1)%points.length], b = points[(i+1)%points.length];
            return (p[0]-a[0])*(b[1]-p[1]) !== (p[1]-a[1])*(b[0]-p[0]);
        });
        if (corners.length >= 3)
            paths.push(corners.map(([x,y], i) => (i ? 'L' : 'M') + x/10 + ' ' + y/10).join('') + 'Z');
    }
    const height = Math.ceil(bounds.getSize(new THREE.Vector2()).y*scale);
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-1 -1 202 ${height+2}" fill="#fff" aria-hidden="true" focusable="false"><path d="${paths.join('')}"/></svg>`;
}

const loader = new GLTFLoader();
await loadCyborgAssets(async url => {
    const bytes = await readFile(new URL(url));
    return loader.parseAsync(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), '');
});
const icons = {};
for (const [kind, label] of Object.entries({
    PISTOL:'Pistol', SHOTGUN:'Shotgun', AR:'Assault rifle', SNIPER:'Sniper rifle', MINIGUN:'Minigun', KATANA:'Katana',
})) {
    const model = createCyborgProp(kind);
    // Muzzles point down -Z in the upright preview frame. The blade extends
    // above its guard, so turn its tip into the wide HUD tile.
    model.rotation.x = kind === 'KATANA' ? -Math.PI + .32 : -Math.PI/2;
    icons[kind] = {label, svg: fittedSilhouette(model)};
    disposeCyborgProp(model);
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
console.log('Generated eight static weapon silhouettes.');
