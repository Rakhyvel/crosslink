import type { Serialized } from "shared"

export class ComponentAPI {
    user: string

    constructor(user: string) {
        this.user = user
    }

    async getAll() {
        const res = await fetch(`/api/components?user=${encodeURIComponent(this.user)}`)
        if (!res.ok) throw new Error("Failed to fetch components")
        return res.json()
    }

    async save(name: string, data: Serialized) {
        const res = await fetch(`/api/components?user=${encodeURIComponent(this.user)}`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({ name, data })
        })

        if (!res.ok) throw new Error("Failed to save component")
        return res.json()
    }

    async delete(name: string) {
        const res = await fetch(`/api/components?user=${encodeURIComponent(this.user)}`, {
            method: "DELETE",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({ name })
        })

        if (!res.ok) throw new Error("Failed to save component")
        return res.json()
    }
}