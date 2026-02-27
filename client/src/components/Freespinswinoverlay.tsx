import { useEffect, useRef, useState } from 'react';

interface FreeSpinsWinOverlayProps {
  totalWin: number;
  onDone: () => void;
}

export default function FreeSpinsWinOverlay({ totalWin, onDone }: FreeSpinsWinOverlayProps) {
  const [displayed, setDisplayed] = useState(0);
  const [phase, setPhase] = useState<'idle' | 'counting' | 'done'>('idle');
  const rafRef = useRef<number | null>(null);
  const startRef = useRef<number | null>(null);
  const COUNT_DURATION = 2400;

  // небольшая задержка перед стартом счётчика — дать барабанам остановиться
  useEffect(() => {
    const t = setTimeout(() => setPhase('counting'), 350);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    if (phase !== 'counting') return;
    startRef.current = null;

    const tick = (now: number) => {
      if (!startRef.current) startRef.current = now;
      const elapsed = now - startRef.current;
      const t = Math.min(elapsed / COUNT_DURATION, 1);
      // ease out quart
      const eased = 1 - Math.pow(1 - t, 4);
      setDisplayed(Math.round(totalWin * eased));

      if (t < 1) {
        rafRef.current = requestAnimationFrame(tick);
      } else {
        setDisplayed(totalWin);
        setPhase('done');
      }
    };

    rafRef.current = requestAnimationFrame(tick);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [phase, totalWin]);

  // Авто-закрытие через 1.5с после окончания счёта
  useEffect(() => {
    if (phase !== 'done') return;
    const t = setTimeout(onDone, 1500);
    return () => clearTimeout(t);
  }, [phase, onDone]);

  const fmt = (v: number) =>
    '$' + v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  return (
    <>
      <style>{`
        @keyframes fswo-bg-in {
          from { opacity: 0; }
          to   { opacity: 1; }
        }
        @keyframes fswo-title-in {
          0%   { transform: translateY(-24px) scale(0.8); opacity: 0; }
          60%  { transform: translateY(4px) scale(1.04); opacity: 1; }
          100% { transform: translateY(0) scale(1); opacity: 1; }
        }
        @keyframes fswo-num-in {
          0%   { transform: scale(0.5); opacity: 0; }
          60%  { transform: scale(1.08); opacity: 1; }
          100% { transform: scale(1); opacity: 1; }
        }
        @keyframes fswo-glow-pulse {
          0%, 100% { text-shadow: 0 0 24px #ffd700, 0 0 48px #ff9500, 0 0 8px #fff; }
          50%      { text-shadow: 0 0 48px #ffd700, 0 0 96px #ff6200, 0 0 16px #fff; }
        }
        @keyframes fswo-coin {
          0%   { transform: translateY(0) rotate(0deg) scale(1); opacity: 1; }
          100% { transform: translateY(-140px) rotate(540deg) scale(0.3); opacity: 0; }
        }
        @keyframes fswo-rays {
          from { transform: rotate(0deg); }
          to   { transform: rotate(360deg); }
        }
        @keyframes fswo-stripe {
          0%   { background-position: 0 0; }
          100% { background-position: 60px 0; }
        }
        .fswo-num-glow {
          animation: fswo-glow-pulse 1s ease-in-out infinite;
        }
      `}</style>

      {/* Полупрозрачная подложка поверх барабанов */}
      <div style={{
        position: 'absolute',
        inset: 0,
        zIndex: 50,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'rgba(0,0,0,0.72)',
        animation: 'fswo-bg-in 0.25s ease forwards',
        overflow: 'hidden',
      }}>

        {/* Вращающиеся лучи позади */}
        <div style={{
          position: 'absolute',
          width: '120%',
          height: '120%',
          background: 'conic-gradient(from 0deg, transparent 0%, rgba(255,215,0,0.04) 5%, transparent 10%)',
          backgroundRepeat: 'repeat',
          animation: 'fswo-rays 8s linear infinite',
          pointerEvents: 'none',
        }} />

        {/* Анимированная полоска сверху */}
        <div style={{
          position: 'absolute',
          top: 0, left: 0, right: 0,
          height: 5,
          background: 'repeating-linear-gradient(90deg, #ffd700 0px, #ffd700 20px, #ff6200 20px, #ff6200 40px, #ffd700 40px)',
          animation: 'fswo-stripe 0.5s linear infinite',
          backgroundSize: '60px 100%',
        }} />
        <div style={{
          position: 'absolute',
          bottom: 0, left: 0, right: 0,
          height: 5,
          background: 'repeating-linear-gradient(90deg, #ffd700 0px, #ffd700 20px, #ff6200 20px, #ff6200 40px, #ffd700 40px)',
          animation: 'fswo-stripe 0.5s linear infinite reverse',
          backgroundSize: '60px 100%',
        }} />

        {/* Летящие монеты/звёзды */}
        {phase !== 'idle' && Array.from({ length: 10 }).map((_, i) => (
          <div key={i} style={{
            position: 'absolute',
            left: `${5 + (i * 9.5) % 90}%`,
            bottom: `${5 + (i * 13) % 55}%`,
            fontSize: `${16 + (i % 3) * 10}px`,
            animation: `fswo-coin ${1.6 + (i % 4) * 0.35}s ease-out ${(i * 0.18) % 1.4}s infinite`,
            pointerEvents: 'none',
            userSelect: 'none',
          }}>
            {['🪙', '⭐', '💰', '✨', '🌟'][i % 5]}
          </div>
        ))}

        {/* Заголовок */}
        <div style={{
          fontFamily: "'Black Han Sans', 'Arial Black', sans-serif",
          fontWeight: 900,
          fontSize: 'clamp(14px, 3vw, 20px)',
          letterSpacing: '0.25em',
          color: '#ffd700',
          textTransform: 'uppercase',
          marginBottom: 12,
          textShadow: '0 2px 8px rgba(0,0,0,0.8)',
          animation: 'fswo-title-in 0.5s cubic-bezier(0.34,1.56,0.64,1) 0.1s both',
        }}>
          🎰 Free Spins Win
        </div>

        {/* Главная цифра */}
        <div
          className="fswo-num-glow"
          style={{
            fontFamily: "'Black Han Sans', 'Arial Black', sans-serif",
            fontWeight: 900,
            fontSize: 'clamp(48px, 10vw, 88px)',
            color: '#ffd700',
            letterSpacing: '-0.04em',
            lineHeight: 1,
            animation: phase === 'idle'
              ? 'fswo-num-in 0.5s cubic-bezier(0.34,1.56,0.64,1) 0.35s both'
              : undefined,
          }}
        >
          {fmt(displayed)}
        </div>

        {/* Подсказка — только когда счёт закончен */}
        {phase === 'done' && (
          <div style={{
            marginTop: 20,
            fontFamily: "'IBM Plex Mono', monospace",
            fontSize: 12,
            color: 'rgba(255,215,0,0.5)',
            letterSpacing: '0.15em',
            textTransform: 'uppercase',
            animation: 'fswo-title-in 0.3s ease both',
          }}>
            tap to continue
          </div>
        )}
      </div>
    </>
  );
}