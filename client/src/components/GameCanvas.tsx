/*
 * GameCanvas Component - PixiJS Rendering Engine
 * Design: Animated spinning reels with real food icons
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

// Symbol emoji mapping - all 11 symbols
const SYMBOL_EMOJIS: Record<string, string> = {
  'burger': '🍔',
  'drink': '🥤',
  'pie': '🥧',
  'order': '📋',
  'pizza': '🍕',
  'taco': '🌮',
  'fries': '🍟',
  'burrito': '🌯',
  'hotdog': '🌭',
  'chicken': '🍗',
  'wrap': '🌯',
};

const SYMBOL_NAMES = ['burger', 'drink', 'pie', 'order', 'pizza', 'taco', 'fries', 'burrito', 'hotdog', 'chicken', 'wrap'];

const ICON_SIZE = 128;
const ICON_COLS = 3;
const ICON_ROWS = 4;

export default function GameCanvas({ gameEngine, isSpinning = false, onSpinComplete }: GameCanvasProps) {
  const canvasRef = useRef<HTMLDivElement>(null);
  const appRef = useRef<PIXI.Application | null>(null);
  const columnsRef = useRef<Map<number, { container: PIXI.Container; sprites: PIXI.Sprite[]; velocity: number }>>(new Map());
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    if (!canvasRef.current) return;

    let mounted = true;

    const initApp = async () => {
      const app = new PIXI.Application();
      await app.init({
        width: 900,
        height: 600,
        backgroundColor: 0x000000,
      });

      if (canvasRef.current && mounted) {
        canvasRef.current.appendChild(app.canvas as HTMLCanvasElement);
        appRef.current = app;
        await initializeGame(app);
        setIsReady(true);
      }
    };

    initApp();

    return () => {
      mounted = false;
      if (appRef.current) {
        appRef.current.destroy();
        appRef.current = null;
      }
    };
  }, []);

  // Handle spinning animation
  useEffect(() => {
    if (!isSpinning) return;

    const app = appRef.current;
    if (!app) return;

    const columns = Array.from(columnsRef.current.values());
    if (columns.length === 0) return;

    // Calculate cell height based on grid (500px / 5 rows = 100px per cell)
    const cellHeight = 100;

    // Start spinning all columns
    columns.forEach((col, colIndex) => {
      col.velocity = 15 + Math.random() * 5; // Random spin speed
    });

    // Stop spinning after duration
    const spinDuration = 2000;
    const stopTime = Date.now() + spinDuration;

    const spinTicker = () => {
      const now = Date.now();
      const timeRemaining = Math.max(0, stopTime - now);
      const progress = 1 - timeRemaining / spinDuration;

      columns.forEach((col) => {
        if (progress < 0.7) {
          // Full speed spinning
          col.container.y += col.velocity;
        } else {
          // Deceleration phase
          const decelProgress = (progress - 0.7) / 0.3;
          col.velocity *= (1 - decelProgress * 0.05);
          col.container.y += col.velocity;
        }

        // Wrap around - keep within visible area
        const totalHeight = col.sprites.length * cellHeight;
        while (col.container.y > cellHeight) {
          col.container.y -= totalHeight;
        }
        while (col.container.y < -totalHeight + cellHeight) {
          col.container.y += totalHeight;
        }
      });

      if (timeRemaining === 0) {
        app.ticker.remove(spinTicker as any);
        
        // Snap to grid positions - align to exact grid positions
        columns.forEach((col) => {
          // Round to nearest grid position
          const snappedY = Math.round(col.container.y / cellHeight) * cellHeight;
          col.container.y = snappedY;
          col.velocity = 0;
        });

        onSpinComplete?.({});
      }
    };

    app.ticker.add(spinTicker);
  }, [isSpinning, onSpinComplete]);

  const initializeGame = async (app: PIXI.Application) => {
    try {
      // Create board background
      const boardBg = new PIXI.Graphics();
      boardBg.rect(50, 50, 800, 500);
      boardBg.fill(0x2a2a2a);
      boardBg.stroke({ width: 10, color: 0x000000 });
      app.stage.addChild(boardBg);

      // Create columns with spinning animation
      const cellWidth = 800 / symbolsConfig.gridSize.columns;
      const cellHeight = 500 / symbolsConfig.gridSize.rows; // 100px per cell

      for (let col = 0; col < symbolsConfig.gridSize.columns; col++) {
        const container = new PIXI.Container();
        container.x = 50 + col * cellWidth + cellWidth / 2;
        container.y = 50; // Start at top of visible area
        
        const sprites: PIXI.Sprite[] = [];

        // Create multiple cells for each symbol position (5 rows visible)
        // We create extra rows above and below for smooth wrapping
        // Total: 2 above + 5 visible + 2 below = 9 cells for smooth animation
        for (let i = 0; i < 9; i++) {
          const cellContainer = new PIXI.Container();
          cellContainer.position.set(0, i * cellHeight);
          
          // Cell background
          const bg = new PIXI.Graphics();
          bg.rect(-cellWidth / 2 + 5, -cellHeight / 2 + 5, cellWidth - 10, cellHeight - 10);
          bg.fill(0xffffff);
          bg.stroke({ width: 3, color: 0x000000 });
          cellContainer.addChild(bg);
          
          // Add emoji icon - properly centered
          const symbolName = SYMBOL_NAMES[i % SYMBOL_NAMES.length];
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
          
          // Add symbol name label
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
          sprites.push(cellContainer as any);
        }

        // Set container to clip children at visible area
        container.cullable = true;

        app.stage.addChild(container);
        columnsRef.current.set(col, { container, sprites, velocity: 0 });
      }

      // Draw grid lines
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
    }
  };

  return (
    <div 
      ref={canvasRef} 
      className="flex justify-center items-center"
      style={{ width: '100%', height: '600px' }}
    />
  );
}
