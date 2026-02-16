/* Neo-Brutalist Street Food Aesthetic - Orders Display
 * Design: Torn paper edge order tickets, asymmetric layout
 * Colors: White tickets with black borders, accent colors for status
 */

import { Order } from '../lib/gameEngine';
import symbolsConfig from '../config/symbols.json';

interface OrdersDisplayProps {
  orders: Order[];
}

export default function OrdersDisplay({ orders }: OrdersDisplayProps) {
  if (orders.length === 0) {
    return null;
  }

  const getSymbolName = (symbolId: string) => {
    const symbol = symbolsConfig.symbols.find(s => s.id === symbolId);
    return symbol?.name || symbolId;
  };

  return (
    <div className="space-y-4">
      <div className="text-brutalist text-2xl mb-4">ACTIVE ORDERS</div>
      
      {orders.map((order, index) => {
        const progress = (order.collected / order.quantity) * 100;
        const isCompleted = order.completed;
        
        return (
          <div
            key={index}
            className="brutalist-border bg-white p-4 brutalist-shadow relative overflow-hidden"
            style={{
              backgroundColor: isCompleted ? '#00ff88' : '#ffffff',
              transform: `rotate(${index % 2 === 0 ? -1 : 1}deg)`
            }}
          >
            {/* Order Header */}
            <div className="flex justify-between items-start mb-3">
              <div>
                <div className="text-mono text-xs">ORDER #{index + 1}</div>
                <div className="text-brutalist text-xl mt-1">
                  {getSymbolName(order.symbolId).toUpperCase()}
                </div>
              </div>
              <div className="text-right">
                <div className="text-mono text-xs">TIP</div>
                <div className="text-brutalist text-lg" style={{ color: '#ff3838' }}>
                  {order.tipMultiplier}x
                </div>
              </div>
            </div>

            {/* Progress */}
            <div className="space-y-2">
              <div className="flex justify-between text-mono text-sm">
                <span>PROGRESS</span>
                <span>{order.collected} / {order.quantity}</span>
              </div>
              
              {/* Progress Bar */}
              <div className="h-8 border-4 border-black relative overflow-hidden">
                <div
                  className="h-full transition-all duration-300"
                  style={{
                    width: `${progress}%`,
                    backgroundColor: isCompleted ? '#ffd700' : '#ff3838'
                  }}
                />
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-mono text-xs font-bold mix-blend-difference text-white">
                    {Math.round(progress)}%
                  </span>
                </div>
              </div>
            </div>

            {/* Completed Badge */}
            {isCompleted && (
              <div className="mt-3 text-center">
                <div className="inline-block brutalist-border bg-black text-white px-4 py-2">
                  <span className="text-brutalist text-sm">✓ COMPLETED</span>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
