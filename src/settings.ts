import * as THREE from 'three';
import { DEFAULT_FOV, MAX_PARTICLES, MAX_RENDER_DISTANCE_CHUNKS, SCOPED_FOV } from './config.js';

import { DEFAULT_KEYBINDS, DEFAULT_CROSSHAIR, readKeybinds, readCrosshair, type Keybinds, type CrosshairSettings } from './controlSettings.js';

const STORAGE_KEY = 'testfps-settings-v1';
export type ShadowQuality = 'low' | 'high';

export interface UserSettings {
    keybinds: Keybinds;
    crosshair: CrosshairSettings;
    sensitivity: number;
    fov: number;
    scopedFov: number;
    renderScale: number;
    particleAmount: number;
    renderDistanceChunks: number;
    shadows: boolean;
    lavaGlow: boolean;
    muzzleFlashes: boolean;
    muzzleFlashOpacity: number;
    bulletTrails: boolean;
    shadowQuality: ShadowQuality;
    showFps: boolean;
    photosensitivityMode: boolean;
    downloadWebLLMImmediately: boolean;
}

export const DEFAULT_USER_SETTINGS: UserSettings = {
    keybinds: { ...DEFAULT_KEYBINDS },
    crosshair: { ...DEFAULT_CROSSHAIR },
    sensitivity: 1.0,
    fov: DEFAULT_FOV,
    scopedFov: SCOPED_FOV,
    renderScale: 1.0,
    particleAmount: 1.0,
    renderDistanceChunks: 4,
    shadows: true,
    lavaGlow: true,
    muzzleFlashes: true,
    muzzleFlashOpacity: 1.0,
    bulletTrails: true,
    shadowQuality: 'low',
    showFps: true,
    photosensitivityMode: false,
    downloadWebLLMImmediately: false,
};

export function cloneSettings(settings: UserSettings): UserSettings {
    return { ...settings, keybinds: { ...settings.keybinds }, crosshair: { ...settings.crosshair } };
}

export const userSettings: UserSettings = cloneSettings(DEFAULT_USER_SETTINGS);

function clamp(value: number, min: number, max: number): number {
    if (!Number.isFinite(value)) return min;
    return Math.max(min, Math.min(max, value));
}

function readBoolean(value: unknown, fallback: boolean): boolean {
    return typeof value === 'boolean' ? value : fallback;
}

function readShadowQuality(value: unknown): ShadowQuality {
    return value === 'high' ? 'high' : 'low';
}

export function loadUserSettings(): UserSettings {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (raw) {
            const parsed = JSON.parse(raw) as Partial<UserSettings>;
            userSettings.keybinds = readKeybinds(parsed.keybinds);
            userSettings.crosshair = readCrosshair(parsed.crosshair);
            userSettings.sensitivity = clamp(parsed.sensitivity ?? DEFAULT_USER_SETTINGS.sensitivity, 0.1, 3.0);
            userSettings.fov = clamp(parsed.fov ?? DEFAULT_USER_SETTINGS.fov, 55, 105);
            userSettings.scopedFov = clamp(parsed.scopedFov ?? DEFAULT_USER_SETTINGS.scopedFov, 8, 35);
            userSettings.renderScale = clamp(parsed.renderScale ?? DEFAULT_USER_SETTINGS.renderScale, 0.5, 1.0);
            userSettings.particleAmount = clamp(parsed.particleAmount ?? DEFAULT_USER_SETTINGS.particleAmount, 0.2, 1.0);
            userSettings.renderDistanceChunks = Math.round(clamp(parsed.renderDistanceChunks ?? DEFAULT_USER_SETTINGS.renderDistanceChunks, 1, MAX_RENDER_DISTANCE_CHUNKS));
            userSettings.shadows = readBoolean(parsed.shadows, DEFAULT_USER_SETTINGS.shadows);
            userSettings.lavaGlow = readBoolean(parsed.lavaGlow, DEFAULT_USER_SETTINGS.lavaGlow);
            userSettings.muzzleFlashes = readBoolean(parsed.muzzleFlashes, DEFAULT_USER_SETTINGS.muzzleFlashes);
            userSettings.muzzleFlashOpacity = clamp(parsed.muzzleFlashOpacity ?? DEFAULT_USER_SETTINGS.muzzleFlashOpacity, 0, 1);
            userSettings.bulletTrails = readBoolean(parsed.bulletTrails, DEFAULT_USER_SETTINGS.bulletTrails);
            userSettings.shadowQuality = readShadowQuality(parsed.shadowQuality);
            userSettings.downloadWebLLMImmediately = readBoolean(parsed.downloadWebLLMImmediately, false);
            userSettings.showFps = readBoolean(parsed.showFps, DEFAULT_USER_SETTINGS.showFps);
            userSettings.photosensitivityMode = readBoolean(parsed.photosensitivityMode, DEFAULT_USER_SETTINGS.photosensitivityMode);
        }
    } catch (err) {
        console.warn('Failed to load settings:', err);
    }
    return userSettings;
}

export function saveUserSettings(): void {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(userSettings));
    } catch (err) {
        console.warn('Failed to save settings:', err);
    }
}

export function applyRendererSettings(renderer: THREE.WebGLRenderer): void {
    const pixelRatio = Math.min(window.devicePixelRatio * userSettings.renderScale, 2.0);
    renderer.setPixelRatio(pixelRatio);
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.shadowMap.enabled = userSettings.shadows;
    // Avoid shadow-map update bookkeeping entirely while the user has shadows
    // disabled; re-enabling requests a fresh map on the next render.
    renderer.shadowMap.autoUpdate = userSettings.shadows;
    renderer.shadowMap.needsUpdate = userSettings.shadows;
    if (userSettings.shadows) {
        renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    }
}

export function getParticleLimit(): number {
    return Math.max(50, Math.floor(MAX_PARTICLES * userSettings.particleAmount));
}

export function scaleParticleCount(count: number): number {
    return Math.max(1, Math.ceil(count * userSettings.particleAmount));
}
