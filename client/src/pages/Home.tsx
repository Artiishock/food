
import { useState, useEffect, useMemo } from 'react';
import GameCanvas from '../components/GameCanvas';
import GameLayout from '../components/GameLayout';
import GameControls from '../components/GameControls';
import SpinControls from '../components/SpinControls';
import OrdersDisplay from '../components/OrdersDisplay';
import BonusesPanel from '../components/BonusesPanel';
import SettingsPanel from '../components/SettingsPanel';
import { GameEngine } from '../lib/gameEngine';

export default function Home() {
  const gameEngine = useMemo(() => new GameEngine(), []);
  const [gameState, setGameState] = useState(() => gameEngine.getState());
  const [isSpinning, setIsSpinning] = useState(false);
  const [autoSpinActive, setAutoSpinActive] = useState(false);

  useEffect(() => {
    const timer = setInterval(() => {
      setGameState(gameEngine.getState());
    }, 100);
    return () => clearInterval(timer);
  }, [gameEngine]);

  const handleSpin = async () => {
    if (isSpinning) return;
    try {
      setIsSpinning(true);
      await gameEngine.spin();
      setGameState(gameEngine.getState());
    } catch (error) {
      console.error(error);
      setAutoSpinActive(false);
      setIsSpinning(false);
    }
  };

  const handleSpinComplete = () => {
    setIsSpinning(false);
    setGameState(gameEngine.getState());
    if (autoSpinActive) {
      setTimeout(handleSpin, 1000);
    }
  };

  const handleAutoSpin = () => {
    setAutoSpinActive(!autoSpinActive);
    if (!autoSpinActive && !isSpinning) {
      handleSpin();
    }
  };

  if (!gameState) {
    return <div className="text-center p-8">Loading...</div>;
  }

  return (
    <GameLayout
      logo={<div className="text-4xl font-black italic tracking-tighter">FOOD SLOTS</div>}
      orders={<OrdersDisplay orders={gameState.orders} />}
      spinControls={
        <SpinControls
          onSpin={handleSpin}
          onAutoSpin={handleAutoSpin}
          isSpinning={isSpinning}
          autoSpinActive={autoSpinActive}
        />
      }
      betControls={
        <GameControls
          gameState={gameState}
          onSpin={handleSpin}
          onBetChange={(bet) => gameEngine.setBet(bet)}
          onAnteChange={(mode) => gameEngine.setAnteMode(mode)}
          onBuyFreeSpins={(type) => gameEngine.buyFreeSpins(type)}
        />
      }
      gameBoard={
        <GameCanvas
          gameEngine={gameEngine}
          isSpinning={isSpinning}
          onSpinComplete={handleSpinComplete}
        />
      }
      settings={<SettingsPanel />}
      balance={<div className="text-mono text-sm">Balance: ${gameState.balance.toFixed(2)}</div>}
      bonuses={<BonusesPanel />}
    />
  );
}
