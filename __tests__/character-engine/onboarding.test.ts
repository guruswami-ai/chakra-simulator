import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  createRawActor,
  mockAnimLibrary,
  mockVoiceLibrary,
  mockTranscriptions,
  expectState,
  expectSpeaking,
  expectSilent,
  getContext,
} from './helpers';

beforeEach(() => {
  vi.spyOn(Math, 'random').mockReturnValue(0.5);
});

/**
 * Advance a raw onboarding actor to talking state.
 * LIBRARY_LOADED → appearing → waving → talking (greeting still playing, step=INTRO)
 */
function advanceOnboardingToTalking(actor: ReturnType<typeof createRawActor>) {
  actor.send({
    type: 'LIBRARY_LOADED',
    library: mockAnimLibrary,
    voiceLib: mockVoiceLibrary,
    transcriptions: mockTranscriptions,
  });
  actor.send({ type: 'VIDEO_ENDED' }); // appearing → waving
  actor.send({ type: 'VIDEO_ENDED' }); // waving → talking
}

describe('onboarding wizard', () => {
  // ── Initial state ───────────────────────────────────────────────

  it('starts with INTRO step', () => {
    const actor = createRawActor({ skipOnboarding: false });
    expect(getContext(actor).onboardingStep).toBe('INTRO');
  });

  it('skip onboarding sets step to null', () => {
    const actor = createRawActor({ skipOnboarding: true });
    expect(getContext(actor).onboardingStep).toBeNull();
  });

  // ── Boot sequence with onboarding ───────────────────────────────

  it('LIBRARY_LOADED during onboarding → appearing with greeting', () => {
    const actor = createRawActor({ skipOnboarding: false });
    actor.send({
      type: 'LIBRARY_LOADED',
      library: mockAnimLibrary,
      voiceLib: mockVoiceLibrary,
      transcriptions: mockTranscriptions,
    });
    expectState(actor, 'appearing');
    expectSpeaking(actor);
  });

  it('appear → wave → talking during onboarding', () => {
    const actor = createRawActor({ skipOnboarding: false });
    advanceOnboardingToTalking(actor);
    expectState(actor, 'talking');
  });

  it('AUDIO_ENDED during onboarding stays in talking (adapter handles)', () => {
    const actor = createRawActor({ skipOnboarding: false });
    advanceOnboardingToTalking(actor);

    // AUDIO_ENDED with isOnboarding guard → stays in talking
    actor.send({ type: 'AUDIO_ENDED' });
    expectState(actor, 'talking');
  });

  it('step is INTRO after library load (not auto-advanced)', () => {
    const actor = createRawActor({ skipOnboarding: false });
    advanceOnboardingToTalking(actor);
    expect(getContext(actor).onboardingStep).toBe('INTRO');
  });

  // ── INTRO → INTRO_CLUSTER ──────────────────────────────────────

  it('ONBOARDING_SPEECH_DONE with INTRO → advances to INTRO_CLUSTER', () => {
    const actor = createRawActor({ skipOnboarding: false });
    advanceOnboardingToTalking(actor);

    actor.send({ type: 'ONBOARDING_SPEECH_DONE' });
    expectState(actor, 'talking');
    expect(getContext(actor).onboardingStep).toBe('INTRO_CLUSTER');
    expectSpeaking(actor, 'Welcome to the cluster');
  });

  // ── INTRO_CLUSTER → PICK_MODEL ─────────────────────────────────

  it('ONBOARDING_SPEECH_DONE with INTRO_CLUSTER → advances to PICK_MODEL', () => {
    const actor = createRawActor({ skipOnboarding: false });
    advanceOnboardingToTalking(actor);

    actor.send({ type: 'ONBOARDING_SPEECH_DONE' }); // INTRO → INTRO_CLUSTER
    actor.send({ type: 'ONBOARDING_SPEECH_DONE' }); // INTRO_CLUSTER → PICK_MODEL
    expectState(actor, 'talking');
    expect(getContext(actor).onboardingStep).toBe('PICK_MODEL');
    expect(getContext(actor).modelCardsGlow).toBe(true);
    expectSpeaking(actor, 'Pick a model');
  });

  // ── PICK_MODEL → model selected → PICK_QUANT ──────────────────

  it('PICK_MODEL speech done → idle (waiting for user selection)', () => {
    const actor = createRawActor({ skipOnboarding: false });
    advanceOnboardingToTalking(actor);

    actor.send({ type: 'ONBOARDING_SPEECH_DONE' }); // INTRO → INTRO_CLUSTER
    actor.send({ type: 'ONBOARDING_SPEECH_DONE' }); // INTRO_CLUSTER → PICK_MODEL
    actor.send({ type: 'ONBOARDING_SPEECH_DONE' }); // PICK_MODEL → fallback → idle
    expectState(actor, 'idle');
    expect(getContext(actor).onboardingStep).toBe('PICK_MODEL');
  });

  it('MODEL_SELECTED during PICK_MODEL from idle → talking with PICK_QUANT', () => {
    const actor = createRawActor({ skipOnboarding: false });
    advanceOnboardingToTalking(actor);

    actor.send({ type: 'ONBOARDING_SPEECH_DONE' }); // INTRO → INTRO_CLUSTER
    actor.send({ type: 'ONBOARDING_SPEECH_DONE' }); // INTRO_CLUSTER → PICK_MODEL
    actor.send({ type: 'ONBOARDING_SPEECH_DONE' }); // PICK_MODEL → idle

    actor.send({ type: 'MODEL_SELECTED', modelId: 'model-a' });
    expectState(actor, 'talking');
    expect(getContext(actor).currentModelId).toBe('model-a');
    expect(getContext(actor).onboardingStep).toBe('PICK_QUANT');
    expect(getContext(actor).modelCardsGlow).toBe(false);
  });

  // ── PICK_QUANT → quantization selected → PICK_TOPOLOGY ────────

  it('quant selection from talking during PICK_QUANT → advances to PICK_TOPOLOGY', () => {
    const actor = createRawActor({ skipOnboarding: false });
    advanceOnboardingToTalking(actor);

    actor.send({ type: 'ONBOARDING_SPEECH_DONE' }); // INTRO → INTRO_CLUSTER
    actor.send({ type: 'ONBOARDING_SPEECH_DONE' }); // INTRO_CLUSTER → PICK_MODEL
    actor.send({ type: 'ONBOARDING_SPEECH_DONE' }); // PICK_MODEL → idle
    actor.send({ type: 'MODEL_SELECTED', modelId: 'model-a' }); // → talking (PICK_QUANT)

    // User selects quant while prompt is playing (from talking state)
    actor.send({ type: 'PARAMETER_CHANGED', paramType: 'quantization', value: 'Q4' });
    expectState(actor, 'talking');
    expect(getContext(actor).onboardingStep).toBe('PICK_TOPOLOGY');
  });

  it('quant selection from idle during PICK_QUANT → also works', () => {
    const actor = createRawActor({ skipOnboarding: false });
    advanceOnboardingToTalking(actor);

    actor.send({ type: 'ONBOARDING_SPEECH_DONE' }); // INTRO → INTRO_CLUSTER
    actor.send({ type: 'ONBOARDING_SPEECH_DONE' }); // INTRO_CLUSTER → PICK_MODEL
    actor.send({ type: 'ONBOARDING_SPEECH_DONE' }); // PICK_MODEL → idle
    actor.send({ type: 'MODEL_SELECTED', modelId: 'model-a' }); // → talking (PICK_QUANT)
    actor.send({ type: 'ONBOARDING_SPEECH_DONE' }); // plays pending PICK_QUANT prompt
    actor.send({ type: 'ONBOARDING_SPEECH_DONE' }); // no pending → fallback → idle

    // User selects quant from idle
    actor.send({ type: 'PARAMETER_CHANGED', paramType: 'quantization', value: 'Q4' });
    expectState(actor, 'talking');
    expect(getContext(actor).onboardingStep).toBe('PICK_TOPOLOGY');
  });

  // ── Regression: PICK_QUANT/PICK_TOPOLOGY prompt must not loop ──

  it('PICK_QUANT prompt plays once then falls to idle (no infinite loop)', () => {
    const actor = createRawActor({ skipOnboarding: false, speechEnabled: true });
    advanceOnboardingToTalking(actor);

    actor.send({ type: 'ONBOARDING_SPEECH_DONE' }); // INTRO → INTRO_CLUSTER
    actor.send({ type: 'ONBOARDING_SPEECH_DONE' }); // INTRO_CLUSTER → PICK_MODEL
    actor.send({ type: 'ONBOARDING_SPEECH_DONE' }); // PICK_MODEL → idle
    actor.send({ type: 'MODEL_SELECTED', modelId: 'model-a' }); // → talking (PICK_QUANT)

    // Pending quant prompt plays
    actor.send({ type: 'ONBOARDING_SPEECH_DONE' });
    expectState(actor, 'talking');
    expectSpeaking(actor, 'Choose quantisation');
    expect(getContext(actor).pendingAudioSrc).toContain('pick_quant');

    // Next ONBOARDING_SPEECH_DONE must NOT replay — falls to idle
    actor.send({ type: 'ONBOARDING_SPEECH_DONE' });
    expectState(actor, 'idle');
    expect(getContext(actor).onboardingStep).toBe('PICK_QUANT');
  });

  it('PICK_TOPOLOGY prompt plays once then falls to idle (no infinite loop)', () => {
    const actor = createRawActor({ skipOnboarding: false, speechEnabled: true });
    advanceOnboardingToTalking(actor);

    actor.send({ type: 'ONBOARDING_SPEECH_DONE' }); // INTRO → INTRO_CLUSTER
    actor.send({ type: 'ONBOARDING_SPEECH_DONE' }); // INTRO_CLUSTER → PICK_MODEL
    actor.send({ type: 'ONBOARDING_SPEECH_DONE' }); // PICK_MODEL → idle
    actor.send({ type: 'MODEL_SELECTED', modelId: 'model-a' }); // → PICK_QUANT
    actor.send({ type: 'PARAMETER_CHANGED', paramType: 'quantization', value: 'Q4' }); // → PICK_TOPOLOGY

    // Pending topology prompt plays
    actor.send({ type: 'ONBOARDING_SPEECH_DONE' });
    expectState(actor, 'talking');
    expectSpeaking(actor, 'Pick a topology');
    expect(getContext(actor).pendingAudioSrc).toContain('pick_topo');

    // Next ONBOARDING_SPEECH_DONE must NOT replay — falls to idle
    actor.send({ type: 'ONBOARDING_SPEECH_DONE' });
    expectState(actor, 'idle');
    expect(getContext(actor).onboardingStep).toBe('PICK_TOPOLOGY');
  });

  // ── PICK_TOPOLOGY → topology selected → reactingYes ───────────

  it('topology selection from talking during PICK_TOPOLOGY → reactingYes', () => {
    const actor = createRawActor({ skipOnboarding: false });
    advanceOnboardingToTalking(actor);

    actor.send({ type: 'ONBOARDING_SPEECH_DONE' }); // INTRO → INTRO_CLUSTER
    actor.send({ type: 'ONBOARDING_SPEECH_DONE' }); // INTRO_CLUSTER → PICK_MODEL
    actor.send({ type: 'ONBOARDING_SPEECH_DONE' }); // PICK_MODEL → idle
    actor.send({ type: 'MODEL_SELECTED', modelId: 'model-a' }); // → talking (PICK_QUANT)
    actor.send({ type: 'PARAMETER_CHANGED', paramType: 'quantization', value: 'Q4' }); // → talking (PICK_TOPOLOGY)

    // User selects topology while prompt is playing
    actor.send({ type: 'PARAMETER_CHANGED', paramType: 'topology', value: 'TP4_RDMA' });
    expectState(actor, 'reactingYes');
    expect(getContext(actor).onboardingStep).toBe('LOADING');
  });

  // ── Tour progression ─────────────────────────────────────────────

  /**
   * Helper: advance through onboarding to talking state with LOADING step,
   * ready for tour to start via ONBOARDING_SPEECH_DONE.
   */
  function advanceToTourReady(actor: ReturnType<typeof createRawActor>) {
    advanceOnboardingToTalking(actor);
    actor.send({ type: 'ONBOARDING_SPEECH_DONE' }); // INTRO → INTRO_CLUSTER
    actor.send({ type: 'ONBOARDING_SPEECH_DONE' }); // INTRO_CLUSTER → PICK_MODEL
    actor.send({ type: 'ONBOARDING_SPEECH_DONE' }); // PICK_MODEL → idle
    actor.send({ type: 'MODEL_SELECTED', modelId: 'model-a' }); // → talking (PICK_QUANT)
    actor.send({ type: 'PARAMETER_CHANGED', paramType: 'quantization', value: 'Q4' }); // → PICK_TOPOLOGY
    actor.send({ type: 'PARAMETER_CHANGED', paramType: 'topology', value: 'TP4_RDMA' }); // → reactingYes (LOADING)
    actor.send({ type: 'VIDEO_ENDED' }); // → idle
    // Get back to talking (needed for ONBOARDING_SPEECH_DONE handler)
    actor.send({ type: 'SPEAK', category: 'engagement' as any }); // → talking
  }

  it('LOADING speech done → starts tour at TOUR_TPS with audio', () => {
    const actor = createRawActor({ skipOnboarding: false, speechEnabled: true });
    advanceToTourReady(actor);

    actor.send({ type: 'ONBOARDING_SPEECH_DONE' }); // LOADING → startTour + playTourStep
    expectState(actor, 'talking');
    expect(getContext(actor).onboardingStep).toBe('TOUR_TPS');
    expectSpeaking(actor, 'This is TPS');
    expect(getContext(actor).pendingAudioSrc).toContain('tour_tps');
  });

  it('each tour step plays its audio clip (not just TOUR_TPS)', () => {
    const actor = createRawActor({ skipOnboarding: false, speechEnabled: true });
    advanceToTourReady(actor);
    actor.send({ type: 'ONBOARDING_SPEECH_DONE' }); // LOADING → TOUR_TPS

    // TOUR_TPS done → TOUR_TTFT (must play TTFT clip)
    actor.send({ type: 'ONBOARDING_SPEECH_DONE' });
    expect(getContext(actor).onboardingStep).toBe('TOUR_TTFT');
    expectSpeaking(actor, 'This is TTFT');
    expect(getContext(actor).pendingAudioSrc).toContain('tour_ttft');

    // TOUR_TTFT done → TOUR_LAYERS
    actor.send({ type: 'ONBOARDING_SPEECH_DONE' });
    expect(getContext(actor).onboardingStep).toBe('TOUR_LAYERS');
    expectSpeaking(actor, 'Layer split');
    expect(getContext(actor).pendingAudioSrc).toContain('tour_layers');

    // TOUR_LAYERS done → TOUR_MEMORY
    actor.send({ type: 'ONBOARDING_SPEECH_DONE' });
    expect(getContext(actor).onboardingStep).toBe('TOUR_MEMORY');
    expectSpeaking(actor, 'Memory usage');
    expect(getContext(actor).pendingAudioSrc).toContain('tour_memory');
  });

  it('TOUR_MEMORY done → tour complete → idle with speech cleared', () => {
    const actor = createRawActor({ skipOnboarding: false, speechEnabled: true });
    advanceToTourReady(actor);
    actor.send({ type: 'ONBOARDING_SPEECH_DONE' }); // LOADING → TOUR_TPS
    actor.send({ type: 'ONBOARDING_SPEECH_DONE' }); // → TOUR_TTFT
    actor.send({ type: 'ONBOARDING_SPEECH_DONE' }); // → TOUR_LAYERS
    actor.send({ type: 'ONBOARDING_SPEECH_DONE' }); // → TOUR_MEMORY
    actor.send({ type: 'ONBOARDING_SPEECH_DONE' }); // → complete

    expectState(actor, 'idle');
    expect(getContext(actor).onboardingStep).toBeNull();
    expect(getContext(actor).isSpeaking).toBe(false);
    expect(getContext(actor).currentSpeechText).toBe('');
  });

  // ── PARAMETER_CHANGED quantization non-onboarding ──────────────

  it('PARAMETER_CHANGED quantization non-onboarding → talking', () => {
    const actor = createRawActor({ skipOnboarding: true });
    actor.send({
      type: 'LIBRARY_LOADED',
      library: mockAnimLibrary,
      voiceLib: mockVoiceLibrary,
      transcriptions: mockTranscriptions,
    });
    actor.send({ type: 'VIDEO_ENDED' }); // → waving
    actor.send({ type: 'VIDEO_ENDED' }); // → talking
    actor.send({ type: 'AUDIO_ENDED' }); // → idle

    actor.send({ type: 'PARAMETER_CHANGED', paramType: 'quantization', value: 'Q4' });
    expectState(actor, 'talking');
  });

  // ── Mode changes ───────────────────────────────────────────────

  it('MODE_CHANGED(SIM) does NOT cancel onboarding (LIVE removed)', () => {
    const actor = createRawActor({ skipOnboarding: false });
    expect(getContext(actor).onboardingStep).toBe('INTRO');

    actor.send({ type: 'MODE_CHANGED', mode: 'SIM' });
    expect(getContext(actor).onboardingStep).toBe('INTRO');
  });

  it('MODE_CHANGED(GAME) does NOT cancel onboarding', () => {
    const actor = createRawActor({ skipOnboarding: false });
    actor.send({ type: 'MODE_CHANGED', mode: 'GAME' });
    expect(getContext(actor).onboardingStep).toBe('INTRO');
  });

  it('MODE_CHANGED(SIM) does NOT cancel onboarding', () => {
    const actor = createRawActor({ skipOnboarding: false });
    actor.send({ type: 'MODE_CHANGED', mode: 'SIM' });
    expect(getContext(actor).onboardingStep).toBe('INTRO');
  });

  // ── Config ─────────────────────────────────────────────────────

  it('tour clips and prompts config exists', () => {
    const actor = createRawActor({ skipOnboarding: true });
    const cfg = getContext(actor).config;
    expect(cfg.tourClips.TOUR_TPS).toBeDefined();
    expect(cfg.tourClips.TOUR_TTFT).toBeDefined();
    expect(cfg.tourClips.TOUR_LAYERS).toBeDefined();
    expect(cfg.tourClips.TOUR_MEMORY).toBeDefined();
    expect(cfg.onboardingPrompts.TOUR_TPS).toBeDefined();
    expect(cfg.onboardingPrompts.TOUR_MEMORY).toBeDefined();
  });
});
