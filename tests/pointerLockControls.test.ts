import test from 'node:test';
import assert from 'node:assert/strict';
import { Euler, PerspectiveCamera, Vector3 } from 'three';
import { PointerLockControls } from '../src/pointerLockControls.js';
import { scopedPointerSensitivity, setLookInputHandler } from '../src/lookInput.js';

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
    controls.rawMouseInput = true;
    controls.lock(); controls.lock();
    await flush();
    assert.deepEqual(options, [{ unadjustedMovement: true }, undefined]);
    controls.dispose();
});

test('lock state is set before callbacks; optional spike protection retains the Windows workaround', t => {
    let now = 0;
    t.mock.method(performance, 'now', () => now);
    const { controls, doc, element, camera } = fixture(() => {});
    controls.mouseSpikeProtection = true;
    controls.addEventListener('lock', () => assert.equal(controls.isLocked, true));
    controls.addEventListener('unlock', () => assert.equal(controls.isLocked, false));
    doc.pointerLockElement = element;
    doc.dispatchEvent(new Event('pointerlockchange'));
    const move = (x: number, y: number, time: number) => {
        now = time;
        const event = new Event('mousemove');
        Object.defineProperties(event, { movementX: { value: x }, movementY: { value: y }, timeStamp: { value: time } });
        doc.dispatchEvent(event);
    };
    const initial = camera.quaternion.clone();
    move(835, 442, 20201);
    assert.ok(camera.quaternion.equals(initial));
    move(4, 0, 21392);
    controls.update(21412);
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
        controls.rawMouseInput = true;
        controls.lock();
        await flush();
        assert.equal(requests, 1);
        controls.dispose();
    }
});

test('default pointer lock respects system input instead of forcing raw input', async () => {
    const options: unknown[] = [];
    const { controls } = fixture(option => { options.push(option); });
    controls.lock(); await flush();
    assert.deepEqual(options, [undefined]);
    controls.dispose();
});

test('both input modes smooth sparse samples and retain high-polling mouse response', t => {
    let now = 0;
    t.mock.method(performance, 'now', () => now);
    for (const raw of [false, true]) for (const inputHz of [60, 125, 1000, 8000]) for (const renderHz of [60, 120, 144, 240]) {
        const { camera, controls, doc, element } = fixture(() => {});
        controls.rawMouseInput = raw; controls.pointerSpeed = 3;
        doc.pointerLockElement = element; doc.dispatchEvent(new Event('pointerlockchange'));
        let eventIndex = 0;
        const before = camera.quaternion.clone();
        for (let frame = 1; frame <= renderHz; frame++) {
            const time = frame * 1000 / renderHz;
            while ((eventIndex + 1) * 1000 / inputHz <= time + 1e-8) {
                now = ++eventIndex * 1000 / inputHz;
                const event = new Event('mousemove');
                Object.defineProperties(event, { movementX: { value: 720 / inputHz }, movementY: { value: 0 }, timeStamp: { value: now } });
                doc.dispatchEvent(event);
            }
            now = time; controls.update(time);
            const step = camera.quaternion.angleTo(before);
            if (frame > renderHz / 5) {
                assert.ok(Math.abs(step - 720 * 0.006 / renderHz) < 1e-6,
                    `uneven aim: raw=${raw}, input=${inputHz}, render=${renderHz}, step=${step}`);
            }
            before.copy(camera.quaternion);
        }
        controls.update(1020);
        const expected = new PerspectiveCamera(); expected.rotation.set(0, -720 * 0.006, 0, 'YXZ');
        assert.ok(camera.quaternion.angleTo(expected.quaternion) < 1e-6, 'resampling preserves total movement');
        controls.dispose();
    }
});

test('genuine first motion, extreme flicks, pitch limits and cancellation retain one shared aim', t => {
    let now = 0;
    t.mock.method(performance, 'now', () => now);
    const { camera, controls, doc, element } = fixture(() => {});
    const lock = () => { doc.pointerLockElement = element; doc.dispatchEvent(new Event('pointerlockchange')); };
    const move = (x: number, y: number, time: number) => {
        now = time;
        const event = new Event('mousemove');
        Object.defineProperties(event, { movementX: { value: x }, movementY: { value: y }, timeStamp: { value: time } });
        doc.dispatchEvent(event);
    };
    lock(); move(4, 0, 2);
    assert.equal(camera.rotation.y, 0, 'incoming samples do not move aim ahead of the displayed crosshair');
    controls.update(20);
    assert.ok(Math.abs(new Euler().setFromQuaternion(camera.quaternion, 'YXZ').y + 0.008) < 1e-9);
    move(300, 0, 22); move(100, 0, 24); controls.update(50);
    assert.ok(Math.abs(new Euler().setFromQuaternion(camera.quaternion, 'YXZ').y + 0.808) < 1e-9, 'fast deceleration does not lose a genuine flick');
    move(10, 10, 52); controls.unlock(); lock(); controls.update(100);
    assert.ok(Math.abs(new Euler().setFromQuaternion(camera.quaternion, 'YXZ').y + 0.808) < 1e-9, 'unlock discards pending interpolation');
    controls.minPolarAngle = 0.1; controls.maxPolarAngle = Math.PI - 0.1;
    move(0, -200, 102); move(0, -1000, 104); controls.update(130);
    assert.ok(Math.abs(new Euler().setFromQuaternion(camera.quaternion, 'YXZ').x - (Math.PI / 2 - 0.1)) < 1e-9);
    move(40, 0, 132); controls.resetLook(); controls.update(200);
    const settled = camera.quaternion.clone(); controls.update(500);
    assert.ok(camera.quaternion.equals(settled), 'no inertial motion after the bounded tail or a reset');
    controls.dispose();
});

test('scoped gain matches perspective projection throughout zoom and shared look still routes vehicle input', t => {
    for (const baseFov of [55, 75, 105]) for (const fov of [8, 15, 35, baseFov]) {
        const camera = new PerspectiveCamera(fov, 16 / 9);
        const ratio = scopedPointerSensitivity(3, fov, baseFov);
        const projected = new Vector3(Math.sin(0.0001 * ratio), 0, -Math.cos(0.0001 * ratio)).project(camera).x;
        const baseCamera = new PerspectiveCamera(baseFov, 16 / 9);
        const expected = new Vector3(Math.sin(0.0003), 0, -Math.cos(0.0003)).project(baseCamera).x;
        assert.ok(Math.abs(projected / expected - 1) < 1e-7);
    }
    let now = 0; t.mock.method(performance, 'now', () => now);
    const { camera, controls, doc, element } = fixture(() => {});
    doc.pointerLockElement = element; doc.dispatchEvent(new Event('pointerlockchange'));
    const samples: number[][] = [];
    setLookInputHandler((yaw, pitch, time) => { samples.push([yaw, pitch, time]); return true; });
    try {
        now = 10; const event = new Event('mousemove');
        Object.defineProperties(event, { movementX: { value: 10 }, movementY: { value: -4 }, timeStamp: { value: now } });
        doc.dispatchEvent(event); controls.update(30);
        assert.deepEqual(samples, [[-0.02, 0.008, 30]]);
        assert.ok(camera.quaternion.equals(new PerspectiveCamera().quaternion));
    } finally { setLookInputHandler(null); controls.dispose(); }
});

test('permission errors do not trigger fallback requests', async () => {
    let requests = 0;
    const { controls } = fixture(async () => { requests++; throw new DOMException('Denied', 'NotAllowedError'); });
    controls.lock();
    await flush();
    assert.equal(requests, 1);
    controls.dispose();
});

test('a pointerlockerror releases a stuck request so Resume can retry', async () => {
    let requests = 0;
    let settleFirst!: () => void;
    const { controls, doc, element } = fixture(() => {
        requests++;
        if (requests === 1) return new Promise<void>(resolve => { settleFirst = resolve; });
        doc.pointerLockElement = element;
        doc.dispatchEvent(new Event('pointerlockchange'));
        return Promise.resolve();
    });
    controls.lock();
    doc.dispatchEvent(new Event('pointerlockerror'));
    controls.lock();
    await flush();
    assert.equal(requests, 2);
    assert.equal(controls.isLocked, true);
    settleFirst();
    await flush();
    assert.equal(controls.isLocked, true, 'a late result from the failed request cannot undo recovery');
    controls.dispose();
});
