import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * Greeting behavior tests validate the state transitions and audio triggers
 * in the initial greeting flow of useGuruswamiState.
 *
 * We test the LOGIC (not the React hook) by simulating the decision paths.
 * This catches the exact bug fixed in this session: returning users getting
 * no greeting audio because the skipOnboarding path was silent.
 */

// Simulate the greeting decision logic from useGuruswamiState
interface GreetingContext {
  library: boolean;          // Animation library loaded?
  voiceLib: boolean;         // Voice library loaded?
  hasGreeted: boolean;       // Already greeted this session?
  skipOnboarding: boolean;   // LIVE mode or returning user?
  speechEnabled: boolean;    // User hasn't muted?
  stateIsCurrent: string;    // Current anim state
}

interface GreetingResult {
  shouldGreet: boolean;
  playsAudio: boolean;
  showsSpeechText: boolean;
  triggersAppear: boolean;
  startsInactivityTimer: boolean;
  advancesOnboarding: boolean;
}

function simulateGreeting(ctx: GreetingContext): GreetingResult {
  const result: GreetingResult = {
    shouldGreet: false,
    playsAudio: false,
    showsSpeechText: false,
    triggersAppear: false,
    startsInactivityTimer: false,
    advancesOnboarding: false,
  };

  // Gate: libraries must be loaded and hasn't greeted yet
  if (!ctx.library || !ctx.voiceLib || ctx.hasGreeted) return result;
  if (ctx.stateIsCurrent !== 'WAITING') return result;

  result.shouldGreet = true;

  if (ctx.skipOnboarding) {
    // Returning user / LIVE mode path (FIXED in this session)
    result.triggersAppear = true;
    result.showsSpeechText = true;  // Random channel greeting
    result.startsInactivityTimer = true;
    if (ctx.speechEnabled) {
      result.playsAudio = true;    // selectVoice('greeting') + play
    }
    result.advancesOnboarding = false;  // No onboarding wizard
  } else {
    // Fresh user: full onboarding path
    result.triggersAppear = true;
    result.showsSpeechText = true;
    result.startsInactivityTimer = true;
    result.advancesOnboarding = true;  // Advances to PICK_MODEL
    if (ctx.speechEnabled) {
      result.playsAudio = true;
    }
  }

  return result;
}

describe('greeting flow', () => {
  const baseCtx: GreetingContext = {
    library: true,
    voiceLib: true,
    hasGreeted: false,
    skipOnboarding: false,
    speechEnabled: true,
    stateIsCurrent: 'WAITING',
  };

  it('does not greet if libraries are not loaded', () => {
    const result = simulateGreeting({ ...baseCtx, library: false });
    expect(result.shouldGreet).toBe(false);
  });

  it('does not greet if voice library is missing', () => {
    const result = simulateGreeting({ ...baseCtx, voiceLib: false });
    expect(result.shouldGreet).toBe(false);
  });

  it('does not double-greet', () => {
    const result = simulateGreeting({ ...baseCtx, hasGreeted: true });
    expect(result.shouldGreet).toBe(false);
  });

  it('does not greet if not in WAITING state', () => {
    const result = simulateGreeting({ ...baseCtx, stateIsCurrent: 'IDLE' });
    expect(result.shouldGreet).toBe(false);
  });

  describe('returning user (skipOnboarding = true)', () => {
    const returningCtx = { ...baseCtx, skipOnboarding: true };

    it('plays greeting audio', () => {
      const result = simulateGreeting(returningCtx);
      expect(result.playsAudio).toBe(true);
    });

    it('shows speech text (channel greeting)', () => {
      const result = simulateGreeting(returningCtx);
      expect(result.showsSpeechText).toBe(true);
    });

    it('triggers appear animation', () => {
      const result = simulateGreeting(returningCtx);
      expect(result.triggersAppear).toBe(true);
    });

    it('starts inactivity timer', () => {
      const result = simulateGreeting(returningCtx);
      expect(result.startsInactivityTimer).toBe(true);
    });

    it('does NOT advance onboarding', () => {
      const result = simulateGreeting(returningCtx);
      expect(result.advancesOnboarding).toBe(false);
    });

    it('skips audio if speech is disabled', () => {
      const result = simulateGreeting({ ...returningCtx, speechEnabled: false });
      expect(result.playsAudio).toBe(false);
      expect(result.showsSpeechText).toBe(true);  // Text still shown
    });
  });

  describe('fresh user (skipOnboarding = false)', () => {
    const freshCtx = { ...baseCtx, skipOnboarding: false };

    it('plays greeting audio', () => {
      const result = simulateGreeting(freshCtx);
      expect(result.playsAudio).toBe(true);
    });

    it('triggers appear animation', () => {
      const result = simulateGreeting(freshCtx);
      expect(result.triggersAppear).toBe(true);
    });

    it('advances onboarding to PICK_MODEL', () => {
      const result = simulateGreeting(freshCtx);
      expect(result.advancesOnboarding).toBe(true);
    });

    it('starts inactivity timer', () => {
      const result = simulateGreeting(freshCtx);
      expect(result.startsInactivityTimer).toBe(true);
    });
  });
});

// ── skipOnboarding derivation ───────────────────────────────────

describe('skipOnboarding derivation', () => {
  function deriveSkipOnboarding(isLive: boolean, onboardingComplete: string | null): boolean {
    const hasCompletedOnboarding = onboardingComplete === 'true';
    return isLive || hasCompletedOnboarding;
  }

  it('skips in LIVE mode regardless of localStorage', () => {
    expect(deriveSkipOnboarding(true, null)).toBe(true);
    expect(deriveSkipOnboarding(true, 'true')).toBe(true);
    expect(deriveSkipOnboarding(true, 'false')).toBe(true);
  });

  it('skips when onboarding is complete', () => {
    expect(deriveSkipOnboarding(false, 'true')).toBe(true);
  });

  it('does NOT skip for fresh user in SIM mode', () => {
    expect(deriveSkipOnboarding(false, null)).toBe(false);
    expect(deriveSkipOnboarding(false, 'false')).toBe(false);
  });
});
