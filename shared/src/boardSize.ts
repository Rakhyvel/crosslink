import { Vec2 } from "./vec";

export const pitch: number = 20

export enum BoardSize {
    Small,
    Medium,
    Large
}

export const boardSizes: Record<BoardSize, Vec2> = {
    [BoardSize.Small]: new Vec2(11, 8).scale(pitch),
    [BoardSize.Medium]: new Vec2(24, 18).scale(pitch),
    [BoardSize.Large]: new Vec2(32, 22).scale(pitch),
};