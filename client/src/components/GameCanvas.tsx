
/*
 * GameCanvas — Real Reel Machine with Sprite Sheet
 */

import { useEffect, useRef, useState } from 'react';
import * as PIXI from 'pixi.js';
import { GameEngine, GridCell, WinInfo } from '../lib/gameEngine';
import symbolsConfig from '../config/symbols.json';

interface GameCanvasProps {
  gameEngine: GameEngine;
  isSpinning?: boolean;
  onSpinComplete?: (result: any) => void;
}

const CANVAS_W = 800;
const CANVAS_H = 500;
const ROWS     = symbolsConfig.gridSize.rows;
const COLS     = symbolsConfig.gridSize.columns;
const CW       = CANVAS_W / COLS;
const CH       = CANVAS_H / ROWS;
const BUFFER   = 4;

const SPIN_SPEED   = 28;
const DECEL        = 0.55;
const STOP_DELAY   = 160;
const SPIN_BASE_MS = 1800;

const GRAVITY = 1.3;
const BOUNCE  = 0.28;

const SHEET_FRAMES: Record<string, { x: number; y: number; w: number; h: number }> = {
  burger:  { x: 0,   y: 50,  w: 341, h: 236 },
  drink:   { x: 321, y: 30,  w: 341, h: 256 },
  pie:     { x: 642, y: 30,  w: 342, h: 276 },
  scatter: { x: 0,   y: 256, w: 341, h: 256 },
  pizza:   { x: 331, y: 300, w: 341, h: 256 },
  taco:    { x: 642, y: 300, w: 342, h: 256 },
  fries:   { x: 0,   y: 555, w: 341, h: 226 },
  burrito: { x: 331, y: 545, w: 331, h: 216 },
  hotdog:  { x: 642, y: 542, w: 342, h: 216 },
  wrap:    { x: 200, y: 775, w: 290, h: 226 },
  chicken: { x: 510, y: 758, w: 240, h: 226 },
};

const FOOD_IDS = Object.keys(SHEET_FRAMES).filter(k => k !== 'scatter');

interface ReelSlot {
  container: PIXI.Container;
  sprite:    PIXI.Sprite;
  bg:        PIXI.Graphics;
  symbolId:  string;
}

interface Reel {
  container: PIXI.Container;
  slots:     ReelSlot[];
  vel:       number;
  spinning:  boolean;
}

export default function GameCanvas({ gameEngine, isSpinning = false, onSpinComplete }: GameCanvasProps) {
  const mountRef   = useRef<HTMLDivElement>(null);
  const appRef     = useRef<PIXI.Application | null>(null);
  const reelsRef   = useRef<Reel[]>([]);
  const fxLayerRef = useRef<PIXI.Container | null>(null);
  const textureMap = useRef<Map<string, PIXI.Texture>>(new Map());
  const busyRef    = useRef(false);

  const [ready, setReady] = useState(false);
  const [err,   setErr  ] = useState<string | null>(null);

  useEffect(() => {
    if (!mountRef.current) return;
    let alive = true;

    (async () => {
      try {
        const app = new PIXI.Application();
        await app.init({
          width: CANVAS_W, height: CANVAS_H,
          backgroundColor: 0x1a1a1a,
          antialias: true,
          resolution: window.devicePixelRatio || 1,
          autoDensity: true,
        });
        if (!alive) return;

        app.ticker.maxFPS = 60;
        mountRef.current!.innerHTML = '';
        mountRef.current!.appendChild(app.canvas as HTMLCanvasElement);
        appRef.current = app;

        await loadTextures(app);
        buildReels(app);
        const state = gameEngine.getState();
        fillReelsWithGrid(state.grid, true);
        setReady(true);
      } catch (e: any) {
        setErr(String(e?.message ?? e));
      }
    })();

    return () => { alive = false; destroyAll(); };
  }, []);

  /* ── Spin trigger ── */
  useEffect(() => {
    if (!ready || !isSpinning || busyRef.current) return;
    const state = gameEngine.getState();

    // ─── ИСПРАВЛЕНИЕ БАГА С ПОБЕДНОЙ ЛОГИКОЙ ───
    // ПРОБЛЕМА: state.grid = финальная сетка ПОСЛЕ всех каскадов.
    // animateReels(state.grid) показывал финал, а потом doCascade подсвечивал
    // позиции из первого каскада — там уже другие символы. Отсюда "разные символы в победе".
    //
    // РЕШЕНИЕ: animateReels показывает начальную сетку (до первого каскада).
    // Берём её из cascadeSteps[0].gridBeforeRemoval — это сетка сразу после
    // генерации барабанов, до первого взрыва.
    const initialGrid = state.cascadeSteps.length > 0
      ? state.cascadeSteps[0].gridBeforeRemoval
      : state.grid;

    runSpinSequence(initialGrid, state.cascadeSteps ?? []);
  }, [isSpinning, ready]);

  const loadTextures = async (app: PIXI.Application) => {
    const baseTexture = await PIXI.Assets.load('/symbols.png');
    for (const [id, f] of Object.entries(SHEET_FRAMES)) {
      const frame = new PIXI.Rectangle(f.x, f.y, f.w, f.h);
      const tex   = new PIXI.Texture({ source: baseTexture.source, frame });
      textureMap.current.set(id, tex);
    }
  };

  const getTexture = (id: string): PIXI.Texture => {
    return textureMap.current.get(id) ?? PIXI.Texture.WHITE;
  };

  const buildReels = (app: PIXI.Application) => {
    const bg = new PIXI.Graphics();
    bg.rect(0, 0, CANVAS_W, CANVAS_H).fill(0x1e1e2e);
    app.stage.addChild(bg);

    const clipMask = new PIXI.Graphics();
    clipMask.rect(0, 0, CANVAS_W, CANVAS_H).fill(0xffffff);
    app.stage.addChild(clipMask);

    for (let col = 0; col < COLS; col++) {
      const container = new PIXI.Container();
      container.x = col * CW;
      container.mask = clipMask;
      app.stage.addChild(container);

      const slots: ReelSlot[] = [];
      const total = ROWS + BUFFER * 2;

      for (let i = 0; i < total; i++) {
        const slot = buildSlot(FOOD_IDS[i % FOOD_IDS.length]);
        slot.container.y = (i - BUFFER) * CH;
        container.addChild(slot.container);
        slots.push(slot);
      }

      reelsRef.current.push({ container, slots, vel: 0, spinning: false });
    }

    const lines = new PIXI.Graphics();
    for (let col = 1; col < COLS; col++) {
      lines.moveTo(col * CW, 0).lineTo(col * CW, CANVAS_H);
    }
    lines.stroke({ width: 2, color: 0x333355 });
    app.stage.addChild(lines);

    const fx = new PIXI.Container();
    fxLayerRef.current = fx;
    app.stage.addChild(fx);
  };

  const buildSlot = (symbolId: string): ReelSlot => {
    const container = new PIXI.Container();
    const bg = new PIXI.Graphics();
    bg.roundRect(2, 2, CW - 4, CH - 4, 6).fill(0x2a2a3e).stroke({ width: 1.5, color: 0x444466 });
    container.addChild(bg);
    const sprite = new PIXI.Sprite(getTexture(symbolId));
    sprite.anchor.set(0.5);
    sprite.position.set(CW / 2, CH / 2);
    fitSprite(sprite, CW - 12, CH - 12);
    container.addChild(sprite);
    return { container, sprite, bg, symbolId };
  };

  const fitSprite = (sprite: PIXI.Sprite, maxW: number, maxH: number) => {
    const tex = sprite.texture;
    if (!tex.width || !tex.height) return;
    const scale = Math.min(maxW / tex.width, maxH / tex.height);
    sprite.scale.set(scale);
  };

  const fillReelsWithGrid = (grid: GridCell[][], resetPositions = false) => {
    for (let col = 0; col < COLS; col++) {
      const reel = reelsRef.current[col];
      if (!reel) continue;

      if (resetPositions) {
        reel.container.y = 0;
        reel.vel = 0;
        reel.spinning = false;
      }

      for (let row = 0; row < ROWS; row++) {
        const slot = reel.slots[row + BUFFER];
        const cell = grid[row]?.[col];
        if (slot && cell) {
          setSlotSymbol(slot, cell.symbol.id);
          slot.container.y = row * CH;
          resetSlotAppearance(slot);
        }
      }

      for (let i = 0; i < BUFFER; i++) {
        const topSlot = reel.slots[i];
        topSlot.container.y = (i - BUFFER) * CH;
        setSlotSymbol(topSlot, randomFood());
        resetSlotAppearance(topSlot);

        const botSlot = reel.slots[ROWS + BUFFER + i];
        botSlot.container.y = (ROWS + i) * CH;
        setSlotSymbol(botSlot, randomFood());
        resetSlotAppearance(botSlot);
      }
    }
  };

  const setSlotSymbol = (slot: ReelSlot, id: string) => {
    slot.symbolId = id;
    const tex = getTexture(id);
    slot.sprite.texture = tex;
    fitSprite(slot.sprite, CW - 12, CH - 12);
  };

  const resetSlotAppearance = (slot: ReelSlot) => {
    slot.container.visible = true;
    slot.container.alpha   = 1;
    slot.container.scale.set(1);
    slot.container.rotation = 0;
    slot.bg.clear();
    slot.bg.roundRect(2, 2, CW - 4, CH - 4, 6).fill(0x2a2a3e).stroke({ width: 1.5, color: 0x444466 });
  };

  const randomFood = () => FOOD_IDS[Math.floor(Math.random() * FOOD_IDS.length)];

  /* ════════════════════════════════════
     SPIN SEQUENCE
     initialGrid — сетка ДО каскадов (показывается при остановке барабанов)
     cascadeSteps — массив шагов, каждый знает свои победы и финальную сетку
  ════════════════════════════════════ */
  const runSpinSequence = async (initialGrid: GridCell[][], cascadeSteps: any[]) => {
    busyRef.current = true;
    try {
      await animateReels(initialGrid);
      await sleep(250);
      for (const step of cascadeSteps) {
        await doCascade(step);
      }
    } finally {
      busyRef.current = false;
      onSpinComplete?.({});
    }
  };

  /* ════════════════════════════════════
     REEL SPIN ANIMATION
  ════════════════════════════════════ */
  const animateReels = (finalGrid: GridCell[][]): Promise<void> => {
    return new Promise(resolve => {
      const app = appRef.current!;
      let elapsed = 0;

      const totalReelH = (ROWS + BUFFER * 2) * CH;

      const finalSymbolsPerCol: string[][] = [];
      for (let col = 0; col < COLS; col++) {
        finalSymbolsPerCol[col] = [];
        for (let row = 0; row < ROWS; row++) {
          finalSymbolsPerCol[col][row] = finalGrid[row][col].symbol.id;
        }
      }

      for (let col = 0; col < COLS; col++) {
        const reel = reelsRef.current[col];
        reel.container.y = 0;
        reel.vel = SPIN_SPEED;
        reel.spinning = true;

        const total = ROWS + BUFFER * 2;
        for (let i = 0; i < total; i++) {
          const slot = reel.slots[i];
          slot.container.y = (i - BUFFER) * CH;
          slot.container.visible = true;
          slot.container.alpha = 1;
          slot.container.scale.set(1);
          slot.container.rotation = 0;
          setSlotSymbol(slot, randomFood());
          resetSlotAppearance(slot);
        }
      }

      const finalLoaded = new Array(COLS).fill(false);

      const tick = (ticker: PIXI.Ticker) => {
        elapsed += ticker.deltaTime * (1000 / 60);
        let allDone = true;

        reelsRef.current.forEach((reel, col) => {
          if (!reel.spinning) return;
          allDone = false;

          const stopAt = SPIN_BASE_MS + col * STOP_DELAY;

          if (elapsed >= stopAt) {
            reel.vel = Math.max(0, reel.vel - DECEL);

            if (!finalLoaded[col] && reel.vel < SPIN_SPEED * 0.6) {
              finalLoaded[col] = true;

              const slotsWithY = reel.slots.map((slot) => ({
                slot,
                screenY: slot.container.y + reel.container.y,
              }));

              const aboveScreen = slotsWithY
                .filter(s => s.screenY < -CH * 0.5)
                .sort((a, b) => b.screenY - a.screenY);

              for (let row = 0; row < ROWS && row < aboveScreen.length; row++) {
                setSlotSymbol(aboveScreen[row].slot, finalSymbolsPerCol[col][row]);
              }
            }
          }

          if (reel.vel > 0) {
            reel.container.y += reel.vel;

            reel.slots.forEach(slot => {
              const screenY = slot.container.y + reel.container.y;
              if (screenY > CANVAS_H + CH) {
                slot.container.y -= totalReelH;
                if (!finalLoaded[col]) {
                  setSlotSymbol(slot, randomFood());
                }
                slot.container.visible = true;
                slot.container.alpha = 1;
              }
            });
          } else {
            reel.vel = 0;
            reel.spinning = false;
            reel.container.y = 0;

            for (let row = 0; row < ROWS; row++) {
              const slot = reel.slots[row + BUFFER];
              if (!slot) continue;
              setSlotSymbol(slot, finalSymbolsPerCol[col][row]);
              slot.container.y = row * CH;
              slot.container.visible = true;
              slot.container.alpha = 1;
              slot.container.scale.set(1);
              slot.container.rotation = 0;
              slot.bg.clear();
              slot.bg.roundRect(2, 2, CW - 4, CH - 4, 6).fill(0x2a2a3e).stroke({ width: 1.5, color: 0x444466 });
            }

            for (let i = 0; i < BUFFER; i++) {
              reel.slots[i].container.y = (i - BUFFER) * CH;
              reel.slots[ROWS + BUFFER + i].container.y = (ROWS + i) * CH;
            }
          }
        });

        if (allDone) {
          app.ticker.remove(tick);

          for (let col = 0; col < COLS; col++) {
            const reel = reelsRef.current[col];
            reel.container.y = 0;
            for (let row = 0; row < ROWS; row++) {
              const slot = reel.slots[row + BUFFER];
              if (!slot) continue;
              setSlotSymbol(slot, finalSymbolsPerCol[col][row]);
              slot.container.y = row * CH;
              slot.container.visible = true;
              slot.container.alpha = 1;
              slot.container.scale.set(1);
              slot.container.rotation = 0;
              slot.bg.clear();
              slot.bg.roundRect(2, 2, CW - 4, CH - 4, 6).fill(0x2a2a3e).stroke({ width: 1.5, color: 0x444466 });
            }
          }

          resolve();
        }
      };

      app.ticker.add(tick);
    });
  };

  /* ════════════════════════════════════
     CASCADE
  ════════════════════════════════════ */
  const doCascade = async (step: any) => {
    const winPositions = new Set<string>();
    (step.wins as WinInfo[]).forEach(w =>
      w.cells.forEach(c => winPositions.add(`${c.row}-${c.col}`))
    );

    // Убеждаемся что на экране правильные символы перед подсветкой
    // Используем gridBeforeRemoval — сетку до взрыва этого каскада
    if (step.gridBeforeRemoval) {
      for (const pos of winPositions) {
        const [row, col] = pos.split('-').map(Number);
        const slot = getSlotAtRC(row, col);
        const cell = step.gridBeforeRemoval[row]?.[col];
        if (slot && cell) {
          // Если символ не совпадает — исправляем (защита от рассинхронизации)
          if (slot.symbolId !== cell.symbol.id) {
            setSlotSymbol(slot, cell.symbol.id);
            resetSlotAppearance(slot);
          }
        }
      }
    }

    await highlightCells(winPositions);
    await explodeCells(winPositions);
    await dropAndFill(step.gridAfterFill as GridCell[][]);
    await sleep(180);
  };

  /* ── Highlight ── */
  const highlightCells = (positions: Set<string>): Promise<void> =>
    new Promise(resolve => {
      const app = appRef.current!;
      let t = 0;
      const dur = 380;

      const tick = (ticker: PIXI.Ticker) => {
        t += ticker.deltaTime * (1000 / 60);
        const p = Math.min(t / dur, 1);
        const scale = 1 + Math.sin(p * Math.PI * 3.5) * 0.12;

        positions.forEach(pos => {
          const slot = getSlotAt(pos);
          if (!slot) return;
          slot.container.scale.set(scale);
          slot.bg.clear();
          slot.bg.roundRect(2, 2, CW - 4, CH - 4, 6)
            .fill(0xffdd00)
            .stroke({ width: 2.5, color: 0xff9900 });
        });

        if (p >= 1) { app.ticker.remove(tick); resolve(); }
      };
      app.ticker.add(tick);
    });

  /* ── Explode ── */
  const explodeCells = (positions: Set<string>): Promise<void> =>
    new Promise(resolve => {
      const app = appRef.current!;
      let t = 0;
      const dur = 500;

      positions.forEach(pos => {
        const [r, c] = pos.split('-').map(Number);
        spawnParticles(c * CW + CW / 2, r * CH + CH / 2);
      });

      const tick = (ticker: PIXI.Ticker) => {
        t += ticker.deltaTime * (1000 / 60);
        const p = Math.min(t / dur, 1);

        positions.forEach(pos => {
          const slot = getSlotAt(pos);
          if (!slot) return;
          slot.container.scale.set(1 + Math.sin(p * Math.PI) * 0.55);
          slot.container.rotation = p * Math.PI * 2;
          slot.container.alpha    = 1 - p;
          slot.bg.clear();
          slot.bg.roundRect(2, 2, CW - 4, CH - 4, 6)
            .fill(lerpColor(0xff4400, 0xff0000, p))
            .stroke({ width: 3, color: 0xff0000 });
        });

        if (p >= 1) {
          positions.forEach(pos => {
            const slot = getSlotAt(pos);
            if (slot) {
              slot.container.visible = false;
              slot.container.alpha = 0;
              slot.container.y = -9999;
            }
          });
          app.ticker.remove(tick);
          resolve();
        }
      };
      app.ticker.add(tick);
    });

  /* ── Drop & Fill with physics ── */
  const dropAndFill = (finalGrid: GridCell[][]): Promise<void> =>
    new Promise(resolve => {
      const app = appRef.current!;

      type Item = { slot: ReelSlot; targetY: number; vy: number; landed: boolean };
      const items: Item[] = [];

      for (let col = 0; col < COLS; col++) {
        const reel = reelsRef.current[col];
        if (!reel) continue;
        reel.container.y = 0;

        for (let row = 0; row < ROWS; row++) {
          const slot = reel.slots[row + BUFFER];
          const cell = finalGrid[row]?.[col];
          if (!slot || !cell) continue;

          setSlotSymbol(slot, cell.symbol.id);
          slot.container.visible = true;
          slot.container.alpha = 1;
          slot.container.scale.set(1);
          slot.container.rotation = 0;
          slot.bg.clear();
          slot.bg.roundRect(2, 2, CW - 4, CH - 4, 6)
            .fill(0x2a2a3e)
            .stroke({ width: 1.5, color: 0x444466 });

          const targetY = row * CH;
          slot.container.y = targetY - CH * (BUFFER + 1);
          items.push({ slot, targetY, vy: 0, landed: false });
        }
      }

      const tick = (ticker: PIXI.Ticker) => {
        let allDone = true;

        items.forEach(item => {
          if (item.landed) return;
          item.vy += GRAVITY;
          item.slot.container.y += item.vy;

          if (item.slot.container.y >= item.targetY) {
            item.slot.container.y = item.targetY;
            item.vy = -(item.vy * BOUNCE);
            if (Math.abs(item.vy) < 0.6) {
              item.vy = 0;
              item.slot.container.y = item.targetY;
              item.landed = true;
              item.slot.container.visible = true;
              item.slot.container.alpha = 1;
            }
          }

          if (!item.landed) allDone = false;
        });

        if (allDone) {
          app.ticker.remove(tick);
          for (let col = 0; col < COLS; col++) {
            const reel = reelsRef.current[col];
            if (!reel) continue;
            for (let row = 0; row < ROWS; row++) {
              const slot = reel.slots[row + BUFFER];
              const cell = finalGrid[row]?.[col];
              if (slot && cell) {
                slot.container.y = row * CH;
                slot.container.visible = true;
                slot.container.alpha = 1;
                slot.container.scale.set(1);
                slot.container.rotation = 0;
              }
            }
          }
          resolve();
        }
      };

      app.ticker.add(tick);
    });

  /* ════════════════════════════════════
     PARTICLES
  ════════════════════════════════════ */
  const spawnParticles = (x: number, y: number) => {
    const fx = fxLayerRef.current;
    const app = appRef.current;
    if (!fx || !app) return;

    const count = 10;
    const particles: (PIXI.Graphics & { vx: number; vy: number; life: number })[] = [];

    for (let i = 0; i < count; i++) {
      const p = new PIXI.Graphics() as any;
      const size = 3 + Math.random() * 3;
      p.circle(0, 0, size).fill([0xffaa00, 0xff4400, 0xffff00][i % 3]);
      const angle = (Math.PI * 2 * i) / count + Math.random() * 0.4;
      const speed = 4 + Math.random() * 3;
      p.position.set(x, y);
      p.vx = Math.cos(angle) * speed;
      p.vy = Math.sin(angle) * speed;
      p.life = 1;
      particles.push(p);
      fx.addChild(p);
    }

    const tick = (ticker: PIXI.Ticker) => {
      let alive = false;
      particles.forEach(p => {
        if (p.life <= 0) return;
        alive = true;
        p.x    += p.vx;
        p.y    += p.vy;
        p.vy   += 0.18;
        p.life -= 0.025;
        p.alpha = Math.max(0, p.life);
      });
      if (!alive) {
        app.ticker.remove(tick);
        particles.forEach(p => p.destroy());
      }
    };
    app.ticker.add(tick);
  };

  /* ════════════════════════════════════
     HELPERS
  ════════════════════════════════════ */
  const getSlotAt = (key: string): ReelSlot | null => {
    const [row, col] = key.split('-').map(Number);
    return getSlotAtRC(row, col);
  };

  const getSlotAtRC = (row: number, col: number): ReelSlot | null => {
    const reel = reelsRef.current[col];
    if (!reel) return null;
    return reel.slots[row + BUFFER] ?? null;
  };

  const sleep = (ms: number) => new Promise<void>(r => setTimeout(r, ms));

  const lerpColor = (a: number, b: number, t: number): number => {
    const ar = (a >> 16) & 0xff, ag = (a >> 8) & 0xff, ab = a & 0xff;
    const br = (b >> 16) & 0xff, bg = (b >> 8) & 0xff, bb = b & 0xff;
    return ((ar + (br - ar) * t) << 16) |
           ((ag + (bg - ag) * t) << 8)  |
            (ab + (bb - ab) * t);
  };

  const destroyAll = () => {
    try {
      appRef.current?.ticker.stop();
      reelsRef.current.forEach(r => r.container.destroy({ children: true }));
      reelsRef.current = [];
      fxLayerRef.current?.destroy({ children: true });
      appRef.current?.destroy(true, { children: true, texture: true, baseTexture: true });
      appRef.current = null;
    } catch { /* ignore */ }
  };

  if (err) {
    return (
      <div style={{ width: CANVAS_W, height: CANVAS_H }}
           className="flex items-center justify-center bg-red-900 text-white rounded p-4">
        <div className="text-center">
          <div className="text-lg font-bold mb-1">Game Error</div>
          <div className="text-sm opacity-80">{err}</div>
          <div className="text-xs mt-2 opacity-60">Make sure /public/symbols.png exists</div>
        </div>
      </div>
    );
  }

  return (
    <div ref={mountRef}
         style={{ width: CANVAS_W, height: CANVAS_H, overflow: 'hidden' }}
         className="rounded-lg shadow-2xl" />
  );
}