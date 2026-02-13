import { AndGate, Button, Led, NotGate, OrGate, Port, XorGate, PortKind, Wire, Switch, type Component, NandGate, NorGate, XnorGate, Clock, DFlipFlop, TFlipFlop } from './components.ts'
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

    tickMs: number
    private lastTick = 0

    constructor(tickMs: number) {
        this.tickMs = tickMs
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
        if (port.kind === PortKind.Input) {
            if (port.wires.length === 0) return
            const wire = port.wires[0]
            this.removeWire(wire)
            this.draggingWire = { from: wire.from, toPos: mousePos, originalWire: wire }
        } else {
            this.draggingWire = { from: port, toPos: mousePos }
        }
    }

    startComponentDrag(component: Component, mousePos: Vec2) {
        this.draggingComponent = component
        this.dragOffset = mousePos.sub(component.pos)

        // Bring to front (or disallow overlapping somehow?)
        this.components = this.components.filter(x => x !== this.draggingComponent);
        this.components.push(this.draggingComponent);
    }

    startPaletteDrag(id: string, mousePos: Vec2) {
        this.draggingFromPalette = { id, toPos: mousePos }
    }

    handleMouseMove(mousePos: Vec2) {
        if (this.draggingWire) {
            this.draggingWire.toPos = mousePos
            return
        }

        if (this.draggingComponent) {
            const grid = 20;
            this.draggingComponent.pos.x = Math.round((mousePos.x - this.dragOffset.x) / grid) * grid;
            this.draggingComponent.pos.y = Math.round((mousePos.y - this.dragOffset.y) / grid) * grid;
        }
    }

    handlePaletteMouseMove(mousePos: Vec2) {
        if (this.draggingFromPalette) {
            this.draggingFromPalette.toPos = mousePos
        }
    }

    handleMouseUp(mousePos: Vec2) {
        if (this.draggingWire) {
            const from = this.draggingWire.from;
            for (const c of this.components) {
                for (const p of [...c.inputs, ...c.outputs]) {
                    if (p == from) continue // skip self
                    const pos = p.getWorldPos()
                    const clickableRadius = 6

                    if (Math.abs(mousePos.x - pos.x) < clickableRadius && Math.abs(mousePos.y - pos.y) < clickableRadius) {
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
            console.log(mousePos)
            if (mousePos.x < 0) {
                this.removeComponent(this.draggingComponent)
            }
        }
        this.draggingComponent = null
    }

    exitPaletteDrag(mousePos: Vec2) {
        if (this.draggingFromPalette) {
            let comp: Component | null = null
            console.log(this.draggingFromPalette.id)
            switch (this.draggingFromPalette.id) {
                case "Button": comp = new Button(mousePos); break
                case "NotGate": comp = new NotGate(mousePos); break
                case "AndGate": comp = new AndGate(mousePos); break
                case "OrGate": comp = new OrGate(mousePos); break
                case "XorGate": comp = new XorGate(mousePos); break
                case "NandGate": comp = new NandGate(mousePos); break
                case "NorGate": comp = new NorGate(mousePos); break
                case "XnorGate": comp = new XnorGate(mousePos); break
                case "Led": comp = new Led(mousePos); break
                case "Switch": comp = new Switch(mousePos); break
                case "Clock": comp = new Clock(mousePos); break
                case "DFlipFlop": comp = new DFlipFlop(mousePos); break
                case "TFlipFlop": comp = new TFlipFlop(mousePos); break
            }

            if (comp) this.addComponent(comp)
            this.draggingFromPalette = null
        }
    }

    draw(ctx: CanvasRenderingContext2D) {
        this.drawGrid(ctx)

        for (const w of this.wires) {
            let color = w.from.value ? "#4caf50" : "#555"
            this.drawWire(w.from.getWorldPos(), w.to.getWorldPos(), color, ctx)
        }

        if (this.draggingFromPalette) {
            const pos = this.draggingFromPalette.toPos;
            ctx.fillStyle = "#aaa8";
            ctx.strokeStyle = "#75757588";
            ctx.fillRect(pos.x, pos.y, 20, 40);
            ctx.strokeRect(pos.x, pos.y, 20, 40);
        }

        if (this.draggingWire) {
            const color = "#4af"
            this.drawWire(this.draggingWire.from.getWorldPos(), this.draggingWire.toPos, color, ctx)
        }

        for (const c of this.components) {
            c.draw(ctx);
        }
    }

    drawGrid(ctx: CanvasRenderingContext2D) {
        const width = 750
        const height = 400
        const spacing = 20;
        ctx.strokeStyle = "rgba(0,0,0,0.05)";
        ctx.lineWidth = 1;

        for (let x = 0; x < width; x += spacing) {
            ctx.beginPath();
            ctx.moveTo(x, 0);
            ctx.lineTo(x, height);
            ctx.stroke();
        }

        for (let y = 0; y < height; y += spacing) {
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(width, y);
            ctx.stroke();
        }
    }

    drawWire(fromPos: Vec2, toPos: Vec2, color: string, ctx: CanvasRenderingContext2D) {
        const padding = 10
        const detour1 = fromPos.add(new Vec2(padding, 0))
        const m = fromPos.add(toPos).scale(0.5)
        const detour2 = toPos.sub(new Vec2(padding, 0))

        ctx.lineWidth = 2;
        ctx.strokeStyle = color // 
        ctx.lineCap = "round";
        ctx.lineJoin = "round";

        ctx.beginPath();
        ctx.moveTo(fromPos.x, fromPos.y);
        ctx.lineTo(detour1.x, fromPos.y);
        if (toPos.x >= fromPos.x + 2 * padding) {
            ctx.lineTo(m.x, fromPos.y);
            ctx.lineTo(m.x, toPos.y);
        } else {
            ctx.lineTo(detour1.x, m.y);
            ctx.lineTo(detour2.x, m.y);
        }
        ctx.lineTo(detour2.x, toPos.y);
        ctx.lineTo(toPos.x, toPos.y);
        ctx.stroke();
    }
}