import { ReactNode, useEffect, useRef, useState } from 'react';
import './GameLayout.css';

interface GameLayoutProps {
  gameBoard: ReactNode;
  logo: ReactNode;
  orders: ReactNode;
  leftBanners: ReactNode;
  bottomBar: ReactNode;
  topBanner?: ReactNode;
  onOrientationChange?: (isPortrait: boolean) => void;
}

const LANDSCAPE_W = 1920;
const PORTRAIT_W  = 620;

const CANVAS_W = 800;
const CANVAS_H = 500;

export default function GameLayout({
  gameBoard,
  logo,
  orders,
  leftBanners,
  bottomBar,
  topBanner,
  onOrientationChange,
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
      onOrientationChange?.(portrait);

      const baseW = portrait ? PORTRAIT_W : LANDSCAPE_W;
      const scale = vw / baseW;
      const realH = vh / scale;

      scalerRef.current.style.transform       = `scale(${scale})`;
      scalerRef.current.style.transformOrigin = 'top left';
      scalerRef.current.style.left            = '0px';
      scalerRef.current.style.top             = '0px';
      scalerRef.current.style.width           = `${baseW}px`;
      scalerRef.current.style.height          = `${realH}px`;

      // Canvas-скейлинг только для portrait
      if (!portrait) {
        if (canvasScalerRef.current) {
          canvasScalerRef.current.style.transform = '';
        }
        return;
      }

      requestAnimationFrame(() => {
        if (canvasWrapperRef.current && canvasScalerRef.current) {
          const wrapperW = canvasWrapperRef.current.clientWidth;
          const wrapperH = canvasWrapperRef.current.clientHeight;
          if (!wrapperW || !wrapperH) return;
          const s = Math.min(wrapperW / CANVAS_W, wrapperH / CANVAS_H);
          canvasScalerRef.current.style.transform = `scale(${s})`;
        }
      });
    }

    scaleLayout();
    window.addEventListener('resize', scaleLayout);
    return () => window.removeEventListener('resize', scaleLayout);
  }, [onOrientationChange]);

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

            {/* Центрирующая обёртка — занимает всё свободное пространство */}
            <div className="portrait-content-area">

              {/* Внутренний блок — ограничен 60% высоты */}
              <div className="portrait-content-inner">

                {/* Canvas + Banners */}
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

                {/* Logo + Orders */}
                <div className="portrait-bottom-content">
                  <div className="portrait-logo">
                    {logo}
                  </div>
                  <div className="portrait-orders">
                    <div className="orders-title"></div>
                    {orders}
                  </div>
                </div>

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