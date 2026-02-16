/* Bonuses Panel - Left Column */

import { useState } from 'react';
import { Button } from './ui/button';

interface BonusesPanelProps {
  balance: number;
  currentBet: number;
  onBuyFreeSpins: (packageType: 'cheap' | 'standard') => void;
  isFreeSpins: boolean;
  freeSpinsRemaining: number;
}

export default function BonusesPanel({
  balance,
  currentBet,
  onBuyFreeSpins,
  isFreeSpins,
  freeSpinsRemaining
}: BonusesPanelProps) {
  const [showBuyMenu, setShowBuyMenu] = useState(false);
  const cheapPrice = currentBet * 50;
  const standardPrice = currentBet * 100;

  if (isFreeSpins) {
    return (
      <div className="brutalist-border p-4 brutalist-shadow" style={{ backgroundColor: '#00ff88' }}>
        <div className="text-brutalist text-xl text-black">
          FREE SPINS
        </div>
        <div className="text-mono text-lg text-black mt-2 font-bold">
          {freeSpinsRemaining} LEFT
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <Button
        onClick={() => setShowBuyMenu(!showBuyMenu)}
        className="w-full brutalist-border brutalist-shadow-hover bg-white text-black hover:bg-white text-sm font-bold"
      >
        💰 BUY FS
      </Button>

      {showBuyMenu && (
        <div className="brutalist-border bg-white text-black p-3 space-y-2">
          <Button
            onClick={() => {
              if (balance >= cheapPrice) {
                onBuyFreeSpins('cheap');
                setShowBuyMenu(false);
              }
            }}
            disabled={balance < cheapPrice}
            className="w-full brutalist-border brutalist-shadow-hover bg-white text-black hover:bg-white text-xs disabled:opacity-50"
          >
            <div>CHEAP</div>
            <div className="text-xs">${cheapPrice}</div>
            <div className="text-xs">5 spins</div>
          </Button>
          
          <Button
            onClick={() => {
              if (balance >= standardPrice) {
                onBuyFreeSpins('standard');
                setShowBuyMenu(false);
              }
            }}
            disabled={balance < standardPrice}
            className="w-full brutalist-border brutalist-shadow-hover bg-white text-black hover:bg-white text-xs disabled:opacity-50"
          >
            <div>STANDARD</div>
            <div className="text-xs">${standardPrice}</div>
            <div className="text-xs">10 spins</div>
          </Button>
        </div>
      )}
    </div>
  );
}
