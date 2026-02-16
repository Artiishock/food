import { Volume2, VolumeX, Info, Settings } from 'lucide-react';
import { Button } from './ui/button';

interface BottomControlBarProps {
  balance: number;
  currentBet: number;
  isSpinning: boolean;
  onSpin: () => void;
  onBetIncrease: () => void;
  onBetDecrease: () => void;
  onAutoSpin: () => void;
  onSettings: () => void;
  onInfo: () => void;
  soundEnabled: boolean;
  onToggleSound: () => void;
}

export default function BottomControlBar({
  balance,
  currentBet,
  isSpinning,
  onSpin,
  onBetIncrease,
  onBetDecrease,
  onAutoSpin,
  onSettings,
  onInfo,
  soundEnabled,
  onToggleSound,
}: BottomControlBarProps) {
  return (
    <div className="fixed bottom-0 left-0 right-0 bg-gradient-to-r from-gray-700 via-gray-600 to-gray-700 h-24 flex items-center justify-between px-8 border-t-4 border-gray-800">
      {/* Left Section: Settings, Info, Sound */}
      <div className="flex items-center gap-4">
        {/* Settings Button */}
        <button
          onClick={onSettings}
          className="w-12 h-12 rounded-full bg-gray-500 hover:bg-gray-400 flex items-center justify-center border-2 border-gray-700 transition"
          title="Settings"
        >
          <Settings size={24} className="text-white" />
        </button>

        {/* Sound Button */}
        <button
          onClick={onToggleSound}
          className="w-12 h-12 rounded-full bg-gray-500 hover:bg-gray-400 flex items-center justify-center border-2 border-gray-700 transition"
          title="Sound"
        >
          {soundEnabled ? (
            <Volume2 size={24} className="text-white" />
          ) : (
            <VolumeX size={24} className="text-white" />
          )}
        </button>

        {/* Info Button */}
        <button
          onClick={onInfo}
          className="w-12 h-12 rounded-full bg-gray-500 hover:bg-gray-400 flex items-center justify-center border-2 border-gray-700 transition"
          title="Info"
        >
          <Info size={24} className="text-white" />
        </button>

        {/* Credit Display */}
        <div className="ml-8 text-white">
          <div className="text-xs font-bold text-yellow-400">CREDIT</div>
          <div className="text-2xl font-bold">${balance.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</div>
        </div>
      </div>

      {/* Center Section: Bet Controls */}
      <div className="flex items-center gap-6">
        <div className="text-white text-right">
          <div className="text-xs font-bold text-yellow-400">BET</div>
          <div className="text-2xl font-bold">${currentBet.toFixed(2)}</div>
        </div>

        {/* Bet Increase Button */}
        <button
          onClick={onBetIncrease}
          disabled={isSpinning}
          className="w-12 h-12 rounded-full bg-gray-500 hover:bg-gray-400 disabled:bg-gray-600 flex items-center justify-center border-2 border-gray-700 transition text-white font-bold text-xl"
          title="Increase Bet"
        >
          +
        </button>

        {/* Bet Decrease Button */}
        <button
          onClick={onBetDecrease}
          disabled={isSpinning}
          className="w-12 h-12 rounded-full bg-gray-500 hover:bg-gray-400 disabled:bg-gray-600 flex items-center justify-center border-2 border-gray-700 transition text-white font-bold text-xl"
          title="Decrease Bet"
        >
          −
        </button>
      </div>

      {/* Right Section: Spin and AutoSpin */}
      <div className="flex items-center gap-4">
        {/* Main Spin Button */}
        <button
          onClick={onSpin}
          disabled={isSpinning}
          className="w-20 h-20 rounded-full bg-gradient-to-b from-gray-400 to-gray-600 hover:from-gray-300 hover:to-gray-500 disabled:from-gray-500 disabled:to-gray-700 flex items-center justify-center border-4 border-white shadow-lg transition transform hover:scale-105 active:scale-95"
          title="Spin"
        >
          <div className="w-16 h-16 rounded-full bg-gradient-to-b from-white to-gray-300 flex items-center justify-center border-2 border-gray-400">
            <svg className="w-10 h-10 text-gray-700" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8zm3.5-9c.83 0 1.5-.67 1.5-1.5S16.33 8 15.5 8 14 8.67 14 9.5s.67 1.5 1.5 1.5zm-7 0c.83 0 1.5-.67 1.5-1.5S9.33 8 8.5 8 7 8.67 7 9.5 7.67 11 8.5 11zm3.5 6.5c2.33 0 4.31-1.46 5.11-3.5H6.89c.8 2.04 2.78 3.5 5.11 3.5z" />
            </svg>
          </div>
        </button>

        {/* AutoSpin Button */}
        <button
          onClick={onAutoSpin}
          disabled={isSpinning}
          className="w-12 h-12 rounded-full bg-gray-500 hover:bg-gray-400 disabled:bg-gray-600 flex items-center justify-center border-2 border-gray-700 transition"
          title="AutoSpin"
        >
          <svg className="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 24 24">
            <path d="M7 10l5 5 5-5z" />
          </svg>
        </button>
      </div>
    </div>
  );
}
