export interface MouseButtonMask {
    primary: boolean;
    secondary: boolean;
    middle: boolean;
}

// Unlike pointerdown/up, mouse events fire when an additional mouse button is
// pressed or released while another remains held.
export const MOUSE_BUTTON_EVENT_TYPES = ['mousedown', 'mouseup', 'mousemove'] as const;

/** Decode the MouseEvent.buttons bitmask, including simultaneous buttons. */
export function decodeMouseButtons(buttons: number): MouseButtonMask {
    const safeButtons = Number.isInteger(buttons) && buttons >= 0 ? buttons : 0;
    return {
        primary: (safeButtons & 1) !== 0,
        secondary: (safeButtons & 2) !== 0,
        middle: (safeButtons & 4) !== 0,
    };
}
