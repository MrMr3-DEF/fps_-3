import * as THREE from 'three';

export interface TargetUserData {
    index: number;
    maxHp: number;
    hp: number;
    scale: number;
    color: number;
    bodyMesh: THREE.Mesh;
    healthBarFg: THREE.Mesh;
    healthBarBg: THREE.Mesh;
    healthBarGroup: THREE.Group;
}

export interface ObstacleUserData {
    height: number;
    halfW: number;
    halfD: number;
    halfH: number;
}

export interface ProjectileUserData {
    dx: number;
    dy: number;
    dz: number;
    age: number;
    visualOnly: boolean;
    damage?: number;
}

export interface FlashableUserData {
    originalColor?: number;
}

export function targetData(target: THREE.Group): TargetUserData {
    return target.userData as TargetUserData;
}

export function obstacleData(obstacle: THREE.Object3D): ObstacleUserData {
    return obstacle.userData as ObstacleUserData;
}

export function projectileData(projectile: THREE.Object3D): ProjectileUserData {
    return projectile.userData as ProjectileUserData;
}
