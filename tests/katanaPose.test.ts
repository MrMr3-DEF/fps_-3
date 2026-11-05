import { katanaBrightness, katanaEmission } from '../src/katanaFlicker.ts';
import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { buildKatana, sampleKatanaPose, updateKatanaModel } from '../src/katanaModel.ts';
import { KatanaClock } from '../src/katanaCombat.ts';
import { KATANA } from '../src/config.ts';
const dispose = (root:THREE.Object3D) => root.traverse((o:any)=>{o.geometry?.dispose();o.material?.dispose();});
test('swing crosses forward at impact, pivots at grip and restores exact rest',()=>{
    const sword=new THREE.Group();sampleKatanaPose(sword,null);
    const position=sword.position.clone(),rotation=sword.quaternion.clone();
    sampleKatanaPose(sword,KATANA.impact);
    const direction=new THREE.Vector3(0,1,0).applyQuaternion(sword.quaternion);
    assert.ok(direction.distanceTo(new THREE.Vector3(0,0,-1))<1e-6);
    assert.ok(Math.abs(sword.position.x+.32)<1e-6);
    sword.updateMatrixWorld(true);
    assert.ok(new THREE.Vector3().applyMatrix4(sword.matrixWorld).distanceTo(sword.position)<1e-6);
    for(const t of [.6,1,null]){sampleKatanaPose(sword,t);assert.deepEqual(sword.position,position);assert.deepEqual(sword.quaternion.toArray(),rotation.toArray());}
});
test('swing is continuous at phase boundaries and independent of sample rate',()=>{
    const a=new THREE.Group(),b=new THREE.Group();
    for(const boundary of [0,.1,.2,.3,.6]){
        sampleKatanaPose(a,Math.max(0,boundary-1e-5));sampleKatanaPose(b,boundary+1e-5);
        assert.ok(a.position.distanceTo(b.position)<.001);
        assert.ok(a.quaternion.angleTo(b.quaternion)<.001);
    }
    for(const rate of [30,60,144]){
        for(let i=0;i<rate*.45;i++)sampleKatanaPose(a,i/rate);
        sampleKatanaPose(a,.45);sampleKatanaPose(b,.45);
        assert.deepEqual(a.position,b.position);assert.deepEqual(a.quaternion.toArray(),b.quaternion.toArray());
    }
});
test('charged release retains bright effects through cut then fades and clears',()=>{
    const model=buildKatana();
    for(const t of [0,.1,.18,.3,.35]){
        updateKatanaModel(model,0,t,true,10,true);
        assert.equal(model.userData.lightning.visible,true);
        assert.equal(model.userData.blade.material.emissiveIntensity,katanaEmission(0,true));
    }
    updateKatanaModel(model,0,.475,true,10,true);
    assert.ok(Math.abs(model.userData.blade.material.emissiveIntensity-katanaEmission(0,true)/2)<1e-6);
    updateKatanaModel(model,0,.6,true,10,true);
    assert.equal(model.userData.lightning.visible,false);
    assert.equal(model.userData.blade.material.emissiveIntensity,0);
    updateKatanaModel(model,0,null,true,10,false);
    assert.equal(model.userData.lightning.visible,false);
    dispose(model);
});
test('fixed flicker loops, stays below white, and spends most time at 60–80 percent',()=>{
    let mid=0, min=1, max=0;
    for(let i=0;i<8000;i++){
        const t=i/1000, value=katanaBrightness(t);
        assert.ok(value>=.5 && value<=.9);
        assert.ok(Math.abs(value-katanaBrightness(t+8))<1e-10);
        if(value>=.6 && value<=.8)mid++;
        min=Math.min(min,value);max=Math.max(max,value);
    }
    assert.ok(mid/8000>=.8);assert.ok(min<.6 && max>.8);
    assert.equal(katanaBrightness(17,true),.7);
    const model=buildKatana();
    for(const charge of [0,1.5,2.999]){
        updateKatanaModel(model,charge,null,false,50,false);
        assert.equal(model.userData.blade.material.emissiveIntensity,0);
    }
    updateKatanaModel(model,4.2,null,true,50,false);
    const held=model.userData.blade.material.emissiveIntensity;
    updateKatanaModel(model,0,0,true,99,false,1.2);
    assert.ok(Math.abs(held-model.userData.blade.material.emissiveIntensity)<1e-12);
    updateKatanaModel(model,3,null,true,999,false);
    assert.equal(model.userData.blade.material.emissiveIntensity,katanaEmission(0));
    updateKatanaModel(model,3,null,true,999,true);
    assert.equal(model.userData.blade.material.emissiveIntensity,katanaEmission(0,true));
    dispose(model);
});
test('cancellation suppresses presentation without bypassing recovery cooldown',()=>{
    const clock=new KatanaClock();clock.begin(0);clock.release(3);clock.cancel();
    assert.equal(clock.cancelled,true);assert.equal(clock.released,3);
    assert.equal(clock.begin(3.2),false);assert.equal(clock.impact(3.2),false);
    assert.equal(clock.begin(3.6),true);assert.equal(clock.cancelled,false);
});

test('both cuts are horizontal; charged cut holds until .35 and shares exact .6 end',()=>{
    for(const charged of [false,true]) {
        const sword=new THREE.Group(), rest=new THREE.Group();sampleKatanaPose(rest,null);
        const end=charged?.18:.3;
        for(let i=0;i<=20;i++){
            sampleKatanaPose(sword,.1+(end-.1)*i/20,charged);
            assert.ok(Math.abs(sword.position.y+.12)<1e-8);
            assert.ok(Math.abs(new THREE.Vector3(0,1,0).applyQuaternion(sword.quaternion).y)<1e-8);
        }
        sampleKatanaPose(sword,charged?.14:.2,charged);
        assert.ok(new THREE.Vector3(0,1,0).applyQuaternion(sword.quaternion).distanceTo(new THREE.Vector3(0,0,-1))<1e-8);
        for(const boundary of [0,.1,end,...(charged?[.35]:[]),.6]) {
            const a=new THREE.Group(),b=new THREE.Group();
            sampleKatanaPose(a,Math.max(0,boundary-1e-6),charged);sampleKatanaPose(b,boundary+1e-6,charged);
            assert.ok(a.position.distanceTo(b.position)<1e-4);assert.ok(a.quaternion.angleTo(b.quaternion)<1e-4);
        }
        sampleKatanaPose(sword,.6,charged);assert.deepEqual(sword.position,rest.position);assert.deepEqual(sword.quaternion.toArray(),rest.quaternion.toArray());
    }
    const a=new THREE.Group(),b=new THREE.Group();sampleKatanaPose(a,.18,true);
    for(const t of [.2,.25,.3,.349]){sampleKatanaPose(b,t,true);assert.ok(a.position.distanceTo(b.position)<1e-10);assert.ok(a.quaternion.angleTo(b.quaternion)<1e-7);}
});
test('charged visual impact happens once at .14 without changing damage window',()=>{
    const clock=new KatanaClock();clock.begin(0);clock.release(3);
    assert.equal(clock.impact(3.139),false);assert.equal(clock.impact(3.14),true);assert.equal(clock.impact(3.2),false);
    assert.equal(clock.damageActive(3.4),true);assert.equal(clock.damageActive(3.401),false);
});
