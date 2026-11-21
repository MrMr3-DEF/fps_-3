import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { CyborgAvatar } from '../src/cyborgAvatar.ts';
import { loadCyborgTestAssets } from './cyborgTestAsset.ts';

test('grapple transfers at the moving thigh, and an unsupported heavy lowers while a one-handed shotgun still fires', async () => {
    await loadCyborgTestAssets();
    const avatar = new CyborgAvatar(0x2244ff);
    const holster = avatar.root.getObjectByName('HolsterL')!;
    const p = new THREE.Vector3(), q = new THREE.Vector3();
    const direction = () => new THREE.Vector3(0,1,0).applyQuaternion(avatar.muzzle.getWorldQuaternion(new THREE.Quaternion()));
    const frame = {body:'Run.Left', bodyTime:.32, weapon:'AR', pitch:.42};
    for (const [phase, time] of [['Draw',.225], ['Return',.295]] as const) {
        avatar.pose({...frame,grapple:'Grapple.'+phase+'.AssaultRifle',grappleTime:time});
        assert.ok(avatar.leftGrip.getWorldPosition(p).distanceTo(holster.getWorldPosition(q)) < .003);
        assert.ok(avatar.leftGrip.getWorldQuaternion(new THREE.Quaternion()).angleTo(holster.getWorldQuaternion(new THREE.Quaternion())) < .02);
    }
    avatar.pose(frame);
    const ready = direction();
    avatar.pose({...frame,grapple:'Grapple.Pull',grappleTime:.2});
    assert.ok(direction().y < ready.y-.5);
    avatar.pose({...frame,weapon:'SHOTGUN',grapple:'Grapple.Pull',grappleTime:.2,action:'Ready'});
    const aim = direction(), hold = avatar.grappleMuzzle.getWorldPosition(p).clone();
    avatar.pose({...frame,weapon:'SHOTGUN',grapple:'Grapple.Pull',grappleTime:.2,action:'Fire',actionTime:7/120});
    assert.ok(aim.angleTo(direction()) > .05);
    assert.ok(avatar.grappleMuzzle.getWorldPosition(p).distanceTo(hold) < .001);
    avatar.dispose();
});

test('camera masks remove the helmet and holstered prop while two players retain independent charge, color and bone palettes', async () => {
    await loadCyborgTestAssets();
    const a = new CyborgAvatar(0x1932ff), b = new CyborgAvatar(0xff1955);
    const charge = (actor: CyborgAvatar) => actor.props.PISTOL.getObjectsByProperty('isSkinnedMesh',true)
        .map(n => (n as THREE.Mesh).material as THREE.MeshStandardMaterial).find(m => m.name.includes('energized glass'))!;
    a.pose({body:'Idle.Armed',bodyTime:0,weapon:'PISTOL',chargeStage:0});
    assert.equal(charge(a).emissiveIntensity,0);
    assert.ok(charge(b).emissiveIntensity>0);
    assert.notEqual(a.damageMaterials[0], b.damageMaterials[0]);
    a.setFirstPerson(true);
    function isWornBy(mesh: THREE.SkinnedMesh, joint: string): boolean {
        const ids = mesh.geometry.index!, skin = mesh.geometry.getAttribute('skinIndex');
        const id = mesh.skeleton.bones.findIndex(n => n.name === joint);
        for (let i=0;i<ids.count;i++) if (skin.getX(ids.getX(i)) === id) return true;
        return false;
    }
    const visible: THREE.SkinnedMesh[] = [];
    a.root.traverseVisible(n=>{if(n instanceof THREE.SkinnedMesh) visible.push(n);});
    assert.ok(visible.some(m=>isWornBy(m,'handR')));
    assert.ok(visible.every(m=>!isWornBy(m,'head') && !isWornBy(m,'GrapplePark')));
    a.setFirstPerson(false);
    assert.ok(a.root.getObjectsByProperty('isSkinnedMesh',true)
        .some(n=>n.visible && isWornBy(n as THREE.SkinnedMesh,'head')));
    let sharedDisposals=0;
    const shared = (b.root.getObjectsByProperty('isSkinnedMesh',true)[0] as THREE.SkinnedMesh).geometry;
    shared.addEventListener('dispose',()=>{sharedDisposals++;});
    a.dispose(); assert.equal(sharedDisposals,0);
    b.pose({body:'Hover.Hold',bodyTime:.1,weapon:'AR'});
    assert.ok(Number.isFinite(b.muzzle.getWorldPosition(new THREE.Vector3()).y));
    b.dispose();
});

test('the support glove stays on each moving battery lid during a pitched strafe and hover', async () => {
    await loadCyborgTestAssets();
    const avatar = new CyborgAvatar(0x2244ff);
    const hand = new THREE.Vector3(), lid = new THREE.Vector3();
    const handRotation = new THREE.Quaternion(), lidRotation = new THREE.Quaternion();
    try {
        for (const weapon of ['PISTOL', 'SHOTGUN', 'AR', 'SNIPER', 'MINIGUN']) {
            const drawerGrip = avatar.props[weapon].getObjectByName('DrawerGrip')!;
            for (const body of ['Run.Left', 'Hover.Hold']) {
                // Check the mechanical phases at contact, full extension and reseating.
                for (const frame of [51, 74, 120, 171, 192]) {
                    avatar.pose({body, bodyTime:frame/120, weapon, action:'Reload', reloadProgress:frame/236, pitch:.42,
                        bodyBlend:body === 'Run.Left' ? {name:'Run.Forward', weight:.4} : undefined});
                    assert.ok(avatar.leftGrip.getWorldPosition(hand).distanceTo(drawerGrip.getWorldPosition(lid)) < .002, weapon);
                    assert.ok(avatar.leftGrip.getWorldQuaternion(handRotation).angleTo(drawerGrip.getWorldQuaternion(lidRotation)) < .02, weapon);
                }
            }
        }
    } finally { avatar.dispose(); }
});

// Measure the deformed luminous overlay in the moving drawer’s coordinates.
function coloredCellSize(model: THREE.Group): THREE.Vector3 {
    model.updateWorldMatrix(true, false);
    model.updateMatrixWorld(true);
    const inverse = model.getObjectByName('Drawer')!.matrixWorld.clone().invert();
    const bounds = new THREE.Box3();
    const vertex = new THREE.Vector3();
    model.traverse(node => {
        if (!(node instanceof THREE.SkinnedMesh) || !node.material.name.includes('energized glass')) return;
        const id = node.skeleton.bones.findIndex(b => b.name === 'CellLight');
        const joints = node.geometry.getAttribute('skinIndex');
        for (let i=0; i<joints.count; i++) {
            if (joints.getX(i) === id) bounds.expandByPoint(node.getVertexPosition(i, vertex).applyMatrix4(node.matrixWorld).applyMatrix4(inverse));
        }
    });
    return bounds.getSize(vertex);
}

test('the open battery shows five physical fill widths on each fitted firearm', async () => {
    await loadCyborgTestAssets();
    const actor = new CyborgAvatar(0x446688);
    try {
        for (const weapon of ['PISTOL','SHOTGUN','AR','SNIPER','MINIGUN']) {
            const pose = { body:'Idle.Armed', bodyTime:0, weapon, action:'Reload', reloadProgress:.4 };
            actor.pose({...pose, chargeStage:4});
            const model = actor.props[weapon], full = coloredCellSize(model).y;
            assert.ok(full > .01, 'missing colored cell on '+weapon);
            for (const stage of [3,0,1,2,4]) {
                actor.pose({...pose, chargeStage:stage});
                assert.ok(Math.abs(coloredCellSize(model).y/full - stage/4) < .003, weapon+' stage '+stage);
            }
        }
    } finally { actor.dispose(); }
});
