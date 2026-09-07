import { touchMove } from '../src/inputSession.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { state } from '../src/state.ts';
import { updatePlayerPhysics } from '../src/physics.ts';
import { updateProjectiles, resetProjectiles } from '../src/projectiles.ts';
import { rebuildTargetHash } from '../src/world.ts';
import { setDamageHandlers } from '../src/damage.ts';
(globalThis as any).document={getElementById:()=>null};
test('50ms enemy-grapple movement stops at pillar instead of crossing it',()=>{
    state.scene=new THREE.Scene();state.camera=new THREE.PerspectiveCamera();state.camera.position.set(-5,2,0);
    state.controls={isLocked:true,getObject:()=>state.camera} as any;
    state.velocity.set(225,0,0);state.hookState='PULLING';state.hookIsEnemy=true;
    const wall=new THREE.Object3D();wall.position.set(0,5,0);wall.userData={height:10,halfW:3,halfD:3,halfH:5};state.obstacles=[wall];
    updatePlayerPhysics(.05);assert.ok(state.camera.position.x<=-3.8);assert.equal(state.velocity.x,0);
    state.obstacles=[];state.hookState='IDLE';
});
test('invisible live targets retain projectile collision',()=>{
    state.scene=new THREE.Scene();state.isMultiplayer=false;state.peerIds=[];
    const target=new THREE.Group();target.position.set(0,2,-5);target.userData={index:0,scale:1};target.visible=false;state.targets=[target];rebuildTargetHash();
    let hits=0;setDamageHandlers(()=>hits++,()=>{});
    const bullet=new THREE.Object3D();bullet.position.set(0,2,0);bullet.userData={dx:0,dy:0,dz:-1,age:0,damage:1,visualOnly:false};state.projectiles=[bullet];
    updateProjectiles(.02,'Pilot');assert.equal(hits,1);resetProjectiles();state.targets=[];rebuildTargetHash();
});

test('analog movement preserves partial speed, caps diagonals and is ignored while paused', () => {
    const run = (x: number, y: number, locked = true) => {
        state.scene = new THREE.Scene();
        state.camera = new THREE.PerspectiveCamera();
        state.camera.position.set(30, 2, 30);
        state.controls = { isLocked: locked, getObject: () => state.camera } as any;
        state.isPlaying = true;
        state.canJump = true;
        state.isShiftDown = false;
        state.isHovering = false;
        state.hookState = 'IDLE';
        state.moveForward = state.moveBackward = state.moveLeft = state.moveRight = false;
        state.obstacles = [];
        state.velocity.set(0, 0, 0);
        touchMove.x = x; touchMove.y = y;
        updatePlayerPhysics(0.01);
        return Math.hypot(state.velocity.x, state.velocity.z);
    };
    const full = run(1, 0);
    assert.ok(full > 0);
    assert.ok(Math.abs(run(0.5, 0) / full - 0.5) < 0.01);
    assert.ok(Math.abs(run(1, 1) - full) < 0.001);
    assert.equal(run(1, 0, false), 0);
    touchMove.x = touchMove.y = 0;
});

test('normal jumps reach 90% of player height across frame rates and reset on landing', async () => {
    const { NORMAL_JUMP_FORCE, PLAYER_HEIGHT } = await import('../src/config.ts');
    for (const fps of [30, 60, 120, 240]) {
        state.camera = new THREE.PerspectiveCamera();
        state.camera.position.set(30, PLAYER_HEIGHT, 30);
        state.controls = { isLocked: true, getObject: () => state.camera } as any;
        state.isPlaying = true;
        state.canJump = false;
        state.normalJumpActive = true;
        state.powerJumpEnabled = true; // Toggling mid-flight must not change this jump.
        state.isShiftDown = state.isHovering = false;
        state.hookState = 'IDLE';
        state.moveForward = state.moveBackward = state.moveLeft = state.moveRight = false;
        state.obstacles = [];
        state.velocity.set(0, NORMAL_JUMP_FORCE, 0);
        let peak = 0;
        for (let frame = 0; frame < fps; frame++) {
            updatePlayerPhysics(1 / fps);
            peak = Math.max(peak, state.camera.position.y - PLAYER_HEIGHT);
            if (state.canJump) break;
        }
        assert.ok(Math.abs(peak - PLAYER_HEIGHT * 0.9) < 0.06, `${fps} FPS: peak ${peak}`);
        assert.equal(state.canJump, true);
        assert.equal(state.normalJumpActive, false);
        assert.equal(state.camera.position.y, PLAYER_HEIGHT);
    }
});
