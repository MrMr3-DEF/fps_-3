// Development-only fixture: production combat, input, models and UI; no saved settings.
import * as THREE from 'three';
import { updateKatanaModel } from '/src/katanaModel.ts';
import { state } from '/src/state.ts';
import { userSettings } from '/src/settings.ts';
import { setTouchMode, beginInput } from '/src/inputSession.ts';
import { katanaInput, cancelKatana } from '/src/katana.ts';
import { setThirdPerson } from '/src/weapons.ts';
import { rebuildTargetHash } from '/src/world.ts';
userSettings.mobileInput='touch';setTouchMode(true);document.documentElement.requestFullscreen=async()=>{};
let review: {charge:number; swing:number|null} | null = null;
let reviewScene:THREE.Scene|null=null;
let timer:ReturnType<typeof setTimeout>|undefined, fixed=false, clear=false;
window.addEventListener('katana-review',event=>{
    const action=(event as CustomEvent).detail;
    if(timer)clearTimeout(timer);
    if(action==='live'){beginInput();review=null;return;}
    if(typeof action==='string' && (action.startsWith('pose:') || action.startsWith('charge:'))){
        beginInput();cancelKatana();review=action.startsWith('pose:')?{charge:0,swing:Number(action.slice(5))}:{charge:Number(action.slice(7)),swing:null};return;
    }
    if(['tap','charged','hold','leave','start'].includes(action))review=null;
    if(action==='start'){document.getElementById('btn-play-sp')!.click();return;}
    if(action==='leave'){cancelKatana();fixed=false;document.getElementById('btn-pause-leave')!.click();return;}
    beginInput();
    if(action==='setup'){
        fixed=true; state.camera!.position.set(600,40,600);state.camera!.rotation.set(0,0,0);state.velocity.set(0,0,0);
        window.dispatchEvent(new KeyboardEvent('keydown',{code:'KeyV'}));window.dispatchEvent(new KeyboardEvent('keyup',{code:'KeyV'}));
        state.targets.slice(0,3).forEach((target,i)=>{target.position.set(600+(i===2?0:(i===0?-.65:.65)),39.65,600+(i===2?-5:-1.8));target.scale.setScalar(1); target.updateMatrixWorld(true); const size=new THREE.Box3().setFromObject(target.userData.bodyMesh,true).getSize(new THREE.Vector3()); target.scale.setScalar(.7/Math.max(size.x,size.y,size.z));target.userData.scale=target.scale.x;target.userData.hp=target.userData.maxHp=50;target.visible=true;target.updateMatrixWorld(true);});rebuildTargetHash();
    }
    if(action==='clear') clear=!clear;
    if(action==='third')setThirdPerson(!state.isThirdPerson);
    if(action==='gentle')userSettings.photosensitivityMode=!userSettings.photosensitivityMode;
    if(['tap','charged','hold'].includes(action)){
        katanaInput(true);if(action!=='hold')timer=setTimeout(()=>katanaInput(false),action==='tap'?60:3300);
    }
});
function frame(){
    if(state.scene && reviewScene!==state.scene){
        const scene=state.scene;
        reviewScene=scene;
        const original=scene.onBeforeRender;
        // Override before visibility traversal, so paused effects enter the render list.
        scene.onBeforeRender=(...args)=>{
            original.apply(scene,args);
            if(review && state.katanaMesh){
                updateKatanaModel(state.katanaMesh,review.charge,review.swing,true,10,userSettings.photosensitivityMode);
                state.katanaMesh.updateMatrixWorld(true);
            }
        };
    }
    if(fixed && state.isPlaying){state.camera!.position.set(600,40,600);state.velocity.set(0,0,0);
        state.targets.slice(0,3).forEach((target,i)=>{target.position.set(600+(clear?30:0)+(i===2?0:(i===0?-.65:.65)),39.65,600+(i===2?-5:-1.8));target.updateMatrixWorld(true);});rebuildTargetHash();
    }
    parent.document.getElementById('status')!.textContent=`Playing: ${state.isPlaying}; weapon: ${state.activeWeaponName}; phase: ${state.switchState}; targets HP: ${state.targets.slice(0,3).map(t=>t.userData.hp).join(', ')}; gentle: ${userSettings.photosensitivityMode}; view: ${state.isThirdPerson?'third':'first'}`;
    requestAnimationFrame(frame);
}frame();
