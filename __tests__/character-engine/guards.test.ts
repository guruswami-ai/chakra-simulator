import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  createTestActor,
  createRawActor,
  expectState,
  getContext,
} from './helpers';

beforeEach(() => {
  vi.spyOn(Math, 'random').mockReturnValue(0.5);
});

/** Load a model and advance back to idle (clears greeting → commentary chain). */
function loadModelToIdle(actor: ReturnType<typeof createTestActor>, modelId: string) {
  actor.send({ type: 'MODEL_SELECTED', modelId });
  actor.send({ type: 'VIDEO_ENDED' }); // appearing → waving (greeting + pending commentary)
  actor.send({ type: 'VIDEO_ENDED' }); // waving → talking
  actor.send({ type: 'AUDIO_ENDED' }); // greeting → plays pending commentary
  actor.send({ type: 'AUDIO_ENDED' }); // commentary → idle
  actor.send({ type: 'SPEECH_LINGER_DONE' }); // clear lingering text
}

describe('guards', () => {
  // ── isSpeechEnabled ───────────────────────────────────────────

  describe('isSpeechEnabled', () => {
    it('true when speechEnabled=true', () => {
      const actor = createTestActor({ speechEnabled: true });
      expect(getContext(actor).speechEnabled).toBe(true);
    });

    it('false when speechEnabled=false', () => {
      const actor = createTestActor({ speechEnabled: false });
      expect(getContext(actor).speechEnabled).toBe(false);
    });
  });

  // ── isLibraryLoaded ───────────────────────────────────────────

  describe('isLibraryLoaded', () => {
    it('false before LIBRARY_LOADED', () => {
      const actor = createRawActor();
      expect(getContext(actor).library).toBeNull();
    });

    it('true after LIBRARY_LOADED', () => {
      const actor = createTestActor();
      expect(getContext(actor).library).not.toBeNull();
    });
  });

  // ── isOnboarding / isNotOnboarding ────────────────────────────

  describe('isOnboarding / isNotOnboarding', () => {
    it('isOnboarding=true when skipOnboarding=false', () => {
      const actor = createRawActor({ skipOnboarding: false });
      expect(getContext(actor).onboardingStep).not.toBeNull();
    });

    it('isNotOnboarding=true when skipOnboarding=true', () => {
      const actor = createTestActor({ skipOnboarding: true });
      expect(getContext(actor).onboardingStep).toBeNull();
    });
  });

  // ── isSameModel / isFirstModel / hasModelId ───────────────────

  describe('model identity guards', () => {
    it('isFirstModel: no model loaded initially', () => {
      const actor = createTestActor();
      expect(getContext(actor).currentModelId).toBeNull();
    });

    it('hasModelId: true after model loaded to idle', () => {
      const actor = createTestActor();
      loadModelToIdle(actor, 'model-a');
      expect(getContext(actor).currentModelId).toBe('model-a');
    });

    it('isSameModel → replay commentary (not disappear)', () => {
      const actor = createTestActor();
      loadModelToIdle(actor, 'model-a');

      // Same model → talking (replay), NOT disappearing
      actor.send({ type: 'MODEL_SELECTED', modelId: 'model-a' });
      expectState(actor, 'talking');
    });
  });

  // ── hasPendingModel ───────────────────────────────────────────

  describe('hasPendingModel', () => {
    it('null initially', () => {
      const actor = createTestActor();
      expect(getContext(actor).pendingModelId).toBeNull();
    });

    it('set during model switch disappear', () => {
      const actor = createTestActor();
      loadModelToIdle(actor, 'model-a');

      // Switch to different model → disappearing
      actor.send({ type: 'MODEL_SELECTED', modelId: 'model-b' });
      expectState(actor, 'disappearing');
      expect(getContext(actor).pendingModelId).toBe('model-b');
    });
  });

  // ── isSpeaking / isNotSpeaking ────────────────────────────────

  describe('isSpeaking / isNotSpeaking', () => {
    it('not speaking at idle', () => {
      const actor = createTestActor();
      expect(getContext(actor).isSpeaking).toBe(false);
    });

    it('speaking after triggering speech', () => {
      const actor = createTestActor();
      actor.send({ type: 'SPEAK', category: 'wisdom' });
      expect(getContext(actor).isSpeaking).toBe(true);
    });
  });

  // ── shouldCommentTrack ────────────────────────────────────────

  describe('shouldCommentTrack', () => {
    it('true when count>=3, model set, not speaking, speech on', () => {
      const actor = createTestActor();
      loadModelToIdle(actor, 'model-a');

      actor.send({ type: 'MUSIC_TRACK_CHANGED', count: 3 });
      expectState(actor, 'talking');
    });

    it('false when count < 3', () => {
      const actor = createTestActor();
      loadModelToIdle(actor, 'model-a');

      actor.send({ type: 'MUSIC_TRACK_CHANGED', count: 2 });
      expectState(actor, 'idle');
    });

    it('false when no model loaded', () => {
      const actor = createTestActor();
      actor.send({ type: 'MUSIC_TRACK_CHANGED', count: 5 });
      expectState(actor, 'idle');
    });
  });

  // ── hasPendingCommentary ──────────────────────────────────────

  describe('hasPendingCommentary', () => {
    it('set when model has greeting prefix AND commentary prefix', () => {
      const actor = createTestActor();
      // Load model-a from idle (isFirstModel) → appearing
      actor.send({ type: 'MODEL_SELECTED', modelId: 'model-a' });
      // appearing → waving (playModelGreeting fires with currentModelId='model-a')
      actor.send({ type: 'VIDEO_ENDED' });
      // model-a has both greeting and commentary prefixes → pendingModelCommentary set
      expect(getContext(actor).pendingModelCommentary).toBe('model-a');
    });
  });

  // ── hasPendingFollowUp ────────────────────────────────────────

  describe('hasPendingFollowUp', () => {
    it('set when random < 0.4 on topology commentary', () => {
      vi.spyOn(Math, 'random').mockReturnValue(0.2);
      const actor = createTestActor();
      actor.send({ type: 'PARAMETER_CHANGED', paramType: 'topology', value: 'TP4_RDMA' });
      // Re-send to trigger commentary from thinkingTopology
      actor.send({ type: 'PARAMETER_CHANGED', paramType: 'topology', value: 'TP4_RDMA' });
      expect(getContext(actor).pendingFollowUp).toBe('question_responses');
    });

    it('null when random >= 0.4', () => {
      vi.spyOn(Math, 'random').mockReturnValue(0.8);
      const actor = createTestActor();
      actor.send({ type: 'PARAMETER_CHANGED', paramType: 'topology', value: 'TP4_RDMA' });
      actor.send({ type: 'PARAMETER_CHANGED', paramType: 'topology', value: 'TP4_RDMA' });
      expect(getContext(actor).pendingFollowUp).toBeNull();
    });
  });

  // ── isQ2 / isGoodQuant ────────────────────────────────────────

  describe('isQ2 / isGoodQuant', () => {
    it('Q2 transitions to talking', () => {
      const actor = createTestActor();
      actor.send({ type: 'PARAMETER_CHANGED', paramType: 'quantization', value: 'Q2' });
      expectState(actor, 'talking');
    });

    it('Q4 transitions to talking', () => {
      const actor = createTestActor();
      actor.send({ type: 'PARAMETER_CHANGED', paramType: 'quantization', value: 'Q4' });
      expectState(actor, 'talking');
    });
  });
});
