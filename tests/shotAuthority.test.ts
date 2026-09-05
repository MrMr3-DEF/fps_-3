import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { ShotLedger, spreadDirection, acceptDeath, acceptLifeUpdate } from '../src/shotAuthority.ts';
import { segmentAabbHitT } from '../src/gameplayMath.ts';
import { WEAPON_STATS } from '../src/config.ts';
import type { FirePacket, WeaponName } from '../src/networkTypes.ts';
const fire=(weapon:WeaponName,shotId=1):FirePacket=>({type:'fire',weapon,shotId,spreadSeed:42,barrelPos:{x:0,y:2,z:0},dir:{x:0,y:0,z:-1}});
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
test('death is consumed once per life and revival requires the next life',()=>{
    const life={lifeId:3,wasDead:false,deathReported:false};
    assert.equal(acceptLifeUpdate(life,4,false),false);
    assert.ok(acceptDeath(life,3));assert.equal(acceptDeath(life,3),false);
    assert.equal(acceptLifeUpdate(life,3,false),false);
    assert.ok(acceptLifeUpdate(life,4,false));assert.equal(acceptDeath(life,3),false);
    assert.ok(acceptDeath(life,4));
    assert.equal(new ShotLedger().record(fire('SNIPER'),1000,true),false);
});
