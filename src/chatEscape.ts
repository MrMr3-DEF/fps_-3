/** Consume the whole Escape press before returning mouse capture to gameplay. */
export class ChatEscape {
    private pressed = false;

    handle(event: Pick<KeyboardEvent, 'key' | 'type' | 'isComposing' | 'preventDefault' | 'stopImmediatePropagation'>, chatOpen: boolean, close: () => void): boolean {
        if (event.key !== 'Escape' || event.isComposing || (!chatOpen && !this.pressed)) return false;
        event.preventDefault();
        event.stopImmediatePropagation();
        if (event.type === 'keydown') {
            if (chatOpen) this.pressed = true;
        } else if (event.type === 'keyup') {
            const shouldClose = this.pressed && chatOpen;
            this.pressed = false;
            if (shouldClose) close();
        }
        return true;
    }
}
