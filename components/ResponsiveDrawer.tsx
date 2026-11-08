import React, { useRef, useCallback, useEffect, useState } from 'react';
import { Breakpoint } from '../hooks/useBreakpoint';
import { SlidersHorizontal, X } from 'lucide-react';

interface ResponsiveDrawerProps {
  children: React.ReactNode;
  isOpen: boolean;
  onToggle: () => void;
  breakpoint: Breakpoint;
}

// Bottom sheet snap points (as fraction of viewport height)
const SNAP_CLOSED = 0;       // Fully hidden
const SNAP_HALF = 0.5;       // Half screen
const SNAP_FULL = 0.85;      // Full (with safe margin at top)

const ResponsiveDrawer: React.FC<ResponsiveDrawerProps> = ({
  children,
  isOpen,
  onToggle,
  breakpoint,
}) => {
  // ── Desktop: static side panel ───────────────────────────────────
  if (breakpoint === 'desktop') {
    return (
      <div className="w-[34%] h-full relative z-20 flex flex-col p-8 overflow-y-auto custom-scrollbar border-l shadow-[-20px_0_100px_rgba(0,0,0,0.8)] bg-purple-950/80 border-purple-500/20">
        <div className="flex flex-col gap-8 w-full">
          {children}
        </div>
      </div>
    );
  }

  // ── Tablet: right-side slide-out drawer ──────────────────────────
  if (breakpoint === 'tablet') {
    return (
      <>
        {/* Backdrop */}
        {isOpen && (
          <div
            className="fixed inset-0 z-30 bg-black/60 drawer-backdrop"
            onClick={onToggle}
          />
        )}
        {/* Drawer */}
        <div
          className="fixed top-0 right-0 h-full z-40 flex flex-col overflow-y-auto custom-scrollbar bg-purple-950/95 border-l border-purple-500/20 shadow-[-20px_0_100px_rgba(0,0,0,0.8)] drawer-transition"
          style={{
            width: 400,
            transform: isOpen ? 'translateX(0)' : 'translateX(100%)',
          }}
        >
          {/* Close button */}
          <div className="flex items-center justify-between p-4 border-b border-white/5">
            <span className="text-xs font-black text-white/40 uppercase tracking-widest">Configure</span>
            <button
              onClick={onToggle}
              className="p-2 text-white/40 hover:text-white hover:bg-white/10 rounded-xl transition-all"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
          <div className="flex-1 p-6 overflow-y-auto custom-scrollbar">
            <div className="flex flex-col gap-8 w-full">
              {children}
            </div>
          </div>
        </div>
      </>
    );
  }

  // ── Mobile: bottom sheet with drag ───────────────────────────────
  return <BottomSheet isOpen={isOpen} onToggle={onToggle}>{children}</BottomSheet>;
};

// ── Bottom Sheet Sub-Component ──────────────────────────────────────

interface BottomSheetProps {
  children: React.ReactNode;
  isOpen: boolean;
  onToggle: () => void;
}

const BottomSheet: React.FC<BottomSheetProps> = ({ children, isOpen, onToggle }) => {
  const sheetRef = useRef<HTMLDivElement>(null);
  const dragStartRef = useRef<{ y: number; height: number } | null>(null);
  const [sheetHeight, setSheetHeight] = useState(0); // 0 = closed
  const [isDragging, setIsDragging] = useState(false);

  // Snap to target height
  const snapTo = useCallback((fraction: number) => {
    const vh = window.innerHeight;
    setSheetHeight(fraction * vh);
  }, []);

  // Open/close sync
  useEffect(() => {
    if (isOpen) {
      snapTo(SNAP_HALF);
    } else {
      snapTo(SNAP_CLOSED);
    }
  }, [isOpen, snapTo]);

  // Touch handlers for drag
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    const touch = e.touches[0];
    dragStartRef.current = { y: touch.clientY, height: sheetHeight };
    setIsDragging(true);
  }, [sheetHeight]);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!dragStartRef.current) return;
    const touch = e.touches[0];
    const delta = dragStartRef.current.y - touch.clientY;
    const newHeight = Math.max(0, Math.min(window.innerHeight * SNAP_FULL, dragStartRef.current.height + delta));
    setSheetHeight(newHeight);
  }, []);

  const handleTouchEnd = useCallback(() => {
    setIsDragging(false);
    if (!dragStartRef.current) return;
    dragStartRef.current = null;

    const vh = window.innerHeight;
    const fraction = sheetHeight / vh;

    // Snap to nearest point
    if (fraction < 0.15) {
      snapTo(SNAP_CLOSED);
      if (isOpen) onToggle(); // Close
    } else if (fraction < 0.65) {
      snapTo(SNAP_HALF);
      if (!isOpen) onToggle(); // Open
    } else {
      snapTo(SNAP_FULL);
      if (!isOpen) onToggle(); // Open
    }
  }, [sheetHeight, snapTo, isOpen, onToggle]);

  return (
    <>
      {/* Backdrop */}
      {sheetHeight > 0 && (
        <div
          className="fixed inset-0 z-30 bg-black/60 drawer-backdrop"
          style={{ opacity: Math.min(1, sheetHeight / (window.innerHeight * SNAP_HALF)) }}
          onClick={() => {
            snapTo(SNAP_CLOSED);
            if (isOpen) onToggle();
          }}
        />
      )}

      {/* Sheet */}
      <div
        ref={sheetRef}
        className={`fixed bottom-0 left-0 right-0 z-40 flex flex-col bg-purple-950/95 border-t border-purple-500/30 rounded-t-3xl shadow-[0_-20px_60px_rgba(0,0,0,0.8)] ${
          isDragging ? '' : 'drawer-transition'
        }`}
        style={{
          height: sheetHeight,
          paddingBottom: 'env(safe-area-inset-bottom)',
        }}
      >
        {/* Drag handle */}
        <div
          className="flex-shrink-0 flex items-center justify-center py-3 cursor-grab active:cursor-grabbing touch-none"
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
        >
          <div className="w-12 h-1.5 rounded-full bg-white/20" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-5 pb-3 border-b border-white/5">
          <span className="text-xs font-black text-white/40 uppercase tracking-widest">Configure</span>
          <button
            onClick={() => {
              snapTo(SNAP_CLOSED);
              if (isOpen) onToggle();
            }}
            className="p-2 text-white/40 hover:text-white hover:bg-white/10 rounded-xl transition-all"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto custom-scrollbar px-5 py-4">
          <div className="flex flex-col gap-6 w-full">
            {children}
          </div>
        </div>
      </div>
    </>
  );
};

export default ResponsiveDrawer;
