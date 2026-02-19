import { useState, useMemo } from 'react';
import GameCanvas from '../components/GameCanvas';
import GameLayout from '../components/GameLayout';
import BottomControlBar from '../components/BottomControlBar';
import LeftBanners from '../components/LeftBanners';
import OrdersDisplay from '../components/OrdersDisplay';
import TipsNotification from '../components/TipsNotification'; // ← НОВЫЙ ИМПОРТ
import { GameEngine, Order } from '../lib/gameEngine';
import symbolsConfig from '../config/symbols.json'; // ← НОВЫЙ ИМПОРТ
import gameConfig from '../config/gameConfig.json'; // ← НОВЫЙ ИМПОРТ
import '../styles/orders.css'; // ← НОВЫЙ ИМПОРТ

export default function Home() {
  const gameEngine = useMemo(() => new GameEngine(), []);
  const [gameState, setGameState] = useState(() => gameEngine.getState());
  const [isSpinning, setIsSpinning] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);

  // ═══ НОВЫЙ STATE ДЛЯ TIPS NOTIFICATION ═══
  const [showTipsNotification, setShowTipsNotification] = useState(false);
  const [completedOrdersForNotif, setCompletedOrdersForNotif] = useState<Order[]>([]);
  const [superBonusAwarded, setSuperBonusAwarded] = useState(false);
  const [superBonusAmount, setSuperBonusAmount] = useState(0);
  // ════════════════════════════════════════
  
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
    const newState = gameEngine.getState();
    setGameState(newState);

    // ═══ НОВАЯ ЛОГИКА: Проверка завершенных заказов ═══
    const completed = newState.orders.filter(o => o.completed);
    
    if (completed.length > 0) {
      console.log('✅ Orders completed:', completed);
      
      // Проверяем Super Bonus (все заказы выполнены после Free Spins)
      const allCompleted = newState.orders.length > 0 && 
                           newState.orders.every(o => o.completed) &&
                           !newState.isFreeSpins && 
                           newState.freeSpinsRemaining === 0;
      
      const superBonus = allCompleted 
        ? newState.currentBet * gameConfig.orders.freeSpinsMode.superBonusMultiplier 
        : 0;
      
      if (superBonus > 0) {
        console.log('🎉 SUPER BONUS AWARDED:', superBonus);
      }
      
      // Показываем уведомление
      setCompletedOrdersForNotif(completed);
      setSuperBonusAwarded(allCompleted);
      setSuperBonusAmount(superBonus);
      setShowTipsNotification(true);
    }
    // ═══════════════════════════════════════════════════
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

  // ═══ НОВЫЙ HANDLER ДЛЯ ЗАКРЫТИЯ NOTIFICATION ═══
  const handleTipsNotificationComplete = () => {
    setShowTipsNotification(false);
    setCompletedOrdersForNotif([]);
    setSuperBonusAwarded(false);
    setSuperBonusAmount(0);
  };
  // ═════════════════════════════════════════════════

  if (!gameState) {
    return <div className="text-center p-8">Loading...</div>;
  }

  return (
    <>
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

      {/* ═══ НОВЫЙ КОМПОНЕНТ: Tips Notification ═══ */}
      {showTipsNotification && (
        <TipsNotification
          completedOrders={completedOrdersForNotif}
          symbols={symbolsConfig.symbols}
          currentBet={gameState.currentBet}
          isFreeSpins={gameState.isFreeSpins}
          superBonusAwarded={superBonusAwarded}
          superBonusAmount={superBonusAmount}
          onComplete={handleTipsNotificationComplete}
        />
      )}
      {/* ═════════════════════════════════════════ */}
    </>
  );
}