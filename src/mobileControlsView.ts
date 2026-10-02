import { TOUCH_CONTROLS, getTouchControlRect, type TouchBounds, type TouchLayout, type TouchFireMode } from './mobileControlLayout.js';

/** Gameplay and the editor share markup, dimensions and safe-area geometry. */
export function createTouchControls(fireMode: TouchFireMode = 'joystick'): HTMLElement {
    const layer = document.createElement('div');
    layer.className = 'touch-controls';
    layer.setAttribute('aria-label', 'Touch game controls');
    const look = document.createElement('div');
    look.className = 'touch-look';
    look.setAttribute('aria-label', 'Drag to look around');
    layer.append(look);
    for (const control of TOUCH_CONTROLS) {
        const element = document.createElement(control.id === 'stick' ? 'div' : 'button');
        element.dataset.control = control.id;
        if (element instanceof HTMLButtonElement) element.type = 'button';
        if (control.id === 'stick') {
            element.className = 'touch-stick';
            element.setAttribute('aria-label', 'Movement joystick');
            element.innerHTML = '<span></span>';
        } else {
            element.textContent = control.label;
            element.setAttribute('aria-label', control.id === 'pause' ? 'Pause game' : control.label);
            if ('key' in control) element.dataset.key = control.key;
            if (control.id === 'fire') element.dataset.fire = '';
            if (control.id === 'pause') element.dataset.pause = '';
        }
        layer.append(element);
    }
    // Mounted-only control shares the vacated grapple slot. It is deliberately
    // absent from the bean's saved layout and from the settings preview.
    const helmet = document.createElement('button');
    helmet.type = 'button'; helmet.textContent = 'Helmet'; helmet.dataset.control = 'helmet'; helmet.dataset.key = 'KeyO';
    helmet.setAttribute('aria-label', 'Toggle mech helmet'); helmet.hidden = true; layer.append(helmet);
    const exit = document.createElement('button');
    exit.type = 'button'; exit.textContent = 'Exit'; exit.dataset.control = 'exit'; exit.dataset.key = 'KeyR';
    exit.setAttribute('aria-label', 'Shut down and leave mech'); exit.hidden = true; layer.append(exit);
    setFireMode(layer, fireMode);
    return layer;
}

function setFireMode(layer: HTMLElement, mode: TouchFireMode): void {
    const fire = layer.querySelector<HTMLButtonElement>('[data-control="fire"]')!;
    if (fire.dataset.fireMode === mode) return;
    // Keep the same outer element so editor selection and gameplay pointer
    // listeners survive a mode change. Only its presentation is replaced.
    fire.dataset.fireMode = mode;
    fire.classList.toggle('touch-fire-joystick', mode === 'joystick');
    fire.setAttribute('aria-label', mode === 'joystick' ? 'Fire joystick' : 'Fire');
    if (mode === 'joystick') fire.innerHTML = '<span>Fire</span>';
    else fire.textContent = 'Fire';
}

export function getTouchBounds(layer: HTMLElement): TouchBounds {
    const style = getComputedStyle(layer);
    return {
        width: layer.clientWidth, height: layer.clientHeight,
        left: parseFloat(style.paddingLeft) || 0, right: parseFloat(style.paddingRight) || 0,
        top: parseFloat(style.paddingTop) || 0, bottom: parseFloat(style.paddingBottom) || 0,
    };
}

export function applyTouchLayout(layer: HTMLElement, layout: TouchLayout, fireMode: TouchFireMode = 'joystick'): void {
    setFireMode(layer, fireMode);
    const bounds = getTouchBounds(layer);
    for (const { id } of TOUCH_CONTROLS) {
        const element = layer.querySelector<HTMLElement>(`[data-control="${id}"]`)!;
        const rect = getTouchControlRect(id, layout, bounds, fireMode);
        Object.assign(element.style, {
            left: `${rect.left}px`, top: `${rect.top}px`, width: `${rect.width}px`, height: `${rect.height}px`,
            fontSize: `${(id === 'fire' ? 16 : id === 'powerJump' ? 9 : 12) * (layout[id]?.scale ?? 1)}px`,
        });
    }
    const helmet = layer.querySelector<HTMLElement>('[data-control="helmet"]')!;
    const grapple = layer.querySelector<HTMLElement>('[data-control="grapple"]')!;
    helmet.style.cssText = grapple.style.cssText;
    const exit = layer.querySelector<HTMLElement>('[data-control="exit"]')!;
    exit.style.cssText = layer.querySelector<HTMLElement>('[data-control="inspect"]')!.style.cssText;
}
