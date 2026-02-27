import { ReactNode } from 'react';
import './GameLayout.css'; // импорт стилей

interface GameLayoutProps {
  gameBoard: ReactNode;
  logo: ReactNode;
  orders: ReactNode;
  leftBanners: ReactNode;
  bottomBar: ReactNode;
  topBanner?: ReactNode;
}

export default function GameLayout({
  gameBoard,
  logo,
  orders,
  leftBanners,
  bottomBar,
  topBanner,
}: GameLayoutProps) {
  return (
    <div className="layout">
      {/* Main Game Area */}
      <div className="main-area">
        {/* LEFT COLUMN: Banners (Ante) */}
        <div className="left-column">
          {leftBanners}
        </div>

        {/* CENTER COLUMN: Top Banner + Game Board */}
        <div className="center-column">
          {topBanner && (
            <div className="top-banner-area">
              {topBanner}
            </div>
          )}
          <div className="game-board-card">
            {gameBoard}
          </div>
        </div>

        {/* RIGHT COLUMN: Logo and Orders */}
        <div className="right-column">
          {/* Logo */}
          <div className="logo-box">
            {logo}
          </div>

          {/* Orders Block */}
          <div className="orders-box">
            <div className="orders-title"></div>
            {orders}
          </div>
        </div>
      </div>

      {/* Bottom Control Bar */}
      {bottomBar}
    </div>
  );
}