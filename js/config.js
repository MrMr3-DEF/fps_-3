export const MAP_SIZE = 680;
export const PILLAR_COUNT = 104;
export const PILLAR_WIDTH = 6.0;

export const WALK_SPEED = 35.0;
export const PLAYER_RADIUS = 0.8;

export const JUMP_FORCE = 164.0;
export const BASE_GRAVITY = 420.0;

export const MAX_PILLAR_HEIGHT = 225.0;
export const MAX_ENEMY_HEIGHT = 275.0;
export const HOOK_MAX_RANGE = 300.0;

export const SWITCH_DURATION = 0.15;
export const PROJECTILE_SPEED = 350;
export const PROJECTILE_LIFETIME = 2.0;

export const ENEMY_CLASSES = [
    { hp: 1, color: 0x00bfff, scale: 1.5 },
    { hp: 3, color: 0x2ed573, scale: 3 },
    { hp: 5, color: 0xffa500, scale: 4.5 },
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
    PISTOL: { fireRate: 0.1, damage: 1, recoil: 0.08, spread: 0.002, bulletColor: 0xff0055 },
    SHOTGUN: { fireRate: 0.6, damage: 1, recoil: 0.22, spread: 0.08, bulletColor: 0xffaa00, pellets: 5 },
    AR: { fireRate: 0.15, damage: 1, recoil: 0.12, spread: 0.002, bulletColor: 0x00ff88 },
    SNIPER: { fireRate: 2.0, damage: 10, recoil: 0.30, spread: 0.0, bulletColor: 0xffff00 },
    MINIGUN: { fireRate: 0.06, damage: 1, recoil: 0.02, spread: 0.002, bulletColor: 0xff6600 },
};

export const LAVA_DAMAGE_TICK_MS = 500;
export const LAVA_DAMAGE_PER_TICK = 1;
export const LAVA_POOL_HALF_SIZE = 12.8;

export const NETWORK_TICK_MS = 33;
export const MAX_PLAYERS = 5;
export const ROOM_CODE_LENGTH = 4;
export const PEER_Y_OFFSET = 0.35;
export const HIT_FLASH_DURATION_MS = 150;

export const HOOK_SPEED = 300;
export const LASER_BEAM_FADE_TIME = 0.3;
export const TARGET_HIT_RANGE_MULTIPLIER = 1.6;

// Cleaned up Config additions
export const BUSH_2D_COUNT = 250;
export const BUSH_3D_COUNT = 180;
export const BUSH_3D_RADIUS_CAP = 330;
export const BUSH_2D_INNER_RADIUS = 345;
export const BUSH_2D_SPREAD = 1155;

export const HOVER_DRAIN_RATE = 5.0;
export const HOVER_RECHARGE_RATE = 3.0;
export const GROUND_FRICTION = 10.0;
export const GRAPPLE_GRAVITY_SCALE = 0.3;
export const HOVER_GRAVITY_SCALE = 0.1;
export const HOVER_MAX_FALL_SPEED = -4.5;
export const AIR_STEER_FORCE = 35.0;
export const AIR_BACK_BRAKE_COEFF = 1.5;

export const HOOK_RELEASE_DISTANCE = 3.0;
export const HOOK_OBJECT_RELEASE_DISTANCE = 12.0;
export const HOOK_MAGNETIC_RADIUS = 3.5;
export const HOOK_MIN_PULL_SPEED = 35.0;
export const HOOK_MAX_SLINGSHOT_SPEED = 120.0;
export const HOOK_SLINGSHOT_ACCEL = 400.0;

export const REGEN_DELAY_MS = 4000;
export const MAP_HALF_SIZE = 340;
export const BORDER_WARN_THRESHOLD = 50;
export const BORDER_PULSE_DISTANCE = 1.5;
export const MINIGUN_RAMP_TIME = 3.0;
export const MINIGUN_MIN_RPM = 50.0;
export const MINIGUN_MAX_RPM = 1000.0;

export const MAX_PARTICLES = 500;

export const HOOK_STATE = Object.freeze({
    IDLE: 'IDLE',
    FIRING: 'FIRING',
    PULLING: 'PULLING'
});

export const WEAPON_SWITCH_STATE = Object.freeze({
    IDLE: 'IDLE',
    WITHDRAWING: 'WITHDRAWING',
    BRINGING_IN: 'BRINGING_IN'
});

export const INSPECT_STATE = Object.freeze({
    IDLE: 'IDLE',
    INSPECTING: 'INSPECTING'
});

export const PEER_BULLET_COLORS = Object.freeze({
    PISTOL: 0xff0055,
    SHOTGUN: 0xffaa00,
    AR: 0x00ff88,
    MINIGUN: 0xff6600
});


