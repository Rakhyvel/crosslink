import { BoardSize } from "./boardSize"

export type Serialized = {
    size: BoardSize
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