import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import TopBar from '../components/TopBar';
import type { ClusterState, AppMode } from '../types';

// Minimal ClusterState for rendering
const mockState: ClusterState = {
  globalTopology: 'OFFLINE',
  fabric: 'OFFLINE',
  activeModels: [],
  nodes: [],
  history: [],
};

const defaultProps = {
  state: mockState,
  onToggleMode: vi.fn(),
  onOpenHelp: vi.fn(),
  mode: 'SIM' as AppMode,
};

describe('TopBar', () => {
  it('renders SIM indicator', () => {
    render(<TopBar {...defaultProps} />);
    expect(screen.getByText('SIM')).toBeInTheDocument();
  });

  it('does NOT render LIVE button', () => {
    render(<TopBar {...defaultProps} />);
    expect(screen.queryByText('LIVE')).not.toBeInTheDocument();
  });

  it('does NOT render GAME button', () => {
    render(<TopBar {...defaultProps} />);
    expect(screen.queryByText('GAME')).not.toBeInTheDocument();
  });
});
