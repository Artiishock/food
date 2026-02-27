import React, { useState } from 'react';
import './LeftBanners.css';

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
  // Track which banner triggered the FS purchase so the status shows there
  const [fsBoughtFrom, setFsBoughtFrom] = useState<'cheap' | 'standard' | null>(null);

  const handleBuyFS = (type: 'cheap' | 'standard') => {
    setFsBoughtFrom(type);
    onBuyFreeSpins(type);
  };

  const showFsInStandard = isFreeSpins && fsBoughtFrom === 'standard';
  const showFsInCheap = isFreeSpins && fsBoughtFrom === 'cheap';

  const anteEnabled = anteMode === 'low';

  return (
    <>
      {/* Standard (expensive) package — 10 FS */}
      {showFsInStandard ? (
        <div className="free-spins-banner">
          <div className="free-spins-title">FREE SPINS</div>
          <div className="free-spins-count">{freeSpinsRemaining}</div>
        </div>
      ) : (
        <div className="banner-card">
          <div className="banner-title">BIG FS Package</div>
          <div style={{ fontSize: '0.7rem', color: '#6b7280', marginBottom: '4px' }}>10 free spins</div>
          <button
            className="buy-button standard"
            onClick={() => handleBuyFS('standard')}
            disabled={isSpinning || isFreeSpins}
          >
            BUY (100×) — 10 FS
          </button>
        </div>
      )}

      {/* Cheap package — 5 FS */}
      {showFsInCheap ? (
        <div className="free-spins-banner">
          <div className="free-spins-title">FREE SPINS</div>
          <div className="free-spins-count">{freeSpinsRemaining}</div>
        </div>
      ) : (
        <div className="banner-card">
          <div className="banner-title">STANDARD FS Package</div>
          <div style={{ fontSize: '0.7rem', color: '#6b7280', marginBottom: '4px' }}>5 free spins</div>
          <button
            className="buy-button cheap"
            onClick={() => handleBuyFS('cheap')}
            disabled={isSpinning || isFreeSpins}
          >
            BUY (50×) — 5 FS
          </button>
        </div>
      )}

      {/* Ante Mode — toggle switch ×1 / ×1.25 */}
      <div className="banner-card">
        <div className="banner-title">Ante Bet</div>
        <div className="ante-toggle-row">
          <span className={`ante-label ${!anteEnabled ? 'ante-label--active' : ''}`}>×1</span>
          <button
            className={`ante-switch ${anteEnabled ? 'ante-switch--on' : 'ante-switch--off'}`}
            onClick={() => onAnteChange(anteEnabled ? 'none' : 'low')}
            disabled={isSpinning}
            aria-label="Toggle ante bet"
          >
            <span className="ante-switch-thumb" />
          </button>
          <span className={`ante-label ${anteEnabled ? 'ante-label--active' : ''}`}>×1.25</span>
        </div>
      </div>
    </>
  );
}