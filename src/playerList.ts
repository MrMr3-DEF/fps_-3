import { state } from './state.js';

/** A tiny front view of the actual bean silhouette: colored dome and dark visor. */
function drawBeanFace(canvas: HTMLCanvasElement, color: number): void {
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    canvas.width = canvas.height = 16;
    ctx.clearRect(0, 0, 16, 16);
    const suit = `#${color.toString(16).padStart(6, '0')}`;
    ctx.fillStyle = '#101a25';
    ctx.fillRect(6, 1, 4, 1);
    ctx.fillRect(4, 2, 8, 1);
    ctx.fillRect(3, 3, 10, 1);
    ctx.fillRect(2, 4, 12, 2);
    ctx.fillRect(1, 6, 14, 10);
    ctx.fillStyle = suit;
    ctx.fillRect(6, 2, 4, 1);
    ctx.fillRect(4, 3, 8, 1);
    ctx.fillRect(3, 4, 10, 2);
    ctx.fillRect(2, 6, 12, 9);
    ctx.fillRect(2, 15, 12, 1);
    ctx.fillStyle = '#ffffff38';
    ctx.fillRect(4, 4, 2, 1);
    ctx.fillRect(3, 5, 2, 2);
    ctx.fillRect(2, 7, 1, 6);
    ctx.fillStyle = '#00000045';
    ctx.fillRect(12, 7, 2, 8);
    ctx.fillRect(3, 14, 10, 1);
    ctx.fillStyle = '#101922';
    ctx.fillRect(2, 8, 12, 4);
    ctx.fillRect(3, 7, 10, 1);
    ctx.fillStyle = '#253a44';
    ctx.fillRect(3, 9, 10, 2);
    ctx.fillStyle = '#66e6ff';
    ctx.fillRect(5, 10, 6, 1);
    ctx.fillStyle = '#b6f7ff';
    ctx.fillRect(5, 10, 2, 1);
}

export function renderPlayerList(): void {
    const rows = document.getElementById('player-list-rows');
    if (!rows) return;
    rows.replaceChildren();
    for (const player of state.playerList) {
        const row = document.createElement('div');
        row.className = 'player-list-row';
        row.setAttribute('role', 'listitem');
        if (player.peerId === state.peer?.id) row.classList.add('player-list-self');
        const face = document.createElement('canvas');
        face.className = 'player-list-face';
        face.setAttribute('aria-hidden', 'true');
        drawBeanFace(face, player.bodyColor);
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
    if (visible) renderPlayerList();
    panel.hidden = !visible;
    panel.setAttribute('aria-hidden', String(!visible));
}
