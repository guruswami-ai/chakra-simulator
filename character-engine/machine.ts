import { setup, assign } from 'xstate';
import type {
  AnimState,
  AnimCategory,
  AnimLibrary,
  VoiceCategory,
  VoiceLibrary,
  ActiveSlot,
  MachineContext,
  MachineEvent,
  CharacterConfig,
  OnboardingStep,
} from './types';

// ── Helpers ──────────────────────────────────────────────────────

function getLoopBehavior(state: AnimState): boolean {
  switch (state) {
    case 'APPEARING':
    case 'DISAPPEARING':
    case 'WAVING':
    case 'REACTING_YES':
    case 'REACTING_NO':
      return false;
    default:
      return true;
  }
}

function stateToCategory(state: AnimState): AnimCategory | null {
  switch (state) {
    case 'APPEARING': return 'appear';
    case 'WAVING': return 'wave';
    case 'TALKING': return 'talk';
    case 'IDLE': return 'idle';
    case 'THINKING': return 'think';
    case 'LISTENING': return 'listen';
    case 'DISAPPEARING': return 'disappear';
    case 'REACTING_YES': return 'yes';
    case 'REACTING_NO': return 'no';
    default: return null;
  }
}

export function extractPhraseFromFilename(filename: string): string {
  const match = filename.match(/gs_[a-z]+_(.+)_\d{3}\.m4a$/);
  if (!match) return '';
  return match[1]
    .replace(/-/g, ' ')
    .replace(/\bi m\b/g, "i'm")
    .replace(/(?<=[a-z]) s\b/g, "'s")
    .replace(/(?<=[a-z]) re\b/g, "'re")
    .replace(/(?<=[a-z]) t\b/g, "'t")
    .replace(/^./, c => c.toUpperCase());
}

function selectVariant(library: AnimLibrary, category: AnimCategory, videoBase: string): string {
  const cat = library.categories[category];
  if (!cat || cat.files.length === 0) return '';
  const file = cat.files[Math.floor(Math.random() * cat.files.length)];
  return videoBase + file;
}

function selectVoice(voiceLib: VoiceLibrary, category: VoiceCategory, voiceBase: string): string | null {
  const files = voiceLib[category];
  if (!files || files.length === 0) return null;
  const file = files[Math.floor(Math.random() * files.length)];
  return voiceBase + category + '/' + file;
}

function getTranscription(
  voicePath: string,
  transcriptions: Record<string, string> | null,
): string {
  const parts = voicePath.split('/voice/');
  const key = parts.length > 1 ? parts[1] : '';
  if (transcriptions && key && transcriptions[key]) {
    return transcriptions[key];
  }
  const filename = voicePath.split('/').pop() || '';
  return extractPhraseFromFilename(filename);
}

function padVariant(n: number, max: number): string {
  return String(Math.floor(Math.random() * max) + 1).padStart(3, '0');
}

/** Compute crossfade video slot assignments */
function crossfade(ctx: MachineContext, src: string, loop: boolean): Partial<MachineContext> {
  const nextSlot: ActiveSlot = ctx.activeSlot === 'A' ? 'B' : 'A';
  return {
    activeSlot: nextSlot,
    isLooping: loop,
    ...(nextSlot === 'A' ? { videoSrcA: src } : { videoSrcB: src }),
  };
}

/** Transition video to match target state, skip reload if same anim category */
function transitionVideo(
  ctx: MachineContext,
  targetState: AnimState,
  forceCategory?: AnimCategory,
): Partial<MachineContext> {
  const cat = forceCategory ?? stateToCategory(targetState);
  if (!cat) return {};

  if (ctx.currentAnimCategory === cat) {
    // Same category — just update loop behavior, don't reload video
    return {
      isLooping: getLoopBehavior(targetState),
    };
  }

  if (!ctx.library) return { currentAnimCategory: cat };

  const src = selectVariant(ctx.library, cat, ctx.config.videoBasePath);
  const shouldLoop = getLoopBehavior(targetState);
  return {
    currentAnimCategory: cat,
    ...crossfade(ctx, src, shouldLoop),
  };
}

/** Prepare audio intent — the adapter hook will actually play it */
function audioIntent(src: string): Partial<MachineContext> {
  return { pendingAudioSrc: src, pendingAudioAction: 'play' as const };
}

function stopAudioIntent(): Partial<MachineContext> {
  return { pendingAudioSrc: null, pendingAudioAction: 'stop' as const };
}

function clearSpeech(): Partial<MachineContext> {
  return {
    isSpeaking: false,
    currentSpeechText: '',
    isHelpSpeaking: false,
    pendingModelCommentary: null,
    pendingFollowUp: null,
    pendingOnboardingPrompt: null,
    systemMessage: null,
    systemSeverity: null,
  };
}

// ── Tour step sequencing ─────────────────────────────────────────

const TOUR_SEQUENCE: Record<string, OnboardingStep> = {
  'TOUR_NODE': 'TOUR_TPS',
  'TOUR_TPS': 'TOUR_TTFT',
  'TOUR_TTFT': 'TOUR_LAYERS',
  'TOUR_LAYERS': 'TOUR_MEMORY',
  'TOUR_MEMORY': 'TRY_BREAK',
  'TRY_BREAK': 'TRY_BREAK',     // Waits for user action (TP5 click)
  'EXPLAIN_BREAK': 'TRY_EP5',
  'TRY_EP5': 'TRY_EP5',         // Waits for user action (EP5 click)
  'EXPLAIN_EP5': 'FREEPLAY',
  'FREEPLAY': 'TRY_CLICK_GURU',
  'TRY_CLICK_GURU': 'TRY_CLICK_GURU',  // Waits for avatar click
  'REWARD_INTRO': 'COMPLETE',
  'COMPLETE': null,
};

// ── Machine Definition ───────────────────────────────────────────

export const characterMachine = setup({
  types: {} as {
    context: MachineContext;
    events: MachineEvent;
    input: { config: CharacterConfig; skipOnboarding: boolean; speechEnabled: boolean };
  },
  guards: {
    isSpeechEnabled: ({ context }) => context.speechEnabled,
    isLibraryLoaded: ({ context }) => context.library !== null,
    isOnboarding: ({ context }) => context.onboardingStep !== null,
    isNotOnboarding: ({ context }) => context.onboardingStep === null,
    hasPendingModel: ({ context }) => context.pendingModelId !== null,
    isSpeaking: ({ context }) => context.isSpeaking,
    isNotSpeaking: ({ context }) => !context.isSpeaking,
    shouldCommentTrack: ({ context, event }) => {
      if (event.type !== 'MUSIC_TRACK_CHANGED') return false;
      // Never interrupt onboarding with music commentary
      if (context.onboardingStep !== null) return false;
      return event.count >= 2 && !context.isSpeaking && context.currentModelId !== null && context.speechEnabled;
    },
    isPickModel: ({ context }) => context.onboardingStep === 'PICK_MODEL',
    isOnboardingNotLoading: ({ context }) => context.onboardingStep !== null && context.onboardingStep !== 'LOADING',
    isSameModel: ({ context, event }) => {
      if (event.type !== 'MODEL_SELECTED') return false;
      return context.currentModelId === event.modelId;
    },
    isFirstModel: ({ context }) => context.currentModelId === null,
    hasModelId: ({ context }) => context.currentModelId !== null,
    hasPendingCommentary: ({ context }) => context.pendingModelCommentary !== null,
    hasPendingFollowUp: ({ context }) => context.pendingFollowUp !== null,
    isQ2: ({ event }) => {
      if (event.type !== 'PARAMETER_CHANGED') return false;
      return event.value.toUpperCase() === 'Q2';
    },
    isGoodQuant: ({ event }) => {
      if (event.type !== 'PARAMETER_CHANGED') return false;
      const q = event.value.toUpperCase();
      return q === 'Q4' || q === 'Q6' || q === 'Q8';
    },
  },
  actions: {
    storeLibrary: assign({
      library: ({ event }) => (event as Extract<MachineEvent, { type: 'LIBRARY_LOADED' }>).library,
      voiceLib: ({ event }) => (event as Extract<MachineEvent, { type: 'LIBRARY_LOADED' }>).voiceLib,
      transcriptions: ({ event }) => (event as Extract<MachineEvent, { type: 'LIBRARY_LOADED' }>).transcriptions,
    }),
    setHasAppeared: assign({ hasAppeared: true }),
    clearHasAppeared: assign({ hasAppeared: false }),
    setHasGreeted: assign({ hasGreeted: true }),

    // ── Video transitions ─────────────────────
    // NOTE: transitionToAppearing reads the library from the event (LIBRARY_LOADED)
    // as well as from context, because XState v5 assign actions within the same
    // transition all read the ORIGINAL context — storeLibrary hasn't been applied yet.
    transitionToAppearing: assign(({ context, event }) => {
      // Use library from event if available (LIBRARY_LOADED), else from context
      const lib = (event as any)?.library || context.library;
      const ctxWithLib = { ...context, library: lib, currentAnimCategory: null };
      const videoUpdate = transitionVideo(ctxWithLib, 'APPEARING', 'appear');
      return {
        hasAppeared: true,
        currentAnimCategory: null,
        ...videoUpdate,
      };
    }),
    // Reload appear video when library arrives late (MODEL_SELECTED before LIBRARY_LOADED)
    reloadAppearVideo: assign(({ context, event }) => {
      const lib = (event as any)?.library || context.library;
      if (!lib) return {};
      const ctxWithLib = { ...context, library: lib, currentAnimCategory: null };
      return transitionVideo(ctxWithLib, 'APPEARING', 'appear');
    }),
    transitionToWaving: assign(({ context }) => transitionVideo(context, 'WAVING', 'wave')),
    transitionToTalking: assign(({ context }) => transitionVideo(context, 'TALKING', 'talk')),
    transitionToIdle: assign(({ context }) => transitionVideo(context, 'IDLE', 'idle')),
    transitionToThinking: assign(({ context }) => transitionVideo(context, 'THINKING', 'think')),
    transitionToDisappearing: assign(({ context }) => transitionVideo(context, 'DISAPPEARING', 'disappear')),
    transitionToReactingYes: assign(({ context }) => ({
      currentAnimCategory: null,
      ...transitionVideo({ ...context, currentAnimCategory: null }, 'REACTING_YES', 'yes'),
    })),
    transitionToReactingNo: assign(({ context }) => ({
      currentAnimCategory: null,
      ...transitionVideo({ ...context, currentAnimCategory: null }, 'REACTING_NO', 'no'),
    })),

    // ── Speech actions ────────────────────────
    clearSpeech: assign(clearSpeech()),
    stopAudio: assign(stopAudioIntent()),

    interruptSpeech: assign(({ context }) => ({
      ...clearSpeech(),
      ...stopAudioIntent(),
      ...transitionVideo(context, 'IDLE', 'idle'),
    })),

    setSpeaking: assign({
      isSpeaking: true,
      speechPurpose: ({ context }) => context.speechPurpose,
    }),

    setInstructional: assign({ speechPurpose: 'instructional' as const }),
    setAmbient: assign({ speechPurpose: 'ambient' as const }),

    // ── Greeting flow ─────────────────────────
    playChannelGreeting: assign(({ context }) => {
      const { config, voiceLib, transcriptions, speechEnabled } = context;
      const greeting = config.channelGreetings[Math.floor(Math.random() * config.channelGreetings.length)];
      let text = greeting;
      let audioSrc: string | null = null;

      if (voiceLib) {
        const src = selectVoice(voiceLib, 'greeting', config.voiceBasePath);
        if (src) {
          const phrase = getTranscription(src, transcriptions);
          if (phrase) text = phrase;
          if (speechEnabled) audioSrc = src;
        }
      }

      return {
        currentSpeechText: text,
        isSpeaking: true,
        speechPurpose: 'instructional' as const,
        ...(audioSrc ? audioIntent(audioSrc) : {}),
      };
    }),

    // ── Model greeting (appear → wave) ────────
    playModelGreeting: assign(({ context }) => {
      const { config, currentModelId, voiceLib, transcriptions, speechEnabled } = context;
      if (!currentModelId) return {};

      const greetPrefix = config.modelGreetingPrefixes[currentModelId];
      const commentaryPrefix = config.modelVoicePrefixes[currentModelId];

      if (greetPrefix) {
        const variant = padVariant(0, config.modelGreetingVariants);
        const greetSrc = config.voiceBasePath + `model_greeting/${greetPrefix}_${variant}.m4a`;
        const text = getTranscription(greetSrc, transcriptions)
          || `Loading ${currentModelId}...`;

        return {
          currentSpeechText: text,
          isSpeaking: true,
          speechPurpose: 'instructional' as const,
          pendingModelCommentary: commentaryPrefix ? currentModelId : null,
          ...(speechEnabled ? audioIntent(greetSrc) : {}),
        };
      }

      if (commentaryPrefix) {
        const variant = padVariant(0, config.modelVoiceVariants);
        const voiceSrc = config.voiceBasePath + `model_commentary/${commentaryPrefix}_${variant}.m4a`;
        const commentary = config.getModelCommentary(currentModelId);
        return {
          currentSpeechText: commentary,
          isSpeaking: true,
          speechPurpose: 'instructional' as const,
          ...(speechEnabled ? audioIntent(voiceSrc) : {}),
        };
      }

      return {};
    }),

    // ── Model commentary chain (after greeting ends) ──
    playPendingCommentary: assign(({ context }) => {
      const { config, pendingModelCommentary, speechEnabled } = context;
      if (!pendingModelCommentary) return {};

      const prefix = config.modelVoicePrefixes[pendingModelCommentary];
      if (!prefix) return { pendingModelCommentary: null };

      const variant = padVariant(0, config.modelVoiceVariants);
      const src = config.voiceBasePath + `model_commentary/${prefix}_${variant}.m4a`;
      const commentary = config.getModelCommentary(pendingModelCommentary);

      return {
        pendingModelCommentary: null,
        currentSpeechText: commentary,
        isSpeaking: true,
        ...(speechEnabled ? audioIntent(src) : {}),
      };
    }),

    // ── Follow-up voice chain ─────────────────
    playPendingFollowUp: assign(({ context }) => {
      const { config, pendingFollowUp, voiceLib, transcriptions, speechEnabled } = context;
      if (!pendingFollowUp || !voiceLib) return { pendingFollowUp: null };

      const src = selectVoice(voiceLib, pendingFollowUp, config.voiceBasePath);
      if (!src) return { pendingFollowUp: null };

      const phrase = getTranscription(src, transcriptions);
      return {
        pendingFollowUp: null,
        currentSpeechText: phrase,
        isSpeaking: true,
        ...(speechEnabled ? audioIntent(src) : {}),
      };
    }),

    // ── Model farewell during disappear ───────
    playFarewell: assign(({ context }) => {
      const { config, currentModelId, voiceLib, transcriptions, speechEnabled } = context;
      if (!currentModelId) return {};

      const prefix = config.modelFarewellPrefixes[currentModelId];
      const variant = padVariant(0, config.modelFarewellVariants);
      const src = prefix
        ? config.voiceBasePath + `model_farewell/${prefix}_${variant}.m4a`
        : (voiceLib ? selectVoice(voiceLib, 'goodbye', config.voiceBasePath) : null);

      if (!src) return {};
      const phrase = getTranscription(src, transcriptions);
      return {
        currentSpeechText: phrase,
        isSpeaking: true,
        ...(speechEnabled ? audioIntent(src) : {}),
      };
    }),

    // ── Quick farewell for model switch (short "be right back" clips) ──
    playQuickFarewell: assign(({ context }) => {
      const { config, transcriptions, speechEnabled } = context;
      const idx = Math.floor(Math.random() * 3) + 1;
      const padded = String(idx).padStart(3, '0');
      const src = config.voiceBasePath + `model_farewell/gs_farewell_switch_${padded}.m4a`;
      const text = getTranscription(src, transcriptions) || 'Switching models...';
      return {
        currentSpeechText: text,
        isSpeaking: true,
        ...(speechEnabled ? audioIntent(src) : {}),
      };
    }),

    // ── Model selected actions ────────────────
    setCurrentModel: assign(({ event }) => ({
      currentModelId: (event as Extract<MachineEvent, { type: 'MODEL_SELECTED' }>).modelId,
      pendingModelId: null,
    })),

    setPendingModel: assign(({ event }) => ({
      pendingModelId: (event as Extract<MachineEvent, { type: 'MODEL_SELECTED' }>).modelId,
    })),

    clearGlow: assign({ modelCardsGlow: false }),

    // ── Replay same model commentary ──────────
    replaySameModelCommentary: assign(({ context }) => {
      const { config, currentModelId, speechEnabled } = context;
      if (!currentModelId) return {};

      const commentary = config.getModelCommentary(currentModelId);
      const prefix = config.modelVoicePrefixes[currentModelId];

      if (prefix) {
        const variant = padVariant(0, config.modelVoiceVariants);
        const src = config.voiceBasePath + `model_commentary/${prefix}_${variant}.m4a`;
        return {
          currentSpeechText: commentary,
          isSpeaking: true,
          speechPurpose: 'ambient' as const,
          ...(speechEnabled ? audioIntent(src) : {}),
        };
      }

      return {
        currentSpeechText: commentary,
        isSpeaking: true,
        speechPurpose: 'ambient' as const,
      };
    }),

    // ── Help request ──────────────────────────
    playHelp: assign(({ context, event }) => {
      if (event.type !== 'HELP_REQUESTED') return {};
      const help = context.config.detailedHelp[event.controlType];
      if (!help) return {};

      const voiceSrc = help.voiceFile
        ? context.config.voiceBasePath + help.voiceFile
        : (context.voiceLib ? selectVoice(context.voiceLib, 'wisdom', context.config.voiceBasePath) : null);

      return {
        currentSpeechText: help.text,
        isSpeaking: true,
        isHelpSpeaking: true,
        speechPurpose: 'instructional' as const,
        ...(context.speechEnabled && voiceSrc ? audioIntent(voiceSrc) : {}),
      };
    }),

    // ── Error trigger ─────────────────────────
    playError: assign(({ context, event }) => {
      if (event.type !== 'TRIGGER_ERROR') return {};
      const err = context.config.errors[event.errorId];
      if (!err) return {};

      const isRecovery = event.errorId === 'RECOVERY';

      // Map error IDs to voice clip prefixes for type-specific audio
      const errorPrefixMap: Record<string, string> = {
        'OOM': 'gs_error_oom_',
        'SHARD_ERROR': 'gs_error_shard_',
        'GPU_TIMEOUT': 'gs_error_timeout_',
        'RDMA_UNSTABLE': 'gs_error_rdma_',
        'CONTEXT_CAPPED': 'gs_error_context_',
        'Q2_HALLUCINATION': 'gs_error_q2_',
        'KV_OVERFLOW': 'gs_error_oom_',  // Reuse OOM clips
        'VRAM_HIGH_QUANT': 'gs_error_oom_',  // Reuse OOM clips
      };

      let voiceSrc: string | null = null;
      if (context.voiceLib) {
        if (isRecovery) {
          // Recovery: pick from encouragement or affirmation
          voiceSrc = selectVoice(context.voiceLib, 'encouragement', context.config.voiceBasePath)
            || selectVoice(context.voiceLib, 'affirmation', context.config.voiceBasePath);
        } else {
          const prefix = errorPrefixMap[event.errorId];
          const errorFiles = context.voiceLib['error'] || [];
          if (prefix) {
            // Filter to type-specific clips
            const matchingFiles = errorFiles.filter((f: string) => f.startsWith(prefix));
            if (matchingFiles.length > 0) {
              const file = matchingFiles[Math.floor(Math.random() * matchingFiles.length)];
              voiceSrc = context.config.voiceBasePath + 'error/' + file;
            }
          }
          // Fallback: any error clip
          if (!voiceSrc) {
            voiceSrc = selectVoice(context.voiceLib, 'error', context.config.voiceBasePath);
          }
        }
      }

      // Get transcription for the selected clip (for speech bubble text)
      const transcription = voiceSrc
        ? getTranscription(voiceSrc, context.transcriptions)
        : err.guru;

      // Flash animation: red "no" glow for errors, green "yes" glow for recovery
      const videoUpdate = isRecovery
        ? transitionVideo({ ...context, currentAnimCategory: null }, 'REACTING_YES', 'yes')
        : err.severity === 'error'
          ? transitionVideo({ ...context, currentAnimCategory: null }, 'REACTING_NO', 'no')
          : transitionVideo(context, 'TALKING', 'talk');

      return {
        currentSpeechText: transcription || err.guru,
        isSpeaking: true,
        speechPurpose: 'instructional' as const,
        systemMessage: err.system,
        systemSeverity: err.severity,
        ...videoUpdate,
        ...(context.speechEnabled && voiceSrc ? audioIntent(voiceSrc) : {}),
      };
    }),

    clearSystemMessage: assign({
      systemMessage: null,
      systemSeverity: null,
    }),

    // ── Avatar click ──────────────────────────
    playAvatarGreeting: assign(({ context }) => {
      const { config, voiceLib, transcriptions, speechEnabled, systemSeverity } = context;

      // If cluster is in error state, give fix advice with voice clip
      if (systemSeverity === 'error') {
        const hintCount = 10;
        const idx = Math.floor(Math.random() * hintCount) + 1;
        const padded = String(idx).padStart(3, '0');
        const clipPath = `error_hint/gs_error_hint_${padded}.m4a`;
        const fullPath = config.voiceBasePath + clipPath;
        const text = getTranscription(fullPath, transcriptions)
          || 'Try a different configuration — there is always a way.';
        return {
          currentSpeechText: text,
          isSpeaking: true,
          speechPurpose: 'instructional' as const,
          ...(speechEnabled ? audioIntent(fullPath) : {}),
        };
      }

      // Normal: random category from the pool
      const categories: VoiceCategory[] = ['wisdom', 'humor', 'encouragement', 'idle_factoid', 'greeting', 'thinking'];
      const category = categories[Math.floor(Math.random() * categories.length)];
      let text = 'You rang?';
      let audioSrc: string | null = null;

      if (voiceLib) {
        const src = selectVoice(voiceLib, category, config.voiceBasePath);
        if (src) {
          text = getTranscription(src, transcriptions);
          if (speechEnabled) audioSrc = src;
        }
      }

      return {
        currentSpeechText: text,
        isSpeaking: true,
        speechPurpose: 'ambient' as const,
        ...(audioSrc ? audioIntent(audioSrc) : {}),
      };
    }),

    // ── Music commentary ──────────────────────
    playMusicCommentary: assign(({ context }) => {
      const { config, currentModelId, speechEnabled } = context;
      if (!currentModelId || !speechEnabled) return {};

      const entry = config.musicCommentaryPrefixes[currentModelId];
      if (!entry) return {};

      const variant = padVariant(0, config.musicCommentaryVariants);
      const src = config.voiceBasePath + `${entry.dir}/${entry.prefix}_${variant}.m4a`;

      return {
        isSpeaking: true,
        currentSpeechText: '',
        speechPurpose: 'ambient' as const,
        ...audioIntent(src),
      };
    }),

    // ── Generic speak ─────────────────────────
    playVoiceCategory: assign(({ context, event }) => {
      if (event.type !== 'SPEAK') return {};
      const { config, voiceLib, transcriptions, speechEnabled } = context;
      if (!voiceLib) return {};

      const src = selectVoice(voiceLib, event.category, config.voiceBasePath);
      if (!src) return {};

      const phrase = getTranscription(src, transcriptions);
      return {
        currentSpeechText: phrase,
        isSpeaking: true,
        speechPurpose: 'ambient' as const,
        ...(speechEnabled ? audioIntent(src) : {}),
      };
    }),

    // ── Disappear → reappear flow ─────────────
    swapToPendingModel: assign(({ context }) => ({
      currentModelId: context.pendingModelId,
      pendingModelId: null,
      currentAnimCategory: null,
    })),

    // ── Onboarding actions ────────────────────
    setOnboardingStep: assign(({ event }) => {
      // This is a generic setter; specific step logic is in parameterOnboarding
      return {};
    }),

    advanceToPickModel: assign(({ context }) => {
      const { config, voiceLib, speechEnabled } = context;
      const text = config.onboardingPrompts.PICK_MODEL;
      const clip = config.onboardingClips.PICK_MODEL;
      return {
        onboardingStep: 'PICK_MODEL' as const,
        modelCardsGlow: true,
        currentSpeechText: text,
        isSpeaking: true,
        speechPurpose: 'instructional' as const,
        ...(speechEnabled && clip ? audioIntent(config.voiceBasePath + clip) : {}),
      };
    }),

    playOnboardingClusterIntro: assign(({ context }) => {
      const { config, speechEnabled } = context;
      const text = config.onboardingPrompts.INTRO_GREETING;
      const clip = config.onboardingClips.INTRO_GREETING;
      return {
        onboardingStep: 'INTRO_GREETING' as const,
        currentSpeechText: text,
        isSpeaking: true,
        speechPurpose: 'instructional' as const,
        ...(speechEnabled && clip ? audioIntent(config.voiceBasePath + clip) : {}),
      };
    }),

    playPendingOnboardingPrompt: assign(({ context }) => {
      const step = context.pendingOnboardingPrompt;
      if (!step) return {};
      const { config, speechEnabled } = context;
      const text = config.onboardingPrompts[step] || '';
      const clip = config.onboardingClips[step];
      return {
        pendingOnboardingPrompt: null as OnboardingStep,
        currentSpeechText: text,
        isSpeaking: true,
        speechPurpose: 'instructional' as const,
        ...(speechEnabled && clip ? audioIntent(config.voiceBasePath + clip) : {}),
      };
    }),

    // ── Parameter commentary ──────────────────
    playTopologyCommentary: assign(({ context, event }) => {
      if (event.type !== 'PARAMETER_CHANGED') return {};
      const { config, speechEnabled } = context;
      const commentary = config.getTopologyCommentary(event.value);
      const topoVoice = config.topologyVoiceMap[event.value];

      // ~40% chance of follow-up question
      const followUp: VoiceCategory | null = Math.random() < 0.4 ? 'question_responses' : null;

      if (topoVoice) {
        const variant = padVariant(0, topoVoice.variants);
        const src = config.voiceBasePath + `${topoVoice.dir}/${topoVoice.prefix}_${variant}.m4a`;
        return {
          currentSpeechText: commentary,
          isSpeaking: true,
          speechPurpose: 'ambient' as const,
          pendingFollowUp: followUp,
          ...(speechEnabled ? audioIntent(src) : {}),
        };
      }

      return {
        currentSpeechText: commentary,
        isSpeaking: true,
        speechPurpose: 'ambient' as const,
        pendingFollowUp: followUp,
      };
    }),

    playQuantCommentary: assign(({ context, event }) => {
      if (event.type !== 'PARAMETER_CHANGED') return {};
      const { config, currentModelId, speechEnabled } = context;
      const q = event.value.toUpperCase();
      const commentary = config.getQuantCommentary(event.value, currentModelId || '');
      const quantVoice = config.quantVoicePrefix[q];

      // Q2 error handling
      if (q === 'Q2') {
        const err = config.errors.Q2_HALLUCINATION;
        return {
          currentSpeechText: commentary,
          isSpeaking: true,
          speechPurpose: 'ambient' as const,
          systemMessage: err?.system || null,
          systemSeverity: err?.severity || null,
          ...(quantVoice && speechEnabled
            ? audioIntent(config.voiceBasePath + `quant_commentary/${quantVoice.prefix}_${padVariant(0, quantVoice.variants)}.m4a`)
            : {}),
        };
      }

      if (quantVoice) {
        const variant = padVariant(0, quantVoice.variants);
        const src = config.voiceBasePath + `quant_commentary/${quantVoice.prefix}_${variant}.m4a`;
        return {
          currentSpeechText: commentary,
          isSpeaking: true,
          speechPurpose: 'ambient' as const,
          ...(speechEnabled ? audioIntent(src) : {}),
        };
      }

      return {
        currentSpeechText: commentary,
        isSpeaking: true,
        speechPurpose: 'ambient' as const,
      };
    }),

    playContextCommentary: assign(({ context, event }) => {
      if (event.type !== 'PARAMETER_CHANGED') return {};
      const { config, speechEnabled } = context;
      const tokens = parseInt(event.value) || 4096;
      const commentary = config.getContextCommentary(tokens);
      const ctxVoice = config.contextVoicePrefix[tokens];

      if (ctxVoice) {
        const variant = padVariant(0, ctxVoice.variants);
        const src = config.voiceBasePath + `context_commentary/${ctxVoice.prefix}_${variant}.m4a`;
        return {
          currentSpeechText: commentary,
          isSpeaking: true,
          speechPurpose: 'ambient' as const,
          ...(speechEnabled ? audioIntent(src) : {}),
        };
      }

      return {
        currentSpeechText: commentary,
        isSpeaking: true,
        speechPurpose: 'ambient' as const,
      };
    }),

    playBatchCommentary: assign(({ context, event }) => {
      if (event.type !== 'PARAMETER_CHANGED') return {};
      const { config, speechEnabled } = context;
      const commentary = config.getBatchCommentary(event.value === 'true');

      // ~40% chance of follow-up question
      const followUp: VoiceCategory | null = Math.random() < 0.4 ? 'question_responses' : null;

      const batchVoice = config.batchVoicePrefix[event.value];
      if (batchVoice) {
        const variant = padVariant(0, batchVoice.variants);
        const src = config.voiceBasePath + `batch_commentary/${batchVoice.prefix}_${variant}.m4a`;
        return {
          currentSpeechText: commentary,
          isSpeaking: true,
          speechPurpose: 'ambient' as const,
          pendingFollowUp: followUp,
          ...(speechEnabled ? audioIntent(src) : {}),
        };
      }

      return {
        currentSpeechText: commentary,
        isSpeaking: true,
        speechPurpose: 'ambient' as const,
        pendingFollowUp: followUp,
      };
    }),

    // ── Onboarding parameter handlers ─────────
    onboardingModelSelected: assign(({ context, event }) => {
      if (event.type !== 'MODEL_SELECTED') return {};
      const { config, voiceLib, speechEnabled } = context;
      const commentary = config.getModelCommentary(event.modelId);

      // Set model, advance to PICK_QUANT, play commentary
      return {
        currentModelId: event.modelId,
        modelCardsGlow: false,
        onboardingStep: 'PICK_QUANT' as const,
        pendingOnboardingPrompt: 'PICK_QUANT' as OnboardingStep,
        currentSpeechText: commentary,
        isSpeaking: true,
        speechPurpose: 'instructional' as const,
        ...(speechEnabled && voiceLib
          ? audioIntent(selectVoice(voiceLib, 'affirmation', config.voiceBasePath) || '')
          : {}),
      };
    }),

    onboardingQuantSelected: assign(({ context }) => {
      const { config, speechEnabled } = context;
      const clip = config.onboardingClips.PICK_CONTEXT;
      return {
        onboardingStep: 'PICK_CONTEXT' as const,
        currentSpeechText: config.onboardingPrompts.PICK_CONTEXT,
        isSpeaking: true,
        speechPurpose: 'instructional' as const,
        ...(speechEnabled && clip ? audioIntent(config.voiceBasePath + clip) : {}),
      };
    }),

    onboardingContextSelected: assign(({ context }) => {
      const { config, speechEnabled } = context;
      const clip = config.onboardingClips.PICK_TOPOLOGY;
      return {
        onboardingStep: 'PICK_TOPOLOGY' as const,
        currentSpeechText: config.onboardingPrompts.PICK_TOPOLOGY,
        isSpeaking: true,
        speechPurpose: 'instructional' as const,
        ...(speechEnabled && clip ? audioIntent(config.voiceBasePath + clip) : {}),
      };
    }),

    onboardingTopologySelected: assign(({ context }) => {
      const { config, speechEnabled } = context;
      const clip = config.onboardingClips.LOADING;
      return {
        onboardingStep: 'LOADING' as const,
        pendingOnboardingPrompt: null as OnboardingStep,
        currentSpeechText: config.onboardingPrompts.LOADING,
        isSpeaking: true,
        speechPurpose: 'instructional' as const,
        ...(speechEnabled && clip ? audioIntent(config.voiceBasePath + clip) : {}),
      };
    }),

    // Interactive tutorial: user clicked TP5 (intentional break)
    onboardingBreakDetected: assign(({ context }) => {
      const { config, speechEnabled } = context;
      const clip = config.onboardingClips.EXPLAIN_BREAK;
      return {
        onboardingStep: 'EXPLAIN_BREAK' as const,
        currentSpeechText: config.onboardingPrompts.EXPLAIN_BREAK,
        isSpeaking: true,
        speechPurpose: 'instructional' as const,
        ...(speechEnabled && clip ? audioIntent(config.voiceBasePath + clip) : {}),
      };
    }),

    // Interactive tutorial: user clicked EP5 (recovery)
    onboardingEP5Selected: assign(({ context }) => {
      const { config, speechEnabled } = context;
      const clip = config.onboardingClips.EXPLAIN_EP5;
      const text = config.onboardingPrompts.EXPLAIN_EP5;
      return {
        onboardingStep: 'EXPLAIN_EP5' as const,
        currentSpeechText: text,
        isSpeaking: true,
        speechPurpose: 'instructional' as const,
        ...(speechEnabled && clip ? audioIntent(config.voiceBasePath + clip) : {}),
      };
    }),

    startTour: assign({
      onboardingStep: 'TOUR_NODE' as OnboardingStep,
    }),

    playTourStep: assign(({ context }) => {
      const step = context.onboardingStep;
      if (!step) return {};
      const { config, speechEnabled } = context;
      const text = config.onboardingPrompts[step] || '';
      // Tour clips exist for TOUR_ steps; other steps use text-only (no pre-recorded audio yet)
      const clip = config.tourClips[step];

      return {
        currentSpeechText: text,
        isSpeaking: true,
        speechPurpose: 'instructional' as const,
        ...(speechEnabled && clip ? audioIntent(config.voiceBasePath + clip) : {}),
      };
    }),

    advanceTour: assign(({ context }) => {
      const step = context.onboardingStep;
      if (!step) return {};
      const nextStep = TOUR_SEQUENCE[step];
      // nextStep is a string (next tour step) or null (tour complete)
      if (typeof nextStep === 'string') {
        return { onboardingStep: nextStep };
      }
      // Tour complete (nextStep is null or step not in sequence)
      return {
        onboardingStep: null as OnboardingStep,
        isSpeaking: false,
        currentSpeechText: '',
      };
    }),

    completeTour: assign({
      onboardingStep: null as OnboardingStep,
      isSpeaking: false,
      currentSpeechText: '',
    }),

    // ── Speech enabled/disabled ───────────────
    updateSpeechEnabled: assign(({ event }) => {
      if (event.type !== 'SPEECH_ENABLED_CHANGED') return {};
      return {
        speechEnabled: event.enabled,
        ...(event.enabled ? {} : {
          isSpeaking: false,
          currentSpeechText: '',
          ...stopAudioIntent(),
        }),
      };
    }),

    // ── Linger done ───────────────────────────
    clearLingeringSpeech: assign({
      isSpeaking: false,
      currentSpeechText: '',
      isHelpSpeaking: false,
      systemMessage: null,
      systemSeverity: null,
    }),

    // ── Selection prompt (inactivity) ─────────
    playSelectionPrompt: assign(({ context }) => {
      const { config, voiceLib, speechEnabled } = context;
      const text = config.onboardingPrompts.PICK_MODEL;
      let audioSrc: string | null = null;

      if (speechEnabled && voiceLib) {
        audioSrc = selectVoice(voiceLib, 'engagement', config.voiceBasePath);
      }

      return {
        currentSpeechText: text,
        isSpeaking: true,
        modelCardsGlow: true,
        speechPurpose: 'instructional' as const,
        ...(audioSrc ? audioIntent(audioSrc) : {}),
      };
    }),

    // ── Mode change ───────────────────────────
    cancelOnboarding: assign({
      onboardingStep: null as OnboardingStep,
      pendingOnboardingPrompt: null as OnboardingStep,
    }),

    // ── Playback rate ─────────────────────────
    setPlaybackRate: assign(({ event }) => {
      // Handled externally — playbackRate is not in machine events
      return {};
    }),
  },
}).createMachine({
  id: 'character',
  initial: 'waiting',
  context: ({ input }) => ({
    config: input.config,
    videoSrcA: '',
    videoSrcB: '',
    activeSlot: 'A' as ActiveSlot,
    isLooping: false,
    playbackRate: 1.0,
    currentAnimCategory: null,
    isSpeaking: false,
    currentSpeechText: '',
    speechEnabled: input.speechEnabled,
    isHelpSpeaking: false,
    speechPurpose: 'ambient' as const,
    pendingAudioSrc: null,
    pendingAudioAction: null,
    systemMessage: null,
    systemSeverity: null,
    modelCardsGlow: false,
    onboardingStep: (input.skipOnboarding ? null : 'INTRO') as OnboardingStep,
    hasAppeared: false,
    hasGreeted: false,
    pendingModelId: null,
    currentModelId: null,
    pendingModelCommentary: null,
    pendingFollowUp: null,
    pendingOnboardingPrompt: null,
    library: null,
    voiceLib: null,
    transcriptions: null,
    setDucking: null,
  }),

  // Global events handled in any state
  on: {
    SPEECH_ENABLED_CHANGED: { actions: 'updateSpeechEnabled' },
    MODE_CHANGED: {
      actions: 'cancelOnboarding',
      guard: () => false, // LIVE mode removed — onboarding never cancelled by mode switch
    },
    SKIP_ONBOARDING: {
      actions: ['cancelOnboarding', 'stopAudio', 'clearSpeech', 'transitionToIdle'],
      target: '.idle',
    },
  },

  states: {
    waiting: {
      on: {
        LIBRARY_LOADED: [
          // During onboarding: just store library, stay in waiting until user clicks "I'm new here"
          {
            guard: 'isOnboarding',
            actions: ['storeLibrary'],
            target: 'waiting',
          },
          // Normal (skipped onboarding): appear with random channel greeting
          {
            actions: ['storeLibrary', 'setHasGreeted', 'transitionToAppearing', 'playChannelGreeting'],
            target: 'appearing',
          },
        ],
        // User clicked "I'm new here" — start the guru intro (library must be loaded)
        WELCOME_DISMISSED: {
          guard: ({ context }) => context.library !== null,
          actions: ['setHasGreeted', 'transitionToAppearing'],
          target: 'appearing',
        },
        MODEL_SELECTED: [
          // During onboarding PICK_MODEL
          {
            guard: 'isPickModel',
            actions: ['onboardingModelSelected'],
            target: 'waiting',
          },
          // First model (no previous model loaded) — skip onboarding path
          {
            actions: ['setCurrentModel', 'transitionToAppearing'],
            target: 'appearing',
          },
        ],
      },
    },

    appearing: {
      entry: 'setHasAppeared',
      on: {
        // Library may load AFTER we enter appearing (MODEL_SELECTED before LIBRARY_LOADED)
        LIBRARY_LOADED: {
          actions: ['storeLibrary', 'reloadAppearVideo'],
        },
        VIDEO_ENDED: [
          // During onboarding: wave + start cluster intro speech (not random greeting)
          {
            guard: 'isOnboarding',
            actions: ['transitionToWaving', 'playOnboardingClusterIntro'],
            target: 'waving',
          },
          // Normal: wave + model greeting
          {
            actions: ['transitionToWaving', 'playModelGreeting'],
            target: 'waving',
          },
        ],
        MODEL_SELECTED: {
          // Ignore during appear — just track for later
          actions: assign(({ event }) => ({
            currentModelId: (event as Extract<MachineEvent, { type: 'MODEL_SELECTED' }>).modelId,
          })),
        },
      },
    },

    waving: {
      on: {
        VIDEO_ENDED: [
          {
            guard: 'isSpeaking',
            actions: 'transitionToTalking',
            target: 'talking',
          },
          {
            actions: 'transitionToIdle',
            target: 'idle',
          },
        ],
        AUDIO_ENDED: {
          // Audio ended during wave — will transition to idle after wave video ends
        },
        // Onboarding speech can finish while wave video is still playing
        // Advance to next intro step (or PICK_MODEL if at end of intro chain)
        ONBOARDING_SPEECH_DONE: [
          {
            guard: ({ context }) => context.onboardingStep === 'INTRO_GREETING',
            actions: [assign(({ context }) => ({
              onboardingStep: 'INTRO_HELP' as OnboardingStep,
              currentSpeechText: context.config.onboardingPrompts.INTRO_HELP,
              isSpeaking: true,
            }))],
            target: 'talking',
          },
          {
            guard: ({ context }) => context.onboardingStep === 'INTRO' || context.onboardingStep === 'INTRO_CLUSTER' || context.onboardingStep === 'INTRO_CONTROLS',
            actions: 'advanceToPickModel',
            target: 'talking',
          },
        ],
        MODEL_SELECTED: {
          actions: assign(({ event }) => ({
            currentModelId: (event as Extract<MachineEvent, { type: 'MODEL_SELECTED' }>).modelId,
          })),
        },
      },
    },

    talking: {
      on: {
        AUDIO_ENDED: [
          // Help speech: linger text, go to idle
          {
            guard: ({ context }) => context.isHelpSpeaking,
            actions: 'transitionToIdle',
            target: 'idle',
            // Adapter hook will handle 30s linger timer
          },
          // Onboarding speech done: adapter sends ONBOARDING_SPEECH_DONE
          {
            guard: 'isOnboarding',
            target: 'talking',
            // Stay in talking, adapter will handle onboarding flow progression
          },
          // Chained commentary after greeting
          {
            guard: 'hasPendingCommentary',
            actions: ['playPendingCommentary', 'transitionToTalking'],
            target: 'talking',
          },
          // Chained follow-up voice
          {
            guard: 'hasPendingFollowUp',
            actions: ['playPendingFollowUp'],
            target: 'talking',
          },
          // Normal: go to idle, text lingers
          {
            actions: 'transitionToIdle',
            target: 'idle',
            // Adapter hook handles 30s text linger
          },
        ],
        AUDIO_FAILED: {
          actions: ['clearSpeech', 'transitionToIdle'],
          target: 'idle',
        },
        SILENT_SPEECH_DONE: [
          {
            guard: 'hasPendingCommentary',
            actions: 'playPendingCommentary',
            target: 'talking',
          },
          {
            guard: 'hasPendingFollowUp',
            actions: 'playPendingFollowUp',
            target: 'talking',
          },
          {
            actions: ['clearSpeech', 'transitionToIdle'],
            target: 'idle',
          },
        ],
        ONBOARDING_SPEECH_DONE: [
          // Intro chain: INTRO_GREETING → INTRO_HELP → INTRO_ROLE → INTRO_CONTROLS → PICK_MODEL
          // Each step plays its v3 audio clip with emotion tags
          {
            guard: ({ context }) => context.onboardingStep === 'INTRO_GREETING',
            actions: [assign(({ context }) => {
              const { config, speechEnabled } = context;
              const clip = config.onboardingClips.INTRO_HELP;
              return {
                onboardingStep: 'INTRO_HELP' as OnboardingStep,
                currentSpeechText: config.onboardingPrompts.INTRO_HELP,
                isSpeaking: true,
                ...(speechEnabled && clip ? audioIntent(config.voiceBasePath + clip) : {}),
              };
            })],
            target: 'talking',
          },
          {
            guard: ({ context }) => context.onboardingStep === 'INTRO_HELP',
            actions: [assign(({ context }) => {
              const { config, speechEnabled } = context;
              const clip = config.onboardingClips.INTRO_ROLE;
              return {
                onboardingStep: 'INTRO_ROLE' as OnboardingStep,
                currentSpeechText: config.onboardingPrompts.INTRO_ROLE,
                isSpeaking: true,
                ...(speechEnabled && clip ? audioIntent(config.voiceBasePath + clip) : {}),
              };
            })],
            target: 'talking',
          },
          {
            guard: ({ context }) => context.onboardingStep === 'INTRO_ROLE',
            actions: [assign(({ context }) => {
              const { config, speechEnabled } = context;
              const clip = config.onboardingClips.INTRO_CONTROLS;
              return {
                onboardingStep: 'INTRO_CONTROLS' as OnboardingStep,
                currentSpeechText: config.onboardingPrompts.INTRO_CONTROLS,
                isSpeaking: true,
                ...(speechEnabled && clip ? audioIntent(config.voiceBasePath + clip) : {}),
              };
            })],
            target: 'talking',
          },
          {
            guard: ({ context }) => context.onboardingStep === 'INTRO' || context.onboardingStep === 'INTRO_CLUSTER' || context.onboardingStep === 'INTRO_CONTROLS',
            actions: 'advanceToPickModel',
            target: 'talking',
          },
          // Pending onboarding prompt (one-shot: plays then clears)
          {
            guard: ({ context }) => context.pendingOnboardingPrompt !== null,
            actions: 'playPendingOnboardingPrompt',
            target: 'talking',
          },
          // Loading complete → start tour (controls stay locked during tour)
          {
            guard: ({ context }) => context.onboardingStep === 'LOADING',
            actions: ['startTour', 'playTourStep'],
            target: 'talking',
          },
          // Tour step → advance. Steps that wait for user action go to idle.
          {
            guard: ({ context }) => {
              const step = context.onboardingStep;
              return step !== null && (step.startsWith('TOUR_') || step === 'EXPLAIN_BREAK'
                || step === 'EXPLAIN_EP5' || step === 'FREEPLAY'
                || step === 'REWARD_INTRO');
            },
            actions: ['advanceTour', 'playTourStep'],
            target: 'talking',
          },
          // Interactive steps: after speech done, go to idle and wait for user click
          {
            guard: ({ context }) => {
              const step = context.onboardingStep;
              return step === 'TRY_BREAK' || step === 'TRY_EP5' || step === 'TRY_CLICK_GURU';
            },
            actions: 'transitionToIdle',
            target: 'idle',
          },
          // Tutorial complete → end onboarding
          {
            guard: ({ context }) => context.onboardingStep === 'COMPLETE',
            actions: [assign({ onboardingStep: null as OnboardingStep }), 'transitionToIdle'],
            target: 'idle',
          },
          // Fallback
          {
            actions: ['clearSpeech', 'transitionToIdle'],
            target: 'idle',
          },
        ],
        VIDEO_ENDED: {
          // Talk video ended but audio still playing — stay (video loops)
        },
        MODEL_SELECTED: [
          // During onboarding PICK_MODEL or INTRO_CONTROLS: advance to PICK_QUANT
          {
            guard: ({ context }) => context.onboardingStep === 'PICK_MODEL'
              || context.onboardingStep === 'INTRO_CONTROLS',
            actions: ['interruptSpeech', 'onboardingModelSelected'],
            target: 'talking',
          },
          // During other onboarding steps: just track model
          {
            guard: 'isOnboarding',
            actions: assign(({ event }) => ({
              currentModelId: (event as Extract<MachineEvent, { type: 'MODEL_SELECTED' }>).modelId,
            })),
          },
          // Same model: just replay commentary
          {
            guard: 'isSameModel',
            actions: ['interruptSpeech', 'replaySameModelCommentary', 'transitionToTalking'],
            target: 'talking',
          },
          // Different model: disappear → reappear with new greeting
          {
            actions: ['interruptSpeech', 'playQuickFarewell', 'setPendingModel', 'transitionToDisappearing'],
            target: 'disappearing',
          },
        ],
        PARAMETER_CHANGED: [
          // Onboarding quant selection
          {
            guard: ({ context, event }) =>
              (event as Extract<MachineEvent, { type: 'PARAMETER_CHANGED' }>).paramType === 'quantization'
              && context.onboardingStep === 'PICK_QUANT',
            actions: ['interruptSpeech', 'onboardingQuantSelected'],
            target: 'talking',
          },
          // Onboarding context selection
          {
            guard: ({ context, event }) =>
              (event as Extract<MachineEvent, { type: 'PARAMETER_CHANGED' }>).paramType === 'kvCache'
              && context.onboardingStep === 'PICK_CONTEXT',
            actions: ['interruptSpeech', 'onboardingContextSelected'],
            target: 'talking',
          },
          // Onboarding topology selection (EP1 for initial load)
          {
            guard: ({ context, event }) =>
              (event as Extract<MachineEvent, { type: 'PARAMETER_CHANGED' }>).paramType === 'topology'
              && context.onboardingStep === 'PICK_TOPOLOGY',
            actions: ['interruptSpeech', 'onboardingTopologySelected', 'transitionToReactingYes'],
            target: 'reactingYes',
          },
          // Interactive break: user clicks TP5 during TRY_BREAK step
          {
            guard: ({ context, event }) => {
              const e = event as Extract<MachineEvent, { type: 'PARAMETER_CHANGED' }>;
              return e.paramType === 'topology' && e.value === 'TP5_RDMA'
                && context.onboardingStep === 'TRY_BREAK';
            },
            actions: ['interruptSpeech', 'onboardingBreakDetected'],
            target: 'talking',
          },
          // Interactive recovery: user clicks EP5 during TRY_EP5 step
          {
            guard: ({ context, event }) => {
              const e = event as Extract<MachineEvent, { type: 'PARAMETER_CHANGED' }>;
              return e.paramType === 'topology' && e.value === 'EP5_SOLO'
                && context.onboardingStep === 'TRY_EP5';
            },
            actions: ['interruptSpeech', 'onboardingEP5Selected', 'transitionToReactingYes'],
            target: 'reactingYes',
          },
          // Other onboarding params — no-op
          {
            guard: 'isOnboardingNotLoading',
          },
          // ── Barge: non-onboarding parameter changes interrupt current speech ──
          // Topology → think then comment
          {
            guard: ({ context, event }) =>
              (event as Extract<MachineEvent, { type: 'PARAMETER_CHANGED' }>).paramType === 'topology'
              && !context.onboardingStep,
            actions: ['interruptSpeech', 'transitionToThinking'],
            target: 'thinkingTopology',
          },
          // Quantization → immediate commentary
          {
            guard: ({ context, event }) => {
              const e = event as Extract<MachineEvent, { type: 'PARAMETER_CHANGED' }>;
              return e.paramType === 'quantization' && !context.onboardingStep;
            },
            actions: ['interruptSpeech', 'playQuantCommentary', 'transitionToTalking'],
            target: 'talking',
          },
          // KV Cache → immediate commentary (not during onboarding)
          {
            guard: ({ context, event }) =>
              (event as Extract<MachineEvent, { type: 'PARAMETER_CHANGED' }>).paramType === 'kvCache'
              && !context.onboardingStep,
            actions: ['interruptSpeech', 'playContextCommentary', 'transitionToTalking'],
            target: 'talking',
          },
          // Batch mode → immediate commentary (not during onboarding)
          {
            guard: ({ context, event }) =>
              (event as Extract<MachineEvent, { type: 'PARAMETER_CHANGED' }>).paramType === 'batchMode'
              && !context.onboardingStep,
            actions: ['interruptSpeech', 'playBatchCommentary', 'transitionToTalking'],
            target: 'talking',
          },
        ],
        HELP_REQUESTED: {
          // Block during onboarding — tutorial must not be interrupted
          guard: 'isNotOnboarding',
          actions: ['interruptSpeech', 'playHelp', 'transitionToTalking'],
          target: 'talking',
        },
        TRIGGER_ERROR: {
          // Block during onboarding — errors discovered after tutorial
          guard: 'isNotOnboarding',
          actions: ['interruptSpeech', 'playError', 'transitionToReactingNo'],
          target: 'reactingNo',
        },
        SPEAK: {
          // Ignore idle chatter during onboarding — tutorial narration must not be interrupted
          guard: 'isNotOnboarding',
          actions: ['interruptSpeech', 'playVoiceCategory', 'transitionToTalking'],
          target: 'talking',
        },
      },
    },

    idle: {
      on: {
        SPEAK: {
          guard: 'isNotOnboarding',
          actions: ['playVoiceCategory', 'transitionToTalking'],
          target: 'talking',
        },
        MODEL_SELECTED: [
          // During onboarding PICK_MODEL
          {
            guard: 'isPickModel',
            actions: ['onboardingModelSelected'],
            target: 'talking',
          },
          // Same model
          {
            guard: 'isSameModel',
            actions: ['replaySameModelCommentary', 'transitionToTalking'],
            target: 'talking',
          },
          // Different model: disappear → reappear with new greeting
          {
            actions: ['playQuickFarewell', 'setPendingModel', 'transitionToDisappearing'],
            target: 'talking',
          },
        ],
        PARAMETER_CHANGED: [
          // Onboarding quant
          {
            guard: ({ context, event }) =>
              (event as Extract<MachineEvent, { type: 'PARAMETER_CHANGED' }>).paramType === 'quantization'
              && context.onboardingStep === 'PICK_QUANT',
            actions: ['onboardingQuantSelected', 'transitionToTalking'],
            target: 'talking',
          },
          // Onboarding context
          {
            guard: ({ context, event }) =>
              (event as Extract<MachineEvent, { type: 'PARAMETER_CHANGED' }>).paramType === 'kvCache'
              && context.onboardingStep === 'PICK_CONTEXT',
            actions: ['onboardingContextSelected', 'transitionToTalking'],
            target: 'talking',
          },
          // Onboarding topology (initial EP1 load)
          {
            guard: ({ context, event }) =>
              (event as Extract<MachineEvent, { type: 'PARAMETER_CHANGED' }>).paramType === 'topology'
              && context.onboardingStep === 'PICK_TOPOLOGY',
            actions: ['onboardingTopologySelected', 'transitionToReactingYes'],
            target: 'reactingYes',
          },
          // Interactive break: TP5 click during TRY_BREAK
          {
            guard: ({ context, event }) => {
              const e = event as Extract<MachineEvent, { type: 'PARAMETER_CHANGED' }>;
              return e.paramType === 'topology' && e.value === 'TP5_RDMA'
                && context.onboardingStep === 'TRY_BREAK';
            },
            actions: ['onboardingBreakDetected', 'transitionToTalking'],
            target: 'talking',
          },
          // Interactive recovery: EP5 click during TRY_EP5
          {
            guard: ({ context, event }) => {
              const e = event as Extract<MachineEvent, { type: 'PARAMETER_CHANGED' }>;
              return e.paramType === 'topology' && e.value === 'EP5_SOLO'
                && context.onboardingStep === 'TRY_EP5';
            },
            actions: ['onboardingEP5Selected', 'transitionToReactingYes'],
            target: 'reactingYes',
          },
          // Model parameter → handled via adapter
          {
            guard: ({ event }) =>
              (event as Extract<MachineEvent, { type: 'PARAMETER_CHANGED' }>).paramType === 'model',
            // Adapter converts to MODEL_SELECTED
          },
          // Topology
          {
            guard: ({ context, event }) =>
              (event as Extract<MachineEvent, { type: 'PARAMETER_CHANGED' }>).paramType === 'topology'
              && !context.onboardingStep,
            actions: ['interruptSpeech', 'transitionToThinking'],
            target: 'thinkingTopology',
          },
          // Quantization
          {
            guard: ({ context, event }) => {
              const e = event as Extract<MachineEvent, { type: 'PARAMETER_CHANGED' }>;
              return e.paramType === 'quantization' && !context.onboardingStep;
            },
            actions: ['interruptSpeech', 'playQuantCommentary', 'transitionToTalking'],
            target: 'talking',
          },
          // KV Cache
          {
            guard: ({ event }) =>
              (event as Extract<MachineEvent, { type: 'PARAMETER_CHANGED' }>).paramType === 'kvCache',
            actions: ['interruptSpeech', 'playContextCommentary', 'transitionToTalking'],
            target: 'talking',
          },
          // Batch mode
          {
            guard: ({ event }) =>
              (event as Extract<MachineEvent, { type: 'PARAMETER_CHANGED' }>).paramType === 'batchMode',
            actions: ['interruptSpeech', 'playBatchCommentary', 'transitionToTalking'],
            target: 'talking',
          },
        ],
        HELP_REQUESTED: {
          guard: 'isNotOnboarding',
          actions: ['interruptSpeech', 'playHelp', 'transitionToTalking'],
          target: 'talking',
        },
        TRIGGER_ERROR: {
          guard: 'isNotOnboarding',
          actions: ['playError', 'transitionToReactingNo'],
          target: 'reactingNo',
        },
        AVATAR_CLICKED: {
          guard: 'isNotOnboarding',
          actions: ['interruptSpeech', 'playAvatarGreeting', 'transitionToWaving'],
          target: 'waving',
        },
        MUSIC_TRACK_CHANGED: {
          guard: 'shouldCommentTrack',
          actions: ['playMusicCommentary', 'transitionToTalking'],
          target: 'talking',
        },
        SPEECH_LINGER_DONE: {
          actions: 'clearLingeringSpeech',
        },
        // Onboarding hint: user stuck on a PICK step for 30s
        ONBOARDING_HINT: {
          guard: 'isOnboarding',
          actions: [assign(({ event }) => ({
            currentSpeechText: (event as Extract<MachineEvent, { type: 'ONBOARDING_HINT' }>).hint,
            isSpeaking: true,
            speechPurpose: 'instructional' as const,
          })), 'transitionToTalking'],
          target: 'talking',
        },
        // Onboarding speech done while idle:
        // - LOADING: start the tour
        // - TRY_CLICK_GURU: avatar was clicked, advance to reward
        // - TOUR/EXPLAIN/FREEPLAY/COMPLETE narration steps: advance
        // - PICK/TRY steps: no-op (user must click the button)
        ONBOARDING_SPEECH_DONE: [
          {
            guard: ({ context }) => context.onboardingStep === 'LOADING',
            actions: ['startTour', 'playTourStep', 'transitionToTalking'],
            target: 'talking',
          },
          {
            guard: ({ context }) => context.onboardingStep === 'TRY_CLICK_GURU',
            actions: [assign(({ context }) => {
              const { config, speechEnabled } = context;
              const clip = config.onboardingClips.REWARD_INTRO || config.tourClips.REWARD_INTRO;
              return {
                onboardingStep: 'REWARD_INTRO' as OnboardingStep,
                currentSpeechText: config.onboardingPrompts.REWARD_INTRO,
                isSpeaking: true,
                ...(speechEnabled && clip ? audioIntent(config.voiceBasePath + clip) : {}),
              };
            }), 'transitionToTalking'],
            target: 'talking',
          },
          {
            guard: ({ context }) => {
              const step = context.onboardingStep;
              if (!step) return false;
              return step.startsWith('TOUR_') || step.startsWith('EXPLAIN_')
                || step === 'FREEPLAY' || step === 'REWARD_INTRO' || step === 'COMPLETE';
            },
            actions: ['advanceTour', 'playTourStep', 'transitionToTalking'],
            target: 'talking',
          },
          {
            guard: 'isOnboarding',
            // PICK/TRY steps: stay in idle, user must click
          },
        ],
        VIDEO_ENDED: {
          // Idle video looped — ignore
        },
      },
    },

    // Topology thinking: brief delay then commentary
    thinkingTopology: {
      entry: 'transitionToThinking',
      // The adapter handles the 500ms delay, then sends a follow-up event
      on: {
        // After delay, adapter re-sends PARAMETER_CHANGED which transitions to talking
        PARAMETER_CHANGED: {
          guard: ({ event }) =>
            (event as Extract<MachineEvent, { type: 'PARAMETER_CHANGED' }>).paramType === 'topology',
          actions: ['playTopologyCommentary', 'transitionToTalking'],
          target: 'talking',
        },
        AUDIO_ENDED: {
          actions: ['clearSpeech', 'transitionToIdle'],
          target: 'idle',
        },
        VIDEO_ENDED: {
          // Think video loops — ignore
        },
        MODEL_SELECTED: {
          actions: ['interruptSpeech', 'playQuickFarewell', 'setPendingModel', 'transitionToDisappearing'],
          target: 'disappearing',
        },
        HELP_REQUESTED: {
          actions: ['interruptSpeech', 'playHelp', 'transitionToTalking'],
          target: 'talking',
        },
      },
    },

    thinking: {
      on: {
        MODEL_SELECTED: {
          actions: ['interruptSpeech', 'playQuickFarewell', 'setPendingModel', 'transitionToDisappearing'],
          target: 'disappearing',
        },
        AUDIO_ENDED: {
          actions: ['transitionToIdle'],
          target: 'idle',
        },
        VIDEO_ENDED: {
          // Think video loops
        },
      },
    },

    disappearing: {
      on: {
        VIDEO_ENDED: {
          actions: ['swapToPendingModel', 'transitionToAppearing'],
          target: 'appearing',
        },
        // Ignore other events during disappear
      },
    },

    reactingYes: {
      on: {
        VIDEO_ENDED: {
          actions: 'transitionToIdle',
          target: 'idle',
        },
        AUDIO_ENDED: {
          // Audio may end before video — stay in reactingYes
        },
      },
    },

    reactingNo: {
      on: {
        VIDEO_ENDED: [
          // If still speaking (error audio), transition to talking
          {
            guard: 'isSpeaking',
            actions: 'transitionToTalking',
            target: 'talking',
          },
          // Otherwise go idle
          {
            actions: 'transitionToIdle',
            target: 'idle',
          },
        ],
        AUDIO_ENDED: {
          // Audio may end before video — stay in reactingNo until video finishes
        },
      },
    },

    listening: {
      on: {
        PARAMETER_CHANGED: {
          // Debounce handled by adapter
        },
        VIDEO_ENDED: {
          // Listen video loops
        },
        AUDIO_ENDED: {
          actions: 'transitionToIdle',
          target: 'idle',
        },
      },
    },
  },
});

export { stateToCategory, getLoopBehavior, selectVariant, selectVoice, getTranscription, padVariant };
