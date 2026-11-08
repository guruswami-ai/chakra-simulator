import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  createTestActor,
  advanceToTalking,
  createRawActor,
  mockAnimLibrary,
  mockVoiceLibrary,
  mockTranscriptions,
  expectState,
  expectSpeaking,
  getContext,
} from './helpers';

beforeEach(() => {
  vi.spyOn(Math, 'random').mockReturnValue(0.5);
});

/**
 * Load a model and advance back to idle.
 * Model greeting creates pendingModelCommentary, so we need 2 AUDIO_ENDED:
 *   AUDIO_ENDED #1 → plays pending commentary (stays talking)
 *   AUDIO_ENDED #2 → no more chains → idle
 *   SPEECH_LINGER_DONE → clear lingering text
 */
function loadModelToIdle(actor: ReturnType<typeof createTestActor>, modelId: string) {
  actor.send({ type: 'MODEL_SELECTED', modelId });
  actor.send({ type: 'VIDEO_ENDED' }); // appearing → waving (greeting + pending commentary)
  actor.send({ type: 'VIDEO_ENDED' }); // waving → talking
  actor.send({ type: 'AUDIO_ENDED' }); // greeting ends → plays pending commentary
  actor.send({ type: 'AUDIO_ENDED' }); // commentary ends → idle
  actor.send({ type: 'SPEECH_LINGER_DONE' }); // clear lingering text
}

describe('model switching', () => {
  it('first model from idle → appearing', () => {
    const actor = createTestActor();
    actor.send({ type: 'MODEL_SELECTED', modelId: 'model-a' });
    expectState(actor, 'appearing');
    expect(getContext(actor).currentModelId).toBe('model-a');
  });

  it('same model re-select → talking (replay commentary)', () => {
    const actor = createTestActor();
    loadModelToIdle(actor, 'model-a');

    // Re-select same model
    actor.send({ type: 'MODEL_SELECTED', modelId: 'model-a' });
    expectState(actor, 'talking');
    expectSpeaking(actor, 'Commentary for model-a');
  });

  it('different model from idle → disappearing with farewell', () => {
    const actor = createTestActor();
    loadModelToIdle(actor, 'model-a');

    // Switch to different model
    actor.send({ type: 'MODEL_SELECTED', modelId: 'model-b' });
    expectState(actor, 'disappearing');
    expect(getContext(actor).pendingModelId).toBe('model-b');
    expect(getContext(actor).currentModelId).toBe('model-a'); // not swapped yet
    expectSpeaking(actor); // farewell playing
  });

  it('disappear VIDEO_ENDED → appearing with pending model', () => {
    const actor = createTestActor();
    loadModelToIdle(actor, 'model-a');

    actor.send({ type: 'MODEL_SELECTED', modelId: 'model-b' });
    expectState(actor, 'disappearing');

    // Disappear video ends → reappear
    actor.send({ type: 'VIDEO_ENDED' });
    expectState(actor, 'appearing');
    expect(getContext(actor).currentModelId).toBe('model-b');
    expect(getContext(actor).pendingModelId).toBeNull();
  });

  it('model switch during talking → disappearing', () => {
    const actor = createRawActor();
    advanceToTalking(actor);
    expectState(actor, 'talking');

    // Talking with no currentModelId and no onboarding → isSameModel=false, last branch → disappearing
    actor.send({ type: 'MODEL_SELECTED', modelId: 'model-a' });
    expectState(actor, 'disappearing');
  });

  it('model switch during thinkingTopology → disappearing', () => {
    const actor = createTestActor();
    actor.send({ type: 'PARAMETER_CHANGED', paramType: 'topology', value: 'TP4_RDMA' });
    expectState(actor, 'thinkingTopology');

    actor.send({ type: 'MODEL_SELECTED', modelId: 'model-a' });
    expectState(actor, 'disappearing');
  });

  it('full switch cycle: idle → disappear → appear → wave → talking → idle', () => {
    const actor = createTestActor();
    loadModelToIdle(actor, 'model-a');
    expectState(actor, 'idle');

    // Switch model
    actor.send({ type: 'MODEL_SELECTED', modelId: 'model-b' });
    expectState(actor, 'disappearing');

    actor.send({ type: 'VIDEO_ENDED' }); // disappear → appear
    expectState(actor, 'appearing');
    expect(getContext(actor).currentModelId).toBe('model-b');

    actor.send({ type: 'VIDEO_ENDED' }); // appear → waving (greeting + pending commentary)
    expectState(actor, 'waving');

    actor.send({ type: 'VIDEO_ENDED' }); // waving → talking
    expectState(actor, 'talking');

    actor.send({ type: 'AUDIO_ENDED' }); // greeting → pending commentary
    expectState(actor, 'talking');

    actor.send({ type: 'AUDIO_ENDED' }); // commentary → idle
    expectState(actor, 'idle');
    expect(getContext(actor).currentModelId).toBe('model-b');
  });

  it('MODEL_SELECTED during waving → tracks model', () => {
    const actor = createRawActor();
    actor.send({
      type: 'LIBRARY_LOADED',
      library: mockAnimLibrary,
      voiceLib: mockVoiceLibrary,
      transcriptions: mockTranscriptions,
    });
    actor.send({ type: 'VIDEO_ENDED' }); // appearing → waving
    expectState(actor, 'waving');

    actor.send({ type: 'MODEL_SELECTED', modelId: 'model-a' });
    expectState(actor, 'waving'); // stays in waving
    expect(getContext(actor).currentModelId).toBe('model-a');
  });
});
