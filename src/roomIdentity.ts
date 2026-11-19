import { MAX_PLAYERS } from './config.js';

export function isUsername(value: unknown): value is string {
    if (typeof value !== 'string') return false;
    if (/^[A-Za-z]{1,10}$/.test(value)) return true;
    const guest = /^Guest([1-9][0-9]*)$/.exec(value);
    return guest !== null && Number(guest[1]) <= MAX_PLAYERS;
}
export function usernameKey(name: string): string { return name.toLowerCase(); }
export function isAdmissionGeneration(value: unknown): value is number {
    return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
}
export function isPeerId(value: unknown): value is string {
    return typeof value === 'string' && /^[A-Za-z0-9_-]{1,128}$/.test(value) &&
        !Object.hasOwn(Object.prototype, value);
}
export function isCapability(value: unknown): value is string {
    return typeof value === 'string' && /^[A-Za-z0-9_-]{43}$/.test(value);
}

export function matchesCapability(expected: unknown, received: unknown): boolean {
    if (!isCapability(expected) || !isCapability(received)) return false;
    const subtle = crypto.subtle as SubtleCrypto & {
        timingSafeEqual?(left: Uint8Array, right: Uint8Array): boolean;
    };
    if (subtle.timingSafeEqual) {
        const encoder = new TextEncoder();
        return subtle.timingSafeEqual(encoder.encode(expected), encoder.encode(received));
    }
    // Tests and browser builds also run where the Workers extension is absent.
    let difference = 0;
    for (let i = 0; i < expected.length; i++) difference |= expected.charCodeAt(i) ^ received.charCodeAt(i);
    return difference === 0;
}
