export const MIN_TOUCH_SCALE = 0.5;
export const MAX_TOUCH_SCALE = 2.5;

export const TOUCH_CONTROLS = [
    { id: 'stick', label: 'Movement', width: 106, height: 106 },
    { id: 'weapon', label: 'Weapon', width: 54, height: 54, key: 'KeyE' },
    { id: 'inspect', label: 'Inspect', width: 54, height: 54, key: 'KeyX' },
    { id: 'view', label: 'View', width: 54, height: 54, key: 'KeyP' },
    { id: 'pause', label: 'Ⅱ', width: 54, height: 54 },
    { id: 'grapple', label: 'Grapple', width: 58, height: 54, key: 'KeyR' },
    { id: 'hover', label: 'Hover', width: 58, height: 54, key: 'ShiftLeft' },
    { id: 'aim', label: 'Aim', width: 58, height: 54, key: 'KeyC' },
    { id: 'jump', label: 'Jump', width: 58, height: 54, key: 'Space' },
    { id: 'fire', label: 'Fire', width: 82, height: 70 },
    { id: 'powerJump', label: 'Power jump', width: 62, height: 44, key: 'ControlLeft' },
] as const;

export type TouchControlId = typeof TOUCH_CONTROLS[number]['id'];
export type TouchFireMode = 'joystick' | 'button';
export interface TouchControlPlacement { x: number; y: number; scale: number }
export type TouchLayout = Partial<Record<TouchControlId, TouchControlPlacement>>;
export interface TouchBounds { width: number; height: number; left: number; right: number; top: number; bottom: number }
export interface TouchControlRect { left: number; top: number; width: number; height: number }

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

export function cloneTouchLayout(layout: TouchLayout): TouchLayout {
    return Object.fromEntries(Object.entries(layout).map(([id, value]) => [id, { ...value }]));
}

/** Old settings keep the default anchors. Validate each override independently. */
export function readTouchLayout(value: unknown): TouchLayout {
    const layout: TouchLayout = {};
    if (!value || typeof value !== 'object') return layout;
    for (const { id } of TOUCH_CONTROLS) {
        const entry = (value as Record<string, unknown>)[id];
        if (!entry || typeof entry !== 'object') continue;
        const { x, y, scale } = entry as Record<string, unknown>;
        if (typeof x !== 'number' || typeof y !== 'number' || typeof scale !== 'number' ||
            !Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(scale)) continue;
        layout[id] = { x: clamp(x, 0, 1), y: clamp(y, 0, 1), scale: clamp(scale, MIN_TOUCH_SCALE, MAX_TOUCH_SCALE) };
    }
    return layout;
}

export function getTouchControlRect(id: TouchControlId, layout: TouchLayout, bounds: TouchBounds, fireMode: TouchFireMode = 'joystick'): TouchControlRect {
    const control = TOUCH_CONTROLS.find(control => control.id === id)!;
    const placement = layout[id];
    const scale = placement?.scale ?? 1;
    const safeWidth = Math.max(1, bounds.width - bounds.left - bounds.right);
    const safeHeight = Math.max(1, bounds.height - bounds.top - bounds.bottom);
    const base = id === 'stick' ? clamp(bounds.height * 0.22, 106, 150) : control.width;
    const desiredWidth = base * scale;
    const desiredHeight = (id === 'stick' || (id === 'fire' && fireMode === 'joystick') ? base : control.height) * scale;
    const fit = Math.min(1, safeWidth / desiredWidth, safeHeight / desiredHeight);
    const width = desiredWidth * fit;
    const height = desiredHeight * fit;
    let x: number, y: number;
    if (placement) {
        // Centers are normalized within the safe viewport, so layouts survive
        // browser chrome, fullscreen changes, and different landscape sizes.
        x = bounds.left + placement.x * safeWidth;
        y = bounds.top + placement.y * safeHeight;
    } else if (id === 'stick') {
        x = Math.max(24, bounds.left) + width / 2;
        y = bounds.height - Math.max(22, bounds.bottom) - height / 2;
    } else if (id === 'powerJump') {
        x = bounds.width / 2 - 80 - width / 2;
        y = bounds.height - Math.max(10, bounds.bottom) - height / 2;
    } else {
        const utilityIndex = ['weapon', 'inspect', 'view', 'pause'].indexOf(id);
        if (utilityIndex >= 0) {
            x = bounds.width - Math.max(16, bounds.right) - 246 + utilityIndex * 64 + width / 2;
            y = Math.max(12, bounds.top) + height / 2;
        } else {
            const column = ['grapple', 'hover', 'aim'].indexOf(id);
            const right = bounds.width - Math.max(20, bounds.right);
            // Reserve the joystick's row height for both variants, so changing
            // Fire's shape does not rearrange other controls at default anchors.
            const fireRowHeight = 82;
            x = id === 'fire' ? right - width / 2 : right - 198 + Math.max(0, column) * 70 + width / 2;
            y = bounds.height - Math.max(20, bounds.bottom) - (column >= 0 ? 54 + 12 + fireRowHeight - height / 2 : id === 'fire' ? height / 2 : fireRowHeight / 2);
        }
    }
    return {
        left: clamp(x - width / 2, bounds.left, bounds.width - bounds.right - width),
        top: clamp(y - height / 2, bounds.top, bounds.height - bounds.bottom - height),
        width, height,
    };
}

export function placeTouchControl(id: TouchControlId, layout: TouchLayout, bounds: TouchBounds, x: number, y: number, scale = layout[id]?.scale ?? 1, fireMode: TouchFireMode = 'joystick'): void {
    layout[id] = {
        x: clamp((x - bounds.left) / Math.max(1, bounds.width - bounds.left - bounds.right), 0, 1),
        y: clamp((y - bounds.top) / Math.max(1, bounds.height - bounds.top - bounds.bottom), 0, 1),
        scale: clamp(scale, MIN_TOUCH_SCALE, MAX_TOUCH_SCALE),
    };
    const rect = getTouchControlRect(id, layout, bounds, fireMode);
    layout[id]!.x = (rect.left + rect.width / 2 - bounds.left) / Math.max(1, bounds.width - bounds.left - bounds.right);
    layout[id]!.y = (rect.top + rect.height / 2 - bounds.top) / Math.max(1, bounds.height - bounds.top - bounds.bottom);
}
