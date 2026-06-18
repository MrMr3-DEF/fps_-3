import * as THREE from 'three';
import { PLAYER_MAX_HP } from './config.js';

export const state = {
    // Player controls input state
    moveForward: false,
    moveBackward: false,
    moveLeft: false,
    moveRight: false,
    canJump: false,

    // Timing and physics
    prevTime: performance.now(),
    velocity: new THREE.Vector3(),

    // Game stats
    score: 0,
    playerHp: PLAYER_MAX_HP,
    playerMaxHp: PLAYER_MAX_HP,
    lastDamageTime: 0,
    isPlaying: false,
    pendingPlay: false,
    regenTimer: 0,
    kills: 0,
    deaths: 0,

    // Multiplayer state fields
    isMultiplayer: false,
    isHost: false,
    roomCode: null,
    peer: null,
    connections: [],
    peers: {},

    // Active game object arrays
    targets: [],
    obstacles: [],
    grappleSurfaces: [],
    projectiles: [],
    projectilePool: [],
    activeParticles: [],
    lavaPools: [],
    fakePillars: [],

    // Grappling hook details
    hookState: 'IDLE', // 'IDLE', 'FIRING', 'PULLING'
    hookPosition: new THREE.Vector3(),
    hookTarget: new THREE.Vector3(),
    hookWillHit: false,
    hookIsEnemy: false,
    hookTargetEnemy: null,
    hookMesh: null,

    // Weapon system state
    activeWeaponName: 'PISTOL', // 'PISTOL', 'SHOTGUN', 'AR', 'SNIPER', 'MINIGUN'
    nextWeaponName: null,
    desiredWeaponName: 'PISTOL',
    switchState: 'IDLE', // 'IDLE', 'WITHDRAWING', 'BRINGING_IN'
    switchTimer: 0,
    fireCooldown: 0,
    isMouseDown: false,
    minigunRamp: 0.0,
    inspectState: 'IDLE', // 'IDLE', 'INSPECTING'
    inspectTimer: 0.0,

    // Three.js instances
    camera: null,
    scene: null,
    renderer: null,
    controls: null,
    leftGun: null,
    rightGun: null,
    rightGunContainer: null,
    pistolMesh: null,
    shotgunMesh: null,
    arMesh: null,
    sniperMesh: null,
    minigunMesh: null,
    playerMesh: null,
    isThirdPerson: false,
    isScoped: false,
    rightClickActive: false,
    keyCActive: false,
    baseSensitivity: 1.0,
    hoverFuel: 1.0,
    isShiftDown: false,
    isHovering: false,
};

// Resets player health, score, velocity, grapple hook state variables, and hover fuel back to default initial values.
export function resetPlayerState() {
    state.playerHp = state.playerMaxHp;
    state.score = 0;
    state.velocity.set(0, 0, 0);
    state.hookState = 'IDLE';
    state.hookPosition.set(0, 0, 0);
    state.hookTarget.set(0, 0, 0);
    state.hookWillHit = false;
    state.hookIsEnemy = false;
    state.hookTargetEnemy = null;
    state.hoverFuel = 1.0;
}

