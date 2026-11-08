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

describe('boot sequence: WAITING → APPEARING → WAVING → IDLE', () => {
  it('starts in waiting state', () => {
    const actor = createRawActor();
    expectState(actor, 'waiting');
    expect(getContext(actor).library).toBeNull();
    expect(getContext(actor).hasAppeared).toBe(false);
  });

  it('LIBRARY_LOADED → appearing', () => {
    const actor = createRawActor();
    actor.send({
      type: 'LIBRARY_LOADED',
      library: mockAnimLibrary,
      voiceLib: mockVoiceLibrary,
      transcriptions: mockTranscriptions,
    });

    expectState(actor, 'appearing');
    expect(getContext(actor).library).toBe(mockAnimLibrary);
    expect(getContext(actor).hasAppeared).toBe(true);
    expect(getContext(actor).hasGreeted).toBe(true);
    // Channel greeting should be speaking
    expectSpeaking(actor);
  });

  it('appear VIDEO_ENDED → waving with greeting', () => {
    const actor = createRawActor();
    actor.send({
      type: 'LIBRARY_LOADED',
      library: mockAnimLibrary,
      voiceLib: mockVoiceLibrary,
      transcriptions: mockTranscriptions,
    });
    actor.send({ type: 'VIDEO_ENDED' });

    expectState(actor, 'waving');
  });

  it('wave VIDEO_ENDED while speaking → talking', () => {
    const actor = createRawActor();
    actor.send({
      type: 'LIBRARY_LOADED',
      library: mockAnimLibrary,
      voiceLib: mockVoiceLibrary,
      transcriptions: mockTranscriptions,
    });
    // appearing → waving
    actor.send({ type: 'VIDEO_ENDED' });
    // Still speaking (greeting hasn't ended), wave ends → talking
    actor.send({ type: 'VIDEO_ENDED' });

    expectState(actor, 'talking');
    expectSpeaking(actor);
  });

  it('wave → talking → AUDIO_ENDED → idle (speech lingers)', () => {
    // AUDIO_ENDED in waving does NOT clear isSpeaking, so VIDEO_ENDED
    // always routes to talking. Idle is reached via talking's AUDIO_ENDED.
    // The machine intentionally keeps speech text visible (30s linger in real app).
    const actor = createRawActor();
    actor.send({
      type: 'LIBRARY_LOADED',
      library: mockAnimLibrary,
      voiceLib: mockVoiceLibrary,
      transcriptions: mockTranscriptions,
    });
    actor.send({ type: 'VIDEO_ENDED' }); // → waving
    actor.send({ type: 'VIDEO_ENDED' }); // → talking (isSpeaking=true)
    expectState(actor, 'talking');
    actor.send({ type: 'AUDIO_ENDED' }); // → idle (speech lingers)

    expectState(actor, 'idle');
    // Speech text still visible until SPEECH_LINGER_DONE
    expectSpeaking(actor);

    actor.send({ type: 'SPEECH_LINGER_DONE' });
    expectSilent(actor);
  });

  it('MODEL_SELECTED while waiting → appearing', () => {
    const actor = createRawActor();
    actor.send({ type: 'MODEL_SELECTED', modelId: 'model-a' });

    expectState(actor, 'appearing');
    expect(getContext(actor).currentModelId).toBe('model-a');
  });

  it('MODEL_SELECTED during appearing → tracks model', () => {
    const actor = createRawActor();
    actor.send({
      type: 'LIBRARY_LOADED',
      library: mockAnimLibrary,
      voiceLib: mockVoiceLibrary,
      transcriptions: mockTranscriptions,
    });
    expectState(actor, 'appearing');

    actor.send({ type: 'MODEL_SELECTED', modelId: 'model-b' });
    expectState(actor, 'appearing'); // stays in appearing
    expect(getContext(actor).currentModelId).toBe('model-b');
  });

  it('initial context has correct defaults', () => {
    const actor = createRawActor();
    const ctx = getContext(actor);

    expect(ctx.videoSrcA).toBe('');
    expect(ctx.videoSrcB).toBe('');
    expect(ctx.activeSlot).toBe('A');
    expect(ctx.isLooping).toBe(false);
    expect(ctx.currentAnimCategory).toBeNull();
    expect(ctx.isSpeaking).toBe(false);
    expect(ctx.currentSpeechText).toBe('');
    expect(ctx.speechEnabled).toBe(true);
    expect(ctx.isHelpSpeaking).toBe(false);
    expect(ctx.pendingAudioSrc).toBeNull();
    expect(ctx.pendingAudioAction).toBeNull();
    expect(ctx.systemMessage).toBeNull();
    expect(ctx.modelCardsGlow).toBe(false);
    expect(ctx.onboardingStep).toBeNull(); // skipOnboarding=true by default
    expect(ctx.pendingModelId).toBeNull();
    expect(ctx.currentModelId).toBeNull();
    expect(ctx.pendingModelCommentary).toBeNull();
    expect(ctx.pendingFollowUp).toBeNull();
  });

  it('skipOnboarding=false starts with INTRO step', () => {
    const actor = createRawActor({ skipOnboarding: false });
    expect(getContext(actor).onboardingStep).toBe('INTRO');
  });
});
