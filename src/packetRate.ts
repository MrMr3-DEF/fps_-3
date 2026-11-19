export class PacketRate {
    private credits: number;
    private updatedAt = -Infinity;
    private readonly perSecond: number;
    private readonly burst: number;

    constructor(perSecond: number, burst: number) {
        this.perSecond = perSecond;
        this.burst = burst;
        this.credits = burst;
    }

    accept(now: number): boolean {
        this.credits = Math.min(this.burst, this.credits + Math.max(0, now - this.updatedAt) / 1000 * this.perSecond);
        this.updatedAt = now;
        if (this.credits < 1) return false;
        this.credits--;
        return true;
    }
}
