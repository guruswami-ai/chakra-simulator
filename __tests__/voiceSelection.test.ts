import { describe, it, expect } from 'vitest';

/**
 * Voice selection tests validate the logic used by selectVoice() in useGuruswamiState.
 * We test the pure logic (category lookup, file resolution) without React hook dependencies.
 */

// Mirror the selectVoice logic from useGuruswamiState.ts
type VoiceCategory =
  | 'greeting' | 'wake' | 'wisdom' | 'thinking' | 'filler'
  | 'affirmation' | 'encouragement' | 'processing' | 'error'
  | 'engagement' | 'acknowledgment' | 'goodbye' | 'question_responses';

type VoiceLibrary = Record<VoiceCategory, string[]>;

const VOICE_BASE = '/guruswami/voice/';

function selectVoice(voiceLib: VoiceLibrary | null, category: VoiceCategory): string | null {
  if (!voiceLib) return null;
  const files = voiceLib[category];
  if (!files || files.length === 0) return null;
  const file = files[Math.floor(Math.random() * files.length)];
  return VOICE_BASE + category + '/' + file;
}

// Mock voice library — minimal set covering key categories
const mockVoiceLib: VoiceLibrary = {
  greeting: ['gs_greeting_hello_001.m4a', 'gs_greeting_welcome_001.m4a'],
  wake: ['gs_wake_ready_001.m4a'],
  wisdom: ['gs_wisdom_patience_001.m4a'],
  thinking: ['gs_thinking_patterns_001.m4a'],
  filler: [],
  affirmation: ['gs_affirmation_001.m4a'],
  encouragement: [],
  processing: [],
  error: ['gs_error_oom_001.m4a'],
  engagement: ['gs_engagement_001.m4a'],
  acknowledgment: [],
  goodbye: ['gs_goodbye_001.m4a'],
  question_responses: [],
};

describe('selectVoice', () => {
  it('returns null when voiceLib is null', () => {
    expect(selectVoice(null, 'greeting')).toBeNull();
  });

  it('returns null for empty category', () => {
    expect(selectVoice(mockVoiceLib, 'filler')).toBeNull();
    expect(selectVoice(mockVoiceLib, 'encouragement')).toBeNull();
  });

  it('returns a valid path for populated category', () => {
    const result = selectVoice(mockVoiceLib, 'greeting');
    expect(result).not.toBeNull();
    expect(result).toMatch(/^\/guruswami\/voice\/greeting\/gs_greeting_/);
    expect(result).toMatch(/\.m4a$/);
  });

  it('path includes category directory', () => {
    const result = selectVoice(mockVoiceLib, 'error');
    expect(result).toContain('/voice/error/');
  });

  it('returns from available files only', () => {
    // wake has exactly 1 file — should always return it
    const result = selectVoice(mockVoiceLib, 'wake');
    expect(result).toBe('/guruswami/voice/wake/gs_wake_ready_001.m4a');
  });

  it('handles unknown category gracefully', () => {
    const result = selectVoice(mockVoiceLib, 'nonexistent' as VoiceCategory);
    expect(result).toBeNull();
  });
});

// ── Transcription extraction (pure function from useGuruswamiState) ──

function extractPhraseFromFilename(filename: string): string {
  // gs_greeting_hello-my-friend_001.m4a → "hello my friend"
  const base = filename.replace(/\.\w+$/, ''); // Remove extension
  const parts = base.split('_');
  // Remove prefix (gs), category, and variant number
  const phrase = parts.slice(2, -1).join(' ').replace(/-/g, ' ');
  return phrase;
}

describe('extractPhraseFromFilename', () => {
  it('extracts phrase from standard naming', () => {
    expect(extractPhraseFromFilename('gs_greeting_hello_001.m4a')).toBe('hello');
  });

  it('handles multi-word phrases with hyphens', () => {
    expect(extractPhraseFromFilename('gs_greeting_hello-my-friend_001.m4a')).toBe('hello my friend');
  });

  it('handles multi-segment phrases with underscores', () => {
    expect(extractPhraseFromFilename('gs_wisdom_patience_is_key_001.m4a')).toBe('patience is key');
  });
});

// ── Music commentary voice mapping ──────────────────────────────

const MUSIC_MODEL_VOICE_MAP: Record<string, { dir: string; prefix: string }> = {
  'kimi-k2.5':     { dir: 'music_commentary_kimi',     prefix: 'gs_music_kimi' },
  'deepseek-v3':   { dir: 'music_commentary_deepseek', prefix: 'gs_music_deepseek' },
  'llama-405b':    { dir: 'music_commentary_llama',     prefix: 'gs_music_llama' },
  'mixtral-8x7b':  { dir: 'music_commentary_mixtral',   prefix: 'gs_music_mixtral' },
  'qwen25-32b':    { dir: 'music_commentary_qwen',      prefix: 'gs_music_qwen' },
};

describe('music commentary voice mapping', () => {
  it('every catalog model has a music commentary mapping', () => {
    const expectedModels = ['kimi-k2.5', 'deepseek-v3', 'llama-405b', 'mixtral-8x7b', 'qwen25-32b'];
    for (const modelId of expectedModels) {
      const entry = MUSIC_MODEL_VOICE_MAP[modelId];
      expect(entry, `Missing music commentary mapping for ${modelId}`).toBeDefined();
      expect(entry.dir).toMatch(/^music_commentary_/);
      expect(entry.prefix).toMatch(/^gs_music_/);
    }
  });
});

// ── Channel greetings ───────────────────────────────────────────

const CHANNEL_GREETINGS = [
  "Hello nerdburgers. Welcome to the Chakra Cluster.",
  "Hello nerdburger. What shall we learn today?",
  "Hello, I'm Guruswami. Welcome to my chakra cluster.",
  "Greetings, curious one. The cluster awaits your questions.",
  "Hello nerdburgers. Time to learn some AI?",
  "Welcome back. The simulation rewards curiosity.",
  "Hello. I'm Guruswami, and this is where silicon dreams.",
  "Namaste, nerdburger. Shall we explore distributed inference?",
  "Hello nerdburgers. What could go wrong? Let's find out.",
  "Welcome to the cluster. Remember — every expert was once a beginner.",
];

describe('CHANNEL_GREETINGS', () => {
  it('has 10 branded variants', () => {
    expect(CHANNEL_GREETINGS).toHaveLength(10);
  });

  it('all greetings are non-empty strings', () => {
    for (const greeting of CHANNEL_GREETINGS) {
      expect(greeting.length).toBeGreaterThan(10);
    }
  });

  it('includes signature "nerdburger" branding', () => {
    const nerdburgerCount = CHANNEL_GREETINGS.filter(g =>
      g.toLowerCase().includes('nerdburger')
    ).length;
    expect(nerdburgerCount).toBeGreaterThanOrEqual(3);
  });
});
