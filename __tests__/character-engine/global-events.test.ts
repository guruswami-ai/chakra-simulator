import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  createTestActor,
  createRawActor,
  advanceToTalking,
  expectState,
  getContext,
} from './helpers';

beforeEach(() => {
  vi.spyOn(Math, 'random').mockReturnValue(0.5);
});

describe('global events', () => {
  // ── SPEECH_ENABLED_CHANGED ────────────────────────────────────

  describe('SPEECH_ENABLED_CHANGED', () => {
    it('updates speechEnabled from idle', () => {
      const actor = createTestActor({ speechEnabled: true });
      actor.send({ type: 'SPEECH_ENABLED_CHANGED', enabled: false });
      expect(getContext(actor).speechEnabled).toBe(false);
    });

    it('updates speechEnabled from talking', () => {
      const actor = createRawActor();
      advanceToTalking(actor);
      expectState(actor, 'talking');

      actor.send({ type: 'SPEECH_ENABLED_CHANGED', enabled: false });
      expect(getContext(actor).speechEnabled).toBe(false);
      expect(getContext(actor).isSpeaking).toBe(false);
    });

    it('updates speechEnabled from waiting', () => {
      const actor = createRawActor({ speechEnabled: true });
      expectState(actor, 'waiting');
      actor.send({ type: 'SPEECH_ENABLED_CHANGED', enabled: false });
      expect(getContext(actor).speechEnabled).toBe(false);
    });

    it('updates speechEnabled from thinkingTopology', () => {
      const actor = createTestActor({ speechEnabled: true });
      actor.send({ type: 'PARAMETER_CHANGED', paramType: 'topology', value: 'TP4_RDMA' });
      expectState(actor, 'thinkingTopology');

      actor.send({ type: 'SPEECH_ENABLED_CHANGED', enabled: false });
      expect(getContext(actor).speechEnabled).toBe(false);
    });
  });

  // ── MODE_CHANGED ──────────────────────────────────────────────

  describe('MODE_CHANGED', () => {
    it('MODE_CHANGED does not cancel onboarding (LIVE mode removed)', () => {
      const actor = createRawActor({ skipOnboarding: false });
      expect(getContext(actor).onboardingStep).toBe('INTRO');

      actor.send({ type: 'MODE_CHANGED', mode: 'SIM' });
      expect(getContext(actor).onboardingStep).toBe('INTRO');
    });

    it('GAME does not cancel onboarding', () => {
      const actor = createRawActor({ skipOnboarding: false });
      actor.send({ type: 'MODE_CHANGED', mode: 'GAME' });
      expect(getContext(actor).onboardingStep).toBe('INTRO');
    });

    it('SIM does not cancel onboarding', () => {
      const actor = createRawActor({ skipOnboarding: false });
      actor.send({ type: 'MODE_CHANGED', mode: 'SIM' });
      expect(getContext(actor).onboardingStep).toBe('INTRO');
    });
  });

  // ── SPEECH_LINGER_DONE ────────────────────────────────────────

  describe('SPEECH_LINGER_DONE', () => {
    it('clears lingering speech in idle', () => {
      const actor = createTestActor();
      // Trigger help → talking → AUDIO_ENDED → idle (with help text lingering)
      actor.send({ type: 'HELP_REQUESTED', controlType: 'topology' });
      actor.send({ type: 'AUDIO_ENDED' }); // → idle, text lingers
      expectState(actor, 'idle');

      actor.send({ type: 'SPEECH_LINGER_DONE' });
      expect(getContext(actor).isSpeaking).toBe(false);
      expect(getContext(actor).currentSpeechText).toBe('');
      expect(getContext(actor).isHelpSpeaking).toBe(false);
    });
  });

  // ── AUDIO_FAILED ──────────────────────────────────────────────

  describe('AUDIO_FAILED', () => {
    it('from talking → idle with cleared speech', () => {
      const actor = createRawActor();
      advanceToTalking(actor);
      expectState(actor, 'talking');

      actor.send({ type: 'AUDIO_FAILED' });
      expectState(actor, 'idle');
      expect(getContext(actor).isSpeaking).toBe(false);
    });
  });
});
