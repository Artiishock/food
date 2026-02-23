export interface SpriteFrame {
  x: number;
  y: number;
  w: number;
  h: number;
}

export const SHEET_FRAMES: Record<string, SpriteFrame> = {
  burger:  { x: 0,   y: 50,  w: 341, h: 236 },
  drink:   { x: 321, y: 30,  w: 341, h: 256 },
  pie:     { x: 642, y: 30,  w: 342, h: 276 },
  scatter: { x: 0,   y: 300, w: 341, h: 256 },
  pizza:   { x: 331, y: 300, w: 341, h: 256 },
  taco:    { x: 642, y: 300, w: 342, h: 256 },
  fries:   { x: 0,   y: 555, w: 341, h: 226 },
  burrito: { x: 331, y: 545, w: 331, h: 216 },
  hotdog:  { x: 642, y: 542, w: 342, h: 216 },
  wrap:    { x: 200, y: 775, w: 290, h: 226 },
  chicken: { x: 510, y: 758, w: 240, h: 226 },
};

export const SHEET_W = 1024;
export const SHEET_H = 1024;