
/**
 * vestaboardCodec.ts — Vestaboard grid formatting for simulated overlay
 *
 * Ported 1:1 from bridge.py lines 2050-2279.
 * Pure functions, no React.
 */

import { ClakyMetrics } from './components/ClakyButton';

// ── Character code map (A=1..Z=26, 1=27..0=36, symbols, 63-70=colors) ──

export const VESTA_CHAR_MAP: Record<string, number> = {
  ' ': 0,
  A: 1, B: 2, C: 3, D: 4, E: 5, F: 6, G: 7, H: 8, I: 9, J: 10,
  K: 11, L: 12, M: 13, N: 14, O: 15, P: 16, Q: 17, R: 18, S: 19, T: 20,
  U: 21, V: 22, W: 23, X: 24, Y: 25, Z: 26,
  '1': 27, '2': 28, '3': 29, '4': 30, '5': 31,
  '6': 32, '7': 33, '8': 34, '9': 35, '0': 36,
  '!': 37, '@': 38, '#': 39, '$': 40, '(': 41, ')': 42,
  '-': 44, '+': 46, '&': 47, '=': 48, ';': 49, ':': 50,
  "'": 52, '"': 53, '%': 54, ',': 55, '.': 56, '/': 59, '?': 60,
};

// ── Reverse map: code → display character ──

export const VESTA_CHARS: Record<number, string> = {
  0: '', 1: 'A', 2: 'B', 3: 'C', 4: 'D', 5: 'E', 6: 'F', 7: 'G',
  8: 'H', 9: 'I', 10: 'J', 11: 'K', 12: 'L', 13: 'M', 14: 'N', 15: 'O',
  16: 'P', 17: 'Q', 18: 'R', 19: 'S', 20: 'T', 21: 'U', 22: 'V', 23: 'W',
  24: 'X', 25: 'Y', 26: 'Z',
  27: '1', 28: '2', 29: '3', 30: '4', 31: '5', 32: '6', 33: '7', 34: '8', 35: '9', 36: '0',
  37: '!', 38: '@', 39: '#', 40: '$', 41: '(', 42: ')',
  44: '-', 46: '+', 47: '&', 48: '=', 49: ';', 50: ':',
  52: "'", 53: '"', 54: '%', 55: ',', 56: '.', 59: '/', 60: '?', 62: '\u00B0',
};

// ── Color code → CSS hex ──

export const VESTA_COLORS: Record<number, string> = {
  63: '#dc2626', // red
  64: '#ea580c', // orange
  65: '#ca8a04', // yellow
  66: '#16a34a', // green
  67: '#2563eb', // blue
  68: '#9333ea', // violet
  69: '#e5e5e5', // white
  70: '#000000', // black
};

// ── Color constants ──

export const VESTA_RED = 63;
export const VESTA_ORANGE = 64;
export const VESTA_YELLOW = 65;
export const VESTA_GREEN = 66;
export const VESTA_BLUE = 67;
export const VESTA_VIOLET = 68;
export const VESTA_WHITE = 69;
export const VESTA_BLACK = 70;

// 5 compute nodes in chakra color order (muladhara→vishuddha)
const CHAKRA_NODE_COLORS = [VESTA_RED, VESTA_ORANGE, VESTA_YELLOW, VESTA_GREEN, VESTA_BLUE];

// ── Helper functions (1:1 ports from bridge.py) ──

/** Convert text to Vestaboard codes, padded/truncated to width. */
export function textToVestaCodes(text: string, width = 22): number[] {
  const upper = text.toUpperCase().slice(0, width);
  const codes = Array.from(upper).map(c => VESTA_CHAR_MAP[c] ?? 0);
  while (codes.length < width) codes.push(0);
  return codes;
}

/** 5 tiles: active nodes in chakra colors, inactive in white. */
export function nodeStatusTiles(activeCount: number): number[] {
  return Array.from({ length: 5 }, (_, i) =>
    i < activeCount ? CHAKRA_NODE_COLORS[i] : VESTA_WHITE
  );
}

/** Visual KV cache bar: color shifts green→yellow→orange→red with utilization. */
export function kvCacheBar(pct: number, width = 12): number[] {
  let filled = Math.round((pct / 100) * width);
  filled = Math.max(0, Math.min(width, filled));
  if (pct > 0) filled = Math.max(1, filled);

  const color =
    pct > 90 ? VESTA_RED :
    pct > 75 ? VESTA_ORANGE :
    pct > 50 ? VESTA_YELLOW :
    VESTA_GREEN;

  return [
    ...Array(filled).fill(color),
    ...Array(width - filled).fill(VESTA_WHITE),
  ];
}

/** Center model name between white tiles. */
export function vestaModelBanner(name: string): number[] {
  const upper = name.toUpperCase().slice(0, 20);
  const nameCodes = Array.from(upper).map(c => VESTA_CHAR_MAP[c] ?? 0);
  const remaining = 22 - nameCodes.length;
  const leftPad = Math.floor(remaining / 2);
  const rightPad = remaining - leftPad;
  return [
    ...Array(leftPad).fill(VESTA_WHITE),
    ...nameCodes,
    ...Array(rightPad).fill(VESTA_WHITE),
  ];
}

/** 5 chakra colors + 12-char text + 5 mirrored chakra colors = 22. */
function rainbowTextRow(text12: string): number[] {
  const codes = Array.from(text12.toUpperCase().slice(0, 12)).map(c => VESTA_CHAR_MAP[c] ?? 0);
  while (codes.length < 12) codes.push(0);
  return [
    VESTA_RED, VESTA_ORANGE, VESTA_YELLOW, VESTA_GREEN, VESTA_BLUE,
    ...codes,
    VESTA_BLUE, VESTA_GREEN, VESTA_YELLOW, VESTA_ORANGE, VESTA_RED,
  ];
}

/** 2 chakra colors + 18-char text + 2 mirrored colors = 22. */
function bookendTextRow(text18: string): number[] {
  const codes = Array.from(text18.toUpperCase().slice(0, 18)).map(c => VESTA_CHAR_MAP[c] ?? 0);
  while (codes.length < 18) codes.push(0);
  return [VESTA_RED, VESTA_ORANGE, ...codes, VESTA_ORANGE, VESTA_RED];
}

const BOTTOM_ROW_VARIANTS: number[][] = [
  rainbowTextRow('@PAULANDYOGI'),
  rainbowTextRow('@PAULANDYOGI'),  // weighted 2x
  rainbowTextRow(' SUBSCRIBE! '),
  rainbowTextRow('SMASH  LIKE!'),
  rainbowTextRow(' HIT  LIKE! '),
  bookendTextRow('LIKE AND SUBSCRIBE'),
  bookendTextRow('LIKE + SUBSCRIBE! '),
];

// ── Main grid builder ──

/** Convert ClakyMetrics to a 6x22 Vestaboard grid. Direct port of metrics_to_vesta_grid(). */
export function metricsToVestaGrid(data: ClakyMetrics): number[][] {
  const {
    modelName = 'UNKNOWN',
    totalParams = '?',
    topology = 'TP4_RDMA',
    nodeCount = 4,
    tps = 0,
    ttft = 0,
    kvCachePercent = 0,
    inputTokens = 0,
    outputTokens = 0,
    totalPower = 0,
    quantization = 'Q4',
  } = data;

  const topoShort = topology.replace('_RDMA', '').replace('RING_', '');
  const ttftMs = ttft < 10 ? Math.round(ttft * 1000) : Math.round(ttft);

  // Row 1: Model name centered between white tiles
  const row1 = vestaModelBanner(modelName);

  // Row 2: Q:quant PAR:params  topo + node tiles
  const quantNum = quantization.replace(/^[QqFf]/, '');
  const quantPrefix = quantization[0].toUpperCase();
  const leftText = `${quantPrefix}:${quantNum} PAR:${totalParams}`;
  const leftCodes = Array.from(leftText.toUpperCase()).map(c => VESTA_CHAR_MAP[c] ?? 0);
  const topoLabel = Array.from(topoShort.toUpperCase()).map(c => VESTA_CHAR_MAP[c] ?? 0);
  const nodes = nodeStatusTiles(nodeCount);
  const rightCodes = [...topoLabel, ...nodes];
  const gap2 = 22 - leftCodes.length - rightCodes.length;
  const row2 = [...leftCodes, ...Array(Math.max(1, gap2)).fill(0), ...rightCodes].slice(0, 22);

  // Row 3: TPS + TTFT
  const tpsStr = tps.toFixed(1).padStart(5);
  const ttftStr = String(ttftMs).padStart(4);
  const row3 = textToVestaCodes(`TPS:${tpsStr}  TTFT:${ttftStr}MS`);

  // Row 4: KV cache bar + percentage + power
  const bar = kvCacheBar(kvCachePercent, 5);
  const kvPrefix = [VESTA_CHAR_MAP['K'], VESTA_CHAR_MAP['V']];
  const pctStr = kvCachePercent.toFixed(1).padStart(4) + '%';
  const pwrStr = `PWR:${String(Math.round(totalPower)).padStart(4)}W`;
  const pctCodes = Array.from(pctStr).map(c => VESTA_CHAR_MAP[c] ?? 0);
  const pwrCodes = Array.from(pwrStr).map(c => VESTA_CHAR_MAP[c] ?? 0);
  const row4 = [...kvPrefix, ...bar, ...pctCodes, 0, ...pwrCodes, ...Array(22).fill(0)].slice(0, 22);

  // Row 5: Token counts
  const inStr = String(inputTokens).padStart(5);
  const outStr = String(outputTokens).padStart(5);
  const row5 = textToVestaCodes(`TOK IN:${inStr} OUT:${outStr}`);

  // Row 6: Random CTA
  const row6 = BOTTOM_ROW_VARIANTS[Math.floor(Math.random() * BOTTOM_ROW_VARIANTS.length)];

  return [row1, row2, row3, row4, row5, row6];
}
