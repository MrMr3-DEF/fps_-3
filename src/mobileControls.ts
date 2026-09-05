import { Euler } from 'three';
import { state } from './state.js';
import { onInputStarted, onInputEnded, enableTouchMode, endInput, isInputActive, touchMove } from './inputSession.js';
import './mobile.css';

interface Actions {
    keyDown(code: string): void;
    keyUp(code: string): void;
    fire(held: boolean): void;
}

/** Independent pointer ownership permits walking, aiming and firing together. */
export function setupMobileControls(actions: Actions): void {
    if (!matchMedia('(pointer: coarse)').matches) return;
    enableTouchMode();
    document.body.classList.add('touch-device');
    const rotate = document.createElement('div');
    rotate.id = 'rotate-device';
    rotate.setAttribute('role', 'status');
    rotate.innerHTML = '<span aria-hidden="true">↻</span><strong>Rotate your device</strong><p>Hold your phone in landscape to play.</p>';
    document.body.append(rotate);
    const layer = document.createElement('div');
    layer.id = 'mobile-controls';
    layer.hidden = true;
    layer.setAttribute('aria-label', 'Touch game controls');
    layer.innerHTML = `
        <div id="touch-look" aria-label="Drag to look around"></div>
        <div id="touch-stick" aria-label="Movement joystick"><span></span></div>
        <div class="touch-utility">
            <button data-key="KeyE" aria-label="Next weapon">Weapon</button>
            <button data-key="KeyX" aria-label="Inspect weapon">Inspect</button>
            <button data-key="KeyP" aria-label="Switch camera view">View</button>
            <button data-pause aria-label="Pause game">Ⅱ</button>
        </div>
        <div class="touch-actions">
            <button data-key="KeyR" aria-label="Grappling hook">Grapple</button>
            <button data-key="ShiftLeft" aria-label="Hold to hover">Hover</button>
            <button data-key="KeyC" aria-label="Hold to aim">Aim</button>
            <button data-key="Space" aria-label="Jump">Jump</button>
            <button data-fire aria-label="Fire weapon">Fire</button>
        </div>`;
    document.body.append(layer);
    const stick = layer.querySelector<HTMLElement>('#touch-stick')!;
    const knob = stick.firstElementChild as HTMLElement;
    const look = layer.querySelector<HTMLElement>('#touch-look')!;
    const rotation = new Euler(0, 0, 0, 'YXZ');
    const held = new Map<number, { element: HTMLElement; release: () => void }>();
    let stickPointer: number | null = null;
    let lookPointer: number | null = null;
    let lastX = 0, lastY = 0;

    function capture(e: PointerEvent, element: HTMLElement, release: () => void): boolean {
        if (!isInputActive() || e.pointerType !== 'touch') return false;
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
    look.addEventListener('pointermove', e => {
        if (e.pointerId !== lookPointer || !state.camera || !isInputActive()) return;
        const sensitivity = 0.004 * state.baseSensitivity * (state.isScoped ? 0.45 : 1);
        rotation.setFromQuaternion(state.camera.quaternion);
        rotation.y -= (e.clientX - lastX) * sensitivity;
        rotation.x = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, rotation.x - (e.clientY - lastY) * sensitivity));
        state.camera.quaternion.setFromEuler(rotation);
        lastX = e.clientX; lastY = e.clientY;
    });
    for (const button of layer.querySelectorAll<HTMLButtonElement>('button')) {
        let owner: number | null = null;
        button.addEventListener('pointerdown', e => {
            if (owner !== null) return;
            if (!capture(e, button, () => {
                owner = null;
                button.classList.remove('held');
                if (button.dataset.key) actions.keyUp(button.dataset.key);
                if (button.hasAttribute('data-fire')) actions.fire(false);
            })) return;
            owner = e.pointerId;
            button.classList.add('held');
            if (button.dataset.key) actions.keyDown(button.dataset.key);
            if (button.hasAttribute('data-fire')) actions.fire(true);
            if (button.hasAttribute('data-pause')) endInput();
        });
    }
    onInputStarted(() => { layer.hidden = false; });
    onInputEnded(() => { reset(); layer.hidden = true; });
    const pause = () => { reset(); if (isInputActive()) endInput(); };
    window.addEventListener('blur', pause);
    document.addEventListener('fullscreenchange', () => { if (!document.fullscreenElement) pause(); });
    document.addEventListener('visibilitychange', () => { if (document.hidden) pause(); });
    window.addEventListener('resize', () => { if (innerWidth <= innerHeight) pause(); });
}
