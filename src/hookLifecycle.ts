import type { Object3D } from 'three';
import { state } from './state.js';
import { sendWeaponIntent, sendSwitchStart } from './weaponNetworkPort.js';
import { isLight } from './weaponHandling.js';
import type { WeaponName } from './networkTypes.js';

export function resetHook(): void {
    const weapon = (state.nextWeaponName ?? state.activeWeaponName) as WeaponName;
    const released = (state.hookState !== 'IDLE' || state.weaponHandling.launchPending) &&
        state.weaponHandling.releaseGrapple(weapon, state.weaponTime);
    clearHookTether();
    if (released && state.isMultiplayer) sendWeaponIntent('release', weapon);
}

/** Separate the cable from hand ownership: regrip, correction and boarding
 * can all cut a tether without issuing a second network command. */
export function clearHookTether(): void {
    state.hookState = 'IDLE';
    state.hookWillHit = false;
    state.hookIsEnemy = false;
    state.hookTargetEnemy = null;
    state.hookTargetCockpit = null;
    state.hookTargetSurface = null;
    state.hookSurfaceLocalPoint.set(0, 0, 0);
    state.hookMesh?.removeFromParent();
}

/** A recycled target object must never carry a grapple into its next spawn. */
export function cancelHookForTarget(target: Object3D): void {
    if (state.hookIsEnemy && state.hookTargetEnemy === target) resetHook();
}

/** Both the host and the owner begin the off-hand movement on withdrawal.
 * A light-to-light switch leaves a connected cable on the same launcher. */
export function beginWeaponSwitch(): boolean {
    if (state.switchState !== 'IDLE' || state.activeWeaponName === state.desiredWeaponName) return false;
    state.nextWeaponName = state.desiredWeaponName;
    state.switchState = 'WITHDRAWING';
    state.switchTimer = 0;
    state.weaponHandling.equip(state.nextWeaponName, state.weaponTime, state.activeWeaponName);
    if (!isLight(state.nextWeaponName)) clearHookTether();
    if (state.isMultiplayer) sendSwitchStart();
    return true;
}
