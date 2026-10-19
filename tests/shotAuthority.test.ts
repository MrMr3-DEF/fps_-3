import { TargetMotionHistory } from '../src/projectileFlight.ts';
import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { ShotLedger, spreadDirection, acceptDeath, acceptLifeUpdate, initialWeaponState, advanceWeaponState } from '../src/shotAuthority.ts';
import { segmentAabbHitT } from '../src/gameplayMath.ts';
import { BULLET_TRAVEL_DISTANCE, PROJECTILE_SPEED, WEAPON_STATS } from '../src/config.ts';
import type { FirePacket, WeaponName } from '../src/networkTypes.ts';
const fire=(weapon:WeaponName,shotId=1):FirePacket=>({type:'fire',weapon,shotId,spreadSeed:42,barrelPos:{x:0,y:2,z:0},dir:{x:0,y:0,z:-1}});

test('a slower previous shot keeps its cooldown when changing to a faster weapon', () => {
    const ledger = new ShotLedger();
    assert.ok(ledger.record(fire('SNIPER'), 1000, false));
    assert.equal(ledger.record(fire('PISTOL', 2), 1090, false), false);
    assert.equal(ledger.record(fire('AR', 2), 1500, false), false);
    assert.ok(ledger.record(fire('PISTOL', 2), 3000, false));
    assert.equal(ledger.record(fire('SNIPER', 3), 3050, false), false);
    assert.ok(ledger.record(fire('SNIPER', 3), 3100, false));
});

test('early packet jitter cannot compound into accelerated fire', () => {
    const ledger = new ShotLedger();
    assert.ok(ledger.record(fire('PISTOL'), 0, false));
    assert.ok(ledger.record(fire('PISTOL', 2), 90, false));
    assert.equal(ledger.record(fire('PISTOL', 3), 180, false), false);
    assert.ok(ledger.record(fire('PISTOL', 3), 190, false));
    assert.equal(ledger.record(fire('PISTOL', 4), 280, false), false);
});

test('weapon authority requires withdraw and bring-in time and cannot oscillate intent', () => {
    const packet = (activeWeapon: WeaponName, switchState: 'IDLE' | 'WITHDRAWING' | 'BRINGING_IN', nextWeapon: WeaponName | null) =>
        ({ activeWeapon, switchState, nextWeapon } as any);
    let accepted = initialWeaponState('SNIPER');
    assert.equal(advanceWeaponState(accepted, packet('PISTOL', 'IDLE', null), 0), null);
    accepted = advanceWeaponState(accepted, packet('SNIPER', 'WITHDRAWING', 'PISTOL'), 0)!;
    assert.equal(advanceWeaponState(accepted, packet('SNIPER', 'WITHDRAWING', 'AR'), 100), null);
    assert.equal(advanceWeaponState(accepted, packet('PISTOL', 'BRINGING_IN', 'PISTOL'), 90), null);
    accepted = advanceWeaponState(accepted, packet('PISTOL', 'BRINGING_IN', 'PISTOL'), 150)!;
    assert.equal(advanceWeaponState(accepted, packet('PISTOL', 'IDLE', null), 200), null);
    accepted = advanceWeaponState(accepted, packet('PISTOL', 'IDLE', null), 300)!;
    assert.equal(accepted.activeWeapon, 'PISTOL'); assert.equal(accepted.switchState, 'IDLE');
    accepted = advanceWeaponState(accepted, packet('PISTOL', 'WITHDRAWING', 'SNIPER'), 400)!;
    assert.equal(advanceWeaponState(accepted, packet('SNIPER', 'BRINGING_IN', 'SNIPER'), 400), null);
    assert.equal(advanceWeaponState(accepted, packet('SNIPER', 'IDLE', null), 400), null);
    accepted = advanceWeaponState(accepted, packet('SNIPER', 'IDLE', null), 700)!;
    assert.equal(accepted.activeWeapon, 'SNIPER', 'a delayed idle update recovers a compressed delivery burst');
});
test('each weapon enforces millisecond cooldowns and rejects duplicate shots',()=>{
    for(const weapon of ['PISTOL','SHOTGUN','AR','SNIPER'] as WeaponName[]){
        const ledger=new ShotLedger();assert.ok(ledger.record(fire(weapon),1000,false));
        assert.equal(ledger.record(fire(weapon,2),1010,false),false);
        assert.ok(ledger.record(fire(weapon,2),1000+WEAPON_STATS[weapon].fireRate*1000,false));
        assert.equal(ledger.record(fire(weapon,2),5000,false),false);
    }
});
test('minigun requires spinup and respects ramp-dependent cadence',()=>{
    const ledger=new ShotLedger();ledger.updateTrigger(true,0);
    assert.equal(ledger.record(fire('MINIGUN'),299,false),false);
    assert.ok(ledger.record(fire('MINIGUN'),300,false));
    assert.equal(ledger.record(fire('MINIGUN',2),350,false),false);
    ledger.updateTrigger(false,400);assert.equal(ledger.record(fire('MINIGUN',2),4000,false),false);
});
test('shotgun cannot claim a nearby target through a pillar',()=>{
    const ledger=new ShotLedger();ledger.record(fire('SHOTGUN'),1000,false);
    const blocked=(a:THREE.Vector3,b:THREE.Vector3)=>segmentAabbHitT(a,b,new THREE.Vector3(-3,0,-8),new THREE.Vector3(3,10,-2))!==null;
    for(let i=0;i<5;i++) assert.equal(ledger.consume(1,i,new THREE.Vector3(0,2,-20),1.6,1,1100,blocked),false);
});
test('exact pellet consumption rejects replays, wrong damage and impossible travel',()=>{
    const ledger=new ShotLedger();ledger.record(fire('AR'),1000,false);
    const dir=spreadDirection(new THREE.Vector3(0,0,-1),42,0,WEAPON_STATS.AR.spread);
    const target=new THREE.Vector3(0,2,0).addScaledVector(dir,100);
    assert.equal(ledger.consume(1,0,target,1,1,1000,()=>false),false);
    assert.equal(ledger.consume(1,0,target,1,10,1400,()=>false),false);
    assert.ok(ledger.consume(1,0,target,1,1,1400,()=>false));
    assert.equal(ledger.consume(1,0,target,1,1,1400,()=>false),false);
});
test('host authority applies the sniper range to every weapon',()=>{
    const weapons=['PISTOL','SHOTGUN','AR','SNIPER','MINIGUN'] as WeaponName[];
    const boundaryArrivalAt=1000+BULLET_TRAVEL_DISTANCE/PROJECTILE_SPEED*1000;
    const ledgerFor=(weapon:WeaponName)=>{
        const ledger=new ShotLedger();
        if(weapon==='MINIGUN') ledger.updateTrigger(true,0);
        assert.ok(ledger.record(fire(weapon),1000,false));
        return ledger;
    };
    for(const weapon of weapons){
        const direction=spreadDirection(new THREE.Vector3(0,0,-1),42,0,WEAPON_STATS[weapon].spread);
        const boundary=new THREE.Vector3(0,2,0).addScaledVector(direction,BULLET_TRAVEL_DISTANCE);
        const beyond=new THREE.Vector3(0,2,0).addScaledVector(direction,BULLET_TRAVEL_DISTANCE+1);
        assert.ok(ledgerFor(weapon).consume(1,0,boundary,0,WEAPON_STATS[weapon].damage,boundaryArrivalAt,()=>false),`${weapon} boundary`);
        assert.equal(ledgerFor(weapon).consume(1,0,beyond,0,WEAPON_STATS[weapon].damage,boundaryArrivalAt,()=>false),false,`${weapon} beyond`);
    }
});
test('host authority starts simulated shots at the projectile muzzle offset',()=>{
    const origin=new THREE.Vector3(0,2,0);
    for(const weapon of ['PISTOL','SHOTGUN','AR','MINIGUN'] as WeaponName[]){
        const ledger=new ShotLedger();
        if(weapon==='MINIGUN') ledger.updateTrigger(true,0);
        assert.ok(ledger.record(fire(weapon),1000,false));
        const direction=spreadDirection(new THREE.Vector3(0,0,-1),42,0,WEAPON_STATS[weapon].spread);
        const target=origin.clone().addScaledVector(direction,10);
        let validationStart:THREE.Vector3|null=null;
        assert.ok(ledger.consume(1,0,target,0,WEAPON_STATS[weapon].damage,1500,(start)=>{
            validationStart=start.clone();return false;
        }));
        assert.ok(validationStart);
        assert.ok(Math.abs(validationStart.distanceTo(origin)-0.1)<1e-9,`${weapon} start`);
    }

    const sniper=new ShotLedger();assert.ok(sniper.record(fire('SNIPER'),1000,false));
    let sniperStart:THREE.Vector3|null=null;
    assert.ok(sniper.consume(1,0,new THREE.Vector3(0,2,-10),0,WEAPON_STATS.SNIPER.damage,1000,(start)=>{
        sniperStart=start.clone();return false;
    }));
    assert.ok(sniperStart);
    assert.equal(sniperStart.distanceTo(origin),0);
});

test('host obstruction receives the configured projectile radius and zero for sniper', () => {
    for (const weapon of ['PISTOL', 'SNIPER'] as WeaponName[]) {
        const ledger = new ShotLedger(); ledger.record(fire(weapon), 0, false);
        let radius: number | null = null;
        ledger.consume(1, 0, new THREE.Vector3(0, 2, -10), 2, WEAPON_STATS[weapon].damage, 100,
            (_start, _end, padding) => { radius = padding; return false; });
        assert.equal(radius, weapon === 'SNIPER' ? 0 : 0.07);
    }
});
test('death is consumed once per life and revival requires the next life',()=>{
    const life={lifeId:3,wasDead:false,deathReported:false};
    assert.equal(acceptLifeUpdate(life,4,false),false);
    assert.ok(acceptDeath(life,3));assert.equal(acceptDeath(life,3),false);
    assert.equal(acceptLifeUpdate(life,3,false),false);
    assert.ok(acceptLifeUpdate(life,4,false));assert.equal(acceptDeath(life,3),false);
    assert.ok(acceptDeath(life,4));
    assert.equal(new ShotLedger().record(fire('SNIPER'),1000,true),false);
});

test('minigun retains barrel spin across a brief trigger release, then cools down', () => {
    const ledger = new ShotLedger();
    ledger.updateTrigger(true, 0);
    assert.ok(ledger.record(fire('MINIGUN', 1), 3000, false));
    ledger.updateTrigger(false, 3100);
    ledger.updateTrigger(true, 3200);
    assert.ok(ledger.record(fire('MINIGUN', 2), 3200, false), 'warm barrels can resume without a fresh spinup');
    assert.ok(ledger.record(fire('MINIGUN', 3), 3270, false), 'cadence retains the decayed ramp');
    ledger.updateTrigger(false, 3300);
    ledger.updateTrigger(true, 6000);
    assert.equal(ledger.record(fire('MINIGUN', 4), 6000, false), false, 'cold barrels require spinup');
});

test('an authorized homing shot can reach only its captured target', () => {
    const packet: FirePacket = {
        ...fire('AR'),
        homingTarget: { kind: 'npc', targetIndex: 7, targetRevision: 3 },
        homingStartDistance: Math.hypot(1.5, 40) / 3,
    };
    const ledger = new ShotLedger();
    const target = new THREE.Vector3(1.5, 2, -40), history = new TargetMotionHistory();
    history.add(1000, target);
    assert.ok(ledger.record(packet, 1000, false, { history, kind: 'sphere', radius: 1.6, canAcquire: () => true }));
    assert.equal(ledger.consumeHomingNpc(1, 0, 8, 3, target, 1.6, 1, 1100, () => false), false);
    assert.ok(ledger.consumeHomingNpc(1, 0, 7, 3, target, 1.6, 1, 1100, () => false));
    assert.equal(ledger.consumeHomingNpc(1, 0, 7, 3, target, 1.6, 1, 1100, () => false), false);
});
