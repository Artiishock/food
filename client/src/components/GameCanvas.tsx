/*
 * GameCanvas Component - PixiJS Rendering Engine
 * Design: Animated spinning reels with cascading wins
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

// Symbol emoji mapping
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

  // Handle spinning and grid updates
  useEffect(() => {
    if (!appRef.current || !isReady) return;

    const app = appRef.current;
    const state = gameEngine.getState();
    
    // Update grid display
    updateGridDisplay(app, state.grid);

    if (isSpinning) {
      performSpin(app, state.grid);
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
          cellsRef.current.set(`${row}-${col}`, cellContainer);
        }
      }

    } catch (error) {
      console.error('Failed to initialize game:', error);
      throw error;
    }
  };

  const updateGridDisplay = (app: PIXI.Application, grid: GridCell[][]) => {
    const cellWidth = 800 / symbolsConfig.gridSize.columns;
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
        }
      }
    }
  };

  const performSpin = async (app: PIXI.Application, grid: GridCell[][]) => {
    const cellWidth = 800 / symbolsConfig.gridSize.columns;
    const cellHeight = 500 / symbolsConfig.gridSize.rows;

    // Animate spinning
    const spinDuration = 2000;
    const startTime = Date.now();

    return new Promise<void>((resolve) => {
      const spinTicker = () => {
        const elapsed = Date.now() - startTime;
        const progress = Math.min(elapsed / spinDuration, 1);

        // Rotate cells
        cellsRef.current.forEach((cellContainer) => {
          cellContainer.rotation = progress * Math.PI * 4;
          cellContainer.alpha = 0.7 + progress * 0.3;
        });

        if (progress >= 1) {
          app.ticker.remove(spinTicker as any);
          
          // Reset rotation and update display
          cellsRef.current.forEach((cellContainer) => {
            cellContainer.rotation = 0;
            cellContainer.alpha = 1;
          });

          updateGridDisplay(app, grid);
          onSpinComplete?.({});
          resolve();
        }
      };

      app.ticker.add(spinTicker);
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
