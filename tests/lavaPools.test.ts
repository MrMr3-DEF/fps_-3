import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {
    LAVA_PIT_MAX_DEPTH,
    LAVA_POOL_HALF_SIZE,
    LAVA_SURFACE_Y,
    GROUND_VISUAL_SIZE,
} from '../src/config.ts';
import {
    LAVA_LIQUID_SDF_OFFSET,
    LAVA_PIT_BANK_WIDTH,
    LAVA_PIT_MASK_ENCODE_RANGE,
    LAVA_SHAPE_COUNT,
    createLavaPitMaskTexture,
    createLavaShapeGeometries,
    getLavaPitFloorY,
    getLavaPoolDescriptor,
    getLavaShapeBoundRadius,
    isPointInLava,
    sampleLavaPitFloorY,
    sampleLavaPoolSdf,
    sampleLavaShapeSdf,
    setLavaPoolDescriptor,
    type LavaPoolDescriptor,
    type LavaShapeIndex,
} from '../src/lavaPools.ts';

function makePool(shapeIndex: LavaShapeIndex, x = 0, z = 0): { object: THREE.Object3D; desc: LavaPoolDescriptor } {
    const object = new THREE.Object3D();
    object.position.set(x, 0, z);
    const desc: LavaPoolDescriptor = {
        x, z, yaw: 0, shapeIndex, scale: 1,
        boundRadius: getLavaShapeBoundRadius(shapeIndex),
    };
    setLavaPoolDescriptor(object, desc);
    return { object, desc };
}

function findPoint(shapeIndex: LavaShapeIndex, predicate: (sdf: number) => boolean): { x: number; z: number; sdf: number } {
    const bound = getLavaShapeBoundRadius(shapeIndex);
    for (let radius = 0; radius <= bound; radius += 0.05) {
        for (let step = 0; step < 128; step++) {
            const angle = (step / 128) * Math.PI * 2;
            const x = Math.cos(angle) * radius;
            const z = Math.sin(angle) * radius;
            const sdf = sampleLavaShapeSdf(shapeIndex, x, z);
            if (predicate(sdf)) return { x, z, sdf };
        }
    }
    throw new Error(`no matching point for shape ${shapeIndex}`);
}

test('four distinct organic lava shapes vary in bounding radius', () => {
    assert.equal(LAVA_SHAPE_COUNT, 4);
    const radii = Array.from({ length: LAVA_SHAPE_COUNT }, (_, index) =>
        getLavaShapeBoundRadius(index as LavaShapeIndex));
    assert.equal(new Set(radii).size, 4, 'bounds are all distinct');
    for (let index = 1; index < radii.length; index++) {
        assert.ok(radii[index] > radii[index - 1], 'shapes grow with their index');
    }

    const signatures = new Set<string>();
    for (let index = 0; index < LAVA_SHAPE_COUNT; index++) {
        const shapeIndex = index as LavaShapeIndex;
        assert.ok(sampleLavaShapeSdf(shapeIndex, 0, 0) < -0.5, 'pit center is inside the rim');
        signatures.add([
            sampleLavaShapeSdf(shapeIndex, 0, 0),
            sampleLavaShapeSdf(shapeIndex, 3, 0),
            sampleLavaShapeSdf(shapeIndex, -4, 2),
            sampleLavaShapeSdf(shapeIndex, 1, -3),
        ].map(value => value.toFixed(4)).join(','));
    }
    assert.equal(signatures.size, 4, 'no two shapes share the same profile');
});

test('pit floors stay dry outside, reach full depth and remain walkable', () => {
    assert.equal(LAVA_PIT_MAX_DEPTH, 0.8);
    for (let index = 0; index < LAVA_SHAPE_COUNT; index++) {
        const shapeIndex = index as LavaShapeIndex;
        const { desc } = makePool(shapeIndex);
        const outside = desc.boundRadius + 3;
        assert.equal(sampleLavaPitFloorY(desc, outside, 0), 0, 'dry ground outside the rim');
        assert.equal(sampleLavaPitFloorY(desc, 0, outside), 0, 'dry ground outside the rim');

        let lowest = 0;
        let maxSlope = 0;
        const step = 0.1;
        const sampleStep = 0.05;
        for (let angleStep = 0; angleStep < 64; angleStep++) {
            const angle = (angleStep / 64) * Math.PI * 2;
            const dirX = Math.cos(angle);
            const dirZ = Math.sin(angle);
            for (let radius = 0; radius <= desc.boundRadius + 1; radius += step) {
                const x = dirX * radius;
                const z = dirZ * radius;
                const floor = sampleLavaPitFloorY(desc, x, z);
                lowest = Math.min(lowest, floor);
                const dx = (sampleLavaPitFloorY(desc, x + sampleStep, z) -
                    sampleLavaPitFloorY(desc, x - sampleStep, z)) / (sampleStep * 2);
                const dz = (sampleLavaPitFloorY(desc, x, z + sampleStep) -
                    sampleLavaPitFloorY(desc, x, z - sampleStep)) / (sampleStep * 2);
                maxSlope = Math.max(maxSlope, Math.hypot(dx, dz));
            }
        }
        assert.ok(lowest <= -LAVA_PIT_MAX_DEPTH + 1e-6, `shape ${shapeIndex} reaches full depth`);
        assert.ok(maxSlope < 0.45, `shape ${shapeIndex} bank slope ${maxSlope.toFixed(3)} is walkable`);
    }
    assert.ok(Math.abs(LAVA_SURFACE_Y) < LAVA_PIT_MAX_DEPTH);
    assert.ok(LAVA_SURFACE_Y < 0);
    assert.ok(LAVA_PIT_BANK_WIDTH > 0);
});

test('lava contact matches the liquid rim and rejects dry or airborne feet', () => {
    assert.ok(LAVA_LIQUID_SDF_OFFSET > 0);
    for (let index = 0; index < LAVA_SHAPE_COUNT; index++) {
        const shapeIndex = index as LavaShapeIndex;
        const { object, desc } = makePool(shapeIndex);
        assert.deepEqual(getLavaPoolDescriptor(object), desc);

        // The center is molten for every authored shape.
        assert.equal(isPointInLava(0, 0, 0, 0, [object]), true, `shape ${shapeIndex} center is lava`);
        assert.equal(sampleLavaPoolSdf(desc, 0, 0) <= -LAVA_LIQUID_SDF_OFFSET, true);

        const dry = findPoint(shapeIndex, sdf => sdf > -0.85 && sdf < -0.25);
        assert.ok(sampleLavaPitFloorY(desc, dry.x, dry.z) > LAVA_SURFACE_Y, 'bank sits above the lava');
        assert.equal(isPointInLava(dry.x, dry.z, 0, 0, [object]), false, 'dry upper bank is not lava');

        assert.equal(isPointInLava(0, 0, LAVA_SURFACE_Y + 0.251, 0, [object]), false, 'airborne feet clear lava');

        const outside = desc.boundRadius + 2;
        assert.equal(isPointInLava(outside, outside, 0, 0, [object]), false, 'outside the pit is dry');
        assert.equal(getLavaPitFloorY(0, 0, [object]), sampleLavaPitFloorY(desc, 0, 0));
    }

    const legacy = new THREE.Object3D();
    legacy.position.set(40, 0, -20);
    assert.equal(getLavaPoolDescriptor(legacy), undefined);
    assert.equal(isPointInLava(40, -20, 0, 0, [legacy]), true, 'legacy square footprint still contacts');
    assert.equal(isPointInLava(40 + LAVA_POOL_HALF_SIZE + 1, -20, 0, 0.5, [legacy]), false);
    assert.equal(isPointInLava(40, -20, 0.16, 0, [legacy]), false, 'legacy feet above the slab clear it');
});

test('basin and surface meshes are valid for every shape', () => {
    const geometries = createLavaShapeGeometries();
    assert.equal(geometries.length, LAVA_SHAPE_COUNT);
    try {
        for (const [index, geometry] of geometries.entries()) {
            for (const mesh of [geometry.basin, geometry.surface]) {
                const positions = mesh.getAttribute('position') as THREE.BufferAttribute;
                const normals = mesh.getAttribute('normal') as THREE.BufferAttribute;
                assert.ok(positions && positions.count > 100, `shape ${index} mesh has vertices`);
                assert.ok(mesh.getIndex() && mesh.getIndex()!.count >= 6, `shape ${index} mesh has triangles`);
                assert.ok(normals && normals.count === positions.count, `shape ${index} mesh has normals`);
                for (let vertex = 0; vertex < positions.count; vertex++) {
                    if (!Number.isFinite(positions.getX(vertex)) ||
                        !Number.isFinite(positions.getY(vertex)) ||
                        !Number.isFinite(positions.getZ(vertex))) {
                        assert.fail(`shape ${index} has a non-finite vertex`);
                    }
                    assert.ok(normals.getY(vertex) > 0, `shape ${index} vertex ${vertex} normal must face upward (+Y)`);
                }
            }

            const basinPositions = geometry.basin.getAttribute('position') as THREE.BufferAttribute;
            let basinMinY = Infinity;
            let basinMaxY = -Infinity;
            for (let vertex = 0; vertex < basinPositions.count; vertex++) {
                const y = basinPositions.getY(vertex);
                basinMinY = Math.min(basinMinY, y);
                basinMaxY = Math.max(basinMaxY, y);
            }
            assert.ok(basinMinY <= -LAVA_PIT_MAX_DEPTH + 0.01, `shape ${index} basin reaches depth`);
            assert.ok(Math.abs(basinMaxY) < 1e-6, `shape ${index} basin rim meets ground flush at y=0`);
            assert.ok(geometry.basin.getAttribute('color'), `shape ${index} basin has vertex colors`);
            assert.ok(geometry.basin.getAttribute('uv'), `shape ${index} basin has UVs`);

            const surfacePositions = geometry.surface.getAttribute('position') as THREE.BufferAttribute;
            assert.ok(geometry.surface.getAttribute('uv'), `shape ${index} surface has UVs`);
            for (let vertex = 0; vertex < surfacePositions.count; vertex++) {
                assert.ok(Math.abs(surfacePositions.getY(vertex) - LAVA_SURFACE_Y) < 1e-6,
                    `shape ${index} surface is flat`);
            }
        }
    } finally {
        for (const geometry of geometries) {
            geometry.basin.dispose();
            geometry.surface.dispose();
        }
    }
});

test('rotated and scaled pool SDF matches Three.js mesh transforms identically', () => {
    const geometries = createLavaShapeGeometries();
    const dummy = new THREE.Object3D();
    const worldPoint = new THREE.Vector3();
    try {
        for (let index = 0; index < LAVA_SHAPE_COUNT; index++) {
            const shapeIndex = index as LavaShapeIndex;
            const yaw = 0.73 + index * 0.91;
            const scale = 0.92 + index * 0.06;
            const x = 140 - index * 55;
            const z = -90 + index * 40;
            const desc: LavaPoolDescriptor = {
                x, z, yaw, shapeIndex, scale,
                boundRadius: getLavaShapeBoundRadius(shapeIndex, scale),
            };
            dummy.position.set(x, 0, z);
            dummy.rotation.set(0, yaw, 0);
            dummy.scale.set(scale, 1, scale);
            dummy.updateMatrix();

            // Ring index 2 (vertices 256..383) is the exact sdf === 0 rim contour.
            const positions = geometries[index].basin.getAttribute('position') as THREE.BufferAttribute;
            for (let seg = 0; seg < 128; seg += 8) {
                const vertex = 256 + seg;
                worldPoint.fromBufferAttribute(positions, vertex).applyMatrix4(dummy.matrix);
                const sdf = sampleLavaPoolSdf(desc, worldPoint.x, worldPoint.z);
                assert.ok(Math.abs(sdf) < 1e-3, `shape ${index} rotated rim vertex ${seg} stays on sdf=0 (got ${sdf})`);
            }
        }
    } finally {
        for (const geometry of geometries) {
            geometry.basin.dispose();
            geometry.surface.dispose();
        }
    }
});

test('lava pit mask encodes smooth signed distances for interiors, rims and outside pixels', () => {
    const resolution = 1024;
    const pixelSize = GROUND_VISUAL_SIZE / resolution;
    const half = GROUND_VISUAL_SIZE / 2;
    const readPixel = (data: Uint8Array, x: number, z: number): number => {
        const column = Math.floor((x + half) / pixelSize);
        const row = Math.floor((z + half) / pixelSize);
        return data[(row * resolution + column) * 4];
    };
    const decodeSdf = (byte: number): number => (byte / 255 - 0.5) * 2 * LAVA_PIT_MASK_ENCODE_RANGE;

    for (let index = 0; index < LAVA_SHAPE_COUNT; index++) {
        const shapeIndex = index as LavaShapeIndex;
        const { object, desc } = makePool(shapeIndex);
        const texture = createLavaPitMaskTexture([object]);
        try {
            assert.equal(texture.image.width, resolution);
            assert.equal(texture.image.height, resolution);
            assert.equal(texture.wrapS, THREE.ClampToEdgeWrapping);
            assert.equal(texture.wrapT, THREE.ClampToEdgeWrapping);
            assert.equal(texture.minFilter, THREE.LinearFilter);
            assert.equal(texture.generateMipmaps, false);
            assert.equal(texture.flipY, false);

            const data = texture.image.data as Uint8Array;
            const column = resolution / 2;
            const row = resolution / 2;
            const insideX = (column + 0.5) * pixelSize - half;
            const insideZ = (row + 0.5) * pixelSize - half;
            const expectedInsideSdf = sampleLavaPoolSdf(desc, insideX, insideZ);
            assert.ok(expectedInsideSdf < -1, 'center pixel is inside the pit');
            const insideByte = readPixel(data, insideX, insideZ);
            assert.ok(insideByte < 127, `shape ${index} interior decodes negative SDF (${insideByte})`);
            assert.ok(Math.abs(decodeSdf(insideByte) - expectedInsideSdf) < 0.15,
                `shape ${index} interior SDF matches encoded distance`);

            const outsideX = desc.boundRadius + LAVA_PIT_MASK_ENCODE_RANGE + 20;
            const outsideSdf = sampleLavaPoolSdf(desc, outsideX, 0);
            assert.ok(outsideSdf > LAVA_PIT_MASK_ENCODE_RANGE);
            assert.equal(readPixel(data, outsideX, 0), 255, `shape ${index} far exterior encodes full solid ground`);
        } finally {
            texture.dispose();
        }
    }
});
