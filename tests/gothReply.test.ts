import test from 'node:test';
import assert from 'node:assert/strict';
import { visibleGothReply } from '../src/gothReply.ts';

test('empty thinking markers are removed from a normal reply', () => {
    assert.equal(visibleGothReply('<think>\n\n</think>\nCome closer.'), 'Come closer.');
    assert.equal(visibleGothReply('Come closer.'), 'Come closer.');
});

test('thinking text and partial tags never leak while streaming', () => {
    const hidden = '<think>Private reasoning here.</think>\n';
    for (let length = 1; length <= hidden.length; length++) {
        assert.equal(visibleGothReply(hidden.slice(0, length)), '', `prefix ${length}`);
    }
    assert.equal(visibleGothReply(hidden + 'Hello.'), 'Hello.');
});

test('multiple blocks, unfinished thinking and orphan closing markers are handled', () => {
    assert.equal(visibleGothReply('<think>one</think>Hello.<think>two</think> Stay.'), 'Hello. Stay.');
    assert.equal(visibleGothReply('Hello.<think>unfinished'), 'Hello.');
    assert.equal(visibleGothReply('</think>\nHello.'), 'Hello.');
    assert.equal(visibleGothReply('Hello. <thi'), 'Hello.');
    assert.equal(visibleGothReply('I give it <3 points.'), 'I give it <3 points.');
});
