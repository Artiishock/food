import React from 'react';
import './LeftBanners.css'; // импорт стилей

interface LeftBannersProps {
  isFreeSpins: boolean;
  freeSpinsRemaining: number;
  anteMode: 'none' | 'low' | 'high';
  onBuyFreeSpins: (type: 'cheap' | 'standard') => void;
  onAnteChange: (mode: 'none' | 'low' | 'high') => void;
  isSpinning: boolean;
}

export default function LeftBanners({
  isFreeSpins,
  freeSpinsRemaining,
  anteMode,
  onBuyFreeSpins,
  onAnteChange,
  isSpinning,
}: LeftBannersProps) {
  return (
    <>
      {/* FS Cheap Package Banner */}
      <div className="banner-card">
        <div className="banner-title">Баннер дорого пакета FS</div>
        <button
          className="buy-button cheap"
          onClick={() => onBuyFreeSpins('cheap')}
          disabled={isSpinning || isFreeSpins}
        >
          CHEAP (50x) - 5 FS
        </button>
      </div>

      {/* FS Expensive Package Banner */}
      <div className="banner-card">
        <div className="banner-title">Баннер дешевого пакета FS</div>
        <button
          className="buy-button standard"
          onClick={() => onBuyFreeSpins('standard')}
          disabled={isSpinning || isFreeSpins}
        >
          STANDARD (100x) - 10 FS
        </button>
      </div>

      {/* Ante Mode Banner */}
      <div className="banner-card">
        <div className="banner-title">Вкл/Выкл ставки Анте</div>
        <div className="ante-group">
          <button
            className={`ante-button ${
              anteMode === 'none' ? 'ante-button--active' : 'ante-button--inactive'
            }`}
            onClick={() => onAnteChange('none')}
            disabled={isSpinning}
          >
            NORMAL
          </button>
          <button
            className={`ante-button ${
              anteMode === 'low' ? 'ante-button--active' : 'ante-button--inactive'
            }`}
            onClick={() => onAnteChange('low')}
            disabled={isSpinning}
          >
            LOW 1.25x
          </button>
          <button
            className={`ante-button ${
              anteMode === 'high' ? 'ante-button--active' : 'ante-button--inactive'
            }`}
            onClick={() => onAnteChange('high')}
            disabled={isSpinning}
          >
            HIGH 5x
          </button>
        </div>
      </div>

      {/* Free Spins Status */}
      {isFreeSpins && (
        <div className="free-spins-banner">
          <div className="free-spins-title">FREE SPINS</div>
          <div className="free-spins-count">{freeSpinsRemaining}</div>
        </div>
      )}
    </>
  );
}