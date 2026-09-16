/** Keyboard codes are stored independently of the user's keyboard layout. */
export const BIND_ACTIONS = [
    ['forward', 'Move forward', 'KeyW'], ['left', 'Move left', 'KeyA'],
    ['backward', 'Move backward', 'KeyS'], ['right', 'Move right', 'KeyD'],
    ['jump', 'Jump', 'Space'], ['hover', 'Hold to hover', 'ShiftLeft'],
    ['powerJump', 'Toggle power jump', 'ControlLeft'], ['interact', 'Interact / talk', 'KeyF'],
    ['grapple', 'Grappling hook', 'KeyR'], ['nextWeapon', 'Next weapon', 'KeyE'],
    ['pistol', 'Equip pistol', 'Digit1'], ['shotgun', 'Equip shotgun', 'Digit2'],
    ['rifle', 'Equip assault rifle', 'Digit3'], ['sniper', 'Equip sniper', 'Digit4'],
    ['minigun', 'Equip minigun', 'Digit5'], ['inspect', 'Inspect weapon', 'KeyX'],
    ['aim', 'Hold to aim', 'KeyC'], ['view', 'Toggle third person', 'KeyP'],
] as const;
export type BindAction = typeof BIND_ACTIONS[number][0];
export type Keybinds = Record<BindAction, string>;
export const DEFAULT_KEYBINDS = Object.fromEntries(BIND_ACTIONS.map(([action, , code]) => [action, code])) as Keybinds;
export function normalizeCode(code: string): string {
    return code === 'ShiftRight' ? 'ShiftLeft' : code === 'ControlRight' ? 'ControlLeft' : code;
}
export function isBindableCode(code: string): boolean {
    return /^(Key[A-Z]|Digit[0-9]|Numpad[0-9]|Arrow(Up|Down|Left|Right)|Space|ShiftLeft|ControlLeft|Enter|Backspace|Delete|Home|End|PageUp|PageDown|Insert|CapsLock|Minus|Equal|BracketLeft|BracketRight|Backslash|Semicolon|Quote|Comma|Period|Slash|Backquote|Numpad(Add|Subtract|Multiply|Divide|Decimal|Enter))$/.test(code);
}
export function keyLabel(code: string): string {
    const names: Record<string, string> = { ShiftLeft: 'Shift', ControlLeft: 'Ctrl', Space: 'Space', ArrowUp: '↑', ArrowDown: '↓', ArrowLeft: '←', ArrowRight: '→', BracketLeft: '[', BracketRight: ']', Minus: '−', Equal: '=', Semicolon: ';', Quote: "'", Comma: ',', Period: '.', Slash: '/', Backslash: '\\', Backquote: '`' };
    return names[code] ?? code.replace(/^Key|^Digit/, '').replace(/^Numpad/, 'Num ');
}
/** Swap conflicting assignments so every action remains reachable. */
export function assignKey(bindings: Keybinds, action: BindAction, code: string): Keybinds {
    const normalized = normalizeCode(code);
    if (!isBindableCode(normalized)) return { ...bindings };
    const next = { ...bindings };
    const conflict = BIND_ACTIONS.find(([other]) => other !== action && bindings[other] === normalized);
    if (conflict) next[conflict[0]] = bindings[action];
    next[action] = normalized;
    return next;
}
export function readKeybinds(value: unknown): Keybinds {
    const bindings = { ...DEFAULT_KEYBINDS };
    if (!value || typeof value !== 'object') return bindings;
    for (const [action] of BIND_ACTIONS) {
        const code = (value as Record<string, unknown>)[action];
        if (typeof code === 'string') Object.assign(bindings, assignKey(bindings, action, code));
    }
    return bindings;
}
/** Translate physical keyboard input to the existing gameplay action codes. */
export function gameplayCode(code: string, bindings: Keybinds): string {
    if (code === 'Escape') return code;
    return BIND_ACTIONS.find(([action]) => bindings[action] === normalizeCode(code))?.[2] ?? '';
}

export interface CrosshairSettings {
    style: 'ring' | 'cross' | 'dot';
    color: string;
    size: number;
    thickness: number;
    gap: number;
    opacity: number;
    shadow: boolean;
    shadowThickness: number;
    shadowColor: string;
    shadowOpacity: number;
    centerDotSize: number;
    centerDotColor: string;
    centerDotOpacity: number;
    centerDot: boolean;
    hitmarker: boolean;
    hitmarkerSize: number;
    hitmarkerGap: number;
    hitmarkerThickness: number;
    hitmarkerOpacity: number;
    hitmarkerDuration: number;
}
export const DEFAULT_CROSSHAIR: CrosshairSettings = {
    style: 'ring', color: '#ff0055', size: 16, thickness: 2, gap: 4,
    opacity: 1, shadow: false, shadowThickness: 1, shadowColor: '#101820', shadowOpacity: 1,
    centerDot: false, centerDotSize: 6, centerDotColor: '#ff0055', centerDotOpacity: 1,
    hitmarker: true, hitmarkerSize: 9, hitmarkerGap: 7, hitmarkerThickness: 2,
    hitmarkerOpacity: 1, hitmarkerDuration: 140,
};
export function readCrosshair(value: unknown): CrosshairSettings {
    const result = { ...DEFAULT_CROSSHAIR };
    if (!value || typeof value !== 'object') return result;
    const data = value as Record<string, unknown>;
    if (data.style === 'ring' || data.style === 'cross' || data.style === 'dot') result.style = data.style;
    for (const key of ['color', 'shadowColor', 'centerDotColor'] as const) {
        if (typeof data[key] === 'string' && /^#[0-9a-f]{6}$/i.test(data[key])) result[key] = data[key];
    }
    for (const [key, min, max] of [['size', 4, 48], ['thickness', 1, 6], ['gap', 0, 16], ['opacity', 0.1, 1], ['shadowThickness', 0, 8], ['shadowOpacity', 0, 1], ['centerDotSize', 1, 24], ['centerDotOpacity', 0, 1], ['hitmarkerSize', 3, 20], ['hitmarkerGap', 2, 20], ['hitmarkerThickness', 1, 6], ['hitmarkerOpacity', 0.1, 1], ['hitmarkerDuration', 50, 500]] as const) {
        const n = data[key];
        if (typeof n === 'number' && Number.isFinite(n)) result[key] = Math.max(min, Math.min(max, n));
    }
    for (const key of ['shadow', 'centerDot', 'hitmarker'] as const) if (typeof data[key] === 'boolean') result[key] = data[key];
    // Preserve the appearance of saved reticles from before independent layers.
    if (typeof data.shadow !== 'boolean' && typeof data.outline === 'boolean') result.shadow = data.outline;
    if (data.centerDotSize === undefined) result.centerDotSize = result.thickness * 3;
    if (data.centerDotColor === undefined) result.centerDotColor = result.color;
    if (data.centerDotOpacity === undefined) result.centerDotOpacity = result.opacity;
    if (data.shadowOpacity === undefined) result.shadowOpacity = result.opacity;
    return result;
}
/** Shared SVG keeps the preview and in-game reticle identical at CSS pixel size. */
export function crosshairSvg(settings: CrosshairSettings): string {
    const s = readCrosshair(settings);
    const radius = s.size / 2;
    const ring = `<circle cx="40" cy="40" r="${Math.max(1, radius - s.thickness / 2)}" fill="none"/>`;
    const cross = `<path fill="none" d="M ${40 - s.gap - radius} 40 H ${40 - s.gap} M ${40 + s.gap} 40 H ${40 + s.gap + radius} M 40 ${40 - s.gap - radius} V ${40 - s.gap} M 40 ${40 + s.gap} V ${40 + s.gap + radius}"/>`;
    const circle = (r: number, color: string) => `<circle cx="40" cy="40" r="${r}" fill="${color}"/>`;
    const lines = s.style === 'ring' ? ring : cross;
    const dotRadius = radius + s.thickness / 2;
    const main = s.style === 'dot'
        ? circle(dotRadius, s.color)
        : `<g stroke="${s.color}" stroke-width="${s.thickness}">${lines}</g>`;
    const hasCenterDot = s.centerDot && s.style !== 'dot';
    const shadow = s.style === 'dot'
        ? circle(dotRadius + s.shadowThickness, s.shadowColor)
        : `<g stroke="${s.shadowColor}" stroke-width="${s.thickness + 2 * s.shadowThickness}">${lines}</g>`;
    const shadowLayer = s.shadow
        ? `<g data-layer="shadow" opacity="${s.shadowOpacity}">${shadow}${hasCenterDot ? circle(s.centerDotSize / 2 + s.shadowThickness, s.shadowColor) : ''}</g>`
        : '';
    const centerLayer = hasCenterDot
        ? `<g data-layer="center-dot" opacity="${s.centerDotOpacity}">${circle(s.centerDotSize / 2, s.centerDotColor)}</g>`
        : '';
    return `<svg xmlns="http://www.w3.org/2000/svg" width="112" height="112" viewBox="-16 -16 112 112" aria-hidden="true">${shadowLayer}<g data-layer="reticle" opacity="${s.opacity}">${main}</g>${centerLayer}</svg>`;
}

/** Four diagonal strokes around the aim point, shared by preview and HUD. */
export function hitmarkerSvg(settings: CrosshairSettings): string {
    const s = readCrosshair(settings);
    const center = 56;
    const diagonal = Math.SQRT1_2;
    const inner = s.hitmarkerGap * diagonal;
    const outer = (s.hitmarkerGap + s.hitmarkerSize) * diagonal;
    const lines = [[-1, -1], [1, -1], [-1, 1], [1, 1]].map(([x, y]) =>
        `<line x1="${center + x * inner}" y1="${center + y * inner}" x2="${center + x * outer}" y2="${center + y * outer}"/>`
    ).join('');
    return `<svg xmlns="http://www.w3.org/2000/svg" width="112" height="112" viewBox="0 0 112 112" aria-hidden="true"><g data-layer="hitmarker" fill="none" stroke="currentColor" stroke-width="${s.hitmarkerThickness}" stroke-linecap="square" opacity="${s.hitmarkerOpacity}">${lines}</g></svg>`;
}
