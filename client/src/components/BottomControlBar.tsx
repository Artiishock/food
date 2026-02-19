import React from 'react';
import './BottomControlBar.css'; // импорт стилей

//icon

import { ImSpinner11 } from "react-icons/im";
import { MdOutlineMotionPhotosAuto } from "react-icons/md";
import { IoIosSettings } from "react-icons/io";

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
  soundEnabled = true,
  onToggleSound,
}: BottomControlBarProps) {
  const formatMoney = (val: number) =>
    '$' + val.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  return (
    <div className="bottom-control-bar">
      {/* Левая группа */}
      <div className="left-group">
        {/* Стек иконок (Settings + Sound) */}
        <div className="icon-stack">
          <button
            className="icon-button"
            onClick={onSettings}
            aria-label="Settings"
          >
          <IoIosSettings />
          </button>

          <button
            className="icon-button"
            onClick={onToggleSound}
            aria-label={soundEnabled ? 'Mute sound' : 'Unmute sound'}
          >
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

        {/* Info */}
        <button className="info-button" onClick={onInfo} aria-label="Information">
          <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
            <path d="M10 14.5V9.5H13V14.5H10ZM11.5 8.2C11.1 8.2 10.75 8.07 10.46 7.8C10.18 7.53 10.04 7.21 10.04 6.84C10.04 6.47 10.18 6.15 10.46 5.88C10.75 5.61 11.1 5.48 11.5 5.48C11.9 5.48 12.25 5.61 12.53 5.88C12.82 6.15 12.96 6.47 12.96 6.84C12.96 7.21 12.82 7.53 12.53 7.8C12.25 8.07 11.9 8.2 11.5 8.2Z" fill="#9F9F9F"/>
          </svg>
        </button>
      </div>

      {/* Центральная группа: CREDIT и BET */}
      <div className="center-group">
        {/* CREDIT */}
        <div className="info-block">
          <span className="info-label">CREDIT</span>
          <span className="info-value">{formatMoney(balance)}</span>
        </div>

        {/* BET */}
        <div className="info-block">
          <span className="info-label">BET</span>
          <div className="bet-block">
            <span className="bet-value">{formatMoney(currentBet)}</span>

          <div className="btngrup">
            <button
              className="bet-adjust-button"
              onClick={onBetIncrease}
              disabled={isSpinning}
              aria-label="Increase bet"
            >
              +
            </button>
            <button
              className="bet-adjust-button"
              onClick={onBetDecrease}
              disabled={isSpinning}
              aria-label="Decrease bet"
            >
              −
            </button>
          </div>
          </div>
        </div>
      </div>

      {/* Правая группа: Spin + авто */}
      <div className="right-group">
        <button
          className={`spin-button ${isSpinning ? 'spin-button--spinning' : ''}`}
          onClick={onSpin}
          disabled={isSpinning}
          aria-label="Spin"
        >
          <ImSpinner11 />
        </button>

        <button
          className="auto-button"
          onClick={onAutoSpin}
          disabled={isSpinning}
          aria-label="Auto spin"
        >
          <MdOutlineMotionPhotosAuto />
        </button>
      </div>
    </div>
  );
}