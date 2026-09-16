import { BIND_ACTIONS, DEFAULT_KEYBINDS, DEFAULT_CROSSHAIR, assignKey, normalizeCode, isBindableCode, keyLabel, crosshairSvg, hitmarkerSvg, type BindAction, type CrosshairSettings } from './controlSettings.js';
import type { UserSettings } from './settings.js';

export function setupSettingsMenu(getDraft: () => UserSettings, update: (mutate: (settings: UserSettings) => void) => void): (settings: UserSettings) => void {
    const root = document.getElementById('panel-settings')!;
    const container = root.querySelector<HTMLElement>('.settings-container')!;
    const tabs = document.createElement('div');
    tabs.className = 'settings-tabs';
    tabs.setAttribute('role', 'tablist');
    tabs.setAttribute('aria-label', 'Settings categories');
    container.before(tabs);
    const categories = [
        ['gameplay', 'Gameplay', ['sensitivity', 'setting-fov', 'setting-scoped-fov', 'setting-webllm-download']],
        ['graphics', 'Graphics', ['setting-render-scale', 'setting-render-distance', 'setting-particles', 'setting-shadows', 'setting-shadow-quality', 'setting-lava-glow', 'setting-muzzle-flashes', 'setting-muzzle-flash-opacity', 'setting-fps']],
        ['accessibility', 'Accessibility', ['setting-photosensitivity']],
        ['keybinds', 'Keybinds', []],
        ['crosshair', 'Crosshair', []],
        ['reset', 'Reset', []],
    ] as const;
    const panels = new Map<string, HTMLElement>();
    let listening: BindAction | null = null;
    let captureButton: HTMLButtonElement | null = null;
    function cancelCapture(): void {
        listening = null;
        if (captureButton) {
            captureButton.classList.remove('is-listening');
            const action = captureButton.dataset.action as BindAction;
            captureButton.textContent = keyLabel(getDraft().keybinds[action]);
        }
        captureButton = null;
    }
    categories.forEach(([id, label, fields], index) => {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'menu-btn secondary';
        button.id = `settings-tab-${id}`;
        button.textContent = label;
        button.setAttribute('role', 'tab');
        button.setAttribute('aria-controls', `settings-page-${id}`);
        button.setAttribute('aria-selected', String(index === 0));
        button.tabIndex = index === 0 ? 0 : -1;
        tabs.append(button);
        const panel = document.createElement('section');
        panel.id = `settings-page-${id}`;
        panel.className = 'settings-page';
        panel.setAttribute('role', 'tabpanel');
        panel.setAttribute('aria-labelledby', button.id);
        panel.tabIndex = 0;
        panel.hidden = index !== 0;
        for (const field of fields) {
            const row = document.getElementById(field)?.closest('.settings-row');
            if (row) panel.append(row);
        }
        container.append(panel);
        panels.set(id, panel);
        button.addEventListener('click', () => {
            cancelCapture();
            tabs.querySelectorAll<HTMLButtonElement>('button').forEach(tab => {
                const active = tab === button;
                tab.setAttribute('aria-selected', String(active));
                tab.tabIndex = active ? 0 : -1;
            });
            panels.forEach((page, pageId) => { page.hidden = pageId !== id; });
        });
        button.addEventListener('keydown', e => {
            const buttons = [...tabs.querySelectorAll<HTMLButtonElement>('button')];
            let target = index;
            if (e.key === 'ArrowRight') target = (index + 1) % buttons.length;
            else if (e.key === 'ArrowLeft') target = (index + buttons.length - 1) % buttons.length;
            else if (e.key === 'Home') target = 0;
            else if (e.key === 'End') target = buttons.length - 1;
            else return;
            e.preventDefault();
            buttons[target].click();
            buttons[target].focus();
        });
    });
    const resetPanel = panels.get('reset')!;
    const resetScope = document.createElement('p');
    resetScope.className = 'menu-caption';
    resetScope.textContent = 'Restores all settings, including keybinds and crosshair. Select Apply to save.';
    resetPanel.append(resetScope, document.getElementById('btn-settings-reset')!);

    const keyPanel = panels.get('keybinds')!;
    const message = document.createElement('p');
    message.className = 'binding-status';
    message.setAttribute('role', 'status');
    message.textContent = 'Select a key to rebind. Esc cancels; used keys swap.';
    keyPanel.append(message);
    const bindings = document.createElement('div');
    bindings.className = 'keybind-list';
    keyPanel.append(bindings);
    for (const [action, label] of BIND_ACTIONS) {
        const row = document.createElement('div');
        row.className = 'keybind-row';
        const title = document.createElement('span');
        title.textContent = label;
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'menu-btn secondary';
        button.dataset.action = action;
        button.setAttribute('aria-label', `Change ${label.toLowerCase()} binding`);
        button.addEventListener('click', () => {
            cancelCapture();
            listening = action;
            captureButton = button;
            button.textContent = 'Press a key…';
            button.classList.add('is-listening');
            message.textContent = `${label}: press a key. Esc to cancel.`;
        });
        row.append(title, button);
        bindings.append(row);
    }
    window.addEventListener('keydown', event => {
        if (!listening) return;
        event.preventDefault();
        event.stopImmediatePropagation();
        if (event.code === 'Escape') {
            cancelCapture();
            message.textContent = 'Binding cancelled.';
            return;
        }
        if (event.repeat) return;
        const code = normalizeCode(event.code);
        if (!isBindableCode(code) || event.metaKey || event.altKey) {
            message.textContent = 'Reserved key. Choose another.';
            return;
        }
        const action = listening;
        const conflict = BIND_ACTIONS.find(([other]) => other !== action && getDraft().keybinds[other] === code);
        cancelCapture();
        update(settings => { settings.keybinds = assignKey(settings.keybinds, action, code); });
        message.textContent = conflict ? `${keyLabel(code)} assigned; swapped with ${conflict[1].toLowerCase()}.` : `${keyLabel(code)} assigned.`;
    }, true);
    window.addEventListener('blur', cancelCapture);
    root.addEventListener('pointerdown', event => { if (event.target !== captureButton) cancelCapture(); });
    const resetKeys = document.createElement('button');
    resetKeys.className = 'menu-btn secondary';
    resetKeys.textContent = 'Reset keybinds';
    resetKeys.addEventListener('click', () => update(settings => { settings.keybinds = { ...DEFAULT_KEYBINDS }; }));
    keyPanel.append(resetKeys);

    const crossPanel = panels.get('crosshair')!;
    const preview = document.createElement('div');
    preview.className = 'crosshair-preview';
    preview.setAttribute('role', 'img');
    preview.setAttribute('aria-label', 'Crosshair preview');
    preview.innerHTML = '<div id="crosshair-preview-reticle"></div><div id="crosshair-preview-hitmarker"></div>';
    const editor = document.createElement('div');
    editor.className = 'crosshair-editor';
    const crossFields = document.createElement('div');
    editor.append(preview, crossFields);
    crossPanel.append(editor);
    const crossControls: { key: keyof CrosshairSettings; input: HTMLInputElement | HTMLSelectElement; output: HTMLElement }[] = [];
    const fields = [
        ['style', 'Style', 'select', 0, 0, 0], ['color', 'Color', 'color', 0, 0, 0],
        ['size', 'Size', 'range', 4, 48, 1], ['thickness', 'Thickness', 'range', 1, 6, 1],
        ['gap', 'Cross gap', 'range', 0, 16, 1], ['opacity', 'Opacity', 'range', 0.1, 1, 0.05],
        ['shadow', 'Shadow', 'checkbox', 0, 0, 0],
        ['shadowThickness', 'Thickness', 'range', 0, 8, 0.5],
        ['shadowColor', 'Color', 'color', 0, 0, 0],
        ['shadowOpacity', 'Opacity', 'range', 0, 1, 0.05],
        ['centerDot', 'Center dot', 'checkbox', 0, 0, 0],
        ['centerDotSize', 'Size', 'range', 1, 24, 1],
        ['centerDotColor', 'Color', 'color', 0, 0, 0],
        ['centerDotOpacity', 'Opacity', 'range', 0, 1, 0.05],
        ['hitmarker', 'Hitmarker', 'checkbox', 0, 0, 0],
        ['hitmarkerSize', 'Line length', 'range', 3, 20, 1],
        ['hitmarkerGap', 'Center gap', 'range', 2, 20, 1],
        ['hitmarkerThickness', 'Thickness', 'range', 1, 6, 0.5],
        ['hitmarkerOpacity', 'Opacity', 'range', 0.1, 1, 0.05],
        ['hitmarkerDuration', 'Flash duration', 'range', 50, 500, 10],
    ] as const;
    let fieldContainer = crossFields;
    for (const [key, label, type, min, max, step] of fields) {
        if (key === 'shadow' || key === 'centerDot' || key === 'hitmarker') {
            const dropdown = document.createElement('details');
            dropdown.className = 'crosshair-dropdown';
            const summary = document.createElement('summary');
            summary.className = 'menu-btn secondary';
            summary.textContent = label;
            fieldContainer = document.createElement('div');
            fieldContainer.className = 'crosshair-layer-controls';
            dropdown.append(summary, fieldContainer);
            crossFields.append(dropdown);
        }
        const row = document.createElement('div');
        row.className = 'settings-row';
        const title = document.createElement('label');
        title.htmlFor = `crosshair-${key}`;
        title.textContent = type === 'checkbox' ? 'Enabled' : label;
        const input = type === 'select' ? document.createElement('select') : document.createElement('input');
        input.id = title.htmlFor;
        const layer = key.startsWith('shadow') ? 'Shadow' : key.startsWith('centerDot') ? 'Center dot' : key.startsWith('hitmarker') ? 'Hitmarker' : '';
        if (layer) input.setAttribute('aria-label', type === 'checkbox' ? `Enable ${layer.toLowerCase()}` : `${layer} ${label.toLowerCase()}`);
        if (input instanceof HTMLSelectElement) input.innerHTML = '<option value="ring">Ring</option><option value="cross">Cross</option><option value="dot">Dot</option>';
        else {
            input.type = type;
            if (type === 'range') { input.min = String(min); input.max = String(max); input.step = String(step); }
        }
        const output = document.createElement('span');
        output.className = 'settings-value';
        input.addEventListener('input', () => update(settings => {
            const value = type === 'checkbox' ? (input as HTMLInputElement).checked : type === 'range' ? Number(input.value) : input.value;
            settings.crosshair = { ...settings.crosshair, [key]: value };
        }));
        row.append(title, input, output);
        fieldContainer.append(row);
        crossControls.push({ key, input, output });
    }
    const resetCross = document.createElement('button');
    resetCross.className = 'menu-btn secondary';
    resetCross.textContent = 'Reset crosshair';
    resetCross.addEventListener('click', () => update(settings => { settings.crosshair = { ...DEFAULT_CROSSHAIR }; }));
    crossPanel.append(resetCross);
    return settings => {
        cancelCapture();
        bindings.querySelectorAll<HTMLButtonElement>('button').forEach(button => {
            const action = button.dataset.action as BindAction;
            button.textContent = keyLabel(settings.keybinds[action]);
            const label = BIND_ACTIONS.find(([id]) => id === action)![1];
            button.setAttribute('aria-label', `Change ${label.toLowerCase()} binding, current key ${button.textContent}`);
        });
        for (const { key, input, output } of crossControls) {
            const value = settings.crosshair[key];
            if (typeof value === 'boolean') (input as HTMLInputElement).checked = value;
            else input.value = String(value);
            input.disabled = (key === 'gap' && settings.crosshair.style !== 'cross') ||
                (key.startsWith('centerDot') && (settings.crosshair.style === 'dot' || (key !== 'centerDot' && !settings.crosshair.centerDot))) ||
                (key.startsWith('shadow') && key !== 'shadow' && !settings.crosshair.shadow) ||
                (key.startsWith('hitmarker') && key !== 'hitmarker' && !settings.crosshair.hitmarker);
            output.textContent = typeof value === 'boolean' ? value ? 'On' : 'Off' : key.toLowerCase().endsWith('opacity') ? `${Math.round(Number(value) * 100)}%` : key.toLowerCase().endsWith('duration') ? `${value}ms` : typeof value === 'number' ? `${value}px` : '';
        }
        preview.querySelector('#crosshair-preview-reticle')!.innerHTML = crosshairSvg(settings.crosshair);
        const previewHitmarker = preview.querySelector<HTMLElement>('#crosshair-preview-hitmarker')!;
        previewHitmarker.innerHTML = hitmarkerSvg(settings.crosshair);
        previewHitmarker.hidden = !settings.crosshair.hitmarker;
    };
}
