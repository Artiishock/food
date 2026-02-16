import { ReactNode } from 'react';

interface GameLayoutProps {
  gameBoard: ReactNode;
  logo: ReactNode;
  orders: ReactNode;
  leftBanners: ReactNode;
  bottomBar: ReactNode;
}

export default function GameLayout({
  gameBoard,
  logo,
  orders,
  leftBanners,
  bottomBar,
}: GameLayoutProps) {
  return (
    <div className="min-h-screen bg-gray-300 flex flex-col">
      {/* Main Game Area */}
      <div className="flex-1 flex gap-6 p-6 pb-32">
        {/* LEFT COLUMN: Banners (FS Packages and Ante) */}
        <div className="w-48 flex flex-col gap-4">
          {leftBanners}
        </div>

        {/* CENTER COLUMN: Game Board */}
        <div className="flex-1 flex justify-center items-center">
          <div className="bg-white p-2 rounded-lg shadow-lg">
            {gameBoard}
          </div>
        </div>

        {/* RIGHT COLUMN: Logo and Orders */}
        <div className="w-48 flex flex-col gap-4">
          {/* Logo */}
          <div className="bg-white p-6 rounded-lg shadow-lg h-32 flex items-center justify-center">
            {logo}
          </div>

          {/* Orders Block */}
          <div className="bg-white p-4 rounded-lg shadow-lg flex-1 overflow-y-auto">
            <div className="text-sm font-bold mb-2">Блок "Заказы"</div>
            {orders}
          </div>
        </div>
      </div>

      {/* Bottom Control Bar */}
      {bottomBar}
    </div>
  );
}
