import { useState, useEffect } from 'react';
import { Order } from '../lib/gameEngine';
import { SHEET_FRAMES, SHEET_W, SHEET_H } from '../config/spriteFrames';
import './OrdersDisplay.css';

interface OrdersDisplayProps {
  orders: Order[];
  onReadyToShow?: (triggerFn: () => Promise<void>) => void;
}

const ICON_SIZE = 36;

function SymbolIcon({ symbolId }: { symbolId: string }) {
  const frame = SHEET_FRAMES[symbolId];
  if (!frame) {
    return <div style={{ width: ICON_SIZE, height: ICON_SIZE, background: '#ccc', borderRadius: 4 }} />;
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

export default function OrdersDisplay({ orders, onReadyToShow }: OrdersDisplayProps) {
  const [isFlashing, setIsFlashing] = useState(false);
  // portrait = height > width
  const [isPortrait, setIsPortrait] = useState(
    () => window.innerHeight > window.innerWidth
  );

  useEffect(() => {
    const handleResize = () => {
      setIsPortrait(window.innerHeight > window.innerWidth);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    const triggerFn = (): Promise<void> => {
      return new Promise(resolve => {
        setIsFlashing(false);
        requestAnimationFrame(() => {
          setIsFlashing(true);
          setTimeout(() => {
            setIsFlashing(false);
            resolve();
          }, 600);
        });
      });
    };
    onReadyToShow?.(triggerFn);
  }, [onReadyToShow]);

  if (orders.length === 0) {
    return null;
  }

  const gridClass = `orders-grid${isPortrait ? ' orders-grid--portrait' : ''}`;

  return (
    <div className={`orders-display${isFlashing ? ' orders-display--flash' : ''}`}>
      <div className={gridClass}>
        {orders.map((order, index) => {
          const progress = Math.min((order.collected / order.quantity) * 100, 100);
          const isCompleted = order.completed;
          const isNew = order.isNew === true;

          return (
            <div
              key={`${order.symbolId}-${order.quantity}-${index}`}
              className={`order-card${isCompleted ? ' order-card--completed' : ''}${isNew ? ' order-card--new' : ''}`}
            >
              {isNew && <div className="order-card__new-badge">NEW!</div>}
              {isCompleted && <div className="order-card__done">✓</div>}
              <div className="row">
                <div className="order-card__icon-wrap">
                  <SymbolIcon symbolId={order.symbolId} />
                </div>
                <div className="order-card__tip">X{order.tipMultiplier}</div>
              </div>

              <div className="order-card__bar">
                <div className="order-card__progress-text">
                  {order.collected}/{order.quantity}
                </div>
                <div
                  className={`order-card__bar-fill${isCompleted ? ' order-card__bar-fill--completed' : ''}`}
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}