import { MAP_HALF_SIZE, MECHA_HEIGHT, TOWN_HALF_SIZE, TOWN_WALL_THICKNESS } from './config.js';

export interface NavigationBox { x: number; z: number; halfW: number; halfD: number; bottom: number; top: number }
export interface NavigationPoint { x: number; z: number }
export interface MechaRoute { points: NavigationPoint[]; heading: number }

/** One reverse search per match serves every border spawn candidate. Cells
 * reserve the whole robot footprint; exact segment checks protect smoothing
 * without inflating hazards so far that real passages disappear from the grid. */
export class MechaNavigation {
    readonly cellSize = 4;
    readonly size: number;
    readonly limit: number;
    private readonly blocked: Uint8Array;
    private readonly next: Int32Array;
    private readonly goalHeading = new Map<number, number>();
    private readonly boxes: NavigationBox[];
    private readonly solidBoxes: NavigationBox[];
    private readonly radius: number;
    private searchCost?: Float64Array;
    private searchParent?: Int32Array;
    private searchSeen?: Uint8Array;
    private searchClosed?: Uint8Array;

    constructor(obstacles: readonly NavigationBox[], lava: readonly NavigationBox[], radius: number, punchReach: number,
        halfSize = MAP_HALF_SIZE, actorHeight = MECHA_HEIGHT) {
        this.limit = Math.floor((halfSize - radius - 4) / this.cellSize) * this.cellSize;
        this.size = Math.round(this.limit * 2 / this.cellSize) + 1;
        this.blocked = new Uint8Array(this.size * this.size);
        this.next = new Int32Array(this.blocked.length).fill(-1);
        this.radius = radius;
        this.boxes = [...obstacles, ...lava].filter(box => box.bottom < actorHeight && box.top > 0);
        this.solidBoxes = obstacles.filter(box => box.bottom < actorHeight && box.top > 0);
        const clearance = radius;
        for (const box of this.boxes) {
            const minX = Math.max(0, Math.ceil((box.x - box.halfW - clearance + this.limit) / this.cellSize));
            const maxX = Math.min(this.size - 1, Math.floor((box.x + box.halfW + clearance + this.limit) / this.cellSize));
            const minZ = Math.max(0, Math.ceil((box.z - box.halfD - clearance + this.limit) / this.cellSize));
            const maxZ = Math.min(this.size - 1, Math.floor((box.z + box.halfD + clearance + this.limit) / this.cellSize));
            for (let z = minZ; z <= maxZ; z++) for (let x = minX; x <= maxX; x++) {
                this.blocked[z * this.size + x] = 1;
            }
        }
        const wall = TOWN_HALF_SIZE + TOWN_WALL_THICKNESS / 2;
        // Navigation ends before the clearance envelope reaches the wall. The
        // final, checked approach is straight toward an intact wall section.
        const approach = Math.ceil((wall + clearance + 8) / this.cellSize) * this.cellSize;
        this.punchDistance = wall + punchReach;
        const queue = new Int32Array(this.blocked.length);
        let tail = 0;
        for (const offset of [-56, -40, 40, 56]) {
            for (const [x, z, yaw] of [[approach, offset, -Math.PI / 2], [-approach, offset, Math.PI / 2], [offset, approach, Math.PI], [offset, -approach, 0]]) {
                const index = this.index(x, z);
                if (index < 0 || this.blocked[index]) continue;
                const end = { x: Math.abs(Math.sin(yaw)) > 0.5 ? -Math.sin(yaw) * this.punchDistance : x,
                    z: Math.abs(Math.cos(yaw)) > 0.5 ? -Math.cos(yaw) * this.punchDistance : z };
                if (!this.approachClear({ x, z }, end)) continue;
                this.next[index] = index;
                this.goalHeading.set(index, yaw);
                queue[tail++] = index;
            }
        }
        let head = 0;
        while (head < tail) {
            const index = queue[head++];
            const x = index % this.size, z = Math.floor(index / this.size);
            for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) {
                if ((!dx && !dz) || x + dx < 0 || z + dz < 0 || x + dx >= this.size || z + dz >= this.size) continue;
                const neighbor = (z + dz) * this.size + x + dx;
                if (this.blocked[neighbor] || this.next[neighbor] !== -1) continue;
                if (dx && dz && (this.blocked[z * this.size + x + dx] || this.blocked[(z + dz) * this.size + x])) continue;
                this.next[neighbor] = index;
                queue[tail++] = neighbor;
            }
        }
    }

    private readonly punchDistance: number;
    private index(x: number, z: number): number {
        const ix = Math.round((x + this.limit) / this.cellSize), iz = Math.round((z + this.limit) / this.cellSize);
        return ix < 0 || iz < 0 || ix >= this.size || iz >= this.size ? -1 : iz * this.size + ix;
    }
    private point(index: number): NavigationPoint {
        return { x: index % this.size * this.cellSize - this.limit, z: Math.floor(index / this.size) * this.cellSize - this.limit };
    }
    // The last approach enters cells conservatively reserved for the wall, so
    // check the true footprint against actual bounds instead.
    private approachClear(start: NavigationPoint, end: NavigationPoint): boolean {
        for (let step = 0; step <= 32; step++) {
            const px = start.x + (end.x - start.x) * step / 32, pz = start.z + (end.z - start.z) * step / 32;
            if (this.boxes.some(box =>
                Math.abs(px - box.x) < box.halfW + this.radius && Math.abs(pz - box.z) < box.halfD + this.radius)) return false;
        }
        return true;
    }
    segmentClear(a: NavigationPoint, b: NavigationPoint, allowLava = false): boolean {
        if (Math.max(Math.abs(a.x), Math.abs(a.z), Math.abs(b.x), Math.abs(b.z)) > this.limit) return false;
        for (const box of allowLava ? this.solidBoxes : this.boxes) {
            let enter = 0, exit = 1;
            for (const axis of ['x', 'z'] as const) {
                const half = (axis === 'x' ? box.halfW : box.halfD) + this.radius;
                const min = box[axis] - half, max = box[axis] + half, delta = b[axis] - a[axis];
                if (Math.abs(delta) < 1e-9) { if (a[axis] < min || a[axis] > max) { enter = 2; break; } }
                else {
                    const start = (min - a[axis]) / delta, end = (max - a[axis]) / delta;
                    enter = Math.max(enter, Math.min(start, end)); exit = Math.min(exit, Math.max(start, end));
                }
            }
            if (enter <= exit) return false;
        }
        return true;
    }
    routeFrom(start: NavigationPoint, maxShortcutCells = Infinity, variationSeed?: number): MechaRoute | null {
        let index = this.index(start.x, start.z);
        if (index < 0 || this.next[index] < 0) return null;
        const raw = [this.point(index)];
        while (this.next[index] !== index) { index = this.next[index]; raw.push(this.point(index)); }
        const heading = this.goalHeading.get(index)!;
        return variationSeed === undefined ? this.shortestRoute(raw, heading, maxShortcutCells)
            : this.variedRoute(raw, heading, maxShortcutCells, variationSeed);
    }
    /** Shortest obstacle- and lava-clearing chain from a moving start to a goal.
     * Chases reuse the shared grid but cannot reuse the wall reverse search, so
     * a bounded A* keeps rerouting cheap enough to run while tracking a player. */
    routeTo(start: NavigationPoint, goal: NavigationPoint, maxShortcutCells = Infinity): NavigationPoint[] | null {
        if (this.segmentClear(start, goal)) return [{ x: goal.x, z: goal.z }];
        const from = this.probeCell(start, true), to = this.probeCell(goal, false);
        if (from < 0 || to < 0) return null;
        const raw = this.searchRoute(from, to);
        if (!raw) return null;
        // Anchor smoothing at the true start so every returned segment is clear
        // for the actual footprint, not only from the snapped grid cell.
        const points = this.smoothRoute([start, ...raw], maxShortcutCells).slice(1);
        if (!points.length) return null;
        const last = points[points.length - 1];
        if (this.segmentClear(last, goal)) points.push({ x: goal.x, z: goal.z });
        return points;
    }
    /** A footprint beside an obstacle edge can round into a reserved cell.
     * Probing nearby cells finds an unblocked grid anchor; the start must also
     * have a clear segment to that cell, while a player standing near cover or
     * in lava still attracts bots to the nearest reachable cell. */
    private probeCell(point: NavigationPoint, fromStart: boolean): number {
        for (const [dx, dz] of [[0, 0], [4, 0], [-4, 0], [0, 4], [0, -4], [4, 4], [4, -4], [-4, 4], [-4, -4]]) {
            const index = this.index(point.x + dx, point.z + dz);
            if (index < 0 || this.blocked[index]) continue;
            if (fromStart && !this.segmentClear(point, this.point(index))) continue;
            return index;
        }
        return -1;
    }
    private searchRoute(start: number, goal: number): NavigationPoint[] | null {
        const size = this.size, capacity = this.blocked.length;
        this.searchCost ??= new Float64Array(capacity);
        this.searchParent ??= new Int32Array(capacity);
        this.searchSeen ??= new Uint8Array(capacity);
        this.searchClosed ??= new Uint8Array(capacity);
        const cost = this.searchCost, parent = this.searchParent, seen = this.searchSeen, closed = this.searchClosed;
        const touched: number[] = [], heap: number[] = [];
        const goalX = goal % size, goalZ = Math.floor(goal / size);
        const estimate = (index: number) => {
            const dx = Math.abs(index % size - goalX), dz = Math.abs(Math.floor(index / size) - goalZ);
            return Math.max(dx, dz) + (Math.SQRT2 - 1) * Math.min(dx, dz);
        };
        const prio = (index: number) => cost[index] + estimate(index);
        const push = (index: number) => {
            heap.push(index);
            for (let child = heap.length - 1; child > 0;) {
                const up = (child - 1) >> 1;
                if (prio(heap[up]) <= prio(heap[child])) break;
                [heap[up], heap[child]] = [heap[child], heap[up]];
                child = up;
            }
        };
        const pop = (): number => {
            const first = heap[0], last = heap.pop()!;
            if (!heap.length) return first;
            heap[0] = last;
            for (let node = 0;;) {
                const left = node * 2 + 1, right = left + 1;
                let best = node;
                if (left < heap.length && prio(heap[left]) < prio(heap[best])) best = left;
                if (right < heap.length && prio(heap[right]) < prio(heap[best])) best = right;
                if (best === node) return first;
                [heap[node], heap[best]] = [heap[best], heap[node]];
                node = best;
            }
        };
        // The scratch grids stay allocated across chases; reset only the cells
        // this search touched so a blocked or bounded search leaves no state.
        touched.push(start);
        seen[start] = 1;
        cost[start] = 0;
        parent[start] = -1;
        push(start);
        let expanded = 0;
        try {
            while (heap.length) {
                const index = pop();
                if (closed[index]) continue;
                closed[index] = 1;
                if (index === goal) {
                    const raw: NavigationPoint[] = [];
                    for (let node = goal; node !== -1; node = parent[node]) raw.push(this.point(node));
                    return raw.reverse();
                }
                if (++expanded > 4096) return null;
                const x = index % size, z = Math.floor(index / size);
                for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) {
                    if ((!dx && !dz) || x + dx < 0 || z + dz < 0 || x + dx >= size || z + dz >= size) continue;
                    const neighbor = (z + dz) * size + x + dx;
                    if (this.blocked[neighbor]) continue;
                    if (dx && dz && (this.blocked[z * size + x + dx] || this.blocked[(z + dz) * size + x])) continue;
                    const next = cost[index] + (dx && dz ? Math.SQRT2 : 1);
                    if (seen[neighbor] && next >= cost[neighbor]) continue;
                    if (!seen[neighbor]) { seen[neighbor] = 1; touched.push(neighbor); }
                    cost[neighbor] = next;
                    parent[neighbor] = index;
                    push(neighbor);
                }
            }
            return null;
        } finally {
            for (const index of touched) {
                cost[index] = 0;
                parent[index] = -1;
                seen[index] = 0;
                closed[index] = 0;
            }
        }
    }
    private smoothRoute(raw: readonly NavigationPoint[], maxShortcutCells: number): NavigationPoint[] {
        const points = [raw[0]];
        let anchor = 0;
        while (anchor < raw.length - 1) {
            let end = anchor + 1;
            while (end + 1 < raw.length && end + 1 - anchor <= maxShortcutCells && this.segmentClear(raw[anchor], raw[end + 1])) end++;
            points.push(raw[end]);
            anchor = end;
        }
        return points;
    }
    borderSpawn(seed: number, available: (point: NavigationPoint) => boolean = () => true, maxShortcutCells = Infinity,
        variationSeed?: number): MechaRoute {
        // A separate seed stream never consumes procedural-world randomness.
        let random = seed >>> 0;
        const border: NavigationPoint[] = [];
        for (let i = 0; i < this.size; i++) {
            const offset = i * this.cellSize - this.limit;
            border.push({ x: -this.limit, z: offset }, { x: this.limit, z: offset }, { x: offset, z: -this.limit }, { x: offset, z: this.limit });
        }
        for (let i = border.length - 1; i > 0; i--) {
            random = (Math.imul(random, 1664525) + 1013904223) >>> 0;
            const j = random % (i + 1);
            [border[i], border[j]] = [border[j], border[i]];
        }
        for (const point of border) {
            if (!available(point)) continue;
            const route = this.routeFrom(point, maxShortcutCells, variationSeed);
            if (route) return route;
        }
        throw new Error('No reachable border spawn for Forgotten Mecha');
    }
    private shortestRoute(raw: NavigationPoint[], heading: number, maxShortcutCells: number): MechaRoute {
        const points = this.smoothRoute(raw, maxShortcutCells);
        const goal = points[points.length - 1];
        points.push({ x: Math.abs(Math.sin(heading)) > 0.5 ? -Math.sin(heading) * this.punchDistance : goal.x,
            z: Math.abs(Math.cos(heading)) > 0.5 ? -Math.cos(heading) * this.punchDistance : goal.z });
        return { points, heading };
    }
    private variedRoute(raw: NavigationPoint[], heading: number, maxShortcutCells: number, variationSeed: number): MechaRoute {
        const random = this.randomFrom(variationSeed);
        const along = [0];
        for (let i = 1; i < raw.length; i++) along.push(along[i - 1] + Math.hypot(raw[i].x - raw[i - 1].x, raw[i].z - raw[i - 1].z));
        const length = along.at(-1)!;
        const side = random() < .5 ? -1 : 1;
        // Long approaches can afford a wide flank; short ones keep their detour
        // proportional so they still rejoin the wall promptly.
        const bend = (20 + random() * 55) * Math.min(1, Math.max(.25, length / 500));
        const phase = random() * Math.PI * 2, frequency = 2.5 + random() * 1.5;
        const anchors: { index: number; point: NavigationPoint }[] = [];
        let nextAnchor = 80 + random() * 60;
        for (let i = 1; i < raw.length - 1; i++) {
            if (along[i] < nextAnchor || length - along[i] < 90) continue;
            const tangentX = raw[i + 1].x - raw[i - 1].x, tangentZ = raw[i + 1].z - raw[i - 1].z;
            const tangent = Math.hypot(tangentX, tangentZ);
            if (tangent < 1e-6) continue;
            const u = along[i] / length, arc = Math.sin(Math.PI * u), wave = Math.sin(u * Math.PI * frequency + phase);
            const lateral = bend * (side * arc * (.7 + .3 * wave) + .22 * wave);
            const offsetX = -tangentZ / tangent, offsetZ = tangentX / tangent;
            for (const scale of [1, .65, .35]) {
                const point = { x: raw[i].x + offsetX * lateral * scale, z: raw[i].z + offsetZ * lateral * scale };
                const index = this.index(point.x, point.z);
                if (index < 0 || this.blocked[index]) continue;
                // Keep both ends of the anchor reachable from its base cell so
                // stitching can always fall back to the BFS chain.
                if (!this.segmentClear(raw[i], point) || !this.segmentClear(point, raw[i + 1])) continue;
                anchors.push({ index: i, point });
                break;
            }
            nextAnchor = along[i] + 80 + random() * 60;
        }
        const points = [raw[0]];
        let cursor = raw[0], cursorBase = 0;
        for (const anchor of anchors) {
            const link = this.baseLink(cursor, cursorBase, anchor.point, anchor.index, raw, maxShortcutCells);
            if (!link) continue;
            points.push(...link);
            cursor = anchor.point;
            cursorBase = anchor.index;
        }
        const goal = raw.at(-1)!;
        const baseEnd = { x: Math.abs(Math.sin(heading)) > 0.5 ? -Math.sin(heading) * this.punchDistance : goal.x,
            z: Math.abs(Math.cos(heading)) > 0.5 ? -Math.cos(heading) * this.punchDistance : goal.z };
        // Spread attackers along the wall face. A short probe toward the wall
        // rejects gateways and other openings where there is nothing to punch.
        const spread = (random() < .5 ? -1 : 1) * (2 + random() * 10);
        const tangent = { x: Math.cos(heading), z: -Math.sin(heading) };
        let link: NavigationPoint[] | null = null;
        for (const scale of [1, .5, 0]) {
            const end = { x: baseEnd.x + tangent.x * spread * scale, z: baseEnd.z + tangent.z * spread * scale };
            if (!this.approachClear(goal, end) || !this.wallAhead(end, heading)) continue;
            link = this.baseLink(cursor, cursorBase, end, raw.length - 1, raw, maxShortcutCells);
            if (link) break;
        }
        if (!link) return this.shortestRoute(raw, heading, maxShortcutCells);
        points.push(...link);
        for (let i = 1; i < points.length; i++) {
            if (!this.segmentClear(points[i - 1], points[i])) return this.shortestRoute(raw, heading, maxShortcutCells);
        }
        return { points, heading };
    }
    private baseLink(start: NavigationPoint, startBase: number, target: NavigationPoint, targetBase: number,
        raw: readonly NavigationPoint[], maxShortcutCells: number): NavigationPoint[] | null {
        if (this.segmentClear(start, target)) return [target];
        const points: NavigationPoint[] = [];
        let cursor = start, base = startBase;
        while (base < targetBase) {
            const limit = Number.isFinite(maxShortcutCells) ? Math.min(targetBase, base + Math.max(1, maxShortcutCells)) : targetBase;
            let chosen = -1;
            for (let i = limit; i > base; i--) {
                if (this.segmentClear(cursor, raw[i])) { chosen = i; break; }
            }
            if (chosen < 0) return null;
            points.push(raw[chosen]);
            cursor = raw[chosen];
            base = chosen;
        }
        if (!this.segmentClear(cursor, target)) return null;
        points.push(target);
        return points;
    }
    private wallAhead(point: NavigationPoint, heading: number): boolean {
        // The standoff sits just outside the footprint envelope, so any probe
        // into an intact wall overlaps it while a gateway stays clear.
        const probe = { x: point.x + Math.sin(heading) * (this.radius + 1), z: point.z + Math.cos(heading) * (this.radius + 1) };
        return !this.segmentClear(point, probe);
    }
    private randomFrom(seed: number): () => number {
        let state = seed >>> 0;
        return () => {
            state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
            return state / 0x100000000;
        };
    }
}
