import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { getTownSpawn } from '../src/town.ts';
import { getWorldSeed, rebuildTargetHash } from '../src/world.ts';
import { state } from '../src/state.ts';
import { setMultiplayerWorldLoader, onMultiplayerDisconnected, hostGame, joinGame, disconnectMultiplayer, broadcastToAll, startHostMatch, authorizeClientPacket, sendLocalState, updateRemotePeers } from '../src/multiplayer.ts';
import { BULLET_TRAVEL_DISTANCE, PLAYER_MAX_HP, NETWORK_MOVEMENT_BURST, NETWORK_MOVEMENT_SPEED } from '../src/config.ts';
import { Peer, Connection } from './fakePeer.ts';
import worker, { TurnRateLimiter } from '../src/worker.ts';
import { TurnRoomStateMachine } from '../src/turnRoom.ts';
import { registerTurnSession } from '../src/turnSecurity.ts';
import { parseNetworkPacket } from '../src/networkTypes.ts';
import { SHARED_BODY_MAT } from '../src/weapons.ts';

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
function update(name:string,lifeId=0){return {type:'update' as const,lifeId,username:name,pos:{x:0,y:2,z:0},yaw:0,pitch:0,activeWeapon:'SNIPER' as const,switchState:'IDLE' as const,nextWeapon:null,isMouseDown:false,isDead:false,hookState:'IDLE' as const,hookPos:null,isHovering:false,hoverKeys:null,hp:PLAYER_MAX_HP,maxHp:PLAYER_MAX_HP};}

test('termination reports once after invalidating stale signalling and preparation work', async () => {
    backend(); state.scene = null;
    const exits: { wasHost: boolean; reason: string | null }[] = [];
    const unsubscribe = onMultiplayerDisconnected(event => {
        assert.equal(state.isMultiplayer, false);
        assert.equal(state.peer, null);
        exits.push(event);
        disconnectMultiplayer(); // A composition-root teardown cannot recurse.
    });
    try {
        await hostGame('Host', 'ABCDEFGH', 'create-room');
        const old = Peer.latest;
        old.emit('disconnected'); old.emit('close'); old.emit('error', { type: 'network' });
        assert.equal(exits.length, 1);
        assert.equal(exits[0].wasHost, true);
        assert.match(exits[0].reason!, /signalling connection/);
        backend();
        await hostGame('Host', 'JKLMNPQR', 'create-room');
        old.emit('close');
        assert.equal(state.isMultiplayer, true);
        disconnectMultiplayer({ notifyRuntime: false });
        assert.equal(exits.length, 1, 'explicit composition-root teardown does not report back');

        backend();
        let finish!: () => void;
        setMultiplayerWorldLoader(() => new Promise(resolve => { finish = resolve; }));
        const pending = hostGame('Host', 'ABCDEFGH', 'create-room');
        for (let i = 0; i < 20 && !finish; i++) await tick();
        assert.ok(finish);
        disconnectMultiplayer();
        assert.equal(exits.length, 2);
        finish(); await pending;
        assert.equal(state.peer, null, 'cancelled preparation cannot create another peer');
        assert.equal(exits.length, 2);
    } finally { unsubscribe(); setMultiplayerWorldLoader(null); disconnectMultiplayer(); }
});

test('world preparation failure reports its reason through the termination boundary', async () => {
    backend(); state.scene = null;
    let reason: string | null = null;
    const unsubscribe = onMultiplayerDisconnected(event => { reason = event.reason; });
    setMultiplayerWorldLoader(async () => { throw new Error('Preparation fixture failed'); });
    try {
        await assert.rejects(hostGame('Host', 'ABCDEFGH', 'create-room'), /Preparation fixture failed/);
        assert.equal(reason, 'Preparation fixture failed');
        assert.equal(state.isMultiplayer, false);
    } finally { unsubscribe(); setMultiplayerWorldLoader(null); disconnectMultiplayer(); }
});

test('host movement allowance bounds cumulative bursts, capped silence and life transitions', async t => {
    backend(); state.scene = null;
    let now = 1000;
    t.mock.method(performance, 'now', () => now);
    try {
        await hostGame('Host', 'ABCDEFGH', 'create-room');
        const admission = await registerTurnSession('ABCDEFGH', 'join-room', 'Pilot', 'moving-peer');
        Peer.latest.emit('connection', new Connection('moving-peer', { admissionToken: admission.admissionToken }));
        await tick(); await tick();
        const send = (x: number, rest = {}) => authorizeClientPacket('moving-peer', { ...update('Pilot'), pos: { x, y: 2, z: 0 }, ...rest });
        assert.ok(send(0));
        let x = 0;
        for (let i = 0; i < 200; i++) if (send(x + 1)) x++;
        assert.equal(x, Math.floor(NETWORK_MOVEMENT_BURST), 'packet count cannot grant new distance');
        assert.equal(send(x + NETWORK_MOVEMENT_BURST, { isDead: true, hp: 0, activeWeapon: 'PISTOL' }), null);
        assert.equal(send(NaN), null);
        assert.ok(authorizeClientPacket('moving-peer', { type: 'fire', weapon: 'SNIPER', shotId: 1, spreadSeed: 1,
            barrelPos: { x, y: 2, z: 0 }, dir: { x: 0, y: 0, z: -1 } }),
        'a rejected update cannot mutate death, weapon or shot state');
        for (let i = 0; i < 10; i++) {
            now += 33;
            x += NETWORK_MOVEMENT_SPEED * 0.033;
            assert.ok(send(x), 'the fastest supported travel remains admissible at the network tick');
        }
        now += 60_000;
        x += NETWORK_MOVEMENT_BURST;
        assert.ok(send(x), 'silence replenishes a bounded burst');
        assert.equal(send(x + 1), null, 'a long silence does not bank an unbounded allowance');
        assert.ok(authorizeClientPacket('moving-peer', { type: 'player_died', lifeId: 0, cause: 'lava', killerPeerId: null,
            victimName: 'Pilot', killerName: 'Lava' }));
        assert.ok(send(-500, { lifeId: 1 }), 'an accepted respawn starts a new budget at its spawn');
        assert.ok(send(-500 + NETWORK_MOVEMENT_BURST, { lifeId: 1 }));
        assert.equal(send(-498 + NETWORK_MOVEMENT_BURST, { lifeId: 1 }), null);
        assert.equal(send(0, { lifeId: 2 }), null, 'an unreported extra life cannot reset the budget');
    } finally { disconnectMultiplayer(); }
});

test('the real host path canonicalizes shotgun pellets and rejects unfinished weapon changes', async t => {
    backend(); state.scene = null;
    let now = 1000;
    t.mock.method(performance, 'now', () => now);
    try {
        await hostGame('Host', 'ABCDEFGH', 'create-room');
        const clients: Connection[] = [];
        for (const username of ['Shooter', 'Viewer']) {
            const admission = await registerTurnSession('ABCDEFGH', 'join-room', username, username);
            const connection = new Connection(username, { admissionToken: admission.admissionToken });
            clients.push(connection); Peer.latest.emit('connection', connection);
        }
        await tick(); await tick(); startHostMatch();
        state.scene = new THREE.Scene();
        const shooter = clients[0], viewer = clients[1];
        const packet = { ...update('Shooter'), activeWeapon: 'SHOTGUN' as const };
        shooter.emit('data', packet);
        shooter.emit('data', { type: 'fire', weapon: 'SHOTGUN', shotId: 1, spreadSeed: 1, pelletCount: 16,
            barrelPos: { x: 0, y: 2, z: 0 }, dir: { x: 0, y: 0, z: -1 } });
        assert.equal(viewer.sent.filter(p => p.type === 'fire').at(-1).pelletCount, 5);
        assert.equal(state.projectiles.length, 5, 'the host renders the configured count too');
        now += 1000;
        shooter.emit('data', { ...packet, activeWeapon: 'PISTOL' });
        assert.equal(viewer.sent.filter(p => p.type === 'update').at(-1).activeWeapon, 'SHOTGUN');
        shooter.emit('data', { ...packet, switchState: 'WITHDRAWING', nextWeapon: 'PISTOL' });
        now += 150;
        shooter.emit('data', { ...packet, activeWeapon: 'PISTOL', switchState: 'BRINGING_IN', nextWeapon: 'PISTOL' });
        const pistol = { type: 'fire', weapon: 'PISTOL', shotId: 2, spreadSeed: 1,
            barrelPos: { x: 0, y: 2, z: 0 }, dir: { x: 0, y: 0, z: -1 } };
        shooter.emit('data', pistol);
        assert.equal(viewer.sent.filter(p => p.type === 'fire').length, 1, 'bring-in cannot fire');
        now += 150;
        shooter.emit('data', { ...packet, activeWeapon: 'PISTOL' }); shooter.emit('data', pistol);
        assert.equal(viewer.sent.filter(p => p.type === 'fire').length, 2);
    } finally { disconnectMultiplayer(); state.scene = null; }
});

test('Worker-backed host admission, fixed names, host kill credit, departure and stale events',async()=>{
    backend();state.scene=null;
    state.camera=new THREE.PerspectiveCamera();state.controls={getObject:()=>state.camera,unlock:()=>{}} as any;
    try {
        await hostGame('Host','ABCDEFGH','create-room');const host=Peer.latest;
        state.dayNightElapsedSeconds=137.25;
        const hostSpawn=getTownSpawn(getWorldSeed(),'house');
        assert.deepEqual(state.camera!.position.toArray(),[hostSpawn.x,2,hostSpawn.z]);
        const denied=new Connection('intruder');host.emit('connection',denied);await tick();assert.equal(denied.open,false);assert.equal(denied.sent.length,0);
        await assert.rejects(registerTurnSession('ABCDEFGH','join-room','host','duplicate'),/username/);
        const a=await registerTurnSession('ABCDEFGH','join-room','Pilot','peer-a');
        const b=await registerTurnSession('ABCDEFGH','join-room','Other','peer-b');
        const ca=new Connection('peer-a',{admissionToken:a.admissionToken});const cb=new Connection('peer-b',{admissionToken:b.admissionToken});
        host.emit('connection',ca);host.emit('connection',cb);await tick();await tick();
        assert.equal(state.connections.length,2);assert.equal(ca.sent[0].proof,a.admissionProof);assert.equal(ca.sent[1].type,'world_snapshot');
        assert.equal(ca.sent[1].spawnHouseSlot,1);assert.equal(cb.sent[1].spawnHouseSlot,2);
        assert.equal(ca.sent[1].dayNightElapsedSeconds,137.25);
        assert.deepEqual(state.lobbyPlayers.map(player => player.peerId),
            [host.id, ...state.connections.map(connection => connection.peer)], 'host admission order owns the lineup');
        assert.deepEqual(cb.sent.filter(packet => packet.type === 'lobby_roster').at(-1).players,
            state.lobbyPlayers, 'every guest receives the same ordered roster');
        ca.emit('data', { type: 'lobby_color', bodyColor: 0xdf5b64 });
        assert.equal(state.lobbyPlayers.find(player => player.peerId === 'peer-a')?.bodyColor, 0xdf5b64);
        assert.equal(cb.sent.filter(packet => packet.type === 'lobby_roster').at(-1).players[1].bodyColor, 0xdf5b64);
        ca.emit('data', { type: 'lobby_roster', players: [{ peerId: 'forged', username: 'Fake', bodyColor: 0 }] });
        assert.equal(state.lobbyPlayers[0].peerId, host.id, 'clients cannot choose the lineup');
        state.scene=new THREE.Scene();
        ca.emit('data',update('Forged'));
        assert.equal(state.peerIds.length,0,'waiting clients cannot enter gameplay');
        assert.equal(ca.sent[1].gameStarted,false);
        assert.equal(startHostMatch(),true);
        assert.equal(startHostMatch(),false,'start is idempotent');
        assert.equal(ca.sent.filter(p=>p.type==='start_game').length,1);
        assert.deepEqual(state.playerList.map(player => [player.peerId, player.kills, player.deaths]),
            [[host.id, 0, 0], ['peer-a', 0, 0], ['peer-b', 0, 0]], 'Tab list begins in room order');
        assert.deepEqual(cb.sent.filter(p=>p.type==='player_list').at(-1).players, state.playerList);
        ca.emit('data', { type: 'player_list', players: [{ peerId: 'peer-a', username: 'Fake', bodyColor: 0, kills: 99, deaths: 0 }] });
        assert.equal(state.playerList[1].kills, 0, 'clients cannot forge scoreboard snapshots');
        ca.emit('data',{...update('Forged'),hp:7,maxHp:PLAYER_MAX_HP});cb.emit('data',update('Other'));
        assert.equal(cb.sent.find(p=>p.type==='update'&&p.senderPeerId==='peer-a').username,'Pilot');
        assert.equal(state.peers['peer-a'].hp,7);
        assert.equal(state.peers['peer-a'].maxHp,PLAYER_MAX_HP);
        assert.equal(state.peers['peer-a'].username,'Pilot');
        assert.equal(state.peers['peer-b'].hp,PLAYER_MAX_HP);
        assert.equal(state.peers['peer-b'].username,'Other');
        updateRemotePeers(0.02);
        assert.equal(state.peers['peer-a'].hp,7,'inspection must not invent health regeneration');
        ca.emit('data',{type:'fire',weapon:'SNIPER',shotId:1,spreadSeed:1,barrelPos:{x:0,y:2,z:0},dir:{x:0,y:0,z:-1},hitPoint:{x:4000,y:4000,z:-4000}});
        const relayedFire=cb.sent.find(p=>p.type==='fire'&&p.senderPeerId==='peer-a');
        assert.deepEqual(relayedFire.hitPoint,{x:0,y:2,z:-BULLET_TRAVEL_DISTANCE},'host clamps and aligns relayed sniper beams');
        ca.emit('data',{type:'player_hit',targetLifeId:0,shotId:1,pelletIndex:0,targetPeerId:'peer-b',damage:10,attackerName:'Forged'});
        assert.equal(state.peers['peer-b'].hp,PLAYER_MAX_HP,'health waits for victim confirmation');
        cb.emit('data',{...update('Other'),hp:0,isDead:true});
        assert.equal(state.peers['peer-b'].hp,0,'inspection displays confirmed victim health');
        assert.ok(ca.sent.some(p=>p.type==='player_hit'&&p.targetPeerId==='peer-b'),'shooter receives validated health changes');
        state.playerHp=6;state.playerMaxHp=PLAYER_MAX_HP;sendLocalState(true);
        const hostUpdate=ca.sent.filter(p=>p.type==='update').at(-1);
        assert.equal(hostUpdate.hp,6);assert.equal(hostUpdate.maxHp,PLAYER_MAX_HP);
        assert.equal(hostUpdate.dayNightElapsedSeconds,137.25,'host state packets carry the room clock');
        state.playerHp=-4;sendLocalState(true);
        assert.equal(ca.sent.filter(p=>p.type==='update').at(-1).hp,0,'outbound health is clamped to its validated range');
        state.playerHp=PLAYER_MAX_HP;
        broadcastToAll({type:'player_hit',targetLifeId:0,shotId:1,pelletIndex:0,targetPeerId:'peer-a',damage:10,attackerName:'Host'});
        assert.equal(state.peers['peer-a'].hp,7,'host inspection waits for the victim instead of predicting health');
        const death={type:'player_died' as const,lifeId:0,cause:'player' as const,killerPeerId:host.id,killerName:'Host',victimName:'Pilot',victimPeerId:'peer-a'};
        ca.emit('data',death);assert.equal(state.kills,1);ca.emit('data',death);assert.equal(state.kills,1);
        assert.deepEqual(state.playerList.map(player => [player.kills, player.deaths]),
            [[1, 0], [0, 1], [0, 0]], 'validated death updates exactly one K/D event');
        assert.deepEqual(cb.sent.filter(p=>p.type==='player_list').at(-1).players, state.playerList);
        broadcastToAll({type:'player_died',lifeId:0,cause:'lava',killerPeerId:null,
            victimName:'Host',killerName:'Lava',victimPeerId:host.id});
        assert.deepEqual(state.playerList.map(player => [player.kills, player.deaths]),
            [[1, 1], [0, 1], [0, 0]], 'host deaths also reach the authoritative list');
        assert.equal(authorizeClientPacket('peer-a',{type:'fire',weapon:'SNIPER',shotId:2,spreadSeed:1,barrelPos:{x:0,y:2,z:0},dir:{x:0,y:0,z:-1}}),null);
        ca.emit('data',{...update('Forged',1),pos:{x:80,y:2,z:40}});
        assert.equal(state.peers['peer-a'].mesh.visible,true);
        assert.deepEqual(state.peers['peer-a'].mesh.position.toArray(),state.peers['peer-a'].targetPosition.toArray(),'respawns snap instead of lerping from the death site');
        ca.close();await tick();assert.ok(cb.sent.some(p=>p.type==='peer_left'&&p.peerId==='peer-a'));
        assert.deepEqual(state.playerList.map(player => player.peerId), [host.id, 'peer-b']);
        const replacement=await registerTurnSession('ABCDEFGH','join-room','pilot','peer-new');
        const cc=new Connection('peer-new',{admissionToken:replacement.admissionToken});
        host.emit('connection',cc);await tick();await tick();
        assert.equal(cc.sent[1].gameStarted,true,'late join snapshot carries match start');
        assert.deepEqual(cc.sent.filter(p=>p.type==='player_list').at(-1).players, state.playerList,
            'late join sees current players and confirmed scores');
        assert.ok(cc.sent.some(p=>p.type==='update'&&p.username==='Host'),'late join receives the host avatar without waiting for a render frame');
        assert.equal(cc.sent[1].spawnHouseSlot,1,'reuse the departed house without shifting the remaining player');
        assert.equal(cb.sent.filter(p=>p.type==='world_snapshot').length,1);
        disconnectMultiplayer();state.scene=null;
        await hostGame('NewHost','JKLMNPQR','create-room');
        cb.emit('error',new Error('old'));cb.emit('close');cb.emit('data',update('Old'));
        assert.equal(state.isMultiplayer,true);assert.equal(state.roomCode,'JKLMNPQR');assert.equal(state.peerIds.length,0);
    } finally {disconnectMultiplayer();}
});

test('client rejects host without proof and applies kills while waiting to play',async()=>{
    backend();state.scene=null;
    state.camera=new THREE.PerspectiveCamera();state.controls={getObject:()=>state.camera,unlock:()=>{}} as any;
    // Register a host directly; this test owns the client singleton.
    const response=await fetch('/api/rooms',{method:'POST',body:JSON.stringify({room:'ABCDEFGH',turnstileToken:'create-room',username:'Host',peerId:'testfps-room-ABCDEFGH'})});
    const host=await response.json() as any;
    try{
        await joinGame('Pilot','ABCDEFGH','join-room');let peer=Peer.latest;peer.emit('open',peer.id);let conn=peer.connections['testfps-room-ABCDEFGH'][0];
        conn.emit('data',{type:'world_snapshot',gameStarted:false,username:'Guest3',spawnHouseSlot:2,seed:1,score:0,dayNightElapsedSeconds:0,targets:[]});assert.equal(state.isMultiplayer,false);
        await joinGame('Pilot','ABCDEFGH','join-room');peer=Peer.latest;peer.emit('open',peer.id);conn=peer.connections['testfps-room-ABCDEFGH'][0];
        const admitted=await fetch('/api/room-admissions/ABCDEFGH',{method:'POST',headers:{Authorization:`Bearer ${host.closeToken}`},body:JSON.stringify({peerId:peer.id,admissionToken:(conn.metadata as any).admissionToken})});
        const admission=await admitted.json() as any;conn.emit('data',{type:'admission',proof:admission.admissionProof});
        conn.emit('data',{type:'world_snapshot',gameStarted:false,username:'Guest3',spawnHouseSlot:2,seed:1,score:0,dayNightElapsedSeconds:42,targets:[]});
        assert.equal(state.isPlaying,false);
        assert.equal(state.dayNightElapsedSeconds,42);
        assert.equal(state.dayNightSyncImmediate,true);
        assert.ok(conn.sent.some(packet => packet.type === 'lobby_color'), 'client shares its suit color while waiting');
        const roster = { type: 'lobby_roster', players: [
            { peerId: 'testfps-room-ABCDEFGH', username: 'Host', bodyColor: 0x3b5998 },
            { peerId: peer.id, username: 'Guest3', bodyColor: 0xdf5b64 },
        ] };
        conn.emit('data', roster);
        assert.deepEqual(state.lobbyPlayers, roster.players, 'guest uses host order');
        conn.emit('data',{...update('Host'),dayNightElapsedSeconds:57});
        assert.equal(state.dayNightElapsedSeconds,57,'host clock keeps synchronizing while this client is in its lobby');
        const spawn=getTownSpawn(1,'house',2);
        assert.deepEqual(state.camera!.position.toArray(),[spawn.x,2,spawn.z]);
        state.camera!.position.x+=3;
        conn.emit('data',{type:'world_snapshot',gameStarted:false,username:'Guest3',spawnHouseSlot:1,seed:99,score:0,dayNightElapsedSeconds:0,targets:[]});
        assert.equal(state.camera!.position.x,spawn.x+3,'duplicate snapshots cannot teleport an existing player');
        const target=new THREE.Group();target.userData={scale:1,index:0,bodyMesh:new THREE.Mesh(new THREE.BoxGeometry(),new THREE.MeshStandardMaterial()),healthBarFg:new THREE.Mesh(),healthBarGroup:new THREE.Group()};state.targets=[target];
        state.hookState='FIRING';state.hookIsEnemy=true;state.hookWillHit=true;state.hookTargetEnemy=target;
        conn.emit('data',{type:'target_state',targetIndex:0,position:{x:0,y:0,z:0},maxHp:3,hp:2,scale:1,color:123});
        assert.equal(state.hookState,'FIRING','nonlethal damage must retain the grapple');
        conn.emit('data',{type:'kill_target',targetIndex:0,score:7,newPosition:{x:50,y:20,z:0},scale:3,hp:3,color:123});
        assert.equal(state.hookState,'IDLE');assert.equal(state.hookTargetEnemy,null);
        assert.equal(state.score,7);assert.equal(target.position.x,50);assert.equal(target.userData.hp,3);
        state.targets=[];
        state.scene=new THREE.Scene();
        conn.emit('data',{type:'start_game'});
        assert.equal(state.isPlaying,true,'host starts a client without pointer lock');
        conn.emit('data',{type:'player_list',players:[
            {peerId:conn.peer,username:'Host',bodyColor:0x3b5998,kills:3,deaths:0},
            {peerId:peer.id,username:'Guest3',bodyColor:0xdf5b64,kills:1,deaths:2},
        ]});
        assert.deepEqual(state.playerList.map(player=>[player.username,player.kills,player.deaths]),
            [['Host',3,0],['Guest3',1,2]],'client accepts the host scoreboard');
        assert.equal(state.username,'Guest3');
        const life=state.lifeId;
        conn.emit('data',{type:'start_game'});
        assert.equal(state.lifeId,life,'duplicate start never respawns');
        conn.emit('data',update('Host'));
        conn.emit('data',{type:'player_died',lifeId:0,cause:'lava',killerPeerId:null,victimName:'Host',killerName:'Lava'});
        conn.emit('data',update('Host'));
        assert.equal(state.peers[conn.peer].mesh.visible,false,'queued living updates cannot resurrect a dead avatar');
        conn.emit('data',update('Host',1));
        assert.equal(state.peers[conn.peer].mesh.visible,true);
        conn.emit('data',{type:'player_hit',targetLifeId:0,shotId:3,pelletIndex:0,targetPeerId:conn.peer,damage:10,attackerName:'Guest2'});
        assert.equal(state.peers[conn.peer].hp,PLAYER_MAX_HP,'late damage cannot harm a new life');
    }finally{disconnectMultiplayer();}
});

test('room creation rate limit allows ten attempts per half hour',async()=>{
    backend();
    const alphabet='ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    const create=async(index:number)=>{
        const room=alphabet[index].repeat(8);
        return fetch('/api/rooms',{method:'POST',body:JSON.stringify({
            room,turnstileToken:'create-room',username:'Host',peerId:`testfps-room-${room}`,
        })});
    };
    for(let index=0;index<10;index++)assert.equal((await create(index)).status,201);
    assert.equal((await create(10)).status,429);
});

test('unopened PeerJS channel timeout frees host lobby capacity even without a close event',async(t)=>{
    backend();state.scene=null;t.mock.timers.enable({apis:['setTimeout','setInterval']});
    try{
        await hostGame('Host','ABCDEFGH','create-room');const host=Peer.latest;host.emit('open',host.id);
        const pending=new Connection('pending',{admissionToken:'a'.repeat(43)});pending.open=false;host.emit('connection',pending);
        t.mock.timers.tick(20_000);
        for(let i=0;i<4;i++){
            const replacement=new Connection(`pending-${i}`,{admissionToken:'a'.repeat(43)});replacement.open=false;host.emit('connection',replacement);
            assert.ok(replacement.handlers.has('open'),'each of the four available slots can be reserved');
        }
    }finally{disconnectMultiplayer();}
});

test('malformed unopened metadata cannot reserve any of the host pending slots', async () => {
    backend(); state.scene = null;
    try {
        await hostGame('Host', 'ABCDEFGH', 'create-room');
        const host = Peer.latest;
        for (let i = 0; i < 20; i++) {
            const bad = new Connection(`bad-${i}`, i % 2 ? null : { admissionToken: 'wrong' });
            bad.open = false; host.emit('connection', bad);
            assert.equal(bad.handlers.has('open'), false);
        }
        for (let i = 0; i < 4; i++) {
            const pending = new Connection(`pending-${i}`, { admissionToken: 'a'.repeat(43) });
            pending.open = false; host.emit('connection', pending);
            assert.equal(pending.handlers.has('open'), true);
        }
        const excess = new Connection('excess', { admissionToken: 'a'.repeat(43) });
        excess.open = false; host.emit('connection', excess);
        assert.equal(excess.handlers.has('open'), false, 'syntactically valid unverified offers are still capped');
    } finally { disconnectMultiplayer(); }
});

test('disabled multiplayer rejects heartbeats before using a room binding', async () => {
    const response = await worker.fetch(new Request('https://local/api/rooms/ABCDEFGH', { method: 'PATCH',
        headers: { Authorization: `Bearer ${'a'.repeat(43)}` }, body: JSON.stringify({ peerIds: [], admissionGeneration: 0 }) }),
        { DISABLE_TURN: 'true' } as any);
    assert.equal(response.status, 503);
});

test('reordered admission responses retain pending peers in the same acknowledged heartbeat snapshot', async t => {
    backend(); state.scene = null;
    t.mock.timers.enable({ apis: ['setInterval'] });
    const originalFetch = globalThis.fetch;
    let release!: () => void;
    const held = new Promise<void>(resolve => { release = resolve; });
    const heartbeats: any[] = [];
    globalThis.fetch = (async (input: any, init: any) => {
        if (init?.method === 'PATCH') heartbeats.push(JSON.parse(init.body));
        const result = await originalFetch(input, init);
        if (String(input).includes('/room-admissions/') && init?.method === 'POST' && JSON.parse(init.body).peerId === 'peer-a') await held;
        return result;
    }) as typeof fetch;
    try {
        await hostGame('Host', 'ABCDEFGH', 'create-room');
        for (const [peerId, username] of [['peer-a', 'Alpha'], ['peer-b', 'Beta']]) {
            const ticket = await registerTurnSession('ABCDEFGH', 'join-room', username, peerId);
            Peer.latest.emit('connection', new Connection(peerId, { admissionToken: ticket.admissionToken }));
        }
        await tick(); await tick(); assert.equal(state.connections.length, 1);
        t.mock.timers.tick(120_000); await tick();
        assert.equal(heartbeats.at(-1).admissionGeneration, 2);
        assert.deepEqual(heartbeats.at(-1).peerIds.sort(), ['peer-a', 'peer-b']);
        release(); await tick(); await tick(); assert.equal(state.connections.length, 2);
        t.mock.timers.tick(120_000); await tick();
        assert.equal(heartbeats.at(-1).admissionGeneration, 2, 'an older response never moves acknowledgement backward');
    } finally { release(); disconnectMultiplayer(); globalThis.fetch = originalFetch; }
});

test('host canonical sniper presentation stops on the floor', async () => {
    backend(); state.scene = null;
    try {
        await hostGame('Host', 'ABCDEFGH', 'create-room');
        const ticket = await registerTurnSession('ABCDEFGH', 'join-room', 'Pilot', 'floor-peer');
        Peer.latest.emit('connection', new Connection('floor-peer', { admissionToken: ticket.admissionToken }));
        await tick(); await tick();
        assert.ok(authorizeClientPacket('floor-peer', update('Pilot')));
        const fire = authorizeClientPacket('floor-peer', { type: 'fire', weapon: 'SNIPER', shotId: 1, spreadSeed: 1,
            barrelPos: { x: 0, y: 2, z: 0 }, dir: { x: 0, y: -1, z: 0 }, hitPoint: { x: 0, y: -500, z: 0 } });
        assert.equal(fire?.type, 'fire');
        if (fire?.type === 'fire') assert.deepEqual(fire.hitPoint, { x: 0, y: 0, z: 0 });
    } finally { disconnectMultiplayer(); }
});

test('the real host checks homing acquisition, intervening bodies and captured revisions', async t => {
    backend(); state.scene = null; state.camera = null; state.controls = null;
    let now = 1000; t.mock.method(performance, 'now', () => now);
    const make = (index: number, position: THREE.Vector3, size: number, scale: number) => {
        const root = new THREE.Group(), body = new THREE.Mesh(new THREE.BoxGeometry(size, size, 1));
        root.add(body); root.position.copy(position);
        root.userData = { index, bodyMesh: body, hp: 10, scale, eliminationRevision: 0 }; return root;
    };
    const target = make(0, new THREE.Vector3(1.5, 3, -120), 2, 1);
    const cover = make(1, new THREE.Vector3(0, 3, -60), 8, 4);
    try {
        await hostGame('Host', 'ABCDEFGH', 'create-room');
        const ticket = await registerTurnSession('ABCDEFGH', 'join-room', 'Shooter', 'guided-peer');
        Peer.latest.emit('connection', new Connection('guided-peer', { admissionToken: ticket.admissionToken }));
        await tick(); await tick();
        state.targets = [target, cover]; rebuildTargetHash();
        assert.ok(authorizeClientPacket('guided-peer', { ...update('Shooter'), pos: { x: 0, y: 3, z: 0 }, activeWeapon: 'AR' }));
        const packet = { type: 'fire' as const, weapon: 'AR' as const, shotId: 1, spreadSeed: 42,
            barrelPos: { x: 0, y: 3, z: 0 }, dir: { x: 0, y: 0, z: -1 },
            homingTarget: { kind: 'npc' as const, targetIndex: 0, targetRevision: 0 }, homingStartDistance: Math.hypot(1.5, 120) / 3 };
        assert.equal(authorizeClientPacket('guided-peer', packet), null, 'fully covered target cannot be acquired');
        cover.position.x = -3.2; rebuildTargetHash();
        assert.ok(authorizeClientPacket('guided-peer', packet), 'a visible silhouette can be acquired');
        const claim = { type: 'hit_target' as const, targetIndex: 0, shotId: 1, pelletIndex: 0, damage: 1 };
        now = 1200;
        assert.equal(authorizeClientPacket('guided-peer', claim), null, 'acquisition does not let the curved shot cross an intervening body');
        cover.position.x = -1000; rebuildTargetHash();
        const peerTicket = await registerTurnSession('ABCDEFGH', 'join-room', 'Cover', 'cover-peer');
        const peerCover = new Connection('cover-peer', { admissionToken: peerTicket.admissionToken });
        Peer.latest.emit('connection', peerCover); await tick(); await tick();
        assert.ok(authorizeClientPacket('cover-peer', { ...update('Cover'), pos: { x: 0.4, y: 3.35, z: -60 } }));
        assert.equal(authorizeClientPacket('guided-peer', { ...packet, shotId: 2 }), null, 'a physical peer body can fully occlude acquisition too');
        peerCover.close();
        assert.ok(authorizeClientPacket('guided-peer', { ...packet, shotId: 2 }));
        now = 1400;
        assert.ok(authorizeClientPacket('guided-peer', { ...claim, shotId: 2 }));
        assert.ok(authorizeClientPacket('guided-peer', { ...packet, shotId: 3 }));
        target.userData.eliminationRevision++;
        now = 1600;
        assert.equal(authorizeClientPacket('guided-peer', { ...claim, shotId: 3 }), null, 'replacement revision cannot use the straight-hit fallback');
    } finally {
        disconnectMultiplayer(); state.targets = []; rebuildTargetHash();
        for (const root of [target, cover]) { const body = root.children[0] as THREE.Mesh; body.geometry.dispose(); (body.material as THREE.Material).dispose(); }
    }
});

test('departing avatars dispose each owned resource once even after the scene reference is gone', async () => {
    backend(); state.scene = null;
    try {
        await hostGame('Host', 'ABCDEFGH', 'create-room');
        const ticket = await registerTurnSession('ABCDEFGH', 'join-room', 'Guest', 'owned-peer');
        const connection = new Connection('owned-peer', { admissionToken: ticket.admissionToken });
        Peer.latest.emit('connection', connection); await tick(); await tick();
        state.scene = new THREE.Scene(); startHostMatch(); connection.emit('data', update('Guest'));
        const peer = state.peers['owned-peer'], root = peer.mesh;
        const geometry = new THREE.BoxGeometry(), texture = new THREE.Texture();
        const material = new THREE.MeshBasicMaterial({ map: texture }), spriteMaterial = new THREE.SpriteMaterial({ map: texture });
        root.add(new THREE.Mesh(geometry, [material, material]), new THREE.Mesh(geometry, material), new THREE.Sprite(spriteMaterial));
        const counts = [0, 0, 0, 0];
        [geometry, texture, material, spriteMaterial].forEach((resource, index) => resource.addEventListener('dispose', () => counts[index]++));
        let sharedDisposals = 0; const sharedListener = () => sharedDisposals++;
        SHARED_BODY_MAT.addEventListener('dispose', sharedListener);
        try {
            state.scene = null; connection.close(); connection.emit('close');
            assert.deepEqual(counts, [1, 1, 1, 1]); assert.equal(sharedDisposals, 0);
            assert.equal(root.parent, null); assert.equal(state.peers['owned-peer'], undefined);
        } finally { SHARED_BODY_MAT.removeEventListener('dispose', sharedListener); }
    } finally { disconnectMultiplayer(); state.scene = null; }
});

test('an accepted hit retains valid death attribution after the killer leaves, without blocking respawn', async () => {
    backend(); state.scene = null;
    try {
        await hostGame('Host', 'ABCDEFGH', 'create-room');
        const clients: Connection[] = [];
        for (const name of ['Alpha', 'Beta', 'Gamma']) {
            const ticket = await registerTurnSession('ABCDEFGH', 'join-room', name, name);
            const connection = new Connection(name, { admissionToken: ticket.admissionToken });
            clients.push(connection); Peer.latest.emit('connection', connection);
        }
        await tick(); await tick(); state.scene = new THREE.Scene(); startHostMatch();
        for (const connection of clients) connection.emit('data', update(connection.peer));
        const [killer, victim, observer] = clients;
        killer.emit('data', { type: 'fire', weapon: 'SNIPER', shotId: 1, spreadSeed: 1,
            barrelPos: { x: 0, y: 2, z: 0 }, dir: { x: 0, y: 0, z: -1 } });
        killer.emit('data', { type: 'player_hit', targetPeerId: victim.peer, targetLifeId: 0, shotId: 1, pelletIndex: 0, damage: 10, attackerName: 'Alpha' });
        killer.close();
        const death = { type: 'player_died', lifeId: 0, cause: 'player', killerPeerId: killer.peer, victimName: 'Beta', killerName: 'Alpha' };
        victim.emit('data', death); victim.emit('data', death);
        const relayed = observer.sent.filter(p => p.type === 'player_died').at(-1);
        assert.ok(parseNetworkPacket(relayed)); assert.equal(relayed.killerPeerId, killer.peer);
        assert.equal(state.playerList.find(p => p.peerId === victim.peer)?.deaths, 1);
        victim.emit('data', update('Beta', 1));
        assert.equal(state.peers[victim.peer].lifeId, 1); assert.equal(state.peers[victim.peer].mesh.visible, true);
    } finally { disconnectMultiplayer(); state.scene = null; }
});

test('full five-player rooms assign distinct houses and reset assignments for a new room', async () => {
    state.scene = null;
    try {
        for (const room of ['ABCDEFGH', 'JKLMNPQR']) {
            // Reset the simulated backend's per-IP join quota between rooms.
            backend();
            await hostGame('Host', room, 'create-room');
            const host = Peer.latest;
            const clients: Connection[] = [];
            for (let index = 1; index < 5; index++) {
                const peerId = `peer-${index}`;
                const admission = await registerTurnSession(room, 'join-room', `Pilot${String.fromCharCode(64 + index)}`, peerId);
                const conn = new Connection(peerId, { admissionToken: admission.admissionToken });
                clients.push(conn);
                host.emit('connection', conn);
            }
            await tick(); await tick();
            assert.equal(state.connections.length, 4);
            const slots = clients.map(conn => conn.sent.find(packet => packet.type === 'world_snapshot').spawnHouseSlot);
            assert.deepEqual([...slots].sort(), [1, 2, 3, 4]);
            const seed = getWorldSeed();
            const spawns = [0, ...slots].map(slot => getTownSpawn(seed, 'house', slot));
            assert.equal(new Set(spawns.map(p => `${p.x},${p.z}`)).size, 5);
            clients[0].close(); await tick();
            assert.deepEqual(state.lobbyPlayers.map(player => player.peerId),
                [host.id, 'peer-2', 'peer-3', 'peer-4']);
            const replacement = await registerTurnSession(room, 'join-room', 'PilotE', 'peer-new');
            const replacementConn = new Connection('peer-new', { admissionToken: replacement.admissionToken });
            host.emit('connection', replacementConn); await tick(); await tick();
            assert.equal(replacementConn.sent.find(packet => packet.type === 'world_snapshot').spawnHouseSlot, 1);
            assert.deepEqual(state.lobbyPlayers.map(player => player.peerId),
                [host.id, 'peer-2', 'peer-3', 'peer-4', 'peer-new'],
                'rejoined player takes the end of the lineup despite reusing the vacant house');
            disconnectMultiplayer();
        }
    } finally { disconnectMultiplayer(); }
});


test('client queues match start and clock updates while its world is preparing', async () => {
    backend();
    state.scene = null;
    state.camera = new THREE.PerspectiveCamera();
    state.controls = { getObject: () => state.camera, unlock: () => {} } as any;
    const response = await fetch('/api/rooms', { method: 'POST', body: JSON.stringify({
        room: 'ABCDEFGH', turnstileToken: 'create-room', username: 'Host', peerId: 'testfps-room-ABCDEFGH',
    }) });
    const host = await response.json() as any;
    let finish!: () => void;
    setMultiplayerWorldLoader(() => new Promise<void>(resolve => { finish = resolve; }));
    try {
        await joinGame('Pilot', 'ABCDEFGH', 'join-room');
        const peer = Peer.latest;
        peer.emit('open', peer.id);
        const conn = peer.connections['testfps-room-ABCDEFGH'][0];
        const response = await fetch('/api/room-admissions/ABCDEFGH', { method: 'POST',
            headers: { Authorization: `Bearer ${host.closeToken}` },
            body: JSON.stringify({ peerId: peer.id, admissionToken: (conn.metadata as any).admissionToken }),
        });
        const admission = await response.json() as any;
        conn.emit('data', { type: 'admission', proof: admission.admissionProof });
        conn.emit('data', { type: 'world_snapshot', gameStarted: false, username: 'Guest3', spawnHouseSlot: 2,
            seed: 1, score: 0, dayNightElapsedSeconds: 42, targets: [] });
        conn.emit('data', { type: 'start_game' });
        conn.emit('data', { ...update('Host'), dayNightElapsedSeconds: 57 });
        assert.equal(state.isPlaying, false);
        state.scene = new THREE.Scene();
        finish();
        await new Promise(resolve => setTimeout(resolve, 0));
        assert.equal(state.isPlaying, true);
        assert.equal(state.dayNightElapsedSeconds, 57);
    } finally {
        setMultiplayerWorldLoader(null);
        disconnectMultiplayer();
        state.scene = null;
    }
});

test('real host authorizes mecha shield/body claims once, rejects fabricated damage and retires shots across mounting', async t => {
    const { ForgottenMecha } = await import('../src/forgottenMecha.ts');
    const { loadIronmawTestAsset } = await import('./ironmawTestAsset.ts');
    const world = await import('../src/world.ts');
    const coordinator = await import('../src/mechaNetwork.ts');
    const { authorizeMechaHit } = await import('../src/multiplayer.ts');
    const originalLoad = ForgottenMecha.prototype.load, originalDocument = globalThis.document;
    const context = new Proxy({}, { get: () => () => {} });
    (globalThis as any).document = { getElementById: () => null, createElement: () => ({ getContext: () => context }) };
    ForgottenMecha.prototype.load = async function () { this.install(await loadIronmawTestAsset()); };
    let now = 1000; t.mock.method(performance, 'now', () => now);
    backend(); state.scene = null;
    try {
        await hostGame('Host', 'ABCDEFGH', 'create-room');
        Peer.latest.emit('open', state.peer!.id);
        const admission = await registerTurnSession('ABCDEFGH', 'join-room', 'Shooter', 'mecha-shooter');
        const connection = new Connection('mecha-shooter', { admissionToken: admission.admissionToken });
        Peer.latest.emit('connection', connection); await tick(); await tick(); startHostMatch();
        state.scene = new THREE.Scene(); world.rebuildEnvironmentWithSeed(42);
        await world.prepareForgottenMecha(coordinator.multiplayerMechaEvents(), async () => {});
        coordinator.initializeNetworkMecha();
        const actor = world.forgottenMecha!;
        const forged = actor.captureNetworkState(999, true);
        connection.emit('data', { type: 'mecha_state', state: forged });
        connection.emit('data', { type: 'mecha_event', sequence: 999, state: forged, event: { kind: 'end' } });
        const particleCount = state.activeParticles.length;
        connection.emit('data', { type: 'mecha_event', sequence: 1000, state: forged,
            event: { kind: 'hit', peerId: 'mecha-shooter', killed: false, score: 999,
                position: { x: 0, y: 20, z: 0 }, direction: { x: 0, y: -1, z: 0 } } });
        assert.equal(state.activeParticles.length, particleCount, 'guests cannot forge armor impact events');
        assert.equal(state.matchEnded, false); assert.equal(actor.hp, 50);
        const origin = actor.combat.shieldCenter.clone().add(new THREE.Vector3(0, 60, 0));
        assert.ok(authorizeClientPacket('mecha-shooter', { ...update('Shooter'), pos: { x: origin.x, y: origin.y, z: origin.z } }));
        const fire = (shotId: number) => authorizeClientPacket('mecha-shooter', { type: 'fire', shotId, spreadSeed: 1, weapon: 'SNIPER',
            barrelPos: { x: origin.x, y: origin.y, z: origin.z }, dir: { x: 0, y: -1, z: 0 } });
        const claim = (shotId: number, damage = 10) => ({ type: 'hit_mecha' as const, revision: actor.revision, shotId, pelletIndex: 0, damage });
        assert.ok(fire(1)); assert.equal(authorizeMechaHit('mecha-shooter', claim(1, 1)), false);
        assert.equal(authorizeMechaHit('mecha-shooter', claim(1)), true); assert.equal(actor.hp, 50);
        assert.equal(authorizeMechaHit('mecha-shooter', claim(1)), false);
        assert.equal(authorizeMechaHit('mecha-shooter', claim(999)), false);
        const weaponPort = await import('../src/weaponNetworkPort.ts');
        const savedConnections = state.connections, savedControls = state.controls, savedCamera = state.camera;
        const soloOrigin = origin.clone().add(new THREE.Vector3(0, 0, 8));
        state.connections = []; state.camera = new THREE.PerspectiveCamera(); state.camera.position.copy(soloOrigin);
        state.controls = { getObject: () => state.camera! } as any; state.activeWeaponName = 'SNIPER'; state.switchState = 'IDLE';
        weaponPort.broadcastLocalFire(soloOrigin, actor.combat.shieldCenter.clone().sub(soloOrigin).normalize(), null, 500, 1);
        assert.equal(authorizeMechaHit(state.peer!.id, claim(500)), true, 'a room host can fight the mecha with no guests connected');
        state.camera.position.x += 50; sendLocalState(true);
        state.connections = savedConnections; state.controls = savedControls; state.camera = savedCamera;

        actor.combat.shieldPhase = 'down'; now += 2100; assert.ok(fire(2));
        assert.equal(authorizeMechaHit('mecha-shooter', claim(2)), true); assert.equal(actor.hp, 40);
        const armorEvent = connection.sent.find(p => p.type === 'mecha_event' && p.event.kind === 'hit');
        assert.ok(armorEvent && parseNetworkPacket(armorEvent));
        assert.deepEqual(armorEvent.event.direction, { x: 0, y: -1, z: 0 });
        assert.ok(armorEvent.event.position.y < origin.y);
        const confirmedCount = state.activeParticles.length;
        assert.ok(confirmedCount > particleCount);
        assert.equal(authorizeMechaHit('mecha-shooter', claim(2)), false);
        assert.equal(state.activeParticles.length, confirmedCount, 'consumed claims cannot replay armor effects');
        assert.ok(connection.sent.some(p => p.type === 'mecha_event' && p.event.kind === 'shield'));
        assert.ok(connection.sent.some(p => p.type === 'mecha_state' && p.state.hp === 40));
        now += 2100; assert.ok(fire(3)); actor.damage(40);
        for (let i = 0; i < 400; i++) actor.update(1 / 60, { position: origin, alive: false, grounded: false });
        actor.pilotPeerId = 'other-pilot'; actor.pilotLifeId = 0;
        assert.equal(actor.beginBoarding(actor.seatAnchor.getWorldPosition(new THREE.Vector3()), new THREE.Quaternion()), true);
        for (let i = 0; i < 500; i++) actor.update(1 / 60, { position: origin, alive: false, grounded: false });
        assert.equal(actor.mode, 'piloted'); assert.equal(authorizeMechaHit('mecha-shooter', claim(3)), false); assert.equal(actor.hp, 50);
        const { setThirdPerson } = await import('../src/weapons.ts');
        state.isThirdPerson = false; setThirdPerson(true);
        assert.equal(state.isThirdPerson, true, 'another pilot transition cannot lock the host perspective');
        const guidedAdmission = await registerTurnSession('ABCDEFGH', 'join-room', 'Guided', 'mecha-guided');
        Peer.latest.emit('connection', new Connection('mecha-guided', { admissionToken: guidedAdmission.admissionToken })); await tick(); await tick();
        const observedCenter = actor.hitbox.position.clone(), guidedOrigin = observedCenter.clone().add(new THREE.Vector3(0, 60, 12));
        assert.ok(authorizeClientPacket('mecha-guided', { ...update('Guided'), activeWeapon: 'AR', pos: { x: guidedOrigin.x, y: guidedOrigin.y, z: guidedOrigin.z } }));
        state.camera = new THREE.PerspectiveCamera(); state.camera.position.copy(soloOrigin).add(new THREE.Vector3(50, 0, 0));
        state.controls = { getObject: () => state.camera! } as any;
        sendLocalState(true); now += 33; actor.group.position.x += 0.6;
        actor.update(1 / 60, { position: guidedOrigin, alive: false, grounded: false }); sendLocalState(true);
        const direction = observedCenter.clone().sub(guidedOrigin).normalize();
        assert.ok(authorizeClientPacket('mecha-guided', { type: 'fire', shotId: 1, spreadSeed: 1, weapon: 'AR',
            barrelPos: { x: guidedOrigin.x, y: guidedOrigin.y, z: guidedOrigin.z }, dir: { x: direction.x, y: direction.y, z: direction.z },
            homingTarget: { kind: 'mecha', targetRevision: actor.revision }, homingStartDistance: guidedOrigin.distanceTo(observedCenter) / 3 }),
            'the first guided shot can use the host history collected before firing');
        state.controls = savedControls; state.camera = savedCamera;


        assert.equal(authorizeClientPacket('mecha-shooter', { type: 'player_died', lifeId: 0, cause: 'mecha', killerPeerId: null, victimName: 'Shooter', killerName: 'Forgotten Mecha' }), null);
    } finally {
        ForgottenMecha.prototype.load = originalLoad; world.disposeWorld(); disconnectMultiplayer(); globalThis.document = originalDocument;
    }
});

test('actual router rejects guest ending authority, accepts admitted readiness after loss and snapshots late viewers', async t => {
    const { ForgottenMecha } = await import('../src/forgottenMecha.ts');
    const { loadIronmawTestAsset } = await import('./ironmawTestAsset.ts');
    const world = await import('../src/world.ts');
    const coordinator = await import('../src/mechaNetwork.ts');
    const originalLoad = ForgottenMecha.prototype.load, originalDocument = globalThis.document;
    const context = new Proxy({}, { get: () => () => {} });
    (globalThis as any).document = { getElementById: () => null, createElement: () => ({ getContext: () => context }) };
    ForgottenMecha.prototype.load = async function () { this.install(await loadIronmawTestAsset()); };
    let now = 1000; t.mock.method(performance, 'now', () => now);
    backend(); state.scene = null;
    try {
        await hostGame('Host', 'ABCDEFGH', 'create-room'); Peer.latest.emit('open', state.peer!.id);
        const admission = await registerTurnSession('ABCDEFGH', 'join-room', 'Viewer', 'ending-viewer');
        const viewer = new Connection('ending-viewer', { admissionToken: admission.admissionToken });
        Peer.latest.emit('connection', viewer); await tick(); await tick(); startHostMatch();
        state.scene = new THREE.Scene(); world.rebuildEnvironmentWithSeed(42);
        await world.prepareForgottenMecha(coordinator.multiplayerMechaEvents(), async () => {}); coordinator.initializeNetworkMecha();
        const actor = world.forgottenMecha!, goal = actor.route!.points.at(-1)!;
        const forged = actor.captureNetworkState(999, true); forged.mode = 'punching'; forged.heading = 0;
        forged.ending = { id: 1, seed: 42, effectsSeed: 7, position: { ...forged.position }, heading: 0, lightingElapsed: 150, phase: 'complete', elapsed: .45 + .6 + .5 + 85 / 24 + 3 };
        assert.ok(parseNetworkPacket({ type: 'mecha_state', state: forged }));
        viewer.emit('data', { type: 'mecha_state', state: forged });
        assert.equal(state.matchEnded, false, 'a syntactically valid ending still cannot be guest-authoritative');
        actor.group.position.set(goal.x, 0, goal.z); actor.followRoute({ points: [goal, goal], heading: actor.route!.heading });
        coordinator.updateMechaNetwork(1 / 60); assert.equal(state.matchEnded, true);
        const ending = coordinator.captureMechaSnapshot()!.ending!;
        now = 1500; coordinator.markMechaEndingReady(ending.id);
        assert.equal(coordinator.captureMechaSnapshot()!.ending!.phase, 'preparing');
        viewer.emit('data', { type: 'mecha_ending_ready', id: ending.id, revision: actor.revision, senderPeerId: 'someone-else' });
        assert.equal(coordinator.captureMechaSnapshot()!.ending!.phase, 'preparing');
        viewer.emit('data', { type: 'mecha_ending_ready', id: ending.id, revision: actor.revision });
        assert.equal(coordinator.captureMechaSnapshot()!.ending!.phase, 'playing');
        const count = viewer.sent.length;
        viewer.emit('data', { type: 'mecha_ending_ready', id: ending.id, revision: actor.revision });
        assert.equal(viewer.sent.length, count, 'duplicate acknowledgments do not amplify broadcasts');
        now += 4200; coordinator.updateMechaEndingNetwork();
        const lateAdmission = await registerTurnSession('ABCDEFGH', 'join-room', 'Late', 'ending-late');
        const late = new Connection('ending-late', { admissionToken: lateAdmission.admissionToken });
        Peer.latest.emit('connection', late); await tick(); await tick();
        const snapshot = late.sent.find(p => p.type === 'world_snapshot');
        assert.ok(parseNetworkPacket(snapshot)); assert.equal(snapshot.mecha.ending.id, ending.id);
        assert.equal(snapshot.mecha.ending.elapsed, 4.65); assert.equal(snapshot.mecha.ending.phase, 'playing');
    } finally { ForgottenMecha.prototype.load = originalLoad; world.disposeWorld(); disconnectMultiplayer(); globalThis.document = originalDocument; }
});
