/**
 * Shared test infrastructure for character engine tests.
 *
 * Provides:
 * - Minimal mock CharacterConfig (no MODEL_CATALOG dependency)
 * - Mock AnimLibrary, VoiceLibrary, transcriptions
 * - createTestActor() — started actor with libraries pre-loaded, at idle
 * - createRawActor() — started actor in 'waiting' (no libraries)
 * - advanceToIdle() / advanceToTalking() — fast-forward helpers
 */
import { createActor, type Actor } from 'xstate';
import { characterMachine } from '../../character-engine/machine';
import type {
  CharacterConfig,
  AnimLibrary,
  VoiceLibrary,
  MachineContext,
  MachineEvent,
  AnimCategory,
  VoiceCategory,
} from '../../character-engine/types';

// ── Minimal mock config ─────────────────────────────────────────

export const mockConfig: CharacterConfig = {
  id: 'test-guru',
  voiceBasePath: '/voice/',
  videoBasePath: '/video/',
  animLibraryUrl: '/anim-lib.json',
  voiceLibraryUrl: '/voice-lib.json',
  transcriptionsUrl: '/transcriptions.json',
  modelVoicePrefixes: {
    'model-a': 'gs_model_a',
    'model-b': 'gs_model_b',
  },
  modelFarewellPrefixes: {
    'model-a': 'gs_farewell_a',
    'model-b': 'gs_farewell_b',
  },
  modelGreetingPrefixes: {
    'model-a': 'gs_greeting_a',
    'model-b': 'gs_greeting_b',
  },
  musicCommentaryPrefixes: {
    'model-a': { dir: 'music_commentary_a', prefix: 'gs_music_a' },
    'model-b': { dir: 'music_commentary_b', prefix: 'gs_music_b' },
  },
  modelVoiceVariants: 3,
  modelFarewellVariants: 3,
  modelGreetingVariants: 3,
  musicCommentaryVariants: 3,
  quantVoicePrefix: {
    'Q4': { prefix: 'gs_quant_q4', variants: 2 },
    'Q8': { prefix: 'gs_quant_q8', variants: 2 },
    'Q2': { prefix: 'gs_quant_q2', variants: 2 },
  },
  contextVoicePrefix: {
    4096: { prefix: 'gs_context_4k', variants: 2 },
    8192: { prefix: 'gs_context_8k', variants: 2 },
  },
  batchVoicePrefix: {
    'true':  { prefix: 'gs_batch_on',  variants: 2 },
    'false': { prefix: 'gs_batch_off', variants: 2 },
  },
  topologyVoiceMap: {
    'TP4_RDMA': { dir: 'topology_commentary', prefix: 'gs_topo_tp4', variants: 2 },
    'SINGLE':   { dir: 'topology_commentary', prefix: 'gs_topo_single', variants: 2 },
  },
  errors: {
    OOM_CRASH: {
      id: 'OOM_CRASH',
      guru: 'The glass overflows.',
      system: '[ERR_OOM]',
      severity: 'error',
    },
    SUBOPTIMAL: {
      id: 'SUBOPTIMAL',
      guru: 'Not ideal.',
      system: '[WARN_SUBOPTIMAL]',
      severity: 'warning',
    },
    Q2_HALLUCINATION: {
      id: 'Q2_HALLUCINATION',
      guru: 'Shadows of truth.',
      system: '[WARN_Q2]',
      severity: 'warning',
    },
  },
  detailedHelp: {
    topology: { text: 'Topology distributes model layers.', voiceFile: 'hover_tip/gs_hover_topology_001.m4a' },
    quant: { text: 'Quantization compresses weights.' },
  },
  channelGreetings: ['Hello nerdburger.'],
  onboardingPrompts: {
    INTRO_GREETING: 'Hi, my name is Guruswami.',
    INTRO_HELP: 'I need your help.',
    INTRO_ROLE: 'I will sit here.',
    INTRO_CONTROLS: 'Here are the controls.',
    INTRO_CLUSTER: 'Hi, my name is Guruswami.',
    PICK_MODEL: 'Pick a model.',
    PICK_QUANT: 'Choose quantisation.',
    PICK_CONTEXT: 'Pick context size.',
    PICK_TOPOLOGY: 'Pick a topology.',
    LOADING: 'Model loaded.',
    TOUR_TPS: 'This is TPS.',
    TOUR_NODE: 'Only one node active.',
    TOUR_TTFT: 'This is TTFT.',
    TOUR_LAYERS: 'Layer split.',
    TOUR_MEMORY: 'Memory usage.',
    TRY_BREAK: 'Click TP5.',
    EXPLAIN_BREAK: 'Cluster crashed.',
    TRY_EP5: 'Click EP5.',
    EXPLAIN_EP5: 'Five copies running.',
    FREEPLAY: 'Experiment freely.',
    TRY_CLICK_GURU: 'Click my sphere.',
    REWARD_INTRO: 'You earned a reward.',
    COMPLETE: 'Click a model to continue.',
  },
  onboardingHints: {
    PICK_MODEL: 'Click a model card.',
    PICK_QUANT: 'Click a quant button.',
    PICK_CONTEXT: 'Click 1K.',
    PICK_TOPOLOGY: 'Click EP1.',
    TRY_BREAK: 'Click TP5.',
    TRY_EP5: 'Click EP5.',
    TRY_CLICK_GURU: 'Click my sphere.',
  },
  tutorialRecommended: { PICK_MODEL: 'model-a' },
  challenges: [],
  onboardingClips: {
    INTRO_CLUSTER: 'onboarding/cluster_001.m4a',
    PICK_MODEL: 'onboarding/pick_model_001.m4a',
    PICK_QUANT: 'onboarding/pick_quant_001.m4a',
    PICK_TOPOLOGY: 'onboarding/pick_topo_001.m4a',
    LOADING: 'onboarding/complete_001.m4a',
  },
  tourClips: {
    TOUR_TPS: 'onboarding/tour_tps_001.m4a',
    TOUR_TTFT: 'onboarding/tour_ttft_001.m4a',
    TOUR_LAYERS: 'onboarding/tour_layers_001.m4a',
    TOUR_MEMORY: 'onboarding/tour_memory_001.m4a',
  },
  getModelCommentary: (id) => `Commentary for ${id}.`,
  getQuantCommentary: (q, _m) => `Quant ${q} commentary.`,
  getContextCommentary: (t) => `Context ${t} commentary.`,
  getBatchCommentary: (e) => e ? 'Batch on.' : 'Batch off.',
  getTopologyCommentary: (t) => `Topology ${t} commentary.`,
};

// ── Mock libraries ──────────────────────────────────────────────

export const mockAnimLibrary: AnimLibrary = {
  categories: Object.fromEntries(
    (['appear', 'idle', 'talk', 'think', 'wave', 'listen', 'yes', 'no', 'disappear'] as AnimCategory[]).map(
      (cat) => [cat, { loop: !['appear', 'disappear', 'wave', 'yes', 'no'].includes(cat), files: [`${cat}_001.mp4`] }]
    )
  ) as AnimLibrary['categories'],
};

export const mockVoiceLibrary: VoiceLibrary = Object.fromEntries(
  (['greeting', 'wake', 'wisdom', 'thinking', 'filler', 'affirmation', 'encouragement',
    'processing', 'error', 'engagement', 'acknowledgment', 'goodbye', 'question_responses'] as VoiceCategory[]).map(
    (cat) => [cat, [`gs_${cat}_test-phrase_001.m4a`]]
  )
) as VoiceLibrary;

export const mockTranscriptions: Record<string, string> = {
  'greeting/gs_greeting_test-phrase_001.m4a': 'Hello there!',
  'wisdom/gs_wisdom_test-phrase_001.m4a': 'The journey continues.',
  'error/gs_error_test-phrase_001.m4a': 'Something went wrong.',
  'question_responses/gs_question_responses_test-phrase_001.m4a': 'What do you think?',
  'goodbye/gs_goodbye_test-phrase_001.m4a': 'Until next time.',
};

// ── Actor type alias ────────────────────────────────────────────

export type TestActor = Actor<typeof characterMachine>;

// ── Factory functions ───────────────────────────────────────────

interface CreateActorOptions {
  skipOnboarding?: boolean;
  speechEnabled?: boolean;
  config?: CharacterConfig;
}

/** Create a started actor in 'waiting' state (no libraries loaded). */
export function createRawActor(opts: CreateActorOptions = {}): TestActor {
  const actor = createActor(characterMachine, {
    input: {
      config: opts.config ?? mockConfig,
      skipOnboarding: opts.skipOnboarding ?? true,
      speechEnabled: opts.speechEnabled ?? true,
    },
  });
  actor.start();
  return actor;
}

/** Create a started actor with libraries loaded, advanced to idle state. */
export function createTestActor(opts: CreateActorOptions = {}): TestActor {
  const actor = createRawActor(opts);
  advanceToIdle(actor);
  return actor;
}

// ── Fast-forward helpers ────────────────────────────────────────

/**
 * Advance to idle state with speech fully cleared.
 *
 * The correct path is:
 *   LIBRARY_LOADED      → appearing (channel greeting starts, isSpeaking=true)
 *   VIDEO_ENDED         → waving    (no model = no pending commentary)
 *   VIDEO_ENDED         → talking   (isSpeaking guard routes here)
 *   AUDIO_ENDED         → idle      (no pending chains, but isSpeaking lingers!)
 *   SPEECH_LINGER_DONE  → clears lingering speech text
 *
 * The machine intentionally keeps speech text visible after audio ends (30s linger
 * in the real app). SPEECH_LINGER_DONE is what the adapter sends after the timer.
 */
export function advanceToIdle(actor: TestActor): void {
  actor.send({
    type: 'LIBRARY_LOADED',
    library: mockAnimLibrary,
    voiceLib: mockVoiceLibrary,
    transcriptions: mockTranscriptions,
  });
  // appearing → waving
  actor.send({ type: 'VIDEO_ENDED' });
  // waving → talking (isSpeaking=true from greeting)
  actor.send({ type: 'VIDEO_ENDED' });
  // talking AUDIO_ENDED → idle (no pending commentary/follow-up, text lingers)
  actor.send({ type: 'AUDIO_ENDED' });
  // Clear lingering speech
  actor.send({ type: 'SPEECH_LINGER_DONE' });
}

/** Advance to 'talking' state (greeting still playing). */
export function advanceToTalking(actor: TestActor): void {
  actor.send({
    type: 'LIBRARY_LOADED',
    library: mockAnimLibrary,
    voiceLib: mockVoiceLibrary,
    transcriptions: mockTranscriptions,
  });
  // appearing → waving
  actor.send({ type: 'VIDEO_ENDED' });
  // waving → talking (isSpeaking is true from greeting)
  actor.send({ type: 'VIDEO_ENDED' });
}

// ── Assertion helpers ───────────────────────────────────────────

export function getState(actor: TestActor): string {
  return actor.getSnapshot().value as string;
}

export function getContext(actor: TestActor): MachineContext {
  return actor.getSnapshot().context;
}

export function expectState(actor: TestActor, expected: string): void {
  expect(getState(actor)).toBe(expected);
}

export function expectSpeaking(actor: TestActor, textContains?: string): void {
  const ctx = getContext(actor);
  expect(ctx.isSpeaking).toBe(true);
  if (textContains) {
    expect(ctx.currentSpeechText).toContain(textContains);
  }
}

export function expectSilent(actor: TestActor): void {
  expect(getContext(actor).isSpeaking).toBe(false);
}
