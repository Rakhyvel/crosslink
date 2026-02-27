import { Port, PortKind, Wire, type Component, createComponentFromType } from './components.ts'
import { Vec2 } from './vec.ts'
import { AddComponentsCommand, AddWiresCommand, CompositeCommand, History, MoveComponentsCommand, RemoveComponentsCommand, RemoveWiresCommand } from './command.ts'
import { Board, BoardSize, type Serialized } from './board.ts'
import { promptModal, confirmSaveModal } from './modal.ts'
import { Palette } from './palette.ts'

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

export class Sim {
    board: Board

    // Maybe could be owned by a Palette object?
    customComponents: Map<string, Serialized> = new Map<string, Serialized>()
    palette: Palette

    draggingComponent: DraggingComponent | null = null
    componentDragFrom: Vec2 | null = null
    draggingWire: DraggingWire | null = null
    dragOffset: Pan | null = null
    selection: Selection | null = null

    cameraPos: Vec2 = new Vec2(0, 0)
    cameraZoom: number = 3.0

    canvas: HTMLCanvasElement
    ctx: CanvasRenderingContext2D

    tickMs: number
    private lastTick = 0

    worldPos: Vec2 = new Vec2(0, 0)
    mouseDown: boolean = false
    mouseDownWorldPos: Vec2 = new Vec2(0, 0)

    private _enabled: boolean = false

    selected: Component[] = []

    history: History = new History()

    inModal: boolean = false

    constructor(canvas: HTMLCanvasElement, tickMs: number) {
        this.canvas = canvas
        this.ctx = canvas.getContext("2d")!
        this.tickMs = tickMs
        this.palette = new Palette("palette", this)

        canvas.addEventListener("wheel", e => {
            const zoomFactor = 1.1
            this.cameraZoom *= e.deltaY < 0 ? zoomFactor : 1 / zoomFactor;
        })

        this.board = new Board(BoardSize.Small, "Untitled Component")
    }

    worldFromScreen(screen: Vec2): Vec2 {
        const worldX = (screen.x - this.canvas.width / 2) / this.cameraZoom + this.board.size.x / 2 + this.cameraPos.x
        const worldY = (screen.y - this.canvas.height / 2) / this.cameraZoom + this.board.size.y / 2 + this.cameraPos.y
        return new Vec2(worldX, worldY);
    }

    screenFromWorld(world: Vec2): Vec2 {
        const screenX = (world.x - this.board.size.x / 2) * this.cameraZoom + this.canvas.width / 2
        const screenY = (world.y - this.board.size.y / 2) * this.cameraZoom + this.canvas.height / 2
        return new Vec2(screenX, screenY);
    }

    pointInsideBoard(p: Vec2): boolean {
        return (p.x >= 0 && p.x < this.board.size.x && p.y >= 0 && p.y < this.board.size.y)
    }

    getOffset(): Vec2 {
        let offset = this.cameraPos
        if (this.dragOffset) {
            offset = offset.add(this.dragOffset.fromPos.sub(this.dragOffset.toPos))
        }
        return offset
    }

    addComponents(cs: Component[]) {
        this.deselect()
        for (const c of cs) {
            this.select(c)
        }
        this.board.addComponents(cs)
    }

    getWiresForComponent(component: Component) {
        const retval: Wire[] = []
        for (const inputs of component.inputs) {
            for (const w of inputs.wires) {
                retval.push(w)
            }
        }
        for (const outputs of component.outputs) {
            for (const w of outputs.wires) {
                retval.push(w)
            }
        }
        return retval
    }

    removeComponents(components: Component[]) {
        for (const c of components) {
            this.removeComponent(c)
        }
    }

    removeComponent(component: Component) {
        this.board.removeComponent(component)
        this.selected = this.selected.filter(x => x !== component)
    }

    addWire(wire: Wire) {
        this.board.addWire(wire)
    }

    removeWire(wire: Wire) {
        this.board.removeWire(wire)
    }

    async clear() {
        this.enabled = false
        
        const canProceed = await this.confirmDiscardIfDirty()
        if (!canProceed) return
        
        this.board.clear()
        this.history.clear()
    }

    clearSelected() {
        this.enabled = false
        this.history.execute(new RemoveComponentsCommand([...this.selected]), this)
    }

    select(component: Component) {
        if (this.enabled) return
        component.selected = true
        this.selected.push(component)
    }

    selectAll() {
        this.deselect()
        this.board.forEachComponent((c, _i) => this.select(c))
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
        this.board.step()
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

    async copySelected() {
        const data = this.board.serialize(c => c.selected);
        const json = JSON.stringify(data, null, 2);

        await navigator.clipboard.writeText(json);
    }

    paste(text: string) {
        const data: Serialized = JSON.parse(text);

        // Instantiate components and map old IDs -> new instances
        const idMap = new Map<string, Component>();
        const components = new Array<Component>();
        for (const c of data.components) {
            const instance: Component | null = createComponentFromType(c.type, new Vec2(c.position.x, c.position.y).add(new Vec2(20, 20)), c.name, this.customComponents);
            if (!instance) {
                throw "bad id: " + c.type
            }

            idMap.set(c.id, instance);
            instance.dropped = true;
            components.push(instance)
        }
        this.history.execute(new AddComponentsCommand(components), this)

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

    undo() {
        this.enabled = false
        this.history.undo(this)
    }

    redo() {
        this.enabled = false
        this.history.redo(this)
    }

    async save() {
        if (this.customComponents.has(this.board.name)) {
            this.saveUnderName(this.board.name)
            return
        }

        const name = await this.promptForName()
        if (!name) return

        this.saveUnderName(name)
    }

    async saveAs() {
        const name = await this.promptForName()
        if (!name) return

        this.saveUnderName(name)
    }

    async load(name: string) {
        if (this.board.name === name) return

        this.enabled = false

        const canProceed = await this.confirmDiscardIfDirty()
        if (!canProceed) return

        const data = this.customComponents.get(name)
        if (!data) return

        this.history.clear()
        this.board = Board.fromSerialized(data, name, this.customComponents)
    }

    private async promptForName(): Promise<string | null> {
        this.inModal = true
        const name = await promptModal("Component name:")
        this.inModal = false
        return name
    }

    private async confirmDiscardIfDirty(): Promise<boolean> {
        if (this.history.undoDepth() === 0) {
            return true
        }

        const choice = await confirmSaveModal(
            "You have unsaved changes. Do you want to save before continuing?"
        )

        if (choice === "save") {
            await this.save()
            return true
        }

        if (choice === "discard") {
            return true
        }

        return false
    }

    private saveUnderName(name: string) {
        const data = this.board.serialize(_ => true)
        this.customComponents.set(name, data)
        this.palette.addItem("Custom", name, "CustomComponent")
        this.board.name = name
        this.load(name)
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
            c.dragOffset = new Vec2(0, 0)
        }
        this.componentDragFrom = this.worldPos
    }

    startPaletteDrag(id: string, name: string | undefined) {
        let comp: Component | null = createComponentFromType(id, this.worldPos, name, this.customComponents)

        if (comp) {
            this.enabled = false
            this.componentDragFrom = this.worldPos.add(comp.size.scale(0.5))
            comp.dragOffset = new Vec2(0, 0)
            this.history.execute(new AddComponentsCommand([comp]), this)
        }
    }

    selectSingleComponent() {
        this.deselect()
        const comp = this.board.hitTestComponents(this.worldPos)
        if (comp) {
            this.select(comp)
        }
    }

    handleMouseDown(e: MouseEvent) {
        this.mouseDown = true;
        this.mouseDownWorldPos = new Vec2(this.worldPos.x, this.worldPos.y)

        if (this.enabled) {
            this.board.interactComponents(this.worldPos)
        }

        // Check if clicking on any port
        if (!this.enabled) {
            const port = this.board.hitTestPorts(this.worldPos)
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
                c.dragOffset = this.worldPos.sub(this.componentDragFrom)
            }
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
            const port = this.board.hitTestPorts(this.worldPos)
            if (port && from.kind !== port.kind) {

                const output = from.kind === PortKind.Output ? from : port
                const input = from.kind === PortKind.Input ? from : port

                const wire = new Wire(output, input)
                this.history.execute(new AddWiresCommand([wire]), this)
                this.draggingWire = null
                return
            }

            if (this.draggingWire.originalWire) {
                this.removeWire(this.draggingWire.originalWire)
                this.history.execute(new RemoveWiresCommand([this.draggingWire.originalWire]), this)
            }
            this.draggingWire = null
        }

        if (this.componentDragFrom) {
            const cmds = []
            for (let c of this.selected) {
                const dropPoint = c.pos.add(c.dragOffset!).snap(20, new Vec2(0, 10))
                if (!this.board.pointInside(dropPoint)) {
                    cmds.push(new RemoveComponentsCommand([c]))
                } else if (c.dropped) {
                    cmds.push(new MoveComponentsCommand([c], [c.pos], [dropPoint]))
                } else {
                    c.pos = dropPoint
                    c.dropped = true
                }
                c.dragOffset = null
            }
            if (cmds.length > 0) {
                this.history.execute(new CompositeCommand(cmds), this)
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

        const selectedComponents = this.board.hitTestComponentsRect(start, end)
        for (const c of selectedComponents) {
            this.select(c)
        }
    }

    draw() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height)
        this.ctx.save()

        const canvasVec = new Vec2(this.canvas.width, this.canvas.height).scale(0.5)
        const boardVec = new Vec2(this.board.size.x, this.board.size.y).scale(0.5)
        let offset = boardVec.add(this.cameraPos)
        if (this.dragOffset) {
            offset = offset.add(this.dragOffset.fromPos.sub(this.dragOffset.toPos))
        }

        this.ctx.translate(canvasVec.x, canvasVec.y)
        this.ctx.scale(this.cameraZoom, this.cameraZoom)
        this.ctx.translate(-offset.x, -offset.y)

        this.board.draw(this.ctx)

        if (this.draggingWire) {
            const color = "#4af"
            this.board.drawWire(this.ctx, this.draggingWire.from.getWorldPos(), this.draggingWire.toPos, color)
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
}