import { state } from '../src/state.ts';
import { getLavaPitFloorY, isPointInLava } from '../src/lavaPools.ts';
// Broad-phase test double: all fixture obstacles are candidates.
export function queryObstaclesNear(_x:number,_z:number,_radius:number,out:unknown[]) {
    out.length=0;out.push(...state.obstacles);return out;
}
// Fixture worlds keep their lava pools in state, so the real organic queries
// still drive movement and damage without the production spatial hash.
export function queryLavaPoolsNear(_x:number,_z:number,_radius:number,out:any[]=[]) {
    out.length=0;out.push(...state.lavaPools);return out;
}
export function getTerrainHeightAt(x:number,z:number) {
    return getLavaPitFloorY(x,z,state.lavaPools);
}
export function isInLavaAt(x:number,z:number,feetY:number,radius=0) {
    return isPointInLava(x,z,feetY,radius,state.lavaPools);
}
