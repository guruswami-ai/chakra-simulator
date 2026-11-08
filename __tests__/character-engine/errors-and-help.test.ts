import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  createTestActor,
  advanceToTalking,
  createRawActor,
  expectState,
  expectSpeaking,
  getContext,
} from './helpers';

beforeEach(() => {
  vi.spyOn(Math, 'random').mockReturnValue(0.5);
});

describe('errors and help', () => {
  // ── TRIGGER_ERROR ─────────────────────────────────────────────

  describe('TRIGGER_ERROR', () => {
    it('from idle → talking with error speech', () => {
      const actor = createTestActor();
      actor.send({ type: 'TRIGGER_ERROR', errorId: 'OOM_CRASH' });
      expectState(actor, 'talking');
      expectSpeaking(actor, 'The glass overflows');
    });

    it('sets systemMessage and severity', () => {
      const actor = createTestActor();
      actor.send({ type: 'TRIGGER_ERROR', errorId: 'OOM_CRASH' });

      const ctx = getContext(actor);
      expect(ctx.systemMessage).toBe('[ERR_OOM]');
      expect(ctx.systemSeverity).toBe('error');
    });

    it('warning severity for non-error', () => {
      const actor = createTestActor();
      actor.send({ type: 'TRIGGER_ERROR', errorId: 'SUBOPTIMAL' });

      const ctx = getContext(actor);
      expect(ctx.systemSeverity).toBe('warning');
    });

    it('from talking → interrupts and replaces speech', () => {
      const actor = createRawActor();
      advanceToTalking(actor);
      expectState(actor, 'talking');

      actor.send({ type: 'TRIGGER_ERROR', errorId: 'OOM_CRASH' });
      expectState(actor, 'talking');
      expectSpeaking(actor, 'The glass overflows');
    });

    it('unknown errorId → no crash, graceful (no speech change)', () => {
      const actor = createTestActor();
      // Should not throw
      actor.send({ type: 'TRIGGER_ERROR', errorId: 'NONEXISTENT' });
      expectState(actor, 'talking');
      // playError returns {} for unknown errorId, so isSpeaking may not be set
    });

    it('systemMessage cleared after speech linger', () => {
      const actor = createTestActor();
      actor.send({ type: 'TRIGGER_ERROR', errorId: 'OOM_CRASH' });
      expect(getContext(actor).systemMessage).toBe('[ERR_OOM]');

      actor.send({ type: 'AUDIO_ENDED' }); // → idle (text lingers)
      // systemMessage still visible during linger
      expect(getContext(actor).systemMessage).toBe('[ERR_OOM]');

      actor.send({ type: 'SPEECH_LINGER_DONE' }); // clears everything
      expect(getContext(actor).systemMessage).toBeNull();
      expect(getContext(actor).systemSeverity).toBeNull();
    });

    it('systemMessage cleared when interrupted by new speech', () => {
      const actor = createTestActor();
      actor.send({ type: 'TRIGGER_ERROR', errorId: 'OOM_CRASH' });
      expect(getContext(actor).systemMessage).toBe('[ERR_OOM]');

      // Interrupt with help request (calls interruptSpeech which uses clearSpeech)
      actor.send({ type: 'HELP_REQUESTED', controlType: 'topology' });
      expect(getContext(actor).systemMessage).toBeNull();
      expect(getContext(actor).systemSeverity).toBeNull();
    });
  });

  // ── HELP_REQUESTED ────────────────────────────────────────────

  describe('HELP_REQUESTED', () => {
    it('from idle → talking with help text', () => {
      const actor = createTestActor();
      actor.send({ type: 'HELP_REQUESTED', controlType: 'topology' });
      expectState(actor, 'talking');
      expectSpeaking(actor, 'Topology distributes model layers');
    });

    it('sets isHelpSpeaking', () => {
      const actor = createTestActor();
      actor.send({ type: 'HELP_REQUESTED', controlType: 'topology' });
      expect(getContext(actor).isHelpSpeaking).toBe(true);
    });

    it('help speech with voiceFile sets audio intent', () => {
      const actor = createTestActor({ speechEnabled: true });
      actor.send({ type: 'HELP_REQUESTED', controlType: 'topology' });
      expect(getContext(actor).pendingAudioSrc).toContain('hover_tip');
    });

    it('help speech without voiceFile falls back to wisdom voice', () => {
      const actor = createTestActor({ speechEnabled: true });
      actor.send({ type: 'HELP_REQUESTED', controlType: 'quant' });
      // quant help has no voiceFile, falls back to selectVoice(voiceLib, 'wisdom', ...)
      expect(getContext(actor).pendingAudioSrc).toContain('wisdom');
    });

    it('from talking → interrupts and replaces', () => {
      const actor = createRawActor();
      advanceToTalking(actor);

      actor.send({ type: 'HELP_REQUESTED', controlType: 'topology' });
      expectState(actor, 'talking');
      expectSpeaking(actor, 'Topology distributes model layers');
    });

    it('help AUDIO_ENDED → idle (isHelpSpeaking triggers linger path)', () => {
      const actor = createTestActor();
      actor.send({ type: 'HELP_REQUESTED', controlType: 'topology' });
      expectState(actor, 'talking');

      actor.send({ type: 'AUDIO_ENDED' });
      expectState(actor, 'idle');
    });

    it('unknown controlType → no crash', () => {
      const actor = createTestActor();
      actor.send({ type: 'HELP_REQUESTED', controlType: 'nonexistent' });
      // playHelp returns {} for unknown control, state transitions to talking
      expectState(actor, 'talking');
    });
  });
});
