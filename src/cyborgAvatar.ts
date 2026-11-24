import * as THREE from 'three';
import { GRAPPLE_SEAT_TIME, HEAVY_HANDOFF_TIME } from './config.js';
import { setSuitGlow } from './damagePulse.js';
import { GLTFLoader, type GLTF } from 'three/addons/loaders/GLTFLoader.js';
import { clone as cloneRig } from 'three/addons/utils/SkeletonUtils.js';
import { excludeFromStablePeerEnvelope } from './smartGogglesPeerMath.js';

const urls = {
    body: new URL('../blender_assets/player_cyborg/player_cyborg_animations.glb', import.meta.url).href,
    PISTOL: new URL('../blender_assets/player_cyborg/props/pistol.glb', import.meta.url).href,
    SHOTGUN: new URL('../blender_assets/player_cyborg/props/shotgun.glb', import.meta.url).href,
    AR: new URL('../blender_assets/player_cyborg/props/assault_rifle.glb', import.meta.url).href,
    SNIPER: new URL('../blender_assets/player_cyborg/props/sniper.glb', import.meta.url).href,
    MINIGUN: new URL('../blender_assets/player_cyborg/props/minigun.glb', import.meta.url).href,
    KATANA: new URL('../blender_assets/player_cyborg/props/katana.glb', import.meta.url).href,
    GRAPPLE: new URL('../blender_assets/player_cyborg/props/grapple.glb', import.meta.url).href,
};
const prefixes: Record<string, string> = {
    PISTOL: 'Pistol', SHOTGUN: 'Shotgun', AR: 'AssaultRifle', SNIPER: 'Sniper', MINIGUN: 'Minigun', KATANA: 'Katana',
};
const heavy = new Set(['AR', 'SNIPER', 'MINIGUN']);
type Source = keyof typeof urls;
let assets: Record<Source, GLTF> | undefined;
let loading: Promise<void> | undefined;
export const cyborgAssetsReady = () => assets !== undefined;

/** Shared immutable geometry, clips and textures survive match/menu changes.
 * Mutable materials, skeletons and pose state belong to their visual instance. */
export function loadCyborgAssets(read?: (url: string) => Promise<GLTF>): Promise<void> {
    if (loading) return loading;
    const loader = new GLTFLoader();
    const fetchAsset = read ?? ((url: string) => loader.loadAsync(url));
    loading = Promise.all(Object.entries(urls).map(async ([name, url]) => [name, await fetchAsset(url)]))
        .then(entries => { assets = Object.fromEntries(entries) as Record<Source, GLTF>; })
        .catch(err => { loading = undefined; throw err; });
    return loading;
}

function source(name: string): GLTF {
    const asset = assets?.[name as Source];
    if (!asset) throw new Error('Cyborg asset is unavailable: ' + name);
    return asset;
}

function joint(root: THREE.Object3D, name: string): THREE.Object3D {
    const node = root.getObjectByName(THREE.PropertyBinding.sanitizeNodeName(name));
    if (!node) throw new Error('Missing cyborg joint ' + name);
    return node;
}

function cloneVisual(template: THREE.Group): THREE.Group {
    const model = cloneRig(template) as THREE.Group;
    // GLTFLoader splits each material primitive into a SkinnedMesh. They use
    // the same joints and inverse binds; update one bone texture per instance.
    const palettes = new Map<THREE.Bone, THREE.Skeleton>();
    model.traverse(n => {
        if (!(n instanceof THREE.SkinnedMesh)) return;
        // Each primitive can travel from its parked bind pose to a different hand.
        // Three caches the first sampled skin bounds, which can hide the drawn launcher.
        n.frustumCulled = false;
        const palette = n.skeleton;
        const root = palette.bones[0], previous = palettes.get(root);
        if (!previous) palettes.set(root, palette);
        else if (previous !== palette && previous.bones.length === palette.bones.length &&
            previous.bones.every((b,i) => b === palette.bones[i] && previous.boneInverses[i].equals(palette.boneInverses[i]))) {
            n.skeleton = previous;
            palette.dispose();
        }
    });
    return model;
}

function releaseSkin(root: THREE.Object3D): void {
    const skeletons = new Set<THREE.Skeleton>();
    root.traverse(n => { if (n instanceof THREE.SkinnedMesh) skeletons.add(n.skeleton); });
    for (const skeleton of skeletons) skeleton.dispose();
}

/** Menu props share the same fitted meshes and need no view-dependent rescaling. */
export function createCyborgProp(weapon: string): THREE.Group {
    return cloneVisual(source(weapon.toUpperCase()).scene);
}

export function disposeCyborgProp(prop: THREE.Group): void {
    prop.removeFromParent();
    releaseSkin(prop);
}

type Channel = 'position' | 'scale' | 'quaternion';
type Sample = { joint: string; property: Channel; sample: THREE.Interpolant };
type Compiled = { duration: number; tracks: Sample[] };
const clipLibraries = new WeakMap<GLTF, Map<string, Compiled>>();
function clips(source: GLTF): Map<string, Compiled> {
    let result = clipLibraries.get(source);
    if (result) return result;
    result = new Map();
    for (const clip of source.animations) {
        const tracks = clip.tracks.map(track => {
            const split = track.name.lastIndexOf('.');
            return { joint: track.name.slice(0, split), property: track.name.slice(split + 1) as Channel,
                sample: track.createInterpolant() };
        });
        result.set(clip.name, { duration: clip.duration, tracks });
    }
    clipLibraries.set(source, result);
    return result;
}

const v0 = new THREE.Vector3(), q0 = new THREE.Quaternion();
class RigPose {
    private nodes = new Map<string, THREE.Object3D>();
    private rest: {node: THREE.Object3D; p: THREE.Vector3; q: THREE.Quaternion; s: THREE.Vector3}[] = [];
    private library: Map<string, Compiled>;
    constructor(model: THREE.Object3D, asset: GLTF) {
        this.library = clips(asset);
        model.traverse(n => {
            if (!(n instanceof THREE.Bone)) return;
            this.nodes.set(n.name, n);
            this.rest.push({node: n, p: n.position.clone(), q: n.quaternion.clone(), s: n.scale.clone()});
        });
    }
    reset(): void {
        for (const {node, p, q, s} of this.rest) {
            node.position.copy(p); node.quaternion.copy(q); node.scale.copy(s);
        }
    }
    apply(name: string, elapsed: number, loop = false, weight = 1): void {
        if (weight <= 0) return;
        const clip = this.library.get(name);
        if (!clip) return;
        const time = loop ? THREE.MathUtils.euclideanModulo(elapsed, clip.duration) :
            THREE.MathUtils.clamp(elapsed, 0, clip.duration);
        for (const track of clip.tracks) {
            const node = this.nodes.get(track.joint);
            if (!node) continue;
            const value = track.sample.evaluate(time);
            if (track.property === 'quaternion') node.quaternion.slerp(q0.fromArray(value), weight);
            else node[track.property].lerp(v0.fromArray(value), weight);
        }
    }
}

// One index buffer per compatible primitive; positions, weights and materials
// remain the same for the camera arms and the complete third-person character.
const handGeometry = new WeakMap<THREE.BufferGeometry, THREE.BufferGeometry | null>();
function armsOnly(mesh: THREE.SkinnedMesh): THREE.BufferGeometry | null {
    const geo = mesh.geometry;
    if (handGeometry.has(geo)) return handGeometry.get(geo)!;
    const belongsToHand = mesh.skeleton.bones.map(b => {
        for (let n: THREE.Object3D | null = b; n && n instanceof THREE.Bone; n = n.parent) {
            if (/^(forearm[LR]|GrappleCarry)$/.test(n.name)) return true;
        }
        return false;
    });
    const jointIds = geo.getAttribute('skinIndex'), index = geo.index;
    const count = index?.count ?? jointIds.count;
    const kept: number[] = [];
    for (let i = 0; i < count; i += 3) {
        const a = index?.getX(i) ?? i, b = index?.getX(i + 1) ?? i + 1, c = index?.getX(i + 2) ?? i + 2;
        if (belongsToHand[jointIds.getX(a)] && belongsToHand[jointIds.getX(b)] && belongsToHand[jointIds.getX(c)]) kept.push(a,b,c);
    }
    let subset: THREE.BufferGeometry | null = null;
    if (kept.length === count) subset = geo;
    else if (kept.length) {
        subset = new THREE.BufferGeometry();
        for (const [name, attribute] of Object.entries(geo.attributes)) subset.setAttribute(name, attribute);
        subset.setIndex(kept);
    }
    handGeometry.set(geo, subset);
    return subset;
}

const darkGlass = new THREE.Color(0x697079);
class ChargeLight {
    readonly color: THREE.Color;
    readonly emission: THREE.Color;
    readonly intensity: number;
    private stage = -1;
    readonly material: THREE.MeshStandardMaterial;
    private readonly cell: THREE.Object3D;
    private readonly rest: THREE.Vector3;
    private readonly rearOffset: THREE.Vector3;
    constructor(material: THREE.MeshStandardMaterial, model: THREE.Group, prefix = '') {
        this.cell = joint(model, prefix + 'CellLight');
        this.rest = this.cell.position.clone();
        // Locate the actual rear of the luminous overlay in its bind frame.
        // On the wide minigun cell the authored pivot is on its side, and a
        // widthwise fill would disappear behind the frosted side facing the pilot.
        let rear = Infinity;
        const vertex = new THREE.Vector3(), bind = new THREE.Matrix4();
        model.traverse(mesh => {
            if (!(mesh instanceof THREE.SkinnedMesh) || !mesh.material.name.includes('energized glass')) return;
            const id = mesh.skeleton.bones.indexOf(this.cell as THREE.Bone);
            if (id < 0) return;
            const skin = mesh.geometry.getAttribute('skinIndex'), points = mesh.geometry.getAttribute('position');
            bind.multiplyMatrices(mesh.skeleton.boneInverses[id], mesh.bindMatrix);
            for (let i=0; i<skin.count; i++) {
                if (skin.getX(i) === id) rear = Math.min(rear, vertex.fromBufferAttribute(points,i).applyMatrix4(bind).y);
            }
        });
        if (!Number.isFinite(rear)) throw new Error('Missing colored surface for ' + this.cell.name);
        this.rearOffset = new THREE.Vector3(0,rear,0).applyQuaternion(this.cell.quaternion);
        this.material = material;
        this.color = material.color.clone();
        this.emission = material.emissive.clone();
        this.intensity = material.emissiveIntensity;
    }
    set(level: number): void {
        const stage = THREE.MathUtils.clamp(Math.round(level), 0, 4);
        // The baked reload assumes a depleted cell. Replace its colored shell
        // scale after every pose sample so the uncharged frosted glass stays visible.
        this.cell.scale.setScalar(stage === 0 ? .0001 : 1);
        const fill = stage / 4;
        if (stage > 0) this.cell.scale.y = fill;
        this.cell.position.copy(this.rest).addScaledVector(this.rearOffset, 1 - fill);
        if (stage === this.stage) return;
        this.stage = stage;
        this.material.color.copy(stage > 0 ? this.color : darkGlass);
        this.material.emissive.copy(this.emission);
        this.material.emissiveIntensity = stage > 0 ? this.intensity : 0;
    }
}

/** Standalone arsenal prop with its own battery material and articulated drawer. */
export function createPreviewProp(weapon: string) {
    const model = createCyborgProp(weapon);
    const rig = new RigPose(model, source(weapon));
    const lights: ChargeLight[] = [];
    model.traverse(node => {
        if (!(node instanceof THREE.SkinnedMesh)) return;
        const material = node.material as THREE.MeshStandardMaterial;
        if (!material.name.includes('energized glass')) return;
        node.material = material.clone();
        lights.push(new ChargeLight(node.material as THREE.MeshStandardMaterial, model));
    });
    let last = -1, lastCharge = 4;
    return {
        model,
        sampleReload(progress: number | undefined, charge: number) {
            const next = progress ?? -1;
            if (next === last && charge === lastCharge) return;
            last = next;
            lastCharge = charge;
            rig.reset();
            if (progress !== undefined) rig.apply('Reload', progress * 236 / 120);
            for (const light of lights) light.set(charge);
        },
        dispose() {
            disposeCyborgProp(model);
            for (const light of lights) light.material.dispose();
        }
    };
}

export interface CyborgPose {
    body: string;
    bodyTime: number;
    bodyBlend?: { name: string; weight: number };
    runWeight?: number;
    weapon: string;
    action?: string;
    actionTime?: number;
    grapple?: string;
    grappleTime?: number;
    pitch?: number;
    spin?: number;
    hitTime?: number;
    reducedMotion?: boolean;
    heavyLower?: number;
    reloadProgress?: number;
    reloadRelease?: { progress: number; weight: number };
    chargeStage?: number;
    grappleChargeStage?: number;
}

const heldLoops = new Set(['Ready', 'Aim', 'ChargedHold']);
const bodyLoops = /^(Idle\.|Run\.|Turn\.|Jump\.(Rise|Apex|Fall)$|Hover\.(Hold|Forward|Left|Right|Backward)$|Grapple\.Pull|Pilot\.Seated$)/;
const sm = THREE.MathUtils.smoothstep;
const directionX = new THREE.Vector3(1,0,0), localY = new THREE.Vector3(0,1,0);
const vector = () => new THREE.Vector3(), quaternion = () => new THREE.Quaternion();
const a = vector(), b = vector(), c = vector(), shoulder = vector(), elbow = vector(), wrist = vector();
const gripGoal = vector(), targetWrist = vector(), targetElbow = vector();
const oldHand = quaternion(), handGoal = quaternion(), goalQ = quaternion(), tempQ = quaternion(), turnQ = quaternion();

function rotateWorld(node: THREE.Object3D, delta: THREE.Quaternion): void {
    node.parent!.getWorldQuaternion(tempQ);
    node.quaternion.premultiply(turnQ.copy(tempQ).invert().multiply(delta).multiply(tempQ));
    node.updateWorldMatrix(false, true);
}

function aimAt(node: THREE.Object3D, tip: THREE.Object3D, target: THREE.Vector3): void {
    node.getWorldPosition(a);
    tip.getWorldPosition(b).sub(a).normalize();
    c.copy(target).sub(a).normalize();
    rotateWorld(node, goalQ.setFromUnitVectors(b, c));
}

export class CyborgAvatar {
    readonly root: THREE.Group;
    readonly props: Record<string, THREE.Group> = {};
    readonly damageMaterials: THREE.MeshStandardMaterial[] = [];
    readonly grip: THREE.Object3D;
    readonly leftGrip: THREE.Object3D;
    readonly wrists: readonly [THREE.Object3D, THREE.Object3D];
    readonly grappleMuzzle: THREE.Object3D;
    readonly tip: THREE.Object3D;
    readonly bladeMaterial: THREE.MeshStandardMaterial;
    private primary = 'PISTOL';
    private primaryVisible = true;
    private showProp = true;
    private firstPerson = false;
    private bodyRig: RigPose;
    private propRigs = new Map<string, RigPose>();
    private primaries = new Map<string, THREE.Object3D>();
    private drawers = new Map<string, THREE.Object3D>();
    private owned = new Map<THREE.Material, THREE.MeshStandardMaterial>();
    private accents: THREE.MeshStandardMaterial[] = [];
    private lights = new Map<string, ChargeLight>();
    private bodyMeshes: {mesh: THREE.SkinnedMesh; full: THREE.BufferGeometry; hands: THREE.BufferGeometry | null}[] = [];
    private shadowMeshes: THREE.SkinnedMesh[] = [];
    private castingShadows = true;
    private chest: THREE.Object3D;
    private holster: THREE.Object3D;
    private arm: THREE.Object3D;
    private forearm: THREE.Object3D;
    private hand: THREE.Object3D;
    private rotor: THREE.Object3D;
    private bores: THREE.Object3D[];
    private minigunMuzzle: THREE.Object3D;
    private bursts: THREE.Bone[] = [];

    constructor(color: number) {
        this.root = cloneVisual(source('body').scene);
        Object.defineProperty(this.root.userData, 'cyborgAvatar', {value: this});
        this.bodyRig = new RigPose(this.root, source('body'));
        this.grip = joint(this.root, 'grip.R');
        this.leftGrip = joint(this.root, 'grip.L');
        this.grappleMuzzle = joint(this.root, 'GrappleMuzzle');
        this.chest = joint(this.root, 'chest');
        this.holster = joint(this.root, 'Holster.L');
        this.arm = joint(this.root, 'upper_arm.L');
        this.forearm = joint(this.root, 'forearm.L');
        this.hand = joint(this.root, 'hand.L');
        this.wrists = [this.hand, joint(this.root, 'hand.R')];
        this.root.traverse(n => {
            if (n instanceof THREE.Bone && n.name.startsWith('Burst')) this.bursts.push(n);
            if (!(n instanceof THREE.SkinnedMesh)) return;
            this.bodyMeshes.push({mesh:n, full:n.geometry, hands:armsOnly(n)});
            this.shadowMeshes.push(n);
            n.castShadow = n.receiveShadow = true;
            const mat = n.material as THREE.MeshStandardMaterial;
            if (/^(Prop|grapple|Holster|Exhaust •)/i.test(mat.name)) excludeFromStablePeerEnvelope(n);
            if (/^(Armor_|Suit_|Visor_Smoked)/.test(mat.name)) {
                const local = this.instanceMaterial(n, mat);
                this.damageMaterials.push(local);
                if (/^Suit_/.test(mat.name)) this.accents.push(local);
            } else if (mat.name.includes('energized glass')) this.lights.set('GRAPPLE', new ChargeLight(this.instanceMaterial(n, mat), this.root, 'Grapple'));
        });
        for (const key of Object.keys(prefixes)) {
            const model = createCyborgProp(key);
            this.props[key] = model;
            model.visible = key === this.primary;
            excludeFromStablePeerEnvelope(model);
            model.traverse(n => {
                if (!(n instanceof THREE.SkinnedMesh)) return;
                this.shadowMeshes.push(n);
                n.castShadow = n.receiveShadow = true;
                const m = n.material as THREE.MeshStandardMaterial;
                if (m.name.includes('energized glass')) this.lights.set(key, new ChargeLight(this.instanceMaterial(n, m), model));
                if (key === 'KATANA' && m.name === 'Katana blade') this.instanceMaterial(n, m);
            });
            this.grip.add(model);
            this.propRigs.set(key, new RigPose(model, source(key)));
            this.primaries.set(key, joint(model, key === 'KATANA' ? 'Tip' : 'Muzzle'));
            if (key !== 'KATANA') this.drawers.set(key, joint(model, 'DrawerGrip'));
        }
        this.tip = this.muzzleFor('KATANA');
        this.rotor = joint(this.props.MINIGUN, 'Rotor');
        this.bores = this.rotor.children.filter(bone => /^Bore\d+$/.test(bone.name));
        if (!this.bores.length) throw new Error('Missing minigun barrel sockets');
        this.minigunMuzzle = this.muzzleFor('MINIGUN');
        this.bladeMaterial = [...this.owned.values()].find(m => m.name === 'Katana blade')!;
        if (!this.bladeMaterial) throw new Error('Missing fitted katana blade material');
        this.setColor(color);
        this.pose({body:'Idle.Armed',bodyTime:0,weapon:'PISTOL'});
    }

    private instanceMaterial(mesh: THREE.Mesh, source: THREE.MeshStandardMaterial): THREE.MeshStandardMaterial {
        let local = this.owned.get(source);
        if (!local) {local = source.clone(); this.owned.set(source, local);}
        mesh.material = local;
        return local;
    }

    setColor(color: number): void {
        for (const material of this.accents) {
            material.color.setHex(color);
            setSuitGlow(material, color);
        }
    }
    get drawerGrip(): THREE.Object3D | undefined { return this.drawers.get(this.primary); }
    get muzzle(): THREE.Object3D { return this.muzzleFor(this.primary); }
    muzzleFor(weapon: string): THREE.Object3D { return weapon === 'GRAPPLE' ? this.grappleMuzzle : this.primaries.get(weapon) ?? this.grip; }
    setFirstPerson(enabled: boolean): void {
        if (this.firstPerson === enabled) return;
        this.firstPerson = enabled;
        for (const {mesh, full, hands} of this.bodyMeshes) {
            mesh.geometry = enabled && hands ? hands : full;
            mesh.visible = !enabled || !!hands;
            mesh.castShadow = !enabled;
        }
    }
    setPrimaryVisible(enabled: boolean): void {
        this.primaryVisible = enabled;
        this.props[this.primary].visible = enabled && this.showProp;
    }

    /** The baked draw is in the neutral leg pose. Fit both limb joints to the
     * moving thigh during contact, then release the correction as the gun clears. */
    private followHolster(t: number): void {
        const weight = sm(t, .11, .204) * (1 - sm(t, .246, .37));
        if (weight <= 0) return;
        this.leftGrip.getWorldPosition(gripGoal).lerp(this.holster.getWorldPosition(a), weight);
        this.leftGrip.getWorldQuaternion(goalQ).slerp(this.holster.getWorldQuaternion(tempQ), weight);
        this.hand.getWorldQuaternion(oldHand);
        this.leftGrip.getWorldQuaternion(tempQ);
        handGoal.copy(goalQ).multiply(tempQ.invert()).multiply(oldHand);
        this.arm.getWorldPosition(shoulder);
        this.forearm.getWorldPosition(elbow);
        this.hand.getWorldPosition(wrist);
        this.leftGrip.getWorldPosition(a).sub(wrist).applyQuaternion(oldHand.invert()).applyQuaternion(handGoal);
        targetWrist.copy(gripGoal).sub(a);
        const upper = shoulder.distanceTo(elbow), lower = elbow.distanceTo(wrist);
        a.copy(targetWrist).sub(shoulder);
        const distance = THREE.MathUtils.clamp(a.length(), Math.abs(upper-lower)+.0001, upper+lower-.0001);
        a.normalize();
        targetWrist.copy(shoulder).addScaledVector(a,distance);
        b.copy(elbow).sub(shoulder); b.addScaledVector(a,-a.dot(b));
        if (b.lengthSq() < 1e-8) b.set(0,0,1).cross(a);
        const projection = (upper*upper-lower*lower+distance*distance)/(2*distance);
        targetElbow.copy(shoulder).addScaledVector(a,projection).addScaledVector(b.normalize(), Math.sqrt(Math.max(0,upper*upper-projection*projection)));
        aimAt(this.arm,this.forearm,targetElbow);
        aimAt(this.forearm,this.hand,targetWrist);
        this.hand.parent!.getWorldQuaternion(tempQ);
        this.hand.quaternion.copy(tempQ.invert()).multiply(handGoal);
    }

    pose(input: CyborgPose): void {
        const weapon = prefixes[input.weapon] ? input.weapon : 'PISTOL';
        const fullBody = input.body.startsWith('Pilot.') || input.body === 'Death';
        this.showProp = !fullBody && input.body !== 'Idle.Unarmed';
        if (this.primary !== weapon) this.props[this.primary].visible = false;
        this.primary = weapon;
        this.props[weapon].visible = this.showProp && this.primaryVisible;
        this.bodyRig.reset();
        this.bodyRig.apply(input.body, input.bodyTime, bodyLoops.test(input.body));
        if (input.bodyBlend) this.bodyRig.apply(input.bodyBlend.name, input.bodyTime, true, input.bodyBlend.weight);
        if (input.runWeight !== undefined && input.runWeight < 1) this.bodyRig.apply('Idle.Armed', 0, false, 1-input.runWeight);
        const action = input.action ?? 'Ready';
        const time = input.reloadProgress !== undefined && action === 'Reload' ? input.reloadProgress * 236/120 : input.actionTime ?? input.bodyTime;
        const grappling = input.grapple ?? '';
        const gripTime = input.grappleTime ?? 0;
        const drawing = grappling.startsWith('Grapple.Draw.'), returning = grappling.startsWith('Grapple.Return.');
        if (this.showProp) {
            this.bodyRig.apply(prefixes[weapon]+'.'+action, time, heldLoops.has(action));
            const weight = input.heavyLower ?? (drawing ? sm(gripTime,0,.225) : returning ? 1-sm(gripTime,GRAPPLE_SEAT_TIME,HEAVY_HANDOFF_TIME) : grappling ? 1 : 0);
            if (weight && heavy.has(weapon)) this.bodyRig.apply(prefixes[weapon]+'.Lowered', 0, false, weight);
            if (grappling) this.bodyRig.apply(grappling, gripTime, grappling === 'Grapple.Pull' || grappling === 'Grapple.Held');
            if (input.reloadRelease) this.bodyRig.apply(prefixes[weapon]+'.Reload', input.reloadRelease.progress * 236/120, false, input.reloadRelease.weight);
        }
        if (input.reducedMotion) for (const flame of this.bursts) flame.scale.setScalar(.00001);
        if (input.hitTime !== undefined && !fullBody) this.bodyRig.apply('Hit',input.hitTime);
        if (input.pitch && !fullBody) {
            this.root.getWorldQuaternion(tempQ);
            a.copy(directionX).applyQuaternion(tempQ);
            rotateWorld(this.chest,goalQ.setFromAxisAngle(a,-THREE.MathUtils.clamp(input.pitch,-1.45,1.45)));
        }
        if (drawing || returning) this.followHolster(returning ? .52-gripTime : gripTime);
        const rig = this.propRigs.get(weapon)!;
        rig.reset();
        if (action === 'Reload') rig.apply('Reload', time);
        else if (input.reloadRelease) rig.apply('Reload', input.reloadRelease.progress * 236/120, false, input.reloadRelease.weight);
        if (weapon === 'MINIGUN') {
            this.rotor.quaternion.setFromAxisAngle(localY, input.spin ?? 0);
            this.rotor.updateMatrix();
            // The housing's +Z points toward the carry handle. Evaluate there so
            // camera pitch, recoil and roll cannot change which opening is on top.
            let highest = -Infinity;
            for (const bore of this.bores) {
                a.copy(bore.position).applyMatrix4(this.rotor.matrix);
                if (a.z > highest) {
                    highest = a.z;
                    this.minigunMuzzle.position.copy(a);
                }
            }
        }
        this.lights.get(weapon)?.set(input.chargeStage ?? 4);
        this.lights.get('GRAPPLE')?.set(input.grappleChargeStage ?? 4);
    }

    setShadowCasting(enabled: boolean): void {
        if (this.castingShadows === enabled) return;
        this.castingShadows = enabled;
        for (const mesh of this.shadowMeshes) mesh.castShadow = enabled;
    }

    dispose(): void {
        this.root.removeFromParent();
        releaseSkin(this.root);
        for (const mat of this.owned.values()) mat.dispose();
        this.owned.clear();
    }
}
