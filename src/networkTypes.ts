export type HookState = 'IDLE' | 'FIRING' | 'PULLING';

export interface Vec3Packet {
    x: number;
    y: number;
    z: number;
}

export interface HoverKeysPacket {
    w: boolean;
    s: boolean;
    a: boolean;
    d: boolean;
}

export interface UpdatePacket {
    type: 'update';
    senderPeerId?: string;
    username: string;
    pos: Vec3Packet;
    yaw: number;
    pitch: number;
    activeWeapon: string;
    isMouseDown: boolean;
    isDead: boolean;
    hookState: HookState;
    hookPos: Vec3Packet | null;
    isHovering: boolean;
    hoverKeys: HoverKeysPacket | null;
}

export interface FirePacket {
    type: 'fire';
    senderPeerId?: string;
    weapon: string;
    barrelPos: Vec3Packet;
    dir: Vec3Packet;
    hitPoint?: Vec3Packet;
}

export interface HitTargetPacket {
    type: 'hit_target';
    senderPeerId?: string;
    targetIndex: number;
    damage: number;
}

export interface KillTargetPacket {
    type: 'kill_target';
    senderPeerId?: string;
    targetIndex: number;
    score: number;
    newPosition: Vec3Packet;
    scale: number;
    hp: number;
    color: number;
}

export interface PlayerHitPacket {
    type: 'player_hit';
    senderPeerId?: string;
    targetPeerId: string;
    damage: number;
    attackerName: string;
}

export interface PlayerDiedPacket {
    type: 'player_died';
    senderPeerId?: string;
    victimName: string;
    killerName: string;
    victimPeerId?: string;
}

export interface JumpPacket {
    type: 'jump';
    senderPeerId?: string;
}

export type NetworkPacket =
    | UpdatePacket
    | FirePacket
    | HitTargetPacket
    | KillTargetPacket
    | PlayerHitPacket
    | PlayerDiedPacket
    | JumpPacket;
