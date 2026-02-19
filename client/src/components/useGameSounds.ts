/**
 * useGameSounds — игровые звуки через Web Audio API
 * Никаких внешних файлов — всё генерируется программно.
 */

import { useRef, useCallback } from 'react';

type SoundName = 'spin' | 'reelStop' | 'win' | 'bigWin' | 'buttonClick';

export function useGameSounds() {
  const ctxRef = useRef<AudioContext | null>(null);
  const mutedRef = useRef(false);

  // Ленивая инициализация AudioContext (требует user gesture)
  const getCtx = (): AudioContext | null => {
    if (mutedRef.current) return null;
    if (!ctxRef.current) {
      try {
        ctxRef.current = new AudioContext();
      } catch {
        return null;
      }
    }
    if (ctxRef.current.state === 'suspended') {
      ctxRef.current.resume();
    }
    return ctxRef.current;
  };

  // ── Утилиты ──

  const makeGain = (ctx: AudioContext, value: number, time: number): GainNode => {
    const g = ctx.createGain();
    g.gain.setValueAtTime(value, time);
    return g;
  };

  const connect = (...nodes: AudioNode[]) => {
    for (let i = 0; i < nodes.length - 1; i++) {
      nodes[i].connect(nodes[i + 1]);
    }
  };

  // ── Генераторы звуков ──

  /**
   * Клик кнопки спина: короткий щелчок с небольшим pitch-sweep
   */
  const playButtonClick = useCallback(() => {
    const ctx = getCtx(); if (!ctx) return;
    const now = ctx.currentTime;

    const osc = ctx.createOscillator();
    const gain = makeGain(ctx, 0.3, now);

    osc.type = 'sine';
    osc.frequency.setValueAtTime(600, now);
    osc.frequency.exponentialRampToValueAtTime(300, now + 0.08);

    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);

    connect(osc, gain, ctx.destination);
    osc.start(now);
    osc.stop(now + 0.1);
  }, []);

  /**
   * Вращение барабанов: шум прокрутки — повторяющийся тикающий звук
   * Возвращает функцию stop() для остановки
   */
  const playSpinLoop = useCallback((): (() => void) => {
    const ctx = getCtx();
    if (!ctx) return () => {};

    // Создаём несколько осцилляторов которые создают ощущение вращения
    const nodes: { osc: OscillatorNode; gain: GainNode }[] = [];
    const masterGain = ctx.createGain();
    masterGain.gain.setValueAtTime(0.15, ctx.currentTime);
    masterGain.connect(ctx.destination);

    // Основной шум — быстрые тики
    const makeClick = (time: number, freq: number) => {
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, time);
      g.gain.setValueAtTime(0.4, time);
      g.gain.exponentialRampToValueAtTime(0.001, time + 0.04);
      osc.connect(g);
      g.connect(masterGain);
      osc.start(time);
      osc.stop(time + 0.05);
    };

    // Планируем тики на 3 секунды вперёд
    const now = ctx.currentTime;
    const interval = 0.06; // период тика
    const freqs = [180, 220, 160, 200]; // разные частоты для ощущения движения

    for (let i = 0; i < 50; i++) {
      makeClick(now + i * interval, freqs[i % freqs.length]);
    }

    // Фоновый шум
    const bufferSize = ctx.sampleRate * 0.5;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) data[i] = (Math.random() * 2 - 1) * 0.3;

    const noise = ctx.createBufferSource();
    noise.buffer = buffer;
    noise.loop = true;

    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 300;
    filter.Q.value = 0.5;

    const noiseGain = ctx.createGain();
    noiseGain.gain.setValueAtTime(0.08, ctx.currentTime);

    noise.connect(filter);
    filter.connect(noiseGain);
    noiseGain.connect(masterGain);
    noise.start();

    let stopped = false;
    return () => {
      if (stopped) return;
      stopped = true;
      const t = ctx.currentTime;
      masterGain.gain.setValueAtTime(masterGain.gain.value, t);
      masterGain.gain.exponentialRampToValueAtTime(0.001, t + 0.15);
      try { noise.stop(t + 0.2); } catch {}
    };
  }, []);

  /**
   * Остановка барабана: короткий "стук" при приземлении
   */
  const playReelStop = useCallback((colIndex: number = 0) => {
    const ctx = getCtx(); if (!ctx) return;
    const now = ctx.currentTime + colIndex * 0.01; // лёгкий сдвиг по колонкам

    // Низкий удар
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(120 - colIndex * 5, now);
    osc.frequency.exponentialRampToValueAtTime(60, now + 0.15);

    gain.gain.setValueAtTime(0.5, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);

    // Немного шума для "механичности"
    const bufSize = Math.floor(ctx.sampleRate * 0.05);
    const buf = ctx.createBuffer(1, bufSize, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < bufSize; i++) d[i] = Math.random() * 2 - 1;

    const noise = ctx.createBufferSource();
    noise.buffer = buf;
    const nGain = ctx.createGain();
    nGain.gain.setValueAtTime(0.15, now);
    nGain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);

    connect(osc, gain, ctx.destination);
    connect(noise, nGain, ctx.destination);

    osc.start(now); osc.stop(now + 0.2);
    noise.start(now); noise.stop(now + 0.05);
  }, []);

  /**
   * Победа: восходящий арпеджио
   */
  const playWin = useCallback((isBig = false) => {
    const ctx = getCtx(); if (!ctx) return;
    const now = ctx.currentTime;

    const notes = isBig
      ? [523, 659, 784, 1047, 1319]   // C5 E5 G5 C6 E6 — большая победа
      : [523, 659, 784, 1047];         // C5 E5 G5 C6 — обычная

    const step = isBig ? 0.10 : 0.12;

    notes.forEach((freq, i) => {
      const t = now + i * step;

      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, t);

      // Лёгкий вибрато для красоты
      const lfo = ctx.createOscillator();
      const lfoGain = ctx.createGain();
      lfo.frequency.value = 5;
      lfoGain.gain.value = 4;
      lfo.connect(lfoGain);
      lfoGain.connect(osc.frequency);

      gain.gain.setValueAtTime(0, t);
      gain.gain.linearRampToValueAtTime(isBig ? 0.4 : 0.3, t + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, t + (isBig ? 0.5 : 0.35));

      // Второй осциллятор для полноты звука
      const osc2 = ctx.createOscillator();
      osc2.type = 'triangle';
      osc2.frequency.setValueAtTime(freq * 2, t);
      const gain2 = ctx.createGain();
      gain2.gain.setValueAtTime(0.1, t);
      gain2.gain.exponentialRampToValueAtTime(0.001, t + 0.2);

      connect(osc, gain, ctx.destination);
      connect(osc2, gain2, ctx.destination);
      lfo.start(t); lfo.stop(t + 0.5);
      osc.start(t); osc.stop(t + 0.5);
      osc2.start(t); osc2.stop(t + 0.3);
    });

    // Финальный аккорд для большой победы
    if (isBig) {
      const chordTime = now + notes.length * step + 0.05;
      [523, 659, 784].forEach(freq => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.value = freq;
        gain.gain.setValueAtTime(0.25, chordTime);
        gain.gain.exponentialRampToValueAtTime(0.001, chordTime + 0.8);
        connect(osc, gain, ctx.destination);
        osc.start(chordTime); osc.stop(chordTime + 0.8);
      });
    }
  }, []);

  // ── Публичный API ──

  const play = useCallback((sound: SoundName, options?: { col?: number; big?: boolean }) => {
    switch (sound) {
      case 'buttonClick': playButtonClick(); break;
      case 'spin':        return playSpinLoop();
      case 'reelStop':    playReelStop(options?.col ?? 0); break;
      case 'win':         playWin(options?.big ?? false); break;
      case 'bigWin':      playWin(true); break;
    }
    return () => {};
  }, [playButtonClick, playSpinLoop, playReelStop, playWin]);

  const setMuted = useCallback((muted: boolean) => {
    mutedRef.current = muted;
    if (muted && ctxRef.current) {
      ctxRef.current.suspend();
    } else if (!muted && ctxRef.current) {
      ctxRef.current.resume();
    }
  }, []);

  return { play, setMuted };
}