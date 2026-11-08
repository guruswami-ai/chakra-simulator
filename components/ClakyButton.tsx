
import React, { useState, useCallback, useRef, useEffect } from 'react';
import { AppMode } from '../types';
import { metricsToVestaGrid } from '../vestaboardCodec';

export interface ClakyMetrics {
  modelName: string;
  totalParams: string;
  quantization: string;
  topology: string;
  nodeCount: number;
  tps: number;
  ttft: number;
  kvCachePercent: number;
  inputTokens: number;
  outputTokens: number;
  totalPower: number;
}

interface ClakyButtonProps {
  metrics: ClakyMetrics;
  disabled?: boolean;
  mode?: AppMode;
  onSimulate?: (grid: number[][]) => void;
}

// Vestaboard character set (subset for display)
const FLAP_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789 .-:';

// Mini 3×5 grid showing "CLAKY" centered — the idle state
const IDLE_GRID = [
  [' ', 'C', 'L', 'A', 'K', 'Y', ' '],
];

const TILE_W = 16;
const TILE_H = 22;
const GAP = 1;

/** Single split-flap tile — scrolls through characters to reach target */
const FlapTile: React.FC<{
  target: string;
  active: boolean;
  delay: number;
  duration: number;
  color: string;
}> = ({ target, active, delay, duration, color }) => {
  const [display, setDisplay] = useState(target);
  const [isFlipping, setIsFlipping] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!active) {
      setDisplay(target);
      return;
    }

    // Start scrolling after delay
    const startTimer = setTimeout(() => {
      setIsFlipping(true);
      let tickCount = 0;
      const totalTicks = Math.floor(duration / 200); // ~200ms per flip (visible rotation)

      intervalRef.current = setInterval(() => {
        tickCount++;
        if (tickCount >= totalTicks) {
          // Land on target
          setDisplay(target);
          setIsFlipping(false);
          if (intervalRef.current) clearInterval(intervalRef.current);
        } else {
          // Flip: briefly set flipping true, change char, then unflip
          setIsFlipping(true);
          setTimeout(() => {
            setDisplay(FLAP_CHARS[Math.floor(Math.random() * FLAP_CHARS.length)]);
            setIsFlipping(false);
          }, 100);
        }
      }, 200);
    }, delay);

    return () => {
      clearTimeout(startTimer);
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [active, target, delay, duration]);

  return (
    <div
      style={{
        width: TILE_W,
        height: TILE_H,
        perspective: '120px',
        position: 'relative',
      }}
    >
      {/* Flap tile — rotates on X axis during flip */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          borderRadius: 2,
          background: '#0a0a0a',
          border: `1px solid ${isFlipping ? '#f59e0b40' : '#222'}`,
          transform: isFlipping ? 'rotateX(180deg)' : 'rotateX(0deg)',
          transition: 'transform 0.15s ease-in-out, border-color 0.3s',
          overflow: 'hidden',
        }}
      >
        {/* Split line */}
        <div style={{
          position: 'absolute',
          top: '50%',
          left: 0,
          right: 0,
          height: 1,
          background: 'rgba(0,0,0,0.5)',
          zIndex: 2,
        }} />
        {/* Character */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontFamily: 'JetBrains Mono, monospace',
            fontWeight: 900,
            fontSize: 11,
            color: isFlipping ? '#f59e0b' : color,
            transform: isFlipping ? 'rotateX(180deg)' : 'none',
            transition: isFlipping ? 'none' : 'color 0.3s',
          }}
        >
          {display}
        </div>
      </div>
    </div>
  );
};

const ClakyButton: React.FC<ClakyButtonProps> = ({ metrics, disabled = false, mode, onSimulate }) => {
  const [status, setStatus] = useState<'idle' | 'sending' | 'success' | 'error'>('idle');
  const [animating, setAnimating] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Lazy-init audio element
  const playSplitFlapSound = useCallback(() => {
    if (!audioRef.current) {
      const base = import.meta.env.BASE_URL || '/';
      audioRef.current = new Audio(`${base}sfx/vesta-flap.m4a`);
      audioRef.current.volume = 0.4;
    }
    audioRef.current.currentTime = 0;
    audioRef.current.play().catch(() => {});
  }, []);

  const handleSend = useCallback(async () => {
    if (disabled || status === 'sending') return;

    setStatus('sending');
    setAnimating(true);
    playSplitFlapSound();

    // Generate grid locally, show overlay
    if (onSimulate) {
      const grid = metricsToVestaGrid(metrics);
      onSimulate(grid);
    }

    // Animation runs for ~5s to match the audio
    setTimeout(() => {
      setAnimating(false);
      setStatus('success');
      setTimeout(() => setStatus('idle'), 2000);
    }, 5000);
  }, [metrics, disabled, status, onSimulate, playSplitFlapSound]);

  // Target text while animating — show key metric
  const targetRow = animating
    ? `${metrics.tps.toFixed(0)}T/s`.padStart(7).split('')
    : [' ', 'C', 'L', 'A', 'K', 'Y', ' '];

  const tileColor = status === 'success' ? '#22c55e'
    : status === 'error' ? '#ef4444'
    : animating ? '#f59e0b'
    : '#888';

  return (
    <button
      onClick={handleSend}
      disabled={disabled || status === 'sending'}
      title={`Send metrics to Claky (${metrics.tps.toFixed(1)} TPS)`}
      className={`
        relative overflow-hidden rounded-lg border transition-all duration-200 cursor-pointer
        ${disabled ? 'opacity-30 cursor-not-allowed' : ''}
        ${status === 'success' ? 'border-green-500/40 bg-green-500/10'
          : status === 'sending' ? 'border-amber-500/40 bg-amber-500/10'
          : 'border-white/10 bg-white/[0.03] hover:bg-white/[0.06] hover:border-white/20'}
      `}
      style={{ padding: '4px 6px' }}
    >
      <div style={{
        display: 'flex',
        gap: GAP,
        background: '#050505',
        borderRadius: 3,
        padding: 2,
      }}>
        {targetRow.map((char, i) => (
          <FlapTile
            key={i}
            target={char}
            active={animating}
            delay={i * 150 + Math.random() * 200} // Staggered start per tile
            duration={3000 + Math.random() * 1500}  // Each tile settles at different time
            color={tileColor}
          />
        ))}
      </div>
    </button>
  );
};

export default ClakyButton;
