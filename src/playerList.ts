import { state } from './state.js';

export function renderPlayerList(): void {
    const rows = document.getElementById('player-list-rows');
    if (!rows) return;
    rows.replaceChildren();
    for (const player of state.playerList) {
        const row = document.createElement('div');
        row.className = 'player-list-row';
        row.setAttribute('role', 'listitem');
        if (player.peerId === state.peer?.id) row.classList.add('player-list-self');
        const face = document.createElement('span');
        face.className = 'player-list-face';
        face.setAttribute('aria-hidden', 'true');
        face.style.color = `#${player.bodyColor.toString(16).padStart(6, '0')}`;
        const name = document.createElement('span');
        name.className = 'player-list-name';
        name.textContent = player.username;
        const kd = document.createElement('span');
        kd.className = 'player-list-kd';
        kd.textContent = `${player.kills}/${player.deaths}`;
        kd.setAttribute('aria-label', `${player.kills} kills, ${player.deaths} deaths`);
        row.append(face, name, kd);
        rows.append(row);
    }
}

export function setPlayerListVisible(visible: boolean): void {
    const panel = document.getElementById('player-list');
    if (!panel) return;
    if (visible && (!state.isMultiplayer || !state.isPlaying)) return;
    if (visible && panel.hidden) renderPlayerList();
    panel.hidden = !visible;
    panel.setAttribute('aria-hidden', String(!visible));
}
