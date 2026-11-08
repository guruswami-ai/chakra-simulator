import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { useMachine } from '@xstate/react';
import { characterMachine } from './machine';
import type {
  CharacterConfig,
  GuruswamiStateReturn,
  GuruswamiStateProps,
  VoiceCategory,
  AnimLibrary,
  VoiceLibrary,
  OnboardingStep,
} from './types';

export function useCharacterMachine(
  config: CharacterConfig,
  { speechEnabled, mode = 'SIM', setDucking }: GuruswamiStateProps,
): GuruswamiStateReturn {
  const isLive = false;
  const hasCompletedOnboarding = typeof window !== 'undefined' &&
    localStorage.getItem('chakra-onboarding-complete') === 'true';
  const skipOnboarding = isLive || hasCompletedOnboarding;

  // Stable input for machine — only computed once
  const machineInput = useMemo(() => ({
    config,
    skipOnboarding,
    speechEnabled,
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }), []);  // Intentionally empty — input is only used at machine creation

  const [state, send] = useMachine(characterMachine, {
    input: machineInput,
  });

  const ctx = state.context;
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const speechLingerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const silentTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inactivityTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const setDuckingRef = useRef(setDucking);
  const isHelpSpeakingRef = useRef(false);
  const onboardingStepRef = useRef<OnboardingStep>(ctx.onboardingStep ?? null);
  const [playbackRate, setPlaybackRate] = useState(1.0);
  // Track previous pendingAudioSrc to detect changes
  const prevAudioSrcRef = useRef<string | null>(null);
  const prevAudioActionRef = useRef<'play' | 'stop' | null>(null);

  useEffect(() => { setDuckingRef.current = setDucking; }, [setDucking]);

  // Sync refs from machine context (avoids stale closures in audio handler)
  useEffect(() => {
    isHelpSpeakingRef.current = ctx.isHelpSpeaking;
  }, [ctx.isHelpSpeaking]);
  useEffect(() => {
    onboardingStepRef.current = ctx.onboardingStep;
  }, [ctx.onboardingStep]);

  // ── Unlock audio on first user interaction ──────────────────────
  // Browsers block Audio.play() unless the element has been "warmed up"
  // during a user gesture. We attach a one-shot listener that plays
  // a silent buffer to unlock the audio pipeline.
  useEffect(() => {
    const unlock = () => {
      const audio = audioRef.current;
      if (audio) {
        // Play a tiny silent buffer to unlock the audio element
        audio.src = 'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQAAAAA=';
        audio.volume = 0;
        audio.play().then(() => {
          audio.pause();
          audio.volume = 0.35;
          audio.src = '';
          console.log('[guru] Audio unlocked via user gesture');
        }).catch(() => {});
      }
      document.removeEventListener('click', unlock);
      document.removeEventListener('touchstart', unlock);
      document.removeEventListener('keydown', unlock);
    };
    document.addEventListener('click', unlock, { once: true });
    document.addEventListener('touchstart', unlock, { once: true });
    document.addEventListener('keydown', unlock, { once: true });
    return () => {
      document.removeEventListener('click', unlock);
      document.removeEventListener('touchstart', unlock);
      document.removeEventListener('keydown', unlock);
    };
  }, []);

  // ── Audio element lifecycle ─────────────────────────────────────
  useEffect(() => {
    const audio = new Audio();
    audio.volume = 0.35;
    audio.preload = 'auto';
    audioRef.current = audio;

    const handleEnded = () => {
      // Clear any silent timer since real audio ended
      if (silentTimerRef.current) {
        clearTimeout(silentTimerRef.current);
        silentTimerRef.current = null;
      }

      // If onboarding, send special event (use ref to avoid stale closure)
      if (onboardingStepRef.current !== null) {
        // After LOADING: pause 3s so user sees the running cluster before tour starts
        const delay = onboardingStepRef.current === 'LOADING' ? 3000 : 0;
        setTimeout(() => send({ type: 'ONBOARDING_SPEECH_DONE' }), delay);
        return;
      }

      // Help speech linger: keep text visible for 30s
      if (isHelpSpeakingRef.current) {
        send({ type: 'AUDIO_ENDED' });
        speechLingerRef.current = setTimeout(() => {
          send({ type: 'SPEECH_LINGER_DONE' });
        }, 30000);
        return;
      }

      send({ type: 'AUDIO_ENDED' });

      // Normal speech linger (30s)
      speechLingerRef.current = setTimeout(() => {
        send({ type: 'SPEECH_LINGER_DONE' });
      }, 30000);
    };

    const handleError = () => {
      send({ type: 'AUDIO_FAILED' });
    };

    audio.addEventListener('ended', handleEnded);
    audio.addEventListener('error', handleError);

    return () => {
      audio.removeEventListener('ended', handleEnded);
      audio.removeEventListener('error', handleError);
      audio.pause();
      audio.src = '';
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);  // Audio element created once

  // ── Drive audio from machine context ────────────────────────────
  // When the machine sets pendingAudioSrc/pendingAudioAction, we execute it
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const src = ctx.pendingAudioSrc;
    const action = ctx.pendingAudioAction;

    // Only act on changes
    if (src === prevAudioSrcRef.current && action === prevAudioActionRef.current) return;
    prevAudioSrcRef.current = src;
    prevAudioActionRef.current = action;

    // Clear any pending silent timer
    if (silentTimerRef.current) {
      clearTimeout(silentTimerRef.current);
      silentTimerRef.current = null;
    }
    if (speechLingerRef.current) {
      clearTimeout(speechLingerRef.current);
      speechLingerRef.current = null;
    }

    if (action === 'stop') {
      audio.pause();
      audio.currentTime = 0;
      return;
    }

    if (action === 'play' && src) {
      console.log('[guru] Audio play:', src, 'speechEnabled:', ctx.speechEnabled);
      // If speech is disabled, use silent timer instead
      if (!ctx.speechEnabled) {
        const text = ctx.currentSpeechText;
        const duration = Math.max(1500, (text.length / 10) * 1000);
        silentTimerRef.current = setTimeout(() => {
          if (onboardingStepRef.current !== null) {
            send({ type: 'ONBOARDING_SPEECH_DONE' });
          } else {
            send({ type: 'SILENT_SPEECH_DONE' });
          }
        }, duration);
        return;
      }

      // Stop any current audio
      if (!audio.paused) {
        audio.pause();
        audio.currentTime = 0;
      }

      audio.src = src;
      audio.load();
      audio.play().catch((err) => {
        console.warn('[guru] Audio autoplay blocked:', err?.message, 'src:', src);
        // Autoplay blocked or error — use silent timer fallback
        const text = ctx.currentSpeechText;
        const duration = Math.max(1500, (text.length / 10) * 1000);
        silentTimerRef.current = setTimeout(() => {
          // During onboarding: advance the tutorial (not just clear speech)
          if (onboardingStepRef.current !== null) {
            send({ type: 'ONBOARDING_SPEECH_DONE' });
          } else {
            send({ type: 'SILENT_SPEECH_DONE' });
          }
        }, duration);
      });
    }
  }, [ctx.pendingAudioSrc, ctx.pendingAudioAction, ctx.speechEnabled, ctx.currentSpeechText, send]);

  // ── Speech enabled toggle ──────────────────────────────────────
  useEffect(() => {
    send({ type: 'SPEECH_ENABLED_CHANGED', enabled: speechEnabled });
    if (!speechEnabled) {
      const audio = audioRef.current;
      if (audio) {
        audio.pause();
        audio.src = '';
      }
    }
  }, [speechEnabled, send]);

  // ── Mode change ────────────────────────────────────────────────
  useEffect(() => {
    send({ type: 'MODE_CHANGED', mode: mode || 'SIM' });
  }, [mode, send]);

  // ── Music ducking ──────────────────────────────────────────────
  // Duck when audio is actually playing (not during the 30s text linger period).
  // Track the audio element's play state, not the state machine's isSpeaking flag,
  // because isSpeaking stays true for 30s after audio ends (text linger).
  const isAudioPlayingRef = useRef(false);
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    const onPlay = () => {
      isAudioPlayingRef.current = true;
      setDuckingRef.current?.(true);
    };
    const onPauseOrEnd = () => {
      isAudioPlayingRef.current = false;
      setDuckingRef.current?.(false);
    };
    const onError = () => {
      isAudioPlayingRef.current = false;
      setDuckingRef.current?.(false);
    };
    audio.addEventListener('play', onPlay);
    audio.addEventListener('pause', onPauseOrEnd);
    audio.addEventListener('ended', onPauseOrEnd);
    audio.addEventListener('error', onError);
    return () => {
      audio.removeEventListener('play', onPlay);
      audio.removeEventListener('pause', onPauseOrEnd);
      audio.removeEventListener('ended', onPauseOrEnd);
      audio.removeEventListener('error', onError);
    };
  }, []);

  // ── Library loading ────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;

    console.log('[guru] Loading libraries from:', config.animLibraryUrl, config.voiceLibraryUrl);
    Promise.all([
      fetch(config.animLibraryUrl).then(r => { console.log('[guru] anim lib status:', r.status); return r.json(); }),
      fetch(config.voiceLibraryUrl).then(r => { console.log('[guru] voice lib status:', r.status); return r.json(); }),
      fetch(config.transcriptionsUrl).then(r => r.json()).catch(() => ({})),
    ]).then(([library, voiceLib, transcriptions]) => {
      if (!cancelled) {
        console.log('[guru] Libraries loaded. Anim categories:', Object.keys((library as AnimLibrary).categories), 'Voice categories:', Object.keys(voiceLib).length);
        send({
          type: 'LIBRARY_LOADED',
          library: library as AnimLibrary,
          voiceLib: voiceLib as VoiceLibrary,
          transcriptions: transcriptions as Record<string, string>,
        });
      }
    }).catch(err => {
      console.warn('[guru] Failed to load character libraries:', err);
    });

    return () => { cancelled = true; };
  }, [config.animLibraryUrl, config.voiceLibraryUrl, config.transcriptionsUrl, send]);

  // ── Inactivity timer (60s repeat in waiting state) ──────────────
  useEffect(() => {
    if (state.value === 'waiting' && ctx.hasGreeted && !ctx.isSpeaking) {
      inactivityTimerRef.current = setTimeout(() => {
        send({ type: 'SPEAK', category: 'engagement' as VoiceCategory });
      }, 60000);
      return () => {
        if (inactivityTimerRef.current) clearTimeout(inactivityTimerRef.current);
      };
    }
  }, [state.value, ctx.hasGreeted, ctx.isSpeaking, send]);

  // ── Onboarding: INTRO/INTRO_CLUSTER fallback auto-advance ──────
  // When speech is enabled, audio handleEnded fires ONBOARDING_SPEECH_DONE naturally.
  // Only use timer fallback when speech is DISABLED (no audio to trigger advancement).
  useEffect(() => {
    const step = ctx.onboardingStep;
    if (step !== 'INTRO' && step !== 'INTRO_CLUSTER') return;
    if (ctx.speechEnabled) return; // audio end handler advances naturally

    const timer = setTimeout(() => {
      send({ type: 'ONBOARDING_SPEECH_DONE' });
    }, 8000); // Reading time for text when speech is off

    return () => clearTimeout(timer);
  }, [ctx.onboardingStep, ctx.speechEnabled, send]);

  // ── Onboarding: auto-advance for narration steps ───────────────
  // Steps with audio: handleEnded fires ONBOARDING_SPEECH_DONE when clip finishes.
  // Steps without audio (or speech disabled): auto-advance after a reading delay.
  // Interactive steps (TRY_BREAK, TRY_EP5, PICK_*) wait for user action — no auto-advance.
  useEffect(() => {
    const step = ctx.onboardingStep;
    if (!step) return;
    // These steps wait for user clicks, not timers
    const waitForUserSteps = ['PICK_MODEL', 'PICK_QUANT', 'PICK_CONTEXT', 'PICK_TOPOLOGY', 'TRY_BREAK', 'TRY_EP5', 'TRY_CLICK_GURU'];
    if (waitForUserSteps.includes(step)) return;
    // INTRO is the welcome gate state — guru hasn't appeared yet
    if (step === 'INTRO') return;

    // Steps with audio clips: only auto-advance if speech is disabled
    const hasClip = !!(ctx.config.tourClips[step] || ctx.config.onboardingClips[step]);
    if (hasClip && ctx.speechEnabled) return; // audio end handler advances naturally

    // Text-only steps or speech-disabled: auto-advance after reading time
    const readingTime = (ctx.config.onboardingPrompts[step]?.length || 80) * 60; // ~60ms per char
    const timer = setTimeout(() => {
      send({ type: 'ONBOARDING_SPEECH_DONE' });
    }, Math.max(3000, Math.min(12000, readingTime)));

    return () => clearTimeout(timer);
  }, [ctx.onboardingStep, ctx.speechEnabled, ctx.config, send]);

  // ── Onboarding: 30s repeat hint for stuck users ────────────────
  // If user hasn't advanced from an interactive step after 30s,
  // show a more specific hint (e.g., "Click the button marked Qwen 32B").
  useEffect(() => {
    const step = ctx.onboardingStep;
    if (!step) return;
    if (ctx.isSpeaking) return; // don't interrupt active speech

    const hint = ctx.config.onboardingHints[step];
    if (!hint) return;

    const timer = setTimeout(() => {
      send({ type: 'ONBOARDING_HINT', hint });
    }, 30000);

    return () => clearTimeout(timer);
  }, [ctx.onboardingStep, ctx.isSpeaking, ctx.config.onboardingHints, send]);

  // ── Onboarding complete persistence ────────────────────────────
  useEffect(() => {
    if (ctx.onboardingStep === null && !skipOnboarding) {
      // Check if we were previously in onboarding — if tour completed, persist
      localStorage.setItem('chakra-onboarding-complete', 'true');
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ctx.onboardingStep]);

  // ── Topology thinking delay (500ms) ────────────────────────────
  const topologyDelayRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingTopologyRef = useRef<{ paramType: string; value: string } | null>(null);

  useEffect(() => {
    if (state.value === 'thinkingTopology' && pendingTopologyRef.current) {
      const { paramType, value } = pendingTopologyRef.current;
      topologyDelayRef.current = setTimeout(() => {
        send({ type: 'PARAMETER_CHANGED', paramType, value });
        pendingTopologyRef.current = null;
      }, 500);
      return () => {
        if (topologyDelayRef.current) clearTimeout(topologyDelayRef.current);
      };
    }
  }, [state.value, send]);

  // ── Callbacks ──────────────────────────────────────────────────

  const onVideoEnded = useCallback(() => {
    send({ type: 'VIDEO_ENDED' });
  }, [send]);

  const speak = useCallback((category: VoiceCategory) => {
    send({ type: 'SPEAK', category });
  }, [send]);

  const onModelSelected = useCallback((modelId: string) => {
    send({ type: 'MODEL_SELECTED', modelId });
  }, [send]);

  const onParameterChange = useCallback((type: string, value: string) => {
    // Model changes route through onModelSelected
    if (type === 'model') {
      send({ type: 'MODEL_SELECTED', modelId: value });
      return;
    }

    // Topology needs special delay handling
    if (type === 'topology' && !ctx.onboardingStep) {
      pendingTopologyRef.current = { paramType: type, value };
    }

    send({ type: 'PARAMETER_CHANGED', paramType: type, value });
  }, [send, ctx.onboardingStep]);

  const onHelpRequest = useCallback((controlType: string) => {
    send({ type: 'HELP_REQUESTED', controlType });
  }, [send]);

  const triggerGuruError = useCallback((errorId: string) => {
    send({ type: 'TRIGGER_ERROR', errorId });
  }, [send]);

  const handleAvatarClick = useCallback(() => {
    // During onboarding: clicking guru skips/advances the current step
    const step = onboardingStepRef.current;
    if (step !== null) {
      // Interrupt any playing audio
      if (audioRef.current && !audioRef.current.paused) {
        audioRef.current.pause();
        audioRef.current.currentTime = 0;
      }
      send({ type: 'ONBOARDING_SPEECH_DONE' });
      return;
    }
    send({ type: 'AVATAR_CLICKED' });
  }, [send]);

  const onMusicTrackChange = useCallback((trackChangeCount: number) => {
    send({ type: 'MUSIC_TRACK_CHANGED', count: trackChangeCount });
  }, [send]);

  const handleSkipOnboarding = useCallback(() => {
    send({ type: 'SKIP_ONBOARDING' });
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
  }, [send]);

  // ── Map XState state to AnimState ──────────────────────────────
  const stateToAnimState: Record<string, string> = {
    waiting: 'WAITING',
    appearing: 'APPEARING',
    waving: 'WAVING',
    talking: 'TALKING',
    idle: 'IDLE',
    thinking: 'THINKING',
    thinkingTopology: 'THINKING',
    listening: 'LISTENING',
    disappearing: 'DISAPPEARING',
    reactingYes: 'REACTING_YES',
    reactingNo: 'REACTING_NO',
  };

  const animState = (stateToAnimState[state.value as string] || 'WAITING') as GuruswamiStateReturn['animState'];

  return {
    animState,
    videoSrcA: ctx.videoSrcA,
    videoSrcB: ctx.videoSrcB,
    activeSlot: ctx.activeSlot,
    isLooping: ctx.isLooping,
    libraryLoaded: ctx.library !== null,
    onVideoEnded,
    playbackRate,
    setPlaybackRate,
    speak,
    isSpeaking: ctx.isSpeaking,
    audioRef,
    onModelSelected,
    onParameterChange,
    currentSpeechText: ctx.currentSpeechText,
    systemMessage: ctx.systemMessage,
    systemSeverity: ctx.systemSeverity,
    modelCardsGlow: ctx.modelCardsGlow,
    onboardingStep: ctx.onboardingStep,
    hasAppeared: ctx.hasAppeared,
    onHelpRequest,
    triggerGuruError,
    handleAvatarClick,
    isHelpSpeaking: isHelpSpeakingRef,
    onMusicTrackChange,
    skipOnboarding: handleSkipOnboarding,
    welcomeDismissed: useCallback(() => {
      send({ type: 'WELCOME_DISMISSED' });
    }, [send]),
  };
}
