import './style.css'

import { type MouseInteractable } from './components.ts'
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

const startButton = document.getElementById("start")! as HTMLButtonElement
const stopButton = document.getElementById("stop")! as HTMLButtonElement
const stepButton = document.getElementById("step")! as HTMLButtonElement
const clearButton = document.getElementById("clear")! as HTMLButtonElement
const slider = document.getElementById("tick-slider") as HTMLInputElement

function frame() {
    startButton.disabled = sim.enabled
    stopButton.disabled = !sim.enabled
    stepButton.disabled = sim.enabled

    sim.updateIfEnabled()
    sim.draw()

    requestAnimationFrame(frame)
}

const sim = new Sim(canvas, 0.1)

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
    sim.handleMouseMove(mouse)
})

window.addEventListener("mouseup", (e) => {
    const mouse = getMousePos(e)
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
        const mouse = getMousePos(e as MouseEvent)
        sim.startPaletteDrag((el as HTMLElement).dataset.type!, mouse)
    })
})

startButton.addEventListener("click", () => {
    sim.enabled = true
})

stopButton.addEventListener("click", () => {
    sim.enabled = false
})

stepButton.addEventListener("click", () => {
    sim.step()
})

clearButton.addEventListener("click", () => {
    sim.clear()
})

slider.addEventListener("input", () => {
    const min = 0.001
    const max = 1000

    function sliderToTickMs(v: number) {
        // v in [0,1]
        return (10 ** (v * (Math.log10(max) - Math.log10(min)) + Math.log10(min)))
    }

    const val = parseFloat(slider.value)
    const tickMs = sliderToTickMs(1.0 - val)
    sim.tickMs = tickMs
})

// Begin that splish
requestAnimationFrame(frame)
