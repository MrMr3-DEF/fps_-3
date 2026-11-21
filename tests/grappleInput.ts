import type { Ray } from 'three';
import { toggleGrapplingHook, updateHook } from '../src/grapple.ts';
import { state } from '../src/state.ts';

/** Drive the normal handoff before a test inspects the chosen world target. */
export function toggleAtDrawEnd(aim?: Ray): void {
    const hands = state.weaponHandling;
    if (hands.hand === 'returning') {
        state.weaponTime = hands.handEnds;
        hands.advance(state.weaponTime);
    }
    toggleGrapplingHook();
    if (hands.hand === 'drawing') {
        state.weaponTime = hands.handEnds;
    }
    updateHook(0, aim);
}
