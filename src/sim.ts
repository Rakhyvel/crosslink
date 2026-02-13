import { AndGate, Button, Led, NotGate, OrGate, Port, XorGate, PortKind, Wire, Switch, type Component, NandGate, NorGate, XnorGate, Clock, DFlipFlop, TFlipFlop, type MouseInteractable } from './components.ts'
import { Vec2 } from './vec.ts'

interface DraggingWire {
    from: Port
    toPos: Vec2
    originalWire?: Wire
}

interface DraggingPalette {
    id: string
    toPos: Vec2
}

export class Sim {
    components: Component[] = []
    wires: Wire[] = []

    draggingComponent: Component | null = null
    draggingWire: DraggingWire | null = null
    dragOffset: Vec2 = new Vec2(0, 0)
    draggingFromPalette: DraggingPalette | null = null

    cameraPos: Vec2 = new Vec2(0, 0)
    cameraZoom: number = 1

    canvas: HTMLCanvasElement
    ctx: CanvasRenderingContext2D

    tickMs: number
    private lastTick = 0

    worldPos: Vec2 = new Vec2(0, 0)

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
        const worldX = (screen.x - this.canvas.width / 2) / this.cameraZoom + this.canvas.width / 2
        const worldY = (screen.y - this.canvas.height / 2) / this.cameraZoom + this.canvas.height / 2
        return new Vec2(worldX, worldY);
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
        this.wires = this.wires.filter(w =>
            w.from.parent !== component &&
            w.to.parent !== component
        )

        this.components = this.components.filter(x => x !== component)
    }

    update(now: number) {
        if (now - this.lastTick < this.tickMs) return
        this.lastTick = now

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

    startWireDrag(port: Port, mousePos: Vec2) {
        const worldPos = this.worldFromScreen(mousePos)
        if (port.kind === PortKind.Input) {
            if (port.wires.length === 0) return
            const wire = port.wires[0]
            this.removeWire(wire)
            this.draggingWire = { from: wire.from, toPos: worldPos, originalWire: wire }
        } else {
            this.draggingWire = { from: port, toPos: worldPos }
        }
    }

    startComponentDrag(component: Component, mousePos: Vec2) {
        const worldPos = this.worldFromScreen(mousePos)
        this.draggingComponent = component
        this.dragOffset = worldPos.sub(component.pos)

        // Bring to front (or disallow overlapping somehow?)
        this.components = this.components.filter(x => x !== this.draggingComponent);
        this.components.push(this.draggingComponent);
    }

    startPaletteDrag(id: string, mousePos: Vec2) {
        const worldPos = this.worldFromScreen(mousePos)
        this.draggingFromPalette = { id, toPos: worldPos }
    }

    handleMouseDown(mousePos: Vec2) {
        const worldPos = this.worldFromScreen(mousePos)
        // check interactive components
        for (const c of this.components) {
            if ("onMouseDown" in c && "onMouseUp" in c && "contains" in c) {
                const interactive = c as MouseInteractable
                if (interactive.contains(worldPos)) {
                    interactive.onMouseDown()
                }
            }
        }

        // Check if clicking on any port
        for (const c of this.components) {
            for (const p of [...c.inputs, ...c.outputs]) {
                const pos = p.getWorldPos()
                const clickableRadius = 6
                if (Math.abs(worldPos.x - pos.x) < clickableRadius && Math.abs(worldPos.y - pos.y) < clickableRadius) {
                    this.startWireDrag(p, worldPos)
                    return // stop here
                }
            }
        }

        // Check if clicking any component
        for (const c of this.components) {
            if (worldPos.x >= c.pos.x && worldPos.x <= c.pos.x + c.size.x &&
                worldPos.y >= c.pos.y && worldPos.y <= c.pos.y + c.size.y
            ) {
                this.startComponentDrag(c, worldPos)
                return
            }
        }
    }

    handleMouseMove(mousePos: Vec2) {
        const worldPos = this.worldFromScreen(mousePos)
        this.worldPos = worldPos
        if (this.draggingWire) {
            this.draggingWire.toPos = worldPos
            return
        }

        if (this.draggingComponent) {
            const grid = 20;
            this.draggingComponent.pos.x = Math.round((worldPos.x - this.dragOffset.x) / grid) * grid;
            this.draggingComponent.pos.y = Math.round((worldPos.y - this.dragOffset.y) / grid) * grid;
        }
    }

    handlePaletteMouseMove(mousePos: Vec2) {
        const worldPos = this.worldFromScreen(mousePos)
        if (this.draggingFromPalette) {
            this.draggingFromPalette.toPos = worldPos
        }
    }

    handleMouseUp(mousePos: Vec2) {
        const worldPos = this.worldFromScreen(mousePos)
        if (this.draggingWire) {
            const from = this.draggingWire.from;
            for (const c of this.components) {
                for (const p of [...c.inputs, ...c.outputs]) {
                    if (p == from) continue // skip self
                    const pos = p.getWorldPos()
                    const clickableRadius = 6

                    if (Math.abs(worldPos.x - pos.x) < clickableRadius && Math.abs(worldPos.y - pos.y) < clickableRadius) {
                        if (from.kind === p.kind) break

                        const output = from.kind === PortKind.Output ? from : p
                        const input = from.kind === PortKind.Input ? from : p

                        const wire = new Wire(output, input)
                        this.addWire(wire)
                        this.draggingWire = null
                        return
                    }
                }
            }

            if (this.draggingWire.originalWire) {
                this.removeWire(this.draggingWire.originalWire)
            }
            this.draggingWire = null
            return
        }

        if (this.draggingComponent) {
            if (worldPos.x < 0) {
                this.removeComponent(this.draggingComponent)
            }
        }
        this.draggingComponent = null
    }

    exitPaletteDrag(mousePos: Vec2) {
        const worldPos = this.worldFromScreen(mousePos)
        if (this.draggingFromPalette) {
            let comp: Component | null = null
            console.log(this.draggingFromPalette.id)
            switch (this.draggingFromPalette.id) {
                case "Button": comp = new Button(worldPos); break
                case "NotGate": comp = new NotGate(worldPos); break
                case "AndGate": comp = new AndGate(worldPos); break
                case "OrGate": comp = new OrGate(worldPos); break
                case "XorGate": comp = new XorGate(worldPos); break
                case "NandGate": comp = new NandGate(worldPos); break
                case "NorGate": comp = new NorGate(worldPos); break
                case "XnorGate": comp = new XnorGate(worldPos); break
                case "Led": comp = new Led(worldPos); break
                case "Switch": comp = new Switch(worldPos); break
                case "Clock": comp = new Clock(worldPos); break
                case "DFlipFlop": comp = new DFlipFlop(worldPos); break
                case "TFlipFlop": comp = new TFlipFlop(worldPos); break
            }

            if (comp) this.addComponent(comp)
            this.draggingFromPalette = null
        }
    }

    draw() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height)
        this.ctx.save()
        this.ctx.translate(this.canvas.width / 2 + this.cameraPos.x, this.canvas.height / 2 - this.cameraPos.y)
        this.ctx.scale(this.cameraZoom, this.cameraZoom)
        this.ctx.translate(-this.canvas.width / 2 + this.cameraPos.x, -this.canvas.height / 2 - this.cameraPos.y)

        this.drawGrid()

        this.ctx.fillStyle = "red"
        const size = 10 // world units
        this.ctx.fillRect(this.worldPos.x - size / 2, this.worldPos.y - size / 2, size, size)

        for (const w of this.wires) {
            let color = w.from.value ? "#4caf50" : "#555"
            this.drawWire(w.from.getWorldPos(), w.to.getWorldPos(), color)
        }

        if (this.draggingFromPalette) {
            const pos = this.draggingFromPalette.toPos;
            this.ctx.fillStyle = "#aaa8";
            this.ctx.strokeStyle = "#75757588";
            this.ctx.fillRect(pos.x, pos.y, 20, 40);
            this.ctx.strokeRect(pos.x, pos.y, 20, 40);
        }

        if (this.draggingWire) {
            const color = "#4af"
            this.drawWire(this.draggingWire.from.getWorldPos(), this.draggingWire.toPos, color)
        }

        for (const c of this.components) {
            c.draw(this.ctx);
        }

        this.ctx.restore()
    }

    drawGrid() {
        const width = this.canvas.width
        const height = this.canvas.height
        const spacing = 20;
        this.ctx.strokeStyle = "rgba(0,0,0,0.05)";
        this.ctx.lineWidth = 1;

        for (let x = 0; x < width; x += spacing) {
            this.ctx.beginPath();
            this.ctx.moveTo(x, 0);
            this.ctx.lineTo(x, height);
            this.ctx.stroke();
        }

        for (let y = 0; y < height; y += spacing) {
            this.ctx.beginPath();
            this.ctx.moveTo(0, y);
            this.ctx.lineTo(width, y);
            this.ctx.stroke();
        }
    }

    drawWire(fromPos: Vec2, toPos: Vec2, color: string) {
        const padding = 10
        const detour1 = fromPos.add(new Vec2(padding, 0))
        const m = fromPos.add(toPos).scale(0.5)
        const detour2 = toPos.sub(new Vec2(padding, 0))

        this.ctx.lineWidth = 2;
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