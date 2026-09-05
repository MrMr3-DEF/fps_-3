export function isUsername(value: unknown): value is string {
    return typeof value === 'string' && /^[A-Za-z]{1,10}$/.test(value);
}
export function usernameKey(name: string): string { return name.toLowerCase(); }
export function isPeerId(value: unknown): value is string {
    return typeof value === 'string' && /^[A-Za-z0-9_-]{1,128}$/.test(value);
}
export function isCapability(value: unknown): value is string {
    return typeof value === 'string' && /^[A-Za-z0-9_-]{43}$/.test(value);
}
