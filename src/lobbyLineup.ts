import type { LobbyPlayer } from './networkTypes.js';
import type { CalloutHorizontalDirection, CalloutVerticalDirection } from './smartGogglesMath.js';

export interface LobbyCalloutPreset {
    horizontal: CalloutHorizontalDirection;
    vertical: CalloutVerticalDirection;
    diagonal: number;
}

// Entries follow roster order: host, near left, near right, far left, far right.
// The solver may use another corner if this one would cover a name or menu.
const CALLOUTS: Readonly<Record<number, readonly LobbyCalloutPreset[]>> = {
    1: [{ horizontal: 'right', vertical: 'up', diagonal: 54 }],
    2: [{ horizontal: 'right', vertical: 'up', diagonal: 78 },
        { horizontal: 'right', vertical: 'up', diagonal: 54 }],
    3: [{ horizontal: 'right', vertical: 'up', diagonal: 102 },
        { horizontal: 'right', vertical: 'up', diagonal: 54 },
        { horizontal: 'left', vertical: 'up', diagonal: 78 }],
    4: [{ horizontal: 'right', vertical: 'up', diagonal: 102 },
        { horizontal: 'right', vertical: 'up', diagonal: 78 },
        { horizontal: 'left', vertical: 'up', diagonal: 102 },
        { horizontal: 'right', vertical: 'up', diagonal: 30 }],
    5: [{ horizontal: 'right', vertical: 'up', diagonal: 102 },
        { horizontal: 'right', vertical: 'up', diagonal: 54 },
        { horizontal: 'left', vertical: 'up', diagonal: 102 },
        { horizontal: 'right', vertical: 'up', diagonal: 30 },
        { horizontal: 'left', vertical: 'down', diagonal: 54 }],
};

export function lobbyCalloutPreset(totalPlayers: number, rosterIndex: number): LobbyCalloutPreset {
    return CALLOUTS[totalPlayers]?.[rosterIndex] ?? CALLOUTS[1][0];
}

/** Every client sees the same lineup but scans only the other players. */
export function lobbyScanPlayers(players: readonly LobbyPlayer[], localPeerId: string): LobbyPlayer[] {
    return players.filter(player => player.peerId !== localPeerId);
}

/** Zero is the host. Guests alternate sides in admission order, then recede. */
export function lobbyPreviewPosition(index: number, aspect: number): { x: number; z: number } {
    if (index === 0) return { x: 0, z: 0 };
    const row = Math.floor((index - 1) / 2);
    const side = index % 2 === 1 ? -1 : 1;
    const width = Math.min(1, Math.max(0.55, aspect / 1.2));
    // The outer pair needs extra lateral spacing to remain visible behind the
    // nearer pair; tighten that spread on portrait viewports.
    return { x: side * (2.35 + row * (0.65 + 1.8 * width)) * width, z: -1.45 - row * 1.5 };
}
