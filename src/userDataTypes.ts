import * as THREE from 'three';
import type { ProjectileHomingTarget } from './projectileHoming.js';

export interface TargetUserData {
    index: number;
    maxHp: number;
    hp: number;
    scale: number;
    color: number;
    /** Increments when this reusable target instance is eliminated. */
    eliminationRevision: number;
    bodyMesh: THREE.Mesh;
    healthBarFg: THREE.Mesh;
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
    distanceTraveled: number;
    visualOnly: boolean;
    damage?: number;
    shotId?: number;
    pelletIndex?: number;
    homingTarget?: ProjectileHomingTarget;
    /** Travel distance captured at fire time; steering begins after this threshold. */
    homingStartDistance?: number;
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
