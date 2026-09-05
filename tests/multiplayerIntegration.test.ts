import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { state } from '../src/state.ts';
import { hostGame, joinGame, disconnectMultiplayer, broadcastToAll, authorizeClientPacket } from '../src/multiplayer.ts';
import { Peer, Connection } from './fakePeer.ts';
import worker, { TurnRateLimiter } from '../src/worker.ts';
import { TurnRoomStateMachine } from '../src/turnRoom.ts';
import { registerTurnSession } from '../src/turnSecurity.ts';

(globalThis as any).document={getElementById:()=>null,createElement:()=>({getContext:()=>null})};
class Storage {
    values=new Map<string,unknown>();
    async get<T>(key:string){return structuredClone(this.values.get(key)) as T|undefined;}
    async put(key:string,value:unknown){this.values.set(key,structuredClone(value));}
    async setAlarm(_time:number){}
    async deleteAll(){this.values.clear();}
}
function namespace(factory:(s:any)=>any){
    const objects=new Map<string,any>();return {idFromName:(s:string)=>s,get:(id:string)=>{
        if(!objects.has(id))objects.set(id,factory({storage:new Storage()}));
        return {fetch:(url:string,init:any)=>objects.get(id).fetch(new Request(url,init))};
    }};
}
function backend(){
    const env:any={TURN_KEY_ID:'key',TURN_KEY_API_TOKEN:'secret',TURNSTILE_SECRET_KEY:'secret',TURNSTILE_SITE_KEY:'site',TURNSTILE_HOSTNAME:'local',
        ACTIVE_TURN_ROOM:namespace(s=>new TurnRoomStateMachine(s,5)),TURN_RATE_LIMITER:namespace(s=>new TurnRateLimiter(s)),ASSETS:{fetch:()=>new Response('missing',{status:404})}};
    globalThis.fetch=(async(input:any,init:any)=>{
        const url=String(input);
        if(url.includes('siteverify'))return Response.json({success:true,hostname:'local',action:new URLSearchParams(init.body).get('response')});
        if(url.includes('generate-ice-servers'))return Response.json({iceServers:[{urls:'stun:local'}]});
        return worker.fetch(new Request(new URL(url,'https://local'),init),env);
    }) as typeof fetch;
}
const tick=()=>new Promise(resolve=>setTimeout(resolve,0));
function update(name:string,lifeId=0){return {type:'update' as const,lifeId,username:name,pos:{x:0,y:2,z:0},yaw:0,pitch:0,activeWeapon:'SNIPER' as const,isMouseDown:false,isDead:false,hookState:'IDLE' as const,hookPos:null,isHovering:false,hoverKeys:null};}

test('Worker-backed host admission, fixed names, host kill credit, departure and stale events',async()=>{
    backend();state.scene=null;
    try {
        await hostGame('Host','ABCDEFGH','create-room');const host=Peer.latest;
        const denied=new Connection('intruder');host.emit('connection',denied);await tick();assert.equal(denied.open,false);assert.equal(denied.sent.length,0);
        await assert.rejects(registerTurnSession('ABCDEFGH','join-room','host','duplicate'),/username/);
        const a=await registerTurnSession('ABCDEFGH','join-room','Pilot','peer-a');
        const b=await registerTurnSession('ABCDEFGH','join-room','Other','peer-b');
        const ca=new Connection('peer-a',{admissionToken:a.admissionToken});const cb=new Connection('peer-b',{admissionToken:b.admissionToken});
        host.emit('connection',ca);host.emit('connection',cb);await tick();await tick();
        assert.equal(state.connections.length,2);assert.equal(ca.sent[0].proof,a.admissionProof);assert.equal(ca.sent[1].type,'world_snapshot');
        state.scene=new THREE.Scene();state.isPlaying=true;
        ca.emit('data',update('Forged'));cb.emit('data',update('Other'));
        assert.equal(cb.sent.find(p=>p.type==='update').username,'Pilot');
        broadcastToAll({type:'player_hit',shotId:1,pelletIndex:0,targetPeerId:'peer-a',damage:10,attackerName:'Host'});
        const death={type:'player_died' as const,lifeId:0,cause:'player' as const,killerPeerId:host.id,killerName:'Host',victimName:'Pilot',victimPeerId:'peer-a'};
        ca.emit('data',death);assert.equal(state.kills,1);ca.emit('data',death);assert.equal(state.kills,1);
        assert.equal(authorizeClientPacket('peer-a',{type:'fire',weapon:'SNIPER',shotId:2,spreadSeed:1,barrelPos:{x:0,y:2,z:0},dir:{x:0,y:0,z:-1}}),null);
        ca.close();await tick();assert.ok(cb.sent.some(p=>p.type==='peer_left'&&p.peerId==='peer-a'));
        assert.ok(await registerTurnSession('ABCDEFGH','join-room','pilot','peer-new'));
        disconnectMultiplayer();state.scene=null;
        await hostGame('NewHost','JKLMNPQR','create-room');
        cb.emit('error',new Error('old'));cb.emit('close');cb.emit('data',update('Old'));
        assert.equal(state.isMultiplayer,true);assert.equal(state.roomCode,'JKLMNPQR');assert.equal(state.peerIds.length,0);
    } finally {disconnectMultiplayer();}
});

test('client rejects host without proof and applies kills while waiting to play',async()=>{
    backend();state.scene=null;
    // Register a host directly; this test owns the client singleton.
    const response=await fetch('/api/rooms',{method:'POST',body:JSON.stringify({room:'ABCDEFGH',turnstileToken:'create-room',username:'Host',peerId:'testfps-room-ABCDEFGH'})});
    const host=await response.json() as any;
    try{
        await joinGame('Pilot','ABCDEFGH','join-room');let peer=Peer.latest;peer.emit('open',peer.id);let conn=peer.connections['testfps-room-ABCDEFGH'][0];
        conn.emit('data',{type:'world_snapshot',seed:1,score:0,targets:[]});assert.equal(state.isMultiplayer,false);
        await joinGame('Pilot','ABCDEFGH','join-room');peer=Peer.latest;peer.emit('open',peer.id);conn=peer.connections['testfps-room-ABCDEFGH'][0];
        const admitted=await fetch('/api/room-admissions/ABCDEFGH',{method:'POST',headers:{Authorization:`Bearer ${host.closeToken}`},body:JSON.stringify({peerId:peer.id,admissionToken:(conn.metadata as any).admissionToken})});
        const admission=await admitted.json() as any;conn.emit('data',{type:'admission',proof:admission.admissionProof});
        conn.emit('data',{type:'world_snapshot',seed:1,score:0,targets:[]});
        assert.equal(state.isPlaying,false);
        const target=new THREE.Group();target.userData={scale:1,index:0,bodyMesh:new THREE.Mesh(new THREE.BoxGeometry(),new THREE.MeshStandardMaterial()),healthBarFg:new THREE.Mesh(),healthBarGroup:new THREE.Group()};state.targets=[target];
        conn.emit('data',{type:'kill_target',targetIndex:0,score:7,newPosition:{x:50,y:20,z:0},scale:3,hp:3,color:123});
        assert.equal(state.score,7);assert.equal(target.position.x,50);assert.equal(target.userData.hp,3);
        state.targets=[];
    }finally{disconnectMultiplayer();}
});

test('unopened PeerJS channel timeout frees host lobby capacity even without a close event',async(t)=>{
    backend();state.scene=null;t.mock.timers.enable({apis:['setTimeout','setInterval']});
    try{
        await hostGame('Host','ABCDEFGH','create-room');const host=Peer.latest;host.emit('open',host.id);
        const pending=new Connection('pending');pending.open=false;host.emit('connection',pending);
        t.mock.timers.tick(20_000);
        for(let i=0;i<4;i++){
            const replacement=new Connection(`pending-${i}`);replacement.open=false;host.emit('connection',replacement);
            assert.ok(replacement.handlers.has('open'),'each of the four available slots can be reserved');
        }
    }finally{disconnectMultiplayer();}
});
