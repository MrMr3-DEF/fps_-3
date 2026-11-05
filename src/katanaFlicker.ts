import * as THREE from 'three';
// Authored once with seed 81423. Durations are milliseconds; no runtime randomness.
const pattern: readonly (readonly [number, number])[] = [[88, 0.749], [90, 0.636], [192, 0.762], [132, 0.665], [160, 0.667], [106, 0.743], [88, 0.749], [189, 0.764], [143, 0.52], [140, 0.693], [158, 0.694], [151, 0.673], [193, 0.727], [202, 0.745], [152, 0.643], [204, 0.71], [96, 0.668], [133, 0.632], [81, 0.751], [154, 0.749], [190, 0.765], [210, 0.72], [151, 0.658], [197, 0.88], [193, 0.763], [163, 0.635], [212, 0.754], [210, 0.646], [137, 0.714], [147, 0.709], [166, 0.734], [174, 0.703], [85, 0.745], [188, 0.767], [197, 0.758], [207, 0.729], [227, 0.744], [178, 0.56], [152, 0.661], [151, 0.662], [159, 0.635], [94, 0.745], [160, 0.644], [207, 0.688], [147, 0.736], [214, 0.729], [184, 0.69], [448, 0.708]];
export function katanaBrightness(seconds: number, gentle = false): number {
    if (gentle) return .7;
    let remaining = ((seconds % 8) + 8) % 8;
    for (let i = 0; i < pattern.length; i++) {
        const [duration, target] = pattern[i];
        if (remaining < duration / 1000) {
            const previous = pattern[(i + pattern.length - 1) % pattern.length][1];
            const blend = THREE.MathUtils.smoothstep(remaining, 0, Math.min(.045, duration / 2500));
            return THREE.MathUtils.lerp(previous, target, blend);
        }
        remaining -= duration / 1000;
    }
    return pattern[pattern.length - 1][1];
}
export function katanaEmission(seconds: number, gentle = false): number {
    // Convert desired display brightness to linear light; never saturate at HDR white.
    const brightness = katanaBrightness(seconds, gentle);
    return brightness <= .04045 ? brightness / 12.92 : ((brightness + .055) / 1.055) ** 2.4;
}
