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

const canvas = document.getElementById("sim-canvas") as HTMLCanvasElement

function resizeCanvas() {
    const rect = canvas.getBoundingClientRect()
    canvas.width = rect.width
    canvas.height = rect.height
}

const resizeObserver = new ResizeObserver(resizeCanvas)
resizeObserver.observe(canvas)

resizeCanvas()

function frame(now: number) {
    sim.update(now)
    sim.draw()

    requestAnimationFrame(frame)
}

const sim = new Sim(canvas, 60)

function getMousePos(e: MouseEvent): Vec2 {
    const rect = canvas.getBoundingClientRect()
    return new Vec2(
        e.clientX - rect.left,
        e.clientY - rect.top
    )
}

canvas.addEventListener("mousedown", (e) => {
    const mouse = getMousePos(e)
    sim.handleMouseDown(mouse)
})

window.addEventListener("mousemove", (e) => {
    const mouse = getMousePos(e)
    sim.handleMouseMove(mouse, e)
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
        const mouse = getMousePos(e)
        sim.startPaletteDrag((el as HTMLElement).dataset.type!, mouse)
    })
})

// Begin that splish
requestAnimationFrame(frame)
