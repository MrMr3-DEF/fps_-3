import { createTownBoxes, generateTownLayout, type TownBox, type TownMaterial } from './town.js';

/** Cinematic shells retain the seeded silhouettes without furniture, windows,
 * room partitions, stairs or ornate interior detail. Never used by world.ts. */
export function createEndingCastle(seed: number): { structures: TownBox[]; paving: TownBox[] } {
    const buildings = generateTownLayout(seed);
    const original = createTownBoxes(buildings);
    const structuralKinds = new Set(['wall', 'tower', 'walkway', 'lookout-post', 'lookout-roof', 'church-tower', 'well']);
    const structures = original.filter(part => structuralKinds.has(part.kind) && part.material !== 'water');
    for (const building of buildings) {
        const goth = building.name === 'goth house', church = building.kind === 'church';
        const material: TownMaterial = goth ? 'gothStone' : church ? 'trim' : `plaster${building.palette}` as TownMaterial;
        const { x, z, width: w, depth: d, height: h } = building;
        const box = (px: number, y: number, pz: number, width: number, height: number, depth: number, color = material) => {
            structures.push({ x: px, y, z: pz, width, height, depth, material: color, solid: true, kind: 'building' });
        };
        for (const side of [-1, 1]) {
            box(x + side * (w / 2 - .5), h / 2, z, 1, h, d);
            box(x, h / 2, z + side * (d / 2 - .5), w - 2, h, 1);
        }
        const roof: TownMaterial = goth ? 'gothRoof' : 'roof';
        box(x, h, z, w + .5, .8, d + .5, roof);
        if (goth || church) {
            const rise = goth ? 6.6 : 3.6;
            // Three broad tiers preserve the pitched silhouette at this shot's
            // distance instead of carrying the gameplay roof's many thin slabs.
            for (let tier = 0; tier < 3; tier++) {
                const width = w * (1 - tier / 3);
                const swap = building.doorAxis === 'x';
                box(x, h + (tier + .5) * rise / 3, z, swap ? w : width, rise / 3, swap ? d * (1 - tier / 3) : d, roof);
            }
        }
    }
    return { structures, paving: original.filter(part => part.kind === 'paving') };
}
