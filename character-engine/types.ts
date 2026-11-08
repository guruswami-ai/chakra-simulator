import React from 'react';
import { AppMode } from '../types';

// ── Animation & Voice Types ──────────────────────────────────────

export type AnimState =
  | 'WAITING'        // Blank sphere, initial voice greeting
  | 'APPEARING'      // appear anim (plays once)
  | 'WAVING'         // wave anim (plays once)
  | 'TALKING'        // talk anim (loops while audio plays)
  | 'IDLE'           // idle anim (loops), periodic voice lines
  | 'THINKING'       // think anim (loops), model loading/topology change
  | 'LISTENING'      // listen anim (loops), user adjusting sliders
  | 'DISAPPEARING'   // disappear anim (plays once)
  | 'REACTING_YES'   // yes anim (plays once), positive feedback
  | 'REACTING_NO';   // no anim (plays once), negative feedback

export type OnboardingStep =
  | 'INTRO'           // Welcome gate shown, guru not yet appeared
  | 'INTRO_GREETING'  // "Hi, my name is Guruswami..."
  | 'INTRO_HELP'      // "I would really appreciate your help..."
  | 'INTRO_ROLE'      // "I'll sit here in the middle..."
  | 'INTRO_CONTROLS'  // "Here are the cluster controls..."
  | 'INTRO_CLUSTER'   // (legacy — redirects to INTRO_GREETING)
  | 'PICK_MODEL'      // "Click Qwen 32B"
  | 'PICK_QUANT'      // "Click Q4"
  | 'PICK_CONTEXT'    // "Click 1K context"
  | 'PICK_TOPOLOGY'   // "Click EP1"
  | 'LOADING'         // Model loading, music starts
  | 'TOUR_NODE'       // "Notice only one node is active..."
  | 'TOUR_TPS'        // "Tokens per second..."
  | 'TOUR_TTFT'       // "Time to first token..."
  | 'TOUR_LAYERS'     // "Model split..."
  | 'TOUR_MEMORY'     // "Per-node memory..."
  | 'TRY_BREAK'       // "Try clicking TP5..."
  | 'EXPLAIN_BREAK'   // "Qwen doesn't fit, cluster crashed"
  | 'TRY_EP5'         // "Click EP5 to recover"
  | 'EXPLAIN_EP5'     // "Five copies, 5x TPS"
  | 'FREEPLAY'        // "Experiment with controls"
  | 'TRY_CLICK_GURU'  // "Click on my glass sphere"
  | 'REWARD_INTRO'    // "You completed the tutorial, here's a reward track"
  | 'COMPLETE'        // "When you're done, click a model card"
  | null;

export type AnimCategory = 'appear' | 'idle' | 'talk' | 'think' | 'wave' | 'listen' | 'yes' | 'no' | 'disappear';

export type VoiceCategory =
  | 'greeting' | 'wake' | 'wisdom' | 'thinking' | 'filler'
  | 'affirmation' | 'encouragement' | 'processing' | 'error'
  | 'engagement' | 'acknowledgment' | 'goodbye' | 'question_responses'
  | 'humor' | 'idle_factoid' | 'deep_dive' | 'achievement';

export interface AnimLibrary {
  categories: Record<AnimCategory, {
    loop: boolean;
    files: string[];
  }>;
}

export type VoiceLibrary = Record<VoiceCategory, string[]>;

export type ActiveSlot = 'A' | 'B';

// ── Error / Challenge Types ──────────────────────────────────────

export interface GuruError {
  id: string;
  /** Guruswami's poetic diagnosis */
  guru: string;
  /** Callisto2-style cold terminal output */
  system: string;
  /** Audio feedback style: 'heavy' = low singing bowl, 'warn' = gentle amber pulse */
  severity: 'error' | 'warning';
}

export interface ChakraChallenge {
  id: string;
  title: string;
  goal: string;
  /** Guruswami's poetic challenge prompt */
  challenge: string;
  /** Guruswami's success celebration */
  success: string;
  /** Win condition check — returns true if current config meets the criteria */
  winCondition: (config: { modelId?: string; quant?: string; context?: number; batch?: boolean; topology?: string }) => boolean;
}

// ── Character Config ─────────────────────────────────────────────

export interface VoiceMapEntry {
  dir: string;
  prefix: string;
  variants: number;
}

export interface CharacterConfig {
  id: string;
  voiceBasePath: string;
  videoBasePath: string;
  animLibraryUrl: string;
  voiceLibraryUrl: string;
  transcriptionsUrl: string;
  // Model voice mappings
  modelVoicePrefixes: Record<string, string>;
  modelFarewellPrefixes: Record<string, string>;
  modelGreetingPrefixes: Record<string, string>;
  musicCommentaryPrefixes: Record<string, { dir: string; prefix: string }>;
  // Variant counts
  modelVoiceVariants: number;
  modelFarewellVariants: number;
  modelGreetingVariants: number;
  musicCommentaryVariants: number;
  // Voice maps for parameter commentary
  quantVoicePrefix: Record<string, { prefix: string; variants: number }>;
  contextVoicePrefix: Record<number, { prefix: string; variants: number }>;
  batchVoicePrefix: Record<string, { prefix: string; variants: number }>;
  topologyVoiceMap: Record<string, VoiceMapEntry>;
  // Content
  errors: Record<string, GuruError>;
  detailedHelp: Record<string, { text: string; voiceFile?: string }>;
  channelGreetings: string[];
  onboardingPrompts: Record<string, string>;
  onboardingHints: Record<string, string>;
  tutorialRecommended: Record<string, string>;
  challenges: ChakraChallenge[];
  // Onboarding voice clips
  onboardingClips: Record<string, string>;
  tourClips: Record<string, string>;
  // Commentary generators
  getModelCommentary: (modelId: string) => string;
  getQuantCommentary: (quant: string, modelId: string) => string;
  getContextCommentary: (tokens: number) => string;
  getBatchCommentary: (enabled: boolean) => string;
  getTopologyCommentary: (topology: string) => string;
}

// ── Machine Context ──────────────────────────────────────────────

export interface MachineContext {
  config: CharacterConfig;
  // Video state
  videoSrcA: string;
  videoSrcB: string;
  activeSlot: ActiveSlot;
  isLooping: boolean;
  playbackRate: number;
  currentAnimCategory: AnimCategory | null;
  // Speech state
  isSpeaking: boolean;
  currentSpeechText: string;
  speechEnabled: boolean;
  isHelpSpeaking: boolean;
  speechPurpose: 'instructional' | 'ambient';
  // Audio control — the adapter hook reads these and drives the actual Audio element
  pendingAudioSrc: string | null;
  pendingAudioAction: 'play' | 'stop' | null;
  // UI state
  systemMessage: string | null;
  systemSeverity: 'error' | 'warning' | null;
  modelCardsGlow: boolean;
  onboardingStep: OnboardingStep;
  hasAppeared: boolean;
  hasGreeted: boolean;
  // Internal
  pendingModelId: string | null;
  currentModelId: string | null;
  pendingModelCommentary: string | null;
  pendingFollowUp: VoiceCategory | null;
  pendingOnboardingPrompt: OnboardingStep;
  // Libraries (loaded async)
  library: AnimLibrary | null;
  voiceLib: VoiceLibrary | null;
  transcriptions: Record<string, string> | null;
  // Callbacks to parent (set by adapter)
  setDucking: ((duck: boolean) => void) | null;
}

// ── Machine Events ───────────────────────────────────────────────

export type MachineEvent =
  | { type: 'LIBRARY_LOADED'; library: AnimLibrary; voiceLib: VoiceLibrary; transcriptions: Record<string, string> }
  | { type: 'VIDEO_ENDED' }
  | { type: 'SPEAK'; category: VoiceCategory }
  | { type: 'AUDIO_ENDED' }
  | { type: 'AUDIO_FAILED' }
  | { type: 'MODEL_SELECTED'; modelId: string }
  | { type: 'PARAMETER_CHANGED'; paramType: string; value: string }
  | { type: 'HELP_REQUESTED'; controlType: string }
  | { type: 'TRIGGER_ERROR'; errorId: string }
  | { type: 'AVATAR_CLICKED' }
  | { type: 'MUSIC_TRACK_CHANGED'; count: number }
  | { type: 'SPEECH_ENABLED_CHANGED'; enabled: boolean }
  | { type: 'SILENT_SPEECH_DONE' }
  | { type: 'SPEECH_LINGER_DONE' }
  | { type: 'ONBOARDING_SPEECH_DONE' }
  | { type: 'ONBOARDING_HINT'; hint: string }
  | { type: 'WELCOME_DISMISSED' }
  | { type: 'MODE_CHANGED'; mode: AppMode }
  | { type: 'SKIP_ONBOARDING' };

// ── Hook Interfaces ──────────────────────────────────────────────

export interface GuruswamiStateReturn {
  animState: AnimState;
  videoSrcA: string;
  videoSrcB: string;
  activeSlot: ActiveSlot;
  isLooping: boolean;
  libraryLoaded: boolean;
  onVideoEnded: () => void;
  playbackRate: number;
  setPlaybackRate: (rate: number) => void;
  /** Call to trigger a voice line from a category. Switches to talk animation. */
  speak: (category: VoiceCategory) => void;
  /** Whether voice audio is currently playing */
  isSpeaking: boolean;
  audioRef: React.RefObject<HTMLAudioElement | null>;
  /** Called when user selects a model in SimulationPanel */
  onModelSelected: (modelId: string) => void;
  /** Called when user changes a parameter (quantization, topology, KV cache, etc.) */
  onParameterChange: (type: string, value: string) => void;
  /** Text currently being spoken — mirrors voice filename */
  currentSpeechText: string;
  /** Callisto2-style system terminal message (shown below guru text for errors) */
  systemMessage: string | null;
  /** Severity of current system message for visual styling */
  systemSeverity: 'error' | 'warning' | null;
  /** Whether model cards should pulse/glow to attract user attention */
  modelCardsGlow: boolean;
  /** Current onboarding step (null = onboarding complete or skipped) */
  onboardingStep: OnboardingStep;
  /** True once guru has appeared — stays true except briefly during model-change disappear */
  hasAppeared: boolean;
  /** Called when user clicks ? button on a control for deep help */
  onHelpRequest: (controlType: string) => void;
  /** Trigger a dual-voice error/warning notification */
  triggerGuruError: (errorId: string) => void;
  /** Handle avatar click — wave + random greeting/wisdom voice */
  handleAvatarClick: () => void;
  /** Skip onboarding entirely — cancels state machine + stops audio */
  skipOnboarding: () => void;
  welcomeDismissed: () => void;
  /** Whether help speech is lingering (text stays visible after audio ends) */
  isHelpSpeaking: React.RefObject<boolean>;
  /** Called when background music track changes */
  onMusicTrackChange: (trackChangeCount: number) => void;
}

export interface GuruswamiStateProps {
  /** Whether speech audio playback is enabled (controlled by MeshGraph toggle) */
  speechEnabled: boolean;
  /** Current app mode: LIVE skips onboarding, SIM/GAME start it */
  mode?: AppMode;
  /** Duck background music during instructional speech (from useBackgroundMusic) */
  setDucking?: (duck: boolean) => void;
}
