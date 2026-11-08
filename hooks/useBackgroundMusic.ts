import { useState, useEffect, useRef, useCallback } from 'react';

const BASE = import.meta.env.BASE_URL || '/';

// ── Track Category Arrays ─────────────────────────────────────────
// Intro: ambient, voice-over beds — played during onboarding at 1.0x speed
// Active: generic fallback — used when no model-specific pool exists
// Model pools: sonic identity per model architecture

/** Curated intro tracks (in music/ root) — first played during onboarding */
const INTRO_CURATED = [
  // v5.5 Indian lo-fi intro tracks — Guruswami's personal soundtrack
  'intro-the-awakening-v1', 'intro-the-awakening-v2', 'intro-the-awakening-v3', 'intro-the-awakening-v4',
  'intro-the-cluster-sleeps-v1', 'intro-the-cluster-sleeps-v2', 'intro-the-cluster-sleeps-v3', 'intro-the-cluster-sleeps-v4',
  'intro-five-nodes-waiting-v1', 'intro-five-nodes-waiting-v2', 'intro-five-nodes-waiting-v3', 'intro-five-nodes-waiting-v4',
  'intro-the-gurus-garden-v1', 'intro-the-gurus-garden-v2', 'intro-the-gurus-garden-v3', 'intro-the-gurus-garden-v4', 'intro-the-gurus-garden-v5',
  'intro-thunderbolt-meditation-v1', 'intro-thunderbolt-meditation-v2', 'intro-thunderbolt-meditation-v3',
  'intro-before-the-storm-v1', 'intro-before-the-storm-v2', 'intro-before-the-storm-v3', 'intro-before-the-storm-v4',
];

// ── Tier-Based Music System ───────────────────────────────────────
// Each model has its own genre. Tracks in library/ are named: t{tier}-{slug}-v{variant}.m4a
// Intro phase plays curated ambient tracks from music/ root.
// Active phase plays tier-matched tracks from library/manifest.json.
//
// T1 = Qwen 32B — Synthwave/Outrun (26 tracks)
// T2 = Llama 405B — Hip-Hop/Boom Bap (28 tracks)
// T3 = Mixtral 8x7B — EDM/DnB (50 tracks)
// T4 = DeepSeek V3 — Chinese-American Fusion (36 tracks)
// T5 = Kimi K2.5 — Space Ambient/Dark Cosmic (18 tracks)
//
// Stingers (music/stingers/): achievement, guru wisdom, tutorial completion
// Archive (music/archive-neoclassical/): old T4 tracks before genre change

const MODEL_TO_TIER: Record<string, number> = {
  'qwen25-32b': 1,
  'llama-405b': 2,
  'mixtral-8x7b': 3,
  'deepseek-v3': 4,
  'kimi-k2.5': 5,
};

/** The Final Boss is never in ambient rotation — credits only */
const FINAL_BOSS_SLUG = 't5-the-final-boss';

/** Reward tracks — one per milestone, NOT in shuffle rotation.
 *  Played explicitly via playReward(index) when a trial is completed.
 *  TODO: manually pick the best track for each slot. */
const REWARD_TRACKS: string[] = [
  'tutorial-bonus-this-song-extended',      // Slot 0: tutorial completion — massively over the top bonus
  'tutorial-reward-the-full-saturation',    // Slot 1: tutorial model load — first music reward
  'p-y-theme-song-sting-only',             // Slot 2: game achievement stinger
];

/** Stinger tracks — short one-shot event sounds (UI transitions, not rewards) */
const STINGER_NAMES = [
  'p-y-theme-song-sting-only',
];

/** Excluded tracks (too large, too small, or empty placeholders) */
// No exclusions needed — manifest.json now contains only tier tracks
const EXCLUDED = new Set<string>();

// ── Types ──────────────────────────────────────────────────────────

export type MusicPhase = 'intro' | 'active';

interface TrackEntry {
  name: string;
  path: string;
}

// ── Helpers ────────────────────────────────────────────────────────

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function curatedEntry(name: string): TrackEntry {
  return { name, path: `${BASE}guruswami/music/${name}.m4a` };
}

function libraryEntry(name: string): TrackEntry {
  return { name, path: `${BASE}guruswami/music/library/${name}.m4a` };
}

function stingerEntry(name: string): TrackEntry {
  return { name, path: `${BASE}guruswami/music/stingers/${name}.m4a` };
}

/** Build a pool from tier prefix — matches all t{tier}-* tracks in the manifest */
function buildTierPool(tier: number, manifest: Set<string>): TrackEntry[] {
  const prefix = `t${tier}-`;
  const entries: TrackEntry[] = [];
  for (const name of manifest) {
    if (name.startsWith(prefix) && !name.startsWith(FINAL_BOSS_SLUG)) {
      entries.push(libraryEntry(name));
    }
  }
  return entries;
}

/** Build the active pool — tier-specific from model, or all tiers shuffled as grab bag */
function buildActivePool(modelId: string | null, manifest: Set<string>): TrackEntry[] {
  const tier = modelId ? MODEL_TO_TIER[modelId] : null;
  if (tier) {
    const pool = buildTierPool(tier, manifest);
    if (pool.length > 0) return pool;
  }
  // Fallback: all tier tracks as grab bag (SIM mode with no model selected)
  const allTierTracks: TrackEntry[] = [];
  for (const name of manifest) {
    if (name.match(/^t[1-5]-/) && !name.startsWith(FINAL_BOSS_SLUG)) {
      allTierTracks.push(libraryEntry(name));
    }
  }
  if (allTierTracks.length > 0) return allTierTracks;
  // Last resort: curated intro tracks
  return INTRO_CURATED.map(curatedEntry);
}

/** Build the intro pool — curated ambient tracks from music/ root */
function buildIntroPool(_manifest: Set<string>): TrackEntry[] {
  // Intro pool is exclusively the guru's Indian lo-fi tracks — no legacy or tier tracks
  return INTRO_CURATED.map(curatedEntry);
}

// ── Hook ───────────────────────────────────────────────────────────

export function useBackgroundMusic() {
  const [enabled, setEnabled] = useState(true);
  const [trackName, setTrackName] = useState('');
  const [phase, setPhaseState] = useState<MusicPhase>('intro');
  const [libraryTracks, setLibraryTracks] = useState<string[]>([]);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const stingerRef = useRef<HTMLAudioElement | null>(null);
  const playlistRef = useRef<TrackEntry[]>([]);
  const indexRef = useRef(0);
  const historyRef = useRef<TrackEntry[]>([]);
  const historyIndexRef = useRef(-1);
  const fadingRef = useRef(false);
  const enabledRef = useRef(true);
  const playingRef = useRef(false);
  const fadeIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const isFirstTrackRef = useRef(true);
  const autoplayRetryRef = useRef(false);
  const phaseRef = useRef<MusicPhase>('intro');
  const activeModelRef = useRef<string | null>(null);
  const manifestSetRef = useRef<Set<string>>(new Set());
  const mainVolumeRef = useRef(0.35);
  const onTrackChangeRef = useRef<((trackName: string) => void) | null>(null);
  const trackChangeCountRef = useRef(0);
  const oneShotRef = useRef(false);  // When true, don't auto-advance after track ends

  // Keep refs in sync with state
  useEffect(() => { enabledRef.current = enabled; }, [enabled]);
  useEffect(() => { phaseRef.current = phase; }, [phase]);

  // Discover library tracks on mount
  useEffect(() => {
    fetch(`${BASE}guruswami/music/library/manifest.json`)
      .then(r => r.json())
      .then((tracks: string[]) => {
        const filtered = tracks.filter(t => !EXCLUDED.has(t));
        setLibraryTracks(filtered);
        manifestSetRef.current = new Set(filtered);
      })
      .catch(() => {
        setLibraryTracks([]);
        manifestSetRef.current = new Set();
      });
  }, []);

  // Build all-tracks ref (for random/prev navigation across entire library)
  const allTracks = useRef<TrackEntry[]>([]);
  useEffect(() => {
    const curated = INTRO_CURATED.map(curatedEntry);
    const library = libraryTracks.map(libraryEntry);
    allTracks.current = [...curated, ...library];
  }, [libraryTracks]);

  // Create main audio element once
  useEffect(() => {
    const audio = new Audio();
    audio.volume = 0;
    audio.preload = 'auto';
    audioRef.current = audio;
    return () => { audio.pause(); audio.src = ''; };
  }, []);

  // Create stinger audio element once
  useEffect(() => {
    const stinger = new Audio();
    stinger.volume = 0.35;
    stinger.preload = 'none';
    stingerRef.current = stinger;
    return () => { stinger.pause(); stinger.src = ''; };
  }, []);

  // ── Fade helpers ────────────────────────────────────────────────

  const cancelFade = useCallback(() => {
    if (fadeIntervalRef.current) {
      clearInterval(fadeIntervalRef.current);
      fadeIntervalRef.current = null;
    }
  }, []);

  const fadeIn = useCallback((audio: HTMLAudioElement, targetVol: number, ms: number) => {
    cancelFade();
    const steps = 20;
    const stepMs = ms / steps;
    const stepVol = targetVol / steps;
    let current = audio.volume;
    fadeIntervalRef.current = setInterval(() => {
      current += stepVol;
      if (current >= targetVol) {
        audio.volume = targetVol;
        cancelFade();
      } else {
        audio.volume = current;
      }
    }, stepMs);
  }, [cancelFade]);

  const fadeOut = useCallback((audio: HTMLAudioElement, ms: number): Promise<void> => {
    cancelFade();
    return new Promise(resolve => {
      const startVol = audio.volume;
      if (startVol <= 0) { resolve(); return; }
      const steps = 20;
      const stepMs = ms / steps;
      const stepVol = startVol / steps;
      let current = startVol;
      fadeIntervalRef.current = setInterval(() => {
        current -= stepVol;
        if (current <= 0) {
          audio.volume = 0;
          cancelFade();
          resolve();
        } else {
          audio.volume = current;
        }
      }, stepMs);
    });
  }, [cancelFade]);

  // ── Play a specific track with crossfade ────────────────────────

  const playTrack = useCallback((entry: TrackEntry) => {
    const audio = audioRef.current;
    if (!audio || !enabledRef.current) return;

    // Guard: if a fade is already in progress, drop this request
    if (fadingRef.current) return;

    historyRef.current.push(entry);
    historyIndexRef.current = -1;

    const doPlay = () => {
      playingRef.current = true;
      audio.src = entry.path;
      audio.load();
      setTrackName(entry.name);

      audio.play().then(() => {
        fadeIn(audio, mainVolumeRef.current, 2000);
        autoplayRetryRef.current = false;
        // Notify track change listeners
        trackChangeCountRef.current++;
        onTrackChangeRef.current?.(entry.name);
      }).catch(() => {
        playingRef.current = false;
        if (!autoplayRetryRef.current) {
          autoplayRetryRef.current = true;
          const retryPlay = () => {
            document.removeEventListener('click', retryPlay);
            document.removeEventListener('keydown', retryPlay);
            autoplayRetryRef.current = false;
            if (enabledRef.current && !playingRef.current) {
              playTrack(entry);
            }
          };
          document.addEventListener('click', retryPlay, { once: true });
          document.addEventListener('keydown', retryPlay, { once: true });
        }
      });
    };

    if (playingRef.current && audio.volume > 0) {
      fadingRef.current = true;
      fadeOut(audio, 800).then(() => {
        fadingRef.current = false;
        playingRef.current = false;
        doPlay();
      });
    } else {
      playingRef.current = false;
      doPlay();
    }
  }, [fadeIn, fadeOut]);

  // ── Build current pool based on phase + model ───────────────────

  const getCurrentPool = useCallback(() => {
    if (phaseRef.current === 'intro') {
      return buildIntroPool(manifestSetRef.current);
    }
    return buildActivePool(activeModelRef.current, manifestSetRef.current);
  }, []);

  // ── Phase/model-aware playNext ──────────────────────────────────

  const playNext = useCallback(() => {
    const audio = audioRef.current;
    if (!audio || !enabledRef.current) return;
    if (playingRef.current) return;

    let entry: TrackEntry;

    if (isFirstTrackRef.current) {
      isFirstTrackRef.current = false;
      entry = curatedEntry('deep-pads');
      const pool = getCurrentPool();
      playlistRef.current = shuffle(pool.filter(t => t.name !== 'deep-pads'));
      indexRef.current = 0;
    } else {
      if (indexRef.current >= playlistRef.current.length) {
        const pool = getCurrentPool();
        playlistRef.current = shuffle(pool);
        indexRef.current = 0;
      }
      entry = playlistRef.current[indexRef.current];
      indexRef.current++;
    }

    playTrack(entry);
  }, [playTrack, getCurrentPool]);

  // ── Track end handling ──────────────────────────────────────────

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handleTimeUpdate = () => {
      if (audio.duration && audio.currentTime > audio.duration - 3 && !fadingRef.current) {
        fadingRef.current = true;
        const srcAtStart = audio.src;
        fadeOut(audio, 2500).then(() => {
          fadingRef.current = false;
          if (audio.src === srcAtStart) {
            playingRef.current = false;
            if (enabledRef.current) playNext();
          }
        });
      }
    };

    const handleEnded = () => {
      if (!fadingRef.current) {
        playingRef.current = false;
        // One-shot mode: track ends, go silent (no auto-advance)
        if (oneShotRef.current) {
          oneShotRef.current = false;
          setTrackName('');
        } else if (enabledRef.current) {
          playNext();
        }
      }
      fadingRef.current = false;
    };

    const handleError = () => {
      cancelFade();
      fadingRef.current = false;
      playingRef.current = false;
      if (enabledRef.current) {
        setTimeout(() => playNext(), 500);
      }
    };

    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('ended', handleEnded);
    audio.addEventListener('error', handleError);
    return () => {
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('ended', handleEnded);
      audio.removeEventListener('error', handleError);
    };
  }, [fadeOut, cancelFade, playNext]);

  // ── Start/stop based on enabled ─────────────────────────────────

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    if (enabled) {
      // On mount: try autoplay. On toggle: toggle() already called playNext()
      // directly in user gesture context, so this is a no-op if already playing.
      if (!playingRef.current) {
        fadingRef.current = false;
        cancelFade();
        playNext();
      }
    } else {
      // Stop everything immediately — main track + stinger
      cancelFade();
      fadingRef.current = false;
      audio.pause();
      audio.src = '';
      audio.volume = 0;
      playingRef.current = false;
      setTrackName('');
      // Also kill any playing stinger
      const stinger = stingerRef.current;
      if (stinger) {
        stinger.pause();
        stinger.src = '';
      }
    }
  }, [enabled, cancelFade, fadeOut, playNext]);

  const toggle = useCallback(() => {
    setEnabled(prev => {
      const next = !prev;
      if (next) {
        // Toggling ON — play directly in click handler (user gesture context)
        enabledRef.current = true;
        playingRef.current = false;
        fadingRef.current = false;
        cancelFade();
        playNext();
      }
      return next;
    });
  }, [cancelFade, playNext]);

  // ── Audio quality degradation via Web Audio API ────────────────
  // At Q4+ the music plays cleanly. At Q3 a lowpass filter rolls off highs.
  // At Q2 white noise is mixed in to simulate signal degradation.
  // Playback rate stays at 1.0 always — no tempo modulation.

  const audioCtxRef = useRef<AudioContext | null>(null);
  const sourceNodeRef = useRef<MediaElementAudioSourceNode | null>(null);
  const lowpassRef = useRef<BiquadFilterNode | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const noiseGainRef = useRef<GainNode | null>(null);
  const noiseSourceRef = useRef<AudioBufferSourceNode | null>(null);
  const audioChainReadyRef = useRef(false);

  /** Lazily init Web Audio chain the first time setAudioQuality is called */
  const ensureAudioChain = useCallback(() => {
    const audio = audioRef.current;
    if (!audio || audioChainReadyRef.current) return;

    try {
      const ctx = new AudioContext();
      audioCtxRef.current = ctx;

      // Source → Lowpass → Destination
      const source = ctx.createMediaElementSource(audio);
      sourceNodeRef.current = source;

      const lowpass = ctx.createBiquadFilter();
      lowpass.type = 'lowpass';
      lowpass.frequency.value = 22000; // Wide open by default
      lowpass.Q.value = 0.7;
      lowpassRef.current = lowpass;

      // Analyser for visual amplitude readout (fftSize 256 = 128 bins, fast)
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      analyser.smoothingTimeConstant = 0.8;
      analyserRef.current = analyser;

      source.connect(lowpass);
      lowpass.connect(analyser);
      analyser.connect(ctx.destination);

      // White noise buffer (2 seconds, looped)
      const noiseLen = ctx.sampleRate * 2;
      const noiseBuf = ctx.createBuffer(1, noiseLen, ctx.sampleRate);
      const noiseData = noiseBuf.getChannelData(0);
      for (let i = 0; i < noiseLen; i++) {
        noiseData[i] = (Math.random() * 2 - 1) * 0.5;
      }

      const noiseGain = ctx.createGain();
      noiseGain.gain.value = 0; // Silent by default
      noiseGainRef.current = noiseGain;
      noiseGain.connect(ctx.destination);

      const noiseNode = ctx.createBufferSource();
      noiseNode.buffer = noiseBuf;
      noiseNode.loop = true;
      noiseNode.connect(noiseGain);
      noiseNode.start();
      noiseSourceRef.current = noiseNode;

      audioChainReadyRef.current = true;
    } catch {
      // Web Audio not supported or already connected — degrade gracefully
    }
  }, []);

  const setTempo = useCallback((_tps: number) => {
    // No-op. Playback rate stays at 1.0. Kept for API compatibility.
    const audio = audioRef.current;
    if (audio) audio.playbackRate = 1.0;
  }, []);

  /** Set audio quality based on quantization level.
   *  F16/Q8/Q6/Q5/Q4 → clean. Q3 → muffled. Q2 → muffled + noise. */
  const setAudioQuality = useCallback((quantization: string) => {
    ensureAudioChain();
    const lowpass = lowpassRef.current;
    const noiseGain = noiseGainRef.current;
    if (!lowpass || !noiseGain) return;

    const ctx = audioCtxRef.current;
    const now = ctx?.currentTime ?? 0;

    switch (quantization) {
      case 'Q2':
        // Heavy degradation: 2kHz cutoff + audible noise
        lowpass.frequency.linearRampToValueAtTime(2000, now + 0.5);
        noiseGain.gain.linearRampToValueAtTime(0.08, now + 0.5);
        break;
      case 'Q3':
        // Moderate: 5kHz cutoff, faint noise
        lowpass.frequency.linearRampToValueAtTime(5000, now + 0.5);
        noiseGain.gain.linearRampToValueAtTime(0.02, now + 0.5);
        break;
      default:
        // Q4 and above: clean signal
        lowpass.frequency.linearRampToValueAtTime(22000, now + 0.5);
        noiseGain.gain.linearRampToValueAtTime(0, now + 0.5);
        break;
    }
  }, [ensureAudioChain]);

  // ── Phase transition ────────────────────────────────────────────

  const setPhase = useCallback((newPhase: MusicPhase) => {
    if (phaseRef.current === newPhase) return;
    setPhaseState(newPhase);
    phaseRef.current = newPhase;

    const pool = newPhase === 'intro'
      ? buildIntroPool(manifestSetRef.current)
      : buildActivePool(activeModelRef.current, manifestSetRef.current);
    if (pool.length === 0) return;

    playlistRef.current = shuffle(pool);
    indexRef.current = 1;

    const audio = audioRef.current;
    if (!audio || !enabledRef.current) return;

    fadingRef.current = true;
    fadeOut(audio, 1200).then(() => {
      fadingRef.current = false;
      playingRef.current = false;
      playTrack(playlistRef.current[0]);
    });
  }, [fadeOut, playTrack]);

  // ── Model-aware active pool switching ───────────────────────────

  const setActiveModel = useCallback((modelId: string | null) => {
    if (activeModelRef.current === modelId) return;
    activeModelRef.current = modelId;

    // Only rebuild & crossfade if already in active phase
    if (phaseRef.current !== 'active') return;
    if (!enabledRef.current) return;

    const pool = buildActivePool(modelId, manifestSetRef.current);
    if (pool.length === 0) return;

    playlistRef.current = shuffle(pool);
    indexRef.current = 1;

    const audio = audioRef.current;
    if (!audio) return;

    // Crossfade to model's sonic identity
    fadingRef.current = true;
    fadeOut(audio, 1000).then(() => {
      fadingRef.current = false;
      playingRef.current = false;
      playTrack(playlistRef.current[0]);
    });
  }, [fadeOut, playTrack]);

  // ── Stinger support ─────────────────────────────────────────────

  const playStinger = useCallback((specificTrack?: string) => {
    const stinger = stingerRef.current;
    const audio = audioRef.current;
    if (!stinger || !enabledRef.current) return;

    const stingerName = specificTrack
      || STINGER_NAMES[Math.floor(Math.random() * STINGER_NAMES.length)];
    const path = `${BASE}guruswami/music/stingers/${stingerName}.m4a`;

    const preDuckVol = audio?.volume ?? mainVolumeRef.current;
    if (audio) {
      audio.volume = mainVolumeRef.current * 0.35;
    }

    stinger.src = path;
    stinger.volume = 0.35;
    stinger.load();
    stinger.play().catch(() => {
      if (audio) audio.volume = preDuckVol;
    });

    const restore = () => {
      if (audio && enabledRef.current) {
        const target = mainVolumeRef.current;
        const steps = 10;
        const stepMs = 50;
        const stepVol = (target - audio.volume) / steps;
        let i = 0;
        const interval = setInterval(() => {
          i++;
          if (i >= steps || !audioRef.current) {
            if (audio) audio.volume = target;
            clearInterval(interval);
          } else {
            audio.volume = Math.min(target, audio.volume + stepVol);
          }
        }, stepMs);
      }
      stinger.removeEventListener('ended', restore);
      stinger.removeEventListener('error', restore);
    };
    stinger.addEventListener('ended', restore);
    stinger.addEventListener('error', restore);
  }, []);

  // ── Reward track support (trial/challenge completion) ──────────

  const playReward = useCallback((slotIndex: number, oneShot: boolean = false) => {
    if (!enabledRef.current) return;
    oneShotRef.current = oneShot;
    const idx = Math.min(slotIndex, REWARD_TRACKS.length - 1);
    const name = REWARD_TRACKS[idx];
    if (!name) return;
    playTrack(stingerEntry(name));
  }, [playTrack]);

  // ── Navigation controls ─────────────────────────────────────────

  const next = useCallback(() => {
    if (!enabledRef.current) return;
    const audio = audioRef.current;
    if (!audio) return;
    cancelFade();
    // If not actively playing, skip fadeOut to preserve user gesture context
    if (!playingRef.current || audio.volume <= 0) {
      fadingRef.current = false;
      playingRef.current = false;
      playNext();
    } else {
      fadingRef.current = true;
      fadeOut(audio, 500).then(() => {
        fadingRef.current = false;
        playingRef.current = false;
        playNext();
      });
    }
  }, [cancelFade, fadeOut, playNext]);

  const prev = useCallback(() => {
    if (!enabledRef.current) return;
    const history = historyRef.current;
    if (history.length < 2) return;

    const idx = historyIndexRef.current === -1
      ? history.length - 2
      : Math.max(0, historyIndexRef.current - 1);

    historyIndexRef.current = idx;
    const entry = history[idx];
    if (!entry) return;

    const audio = audioRef.current;
    if (!audio) return;

    const doPlayPrev = () => {
      fadingRef.current = false;
      playingRef.current = true;
      audio.src = entry.path;
      audio.load();
      setTrackName(entry.name);
      audio.play().then(() => {
        fadeIn(audio, mainVolumeRef.current, 1000);
      }).catch(() => {
        playingRef.current = false;
      });
    };

    // Skip fadeOut when not playing to preserve user gesture context
    if (!playingRef.current || audio.volume <= 0) {
      doPlayPrev();
    } else {
      fadingRef.current = true;
      fadeOut(audio, 500).then(doPlayPrev);
    }
  }, [fadeOut, fadeIn]);

  const random = useCallback(() => {
    if (!enabledRef.current) return;
    const tracks = allTracks.current;
    if (tracks.length === 0) return;
    const entry = tracks[Math.floor(Math.random() * tracks.length)];
    const audio = audioRef.current;
    if (!audio) return;

    // Skip fadeOut when not playing to preserve user gesture context
    if (!playingRef.current || audio.volume <= 0) {
      fadingRef.current = false;
      playingRef.current = false;
      playTrack(entry);
    } else {
      fadingRef.current = true;
      fadeOut(audio, 500).then(() => {
        fadingRef.current = false;
        playingRef.current = false;
        playTrack(entry);
      });
    }
  }, [fadeOut, playTrack]);

  // ── Speech ducking & OOM mute ─────────────────────────────────

  const duckingRef = useRef(false);
  const oomMuteRef = useRef(false);
  const duckIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const cancelDuckRamp = useCallback(() => {
    if (duckIntervalRef.current) {
      clearInterval(duckIntervalRef.current);
      duckIntervalRef.current = null;
    }
  }, []);

  /** Compute the effective target volume based on OOM mute + speech ducking */
  const getEffectiveTarget = useCallback(() => {
    if (oomMuteRef.current) return 0;
    if (duckingRef.current) return mainVolumeRef.current * 0.35;
    return mainVolumeRef.current;
  }, []);

  /** Smoothly ramp to a target volume (cancels any in-flight ramp) */
  const rampVolume = useCallback((target: number, steps: number, stepMs: number) => {
    cancelDuckRamp();
    const audio = audioRef.current;
    if (!audio) return;
    const stepVol = (target - audio.volume) / steps;
    let i = 0;
    duckIntervalRef.current = setInterval(() => {
      i++;
      if (i >= steps || !audioRef.current) {
        audio.volume = Math.max(0, Math.min(1, target));
        cancelDuckRamp();
      } else {
        audio.volume = Math.max(0, Math.min(1, audio.volume + stepVol));
      }
    }, stepMs);
  }, [cancelDuckRamp]);

  const setDucking = useCallback((duck: boolean) => {
    const audio = audioRef.current;
    if (!audio || duckingRef.current === duck) return;
    duckingRef.current = duck;
    // OOM mute takes priority — don't change volume
    if (oomMuteRef.current) return;
    const target = getEffectiveTarget();
    rampVolume(target, duck ? 8 : 12, duck ? 40 : 60);
  }, [getEffectiveTarget, rampVolume]);

  /** OOM mute — fades music out then pauses playback.
   *  When cleared, resumes and restores volume. */
  const setOomMute = useCallback((mute: boolean) => {
    if (oomMuteRef.current === mute) return;
    oomMuteRef.current = mute;
    const audio = audioRef.current;
    if (!audio) return;

    if (mute) {
      // Record scratch + hard stop — dramatic break on error
      cancelDuckRamp();
      // Play a random record scratch SFX over the dying music
      const scratchIdx = Math.floor(Math.random() * 6) + 1;
      const scratch = new Audio(`${BASE}guruswami/sfx/audio_stop0000${scratchIdx}.m4a`);
      scratch.volume = 0.3;
      scratch.play().catch(() => {});
      // Quick fade to silence (200ms) then pause — keeps currentTime for resume
      const startVol = audio.volume;
      const fadeSteps = 8;
      const fadeMs = 25;
      let step = 0;
      const fadeInterval = setInterval(() => {
        step++;
        if (step >= fadeSteps) {
          audio.volume = 0;
          audio.pause();
          clearInterval(fadeInterval);
        } else {
          audio.volume = Math.max(0, startVol * (1 - step / fadeSteps));
        }
      }, fadeMs);
    } else {
      // Resume playback and fade back up
      const target = getEffectiveTarget();
      audio.volume = 0;
      audio.play().then(() => {
        rampVolume(target, 20, 75);
      }).catch(() => {
        // Autoplay blocked — will resume on next user interaction
      });
    }
  }, [getEffectiveTarget, rampVolume, cancelDuckRamp]);

  return {
    enabled, toggle, trackName, setTempo, setAudioQuality, next, prev, random,
    phase, setPhase, playStinger, playReward, setActiveModel, setDucking, setOomMute,
    analyserRef, onTrackChangeRef, trackChangeCountRef,
  };
}
