import { state } from './state.js';
import { applyLookInput } from './lookInput.js';
import { onInputStarted, onInputEnded, setTouchMode, touchMode, endInput, isInputActive, touchMove } from './inputSession.js';
import { userSettings } from './settings.js';
import { createTouchControls, applyTouchLayout } from './mobileControlsView.js';

interface Actions {
    keyDown(code: string): void;
    keyUp(code: string): void;
    fire(held: boolean): void;
}

/** Independent pointer ownership permits walking, aiming and firing together. */
export function setupMobileControls(actions: Actions): () => void {
    // A hybrid computer may have a fine primary pointer and still accept touch.
    // Device detection controls presentation defaults, never the chosen input mode.
    const coarsePointer = matchMedia('(pointer: coarse)').matches;
    const rotate = document.createElement('div');
    rotate.id = 'rotate-device';
    rotate.setAttribute('role', 'status');
    rotate.innerHTML = '<span aria-hidden="true">↻</span><strong>Rotate your device</strong><p>Hold your phone in landscape to play.</p>';
    document.body.append(rotate);
    const layer = createTouchControls(userSettings.touchFireMode);
    layer.id = 'mobile-controls';
    layer.hidden = true;
    document.body.append(layer);
    const stick = layer.querySelector<HTMLElement>('.touch-stick')!;
    const knob = stick.firstElementChild as HTMLElement;
    const look = layer.querySelector<HTMLElement>('.touch-look')!;
    const held = new Map<number, { element: HTMLElement; release: () => void }>();
    let stickPointer: number | null = null;
    let lookPointer: number | null = null;
    let lastX = 0, lastY = 0;

    function capture(e: PointerEvent, element: HTMLElement, release: () => void): boolean {
        if (!touchMode || !isInputActive() || e.pointerType !== 'touch') return false;
        e.preventDefault();
        element.setPointerCapture(e.pointerId);
        held.set(e.pointerId, { element, release });
        return true;
    }
    function release(id: number): void {
        const entry = held.get(id);
        if (!entry) return;
        held.delete(id);
        entry.release();
        if (entry.element.hasPointerCapture(id)) entry.element.releasePointerCapture(id);
    }
    function reset(): void {
        for (const id of [...held.keys()]) release(id);
        touchMove.x = touchMove.y = 0;
    }
    for (const event of ['pointerup', 'pointercancel', 'lostpointercapture']) {
        layer.addEventListener(event, e => release((e as PointerEvent).pointerId));
    }
    function moveStick(e: PointerEvent): void {
        const rect = stick.getBoundingClientRect();
        const radius = rect.width * 0.35;
        let x = (e.clientX - rect.left - rect.width / 2) / radius;
        let y = (e.clientY - rect.top - rect.height / 2) / radius;
        const distance = Math.hypot(x, y);
        if (distance < 0.12) x = y = 0;
        else { const scale = Math.min(1, (distance - 0.12) / 0.88) / distance; x *= scale; y *= scale; }
        touchMove.x = x; touchMove.y = y;
        knob.style.transform = `translate(${x * radius}px, ${y * radius}px)`;
    }
    stick.addEventListener('pointerdown', e => {
        if (stickPointer !== null) return;
        if (!capture(e, stick, () => { stickPointer = null; touchMove.x = touchMove.y = 0; knob.style.transform = ''; })) return;
        stickPointer = e.pointerId;
        moveStick(e);
    });
    stick.addEventListener('pointermove', e => { if (e.pointerId === stickPointer) moveStick(e); });
    look.addEventListener('pointerdown', e => {
        if (lookPointer !== null) return;
        if (!capture(e, look, () => { lookPointer = null; })) return;
        lookPointer = e.pointerId; lastX = e.clientX; lastY = e.clientY;
    });
    function lookBy(x: number, y: number, time: number): void {
        if (!state.camera || !isInputActive()) return;
        const sensitivity = 0.004 * state.baseSensitivity * (state.isScoped ? 0.45 : 1);
        applyLookInput(state.camera, -x * sensitivity, -y * sensitivity, -Math.PI / 2, Math.PI / 2, time);
    }
    look.addEventListener('pointermove', e => {
        if (e.pointerId !== lookPointer) return;
        lookBy(e.clientX - lastX, e.clientY - lastY, e.timeStamp);
        lastX = e.clientX; lastY = e.clientY;
    });
    for (const button of layer.querySelectorAll<HTMLButtonElement>('button')) {
        let owner: number | null = null;
        let fireStartX = 0, fireStartY = 0, fireLastX = 0, fireLastY = 0;
        button.addEventListener('pointerdown', e => {
            if (owner !== null) return;
            if (!capture(e, button, () => {
                owner = null;
                button.classList.remove('held');
                const knob = button.querySelector<HTMLElement>('span');
                if (button.hasAttribute('data-fire') && knob) knob.style.transform = '';
                if (button.dataset.key) actions.keyUp(button.dataset.key);
                if (button.hasAttribute('data-fire')) actions.fire(false);
            })) return;
            owner = e.pointerId;
            // Aim starts at the contact point, so an off-center press can fire
            // immediately without snapping the camera. Capture permits dragging
            // beyond the visible stick while the other thumb keeps moving.
            fireStartX = fireLastX = e.clientX;
            fireStartY = fireLastY = e.clientY;
            button.classList.add('held');
            if (button.dataset.key) actions.keyDown(button.dataset.key);
            if (button.hasAttribute('data-fire')) actions.fire(true);
            if (button.hasAttribute('data-pause')) endInput();
        });
        if (button.hasAttribute('data-fire')) button.addEventListener('pointermove', e => {
            if (e.pointerId !== owner || userSettings.touchFireMode !== 'joystick' || !isInputActive()) return;
            lookBy(e.clientX - fireLastX, e.clientY - fireLastY, e.timeStamp);
            fireLastX = e.clientX; fireLastY = e.clientY;
            const x = e.clientX - fireStartX, y = e.clientY - fireStartY;
            const radius = button.getBoundingClientRect().width * 0.25;
            const scale = Math.min(1, radius / (Math.hypot(x, y) || 1));
            button.querySelector<HTMLElement>('span')!.style.transform = `translate(${x * scale}px, ${y * scale}px)`;
        });
    }
    function sync(): void {
        reset();
        const enabled = userSettings.mobileInput === 'touch';
        setTouchMode(enabled);
        document.body.classList.toggle('touch-device', coarsePointer || enabled);
        document.body.classList.toggle('touch-input', enabled);
        layer.hidden = !enabled || !isInputActive();
        if (!layer.hidden) applyTouchLayout(layer, userSettings.touchLayout, userSettings.touchFireMode);
    }
    onInputStarted(() => {
        layer.hidden = !touchMode;
        if (!layer.hidden) applyTouchLayout(layer, userSettings.touchLayout, userSettings.touchFireMode);
    });
    onInputEnded(() => { reset(); layer.hidden = true; });
    const pause = () => { reset(); if (isInputActive()) endInput(); };
    window.addEventListener('blur', pause);
    document.addEventListener('fullscreenchange', () => { if (!document.fullscreenElement) pause(); });
    document.addEventListener('visibilitychange', () => { if (document.hidden) pause(); });
    window.addEventListener('resize', () => {
        if (touchMode && innerWidth <= innerHeight) pause();
        else if (!layer.hidden) applyTouchLayout(layer, userSettings.touchLayout, userSettings.touchFireMode);
    });
    sync();
    return sync;
}
