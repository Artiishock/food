import { useState, useMemo, useRef } from 'react';
import GameCanvas from '../components/GameCanvas';
import GameLayout from '../components/GameLayout';
import BottomControlBar from '../components/BottomControlBar';
import LeftBanners from '../components/LeftBanners';
import OrdersDisplay from '../components/OrdersDisplay';
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

  // Ордера подготовленные ЗАРАНЕЕ — до начала анимации барабанов.
  // Они показываются в блоке заказов в момент когда scatter долетает,
  // ещё до того как начались каскады.
  const [pendingOrders, setPendingOrders] = useState<Order[]>([]);
  const [lastWin, setLastWin] = useState(0);

  // Ref хранит triggerFn из OrdersDisplay.
  // Когда scatter долетает до блока заказов — GameCanvas вызывает onOrdersAppear(),
  // которая вызывает этот триггер и ЖДЁТ его Promise прежде чем запустить каскады.
  const ordersAnimTriggerRef = useRef<(() => Promise<void>) | null>(null);

  const handleSpin = async () => {
    if (isSpinning) return;
    setLastWin(0);
    setIsFast(false);
    try {
      // Готовим сетку и ордера заранее, но НЕ показываем их в UI.
      // Ордера появятся только когда scatter долетит до блока заказов.
      gameEngine.prepare();

      setIsSpinning(true);
      await gameEngine.spin();
    } catch (error) {
      console.error('Spin error:', error);
      setIsSpinning(false);
      setPendingOrders([]);
      setGameState(gameEngine.getState());
    }
  };

  const handleSpinComplete = () => {
    console.log("[Home] handleSpinComplete called, isFast will be reset");
    setIsSpinning(false);
    setIsFast(false);
    // Все каскады завершены — старые ордера больше не нужны отдельно.
    // gameState.orders теперь содержит актуальное состояние (включая новые ордера).
    // Очищаем pendingOrders чтобы убрать дубли.
    setPendingOrders([]);
    const newState = gameEngine.getState();
    setGameState(newState);
    setLastWin(newState.totalWin ?? 0);

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
              // Старые ордера показываем до конца спина — они ещё могут выполниться в каскадах.
              // Новые (pending) появляются когда scatter долетел, но рядом со старыми.
              // После handleSpinComplete pendingOrders очищается и остаётся только gameState.orders.
              ...gameState.orders,
              ...pendingOrders.filter(p =>
                // не дублируем если ордер уже есть в gameState (после спина)
                !gameState.orders.some(o => o.symbolId === p.symbolId && o.quantity === p.quantity && o.collected === 0)
              )
            ]}
            onReadyToShow={(triggerFn) => {
              // OrdersDisplay регистрирует свою анимацию-триггер здесь.
              // GameCanvas будет вызывать её когда scatter долетает к блоку заказов.
              ordersAnimTriggerRef.current = triggerFn;
            }}
          />
        }
        gameBoard={
          <GameCanvas
            gameEngine={gameEngine}
            isSpinning={isSpinning}
            soundEnabled={soundEnabled}
            onSpinComplete={handleSpinComplete}
            onSpeedUpReady={(fn) => setOnSpeedUp(() => fn)}
            onOrdersAppear={() => {
              // Scatter долетел — теперь показываем ордера в блоке заказов.
              // Берём pendingOrders из движка и кладём в React state.
              // preparedOrders — снапшот созданный в prepare(), не расходуется spin().
              // Именно эти ордера показываем в момент прилёта scatter.
              const state = gameEngine.getState();
              const toShow = state.preparedOrders.length > 0
                ? state.preparedOrders
                : state.orders;
              setPendingOrders(toShow);
              // Запускаем анимацию появления карточки и ждём (600ms).
              // Каскады стартуют только после resolve.
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