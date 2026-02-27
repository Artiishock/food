import { useEffect, useState } from 'react';
import './FreeSpinsIntro.css';

interface FreeSpinsIntroProps {
  packageType: 'standard' | 'big';
  spinsCount: number;
  ordersCount: number;
  onStart: () => void;
}

export default function FreeSpinsIntro({ packageType, spinsCount, ordersCount, onStart }: FreeSpinsIntroProps) {
  const [animIn, setAnimIn] = useState(false);

  useEffect(() => {
    // небольшая задержка чтобы CSS-transition успел сработать
    const t = setTimeout(() => setAnimIn(true), 50);
    return () => clearTimeout(t);
  }, []);

  const isBig = packageType === 'big';

  const title    = isBig ? 'BIG FS PACKAGE' : 'STANDARD FS PACKAGE';
  const subtitle = isBig ? 'MAXIMUM TIPS MODE' : 'MULTI-ORDER MODE';
  const color    = isBig ? '#ff6b00' : '#3b82f6';
  const bgColor  = isBig ? '#fff3e0' : '#eff6ff';

  const features = isBig
    ? [
        `${ordersCount} simultaneous orders`,
        '−35% order difficulty',
        'Completed order → new order immediately',
        `${spinsCount} free spins`,
        'Highest tip multipliers (8×–75×)',
      ]
    : [
        `${ordersCount} simultaneous orders`,
        'Orders persist for all spins',
        `${spinsCount} free spins`,
        'High tip multipliers (5×–25×)',
      ];

  return (
    <div className={`fs-intro-overlay${animIn ? ' fs-intro-overlay--in' : ''}`}>
      <div
        className={`fs-intro-card${animIn ? ' fs-intro-card--in' : ''}`}
        style={{ '--fs-color': color, '--fs-bg': bgColor } as React.CSSProperties}
      >
        {/* Декоративные уголки */}
        <div className="fs-intro-corner fs-intro-corner--tl" />
        <div className="fs-intro-corner fs-intro-corner--tr" />
        <div className="fs-intro-corner fs-intro-corner--bl" />
        <div className="fs-intro-corner fs-intro-corner--br" />

        <div className="fs-intro-badge">{subtitle}</div>

        <h1 className="fs-intro-title">{title}</h1>

        <div className="fs-intro-spins">
          <span className="fs-intro-spins__number">{spinsCount}</span>
          <span className="fs-intro-spins__label">FREE SPINS</span>
        </div>

        <ul className="fs-intro-features">
          {features.map((f, i) => (
            <li key={i} className="fs-intro-feature">
              <span className="fs-intro-feature__dot">●</span>
              {f}
            </li>
          ))}
        </ul>

        <button className="fs-intro-btn" onClick={onStart}>
          START SPINNING
          <span className="fs-intro-btn__arrow">→</span>
        </button>
      </div>
    </div>
  );
}