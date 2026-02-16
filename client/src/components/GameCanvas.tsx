/*
 * GameCanvas Component - PixiJS Rendering Engine
 * Design: Animated spinning reels with real food icons
 */

import { useEffect, useRef, useState } from 'react';
import * as PIXI from 'pixi.js';
import { GameEngine } from '../lib/gameEngine';
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

const SYMBOL_NAMES = ['burger', 'drink', 'pie', 'scatter', 'pizza', 'taco', 'fries', 'burrito', 'hotdog', 'chicken', 'wrap'];

export default function GameCanvas({ gameEngine, isSpinning = false, onSpinComplete }: GameCanvasProps) {
  const canvasRef = useRef<HTMLDivElement>(null);
  const appRef = useRef<PIXI.Application | null>(null);
  const columnsRef = useRef<Map<number, { container: PIXI.Container; sprites: PIXI.Container[]; velocity: number; stopRequested: boolean; finalY: number | null }>>(new Map());
  const [isReady, setIsReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!canvasRef.current) return;

    let mounted = true;

    const initApp = async () => {
      try {
        const app = new PIXI.Application();
        await app.init({
          width: 900,
          height: 600,
          backgroundColor: 0x000000,
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

  // Handle spinning animation
  useEffect(() => {
    if (!isSpinning || !appRef.current) return;

    const app = appRef.current;
    const columns = Array.from(columnsRef.current.values());
    if (columns.length === 0) return;

    const cellHeight = 100;

    // Start spinning all columns
    columns.forEach((col) => {
      col.velocity = 25 + Math.random() * 10;
      col.stopRequested = false;
      col.finalY = null;
    });

    const startTime = Date.now();
    const spinDuration = 1000;

    const spinTicker = () => {
      const now = Date.now();
      const elapsed = now - startTime;
      
      let allStopped = true;

      columns.forEach((col, colIndex) => {
        const reelStopTime = spinDuration + colIndex * 300;
        
        if (elapsed > reelStopTime && !col.stopRequested) {
          col.stopRequested = true;
          col.finalY = Math.round(col.container.y / cellHeight) * cellHeight;
        }

        if (col.velocity > 0 || (col.finalY !== null && Math.abs(col.container.y - col.finalY) > 0.5)) {
          allStopped = false;
          
          if (col.stopRequested && col.finalY !== null) {
            const diff = col.finalY - col.container.y;
            
            col.velocity *= 0.92;
            
            if (col.velocity < 2 && Math.abs(diff) < 20) {
              col.container.y = col.finalY;
              col.velocity = 0;
            } else {
              col.container.y += col.velocity;
              col.container.y += diff * 0.1;
            }
          } else {
            col.container.y += col.velocity;
          }

          if (col.container.y > 150) {
            col.container.y -= cellHeight;
            if (col.finalY !== null) col.finalY -= cellHeight;
          } else if (col.container.y < -50) {
            col.container.y += cellHeight;
            if (col.finalY !== null) col.finalY += cellHeight;
          }
        }
      });

      if (allStopped) {
        app.ticker.remove(spinTicker as any);
        onSpinComplete?.({});
      }
    };

    app.ticker.add(spinTicker);
  }, [isSpinning, onSpinComplete]);

  const initializeGame = async (app: PIXI.Application) => {
    try {
      const boardBg = new PIXI.Graphics();
      boardBg.rect(50, 50, 800, 500);
      boardBg.fill(0x2a2a2a);
      boardBg.stroke({ width: 10, color: 0x000000 });
      app.stage.addChild(boardBg);

      const mask = new PIXI.Graphics();
      mask.rect(50, 50, 800, 500);
      mask.fill(0xffffff);
      app.stage.addChild(mask);

      const cellWidth = 800 / symbolsConfig.gridSize.columns;
      const cellHeight = 100;

      for (let col = 0; col < symbolsConfig.gridSize.columns; col++) {
        const container = new PIXI.Container();
        container.x = 50 + col * cellWidth + cellWidth / 2;
        container.y = 50;
        container.mask = mask;
        
        const sprites: PIXI.Container[] = [];

        for (let i = -3; i < 8; i++) {
          const cellContainer = new PIXI.Container();
          cellContainer.position.set(0, i * cellHeight);
          
          const bg = new PIXI.Graphics();
          bg.rect(-cellWidth / 2 + 5, -cellHeight / 2 + 5, cellWidth - 10, cellHeight - 10);
          bg.fill(0xffffff);
          bg.stroke({ width: 3, color: 0x000000 });
          cellContainer.addChild(bg);
          
          const symbolName = SYMBOL_NAMES[Math.abs(i) % SYMBOL_NAMES.length];
          const emoji = SYMBOL_EMOJIS[symbolName] || '❓';
          const emojiText = new PIXI.Text({
            text: emoji,
            style: {
              fontSize: 56,
              align: 'center',
            }
          });
          emojiText.anchor.set(0.5);
          emojiText.position.set(0, -12);
          cellContainer.addChild(emojiText);
          
          const nameText = new PIXI.Text({
            text: symbolName.substring(0, 3).toUpperCase(),
            style: {
              fontFamily: 'IBM Plex Mono, monospace',
              fontSize: 11,
              fontWeight: '600',
              fill: 0x000000,
              align: 'center',
            }
          });
          nameText.anchor.set(0.5);
          nameText.position.set(0, cellHeight / 2 - 12);
          cellContainer.addChild(nameText);
          
          container.addChild(cellContainer);
          sprites.push(cellContainer);
        }

        app.stage.addChild(container);
        columnsRef.current.set(col, { container, sprites, velocity: 0, stopRequested: false, finalY: null });
      }

      const gridLines = new PIXI.Graphics();
      for (let i = 0; i <= symbolsConfig.gridSize.columns; i++) {
        const x = 50 + i * cellWidth;
        gridLines.moveTo(x, 50);
        gridLines.lineTo(x, 550);
      }
      for (let i = 0; i <= symbolsConfig.gridSize.rows; i++) {
        const y = 50 + i * cellHeight;
        gridLines.moveTo(50, y);
        gridLines.lineTo(850, y);
      }
      gridLines.stroke({ width: 2, color: 0x444444 });
      app.stage.addChild(gridLines);

    } catch (error) {
      console.error('Failed to initialize game:', error);
      throw error;
    }
  };

  if (error) {
    return (
      <div 
        className="flex justify-center items-center bg-red-900 text-white p-4 rounded"
        style={{ width: '900px', height: '600px' }}
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
      style={{ width: '900px', height: '600px' }}
    />
  );
}
