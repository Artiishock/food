import { useState, useEffect, useMemo } from 'react';
import GameCanvas from '../components/GameCanvas';
import GameLayout from '../components/GameLayout';
import BottomControlBar from '../components/BottomControlBar';
import LeftBanners from '../components/LeftBanners';
import OrdersDisplay from '../components/OrdersDisplay';
import { GameEngine } from '../lib/gameEngine';

export default function Home() {
  const gameEngine = useMemo(() => new GameEngine(), []);
  const [gameState, setGameState] = useState(() => gameEngine.getState());
  const [isSpinning, setIsSpinning] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);

  // Remove the interval - only update on explicit actions
  // This prevents infinite re-renders and animation loops
  
  const handleSpin = async () => {
    if (isSpinning) return;
    
    try {
      setIsSpinning(true);
      const result = await gameEngine.spin();
      // State will be updated in handleSpinComplete
    } catch (error) {
      console.error('Spin error:', error);
      setIsSpinning(false);
      setGameState(gameEngine.getState());
    }
  };

  const handleSpinComplete = () => {
    setIsSpinning(false);
    setGameState(gameEngine.getState());
  };

  const handleBetIncrease = () => {
    const newBet = Math.min(100, gameState.currentBet + 1);
    gameEngine.setBet(newBet);
    setGameState(gameEngine.getState());
  };

  const handleBetDecrease = () => {
    const newBet = Math.max(1, gameState.currentBet - 1);
    gameEngine.setBet(newBet);
    setGameState(gameEngine.getState());
  };

  const handleBuyFreeSpins = (type: 'cheap' | 'standard') => {
    try {
      gameEngine.buyFreeSpins(type);
      setGameState(gameEngine.getState());
    } catch (error) {
      console.error('Failed to buy free spins:', error);
    }
  };

  const handleAnteChange = (mode: 'none' | 'low' | 'high') => {
    gameEngine.setAnteMode(mode);
    setGameState(gameEngine.getState());
  };

  if (!gameState) {
    return <div className="text-center p-8">Loading...</div>;
  }

  return (
    <GameLayout
      logo={<div className="text-4xl font-black italic tracking-tighter text-center">FOOD<br/>SLOTS</div>}
      orders={<OrdersDisplay orders={gameState.orders} />}
      gameBoard={
        <GameCanvas
          gameEngine={gameEngine}
          isSpinning={isSpinning}
          onSpinComplete={handleSpinComplete}
        />
      }
      leftBanners={
        <LeftBanners
          isFreeSpins={gameState.isFreeSpins}
          freeSpinsRemaining={gameState.freeSpinsRemaining}
          anteMode={gameState.anteMode}
          onBuyFreeSpins={handleBuyFreeSpins}
          onAnteChange={handleAnteChange}
          isSpinning={isSpinning}
        />
      }
      bottomBar={
        <BottomControlBar
          balance={gameState.balance}
          currentBet={gameState.currentBet}
          isSpinning={isSpinning}
          onSpin={handleSpin}
          onBetIncrease={handleBetIncrease}
          onBetDecrease={handleBetDecrease}
          onAutoSpin={handleSpin}
          onSettings={() => console.log('Settings')}
          onInfo={() => console.log('Info')}
          soundEnabled={soundEnabled}
          onToggleSound={() => setSoundEnabled(!soundEnabled)}
        />
      }
    />
  );
}