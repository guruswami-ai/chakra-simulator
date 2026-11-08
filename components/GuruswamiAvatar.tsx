import React, { useRef, useEffect, useCallback, useState, useMemo } from 'react';
import { useGuruswamiState, AnimState, OnboardingStep } from '../hooks/useGuruswamiState';
import { ActiveSlot } from '../character-engine/types';
import { AppMode } from '../types';
import { Breakpoint } from '../hooks/useBreakpoint';

interface GuruswamiAvatarProps {
  /** Current tokens per second — drives typing speed, video rate, and message content */
  tps: number;
  /** Quality percentage (0-100) — below 60% text degrades into gibberish */
  perplexityPct?: number;
  /** Current quantization level — text only corrupts at Q2 */
  quantization?: string;
  /** Whether guru speech audio is enabled */
  speechEnabled: boolean;
  /** Current app mode */
  mode?: AppMode;
  /** Currently selected model ID from SimulationPanel */
  selectedModelId?: string;
  /** Display name of currently selected model */
  selectedModelName?: string;
  /** Current cluster topology */
  topology?: string;
  /** Whether the current config is complete and running */
  configComplete?: boolean;
  /** Callback to expose onParameterChange to parent */
  onParameterChangeRef?: React.MutableRefObject<((type: string, value: string) => void) | null>;
  /** Callback to expose onHelpRequest to parent */
  onHelpRequestRef?: React.MutableRefObject<((controlType: string) => void) | null>;
  /** Callback to expose triggerGuruError to parent */
  onTriggerGuruErrorRef?: React.MutableRefObject<((errorId: string) => void) | null>;
  /** Callback to expose onMusicTrackChange to parent */
  onMusicTrackChangeRef?: React.MutableRefObject<((trackChangeCount: number) => void) | null>;
  /** Callback to expose skipOnboarding to parent */
  onSkipOnboardingRef?: React.MutableRefObject<(() => void) | null>;
  /** Callback to expose welcomeDismissed to parent */
  onWelcomeDismissedRef?: React.MutableRefObject<(() => void) | null>;
  /** Callback when modelCardsGlow state changes */
  onModelCardsGlowChange?: (glow: boolean) => void;
  /** Callback when onboarding step changes */
  onOnboardingStepChange?: (step: OnboardingStep) => void;
  /** Current onboarding step from parent (for cinematic positioning) */
  onboardingStepFromParent?: OnboardingStep;
  /** Click handler for LIVE mode — triggers on-demand status report */
  onAvatarClick?: () => void;
  /** LIVE mode state override — injects commentary from useLiveGuruswami */
  liveOverride?: {
    commentaryText: string;
    isSpeaking: boolean;
    animState: AnimState;
  };
  /** Duck background music during instructional speech */
  setDucking?: (duck: boolean) => void;
  /** Responsive breakpoint for positioning */
  breakpoint?: Breakpoint;
}

const BUBBLE_SIZE = 200;

// Gibberish characters for low-quality degradation
const GLITCH_CHARS = '░▒▓█▄▀■□▪▫●○◆◇◈★☆✦✧⚡⟁⟐⟡∆∇∞∅≈≋⌘⎔⏣⏚⏛☸✴✳⊕⊗⊘⊙⊚';

// Status messages that rotate during idle (when not speaking)
function getIdleMessages(tps: number, modelName?: string, topology?: string, configComplete?: boolean): string[] {
  const msgs: string[] = [];

  // ── Config incomplete: prompt the user to pick settings ──
  if (modelName && !configComplete) {
    const name = modelName.split(' ')[0] || modelName;
    if (!topology || topology === '') {
      // No topology yet — probably missing quant, context, or topology
      msgs.push(
        `${name} is selected — now pick a quantisation`,
        'Choose Q4 for a good balance of speed and quality',
        'Pick the settings to load the model on the cluster',
        `Almost there — ${name} needs a few more settings`,
        'Select quantisation, context, and topology to deploy',
      );
    } else if (tps <= 0) {
      // Has topology but still not running — probably an error config
      msgs.push(
        'This configuration isn\'t working — try different settings',
        'Check the topology — not all models fit every configuration',
        'Click on me for a hint',
      );
    }
    // Always include these during config
    msgs.push(
      'The cluster is waiting for a working configuration',
      'Pick the remaining settings to start inference',
    );
    return msgs;
  }

  const isTP = topology?.startsWith('TP');
  const isPP = topology?.startsWith('RING_PP');
  const isEP = topology?.startsWith('EP') || topology === 'SINGLE';

  // ── Config complete: show model/topology facts and status ──
  // TPS-aware
  if (tps > 0) msgs.push(`${tps.toFixed(1)} tokens per second`);
  if (tps > 20) msgs.push('That throughput is looking good');
  if (tps > 50) msgs.push('Flying... this is peak performance');
  if (tps > 0 && tps < 5) msgs.push('Slow but steady... heavy workload');

  // Model-specific — facts, use cases, character
  if (modelName?.includes('Qwen')) {
    msgs.push(
      'Qwen 32B — great for coding and chat',
      '32 billion parameters, all active on every token',
      'Max context: 128K tokens',
      'Dense model — no routing overhead, just raw speed',
      'GQA attention with 8 KV heads',
      'Best on a single node... distributing it actually slows it down',
      'Made by Alibaba Cloud... one of the best open models at this size',
    );
  } else if (modelName?.includes('Llama')) {
    msgs.push(
      'Llama 405B — the largest dense open model',
      '405 billion parameters... every single one active',
      'Max context: 128K tokens',
      'Needs tensor parallel to run at usable speed',
      '230 gigabytes at Q4... barely fits on one node',
      'Best for complex reasoning and long analysis',
      'Made by Meta... released as open weights',
      '126 transformer layers deep',
    );
  } else if (modelName?.includes('Mixtral')) {
    msgs.push(
      'Mixtral 8x7B — the original mainstream MoE',
      'Eight experts but only two fire per token',
      'Max context: 32K tokens — smallest window of our five',
      '46.7 billion total params, 12.9 billion active',
      'Great for fast general chat',
      'Made by Mistral AI in Paris',
      'MoE means most weights sleep on every token',
    );
  } else if (modelName?.includes('DeepSeek')) {
    msgs.push(
      'DeepSeek V3 — MoE with Multi-Latent Attention',
      '671 billion total, 37 billion active per token',
      '256 experts with top-8 routing',
      'Max context: 128K tokens',
      'MLA compresses the KV cache — 28x smaller than standard',
      'Trained for 5.6 million dollars... crashed the stock market',
      'Made in China — took Western architectures and made them their own',
      '61 transformer layers',
    );
  } else if (modelName?.includes('Kimi')) {
    msgs.push(
      'Kimi K2.5 — one trillion parameters',
      'The largest model in the collection',
      'Max context: 256K tokens — the biggest window we have',
      'MLA attention like DeepSeek but even more compressed',
      '614 gigabytes at Q4... needs at least two nodes',
      'Made by Moonshot AI in Beijing',
      'Only 32 billion active parameters per token',
    );
  }

  // Topology-specific
  if (isTP) {
    msgs.push('Thunderbolt mesh is humming', 'All shards synchronized across the fabric', 'Attention heads distributed evenly');
  } else if (isPP) {
    msgs.push('Pipeline flowing stage by stage', 'Activations cascading through the chain', 'Each stage adds its layers to the output');
  } else if (isEP) {
    msgs.push('Each node running its own copy', 'Independent instances... maximum throughput', 'No synchronisation needed... pure parallel');
  }

  // General — always available
  msgs.push(
    'Listening to the music',
    'Click on me if you need anything',
    'Try changing a setting and see what happens',
    'The mandala keeps spinning',
  );

  return msgs;
}

/** Corrupt a string based on quality percentage.
 *  100% = clean, 60% = some glitches, 30% = mostly gibberish, 0% = all gibberish */
function corruptText(text: string, qualityPct: number): string {
  if (qualityPct >= 95) return text;
  const corruptionChance = Math.max(0, (100 - qualityPct) / 100);
  return text.split('').map(ch => {
    if (ch === ' ') return ' ';
    if (Math.random() < corruptionChance * 0.8) {
      return GLITCH_CHARS[Math.floor(Math.random() * GLITCH_CHARS.length)];
    }
    return ch;
  }).join('');
}

// Guru stays quiet during idle — speaks only on user action, track change, or error.

// State labels shown under the avatar
const STATE_LABELS: Partial<Record<AnimState, string>> = {
  WAITING: 'Awaiting...',
  APPEARING: 'Materializing...',
  WAVING: 'Namaste',
  THINKING: 'Contemplating...',
  LISTENING: 'Listening...',
  DISAPPEARING: 'Dissolving...',
};

const GuruswamiAvatar: React.FC<GuruswamiAvatarProps> = ({
  tps,
  perplexityPct = 93,
  quantization,
  speechEnabled,
  mode = 'GAME',
  selectedModelId,
  selectedModelName,
  topology,
  configComplete,
  onParameterChangeRef,
  onHelpRequestRef,
  onTriggerGuruErrorRef,
  onMusicTrackChangeRef,
  onSkipOnboardingRef,
  onWelcomeDismissedRef,
  onModelCardsGlowChange,
  onOnboardingStepChange,
  onboardingStepFromParent,
  onAvatarClick,
  liveOverride,
  setDucking,
  breakpoint = 'desktop',
}) => {
  const {
    animState,
    videoSrcA,
    videoSrcB,
    activeSlot,
    isLooping,
    onVideoEnded,
    setPlaybackRate,
    speak,
    isSpeaking,
    audioRef,
    onModelSelected,
    onParameterChange,
    currentSpeechText,
    systemMessage,
    systemSeverity,
    modelCardsGlow,
    onboardingStep,
    hasAppeared,
    onHelpRequest,
    triggerGuruError,
    isHelpSpeaking,
    onMusicTrackChange,
    skipOnboarding,
    welcomeDismissed,
    handleAvatarClick: guruAvatarClick,
  } = useGuruswamiState({ speechEnabled, mode, setDucking });

  const videoRefA = useRef<HTMLVideoElement>(null);
  const videoRefB = useRef<HTMLVideoElement>(null);

  // ── Expose onParameterChange to parent via ref ─────────
  useEffect(() => {
    if (onParameterChangeRef) {
      onParameterChangeRef.current = onParameterChange;
    }
    return () => {
      if (onParameterChangeRef) onParameterChangeRef.current = null;
    };
  }, [onParameterChange, onParameterChangeRef]);

  // ── Expose onHelpRequest to parent via ref ─────────
  useEffect(() => {
    if (onHelpRequestRef) {
      onHelpRequestRef.current = onHelpRequest;
    }
    return () => {
      if (onHelpRequestRef) onHelpRequestRef.current = null;
    };
  }, [onHelpRequest, onHelpRequestRef]);

  // ── Expose triggerGuruError to parent via ref ─────────
  useEffect(() => {
    if (onTriggerGuruErrorRef) {
      onTriggerGuruErrorRef.current = triggerGuruError;
    }
    return () => {
      if (onTriggerGuruErrorRef) onTriggerGuruErrorRef.current = null;
    };
  }, [triggerGuruError, onTriggerGuruErrorRef]);

  // ── Expose onMusicTrackChange to parent via ref ─────────
  useEffect(() => {
    if (onMusicTrackChangeRef) {
      onMusicTrackChangeRef.current = onMusicTrackChange;
    }
    return () => {
      if (onMusicTrackChangeRef) onMusicTrackChangeRef.current = null;
    };
  }, [onMusicTrackChange, onMusicTrackChangeRef]);

  // ── Expose skipOnboarding to parent via ref ─────────
  useEffect(() => {
    if (onSkipOnboardingRef) {
      onSkipOnboardingRef.current = skipOnboarding;
    }
    return () => {
      if (onSkipOnboardingRef) onSkipOnboardingRef.current = null;
    };
  }, [skipOnboarding, onSkipOnboardingRef]);

  // ── Expose welcomeDismissed to parent via ref ─────────
  useEffect(() => {
    if (onWelcomeDismissedRef) {
      onWelcomeDismissedRef.current = welcomeDismissed;
    }
    return () => {
      if (onWelcomeDismissedRef) onWelcomeDismissedRef.current = null;
    };
  }, [welcomeDismissed, onWelcomeDismissedRef]);

  // ── Report modelCardsGlow changes to parent ────────────
  useEffect(() => {
    onModelCardsGlowChange?.(modelCardsGlow);
  }, [modelCardsGlow, onModelCardsGlowChange]);

  // ── Report onboardingStep changes to parent ─────────────
  useEffect(() => {
    onOnboardingStepChange?.(onboardingStep);
  }, [onboardingStep, onOnboardingStepChange]);

  // ── Click handler (LIVE → prop, SIM/GAME → hook) ──────
  const [clickPulse, setClickPulse] = useState(false);
  const handleAvatarClick = useCallback(() => {
    if (onAvatarClick) {
      onAvatarClick();
    } else if (guruAvatarClick) {
      guruAvatarClick();
    } else {
      return;
    }
    // Play guru_clicked SFX
    const clickIdx = Math.floor(Math.random() * 7) + 1;
    const clickSfx = new Audio(`${import.meta.env.BASE_URL || '/'}guruswami/sfx/guru_clicked0000${clickIdx}.m4a`);
    clickSfx.volume = 0.25;
    clickSfx.play().catch(() => {});
    setClickPulse(true);
    setTimeout(() => setClickPulse(false), 300);
  }, [onAvatarClick, guruAvatarClick]);

  // ── LIVE override: merge external state ───────────────────
  const effectiveIsSpeaking = liveOverride ? liveOverride.isSpeaking : isSpeaking;
  const effectiveSpeechText = liveOverride?.commentaryText || currentSpeechText;
  const effectiveAnimState = liveOverride ? liveOverride.animState : animState;

  // ── Guru state-change SFX ─────────────────────────────────
  const prevAnimStateRef = useRef(effectiveAnimState);
  useEffect(() => {
    const prev = prevAnimStateRef.current;
    prevAnimStateRef.current = effectiveAnimState;
    if (prev === effectiveAnimState) return;

    const base = import.meta.env.BASE_URL || '/';
    let sfxPath: string | null = null;
    const volume = 0.25;

    if (effectiveAnimState === 'APPEARING') {
      // Guru appearing — gong sound (initial tutorial + model switch reappear)
      const idx = Math.floor(Math.random() * 8) + 1;
      sfxPath = `${base}guruswami/sfx/guru_appear_0000${idx}.m4a`;
    } else if (effectiveAnimState === 'DISAPPEARING') {
      // Guru disappearing — whoosh/fade sound
      const idx = Math.floor(Math.random() * 8) + 1;
      sfxPath = `${base}guruswami/sfx/guru_disappear_0000${idx}.m4a`;
    }

    if (sfxPath) {
      const sfx = new Audio(sfxPath);
      sfx.volume = volume;
      sfx.play().catch(() => {});
    }
  }, [effectiveAnimState]);

  // ── Speech bubble state ──────────────────────────────────
  const [displayText, setDisplayText] = useState('');
  const [messageIndex, setMessageIndex] = useState(0);
  const [bubbleOpacity, setBubbleOpacity] = useState(0);
  const charIndexRef = useRef(0);
  const currentMessageRef = useRef('');
  const typingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);


  const idleMessages = useMemo(() => getIdleMessages(tps, selectedModelName, topology, configComplete), [Math.round(tps), selectedModelName, topology, configComplete]);

  // Model selection is forwarded via onParameterChange('model', id) from SimulationPanel
  // — no useEffect needed here. The previous useEffect on selectedModelId caused a
  // duplicate MODEL_SELECTED event (one from onParameterChange, one from the prop change).

  // Expose onParameterChange and modelCardsGlow to parent via the component ref
  // (handled via props in App.tsx instead)

  // ── Guru video always plays at normal speed ──
  // The guru is a consistent character — his animations don't speed up or slow down with TPS.
  useEffect(() => {
    setPlaybackRate(1.0);
    if (videoRefA.current) videoRefA.current.playbackRate = 1.0;
    if (videoRefB.current) videoRefB.current.playbackRate = 1.0;
  }, [setPlaybackRate]);

  // ── No periodic voice lines ─────────────────────────────
  // Guru stays quiet during idle so the user can enjoy the music.
  // He only speaks when: user clicks a control, clicks the guru,
  // music track changes, or an error/recovery occurs.
  // Silent <think> tag text bubbles still rotate for visual interest.

  // ── Typing effect — mirrors speech when talking, idle messages otherwise ─
  // Before model selection: type at full speed (40 chars/sec)
  // After model selection: TPS-driven speed
  // Guru typing is always consistent — not TPS-driven.
  // Q2 garbled text is the only exception (handled via corruptText, not speed).
  const typingCharsPerSec = 35;
  const idleCharsPerSec = 25;

  useEffect(() => {
    // Clear previous timer
    if (typingTimerRef.current) clearTimeout(typingTimerRef.current);

    // During WAITING with speech text, show the greeting
    if (effectiveAnimState === 'WAITING' && effectiveSpeechText) {
      const message = (onboardingStep || quantization !== 'Q2') ? effectiveSpeechText : corruptText(effectiveSpeechText, perplexityPct);
      currentMessageRef.current = message;
      charIndexRef.current = 0;
      setDisplayText('');
      setBubbleOpacity(1);

      const msPerChar = 1000 / typingCharsPerSec;

      const typeNext = () => {
        if (charIndexRef.current < currentMessageRef.current.length) {
          charIndexRef.current++;
          setDisplayText(currentMessageRef.current.slice(0, charIndexRef.current));
          typingTimerRef.current = setTimeout(typeNext, msPerChar);
        }
      };
      typingTimerRef.current = setTimeout(typeNext, 200);
      return () => { if (typingTimerRef.current) clearTimeout(typingTimerRef.current); };
    }

    // When speaking — mirror the voice text (includes APPEARING during INTRO greeting)
    if (effectiveIsSpeaking && effectiveSpeechText && (effectiveAnimState === 'TALKING' || effectiveAnimState === 'REACTING_YES' || effectiveAnimState === 'REACTING_NO' || effectiveAnimState === 'APPEARING')) {
      // Never corrupt during onboarding or LIVE mode — only Q2 gets glitch chars
      const message = (onboardingStep || liveOverride || quantization !== 'Q2') ? effectiveSpeechText : corruptText(effectiveSpeechText, perplexityPct);
      currentMessageRef.current = message;

      // Help text appears instantly — no typing animation
      if (isHelpSpeaking.current) {
        charIndexRef.current = message.length;
        setDisplayText(message);
        setBubbleOpacity(1);
        return () => { if (typingTimerRef.current) clearTimeout(typingTimerRef.current); };
      }

      charIndexRef.current = 0;
      setDisplayText('');
      setBubbleOpacity(1);

      const msPerChar = 1000 / typingCharsPerSec;

      const typeNext = () => {
        if (charIndexRef.current < currentMessageRef.current.length) {
          charIndexRef.current++;
          setDisplayText(currentMessageRef.current.slice(0, charIndexRef.current));
          typingTimerRef.current = setTimeout(typeNext, msPerChar);
        }
        // Don't auto-fade — it stays visible until speech ends
      };
      typingTimerRef.current = setTimeout(typeNext, 200);
      return () => { if (typingTimerRef.current) clearTimeout(typingTimerRef.current); };
    }

    // When idle (not speaking):
    // During onboarding: keep showing the last instruction text (no idle rotation)
    // Normal mode: rotate status messages with <think> tags
    if (effectiveAnimState === 'IDLE' && !effectiveIsSpeaking) {
      if (onboardingStep) {
        // Onboarding: hold the instruction text or show nothing — never idle messages
        const text = effectiveSpeechText || '';
        if (text) {
          currentMessageRef.current = text;
          charIndexRef.current = text.length;
          setDisplayText(text);
          setBubbleOpacity(1);
        } else {
          setBubbleOpacity(0);
        }
        return () => { if (typingTimerRef.current) clearTimeout(typingTimerRef.current); };
      }

      const rawMessage = idleMessages[messageIndex % idleMessages.length];
      const message = (quantization !== 'Q2') ? rawMessage : corruptText(rawMessage, perplexityPct);
      currentMessageRef.current = message;
      charIndexRef.current = 0;
      setDisplayText('');
      setBubbleOpacity(1);

      const msPerChar = 1000 / idleCharsPerSec;

      const typeNext = () => {
        if (charIndexRef.current < currentMessageRef.current.length) {
          charIndexRef.current++;
          setDisplayText(currentMessageRef.current.slice(0, charIndexRef.current));
          typingTimerRef.current = setTimeout(typeNext, msPerChar);
        } else {
          typingTimerRef.current = setTimeout(() => {
            setBubbleOpacity(0);
            typingTimerRef.current = setTimeout(() => {
              setMessageIndex(prev => prev + 1);
            }, 600);
          }, 2500);
        }
      };

      typingTimerRef.current = setTimeout(typeNext, 400);
      return () => { if (typingTimerRef.current) clearTimeout(typingTimerRef.current); };
    }

    // Not speaking and not idle — fade out bubble
    if (!effectiveIsSpeaking && !effectiveSpeechText) {
      setBubbleOpacity(0);
    }

    return () => { if (typingTimerRef.current) clearTimeout(typingTimerRef.current); };
  }, [effectiveAnimState, effectiveIsSpeaking, effectiveSpeechText, messageIndex, idleMessages, typingCharsPerSec, idleCharsPerSec, perplexityPct, quantization, onboardingStep, liveOverride]);

  // ── Video playback ───────────────────────────────────────
  // Safety timer: if onEnded never fires (browser quirk with short/autoplay videos),
  // force the transition after the video's expected duration + a buffer.
  const videoSafetyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const video = videoRefA.current;
    if (!video || !videoSrcA) return;
    console.log('[guru] Video A loading:', videoSrcA);
    if (videoSafetyTimerRef.current) clearTimeout(videoSafetyTimerRef.current);
    video.load();
    video.play().catch((e) => {
      console.warn('[guru] Video A play failed:', e?.message);
      // If play fails entirely, force transition after a short delay
      // But NOT for looping videos (idle, talking, thinking) — they don't need to end
      if (!isLooping) {
        videoSafetyTimerRef.current = setTimeout(() => {
          console.log('[guru] Video A play failed — forcing onVideoEnded');
          onVideoEnded();
        }, 1500);
      }
    });
    // Safety: if onEnded doesn't fire within 5s, force it
    // Skip for looping videos — they never end naturally
    if (!isLooping) {
      videoSafetyTimerRef.current = setTimeout(() => {
        if (video.paused || video.ended || video.currentTime === 0) {
          console.log('[guru] Video A safety timer — forcing onVideoEnded');
          onVideoEnded();
        }
      }, 5000);
    }
    return () => { if (videoSafetyTimerRef.current) clearTimeout(videoSafetyTimerRef.current); };
  }, [videoSrcA, onVideoEnded, isLooping]);

  useEffect(() => {
    const video = videoRefB.current;
    if (!video || !videoSrcB) return;
    video.load();
    video.play().catch(() => {
      // If play fails, force transition
      setTimeout(() => onVideoEnded(), 1500);
    });
  }, [videoSrcB, onVideoEnded]);

  const handleVideoEndedA = useCallback(() => {
    if (activeSlot === 'A') onVideoEnded();
  }, [activeSlot, onVideoEnded]);

  const handleVideoEndedB = useCallback(() => {
    if (activeSlot === 'B') onVideoEnded();
  }, [activeSlot, onVideoEnded]);

  // ── Entry animation ──────────────────────────────────────
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setMounted(true), 50);
    return () => clearTimeout(t);
  }, []);

  // Once appeared, guru stays visible (only disappear/appear for model changes)
  const showVideo = hasAppeared && (videoSrcA || videoSrcB);
  // Always show the ambient sphere as a background — video covers it when loaded
  const showWaitingSphere = true;
  const showBubble = (
    (effectiveAnimState === 'WAITING' && effectiveSpeechText) ||
    (effectiveIsSpeaking && effectiveSpeechText) ||
    (effectiveAnimState === 'IDLE' && displayText) ||
    (effectiveAnimState === 'THINKING' && displayText) ||
    (effectiveAnimState === 'LISTENING' && displayText)
  );

  // Crossfade protection: keep old slot visible briefly during swap
  const prevActiveSlotRef = useRef(activeSlot);
  const [fadingOutSlot, setFadingOutSlot] = useState<ActiveSlot | null>(null);
  const fadeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (activeSlot !== prevActiveSlotRef.current && hasAppeared) {
      const oldSlot = prevActiveSlotRef.current;
      setFadingOutSlot(oldSlot);
      if (fadeTimerRef.current) clearTimeout(fadeTimerRef.current);
      fadeTimerRef.current = setTimeout(() => setFadingOutSlot(null), 400);
    }
    prevActiveSlotRef.current = activeSlot;
    return () => { if (fadeTimerRef.current) clearTimeout(fadeTimerRef.current); };
  }, [activeSlot, hasAppeared]);

  // State label
  const stateLabel = STATE_LABELS[effectiveAnimState];

  // Guru positioning — centered on desktop, corner on mobile/tablet
  const isIntro = onboardingStep === 'INTRO';
  const isMobileAvatar = breakpoint === 'mobile';
  const isTabletAvatar = breakpoint === 'tablet';
  const isCompactAvatar = isMobileAvatar || isTabletAvatar;

  // Size: desktop 200px, tablet 170px, mobile 140px (intro always 350px centered)
  const bubbleSize = isIntro ? 350
    : isMobileAvatar ? 140
    : isTabletAvatar ? 170
    : BUBBLE_SIZE;

  // Position: centered during intro/desktop, bottom-right on mobile/tablet
  // The container is sized to the bubble — speech bubble extends outside via overflow-visible
  // Position the bubble — always centered on its anchor point using translate
  const positionStyle: React.CSSProperties = {
    top: '50%',
    left: '50%',
    transform: 'translate(-50%, -50%)',
  };

  // Speech bubble: above on desktop/intro, to the LEFT on mobile/tablet (avoids right-edge clip)
  const speechToLeft = isCompactAvatar && !isIntro;
  const speechMaxWidth = speechToLeft ? 220 : (systemMessage ? bubbleSize + 80 : bubbleSize + 30);

  return (
    <div
      className="absolute z-40 pointer-events-none"
      style={{
        ...positionStyle,
        width: bubbleSize,
        height: bubbleSize,
        transition: 'all 1200ms cubic-bezier(0.4, 0, 0.2, 1)',
      }}
    >
      {/* Speech Bubble — above on desktop, to the left on mobile/tablet */}
      <div
        className="absolute pointer-events-none"
        style={speechToLeft ? {
          // Position to the left of the avatar bubble
          right: '100%',
          marginRight: 10,
          top: '50%',
          transform: 'translateY(-50%)',
          opacity: (showBubble && displayText) || systemMessage ? bubbleOpacity : 0,
          transition: 'opacity 500ms',
        } : {
          // Position above the avatar bubble
          bottom: '100%',
          marginBottom: isIntro ? 20 : 10,
          left: '50%',
          transform: 'translateX(-50%)',
          opacity: (showBubble && displayText) || systemMessage ? bubbleOpacity : 0,
          transition: 'opacity 500ms, margin-bottom 1200ms cubic-bezier(0.4,0,0.2,1)',
        }}
      >
        <div
          className="relative px-4 py-3 rounded-2xl text-[11px] font-mono leading-relaxed"
          style={{
            background: 'rgba(20, 16, 8, 0.75)',
            backdropFilter: 'blur(12px)',
            border: systemMessage
              ? `1px solid ${systemSeverity === 'error' ? 'rgba(255, 80, 60, 0.25)' : 'rgba(255, 180, 50, 0.20)'}`
              : '1px solid rgba(255, 200, 50, 0.15)',
            color: 'rgba(255, 210, 100, 0.85)',
            boxShadow: systemMessage
              ? `0 4px 20px rgba(0, 0, 0, 0.5), 0 0 40px ${systemSeverity === 'error' ? 'rgba(255, 80, 60, 0.08)' : 'rgba(255, 180, 40, 0.08)'}`
              : '0 4px 20px rgba(0, 0, 0, 0.4), 0 0 30px rgba(255, 180, 40, 0.06)',
            minHeight: 36,
            width: speechMaxWidth,
            transition: 'border-color 500ms, box-shadow 500ms',
          }}
        >
          {/* Guruswami's poetic text — <think> tags when idle (never during onboarding) */}
          {displayText && !onboardingStep && !effectiveIsSpeaking && (effectiveAnimState === 'IDLE' || effectiveAnimState === 'THINKING') && (
            <span className="text-white/25 text-[10px]">&lt;think&gt; </span>
          )}
          {displayText || '\u00A0'}
          {displayText && !onboardingStep && !effectiveIsSpeaking && (effectiveAnimState === 'IDLE' || effectiveAnimState === 'THINKING') && (
            <span className="text-white/25 text-[10px]"> &lt;/think&gt;</span>
          )}
          {displayText && !systemMessage && (
            <span className="inline-block w-[2px] h-[13px] bg-amber-400/60 ml-0.5 animate-pulse align-text-bottom" />
          )}

          {/* Callisto2 system terminal line — cold green, appears below guru text */}
          {systemMessage && (
            <div
              className="mt-2 pt-2 text-[10px] leading-snug font-mono"
              style={{
                borderTop: `1px solid ${systemSeverity === 'error' ? 'rgba(255, 80, 60, 0.15)' : 'rgba(120, 200, 120, 0.12)'}`,
                color: systemSeverity === 'error' ? 'rgba(255, 120, 100, 0.7)' : 'rgba(120, 200, 120, 0.6)',
                letterSpacing: '0.02em',
              }}
            >
              {systemMessage}
            </div>
          )}

          {/* Triangle tail — points down (desktop) or right (mobile) */}
          {speechToLeft ? (
            <>
              {/* Tail pointing right (toward avatar) */}
              <div
                className="absolute -right-[7px] top-1/2 -translate-y-1/2 w-0 h-0"
                style={{
                  borderTop: '7px solid transparent',
                  borderBottom: '7px solid transparent',
                  borderLeft: systemMessage && systemSeverity === 'error'
                    ? '7px solid rgba(255, 80, 60, 0.25)'
                    : '7px solid rgba(255, 200, 50, 0.15)',
                }}
              />
              <div
                className="absolute -right-[6px] top-1/2 -translate-y-1/2 w-0 h-0"
                style={{
                  borderTop: '6px solid transparent',
                  borderBottom: '6px solid transparent',
                  borderLeft: '6px solid rgba(20, 16, 8, 0.75)',
                }}
              />
            </>
          ) : (
            <>
              {/* Tail pointing down (toward avatar) */}
              <div
                className="absolute -bottom-[7px] left-1/2 -translate-x-1/2 w-0 h-0"
                style={{
                  borderLeft: '7px solid transparent',
                  borderRight: '7px solid transparent',
                  borderTop: systemMessage && systemSeverity === 'error'
                    ? '7px solid rgba(255, 80, 60, 0.25)'
                    : '7px solid rgba(255, 200, 50, 0.15)',
                }}
              />
              <div
                className="absolute -bottom-[6px] left-1/2 -translate-x-1/2 w-0 h-0"
                style={{
                  borderLeft: '6px solid transparent',
                  borderRight: '6px solid transparent',
                  borderTop: '6px solid rgba(20, 16, 8, 0.75)',
                }}
              />
            </>
          )}
        </div>
      </div>

      {/* Glass Bubble — the unified floating widget. All layers share inset-0. */}
      <div
        className={`relative rounded-full overflow-hidden pointer-events-auto transition-all ease-out ${
          mounted
            ? 'scale-100 opacity-100'
            : 'scale-0 opacity-0'
        } ${(onAvatarClick || guruAvatarClick) ? 'cursor-pointer' : ''}`}
        style={{
          width: bubbleSize,
          height: bubbleSize,
          transitionDuration: '700ms',
          transformOrigin: 'center center',
          boxShadow: clickPulse
            ? '0 0 80px rgba(255, 180, 40, 0.6), 0 0 160px rgba(255, 150, 30, 0.3), inset 0 0 30px rgba(255, 200, 50, 0.15)'
            : onboardingStep === 'TRY_CLICK_GURU'
              ? '0 0 80px rgba(255, 200, 50, 0.5), 0 0 160px rgba(255, 150, 30, 0.3), 0 0 250px rgba(255, 130, 20, 0.15), inset 0 0 30px rgba(255, 200, 50, 0.12)'
              : effectiveAnimState === 'WAITING'
                ? '0 0 60px rgba(255, 200, 50, 0.15), 0 0 120px rgba(255, 150, 30, 0.08), inset 0 0 30px rgba(255, 200, 50, 0.05)'
                : '0 0 60px rgba(255, 200, 50, 0.3), 0 0 120px rgba(255, 150, 30, 0.15), 0 0 200px rgba(255, 130, 20, 0.06), inset 0 0 20px rgba(255, 200, 50, 0.08)',
        }}
        onClick={handleAvatarClick}
      >
          {/* Ambient sphere background — always visible, video covers it when loaded */}
          {showWaitingSphere && (
            <div
              className="absolute inset-0 rounded-full"
              style={{
                background: 'radial-gradient(circle at 40% 35%, rgba(255, 200, 50, 0.18) 0%, rgba(50, 35, 15, 0.7) 40%, rgba(25, 18, 8, 0.9) 100%)',
              }}
            >
              {/* Pulsing inner glow — visible beacon on dark background */}
              <div
                className="absolute inset-4 rounded-full animate-pulse"
                style={{
                  background: 'radial-gradient(circle, rgba(255, 200, 50, 0.12) 0%, transparent 60%)',
                  animationDuration: '2.5s',
                }}
              />
            </div>
          )}

          {/* Video A and B — always in DOM, controlled by opacity only.
              Never conditionally mount/unmount — DOM insertion shifts position. */}
          <video
            ref={videoRefA}
            src={videoSrcA || undefined}
            muted
            playsInline
            loop={activeSlot === 'A' && isLooping}
            onEnded={handleVideoEndedA}
            style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', objectFit: 'cover' }}
            className={`transition-opacity duration-300 ${
              showVideo && videoSrcA && (activeSlot === 'A' || fadingOutSlot === 'A') ? 'opacity-100' : 'opacity-0'
            }`}
          />
          <video
            ref={videoRefB}
            src={videoSrcB || undefined}
            muted
            playsInline
            loop={activeSlot === 'B' && isLooping}
            onEnded={handleVideoEndedB}
            style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', objectFit: 'cover' }}
            className={`transition-opacity duration-300 ${
              showVideo && videoSrcB && (activeSlot === 'B' || fadingOutSlot === 'B') ? 'opacity-100' : 'opacity-0'
            }`}
          />

          {/* Ring highlight */}
          <div
            className="absolute inset-0 rounded-full pointer-events-none"
            style={{
              background: 'radial-gradient(circle at 35% 25%, rgba(255,255,255,0.06) 0%, transparent 50%)',
              border: '1px solid rgba(255, 200, 50, 0.12)',
            }}
          />

        {/* State label — positioned below the bubble */}
        {stateLabel && (
          <div className="absolute -bottom-6 left-0 right-0 text-center pointer-events-none">
            <div className={`text-[10px] font-mono tracking-widest uppercase ${
              animState === 'WAVING' ? 'text-amber-300/50' :
              animState === 'WAITING' ? 'text-amber-200/30' :
              'text-white/20 text-[10px] tracking-wider'
            }`}>
              {stateLabel}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

// Export onParameterChange and modelCardsGlow access via a wrapper
// These are exposed through the hook, and App.tsx passes them through props
export default GuruswamiAvatar;

// Re-export the return type so App.tsx can reference onParameterChange/modelCardsGlow
export type { GuruswamiAvatarProps };
