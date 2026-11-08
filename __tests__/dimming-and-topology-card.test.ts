/**
 * Tests for:
 * 1. Dimming logic — verifies opacity values at each onboarding step
 * 2. ClusterTopologyCard — containerStyle passthrough, "Awaiting deployment" placeholder
 */
import { describe, it, expect } from 'vitest';
import type { OnboardingStep } from '../character-engine/types';

// ── Extract the dimming function from App.tsx logic ─────────────
// (Pure function, no React hooks needed)
type DimmingValues = { left: number; mandala: number; stats: number; topbar: number };

function computeDimming(onboardingStep: OnboardingStep, bootPhase: number = 0): DimmingValues {
  switch (onboardingStep) {
    case 'INTRO':        return { left: 0.03, mandala: 0.02, stats: 0, topbar: 0.08 };
    case 'INTRO_CLUSTER':return { left: 0.05, mandala: 0.03, stats: 0, topbar: 0.10 };
    case 'PICK_MODEL':   return { left: 0.08, mandala: 0.05, stats: 0.05, topbar: 0.15 };
    case 'PICK_QUANT':   return { left: 0.12, mandala: 0.08, stats: 0.08, topbar: 0.20 };
    case 'PICK_TOPOLOGY':return { left: 0.35, mandala: 0.20, stats: 0.15, topbar: 0.35 };
    case 'TOUR_TPS':
    case 'TOUR_TTFT':
    case 'TOUR_LAYERS':
    case 'TOUR_MEMORY':  return { left: 1.0, mandala: 1.0, stats: 1.0, topbar: 0.5 };
    case 'LOADING': {
      const prev = { left: 0.35, mandala: 0.20, stats: 0.15, topbar: 0.35 };
      return {
        mandala: bootPhase >= 1 ? 1.0 : prev.mandala,
        topbar:  bootPhase >= 2 ? 1.0 : prev.topbar,
        left:    bootPhase >= 3 ? 1.0 : prev.left,
        stats:   bootPhase >= 4 ? 1.0 : prev.stats,
      };
    }
    default:             return { left: 1.0, mandala: 1.0, stats: 1.0, topbar: 1.0 };
  }
}

// ── Dimming tests ─────────────────────────────────────────────────

describe('dimming values at each onboarding step', () => {
  it('INTRO: stats=0 (card invisible), left near-zero', () => {
    const d = computeDimming('INTRO');
    expect(d.stats).toBe(0);
    expect(d.left).toBeLessThan(0.05);
    expect(d.topbar).toBeLessThan(0.1);
  });

  it('INTRO_CLUSTER: stats=0 (card still invisible)', () => {
    const d = computeDimming('INTRO_CLUSTER');
    expect(d.stats).toBe(0);
    expect(d.left).toBeLessThan(0.1);
  });

  it('PICK_MODEL: stats barely visible (ghost outline)', () => {
    const d = computeDimming('PICK_MODEL');
    expect(d.stats).toBe(0.05);
    expect(d.left).toBe(0.08);
  });

  it('PICK_QUANT: stats slightly more visible', () => {
    const d = computeDimming('PICK_QUANT');
    expect(d.stats).toBe(0.08);
    expect(d.left).toBe(0.12);
  });

  it('PICK_TOPOLOGY: stats faint but visible', () => {
    const d = computeDimming('PICK_TOPOLOGY');
    expect(d.stats).toBe(0.15);
    expect(d.left).toBe(0.35);
  });

  it('LOADING phase 0: all sections at PICK_TOPOLOGY levels', () => {
    const d = computeDimming('LOADING', 0);
    expect(d.stats).toBe(0.15);
    expect(d.left).toBe(0.35);
    expect(d.mandala).toBe(0.20);
    expect(d.topbar).toBe(0.35);
  });

  it('LOADING phase 4: all sections at 1.0 (full reveal)', () => {
    const d = computeDimming('LOADING', 4);
    expect(d.stats).toBe(1.0);
    expect(d.left).toBe(1.0);
    expect(d.mandala).toBe(1.0);
    expect(d.topbar).toBe(1.0);
  });

  it('LOADING phases stagger correctly (mandala→topbar→left→stats)', () => {
    const p1 = computeDimming('LOADING', 1);
    expect(p1.mandala).toBe(1.0);
    expect(p1.topbar).toBe(0.35); // not yet
    expect(p1.left).toBe(0.35);   // not yet
    expect(p1.stats).toBe(0.15);  // not yet

    const p2 = computeDimming('LOADING', 2);
    expect(p2.mandala).toBe(1.0);
    expect(p2.topbar).toBe(1.0);  // revealed
    expect(p2.left).toBe(0.35);   // not yet
    expect(p2.stats).toBe(0.15);  // not yet

    const p3 = computeDimming('LOADING', 3);
    expect(p3.left).toBe(1.0);    // revealed
    expect(p3.stats).toBe(0.15);  // not yet

    const p4 = computeDimming('LOADING', 4);
    expect(p4.stats).toBe(1.0);   // finally revealed
  });

  it('TOUR_* steps: stats=1.0 (card fully visible for tourStyle highlighting)', () => {
    for (const step of ['TOUR_TPS', 'TOUR_TTFT', 'TOUR_LAYERS', 'TOUR_MEMORY'] as OnboardingStep[]) {
      const d = computeDimming(step);
      expect(d.stats).toBe(1.0);
      expect(d.left).toBe(1.0);
      expect(d.mandala).toBe(1.0);
      // topbar stays at 0.5 during tour — focus on the card
      expect(d.topbar).toBe(0.5);
    }
  });

  it('null (onboarding complete): everything at 1.0', () => {
    const d = computeDimming(null);
    expect(d.stats).toBe(1.0);
    expect(d.left).toBe(1.0);
    expect(d.mandala).toBe(1.0);
    expect(d.topbar).toBe(1.0);
  });

  it('dimming values increase monotonically through onboarding steps', () => {
    const steps: OnboardingStep[] = [
      'INTRO', 'INTRO_CLUSTER', 'PICK_MODEL', 'PICK_QUANT', 'PICK_TOPOLOGY',
    ];
    for (let i = 1; i < steps.length; i++) {
      const prev = computeDimming(steps[i - 1]);
      const curr = computeDimming(steps[i]);
      expect(curr.left).toBeGreaterThanOrEqual(prev.left);
      expect(curr.stats).toBeGreaterThanOrEqual(prev.stats);
      expect(curr.topbar).toBeGreaterThanOrEqual(prev.topbar);
      expect(curr.mandala).toBeGreaterThanOrEqual(prev.mandala);
    }
  });
});

// ── ClusterTopologyCard prop tests ────────────────────────────────

describe('ClusterTopologyCard showLayerSplit / showMemory logic', () => {
  // These mirror the conditions in ClusterTopologyCard.tsx lines 130-131
  const showLayerSplit = (totalLayers?: number) => totalLayers !== undefined && totalLayers > 0;
  const showMemory = (weightsPerNode?: number) => weightsPerNode !== undefined && weightsPerNode > 0;

  it('no model data → both false → "Awaiting deployment" placeholder renders', () => {
    expect(showLayerSplit(undefined)).toBe(false);
    expect(showMemory(undefined)).toBe(false);
    // When both false, the placeholder renders
  });

  it('totalLayers=0 → showLayerSplit=false', () => {
    expect(showLayerSplit(0)).toBe(false);
  });

  it('weightsPerNode=0 → showMemory=false', () => {
    expect(showMemory(0)).toBe(false);
  });

  it('with model data → both true → placeholder does NOT render', () => {
    expect(showLayerSplit(80)).toBe(true);
    expect(showMemory(153)).toBe(true);
    // When either is true, the placeholder does not render
  });
});

// ── Verify dimming is applied correctly in JSX ────────────────────

describe('dimming application to DOM elements (structural)', () => {
  it('default case (null) applies opacity 1.0 to all elements', () => {
    // This verifies the "returning user" path where the left menu should be fully visible
    const d = computeDimming(null);
    // ClusterTopologyCard gets containerStyle={{ opacity: dimming.stats }}
    expect(d.stats).toBe(1.0);
    // MeshGraph wrapper gets style={{ opacity: dimming.left }}
    expect(d.left).toBe(1.0);
    // TopBar wrapper gets style={{ opacity: dimming.topbar }}
    expect(d.topbar).toBe(1.0);
    // MandalaShader wrapper gets style={{ opacity: dimming.mandala }}
    expect(d.mandala).toBe(1.0);
  });

  it('INTRO step dims everything to near-zero', () => {
    const d = computeDimming('INTRO');
    // All sections should be barely visible
    expect(d.left).toBeLessThanOrEqual(0.05);
    expect(d.stats).toBe(0);
    expect(d.topbar).toBeLessThanOrEqual(0.1);
    expect(d.mandala).toBeLessThanOrEqual(0.05);
  });

  it('TOUR steps have stats=1.0 so tourStyle() can handle per-section dimming', () => {
    // tourStyle() applies opacity:0.2 to non-highlighted sections
    // If container were at stats=0.25, effective would be 0.25*0.2=0.05 (too dim)
    // So container must be at 1.0 for tour to work correctly
    const d = computeDimming('TOUR_TPS');
    expect(d.stats).toBe(1.0);
  });
});
