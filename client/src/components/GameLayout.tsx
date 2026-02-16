/* Neo-Brutalist Layout - Proper positioning of all UI elements according to user spec */

import { ReactNode } from 'react';

interface GameLayoutProps {
  settings: ReactNode;
  balance: ReactNode;
  bonuses: ReactNode;
  gameBoard: ReactNode;
  logo: ReactNode;
  orders: ReactNode;
  spinControls: ReactNode;
  betControls: ReactNode;
}

export default function GameLayout({
  settings,
  balance,
  bonuses,
  gameBoard,
  logo,
  orders,
  spinControls,
  betControls
}: GameLayoutProps) {
  return (
    <div className="min-h-screen bg-black text-white p-4 flex flex-col">
      {/* Header with Settings */}
      <div className="flex justify-between items-start mb-4 gap-4">
        {/* Left: Settings */}
        <div className="w-40">
          {settings}
        </div>

        {/* Center: Logo/Title */}
        <div className="flex-1 text-center">
          {logo}
        </div>

        {/* Right: Empty space */}
        <div className="w-40"></div>
      </div>

      {/* Main Game Area - 3 columns */}
      <div className="flex-1 flex gap-4 mb-4">
        {/* LEFT COLUMN: Balance + FS Packages + Ante */}
        <div className="w-48 space-y-3 flex flex-col">
          {/* Balance */}
          <div className="border-4 border-black bg-white text-black p-4">
            {balance}
          </div>

          {/* FS Packages and Ante Controls */}
          <div className="flex-1 space-y-2">
            {bonuses}
          </div>
        </div>

        {/* CENTER COLUMN: Game Board */}
        <div className="flex-1 flex justify-center items-center">
          <div className="border-4 border-black bg-gray-800 p-2">
            {gameBoard}
          </div>
        </div>

        {/* RIGHT COLUMN: Logo + Orders */}
        <div className="w-48 space-y-3 flex flex-col">
          {/* Logo */}
          <div className="border-4 border-black bg-white text-black p-4 h-32 flex items-center justify-center">
            <div className="text-center">
              <div className="text-5xl">🍔</div>
              <div className="text-mono text-xs mt-2 font-bold">FOODTRUCK</div>
            </div>
          </div>

          {/* Orders Block */}
          <div className="flex-1 border-4 border-black bg-white text-black p-4 overflow-y-auto">
            <div className="text-mono text-xs font-bold mb-2">ORDERS</div>
            {orders}
          </div>
        </div>
      </div>

      {/* Bottom Control Row */}
      <div className="flex justify-between items-end gap-4">
        {/* Left: Spin Controls */}
        <div className="flex-1">
          {spinControls}
        </div>

        {/* Center: Empty */}
        <div className="flex-1"></div>

        {/* Right: Bet Controls */}
        <div className="flex-1">
          {betControls}
        </div>
      </div>
    </div>
  );
}
