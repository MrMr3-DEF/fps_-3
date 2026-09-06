import test from 'node:test';
import assert from 'node:assert/strict';
import { PerspectiveCamera } from 'three';
import { PointerLockControls } from '../src/pointerLockControls.js';

function fixture(request: (options?: unknown) => Promise<void> | void) {
    const doc = Object.assign(new EventTarget(), {
        pointerLockElement: null as unknown,
        exitPointerLock() { this.pointerLockElement = null; this.dispatchEvent(new Event('pointerlockchange')); },
    });
    const element = { ownerDocument: doc, requestPointerLock: request };
    const camera = new PerspectiveCamera();
    const controls = new PointerLockControls(camera, element as unknown as HTMLElement);
    return { doc, element, camera, controls };
}
const flush = () => new Promise(resolve => setImmediate(resolve));

test('unsupported raw input falls back once and duplicate pending requests are ignored', async () => {
    const options: unknown[] = [];
    const { controls } = fixture(async option => {
        options.push(option);
        if (option) throw new DOMException('Raw unavailable', 'NotSupportedError');
    });
    controls.lock(); controls.lock();
    await flush();
    assert.deepEqual(options, [{ unadjustedMovement: true }, undefined]);
    controls.dispose();
});

test('lock state is set before callbacks; reported spikes do not rotate the actual camera', () => {
    const { controls, doc, element, camera } = fixture(() => {});
    controls.addEventListener('lock', () => assert.equal(controls.isLocked, true));
    controls.addEventListener('unlock', () => assert.equal(controls.isLocked, false));
    doc.pointerLockElement = element;
    doc.dispatchEvent(new Event('pointerlockchange'));
    const move = (x: number, y: number, time: number) => {
        const event = new Event('mousemove');
        Object.defineProperties(event, { movementX: { value: x }, movementY: { value: y }, timeStamp: { value: time } });
        doc.dispatchEvent(event);
    };
    const initial = camera.quaternion.clone();
    move(835, 442, 20201);
    assert.ok(camera.quaternion.equals(initial));
    move(4, 0, 21392);
    const afterNormal = camera.quaternion.clone();
    assert.ok(!afterNormal.equals(initial));
    move(702, -3, 21394);
    assert.ok(camera.quaternion.equals(afterNormal));
    controls.unlock();
    move(20, 10, 21396);
    assert.ok(camera.quaternion.equals(afterNormal));
    controls.dispose();
});

test('raw input success makes one request and legacy void-returning APIs are supported', async () => {
    for (const result of [undefined, Promise.resolve()]) {
        let requests = 0;
        const { controls } = fixture(() => { requests++; return result; });
        controls.lock();
        await flush();
        assert.equal(requests, 1);
        controls.dispose();
    }
});

test('permission errors do not trigger fallback requests', async () => {
    let requests = 0;
    const { controls } = fixture(async () => { requests++; throw new DOMException('Denied', 'NotAllowedError'); });
    controls.lock();
    await flush();
    assert.equal(requests, 1);
    controls.dispose();
});
