import type { Component, Wire } from "./components"
import { Sim } from "./sim"
import type { Vec2 } from "./vec"

interface Command {
    do(sim: Sim): void
    undo(sim: Sim): void
}

export class History {
    private undoStack: Command[] = []
    private redoStack: Command[] = []

    dirty: boolean = false

    execute(cmd: Command, sim: Sim) {
        cmd.do(sim)
        this.undoStack.push(cmd)
        this.redoStack = []
        this.dirty = true
    }

    undo(sim: Sim) {
        const cmd = this.undoStack.pop()
        if (!cmd) return
        cmd.undo(sim)
        this.redoStack.push(cmd)
    }

    redo(sim: Sim) {
        const cmd = this.redoStack.pop()
        if (!cmd) return
        cmd.do(sim)
        this.undoStack.push(cmd)
    }

    undoDepth(): number { return this.undoStack.length }
    redoDepth(): number { return this.redoStack.length }

    clear() {
        this.undoStack = []
        this.redoStack = []
    }
}

export class CompositeCommand implements Command {
    constructor(private commands: Command[]) { }

    do(sim: Sim) {
        for (const c of this.commands) c.do(sim)
    }

    undo(sim: Sim) {
        for (const c of this.commands) c.undo(sim)
    }
}

export class AddComponentsCommand implements Command {
    private removedWires: Wire[] = []

    constructor(private components: Component[]) { }

    do(sim: Sim) {
        sim.addComponents(this.components)
        for (const w of this.removedWires) {
            sim.addWire(w)
        }
    }

    undo(sim: Sim) {
        this.removedWires = []
        for (const c of this.components) {
            this.removedWires = this.removedWires.concat(sim.getWiresForComponent(c))
        }
        sim.removeComponents(this.components)
    }
}

export class RemoveComponentsCommand implements Command {
    private removedWires: Wire[] = []

    constructor(private components: Component[]) { }

    do(sim: Sim) {
        this.removedWires = []
        for (const c of this.components) {
            this.removedWires = this.removedWires.concat(sim.getWiresForComponent(c))
        }
        sim.removeComponents(this.components)
    }

    undo(sim: Sim) {
        sim.addComponents(this.components)
        for (const w of this.removedWires) {
            sim.addWire(w)
        }
    }
}

export class MoveComponentsCommand implements Command {
    constructor(
        private components: Component[],
        private from: Vec2[],
        private to: Vec2[]
    ) { }

    do(_sim: Sim) {
        this.components.forEach((c, i) => {
            c.pos = this.to[i]
        })
    }

    undo(_sim: Sim) {
        this.components.forEach((c, i) => {
            c.pos = this.from[i]
        })
    }
}

export class AddWiresCommand implements Command {
    constructor(private wires: Wire[]) { }

    do(sim: Sim) {
        for (const w of this.wires) {
            sim.addWire(w)
        }
    }

    undo(sim: Sim) {
        for (const w of this.wires) {
            sim.removeWire(w)
        }
    }
}

export class RemoveWiresCommand implements Command {
    constructor(private wires: Wire[]) { }

    do(sim: Sim) {
        for (const w of this.wires) {
            sim.removeWire(w)
        }
    }

    undo(sim: Sim) {
        for (const w of this.wires) {
            sim.addWire(w)
        }
    }
}