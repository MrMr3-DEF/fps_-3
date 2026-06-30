import * as THREE from 'three';
import { DEFAULT_FOV, MAX_PARTICLES, MAX_RENDER_DISTANCE_CHUNKS, SCOPED_FOV } from './config.js';

const STORAGE_KEY = 'testfps-settings-v1';

export interface UserSettings {
    sensitivity: number;
    fov: number;
    scopedFov: number;
    renderScale: number;
    particleAmount: number;
    renderDistanceChunks: number;
    shadows: boolean;
    showFps: boolean;
}

export const DEFAULT_USER_SETTINGS: UserSettings = {
    sensitivity: 1.0,
    fov: DEFAULT_FOV,
    scopedFov: SCOPED_FOV,
    renderScale: 1.0,
    particleAmount: 1.0,
    renderDistanceChunks: 4,
    shadows: true,
    showFps: true,
};

export const userSettings: UserSettings = { ...DEFAULT_USER_SETTINGS };

function clamp(value: number, min: number, max: number): number {
    if (!Number.isFinite(value)) return min;
    return Math.max(min, Math.min(max, value));
}

function readBoolean(value: unknown, fallback: boolean): boolean {
    return typeof value === 'boolean' ? value : fallback;
}

export function loadUserSettings(): UserSettings {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (raw) {
            const parsed = JSON.parse(raw) as Partial<UserSettings>;
            userSettings.sensitivity = clamp(parsed.sensitivity ?? DEFAULT_USER_SETTINGS.sensitivity, 0.1, 3.0);
            userSettings.fov = clamp(parsed.fov ?? DEFAULT_USER_SETTINGS.fov, 55, 105);
            userSettings.scopedFov = clamp(parsed.scopedFov ?? DEFAULT_USER_SETTINGS.scopedFov, 8, 35);
            userSettings.renderScale = clamp(parsed.renderScale ?? DEFAULT_USER_SETTINGS.renderScale, 0.5, 1.0);
            userSettings.particleAmount = clamp(parsed.particleAmount ?? DEFAULT_USER_SETTINGS.particleAmount, 0.2, 1.0);
            userSettings.renderDistanceChunks = Math.round(clamp(parsed.renderDistanceChunks ?? DEFAULT_USER_SETTINGS.renderDistanceChunks, 1, MAX_RENDER_DISTANCE_CHUNKS));
            userSettings.shadows = readBoolean(parsed.shadows, DEFAULT_USER_SETTINGS.shadows);
            userSettings.showFps = readBoolean(parsed.showFps, DEFAULT_USER_SETTINGS.showFps);
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

export function resetUserSettings(): UserSettings {
    Object.assign(userSettings, DEFAULT_USER_SETTINGS);
    saveUserSettings();
    return userSettings;
}

export function applyRendererSettings(renderer: THREE.WebGLRenderer): void {
    const pixelRatio = Math.min(window.devicePixelRatio * userSettings.renderScale, 2.0);
    renderer.setPixelRatio(pixelRatio);
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.shadowMap.enabled = userSettings.shadows;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
}

export function getParticleLimit(): number {
    return Math.max(50, Math.floor(MAX_PARTICLES * userSettings.particleAmount));
}

export function scaleParticleCount(count: number): number {
    return Math.max(1, Math.ceil(count * userSettings.particleAmount));
}
