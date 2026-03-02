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

type SaveChoice = "save" | "discard" | "cancel"

export function confirmSaveModal(message: string): Promise<"save" | "discard" | "cancel"> {
    return new Promise((resolve) => {
        const modal = document.getElementById("saveModal")!
        const label = document.getElementById("saveModalLabel")!
        const save = document.getElementById("saveModalSave")!
        const discard = document.getElementById("saveModalDiscard")!
        const cancel = document.getElementById("saveModalCancel")!

        label.textContent = message
        modal.style.display = "flex"

        // Focus Save by default
        ;(save as HTMLButtonElement).focus()

        const cleanup = () => {
            modal.style.display = "none"
            save.removeEventListener("click", onSave)
            discard.removeEventListener("click", onDiscard)
            cancel.removeEventListener("click", onCancel)
            document.removeEventListener("keydown", onKey)
        }

        const onSave = () => {
            cleanup()
            resolve("save")
        }

        const onDiscard = () => {
            cleanup()
            resolve("discard")
        }

        const onCancel = () => {
            cleanup()
            resolve("cancel")
        }

        const onKey = (e: KeyboardEvent) => {
            if (e.key === "Enter") onSave()
            else if (e.key === "Escape") onCancel()
        }

        save.addEventListener("click", onSave)
        discard.addEventListener("click", onDiscard)
        cancel.addEventListener("click", onCancel)
        document.addEventListener("keydown", onKey)
    })
}