/* Spin Controls - Bottom Left */

import { Button } from './ui/button';

interface SpinControlsProps {
  onSpin: () => void;
  onAutoSpin: () => void;
  isSpinning: boolean;
  autoSpinActive: boolean;
}

export default function SpinControls({
  onSpin,
  onAutoSpin,
  isSpinning,
  autoSpinActive
}: SpinControlsProps) {
  return (
    <div className="space-y-3">
      <Button
        onClick={onSpin}
        disabled={isSpinning}
        className="w-full h-16 brutalist-border-thick brutalist-shadow-hover text-brutalist text-2xl"
        style={{ 
          backgroundColor: '#ffd700',
          color: '#1a1a1a',
          border: '12px solid #000000'
        }}
      >
        {isSpinning ? 'SPINNING...' : 'SPIN'}
      </Button>

      <Button
        onClick={onAutoSpin}
        variant={autoSpinActive ? 'default' : 'outline'}
        className={`w-full brutalist-border brutalist-shadow-hover text-brutalist text-sm ${
          autoSpinActive 
            ? 'bg-black text-white hover:bg-black' 
            : 'bg-white text-black hover:bg-white'
        }`}
      >
        {autoSpinActive ? '⏸ AUTO SPIN ON' : '▶ AUTO SPIN'}
      </Button>
    </div>
  );
}
