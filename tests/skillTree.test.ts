import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { KATANA, SKILL_TREE_MAX_LEVEL, SKILL_TREE_MAX_WEAPON_DAMAGE, WEAPON_STATS } from '../src/config.ts';
import {
    applySkillUpgrade, createSkillTreeState, playerMaxHpForLevel,
    skillPointsForCubeMaxHp, skillUpgradeCost, weaponDamageForShot,
} from '../src/skillTree.ts';
import { createPlayerLife, healPlayerLife, upgradePlayerLifeMaxHp } from '../src/playerLife.ts';
import { ShotLedger, spreadDirection } from '../src/shotAuthority.ts';
import { parseNetworkPacket } from '../src/networkTypes.ts';

test('cube enemies award skill points by class and other enemies award none', () => {
    for (const [maxHp, points] of [[1, 1], [3, 2], [5, 3], [10, 5]]) {
        assert.equal(skillPointsForCubeMaxHp(maxHp), points);
    }
    assert.equal(skillPointsForCubeMaxHp(2), 0);
    assert.equal(skillPointsForCubeMaxHp(20), 0);
    assert.equal(skillPointsForCubeMaxHp(999), 0);
});

test('skill upgrade costs compound for weapons and stay fixed for health', () => {
    for (let level = 0; level < SKILL_TREE_MAX_LEVEL; level++) {
        assert.equal(skillUpgradeCost('HEALTH', level), 50);
    }
    assert.equal(skillUpgradeCost('HEALTH', SKILL_TREE_MAX_LEVEL), null);

    for (const upgrade of ['PISTOL', 'SHOTGUN', 'AR', 'SNIPER', 'MINIGUN', 'KATANA'] as const) {
        let expected = 5;
        for (let level = 0; level < SKILL_TREE_MAX_LEVEL; level++) {
            assert.equal(skillUpgradeCost(upgrade, level), expected, `${upgrade} Lv.${level}`);
            expected = Math.ceil(expected * 1.1);
        }
        assert.equal(skillUpgradeCost(upgrade, SKILL_TREE_MAX_LEVEL), null);
    }
    assert.deepEqual([0, 1, 2, 3].map(level => skillUpgradeCost('PISTOL', level)), [5, 6, 7, 8]);
});

test('health levels scale player maximum hit points with a final cap', () => {
    assert.equal(playerMaxHpForLevel(0), 10);
    assert.equal(playerMaxHpForLevel(1), 15);
    assert.equal(playerMaxHpForLevel(98), 500);
    assert.equal(playerMaxHpForLevel(99), 99999);
});

test('raising life capacity carries the gained headroom without reviving a dead life', () => {
    const life = createPlayerLife(1);
    life.hp = 4;
    assert.equal(upgradePlayerLifeMaxHp(life, 15), true);
    assert.equal(life.maxHp, 15);
    assert.equal(life.hp, 9);
    assert.equal(upgradePlayerLifeMaxHp(life, 15), false);

    const dead = createPlayerLife(2);
    dead.hp = 0;
    assert.equal(upgradePlayerLifeMaxHp(dead, 20), true);
    assert.equal(dead.maxHp, 20);
    assert.equal(dead.hp, 0);
});

test('regeneration heals only up to the upgraded life maximum', () => {
    const life = createPlayerLife(1, 15);
    life.hp = 12;
    life.nextHealAt = 0;
    assert.equal(healPlayerLife(life, 5000, false), true);
    assert.equal(life.hp, 15);
    assert.equal(healPlayerLife(life, 6000, false), false);
});

test('pistol damage spreads level bonuses across its five-shot cycle', () => {
    const damage = (level: number, shotIndex: number) => weaponDamageForShot('PISTOL', level, shotIndex);
    assert.deepEqual(Array.from({ length: 5 }, (_, i) => damage(0, i)), [1, 1, 1, 1, 1]);
    assert.deepEqual(Array.from({ length: 5 }, (_, i) => damage(1, i)), [1, 1, 1, 1, 2]);
    assert.deepEqual(Array.from({ length: 5 }, (_, i) => damage(2, i)), [1, 1, 1, 2, 2]);
    assert.deepEqual(Array.from({ length: 5 }, (_, i) => damage(5, i)), [2, 2, 2, 2, 2]);
    assert.deepEqual(Array.from({ length: 5 }, (_, i) => damage(6, i)), [2, 2, 2, 2, 3]);
    assert.deepEqual(Array.from({ length: 5 }, (_, i) => damage(99, i)), Array(5).fill(9999));
});

test('shotgun damage spreads level bonuses across its five pellets', () => {
    const damage = (level: number, pelletIndex: number) => weaponDamageForShot('SHOTGUN', level, 0, pelletIndex);
    assert.deepEqual(Array.from({ length: 5 }, (_, i) => damage(0, i)), [1, 1, 1, 1, 1]);
    assert.deepEqual(Array.from({ length: 5 }, (_, i) => damage(1, i)), [2, 1, 1, 1, 1]);
    assert.deepEqual(Array.from({ length: 5 }, (_, i) => damage(2, i)), [2, 2, 1, 1, 1]);
    assert.deepEqual(Array.from({ length: 5 }, (_, i) => damage(5, i)), [2, 2, 2, 2, 2]);
    assert.deepEqual(Array.from({ length: 5 }, (_, i) => damage(6, i)), [3, 2, 2, 2, 2]);
    assert.deepEqual(Array.from({ length: 5 }, (_, i) => damage(99, i)), Array(5).fill(9999));
});

test('AR damage spreads level bonuses across its four-shot cycle', () => {
    const damage = (level: number, shotIndex: number) => weaponDamageForShot('AR', level, shotIndex);
    assert.deepEqual(Array.from({ length: 4 }, (_, i) => damage(1, i)), [1, 1, 1, 2]);
    assert.deepEqual(Array.from({ length: 4 }, (_, i) => damage(2, i)), [1, 1, 2, 2]);
    assert.deepEqual(Array.from({ length: 4 }, (_, i) => damage(4, i)), [2, 2, 2, 2]);
    assert.deepEqual(Array.from({ length: 4 }, (_, i) => damage(99, i)), Array(4).fill(9999));
});

test('sniper damage increases by one per level up to the final cap', () => {
    assert.equal(weaponDamageForShot('SNIPER', 0), 10);
    assert.equal(weaponDamageForShot('SNIPER', 1), 11);
    assert.equal(weaponDamageForShot('SNIPER', 98), 108);
    assert.equal(weaponDamageForShot('SNIPER', 99), 9999);
});

test('minigun damage spreads level bonuses across its ten-shot cycle', () => {
    const damage = (level: number, shotIndex: number) => weaponDamageForShot('MINIGUN', level, shotIndex);
    assert.deepEqual(Array.from({ length: 10 }, (_, i) => damage(1, i)), [1, 1, 1, 1, 1, 1, 1, 1, 1, 2]);
    assert.deepEqual(Array.from({ length: 10 }, (_, i) => damage(10, i)), Array(10).fill(2));
    assert.deepEqual(Array.from({ length: 10 }, (_, i) => damage(99, i)), Array(10).fill(9999));
});

test('katana upgrades raise base and charged damage up to the final cap', () => {
    assert.equal(weaponDamageForShot('KATANA', 0, 0, 0, false), KATANA.damage);
    assert.equal(weaponDamageForShot('KATANA', 0, 0, 0, true), KATANA.chargedDamage);
    assert.equal(weaponDamageForShot('KATANA', 1, 0, 0, false), 6);
    assert.equal(weaponDamageForShot('KATANA', 1, 0, 0, true), 12);
    assert.equal(weaponDamageForShot('KATANA', 98, 0, 0, false), 103);
    assert.equal(weaponDamageForShot('KATANA', 98, 0, 0, true), 206);
    assert.equal(weaponDamageForShot('KATANA', 99, 0, 0, false), 9999);
    assert.equal(weaponDamageForShot('KATANA', 99, 0, 0, true), 19998);
});

test('applying an upgrade requires points and stops at the maximum level', () => {
    const tree = createSkillTreeState();
    assert.equal(applySkillUpgrade(tree, 'PISTOL').ok, false);
    assert.equal(tree.points, 0);
    assert.equal(tree.levels.PISTOL, 0);

    tree.points = 5;
    const pistol = applySkillUpgrade(tree, 'PISTOL');
    assert.equal(pistol.ok, true);
    assert.equal(pistol.cost, 5);
    assert.equal(pistol.level, 1);
    assert.equal(tree.points, 0);
    assert.equal(tree.levels.PISTOL, 1);

    tree.points = 50;
    assert.equal(applySkillUpgrade(tree, 'HEALTH').ok, true);
    assert.equal(tree.levels.HEALTH, 1);
    assert.equal(tree.points, 0);

    tree.points = 100;
    tree.levels.HEALTH = SKILL_TREE_MAX_LEVEL;
    assert.equal(applySkillUpgrade(tree, 'HEALTH').ok, false);
    assert.equal(tree.levels.HEALTH, SKILL_TREE_MAX_LEVEL);
    assert.equal(tree.points, 100);

    tree.levels.PISTOL = SKILL_TREE_MAX_LEVEL;
    assert.equal(applySkillUpgrade(tree, 'PISTOL').ok, false);
    assert.equal(tree.levels.PISTOL, SKILL_TREE_MAX_LEVEL);
    assert.equal(tree.points, 100);
});

function firedLedger(weapon: 'PISTOL' | 'SHOTGUN', level: number, shotIndex: number): ShotLedger {
    const ledger = new ShotLedger();
    assert.ok(ledger.record({
        type: 'fire', weapon, shotId: 1, spreadSeed: 42,
        barrelPos: { x: 0, y: 2, z: 0 }, dir: { x: 0, y: 0, z: -1 },
    }, 1000, false, undefined, undefined, level, shotIndex));
    return ledger;
}

function acceptedDamage(ledger: ShotLedger, weapon: 'PISTOL' | 'SHOTGUN', pelletIndex: number, damage: number): boolean {
    const direction = spreadDirection(new THREE.Vector3(0, 0, -1), 42, pelletIndex, WEAPON_STATS[weapon].spread);
    const target = new THREE.Vector3(0, 2, 0).addScaledVector(direction, 10);
    return ledger.consume(1, pelletIndex, target, 1, damage, 1100, () => false);
}

test('host shot authority verifies cyclic upgraded pistol damage', () => {
    for (let shotIndex = 0; shotIndex < 4; shotIndex++) {
        assert.equal(acceptedDamage(firedLedger('PISTOL', 1, shotIndex), 'PISTOL', 0, 2), false);
        assert.equal(acceptedDamage(firedLedger('PISTOL', 1, shotIndex), 'PISTOL', 0, 1), true);
    }
    assert.equal(acceptedDamage(firedLedger('PISTOL', 1, 4), 'PISTOL', 0, 1), false);
    assert.equal(acceptedDamage(firedLedger('PISTOL', 1, 4), 'PISTOL', 0, 2), true);
});

test('host shot authority verifies per-pellet shotgun upgraded damage', () => {
    const ledger = firedLedger('SHOTGUN', 1, 0);
    assert.equal(acceptedDamage(ledger, 'SHOTGUN', 0, 1), false);
    assert.equal(acceptedDamage(ledger, 'SHOTGUN', 0, 2), true);
    assert.equal(acceptedDamage(ledger, 'SHOTGUN', 1, 2), false);
    assert.equal(acceptedDamage(ledger, 'SHOTGUN', 1, 1), true);
});

const skillLevels = { HEALTH: 0, PISTOL: 0, SHOTGUN: 0, AR: 0, SNIPER: 0, MINIGUN: 0, KATANA: 0 };

test('network parser accepts valid skill packets and rejects malformed upgrades', () => {
    assert.equal(parseNetworkPacket({ type: 'skill_upgrade', upgrade: 'PISTOL' })?.type, 'skill_upgrade');
    assert.equal(parseNetworkPacket({ type: 'skill_state', peerId: 'peer-a', points: 5, levels: skillLevels })?.type, 'skill_state');

    assert.equal(parseNetworkPacket({ type: 'skill_upgrade', upgrade: 'LASER' }), null);
    for (const level of [-1, 100]) {
        assert.equal(parseNetworkPacket({ type: 'skill_state', peerId: 'peer-a', points: 0, levels: { ...skillLevels, PISTOL: level } }), null);
    }
    assert.equal(parseNetworkPacket({ type: 'skill_state', peerId: 'peer-a', points: 0, levels: { ...skillLevels, LASER: 0 } }), null);
    assert.equal(parseNetworkPacket({ type: 'skill_state', peerId: 'peer-a', points: -1, levels: skillLevels }), null);
});

test('network parser bounds upgraded player health', () => {
    const health = { type: 'player_health', peerId: 'peer-a', lifeId: 1, hp: 100, maxHp: 99999 };
    assert.equal(parseNetworkPacket(health)?.type, 'player_health');
    assert.equal(parseNetworkPacket({ ...health, hp: 100000 }), null);
    assert.equal(parseNetworkPacket({ ...health, hp: 1, maxHp: 100000 }), null);
});

test('network parser bounds upgraded hit damage', () => {
    const hitTarget = { type: 'hit_target', shotId: 1, pelletIndex: 0, targetIndex: 0, damage: 9999 };
    assert.equal(parseNetworkPacket(hitTarget)?.type, 'hit_target');
    assert.equal(parseNetworkPacket({ ...hitTarget, damage: SKILL_TREE_MAX_WEAPON_DAMAGE * 2 + 1 }), null);

    const playerHit = {
        type: 'player_hit', shotId: 1, pelletIndex: 0,
        targetPeerId: 'peer-a', targetLifeId: 1, damage: 9999, attackerName: 'Pilot',
    };
    assert.equal(parseNetworkPacket(playerHit)?.type, 'player_hit');
    assert.equal(parseNetworkPacket({ ...playerHit, damage: SKILL_TREE_MAX_WEAPON_DAMAGE * 2 + 1 }), null);
});
