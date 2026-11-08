// ── Thin adapter: delegates to XState character engine ────────────
// All state machine logic lives in character-engine/machine.ts
// All content data lives in character-engine/content/guruswami.ts
// This file preserves the public API for all existing consumers.

import { useCharacterMachine } from '../character-engine/useCharacterMachine';
import { guruswamiConfig } from '../character-engine/content/guruswami';

// Re-export types for consumers
export type {
  AnimState,
  OnboardingStep,
  GuruswamiStateReturn,
  GuruswamiStateProps,
  ChakraChallenge,
  GuruError,
  VoiceCategory,
} from '../character-engine/types';

// Re-export content constants for consumers
export {
  GURU_ERRORS,
  DETAILED_HELP,
  CHAKRA_CHALLENGES,
  TUTORIAL_RECOMMENDED,
} from '../character-engine/content/guruswami';

export function useGuruswamiState(
  props: import('../character-engine/types').GuruswamiStateProps,
): import('../character-engine/types').GuruswamiStateReturn {
  return useCharacterMachine(guruswamiConfig, props);
}
