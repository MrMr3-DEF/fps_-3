import test from 'node:test';
import assert from 'node:assert/strict';
import { modelFailure } from '../src/gothModelFailure.ts';

test('GPU model unloads do not tell players to delete their downloaded cache', () => {
    for (const error of [new Error('Model not loaded before trying to complete chat'), 'WebGPUNotAvailableError', new Error('Device was lost'), 'Object has already been disposed']) {
        const message = modelFailure(error).message;
        assert.match(message, /WebGPU session/);
        assert.match(message, /does not mean the downloaded files were deleted/);
    }
});

test('storage and network failures retain their original diagnostic', () => {
    assert.match(modelFailure(new Error('QuotaExceededError')).message, /browser storage.*QuotaExceededError/);
    assert.match(modelFailure(new Error('Failed to fetch')).message, /connection.*Failed to fetch/);
    assert.equal(modelFailure(new Error('specific runtime detail')).message, 'Error: specific runtime detail');
});
