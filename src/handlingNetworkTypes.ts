import { FIREARM_MAGAZINES, HEAVY_HANDOFF_TIME, HEAVY_RECENT_SHOT_TIME } from './config.js';
import { fields, isPacketRecord } from './networkProjection.js';
import type { FirearmName, WeaponName } from './networkTypes.js';

export type WeaponIntent = 'reload' | 'grapple' | 'release' | 'raise' | 'cancel';
export type HandPhase = 'holstered' | 'drawing' | 'drawn' | 'returning';
export type LightWeapon = 'PISTOL' | 'SHOTGUN';
export interface HandlingSnapshot {
    rounds: Record<FirearmName, number>;
    hand: HandPhase;
    handWeapon: WeaponName;
    outgoingLight: LightWeapon | null;
    handAge: number;
    handRemaining: number;
    reloadWeapon: FirearmName | null;
    reloadRemaining: number;
    queuedReload: FirearmName | null;
    launchPending: boolean;
    pendingFire: FirearmName | null;
    lastHeavyAge: number | null;
}
export interface HandlingCommand {
    type: 'handling_command'; action: WeaponIntent; weapon: WeaponName; lifeId: number; sequence: number;
    senderPeerId?: string;
}
export interface HandlingStatePacket {
    type: 'handling_state'; peerId: string; lifeId: number; revision: number;
    tetherActive: boolean; commandAck: number; shotAck: number; rejected?: boolean; handling: HandlingSnapshot; senderPeerId?: string;
}

const guns = Object.keys(FIREARM_MAGAZINES) as FirearmName[];
const elapsed = (v: unknown, limit: number) => typeof v === 'number' && Number.isFinite(v) && v >= 0 && v <= limit;
const gunOrNull = (v: unknown): v is FirearmName | null => v === null || typeof v === 'string' && Object.hasOwn(FIREARM_MAGAZINES, v);
export function isHandlingSnapshot(v: unknown): v is HandlingSnapshot {
    if (!isPacketRecord(v) || !isPacketRecord(v.rounds)) return false;
    const rounds = v.rounds;
    return guns.every(w => Number.isInteger(rounds[w]) && elapsed(rounds[w], FIREARM_MAGAZINES[w].capacity))
        && (v.hand === 'holstered' || v.hand === 'drawing' || v.hand === 'drawn' || v.hand === 'returning')
        && (v.handWeapon === 'KATANA' || v.handWeapon !== null && gunOrNull(v.handWeapon))
        && (v.outgoingLight === null || (v.hand === 'returning' &&
            (v.outgoingLight === 'PISTOL' || v.outgoingLight === 'SHOTGUN') &&
            (v.handWeapon === 'AR' || v.handWeapon === 'SNIPER' || v.handWeapon === 'MINIGUN')))
        && elapsed(v.handAge, 1) && elapsed(v.handRemaining, HEAVY_HANDOFF_TIME + 1e-6)
        && ((v.hand === 'drawing' || v.hand === 'returning') || v.handRemaining === 0)
        && gunOrNull(v.reloadWeapon) && (v.reloadWeapon === null ? v.reloadRemaining === 0 :
            v.hand === 'holstered' && elapsed(v.reloadRemaining, FIREARM_MAGAZINES[v.reloadWeapon].reloadSeconds + 1e-6))
        && typeof v.launchPending === 'boolean' && (!v.launchPending || v.hand === 'drawing' || v.hand === 'drawn')
        && gunOrNull(v.queuedReload) && (v.queuedReload === null ||
            v.hand === 'returning' && v.reloadWeapon === null && v.pendingFire === null)
        && (v.pendingFire === null || ((v.pendingFire === 'AR' || v.pendingFire === 'SNIPER' || v.pendingFire === 'MINIGUN')
            && v.reloadWeapon === null && (v.hand === 'holstered' || v.hand === 'returning')))
        && (v.lastHeavyAge === null || elapsed(v.lastHeavyAge, HEAVY_RECENT_SHOT_TIME + 1e-6));
}
export const handlingFields = { ...fields('hand','handWeapon','outgoingLight','handAge','handRemaining','reloadWeapon','reloadRemaining',
    'pendingFire','lastHeavyAge','queuedReload','launchPending'), rounds: fields(...guns) };
