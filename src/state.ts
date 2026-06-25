import * as THREE from 'three';
import { PLAYER_MAX_HP } from './config.js';
import type { PointerLockControls } from 'three/examples/jsm/controls/PointerLockControls.js';
import type { Particle } from './particles.js';

export interface PeerLike {
    id: string;
    destroy(): void;
    on(event: string, cb: (...args: any[]) => void): void;
    connect(id: string): DataConnectionLike;
}

export interface DataConnectionLike {
    open: boolean;
    peer: string;
    send(data: unknown): void;
    close(): void;
    on(event: string, cb: (...args: any[]) => void): void;
}

export interface PeerData {
    mesh: THREE.Group;
    targetPosition: THREE.Vector3;
    targetYaw: number;
    leftGun: THREE.Group;
    rightGunContainer: THREE.Group;
    pistolMesh: THREE.Group;
    shotgunMesh: THREE.Group;
    arMesh: THREE.Group;
    sniperMesh: THREE.Group;
    minigunMesh: THREE.Group;
    minigunRamp?: number;
    lastUpdateTime?: number;
    hookLine: THREE.Mesh | null;
}

export interface GameState {
    moveForward: boolean;
    moveBackward: boolean;
    moveLeft: boolean;
    moveRight: boolean;
    canJump: boolean;

    prevTime: number;
    velocity: THREE.Vector3;

    score: number;
    playerHp: number;
    playerMaxHp: number;
    lastDamageTime: number;
    isPlaying: boolean;
    pendingPlay: boolean;
    regenTimer: number;
    kills: number;
    deaths: number;

    isMultiplayer: boolean;
    isHost: boolean;
    roomCode: string | null;
    peer: PeerLike | null;
    connections: DataConnectionLike[];
    peers: Record<string, PeerData>;
    peerIds: string[];

    targets: THREE.Group[];
    obstacles: THREE.Object3D[];
    grappleSurfaces: THREE.Object3D[];
    projectiles: THREE.Object3D[];
    projectilePool: THREE.Object3D[];
    activeParticles: Particle[];
    lavaPools: THREE.Object3D[];
    fakePillars: THREE.Object3D[];

    hookState: 'IDLE' | 'FIRING' | 'PULLING';
    hookPosition: THREE.Vector3;
    hookTarget: THREE.Vector3;
    hookWillHit: boolean;
    hookIsEnemy: boolean;
    hookTargetEnemy: THREE.Object3D | null;
    hookMesh: THREE.Mesh | null;

    activeWeaponName: string;
    nextWeaponName: string | null;
    desiredWeaponName: string;
    switchState: 'IDLE' | 'WITHDRAWING' | 'BRINGING_IN';
    switchTimer: number;
    fireCooldown: number;
    isMouseDown: boolean;
    minigunRamp: number;
    inspectState: 'IDLE' | 'INSPECTING';
    inspectTimer: number;

    camera: THREE.PerspectiveCamera | null;
    scene: THREE.Scene | null;
    renderer: THREE.WebGLRenderer | null;
    controls: PointerLockControls | null;
    leftGun: THREE.Object3D | null;
    rightGun: THREE.Object3D | null;
    rightGunContainer: THREE.Object3D | null;
    pistolMesh: THREE.Object3D | null;
    shotgunMesh: THREE.Object3D | null;
    arMesh: THREE.Object3D | null;
    sniperMesh: THREE.Object3D | null;
    minigunMesh: THREE.Object3D | null;
    playerMesh: THREE.Group | null;
    isThirdPerson: boolean;
    isScoped: boolean;
    rightClickActive: boolean;
    keyCActive: boolean;
    baseSensitivity: number;
    hoverFuel: number;
    isShiftDown: boolean;
    isHovering: boolean;
}

export const state: GameState = {
    // Input flags consumed by the physics loop.
    moveForward: false,
    moveBackward: false,
    moveLeft: false,
    moveRight: false,
    canJump: false,

    // Runtime physics state.
    prevTime: performance.now(),
    velocity: new THREE.Vector3(),

    // Local player stats and lifecycle.
    score: 0,
    playerHp: PLAYER_MAX_HP,
    playerMaxHp: PLAYER_MAX_HP,
    lastDamageTime: 0,
    isPlaying: false,
    pendingPlay: false,
    regenTimer: 0,
    kills: 0,
    deaths: 0,

    // PeerJS/WebRTC session state.
    isMultiplayer: false,
    isHost: false,
    roomCode: null,
    peer: null,
    connections: [],
    peers: {},
    peerIds: [],

    // Scene object registries used by update loops and collision checks.
    targets: [],
    obstacles: [],
    grappleSurfaces: [],
    projectiles: [],
    projectilePool: [],
    activeParticles: [],
    lavaPools: [],
    fakePillars: [],

    // Local grappling hook state.
    hookState: 'IDLE',
    hookPosition: new THREE.Vector3(),
    hookTarget: new THREE.Vector3(),
    hookWillHit: false,
    hookIsEnemy: false,
    hookTargetEnemy: null,
    hookMesh: null,

    // Current weapon, switching, firing and inspect animation state.
    activeWeaponName: 'PISTOL',
    nextWeaponName: null,
    desiredWeaponName: 'PISTOL',
    switchState: 'IDLE',
    switchTimer: 0,
    fireCooldown: 0,
    isMouseDown: false,
    minigunRamp: 0.0,
    inspectState: 'IDLE',
    inspectTimer: 0.0,

    // Three.js scene graph references and first/third-person view state.
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

export function resetPlayerState() {
    state.playerHp = state.playerMaxHp;
    state.score = 0;
    state.kills = 0;
    state.deaths = 0;
    state.velocity.set(0, 0, 0);
    state.hookState = 'IDLE';
    state.hookPosition.set(0, 0, 0);
    state.hookTarget.set(0, 0, 0);
    state.hookWillHit = false;
    state.hookIsEnemy = false;
    state.hookTargetEnemy = null;
    state.hoverFuel = 1.0;
    state.inspectState = 'IDLE';
    state.inspectTimer = 0;
    state.minigunRamp = 0;
}
