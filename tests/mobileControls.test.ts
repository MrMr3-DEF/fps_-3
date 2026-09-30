import test from 'node:test';
import assert from 'node:assert/strict';
import { Euler, PerspectiveCamera } from 'three';
import { state } from '../src/state.js';
import { setupMobileControls } from '../src/mobileControls.js';
import { beginInput, endInput, isInputActive, setTouchMode, touchMove } from '../src/inputSession.js';
import { cloneSettings, DEFAULT_USER_SETTINGS, userSettings } from '../src/settings.js';

/** Pointer capture and bubbling are the DOM seams exercised by the real input handlers. */
class TouchElement extends EventTarget {
    id = '';
    hidden = false;
    className = '';
    dataset: Record<string, string> = {};
    style: Record<string, string> = {};
    children: TouchElement[] = [];
    parent: TouchElement | null = null;
    attributes: Record<string, string> = {};
    private text = '';
    private classes = new Set<string>();
    private pointers = new Set<number>();
    classList = {
        add: (name: string) => { this.classes.add(name); },
        remove: (name: string) => { this.classes.delete(name); },
        contains: (name: string) => this.classes.has(name) || this.className.split(' ').includes(name),
        toggle: (name: string, value: boolean) => { if (value) this.classes.add(name); else this.classes.delete(name); },
    };
    readonly tag: string;
    constructor(tag: string) { super(); this.tag = tag; }
    get clientWidth() { return 844; }
    get clientHeight() { return 390; }
    get firstElementChild() { return this.children[0]; }
    get textContent() { return this.text; }
    set textContent(text: string) { this.text = text; this.children = []; }
    set innerHTML(html: string) {
        this.children = [];
        if (html.startsWith('<span')) this.append(new TouchElement('span'));
    }
    append(...children: TouchElement[]) { for (const child of children) { child.parent = this; this.children.push(child); } }
    setAttribute(name: string, value: string) { this.attributes[name] = value; }
    hasAttribute(name: string) { return name.startsWith('data-') ? name.slice(5) in this.dataset : name in this.attributes; }
    matches(selector: string): boolean {
        if (selector.startsWith('.')) return this.classList.contains(selector.slice(1));
        if (selector.startsWith('[data-control=')) return this.dataset.control === selector.match(/"(.*?)"/)?.[1];
        return this.tag === selector;
    }
    querySelectorAll(selector: string): TouchElement[] {
        return this.children.flatMap(child => [...(child.matches(selector) ? [child] : []), ...child.querySelectorAll(selector)]);
    }
    querySelector(selector: string) { return this.querySelectorAll(selector)[0] ?? null; }
    getBoundingClientRect() {
        return { left: parseFloat(this.style.left) || 0, top: parseFloat(this.style.top) || 0,
            width: parseFloat(this.style.width) || 0, height: parseFloat(this.style.height) || 0 };
    }
    setPointerCapture(id: number) { this.pointers.add(id); }
    hasPointerCapture(id: number) { return this.pointers.has(id); }
    releasePointerCapture(id: number) { this.pointers.delete(id); this.pointer('lostpointercapture', id, 0, 0); }
    pointer(type: string, pointerId: number, clientX: number, clientY: number, pointerType = 'touch') {
        const event = Object.assign(new Event(type, { bubbles: true, cancelable: true }), { pointerId, clientX, clientY, pointerType, button: 0 });
        for (let element: TouchElement | null = this; element; element = element.parent) element.dispatchEvent(event);
    }
}
class TouchButton extends TouchElement { type = ''; constructor() { super('button'); } }

for (const coarsePointer of [true, false]) test(`two touch owners can move and fire/aim together with a ${coarsePointer ? 'coarse' : 'fine'} primary pointer; cancellation, mode changes and blur release fire`, async () => {
    const previousSettings = cloneSettings(userSettings);
    const previousState = { controls: state.controls, camera: state.camera, baseSensitivity: state.baseSensitivity, isScoped: state.isScoped };
    const body = new TouchElement('body');
    const win = new EventTarget();
    const doc = Object.assign(new EventTarget(), { body, hidden: false, fullscreenElement: null,
        documentElement: { requestFullscreen: async () => { throw new Error('Unsupported'); } },
        createElement: (tag: string) => tag === 'button' ? new TouchButton() : new TouchElement(tag),
    });
    const globals = { window: win, document: doc, HTMLButtonElement: TouchButton, innerWidth: 844, innerHeight: 390,
        matchMedia: () => ({ matches: coarsePointer }), getComputedStyle: () => ({ paddingLeft: '0', paddingRight: '0', paddingTop: '0', paddingBottom: '0' }) };
    const descriptors = new Map(Object.keys(globals).map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
    for (const [key, value] of Object.entries(globals)) Object.defineProperty(globalThis, key, { configurable: true, value });
    const fires: boolean[] = [];
    try {
        setTouchMode(false);
        Object.assign(userSettings, cloneSettings(DEFAULT_USER_SETTINGS), { mobileInput: 'touch' });
        state.controls = Object.assign(new EventTarget(), { isLocked: false, unlock() {} }) as unknown as NonNullable<typeof state.controls>;
        state.camera = new PerspectiveCamera();
        state.baseSensitivity = 1;
        state.isScoped = false;
        const sync = setupMobileControls({ keyDown() {}, keyUp() {}, fire: held => fires.push(held) });
        beginInput();
        await Promise.resolve();
        const layer = body.children.find(child => child.id === 'mobile-controls')!;
        const stick = layer.querySelector('[data-control="stick"]')!;
        const fire = layer.querySelector('[data-control="fire"]')!;
        const stickRect = stick.getBoundingClientRect();
        const fireRect = fire.getBoundingClientRect();
        const x = fireRect.left + fireRect.width / 2 - 10, y = fireRect.top + fireRect.height / 2 + 5;
        stick.pointer('pointerdown', 1, stickRect.left + stickRect.width, stickRect.top + stickRect.height / 2);
        fire.pointer('pointerdown', 2, x, y);
        assert.equal(touchMove.x, 1);
        assert.deepEqual(fires, [true]);
        assert.equal(state.camera.quaternion.angleTo(new PerspectiveCamera().quaternion), 0, 'pressing off-center must not turn the camera');
        assert.ok(stick.hasPointerCapture(1) && fire.hasPointerCapture(2));
        fire.pointer('pointerdown', 3, x, y);
        fire.pointer('pointermove', 3, x + 100, y + 100);
        assert.deepEqual(fires, [true], 'another finger cannot steal a held fire control');
        assert.equal(state.camera.rotation.y, 0);
        fire.pointer('pointermove', 2, x + 32, y - 12);
        const aim = new Euler().setFromQuaternion(state.camera.quaternion, 'YXZ');
        assert.ok(Math.abs(aim.y + 32 * 0.004) < 1e-10);
        assert.ok(Math.abs(aim.x - 12 * 0.004) < 1e-10);
        assert.equal(touchMove.x, 1, 'aiming and shooting do not interrupt the movement finger');
        assert.notEqual(fire.firstElementChild.style.transform, '');
        state.camera.quaternion.identity();
        state.isScoped = true;
        fire.pointer('pointermove', 2, x + 52, y - 12);
        assert.ok(Math.abs(new Euler().setFromQuaternion(state.camera.quaternion, 'YXZ').y + 20 * 0.004 * 0.45) < 1e-10);
        fire.pointer('pointercancel', 2, x, y);
        assert.deepEqual(fires, [true, false]);
        assert.equal(fire.firstElementChild.style.transform, '');
        assert.equal(fire.hasPointerCapture(2), false);
        assert.equal(touchMove.x, 1, 'cancelling fire does not release movement');
        const cancelledAim = state.camera.quaternion.clone();
        fire.pointer('pointermove', 2, x + 200, y);
        assert.ok(state.camera.quaternion.equals(cancelledAim));
        endInput();
        assert.deepEqual(touchMove, { x: 0, y: 0 });

        userSettings.touchFireMode = 'button';
        sync();
        beginInput();
        await Promise.resolve();
        assert.equal(fire.classList.contains('touch-fire-joystick'), false);
        assert.equal(fire.firstElementChild, undefined);
        fire.pointer('pointerdown', 4, x, y);
        fire.pointer('pointermove', 4, x + 200, y + 100);
        assert.ok(state.camera.quaternion.equals(cancelledAim), 'the button variant shoots without aiming');
        assert.equal(fires.at(-1), true);
        userSettings.touchFireMode = 'joystick';
        sync();
        assert.equal(fires.at(-1), false, 'changing fire type releases a held shot before replacing its knob');
        assert.equal(fire.hasPointerCapture(4), false);
        assert.equal(fire.classList.contains('touch-fire-joystick'), true);
        fire.pointer('pointermove', 4, x + 300, y);
        assert.ok(state.camera.quaternion.equals(cancelledAim));

        const beforeMouse = fires.length;
        fire.pointer('pointerdown', 5, x, y, 'mouse');
        assert.equal(fires.length, beforeMouse, 'mouse input must not acquire touch controls');
        fire.pointer('pointerdown', 6, x, y);
        fire.pointer('pointermove', 6, x + 20, y);
        win.dispatchEvent(new Event('blur'));
        assert.equal(isInputActive(), false);
        assert.equal(fires.at(-1), false);
        assert.equal(fire.firstElementChild.style.transform, '');
        assert.equal(fire.hasPointerCapture(6), false);
    } finally {
        endInput();
        setTouchMode(false);
        Object.assign(userSettings, previousSettings);
        Object.assign(state, previousState);
        for (const [key, descriptor] of descriptors) {
            if (descriptor) Object.defineProperty(globalThis, key, descriptor);
            else Reflect.deleteProperty(globalThis, key);
        }
    }
});
