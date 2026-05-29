export const MAP_SIZE = 680;
export const PILLAR_COUNT = 104;
export const PILLAR_WIDTH = 6.0;

export const WALK_SPEED = 35.0;
export const SPRINT_SPEED = 65.0;
export const PLAYER_RADIUS = 0.8;

export const JUMP_FORCE = 164.0;
export const BASE_GRAVITY = 420.0;

export const MAX_PILLAR_HEIGHT = 120.0;
export const MAX_ENEMY_HEIGHT = 120.0;
export const HOOK_MAX_RANGE = 300.0;

export const SWITCH_DURATION = 0.15;
export const PROJECTILE_SPEED = 200;
export const PROJECTILE_LIFETIME = 2.0;

export const ENEMY_CLASSES = [
    { hp: 1,  color: 0x00bfff, scale: 1.5 },
    { hp: 3,  color: 0x2ed573, scale: 3 },
    { hp: 5,  color: 0xffa500, scale: 4.5 },
    { hp: 10, color: 0xff4757, scale: 6 }
];

// Phase 1 Additions: Centralized player, weapon, lava, multiplayer & grapple configs
export const PLAYER_HEIGHT = 2.0;
export const PLAYER_MAX_HP = 10;
export const PLAYER_HIT_RANGE = 0.8;
export const DEFAULT_FOV = 75;
export const SCOPED_FOV = 15;
export const FOV_LERP_SPEED = 15;

export const WEAPON_STATS = {
    PISTOL:  { fireRate: 0.1, damage: 1, recoil: 0.08, spread: 0.0,  bulletColor: 0xff0055 },
    SHOTGUN: { fireRate: 0.6, damage: 1, recoil: 0.22, spread: 0.08, bulletColor: 0xffaa00, pellets: 5 },
    AR:      { fireRate: 0.15, damage: 1, recoil: 0.12, spread: 0.02, bulletColor: 0x00ff88 },
    SNIPER:  { fireRate: 2.0, damage: 10, recoil: 0.30, spread: 0.0, bulletColor: 0xffff00 },
};

export const LAVA_DAMAGE_TICK_MS = 500;
export const LAVA_DAMAGE_PER_TICK = 1;
export const LAVA_POOL_HALF_SIZE = 12.8;

export const NETWORK_TICK_MS = 33;
export const MAX_PLAYERS = 5;
export const ROOM_CODE_LENGTH = 4;
export const PEER_Y_OFFSET = 1.0;
export const HIT_FLASH_DURATION_MS = 150;

export const HOOK_SPEED = 200;
export const HOOK_PULL_SPEED = 45;
export const LASER_BEAM_FADE_TIME = 0.3;
export const TARGET_HIT_RANGE_MULTIPLIER = 1.6;

