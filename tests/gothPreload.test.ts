import test from 'node:test';
import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import { readFileSync } from 'node:fs';
import { CHAT_CONSENT_KEY } from '../src/gothChatConsent.ts';

// Exercise the real UI lifecycle without a browser, GPU or model downloads.
const fakeEngine = `export class GothChatEngine {
  ready = false;
  async load() { globalThis.modelLoads++; this.ready = true; }
  dispose() { this.ready = false; }
}`;
registerHooks({
    resolve(specifier, context, next) {
        if (context.parentURL?.endsWith('/gothChat.ts') && specifier.endsWith('gothChatEngine.js')) {
            return { url: 'data:text/javascript,' + encodeURIComponent(fakeEngine), shortCircuit: true };
        }
        return next(specifier, context);
    },
    load(url, context, next) {
        if (url.endsWith('/gothChat.css')) return { format: 'module', source: '', shortCircuit: true };
        return next(url, context);
    },
});

class Element {
    hidden = false;
    value = '';
    textContent = '';
    scrollHeight = 0;
    scrollTop = 0;
    clientHeight = 0;
    nodes = new Map<string, Element>();
    handlers = new Map<string, () => void>();
    classList = { add() {}, remove() {} };
    querySelector(selector: string) {
        if (!this.nodes.has(selector)) this.nodes.set(selector, new Element());
        return this.nodes.get(selector)!;
    }
    setAttribute() {}
    addEventListener(name: string, callback: () => void) { this.handlers.set(name, callback); }
    append() {}
    replaceChildren() {}
    focus() {}
}

test('automatic loading requires consent, shares its model with chat, and settings approval returns to settings', async () => {
    const original = { window: globalThis.window, document: globalThis.document, fetch: globalThis.fetch };
    const values = new Map<string, string>();
    let panel = new Element();
    let fetches = 0;
    let gameplayHooks = 0;
    Object.assign(globalThis, {
        modelLoads: 0,
        window: { localStorage: { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => values.set(key, value) }, addEventListener() {} },
        document: { body: new Element(), createElement: (tag: string) => tag === 'section' ? (panel = new Element()) : new Element() },
        fetch: async (url: string) => {
            fetches++;
            return new Response(readFileSync(new URL('../public' + url, import.meta.url), 'utf8'));
        },
    });
    try {
        const { GothChat } = await import('../src/gothChat.ts');
        const chat = new GothChat({ onOpen: () => gameplayHooks++, onClose: () => gameplayHooks++, onReplyStart() {} });
        chat.preload();
        assert.equal(fetches, 0);
        let approval: boolean | undefined;
        chat.requestDownloadApproval(value => { approval = value; });
        chat.close();
        assert.equal(approval, false);
        assert.equal(values.size, 0);
        chat.requestDownloadApproval(value => { approval = value; });
        panel.querySelector('[data-action="approve"]').handlers.get('click')!();
        assert.equal(approval, true);
        assert.equal(values.get(CHAT_CONSENT_KEY), 'accepted');
        assert.equal(chat.isOpen, false);
        assert.equal(gameplayHooks, 0);
        assert.equal(fetches, 0, 'approving the setting alone does not download before Apply');
        chat.preload();
        chat.preload();
        // Starting a game must not cancel an automatic download.
        chat.reset();
        await (chat as unknown as { preloadTask: Promise<void> }).preloadTask;
        assert.equal((globalThis as unknown as { modelLoads: number }).modelLoads, 1);
        chat.open();
        await new Promise(resolve => setTimeout(resolve, 0));
        assert.equal((globalThis as unknown as { modelLoads: number }).modelLoads, 1);
        chat.close();
        chat.requestDownloadApproval(value => { approval = value; });
        assert.equal(panel.querySelector('.goth-chat-notice').hidden, false, 'show the same notice even with saved approval');
        chat.close();
        assert.equal(approval, false);
    } finally {
        Object.assign(globalThis, original);
    }
});

test('automatic download preference is off by default and persists only as a boolean', async () => {
    const { DEFAULT_USER_SETTINGS, userSettings, loadUserSettings, saveUserSettings } = await import('../src/settings.ts');
    const originalStorage = globalThis.localStorage;
    const originalSettings = { ...userSettings };
    let saved = '{}';
    Object.assign(globalThis, { localStorage: { getItem: () => saved, setItem: (_key: string, value: string) => { saved = value; } } });
    try {
        assert.equal(DEFAULT_USER_SETTINGS.downloadWebLLMImmediately, false);
        assert.equal(loadUserSettings().downloadWebLLMImmediately, false);
        userSettings.downloadWebLLMImmediately = true;
        saveUserSettings();
        userSettings.downloadWebLLMImmediately = false;
        assert.equal(loadUserSettings().downloadWebLLMImmediately, true);
        saved = '{"downloadWebLLMImmediately":"true"}';
        assert.equal(loadUserSettings().downloadWebLLMImmediately, false);
    } finally {
        Object.assign(userSettings, originalSettings);
        Object.assign(globalThis, { localStorage: originalStorage });
    }
});
