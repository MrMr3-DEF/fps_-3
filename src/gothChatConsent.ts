/** Bump the key when the information shown to players materially changes. */
export const CHAT_CONSENT_KEY = 'testfps.goth-chat-consent.v3';

type ConsentStorage = Pick<Storage, 'getItem' | 'setItem'>;

export class ChatConsent {
    private accepted = false;
    private storage: ConsentStorage | undefined;

    constructor(storage: () => ConsentStorage = () => window.localStorage) {
        try {
            this.storage = storage();
            this.accepted = this.storage.getItem(CHAT_CONSENT_KEY) === 'accepted';
        } catch { /* Restricted storage still allows explicit approval for this page. */ }
    }

    get approved(): boolean { return this.accepted; }

    accept(): void {
        this.accepted = true;
        try { this.storage?.setItem(CHAT_CONSENT_KEY, 'accepted'); } catch { /* Session-only approval. */ }
    }
}
