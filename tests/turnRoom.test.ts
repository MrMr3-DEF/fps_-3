import test from 'node:test';
import assert from 'node:assert/strict';
import { TurnRoomStateMachine } from '../src/turnRoom.ts';

class MemoryStorage {
    values = new Map<string, unknown>();
    alarmAt: number | null = null;
    async get<T>(key: string): Promise<T | undefined> { return structuredClone(this.values.get(key)) as T | undefined; }
    async put<T>(key: string, value: T) { this.values.set(key, structuredClone(value)); }
    async setAlarm(time: number) { this.alarmAt = time; }
    async deleteAll() { this.values.clear(); this.alarmAt = null; }
}
const cap = (c: string) => c.repeat(43);
function fields(c: string, name = `Pilot${c}`) {
    return { turnSessionToken: cap(c), admissionToken: cap(c.toUpperCase()), admissionProof: cap(c === 'h' ? 'Z' : c),
        username: name, peerId: `peer-${c}`, ip: '127.0.0.1', expiresAt: Date.now() + 300_000 };
}
async function call(room: TurnRoomStateMachine, path: string, body: object) {
    return room.fetch(new Request(`https://room${path}`, { method: 'POST', body: JSON.stringify(body) }));
}
async function setup() {
    const storage = new MemoryStorage(); const room = new TurnRoomStateMachine({ storage }, 5);
    assert.equal((await call(room, '/register', { ...fields('h','Host'), closeToken: cap('X'), expiresAt: Date.now()+1800_000, sessionExpiresAt: Date.now()+300_000 })).status, 201);
    return { room, storage };
}
test('room reserves case-insensitive names including the host; release permits reuse', async () => {
    const { room } = await setup();
    assert.equal((await call(room,'/create-session',fields('a','host'))).status,409);
    assert.equal((await call(room,'/create-session',fields('a','Pilot'))).status,201);
    const duplicate = await call(room,'/create-session',fields('b','pILOT'));
    assert.equal(duplicate.status,409); assert.match((await duplicate.json()).error,/username/);
    await call(room,'/release-session',{turnSessionToken:cap('a')});
    assert.equal((await call(room,'/create-session',fields('b','Pilot'))).status,201);
});
test('concurrent same-name joins reserve exactly once with isolated storage', async () => {
    const { room }=await setup();
    const results=await Promise.all(['a','b','c','d'].map(c=>call(room,'/create-session',fields(c,'Pilot'))));
    assert.deepEqual(results.map(r=>r.status).sort(),[201,409,409,409]);
});
test('parallel distinct joins cannot exceed room capacity', async () => {
    const { room }=await setup();
    const results=await Promise.all(['a','b','c','d','e','f'].map(c=>call(room,'/create-session',fields(c))));
    assert.equal(results.filter(r=>r.status===201).length,4);
});
test('admission requires host capability and correct peer-bound, single-use ticket', async () => {
    const { room }=await setup(); await call(room,'/create-session',fields('a'));
    assert.equal((await call(room,'/admit',{peerId:'peer-a',admissionToken:cap('A')})).status,403);
    assert.equal((await call(room,'/admit',{closeToken:cap('X'),peerId:'peer-b',admissionToken:cap('A')})).status,404);
    assert.equal((await call(room,'/admit',{closeToken:cap('X'),peerId:'peer-a',admissionToken:cap('B')})).status,403);
    const body={closeToken:cap('X'),peerId:'peer-a',admissionToken:cap('A')};
    const results=await Promise.all([call(room,'/admit',body),call(room,'/admit',body)]);
    assert.deepEqual(results.map(r=>r.status).sort(),[200,403]);
    const admitted=await results.find(r=>r.status===200)!.json(); assert.equal(admitted.admissionProof,cap('a'));
    await call(room,'/depart',{closeToken:cap('X'),peerId:'peer-a'});
    assert.equal((await call(room,'/create-session',fields('b','Pilota'))).status,201);
});
test('credential quota and IP binding survive concurrent claims', async () => {
    const { room }=await setup();
    assert.equal((await call(room,'/claim-credential',{turnSessionToken:cap('h'),ip:'elsewhere'})).status,403);
    const responses=await Promise.all(Array.from({length:5},()=>call(room,'/claim-credential',{turnSessionToken:cap('h'),ip:'127.0.0.1'})));
    assert.equal(responses.filter(r=>r.status===200).length,2);
    assert.equal(responses.filter(r=>r.status===429).length,3);
});
test('heartbeat renews admitted sessions, prunes departed names; old alarm cannot erase renewed room', async () => {
    const { room, storage }=await setup(); await call(room,'/create-session',fields('a'));
    await call(room,'/admit',{closeToken:cap('X'),peerId:'peer-a',admissionToken:cap('A')});
    const before=(await storage.get<any>('room')).sessions[cap('a')].expiresAt;
    await call(room,'/heartbeat',{closeToken:cap('X'),expiresAt:Date.now()+1800_000,peerIds:['peer-a']});
    assert.ok((await storage.get<any>('room')).sessions[cap('a')].expiresAt>=before);
    await room.alarm(); assert.ok(await storage.get('room'));
    await call(room,'/heartbeat',{closeToken:cap('X'),expiresAt:Date.now()+1800_000,peerIds:[]});
    assert.equal((await storage.get<any>('room')).sessions[cap('a')],undefined);
});
test('close requires capability and invalidates every session', async () => {
    const { room,storage }=await setup();
    assert.equal((await call(room,'/close',{closeToken:cap('A')})).status,403);
    assert.equal((await call(room,'/close',{closeToken:cap('X')})).status,204);
    assert.equal(await storage.get('room'),undefined);
});
test('concurrent room registrations produce only one owner', async () => {
    const storage=new MemoryStorage();const room=new TurnRoomStateMachine({storage},5);
    const responses=await Promise.all(['a','b'].map(c=>call(room,'/register',{...fields(c),closeToken:cap(c),expiresAt:Date.now()+1800_000,sessionExpiresAt:Date.now()+300_000})));
    assert.deepEqual(responses.map(r=>r.status).sort(),[201,409]);
});

test('renewed sessions retain names and can refresh TURN beyond initial five minutes',async(t)=>{
    let now=Date.now();t.mock.method(Date,'now',()=>now);
    const {room}=await setup();await call(room,'/create-session',fields('a','Pilot'));
    await call(room,'/admit',{closeToken:cap('X'),peerId:'peer-a',admissionToken:cap('A')});
    const claim=()=>call(room,'/claim-credential',{turnSessionToken:cap('h'),ip:'127.0.0.1'});
    assert.equal((await claim()).status,200);
    for(let minute=2;minute<=12;minute+=2){
        now+=120_000;
        assert.equal((await call(room,'/heartbeat',{closeToken:cap('X'),expiresAt:now+1800_000,peerIds:['peer-a']})).status,200);
        if(minute%4===0)assert.equal((await claim()).status,200);
    }
    assert.equal((await call(room,'/create-session',fields('b','pilot'))).status,409);
});
test('expired pending reservations free usernames',async(t)=>{
    let now=Date.now();t.mock.method(Date,'now',()=>now);
    const {room}=await setup();await call(room,'/create-session',fields('a','Pilot'));
    now+=300_001;
    assert.equal((await call(room,'/create-session',fields('b','pilot'))).status,201);
});
test('expired relay lease does not free an admitted player name while room is alive',async(t)=>{
    let now=Date.now();t.mock.method(Date,'now',()=>now);
    const {room}=await setup();now+=300_001;
    assert.equal((await call(room,'/create-session',fields('b','host'))).status,409);
    assert.equal((await call(room,'/claim-credential',{turnSessionToken:cap('h'),ip:'127.0.0.1'})).status,404);
    await call(room,'/heartbeat',{closeToken:cap('X'),expiresAt:now+1800_000,peerIds:[]});
    assert.equal((await call(room,'/claim-credential',{turnSessionToken:cap('h'),ip:'127.0.0.1'})).status,200);
});
