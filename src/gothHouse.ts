import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import type { TownBuilding } from './town.js';

/** Decorative geometry only; the shell, stepped roof and furniture collide in town.ts. */
export function createGothHouseDecor(b: TownBuilding): THREE.Group {
    const group = new THREE.Group();
    group.name = 'goth house';
    group.position.set(b.x, 0, b.z);
    if (b.doorAxis === 'x') { group.rotation.y = Math.PI / 2; group.scale.x = -1; }
    const w = b.doorAxis === 'x' ? b.depth : b.width;
    const d = b.doorAxis === 'x' ? b.width : b.depth;
    const front = -b.doorSide;
    const materials = {
        iron: new THREE.MeshStandardMaterial({ color: 0x191923, metalness: 0.65, roughness: 0.45 }),
        silver: new THREE.MeshStandardMaterial({ color: 0x9b91ac, metalness: 0.35, roughness: 0.6, side: THREE.DoubleSide }),
        violet: new THREE.MeshStandardMaterial({ color: 0x8839bd, emissive: 0x682091, emissiveIntensity: 0.65, side: THREE.DoubleSide }),
        ruby: new THREE.MeshStandardMaterial({ color: 0x9b254c, emissive: 0x671532, emissiveIntensity: 0.5, side: THREE.DoubleSide }),
        wax: new THREE.MeshStandardMaterial({ color: 0xe6d7b2 }),
        flame: new THREE.MeshBasicMaterial({ color: 0xffbc6b }),
    };
    type Material = keyof typeof materials;
    const buckets = new Map<Material, THREE.BufferGeometry[]>();
    const dummy = new THREE.Object3D();
    const add = (geo: THREE.BufferGeometry, mat: Material, x: number, y: number, z: number, rx = 0, ry = 0, rz = 0) => {
        // Keep one draw call per material, despite the many small ornaments.
        const geometry = geo.index ? geo.toNonIndexed() : geo;
        if (geometry !== geo) geo.dispose();
        dummy.position.set(x, y, z); dummy.rotation.set(rx, ry, rz); dummy.updateMatrix();
        geometry.applyMatrix4(dummy.matrix);
        const list = buckets.get(mat) ?? []; list.push(geometry); buckets.set(mat, list);
    };
    const box = (x: number, y: number, z: number, width: number, height: number, depth: number, mat: Material) =>
        add(new THREE.BoxGeometry(width, height, depth), mat, x, y, z);
    const rod = (a: THREE.Vector3, c: THREE.Vector3, radius: number, mat: Material) => {
        const mid = a.clone().add(c).multiplyScalar(0.5);
        const rotation = new THREE.Euler().setFromQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), c.clone().sub(a).normalize()));
        add(new THREE.CylinderGeometry(radius, radius, a.distanceTo(c), 6), mat, mid.x, mid.y, mid.z, rotation.x, rotation.y, rotation.z);
    };
    const arch = (half: number, height: number) => {
        const shape = new THREE.Shape();
        shape.moveTo(-half, 0); shape.lineTo(half, 0); shape.lineTo(half, height * 0.6);
        shape.quadraticCurveTo(half * 0.85, height * 0.85, 0, height);
        shape.quadraticCurveTo(-half * 0.85, height * 0.85, -half, height * 0.6); shape.closePath();
        return shape;
    };
    // Tall lancet windows on the facade, side walls and inside the room.
    const window = (x: number, y: number, z: number, ry: number) => {
        add(new THREE.ShapeGeometry(arch(1.25, 6)), 'silver', x, y, z, 0, ry);
        const offset = new THREE.Vector3(0, 0.2, 0.035).applyAxisAngle(new THREE.Vector3(0, 1, 0), ry);
        add(new THREE.ShapeGeometry(arch(0.99, 5.5)), 'violet', x + offset.x, y + offset.y, z + offset.z, 0, ry);
        const line = new THREE.Vector3(0, 0, 0.07).applyAxisAngle(new THREE.Vector3(0, 1, 0), ry);
        add(new THREE.BoxGeometry(0.10, 4.5, 0.06), 'iron', x + line.x, y + 2.5, z + line.z, 0, ry);
        add(new THREE.BoxGeometry(1.95, 0.10, 0.06), 'iron', x + line.x, y + 2.5, z + line.z, 0, ry);
    };
    for (const side of [-1, 1]) {
        window(side * w * 0.30, 5.7, front * (d / 2 + 0.035), front === 1 ? 0 : Math.PI);
        for (const along of [-d * 0.26, d * 0.26]) {
            window(side * (w / 2 + 0.035), 5, along, side * Math.PI / 2);
            window(side * (w / 2 - 0.735), 4, along, -side * Math.PI / 2);
        }
    }
    // A pointed door surround above the rectangular, fully open passage.
    const face = front * (d / 2 + 0.20);
    for (const side of [-1, 1]) {
        rod(new THREE.Vector3(side * 2.8, 4.9, face), new THREE.Vector3(0, 8.3, face), 0.18, 'silver');
        box(side * 2.8, 2.45, face, 0.36, 4.9, 0.36, 'silver');
    }
    // Radial rose window on the high gable, framed by an iron wheel.
    add(new THREE.CircleGeometry(1.65, 24), 'ruby', 0, 17.7, front * (d / 2 + 0.04), 0, front === 1 ? 0 : Math.PI);
    add(new THREE.TorusGeometry(1.7, 0.13, 6, 32), 'silver', 0, 17.7, front * (d / 2 + 0.10));
    for (let i = 0; i < 8; i++) {
        const a = i * Math.PI / 4;
        rod(new THREE.Vector3(0, 17.7, front * (d / 2 + 0.13)), new THREE.Vector3(Math.cos(a) * 1.6, 17.7 + Math.sin(a) * 1.6, front * (d / 2 + 0.13)), 0.06, 'iron');
    }
    // Bat-shaped stone grotesques flank the facade under the eaves.
    const wing = new THREE.Shape();
    wing.moveTo(0, 0); wing.lineTo(1.3, 0.8); wing.lineTo(0.95, -0.15);
    wing.lineTo(0.5, 0.03); wing.lineTo(0.3, -0.35); wing.closePath();
    for (const side of [-1, 1]) {
        const x = side * w * 0.30;
        add(new THREE.SphereGeometry(0.3, 8, 6), 'silver', x, 13.4, face);
        for (const mirror of [-1, 1]) {
            const geo = new THREE.ShapeGeometry(wing); geo.scale(mirror, 1, 1);
            add(geo, 'silver', x, 13.4, face, 0, front === 1 ? 0 : Math.PI);
        }
    }
    // Four slender spires, with collars, needles and small metal crosses.
    for (const side of [-1, 1]) for (const end of [-1, 1]) {
        const x = side * (w / 2 - 0.7), z = end * (d / 2 - 0.7);
        add(new THREE.ConeGeometry(1.25, 5, 4), 'iron', x, b.height + 4.5, z, 0, Math.PI / 4);
        add(new THREE.TorusGeometry(0.75, 0.12, 6, 12), 'silver', x, b.height + 2.1, z, Math.PI / 2);
        box(x, b.height + 7.5, z, 0.13, 1.8, 0.13, 'silver');
        box(x, b.height + 7.7, z, 0.8, 0.13, 0.13, 'silver');
    }
    // Ridge cresting and spear-shaped iron finials.
    for (let along = -d / 2 + 1; along < d / 2; along += 2) {
        box(0, b.height + 7.2, along, 0.12, 1.2, 0.12, 'iron');
        add(new THREE.OctahedronGeometry(0.3), 'silver', 0, b.height + 7.9, along);
    }
    // A dark pointed hearth, glowing embers and iron grate inside the room.
    const hearthZ = b.doorSide * (d / 2 - 1.52);
    add(new THREE.ShapeGeometry(arch(1.7, 2.8)), 'iron', 0, 0.25, hearthZ, 0, front === 1 ? 0 : Math.PI);
    for (let i = -1; i <= 1; i++) {
        add(new THREE.ConeGeometry(0.25, 0.85 + (i === 0 ? 0.35 : 0), 6), 'flame', i * 0.5, 0.8, hearthZ + front * 0.08);
        box(i * 0.5, 0.75, hearthZ + front * 0.35, 0.08, 1.1, 0.08, 'iron');
    }
    for (const side of [-1, 1]) {
        const banner = new THREE.Shape(); banner.moveTo(-1, 0); banner.lineTo(0, -0.8); banner.lineTo(1, 0); banner.lineTo(1, 4); banner.lineTo(-1, 4); banner.closePath();
        add(new THREE.ShapeGeometry(banner), 'ruby', side * w * 0.3, 5, b.doorSide * (d / 2 - 0.74), 0, front === 1 ? 0 : Math.PI);
    }
    // Suspended chandelier, candles, writing-desk books and a coffin lid.
    rod(new THREE.Vector3(0, b.height - 0.8, 0), new THREE.Vector3(0, 6.8, 0), 0.06, 'iron');
    add(new THREE.TorusGeometry(2.2, 0.14, 6, 20), 'iron', 0, 6.7, 0, Math.PI / 2);
    const candle = (x: number, y: number, z: number) => {
        add(new THREE.CylinderGeometry(0.12, 0.15, 0.65, 8), 'wax', x, y + 0.325, z);
        add(new THREE.ConeGeometry(0.12, 0.35, 6), 'flame', x, y + 0.82, z);
    };
    for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4; candle(Math.cos(a) * 2.2, 6.7, Math.sin(a) * 2.2); }
    for (const side of [-1, 1]) {
        box(side * (w / 2 - 1), 3, 0, 0.4, 0.2, 1.4, 'iron');
        candle(side * (w / 2 - 1), 3.1, 0);
    }
    for (let i = 0; i < 4; i++) box(w / 2 - 2.4, 1.8 + i * 0.18, b.doorSide * (d / 2 - 3), 1.2 - i * 0.08, 0.16, 0.8, i % 2 ? 'ruby' : 'violet');
    const coffin = new THREE.Shape();
    coffin.moveTo(-0.6, -1.8); coffin.lineTo(0.6, -1.8); coffin.lineTo(1.1, 0.7); coffin.lineTo(0.7, 1.8); coffin.lineTo(-0.7, 1.8); coffin.lineTo(-1.1, 0.7); coffin.closePath();
    add(new THREE.ExtrudeGeometry(coffin, { depth: 0.12, bevelEnabled: false }), 'iron', -w / 2 + 2.4, 1.55, b.doorSide * (d / 2 - 3.4), Math.PI / 2);
    for (const [name, geometries] of buckets) {
        const merged = mergeGeometries(geometries);
        geometries.forEach(geometry => geometry.dispose());
        if (!merged) throw new Error('Unable to batch goth house decorations');
        const mesh = new THREE.Mesh(merged, materials[name]); mesh.castShadow = true; mesh.receiveShadow = true; group.add(mesh);
    }
    return group;
}
