import { Order } from '../lib/gameEngine';
import symbolsConfig from '../config/symbols.json';
import './OrdersDisplay.css';

interface OrdersDisplayProps {
  orders: Order[];
}

// Координаты фреймов в спрайт-листе (пиксели исходного изображения)
const SHEET_FRAMES: Record<string, { x: number; y: number; w: number; h: number }> = {
  burger:  { x: 0,   y: 50,  w: 341, h: 236 },
  drink:   { x: 321, y: 30,  w: 341, h: 256 },
  pie:     { x: 642, y: 30,  w: 342, h: 276 },
  scatter: { x: 0,   y: 256, w: 341, h: 256 },
  pizza:   { x: 331, y: 300, w: 341, h: 256 },
  taco:    { x: 642, y: 300, w: 342, h: 256 },
  fries:   { x: 0,   y: 555, w: 341, h: 226 },
  burrito: { x: 331, y: 545, w: 331, h: 216 },
  hotdog:  { x: 642, y: 542, w: 342, h: 216 },
  wrap:    { x: 200, y: 775, w: 290, h: 226 },
  chicken: { x: 510, y: 758, w: 240, h: 226 },
};

// Реальный размер спрайт-листа symbols.png
const SHEET_W = 1024;
const SHEET_H = 1024;

// Размер иконки в UI
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
            {/* Header: icon + order # + tip */}
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

            {/* Progress */}
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

            {/* Completed Badge */}
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