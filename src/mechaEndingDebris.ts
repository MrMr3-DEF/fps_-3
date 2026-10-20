import * as THREE from 'three';
import { SpatialHash } from './spatialHash.js';

export const ENDING_DEBRIS = { gravity: 36, step: 1 / 120, breakChance: .2, contacts: 8, chunksPerPillar: 4,
    restitution: .45, tangentialRetention: .8 } as const;
export interface EndingPillar {
    id: number; position: THREE.Vector3; size: THREE.Vector3; bounds: THREE.Box3; destroyedAt: number;
}
export interface DebrisSegment { at: number; position: THREE.Vector3; velocity: THREE.Vector3 }
export interface EndingStone {
    id: number; position: THREE.Vector3; size: THREE.Vector3; velocity: THREE.Vector3; spin: THREE.Vector3;
    birth: number; landing: number; sourcePillar?: number;
    segments?: DebrisSegment[]; stopAt?: number; grounded?: boolean;
}
export interface PillarContact {
    at: number; stoneId: number; pillarId: number; ordinal: number; shattered: boolean; point: THREE.Vector3;
}
export interface EndingDebrisPaths { secondary: EndingStone[]; contacts: PillarContact[]; bounces: number; shatters: number }
interface Body { stone: EndingStone; at: number; position: THREE.Vector3; velocity: THREE.Vector3; radius: number; contacts: number; done: boolean; excluded: Set<number> }
interface Contact { at: number; body: Body; pillar: EndingPillar | null; normal: THREE.Vector3 }
const G = ENDING_DEBRIS.gravity;
const EPS = 1e-7, SKIN = .005;

/** A hash per contact, rather than a shared RNG, makes playback independent of
 * render rate, quality settings, and how preparation batches yield. */
export function pillarImpactRoll(seed: number, stone: number, pillar: number, ordinal: number): number {
    let n = (seed ^ Math.imul(stone + 1, 0x9e3779b1) ^ Math.imul(pillar + 1, 0x85ebca6b) ^ Math.imul(ordinal + 1, 0xc2b2ae35)) >>> 0;
    n = Math.imul(n ^ n >>> 16, 0x7feb352d); n = Math.imul(n ^ n >>> 15, 0x846ca68b);
    return ((n ^ n >>> 16) >>> 0) / 4294967296;
}

/** Sweeps conservative spherical fragment bounds against an axis-aligned pillar.
 * A fragment starting inside is not a new impact; it must separate first. */
export function sweepPillar(start: THREE.Vector3, end: THREE.Vector3, bounds: THREE.Box3, radius: number): { fraction: number; normal: THREE.Vector3 } | null {
    let enter = -Infinity, exit = Infinity, axis = 0, sign = 0;
    const a = [start.x, start.y, start.z], b = [end.x, end.y, end.z];
    const lo = [bounds.min.x - radius, bounds.min.y - radius, bounds.min.z - radius];
    const hi = [bounds.max.x + radius, bounds.max.y + radius, bounds.max.z + radius];
    for (let i = 0; i < 3; i++) {
        const d = b[i] - a[i];
        if (Math.abs(d) < 1e-12) { if (a[i] < lo[i] || a[i] > hi[i]) return null; continue; }
        const t1 = (lo[i] - a[i]) / d, t2 = (hi[i] - a[i]) / d;
        const near = Math.min(t1, t2), far = Math.max(t1, t2);
        if (near > enter) { enter = near; axis = i; sign = d > 0 ? -1 : 1; }
        exit = Math.min(exit, far);
        if (enter > exit) return null;
    }
    if (enter < -EPS || enter > 1 || exit < 0) return null;
    const normal = new THREE.Vector3(); normal.setComponent(axis, sign);
    return { fraction: Math.max(0, enter), normal };
}
function advance(body: Body, at: number): void {
    const dt = Math.max(0, at - body.at);
    body.position.addScaledVector(body.velocity, dt); body.position.y -= G / 2 * dt * dt;
    body.velocity.y -= G * dt; body.at = at;
}
function segment(body: Body): void {
    body.stone.segments!.push({ at: body.at, position: body.position.clone(), velocity: body.velocity.clone() });
}
function bodyFor(stone: EndingStone): Body {
    delete stone.stopAt; delete stone.grounded;
    stone.segments = [{ at: stone.birth, position: stone.position.clone(), velocity: stone.velocity.clone() }];
    return { stone, at: stone.birth, position: stone.position.clone(), velocity: stone.velocity.clone(), radius: stone.size.length() / 2, contacts: 0, done: false, excluded: new Set() };
}
function compare(a: Contact, b: Contact): number { return a.at - b.at || a.body.stone.id - b.body.stone.id || (a.pillar?.id ?? -1) - (b.pillar?.id ?? -1); }

/** Bake once under black. A time-ordered contact queue within each fixed step
 * prevents a later collision from destroying a pillar before an earlier stone
 * reaches it. The scene subsequently samples analytic segments without physics. */
export async function prepareEndingDebris(stones: EndingStone[], pillars: EndingPillar[], duration: number, seed: number,
    checkpoint: () => Promise<void>): Promise<EndingDebrisPaths> {
    const result: EndingDebrisPaths = { secondary: [], contacts: [], bounces: 0, shatters: 0 };
    const index = new SpatialHash<EndingPillar>(32), candidates: EndingPillar[] = [];
    for (const pillar of pillars) { pillar.destroyedAt = Infinity; index.insert(pillar.position.x, pillar.position.z, Math.max(pillar.size.x, pillar.size.z) / 2, pillar); }
    const bodies = stones.map(bodyFor), end = new THREE.Vector3();
    let nextId = stones.reduce((n, stone) => Math.max(n, stone.id + 1), 0);
    const nextContact = (body: Body, until: number): Contact | null => {
        if (body.done || body.at >= until) return null;
        const dt = until - body.at;
        end.copy(body.position).addScaledVector(body.velocity, dt); end.y -= G / 2 * dt * dt;
        let first: Contact | null = null;
        const ground = (body.velocity.y + Math.sqrt(body.velocity.y ** 2 + 2 * G * Math.max(0, body.position.y - body.radius))) / G;
        const groundAt = body.position.y <= body.radius && body.velocity.y <= 0 ? body.at : body.at + ground;
        if (groundAt <= until) first = { at: groundAt, body, pillar: null, normal: new THREE.Vector3(0, 1, 0) };
        index.querySegment(body.position.x, body.position.z, end.x, end.z, candidates, body.radius);
        for (const pillar of candidates) {
            if (pillar.id === body.stone.sourcePillar || pillar.destroyedAt <= body.at) continue;
            if (body.excluded.has(pillar.id)) {
                const p = body.position, b = pillar.bounds, r = body.radius + SKIN / 2;
                if (p.x >= b.min.x - r && p.x <= b.max.x + r && p.y >= b.min.y - r && p.y <= b.max.y + r && p.z >= b.min.z - r && p.z <= b.max.z + r) continue;
                body.excluded.delete(pillar.id);
            }
            const hit = sweepPillar(body.position, end, pillar.bounds, body.radius);
            if (!hit) continue;
            const at = body.at + dt * hit.fraction;
            if (pillar.destroyedAt <= at) continue;
            const contact = { at, body, pillar, normal: hit.normal };
            if (!first || compare(contact, first) < 0) first = contact;
        }
        return first;
    };
    for (let tick = 0; tick * ENDING_DEBRIS.step < duration; tick++) {
        const until = Math.min(duration, (tick + 1) * ENDING_DEBRIS.step), queue: Contact[] = [];
        for (const body of bodies) { const hit = nextContact(body, until); if (hit) queue.push(hit); }
        queue.sort(compare);
        while (queue.length) {
            const hit = queue.shift()!, { body, pillar } = hit;
            if (pillar && pillar.destroyedAt <= hit.at) {
                const replacement = nextContact(body, until); if (replacement) { queue.push(replacement); queue.sort(compare); }
                continue;
            }
            advance(body, hit.at);
            if (!pillar) {
                body.position.y = body.radius; body.velocity.set(0, 0, 0); body.done = true;
                body.stone.stopAt = hit.at; body.stone.grounded = true; segment(body); continue;
            }
            const ordinal = body.contacts++, shattered = pillarImpactRoll(seed, body.stone.id, pillar.id, ordinal) < ENDING_DEBRIS.breakChance;
            result.contacts.push({ at: hit.at, stoneId: body.stone.id, pillarId: pillar.id, ordinal, shattered, point: body.position.clone() });
            body.excluded.add(pillar.id);
            if (shattered) {
                pillar.destroyedAt = hit.at; result.shatters++;
                const impulse = body.velocity.clone(); impulse.y = Math.max(0, impulse.y); impulse.normalize();
                for (let part = 0; part < ENDING_DEBRIS.chunksPerPillar; part++) {
                    const random = (n: number) => pillarImpactRoll(seed ^ 0x50494c4c, pillar.id, part, n);
                    const size = pillar.size.clone(); size.y /= ENDING_DEBRIS.chunksPerPillar;
                    const position = pillar.position.clone(); position.y = size.y * (part + .5);
                    const velocity = impulse.clone().multiplyScalar(20 + random(0) * 20);
                    velocity.add(new THREE.Vector3((random(1) - .5) * 22, 12 + random(2) * 22, (random(3) - .5) * 22));
                    const stone: EndingStone = { id: nextId++, position, size, velocity, sourcePillar: pillar.id, birth: hit.at, landing: Infinity,
                        spin: new THREE.Vector3(random(4) - .5, random(5) - .5, random(6) - .5).multiplyScalar(3) };
                    result.secondary.push(stone); const fragment = bodyFor(stone); bodies.push(fragment);
                    const contact = nextContact(fragment, until); if (contact) queue.push(contact);
                }
                body.velocity.multiplyScalar(.7);
            } else {
                result.bounces++;
                const normalSpeed = body.velocity.dot(hit.normal);
                body.velocity.multiplyScalar(ENDING_DEBRIS.tangentialRetention)
                    .addScaledVector(hit.normal, -(ENDING_DEBRIS.tangentialRetention + ENDING_DEBRIS.restitution) * normalSpeed);
                body.position.addScaledVector(hit.normal, SKIN);
            }
            if (body.contacts >= ENDING_DEBRIS.contacts) {
                body.velocity.set(0, 0, 0); body.done = true; body.stone.stopAt = hit.at;
            }
            segment(body);
            const next = nextContact(body, until); if (next) queue.push(next);
            queue.sort(compare);
        }
        for (const body of bodies) if (!body.done && body.at < until) advance(body, until);
        if (tick % 8 === 0) await checkpoint();
    }
    return result;
}

/** Binary search permits backwards seeks without restoring simulation state. */
export function sampleEndingStone(stone: EndingStone, age: number, out: THREE.Vector3): number {
    if (age < stone.birth) { out.copy(stone.position); return 0; }
    const stop = stone.stopAt ?? Infinity, time = Math.min(age, stop), segments = stone.segments!;
    let lo = 0, hi = segments.length - 1;
    while (lo < hi) { const mid = Math.ceil((lo + hi) / 2); if (segments[mid].at <= time) lo = mid; else hi = mid - 1; }
    const part = segments[lo], dt = Math.max(0, time - part.at);
    out.copy(part.position).addScaledVector(part.velocity, dt); if (time < stop) out.y -= G / 2 * dt * dt;
    return Math.max(0, time - stone.birth);
}
