import { Vec2 } from './vec.ts'

export interface Component {
    pos: Vec2
    size: Vec2

    inputs: Port[]
    outputs: Port[]

    update(): void
    draw(ctx: CanvasRenderingContext2D): void
}

export enum PortKind {
    Input,
    Output
}

export class Port {
    constructor(
        // holy crap this syntax is kinda nice!
        public id: string,
        public offset: Vec2,
        public parent: Component,
        public kind: PortKind
    ) { }

    private _value: Signal = 0
    get value(): Signal {
        return this._value
    }
    set value(v: Signal) {
        this._value = v
    }
    wires: Wire[] = []

    getWorldPos(): Vec2 {
        return this.parent.pos.add(this.offset)
    }
}

export class Wire {
    constructor(public from: Port, public to: Port) { }
}

export type Signal = 0 | 1

export abstract class Gate implements Component {
    pos: Vec2
    size: Vec2
    inputs: Port[] = []
    outputs: Port[] = []

    constructor(pos: Vec2, inputNames: string[], outputNames: string[], width = 60) {
        this.pos = pos

        // Determine height based on max of input/output count
        const n = Math.max(inputNames.length, outputNames.length)
        const height = Math.max(40, n * 30)
        this.size = new Vec2(width, height)

        // Assign ports
        this.inputs = inputNames.map((id, i) =>
            new Port(id, new Vec2(0, (i + 1) * this.size.y / (inputNames.length + 1)), this, PortKind.Input)
        )
        this.outputs = outputNames.map((id, i) =>
            new Port(id, new Vec2(this.size.x, (i + 1) * this.size.y / (outputNames.length + 1)), this, PortKind.Output)
        )
    }

    draw(ctx: CanvasRenderingContext2D) {
        // Draw box
        ctx.fillStyle = "#fcfbf8";
        ctx.strokeStyle = "#4b4b4b";
        ctx.lineWidth = 1.25;

        ctx.beginPath();
        ctx.roundRect(this.pos.x, this.pos.y, this.size.x, this.size.y, 6);
        ctx.fill();
        ctx.stroke();

        // Draw label
        ctx.fillStyle = "#222";
        ctx.font = "12px system-ui, sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(this.getLabel(), this.pos.x + this.size.x / 2, this.pos.y + this.size.y / 2);

        // Draw ports
        const r = 4;
        for (const p of [...this.inputs, ...this.outputs]) {
            const world = p.getWorldPos();
            ctx.beginPath();
            ctx.arc(world.x, world.y, r, 0, Math.PI * 2);
            if (p.wires.length > 0) {
                ctx.fillStyle = p.value === 1 ? "#4caf50" : "#555";
                ctx.fill();
            }
            ctx.strokeStyle = "#555";
            // TODO: If port is hovered:
            // ctx.strokeStyle = "#4aa3ff";
            // ctx.lineWidth = 2;
            ctx.stroke();
        }
    }

    abstract update(): void
    abstract getLabel(): string
}

export interface MouseInteractable {
    contains(mouse: Vec2): boolean
    onMouseDown(): void
    onMouseUp(): void
}

export class NotGate extends Gate {
    constructor(pos: Vec2) {
        super(pos, ["in"], ["out"])
    }

    update() {
        this.outputs[0].value = this.inputs[0].value === 0 ? 1 : 0
    }

    getLabel(): string {
        return 'NOT'
    }
}

export class AndGate extends Gate {
    constructor(pos: Vec2) {
        super(pos, ["x", "y"], ["out"])
    }

    update() {
        const x = this.inputs[0].value
        const y = this.inputs[1].value
        this.outputs[0].value = (x && y) as Signal
    }

    getLabel(): string {
        return 'AND'
    }
}

export class OrGate extends Gate {
    constructor(pos: Vec2) {
        super(pos, ["x", "y"], ["out"])
    }

    update() {
        const x = this.inputs[0].value
        const y = this.inputs[1].value
        this.outputs[0].value = (x || y) as Signal
    }

    getLabel(): string {
        return 'OR'
    }
}

export class XorGate extends Gate {
    constructor(pos: Vec2) {
        super(pos, ["x", "y"], ["out"])
    }

    update() {
        const x = this.inputs[0].value
        const y = this.inputs[1].value
        this.outputs[0].value = (x ^ y) as Signal
    }

    getLabel(): string {
        return 'XOR'
    }
}

export class NandGate extends Gate {
    constructor(pos: Vec2) {
        super(pos, ["x", "y"], ["out"])
    }

    update() {
        const x = this.inputs[0].value
        const y = this.inputs[1].value
        const and = x && y ? 1 : 0
        this.outputs[0].value = and ? 0 : 1
    }

    getLabel(): string {
        return 'NAND'
    }
}

export class NorGate extends Gate {
    constructor(pos: Vec2) {
        super(pos, ["x", "y"], ["out"])
    }

    update() {
        const x = this.inputs[0].value
        const y = this.inputs[1].value
        const or = x || y ? 1 : 0
        this.outputs[0].value = or ? 0 : 1
    }

    getLabel(): string {
        return 'NOR'
    }
}

export class XnorGate extends Gate {
    constructor(pos: Vec2) {
        super(pos, ["x", "y"], ["out"])
    }

    update() {
        const x = this.inputs[0].value
        const y = this.inputs[1].value
        const xor = x ^ y ? 1 : 0
        this.outputs[0].value = xor ? 0 : 1
    }

    getLabel(): string {
        return 'XNOR'
    }
}

export class Button extends Gate implements MouseInteractable {
    pressed = false

    constructor(pos: Vec2) {
        super(pos, [], ["out"])
    }

    update() {
        this.outputs[0].value = this.pressed ? 1 : 0
    }

    draw(ctx: CanvasRenderingContext2D) {
        super.draw(ctx)

        ctx.fillStyle = this.pressed ? "#2f28" : "#aaa";
        ctx.strokeStyle = "#757575ff";
        ctx.fillRect(this.pos.x + 6, this.pos.y + 6, this.size.x - 12, this.size.y - 12);
        ctx.strokeRect(this.pos.x + 6, this.pos.y + 6, this.size.x - 12, this.size.y - 12);

        // Draw label
        ctx.fillStyle = "#222";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(this.getLabel(), this.pos.x + this.size.x / 2, this.pos.y + this.size.y / 2);
    }

    getLabel(): string {
        return 'BTN'
    }

    contains(mouse: Vec2) {
        return mouse.x >= this.pos.x + 6 && mouse.x <= this.pos.x + this.size.x - 12 &&
            mouse.y >= this.pos.y + 6 && mouse.y <= this.pos.y + this.size.y - 12
    }

    onMouseDown() {
        this.pressed = true
    }

    onMouseUp() {
        this.pressed = false
    }
}

export class Switch extends Gate implements MouseInteractable {
    pressed = false

    constructor(pos: Vec2) {
        super(pos, [], ["out"])
    }

    update() {
        this.outputs[0].value = this.pressed ? 1 : 0
    }

    draw(ctx: CanvasRenderingContext2D) {
        super.draw(ctx)

        ctx.fillStyle = this.pressed ? "#2f28" : "#aaa";
        ctx.strokeStyle = "#757575ff";
        ctx.fillRect(this.pos.x + 6, this.pos.y + 6, this.size.x - 12, this.size.y - 12);
        ctx.strokeRect(this.pos.x + 6, this.pos.y + 6, this.size.x - 12, this.size.y - 12);

        // Draw label
        ctx.fillStyle = "#222";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(this.getLabel(), this.pos.x + this.size.x / 2, this.pos.y + this.size.y / 2);
    }

    getLabel(): string {
        return 'SWITCH'
    }

    contains(mouse: Vec2) {
        return mouse.x >= this.pos.x + 6 && mouse.x <= this.pos.x + this.size.x - 12 &&
            mouse.y >= this.pos.y + 6 && mouse.y <= this.pos.y + this.size.y - 12
    }

    onMouseDown() {
        this.pressed = !this.pressed
    }

    onMouseUp() {
    }
}

export class Clock extends Gate {
    private counter = 4
    state = 0

    constructor(pos: Vec2) {
        super(pos, [], ["out"])
    }

    update() {
        const period = 4
        this.counter++

        if (this.counter >= period) {
            this.counter = 0
            this.state = this.state ? 0 : 1
        }

        this.outputs[0].value = this.state as Signal
    }

    getLabel(): string {
        return 'CLK'
    }
}

export class DFlipFlop extends Gate {
    private q = 0
    private prevClock = 0

    constructor(pos: Vec2) {
        super(pos, ["d", "clk"], ["Q", "!Q"])
    }

    update() {
        const d = this.inputs[0].value
        const clk = this.inputs[1].value

        // Detect rising edge
        if (clk === 1 && this.prevClock === 0) {
            this.q = d
        }

        this.prevClock = clk

        this.outputs[0].value = this.q as Signal
        this.outputs[1].value = this.q ? 0 : 1
    }

    getLabel(): string {
        return 'DFF'
    }
}

export class TFlipFlop extends Gate {
    private q = 0
    private prevClock = 0

    constructor(pos: Vec2) {
        super(pos, ["t", "clk"], ["Q"])
    }

    update() {
        const t = this.inputs[0].value
        const clk = this.inputs[1].value

        if (clk === 1 && this.prevClock === 0) {
            if (t === 1) {
                this.q = this.q ? 0 : 1
            }
        }

        this.prevClock = clk

        this.outputs[0].value = this.q as Signal
    }

    getLabel(): string {
        return 'TFF'
    }
}

export class Led extends Gate {

    constructor(pos: Vec2) {
        super(pos, ["in"], [])
    }

    update() {
    }

    draw(ctx: CanvasRenderingContext2D) {
        super.draw(ctx)

        ctx.fillStyle = (this.inputs[0].value === 1) ? "#f228" : "#aaa";
        ctx.strokeStyle = "#757575ff";
        ctx.fillRect(this.pos.x + 6, this.pos.y + 6, this.size.x - 12, this.size.y - 12);
        ctx.strokeRect(this.pos.x + 6, this.pos.y + 6, this.size.x - 12, this.size.y - 12);

        // Draw label
        ctx.fillStyle = "#222";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(this.getLabel(), this.pos.x + this.size.x / 2, this.pos.y + this.size.y / 2);
    }

    getLabel(): string {
        return 'LED'
    }
}