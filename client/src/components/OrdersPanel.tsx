import React from 'react';
import { Order, Symbol } from '../lib/gameEngine';
import { CheckCircle2, Clock, Star } from 'lucide-react';

interface OrdersPanelProps {
  orders: Order[];
  symbols: Symbol[]; // Нужен для получения имени символа
  isFreeSpins: boolean;
  position?: 'left' | 'right';
}

interface OrderCardProps {
  order: Order;
  symbolName: string;
  index: number;
  isFreeSpins: boolean;
}

function OrderCard({ order, symbolName, index, isFreeSpins }: OrderCardProps) {
  const progress = Math.min((order.collected / order.quantity) * 100, 100);
  const isCompleted = order.completed;
  const isActive = !isCompleted;

  return (
    <div 
      className={`
        relative p-4 rounded-lg border-2 transition-all duration-300
        ${isCompleted ? 'bg-green-900/40 border-green-500 order-completed' : ''}
        ${isActive ? 'bg-black/60 border-yellow-500 border-pulse' : ''}
      `}
      style={{
        backdropFilter: 'blur(10px)',
      }}
    >
      {/* Order Number Badge */}
      <div className="absolute -top-3 -left-3 w-8 h-8 bg-yellow-500 rounded-full flex items-center justify-center font-bold text-black text-sm border-2 border-yellow-300 shadow-lg">
        #{index + 1}
      </div>

      {/* Status Badge */}
      {isCompleted && (
        <div className="absolute -top-3 -right-3">
          <CheckCircle2 size={28} className="text-green-400 drop-shadow-lg animate-bounce" />
        </div>
      )}

      {isActive && (
        <div className="absolute -top-3 -right-3">
          <Clock size={28} className="text-yellow-400 drop-shadow-lg" />
        </div>
      )}

      {/* Symbol Name */}
      <div className="text-center mb-2">
        <h3 className="text-lg font-bold text-white mb-1">
          {symbolName}
        </h3>
        <div className="text-xs text-gray-400">
          {isFreeSpins ? 'Free Spins Order' : 'Collect for TIPS'}
        </div>
      </div>

      {/* Icon placeholder */}
      <div className="w-16 h-16 mx-auto mb-3 bg-gradient-to-br from-yellow-600 to-orange-600 rounded-lg flex items-center justify-center text-3xl border-2 border-yellow-400 shadow-lg">
        🍔
      </div>

      {/* Progress Bar */}
      <div className="mb-3">
        <div className="flex justify-between text-xs mb-1">
          <span className="text-gray-300">Progress</span>
          <span className={`font-bold ${isCompleted ? 'text-green-400' : order.collected > 0 ? 'text-yellow-400' : 'text-gray-400'}`}>
            {order.collected}/{order.quantity}
          </span>
        </div>
        <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
          <div 
            className={`h-full transition-all duration-500 progress-fill ${
              isCompleted ? 'bg-green-500' : 'bg-gradient-to-r from-yellow-500 to-orange-500'
            }`}
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* Tip Multiplier */}
      <div className={`
        flex items-center justify-center gap-2 p-2 rounded-md
        ${isCompleted ? 'bg-green-500/20' : 'bg-yellow-500/20'}
      `}>
        <Star size={16} className="text-yellow-400" fill="currentColor" />
        <span className="text-sm font-bold text-white">
          {order.tipMultiplier}x TIPS
        </span>
        <Star size={16} className="text-yellow-400" fill="currentColor" />
      </div>

      {/* Completed Message */}
      {isCompleted && (
        <div className="mt-2 text-center text-xs font-bold text-green-400 animate-pulse">
          ORDER COMPLETE! 🎉
        </div>
      )}
    </div>
  );
}

export default function OrdersPanel({ orders, symbols, isFreeSpins, position = 'right' }: OrdersPanelProps) {
  if (orders.length === 0) {
    return null;
  }

  const allCompleted = orders.every(o => o.completed);
  const completedCount = orders.filter(o => o.completed).length;

  // Функция для получения имени символа по ID
  const getSymbolName = (symbolId: string): string => {
    const symbol = symbols.find(s => s.id === symbolId);
    return symbol ? symbol.name : symbolId;
  };

  return (
    <div 
      className={`
        fixed top-24 ${position === 'right' ? 'right-4' : 'left-4'}
        w-72 z-30 slide-in-right
      `}
    >
      {/* Panel Header */}
      <div className="bg-gradient-to-r from-yellow-600 to-orange-600 p-3 rounded-t-lg border-2 border-yellow-500 shadow-lg">
        <div className="flex items-center justify-between">
          <h2 className="text-white font-bold text-lg flex items-center gap-2">
            📋 ORDERS
            {isFreeSpins && <span className="text-xs bg-purple-600 px-2 py-1 rounded">FREE SPINS</span>}
          </h2>
          <div className="bg-black/40 px-3 py-1 rounded text-sm font-bold text-white">
            {completedCount}/{orders.length}
          </div>
        </div>
        
        {allCompleted && orders.length > 1 && isFreeSpins && (
          <div className="mt-2 text-xs font-bold text-black bg-yellow-300 px-2 py-1 rounded text-center animate-pulse">
            🎉 ALL COMPLETE! SUPER BONUS! 🎉
          </div>
        )}
      </div>

      {/* Orders List */}
      <div 
        className="bg-gradient-to-b from-gray-900/95 to-gray-800/95 p-3 rounded-b-lg border-2 border-t-0 border-yellow-500 space-y-3 max-h-[600px] overflow-y-auto shadow-lg"
        style={{ backdropFilter: 'blur(10px)' }}
      >
        {orders.map((order, index) => (
          <OrderCard 
            key={`${order.symbolId}-${index}`} 
            order={order} 
            symbolName={getSymbolName(order.symbolId)}
            index={index}
            isFreeSpins={isFreeSpins}
          />
        ))}

        {/* Tips Info */}
        {completedCount > 0 && (
          <div className="mt-3 p-3 bg-green-900/40 border border-green-500 rounded-lg">
            <div className="text-center">
              <div className="text-xs text-gray-300 mb-1">TIPS FORMULA</div>
              <div className="text-xs text-yellow-400 font-mono">
                Bet × Multiplier
              </div>
              {allCompleted && orders.length > 1 && isFreeSpins && (
                <div className="text-xs text-green-400 mt-1 font-bold">
                  + Super Bonus (All Complete)
                </div>
              )}
            </div>
          </div>
        )}

        {/* Free Spins Info */}
        {isFreeSpins && (
          <div className="mt-3 p-3 bg-purple-900/40 border border-purple-500 rounded-lg">
            <div className="text-center text-xs text-purple-300">
              💎 Orders carry over between Free Spins
            </div>
          </div>
        )}
      </div>
    </div>
  );
}