import './style.css'

import { Sim } from './sim.ts'
import { Vec2 } from './vec.ts'

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
const undoButton = document.getElementById("undo")! as HTMLButtonElement
const redoButton = document.getElementById("redo")! as HTMLButtonElement
const slider = document.getElementById("tick-slider") as HTMLInputElement

function frame() {
    startButton.disabled = sim.enabled
    stopButton.disabled = !sim.enabled
    stepButton.disabled = sim.enabled
    undoButton.disabled = sim.history.undoDepth() == 0
    redoButton.disabled = sim.history.redoDepth() == 0

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

canvas.addEventListener("mousedown", e => {
    sim.handleMouseDown(e)
})

window.addEventListener("mousemove", (e) => {
    const mouse = getMousePos(e)
    sim.handleMouseMove(mouse)
})

window.addEventListener("mouseup", _ => {
    sim.handleMouseUp()
})

window.addEventListener("keydown", async (e: KeyboardEvent) => {
    if (e.ctrlKey) {
        e.preventDefault();
        if (e.key.toLowerCase() == "a") {
            sim.selectAll()
        } else if (e.key.toLowerCase() === "c") {
            await sim.copySelected();
        } else if (e.key.toLowerCase() === "s") {
            await sim.save()
        } else if (e.key.toLowerCase() === "v") {
            try {
                const text = await navigator.clipboard.readText();
                sim.paste(text);
            } catch (err) {
                console.warn("Clipboard does not contain valid circuit data", err);
            }
        } else if (e.key.toLowerCase() == "y") {
            sim.redo()
        } else if (e.key.toLowerCase() == "z") {
            sim.undo()
        }
    } else if (e.key === "Backspace" || e.key === "Delete") {
        e.preventDefault()
        sim.clearSelected()
    } else if (e.key === " ") {
        sim.enabled = !sim.enabled
    }
});

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

undoButton.addEventListener("click", () => {
    sim.undo()
})

redoButton.addEventListener("click", () => {
    sim.redo()
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
