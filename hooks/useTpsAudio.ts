/**
 * TPS Audio Hook - Audio that responds to inference speed
 *
 * Creates roulette-wheel-like tick sounds that speed up/slow down with TPS.
 * Uses pre-recorded sound files from YAlorenzo/games repo with Web Audio API.
 */

import { useEffect, useRef, useCallback, useState } from 'react';

// Sound file imports (relative to public directory after build)
const SOUNDS = {
  tick: '/sounds/tick.mp3',
  spinUp: '/sounds/roulette_spin.mp3',
  spinDown: '/sounds/slots_spin.mp3',
  win: '/sounds/win.mp3',
};

interface TpsAudioOptions {
  enabled?: boolean;
  baseVolume?: number;      // 0-1
  minTickInterval?: number; // ms - fastest tick rate
  maxTickInterval?: number; // ms - slowest tick rate
  tpsThreshold?: number;    // TPS below this = no sound
  useSamples?: boolean;     // Use sample files vs procedural audio
}

interface AudioState {
  isPlaying: boolean;
  volume: number;
  tickRate: number;
}

// Audio buffer cache
const audioBufferCache: Map<string, AudioBuffer> = new Map();

export function useTpsAudio(tps: number, options: TpsAudioOptions = {}) {
  const {
    enabled = true,
    baseVolume = 0.3,
    minTickInterval = 80,   // Max speed: ~12 ticks/sec at high TPS
    maxTickInterval = 400,  // Min speed: ~2.5 ticks/sec at low TPS
    tpsThreshold = 1,       // No sound below 1 TPS
    useSamples = true,      // Use sample files by default
  } = options;

  const audioContextRef = useRef<AudioContext | null>(null);
  const tickIntervalRef = useRef<number | null>(null);
  const lastTickTimeRef = useRef<number>(0);
  const [audioState, setAudioState] = useState<AudioState>({
    isPlaying: false,
    volume: baseVolume,
    tickRate: 0
  });

  // Initialize AudioContext on first user interaction
  const initAudio = useCallback(async () => {
    if (!audioContextRef.current) {
      audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
    }

    // Preload audio samples
    if (useSamples) {
      await Promise.all(
        Object.entries(SOUNDS).map(async ([key, url]) => {
          if (!audioBufferCache.has(key)) {
            try {
              const response = await fetch(url);
              const arrayBuffer = await response.arrayBuffer();
              const audioBuffer = await audioContextRef.current!.decodeAudioData(arrayBuffer);
              audioBufferCache.set(key, audioBuffer);
            } catch (e) {
              console.warn(`Failed to load sound: ${key}`, e);
            }
          }
        })
      );
    }

    return audioContextRef.current;
  }, [useSamples]);

  // Play a cached audio sample
  const playSample = useCallback((key: string, volume: number = baseVolume, playbackRate: number = 1) => {
    const ctx = audioContextRef.current;
    const buffer = audioBufferCache.get(key);
    if (!ctx || ctx.state === 'suspended' || !buffer) return;

    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.playbackRate.value = playbackRate;

    const gainNode = ctx.createGain();
    gainNode.gain.value = volume;

    source.connect(gainNode);
    gainNode.connect(ctx.destination);
    source.start(0);
  }, [baseVolume]);

  // Play a single tick sound - mechanical click like roulette wheel
  const playTick = useCallback((volume: number = baseVolume, pitch: number = 1) => {
    // Try to use sample first
    if (useSamples && audioBufferCache.has('tick')) {
      playSample('tick', volume * 0.6, pitch);
      return;
    }

    // Fallback to procedural audio
    const ctx = audioContextRef.current;
    if (!ctx || ctx.state === 'suspended') return;

    const now = ctx.currentTime;

    // Create a short, sharp click using noise + filter
    const bufferSize = ctx.sampleRate * 0.02; // 20ms of noise
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);

    // Generate filtered noise (mechanical click sound)
    for (let i = 0; i < bufferSize; i++) {
      // Sharp attack, quick decay envelope
      const envelope = Math.exp(-i / (bufferSize * 0.1));
      data[i] = (Math.random() * 2 - 1) * envelope;
    }

    const source = ctx.createBufferSource();
    source.buffer = buffer;

    // Bandpass filter for that mechanical "click" quality
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 2000 * pitch; // Higher pitch for faster TPS
    filter.Q.value = 5;

    // Gain for volume control
    const gainNode = ctx.createGain();
    gainNode.gain.setValueAtTime(volume * 0.5, now);
    gainNode.gain.exponentialRampToValueAtTime(0.001, now + 0.02);

    source.connect(filter);
    filter.connect(gainNode);
    gainNode.connect(ctx.destination);

    source.start(now);
    source.stop(now + 0.025);
  }, [baseVolume, useSamples, playSample]);

  // Play a "spin up" whoosh sound when inference starts
  const playSpinUp = useCallback(() => {
    // Try sample first (roulette spin sound)
    if (useSamples && audioBufferCache.has('spinUp')) {
      playSample('spinUp', baseVolume * 0.4, 1.2);
      return;
    }

    // Fallback to procedural
    const ctx = audioContextRef.current;
    if (!ctx || ctx.state === 'suspended') return;

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(100, now);
    osc.frequency.exponentialRampToValueAtTime(800, now + 0.3);

    gain.gain.setValueAtTime(baseVolume * 0.2, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + 0.35);
  }, [baseVolume, useSamples, playSample]);

  // Play a "spin down" sound when inference stops
  const playSpinDown = useCallback(() => {
    // Try sample first (slots spin sound - shorter)
    if (useSamples && audioBufferCache.has('spinDown')) {
      playSample('spinDown', baseVolume * 0.3, 0.8);
      return;
    }

    // Fallback to procedural
    const ctx = audioContextRef.current;
    if (!ctx || ctx.state === 'suspended') return;

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(600, now);
    osc.frequency.exponentialRampToValueAtTime(80, now + 0.5);

    gain.gain.setValueAtTime(baseVolume * 0.15, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.5);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + 0.55);
  }, [baseVolume, useSamples, playSample]);

  // Play win sound when inference completes successfully
  const playWin = useCallback(() => {
    if (useSamples && audioBufferCache.has('win')) {
      playSample('win', baseVolume * 0.5);
    }
  }, [baseVolume, useSamples, playSample]);

  // Calculate tick interval based on TPS (higher TPS = faster ticks)
  const getTickInterval = useCallback((currentTps: number): number => {
    if (currentTps <= tpsThreshold) return 0; // No ticking

    // Map TPS to tick interval: higher TPS = shorter interval
    // TPS 10 -> ~300ms, TPS 50 -> ~100ms, TPS 150 -> ~50ms
    const normalizedTps = Math.min(currentTps, 200); // Cap at 200 TPS
    const interval = maxTickInterval - ((normalizedTps / 200) * (maxTickInterval - minTickInterval));
    return Math.max(minTickInterval, Math.min(maxTickInterval, interval));
  }, [minTickInterval, maxTickInterval, tpsThreshold]);

  // Main effect: manage tick loop based on TPS
  useEffect(() => {
    if (!enabled) return;

    const tickInterval = getTickInterval(tps);
    const pitch = 0.8 + (Math.min(tps, 150) / 150) * 0.6; // Pitch increases with TPS

    // Clear existing interval
    if (tickIntervalRef.current) {
      clearInterval(tickIntervalRef.current);
      tickIntervalRef.current = null;
    }

    if (tickInterval > 0 && audioContextRef.current) {
      // Start ticking
      const tick = () => {
        const now = performance.now();
        if (now - lastTickTimeRef.current >= tickInterval * 0.8) {
          playTick(baseVolume, pitch);
          lastTickTimeRef.current = now;
        }
      };

      tickIntervalRef.current = window.setInterval(tick, tickInterval);

      setAudioState({
        isPlaying: true,
        volume: baseVolume,
        tickRate: Math.round(1000 / tickInterval)
      });
    } else {
      setAudioState({
        isPlaying: false,
        volume: baseVolume,
        tickRate: 0
      });
    }

    return () => {
      if (tickIntervalRef.current) {
        clearInterval(tickIntervalRef.current);
      }
    };
  }, [tps, enabled, baseVolume, getTickInterval, playTick]);

  // Track TPS transitions for spin up/down sounds
  const prevTpsRef = useRef(0);
  useEffect(() => {
    if (!enabled || !audioContextRef.current) return;

    const wasActive = prevTpsRef.current > tpsThreshold;
    const isActive = tps > tpsThreshold;

    if (!wasActive && isActive) {
      playSpinUp();
    } else if (wasActive && !isActive) {
      playSpinDown();
    }

    prevTpsRef.current = tps;
  }, [tps, enabled, tpsThreshold, playSpinUp, playSpinDown]);

  return {
    initAudio,
    audioState,
    playTick,
    playSpinUp,
    playSpinDown,
    playWin,
    playSample,
    isSupported: typeof AudioContext !== 'undefined' || typeof (window as any).webkitAudioContext !== 'undefined'
  };
}

/**
 * TPS Color Utility - Dynamic color scheme based on inference speed
 *
 * Returns colors that transition from cool (slow/idle) to warm (fast/active)
 */
export function getTpsColor(tps: number, options: { alpha?: number } = {}): string {
  const { alpha = 1 } = options;

  if (tps <= 0) {
    // Idle: cool blue-gray
    return `rgba(100, 116, 139, ${alpha})`; // slate-500
  } else if (tps < 20) {
    // Slow: cyan/teal
    return `rgba(6, 182, 212, ${alpha})`; // cyan-500
  } else if (tps < 50) {
    // Medium: green
    return `rgba(34, 197, 94, ${alpha})`; // green-500
  } else if (tps < 100) {
    // Fast: yellow/amber
    return `rgba(234, 179, 8, ${alpha})`; // yellow-500
  } else if (tps < 150) {
    // Very fast: orange
    return `rgba(249, 115, 22, ${alpha})`; // orange-500
  } else {
    // Maximum: red (hot!)
    return `rgba(239, 68, 68, ${alpha})`; // red-500
  }
}

/**
 * Get a gradient for TPS visualization
 */
export function getTpsGradient(tps: number): { start: string; end: string } {
  if (tps <= 0) {
    return { start: '#334155', end: '#1e293b' }; // slate dark
  } else if (tps < 20) {
    return { start: '#06b6d4', end: '#0891b2' }; // cyan
  } else if (tps < 50) {
    return { start: '#22c55e', end: '#16a34a' }; // green
  } else if (tps < 100) {
    return { start: '#eab308', end: '#ca8a04' }; // yellow
  } else if (tps < 150) {
    return { start: '#f97316', end: '#ea580c' }; // orange
  } else {
    return { start: '#ef4444', end: '#dc2626' }; // red
  }
}

/**
 * Calculate spin duration based on TPS
 * Higher TPS = faster spin (shorter duration)
 */
export function getTpsSpinDuration(tps: number): number {
  if (tps <= 0) return 0; // No spin when idle
  if (tps < 5) return 10; // Very slow spin
  if (tps < 20) return 5;
  if (tps < 50) return 2;
  if (tps < 100) return 1;
  if (tps < 150) return 0.5;
  return 0.3; // Maximum speed
}
