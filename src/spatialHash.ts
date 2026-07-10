export class SpatialHash<T> {
    private readonly cellSize: number;
    private readonly cells = new Map<string, T[]>();
    // Reused across queries so values that span more than one cell are returned
    // once without repeatedly scanning the caller's output array.
    private readonly seen = new Set<T>();

    constructor(cellSize: number) {
        this.cellSize = cellSize;
    }

    clear(): void {
        this.cells.clear();
        this.seen.clear();
    }

    insert(x: number, z: number, radius: number, value: T): void {
        const minX = this.toCell(x - radius);
        const maxX = this.toCell(x + radius);
        const minZ = this.toCell(z - radius);
        const maxZ = this.toCell(z + radius);

        for (let cx = minX; cx <= maxX; cx++) {
            for (let cz = minZ; cz <= maxZ; cz++) {
                const key = this.key(cx, cz);
                let bucket = this.cells.get(key);
                if (!bucket) {
                    bucket = [];
                    this.cells.set(key, bucket);
                }
                bucket.push(value);
            }
        }
    }

    query(x: number, z: number, radius: number, out: T[] = []): T[] {
        out.length = 0;
        this.seen.clear();
        const minX = this.toCell(x - radius);
        const maxX = this.toCell(x + radius);
        const minZ = this.toCell(z - radius);
        const maxZ = this.toCell(z + radius);

        for (let cx = minX; cx <= maxX; cx++) {
            for (let cz = minZ; cz <= maxZ; cz++) {
                const bucket = this.cells.get(this.key(cx, cz));
                if (!bucket) continue;
                for (let i = 0; i < bucket.length; i++) {
                    const item = bucket[i];
                    if (!this.seen.has(item)) {
                        this.seen.add(item);
                        out.push(item);
                    }
                }
            }
        }

        return out;
    }

    /**
     * Returns values from the cells traversed by a 2D segment. This is a
     * broad-phase helper for ray-like gameplay queries; callers still perform
     * the exact 3D intersection test afterwards.
     */
    querySegment(startX: number, startZ: number, endX: number, endZ: number, out: T[] = []): T[] {
        out.length = 0;
        this.seen.clear();

        let cellX = this.toCell(startX);
        let cellZ = this.toCell(startZ);
        const endCellX = this.toCell(endX);
        const endCellZ = this.toCell(endZ);
        const deltaX = endX - startX;
        const deltaZ = endZ - startZ;
        const stepX = Math.sign(deltaX);
        const stepZ = Math.sign(deltaZ);

        const tDeltaX = stepX === 0 ? Infinity : this.cellSize / Math.abs(deltaX);
        const tDeltaZ = stepZ === 0 ? Infinity : this.cellSize / Math.abs(deltaZ);
        const nextBoundaryX = stepX > 0 ? (cellX + 1) * this.cellSize : cellX * this.cellSize;
        const nextBoundaryZ = stepZ > 0 ? (cellZ + 1) * this.cellSize : cellZ * this.cellSize;
        let tMaxX = stepX === 0 ? Infinity : (nextBoundaryX - startX) / deltaX;
        let tMaxZ = stepZ === 0 ? Infinity : (nextBoundaryZ - startZ) / deltaZ;

        while (true) {
            this.appendCell(cellX, cellZ, out);
            if (cellX === endCellX && cellZ === endCellZ) break;

            if (tMaxX < tMaxZ) {
                cellX += stepX;
                tMaxX += tDeltaX;
            } else if (tMaxZ < tMaxX) {
                cellZ += stepZ;
                tMaxZ += tDeltaZ;
            } else {
                // At an exact grid corner a swept object can overlap either
                // adjacent cell, not just the diagonal destination. Include
                // both broad-phase neighbors before advancing diagonally.
                const nextX = cellX + stepX;
                const nextZ = cellZ + stepZ;
                this.appendCell(nextX, cellZ, out);
                this.appendCell(cellX, nextZ, out);
                cellX = nextX;
                cellZ = nextZ;
                tMaxX += tDeltaX;
                tMaxZ += tDeltaZ;
            }
        }

        return out;
    }

    private appendCell(cellX: number, cellZ: number, out: T[]): void {
        const bucket = this.cells.get(this.key(cellX, cellZ));
        if (!bucket) return;

        for (let i = 0; i < bucket.length; i++) {
            const item = bucket[i];
            if (!this.seen.has(item)) {
                this.seen.add(item);
                out.push(item);
            }
        }
    }

    private toCell(value: number): number {
        return Math.floor(value / this.cellSize);
    }

    private key(x: number, z: number): string {
        return `${x},${z}`;
    }
}
