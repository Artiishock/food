import { useEffect, useRef, useState, useCallback } from 'react';
import { useGameSounds } from './useGameSounds';
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
  const { play }   = useGameSounds();
  const stopSpin   = useRef<(() => void) | null>(null);
  const [ready, setReady] = useState(false);
  const [err,   setErr  ] = useState<string | null>(null);

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
    // Запускаем звук вращения
    stopSpin.current = play('spin') ?? null;
    try {
      await animateReels(initialGrid);
      await sleep(250);
      for (const step of cascadeSteps) await doCascade(step);
    } finally {
      busyRef.current = false;
      onSpinComplete?.({});
    }
  };

  /* ════════════════════════════════════
     REEL SPIN ANIMATION

     Каждая колонка имеет независимый offset (scrollY).
     Финальные символы в canonical слотах (row+BUFFER) с самого старта.
     container.y = 0 всегда. Движение через slot.container.y.
     Порядок остановки: 0 → 1 → 2 → 3 → 4.
  ════════════════════════════════════ */
  const animateReels = (finalGrid: GridCell[][]): Promise<void> => {
    return new Promise(resolve => {
      const app = appRef.current!;
      const SLOT_COUNT = ROWS + BUFFER * 2;
      const TOTAL_H    = SLOT_COUNT * CH;

      // Финальные символы → canonical слоты (row+BUFFER)
      // Стартовая позиция: slot[row+BUFFER].y = (row+BUFFER-BUFFER)*CH - ROWS*CH = row*CH - ROWS*CH
      // т.е. выше экрана на ROWS*CH
      for (let col = 0; col < COLS; col++) {
        const reel = reelsRef.current[col];
        reel.container.y = 0;

        for (let i = 0; i < SLOT_COUNT; i++) {
          const isCanonical = i >= BUFFER && i < BUFFER + ROWS;
          if (isCanonical) {
            const row = i - BUFFER;
            const sym = finalGrid[row]?.[col]?.symbol?.id ?? randomFood();
            setSlotSymbol(reel.slots[i], sym);
          } else {
            setSlotSymbol(reel.slots[i], randomFood());
          }
          // Начальный Y: сдвигаем все слоты вверх на ROWS*CH
          // Canonical слоты стартуют выше экрана, въедут когда прокрутимся на ROWS*CH
          reel.slots[i].container.y = (i - BUFFER) * CH - ROWS * CH;
          resetSlotAppearance(reel.slots[i]);
        }
      }

      // Независимое состояние для каждой колонки
      const vel        = new Array(COLS).fill(SPIN_SPEED);
      const scrolled   = new Array(COLS).fill(0);   // суммарно прокручено px
      const snapTarget = new Array(COLS).fill(-1);   // целевой scroll (px), -1 = не задан
      const stopped    = new Array(COLS).fill(false);
      let elapsed      = 0;

      const tick = (ticker: PIXI.Ticker) => {
        elapsed += ticker.deltaTime * (1000 / 60);
        let allStopped = true;

        for (let col = 0; col < COLS; col++) {
          if (stopped[col]) continue;
          allStopped = false;

          const stopAt = SPIN_BASE_MS + col * STOP_DELAY;
          const reel   = reelsRef.current[col];

          // Начинаем торможение
          if (elapsed >= stopAt) {
            vel[col] = Math.max(0, vel[col] - DECEL);

            // Фиксируем snap-target один раз в начале торможения
            if (snapTarget[col] < 0) {
              // Цель: scrolled ≡ ROWS*CH (mod TOTAL_H)
              // Это значит canonical слоты окажутся ровно на row*CH
              // Находим ближайшее такое значение ВПЕРЕДИ текущего scrolled
              const cur = scrolled[col];
              const mod = ROWS * CH; // остаток который нам нужен
              // Сколько пикселей до следующей "правильной" точки
              const curMod = cur % TOTAL_H;
              let dist = mod - curMod;
              if (dist <= 0) dist += TOTAL_H;  // берём следующую, не текущую
              snapTarget[col] = cur + dist;
            }
          }

          const v         = vel[col];
          const remaining = snapTarget[col] >= 0 ? snapTarget[col] - scrolled[col] : Infinity;
          const atTarget  = snapTarget[col] >= 0 && remaining <= 0;

          if (atTarget) {
            // Точно на месте — фиксируем финальные позиции
            for (let i = 0; i < SLOT_COUNT; i++) {
              const isCanonical = i >= BUFFER && i < BUFFER + ROWS;
              const row = i - BUFFER;
              reel.slots[i].container.y = isCanonical ? row * CH : (i - BUFFER - ROWS) * CH;
              reel.slots[i].container.visible = isCanonical;
              if (isCanonical) {
                reel.slots[i].container.alpha = 1;
                reel.slots[i].container.scale.set(1);
                reel.slots[i].container.rotation = 0;
                reel.slots[i].bg.clear();
                reel.slots[i].bg.roundRect(2, 2, CW - 4, CH - 4, 6).fill(0x2a2a3e).stroke({ width: 1.5, color: 0x444466 });
              }
            }
            // Звук остановки барабана
            play('reelStop', { col });
            stopped[col] = true;
            continue;
          }

          // Скорость: минимум при докрутке чтобы не ползти
          const SNAP_MIN = SPIN_SPEED * 0.35;
          const effectiveV = (snapTarget[col] >= 0 && v < SNAP_MIN) ? SNAP_MIN : v;
          const step = Math.min(effectiveV, remaining < Infinity ? remaining : effectiveV);

          scrolled[col] += step;

          // Двигаем все слоты вниз на step
          for (let i = 0; i < SLOT_COUNT; i++) {
            reel.slots[i].container.y += step;

            // Слот ушёл за нижний край → переносим наверх
            if (reel.slots[i].container.y > CANVAS_H + CH) {
              reel.slots[i].container.y -= TOTAL_H;
              // Canonical слоты не трогаем — они несут финальные символы
              const isCanonical = i >= BUFFER && i < BUFFER + ROWS;
              if (!isCanonical) {
                setSlotSymbol(reel.slots[i], randomFood());
                resetSlotAppearance(reel.slots[i]);
              }
            }
          }
        }

        if (allStopped) {
          app.ticker.remove(tick);
          // Останавливаем звук вращения
          stopSpin.current?.();
          stopSpin.current = null;
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
    await sleep(180);
  };

  // Победная анимация: увеличение → полёт вниз к центру нижней панели → исчезновение
  const highlightCells = (positions: Set<string>): Promise<void> =>
    new Promise(resolve => {
      const app = appRef.current!;
      const fx  = fxLayerRef.current!;

      // Центр нижней панели в координатах canvas
      // Нижняя панель: Y = CANVAS_H (сразу под canvas), центр X = CANVAS_W / 2
      const TARGET_X = CANVAS_W / 2;
      const TARGET_Y = CANVAS_H + 40; // чуть ниже края canvas

      // Для каждой позиции создаём клон-спрайт в fxLayer (поверх всего)
      // Оригинальный слот скрываем сразу — анимируем только клон
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

        // Стартовая позиция клона = центр ячейки в мировых координатах
        const [row, col] = pos.split('-').map(Number);
        const startX = col * CW + CW / 2;
        const startY = row * CH + CH / 2;

        // Клон фона
        const bg = new PIXI.Graphics();
        bg.roundRect(-CW / 2 + 2, -CH / 2 + 2, CW - 4, CH - 4, 6)
          .fill(0xffdd00).stroke({ width: 2.5, color: 0xff9900 });
        bg.position.set(startX, startY);
        fx.addChild(bg);

        // Клон спрайта — копируем scale из оригинала
        const sprite = new PIXI.Sprite(slot.sprite.texture);
        sprite.anchor.set(0.5);
        sprite.position.set(startX, startY);
        sprite.scale.set(slot.sprite.scale.x, slot.sprite.scale.y);
        fx.addChild(sprite);

        // Скрываем оригинальный слот
        slot.container.visible = false;

        items.push({ sprite, bg, startX, startY, baseScale: slot.sprite.scale.x, phase: 'grow', t: 0, done: false });
      });

      const GROW_DUR = 400;  // ms — фаза увеличения с подсветкой
      const FLY_DUR  = 500;  // ms — фаза полёта вниз

      const tick = (ticker: PIXI.Ticker) => {
        const dt = ticker.deltaTime * (1000 / 60);

        items.forEach(item => {
          if (item.done) return;
          item.t += dt;

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

  // explodeCells теперь только скрывает оригиналы (клоны уже улетели в highlightCells)
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

        // Удалённые строки в этой колонке
        const removedRows = new Set<number>();
        removedPositions.forEach(pos => {
          const [r, c] = pos.split('-').map(Number);
          if (c === col) removedRows.add(r);
        });

        const numRemoved = removedRows.size;

        for (let row = 0; row < ROWS; row++) {
          const slot = reel.slots[row + BUFFER];
          const cell = finalGrid[row]?.[col];
          if (!slot || !cell) continue;

          const targetY = row * CH;

          // Определяем startY для этого символа:
          // Символ "новый" (пришёл сверху) если в beforeGrid его не было вообще
          // или его позиция в beforeGrid была выше текущей.
          //
          // Алгоритм каскада: удаляем winPositions, оставшиеся символы
          // сдвигаются вниз на кол-во удалённых ниже них, новые заполняют сверху.
          //
          // Для строки row в finalGrid:
          // - Считаем сколько удалённых строк НИЖЕ row (включая row) в этой колонке
          //   → это смещение вниз для символа который был выше
          // - Если символ был в beforeGrid[row - shift][col] → он сдвинулся вниз
          // - Если row - shift < 0 → символ новый, падает сверху

          // Кол-во удалённых строк <= row (т.е. на уровне row и выше)
          let removedAboveOrAt = 0;
          for (let r = 0; r <= row; r++) {
            if (removedRows.has(r)) removedAboveOrAt++;
          }

          // Откуда пришёл этот символ в beforeGrid
          const sourceRow = row - removedAboveOrAt;
          const isNew = sourceRow < 0;

          setSlotSymbol(slot, cell.symbol.id);
          slot.container.visible = true;
          slot.container.alpha = 1;
          slot.container.scale.set(1);
          slot.container.rotation = 0;
          slot.bg.clear();
          slot.bg.roundRect(2, 2, CW - 4, CH - 4, 6).fill(0x2a2a3e).stroke({ width: 1.5, color: 0x444466 });

          let startY: number;
          if (isNew) {
            // Новый символ — стартует выше экрана
            // Чем выше строка тем выше стартует
            startY = targetY - (Math.abs(sourceRow) + 1) * CH;
          } else if (removedAboveOrAt > 0) {
            // Существующий символ сдвинулся вниз — стартует со своей старой позиции
            startY = sourceRow * CH;
          } else {
            // Символ не двигался — сразу на месте
            slot.container.y = targetY;
            continue;
          }

          slot.container.y = startY;
          items.push({ slot, startY, targetY, vy: 0, landed: false });
        }
      }

      if (items.length === 0) { resolve(); return; }

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
      particles.forEach(p => { if (p.life <= 0) return; alive = true; p.x += p.vx; p.y += p.vy; p.vy += 0.18; p.life -= 0.025; p.alpha = Math.max(0, p.life); });
      if (!alive) { app.ticker.remove(tick); particles.forEach(p => p.destroy()); }
    };
    app.ticker.add(tick);
  };

  const getSlotAt   = (key: string) => { const [r, c] = key.split('-').map(Number); return getSlotAtRC(r, c); };
  const getSlotAtRC = (row: number, col: number) => reelsRef.current[col]?.slots[row + BUFFER] ?? null;
  const sleep       = (ms: number) => new Promise<void>(r => setTimeout(r, ms));
  const lerpColor   = (a: number, b: number, t: number) => {
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