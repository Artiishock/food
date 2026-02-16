/*
 * GameCanvas Component - PixiJS Rendering Engine
 * Smooth spinning reels + cascading win animations
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

export default function GameCanvas({ gameEngine, isSpinning = false, onSpinComplete }: GameCanvasProps) {
  const canvasRef = useRef<HTMLDivElement>(null);
  const appRef = useRef<PIXI.Application | null>(null);
  const cellsRef = useRef<Map<string, { container: PIXI.Container; bg: PIXI.Graphics; emoji: PIXI.Text }>>(new Map());
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

  // Handle spinning
  useEffect(() => {
    if (!appRef.current || !isReady) return;

    const app = appRef.current;
    const state = gameEngine.getState();
    
    if (isSpinning) {
      performSpinAnimation(app, state.grid);
    } else {
      // Update display after spin completes
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

      // Create grid cells
      for (let row = 0; row < symbolsConfig.gridSize.rows; row++) {
        for (let col = 0; col < symbolsConfig.gridSize.columns; col++) {
          const cellContainer = new PIXI.Container();
          cellContainer.position.set(col * cellWidth, row * cellHeight);
          
          // Background
          const bg = new PIXI.Graphics();
          bg.rect(1, 1, cellWidth - 2, cellHeight - 2);
          bg.fill(0xffffff);
          bg.stroke({ width: 1, color: 0xcccccc });
          cellContainer.addChild(bg);
          
          // Emoji text
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
          
          app.stage.addChild(cellContainer);
          cellsRef.current.set(`${row}-${col}`, { container: cellContainer, bg, emoji: emojiText });
        }
      }

    } catch (error) {
      console.error('Failed to initialize game:', error);
      throw error;
    }
  };

  const updateGridDisplay = (app: PIXI.Application, grid: GridCell[][]) => {
    for (let row = 0; row < grid.length; row++) {
      for (let col = 0; col < grid[row].length; col++) {
        const cell = grid[row][col];
        const key = `${row}-${col}`;
        const cellData = cellsRef.current.get(key);

        if (cellData && cell) {
          const emoji = SYMBOL_EMOJIS[cell.symbol.id] || '❓';
          cellData.emoji.text = emoji;
          cellData.bg.clear();
          cellData.bg.rect(1, 1, 800 / symbolsConfig.gridSize.columns - 2, 500 / symbolsConfig.gridSize.rows - 2);
          cellData.bg.fill(0xffffff);
          cellData.bg.stroke({ width: 1, color: 0xcccccc });
        }
      }
    }
  };

  const performSpinAnimation = async (app: PIXI.Application, grid: GridCell[][]) => {
    const cellWidth = 800 / symbolsConfig.gridSize.columns;
    const cellHeight = 500 / symbolsConfig.gridSize.rows;
    const spinDuration = 2000;

    return new Promise<void>((resolve) => {
      const startTime = Date.now();

      const spinTicker = () => {
        const elapsed = Date.now() - startTime;
        const progress = Math.min(elapsed / spinDuration, 1);

        // Smooth spinning animation for all cells
        cellsRef.current.forEach((cellData) => {
          cellData.container.rotation = progress * Math.PI * 6;
          cellData.container.alpha = 0.6 + progress * 0.4;
          cellData.container.scale.set(0.8 + progress * 0.2);
        });

        if (progress >= 1) {
          app.ticker.remove(spinTicker as any);
          
          // Reset animation properties
          cellsRef.current.forEach((cellData) => {
            cellData.container.rotation = 0;
            cellData.container.alpha = 1;
            cellData.container.scale.set(1);
          });

          // Update grid display
          updateGridDisplay(app, grid);

          // Perform cascade animations if there are wins
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
      // Explosion animation for winning symbols
      await performExplosion(app, step.wins);
      
      // Drop animation
      await performDrop(app);
      
      // Update grid
      updateGridDisplay(app, step.newGrid);
    }
  };

  const performExplosion = async (app: PIXI.Application, wins: any[]): Promise<void> => {
    return new Promise<void>((resolve) => {
      const explosionDuration = 600;
      const startTime = Date.now();

      const explosionTicker = () => {
        const elapsed = Date.now() - startTime;
        const progress = Math.min(elapsed / explosionDuration, 1);

        // Highlight and scale winning cells
        wins.forEach((win: any) => {
          win.cells.forEach((cell: GridCell) => {
            const key = `${cell.row}-${cell.col}`;
            const cellData = cellsRef.current.get(key);
            if (cellData) {
              cellData.bg.clear();
              cellData.bg.rect(1, 1, 800 / symbolsConfig.gridSize.columns - 2, 500 / symbolsConfig.gridSize.rows - 2);
              cellData.bg.fill(0xff6b6b); // Red for explosion
              cellData.bg.stroke({ width: 2, color: 0xff0000 });
              
              cellData.container.scale.set(1 + progress * 0.3);
              cellData.emoji.alpha = 1 - progress;
            }
          });
        });

        if (progress >= 1) {
          app.ticker.remove(explosionTicker as any);
          
          // Clear explosion effect
          wins.forEach((win: any) => {
            win.cells.forEach((cell: GridCell) => {
              const key = `${cell.row}-${cell.col}`;
              const cellData = cellsRef.current.get(key);
              if (cellData) {
                cellData.container.scale.set(1);
                cellData.emoji.alpha = 1;
              }
            });
          });

          resolve();
        }
      };

      app.ticker.add(explosionTicker);
    });
  };

  const performDrop = async (app: PIXI.Application): Promise<void> => {
    return new Promise<void>((resolve) => {
      const dropDuration = 400;
      const startTime = Date.now();

      const dropTicker = () => {
        const elapsed = Date.now() - startTime;
        const progress = Math.min(elapsed / dropDuration, 1);

        // Simulate drop with scale and position changes
        cellsRef.current.forEach((cellData) => {
          cellData.container.y += progress * 5;
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
