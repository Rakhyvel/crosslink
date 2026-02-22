export class Vec2 {
    x: number
    y: number

    constructor(x: number, y: number) {
        this.x = x
        this.y = y
    }

    add(other: Vec2): Vec2 {
        return new Vec2(this.x + other.x, this.y + other.y)
    }

    sub(other: Vec2): Vec2 {
        return new Vec2(this.x - other.x, this.y - other.y)
    }

    mul(other: Vec2): Vec2 {
        return new Vec2(this.x * other.x, this.y * other.y)
    }

    scale(scalar: number): Vec2 {
        return new Vec2(this.x * scalar, this.y * scalar)
    }

    snap(grid: number): Vec2 {
        const snapX = Math.round(this.x / grid) * grid;
        const snapY = Math.round(this.y / grid) * grid;
        return new Vec2(snapX, snapY)
    }

    norm(): number {
        return Math.sqrt(this.x * this.x + this.y * this.y)
    }

    dist(other: Vec2): number {
        return this.sub(other).norm()
    }
}