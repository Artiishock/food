import React from 'react';
import './LeftBanners.css';

interface LeftBannersProps {
  isFreeSpins: boolean;
  freeSpinsRemaining: number;
  anteMode: 'none' | 'low' | 'high';
  onBuyFreeSpins: (type: 'cheap' | 'standard') => void;
  onAnteChange: (mode: 'none' | 'low' | 'high') => void;
  isSpinning: boolean;
  currentBet?: number;
  isPortrait?: boolean;
}

export default function LeftBanners({
  isFreeSpins,
  freeSpinsRemaining,
  anteMode,
  onBuyFreeSpins,
  onAnteChange,
  isSpinning,
  currentBet = 10,
  isPortrait = false,
}: LeftBannersProps) {
  const anteEnabled = anteMode === 'low';
  const cheapPrice    = currentBet * 50;
  const standardPrice = currentBet * 100;
  const p = isPortrait ? ' banner-btn--portrait' : '';

  const fmt = (val: number) =>
    '$' + val.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  return (
    <>
      {/* BUY FREE SPINS — Standard (100x) */}
      <button
        className={`banner-btn banner-btn--standard${p}`}
        onClick={() => onBuyFreeSpins('standard')}
        disabled={isSpinning || isFreeSpins}
      >
        <span className="banner-btn__title">BUY<br/><span className="banner-btn__super-label">SUPER</span><br/>FREE SPINS</span>

        <span className="banner-btn__price">{fmt(standardPrice)}</span>
      </button>

      {/* BUY SUPER FREE SPINS — Cheap (50x) */}
      <button
        className={`banner-btn banner-btn--super${p}`}
        onClick={() => onBuyFreeSpins('cheap')}
        disabled={isSpinning || isFreeSpins}
      >
        <span className="banner-btn__title">BUY</span>

        <span className="banner-btn__title">FREE SPINS</span>
        <span className="banner-btn__price">{fmt(cheapPrice)}</span>
      </button>

      {/* ANTE BET toggle */}
      <button
        className={`banner-btn banner-btn--ante${anteEnabled ? ' banner-btn--ante-on' : ''}${p}`}
        onClick={() => !isSpinning && onAnteChange(anteEnabled ? 'none' : 'low')}
        disabled={isSpinning}
      >
        <span className="banner-btn__title">BET</span>
        <span className="banner-btn__ante-price">{fmt(currentBet * (anteEnabled ? 1.25 : 1))}</span>
        {/* <span className="banner-btn__title">FREE SPINS</span> */}
        <span className="banner-btn__ante-sub">Double chance<br/>to win the feature</span>
        <span className={`banner-btn__ante-toggle${anteEnabled ? ' banner-btn__ante-toggle--on' : ''}`}>
          <span className="banner-btn__ante-arrow">&#9654;</span>
          <span className="banner-btn__ante-state">{anteEnabled ? 'ON' : 'OFF'}</span>
        </span>
      </button>
    </>
  );
}