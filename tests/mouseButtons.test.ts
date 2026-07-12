import test from 'node:test';
import assert from 'node:assert/strict';
import { decodeMouseButtons } from '../src/mouseButtons.ts';

test('mouse button bitmask preserves simultaneous fire and ADS', () => {
    assert.deepEqual(decodeMouseButtons(0), { primary: false, secondary: false, middle: false });
    assert.deepEqual(decodeMouseButtons(1), { primary: true, secondary: false, middle: false });
    assert.deepEqual(decodeMouseButtons(2), { primary: false, secondary: true, middle: false });
    assert.deepEqual(decodeMouseButtons(3), { primary: true, secondary: true, middle: false });
});

test('mouse button decoder handles middle and invalid masks safely', () => {
    assert.deepEqual(decodeMouseButtons(4), { primary: false, secondary: false, middle: true });
    assert.deepEqual(decodeMouseButtons(Number.NaN), { primary: false, secondary: false, middle: false });
});
