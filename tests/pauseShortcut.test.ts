import test from 'node:test';
import assert from 'node:assert/strict';
import { getEscapePauseAction } from '../src/pauseShortcut.js';

const paused = {
    isPlaying: true,
    isAlive: true,
    isInputActive: false,
    isPauseMenuVisible: true,
};

test('Escape resumes a living game from its pause menu', () => {
    assert.equal(getEscapePauseAction('Escape', paused), 'resume');
});

test('the first Escape explicitly pauses active gameplay', () => {
    assert.equal(getEscapePauseAction('Escape', { ...paused, isInputActive: true }), 'pause');
});

test('Escape does not start play from unrelated overlays', () => {
    assert.equal(getEscapePauseAction('Escape', { ...paused, isPauseMenuVisible: false }), null);
    assert.equal(getEscapePauseAction('Escape', { ...paused, isAlive: false }), null);
    assert.equal(getEscapePauseAction('Escape', { ...paused, isPlaying: false }), null);
    assert.equal(getEscapePauseAction('Enter', paused), null);
});
