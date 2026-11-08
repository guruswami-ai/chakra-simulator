
import React, { useEffect, useRef, useState, useMemo } from 'react';
import ConceptHelper from './ConceptHelper';
import { Activity, Zap, Coffee, PartyPopper, Sparkles } from 'lucide-react';

interface InferenceCoreProps {
  tps: number;           // Dynamic TPS for display (can burst during inference)
  estimatedTps?: number; // Steady estimated TPS for animation (from SimulationPanel)
  color: string;
  perplexity?: number;  // Optional perplexity score (lower = smarter, higher = dumber)
  quantization?: string; // Optional quantization label (e.g., "4-bit", "FP16")
  modelName?: string;    // Model name for size detection (e.g., "Llama-3.2-70B-Instruct")
  nodeCount?: number;    // Number of nodes in use (1 = single, 5 = full mesh)
  weightsPerNode?: number; // Model weights GB per node
  kvCachePerNode?: number; // KV cache GB per node
  freePerNode?: number;    // Remaining GB per node (512 - weights - kv)
  analyserRef?: React.RefObject<AnalyserNode | null>; // Audio analyser for visual amplitude
  compact?: boolean;     // When true, hide left-column panels (Inference Status, Model Quality, Node Memory)
}

// ═══════════════════════════════════════════════════════════════════════
// MODEL SIZE DETECTION & PERFORMANCE RATIO
// ═══════════════════════════════════════════════════════════════════════
// TPS is relative to model size. A 1T model at 15 TPS is blazing fast,
// while an 8B model at 80 TPS is actually slow.

interface ModelSizeInfo {
  params: number;       // Billions of parameters
  category: 'tiny' | 'small' | 'medium' | 'large' | 'massive' | 'colossal';
  expectedTpsSingle: number;  // Expected TPS on single node
  expectedTpsMesh: number;    // Expected TPS on full mesh (5 nodes)
}

// Known model patterns with size detection
const MODEL_SIZE_PATTERNS: Array<{ pattern: RegExp; params: number }> = [
  // Explicit size in name (most common)
  { pattern: /(\d+(?:\.\d+)?)\s*[Tt](?:rillion)?/i, params: -1 }, // 1T, 1.5T
  { pattern: /(\d+(?:\.\d+)?)\s*[Bb](?:illion)?/i, params: -2 },  // 70B, 8B
  { pattern: /(\d+(?:\.\d+)?)\s*[Mm](?:illion)?/i, params: -3 },  // 350M

  // Known model families (fallback if size not in name)
  { pattern: /kimi.*k2|moonshot/i, params: 1000 },       // Kimi K2 ~1T MoE
  { pattern: /deepseek.*v3|deepseek.*r1/i, params: 671 }, // DeepSeek V3/R1 671B MoE
  { pattern: /qwen.*235/i, params: 235 },                 // Qwen 235B MoE
  { pattern: /llama.*405/i, params: 405 },                // Llama 405B
  { pattern: /llama.*70/i, params: 70 },                  // Llama 70B
  { pattern: /llama.*8/i, params: 8 },                    // Llama 8B
  { pattern: /llama.*3[.-]2.*3/i, params: 3 },            // Llama 3.2 3B
  { pattern: /llama.*3[.-]2.*1/i, params: 1 },            // Llama 3.2 1B
  { pattern: /gemma.*27/i, params: 27 },                  // Gemma 27B
  { pattern: /gemma.*9/i, params: 9 },                    // Gemma 9B
  { pattern: /gemma.*2/i, params: 2 },                    // Gemma 2B
  { pattern: /mistral.*large/i, params: 123 },            // Mistral Large
  { pattern: /mistral.*8x22/i, params: 141 },             // Mixtral 8x22B
  { pattern: /mistral.*8x7/i, params: 47 },               // Mixtral 8x7B
  { pattern: /phi.*4/i, params: 14 },                     // Phi-4
  { pattern: /phi.*3/i, params: 3.8 },                    // Phi-3
  { pattern: /command.*r\+/i, params: 104 },              // Command R+
  { pattern: /command.*r/i, params: 35 },                 // Command R
];

// Expected TPS baselines by model size category
// These are calibrated for Apple Silicon M3 Ultra cluster
const SIZE_CATEGORIES: Record<string, ModelSizeInfo> = {
  tiny:     { params: 3,    category: 'tiny',     expectedTpsSingle: 150, expectedTpsMesh: 200 },   // 1-3B
  small:    { params: 8,    category: 'small',    expectedTpsSingle: 100, expectedTpsMesh: 150 },   // 3-15B
  medium:   { params: 30,   category: 'medium',   expectedTpsSingle: 50,  expectedTpsMesh: 80 },    // 15-50B
  large:    { params: 70,   category: 'large',    expectedTpsSingle: 25,  expectedTpsMesh: 45 },    // 50-150B
  massive:  { params: 405,  category: 'massive',  expectedTpsSingle: 8,   expectedTpsMesh: 18 },    // 150-500B
  colossal: { params: 1000, category: 'colossal', expectedTpsSingle: 2,   expectedTpsMesh: 10 },    // 500B+
};

function detectModelSize(modelName: string | undefined): ModelSizeInfo {
  if (!modelName) return SIZE_CATEGORIES.medium; // Default assumption

  // Try to extract explicit size from name
  for (const { pattern, params } of MODEL_SIZE_PATTERNS) {
    const match = modelName.match(pattern);
    if (match) {
      let detectedParams = params;

      // Handle dynamic extraction (-1 = trillion, -2 = billion, -3 = million)
      if (params === -1) detectedParams = parseFloat(match[1]) * 1000; // T to B
      else if (params === -2) detectedParams = parseFloat(match[1]);
      else if (params === -3) detectedParams = parseFloat(match[1]) / 1000;

      // Map to category
      if (detectedParams <= 3) return { ...SIZE_CATEGORIES.tiny, params: detectedParams };
      if (detectedParams <= 15) return { ...SIZE_CATEGORIES.small, params: detectedParams };
      if (detectedParams <= 50) return { ...SIZE_CATEGORIES.medium, params: detectedParams };
      if (detectedParams <= 150) return { ...SIZE_CATEGORIES.large, params: detectedParams };
      if (detectedParams <= 500) return { ...SIZE_CATEGORIES.massive, params: detectedParams };
      return { ...SIZE_CATEGORIES.colossal, params: detectedParams };
    }
  }

  return SIZE_CATEGORIES.medium; // Default fallback
}

function getExpectedTps(modelInfo: ModelSizeInfo, nodeCount: number): number {
  // Interpolate between single and mesh based on node count
  const t = Math.min(1, (nodeCount - 1) / 4); // 1 node = 0, 5 nodes = 1
  return modelInfo.expectedTpsSingle + t * (modelInfo.expectedTpsMesh - modelInfo.expectedTpsSingle);
}

function getPerformanceRatio(tps: number, expectedTps: number): number {
  if (expectedTps <= 0) return 1;
  return tps / expectedTps;
}

// ═══════════════════════════════════════════════════════════════════════
// TPS MOOD SYSTEM (Performance Ratio Based)
// ═══════════════════════════════════════════════════════════════════════
// Mood is now based on performance ratio (actual TPS / expected TPS).
// A 1T model at 15 TPS (ratio ~1.5) is "party" mode.
// An 8B model at 80 TPS (ratio ~0.8) is just "normal".

type Mood = 'sluggish' | 'normal' | 'party' | 'ludicrous';

// Performance ratio thresholds:
// < 0.3  = sluggish (way below expectations)
// 0.3-0.8 = normal (meeting baseline)
// 0.8-1.3 = party (exceeding expectations)
// > 1.3   = ludicrous (crushing it)
const getMoodFromRatio = (ratio: number, tps: number): Mood => {
  // Special case: no inference happening
  if (tps <= 0) return 'sluggish';

  if (ratio < 0.3) return 'sluggish';
  if (ratio < 0.8) return 'normal';
  if (ratio < 1.3) return 'party';
  return 'ludicrous';
};

// Legacy function for fallback (uses raw TPS)
const getMood = (tps: number): Mood => {
  if (tps < 5) return 'sluggish';
  if (tps < 20) return 'normal';
  if (tps < 35) return 'party';
  return 'ludicrous';
};

// Status messages for each mood - cycling through these adds personality
// MASSIVE variety to keep it entertaining!
const STATUS_MESSAGES: Record<Mood, string[]> = {
  sluggish: [
    // Bored & Waiting
    "So slow...",
    "Boring TPS",
    "This better be insightful",
    "Are we there yet?",
    "Contemplating existence",
    "Counting sheep...",
    "Making coffee ☕",
    "Taking a scenic route",
    "Wisdom takes time",
    "Deep thoughts loading",
    "Buffering reality",
    "Existential processing",
    // Frustrated
    "Watching paint dry",
    "Grass growing faster",
    "Dial-up vibes",
    "56k modem energy",
    "Loading... forever",
    "Patience is a virtue",
    "Rome wasn't built today",
    "Snail mail mode",
    // Self-aware humor
    "I could walk faster",
    "My grandma types faster",
    "Carrier pigeon backup?",
    "Sending via fax...",
    "Using semaphore flags",
    "Smoke signals ready",
    "Is it plugged in?",
    "Have you tried rebooting?",
    // Existential
    "Pondering the void",
    "Questioning my purpose",
    "Why are we here?",
    "Heat death of universe ETA",
    "Entropy accelerating",
    "Watching ice melt",
    "Continental drift pace",
    "Tectonic speed",
  ],
  normal: [
    // Professional
    "CORE_STREAMING",
    "Tokens flowing",
    "Steady progress",
    "Cruising along",
    "In the zone",
    "Inference active",
    "Pipeline healthy",
    "Nominal throughput",
    "Tokens on track",
    "Crunching numbers",
    // Competent
    "Systems nominal",
    "All cylinders firing",
    "Smooth sailing",
    "Green across the board",
    "Operating parameters OK",
    "Within spec",
    "Cruising altitude",
    "Autopilot engaged",
    // Casual professional
    "Doing the thing",
    "Making progress",
    "Tokens go brrrr",
    "Working on it",
    "Processing vibes",
    "Inference-ing",
    "Token factory open",
    "Assembly line rolling",
    // Zen mode
    "Finding balance",
    "Harmony achieved",
    "Flow state active",
    "One with the tokens",
    "Calm and collected",
    "Steady as she goes",
  ],
  party: [
    // Classic celebrations
    "🎉 PARTY MODE!",
    "🚀 Ludicrous speed!",
    "⚡ Faster than reading!",
    "🔥 Woah, crazy TPS!",
    "✨ Vibes are immaculate",
    "💫 We're cooking now!",
    "🌈 Rainbow mode!",
    "🎊 Peak performance!",
    "💎 Diamond hands TPS",
    "🦄 Unicorn energy!",
    "🎸 MAXIMUM OVERDRIVE",
    "🌟 Stars aligning!",
    "🎯 Hitting different",
    "🔮 Future is NOW",
    "💥 BOOM! Token shower!",
    // Meme references
    "🚀 To the moon!",
    "💎 HODL those tokens!",
    "🔥 This is fine",
    "😎 Deal with it",
    "🐕 Such speed, much wow",
    "🦍 Ape together strong",
    "📈 Stonks only go up",
    "🎰 Jackpot mode!",
    // Music/DJ vibes
    "🎧 DJ TPS in the house!",
    "🪩 Disco never dies!",
    "🎹 Synthwave activated",
    "🎺 Tokens go brrrrrap!",
    "🥁 Beat drops here",
    "🎵 In perfect harmony",
    "🎤 Karaoke champion",
    "🎻 Symphony of speed",
    // Over the top
    "🌪️ TURBO ACTIVATED",
    "⚡ WARP SPEED!",
    "🏎️ VROOM VROOM",
    "✈️ Supersonic mode",
    "🚄 Bullet train energy",
    "🏄 Riding the wave",
    "🎢 WHEEEEEEE!",
    "🎠 Carousel of joy",
    // Food & drink
    "🍾 Pop the champagne!",
    "🥳 Birthday every day!",
    "🍕 Pizza party mode",
    "🎂 Cake for everyone!",
    "🍩 Donut worry be happy",
    "☕ Espresso shot energy",
  ],
  ludicrous: [
    // Beyond comprehension
    "🤯 BEYOND LUDICROUS",
    "🌌 HYPERDRIVE ENGAGED",
    "⚡ UNLIMITED POWER!",
    "🔥 SUPERNOVA MODE",
    "💎 ABSOLUTE UNIT",
    "🚀 ESCAPE VELOCITY",
    "✨ TRANSCENDENCE",
    "🎆 GALACTIC BRAIN",
    "👑 LEGENDARY STATUS",
    "💫 REALITY.EXE CRASHED",
    "🌈 FULL SPECTRUM",
    "🎪 CIRCUS MAXIMUS",
    // Cosmic level
    "🌌 Multiverse unlocked",
    "🕳️ Black hole speeds",
    "💫 Big bang energy",
    "🌠 Shooting star mode",
    "☄️ Asteroid incoming",
    "🛸 UFO confirmed",
    "👽 Phone home speeds",
    "🌍 Rotating faster",
    // Movie references
    "🎬 Plaid mode engaged",
    "⏰ 88mph achieved",
    "🔮 Prophecy fulfilled",
    "🧙 You shall PASS!",
    "🦸 With great TPS...",
    "🤖 I'll be back... faster",
    "👾 Game over for slow",
    "🎮 God mode ON",
    // Absurdist
    "🦑 Kraken released",
    "🐉 Dragon awakened",
    "🦖 Dino resurrection",
    "🌋 Volcano of tokens",
    "🌊 Tsunami of speed",
    "⚡ Thor's blessing",
    "🔱 Poseidon approves",
    "👁️ All-seeing TPS",
    // Pure chaos
    "🎰 INFINITE JACKPOT",
    "💰 MONEY PRINTER GO",
    "🏆 GOAT ACHIEVEMENT",
    "🥇 OLYMPIC RECORD",
    "📊 OFF THE CHARTS",
    "🔊 BASS DROP MAXIMUM",
    "🎸 GUITAR SOLO ETERNAL",
    "🥁 DRUM SOLO INFINITE",
  ],
};

// Party mode color palette - vibrant disco colors
const PARTY_COLORS = [
  '#ff006e', // Hot pink
  '#8338ec', // Purple
  '#3a86ff', // Electric blue
  '#06d6a0', // Mint
  '#ffbe0b', // Gold
  '#fb5607', // Orange
  '#ff006e', // Magenta
  '#00f5d4', // Cyan
  '#f72585', // Pink
  '#7209b7', // Violet
];


// ═══════════════════════════════════════════════════════════════════════
// PERPLEXITY / INTELLIGENCE MOOD SYSTEM
// ═══════════════════════════════════════════════════════════════════════
// Lower perplexity = smarter model, higher perplexity = dumber model
// Typical ranges: 1.5-3 (genius), 3-6 (smart), 6-15 (average), 15-30 (struggling), 30+ (confused)

type IntelligenceMood = 'genius' | 'smart' | 'average' | 'struggling' | 'confused';

const getIntelligenceMood = (perplexity: number): IntelligenceMood => {
  if (perplexity < 3) return 'genius';
  if (perplexity < 6) return 'smart';
  if (perplexity < 15) return 'average';
  if (perplexity < 30) return 'struggling';
  return 'confused';
};

const INTELLIGENCE_MESSAGES: Record<IntelligenceMood, string[]> = {
  genius: [
    // Classic genius
    "🧠 Galaxy brain",
    "🎓 PhD energy",
    "💎 Crystal clear",
    "✨ Enlightened",
    "🔮 Oracle mode",
    "👑 Big brain time",
    "🌟 Peak coherence",
    "💫 Omniscient",
    "🎯 Laser focused",
    "🧬 Perfect recall",
    // Intellectual flex
    "📖 Encyclopedia mode",
    "🎼 Perfect pitch logic",
    "🔬 Scientific precision",
    "🏛️ Aristotle vibes",
    "🎭 Shakespeare tier",
    "🧪 Lab-grade accuracy",
    "📐 Geometric perfection",
    "🌌 Cosmic understanding",
    "⚛️ Quantum clarity",
    "🔭 Visionary insight",
    // Mythical/Pop culture
    "🧙 Gandalf wisdom",
    "🦉 Owl council approved",
    "🐉 Dragon intellect",
    "👁️ Third eye open",
    "🌙 Lunar enlightenment",
    "☀️ Solar brilliance",
    "🗿 Ancient wisdom",
    "🏆 Nobel material",
    "🎪 Genius certified",
    "💠 Diamond mind",
  ],
  smart: [
    // Classic competent
    "📚 Well-read",
    "💡 Sharp thinking",
    "🎯 On point",
    "✅ Making sense",
    "🧠 Clever mode",
    "📖 Articulate",
    "💪 Strong logic",
    "🌿 Clear headed",
    // Professional competence
    "📊 Data-driven",
    "🎓 Dean's list brain",
    "📝 A+ quality",
    "🔧 Well-calibrated",
    "⚡ Quick wit",
    "🎨 Creative clarity",
    "🧭 Well-oriented",
    "🎹 In tune",
    "🔑 Key insights",
    "🌊 Smooth flow",
    // Confident competence
    "🦅 Eagle eye",
    "🐺 Wolf pack smart",
    "🦊 Fox clever",
    "🐬 Dolphin brain",
    "🦋 Metamorphosed",
    "🌱 Flourishing logic",
    "🍎 Newton moment",
    "🧲 Magnetic reasoning",
    "⚖️ Balanced view",
    "🎭 Nuanced take",
  ],
  average: [
    // Neutral processing
    "🤔 Thinking...",
    "📝 Working on it",
    "⚙️ Processing",
    "🔄 Reasoning",
    "💭 Pondering",
    "🧩 Piecing together",
    "📊 Calculating",
    "🔍 Analyzing",
    // Honest effort
    "🚶 Getting there",
    "📦 Unpacking ideas",
    "🔨 Building logic",
    "🎣 Fishing for words",
    "🧶 Untangling",
    "🔗 Connecting dots",
    "📎 Holding together",
    "🪜 Step by step",
    // Self-aware mediocrity
    "🌤️ Partly cloudy",
    "🚗 Middle lane",
    "📻 Average signal",
    "🎲 50/50 odds",
    "⏳ Buffering brain",
    "🧊 Lukewarm take",
    "🥈 Silver tier",
    "🌡️ Room temperature IQ",
    "🎯 Close enough",
    "🛠️ Under construction",
  ],
  struggling: [
    // Classic confusion
    "😅 Bit fuzzy",
    "🌀 Kinda confused",
    "💨 Brain fog",
    "🤷 Winging it",
    "🎲 Guessing maybe?",
    "🌫️ Hazy thoughts",
    "😬 Not my best",
    "🔀 Scrambled eggs",
    // Admission of struggle
    "🥴 Seeing double",
    "🌊 In over my head",
    "🎪 Juggling badly",
    "🧵 Losing the thread",
    "🔦 Lost in the dark",
    "🗺️ Wrong map",
    "🧭 Compass spinning",
    "🎯 Missing the mark",
    "🪃 Boomerang logic",
    "🎈 Deflating fast",
    // Humorous struggle
    "🐌 Snail brain",
    "🦥 Sloth thoughts",
    "🧀 Swiss cheese logic",
    "🍜 Noodle brain",
    "🥔 Potato processing",
    "🧱 Hitting walls",
    "🌋 Overheating",
    "💤 Half asleep",
    "🎭 Improvising badly",
    "🚧 Road closed ahead",
  ],
  confused: [
    // Classic chaos
    "🤪 Dumb-dumb mode",
    "🥴 Word salad",
    "🌪️ Total chaos",
    "🎪 Circus brain",
    "🐒 Monkey typing",
    "🗑️ Garbage out",
    "💀 Brain.exe crashed",
    "🎰 Random tokens",
    "🌈 Hallucinating",
    "🦆 Quack quack",
    "🍝 Spaghetti logic",
    "👻 Ghost thoughts",
    // Absurdist confusion
    "🦑 Tentacle logic",
    "🌋 Volcanic nonsense",
    "🎲 Dice roll answers",
    "🧟 Zombie mode",
    "👽 Alien transmission",
    "🌀 Void speaking",
    "🎭 Mask malfunction",
    "🔮 Crystal ball cracked",
    "🃏 Joker brain",
    "🎨 Abstract expressionism",
    // Self-deprecating chaos
    "🥶 Absolute zero IQ",
    "🧊 Frozen logic",
    "💫 Seeing stars",
    "🌙 Lunatic mode",
    "🦴 Skeleton crew brain",
    "🎃 Pumpkin head",
    "🧽 Sponge brain",
    "🌊 Drowning in tokens",
    "🎢 Rollercoaster logic",
    "🦎 Lizard brain only",
    // Ultimate chaos
    "📺 Static noise",
    "💿 Disc read error",
    "📡 Signal lost",
    "🔇 Error beeps only",
    "🗿 Easter Island mode",
    "🌌 Lost in space",
    "⚫ Black hole brain",
    "🎆 Neurons fireworks",
    "🧨 Self-destructing",
    "🌪️ Tornado of words",
  ],
};

const INTELLIGENCE_STYLES: Record<IntelligenceMood, {
  color: string;
  bgColor: string;
  borderColor: string;
  icon: string;
  glowColor: string;
}> = {
  genius: {
    color: 'text-violet-400',
    bgColor: 'bg-violet-500/20',
    borderColor: 'border-violet-500/30',
    icon: '🧠',
    glowColor: 'rgba(139, 92, 246, 0.4)',
  },
  smart: {
    color: 'text-emerald-400',
    bgColor: 'bg-emerald-500/20',
    borderColor: 'border-emerald-500/30',
    icon: '💡',
    glowColor: 'rgba(16, 185, 129, 0.3)',
  },
  average: {
    color: 'text-blue-400',
    bgColor: 'bg-blue-500/20',
    borderColor: 'border-blue-500/30',
    icon: '🤔',
    glowColor: 'rgba(59, 130, 246, 0.2)',
  },
  struggling: {
    color: 'text-amber-400',
    bgColor: 'bg-amber-500/20',
    borderColor: 'border-amber-500/30',
    icon: '😅',
    glowColor: 'rgba(245, 158, 11, 0.3)',
  },
  confused: {
    color: 'text-red-400',
    bgColor: 'bg-red-500/20',
    borderColor: 'border-red-500/30',
    icon: '🤪',
    glowColor: 'rgba(239, 68, 68, 0.4)',
  },
};

const InferenceCore: React.FC<InferenceCoreProps> = ({ tps, estimatedTps, color, perplexity, quantization, modelName, nodeCount = 1, weightsPerNode, kvCachePerNode, freePerNode, analyserRef, compact }) => {
  const layerCount = 10;
  const particlesRef = useRef<any[]>([]);
  const discoRef = useRef<any[]>([]);
  const streamerRef = useRef<any[]>([]);
  const pulseWaveRef = useRef<any[]>([]);      // Neural pulse waves
  const burstRef = useRef<any[]>([]);          // Token burst explosions
  const energyFieldRef = useRef<number>(0);    // Energy field intensity
  const requestRef = useRef<number>(0);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const prevTpsRef = useRef<number>(0);        // Track TPS changes for bursts
  const audioDataRef = useRef<Uint8Array | null>(null); // Reusable buffer for analyser

  // Use estimatedTps for animation (steady rate), fall back to tps if not provided
  const animationTps = estimatedTps ?? tps;

  // Performance ratio calculation - use animationTps for consistent mood
  const modelInfo = useMemo(() => detectModelSize(modelName), [modelName]);
  const expectedTps = useMemo(() => getExpectedTps(modelInfo, nodeCount), [modelInfo, nodeCount]);
  const performanceRatio = useMemo(() => getPerformanceRatio(animationTps, expectedTps), [animationTps, expectedTps]);

  // TPS Message cycling state - now uses performance ratio for mood
  // Use animationTps for mood so animation runs at expected rate even when tps is 0
  const [messageIndex, setMessageIndex] = useState(0);
  const mood = useMemo(() => modelName ? getMoodFromRatio(performanceRatio, animationTps) : getMood(animationTps), [performanceRatio, animationTps, modelName]);
  const messages = STATUS_MESSAGES[mood];

  // Intelligence message cycling state
  const [intelligenceMessageIndex, setIntelligenceMessageIndex] = useState(0);
  const intelligenceMood = useMemo(() =>
    perplexity !== undefined ? getIntelligenceMood(perplexity) : null,
    [perplexity]
  );
  const intelligenceMessages = intelligenceMood ? INTELLIGENCE_MESSAGES[intelligenceMood] : [];
  const intelligenceStyle = intelligenceMood ? INTELLIGENCE_STYLES[intelligenceMood] : null;

  // Cycle through TPS status messages
  useEffect(() => {
    const interval = setInterval(() => {
      setMessageIndex(prev => (prev + 1) % messages.length);
    }, mood === 'party' || mood === 'ludicrous' ? 1500 : 3000); // Faster cycling in party mode
    return () => clearInterval(interval);
  }, [messages.length, mood]);

  // Cycle through intelligence messages
  useEffect(() => {
    if (!intelligenceMessages.length) return;
    const interval = setInterval(() => {
      setIntelligenceMessageIndex(prev => (prev + 1) % intelligenceMessages.length);
    }, intelligenceMood === 'confused' ? 1000 : 2500); // Faster when confused
    return () => clearInterval(interval);
  }, [intelligenceMessages.length, intelligenceMood]);

  // Reset message index when mood changes
  useEffect(() => {
    setMessageIndex(0);
  }, [mood]);

  // Reset intelligence message index when intelligence mood changes
  useEffect(() => {
    setIntelligenceMessageIndex(0);
  }, [intelligenceMood]);

  useEffect(() => {
    const animate = (time: number) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      ctx.clearRect(0, 0, canvas.width, canvas.height);

      const width = canvas.width;
      const height = canvas.height;
      const centerY = height / 2 + 30;
      const stackHeight = 260;
      const top = centerY - stackHeight / 2;
      const bottom = centerY + stackHeight / 2;

      // ═══════════════════════════════════════════════════════════════════
      // AUDIO LEVEL — read RMS amplitude from analyser (0-1)
      // ═══════════════════════════════════════════════════════════════════
      let audioLevel = 0;
      if (analyserRef?.current) {
        if (!audioDataRef.current || audioDataRef.current.length !== analyserRef.current.frequencyBinCount) {
          audioDataRef.current = new Uint8Array(analyserRef.current.frequencyBinCount);
        }
        analyserRef.current.getByteTimeDomainData(audioDataRef.current as Uint8Array<ArrayBuffer>);
        let sum = 0;
        for (let i = 0; i < audioDataRef.current.length; i++) {
          const v = (audioDataRef.current[i] - 128) / 128;
          sum += v * v;
        }
        audioLevel = Math.min(1, Math.sqrt(sum / audioDataRef.current.length) * 3); // Boost + clamp
      }

      // ═══════════════════════════════════════════════════════════════════
      // CIRCULAR CLIP — contain all animation within the pentagon inscribed circle
      // ═══════════════════════════════════════════════════════════════════
      const clipRadius = Math.min(width, height) * 0.46;
      ctx.save();
      ctx.beginPath();
      ctx.arc(width / 2, centerY, clipRadius, 0, Math.PI * 2);
      ctx.clip();

      // Use animationTps for steady animation rate (estimated TPS)
      const normalizedTps = Math.min(animationTps / 30, 1.5);
      const isParty = mood === 'party' || mood === 'ludicrous';
      const isLudicrous = mood === 'ludicrous';
      const isSluggish = mood === 'sluggish';

      // Adjust speed based on mood
      const moodSpeedMultiplier = isSluggish ? 0.4 : (isLudicrous ? 2.5 : (isParty ? 1.8 : 1));
      const speedMultiplier = (1 + normalizedTps * 2.5) * moodSpeedMultiplier;
      const oscillationSpeed = (0.002 + (normalizedTps * 0.012)) * (isSluggish ? 0.3 : 1);
      const intensity = 0.1 + (normalizedTps * 0.5);

      // ═══════════════════════════════════════════════════════════════════
      // PARTY MODE: Disco Ball Effect (floating sparkles at top)
      // ═══════════════════════════════════════════════════════════════════
      if (isParty && Math.random() < 0.3) {
        discoRef.current.push({
          x: Math.random() * width,
          y: 10 + Math.random() * 40,
          size: 1 + Math.random() * 3,
          opacity: 0.8 + Math.random() * 0.2,
          color: PARTY_COLORS[Math.floor(Math.random() * PARTY_COLORS.length)],
          twinkle: Math.random() * Math.PI * 2,
          lifetime: 0,
          maxLife: 30 + Math.random() * 30,
        });
      }

      // Render disco sparkles
      discoRef.current = discoRef.current.filter(d => d.lifetime < d.maxLife);
      discoRef.current.forEach(d => {
        d.lifetime++;
        const twinkle = Math.sin(time * 0.02 + d.twinkle) * 0.5 + 0.5;
        ctx.globalAlpha = d.opacity * twinkle * (1 - d.lifetime / d.maxLife);
        ctx.fillStyle = d.color;
        ctx.beginPath();
        // Draw a 4-point star
        const s = d.size * (1 + twinkle * 0.5);
        ctx.moveTo(d.x, d.y - s * 2);
        ctx.lineTo(d.x + s * 0.5, d.y - s * 0.5);
        ctx.lineTo(d.x + s * 2, d.y);
        ctx.lineTo(d.x + s * 0.5, d.y + s * 0.5);
        ctx.lineTo(d.x, d.y + s * 2);
        ctx.lineTo(d.x - s * 0.5, d.y + s * 0.5);
        ctx.lineTo(d.x - s * 2, d.y);
        ctx.lineTo(d.x - s * 0.5, d.y - s * 0.5);
        ctx.closePath();
        ctx.fill();
      });

      // ═══════════════════════════════════════════════════════════════════
      // NEW: ENERGY FIELD AURA (glowing halo around the stack)
      // ═══════════════════════════════════════════════════════════════════
      // The aura expands/contracts based on performance ratio
      const targetEnergy = Math.min(1.5, performanceRatio);
      energyFieldRef.current += (targetEnergy - energyFieldRef.current) * 0.05; // Smooth interpolation
      const energyLevel = energyFieldRef.current;

      if (animationTps > 0 && energyLevel > 0.1) {
        const auraRadius = 60 + energyLevel * 40;
        const auraPulse = Math.sin(time * 0.003) * 10;

        // Outer glow
        const auraGradient = ctx.createRadialGradient(
          width / 2, centerY, 20,
          width / 2, centerY, auraRadius + auraPulse
        );

        let auraColor = color;
        if (isLudicrous) {
          auraColor = PARTY_COLORS[Math.floor((time * 0.005) % PARTY_COLORS.length)];
        } else if (isParty) {
          auraColor = '#fbbf24'; // Gold
        }

        auraGradient.addColorStop(0, auraColor + '00');
        auraGradient.addColorStop(0.4, auraColor + Math.floor(energyLevel * 30).toString(16).padStart(2, '0'));
        auraGradient.addColorStop(0.7, auraColor + Math.floor(energyLevel * 15).toString(16).padStart(2, '0'));
        auraGradient.addColorStop(1, auraColor + '00');

        ctx.globalAlpha = 0.6;
        ctx.fillStyle = auraGradient;
        ctx.beginPath();
        ctx.ellipse(width / 2, centerY, auraRadius + auraPulse, (auraRadius + auraPulse) * 0.6, 0, 0, Math.PI * 2);
        ctx.fill();
      }

      // ═══════════════════════════════════════════════════════════════════
      // NEW: NEURAL PULSE WAVES (ripples propagating through layers)
      // ═══════════════════════════════════════════════════════════════════
      // Spawn new pulse waves based on performance
      const pulseChance = isSluggish ? 0.005 : (isLudicrous ? 0.08 : (isParty ? 0.04 : 0.015));
      if (animationTps > 0 && Math.random() < pulseChance) {
        pulseWaveRef.current.push({
          y: top,                    // Start at top of stack
          speed: 2 + performanceRatio * 3,
          opacity: 0.8,
          color: isParty ? PARTY_COLORS[Math.floor(Math.random() * PARTY_COLORS.length)] : color,
          width: 0,                  // Expands as it travels
          maxWidth: 80 + performanceRatio * 40,
        });
      }

      // Render and update pulse waves
      pulseWaveRef.current = pulseWaveRef.current.filter(p => p.y < bottom + 50);
      pulseWaveRef.current.forEach(p => {
        p.y += p.speed;
        p.width = Math.min(p.maxWidth, p.width + 3);
        p.opacity *= 0.98; // Fade out

        // Draw expanding wave
        const waveY = p.y;
        const progress = (waveY - top) / stackHeight;

        ctx.globalAlpha = p.opacity * (1 - progress * 0.5);
        ctx.strokeStyle = p.color;
        ctx.lineWidth = 2 + progress * 2;
        ctx.beginPath();
        ctx.ellipse(width / 2, waveY, p.width * (1 - progress * 0.3), 8 + progress * 4, 0, 0, Math.PI * 2);
        ctx.stroke();

        // Add glow trail
        if (isParty || isLudicrous) {
          ctx.globalAlpha = p.opacity * 0.3;
          ctx.lineWidth = 6;
          ctx.stroke();
        }
      });

      // ═══════════════════════════════════════════════════════════════════
      // NEW: TOKEN BURST EXPLOSIONS (on TPS spikes or high performance)
      // ═══════════════════════════════════════════════════════════════════
      // Detect TPS spike (increase > 20% or entering party/ludicrous)
      const tpsChange = tps - prevTpsRef.current;
      const shouldBurst = (tpsChange > prevTpsRef.current * 0.2 && tps > 5) ||
                          (performanceRatio > 1.0 && Math.random() < 0.02);

      if (shouldBurst && tps > 0) {
        const burstCount = isLudicrous ? 20 : (isParty ? 12 : 6);
        for (let i = 0; i < burstCount; i++) {
          const angle = (Math.PI * 2 * i) / burstCount + Math.random() * 0.5;
          burstRef.current.push({
            x: width / 2,
            y: centerY,
            vx: Math.cos(angle) * (3 + Math.random() * 4) * performanceRatio,
            vy: Math.sin(angle) * (3 + Math.random() * 4) * performanceRatio,
            size: 2 + Math.random() * 3,
            opacity: 1,
            color: isParty ? PARTY_COLORS[Math.floor(Math.random() * PARTY_COLORS.length)] : (Math.random() > 0.5 ? color : '#fff'),
            lifetime: 0,
            maxLife: 30 + Math.random() * 20,
            gravity: 0.05 + Math.random() * 0.05,
          });
        }
      }
      prevTpsRef.current = tps;

      // Render bursts
      burstRef.current = burstRef.current.filter(b => b.lifetime < b.maxLife);
      burstRef.current.forEach(b => {
        b.lifetime++;
        b.x += b.vx;
        b.y += b.vy;
        b.vy += b.gravity; // Gravity pulls down
        b.vx *= 0.98;      // Air resistance
        b.opacity = 1 - (b.lifetime / b.maxLife);

        ctx.globalAlpha = b.opacity;
        ctx.fillStyle = b.color;
        ctx.beginPath();
        ctx.arc(b.x, b.y, Math.max(0, b.size * b.opacity), 0, Math.PI * 2);
        ctx.fill();

        // Sparkle trail for party mode
        if ((isParty || isLudicrous) && b.lifetime % 2 === 0) {
          ctx.globalAlpha = b.opacity * 0.5;
          ctx.beginPath();
          ctx.arc(b.x - b.vx * 2, b.y - b.vy * 2, b.size * 0.5, 0, Math.PI * 2);
          ctx.fill();
        }
      });

      // ═══════════════════════════════════════════════════════════════════
      // RENDER STACK LAYERS — color from TPS, size from audio
      // ═══════════════════════════════════════════════════════════════════
      // Audio-reactive scale: rings breathe with music amplitude (1x quiet → 2.5x loud)
      const audioScale = 1 + audioLevel * 1.5;

      ctx.lineWidth = isParty ? 1.5 : 1;
      for (let i = 0; i < layerCount; i++) {
        const y = top + (i / (layerCount - 1)) * stackHeight;
        const yOffset = Math.sin(time * oscillationSpeed + i * 0.8) * (2.5 * normalizedTps);
        const opacity = isSluggish
          ? 0.02 + (Math.sin(time * oscillationSpeed + i * 0.5) * 0.02)
          : 0.04 + (Math.sin(time * oscillationSpeed + i * 0.5) * 0.04) + (intensity * 0.18);

        // TPS-driven color: slow = muted, party = rainbow cycling
        let layerColor = color;
        if (isParty) {
          const colorIndex = Math.floor((time * 0.003 + i * 0.5) % PARTY_COLORS.length);
          layerColor = PARTY_COLORS[colorIndex];
        }

        // Circular Layer Halo — radii scale with audio level
        const baseRx = 48 - (i * 1.5);
        const baseRy = 10;
        ctx.beginPath();
        ctx.ellipse(width / 2, y + yOffset, baseRx * audioScale, baseRy * audioScale, 0, 0, Math.PI * 2);
        ctx.strokeStyle = layerColor;
        ctx.globalAlpha = isParty ? opacity * 1.5 : opacity;
        ctx.stroke();

        // Inner Pulse Line
        const pulseHalf = 15 * audioScale;
        ctx.beginPath();
        ctx.moveTo(width / 2 - pulseHalf, y + yOffset);
        ctx.lineTo(width / 2 + pulseHalf, y + yOffset);
        ctx.stroke();

        // Party mode: Add glow effect to layers
        if (isParty && i % 2 === 0) {
          ctx.beginPath();
          ctx.ellipse(width / 2, y + yOffset, (baseRx + 4) * audioScale, (baseRy + 2) * audioScale, 0, 0, Math.PI * 2);
          ctx.strokeStyle = layerColor;
          ctx.globalAlpha = 0.1;
          ctx.lineWidth = 4;
          ctx.stroke();
          ctx.lineWidth = isParty ? 1.5 : 1;
        }
      }

      // ═══════════════════════════════════════════════════════════════════
      // MAIN PARTICLES (with party mode rainbow colors)
      // ═══════════════════════════════════════════════════════════════════
      // Use animationTps for steady particle spawn rate
      const particleChance = isSluggish ? animationTps / 50 : (isParty ? animationTps / 8 : animationTps / 20);
      if (animationTps > 0 && Math.random() < particleChance) {
        let particleColor = color;
        if (isParty) {
          particleColor = PARTY_COLORS[Math.floor(Math.random() * PARTY_COLORS.length)];
        } else if (Math.random() > 0.8) {
          particleColor = '#fff';
        }

        particlesRef.current.push({
          y: top,
          speed: (1.8 + Math.random() * 3.5) * speedMultiplier,
          id: Math.random(),
          size: isParty ? (1.5 + Math.random() * 3.0) : (1.2 + Math.random() * 2.0),
          drift: (Math.random() - 0.5) * (isParty ? 30 : 18),
          opacity: 0.5 + Math.random() * 0.5,
          color: particleColor,
          isRainbow: isParty && Math.random() > 0.7,
        });
      }

      // Particle Physics and Rendering
      particlesRef.current = particlesRef.current.filter(p => p.y < bottom);
      particlesRef.current.forEach(p => {
        p.y += p.speed;

        // Rainbow particles cycle colors as they fall
        if (p.isRainbow) {
          const colorIndex = Math.floor((time * 0.01 + p.y * 0.05) % PARTY_COLORS.length);
          p.color = PARTY_COLORS[colorIndex];
        }

        const trailLength = isParty ? (15 + (normalizedTps * 50)) : (10 + (normalizedTps * 35));
        const gradient = ctx.createLinearGradient(0, p.y - trailLength, 0, p.y);
        gradient.addColorStop(0, 'transparent');
        gradient.addColorStop(1, p.color);

        ctx.globalAlpha = p.opacity;
        ctx.fillStyle = gradient;

        const jitter = Math.sin(p.y * 0.15) * (2 * normalizedTps) * (isParty ? 2 : 1);
        ctx.beginPath();
        ctx.arc(width / 2 + p.drift + jitter, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();

        // Party mode: Add sparkle trail
        if (isParty && Math.random() > 0.7) {
          ctx.globalAlpha = 0.3;
          ctx.fillStyle = '#fff';
          ctx.beginPath();
          ctx.arc(width / 2 + p.drift + jitter + (Math.random() - 0.5) * 10,
                  p.y - Math.random() * 20,
                  0.5 + Math.random(), 0, Math.PI * 2);
          ctx.fill();
        }

        // High-energy hot spots when passing through layers
        const layerIdx = Math.floor(((p.y - top) / stackHeight) * layerCount);
        if (layerIdx >= 0 && layerIdx < layerCount) {
          const ly = top + (layerIdx / (layerCount - 1)) * stackHeight;
          const yOffset = Math.sin(time * oscillationSpeed + layerIdx * 0.8) * (2.5 * normalizedTps);

          ctx.beginPath();
          ctx.ellipse(width / 2, ly + yOffset, 50 - (layerIdx * 1.5), 11, 0, 0, Math.PI * 2);
          ctx.strokeStyle = isParty ? p.color : '#fff';
          ctx.globalAlpha = isParty ? 0.15 + (intensity * 0.6) : 0.08 + (intensity * 0.5);
          ctx.stroke();
        }
      });

      // ═══════════════════════════════════════════════════════════════════
      // PARTY MODE: Confetti / Streamers (falling from top)
      // ═══════════════════════════════════════════════════════════════════
      if (isParty && Math.random() < (isLudicrous ? 0.4 : 0.15)) {
        streamerRef.current.push({
          x: Math.random() * width,
          y: -10,
          width: 2 + Math.random() * 4,
          height: 8 + Math.random() * 15,
          color: PARTY_COLORS[Math.floor(Math.random() * PARTY_COLORS.length)],
          speed: 1 + Math.random() * 2,
          wobble: Math.random() * Math.PI * 2,
          wobbleSpeed: 0.05 + Math.random() * 0.1,
          rotation: Math.random() * Math.PI,
          rotationSpeed: 0.02 + Math.random() * 0.05,
        });
      }

      // Render streamers
      streamerRef.current = streamerRef.current.filter(s => s.y < height + 20);
      streamerRef.current.forEach(s => {
        s.y += s.speed;
        s.wobble += s.wobbleSpeed;
        s.rotation += s.rotationSpeed;
        const wobbleX = Math.sin(s.wobble) * 15;

        ctx.save();
        ctx.translate(s.x + wobbleX, s.y);
        ctx.rotate(s.rotation);
        ctx.globalAlpha = 0.8;
        ctx.fillStyle = s.color;
        ctx.fillRect(-s.width / 2, -s.height / 2, s.width, s.height);
        ctx.restore();
      });

      // Restore canvas state (releases circular clip)
      ctx.restore();

      requestRef.current = requestAnimationFrame(animate);
    };

    requestRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(requestRef.current);
  }, [animationTps, color, mood, performanceRatio, analyserRef]);

  // Get mood-specific styling
  const getMoodStyles = () => {
    switch (mood) {
      case 'ludicrous':
        return {
          bgOpacity: 0.25 + (tps / 80),
          bgScale: 1.2 + (tps / 40),
          tpsColor: 'text-fuchsia-400',
          glowColor: 'rgba(236, 72, 153, 0.4)',
          indicatorClass: 'bg-fuchsia-500 animate-pulse shadow-[0_0_15px_#ec4899]',
          borderClass: 'border-fuchsia-500/30',
          Icon: Sparkles,
        };
      case 'party':
        return {
          bgOpacity: 0.15 + (tps / 100),
          bgScale: 1 + (tps / 50),
          tpsColor: 'text-yellow-400',
          glowColor: 'rgba(250, 204, 21, 0.3)',
          indicatorClass: 'bg-yellow-400 animate-pulse shadow-[0_0_12px_#facc15]',
          borderClass: 'border-yellow-500/20',
          Icon: PartyPopper,
        };
      case 'sluggish':
        return {
          bgOpacity: 0.04,
          bgScale: 0.8,
          tpsColor: 'text-gray-500',
          glowColor: 'rgba(107, 114, 128, 0.1)',
          indicatorClass: 'bg-gray-500',
          borderClass: 'border-gray-700/30',
          Icon: Coffee,
        };
      default:
        return {
          bgOpacity: 0.08 + (tps / 100),
          bgScale: 0.85 + (tps / 50),
          tpsColor: 'text-emerald-400',
          glowColor: 'rgba(16, 185, 129, 0.2)',
          indicatorClass: 'bg-emerald-500 animate-pulse shadow-[0_0_8px_#10b981]',
          borderClass: 'border-white/10',
          Icon: Zap,
        };
    }
  };

  const styles = getMoodStyles();
  const currentMessage = messages[messageIndex];
  const isParty = mood === 'party' || mood === 'ludicrous';

  return (
    <>
      {/* ═══════ LEFT COLUMN — Party Status + Model Quality stacked ═══════ */}
      {!compact && (
      <div className="absolute top-[7.5rem] left-10 z-40 pointer-events-none w-80 flex flex-col gap-4">
      <div className={`chakra-panel flex flex-col items-center p-7 rounded-[2.5rem] w-full transition-all duration-500 ${isParty ? 'shadow-[0_0_40px_rgba(250,204,21,0.2)]' : ''}`}>
        <span className="text-[10px] font-black uppercase tracking-[0.4em] text-white/40 mb-3 flex items-center gap-3">
          <styles.Icon className={`w-5 h-5 ${isParty ? 'animate-bounce' : ''}`} />
          {isParty ? 'Party Status' : 'Inference Status'}
          <ConceptHelper
            sectionId="tps-ttft"
            label="Inference TPS"
          />
        </span>
        <div className="flex items-baseline gap-3">
          <span className={`text-6xl font-black font-mono text-white tabular-nums transition-all duration-300 ${
            isParty ? 'drop-shadow-[0_0_30px_rgba(250,204,21,0.5)] animate-pulse' : 'drop-shadow-[0_0_20px_rgba(255,255,255,0.2)]'
          }`}>
            {tps.toFixed(1)}
          </span>
          <span className={`text-sm font-black font-mono uppercase tracking-widest transition-colors duration-300 ${styles.tpsColor}`}>
            TPS
          </span>
        </div>

        {/* Mood indicator badge - fixed height to prevent layout jump */}
        <div className={`mt-3 h-6 flex items-center justify-center transition-opacity duration-300 ${isParty ? 'opacity-100' : 'opacity-0'}`}>
          <div className="px-3 py-1 bg-gradient-to-r from-pink-500/20 via-yellow-500/20 to-cyan-500/20 rounded-full border border-white/10">
            <span className="text-[10px] font-black uppercase tracking-wider text-white/80 animate-pulse">
              {mood === 'ludicrous' ? '🌌 BEYOND LIMITS' : '🎉 PARTY MODE'}
            </span>
          </div>
        </div>

        {/* Performance ratio indicator (when model detected) */}
        {modelName && tps > 0 && (
          <div className="mt-3 flex flex-col items-center gap-1">
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-mono text-white/30 uppercase tracking-wider">
                {modelInfo.category} ({modelInfo.params >= 1000 ? `${(modelInfo.params / 1000).toFixed(1)}T` : `${modelInfo.params}B`})
              </span>
              <span className="text-[10px] font-mono text-white/20">•</span>
              <span className={`text-[10px] font-mono font-bold uppercase tracking-wider ${
                performanceRatio >= 1.3 ? 'text-fuchsia-400' :
                performanceRatio >= 0.8 ? 'text-yellow-400' :
                performanceRatio >= 0.3 ? 'text-emerald-400' :
                'text-gray-500'
              }`}>
                {(performanceRatio * 100).toFixed(0)}% of expected
              </span>
            </div>
            {/* Performance bar */}
            <div className="w-32 h-1 bg-white/10 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-500 ${
                  performanceRatio >= 1.3 ? 'bg-gradient-to-r from-fuchsia-500 to-pink-500' :
                  performanceRatio >= 0.8 ? 'bg-gradient-to-r from-yellow-500 to-amber-500' :
                  performanceRatio >= 0.3 ? 'bg-gradient-to-r from-emerald-500 to-green-500' :
                  'bg-gray-500'
                }`}
                style={{ width: `${Math.min(100, performanceRatio * 100)}%` }}
              />
            </div>
          </div>
        )}
      </div>

      {/* ═══════ MODEL QUALITY — stacked below Party Status ═══════ */}
      {perplexity !== undefined && intelligenceStyle && (() => {
        // Quality percentage: 100% at PPL=1 (perfect), 0% at PPL=50+ (chaos)
        const qualityPct = Math.max(0, Math.min(100, (1 - (perplexity - 1) / 49) * 100));
        // Blur amount: 0px at genius → 3px at confused
        const blurPx = intelligenceMood === 'genius' ? 0 :
                        intelligenceMood === 'smart' ? 0.3 :
                        intelligenceMood === 'average' ? 0.8 :
                        intelligenceMood === 'struggling' ? 1.8 : 3.5;
        return (
        <div className={`chakra-panel flex flex-col items-center p-5 rounded-[2rem] w-full transition-all duration-500 border ${intelligenceStyle.borderColor}`}
          style={{
            boxShadow: `0 0 30px ${intelligenceStyle.glowColor}`,
          }}>
          {/* Header with quantization info */}
          <div className="flex items-center justify-between w-full mb-3">
            <span className="text-[10px] font-black uppercase tracking-[0.3em] text-white/40">
              Model Quality
            </span>
            {quantization && (
              <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-full ${intelligenceStyle.bgColor} ${intelligenceStyle.color}`}>
                {quantization}
              </span>
            )}
          </div>

          {/* Perplexity Score */}
          <div className="flex items-baseline gap-2 mb-2">
            <span className="text-3xl">{intelligenceStyle.icon}</span>
            <span className={`text-4xl font-black font-mono tabular-nums ${intelligenceStyle.color}`}>
              {perplexity.toFixed(1)}
            </span>
            <span className="text-xs font-mono text-white/40 uppercase">PPL</span>
          </div>

          {/* Intelligence Mood Label */}
          <div className={`px-3 py-1.5 rounded-full ${intelligenceStyle.bgColor} border ${intelligenceStyle.borderColor} mb-3`}>
            <span className={`text-[11px] font-black uppercase tracking-wider ${intelligenceStyle.color}`}>
              {intelligenceMood === 'genius' ? '🌟 GENIUS MODE' :
               intelligenceMood === 'smart' ? '💡 SHARP' :
               intelligenceMood === 'average' ? '🤔 THINKING' :
               intelligenceMood === 'struggling' ? '😅 STRUGGLING' :
               '🤪 CONFUSED'}
            </span>
          </div>

          {/* Fuzziness visualization — text sample with progressive blur */}
          <div className="w-full px-2 py-2 rounded-lg bg-black/30 mb-3 overflow-hidden">
            <p className="text-[10px] font-mono text-white/70 leading-relaxed transition-all duration-700 text-center"
              style={{ filter: `blur(${blurPx}px)` }}>
              The quick brown fox jumps over the lazy dog
            </p>
          </div>

          {/* Intelligence Status Message */}
          <div className={`text-center transition-all duration-300 ${
            intelligenceMood === 'confused' ? 'animate-pulse' : ''
          }`}>
            <span className={`text-sm font-mono font-bold ${intelligenceStyle.color}`}
              style={{ minWidth: '150px', display: 'inline-block' }}>
              {intelligenceMessages[intelligenceMessageIndex]}
            </span>
          </div>

          {/* Quality Bar — CHAOS (left) to GENIUS (right), more fill = better */}
          <div className="w-full mt-4">
            <div className="flex justify-between text-[10px] font-mono text-white/30 mb-1">
              <span>CHAOS</span>
              <span>FUZZY</span>
              <span>OK</span>
              <span>SHARP</span>
              <span>GENIUS</span>
            </div>
            <div className="h-2 w-full bg-white/10 rounded-full overflow-hidden">
              <div
                className="h-full transition-all duration-500 rounded-full"
                style={{
                  width: `${qualityPct}%`,
                  background: intelligenceMood === 'genius' ? 'linear-gradient(90deg, #a78bfa, #8b5cf6)' :
                              intelligenceMood === 'smart' ? 'linear-gradient(90deg, #34d399, #10b981)' :
                              intelligenceMood === 'average' ? 'linear-gradient(90deg, #60a5fa, #3b82f6)' :
                              intelligenceMood === 'struggling' ? 'linear-gradient(90deg, #fbbf24, #f59e0b)' :
                              'linear-gradient(90deg, #f87171, #ef4444)',
                }}
              />
            </div>
            <div className="flex justify-between text-[10px] font-mono text-white/20 mt-1">
              <span>50+</span>
              <span>30</span>
              <span>15</span>
              <span>5</span>
              <span>1</span>
            </div>
          </div>
        </div>
        );
      })()}

      {/* ═══════ NODE MEMORY — stacked below Model Quality ═══════ */}
      {weightsPerNode !== undefined && weightsPerNode > 0 && (
        <div className={`chakra-panel flex flex-col p-5 rounded-[2rem] w-full transition-all duration-500 border ${
          freePerNode !== undefined && freePerNode <= 0
            ? 'border-red-500/50'
            : freePerNode !== undefined && freePerNode < 25
            ? 'border-amber-500/30'
            : 'border-white/10'
        }`}
          style={{
            boxShadow: freePerNode !== undefined && freePerNode <= 0
              ? '0 0 20px rgba(239, 68, 68, 0.2)'
              : freePerNode !== undefined && freePerNode < 25
              ? '0 0 20px rgba(245, 158, 11, 0.15)'
              : '0 0 20px rgba(255,255,255,0.03)',
          }}>
          {/* Header */}
          <div className="flex items-center justify-between w-full mb-3">
            <span className="text-[10px] font-black uppercase tracking-[0.3em] text-white/40">
              Node Memory
            </span>
            <span className="text-[10px] font-mono font-bold text-white/50">
              {Math.round((weightsPerNode || 0) + (kvCachePerNode || 0))}/512 GB
              {freePerNode !== undefined && freePerNode <= 0 && (
                <span className="ml-1.5 text-[10px] font-black text-red-400 bg-red-500/20 px-1.5 py-0.5 rounded-full animate-pulse">
                  OOM
                </span>
              )}
            </span>
          </div>

          {/* Stacked bar gauge */}
          <div className="w-full h-5 bg-white/10 rounded-full overflow-hidden flex">
            {/* Weights segment */}
            <div
              className="h-full bg-cyan-500 transition-all duration-500"
              style={{ width: `${Math.min(100, (weightsPerNode / 512) * 100)}%` }}
            />
            {/* KV Cache segment */}
            <div
              className="h-full bg-purple-500 transition-all duration-500"
              style={{ width: `${Math.min(100 - (weightsPerNode / 512) * 100, (kvCachePerNode || 0) / 512 * 100)}%` }}
            />
            {/* Free = remainder (background shows through) */}
          </div>

          {/* Legend */}
          <div className="flex flex-col gap-1 mt-3">
            <div className="flex items-center gap-2">
              <div className="w-2.5 h-2.5 rounded-sm bg-cyan-500 flex-shrink-0" />
              <span className="text-[10px] font-mono text-cyan-400">
                {weightsPerNode.toFixed(1)} GB
              </span>
              <span className="text-[10px] font-mono text-white/30">weights</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-2.5 h-2.5 rounded-sm bg-purple-500 flex-shrink-0" />
              <span className="text-[10px] font-mono text-purple-400">
                {(kvCachePerNode || 0) < 1 && (kvCachePerNode || 0) >= 0.01 ? `${Math.round((kvCachePerNode || 0) * 1024)} MB` : `${(kvCachePerNode || 0).toFixed(1)} GB`}
              </span>
              <span className="text-[10px] font-mono text-white/30">kv cache</span>
            </div>
            <div className="flex items-center gap-2">
              <div className={`w-2.5 h-2.5 rounded-sm flex-shrink-0 ${
                freePerNode !== undefined && freePerNode < 25 ? 'bg-amber-500 animate-pulse' : 'bg-white/20'
              }`} />
              <span className={`text-[10px] font-mono ${
                freePerNode !== undefined && freePerNode <= 0 ? 'text-red-400 font-bold' :
                freePerNode !== undefined && freePerNode < 25 ? 'text-amber-400' :
                'text-white/40'
              }`}>
                {freePerNode !== undefined ? freePerNode : 0} GB
              </span>
              <span className={`text-[10px] font-mono ${
                freePerNode !== undefined && freePerNode < 25 ? 'text-amber-400/60' : 'text-white/30'
              }`}>
                {freePerNode !== undefined && freePerNode < 25 ? 'free — LOW' : 'free'}
              </span>
            </div>
          </div>
        </div>
      )}
      </div>
      )}

      {/* ═══════ ANIMATION CANVAS — center stage aura behind guru ═══════ */}
      <div className="absolute inset-0 z-20 pointer-events-none flex items-center justify-center"
           style={{ paddingTop: '15%' }}>
        <div className="relative w-[500px] h-[700px]">
          {/* Background glow - suppressed in compact mode (left panels no longer contain the bleed) */}
          {!compact && (
            <>
              <div
                className={`absolute inset-0 transition-all duration-300 ${isParty ? 'blur-[80px]' : 'blur-[60px]'}`}
                style={{
                  backgroundColor: isParty
                    ? `hsl(${(Date.now() * 0.05) % 360}, 80%, 50%)` // Rainbow cycling
                    : color,
                  opacity: styles.bgOpacity,
                  transform: `scale(${styles.bgScale})`
                }}
              />

              {/* Party mode: Additional rainbow glow layers */}
              {isParty && (
                <>
                  <div
                    className="absolute inset-0 blur-[100px] animate-spin"
                    style={{
                      background: 'conic-gradient(from 0deg, #ff006e, #8338ec, #3a86ff, #06d6a0, #ffbe0b, #fb5607, #ff006e)',
                      opacity: 0.15,
                      animationDuration: '8s',
                    }}
                  />
                  <div
                    className="absolute inset-0 blur-[60px] animate-pulse"
                    style={{
                      background: 'radial-gradient(circle, rgba(255,255,255,0.3) 0%, transparent 70%)',
                      opacity: 0.2,
                    }}
                  />
                </>
              )}
            </>
          )}

          <canvas
            ref={canvasRef}
            width={400}
            height={600}
            className="relative z-20 mx-auto"
          />
        </div>
      </div>

      {/* ═══════ STATUS BADGE — between anahata & manipura ═══════ */}
      <div className="absolute z-30 pointer-events-none"
           style={{ bottom: '12%', left: '50%', transform: 'translateX(-50%)' }}>
        <div className={`px-5 py-2 rounded-full border flex items-center gap-3 transition-all duration-300 ${
          isParty
            ? 'bg-gradient-to-r from-pink-900/80 via-purple-900/80 to-cyan-900/80 border-white/20 shadow-[0_0_20px_rgba(236,72,153,0.3)]'
            : 'bg-black/80 border-white/10'
        }`}>
          <div className={`w-2.5 h-2.5 rounded-full transition-all duration-300 ${
            tps > 0 ? styles.indicatorClass : 'bg-red-500'
          }`} />
          <span className={`text-xs font-mono font-black tracking-widest uppercase transition-all duration-300 ${
            isParty ? 'text-white animate-pulse' : (mood === 'sluggish' ? 'text-gray-500' : 'text-white/80')
          }`}
          style={{
            minWidth: '160px',
            textAlign: 'center',
          }}>
            {currentMessage}
          </span>
        </div>
      </div>

    </>
  );
};

export default InferenceCore;
