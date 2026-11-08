
import React, { useEffect, useRef, useState, useCallback } from 'react';
import { VESTA_CHARS, VESTA_COLORS } from '../vestaboardCodec';

interface VestaboardOverlayProps {
  grid: number[][];
  visible: boolean;
  onDismiss: () => void;
}

const BLANK_COLOR = '#181819';
const SCROLL_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
const ROWS = 6;
const COLS = 22;
const TOTAL_TILES = ROWS * COLS;

// Pre-calculate per-tile animation parameters
function buildTileParams(grid: number[][]) {
  const tiles: Array<{
    targetChar: string;
    targetBg: string;
    startDelay: number;  // ms before this tile starts flipping
    totalFlips: number;  // how many flips before settling
  }> = [];

  for (let r = 0; r < ROWS; r++) {
    const row = grid[r];
    for (let c = 0; c < COLS; c++) {
      const code = row?.[c] ?? 0;
      const isColor = code >= 63 && code <= 70;
      tiles.push({
        targetChar: isColor ? ' ' : (VESTA_CHARS[code] || ' '),
        targetBg: isColor ? VESTA_COLORS[code] : BLANK_COLOR,
        startDelay: c * 50 + r * 80 + Math.random() * 60,
        totalFlips: 10 + Math.floor(Math.random() * 15),
      });
    }
  }
  return tiles;
}

const VestaboardOverlay: React.FC<VestaboardOverlayProps> = ({ grid, visible, onDismiss }) => {
  const dismissTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animRef = useRef<number | null>(null);
  const [settled, setSettled] = useState(false);

  // Play audio when visible
  useEffect(() => {
    if (!visible) {
      setSettled(false);
      return;
    }
    if (!audioRef.current) {
      const base = import.meta.env.BASE_URL || '/';
      audioRef.current = new Audio(`${base}sfx/vesta-flap.m4a`);
      audioRef.current.volume = 0.25;
    }
    audioRef.current.currentTime = 0;
    audioRef.current.play().catch(() => {});
  }, [visible]);

  // Canvas-based animation — single render loop for all 132 tiles
  useEffect(() => {
    if (!visible || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const tileParams = buildTileParams(grid);
    const startTime = performance.now();
    const flipInterval = 120; // ms per flip

    // Canvas dimensions
    const dpr = window.devicePixelRatio || 1;
    const boardW = canvas.clientWidth;
    const boardH = canvas.clientHeight;
    canvas.width = boardW * dpr;
    canvas.height = boardH * dpr;
    ctx.scale(dpr, dpr);

    const tileW = (boardW - (COLS + 1) * 1.5) / COLS;
    const tileH = (boardH - (ROWS + 1) * 1.5) / ROWS;
    const gap = 1.5;

    let allSettled = false;

    function draw(now: number) {
      if (!ctx) return;
      const elapsed = now - startTime;

      ctx.clearRect(0, 0, boardW, boardH);

      let settledCount = 0;

      for (let i = 0; i < TOTAL_TILES; i++) {
        const r = Math.floor(i / COLS);
        const c = i % COLS;
        const tile = tileParams[i];

        const x = gap + c * (tileW + gap);
        const y = gap + r * (tileH + gap);

        const tileElapsed = elapsed - tile.startDelay;
        let char = ' ';
        let bg = BLANK_COLOR;
        let isFlipping = false;

        if (tileElapsed < 0) {
          // Not started yet
          char = ' ';
          bg = BLANK_COLOR;
        } else {
          const flipNum = Math.floor(tileElapsed / flipInterval);
          if (flipNum >= tile.totalFlips) {
            // Settled
            char = tile.targetChar;
            bg = tile.targetBg;
            settledCount++;
          } else {
            // Scrolling
            char = SCROLL_CHARS[Math.floor(Math.random() * SCROLL_CHARS.length)];
            bg = flipNum % 2 === 0 ? '#222' : BLANK_COLOR;
            isFlipping = (tileElapsed % flipInterval) < flipInterval * 0.4;
          }
        }

        // Draw tile background
        ctx.fillStyle = bg;
        const cornerR = 2;
        ctx.beginPath();
        ctx.roundRect(x, y, tileW, tileH, cornerR);
        ctx.fill();

        // Split-flap line
        ctx.fillStyle = 'rgba(0,0,0,0.35)';
        ctx.fillRect(x, y + tileH / 2 - 0.5, tileW, 1);

        // Draw character
        if (char !== ' ') {
          ctx.fillStyle = isFlipping ? '#f59e0b' : '#ffffff';
          ctx.font = `bold ${Math.floor(tileH * 0.65)}px "JetBrains Mono", monospace`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';

          // Vertical squeeze during flip
          if (isFlipping) {
            ctx.save();
            ctx.translate(x + tileW / 2, y + tileH / 2);
            ctx.scale(1, 0.3);
            ctx.fillText(char, 0, 0);
            ctx.restore();
          } else {
            ctx.fillText(char, x + tileW / 2, y + tileH / 2 + 1);
          }
        }
      }

      if (settledCount >= TOTAL_TILES && !allSettled) {
        allSettled = true;
        setSettled(true);
        // Stop the flap audio when all tiles have settled
        if (audioRef.current) {
          const audio = audioRef.current;
          // Quick fade out over 200ms
          const fadeSteps = 8;
          const startVol = audio.volume;
          let step = 0;
          const fade = setInterval(() => {
            step++;
            if (step >= fadeSteps) {
              audio.pause();
              audio.volume = startVol;
              clearInterval(fade);
            } else {
              audio.volume = Math.max(0, startVol * (1 - step / fadeSteps));
            }
          }, 25);
        }
      }

      if (!allSettled) {
        animRef.current = requestAnimationFrame(draw);
      }
    }

    animRef.current = requestAnimationFrame(draw);

    return () => {
      if (animRef.current) cancelAnimationFrame(animRef.current);
    };
  }, [visible, grid]);

  // Auto-dismiss after 30s
  useEffect(() => {
    if (!visible) {
      if (dismissTimer.current) clearTimeout(dismissTimer.current);
      return;
    }
    dismissTimer.current = setTimeout(onDismiss, 30_000);
    return () => {
      if (dismissTimer.current) clearTimeout(dismissTimer.current);
    };
  }, [visible, onDismiss]);

  return (
    <div
      onClick={onDismiss}
      className="pointer-events-auto cursor-pointer"
      style={{
        position: 'absolute',
        bottom: 'calc(50% + 130px)',
        left: '50%',
        transform: `translateX(-50%)${visible ? '' : ' translateY(8px)'}`,
        width: Math.min(600, window.innerWidth - 40),
        zIndex: 45,
        opacity: visible ? 1 : 0,
        transition: visible
          ? 'opacity 0.3s ease, transform 0.3s ease'
          : 'opacity 0.5s ease, transform 0.5s ease',
        pointerEvents: visible ? 'auto' : 'none',
      }}
    >
      {/* Vestaboard frame */}
      <div
        style={{
          background: 'rgba(0,0,0,0.92)',
          borderRadius: 12,
          padding: 10,
          border: '1px solid rgba(255,255,255,0.08)',
          boxShadow: '0 20px 60px rgba(0,0,0,0.8), 0 0 40px rgba(0,0,0,0.5)',
        }}
      >
        <canvas
          ref={canvasRef}
          style={{
            width: '100%',
            aspectRatio: `${COLS * 5} / ${ROWS * 6}`,
            borderRadius: 6,
            background: '#111',
            display: 'block',
          }}
        />
      </div>
    </div>
  );
};

export default VestaboardOverlay;
