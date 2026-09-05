import { state } from '../src/state.ts';
// Broad-phase test double: all fixture obstacles are candidates.
export function queryObstaclesNear(_x:number,_z:number,_radius:number,out:unknown[]) {
    out.length=0;out.push(...state.obstacles);return out;
}
