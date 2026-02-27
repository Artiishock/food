import { useState, useMemo, useRef } from 'react';
import GameCanvas from '../components/GameCanvas';
import GameLayout from '../components/GameLayout';
import BottomControlBar from '../components/BottomControlBar';
import LeftBanners from '../components/LeftBanners';
import OrdersDisplay from '../components/OrdersDisplay';
import FreeSpinsBanner from '../components/FreeSpinsBanner';
import TipsNotification from '../components/TipsNotification';
import { GameEngine, Order } from '../lib/gameEngine';
import symbolsConfig from '../config/symbols.json';
import gameConfig from '../config/gameConfig.json';
import '../styles/orders.css';

export default function Home() {
  const gameEngine = useMemo(() => new GameEngine(), []);
  const [gameState, setGameState] = useState(() => gameEngine.getState());
  const [isSpinning, setIsSpinning] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);

  const [showTipsNotification, setShowTipsNotification] = useState(false);
  const [completedOrdersForNotif, setCompletedOrdersForNotif] = useState<Order[]>([]);
  const [superBonusAwarded, setSuperBonusAwarded] = useState(false);
  const [superBonusAmount, setSuperBonusAmount] = useState(0);

  const [onSpeedUp, setOnSpeedUp] = useState<(() => void) | null>(null);
  const [isFast, setIsFast] = useState(false);

  const [pendingOrders, setPendingOrders] = useState<Order[]>([]);
  const [lastWin, setLastWin] = useState(0);

  const ordersAnimTriggerRef = useRef<(() => Promise<void>) | null>(null);
  const isSpinningRef = useRef(false);
  const freeSpinsAutoRef = useRef(false);

  const handleSpin = async () => {
    if (isSpinningRef.current) return;
    isSpinningRef.current = true;
    setLastWin(0);
    setIsFast(false);
    try {
      gameEngine.prepare();

      setIsSpinning(true);
      await gameEngine.spin();
    } catch (error) {
      console.error('Spin error:', error);
      setIsSpinning(false);
      isSpinningRef.current = false;
      freeSpinsAutoRef.current = false;
      setPendingOrders([]);
      setGameState(gameEngine.getState());
    }
  };

  const handleSpinComplete = () => {
    setIsSpinning(false);
    isSpinningRef.current = false;
    setIsFast(false);
    setPendingOrders([]);
    const newState = gameEngine.getState();
    setGameState(newState);
    setLastWin(newState.totalWin ?? 0);

    // During free spins orders are replaced — no notification per spin
    // Only show notification for normal mode completed orders
    if (!newState.isFreeSpins) {
      const completed = newState.orders.filter(o => o.completed);
      if (completed.length > 0) {
        const allCompleted = newState.orders.length > 0 &&
                             newState.orders.every(o => o.completed) &&
                             !newState.isFreeSpins &&
                             newState.freeSpinsRemaining === 0;

        const superBonus = allCompleted
          ? newState.currentBet * gameConfig.orders.freeSpinsMode.superBonusMultiplier
          : 0;

        setCompletedOrdersForNotif(completed);
        setSuperBonusAwarded(allCompleted);
        setSuperBonusAmount(superBonus);
        setShowTipsNotification(true);
      }
    }

    // Auto-spin: continue while free spins remain
    if (freeSpinsAutoRef.current && newState.isFreeSpins && newState.freeSpinsRemaining > 0) {
      setTimeout(() => {
        if (freeSpinsAutoRef.current) handleSpin();
      }, 500);
    } else if (!newState.isFreeSpins) {
      // Free spins ended — stop auto spin
      freeSpinsAutoRef.current = false;
    }
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
    if (isSpinningRef.current) return;
    try {
      gameEngine.buyFreeSpins(type);
      setGameState(gameEngine.getState());
      // Start auto-spin for all purchased free spins
      freeSpinsAutoRef.current = true;
      setTimeout(() => handleSpin(), 300);
    } catch (error) {
      console.error('Failed to buy free spins:', error);
    }
  };

  const handleAnteChange = (mode: 'none' | 'low' | 'high') => {
    gameEngine.setAnteMode(mode);
    setGameState(gameEngine.getState());
  };

  const handleTipsNotificationComplete = () => {
    setShowTipsNotification(false);
    setCompletedOrdersForNotif([]);
    setSuperBonusAwarded(false);
    setSuperBonusAmount(0);
  };

  if (!gameState) {
    return <div className="text-center p-8">Loading...</div>;
  }

  return (
    <>
      <GameLayout
        logo={<div className="text-4xl font-black italic tracking-tighter text-center">FOOD<br/>SLOTS</div>}
        orders={
          <OrdersDisplay
            orders={[
              ...gameState.orders,
              ...pendingOrders.filter(p =>
                !gameState.orders.some(o => o.symbolId === p.symbolId && o.quantity === p.quantity && o.collected === 0)
              )
            ]}
            onReadyToShow={(triggerFn) => {
              ordersAnimTriggerRef.current = triggerFn;
            }}
          />
        }
        topBanner={
          gameState.isFreeSpins ? (
            <FreeSpinsBanner
              freeSpinsRemaining={gameState.freeSpinsRemaining}
            />
          ) : undefined
        }
        gameBoard={
          <GameCanvas
            gameEngine={gameEngine}
            isSpinning={isSpinning}
            soundEnabled={soundEnabled}
            onSpinComplete={handleSpinComplete}
            onSpeedUpReady={(fn) => setOnSpeedUp(() => fn)}
            onOrdersAppear={() => {
              const state = gameEngine.getState();
              const toShow = state.preparedOrders.length > 0
                ? state.preparedOrders
                : state.orders;
              setPendingOrders(toShow);
              if (ordersAnimTriggerRef.current) {
                return ordersAnimTriggerRef.current();
              }
              return Promise.resolve();
            }}
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
            onSpeedUp={onSpeedUp ? () => { onSpeedUp(); setIsFast(v => !v); } : undefined}
            isFast={isFast}
            lastWin={lastWin}
          />
        }
      />

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
    </>
  );
}