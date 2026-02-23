import { Order } from '../lib/gameEngine';
import { SHEET_FRAMES, SHEET_W, SHEET_H } from '../config/spriteFrames';
import './OrdersDisplay.css';

interface OrdersDisplayProps {
  orders: Order[];
}

const ICON_SIZE = 60;

function SymbolIcon({ symbolId }: { symbolId: string }) {
  const frame = SHEET_FRAMES[symbolId];
  if (!frame) {
    return <div style={{ width: ICON_SIZE, height: ICON_SIZE, background: '#eee', borderRadius: 8 }} />;
  }

  const scale = Math.min(ICON_SIZE / frame.w, ICON_SIZE / frame.h);
  const scaledSheetW = SHEET_W * scale;
  const scaledSheetH = SHEET_H * scale;
  const offsetX = frame.x * scale;
  const offsetY = frame.y * scale;
  const renderedW = frame.w * scale;
  const renderedH = frame.h * scale;

  return (
    <div
      style={{
        width: ICON_SIZE,
        height: ICON_SIZE,
        flexShrink: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          width: renderedW,
          height: renderedH,
          backgroundImage: 'url(/symbols.png)',
          backgroundSize: `${scaledSheetW}px ${scaledSheetH}px`,
          backgroundPosition: `-${offsetX}px -${offsetY}px`,
          backgroundRepeat: 'no-repeat',
        }}
      />
    </div>
  );
}

export default function OrdersDisplay({ orders }: OrdersDisplayProps) {
  if (orders.length === 0) {
    return null;
  }

  return (
    <div className="orders-display">
      <div className="orders-display__title">ACTIVE ORDERS</div>

      {orders.map((order, index) => {
        const progress = (order.collected / order.quantity) * 100;
        const isCompleted = order.completed;

        return (
          <div
            key={index}
            className={`order-card ${isCompleted ? 'order-card--completed' : ''}`}
            style={{ transform: `rotate(${index % 2 === 0 ? -1 : 1}deg)` }}
          >
            <div className="order-card__header">
              <div className="order-card__icon">
                <SymbolIcon symbolId={order.symbolId} />
              </div>
              <div className="order-card__meta">
                <div className="order-card__label">ORDER #{index + 1}</div>
              </div>
              <div className="order-card__right">
                <div className="order-card__label">TIP</div>
                <div className="order-card__tip-value">{order.tipMultiplier}x</div>
              </div>
            </div>

            <div className="order-card__progress-section">
              <div className="order-card__progress-row">
                <span>PROGRESS</span>
                <span>{order.collected} / {order.quantity}</span>
              </div>
              <div className="order-card__progress-bar-container">
                <div
                  className={`order-card__progress-fill ${isCompleted ? 'order-card__progress-fill--completed' : ''}`}
                  style={{ width: `${progress}%` }}
                />
                <div className="order-card__progress-text">{Math.round(progress)}%</div>
              </div>
            </div>

            {isCompleted && (
              <div className="order-card__badge-container">
                <div className="order-card__badge">✓ COMPLETED</div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}