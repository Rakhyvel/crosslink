import { AndGate, Button, Led, NotGate, OrGate, Port, XorGate, PortKind, Wire, Switch, type Component, NandGate, NorGate, XnorGate, Clock, DFlipFlop, TFlipFlop, type MouseInteractable } from './components.ts'
import { Vec2 } from './vec.ts'

interface DraggingComponent {
    fromPos: Vec2
    toPos: Vec2
}

interface DraggingWire {
    from: Port
    toPos: Vec2
    originalWire?: Wire
}

interface Pan {
    fromPos: Vec2
    toPos: Vec2
}

interface Selection {
    start: Vec2
    end: Vec2
}

type ClipboardData = {
    components: {
        id: string
        type: string
        position: { x: number, y: number }
    }[]
    wires: {
        fromComponentId: string
        fromPortIndex: number
        toComponentId: string
        toPortIndex: number
    }[]
}

export class Sim {
    components: Component[] = []
    wires: Wire[] = []

    draggingComponent: DraggingComponent | null = null
    componentDragFrom: Vec2 | null = null
    draggingWire: DraggingWire | null = null
    dragOffset: Pan | null = null
    selection: Selection | null = null

    cameraPos: Vec2 = new Vec2(0, 0)
    cameraZoom: number = 1.5

    canvas: HTMLCanvasElement
    ctx: CanvasRenderingContext2D

    tickMs: number
    private lastTick = 0

    worldPos: Vec2 = new Vec2(0, 0)
    mouseDown: boolean = false
    mouseDownWorldPos: Vec2 = new Vec2(0, 0)

    private _enabled: boolean = false

    pitch: number = 20
    size: Vec2 = new Vec2(32, 26).scale(this.pitch)

    selected: Component[] = []

    constructor(canvas: HTMLCanvasElement, tickMs: number) {
        this.canvas = canvas
        this.ctx = canvas.getContext("2d")!
        this.tickMs = tickMs

        canvas.addEventListener("wheel", e => {
            const zoomFactor = 1.1
            this.cameraZoom *= e.deltaY < 0 ? zoomFactor : 1 / zoomFactor;
        })
    }

    worldFromScreen(screen: Vec2): Vec2 {
        const worldX = (screen.x - this.canvas.width / 2) / this.cameraZoom + this.size.x / 2 + this.cameraPos.x
        const worldY = (screen.y - this.canvas.height / 2) / this.cameraZoom + this.size.y / 2 + this.cameraPos.y
        return new Vec2(worldX, worldY);
    }

    screenFromWorld(world: Vec2): Vec2 {
        const screenX = (world.x - this.size.x / 2) * this.cameraZoom + this.canvas.width / 2
        const screenY = (world.y - this.size.y / 2) * this.cameraZoom + this.canvas.height / 2
        return new Vec2(screenX, screenY);
    }

    pointInsideBoard(p: Vec2): boolean {
        return (p.x >= 0 && p.x < this.size.x && p.y >= 0 && p.y < this.size.y)
    }

    getOffset(): Vec2 {
        let offset = this.cameraPos
        if (this.dragOffset) {
            offset = offset.add(this.dragOffset.fromPos.sub(this.dragOffset.toPos))
        }
        return offset
    }

    addComponent(c: Component) {
        this.components.push(c)
    }

    addWire(w: Wire) {
        if (w.to.kind == PortKind.Input) {
            w.to.wires.forEach(oldWire => this.removeWire(oldWire))
            w.to.wires = [w]
        }
        w.from.wires.push(w)
        this.wires.push(w)
    }

    removeWire(w: Wire) {
        this.wires = this.wires.filter(x => x !== w)
        w.from.wires = w.from.wires.filter(x => x !== w)
        w.to.wires = w.to.wires.filter(x => x !== w)
    }

    removeWireAttachedTo(port: Port) {
        this.wires = this.wires.filter(w => w.from !== port && w.to !== port)
    }

    removeWireAttachedFrom(port: Port) {
        this.wires = this.wires.filter(w => w.from !== port && w.to !== port)
    }

    removeComponent(component: Component) {
        // Remove any wires
        for (const inputs of component.inputs) {
            for (const w of inputs.wires) {
                this.removeWire(w)
            }
        }
        for (const outputs of component.outputs) {
            for (const w of outputs.wires) {
                this.removeWire(w)
            }
        }

        this.components = this.components.filter(x => x !== component)
        this.selected = this.selected.filter(x => x !== component)
    }

    clear() {
        this.components = []
        this.wires = []
    }

    clearSelected() {
        for (const c of [...this.selected]) {
            this.removeComponent(c)
        }
    }

    select(component: Component) {
        if (this.enabled) return
        component.selected = true
        this.selected.push(component)
    }

    selectAll() {
        this.deselect()
        for (const c of this.components) {
            this.select(c)
        }
    }

    deselect() {
        for (const c of this.selected) {
            c.selected = false
        }
        this.selected = []
    }

    set enabled(e: boolean) {
        this.canvas.classList.remove("running")
        this.canvas.classList.remove("build")
        if (e) {
            this.lastTick = Date.now()
            this.deselect()
            this.canvas.classList.add("running")
        } else {
            this.canvas.classList.add("build")
        }
        this._enabled = e
    }

    get enabled(): boolean {
        return this._enabled
    }

    updateIfEnabled() {
        if (this.enabled) {
            this.update()
        }
    }

    private update() {
        const now = Date.now()
        const elapsed = now - this.lastTick

        if (elapsed < this.tickMs) return

        const missedTicks = Math.floor(elapsed / this.tickMs)
        for (let i = 0; i < missedTicks; i++) {
            this.step()
            this.lastTick += this.tickMs
        }
    }

    step() {
        for (const c of this.components) {
            c.update()
            for (const p of c.inputs) {
                p.value = 0
            }
        }

        for (const w of this.wires) {
            w.to.value = w.from.value
        }
    }

    hitTestComponents(pos: Vec2): Component | null {
        return this.components.find(c =>
            pos.x >= c.pos.x && pos.x <= c.pos.x + c.size.x &&
            pos.y >= c.pos.y && pos.y <= c.pos.y + c.size.y
        ) ?? null
    }

    hitTestPorts(pos: Vec2, radius = 6): Port | null {
        for (const c of this.components) {
            for (const p of [...c.inputs, ...c.outputs]) {
                const world = p.getWorldPos()
                if (Math.abs(pos.x - world.x) < radius &&
                    Math.abs(pos.y - world.y) < radius) return p
            }
        }
        return null
    }

    mouseInsideSelected(): boolean {
        for (const c of this.selected) {
            if (this.worldPos.x >= c.pos.x && this.worldPos.x <= c.pos.x + c.size.x &&
                this.worldPos.y >= c.pos.y && this.worldPos.y <= c.pos.y + c.size.y
            ) {
                return true
            }
        }
        return false
    }

    buildClipboardData(): ClipboardData {
        const selected = this.components.filter(c => c.selected);
        const data: ClipboardData = {
            components: [],
            wires: []
        };
        if (selected.length === 0) return data;

        const ids = new Map<Component, string>();

        // Assign temporary IDs
        for (const c of selected) {
            const id = crypto.randomUUID();
            ids.set(c, id);

            data.components.push({
                id,
                type: c.id,
                position: { x: c.pos.x, y: c.pos.y },
            });
        }

        // Store only internal wires
        for (const w of this.wires) {
            if (ids.has(w.from.parent) && ids.has(w.to.parent)) {
                data.wires.push({
                    fromComponentId: ids.get(w.from.parent)!,
                    fromPortIndex: w.from.index,
                    toComponentId: ids.get(w.to.parent)!,
                    toPortIndex: w.to.index
                });
            }
        }

        return data;
    }

    async copySelected() {
        const data = this.buildClipboardData();
        const json = JSON.stringify(data, null, 2);

        await navigator.clipboard.writeText(json);
    }

    paste(text: string) {
        this.deselect()
        const data: ClipboardData = JSON.parse(text);

        // Instantiate components and map old IDs -> new instances
        const idMap = new Map<string, Component>();
        for (const c of data.components) {
            const instance: Component | null = this.createComponentFromType(c.type, new Vec2(c.position.x, c.position.y));
            if (!instance) {
                throw "bad id: " + c.type
            }

            this.select(instance)

            idMap.set(c.id, instance);
            this.components.push(instance)
        }

        // Instantiate wires
        for (const w of data.wires) {
            const fromComp = idMap.get(w.fromComponentId);
            const toComp = idMap.get(w.toComponentId);

            if (!fromComp || !toComp) continue; // safety

            const fromPort = fromComp.outputs[w.fromPortIndex];
            const toPort = toComp.inputs[w.toPortIndex];

            this.addWire(new Wire(fromPort, toPort));
        }
    }

    createComponentFromType(type: string, pos: Vec2) {
        switch (type) {
            case "Button": return new Button(pos)
            case "NotGate": return new NotGate(pos)
            case "AndGate": return new AndGate(pos)
            case "OrGate": return new OrGate(pos)
            case "XorGate": return new XorGate(pos)
            case "NandGate": return new NandGate(pos)
            case "NorGate": return new NorGate(pos)
            case "XnorGate": return new XnorGate(pos)
            case "Led": return new Led(pos)
            case "Switch": return new Switch(pos)
            case "Clock": return new Clock(pos)
            case "DFlipFlop": return new DFlipFlop(pos)
            case "TFlipFlop": return new TFlipFlop(pos)
            default: return null
        }
    }

    startWireDrag(port: Port) {
        if (this.enabled) return // can't do wires during a sim
        if (port.kind === PortKind.Input) {
            if (port.wires.length === 0) return
            const wire = port.wires[0]
            this.removeWire(wire)
            this.draggingWire = { from: wire.from, toPos: this.worldPos, originalWire: wire }
        } else {
            this.draggingWire = { from: port, toPos: this.worldPos }
        }
    }

    startComponentDrag() {
        for (const c of this.selected) {
            c.isDragged = true
        }
        this.componentDragFrom = this.worldPos
    }

    startPaletteDrag(id: string) {
        let comp: Component | null = this.createComponentFromType(id, this.worldPos)

        if (comp) {
            this.deselect()
            this.enabled = false
            this.componentDragFrom = this.worldPos.add(comp.size.scale(0.5))
            comp.isDragged = true
            this.select(comp)
            this.components.push(comp);
        }
    }

    selectSingleComponent() {
        this.deselect()
        for (const c of this.components) {
            if (this.worldPos.x >= c.pos.x && this.worldPos.x <= c.pos.x + c.size.x &&
                this.worldPos.y >= c.pos.y && this.worldPos.y <= c.pos.y + c.size.y
            ) {
                this.select(c)
                return
            }
        }
    }

    handleMouseDown(e: MouseEvent) {
        this.mouseDown = true;
        this.mouseDownWorldPos = new Vec2(this.worldPos.x, this.worldPos.y)

        if (this.enabled) {
            // if sim, check interactive components
            for (const c of this.components) {
                if ("onMouseDown" in c && "onMouseUp" in c && "contains" in c) {
                    const interactive = c as MouseInteractable
                    if (interactive.contains(this.worldPos)) {
                        interactive.onMouseDown()
                    }
                }
            }
        }

        // Check if clicking on any port
        if (!this.enabled) {
            const port = this.hitTestPorts(this.worldPos)
            if (port) {
                this.startWireDrag(port)
                return
            }
        }

        if (!this.enabled && e.shiftKey) {
            this.selection = { start: this.worldPos, end: this.worldPos }
        }

        if (!this.mouseInsideSelected()) {
            this.selectSingleComponent()
        }
    }

    handleMouseMove(mousePos: Vec2) {
        this.worldPos = this.worldFromScreen(mousePos)

        if (this.draggingWire) {
            this.draggingWire.toPos = this.worldPos
            return
        }

        if (this.selected.length > 0 && this.componentDragFrom) {
            for (const c of this.selected) {
                c.pos = c.pos.add(this.worldPos.sub(this.componentDragFrom))
            }
            this.componentDragFrom = this.worldPos
            return
        }

        if (this.mouseDown && this.dragOffset) {
            this.dragOffset.toPos = this.worldPos
        }

        if (this.selection) {
            this.selection.end = this.worldPos
            return
        }

        if (this.mouseDown && !this.componentDragFrom) {
            if (!this.enabled && this.selected.length > 0 && this.mouseInsideSelected()) {
                this.startComponentDrag()
                return
            }
        }

        if (this.mouseDown && !this.dragOffset && this.worldPos.dist(this.mouseDownWorldPos) > 0.1) {
            this.dragOffset = {
                fromPos: this.mouseDownWorldPos,
                toPos: this.mouseDownWorldPos
            };
        }
    }

    handleMouseUp() {
        this.mouseDown = false
        if (this.draggingWire) {
            const from = this.draggingWire.from;
            const port = this.hitTestPorts(this.worldPos)
            if (port && from.kind !== port.kind) {

                const output = from.kind === PortKind.Output ? from : port
                const input = from.kind === PortKind.Input ? from : port

                const wire = new Wire(output, input)
                this.addWire(wire)
                this.draggingWire = null
                return
            }

            if (this.draggingWire.originalWire) {
                this.removeWire(this.draggingWire.originalWire)
            }
            this.draggingWire = null
        }

        if (this.componentDragFrom) {
            for (let c of this.selected) {
                c.pos = c.pos.snap(20)

                if (!this.pointInsideBoard(c.pos)) {
                    this.removeComponent(c)
                }
                c.isDragged = false
            }
            this.componentDragFrom = null
            return
        }

        if (this.dragOffset) {
            this.cameraPos = this.cameraPos.add(this.dragOffset.fromPos.sub(this.dragOffset.toPos))
            this.dragOffset = null
        }

        if (this.selection) {
            this.finishSelection()
            this.selection = null
            return
        }

        this.selectSingleComponent()
    }

    private finishSelection() {
        const start = this.selection!.start!
        const end = this.selection!.end!

        const minX = Math.min(start.x, end.x)
        const maxX = Math.max(start.x, end.x)
        const minY = Math.min(start.y, end.y)
        const maxY = Math.max(start.y, end.y)

        for (const c of this.components) {
            const bounds = {
                x: c.pos.x,
                y: c.pos.y,
                width: c.size.x,
                height: c.size.y
            }

            const intersects =
                bounds.x < maxX &&
                bounds.x + bounds.width > minX &&
                bounds.y < maxY &&
                bounds.y + bounds.height > minY

            if (intersects) {
                this.select(c)
            }
        }
    }

    draw() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height)
        this.ctx.save()

        const canvasVec = new Vec2(this.canvas.width, this.canvas.height).scale(0.5)
        const boardVec = new Vec2(this.size.x, this.size.y).scale(0.5)
        let offset = boardVec.add(this.cameraPos)
        if (this.dragOffset) {
            offset = offset.add(this.dragOffset.fromPos.sub(this.dragOffset.toPos))
        }

        this.ctx.translate(canvasVec.x, canvasVec.y)
        this.ctx.scale(this.cameraZoom, this.cameraZoom)
        this.ctx.translate(-offset.x, -offset.y)

        this.drawGrid()

        for (const c of this.components) {
            c.draw(this.ctx);
        }

        if (this.draggingWire) {
            const color = "#4af"
            this.drawWire(this.draggingWire.from.getWorldPos(), this.draggingWire.toPos, color)
        }

        for (const w of this.wires) {
            let color = w.from.value ? "#4caf50" : "#555"
            this.drawWire(w.from.getWorldPos(), w.to.getWorldPos(), color)
        }

        if (this.selection) {
            this.ctx.fillStyle = "rgba(74, 163, 255, 0.15)"
            this.ctx.strokeStyle = "#4aa3ff"
            this.ctx.lineWidth = 1
            const size = this.selection.end.sub(this.selection.start)
            this.ctx.fillRect(this.selection.start.x, this.selection.start.y, size.x, size.y)
            this.ctx.strokeRect(this.selection.start.x, this.selection.start.y, size.x, size.y)
        }

        this.ctx.restore()
    }

    drawGrid() {
        this.ctx.fillStyle = "#ebebeb"
        this.ctx.strokeStyle = "#ebebeb";
        this.ctx.beginPath();
        this.ctx.roundRect(0, 0, this.size.x, this.size.y, 6);
        this.ctx.fill();
        this.ctx.stroke();

        this.ctx.strokeStyle = "#e0e0e0";
        this.ctx.lineWidth = 1.0 / this.cameraZoom;

        for (let x = this.pitch; x < this.size.x; x += this.pitch) {
            this.ctx.beginPath();
            this.ctx.moveTo(x, 0);
            this.ctx.lineTo(x, this.size.y);
            this.ctx.stroke();
        }

        for (let y = this.pitch; y < this.size.y; y += this.pitch) {
            this.ctx.beginPath();
            this.ctx.moveTo(0, y);
            this.ctx.lineTo(this.size.x, y);
            this.ctx.stroke();
        }
    }

    drawWire(fromPos: Vec2, toPos: Vec2, color: string) {
        const padding = 10
        const detour1 = fromPos.add(new Vec2(padding, 0))
        const m = fromPos.add(toPos).scale(0.5)
        const detour2 = toPos.sub(new Vec2(padding, 0))

        this.ctx.lineWidth = 1;
        this.ctx.strokeStyle = color // 
        this.ctx.lineCap = "round";
        this.ctx.lineJoin = "round";

        this.ctx.beginPath();
        this.ctx.moveTo(fromPos.x, fromPos.y);
        this.ctx.lineTo(detour1.x, fromPos.y);
        if (toPos.x >= fromPos.x + 2 * padding) {
            this.ctx.lineTo(m.x, fromPos.y);
            this.ctx.lineTo(m.x, toPos.y);
        } else {
            this.ctx.lineTo(detour1.x, m.y);
            this.ctx.lineTo(detour2.x, m.y);
        }
        this.ctx.lineTo(detour2.x, toPos.y);
        this.ctx.lineTo(toPos.x, toPos.y);
        this.ctx.stroke();
    }
}