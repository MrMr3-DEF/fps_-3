import type { Object3D } from 'three';
import { state } from './state.js';

export function resetHook(): void {
    state.hookState = 'IDLE';
    state.hookWillHit = false;
    state.hookIsEnemy = false;
    state.hookTargetEnemy = null;
    state.hookMesh?.removeFromParent();
    const badge = document.getElementById('hook-badge');
    if (badge) badge.style.display = 'none';
}

/** A recycled target object must never carry a grapple into its next spawn. */
export function cancelHookForTarget(target: Object3D): void {
    if (state.hookIsEnemy && state.hookTargetEnemy === target) resetHook();
}
