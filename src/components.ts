import { Board, type Serialized } from './board.ts'
import { Vec2 } from './vec.ts'

export interface Component {
    pos: Vec2
    size: Vec2

    inputs: Port[]
    outputs: Port[]

    dragOffset: Vec2 | null
    selected: boolean
    dropped: boolean
    movable: boolean

    id: string
    name: string

    clone(): Component
    dragPos(): Vec2
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
        public kind: PortKind,
        public index: number
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
        return this.parent.dragPos().add(this.offset)
    }
}

export class Wire {
    constructor(public from: Port, public to: Port) { }
}

export type Signal = 0 | 1

export function createComponentFromType(type: string, pos: Vec2, name: string | null = null, custom: Map<string, Serialized> | null = null) {
    switch (type) {
        case "InputPin": return new InputPin(pos)
        case "OutputPin": return new OutputPin(pos)
        case "NotGate": return new NotGate(pos)
        case "AndGate": return new AndGate(pos)
        case "OrGate": return new OrGate(pos)
        case "XorGate": return new XorGate(pos)
        case "NandGate": return new NandGate(pos)
        case "NorGate": return new NorGate(pos)
        case "XnorGate": return new XnorGate(pos)
        case "Clock": return new Clock(pos)
        case "SRLatch": return new SRLatch(pos)
        case "DFlipFlop": return new DFlipFlop(pos)
        case "TFlipFlop": return new TFlipFlop(pos)
        case "CustomComponent":
            if (custom) {
                const data = custom.get(name!)!
                return new CustomComponent(pos, name!, data, custom)
            }
            return null
        default: return null
    }
}

export abstract class Gate implements Component {
    pos: Vec2
    size: Vec2
    inputs: Port[] = []
    outputs: Port[] = []
    dragOffset: Vec2 | null = null
    dropped: boolean = false
    selected: boolean = false
    id: string
    name: string = ""
    movable: boolean = true

    constructor(pos: Vec2, id: string, inputNames: string[], outputNames: string[], width = 40) {
        this.pos = pos
        this.id = id

        // Determine height based on max of input/output count
        const n = Math.max(inputNames.length, outputNames.length)
        const height = Math.max(20, 20 + (n - 1) * 20)
        this.size = new Vec2(width, height)

        // Assign ports
        this.inputs = inputNames.map((id, i) =>
            new Port(id, new Vec2(0, 10 + 20 * i), this, PortKind.Input, i)
        )
        this.outputs = outputNames.map((id, i) =>
            new Port(
                id,
                new Vec2(this.size.x, 10 + 20 * i),
                this,
                PortKind.Output,
                i
            )
        )
    }

    dragPos(): Vec2 {
        let retval = this.pos
        if (this.dragOffset) {
            retval = retval.add(this.dragOffset)
        }
        return retval
    }

    draw(ctx: CanvasRenderingContext2D) {
        const opacity = this.dragOffset ? "88" : "ff"
        const realPos = this.dragPos()

        this.drawSelection(ctx)

        // Draw box
        ctx.fillStyle = "#e9e9e9" + opacity;
        ctx.strokeStyle = "#4b4b4b" + opacity;
        ctx.lineWidth = 0.5;

        ctx.beginPath();
        ctx.fillRect(realPos.x, realPos.y, this.size.x, this.size.y);
        ctx.strokeRect(realPos.x, realPos.y, this.size.x, this.size.y);

        // Draw label
        ctx.fillStyle = "#818181" + opacity;
        ctx.font = "10px caveat";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(this.getLabel(), realPos.x + this.size.x / 2, realPos.y + this.size.y / 2);

        this.drawPorts(ctx)
    }

    drawSelection(ctx: CanvasRenderingContext2D) {
        const opacity = this.dragOffset ? "88" : "ff"
        const realPos = this.dragPos()

        if (this.selected) {
            ctx.fillStyle = "#4aa3ff" + opacity
            ctx.beginPath();
            ctx.fillRect(realPos.x - 2, realPos.y - 2, this.size.x + 4, this.size.y + 4);
            ctx.fill();
        }
    }

    drawPorts(ctx: CanvasRenderingContext2D) {
        const opacity = this.dragOffset ? "88" : "ff"
        const size = 3;
        for (const p of [...this.inputs, ...this.outputs]) {
            const world = p.getWorldPos();
            ctx.beginPath();
            ctx.arc(world.x, world.y, size, 0, Math.PI * 2)

            ctx.fillStyle = "#ebebeb"
            ctx.strokeStyle = "#555"
            if (p.wires.length > 0) {
                ctx.fillStyle = p.value === 1 ? ("#4caf50" + opacity) : ("#555555" + opacity);
                ctx.strokeStyle = p.value === 1 ? ("#4caf50" + opacity) : ("#555555" + opacity);
            }
            ctx.fill();
            ctx.stroke();
        }
    }

    abstract clone(): Component
    abstract update(): void
    abstract getLabel(): string
}

export interface MouseInteractable {
    contains(mouse: Vec2): boolean
    onMouseDown(): void
}

export class NotGate extends Gate {
    constructor(pos: Vec2) {
        super(pos, "NotGate", ["in"], ["out"])
    }

    clone() {
        return new NotGate(this.pos)
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
        super(pos, "AndGate", ["x", "y"], ["out"])
    }

    clone() {
        return new AndGate(this.pos)
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
        super(pos, "OrGate", ["x", "y"], ["out"])
    }

    clone() {
        return new OrGate(this.pos)
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
        super(pos, "XorGate", ["x", "y"], ["out"])
    }

    clone() {
        return new XorGate(this.pos)
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
        super(pos, "NandGate", ["x", "y"], ["out"])
    }

    clone() {
        return new NandGate(this.pos)
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
        super(pos, "NorGate", ["x", "y"], ["out"])
    }

    clone() {
        return new NorGate(this.pos)
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
        super(pos, "XnorGate", ["x", "y"], ["out"])
    }

    clone() {
        return new XnorGate(this.pos)
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

export class Clock extends Gate {
    private counter = 4
    state = 0

    constructor(pos: Vec2) {
        super(pos, "Clock", [], ["out"])
    }

    clone() {
        return new Clock(this.pos)
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

export class SRLatch extends Gate {
    private q = 0

    constructor(pos: Vec2) {
        super(pos, "SRLatch", ["r", "s"], ["Q", "!Q"])
    }

    clone() {
        return new SRLatch(this.pos)
    }

    update() {
        const r = this.inputs[0].value
        const s = this.inputs[1].value

        // Edge case, if both are on then q and !q aren't actually opposites
        if (r === 1 && s === 1) {
            this.outputs[0].value = 0
            this.outputs[1].value = 0
            return
        }

        if (r === 1) {
            this.q = 0
        } else if (s === 1) {
            this.q = 1
        }

        this.outputs[0].value = this.q as Signal
        this.outputs[1].value = this.q ? 0 : 1
    }

    getLabel(): string {
        return 'SRL'
    }
}

export class DFlipFlop extends Gate {
    private q = 0
    private prevClock = 0

    constructor(pos: Vec2) {
        super(pos, "DFlipFlop", ["d", "clk"], ["Q", "!Q"])
    }

    clone() {
        return new DFlipFlop(this.pos)
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
        super(pos, "TFlipFlop", ["t", "clk"], ["Q"])
    }

    clone() {
        return new TFlipFlop(this.pos)
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

export class InputPin extends Gate implements MouseInteractable {
    pressed = false

    constructor(pos: Vec2) {
        super(pos, "InputPin", [], ["out"], 20)
        this.size = new Vec2(20, 20)
    }

    clone() {
        return new InputPin(this.pos)
    }

    setValue(value: boolean) {
        this.pressed = value
    }

    update() {
        this.outputs[0].value = this.pressed ? 1 : 0
    }

    draw(ctx: CanvasRenderingContext2D) {
        super.drawSelection(ctx)

        ctx.fillStyle = this.pressed ? "#2f28" : "#aaa";
        ctx.strokeStyle = "#757575ff";
        ctx.lineWidth = 0.5;
        ctx.strokeRect(this.dragPos().x, this.dragPos().y, this.size.x, this.size.y);

        ctx.beginPath();
        ctx.arc(this.dragPos().x + this.size.x / 2, this.dragPos().y + this.size.y / 2, this.size.x / 2.9, 0, Math.PI * 2)

        ctx.strokeStyle = "#555"
        ctx.fill();
        ctx.stroke();

        super.drawPorts(ctx)
    }

    getLabel(): string {
        return 'IN'
    }

    contains(mouse: Vec2) {
        return mouse.x >= this.pos.x && mouse.x < this.pos.x + this.size.x &&
            mouse.y >= this.pos.y && mouse.y < this.pos.y + this.size.y
    }

    onMouseDown() {
        this.pressed = !this.pressed
    }
}

export class OutputPin extends Gate {
    constructor(pos: Vec2) {
        super(pos, "OutputPin", ["in"], [], 20)
        this.size = new Vec2(20, 20)
    }

    clone() {
        return new OutputPin(this.pos)
    }

    update() { }

    draw(ctx: CanvasRenderingContext2D) {
        super.drawSelection(ctx)

        ctx.fillStyle = (this.inputs[0].value === 1) ? "#2f28" : "#aaa";
        ctx.strokeStyle = "#757575ff";
        ctx.lineWidth = 0.5;
        ctx.beginPath();
        ctx.arc(this.dragPos().x + this.size.x / 2, this.dragPos().y + this.size.y / 2, this.size.x / 2.9, 0, Math.PI * 2)
        ctx.stroke();

        ctx.beginPath();
        ctx.arc(this.dragPos().x + this.size.x / 2, this.dragPos().y + this.size.y / 2, this.size.x / 2.9, 0, Math.PI * 2)

        ctx.strokeStyle = "#555"
        ctx.fill();
        ctx.stroke();

        super.drawPorts(ctx)
    }

    getLabel(): string {
        return 'OUT'
    }
}

export class CustomComponent extends Gate {
    board: Board

    constructor(pos: Vec2, name: string, private data: Serialized, private custom: Map<string, Serialized>) {
        const inputs = data.components.filter(c => c.type === "InputPin")
        const outputs = data.components.filter(c => c.type === "OutputPin")

        super(pos, "CustomComponent", inputs.map((_, i) => "in" + i), outputs.map((_, i) => "out" + i))
        this.name = name
        this.board = Board.fromSerialized(data, name, custom)
    }

    clone() {
        return new CustomComponent(this.pos, this.name, this.data, this.custom)
    }

    update() {
        const inputComponents = this.board.getInputPins()
        const outputComponents = this.board.getOutputPins()

        // Set board input pins
        this.inputs.forEach((input, i) => {
            inputComponents[i].setValue(input.value === 1)
        })

        this.board.step()

        console.log(this.board)

        // Get output pins
        for (let i = 0; i < outputComponents.length; i += 1) {
            this.outputs[i].value = outputComponents[i].inputs[0].value
        }
    }

    getLabel(): string {
        return this.name
    }
}