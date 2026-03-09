export type Serialized = {
    components: {
        id: string
        type: string
        name: string | undefined
        position: { x: number, y: number }
    }[]
    wires: {
        fromComponentId: string
        fromPortIndex: number
        toComponentId: string
        toPortIndex: number
    }[]
}