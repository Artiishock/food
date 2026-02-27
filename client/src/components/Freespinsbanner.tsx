import React from 'react';
import './FreeSpinsBanner.css';

interface FreeSpinsBannerProps {
  freeSpinsRemaining: number;
  totalSpins?: number;
}

export default function FreeSpinsBanner({ freeSpinsRemaining, totalSpins }: FreeSpinsBannerProps) {
  return (
    <div className="free-spins-banner-top">
      <div className="free-spins-banner-top__icon">⭐</div>
      <div className="free-spins-banner-top__label">FREE SPINS</div>
      <div className="free-spins-banner-top__count">{freeSpinsRemaining}</div>
      {totalSpins && (
        <div className="free-spins-banner-top__label">/ {totalSpins}</div>
      )}
      <div className="free-spins-banner-top__icon">⭐</div>
    </div>
  );
}