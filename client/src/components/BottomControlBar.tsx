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
  onSpeedUp?: () => void;       // функция ускорения из GameCanvas
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
}: BottomControlBarProps) {
  const [showAutoMenu, setShowAutoMenu]   = useState(false);
  const [autoSpinsLeft, setAutoSpinsLeft] = useState(0);
  const [isFast, setIsFast]               = useState(false);
  const menuRef   = useRef<HTMLDivElement>(null);
  const isAutoRef = useRef(false);

  const formatMoney = (val: number) =>
    '$' + val.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  // Сбрасываем isFast когда вращение завершилось
  useEffect(() => {
    if (!isSpinning) setIsFast(false);
  }, [isSpinning]);

  // Закрываем меню при клике вне
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShowAutoMenu(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // Следующий спин в автоцикле
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

  const handleSpeedUp = () => {
    setIsFast(v => !v);
    onSpeedUp?.();
  };

  const isAuto = isAutoRef.current && (isSpinning || autoSpinsLeft > 0);

  return (
    <div className="bottom-control-bar">

      {/* Левая группа */}
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

      {/* Центральная группа */}
      <div className="center-group">
        <div className="info-block">
          <span className="info-label">CREDIT</span>
          <span className="info-value">{formatMoney(balance)}</span>
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

      {/* Правая группа */}
      <div className="right-group">

        {/* SPIN / SPEED кнопка */}
        <button
          className={`spin-button ${isSpinning ? 'spin-button--spinning' : ''} ${isFast ? 'spin-button--fast' : ''}`}
          onClick={isSpinning ? handleSpeedUp : onSpin}
          disabled={false}
          aria-label={isSpinning ? (isFast ? 'Normal speed' : 'Speed up') : 'Spin'}
        >
          {isSpinning ? (
            <span className="speed-btn-inner">
              <MdFastForward />
              {isFast && <span className="speed-label">×4</span>}
            </span>
          ) : (
            <ImSpinner11 />
          )}
        </button>

        {/* Авто кнопка / STOP */}
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
              // STOP с счётчиком
              <span className="auto-stop-inner">
                <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                  <rect x="2" y="2" width="6" height="6" rx="1" fill="currentColor"/>
                </svg>
                {autoSpinsLeft > 0 && <span className="auto-stop-count">{autoSpinsLeft}</span>}
              </span>
            ) : (
              <MdOutlineMotionPhotosAuto />
            )}
          </button>

          {/* Выпадающее меню */}
          {showAutoMenu && (
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
          )}
        </div>

      </div>
    </div>
  );
}