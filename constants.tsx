
import React from 'react';

export const CHAKRA_COLORS = {
  muladhara: { base: '#ef4444', glow: 'rgba(239, 68, 68, 0.4)', label: 'Root', element: 'Earth' },
  svadhisthana: { base: '#f97316', glow: 'rgba(249, 115, 22, 0.4)', label: 'Sacral', element: 'Water' },
  manipura: { base: '#eab308', glow: 'rgba(234, 179, 8, 0.4)', label: 'Solar Plexus', element: 'Fire' },
  anahata: { base: '#22c55e', glow: 'rgba(34, 197, 94, 0.4)', label: 'Heart', element: 'Air' },
  vishuddha: { base: '#06b6d4', glow: 'rgba(6, 182, 212, 0.4)', label: 'Throat', element: 'Ether' },
  sahasrara: { base: '#a855f7', glow: 'rgba(168, 85, 247, 0.4)', label: 'Crown', element: 'Consciousness' },
};

// Simplified chakra symbols matching the landing page design
export const CHAKRA_SYMBOLS: Record<string, React.ReactNode> = {
  muladhara: (
    <g transform="translate(50, 50)">
      {/* 4-petaled lotus — Earth, stability, foundation */}
      {Array.from({ length: 4 }).map((_, i) => (
        <ellipse key={i} cx="0" cy="-30" rx="10" ry="14" fill="none" stroke="currentColor" strokeWidth="1.5" opacity="0.5" transform={`rotate(${i * 90})`} />
      ))}
      {/* Rotated square — Earth element */}
      <rect x="-14" y="-14" width="28" height="28" fill="none" stroke="currentColor" strokeWidth="2.5" transform="rotate(45)" />
      {/* Inner circle binding */}
      <circle cx="0" cy="0" r="10" fill="none" stroke="currentColor" strokeWidth="1" opacity="0.4" />
      {/* Center seed */}
      <circle cx="0" cy="0" r="4" fill="currentColor" opacity="0.9" />
    </g>
  ),
  svadhisthana: (
    <g transform="translate(50, 50)">
      {/* 6-petaled lotus — Water, flow, creativity */}
      {Array.from({ length: 6 }).map((_, i) => (
        <ellipse key={i} cx="0" cy="-30" rx="9" ry="13" fill="none" stroke="currentColor" strokeWidth="1.5" opacity="0.5" transform={`rotate(${i * 60})`} />
      ))}
      {/* Crescent moon — Water element */}
      <path d="M-16 2 A16 16 0 0 1 16 2" fill="none" stroke="currentColor" strokeWidth="2.5" />
      <path d="M-10 2 A10 14 0 0 0 10 2" fill="none" stroke="currentColor" strokeWidth="1.5" opacity="0.6" />
      {/* Center circle */}
      <circle cx="0" cy="5" r="5" fill="currentColor" opacity="0.8" />
    </g>
  ),
  manipura: (
    <g transform="translate(50, 50)">
      {/* 10-petaled lotus — Fire, power, transformation */}
      {Array.from({ length: 10 }).map((_, i) => (
        <ellipse key={i} cx="0" cy="-30" rx="8" ry="12" fill="none" stroke="currentColor" strokeWidth="1.5" opacity="0.5" transform={`rotate(${i * 36})`} />
      ))}
      {/* Downward triangle — Fire element */}
      <polygon points="0,16 -18,-10 18,-10" fill="none" stroke="currentColor" strokeWidth="2.5" />
      {/* Inner fire lines */}
      {Array.from({ length: 3 }).map((_, i) => (
        <line key={i} x1="0" y1="-6" x2="0" y2="-14" stroke="currentColor" strokeWidth="1.5" opacity="0.4" transform={`rotate(${i * 120 - 60})`} />
      ))}
      {/* Center flame */}
      <circle cx="0" cy="0" r="4" fill="currentColor" opacity="0.9" />
    </g>
  ),
  anahata: (
    <g transform="translate(50, 50)">
      {/* 12-petaled lotus — Air, love, balance */}
      {Array.from({ length: 12 }).map((_, i) => (
        <ellipse key={i} cx="0" cy="-30" rx="7" ry="12" fill="none" stroke="currentColor" strokeWidth="1.5" opacity="0.5" transform={`rotate(${i * 30})`} />
      ))}
      {/* Star of David — two interlocking triangles, Air element */}
      <polygon points="0,-18 -16,10 16,10" fill="none" stroke="currentColor" strokeWidth="2" />
      <polygon points="0,18 -16,-10 16,-10" fill="none" stroke="currentColor" strokeWidth="2" />
      {/* Center heart point */}
      <circle cx="0" cy="0" r="3.5" fill="currentColor" opacity="0.9" />
    </g>
  ),
  vishuddha: (
    <g transform="translate(50, 50)">
      {/* 16-petaled lotus — Ether, sound, expression */}
      {Array.from({ length: 16 }).map((_, i) => (
        <ellipse key={i} cx="0" cy="-30" rx="7" ry="12" fill="none" stroke="currentColor" strokeWidth="1.5" opacity="0.5" transform={`rotate(${i * 22.5})`} />
      ))}
      {/* Downward triangle — Ether/sound element */}
      <polygon points="0,16 -14,-8 14,-8" fill="none" stroke="currentColor" strokeWidth="2.5" />
      {/* Center circle — the void */}
      <circle cx="0" cy="2" r="5" fill="currentColor" opacity="0.8" />
    </g>
  ),
  sahasrara: (
    <g transform="translate(50, 50)">
      {/* 20-petaled lotus (representing 1000) — Crown, consciousness */}
      {Array.from({ length: 20 }).map((_, i) => (
        <ellipse key={i} cx="0" cy="-32" rx="6" ry="10" fill="none" stroke="currentColor" strokeWidth="1.5" opacity="0.45" transform={`rotate(${i * 18})`} />
      ))}
      {/* Inner ring of smaller petals */}
      {Array.from({ length: 12 }).map((_, i) => (
        <ellipse key={`inner-${i}`} cx="0" cy="-20" rx="4" ry="7" fill="none" stroke="currentColor" strokeWidth="1" opacity="0.3" transform={`rotate(${i * 30 + 15})`} />
      ))}
      {/* Radiating crown lines */}
      {Array.from({ length: 8 }).map((_, i) => (
        <line key={i} x1="0" y1="-8" x2="0" y2="-14" stroke="currentColor" strokeWidth="1.5" opacity="0.5" transform={`rotate(${i * 45})`} />
      ))}
      {/* Void — pure consciousness */}
      <circle cx="0" cy="0" r="5" fill="currentColor" opacity="0.7" />
    </g>
  ),
};

// Initial node configuration - compute nodes only (management nodes added dynamically)
// New fields for node visualization states:
// - wired_gb: GPU memory (wired pages) - key for state detection
// - soc_load: SoC load percentage
// - tb5_reachable: Number of TB5 peers reachable (0-4)
// - tb5_latency_ms: Average TB5 ping latency
// - tb5_status: 'healthy' | 'degraded' | 'down' | 'unknown'
// - warnings: Array of active warnings
export const INITIAL_NODES = [
  { id: '1', name: 'muladhara', role: 'compute', hw_model: 'M3 Ultra', ram_total: 512, wired_gb: 0, soc_load: 0, tb5_links: 4, tb5_reachable: 0, tb5_latency_ms: 0, tb5_status: 'unknown' as const, color: CHAKRA_COLORS.muladhara.base, glowColor: CHAKRA_COLORS.muladhara.glow, warnings: [] },
  { id: '2', name: 'svadhisthana', role: 'compute', hw_model: 'M3 Ultra', ram_total: 512, wired_gb: 0, soc_load: 0, tb5_links: 4, tb5_reachable: 0, tb5_latency_ms: 0, tb5_status: 'unknown' as const, color: CHAKRA_COLORS.svadhisthana.base, glowColor: CHAKRA_COLORS.svadhisthana.glow, warnings: [] },
  { id: '3', name: 'manipura', role: 'compute', hw_model: 'M3 Ultra', ram_total: 512, wired_gb: 0, soc_load: 0, tb5_links: 4, tb5_reachable: 0, tb5_latency_ms: 0, tb5_status: 'unknown' as const, color: CHAKRA_COLORS.manipura.base, glowColor: CHAKRA_COLORS.manipura.glow, warnings: [] },
  { id: '4', name: 'anahata', role: 'compute', hw_model: 'M3 Ultra', ram_total: 512, wired_gb: 0, soc_load: 0, tb5_links: 4, tb5_reachable: 0, tb5_latency_ms: 0, tb5_status: 'unknown' as const, color: CHAKRA_COLORS.anahata.base, glowColor: CHAKRA_COLORS.anahata.glow, warnings: [] },
  { id: '5', name: 'vishuddha', role: 'compute', hw_model: 'M3 Ultra', ram_total: 512, wired_gb: 0, soc_load: 0, tb5_links: 4, tb5_reachable: 0, tb5_latency_ms: 0, tb5_status: 'unknown' as const, color: CHAKRA_COLORS.vishuddha.base, glowColor: CHAKRA_COLORS.vishuddha.glow, warnings: [] },
];
