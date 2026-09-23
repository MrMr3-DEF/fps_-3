import test from 'node:test';
import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import { readFileSync } from 'node:fs';
import { CHAT_CONSENT_KEY } from '../src/gothChatConsent.ts';

// Exercise the real UI lifecycle without a browser, GPU or model downloads.
const fakeEngine = `export class GothChatEngine {
  ready = false;
  async load() { globalThis.modelLoads++; await globalThis.modelGate; if (globalThis.modelFailure) throw new Error("Simulated GPU loss"); this.ready = true; }
  dispose() { globalThis.modelDisposals++; this.ready = false; }
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
        modelDisposals: 0,
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
        chat.reset({ preserveLoadedModel: false });
        assert.equal((chat as unknown as { engine: unknown }).engine, null);
        assert.equal((globalThis as unknown as { modelDisposals: number }).modelDisposals, 1);
        chat.requestDownloadApproval(value => { approval = value; });
        assert.equal(panel.querySelector('.goth-chat-notice').hidden, false, 'show the same notice even with saved approval');
        chat.close();
        assert.equal(approval, false);
        let release!: () => void;
        Object.assign(globalThis, { modelGate: new Promise<void>(resolve => { release = resolve; }) });
        const waiting = new GothChat({ onOpen() {}, onClose() {}, onReplyStart() {} });
        waiting.open();
        await new Promise(resolve => setTimeout(resolve, 0));
        waiting.close();
        waiting.open();
        release();
        await new Promise(resolve => setTimeout(resolve, 0));
        assert.equal((globalThis as unknown as { modelLoads: number }).modelLoads, 2, 'reopening during a normal download shares one worker');
        waiting.close();
        Object.assign(globalThis, { modelFailure: true });
        const failed = new GothChat({ onOpen() {}, onClose() {}, onReplyStart() {} });
        failed.open();
        await new Promise(resolve => setTimeout(resolve, 0));
        assert.equal((globalThis as unknown as { modelLoads: number }).modelLoads, 3, 'failed loads do not immediately allocate a second GPU session');
        assert.match(panel.querySelector('.goth-chat-status').textContent, /Simulated GPU loss/);
        failed.close();
    } finally {
        Object.assign(globalThis, original);
    }
});

test('boolean settings preserve defaults and persist only boolean values', async () => {
    const { DEFAULT_USER_SETTINGS, userSettings, loadUserSettings, saveUserSettings } = await import('../src/settings.ts');
    const originalStorage = globalThis.localStorage;
    const originalSettings = { ...userSettings };
    let saved = '{}';
    Object.assign(globalThis, { localStorage: { getItem: () => saved, setItem: (_key: string, value: string) => { saved = value; } } });
    try {
        assert.equal(DEFAULT_USER_SETTINGS.downloadWebLLMImmediately, false);
        assert.equal(DEFAULT_USER_SETTINGS.lavaGlow, true);
        assert.equal(DEFAULT_USER_SETTINGS.photosensitivityMode, false);
        assert.equal(DEFAULT_USER_SETTINGS.muzzleFlashes, true);
        assert.equal(DEFAULT_USER_SETTINGS.bulletTrails, true);
        assert.equal(loadUserSettings().downloadWebLLMImmediately, false);
        assert.equal(loadUserSettings().lavaGlow, true);
        assert.equal(loadUserSettings().photosensitivityMode, false);
        assert.equal(loadUserSettings().muzzleFlashes, true);
        assert.equal(loadUserSettings().bulletTrails, true);
        userSettings.downloadWebLLMImmediately = true;
        userSettings.lavaGlow = true;
        userSettings.photosensitivityMode = true;
        userSettings.muzzleFlashes = false;
        userSettings.bulletTrails = false;
        saveUserSettings();
        userSettings.downloadWebLLMImmediately = false;
        userSettings.lavaGlow = false;
        userSettings.photosensitivityMode = false;
        userSettings.muzzleFlashes = true;
        userSettings.bulletTrails = true;
        assert.equal(loadUserSettings().downloadWebLLMImmediately, true);
        assert.equal(loadUserSettings().lavaGlow, true);
        assert.equal(loadUserSettings().photosensitivityMode, true);
        assert.equal(loadUserSettings().muzzleFlashes, false);
        assert.equal(loadUserSettings().bulletTrails, false);
        saved = '{"lavaGlow":false}';
        assert.equal(loadUserSettings().lavaGlow, false, 'explicitly saved off remains off');
        saved = '{"downloadWebLLMImmediately":"true","lavaGlow":"true","photosensitivityMode":"true","muzzleFlashes":"false","bulletTrails":"false"}';
        assert.equal(loadUserSettings().downloadWebLLMImmediately, false);
        assert.equal(loadUserSettings().lavaGlow, true);
        assert.equal(loadUserSettings().photosensitivityMode, false);
        assert.equal(loadUserSettings().muzzleFlashes, true);
        assert.equal(loadUserSettings().bulletTrails, true);
    } finally {
        Object.assign(userSettings, originalSettings);
        Object.assign(globalThis, { localStorage: originalStorage });
    }
});

test('Escape after a GPU error keeps a recoverable pause UI until mouse capture succeeds in SP and MP', async () => {
    const { PerspectiveCamera } = await import('three');
    const { PointerLockControls } = await import('../src/pointerLockControls.ts');
    const { state } = await import('../src/state.ts');
    const { onInputStarted, onInputEnded, endInput, beginInput, resumeInputAfterOverlay, isInputActive } = await import('../src/inputSession.ts');
    const { GothChat } = await import('../src/gothChat.ts');
    const original = { window: globalThis.window, document: globalThis.document, fetch: globalThis.fetch };
    try {
        for (const multiplayer of [false, true]) {
            const handlers = new Map<string, (event: any) => void>();
            let panel = new Element();
            Object.assign(globalThis, {
                modelFailure: true, modelGate: undefined,
                window: {
                    localStorage: { getItem: () => 'accepted' },
                    addEventListener: (name: string, callback: (event: any) => void) => handlers.set(name, callback),
                },
                document: { body: new Element(), createElement: (tag: string) => tag === 'section' ? (panel = new Element()) : new Element() },
                fetch: async (url: string) => new Response(readFileSync(new URL('../public' + url, import.meta.url), 'utf8')),
            });
            const doc = Object.assign(new EventTarget(), {
                pointerLockElement: null as unknown,
                exitPointerLock() { this.pointerLockElement = null; this.dispatchEvent(new Event('pointerlockchange')); },
            });
            let deny = true;
            const element = { ownerDocument: doc, requestPointerLock: async () => {
                if (deny) throw new DOMException('Escape cannot restore capture', 'NotAllowedError');
                doc.pointerLockElement = element; doc.dispatchEvent(new Event('pointerlockchange'));
            } };
            const controls = new PointerLockControls(new PerspectiveCamera(), element as unknown as HTMLElement);
            state.controls = controls; state.isPlaying = true; state.isMultiplayer = multiplayer; state.playerHp = 10;
            let pauseVisible = false;
            const chat = new GothChat({ onOpen: endInput, onClose: resumeInputAfterOverlay, onReplyStart() {} });
            onInputStarted(() => { pauseVisible = false; });
            onInputEnded(() => { pauseVisible = !chat.isOpen; });
            doc.pointerLockElement = element; doc.dispatchEvent(new Event('pointerlockchange'));
            chat.open();
            await new Promise(resolve => setImmediate(resolve));
            assert.match(panel.querySelector('.goth-chat-status').textContent, /Simulated GPU loss/);
            for (const type of ['keydown', 'keyup']) handlers.get(type)!({
                type, key: 'Escape', code: 'Escape', isComposing: false, preventDefault() {}, stopImmediatePropagation() {},
            });
            await new Promise(resolve => setImmediate(resolve));
            assert.equal(chat.isOpen, false);
            assert.equal(panel.hidden, true);
            assert.equal(isInputActive(), false);
            assert.equal(pauseVisible, true, 'denied Escape resume leaves a visible recovery route');
            deny = false;
            beginInput(); // The existing Resume button.
            await new Promise(resolve => setImmediate(resolve));
            assert.equal(isInputActive(), true, 'retry resumes the same game without reloading');
            assert.equal(pauseVisible, false);
            controls.dispose();
        }
    } finally {
        state.controls = null; state.isPlaying = false; state.isMultiplayer = false;
        Object.assign(globalThis, original);
    }
});
