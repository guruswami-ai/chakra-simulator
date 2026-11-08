import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  createTestActor,
  expectState,
  getContext,
} from './helpers';

beforeEach(() => {
  vi.spyOn(Math, 'random').mockReturnValue(0.5);
});

describe('speech disabled paths', () => {
  it('no audio intent when speechEnabled=false', () => {
    const actor = createTestActor({ speechEnabled: false });
    actor.send({ type: 'SPEAK', category: 'wisdom' });
    expectState(actor, 'talking');
    // Voice is "speaking" (text shown) but no audio
    expect(getContext(actor).isSpeaking).toBe(true);
    expect(getContext(actor).pendingAudioSrc).toBeNull();
  });

  it('SILENT_SPEECH_DONE → idle when no pending chains', () => {
    const actor = createTestActor({ speechEnabled: false });
    actor.send({ type: 'SPEAK', category: 'wisdom' });
    expectState(actor, 'talking');

    actor.send({ type: 'SILENT_SPEECH_DONE' });
    expectState(actor, 'idle');
    expect(getContext(actor).isSpeaking).toBe(false);
  });

  it('SPEECH_ENABLED_CHANGED(false) clears speech and stops audio', () => {
    const actor = createTestActor({ speechEnabled: true });
    actor.send({ type: 'SPEAK', category: 'wisdom' });
    expect(getContext(actor).isSpeaking).toBe(true);

    actor.send({ type: 'SPEECH_ENABLED_CHANGED', enabled: false });
    expect(getContext(actor).speechEnabled).toBe(false);
    expect(getContext(actor).isSpeaking).toBe(false);
    expect(getContext(actor).pendingAudioAction).toBe('stop');
  });

  it('SPEECH_ENABLED_CHANGED(true) re-enables', () => {
    const actor = createTestActor({ speechEnabled: false });
    actor.send({ type: 'SPEECH_ENABLED_CHANGED', enabled: true });
    expect(getContext(actor).speechEnabled).toBe(true);
  });

  it('topology commentary with speech disabled → no audio but text present', () => {
    const actor = createTestActor({ speechEnabled: false });
    actor.send({ type: 'PARAMETER_CHANGED', paramType: 'topology', value: 'TP4_RDMA' });
    actor.send({ type: 'PARAMETER_CHANGED', paramType: 'topology', value: 'TP4_RDMA' });

    expectState(actor, 'talking');
    expect(getContext(actor).isSpeaking).toBe(true);
    expect(getContext(actor).currentSpeechText).toContain('Topology TP4_RDMA');
    expect(getContext(actor).pendingAudioSrc).toBeNull();
  });
});
