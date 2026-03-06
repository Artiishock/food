import { useEffect, useRef, useState, useCallback } from 'react';
import { useGameSounds } from './useGameSounds';
import * as PIXI from 'pixi.js';
import { GameEngine, GridCell, WinInfo } from '../lib/gameEngine';
import symbolsConfig from '../config/symbols.json';
import { SHEET_FRAMES } from '../config/spriteFrames';

interface GameCanvasProps {
  gameEngine: GameEngine;
  isSpinning?: boolean;
  soundEnabled?: boolean;
  onSpinComplete?: (result: any) => void;
  onSpeedUpReady?: (speedUp: () => void) => void;
  onOrdersAppear?: () => Promise<void>;
  initialFast?: boolean;
}

const CANVAS_W = 800;
const CANVAS_H = 500;
const ROWS     = symbolsConfig.gridSize.rows;
const COLS     = symbolsConfig.gridSize.columns;
const CW       = CANVAS_W / COLS;
const CH       = CANVAS_H / ROWS;
const BUFFER   = 4;

// Скорость вращения px/frame при 60fps
const SPIN_SPEED        = 28;
// Фреймов на разгон и торможение
const ACCEL_FRAMES      = 18;
const DECEL_FRAMES      = 38;
// Задержка между остановками соседних барабанов (~417ms между каждым).
// Шаг = 7 * CH = 700px — кратен CH, слоты всегда встают ровно.
const STOP_DELAY_FRAMES = 25; // 25 * 28 = 700 = 7 * CH(100)
// Минимум полных оборотов до остановки первого барабана
const MIN_SPINS         = 2;

const GRAVITY = 1.3;
const BOUNCE  = 0.28;

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

export default function GameCanvas({ gameEngine, isSpinning = false, soundEnabled = true, onSpinComplete, onSpeedUpReady, onOrdersAppear, initialFast = false }: GameCanvasProps) {
  const mountRef      = useRef<HTMLDivElement>(null);
  const appRef        = useRef<PIXI.Application | null>(null);
  const reelsRef      = useRef<Reel[]>([]);
  const fxLayerRef    = useRef<PIXI.Container | null>(null);
  const textureMap    = useRef<Map<string, PIXI.Texture>>(new Map());
  const busyRef            = useRef(false);
  const onSpinCompleteRef  = useRef(onSpinComplete);
  const onOrdersAppearRef  = useRef(onOrdersAppear);
  const { play, setMuted } = useGameSounds();
  const stopSpin      = useRef<(() => void) | null>(null);
  const speedMultRef  = useRef(1);
  const initialFastRef = useRef(initialFast);
  const [ready, setReady] = useState(false);
  const [err,   setErr  ] = useState<string | null>(null);

  useEffect(() => {
    setMuted(!soundEnabled);
  }, [soundEnabled]);

  onSpinCompleteRef.current  = onSpinComplete;
  onOrdersAppearRef.current  = onOrdersAppear;
  initialFastRef.current     = initialFast;

  const speedUp = useCallback(() => {
    if (!busyRef.current) return;
    speedMultRef.current = speedMultRef.current === 1 ? 4 : 1;
  }, []);

  useEffect(() => {
    onSpeedUpReady?.(speedUp);
  }, [speedUp, onSpeedUpReady]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.code === 'Space' && e.target === document.body) {
        e.preventDefault();
        if (busyRef.current) speedUp();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [speedUp]);

  useEffect(() => {
    if (!mountRef.current) return;
    let alive = true;
    (async () => {
      try {
        const app = new PIXI.Application();
        await app.init({ width: CANVAS_W, height: CANVAS_H, backgroundColor: 0x1a1a1a, antialias: true, resolution: window.devicePixelRatio || 1, autoDensity: true });
        if (!alive) return;
        app.ticker.maxFPS = 60;
        mountRef.current!.innerHTML = '';
        mountRef.current!.appendChild(app.canvas as HTMLCanvasElement);
        appRef.current = app;
        await loadTextures(app);
        buildReels(app);
        fillReelsWithGrid(gameEngine.getState().grid, true);
        setReady(true);
      } catch (e: any) { setErr(String(e?.message ?? e)); }
    })();
    return () => { alive = false; destroyAll(); };
  }, []);

  useEffect(() => {
    if (!ready || !isSpinning || busyRef.current) return;
    play('buttonClick');
    const state = gameEngine.getState();
    const initialGrid = state.cascadeSteps.length > 0 ? state.cascadeSteps[0].gridBeforeRemoval : state.grid;
    runSpinSequence(initialGrid, state.cascadeSteps ?? []);
  }, [isSpinning, ready]);

  const loadTextures = async (app: PIXI.Application) => {
    const baseTexture = await PIXI.Assets.load('/symbols.png');
    for (const [id, f] of Object.entries(SHEET_FRAMES)) {
      textureMap.current.set(id, new PIXI.Texture({ source: baseTexture.source, frame: new PIXI.Rectangle(f.x, f.y, f.w, f.h) }));
    }
  };

  const getTexture = (id: string) => textureMap.current.get(id) ?? PIXI.Texture.WHITE;

  const buildReels = (app: PIXI.Application) => {
    const bg = new PIXI.Graphics();
    bg.rect(0, 0, CANVAS_W, CANVAS_H).fill(0x1e1e2e);
    app.stage.addChild(bg);
    const clipMask = new PIXI.Graphics();
    clipMask.rect(0, 0, CANVAS_W, CANVAS_H).fill(0xffffff);
    app.stage.addChild(clipMask);
    for (let col = 0; col < COLS; col++) {
      const container = new PIXI.Container();
      container.x = col * CW; container.y = 0;
      container.mask = clipMask;
      app.stage.addChild(container);
      const slots: ReelSlot[] = [];
      for (let i = 0; i < ROWS + BUFFER * 2; i++) {
        const slot = buildSlot(FOOD_IDS[i % FOOD_IDS.length]);
        slot.container.y = (i - BUFFER) * CH;
        container.addChild(slot.container);
        slots.push(slot);
      }
      reelsRef.current.push({ container, slots, vel: 0, spinning: false });
    }
    const lines = new PIXI.Graphics();
    for (let col = 1; col < COLS; col++) lines.moveTo(col * CW, 0).lineTo(col * CW, CANVAS_H);
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
    sprite.anchor.set(0.5); sprite.position.set(CW / 2, CH / 2);
    fitSprite(sprite, CW - 12, CH - 12);
    container.addChild(sprite);
    return { container, sprite, bg, symbolId };
  };

  const fitSprite = (sprite: PIXI.Sprite, maxW: number, maxH: number) => {
    const tex = sprite.texture;
    if (!tex.width || !tex.height) return;
    sprite.scale.set(Math.min(maxW / tex.width, maxH / tex.height));
  };

  const fillReelsWithGrid = (grid: GridCell[][], resetPositions = false) => {
    for (let col = 0; col < COLS; col++) {
      const reel = reelsRef.current[col];
      if (!reel) continue;
      if (resetPositions) { reel.container.y = 0; reel.vel = 0; reel.spinning = false; }
      for (let row = 0; row < ROWS; row++) {
        const slot = reel.slots[row + BUFFER]; const cell = grid[row]?.[col];
        if (slot && cell) { setSlotSymbol(slot, cell.symbol.id); slot.container.y = row * CH; resetSlotAppearance(slot); }
      }
      for (let i = 0; i < BUFFER; i++) {
        const t = reel.slots[i]; t.container.y = (i - BUFFER) * CH; setSlotSymbol(t, randomFood()); resetSlotAppearance(t);
        const b = reel.slots[ROWS + BUFFER + i]; b.container.y = (ROWS + i) * CH; setSlotSymbol(b, randomFood()); resetSlotAppearance(b);
      }
    }
  };

  const setSlotSymbol = (slot: ReelSlot, id: string) => {
    slot.symbolId = id; slot.sprite.texture = getTexture(id); fitSprite(slot.sprite, CW - 12, CH - 12);
  };

  const resetSlotAppearance = (slot: ReelSlot) => {
    slot.container.visible = true; slot.container.alpha = 1;
    slot.container.scale.set(1); slot.container.rotation = 0;
    slot.bg.clear(); slot.bg.roundRect(2, 2, CW - 4, CH - 4, 6).fill(0x2a2a3e).stroke({ width: 1.5, color: 0x444466 });
  };

  const randomFood = () => FOOD_IDS[Math.floor(Math.random() * FOOD_IDS.length)];

  const runSpinSequence = async (initialGrid: GridCell[][], cascadeSteps: any[]) => {
    busyRef.current = true;
    speedMultRef.current = initialFastRef.current ? 4 : 1;
    stopSpin.current = play('spin') ?? null;
    try {
      await animateReels(initialGrid);
      await sleep(250 / speedMultRef.current);
      for (const step of cascadeSteps) await doCascade(step);
    } finally {
      console.log("[GameCanvas] runSpinSequence finally, calling onSpinComplete");
      busyRef.current = false;
      onSpinCompleteRef.current?.({});
    }
  };

  const animateReels = (finalGrid: GridCell[][]): Promise<void> => {
    return new Promise(resolve => {
      const app        = appRef.current!;
      const SLOT_COUNT = ROWS + BUFFER * 2;
      const TOTAL_H    = SLOT_COUNT * CH;

      // ── 1. Расставляем слоты ─────────────────────────────────────────────
      // Стартовая позиция: (i - BUFFER) * CH — слоты стоят на своих обычных
      // местах, canonical-слоты сразу видны на экране (нет мигания пустоты).
      // Canonical-слоты получают финальные символы ДО старта — они прокручиваются
      // вместе со всеми и "приплывают" обратно на место после MIN_SPINS оборотов.
      for (let col = 0; col < COLS; col++) {
        const reel = reelsRef.current[col];
        reel.container.y = 0;
        for (let i = 0; i < SLOT_COUNT; i++) {
          const isCanonical = i >= BUFFER && i < BUFFER + ROWS;
          const sym = isCanonical
            ? (finalGrid[i - BUFFER]?.[col]?.symbol?.id ?? randomFood())
            : randomFood();
          setSlotSymbol(reel.slots[i], sym);
          reel.slots[i].container.y = (i - BUFFER) * CH;
          resetSlotAppearance(reel.slots[i]);
        }
      }

      // ── 2. Считаем детерминированный путь каждого барабана ───────────────
      // Старт canonical[0] (slot[BUFFER]) на y=0.
      // После прокрутки на точное кратное TOTAL_H → снова y=0. ✓
      // target[col] = MIN_SPINS * TOTAL_H + задержка для порядка остановки.
      // Каждый следующий барабан проходит больше → останавливается позже →
      // гарантированный порядок 0→1→2→3→4→5.
      const d_accel = SPIN_SPEED * ACCEL_FRAMES / 2;
      const d_decel = SPIN_SPEED * DECEL_FRAMES / 2;

      const snapForCol = (col: number): number => {
        let target = MIN_SPINS * TOTAL_H + col * STOP_DELAY_FRAMES * SPIN_SPEED;
        const minTarget = d_accel + d_decel + SPIN_SPEED * 15;
        while (target < minTarget) target += TOTAL_H;
        // Округляем вверх до кратного CH — слоты встанут ровно на row*CH.
        // target = (MIN_SPINS + 1 + col) * TOTAL_H
        // Каждый барабан проходит на TOTAL_H больше предыдущего → уникальные targets.
        // Кратность TOTAL_H гарантирует что canonical-слоты вернутся ровно на row*CH.
        // Разница ~774ms между барабанами.
        return (MIN_SPINS + 1 + col) * TOTAL_H;
      };

      const targets      = Array.from({ length: COLS }, (_, c) => snapForCol(c));
      const scrolled     = new Array(COLS).fill(0);
      const stopped      = new Array(COLS).fill(false);
      const decelStarted = new Array(COLS).fill(false);
      const vel          = new Array(COLS).fill(0);
      let   frame        = 0;

      const decelStartFrame = targets.map(t => {
        const cruiseFrames = (t - d_accel - d_decel) / SPIN_SPEED;
        return Math.ceil(ACCEL_FRAMES + cruiseFrames);
      });

      const tick = (ticker: PIXI.Ticker) => {
        const spd = speedMultRef.current;
        const df  = ticker.elapsedMS / (1000 / 60) * spd;
        frame += df;

        let allStopped = true;

        for (let col = 0; col < COLS; col++) {
          if (stopped[col]) continue;
          allStopped = false;

          const reel      = reelsRef.current[col];
          const remaining = targets[col] - scrolled[col];

          // Фаза РАЗГОН
          if (!decelStarted[col] && frame < ACCEL_FRAMES) {
            vel[col] = SPIN_SPEED * Math.min(frame / ACCEL_FRAMES, 1);
          }
          // Фаза КРЕЙСЕР
          else if (!decelStarted[col] && frame < decelStartFrame[col]) {
            vel[col] = SPIN_SPEED;
          }
          // Старт ТОРМОЖЕНИЯ — только после того как предыдущий начал тормозить
          else if (!decelStarted[col]) {
            if (col === 0 || decelStarted[col - 1]) {
              decelStarted[col] = true;
            } else {
              vel[col] = SPIN_SPEED;
            }
          }

          // Фаза ТОРМОЖЕНИЕ
          if (decelStarted[col]) {
            vel[col] = Math.max(1.0, SPIN_SPEED * (remaining / d_decel));
          }

          const step = Math.min(vel[col] * df, Math.max(0, remaining));
          scrolled[col] += step;

          for (let i = 0; i < SLOT_COUNT; i++) {
            reel.slots[i].container.y += step;

            if (reel.slots[i].container.y > CANVAS_H + CH) {
              reel.slots[i].container.y -= TOTAL_H;
              const isCanonical = i >= BUFFER && i < BUFFER + ROWS;
              if (!isCanonical) {
                setSlotSymbol(reel.slots[i], randomFood());
                resetSlotAppearance(reel.slots[i]);
              }
            }
          }

          // Барабан достиг цели — target кратен TOTAL_H, поэтому canonical-слоты
          // вернулись точно на row*CH без прыжков. Просто фиксируем видимость.
          if (scrolled[col] >= targets[col]) {
            for (let i = 0; i < SLOT_COUNT; i++) {
              const isCanonical = i >= BUFFER && i < BUFFER + ROWS;
              const row = i - BUFFER;
              reel.slots[i].container.y      = isCanonical ? row * CH : (row - ROWS) * CH;
              reel.slots[i].container.visible = isCanonical;
              if (isCanonical) {
                reel.slots[i].container.alpha    = 1;
                reel.slots[i].container.scale.set(1);
                reel.slots[i].container.rotation = 0;
                reel.slots[i].bg.clear();
                reel.slots[i].bg.roundRect(2, 2, CW - 4, CH - 4, 6)
                  .fill(0x2a2a3e).stroke({ width: 1.5, color: 0x444466 });
              }
            }
            play('reelStop', { col });
            stopped[col] = true;
          }
        }

        if (allStopped) {
          app.ticker.remove(tick);
          stopSpin.current?.();
          stopSpin.current = null;
          resolve();
        }
      };

      app.ticker.add(tick);
    });
  };

  const doCascade = async (step: any) => {
    if (step.isScatterStep) {
      const scatterPositions = new Set<string>(
        (step.scatterCells as GridCell[]).map((c: GridCell) => `${c.row}-${c.col}`)
      );
      await animateScatterFly(scatterPositions, step.gridAfterFill as GridCell[][]);
      return;
    }

    const winPositions = new Set<string>();
    (step.wins as WinInfo[]).forEach(w => w.cells.forEach(c => winPositions.add(`${c.row}-${c.col}`)));
    if (step.gridBeforeRemoval) {
      for (const pos of winPositions) {
        const [row, col] = pos.split('-').map(Number);
        const slot = getSlotAtRC(row, col); const cell = step.gridBeforeRemoval[row]?.[col];
        if (slot && cell && slot.symbolId !== cell.symbol.id) { setSlotSymbol(slot, cell.symbol.id); resetSlotAppearance(slot); }
      }
    }
    const isBig = winPositions.size >= 6;
    play('win', { big: isBig });
    await highlightCells(winPositions);
    await explodeCells(winPositions);
    await dropAndFill(step.gridAfterFill as GridCell[][], step.gridBeforeRemoval as GridCell[][], winPositions);
    await sleep(180 / speedMultRef.current);
  };

  const animateScatterFly = (positions: Set<string>, gridAfterFill: GridCell[][]): Promise<void> =>
    new Promise(resolve => {
      const app = appRef.current!;
      const fx  = fxLayerRef.current!;

      const TARGET_X = CANVAS_W + 160;
      const TARGET_Y = CANVAS_H / 2;

      type ScatterItem = {
        sprite:    PIXI.Sprite;
        glow:      PIXI.Graphics;
        startX:    number;
        startY:    number;
        baseScale: number;
        phase:     'grow' | 'fly';
        t:         number;
        done:      boolean;
      };

      const items: ScatterItem[] = [];

      positions.forEach(pos => {
        const slot = getSlotAt(pos);
        if (!slot) return;

        const [row, col] = pos.split('-').map(Number);
        const startX = col * CW + CW / 2;
        const startY = row * CH + CH / 2;

        const glow = new PIXI.Graphics();
        glow.circle(0, 0, CW * 0.55).fill({ color: 0xffcc00, alpha: 0.35 });
        glow.position.set(startX, startY);
        fx.addChild(glow);

        const sprite = new PIXI.Sprite(slot.sprite.texture);
        sprite.anchor.set(0.5);
        sprite.position.set(startX, startY);
        sprite.scale.set(slot.sprite.scale.x, slot.sprite.scale.y);
        fx.addChild(sprite);

        slot.container.visible = false;

        items.push({
          sprite, glow,
          startX, startY,
          baseScale: slot.sprite.scale.x,
          phase: 'grow',
          t: 0,
          done: false,
        });
      });

      if (items.length === 0) { resolve(); return; }

      const GROW_DUR = 320;
      const FLY_DUR  = 600;

      const tick = (ticker: PIXI.Ticker) => {
        const spd = speedMultRef.current;
        const dt  = ticker.elapsedMS;

        items.forEach(item => {
          if (item.done) return;
          item.t += dt * spd;

          if (item.phase === 'grow') {
            const p = Math.min(item.t / GROW_DUR, 1);
            const scale = 1 + Math.sin(p * Math.PI) * 0.8;
            item.sprite.scale.set(item.baseScale * scale);
            item.glow.scale.set(scale);
            item.glow.clear();
            item.glow.circle(0, 0, CW * 0.55 * scale).fill({ color: 0xffcc00, alpha: 0.25 + p * 0.4 });

            if (p >= 1) {
              item.phase = 'fly';
              item.t = 0;
              spawnParticles(item.startX, item.startY);
            }

          } else {
            const p = Math.min(item.t / FLY_DUR, 1);
            const ease = p * p * p;

            const x = item.startX + (TARGET_X - item.startX) * ease;
            const arc = Math.sin(p * Math.PI) * -30;
            const y = item.startY + (TARGET_Y - item.startY) * ease * 0.3 + arc;

            item.sprite.position.set(x, y);
            item.glow.position.set(x, y);

            const shrink = 1.6 * (1 - ease * 0.7);
            item.sprite.scale.set(item.baseScale * shrink);
            item.glow.scale.set(shrink);
            item.sprite.alpha = 1 - ease * ease;
            item.glow.alpha   = 1 - ease * ease;

            if (p >= 1) {
              item.done = true;
              item.sprite.destroy();
              item.glow.destroy();
            }
          }
        });

        if (items.every(i => i.done)) {
          app.ticker.remove(tick);
          const uiPromise = onOrdersAppearRef.current ? onOrdersAppearRef.current() : Promise.resolve();
          const timeout   = new Promise<void>(r => setTimeout(r, 1500));
          Promise.race([uiPromise, timeout]).then(() => {
            dropAndFill(gridAfterFill, gridAfterFill, positions).then(() => resolve());
          });
        }
      };

      app.ticker.add(tick);
    });

  const highlightCells = (positions: Set<string>): Promise<void> =>
    new Promise(resolve => {
      const app = appRef.current!;
      const fx  = fxLayerRef.current!;

      const TARGET_X = CANVAS_W / 2;
      const TARGET_Y = CANVAS_H + 40;

      type FlyItem = {
        sprite:    PIXI.Sprite;
        bg:        PIXI.Graphics;
        startX:    number;
        startY:    number;
        baseScale: number;
        phase:     'grow' | 'fly';
        t:         number;
        done:      boolean;
      };

      const items: FlyItem[] = [];

      positions.forEach(pos => {
        const slot = getSlotAt(pos);
        if (!slot) return;

        const [row, col] = pos.split('-').map(Number);
        const startX = col * CW + CW / 2;
        const startY = row * CH + CH / 2;

        const bg = new PIXI.Graphics();
        bg.roundRect(-CW / 2 + 2, -CH / 2 + 2, CW - 4, CH - 4, 6)
          .fill(0xffdd00).stroke({ width: 2.5, color: 0xff9900 });
        bg.position.set(startX, startY);
        fx.addChild(bg);

        const sprite = new PIXI.Sprite(slot.sprite.texture);
        sprite.anchor.set(0.5);
        sprite.position.set(startX, startY);
        sprite.scale.set(slot.sprite.scale.x, slot.sprite.scale.y);
        fx.addChild(sprite);

        slot.container.visible = false;

        items.push({ sprite, bg, startX, startY, baseScale: slot.sprite.scale.x, phase: 'grow', t: 0, done: false });
      });

      const GROW_DUR = 400;
      const FLY_DUR  = 500;

      const tick = (ticker: PIXI.Ticker) => {
        const spd = speedMultRef.current;
        const dt  = ticker.elapsedMS;

        items.forEach(item => {
          if (item.done) return;
          item.t += dt * spd;

          if (item.phase === 'grow') {
            const p = Math.min(item.t / GROW_DUR, 1);
            const scale = 1 + Math.sin(p * Math.PI) * 0.5;
            item.sprite.scale.set(item.baseScale * scale);
            item.bg.scale.set(scale);

            item.bg.clear();
            item.bg.roundRect(-CW / 2 + 2, -CH / 2 + 2, CW - 4, CH - 4, 6)
              .fill(lerpColor(0xffdd00, 0xffffff, Math.abs(Math.sin(p * Math.PI * 2)) * 0.3))
              .stroke({ width: 3, color: 0xff9900 });

            if (p >= 1) {
              item.phase = 'fly';
              item.t = 0;
              spawnParticles(item.startX, item.startY);
            }

          } else {
            const p = Math.min(item.t / FLY_DUR, 1);
            const ease = p * p;

            const x = item.startX + (TARGET_X - item.startX) * ease;
            const y = item.startY + (TARGET_Y - item.startY) * ease;

            item.sprite.position.set(x, y);
            item.bg.position.set(x, y);

            const shrink = 1 - p * 0.85;
            item.sprite.scale.set(item.baseScale * shrink);
            item.bg.scale.set(shrink);
            item.sprite.alpha = 1 - ease;
            item.bg.alpha     = 1 - ease;

            if (p >= 1) {
              item.done = true;
              item.sprite.destroy();
              item.bg.destroy();
            }
          }
        });

        if (items.every(i => i.done)) {
          app.ticker.remove(tick);
          resolve();
        }
      };

      app.ticker.add(tick);
    });

  const explodeCells = (positions: Set<string>): Promise<void> =>
    new Promise(resolve => {
      positions.forEach(pos => {
        const slot = getSlotAt(pos);
        if (slot) {
          slot.container.visible = false;
          slot.container.alpha   = 0;
          slot.container.y       = -9999;
        }
      });
      resolve();
    });

  const dropAndFill = (finalGrid: GridCell[][], beforeGrid: GridCell[][], removedPositions: Set<string>): Promise<void> =>
    new Promise(resolve => {
      const app = appRef.current!;
      type Item = { slot: ReelSlot; startY: number; targetY: number; vy: number; landed: boolean };
      const items: Item[] = [];

      for (let col = 0; col < COLS; col++) {
        const reel = reelsRef.current[col]; if (!reel) continue;
        reel.container.y = 0;

        // Строим список удалённых строк в этой колонке
        const removedRows = new Set<number>();
        removedPositions.forEach(pos => {
          const [r, c] = pos.split('-').map(Number);
          if (c === col) removedRows.add(r);
        });

        if (removedRows.size === 0) continue;

        // Строим карту: finalRow → откуда пришёл символ (beforeRow или 'new')
        // Логика: символы падают вниз. Выжившие символы из beforeGrid
        // сохраняют своё положение относительно дна — т.е. самый нижний
        // выживший остаётся на самой нижней незанятой позиции и т.д.
        //
        // beforeGrid колонка сверху вниз: собираем выживших (не удалённых)
        const survivors: { beforeRow: number; symbolId: string }[] = [];
        for (let r = 0; r < ROWS; r++) {
          if (!removedRows.has(r)) {
            survivors.push({ beforeRow: r, symbolId: beforeGrid[r]?.[col]?.symbol?.id ?? randomFood() });
          }
        }
        // survivors упорядочены сверху вниз из beforeGrid.
        // В finalGrid они должны занять НИЖНИЕ позиции (тяжесть тянет вниз).
        // Новые символы заполняют верхние позиции.
        const newCount = removedRows.size;
        // finalRow 0..newCount-1 — новые символы (падают сверху)
        // finalRow newCount..ROWS-1 — выжившие (остаются на месте или падают на новую позицию)

        for (let row = 0; row < ROWS; row++) {
          const slot = reel.slots[row + BUFFER];
          const cell = finalGrid[row]?.[col];
          if (!slot || !cell) continue;

          const targetY = row * CH;

          setSlotSymbol(slot, cell.symbol.id);
          slot.container.visible = true;
          slot.container.alpha   = 1;
          slot.container.scale.set(1);
          slot.container.rotation = 0;
          slot.bg.clear();
          slot.bg.roundRect(2, 2, CW - 4, CH - 4, 6).fill(0x2a2a3e).stroke({ width: 1.5, color: 0x444466 });

          const survivorIndex = row - newCount; // индекс в массиве survivors
          const isNew = survivorIndex < 0;

          if (isNew) {
            // Новый символ — падает сверху. Стартует выше экрана.
            const startY = -(newCount - row) * CH;
            slot.container.y = startY;
            items.push({ slot, startY, targetY, vy: 0, landed: false });
          } else {
            // Выживший — был в beforeRow = survivors[survivorIndex].beforeRow
            const beforeRow = survivors[survivorIndex].beforeRow;
            const startY    = beforeRow * CH;
            if (startY === targetY) {
              // Уже на месте — не двигаем
              slot.container.y = targetY;
            } else {
              // Нужно упасть вниз на новую позицию
              slot.container.y = startY;
              items.push({ slot, startY, targetY, vy: 0, landed: false });
            }
          }
        }
      }

      if (items.length === 0) { resolve(); return; }

      const tick = (ticker: PIXI.Ticker) => {
        const spd2 = speedMultRef.current;
        const dt   = ticker.elapsedMS / (1000 / 60);
        let allDone = true;
        items.forEach(item => {
          if (item.landed) return;
          item.vy += GRAVITY * spd2 * dt;
          item.slot.container.y += item.vy * dt;
          if (item.slot.container.y >= item.targetY) {
            item.slot.container.y = item.targetY;
            const effectiveBounce = BOUNCE / spd2;
            const stopThreshold   = 0.6 * Math.sqrt(spd2);
            item.vy = -(item.vy * effectiveBounce);
            if (Math.abs(item.vy) < stopThreshold) {
              item.vy = 0;
              item.slot.container.y = item.targetY;
              item.landed = true;
            }
          }
          if (!item.landed) allDone = false;
        });
        if (allDone) {
          app.ticker.remove(tick);
          for (let col = 0; col < COLS; col++) {
            const reel = reelsRef.current[col]; if (!reel) continue;
            for (let row = 0; row < ROWS; row++) {
              const slot = reel.slots[row + BUFFER];
              if (slot) { slot.container.y = row * CH; slot.container.visible = true; slot.container.alpha = 1; slot.container.scale.set(1); slot.container.rotation = 0; }
            }
          }
          resolve();
        }
      };
      app.ticker.add(tick);
    });

  const spawnParticles = (x: number, y: number) => {
    const fx = fxLayerRef.current; const app = appRef.current; if (!fx || !app) return;
    const particles: (PIXI.Graphics & { vx: number; vy: number; life: number })[] = [];
    for (let i = 0; i < 10; i++) {
      const p = new PIXI.Graphics() as any;
      p.circle(0, 0, 3 + Math.random() * 3).fill([0xffaa00, 0xff4400, 0xffff00][i % 3]);
      const angle = (Math.PI * 2 * i) / 10 + Math.random() * 0.4; const speed = 4 + Math.random() * 3;
      p.position.set(x, y); p.vx = Math.cos(angle) * speed; p.vy = Math.sin(angle) * speed; p.life = 1;
      particles.push(p); fx.addChild(p);
    }
    const tick = (ticker: PIXI.Ticker) => {
      let alive = false;
      const dt = ticker.elapsedMS / (1000 / 60);
      particles.forEach(p => { if (p.life <= 0) return; alive = true; p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 0.18 * dt; p.life -= 0.025 * dt; p.alpha = Math.max(0, p.life); });
      if (!alive) { app.ticker.remove(tick); particles.forEach(p => p.destroy()); }
    };
    app.ticker.add(tick);
  };

  const getSlotAt   = (key: string) => { const [r, c] = key.split('-').map(Number); return getSlotAtRC(r, c); };
  const getSlotAtRC = (row: number, col: number) => reelsRef.current[col]?.slots[row + BUFFER] ?? null;
  const sleep = (ms: number) => new Promise<void>(r => {
    let elapsed = 0;
    const interval = setInterval(() => {
      elapsed += 16 * speedMultRef.current;
      if (elapsed >= ms) { clearInterval(interval); r(); }
    }, 16);
  });
  const lerpColor = (a: number, b: number, t: number) => {
    const tc = Math.max(0, Math.min(1, t));
    const [ar,ag,ab] = [(a>>16)&0xff,(a>>8)&0xff,a&0xff];
    const [br,bg,bb] = [(b>>16)&0xff,(b>>8)&0xff,b&0xff];
    const r = Math.round(ar+(br-ar)*tc);
    const g = Math.round(ag+(bg-ag)*tc);
    const bl = Math.round(ab+(bb-ab)*tc);
    return ((r<<16)|(g<<8)|bl) >>> 0;
  };

  const destroyAll = () => {
    try {
      appRef.current?.ticker.stop();
      reelsRef.current.forEach(r => r.container.destroy({ children: true }));
      reelsRef.current = [];
      fxLayerRef.current?.destroy({ children: true });
      appRef.current?.destroy(true, { children: true, texture: true, baseTexture: true });
      appRef.current = null;
    } catch { }
  };

  if (err) return (
    <div style={{ width: CANVAS_W, height: CANVAS_H }} className="flex items-center justify-center bg-red-900 text-white rounded p-4">
      <div className="text-center"><div className="text-lg font-bold mb-1">Game Error</div><div className="text-sm opacity-80">{err}</div></div>
    </div>
  );

  return <div ref={mountRef} style={{ width: CANVAS_W, height: CANVAS_H, overflow: 'hidden' }} className="rounded-lg shadow-2xl" />;
}