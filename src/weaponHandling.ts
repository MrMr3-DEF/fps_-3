import { FIREARM_MAGAZINES, GRAPPLE_DRAW_TIME, HEAVY_HANDOFF_TIME, HEAVY_RECENT_SHOT_TIME } from './config.js';
import type { FirearmName, WeaponName } from './networkTypes.js';
import type { HandlingSnapshot, HandPhase, LightWeapon } from './handlingNetworkTypes.js';

export type MagazineCounts = Record<FirearmName, number>;
export type { HandPhase } from './handlingNetworkTypes.js';
export function isFirearm(weapon: string): weapon is FirearmName {
    return Object.hasOwn(FIREARM_MAGAZINES, weapon);
}
export function isHeavy(weapon: string): boolean {
    return weapon === 'AR' || weapon === 'SNIPER' || weapon === 'MINIGUN';
}
export function isLight(weapon: string): weapon is LightWeapon {
    return weapon === 'PISTOL' || weapon === 'SHOTGUN';
}
export function batteryStage(rounds: number, capacity: number): number {
    if (rounds <= 0) return 0;
    if (rounds >= capacity) return 4;
    return Math.max(1, Math.min(3, Math.round(4 * rounds / capacity)));
}

/** The exposed cell charges between frames 95 and 151 of the 236-frame drawer action. */
export function reloadingBatteryStage(initial: number, progress: number): number {
    const charge = Math.max(0, Math.min(1, (progress * 236 - 95) / 56));
    return initial + Math.floor(charge * (4 - initial));
}
function fullMagazines(): MagazineCounts {
    return Object.fromEntries(Object.entries(FIREARM_MAGAZINES).map(([name, spec]) => [name, spec.capacity])) as MagazineCounts;
}

/** Uses the caller's monotonic clock in seconds. No render frames or input
 * packets can add rounds before the active battery's deadline. */
export class WeaponHandling {
    rounds = fullMagazines();
    reload: { weapon: FirearmName; started: number; ends: number; startRounds: number } | null = null;
    hand: HandPhase = 'holstered';
    handWeapon: WeaponName = 'PISTOL';
    outgoingLight: LightWeapon | null = null;
    handStarted = 0;
    handEnds = 0;
    pendingFire: FirearmName | null = null;
    lastHeavyShot = -Infinity;
    queuedReload: FirearmName | null = null;
    launchPending = false;

    constructor(weapon = '') {
        this.hand = isLight(weapon) ? 'drawn' : 'holstered';
        this.handWeapon = isFirearm(weapon) || weapon === 'KATANA' ? weapon : 'PISTOL';
    }

    private moveHand(drawing: boolean, now: number, duration: number, weapon: string): void {
        const moving = drawing ? 'drawing' : 'returning';
        const destination = drawing ? 'drawn' : 'holstered';
        if (this.hand === moving || this.hand === destination) return;
        // Switching back halfway through a handoff starts from the current grip.
        const reversed = this.hand === 'drawing' || this.hand === 'returning';
        const remaining = reversed ? Math.max(0, Math.min(1, (now - this.handStarted) / (this.handEnds - this.handStarted))) : 1;
        this.handWeapon = isFirearm(weapon) || weapon === 'KATANA' ? weapon : 'PISTOL';
        this.outgoingLight = null;
        this.hand = moving;
        this.handEnds = now + duration * remaining;
        this.handStarted = this.handEnds - duration;
    }

    private startReload(weapon: FirearmName, at: number): void {
        this.queuedReload = null;
        this.reload = { weapon, started: at, ends: at + FIREARM_MAGAZINES[weapon].reloadSeconds,
            startRounds: this.rounds[weapon] };
    }

    advance(now: number): void {
        if (this.hand === 'returning' && now >= this.handEnds) {
            this.hand = 'holstered';
            this.outgoingLight = null;
            this.handStarted = this.handEnds;
            if (this.queuedReload) this.startReload(this.queuedReload, this.handEnds);
        }
        if (this.reload && now >= this.reload.ends) {
            const { weapon, ends } = this.reload;
            this.rounds[weapon] = FIREARM_MAGAZINES[weapon].capacity;
            this.reload = null;
            if (isLight(weapon)) this.moveHand(true, ends, GRAPPLE_DRAW_TIME, weapon);
        }
        if (this.hand === 'drawing' && now >= this.handEnds) {
            this.hand = 'drawn';
            this.handStarted = this.handEnds;
        }
    }

    beginReload(weapon: FirearmName, now: number, tetherActive = false): boolean {
        this.advance(now);
        if (tetherActive || this.launchPending || this.hand === 'drawing' || this.hand === 'returning' ||
            this.reload || this.pendingFire || this.rounds[weapon] >= FIREARM_MAGAZINES[weapon].capacity) return false;
        if (this.hand === 'drawn') {
            this.queuedReload = weapon;
            this.moveHand(false, now, isHeavy(weapon) ? HEAVY_HANDOFF_TIME : GRAPPLE_DRAW_TIME, weapon);
        } else this.startReload(weapon, now);
        return true;
    }

    pressGrapple(weapon: string, now: number): boolean {
        this.advance(now);
        if (this.hand === 'returning' || this.queuedReload) return false;
        if (this.launchPending) return this.releaseGrapple(weapon, now);
        this.reload = null;
        this.pendingFire = null;
        this.launchPending = true;
        this.moveHand(true, now, isHeavy(weapon) && now <= this.lastHeavyShot + HEAVY_RECENT_SHOT_TIME
            ? HEAVY_HANDOFF_TIME : GRAPPLE_DRAW_TIME, weapon);
        return true;
    }

    releaseGrapple(weapon: string, now: number): boolean {
        this.advance(now);
        if (!this.launchPending && this.hand !== 'drawn') return false;
        this.launchPending = false;
        if (weapon === 'KATANA' || (this.hand === 'drawing' && !isLight(weapon)))
            this.moveHand(false, now, GRAPPLE_DRAW_TIME, weapon);
        return true;
    }

    equip(weapon: string, now: number, previousWeapon = weapon): void {
        this.advance(now);
        this.reload = null;
        this.queuedReload = null;
        this.pendingFire = null;
        if (!isLight(weapon)) this.launchPending = false;
        this.moveHand(isLight(weapon), now, isHeavy(weapon) ? HEAVY_HANDOFF_TIME : GRAPPLE_DRAW_TIME,
            isLight(weapon) ? previousWeapon : weapon);
        // A switch can take over a return already in progress (e.g. a reload).
        // Keep its deadline, but send the glove to the newly selected grip.
        if (this.hand === 'returning' && (isFirearm(weapon) || weapon === 'KATANA')) {
            this.handWeapon = weapon;
            this.outgoingLight = isHeavy(weapon) ? (isLight(previousWeapon) ? previousWeapon : this.outgoingLight) : null;
        }
    }

    requestHeavyFire(weapon: FirearmName, now: number, switching = false): boolean {
        this.advance(now);
        if (!isHeavy(weapon) || !this.rounds[weapon] || (this.hand === 'holstered' && !switching) ||
            this.reload || this.queuedReload || this.pendingFire) return false;
        this.launchPending = false;
        this.moveHand(false, now, HEAVY_HANDOFF_TIME, weapon);
        this.pendingFire = weapon;
        return true;
    }

    takeLaunch(now: number): boolean {
        this.advance(now);
        if (!this.launchPending || this.hand !== 'drawn') return false;
        this.launchPending = false;
        return true;
    }

    canFire(weapon: FirearmName, now: number): boolean {
        this.advance(now);
        return !this.reload && !this.queuedReload && this.rounds[weapon] > 0 &&
            (!isHeavy(weapon) || this.hand === 'holstered');
    }

    spendShot(weapon: FirearmName, now: number): boolean {
        if (!this.canFire(weapon, now)) return false;
        this.rounds[weapon]--;
        this.pendingFire = null;
        if (isHeavy(weapon)) this.lastHeavyShot = now;
        return true;
    }

    chargeStage(weapon: FirearmName, now: number): number {
        const cap = FIREARM_MAGAZINES[weapon].capacity;
        const reload = this.reload;
        if (!reload || reload.weapon !== weapon) return batteryStage(this.rounds[weapon], cap);
        const progress = (now - reload.started) / (reload.ends - reload.started);
        return reloadingBatteryStage(batteryStage(reload.startRounds, cap), progress);
    }

    interrupt(weapon: string, now: number): void {
        this.launchPending = false;
        this.equip(weapon, now);
    }

    cancelActions(): void {
        this.reload = null;
        this.pendingFire = null;
        this.queuedReload = null;
        this.launchPending = false;
        this.hand = 'holstered';
        this.outgoingLight = null;
        this.handStarted = this.handEnds = 0;
    }

    reset(weapon = ''): void {
        this.cancelActions();
        this.hand = isLight(weapon) ? 'drawn' : 'holstered';
        this.handWeapon = isFirearm(weapon) || weapon === 'KATANA' ? weapon : 'PISTOL';
        this.rounds = fullMagazines();
        this.lastHeavyShot = -Infinity;
    }

    snapshot(now: number): HandlingSnapshot {
        this.advance(now);
        return { rounds: { ...this.rounds }, hand: this.hand, handWeapon: this.handWeapon, outgoingLight: this.outgoingLight, handAge: Math.min(1, Math.max(0, now - this.handStarted)),
            handRemaining: Math.max(0, this.handEnds - now), reloadWeapon: this.reload?.weapon ?? null,
            reloadRemaining: this.reload ? Math.max(0, this.reload.ends - now) : 0,
            pendingFire: this.pendingFire, queuedReload: this.queuedReload, launchPending: this.launchPending,
            lastHeavyAge: now - this.lastHeavyShot > HEAVY_RECENT_SHOT_TIME ? null : Math.max(0, now - this.lastHeavyShot) };
    }

    restore(s: HandlingSnapshot, now: number): void {
        // A snapshot can confirm or deny an input. Only a local input can
        // schedule a launch; replaying a snapshot after launch must be harmless.
        this.launchPending &&= s.launchPending;
        this.queuedReload = s.queuedReload;
        const drawing = s.hand === 'drawn' && this.hand === 'drawing' && now < this.handEnds;
        if (!drawing) {
            this.hand = s.hand;
            this.handWeapon = s.handWeapon;
            this.outgoingLight = s.outgoingLight;
            this.handStarted = now - s.handAge;
            this.handEnds = now + s.handRemaining;
        }
        this.pendingFire = s.pendingFire;
        this.rounds = { ...s.rounds };
        this.lastHeavyShot = s.lastHeavyAge === null ? -Infinity : now - s.lastHeavyAge;
        this.reload = s.reloadWeapon ? { weapon: s.reloadWeapon, ends: now + s.reloadRemaining,
            started: now + s.reloadRemaining - FIREARM_MAGAZINES[s.reloadWeapon].reloadSeconds,
            startRounds: s.rounds[s.reloadWeapon] } : null;
    }
}
