/* Neo-Brutalist Street Food Aesthetic - Game Controls
 * Design: Asymmetric button placement, thick borders, bold typography
 * Interactions: Exaggerated hover states with border shifts
 */

import { useState } from 'react';
import { Button } from './ui/button';
import { GameState } from '../lib/gameEngine';

interface GameControlsProps {
  gameState: GameState;
  onSpin: () => void;
  onBetChange: (amount: number) => void;
  onAnteChange: (mode: 'none' | 'low' | 'high') => void;
  onBuyFreeSpins: (packageType: 'cheap' | 'standard') => void;
}

export default function GameControls({
  gameState,
  onSpin,
  onBetChange,
  onAnteChange,
  onBuyFreeSpins
}: GameControlsProps) {
  const [showBuyMenu, setShowBuyMenu] = useState(false);

  return (
    <div className="space-y-6">
      {/* Balance Display */}
      <div className="brutalist-border bg-white p-6 brutalist-shadow">
        <div className="space-y-4">
          <div>
            <div className="text-mono text-sm mb-1">BALANCE</div>
            <div className="text-brutalist text-4xl">${gameState.balance.toFixed(2)}</div>
          </div>
          
          {gameState.totalWin > 0 && (
            <div>
              <div className="text-mono text-sm mb-1">LAST WIN</div>
              <div className="text-brutalist text-2xl" style={{ color: '#ff3838' }}>
                +${gameState.totalWin.toFixed(2)}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Bet Controls */}
      <div className="brutalist-border bg-white p-6 brutalist-shadow">
        <div className="text-mono text-sm mb-4">BET AMOUNT</div>
        <div className="flex items-center gap-4">
          <Button
            variant="outline"
            onClick={() => onBetChange(Math.max(1, gameState.currentBet - 1))}
            disabled={gameState.isSpinning}
            className="brutalist-border brutalist-shadow-hover bg-white text-black hover:bg-white w-12 h-12 p-0 text-2xl font-bold"
          >
            -
          </Button>
          <div className="text-brutalist text-3xl flex-1 text-center">
            ${gameState.currentBet}
          </div>
          <Button
            variant="outline"
            onClick={() => onBetChange(Math.min(100, gameState.currentBet + 1))}
            disabled={gameState.isSpinning}
            className="brutalist-border brutalist-shadow-hover bg-white text-black hover:bg-white w-12 h-12 p-0 text-2xl font-bold"
          >
            +
          </Button>
        </div>
      </div>

      {/* Ante Mode */}
      <div className="brutalist-border bg-white p-6 brutalist-shadow">
        <div className="text-mono text-sm mb-4">ANTE MODE</div>
        <div className="grid grid-cols-3 gap-2">
          <Button
            variant={gameState.anteMode === 'none' ? 'default' : 'outline'}
            onClick={() => onAnteChange('none')}
            disabled={gameState.isSpinning}
            className={`brutalist-border brutalist-shadow-hover text-xs ${
              gameState.anteMode === 'none' 
                ? 'bg-black text-white hover:bg-black' 
                : 'bg-white text-black hover:bg-white'
            }`}
          >
            NORMAL
          </Button>
          <Button
            variant={gameState.anteMode === 'low' ? 'default' : 'outline'}
            onClick={() => onAnteChange('low')}
            disabled={gameState.isSpinning}
            className={`brutalist-border brutalist-shadow-hover text-xs ${
              gameState.anteMode === 'low' 
                ? 'bg-black text-white hover:bg-black' 
                : 'bg-white text-black hover:bg-white'
            }`}
          >
            LOW 1.25x
          </Button>
          <Button
            variant={gameState.anteMode === 'high' ? 'default' : 'outline'}
            onClick={() => onAnteChange('high')}
            disabled={gameState.isSpinning}
            className={`brutalist-border brutalist-shadow-hover text-xs ${
              gameState.anteMode === 'high' 
                ? 'bg-black text-white hover:bg-black' 
                : 'bg-white text-black hover:bg-white'
            }`}
          >
            HIGH 5x
          </Button>
        </div>
      </div>

      {/* Spin Button */}
      <Button
        onClick={onSpin}
        disabled={gameState.isSpinning}
        className="w-full h-20 brutalist-border-thick brutalist-shadow-hover text-brutalist text-3xl"
        style={{ 
          backgroundColor: '#ffd700',
          color: '#1a1a1a',
          border: '12px solid #000000'
        }}
      >
        {gameState.isSpinning ? 'SPINNING...' : 'SPIN'}
      </Button>

      {/* Free Spins Info */}
      {gameState.isFreeSpins && (
        <div className="brutalist-border p-6 brutalist-shadow" style={{ backgroundColor: '#00ff88' }}>
          <div className="text-brutalist text-2xl text-black">
            FREE SPINS
          </div>
          <div className="text-mono text-xl text-black mt-2">
            {gameState.freeSpinsRemaining} REMAINING
          </div>
        </div>
      )}

      {/* Buy Free Spins */}
      {!gameState.isFreeSpins && (
        <div className="space-y-2">
          <Button
            onClick={() => setShowBuyMenu(!showBuyMenu)}
            variant="outline"
            className="w-full brutalist-border brutalist-shadow-hover bg-white text-black hover:bg-white"
          >
            BUY FREE SPINS
          </Button>
          
          {showBuyMenu && (
            <div className="brutalist-border bg-white p-4 space-y-2">
              <Button
                onClick={() => {
                  onBuyFreeSpins('cheap');
                  setShowBuyMenu(false);
                }}
                className="w-full brutalist-border brutalist-shadow-hover bg-white text-black hover:bg-white text-sm"
              >
                CHEAP (50x bet) - 5 spins
              </Button>
              <Button
                onClick={() => {
                  onBuyFreeSpins('standard');
                  setShowBuyMenu(false);
                }}
                className="w-full brutalist-border brutalist-shadow-hover bg-white text-black hover:bg-white text-sm"
              >
                STANDARD (100x bet) - 10 spins
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
