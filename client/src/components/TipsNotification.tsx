import React, { useEffect, useState } from 'react';
import { Order, Symbol } from '../lib/gameEngine';

interface TipsNotificationProps {
  completedOrders: Order[];
  symbols: Symbol[];
  currentBet: number;
  isFreeSpins: boolean;
  superBonusAwarded: boolean; // Если все заказы выполнены в фриспинах
  superBonusAmount?: number;
  onComplete: () => void;
}

export default function TipsNotification({ 
  completedOrders, 
  symbols,
  currentBet,
  isFreeSpins,
  superBonusAwarded,
  superBonusAmount = 0,
  onComplete 
}: TipsNotificationProps) {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setVisible(false);
      setTimeout(onComplete, 300);
    }, 5000);

    return () => clearTimeout(timer);
  }, [onComplete]);

  if (completedOrders.length === 0) {
    return null;
  }

  // Получить имя символа
  const getSymbolName = (symbolId: string): string => {
    const symbol = symbols.find(s => s.id === symbolId);
    return symbol ? symbol.name : symbolId;
  };

  // Рассчитать общие чаевые
  const totalTips = completedOrders.reduce((sum, order) => {
    return sum + (currentBet * order.tipMultiplier);
  }, 0);

  const finalTotal = superBonusAwarded ? totalTips + superBonusAmount : totalTips;

  return (
    <div 
      className={`
        fixed inset-0 z-50 flex items-center justify-center pointer-events-none
        transition-opacity duration-300
        ${visible ? 'opacity-100' : 'opacity-0'}
      `}
    >
      {/* Backdrop Glow */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />

      {/* Notification Card */}
      <div 
        className="relative bg-gradient-to-br from-yellow-500 via-orange-500 to-red-500 p-1 rounded-2xl shadow-2xl transform animate-bounce-in pointer-events-auto"
      >
        <div className="bg-gray-900 rounded-xl p-8 min-w-[400px] max-w-[500px]">
          {/* Title */}
          <div className="text-center mb-6">
            <div className="text-6xl mb-3 animate-bounce">💰</div>
            <h2 className="text-3xl font-bold bg-gradient-to-r from-yellow-400 to-orange-400 bg-clip-text text-transparent mb-2 text-glow-pulse">
              TIPS EARNED!
            </h2>
            {isFreeSpins && (
              <div className="text-sm font-bold text-purple-400">
                🎰 Free Spins Order Completed
              </div>
            )}
          </div>

          {/* Completed Orders List */}
          <div className="mb-6 space-y-2 max-h-[300px] overflow-y-auto">
            {completedOrders.map((order, index) => {
              const tips = currentBet * order.tipMultiplier;
              return (
                <div 
                  key={`${order.symbolId}-${index}`}
                  className="bg-gray-800/50 p-3 rounded-lg flex items-center justify-between border border-yellow-600/30 fade-in-up"
                  style={{ animationDelay: `${index * 0.1}s` }}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-gradient-to-br from-yellow-600 to-orange-600 rounded-full flex items-center justify-center text-xl">
                      ✓
                    </div>
                    <div>
                      <div className="text-white font-bold">{getSymbolName(order.symbolId)}</div>
                      <div className="text-xs text-gray-400">
                        {order.collected}/{order.quantity} collected
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-yellow-400 font-bold text-lg">
                      ${tips.toFixed(2)}
                    </div>
                    <div className="text-xs text-gray-400">
                      {order.tipMultiplier}x
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Calculation Breakdown */}
          <div className="mb-6 bg-black/40 p-4 rounded-lg border border-yellow-600/30">
            <div className="text-center space-y-2">
              {completedOrders.map((order, index) => {
                const tips = currentBet * order.tipMultiplier;
                return (
                  <div key={`calc-${index}`} className="text-xs text-gray-400 font-mono">
                    ${currentBet.toFixed(2)} bet × {order.tipMultiplier}x = ${tips.toFixed(2)}
                  </div>
                );
              })}
              
              {completedOrders.length > 0 && (
                <>
                  <div className="border-t border-gray-700 my-2"></div>
                  <div className="text-sm text-yellow-400 font-bold">
                    Total Tips: ${totalTips.toFixed(2)}
                  </div>
                </>
              )}

              {superBonusAwarded && (
                <>
                  <div className="text-sm text-green-400 font-bold mt-2 animate-pulse">
                    + Super Bonus: ${superBonusAmount.toFixed(2)}
                  </div>
                  <div className="text-xs text-gray-400">
                    (All orders completed in Free Spins!)
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Total Amount */}
          <div className="text-center">
            <div className="text-sm text-gray-400 mb-2">
              {superBonusAwarded ? 'Grand Total' : 'Total Earned'}
            </div>
            <div className={`text-5xl font-bold bg-gradient-to-r ${
              superBonusAwarded 
                ? 'from-green-400 via-yellow-400 to-orange-400' 
                : 'from-yellow-400 via-orange-400 to-red-400'
            } bg-clip-text text-transparent animate-pulse tips-scale`}>
              ${finalTotal.toFixed(2)}
            </div>
          </div>

          {superBonusAwarded && (
            <div className="mt-4 text-center">
              <div className="text-xl animate-bounce">
                🎉 🎉 🎉
              </div>
            </div>
          )}

          {/* Auto-close indicator */}
          <div className="mt-6 text-center text-xs text-gray-500">
            Auto-closing in 5 seconds...
          </div>
        </div>
      </div>
    </div>
  );
}