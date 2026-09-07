import './gothChat.css';
import { ChatConsent } from './gothChatConsent.js';
import { ChatEscape } from './chatEscape.js';
import { buildCharacterPrompt, byteLength, loadCharacterKnowledge, type CharacterKnowledge } from './gothKnowledge.js';
import type { GothChatEngine } from './gothChatEngine.js';

interface ChatHooks {
    onOpen(): void;
    onClose(resume: boolean): void;
    onReplyStart(): void;
}

/** Owns the conversation UI, consent gate, transcript and async request lifetime. */
export class GothChat {
    private openingKey: string | null = null;
    private panel: HTMLElement;
    private transcript: HTMLElement;
    private input: HTMLInputElement;
    private status: HTMLElement;
    private progress: HTMLProgressElement;
    private notice: HTMLElement;
    private conversation: HTMLElement;
    private consent = new ChatConsent();
    private escape = new ChatEscape();
    private hooks: ChatHooks;
    private knowledge: CharacterKnowledge | null = null;
    private engine: GothChatEngine | null = null;
    private epoch = 0;
    private fetchController: AbortController | null = null;
    private pending = false;
    private opened = false;
    private greetingShown = false;
    private activeAnswer: HTMLElement | null = null;
    get isOpen(): boolean { return this.opened; }

    constructor(hooks: ChatHooks) {
        this.hooks = hooks;
        this.panel = document.createElement('section');
        this.panel.id = 'goth-chat';
        this.panel.hidden = true;
        this.panel.setAttribute('role', 'dialog');
        this.panel.setAttribute('aria-label', 'Talk to your girlfriend');
        this.panel.setAttribute('aria-modal', 'true');
        this.panel.innerHTML = `
            <div class="goth-chat-notice" hidden aria-labelledby="goth-chat-notice-title">
                <span class="goth-chat-eyebrow">BEFORE YOU CHAT</span>
                <h2 id="goth-chat-notice-title">A little about the AI</h2>
                <p>You’re talking to a fictional character powered by AI. Her replies are generated, can be inaccurate or inappropriate, and are not professional advice.</p>
                <ul>
                    <li><strong>Runs on your device.</strong> Chat text is processed locally with <a href="https://webllm.mlc.ai/" target="_blank" rel="noopener noreferrer">WebLLM</a> and a local language model. This chat does not send your messages to an AI service.</li>
                    <li><strong>A download on first use.</strong> Enabling chat downloads model files (roughly 1.1 GB with the default Qwen3.5 2B model) from Hugging Face and MLC’s hosting. These hosts receive normal connection information, such as your IP address. Running the model uses your device’s GPU and memory.</li>
                    <li><strong>You control when it starts.</strong> Messages stay in this page’s memory and clear when you refresh or leave the world. Model files may remain cached. Approval is saved in this browser; clearing site data removes it.</li>
                </ul>
                <p class="goth-chat-legal">Site information: <a href="https://luigismansion.de/impressum" target="_blank" rel="noopener noreferrer">Impressum</a> · <a href="https://luigismansion.de/datenschutz" target="_blank" rel="noopener noreferrer">Datenschutz</a></p>
                <div class="goth-chat-notice-actions"><button type="button" data-action="decline">Not now</button><button type="button" data-action="approve">I understand — enable AI chat</button></div>
                <p class="goth-chat-notice-footnote">Chat stays off until you approve. Esc returns to the game.</p>
            </div>
            <div class="goth-chat-conversation" hidden>
                <div class="goth-chat-messages" role="log" aria-label="Conversation" aria-live="polite" aria-relevant="additions text" tabindex="0"></div>
                <form class="goth-chat-compose">
                    <div class="goth-chat-status" id="goth-chat-status" role="status"></div>
                    <progress max="1" value="0" aria-label="Model loading progress" hidden></progress>
                    <label class="goth-chat-input-bar" for="goth-chat-input"><span class="goth-chat-sr-only">Message to your girlfriend</span><input id="goth-chat-input" maxlength="400" autocomplete="off" placeholder="Say something…" aria-describedby="goth-chat-status" enterkeyhint="send"><span class="goth-chat-key-hints" aria-hidden="true">Enter ↵ <span>·</span> Esc</span></label>
                </form>
            </div>`;
        document.body.append(this.panel);
        this.transcript = this.panel.querySelector('.goth-chat-messages')!;
        this.input = this.panel.querySelector('input')!;
        this.status = this.panel.querySelector('.goth-chat-status')!;
        this.progress = this.panel.querySelector('progress')!;
        this.notice = this.panel.querySelector('.goth-chat-notice')!;
        this.conversation = this.panel.querySelector('.goth-chat-conversation')!;
        this.panel.querySelector('form')!.addEventListener('submit', event => { event.preventDefault(); void this.submit(); });
        this.panel.querySelector('[data-action="approve"]')!.addEventListener('click', () => {
            this.consent.accept();
            this.showConversation();
        });
        this.panel.querySelector('[data-action="decline"]')!.addEventListener('click', () => this.close(true));
        // Capture before the game's document/window handlers, including when the log has focus.
        window.addEventListener('keydown', event => this.handleKey(event), true);
        window.addEventListener('keyup', event => {
            if (event.code === this.openingKey) {
                this.openingKey = null;
                event.preventDefault();
                event.stopImmediatePropagation();
                return;
            }
            if (this.escape.handle(event, this.opened, () => this.close(true))) return;
            if (this.opened) event.stopImmediatePropagation();
        }, true);
        window.addEventListener('wheel', event => {
            if (!this.opened) return;
            event.preventDefault();
            event.stopImmediatePropagation();
            const scroller = this.consent.approved ? this.transcript : this.notice;
            const unit = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? scroller.clientHeight : 1;
            scroller.scrollTop += event.deltaY * unit;
        }, { capture: true, passive: false });
        this.panel.addEventListener('click', event => {
            if (event.target === this.panel || event.target === this.conversation) this.focus();
        });
    }

    private handleKey(event: KeyboardEvent): void {
        if (this.escape.handle(event, this.opened, () => this.close(true))) return;
        if (!this.opened) return;
        event.stopImmediatePropagation();
        if (event.code === this.openingKey) { event.preventDefault(); return; }
        if (event.isComposing || event.keyCode === 229) return;
        if (!this.consent.approved) {
            if (event.key === 'Tab') this.trapFocus(event, this.notice);
            return;
        }
        if (event.key === 'Tab') { event.preventDefault(); this.input.focus(); return; }
        if (event.key === 'Enter') { event.preventDefault(); void this.submit(); return; }
        // Allow selecting/copying earlier messages. Other typing always returns to the draft.
        if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'c') return;
        if (event.target !== this.input) {
            this.input.focus();
            if (event.key.length === 1 && !event.metaKey && !event.ctrlKey && !event.altKey) {
                event.preventDefault();
                const start = this.input.selectionStart ?? this.input.value.length;
                const end = this.input.selectionEnd ?? start;
                if (this.input.value.length - (end - start) + event.key.length <= this.input.maxLength) {
                    this.input.setRangeText(event.key, start, end, 'end');
                }
            }
        }
    }

    private trapFocus(event: KeyboardEvent, root: HTMLElement): void {
        const focusable = [...root.querySelectorAll<HTMLElement>('button, a[href]')];
        const current = focusable.indexOf(document.activeElement as HTMLElement);
        const next = (current + (event.shiftKey ? -1 : 1) + focusable.length) % focusable.length;
        event.preventDefault();
        focusable[next]?.focus();
    }

    open(trigger?: { code: string; preventDefault?: () => void }): void {
        if (this.opened) return;
        // Focus changes during keydown must not insert the interaction key.
        trigger?.preventDefault?.();
        this.openingKey = trigger?.code ?? null;
        this.opened = true;
        this.panel.hidden = false;
        document.body.classList.add('goth-chat-open');
        this.notice.hidden = this.consent.approved;
        this.conversation.hidden = !this.consent.approved;
        this.hooks.onOpen();
        if (this.consent.approved) this.showConversation();
        else this.focus();
    }

    private showConversation(): void {
        if (!this.opened || !this.consent.approved) return;
        this.notice.hidden = true;
        this.conversation.hidden = false;
        this.focus();
        void this.initialize();
    }

    focus(): void {
        if (!this.opened) return;
        // Pointer-lock exit can arrive after open(), so the main lifecycle also calls this.
        (this.consent.approved ? this.input : this.panel.querySelector<HTMLButtonElement>('[data-action="decline"]')!).focus({ preventScroll: true });
    }

    close(resume = false): void {
        if (!this.opened) return;
        this.opened = false;
        this.panel.hidden = true;
        document.body.classList.remove('goth-chat-open');
        this.cancelPending();
        this.hooks.onClose(resume);
    }

    private cancelPending(): void {
        this.epoch++;
        if (this.activeAnswer) {
            this.activeAnswer.textContent = `${this.activeAnswer.textContent === '…' ? '' : this.activeAnswer.textContent}\n[Reply interrupted]`.trim();
            this.activeAnswer = null;
        }
        this.fetchController?.abort();
        this.fetchController = null;
        if (this.pending) { this.engine?.dispose(); this.engine = null; }
        this.pending = false;
    }

    reset(): void {
        this.close(false);
        this.cancelPending();
        this.transcript.replaceChildren();
        this.greetingShown = false;
        this.input.value = '';
        this.engine?.dispose();
        this.engine = null;
        this.knowledge = null;
    }

    private followsLatest(): boolean {
        return this.transcript.scrollHeight - this.transcript.scrollTop - this.transcript.clientHeight < 48;
    }

    private message(role: 'user' | 'assistant', text: string): HTMLElement {
        const row = document.createElement('div');
        row.className = `goth-message goth-message-${role}`;
        row.setAttribute('aria-label', role === 'user' ? 'You' : this.knowledge?.config.name ?? 'Your girlfriend');
        const body = document.createElement('p');
        body.textContent = text;
        row.append(body);
        this.transcript.append(row);
        this.transcript.scrollTop = this.transcript.scrollHeight;
        return body;
    }

    private setReady(): void {
        this.pending = false;
        this.progress.hidden = true;
        this.status.textContent = '';
    }

    private async initialize(): Promise<void> {
        if (!this.opened || !this.consent.approved || this.pending) return;
        const epoch = ++this.epoch;
        this.pending = true;
        this.status.textContent = 'Reading her character notes…';
        this.fetchController = new AbortController();
        try {
            const knowledge = this.knowledge ?? await loadCharacterKnowledge(this.fetchController.signal);
            if (epoch !== this.epoch) return;
            this.knowledge = knowledge;
            if (!this.greetingShown) {
                this.message('assistant', this.knowledge.config.greeting);
                this.greetingShown = true;
            }
            if (!this.engine?.ready) {
                this.status.textContent = 'Loading local chat. You can write while the model loads…';
                this.progress.hidden = false;
                this.progress.value = 0;
                this.progress.title = '';
                const { GothChatEngine } = await import('./gothChatEngine.js');
                if (epoch !== this.epoch) return;
                this.engine = new GothChatEngine();
                await this.engine.load(this.knowledge.config, (fraction, text) => {
                    if (epoch !== this.epoch) return;
                    this.progress.value = Math.min(1, Math.max(0, fraction));
                    this.status.textContent = `Loading local chat · ${Math.round(fraction * 100)}% · You can write while it loads`;
                    this.progress.title = text;
                });
            }
            if (epoch === this.epoch) this.setReady();
        } catch (error) { if (epoch === this.epoch) this.showError(error); }
    }

    private showError(error: unknown): void {
        this.pending = false;
        this.progress.hidden = true;
        this.engine?.dispose();
        this.engine = null;
        this.status.textContent = `${error instanceof Error ? error.message : 'Local chat could not start.'} Press Enter to retry.`;
    }

    private async submit(): Promise<void> {
        if (!this.opened || !this.consent.approved || this.pending) return;
        if (!this.engine?.ready || !this.knowledge) { void this.initialize(); return; }
        const text = this.input.value.trim();
        if (!text) return;
        if (byteLength(text) > 600) { this.status.textContent = 'Please shorten your message a little so she can follow it.'; return; }
        const epoch = ++this.epoch;
        const { messages } = buildCharacterPrompt(this.knowledge, text);
        this.pending = true;
        this.input.value = '';
        this.message('user', text);
        const answer = this.message('assistant', '…');
        this.activeAnswer = answer;
        this.status.textContent = 'She’s thinking…';
        let started = false;
        try {
            const reply = await this.engine.reply(messages, this.knowledge.config, content => {
                if (epoch !== this.epoch) return;
                const follow = this.followsLatest();
                if (!started) { started = true; this.hooks.onReplyStart(); }
                answer.textContent = content;
                this.status.textContent = 'She’s replying…';
                if (follow) this.transcript.scrollTop = this.transcript.scrollHeight;
            });
            if (epoch !== this.epoch) return;
            this.activeAnswer = null;
            answer.textContent = reply;
            this.setReady();
        } catch (error) {
            if (epoch !== this.epoch) return;
            this.activeAnswer = null;
            answer.textContent = started ? `${answer.textContent}\n[Reply interrupted]` : '[No reply received]';
            if (!this.input.value) this.input.value = text;
            this.showError(error);
        }
    }
}
