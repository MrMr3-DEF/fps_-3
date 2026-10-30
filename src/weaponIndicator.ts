import { WEAPON_INDICATOR_ICONS, type WeaponIndicatorKind } from './weaponIndicatorIcons.js';
import { getWeaponIndicatorTouchBottom, type TouchBounds, type TouchLayout, type TouchFireMode } from './mobileControlLayout.js';

export function selectedWeaponIcon(activeWeaponName: string, piloting: boolean): WeaponIndicatorKind {
    if (piloting) return 'ROCKET';
    return Object.hasOwn(WEAPON_INDICATOR_ICONS, activeWeaponName) && activeWeaponName !== 'ROCKET'
        ? activeWeaponName as WeaponIndicatorKind : 'PISTOL';
}

export class WeaponIndicator {
    private readonly element: HTMLElement;
    private current: WeaponIndicatorKind | null = null;

    constructor(element: HTMLElement) { this.element = element; }

    update(activeWeaponName: string, piloting: boolean): void {
        const kind = selectedWeaponIcon(activeWeaponName, piloting);
        if (kind === this.current) return;
        this.current = kind;
        const icon = WEAPON_INDICATOR_ICONS[kind];
        this.element.innerHTML = icon.svg;
        this.element.dataset.weapon = kind;
        this.element.setAttribute('aria-label', `Selected weapon: ${icon.label}`);
    }

    placeTouch(layout: TouchLayout, bounds: TouchBounds, fireMode: TouchFireMode): void {
        const height = Number.parseFloat(getComputedStyle(this.element).height);
        const bottom = getWeaponIndicatorTouchBottom(layout, bounds, height, fireMode);
        this.element.style.setProperty('--weapon-indicator-touch-bottom', `${bottom}px`);
    }

    reset(): void {
        this.current = null;
        this.element.replaceChildren();
        delete this.element.dataset.weapon;
        this.element.setAttribute('aria-label', 'Selected weapon');
    }
}
