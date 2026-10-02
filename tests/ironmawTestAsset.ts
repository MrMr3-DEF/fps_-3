import { readFile } from 'node:fs/promises';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

/** Keep the actual skin and baked clips; remove only browser image decoding
 * from Node geometry tests. Browser review loads the untouched production GLB. */
export async function loadIronmawTestAsset() {
    const original = await readFile(new URL('../blender_assets/ironmaw/ironmaw_siege_robot.glb', import.meta.url));
    const length = original.readUInt32LE(12);
    const json = JSON.parse(original.subarray(20, 20 + length).toString());
    json.images = []; json.textures = []; json.materials = [];
    for (const mesh of json.meshes) for (const primitive of mesh.primitives) delete primitive.material;
    let encoded = Buffer.from(JSON.stringify(json));
    encoded = Buffer.concat([encoded, Buffer.alloc((4 - encoded.length % 4) % 4, 32)]);
    const binary = original.subarray(20 + length);
    const header = Buffer.alloc(20);
    header.writeUInt32LE(0x46546c67); header.writeUInt32LE(2, 4); header.writeUInt32LE(20 + encoded.length + binary.length, 8);
    header.writeUInt32LE(encoded.length, 12); header.writeUInt32LE(0x4e4f534a, 16);
    const buffer = Buffer.concat([header, encoded, binary]);
    return new GLTFLoader().parseAsync(buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength), '');
}
