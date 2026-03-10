import React, { useState, useEffect, useRef } from 'react';
import './BottomControlBar.css';

import { ImSpinner11 } from "react-icons/im";
import { MdOutlineMotionPhotosAuto } from "react-icons/md";
import { IoIosSettings } from "react-icons/io";
import { MdFastForward } from "react-icons/md";

interface BottomControlBarProps {
  balance: number;
  currentBet: number;
  isSpinning: boolean;
  onSpin: () => void;
  onBetIncrease: () => void;
  onBetDecrease: () => void;
  onAutoSpin?: () => void;
  onSettings?: () => void;
  onInfo?: () => void;
  soundEnabled?: boolean;
  onToggleSound?: () => void;
  onSpeedUp?: () => void;
  lastWin?: number;
  isFast?: boolean;
  isPortrait?: boolean;
}

const AUTO_SPIN_OPTIONS = [5, 10, 25, 50, 100];

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
  soundEnabled = true,
  onToggleSound,
  onSpeedUp,
  isFast: isFastProp = false,
  lastWin = 0,
  isPortrait = false,
}: BottomControlBarProps) {
  const [showAutoMenu, setShowAutoMenu] = useState(false);
  const [autoSpinsLeft, setAutoSpinsLeft] = useState(0);
  const menuRef = useRef<HTMLDivElement>(null);
  const isAutoRef = useRef(false);

  const formatMoney = (val: number) =>
    '$' + val.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShowAutoMenu(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  useEffect(() => {
    if (!isAutoRef.current || isSpinning || autoSpinsLeft <= 0) return;
    const timer = setTimeout(() => {
      setAutoSpinsLeft(n => n - 1);
      onSpin();
    }, 400);
    return () => clearTimeout(timer);
  }, [isSpinning, autoSpinsLeft]);

  const startAutoSpin = (count: number) => {
    setShowAutoMenu(false);
    isAutoRef.current = true;
    setAutoSpinsLeft(count - 1);
    onSpin();
  };

  const stopAutoSpin = () => {
    isAutoRef.current = false;
    setAutoSpinsLeft(0);
  };

  const handleSpeedUp = () => { onSpeedUp?.(); };

  const isEffectivelyFast = isFastProp && isSpinning;
  const isAuto = isAutoRef.current && (isSpinning || autoSpinsLeft > 0);

  const AutoMenu = () => showAutoMenu ? (
    <div className="auto-spin-menu">
      <div className="auto-spin-menu__title">Auto Spins</div>
      {AUTO_SPIN_OPTIONS.map(count => (
        <button key={count} className="auto-spin-menu__item" onClick={() => startAutoSpin(count)}>
          <span>{count} spins</span>
          <svg width="6" height="10" viewBox="0 0 6 10" fill="none">
            <path d="M1 1L5 5L1 9" stroke="#666" strokeWidth="1.5" strokeLinecap="round"/>
          </svg>
        </button>
      ))}
    </div>
  ) : null;

  /* ═════════════════════════════════════════════════════════════
     PORTRAIT (высота > ширина)
     Макет: [ℹ️ CREDIT/BET]  [WIN]  [AUTO ≡]
            ^ Spin кластер выступает над баром ^
  ═════════════════════════════════════════════════════════════ */
  if (isPortrait) {
    return (
      <div className="bottom-control-bar bottom-control-bar--portrait">

        {/* Spin + ± — выступают над баром */}
        <div className="portrait-spin-cluster">
          <button className="portrait-bet-btn" onClick={onBetDecrease} disabled={isSpinning} aria-label="Decrease bet">−</button>
          <button
            className={`spin-button spin-button--portrait ${isSpinning ? 'spin-button--spinning' : ''} ${isEffectivelyFast ? 'spin-button--fast' : ''}`}
            onClick={isSpinning ? handleSpeedUp : onSpin}
            aria-label="Spin"
          >
            {isSpinning ? (
              <span className="speed-btn-inner">
                <MdFastForward />
                {isEffectivelyFast && <span className="speed-label">×4</span>}
              </span>
            ) : <ImSpinner11 />}
          </button>
          <button className="portrait-bet-btn" onClick={onBetIncrease} disabled={isSpinning} aria-label="Increase bet">+</button>
        </div>

        {/* Левая часть бара: ℹ️ + CREDIT/BET стопка */}
        <div className="portrait-bar-left">
          <button className="portrait-info-btn" onClick={onInfo} aria-label="Info">
            <svg viewBox="0 0 22 22" fill="none">
              <path d="M10 14.5V9.5H13V14.5H10ZM11.5 8.2C11.1 8.2 10.75 8.07 10.46 7.8C10.18 7.53 10.04 7.21 10.04 6.84C10.04 6.47 10.18 6.15 10.46 5.88C10.75 5.61 11.1 5.48 11.5 5.48C11.9 5.48 12.25 5.61 12.53 5.88C12.82 6.15 12.96 6.47 12.96 6.84C12.96 7.21 12.82 7.53 12.53 7.8C12.25 8.07 11.9 8.2 11.5 8.2Z" fill="#9F9F9F"/>
            </svg>
          </button>
          <div className="portrait-info-stack">
            <div className="portrait-info-row">
              <span className="portrait-label">CREDIT</span>
              <span className="portrait-value">{formatMoney(balance)}</span>
            </div>
            <div className="portrait-info-row">
              <span className="portrait-label">BET</span>
              <span className="portrait-value">{formatMoney(currentBet)}</span>
            </div>
          </div>
        </div>

        {/* Центр: WIN */}
        <div className="portrait-bar-center">
          <span className="portrait-win-label">WIN</span>
          <span className={`portrait-win-value${lastWin > 0 ? ' portrait-win-value--active' : ''}`}>
            {lastWin > 0 ? formatMoney(lastWin) : '—'}
          </span>
        </div>

        {/* Правые кнопки: AUTO | ≡ */}
        <div className="portrait-bar-right">
          <div className="auto-spin-wrapper" ref={menuRef}>
            <button
              className={`portrait-icon-btn${isAuto ? ' portrait-icon-btn--active' : ''}`}
              onClick={() => { if (isAuto) { stopAutoSpin(); return; } if (isSpinning) return; setShowAutoMenu(v => !v); }}
              aria-label="Auto spin"
            >
              {isAuto ? (
                <span className="auto-stop-inner">
                  <svg width="11" height="11" viewBox="0 0 10 10" fill="none"><rect x="2" y="2" width="6" height="6" rx="1" fill="currentColor"/></svg>
                  {autoSpinsLeft > 0 && <span className="auto-stop-count">{autoSpinsLeft}</span>}
                </span>
              ) : <MdOutlineMotionPhotosAuto />}
            </button>
            <AutoMenu />
          </div>
          <button className="portrait-icon-btn" onClick={onSettings} aria-label="Settings">
            <IoIosSettings />
          </button>
        </div>

      </div>
    );
  }

  /* ═════════════════════════════════════════════════════════════
     LANDSCAPE (ширина > высота) — оригинальный макет
     [⚙️🔊]  [ℹ️]  [CREDIT | WIN | BET±]  [SPIN] [AUTO]
  ═════════════════════════════════════════════════════════════ */
  return (
    <div className="bottom-control-bar">

      {/* Левая группа: иконки настроек/звука + ℹ️ */}
      <div className="left-group">
        <div className="icon-stack">
          <button className="icon-button" onClick={onSettings} aria-label="Settings">
            <IoIosSettings />
          </button>
          <button className="icon-button" onClick={onToggleSound} aria-label={soundEnabled ? 'Mute' : 'Unmute'}>
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M5.5 10.5L5.5 7.5L5.5 3.5L3 5.5H2C1.72 5.5 1.5 5.72 1.5 6V8C1.5 8.28 1.72 8.5 2 8.5H3L5.5 10.5Z" fill="#9F9F9F"/>
              {soundEnabled ? (
                <>
                  <path d="M7.5 9.5C8.9 8.06 8.9 5.8 7.5 4.5" stroke="#9F9F9F" strokeWidth="1.2" strokeLinecap="round"/>
                  <path d="M9.5 11.5C12 8.93 12 5.07 9.5 2.5" stroke="#9F9F9F" strokeWidth="1.2" strokeLinecap="round"/>
                </>
              ) : (
                <path d="M8 5L12 9M12 5L8 9" stroke="#9F9F9F" strokeWidth="1.2" strokeLinecap="round"/>
              )}
            </svg>
          </button>
        </div>
        <button className="info-button" onClick={onInfo} aria-label="Information">
          <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
            <path d="M10 14.5V9.5H13V14.5H10ZM11.5 8.2C11.1 8.2 10.75 8.07 10.46 7.8C10.18 7.53 10.04 7.21 10.04 6.84C10.04 6.47 10.18 6.15 10.46 5.88C10.75 5.61 11.1 5.48 11.5 5.48C11.9 5.48 12.25 5.61 12.53 5.88C12.82 6.15 12.96 6.47 12.96 6.84C12.96 7.21 12.82 7.53 12.53 7.8C12.25 8.07 11.9 8.2 11.5 8.2Z" fill="#9F9F9F"/>
          </svg>
        </button>
      </div>

      {/* Центральная группа: CREDIT | WIN | BET± */}
      <div className="center-group">
        <div className="info-block">
          <span className="info-label">CREDIT</span>
          <span className="info-value">{formatMoney(balance)}</span>
        </div>

        <div className="info-block win-block">
          <span className="info-label win-label">WIN</span>
          <span className={`info-value win-value${lastWin > 0 ? ' win-value--active' : ''}`}>
            {lastWin > 0 ? formatMoney(lastWin) : '—'}
          </span>
        </div>

        <div className="info-block">
          <span className="info-label">BET</span>
          <div className="bet-block">
            <span className="bet-value">{formatMoney(currentBet)}</span>
            <div className="btngrup">
              <button className="bet-adjust-button" onClick={onBetIncrease} disabled={isSpinning}>+</button>
              <button className="bet-adjust-button" onClick={onBetDecrease} disabled={isSpinning}>−</button>
            </div>
          </div>
        </div>
      </div>

      {/* Правая группа: SPIN + AUTO */}
      <div className="right-group">
        <button
          className={`spin-button ${isSpinning ? 'spin-button--spinning' : ''} ${isEffectivelyFast ? 'spin-button--fast' : ''}`}
          onClick={isSpinning ? handleSpeedUp : onSpin}
          disabled={false}
          aria-label="Spin"
        >
          {isSpinning ? (
            <span className="speed-btn-inner">
              <MdFastForward />
              {isEffectivelyFast && <span className="speed-label">×4</span>}
            </span>
          ) : <ImSpinner11 />}
        </button>

        <div className="auto-spin-wrapper" ref={menuRef}>
          <button
            className={`auto-button ${isAuto ? 'auto-button--active' : ''}`}
            onClick={() => {
              if (isAuto) { stopAutoSpin(); return; }
              if (isSpinning) return;
              setShowAutoMenu(v => !v);
            }}
            aria-label={isAuto ? 'Stop auto spin' : 'Auto spin'}
          >
            {isAuto ? (
              <span className="auto-stop-inner">
                <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                  <rect x="2" y="2" width="6" height="6" rx="1" fill="currentColor"/>
                </svg>
                {autoSpinsLeft > 0 && <span className="auto-stop-count">{autoSpinsLeft}</span>}
              </span>
            ) : <MdOutlineMotionPhotosAuto />}
          </button>
          <AutoMenu />
        </div>
      </div>

    </div>
  );
}