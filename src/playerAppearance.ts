import { characterColor, saveCharacterColor, validCharacterColor } from './appearance.js';
import { getPlayerAvatar } from './playerAvatar.js';
import { publishSuitColor } from './multiplayer.js';
import { state } from './state.js';

/** The saved tint follows the local pilot through preview, spawn, cockpit and subsequent lives. */
export function changePlayerSuitColor(color: string): void {
    if (!validCharacterColor(color) || color.toLowerCase() === characterColor.toLowerCase()) return;
    saveCharacterColor(color.toLowerCase());
    getPlayerAvatar(state.playerMesh)?.setColor(Number.parseInt(color.slice(1), 16));
    if (state.isMultiplayer) publishSuitColor();
}
