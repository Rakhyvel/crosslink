export function promptModal(message: string, defaultValue = ""): Promise<string | null> {
    return new Promise((resolve) => {
        const modal = document.getElementById("modal")!
        const label = document.getElementById("modalLabel")!
        const input = document.getElementById("modalInput") as HTMLInputElement
        const ok = document.getElementById("modalOk")!
        const cancel = document.getElementById("modalCancel")!

        label.textContent = message
        input.value = defaultValue

        modal.style.display = "flex"
        input.focus()

        const cleanup = () => {
            modal.style.display = "none"
            ok.removeEventListener("click", onOk)
            cancel.removeEventListener("click", onCancel)
            input.removeEventListener("keydown", onKey)
        }

        const onOk = () => {
            cleanup()
            resolve(input.value)
        }
        const onCancel = () => {
            cleanup()
            resolve(null)
        }
        const onKey = (e: KeyboardEvent) => {
            if (e.key === "Enter") onOk()
            else if (e.key === "Escape") onCancel()
        }

        ok.addEventListener("click", onOk)
        cancel.addEventListener("click", onCancel)
        input.addEventListener("keydown", onKey)
    })
}