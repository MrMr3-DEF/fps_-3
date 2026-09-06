import test from 'node:test';
import assert from 'node:assert/strict';
import { MouseMovementFilter } from '../src/mouseMovement.js';

test('reported lock-entry and isolated Windows spikes do not enter camera movement', () => {
    const filter = new MouseMovementFilter();
    assert.equal(filter.sample(835, 442, 20201), null);
    assert.deepEqual(filter.sample(4, 10, 21392), { x: 4, y: 10 });
    assert.equal(filter.sample(702, -3, 21394), null);
    assert.deepEqual(filter.sample(3, 8, 21396), { x: 3, y: 8 });
    filter.sample(6, 6, 31408);
    assert.equal(filter.sample(298, 478, 31410), null);
    assert.deepEqual(filter.sample(2, 8, 31412), { x: 2, y: 8 });
});

test('normal movement and low-polling large deltas preserve exact input', () => {
    const filter = new MouseMovementFilter();
    filter.sample(0, 0, 0);
    assert.deepEqual(filter.sample(200, -100, 2), { x: 200, y: -100 });
    assert.deepEqual(filter.sample(700, 0, 18), { x: 700, y: 0 });
    assert.deepEqual(filter.sample(-800, 10, 60), { x: -800, y: 10 });
});

test('confirmed sustained fast input retains both samples without an angular cap', () => {
    const filter = new MouseMovementFilter();
    filter.sample(0, 0, 0);
    assert.equal(filter.sample(702, 0, 2), null);
    assert.deepEqual(filter.sample(690, 0, 4), { x: 1392, y: 0 });
    assert.deepEqual(filter.sample(700, 0, 6), { x: 700, y: 0 });
});

test('reset discards pending movement and invalid input cannot poison later samples', () => {
    const filter = new MouseMovementFilter();
    filter.sample(0, 0, 0);
    filter.sample(702, 0, 2);
    filter.reset();
    assert.equal(filter.sample(835, 442, 10), null);
    assert.equal(filter.sample(NaN, 0, 11), null);
    assert.deepEqual(filter.sample(1, 2, 12), { x: 1, y: 2 });
});
