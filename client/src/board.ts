import type { Serialized } from "shared";
import { createComponentFromType, InputPin, PortKind, Wire, type Component, type MouseInteractable, type Port } from "./components"
import { Vec2 } from "./vec"

const pitch: number = 20

export enum BoardSize {
    Small,
    Medium,
    Large
}

const boardSizes: Record<BoardSize, Vec2> = {
    [BoardSize.Small]: new Vec2(11, 8).scale(pitch),
    [BoardSize.Medium]: new Vec2(24, 18).scale(pitch),
    [BoardSize.Large]: new Vec2(32, 22).scale(pitch),
};

export class Board {
    size: Vec2

    constructor(boardSize: BoardSize, public name: string, private components: Component[] = [], private wires: Wire[] = []) {
        this.size = boardSizes[boardSize]
    }

    static fromSerialized(data: Serialized, name: string, custom: Map<string, Serialized> | null = null): Board {
        const retval = new Board(BoardSize.Small, name)

        // Instantiate components and map old IDs -> new instances
        const idMap = new Map<string, Component>();
        const components = new Array<Component>();
        for (const c of data.components) {
            const instance: Component | null = createComponentFromType(c.type, new Vec2(c.position.x, c.position.y), c.name, custom);
            if (!instance) {

                throw "bad id: " + c.type
            }

            idMap.set(c.id, instance);
            instance.dropped = true;
            components.push(instance)
        }
        retval.addComponents(components)

        // Instantiate wires
        for (const w of data.wires) {
            const fromComp = idMap.get(w.fromComponentId);
            const toComp = idMap.get(w.toComponentId);

            if (!fromComp || !toComp) continue; // safety

            const fromPort = fromComp.outputs[w.fromPortIndex];
            const toPort = toComp.inputs[w.toPortIndex];

            retval.addWire(new Wire(fromPort, toPort));
        }

        return retval
    }

    addComponents(cs: Component[]) {
        for (const c of cs) {
            this.components.push(c)
        }
    }

    removeComponent(component: Component) {
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
    }

    getInputPins(): InputPin[] {
        return this.components.filter(c => c.id === "InputPin").sort((a, b) => a.pos.y - b.pos.y) as InputPin[]
    }

    getOutputPins() {
        return this.components.filter(c => c.id === "OutputPin").sort((a, b) => a.pos.y - b.pos.y)
    }

    forEachComponent(f: (arg0: Component, arg1: number) => void) {
        this.components.forEach((c, i) => f(c, i))
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

    clear() {
        this.components = []
        this.wires = []
        this.name = "Untitled Component"
    }

    hitTestComponents(pos: Vec2): Component | null {
        return this.components.find(c =>
            pos.x >= c.pos.x && pos.x <= c.pos.x + c.size.x &&
            pos.y >= c.pos.y && pos.y <= c.pos.y + c.size.y
        ) ?? null
    }

    hitTestComponentsRect(start: Vec2, end: Vec2) {
        let retval = []

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
                retval.push(c)
            }
        }

        return retval;
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

    getInternalWires(components: Component[]): Wire[] {
        const set = new Set(components);
        return this.wires.filter(w => set.has(w.from.parent) && set.has(w.to.parent));
    }

    pointInside(p: Vec2): boolean {
        return (p.x >= 0 && p.x < this.size.x && p.y >= 0 && p.y < this.size.y)
    }

    serialize(f: (value: Component) => Boolean): Serialized {
        const components = this.components.filter(f)
        const data: Serialized = {
            components: [],
            wires: []
        };
        if (components.length === 0) return data;

        const ids = new Map<Component, string>();

        // Assign temporary IDs
        for (const c of components) {
            const id = crypto.randomUUID();
            ids.set(c, id);

            data.components.push({
                id,
                type: c.id,
                name: c.name,
                position: { x: c.pos.x, y: c.pos.y },
            });
        }

        // Store only internal wires
        for (const w of this.getInternalWires(components)) {
            data.wires.push({
                fromComponentId: ids.get(w.from.parent)!,
                fromPortIndex: w.from.index,
                toComponentId: ids.get(w.to.parent)!,
                toPortIndex: w.to.index
            });
        }

        return data;
    }

    interactComponents(worldPos: Vec2) {
        for (const c of this.components) {
            if ("onMouseDown" in c && "contains" in c) {
                const interactive = c as MouseInteractable
                if (interactive.contains(worldPos)) {
                    interactive.onMouseDown()
                }
            }
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

    draw(ctx: CanvasRenderingContext2D) {
        this.drawGrid(ctx)

        for (const c of this.components) {
            c.draw(ctx);
        }

        for (const w of this.wires) {
            let color = w.from.value ? "#4caf50" : "#555"
            this.drawWire(ctx, w.from.getWorldPos(), w.to.getWorldPos(), color)
        }
    }

    drawGrid(ctx: CanvasRenderingContext2D) {
        ctx.fillStyle = "#ebebeb"
        ctx.strokeStyle = "#ebebeb";
        ctx.beginPath();
        ctx.fillRect(0, 0, this.size.x, this.size.y);
        // ctx.fill();
        ctx.stroke();

        ctx.strokeStyle = "#e0e0e0";
        ctx.lineWidth = 1.0;

        for (let x = pitch; x < this.size.x; x += pitch) {
            ctx.beginPath();
            ctx.moveTo(x, pitch);
            ctx.lineTo(x, this.size.y - pitch);
            ctx.stroke();
        }

        for (let y = pitch; y < this.size.y; y += pitch) {
            ctx.beginPath();
            ctx.moveTo(pitch, y);
            ctx.lineTo(this.size.x - pitch, y);
            ctx.stroke();
        }

        ctx.fillStyle = "#818181ff"
        ctx.font = "10px caveat";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle"
        ctx.fillText(this.name, this.size.x / 2, 10);
    }

    drawWire(ctx: CanvasRenderingContext2D, fromPos: Vec2, toPos: Vec2, color: string) {
        const dx = toPos.x - fromPos.x;
        const offset = Math.min(40, Math.abs(dx));

        ctx.lineWidth = 2;
        ctx.strokeStyle = color;
        ctx.lineCap = "round";
        ctx.lineJoin = "round";

        ctx.beginPath();
        ctx.moveTo(fromPos.x, fromPos.y);

        ctx.bezierCurveTo(
            fromPos.x + offset, fromPos.y,       // control point 1
            toPos.x - offset, toPos.y,           // control point 2
            toPos.x, toPos.y                     // end point
        );

        ctx.stroke();
    }
}