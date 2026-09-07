import test from 'node:test';
import assert from 'node:assert/strict';
import { ChatEscape } from '../src/chatEscape.js';

function event(type: string, isComposing = false) {
    return { type, key: 'Escape', isComposing, prevented: false, stopped: false,
        preventDefault() { this.prevented = true; },
        stopImmediatePropagation() { this.stopped = true; } };
}

test('chat keeps mouse capture released through Escape keydown/repeats and resumes once on keyup', () => {
    const escape = new ChatEscape();
    let open = true, resumes = 0;
    const close = () => { resumes++; open = false; };
    for (let repeat = 0; repeat < 4; repeat++) {
        const down = event('keydown');
        assert.equal(escape.handle(down, open, close), true);
        assert.equal(down.prevented && down.stopped, true);
        assert.equal(open, true, 'no pointer-lock request while Escape is held');
    }
    const up = event('keyup');
    assert.equal(escape.handle(up, open, close), true);
    assert.equal(up.prevented && up.stopped, true, 'the release must not reach gameplay');
    assert.equal(resumes, 1);
    assert.equal(open, false);
    assert.equal(escape.handle(event('keydown'), open, close), false, 'the next Escape can pause normal gameplay');
    assert.equal(escape.handle(event('keyup'), open, close), false);
    assert.equal(resumes, 1);
});

test('death or another close while Escape is held cannot resume gameplay on release', () => {
    const escape = new ChatEscape();
    let resumes = 0;
    const close = () => resumes++;
    escape.handle(event('keydown'), true, close);
    const release = event('keyup');
    assert.equal(escape.handle(release, false, close), true);
    assert.equal(release.stopped, true);
    assert.equal(resumes, 0);
});

test('IME Escape and an unrelated key release do not close the conversation', () => {
    const escape = new ChatEscape();
    let resumes = 0;
    const close = () => resumes++;
    assert.equal(escape.handle(event('keydown', true), true, close), false);
    escape.handle(event('keyup'), true, close);
    assert.equal(resumes, 0);
    assert.equal(escape.handle({ ...event('keydown'), key: 'f' }, true, close), false);
});
