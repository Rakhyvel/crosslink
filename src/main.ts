import './style.css'

import { AndGate, Button, Led, NotGate, type MouseInteractable } from './components.ts'
import { Sim } from './sim.ts'
import { Vec2 } from './vec.ts'

// TODO:
// - [x] connections
// - [x] and, or, not components
// - [x] dragging with snap
// - [x] new wire/reset wire from dragging from port
// - [x] button/switch, LEDs components
// - [x] new component from dragging from palette

const canvas = document.createElement("canvas");
document.body.style.margin = "0"
document.body.appendChild(canvas);

const ctx = canvas.getContext("2d")!;

function resize() {
    canvas.width = window.innerWidth * 0.8
    canvas.height = window.innerHeight
}
window.addEventListener("resize", resize)
resize()

function frame(now: number) {
    ctx.clearRect(0, 0, canvas.width, canvas.height)

    sim.update(now)
    sim.draw(ctx)

    requestAnimationFrame(frame)
}

const sim = new Sim(60)

function getMousePos(e: MouseEvent): Vec2 {
    const rect = canvas.getBoundingClientRect()
    return new Vec2(
        e.clientX - rect.left,
        e.clientY - rect.top
    )
}

canvas.addEventListener("mousedown", (e) => {
    const mouse = getMousePos(e)

    // check interactive components
    for (const c of sim.components) {
        if ("onMouseDown" in c && "onMouseUp" in c && "contains" in c) {
            const interactive = c as MouseInteractable
            if (interactive.contains(mouse)) {
                interactive.onMouseDown()
            }
        }
    }

    // Check if clicking on any port
    for (const c of sim.components) {
        for (const p of [...c.inputs, ...c.outputs]) {
            const pos = p.getWorldPos()
            const clickableRadius = 6
            if (Math.abs(mouse.x - pos.x) < clickableRadius && Math.abs(mouse.y - pos.y) < clickableRadius) {
                sim.startWireDrag(p, mouse)
                return // stop here
            }
        }
    }

    // Check if clicking any component
    for (const c of sim.components) {
        if (mouse.x >= c.pos.x && mouse.x <= c.pos.x + c.size.x &&
            mouse.y >= c.pos.y && mouse.y <= c.pos.y + c.size.y
        ) {
            sim.startComponentDrag(c, mouse)
            return
        }
    }
})

window.addEventListener("mousemove", (e) => {
    const mouse = getMousePos(e)
    sim.handleMouseMove(mouse)
    sim.handlePaletteMouseMove(mouse)
})

window.addEventListener("mouseup", (e) => {
    const mouse = getMousePos(e)
    sim.exitPaletteDrag(mouse)
    sim.handleMouseUp(mouse)

    for (const c of sim.components) {
        if ("onMouseDown" in c && "onMouseUp" in c && "contains" in c) {
            const interactive = c as MouseInteractable
            interactive.onMouseUp()
        }
    }
})

document.querySelectorAll(".palette-item").forEach(el => {
    el.addEventListener("mousedown", e => {
        sim.startPaletteDrag((el as HTMLElement).dataset.type!, new Vec2(e.clientX, e.clientY))
    })
})

// Begin that splish
requestAnimationFrame(frame)
