import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  createTestActor,
  expectState,
  expectSpeaking,
  getContext,
} from './helpers';

beforeEach(() => {
  vi.spyOn(Math, 'random').mockReturnValue(0.5);
});

describe('speech chaining: greeting → commentary → follow-up', () => {
  it('model greeting sets pendingModelCommentary', () => {
    const actor = createTestActor();
    actor.send({ type: 'MODEL_SELECTED', modelId: 'model-a' });
    // appearing → waving, playModelGreeting fires
    actor.send({ type: 'VIDEO_ENDED' });
    // model-a has greeting prefix AND commentary prefix → pendingModelCommentary set
    expect(getContext(actor).pendingModelCommentary).toBe('model-a');
  });

  it('AUDIO_ENDED after greeting → plays pending commentary', () => {
    const actor = createTestActor();
    actor.send({ type: 'MODEL_SELECTED', modelId: 'model-a' });
    actor.send({ type: 'VIDEO_ENDED' }); // appear → wave
    actor.send({ type: 'VIDEO_ENDED' }); // wave → talking (greeting playing)

    // Greeting ends → hasPendingCommentary guard fires
    actor.send({ type: 'AUDIO_ENDED' });
    expectState(actor, 'talking');
    expectSpeaking(actor, 'Commentary for model-a');
    expect(getContext(actor).pendingModelCommentary).toBeNull();
  });

  it('commentary AUDIO_ENDED without follow-up → idle', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.8); // no follow-up

    const actor = createTestActor();
    actor.send({ type: 'MODEL_SELECTED', modelId: 'model-a' });
    actor.send({ type: 'VIDEO_ENDED' }); // appear → wave
    actor.send({ type: 'VIDEO_ENDED' }); // wave → talking

    actor.send({ type: 'AUDIO_ENDED' }); // greeting → commentary
    actor.send({ type: 'AUDIO_ENDED' }); // commentary → idle (no follow-up)
    expectState(actor, 'idle');
  });

  it('commentary AUDIO_ENDED with follow-up → plays follow-up', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.2); // < 0.4 → follow-up

    const actor = createTestActor();
    // Get to talking with pending follow-up from topology commentary
    actor.send({ type: 'PARAMETER_CHANGED', paramType: 'topology', value: 'TP4_RDMA' });
    actor.send({ type: 'PARAMETER_CHANGED', paramType: 'topology', value: 'TP4_RDMA' }); // → talking
    expectState(actor, 'talking');
    expect(getContext(actor).pendingFollowUp).toBe('question_responses');

    // Commentary ends → follow-up plays
    actor.send({ type: 'AUDIO_ENDED' });
    expectState(actor, 'talking');
    expect(getContext(actor).pendingFollowUp).toBeNull();
  });

  it('follow-up AUDIO_ENDED → idle', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.2);

    const actor = createTestActor();
    actor.send({ type: 'PARAMETER_CHANGED', paramType: 'topology', value: 'TP4_RDMA' });
    actor.send({ type: 'PARAMETER_CHANGED', paramType: 'topology', value: 'TP4_RDMA' }); // talking

    actor.send({ type: 'AUDIO_ENDED' }); // commentary → follow-up
    expectState(actor, 'talking');

    actor.send({ type: 'AUDIO_ENDED' }); // follow-up → idle
    expectState(actor, 'idle');
  });

  it('no follow-up → AUDIO_ENDED goes directly to idle', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.8); // >= 0.4 → no follow-up

    const actor = createTestActor();
    actor.send({ type: 'PARAMETER_CHANGED', paramType: 'topology', value: 'TP4_RDMA' });
    actor.send({ type: 'PARAMETER_CHANGED', paramType: 'topology', value: 'TP4_RDMA' }); // talking
    expect(getContext(actor).pendingFollowUp).toBeNull();

    actor.send({ type: 'AUDIO_ENDED' });
    expectState(actor, 'idle');
  });

  it('SILENT_SPEECH_DONE chains same as AUDIO_ENDED', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.2);

    const actor = createTestActor({ speechEnabled: false });
    actor.send({ type: 'PARAMETER_CHANGED', paramType: 'topology', value: 'TP4_RDMA' });
    actor.send({ type: 'PARAMETER_CHANGED', paramType: 'topology', value: 'TP4_RDMA' }); // talking

    // SILENT_SPEECH_DONE replaces AUDIO_ENDED when speech disabled
    actor.send({ type: 'SILENT_SPEECH_DONE' });
    expectState(actor, 'talking'); // follow-up plays
    expect(getContext(actor).pendingFollowUp).toBeNull();

    actor.send({ type: 'SILENT_SPEECH_DONE' });
    expectState(actor, 'idle');
  });
});
