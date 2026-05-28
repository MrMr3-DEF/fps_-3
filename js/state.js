import * as THREE from 'three';

export const state = {
    // Player controls input state
    moveForward: false,
    moveBackward: false,
    moveLeft: false,
    moveRight: false,
    isSprinting: false,
    canJump: false,

    // Timing and physics
    prevTime: performance.now(),
    velocity: new THREE.Vector3(),

    // Game stats
    score: 0,
    playerHp: 10,
    playerMaxHp: 10,
    lastDamageTime: 0,

    // Active game object arrays
    targets: [],
    obstacles: [],
    grappleSurfaces: [],
    projectiles: [],
    projectilePool: [],
    activeParticles: [],
    lavaPools: [],

    // Grappling hook details
    hookState: 'IDLE', // 'IDLE', 'FIRING', 'PULLING'
    hookPosition: new THREE.Vector3(),
    hookTarget: new THREE.Vector3(),
    hookWillHit: false,
    hookIsEnemy: false,
    hookTargetEnemy: null,
    hookMesh: null,

    // Weapon system state
    activeWeaponName: 'PISTOL', // 'PISTOL' or 'SHOTGUN'
    nextWeaponName: null,
    desiredWeaponName: 'PISTOL',
    switchState: 'IDLE', // 'IDLE', 'WITHDRAWING', 'BRINGING_IN'
    switchTimer: 0,
    fireCooldown: 0,
    isMouseDown: false,

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
    playerMesh: null,
    isThirdPerson: false,
};
