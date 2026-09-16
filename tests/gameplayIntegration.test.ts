import { touchMove } from '../src/inputSession.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { state } from '../src/state.ts';
import { updatePlayerPhysics } from '../src/physics.ts';
import { updateProjectiles, resetProjectiles } from '../src/projectiles.ts';
import { rebuildTargetHash } from '../src/world.ts';
import { BULLET_TRAVEL_DISTANCE } from '../src/config.ts';
import { setDamageHandlers } from '../src/damage.ts';
import { buildBeanModel } from '../src/weapons.ts';
import { setWeaponNetworkPort } from '../src/weaponNetworkPort.ts';
import type { NetworkPacket } from '../src/networkTypes.ts';
(globalThis as any).document={getElementById:()=>null};
test('50ms enemy-grapple movement stops at pillar instead of crossing it',()=>{
    state.scene=new THREE.Scene();state.camera=new THREE.PerspectiveCamera();state.camera.position.set(-5,2,0);
    state.controls={isLocked:true,getObject:()=>state.camera} as any;
    state.velocity.set(225,0,0);state.hookState='PULLING';state.hookIsEnemy=true;
    const wall=new THREE.Object3D();wall.position.set(0,5,0);wall.userData={height:10,halfW:3,halfD:3,halfH:5};state.obstacles=[wall];
    updatePlayerPhysics(.05);assert.ok(state.camera.position.x<=-3.8);assert.equal(state.velocity.x,0);
    state.obstacles=[];state.hookState='IDLE';
});

test('diagonal movement slides along a pillar corner without entering it', () => {
    state.scene = new THREE.Scene();
    state.camera = new THREE.PerspectiveCamera();
    state.camera.position.set(3.81, 2, 3.81);
    state.controls = { isLocked: true, getObject: () => state.camera } as any;
    state.isPlaying = true;
    state.canJump = false;
    state.isShiftDown = false;
    state.isHovering = false;
    state.hookState = 'IDLE';
    state.moveForward = state.moveBackward = state.moveLeft = state.moveRight = false;
    state.velocity.set(-1, 0, -1);

    const pillar = new THREE.Object3D();
    pillar.position.set(0, 5, 0);
    pillar.userData = { height: 10, halfW: 3, halfD: 3, halfH: 5 };
    state.obstacles = [pillar];

    updatePlayerPhysics(0.016);

    const collisionExtent = 3.8;
    assert.equal(
        Math.abs(state.camera.position.x) < collisionExtent && Math.abs(state.camera.position.z) < collisionExtent,
        false
    );
    assert.notEqual(state.velocity.x, 0);
    assert.equal(state.velocity.z, 0);

    state.obstacles = [];
});

test('invisible live targets retain projectile collision',()=>{
    state.scene=new THREE.Scene();state.isMultiplayer=false;state.peerIds=[];
    const target=new THREE.Group();target.position.set(0,2,-5);target.userData={index:0,scale:1};target.visible=false;state.targets=[target];rebuildTargetHash();
    let hits=0;setDamageHandlers(()=>hits++,()=>{});
    const bullet=new THREE.Object3D();bullet.position.set(0,2,0);bullet.userData={dx:0,dy:0,dz:-1,age:0,damage:1,visualOnly:false};state.projectiles=[bullet];
    updateProjectiles(.02,'Pilot');assert.equal(hits,1);resetProjectiles();state.targets=[];rebuildTargetHash();
});

test('projectiles cap their final swept segment at the shared bullet range',()=>{
    state.scene=new THREE.Scene();state.isMultiplayer=false;state.peerIds=[];state.obstacles=[];state.targets=[];rebuildTargetHash();
    state.projectilePool=[];
    const bullet=new THREE.Object3D();bullet.position.set(0,2,-0.1);
    bullet.userData={dx:0,dy:0,dz:-1,age:0,distanceTraveled:0.1,damage:1,visualOnly:false};
    state.projectiles=[bullet];
    updateProjectiles(1.05,'Pilot');
    assert.equal(state.projectiles.length,0);
    assert.ok(Math.abs(bullet.position.z+BULLET_TRAVEL_DISTANCE)<1e-9);
    assert.equal(bullet.userData.distanceTraveled,BULLET_TRAVEL_DISTANCE);
    assert.equal(state.projectilePool[0],bullet);
    state.projectilePool=[];
});

test('real projectile updates hit the top and bottom of the bean cuboid', () => {
    state.scene = new THREE.Scene();
    state.isMultiplayer = true;
    state.isHost = false;
    state.obstacles = [];
    state.targets = [];
    rebuildTargetHash();
    state.projectilePool = [];

    const mesh = buildBeanModel(0x8c7ae6, 0xff4757);
    mesh.scale.setScalar(1.5);
    mesh.position.set(0, 1.65, -5);
    state.scene.add(mesh);
    state.peers = { remote: { mesh, hp: 10, lifeId: 4 } as any };
    state.peerIds = ['remote'];

    const packets: NetworkPacket[] = [];
    setWeaponNetworkPort({
        broadcastToAll: packet => packets.push(packet),
        broadcastLocalFire: () => {},
        flashPeerMesh: () => {},
    });

    for (const y of [0.1, 3.2]) {
        const bullet = new THREE.Object3D();
        bullet.position.set(0, y, 0);
        bullet.userData = {
            dx: 0, dy: 0, dz: -1, age: 0, distanceTraveled: 0,
            damage: 1, visualOnly: false, shotId: packets.length + 1, pelletIndex: 0,
        };
        state.projectiles = [bullet];
        updateProjectiles(0.01, 'Pilot');
        assert.equal(state.projectiles.length, 0, `${y} height projectile is consumed by the cuboid`);
    }

    const hits = packets.filter(packet => packet.type === 'player_hit');
    assert.equal(hits.length, 2);
    assert.deepEqual(hits.map(packet => packet.type === 'player_hit' && packet.targetLifeId), [4, 4]);

    state.projectiles = [];
    state.projectilePool = [];
    state.peers = {};
    state.peerIds = [];
    state.isMultiplayer = false;
    state.scene = null;
    setWeaponNetworkPort({ broadcastToAll: () => {}, broadcastLocalFire: () => {}, flashPeerMesh: () => {} });
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
