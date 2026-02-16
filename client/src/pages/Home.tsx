
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
  const [gameState, setGameState] = useState(gameEngine.getState());
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
    } catch (error) {
      console.error(error);
      setAutoSpinActive(false);
      setIsSpinning(false);
    }
  };

  const handleSpinComplete = () => {
    setIsSpinning(false);
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
          state={gameState}
          onSetBet={(bet) => gameEngine.setBet(bet)}
          onSetAnte={(mode) => gameEngine.setAnteMode(mode)}
          onBuyFreeSpins={(type) => gameEngine.buyFreeSpins(type)}
        />
      }
    >
      <GameCanvas
        gameEngine={gameEngine}
        isSpinning={isSpinning}
        onSpinComplete={handleSpinComplete}
      />
    </GameLayout>
  );
}
