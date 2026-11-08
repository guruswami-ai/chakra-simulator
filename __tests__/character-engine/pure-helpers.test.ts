import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  extractPhraseFromFilename,
  stateToCategory,
  getLoopBehavior,
  selectVariant,
  selectVoice,
  getTranscription,
  padVariant,
} from '../../character-engine/machine';
import type { AnimLibrary, AnimCategory, VoiceLibrary, VoiceCategory, AnimState } from '../../character-engine/types';
import { mockAnimLibrary, mockVoiceLibrary } from './helpers';

beforeEach(() => {
  vi.spyOn(Math, 'random').mockReturnValue(0.5);
});

// ── extractPhraseFromFilename ───────────────────────────────────

describe('extractPhraseFromFilename', () => {
  it('extracts a single-word phrase', () => {
    expect(extractPhraseFromFilename('gs_greeting_namaste_001.m4a')).toBe('Namaste');
  });

  it('extracts multi-word phrases (hyphens → spaces)', () => {
    expect(extractPhraseFromFilename('gs_wisdom_the-journey-continues_002.m4a')).toBe('The journey continues');
  });

  it('expands contractions: i m → i\'m', () => {
    expect(extractPhraseFromFilename('gs_greeting_i-m-guruswami_001.m4a')).toBe("I'm guruswami");
  });

  it('expands contractions: \'s', () => {
    expect(extractPhraseFromFilename('gs_wisdom_that-s-interesting_003.m4a')).toBe("That's interesting");
  });

  it('expands contractions: \'re', () => {
    expect(extractPhraseFromFilename('gs_greeting_you-re-welcome_001.m4a')).toBe("You're welcome");
  });

  it('expands contractions: \'t', () => {
    expect(extractPhraseFromFilename('gs_greeting_don-t-worry_001.m4a')).toBe("Don't worry");
  });

  it('returns empty for non-matching filenames', () => {
    expect(extractPhraseFromFilename('random-file.mp3')).toBe('');
    expect(extractPhraseFromFilename('')).toBe('');
  });

  it('capitalises first letter', () => {
    const result = extractPhraseFromFilename('gs_wisdom_hello-world_001.m4a');
    expect(result[0]).toBe('H');
  });
});

// ── stateToCategory ─────────────────────────────────────────────

describe('stateToCategory', () => {
  const mappings: [AnimState, AnimCategory | null][] = [
    ['APPEARING', 'appear'],
    ['WAVING', 'wave'],
    ['TALKING', 'talk'],
    ['IDLE', 'idle'],
    ['THINKING', 'think'],
    ['LISTENING', 'listen'],
    ['DISAPPEARING', 'disappear'],
    ['REACTING_YES', 'yes'],
    ['REACTING_NO', 'no'],
    ['WAITING', null],
  ];

  it.each(mappings)('%s → %s', (state, expected) => {
    expect(stateToCategory(state)).toBe(expected);
  });
});

// ── getLoopBehavior ─────────────────────────────────────────────

describe('getLoopBehavior', () => {
  it('returns false for one-shot states', () => {
    expect(getLoopBehavior('APPEARING')).toBe(false);
    expect(getLoopBehavior('DISAPPEARING')).toBe(false);
    expect(getLoopBehavior('WAVING')).toBe(false);
    expect(getLoopBehavior('REACTING_YES')).toBe(false);
    expect(getLoopBehavior('REACTING_NO')).toBe(false);
  });

  it('returns true for looping states', () => {
    expect(getLoopBehavior('TALKING')).toBe(true);
    expect(getLoopBehavior('IDLE')).toBe(true);
    expect(getLoopBehavior('THINKING')).toBe(true);
    expect(getLoopBehavior('LISTENING')).toBe(true);
    expect(getLoopBehavior('WAITING')).toBe(true);
  });
});

// ── selectVariant ───────────────────────────────────────────────

describe('selectVariant', () => {
  it('returns video path from library', () => {
    const result = selectVariant(mockAnimLibrary, 'idle', '/video/');
    expect(result).toBe('/video/idle_001.mp4');
  });

  it('returns empty string for missing category files', () => {
    const emptyLib: AnimLibrary = {
      categories: {
        ...mockAnimLibrary.categories,
        idle: { loop: true, files: [] },
      },
    };
    expect(selectVariant(emptyLib, 'idle', '/video/')).toBe('');
  });
});

// ── selectVoice ─────────────────────────────────────────────────

describe('selectVoice', () => {
  it('returns voice path with category subdirectory', () => {
    const result = selectVoice(mockVoiceLibrary, 'greeting', '/voice/');
    expect(result).toBe('/voice/greeting/gs_greeting_test-phrase_001.m4a');
  });

  it('returns null for empty category', () => {
    const emptyLib = { ...mockVoiceLibrary, greeting: [] } as VoiceLibrary;
    expect(selectVoice(emptyLib, 'greeting', '/voice/')).toBeNull();
  });
});

// ── getTranscription ────────────────────────────────────────────

describe('getTranscription', () => {
  const transcriptions = {
    'greeting/gs_greeting_test-phrase_001.m4a': 'Hello there!',
  };

  it('returns transcription when key matches', () => {
    const result = getTranscription('/voice/greeting/gs_greeting_test-phrase_001.m4a', transcriptions);
    expect(result).toBe('Hello there!');
  });

  it('falls back to filename extraction when no match', () => {
    const result = getTranscription('/voice/wisdom/gs_wisdom_the-journey_001.m4a', transcriptions);
    expect(result).toBe('The journey');
  });

  it('handles null transcriptions', () => {
    const result = getTranscription('/voice/greeting/gs_greeting_namaste_001.m4a', null);
    expect(result).toBe('Namaste');
  });
});

// ── padVariant ──────────────────────────────────────────────────

describe('padVariant', () => {
  it('pads to 3 digits', () => {
    // Math.random mocked to 0.5, max=3 → floor(0.5*3)+1 = 2 → '002'
    expect(padVariant(0, 3)).toBe('002');
  });

  it('pads single digit', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.0);
    // floor(0.0*3)+1 = 1 → '001'
    expect(padVariant(0, 3)).toBe('001');
  });

  it('pads max value', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.99);
    // floor(0.99*3)+1 = 3 → '003'
    expect(padVariant(0, 3)).toBe('003');
  });
});
