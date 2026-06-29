import { state } from './state.js';

const uiCache: Record<string, HTMLElement | null> = {};

function getUI<T extends HTMLElement>(id: string): T | null {
    return (uiCache[id] || (uiCache[id] = document.getElementById(id))) as T | null;
}

let lastReloadProgress = -1;
let lastHoverFuel = -1;
let lastFpsText = '';
let speedlineImagesReady = false;
let speedlinesActive = false;
let speedlinePhase = 0;
let lastSpeedlineOpacity = -1;
let lastSpeedlineSwapTime = 0;
let lastGText = '';
let lastGDotTransform = '';

export function updateHealthBar(hpRatio: number, flashColor: string | null = null): void {
    const healthBar = getUI<HTMLElement>('health-bar');
    if (!healthBar) return;
    healthBar.style.width = `${hpRatio}%`;
    if (flashColor) {
        healthBar.style.backgroundColor = flashColor;
        setTimeout(() => {
            const currentBar = getUI<HTMLElement>('health-bar');
            if (state.playerHp > 0 && currentBar && currentBar.style.backgroundColor === flashColor) {
                currentBar.style.backgroundColor = '#2ed573';
            }
        }, 100);
    } else {
        healthBar.style.backgroundColor = '#2ed573';
    }
}

export function updateHoverBar(fuelRatio: number): void {
    const hoverBar = getUI<HTMLElement>('hover-bar');
    if (!hoverBar) return;
    if (fuelRatio !== lastHoverFuel) {
        hoverBar.style.height = `${fuelRatio * 100}%`;
        lastHoverFuel = fuelRatio;
    }
}

export function updateReloadBar(progress: number): void {
    const reloadBar = getUI<HTMLElement>('reload-bar');
    if (!reloadBar) return;
    if (progress !== lastReloadProgress) {
        reloadBar.style.width = `${progress * 100}%`;
        lastReloadProgress = progress;
    }
}

export function setFpsVisible(visible: boolean): void {
    const fpsCounter = getUI<HTMLElement>('fps-counter');
    if (fpsCounter) fpsCounter.style.display = visible ? 'block' : 'none';
}

export function setFpsText(text: string): void {
    const fpsCounter = getUI<HTMLElement>('fps-counter');
    if (!fpsCounter || text === lastFpsText) return;
    fpsCounter.textContent = text;
    lastFpsText = text;
}

function createSpeedlineImage(seed: number): string {
    const canvas = document.createElement('canvas');
    canvas.width = 768;
    canvas.height = 768;

    const ctx = canvas.getContext('2d');
    if (!ctx) return '';

    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;
    const innerRadius = 250;
    const outerRadius = 560;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.globalCompositeOperation = 'source-over';
    ctx.lineCap = 'round';

    const lineCount = seed === 0 ? 54 : 47;
    for (let i = 0; i < lineCount; i++) {
        const angle = ((i / lineCount) * Math.PI * 2) + seed * 0.11 + ((i % 5) - 2) * 0.012;
        const start = innerRadius + ((i * 37 + seed * 53) % 80);
        const length = 125 + ((i * 29 + seed * 41) % 165);
        const end = Math.min(outerRadius, start + length);
        const alpha = 0.24 + ((i * 17 + seed * 19) % 38) / 100;

        ctx.strokeStyle = `rgba(${seed === 0 ? '0, 170, 238' : '0, 210, 255'}, ${alpha})`;
        ctx.lineWidth = 2 + ((i + seed) % 3);
        ctx.beginPath();
        ctx.moveTo(centerX + Math.cos(angle) * start, centerY + Math.sin(angle) * start);
        ctx.lineTo(centerX + Math.cos(angle) * end, centerY + Math.sin(angle) * end);
        ctx.stroke();
    }

    return canvas.toDataURL('image/png');
}

function ensureSpeedlineImages(): void {
    if (speedlineImagesReady) return;

    const layerA = getUI<HTMLElement>('speedlines-a');
    const layerB = getUI<HTMLElement>('speedlines-b');
    if (!layerA || !layerB) return;

    layerA.style.backgroundImage = `url(${createSpeedlineImage(0)})`;
    layerB.style.backgroundImage = `url(${createSpeedlineImage(1)})`;
    speedlineImagesReady = true;
}

function setSpeedlineLayers(active: boolean): void {
    const layerA = getUI<HTMLElement>('speedlines-a');
    const layerB = getUI<HTMLElement>('speedlines-b');
    if (!layerA || !layerB) return;

    if (!active) {
        layerA.style.opacity = '0';
        layerB.style.opacity = '0';
        return;
    }

    layerA.style.opacity = speedlinePhase === 0 ? '1' : '0.15';
    layerB.style.opacity = speedlinePhase === 0 ? '0.15' : '1';
}

export function updateSpeedlines(speed: number, visible: boolean): void {
    const speedlines = getUI<HTMLElement>('speedlines');
    if (!speedlines) return;

    if (visible) {
        ensureSpeedlineImages();
    }

    const speedProgress = visible ? Math.max(0, Math.min(1, (speed - 225) / 175)) : 0;
    const opacity = speed >= 225 && visible ? Number((0.32 + speedProgress * 0.36).toFixed(3)) : 0;

    if (opacity !== lastSpeedlineOpacity) {
        speedlines.style.opacity = opacity.toString();
        lastSpeedlineOpacity = opacity;
    }

    const active = opacity > 0;
    if (active && !speedlinesActive) {
        ensureSpeedlineImages();
        lastSpeedlineSwapTime = performance.now();
        speedlinePhase = 0;
        setSpeedlineLayers(true);
    } else if (!active && speedlinesActive) {
        setSpeedlineLayers(false);
    }
    speedlinesActive = active;

    if (!active) return;

    const now = performance.now();
    if (now - lastSpeedlineSwapTime >= 170) {
        speedlinePhase = speedlinePhase === 0 ? 1 : 0;
        lastSpeedlineSwapTime = now;
        setSpeedlineLayers(true);
    }
}

export function setAccelerometerVisible(visible: boolean): void {
    const accelerometer = getUI<HTMLElement>('accelerometer');
    if (accelerometer) accelerometer.style.display = visible ? 'block' : 'none';
}

export function updateAccelerometer(gRight: number, gUp: number): void {
    const accelerometerValue = getUI<HTMLElement>('accelerometer-value');
    const accelerometerDot = getUI<HTMLElement>('accelerometer-dot');

    const gMagnitude = Math.hypot(gRight, gUp);
    const gText = gMagnitude.toFixed(1);
    if (accelerometerValue && gText !== lastGText) {
        accelerometerValue.textContent = gText;
        lastGText = gText;
    }

    if (accelerometerDot) {
        const maxDisplayG = 3;
        const clampedMagnitude = Math.min(maxDisplayG, gMagnitude);
        const scale = gMagnitude > 0 ? clampedMagnitude / gMagnitude : 0;
        const pxPerG = 17;
        const x = Math.round(gRight * scale * pxPerG);
        const y = Math.round(-gUp * scale * pxPerG);
        const transform = `translate(calc(-50% + ${x}px), calc(-50% + ${y}px))`;
        if (transform !== lastGDotTransform) {
            accelerometerDot.style.transform = transform;
            lastGDotTransform = transform;
        }
    }
}
