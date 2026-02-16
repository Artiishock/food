/*
 * GameCanvas Component - PixiJS Rendering Engine
 * Continuous vertical reel spinning + recursive cascading animations
 */

import { useEffect, useRef, useState } from 'react';
import * as PIXI from 'pixi.js';
import { GameEngine, GridCell } from '../lib/gameEngine';
import symbolsConfig from '../config/symbols.json';

interface GameCanvasProps {
  gameEngine: GameEngine;
  isSpinning?: boolean;
  onSpinComplete?: (result: any) => void;
}

const SYMBOL_EMOJIS: Record<string, string> = {
  'burger': '🍔',
  'drink': '🥤',
  'pie': '🥧',
  'scatter': '📋',
  'pizza': '🍕',
  'taco': '🌮',
  'fries': '🍟',
  'burrito': '🌯',
  'hotdog': '🌭',
  'chicken': '🍗',
  'wrap': '🌯',
};

interface ReelColumn {
  container: PIXI.Container;
  cells: PIXI.Container[];
  velocity: number;
}

export default function GameCanvas({ gameEngine, isSpinning = false, onSpinComplete }: GameCanvasProps) {
  const canvasRef = useRef<HTMLDivElement>(null);
  const appRef = useRef<PIXI.Application | null>(null);
  const reelsRef = useRef<Map<number, ReelColumn>>(new Map());
  const cellsRef = useRef<Map<string, PIXI.Container>>(new Map());
  const [isReady, setIsReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!canvasRef.current) return;

    let mounted = true;

    const initApp = async () => {
      try {
        const app = new PIXI.Application();
        await app.init({
          width: 800,
          height: 500,
          backgroundColor: 0x1a1a1a,
          antialias: true,
        });

        if (canvasRef.current && mounted) {
          canvasRef.current.innerHTML = '';
          canvasRef.current.appendChild(app.canvas as HTMLCanvasElement);
          appRef.current = app;
          await initializeGame(app);
          setIsReady(true);
          setError(null);
        }
      } catch (err) {
        console.error('Failed to initialize PixiJS:', err);
        setError(`Failed to initialize game: ${err instanceof Error ? err.message : String(err)}`);
      }
    };

    initApp();

    return () => {
      mounted = false;
      if (appRef.current) {
        try {
          appRef.current.destroy();
          appRef.current = null;
        } catch (e) {
          console.error('Error destroying app:', e);
        }
      }
    };
  }, []);

  useEffect(() => {
    if (!appRef.current || !isReady) return;

    const app = appRef.current;
    const state = gameEngine.getState();
    
    if (isSpinning) {
      performSpinAnimation(app, state.grid);
    } else {
      updateGridDisplay(app, state.grid);
    }
  }, [isSpinning, gameEngine, isReady]);

  const initializeGame = async (app: PIXI.Application) => {
    try {
      const boardBg = new PIXI.Graphics();
      boardBg.rect(0, 0, 800, 500);
      boardBg.fill(0x2a2a2a);
      boardBg.stroke({ width: 2, color: 0x000000 });
      app.stage.addChild(boardBg);

      const cellWidth = 800 / symbolsConfig.gridSize.columns;
      const cellHeight = 500 / symbolsConfig.gridSize.rows;

      // Create reels with extended symbols for continuous scrolling
      for (let col = 0; col < symbolsConfig.gridSize.columns; col++) {
        const reelContainer = new PIXI.Container();
        reelContainer.position.set(col * cellWidth, 0);
        
        const mask = new PIXI.Graphics();
        mask.rect(0, 0, cellWidth, 500);
        mask.fill(0xffffff);
        app.stage.addChild(mask);
        reelContainer.mask = mask;
        
        const cells: PIXI.Container[] = [];
        
        // Create extended cells (with buffer above and below for continuous scrolling)
        for (let row = -2; row < symbolsConfig.gridSize.rows + 2; row++) {
          const cellContainer = new PIXI.Container();
          cellContainer.position.set(0, row * cellHeight);
          
          const bg = new PIXI.Graphics();
          bg.rect(1, 1, cellWidth - 2, cellHeight - 2);
          bg.fill(0xffffff);
          bg.stroke({ width: 1, color: 0xcccccc });
          cellContainer.addChild(bg);
          
          const emojiText = new PIXI.Text({
            text: '?',
            style: {
              fontSize: 40,
              align: 'center',
            }
          });
          emojiText.anchor.set(0.5);
          emojiText.position.set(cellWidth / 2, cellHeight / 2 - 8);
          cellContainer.addChild(emojiText);
          
          reelContainer.addChild(cellContainer);
          cells.push(cellContainer);
          
          if (row >= 0 && row < symbolsConfig.gridSize.rows) {
            cellsRef.current.set(`${row}-${col}`, cellContainer);
          }
        }
        
        app.stage.addChild(reelContainer);
        reelsRef.current.set(col, { container: reelContainer, cells, velocity: 0 });
      }

    } catch (error) {
      console.error('Failed to initialize game:', error);
      throw error;
    }
  };

  const updateGridDisplay = (app: PIXI.Application, grid: GridCell[][]) => {
    const cellHeight = 500 / symbolsConfig.gridSize.rows;

    for (let row = 0; row < grid.length; row++) {
      for (let col = 0; col < grid[row].length; col++) {
        const cell = grid[row][col];
        const key = `${row}-${col}`;
        const cellContainer = cellsRef.current.get(key);

        if (cellContainer && cell) {
          const emoji = SYMBOL_EMOJIS[cell.symbol.id] || '❓';
          const emojiText = cellContainer.children[1] as PIXI.Text;
          if (emojiText) {
            emojiText.text = emoji;
          }
          
          cellContainer.position.y = row * cellHeight;
          cellContainer.alpha = 1;
          
          if (cellContainer.children[0]) {
            const bg = cellContainer.children[0] as PIXI.Graphics;
            bg.clear();
            bg.rect(1, 1, 800 / symbolsConfig.gridSize.columns - 2, cellHeight - 2);
            bg.fill(0xffffff);
            bg.stroke({ width: 1, color: 0xcccccc });
          }
        }
      }
    }
  };

  const performSpinAnimation = async (app: PIXI.Application, grid: GridCell[][]) => {
    const cellHeight = 500 / symbolsConfig.gridSize.rows;
    const spinDuration = 2000;

    return new Promise<void>((resolve) => {
      const startTime = Date.now();
      const reels = Array.from(reelsRef.current.values());

      const spinTicker = () => {
        const elapsed = Date.now() - startTime;
        const progress = Math.min(elapsed / spinDuration, 1);

        reels.forEach((reel, colIndex) => {
          const staggerDelay = colIndex * 100;
          const adjustedProgress = Math.max(0, progress - staggerDelay / spinDuration);
          
          if (adjustedProgress > 0) {
            const easeProgress = adjustedProgress < 0.7 
              ? adjustedProgress / 0.7 
              : 0.7 + (adjustedProgress - 0.7) * 0.3;
            
            reel.velocity = 30 * (1 - easeProgress);
            reel.container.y += reel.velocity;

            // Wrap around for infinite scroll
            if (reel.container.y > cellHeight * symbolsConfig.gridSize.rows) {
              reel.container.y -= cellHeight * symbolsConfig.gridSize.rows;
            }
          }
        });

        if (progress >= 1) {
          app.ticker.remove(spinTicker as any);
          
          reels.forEach((reel) => {
            reel.container.y = 0;
            reel.velocity = 0;
          });

          updateGridDisplay(app, grid);

          const state = gameEngine.getState();
          if (state.cascadeSteps && state.cascadeSteps.length > 0) {
            performCascadeAnimations(app, state.cascadeSteps).then(() => {
              onSpinComplete?.({});
              resolve();
            });
          } else {
            onSpinComplete?.({});
            resolve();
          }
        }
      };

      app.ticker.add(spinTicker);
    });
  };

  const performCascadeAnimations = async (app: PIXI.Application, cascadeSteps: any[]): Promise<void> => {
    for (const step of cascadeSteps) {
      await performExplosion(app, step.wins);
      await performDrop(app, step.wins);
      updateGridDisplay(app, step.newGrid);
    }
  };

  const performExplosion = async (app: PIXI.Application, wins: any[]): Promise<void> => {
    return new Promise<void>((resolve) => {
      const explosionDuration = 400;
      const startTime = Date.now();

      const explosionTicker = () => {
        const elapsed = Date.now() - startTime;
        const progress = Math.min(elapsed / explosionDuration, 1);

        wins.forEach((win: any) => {
          win.cells.forEach((cell: GridCell) => {
            const key = `${cell.row}-${cell.col}`;
            const cellContainer = cellsRef.current.get(key);
            if (cellContainer && cellContainer.children[0]) {
              const bg = cellContainer.children[0] as PIXI.Graphics;
              bg.clear();
              bg.rect(1, 1, 800 / symbolsConfig.gridSize.columns - 2, 500 / symbolsConfig.gridSize.rows - 2);
              bg.fill(0xff6b6b);
              bg.stroke({ width: 2, color: 0xff0000 });
              
              cellContainer.scale.set(1 + progress * 0.2);
              
              if (cellContainer.children[1]) {
                (cellContainer.children[1] as PIXI.Text).alpha = 1 - progress;
              }
            }
          });
        });

        if (progress >= 1) {
          app.ticker.remove(explosionTicker as any);
          
          wins.forEach((win: any) => {
            win.cells.forEach((cell: GridCell) => {
              const key = `${cell.row}-${cell.col}`;
              const cellContainer = cellsRef.current.get(key);
              if (cellContainer) {
                cellContainer.visible = false;
              }
            });
          });

          resolve();
        }
      };

      app.ticker.add(explosionTicker);
    });
  };

  const performDrop = async (app: PIXI.Application, wins: any[]): Promise<void> => {
    return new Promise<void>((resolve) => {
      const dropDuration = 500;
      const startTime = Date.now();
      const cellHeight = 500 / symbolsConfig.gridSize.rows;

      const affectedCols = new Set<number>();
      wins.forEach((win: any) => {
        win.cells.forEach((cell: GridCell) => {
          affectedCols.add(cell.col);
        });
      });

      const dropTicker = () => {
        const elapsed = Date.now() - startTime;
        const progress = Math.min(elapsed / dropDuration, 1);
        const dropDistance = cellHeight * progress;

        cellsRef.current.forEach((cellContainer, key) => {
          const [row, col] = key.split('-').map(Number);
          
          if (affectedCols.has(col) && cellContainer.visible) {
            let shouldDrop = false;
            wins.forEach((win: any) => {
              win.cells.forEach((cell: GridCell) => {
                if (cell.col === col && row < cell.row) {
                  shouldDrop = true;
                }
              });
            });

            if (shouldDrop) {
              cellContainer.position.y = row * cellHeight + dropDistance;
            }
          }
        });

        if (progress >= 1) {
          app.ticker.remove(dropTicker as any);
          resolve();
        }
      };

      app.ticker.add(dropTicker);
    });
  };

  if (error) {
    return (
      <div 
        className="flex justify-center items-center bg-red-900 text-white p-4 rounded"
        style={{ width: '800px', height: '500px' }}
      >
        <div className="text-center">
          <div className="text-xl font-bold mb-2">Error Loading Game</div>
          <div className="text-sm">{error}</div>
        </div>
      </div>
    );
  }

  return (
    <div 
      ref={canvasRef} 
      className="flex justify-center items-center bg-gray-900"
      style={{ width: '800px', height: '500px' }}
    />
  );
}
