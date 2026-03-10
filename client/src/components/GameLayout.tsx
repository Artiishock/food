import { ReactNode, useEffect, useRef, useState } from 'react';
import './GameLayout.css';

interface GameLayoutProps {
  gameBoard: ReactNode;
  logo: ReactNode;
  orders: ReactNode;
  leftBanners: ReactNode;
  bottomBar: ReactNode;
  topBanner?: ReactNode;
}

const LANDSCAPE_W = 1920;
const PORTRAIT_W  = 620;

// Реальный размер PIXI canvas
const CANVAS_W = 800;
const CANVAS_H = 500;

// Ширина canvas в portrait и производный scale
const PORTRAIT_CANVAS_W = 360;
const PORTRAIT_CANVAS_SCALE = PORTRAIT_CANVAS_W / CANVAS_W; // 0.45
const PORTRAIT_CANVAS_H = Math.round(CANVAS_H * PORTRAIT_CANVAS_SCALE); // 225

export default function GameLayout({
  gameBoard,
  logo,
  orders,
  leftBanners,
  bottomBar,
  topBanner,
}: GameLayoutProps) {
  const scalerRef        = useRef<HTMLDivElement>(null);
  const canvasWrapperRef = useRef<HTMLDivElement>(null);
  const canvasScalerRef  = useRef<HTMLDivElement>(null);
  const [isPortrait, setIsPortrait] = useState(
    () => window.innerHeight > window.innerWidth
  );

  useEffect(() => {
    function scaleLayout() {
      if (!scalerRef.current) return;

      const vw = window.innerWidth;
      const vh = window.innerHeight;
      const portrait = vh > vw;
      setIsPortrait(portrait);

      const baseW = portrait ? PORTRAIT_W : LANDSCAPE_W;
      const scale = vw / baseW;
      const realH = vh / scale;

      scalerRef.current.style.transform       = `scale(${scale})`;
      scalerRef.current.style.transformOrigin = 'top left';
      scalerRef.current.style.left            = '0px';
      scalerRef.current.style.top             = '0px';
      scalerRef.current.style.width           = `${baseW}px`;
      scalerRef.current.style.height          = `${realH}px`;

      // Scale PIXI canvas (800x500) to fill portrait-canvas-wrapper completely
      requestAnimationFrame(() => {
        if (canvasWrapperRef.current && canvasScalerRef.current) {
          const wrapperW = canvasWrapperRef.current.clientWidth;
          const wrapperH = canvasWrapperRef.current.clientHeight;
          const scaleX = wrapperW / 800;
          const scaleY = wrapperH / 500;
          // use min to contain (fit inside wrapper)
          const s = Math.min(scaleX, scaleY);
          canvasScalerRef.current.style.transform = `scale(${s})`;
        }
      });
    }

    scaleLayout();
    window.addEventListener('resize', scaleLayout);
    return () => window.removeEventListener('resize', scaleLayout);
  }, []);

  if (isPortrait) {
    return (
      <div className="layout-wrapper">
        <div className="layout-scaler" ref={scalerRef}>
          <div className="layout layout--portrait">

            {/* Top Banner */}
            {topBanner && (
              <div className="portrait-top-banner">
                {topBanner}
              </div>
            )}

            {/* Canvas (масштабированный) + Banners справа */}
            <div className="portrait-middle">
              <div className="portrait-canvas-wrapper" ref={canvasWrapperRef}>
                <div className="portrait-canvas-scaler" ref={canvasScalerRef}>
                  {gameBoard}
                </div>
              </div>
              <div className="portrait-banners">
                {leftBanners}
              </div>
            </div>

            {/* Logo + Orders под canvas */}
            <div className="portrait-bottom-content">
              <div className="portrait-logo">
                {logo}
              </div>
              <div className="portrait-orders">
                <div className="orders-title"></div>
                {orders}
              </div>
            </div>

            {/* Bottom Bar */}
            {bottomBar}

          </div>
        </div>
      </div>
    );
  }

  // Landscape
  return (
    <div className="layout-wrapper">
      <div className="layout-scaler" ref={scalerRef}>
        <div className="layout layout--landscape">

          <div className="main-area">
            <div className="left-column">
              {leftBanners}
            </div>

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

            <div className="right-column">
              <div className="logo-box">
                {logo}
              </div>
              <div className="orders-box">
                <div className="orders-title"></div>
                {orders}
              </div>
            </div>
          </div>

          {bottomBar}

        </div>
      </div>
    </div>
  );
}