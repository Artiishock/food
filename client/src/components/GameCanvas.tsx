
/*
 * GameCanvas — Real Reel Machine with Sprite Sheet
 *
 * SETUP: Copy symbols.png into client/public/symbols.png
 *
 * Architecture:
 *   - Each reel has a container with (ROWS + BUFFER*2) sprites
 *   - Container.y scrolls down; sprites wrap around for infinite scroll
 *   - No symbols are ever destroyed – only texture + position update
 *   - After stop: snap to grid, write final symbols
 *   - Cascades: explode → drop with gravity → fill from top
 */

import { useEffect, useRef, useState } from 'react';
import * as PIXI from 'pixi.js';
import { GameEngine, GridCell, WinInfo } from '../lib/gameEngine';
import symbolsConfig from '../config/symbols.json';

/* ─────────────── Config ─────────────── */

interface GameCanvasProps {
  gameEngine: GameEngine;
  isSpinning?: boolean;
  onSpinComplete?: (result: any) => void;
}

const CANVAS_W = 800;
const CANVAS_H = 500;
const ROWS     = symbolsConfig.gridSize.rows;      // 5
const COLS     = symbolsConfig.gridSize.columns;   // 6
const CW       = CANVAS_W / COLS;   // cell width  ≈ 133
const CH       = CANVAS_H / ROWS;   // cell height = 100
const BUFFER   = 4;                 // extra symbols above + below viewport

// Reel physics
const SPIN_SPEED   = 28;   // px per frame
const DECEL        = 0.55; // px²/frame deceleration
const STOP_DELAY   = 160;  // ms between each reel stopping
const SPIN_BASE_MS = 1800; // base spin duration

// Cascade physics
const GRAVITY = 1.3;
const BOUNCE  = 0.28;

/* ─────────────── Sprite-sheet frames ─────────────── */

// symbols.png is 1024×1024, 3×4 grid (last row has 2 centered items)
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

/* ─────────────── Types ─────────────── */

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

/* ═══════════════════════════════════════════════════ */
/*                     COMPONENT                       */
/* ═══════════════════════════════════════════════════ */

export default function GameCanvas({ gameEngine, isSpinning = false, onSpinComplete }: GameCanvasProps) {
  const mountRef   = useRef<HTMLDivElement>(null);
  const appRef     = useRef<PIXI.Application | null>(null);
  const reelsRef   = useRef<Reel[]>([]);
  const fxLayerRef = useRef<PIXI.Container | null>(null);
  const textureMap = useRef<Map<string, PIXI.Texture>>(new Map());
  const busyRef    = useRef(false);

  const [ready, setReady] = useState(false);
  const [err,   setErr  ] = useState<string | null>(null);

  /* ── Init ── */
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
    runSpinSequence(state);
  }, [isSpinning, ready]);

  /* ════════════════════════════════════
     TEXTURE LOADING
  ════════════════════════════════════ */
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

  /* ════════════════════════════════════
     BUILD REELS
  ════════════════════════════════════ */
  const buildReels = (app: PIXI.Application) => {
    // Board background
    const bg = new PIXI.Graphics();
    bg.rect(0, 0, CANVAS_W, CANVAS_H).fill(0x1e1e2e);
    app.stage.addChild(bg);

    // Clip mask (only show 800×500 viewport)
    const clipMask = new PIXI.Graphics();
    clipMask.rect(0, 0, CANVAS_W, CANVAS_H).fill(0xffffff);
    app.stage.addChild(clipMask);

    // Per-column reel containers
    for (let col = 0; col < COLS; col++) {
      const container = new PIXI.Container();
      container.x = col * CW;
      container.mask = clipMask;
      app.stage.addChild(container);

      const slots: ReelSlot[] = [];
      const total = ROWS + BUFFER * 2;

      for (let i = 0; i < total; i++) {
        const slot = buildSlot(FOOD_IDS[i % FOOD_IDS.length]);
        // Position relative to container: slot 0 starts BUFFER cells above screen
        slot.container.y = (i - BUFFER) * CH;
        container.addChild(slot.container);
        slots.push(slot);
      }

      reelsRef.current.push({
        container,
        slots,
        vel: 0,
        spinning: false,
      });
    }

    // Reel separators (decorative)
    const lines = new PIXI.Graphics();
    for (let col = 1; col < COLS; col++) {
      lines.moveTo(col * CW, 0).lineTo(col * CW, CANVAS_H);
    }
    lines.stroke({ width: 2, color: 0x333355 });
    app.stage.addChild(lines);

    // FX layer on top
    const fx = new PIXI.Container();
    fxLayerRef.current = fx;
    app.stage.addChild(fx);
  };

  const buildSlot = (symbolId: string): ReelSlot => {
    const container = new PIXI.Container();

    // Background tile
    const bg = new PIXI.Graphics();
    bg.roundRect(2, 2, CW - 4, CH - 4, 6).fill(0x2a2a3e).stroke({ width: 1.5, color: 0x444466 });
    container.addChild(bg);

    // Symbol sprite
    const sprite = new PIXI.Sprite(getTexture(symbolId));
    sprite.anchor.set(0.5);
    sprite.position.set(CW / 2, CH / 2);
    fitSprite(sprite, CW - 12, CH - 12);
    container.addChild(sprite);

    return { container, sprite, bg, symbolId };
  };

  /** Scale sprite to fit inside maxW × maxH while keeping aspect ratio */
  const fitSprite = (sprite: PIXI.Sprite, maxW: number, maxH: number) => {
    const tex = sprite.texture;
    if (!tex.width || !tex.height) return;
    const scale = Math.min(maxW / tex.width, maxH / tex.height);
    sprite.scale.set(scale);
  };

  /* ════════════════════════════════════
     FILL REELS WITH GRID (static)
  ════════════════════════════════════ */
  const fillReelsWithGrid = (grid: GridCell[][], resetPositions = false) => {
    for (let col = 0; col < COLS; col++) {
      const reel = reelsRef.current[col];
      if (!reel) continue;

      if (resetPositions) {
        reel.container.y = 0;
        reel.vel = 0;
        reel.spinning = false;
      }

      // Set visible slots (BUFFER … BUFFER+ROWS-1)
      for (let row = 0; row < ROWS; row++) {
        const slot = reel.slots[row + BUFFER];
        const cell = grid[row]?.[col];
        if (slot && cell) {
          setSlotSymbol(slot, cell.symbol.id);
          slot.container.y = (row - 0) * CH; // relative: y=0 is top of viewport
          resetSlotAppearance(slot);
        }
      }

      // Fill buffer slots (above and below) with random food
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
  ════════════════════════════════════ */
  const runSpinSequence = async (state: any) => {
    busyRef.current = true;
    try {
      // 1. Spin (final symbols already set inside animateReels)
      await animateReels(state.grid);

      // 2. Brief pause
      await sleep(250);

      // 3. Cascades
      for (const step of (state.cascadeSteps ?? [])) {
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

      // Финальные символы для каждой колонки
      const finalSymbolsPerCol: string[][] = [];
      for (let col = 0; col < COLS; col++) {
        finalSymbolsPerCol[col] = [];
        for (let row = 0; row < ROWS; row++) {
          finalSymbolsPerCol[col][row] = finalGrid[row][col].symbol.id;
        }
      }

      // ─── ИНИЦИАЛИЗАЦИЯ ───
      // Все слоты получают СЛУЧАЙНЫЕ символы.
      // Финальные символы пока НЕ ставим ни в один слот.
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

      // Трекер: сколько полных оборотов сделал каждый рил после начала торможения
      // Используем это чтобы понять — финальные символы уже "загружены" в слоты или нет
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

            // Когда скорость упала достаточно и финальные символы ещё не загружены —
            // загружаем их в слоты которые СЕЙЧАС выше экрана (не видны пользователю).
            // Делаем это один раз на рил.
            if (!finalLoaded[col] && reel.vel < SPIN_SPEED * 0.6) {
              finalLoaded[col] = true;

              // Определяем текущее абсолютное положение каждого слота
              // и находим те что выше viewport (screenY < -CH*0.5)
              // Присваиваем финальные символы слотам с наименьшим screenY
              // (они первыми "въедут" в viewport снизу когда рил остановится)

              // Собираем все слоты с их текущими screenY
              const slotsWithY = reel.slots.map((slot, idx) => ({
                slot,
                idx,
                screenY: slot.container.y + reel.container.y,
              }));

              // Слоты что сейчас выше экрана — кандидаты для записи финальных символов
              const aboveScreen = slotsWithY
                .filter(s => s.screenY < -CH * 0.5)
                .sort((a, b) => b.screenY - a.screenY); // ближайшие к верху экрана — первые

              // Нам нужно ROWS слотов (по одному на каждую строку)
              // Берём ближайшие к верху экрана — они появятся последними,
              // то есть остановятся именно в видимой зоне
              // ROWS слотов: берём последние ROWS из aboveScreen (самые дальние от экрана)
              // На самом деле нам нужны те что остановятся в строках 0..ROWS-1.
              // Проще: назначаем финальные символы слотам которые сейчас
              // находятся в позиции -(1..ROWS)*CH от верха экрана
              for (let row = 0; row < ROWS && row < aboveScreen.length; row++) {
                // row=0 → ближайший к верху экрана слот → остановится в строке 0
                setSlotSymbol(aboveScreen[row].slot, finalSymbolsPerCol[col][row]);
              }
            }
          }

          if (reel.vel > 0) {
            reel.container.y += reel.vel;

            // Врап: слоты ушедшие за нижний край → переносим наверх
            reel.slots.forEach(slot => {
              const screenY = slot.container.y + reel.container.y;
              if (screenY > CANVAS_H + CH) {
                slot.container.y -= totalReelH;
                // В буфере выше экрана ставим случайные символы
                // (финальные уже загружены отдельно)
                if (!finalLoaded[col]) {
                  setSlotSymbol(slot, randomFood());
                }
                slot.container.visible = true;
                slot.container.alpha = 1;
              }
            });
          } else {
            // ─── ОСТАНОВКА ───
            reel.vel = 0;
            reel.spinning = false;

            // ВАЖНО: сбрасываем container.y = 0 и ставим все слоты
            // на абсолютные позиции. Никакого "row * CH - container.y".
            reel.container.y = 0;

            for (let row = 0; row < ROWS; row++) {
              const slot = reel.slots[row + BUFFER];
              if (!slot) continue;

              // Финальный символ — гарантируем правильный
              setSlotSymbol(slot, finalSymbolsPerCol[col][row]);
              slot.container.y = row * CH;
              slot.container.visible = true;
              slot.container.alpha = 1;
              slot.container.scale.set(1);
              slot.container.rotation = 0;
              slot.bg.clear();
              slot.bg
                .roundRect(2, 2, CW - 4, CH - 4, 6)
                .fill(0x2a2a3e)
                .stroke({ width: 1.5, color: 0x444466 });
            }

            // Буферные слоты убираем за пределы viewport
            for (let i = 0; i < BUFFER; i++) {
              reel.slots[i].container.y = (i - BUFFER) * CH;
              reel.slots[ROWS + BUFFER + i].container.y = (ROWS + i) * CH;
            }
          }
        });

        if (allDone) {
          app.ticker.remove(tick);

          // Финальная гарантия: ещё раз ставим всё в правильные позиции
          // (на случай если ticker успел сделать ещё один кадр после остановки)
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
              slot.bg
                .roundRect(2, 2, CW - 4, CH - 4, 6)
                .fill(0x2a2a3e)
                .stroke({ width: 1.5, color: 0x444466 });
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
          // Hide exploded symbols completely
          positions.forEach(pos => {
            const slot = getSlotAt(pos);
            if (slot) {
              slot.container.visible = false;
              slot.container.alpha = 0;
              // Move it off-screen to avoid any rendering artifacts
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

      // Prepare items: update slot symbols then launch them from above
      type Item = { slot: ReelSlot; targetY: number; vy: number; landed: boolean };
      const items: Item[] = [];

      for (let col = 0; col < COLS; col++) {
        const reel = reelsRef.current[col];
        if (!reel) continue;
        
        // Reset reel container position
        reel.container.y = 0;
        
        for (let row = 0; row < ROWS; row++) {
          const slot = reel.slots[row + BUFFER];
          const cell = finalGrid[row]?.[col];
          if (!slot || !cell) continue;

          setSlotSymbol(slot, cell.symbol.id);
          
          // Reset appearance
          slot.container.visible = true;
          slot.container.alpha = 1;
          slot.container.scale.set(1);
          slot.container.rotation = 0;
          
          slot.bg.clear();
          slot.bg.roundRect(2, 2, CW - 4, CH - 4, 6)
            .fill(0x2a2a3e)
            .stroke({ width: 1.5, color: 0x444466 });

          const targetY = row * CH;
          slot.container.y = targetY - CH * (BUFFER + 1); // start above

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
              
              // Ensure visible at landing
              item.slot.container.visible = true;
              item.slot.container.alpha = 1;
            }
          }

          if (!item.landed) allDone = false;
        });

        if (allDone) {
          app.ticker.remove(tick);
          
          // Final check: ensure all slots are visible and at correct positions
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
  /** Get the slot at a "row-col" string key */
  const getSlotAt = (key: string): ReelSlot | null => {
    const [row, col] = key.split('-').map(Number);
    return getSlotAtRC(row, col);
  };

  /** Get the slot for visible row/col (BUFFER offset applied) */
  const getSlotAtRC = (row: number, col: number): ReelSlot | null => {
    const reel = reelsRef.current[col];
    if (!reel) return null;
    const slot = reel.slots[row + BUFFER];
    return slot ?? null;
  };

  const sleep = (ms: number) => new Promise<void>(r => setTimeout(r, ms));

  const lerpColor = (a: number, b: number, t: number): number => {
    const ar = (a >> 16) & 0xff, ag = (a >> 8) & 0xff, ab = a & 0xff;
    const br = (b >> 16) & 0xff, bg = (b >> 8) & 0xff, bb = b & 0xff;
    return ((ar + (br - ar) * t) << 16) |
           ((ag + (bg - ag) * t) << 8)  |
            (ab + (bb - ab) * t);
  };

  /* ════════════════════════════════════
     DESTROY
  ════════════════════════════════════ */
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

  /* ════════════════════════════════════
     RENDER
  ════════════════════════════════════ */
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