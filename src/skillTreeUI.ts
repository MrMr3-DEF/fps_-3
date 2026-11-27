import { SKILL_TREE_MAX_LEVEL } from './config.js';
import {
    SKILL_UPGRADE_ORDER, skillUpgradeCost,
    type SkillTreeState, type SkillUpgradeId,
} from './skillTree.js';
import { WEAPON_INDICATOR_ICONS } from './weaponIndicatorIcons.js';

/** Flat blue orb used for skill points in the HUD, balance header and upgrade costs. */
export const SKILL_ORB_ICON_SVG = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" overflow="visible" aria-hidden="true" focusable="false">' +
    '<circle cx="16" cy="16" r="9.5" fill="#00aaff"/>' +
    '<circle cx="16" cy="16" r="13.75" fill="none" stroke="#00aaff" stroke-width="2.5"/>' +
    '</svg>';

/** Greek cross of five equal squares, matching the white weapon indicator silhouettes. */
export const HEALTH_CROSS_ICON_SVG = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 100" fill="#fff" aria-hidden="true" focusable="false">' +
    '<rect x="58" y="36" width="84" height="28"/>' +
    '<rect x="86" y="8" width="28" height="84"/>' +
    '</svg>';

interface SkillTreeOverlayOptions {
    onUpgrade: (upgrade: SkillUpgradeId) => void;
}

interface SkillTreeItem {
    id: SkillUpgradeId;
    column: HTMLElement;
    level: HTMLElement;
    tile: HTMLButtonElement;
    cost: HTMLElement;
}

export class SkillTreeOverlay {
    private readonly overlay: HTMLElement;
    private readonly points: HTMLElement;
    private readonly balance: HTMLElement;
    private readonly items: SkillTreeItem[];
    private opened = false;

    get isOpen(): boolean { return this.opened; }

    constructor(options: SkillTreeOverlayOptions) {
        this.overlay = document.getElementById('skill-tree-overlay')!;
        this.points = document.getElementById('skill-points')!;
        this.balance = document.getElementById('skill-tree-balance-value')!;
        const row = document.getElementById('skill-tree-row')!;
        // index.html keeps the orb placeholders static; the shared SVG keeps
        // every point indicator identical to the upgrade-cost icons.
        for (const orb of document.querySelectorAll<HTMLElement>('.skill-orb-icon')) orb.innerHTML = SKILL_ORB_ICON_SVG;
        this.items = SKILL_UPGRADE_ORDER.map(id => this.createItem(id, options.onUpgrade));
        row.replaceChildren(...this.items.map(item => item.column));
    }

    private createItem(id: SkillUpgradeId, onUpgrade: (upgrade: SkillUpgradeId) => void): SkillTreeItem {
        const label = id === 'HEALTH' ? 'Health' : WEAPON_INDICATOR_ICONS[id].label;
        const column = document.createElement('div');
        column.className = 'skill-tree-column';
        const level = document.createElement('span');
        level.className = 'skill-tree-level';
        const tile = document.createElement('button');
        tile.type = 'button';
        tile.className = 'skill-tree-tile';
        tile.dataset.upgrade = id;
        tile.setAttribute('aria-label', `Upgrade ${label}`);
        tile.innerHTML = id === 'HEALTH' ? HEALTH_CROSS_ICON_SVG : WEAPON_INDICATOR_ICONS[id].svg;
        tile.addEventListener('click', () => onUpgrade(id));
        const costRow = document.createElement('span');
        costRow.className = 'skill-tree-cost';
        const orb = document.createElement('span');
        orb.className = 'skill-orb-icon';
        orb.setAttribute('aria-hidden', 'true');
        orb.innerHTML = SKILL_ORB_ICON_SVG;
        const cost = document.createElement('span');
        cost.className = 'skill-tree-cost-value';
        costRow.append(orb, cost);
        column.append(level, tile, costRow);
        return { id, column, level, tile, cost };
    }

    open(tree: SkillTreeState): void {
        this.opened = true;
        this.overlay.hidden = false;
        this.render(tree);
    }

    close(): void {
        this.opened = false;
        this.overlay.hidden = true;
    }

    render(tree: SkillTreeState): void {
        this.points.textContent = String(tree.points);
        this.balance.textContent = String(tree.points);
        for (const item of this.items) {
            const level = tree.levels[item.id];
            const maxed = level >= SKILL_TREE_MAX_LEVEL;
            const cost = skillUpgradeCost(item.id, level);
            const affordable = cost !== null && tree.points >= cost;
            item.level.textContent = maxed ? 'MAX' : `Lv. ${level}`;
            item.cost.textContent = cost === null ? 'MAX' : String(cost);
            item.tile.disabled = cost === null || !affordable;
            item.tile.classList.toggle('is-affordable', affordable);
            item.tile.classList.toggle('is-maxed', maxed);
            item.column.classList.toggle('is-affordable', affordable);
            item.column.classList.toggle('is-maxed', maxed);
        }
    }
}
