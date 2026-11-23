import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { loadCyborgTestAssets } from './cyborgTestAsset.ts';
import { CyborgAvatar } from '../src/cyborgAvatar.ts';
import { FirstPersonReloadFrame, getHolderMuzzlePosition } from '../src/firstPersonReload.ts';
import { CYBORG_SCALE } from '../src/playerAvatar.ts';
import { PLAYER_BODY_CAMERA_OFFSET } from '../src/playerHitbox.ts';
import { FIREARM_MAGAZINES, PLAYER_HEIGHT } from '../src/config.ts';

test('holder can see the open drawer and both hands at game scale, without changing simulation sockets', async t => {
    await loadCyborgTestAssets();
    const avatar = new CyborgAvatar(0x44aacc);
    const shell = new THREE.Group();
    shell.add(avatar.root);
    avatar.root.scale.setScalar(CYBORG_SCALE);
    avatar.root.rotation.y = Math.PI;
    avatar.root.position.y = PLAYER_BODY_CAMERA_OFFSET - PLAYER_HEIGHT;
    avatar.setFirstPerson(true);
    const eye = new THREE.Vector3(14,PLAYER_HEIGHT,-5), yaw=.37;
    shell.position.copy(eye).y -= PLAYER_BODY_CAMERA_OFFSET;
    shell.rotation.y = yaw;
    const frame = new FirstPersonReloadFrame(), projected = new THREE.Vector3();
    const logical = new THREE.Vector3(), logicalLeft = new THREE.Vector3(), logicalMuzzle = new THREE.Vector3();
    let worstX=0, worstY=0, minDepth=Infinity, highestElbow=-Infinity;
    try {
        for (const [fov,aspect,pitch] of [[75,16/9,0],[75,924/412,-.8],[60,412/924,.9],[15,16/9,.4]]) {
            const camera = new THREE.PerspectiveCamera(fov,aspect,.1,1500);
            camera.position.copy(eye); camera.rotation.set(pitch,yaw,0,'YXZ'); camera.updateMatrixWorld(true);
            const aim = camera.quaternion.clone();
            for (const [weapon,spec] of Object.entries(FIREARM_MAGAZINES)) {
                frame.clear();
                const original = avatar.root.position.clone();
                for (let i=0;i<=60;i++) {
                    const progress=i/60;
                    const pose = {body:'Run.Left',bodyTime:progress,weapon,action:'Reload',reloadProgress:progress,pitch};
                    avatar.pose(pose);
                    avatar.drawerGrip!.getWorldPosition(logical);
                    avatar.leftGrip.getWorldPosition(logicalLeft);
                    avatar.muzzle.getWorldPosition(logicalMuzzle);
                    frame.begin(avatar,camera,pose,spec.reloadSeconds/60);
                    const lens = frame.camera;
                    if (progress>=.32 && progress<=.76) {
                        const depth = -avatar.drawerGrip!.getWorldPosition(projected).applyMatrix4(lens.matrixWorldInverse).z;
                        const normalLensDepth = depth * Math.tan(THREE.MathUtils.degToRad(lens.fov/2)) / Math.tan(THREE.MathUtils.degToRad(75/2));
                        minDepth = Math.min(minDepth,normalLensDepth);
                        assert.ok(normalLensDepth>.64, `${weapon}: receiver too close to the eye at ${fov}°`);
                        for (const wrist of avatar.wrists) {
                            const elbow = wrist.parent!.getWorldPosition(projected).project(lens);
                            if (elbow.z < -1 || elbow.z > 1) continue;
                            highestElbow = Math.max(highestElbow,elbow.y);
                            assert.ok(elbow.y< -1.12, `${weapon}: sleeve ends on screen at ${elbow.y}`);
                        }
                        for (const socket of [avatar.drawerGrip!,avatar.leftGrip,avatar.grip]) {
                            socket.getWorldPosition(projected).project(lens);
                            worstX=Math.max(worstX,Math.abs(projected.x)); worstY=Math.max(worstY,Math.abs(projected.y));
                            assert.ok(Math.abs(projected.x)<.91 && Math.abs(projected.y)<.9 && projected.z>-1 && projected.z<1,
                                `${weapon} @ ${fov}° / ${aspect}: ${socket.name} outside holder frame ${projected.toArray()}`);
                        }
                        assert.ok(Math.abs(avatar.drawerGrip!.getWorldPosition(projected).distanceTo(avatar.leftGrip.getWorldPosition(new THREE.Vector3()))
                            -logical.distanceTo(logicalLeft))<1e-8, 'the glove remains fitted to the drawer');
                    }
                    frame.restore();
                    assert.ok(avatar.root.position.equals(original) && avatar.muzzle.getWorldPosition(projected).distanceTo(logicalMuzzle)<1e-8);
                    assert.ok(camera.position.equals(eye) && camera.quaternion.equals(aim));
                }
            }
        }
        const camera = new THREE.PerspectiveCamera(75,16/9,.1,1500);
        camera.position.copy(eye); camera.rotation.y=yaw; camera.updateMatrixWorld(true);
        const ready = {body:'Idle.Armed',bodyTime:0,weapon:'SNIPER'};
        const reload = {...ready,action:'Reload',reloadProgress:.5};
        frame.clear();
        frame.begin(avatar,camera,ready,1/60);
        const restingFrame = avatar.root.position.clone();
        frame.restore();
        for (let i=0;i<12;i++) { frame.begin(avatar,camera,reload,1/60); frame.restore(); }
        frame.begin(avatar,camera,reload,1/60);
        let previous=avatar.root.position.distanceTo(restingFrame);
        assert.ok(previous>.05);
        frame.restore();
        for (let i=0;i<9;i++) {
            frame.begin(avatar,camera,ready,1/60);
            const current=avatar.root.position.distanceTo(restingFrame);
            assert.ok(current<=previous);
            if (i===0) assert.ok(current>previous*.85, 'cancel eases out from the displayed offset');
            previous=current;
            frame.restore();
        }
        assert.equal(previous,0);
        t.diagnostic(`Open drawer: max |NDC| = (${worstX.toFixed(2)}, ${worstY.toFixed(2)}), minimum depth at 75° = ${minDepth.toFixed(2)} m, highest elbow NDC = ${highestElbow.toFixed(2)}`);
    } finally { frame.clear(); avatar.dispose(); }
});

test('rapid turns, flight and scope keep the drawn guns stable and present each effect at its aperture', async () => {
    await loadCyborgTestAssets();
    const avatar = new CyborgAvatar(0x44aacc), shell = new THREE.Group();
    shell.add(avatar.root);
    avatar.root.scale.setScalar(CYBORG_SCALE);
    avatar.root.rotation.y = Math.PI;
    avatar.root.position.y = PLAYER_BODY_CAMERA_OFFSET - PLAYER_HEIGHT;
    avatar.setFirstPerson(true);
    const frame = new FirstPersonReloadFrame();
    const camera = new THREE.PerspectiveCamera(75,16/9,.1,1500);
    const rendered = new THREE.Vector3(), effect = new THREE.Vector3(), local = new THREE.Vector3();
    try {
        for (const weapon of Object.keys(FIREARM_MAGAZINES)) {
            const heavy = ['AR','SNIPER','MINIGUN'].includes(weapon);
            for (const offhand of (heavy ? [false,true] : [true])) {
                const reference = new THREE.Vector3();
                for (const [i, pitch] of [0,1.42,-1.43,.8].entries()) {
                    camera.fov = i%2 ? 15 : 75;
                    camera.updateProjectionMatrix();
                    camera.position.set(13-19*i,PLAYER_HEIGHT+4*i,i*11);
                    camera.rotation.set(pitch,i*2.9,0,'YXZ');
                    camera.updateMatrixWorld(true);
                    shell.position.copy(camera.position).y -= PLAYER_BODY_CAMERA_OFFSET;
                    shell.rotation.y = i*2.9;
                    const pose = {body:i%2 ? 'Run.Left' : 'Hover.Hold',bodyTime:i*.24,weapon,action:'Ready',
                        actionTime:0,pitch,grapple:offhand?'Grapple.Held':undefined};
                    avatar.pose(pose);
                    const physical = avatar.muzzle.getWorldPosition(new THREE.Vector3());
                    frame.begin(avatar,camera,pose,1/60);
                    avatar.muzzle.getWorldPosition(local).applyMatrix4(frame.camera.matrixWorldInverse);
                    if (i===0) reference.copy(local);
                    assert.ok(local.distanceTo(reference)<.04, weapon+' cuts across the moving eye');
                    for (const id of offhand ? [weapon,'GRAPPLE'] : [weapon]) {
                        const muzzle = avatar.muzzleFor(id);
                        muzzle.getWorldPosition(rendered).project(frame.camera);
                        assert.ok(getHolderMuzzlePosition(avatar,id,effect));
                        effect.project(camera);
                        assert.ok(rendered.distanceTo(effect)<1e-8, id+' effect misses visible barrel');
                        if (id==='GRAPPLE') {
                            assert.ok(Math.abs(rendered.x)<.95 && Math.abs(rendered.y)<.95 && rendered.z<1);
                        }
                    }
                    frame.restore();
                    assert.ok(avatar.muzzle.getWorldPosition(local).distanceTo(physical)<1e-8);
                }
            }
        }
        frame.clear();
        assert.equal(getHolderMuzzlePosition(avatar,'GRAPPLE',effect),false);
    } finally { frame.clear(); avatar.dispose(); }
});

test('the drawn launcher stays renderable after first being culled in its hidden spawn pose', async () => {
    await loadCyborgTestAssets();
    const avatar = new CyborgAvatar(0x44aacc);
    const shell = new THREE.Group();
    shell.add(avatar.root);
    avatar.root.scale.setScalar(CYBORG_SCALE);
    avatar.root.rotation.y = Math.PI;
    const camera = new THREE.PerspectiveCamera(75,16/9,.1,1500);
    camera.position.y = PLAYER_HEIGHT;
    camera.updateMatrixWorld(true);
    const frustum = new THREE.Frustum().setFromProjectionMatrix(
        new THREE.Matrix4().multiplyMatrices(camera.projectionMatrix,camera.matrixWorldInverse));
    try {
        for (const firstPerson of [false,true]) {
            avatar.setFirstPerson(firstPerson);
            avatar.pose({body:'Spawn',bodyTime:.02,weapon:'AR'});
            avatar.root.updateMatrixWorld(true);
            const meshes: THREE.SkinnedMesh[] = [];
            avatar.root.traverseVisible(node => {
                if (!(node instanceof THREE.SkinnedMesh)) return;
                const g = node.geometry, ids = g.getAttribute('skinIndex');
                const carried = node.skeleton.bones.map((bone: THREE.Object3D) => {
                    for (let b: THREE.Object3D | null = bone;b;b=b.parent) if (b.name==='GrappleCarry') return true;
                    return false;
                });
                for (let i=0;i<(g.index?.count ?? ids.count);i++) {
                    if (!carried[ids.getX(g.index?.getX(i) ?? i)]) continue;
                    meshes.push(node);
                    node.computeBoundingSphere();
                    break;
                }
            });
            assert.ok(meshes.length>0, 'test must exercise visible launcher primitives');
            avatar.pose({body:'Idle.Armed',bodyTime:0,weapon:'AR',grapple:'Grapple.Held'});
            avatar.root.updateMatrixWorld(true);
            for (const mesh of meshes) {
                assert.ok(!mesh.frustumCulled || frustum.intersectsObject(mesh),
                    mesh.name+' disappeared after the launcher was drawn');
            }
        }
    } finally { avatar.dispose(); }
});

test('first-person katana stays smoothly bounded during locomotion and restores its physical pose', async () => {
    await loadCyborgTestAssets();
    const avatar = new CyborgAvatar(0x44aacc), shell = new THREE.Group();
    shell.add(avatar.root);
    avatar.root.scale.setScalar(CYBORG_SCALE);
    avatar.root.rotation.y = Math.PI;
    avatar.root.position.y = PLAYER_BODY_CAMERA_OFFSET - PLAYER_HEIGHT;
    avatar.setFirstPerson(true);
    const frame = new FirstPersonReloadFrame();
    const camera = new THREE.PerspectiveCamera(75, 16/9, .1, 1500);
    const tip = new THREE.Vector3(), reference = new THREE.Vector3(), physical = new THREE.Vector3();
    try {
        for (const [i, body] of ['Idle.Armed', 'Run.Forward', 'Run.Left', 'Run.Right', 'Jump.Fall', 'Hover.Hold'].entries()) {
            const pitch = i % 2 ? .55 : -.4;
            camera.position.set(i * 3, PLAYER_HEIGHT, -i * 5);
            camera.rotation.set(pitch, i * .7, 0, 'YXZ');
            camera.updateMatrixWorld(true);
            shell.position.copy(camera.position).y -= PLAYER_BODY_CAMERA_OFFSET;
            shell.rotation.y = i * .7;
            const pose = { body, bodyTime: .15 + i * .07, weapon: 'KATANA', action: 'Ready', actionTime: 0, pitch };
            avatar.pose(pose);
            avatar.tip.getWorldPosition(physical);
            frame.begin(avatar, camera, pose, 1/60);
            assert.equal(avatar.root.visible, false, 'katana renders in the foreground pass outside world motion blur');
            avatar.tip.getWorldPosition(tip).applyMatrix4(frame.camera.matrixWorldInverse);
            if (i === 0) reference.copy(tip);
            assert.ok(tip.distanceTo(reference) < .05, `katana blade jumped during ${body}: ${tip.distanceTo(reference)}`);
            frame.restore();
            assert.equal(avatar.root.visible, true);
            assert.ok(avatar.tip.getWorldPosition(tip).distanceTo(physical) < 1e-8, 'physical blade pose restored');
        }
    } finally { frame.clear(); avatar.dispose(); }
});
