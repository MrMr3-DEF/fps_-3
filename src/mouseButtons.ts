export interface MouseButtonMask {
    primary: boolean;
    secondary: boolean;
    middle: boolean;
}

/** Decode the PointerEvent.buttons bitmask, including simultaneous buttons. */
export function decodeMouseButtons(buttons: number): MouseButtonMask {
    const safeButtons = Number.isInteger(buttons) && buttons >= 0 ? buttons : 0;
    return {
        primary: (safeButtons & 1) !== 0,
        secondary: (safeButtons & 2) !== 0,
        middle: (safeButtons & 4) !== 0,
    };
}
