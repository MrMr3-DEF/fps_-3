export class SpatialHash<T> {
    private readonly cellSize: number;
    private readonly cells = new Map<string, T[]>();

    constructor(cellSize: number) {
        this.cellSize = cellSize;
    }

    clear(): void {
        this.cells.clear();
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
                    if (!out.includes(item)) {
                        out.push(item);
                    }
                }
            }
        }

        return out;
    }

    private toCell(value: number): number {
        return Math.floor(value / this.cellSize);
    }

    private key(x: number, z: number): string {
        return `${x},${z}`;
    }
}
