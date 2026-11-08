/**
 * ClusterTopologyCard rendering tests.
 * Verifies:
 * - containerStyle (opacity) is applied to the root div
 * - containerClassName is applied to the root div
 * - "Awaiting deployment" shows when no layer/memory data
 * - "Awaiting deployment" hidden when layer/memory data present
 * - TPS and TTFT values render correctly
 */
import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { render, screen } from '@testing-library/react';
import ClusterTopologyCard from '../components/ClusterTopologyCard';
import { CodexProvider } from '../components/CodexContext';

const baseProps = {
  topology: 'TP4_RDMA' as any,
  tps: 0,
  ttft: 0,
  nodeCount: 0,
  onClick: vi.fn(),
  history: [],
};

/** Wrap component with required context providers */
function renderCard(props: Record<string, any> = {}) {
  return render(
    <CodexProvider>
      <ClusterTopologyCard {...baseProps} {...props} />
    </CodexProvider>
  );
}

describe('ClusterTopologyCard', () => {
  // ── containerStyle / containerClassName passthrough ───────────

  it('applies containerStyle to root div', () => {
    const { container } = renderCard({ containerStyle: { opacity: 0.15 } });
    const root = container.firstElementChild as HTMLElement;
    expect(root.style.opacity).toBe('0.15');
  });

  it('applies containerStyle opacity=0 (invisible during INTRO)', () => {
    const { container } = renderCard({ containerStyle: { opacity: 0 } });
    const root = container.firstElementChild as HTMLElement;
    expect(root.style.opacity).toBe('0');
  });

  it('applies containerStyle opacity=1 (fully visible after onboarding)', () => {
    const { container } = renderCard({ containerStyle: { opacity: 1.0 } });
    const root = container.firstElementChild as HTMLElement;
    expect(root.style.opacity).toBe('1');
  });

  it('applies containerClassName to root div', () => {
    const { container } = renderCard({
      containerClassName: 'transition-opacity duration-[1500ms] ease-out',
    });
    const root = container.firstElementChild as HTMLElement;
    expect(root.className).toContain('transition-opacity');
    expect(root.className).toContain('duration-[1500ms]');
    expect(root.className).toContain('ease-out');
  });

  it('no containerStyle/className → root has default classes only', () => {
    const { container } = renderCard();
    const root = container.firstElementChild as HTMLElement;
    expect(root.className).toContain('absolute');
    expect(root.className).toContain('pointer-events-auto');
    // No trailing space from undefined className
    expect(root.className).not.toContain('undefined');
  });

  // ── "Awaiting deployment" placeholder ─────────────────────────

  it('shows "Awaiting deployment" when no totalLayers and no weightsPerNode', () => {
    renderCard();
    expect(screen.getByText('Awaiting deployment')).toBeInTheDocument();
  });

  it('shows "Awaiting deployment" when totalLayers=0 and weightsPerNode=0', () => {
    renderCard({ totalLayers: 0, weightsPerNode: 0 });
    expect(screen.getByText('Awaiting deployment')).toBeInTheDocument();
  });

  it('hides "Awaiting deployment" when totalLayers > 0', () => {
    renderCard({ totalLayers: 80 });
    expect(screen.queryByText('Awaiting deployment')).not.toBeInTheDocument();
  });

  it('hides "Awaiting deployment" when weightsPerNode > 0', () => {
    renderCard({ weightsPerNode: 153, kvCachePerNode: 10, freePerNode: 349 });
    expect(screen.queryByText('Awaiting deployment')).not.toBeInTheDocument();
  });

  // ── TPS / TTFT rendering ──────────────────────────────────────

  it('shows TPS=0.0 during onboarding (passed as prop)', () => {
    renderCard({ tps: 0 });
    expect(screen.getByText('0.0')).toBeInTheDocument();
  });

  it('shows TTFT=0.00 during onboarding (passed as prop)', () => {
    renderCard({ ttft: 0 });
    expect(screen.getByText('0.00')).toBeInTheDocument();
  });

  it('shows actual TPS when simulation is active', () => {
    renderCard({ tps: 11.5 });
    expect(screen.getByText('11.5')).toBeInTheDocument();
  });

  // ── Tour highlight ────────────────────────────────────────────

  it('does not crash with highlightSection=tps', () => {
    const { container } = renderCard({ highlightSection: 'tps' });
    expect(container.firstElementChild).toBeTruthy();
  });

  it('does not crash with highlightSection=memory', () => {
    const { container } = renderCard({
      highlightSection: 'memory',
      weightsPerNode: 153,
      kvCachePerNode: 10,
      freePerNode: 349,
    });
    expect(container.firstElementChild).toBeTruthy();
  });
});
