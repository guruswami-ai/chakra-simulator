
import React, { createContext, useContext, useState, useCallback, useMemo, useRef } from 'react';
import { HelpSectionId, CodexSectionId } from '../types';
import { useResonanceState } from '../hooks/useResonanceState';
import type { ResonanceState, ModelProgress } from '../hooks/useResonanceState';

// ── Types ─────────────────────────────────────────────────────────────

export type CodexMode = 'GAME' | 'SIM' | 'LIVE';

/** Ordered model progression — tier = index of highest mastered model + 1 */
const MODEL_TIER_ORDER = ['qwen25-32b', 'llama-405b', 'mixtral-8x7b', 'deepseek-v3', 'kimi-k2.5'];

export interface CodexContextType {
  // Panel open/close state
  isOpen: boolean;
  anchor: CodexSectionId | null;
  openCodex: (section?: CodexSectionId) => void;
  closeCodex: () => void;

  /** Ref for external callback when a section opens — set by App.tsx to trigger Guruswami voice */
  onSectionOpenRef: React.MutableRefObject<((sectionId: string) => void) | null>;

  // Codex extensions
  mode: CodexMode;
  currentTier: number;
  hasGraduated: boolean;
  resonance: ResonanceState;
  getModelProgress: (modelId: string) => ModelProgress;
  isTrialCompleted: (trialId: string) => boolean;
  isSectionUnlocked: (id: CodexSectionId) => boolean;

  // Codex progress persistence
  recordQuizScore: (trialId: string, score: number, total: number) => void;
  markSectionViewed: (sectionId: string) => void;

  // Backward compat aliases for HelpContext consumers
  openHelp: (section?: HelpSectionId) => void;
  closeHelp: () => void;
}

// ── Context ───────────────────────────────────────────────────────────

const CodexContext = createContext<CodexContextType | undefined>(undefined);

// ── Provider ──────────────────────────────────────────────────────────

export const CodexProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [anchor, setAnchor] = useState<CodexSectionId | null>(null);
  const onSectionOpenRef = useRef<((sectionId: string) => void) | null>(null);

  const resonanceHook = useResonanceState();
  const { state: resonance, getModelProgress, isTrialCompleted, recordQuizScore, markSectionViewed } = resonanceHook;

  const openCodex = useCallback((section?: CodexSectionId) => {
    setAnchor(section || null);
    setIsOpen(true);
    // Notify external listener (Guruswami voice) when a specific section is opened
    if (section) {
      onSectionOpenRef.current?.(section);
    }
  }, []);

  const closeCodex = useCallback(() => {
    setIsOpen(false);
    setAnchor(null);
  }, []);

  // Derive current tier from mastered model count (ordered progression)
  const currentTier = useMemo(() => {
    let tier = 0;
    for (const modelId of MODEL_TIER_ORDER) {
      if (resonance.models[modelId]?.mastered) {
        tier++;
      } else {
        break;
      }
    }
    return tier;
  }, [resonance.models]);

  // Derive mode from state
  const mode: CodexMode = useMemo(() => {
    if (resonance.activeTrialId) return 'GAME';
    if (resonance.hasGraduated) return 'SIM';
    return 'GAME'; // Default to GAME until graduated
  }, [resonance.activeTrialId, resonance.hasGraduated]);

  // V1: all sections unlocked
  const isSectionUnlocked = useCallback((_id: CodexSectionId): boolean => {
    return true;
  }, []);

  const value: CodexContextType = useMemo(() => ({
    isOpen,
    anchor,
    openCodex,
    closeCodex,
    onSectionOpenRef,
    mode,
    currentTier,
    hasGraduated: resonance.hasGraduated,
    resonance,
    getModelProgress,
    isTrialCompleted,
    isSectionUnlocked,
    recordQuizScore,
    markSectionViewed,
    // Backward compat aliases
    openHelp: openCodex,
    closeHelp: closeCodex,
  }), [isOpen, anchor, openCodex, closeCodex, mode, currentTier, resonance, getModelProgress, isTrialCompleted, isSectionUnlocked, recordQuizScore, markSectionViewed]);

  return (
    <CodexContext.Provider value={value}>
      {children}
    </CodexContext.Provider>
  );
};

// ── Hook ──────────────────────────────────────────────────────────────

export const useCodex = () => {
  const context = useContext(CodexContext);
  if (!context) throw new Error('useCodex must be used within a CodexProvider');
  return context;
};
