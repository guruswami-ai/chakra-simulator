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

describe('parameter commentary', () => {
  // ── Topology ──────────────────────────────────────────────────

  describe('topology', () => {
    it('topology from idle → thinkingTopology', () => {
      const actor = createTestActor();
      actor.send({ type: 'PARAMETER_CHANGED', paramType: 'topology', value: 'TP4_RDMA' });
      expectState(actor, 'thinkingTopology');
    });

    it('topology delayed re-send → talking with commentary', () => {
      const actor = createTestActor();
      actor.send({ type: 'PARAMETER_CHANGED', paramType: 'topology', value: 'TP4_RDMA' });
      expectState(actor, 'thinkingTopology');

      // Adapter re-sends after delay
      actor.send({ type: 'PARAMETER_CHANGED', paramType: 'topology', value: 'TP4_RDMA' });
      expectState(actor, 'talking');
      expectSpeaking(actor, 'Topology TP4_RDMA commentary');
    });

    it('topology commentary includes audio intent when speechEnabled', () => {
      const actor = createTestActor({ speechEnabled: true });
      actor.send({ type: 'PARAMETER_CHANGED', paramType: 'topology', value: 'TP4_RDMA' });
      actor.send({ type: 'PARAMETER_CHANGED', paramType: 'topology', value: 'TP4_RDMA' });

      const ctx = getContext(actor);
      expect(ctx.pendingAudioSrc).toContain('topology_commentary');
      expect(ctx.pendingAudioAction).toBe('play');
    });

    it('topology with unknown value still provides text commentary', () => {
      const actor = createTestActor();
      actor.send({ type: 'PARAMETER_CHANGED', paramType: 'topology', value: 'UNKNOWN' });
      actor.send({ type: 'PARAMETER_CHANGED', paramType: 'topology', value: 'UNKNOWN' });
      expectState(actor, 'talking');
      expectSpeaking(actor, 'Topology UNKNOWN commentary');
    });
  });

  // ── Follow-up questions ───────────────────────────────────────

  describe('follow-up questions', () => {
    it('40% chance follow-up on topology (random < 0.4)', () => {
      vi.spyOn(Math, 'random').mockReturnValue(0.2);
      const actor = createTestActor();
      actor.send({ type: 'PARAMETER_CHANGED', paramType: 'topology', value: 'TP4_RDMA' });
      actor.send({ type: 'PARAMETER_CHANGED', paramType: 'topology', value: 'TP4_RDMA' });

      expect(getContext(actor).pendingFollowUp).toBe('question_responses');
    });

    it('no follow-up when random >= 0.4', () => {
      vi.spyOn(Math, 'random').mockReturnValue(0.8);
      const actor = createTestActor();
      actor.send({ type: 'PARAMETER_CHANGED', paramType: 'topology', value: 'TP4_RDMA' });
      actor.send({ type: 'PARAMETER_CHANGED', paramType: 'topology', value: 'TP4_RDMA' });

      expect(getContext(actor).pendingFollowUp).toBeNull();
    });

    it('40% chance follow-up on batch mode', () => {
      vi.spyOn(Math, 'random').mockReturnValue(0.2);
      const actor = createTestActor();
      actor.send({ type: 'PARAMETER_CHANGED', paramType: 'batchMode', value: 'true' });

      expect(getContext(actor).pendingFollowUp).toBe('question_responses');
    });
  });

  // ── Quantization ──────────────────────────────────────────────

  describe('quantization', () => {
    it('Q4 from idle → talking with commentary', () => {
      const actor = createTestActor();
      actor.send({ type: 'PARAMETER_CHANGED', paramType: 'quantization', value: 'Q4' });
      expectState(actor, 'talking');
      expectSpeaking(actor, 'Quant Q4 commentary');
    });

    it('Q8 from idle → talking with audio intent', () => {
      const actor = createTestActor({ speechEnabled: true });
      actor.send({ type: 'PARAMETER_CHANGED', paramType: 'quantization', value: 'Q8' });
      expectState(actor, 'talking');
      expect(getContext(actor).pendingAudioSrc).toContain('quant_commentary');
    });

    it('Q2 transitions to talking with warning', () => {
      const actor = createTestActor();
      actor.send({ type: 'PARAMETER_CHANGED', paramType: 'quantization', value: 'Q2' });
      expectState(actor, 'talking');
      expectSpeaking(actor, 'Quant Q2 commentary');
      expect(getContext(actor).systemMessage).toBe('[WARN_Q2]');
      expect(getContext(actor).systemSeverity).toBe('warning');
    });

    it('Q2 warning cleared after speech linger', () => {
      const actor = createTestActor();
      actor.send({ type: 'PARAMETER_CHANGED', paramType: 'quantization', value: 'Q2' });
      expect(getContext(actor).systemMessage).toBe('[WARN_Q2]');

      actor.send({ type: 'AUDIO_ENDED' }); // → idle
      actor.send({ type: 'SPEECH_LINGER_DONE' }); // clears everything
      expect(getContext(actor).systemMessage).toBeNull();
    });
  });

  // ── KV Cache ──────────────────────────────────────────────────

  describe('kvCache', () => {
    it('kvCache → talking with context commentary', () => {
      const actor = createTestActor();
      actor.send({ type: 'PARAMETER_CHANGED', paramType: 'kvCache', value: '4096' });
      expectState(actor, 'talking');
      expectSpeaking(actor, 'Context 4096 commentary');
    });

    it('kvCache with audio intent', () => {
      const actor = createTestActor({ speechEnabled: true });
      actor.send({ type: 'PARAMETER_CHANGED', paramType: 'kvCache', value: '4096' });
      expect(getContext(actor).pendingAudioSrc).toContain('context_commentary');
    });
  });

  // ── Batch mode ────────────────────────────────────────────────

  describe('batchMode', () => {
    it('batchMode true → talking', () => {
      const actor = createTestActor();
      actor.send({ type: 'PARAMETER_CHANGED', paramType: 'batchMode', value: 'true' });
      expectState(actor, 'talking');
      expectSpeaking(actor, 'Batch on');
    });

    it('batchMode false → talking with interactive commentary', () => {
      const actor = createTestActor();
      actor.send({ type: 'PARAMETER_CHANGED', paramType: 'batchMode', value: 'false' });
      expectState(actor, 'talking');
      expectSpeaking(actor, 'Batch off');
    });
  });

  // ── Model parameter ───────────────────────────────────────────

  describe('model parameter type', () => {
    it('model paramType has guard but no target (adapter handles)', () => {
      const actor = createTestActor();
      actor.send({ type: 'PARAMETER_CHANGED', paramType: 'model', value: 'model-a' });
      // The guard matches but there's no target/action — stays in idle
      expectState(actor, 'idle');
    });
  });
});
