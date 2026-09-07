import test from 'node:test';
import assert from 'node:assert/strict';
import { ChatConsent, CHAT_CONSENT_KEY } from '../src/gothChatConsent.js';

test('chat needs explicit approval and remembers it across visits', () => {
    const values = new Map<string, string>();
    const storage = { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => { values.set(key, value); } };
    assert.equal(new ChatConsent(() => storage).approved, false);
    assert.equal(values.size, 0, 'opening or declining must not save approval');
    const consent = new ChatConsent(() => storage);
    consent.accept();
    assert.equal(consent.approved, true);
    assert.equal(new ChatConsent(() => storage).approved, true);
    values.set(CHAT_CONSENT_KEY, 'false');
    assert.equal(new ChatConsent(() => storage).approved, false, 'invalid values cannot bypass the notice');
});

test('blocked browser storage requires approval each page, without breaking chat', () => {
    const blocked = () => { throw new Error('Storage unavailable'); };
    const consent = new ChatConsent(blocked);
    assert.equal(consent.approved, false);
    consent.accept();
    assert.equal(consent.approved, true);
    assert.equal(new ChatConsent(blocked).approved, false);
});

test('readable but unwritable storage falls back to approval for this page', () => {
    const storage = { getItem: () => null, setItem: () => { throw new Error('Quota exceeded'); } };
    const consent = new ChatConsent(() => storage);
    consent.accept();
    assert.equal(consent.approved, true);
    assert.equal(new ChatConsent(() => storage).approved, false);
});
