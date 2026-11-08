import {
  MODEL_CATALOG,
  QUANTIZATION_DISPLAY,
  Quantization,
} from '../../simulation/modelCatalog';
import type { CharacterConfig, GuruError, ChakraChallenge } from '../types';

const BASE = import.meta.env.BASE_URL || '/';

// ── Model voice file mappings ────────────────────────────────────

const MODEL_VOICE_PREFIX: Record<string, string> = {
  'qwen25-32b':  'gs_model_qwen32b',
  'llama-405b':  'gs_model_llama405b',
  'mixtral-8x7b': 'gs_model_mixtral',
  'deepseek-v3': 'gs_model_deepseek',
  'kimi-k2.5':    'gs_model_kimi_k25',
};

const MODEL_FAREWELL_PREFIX: Record<string, string> = {
  'qwen25-32b':   'gs_model_farewell_qwen',
  'llama-405b':   'gs_model_farewell_llama',
  'mixtral-8x7b': 'gs_model_farewell_mixtral',
  'deepseek-v3':  'gs_model_farewell_deepseek',
  'kimi-k2.5':     'gs_model_farewell_kimi',
};

const MODEL_GREETING_PREFIX: Record<string, string> = {
  'qwen25-32b':   'gs_model_greeting_qwen',
  'llama-405b':   'gs_model_greeting_llama',
  'mixtral-8x7b': 'gs_model_greeting_mixtral',
  'deepseek-v3':  'gs_model_greeting_deepseek',
  'kimi-k2.5':     'gs_model_greeting_kimi',
};

const MUSIC_COMMENTARY_PREFIX: Record<string, { dir: string; prefix: string }> = {
  'qwen25-32b':   { dir: 'music_commentary_qwen',    prefix: 'gs_music_qwen' },
  'llama-405b':   { dir: 'music_commentary_llama',    prefix: 'gs_music_llama' },
  'mixtral-8x7b': { dir: 'music_commentary_mixtral',  prefix: 'gs_music_mixtral' },
  'deepseek-v3':  { dir: 'music_commentary_deepseek', prefix: 'gs_music_deepseek' },
  'kimi-k2.5':     { dir: 'music_commentary_kimi',     prefix: 'gs_music_kimi' },
};

// ── Quant / Context / Batch / Topology voice maps ────────────────

const QUANT_VOICE_PREFIX: Record<string, { prefix: string; variants: number }> = {
  'F16':  { prefix: 'gs_quant_fp16', variants: 3 },
  'Q8':   { prefix: 'gs_quant_q8',   variants: 3 },
  'Q6':   { prefix: 'gs_quant_q6',   variants: 3 },
  'Q4':   { prefix: 'gs_quant_q4',   variants: 4 },
  'Q3':   { prefix: 'gs_quant_q3',   variants: 3 },
  'Q2':   { prefix: 'gs_quant_q2',   variants: 3 },
};

const CONTEXT_VOICE_PREFIX: Record<number, { prefix: string; variants: number }> = {
  1024:   { prefix: 'gs_context_1k',   variants: 2 },
  2048:   { prefix: 'gs_context_2k',   variants: 1 },
  4096:   { prefix: 'gs_context_4k',   variants: 2 },
  8192:   { prefix: 'gs_context_8k',   variants: 2 },
  16384:  { prefix: 'gs_context_16k',  variants: 1 },
  32768:  { prefix: 'gs_context_32k',  variants: 2 },
  65536:  { prefix: 'gs_context_64k',  variants: 2 },
  131072: { prefix: 'gs_context_128k', variants: 2 },
};

const BATCH_VOICE_PREFIX: Record<string, { prefix: string; variants: number }> = {
  'true':  { prefix: 'gs_batch_batch',       variants: 2 },
  'false': { prefix: 'gs_batch_interactive',  variants: 2 },
};

const TOPOLOGY_VOICE_MAP: Record<string, { dir: string; prefix: string; variants: number }> = {
  'SINGLE':       { dir: 'topology_commentary', prefix: 'gs_topo_single', variants: 3 },
  'EP2_SOLO':     { dir: 'topology_commentary', prefix: 'gs_topo_ep2',    variants: 3 },
  'EP3_SOLO':     { dir: 'topology_commentary', prefix: 'gs_topo_ep3',    variants: 3 },
  'EP4_SOLO':     { dir: 'topology_commentary', prefix: 'gs_topo_ep4',    variants: 3 },
  'EP5_SOLO':     { dir: 'topology_commentary', prefix: 'gs_topo_ep5',    variants: 3 },
  'RING_PP2':     { dir: 'topology_commentary', prefix: 'gs_topo_pp2',    variants: 3 },
  'RING_PP3':     { dir: 'topology_commentary', prefix: 'gs_topo_pp3',    variants: 3 },
  'RING_PP4':     { dir: 'topology_commentary', prefix: 'gs_topo_pp4',    variants: 3 },
  'RING_PP5':     { dir: 'topology_commentary', prefix: 'gs_topo_pp5',    variants: 3 },
  'TP2_RDMA':     { dir: 'topology_commentary', prefix: 'gs_topo_tp2',    variants: 3 },
  'TP3_RDMA':     { dir: 'topology_commentary', prefix: 'gs_topo_tp3',    variants: 3 },
  'TP4_RDMA':     { dir: 'topology_commentary', prefix: 'gs_topo_tp4',    variants: 3 },
  'TP5_RDMA':     { dir: 'topology_commentary', prefix: 'gs_topo_tp5',    variants: 3 },
};

// ── Channel greetings ────────────────────────────────────────────

const CHANNEL_GREETINGS = [
  "Hello nerdburgers. Welcome to the Chakra Cluster.",
  "Hello nerdburger. What shall we learn today?",
  "Hello, I'm Guruswami. Welcome to my chakra cluster.",
  "Greetings, curious one. The cluster awaits your questions.",
  "Hello nerdburgers. Time to learn some AI?",
  "Welcome back. The simulation rewards curiosity.",
  "Hello. I'm Guruswami, and this is where silicon dreams.",
  "Namaste, nerdburger. Shall we explore distributed inference?",
  "Hello nerdburgers. What could go wrong? Let's find out.",
  "Welcome to the cluster. Remember — every expert was once a beginner.",
];

// ── Commentary generators ────────────────────────────────────────

function getModelCommentary(modelId: string): string {
  const model = MODEL_CATALOG.find(m => m.id === modelId);
  if (!model) return 'Interesting choice...';

  if (modelId === 'qwen25-32b') {
    return `Qwen 32B. A dense model — all thirty-two billion parameters active on every question. Fast, smart, fits on a single machine. A great first choice.`;
  }

  if (model.architecture === 'moe') {
    return `${model.displayName}. A ${model.totalParams} mind, but only ${model.activeParams || 'a fraction'} wakes for each question — like a hospital of specialists. You do not summon every doctor for a headache.`;
  }
  return `${model.displayName}. ${model.totalParams} parameters, every one active on every question. No routing, no shortcuts. It needs the memory to match its ambition.`;
}

function getQuantCommentary(quant: string, _modelId: string): string {
  const display = QUANTIZATION_DISPLAY[quant as Quantization];
  if (!display) return 'Quantization selected.';

  switch (quant) {
    case 'F16':  return 'F16. The original model weights at full precision. Highest quality, but largest and slowest. Every nuance preserved — if you can afford the memory.';
    case 'Q8':   return 'Q8. Half the size of F16 and nearly identical in quality. Smart, fast, and the loss is practically invisible.';
    case 'Q6':   return 'Q6. About sixty percent the size of F16 with minimal quality loss. A good balance when Q8 is just a bit too heavy.';
    case 'Q4':   return 'Q4. A quarter the size of F16 and often nearly as good. The happy place for most tasks — fast, lean, and still intelligent.';
    case 'Q3':   return 'Q3. An eighth the size of F16, but we are crossing into lossy territory. The model sounds confident but stumbles on nuance. Use when memory is truly scarce.';
    case 'Q2':   return 'Q2. The smallest, fastest option — but it produces gibberish. Useful for speed testing, not for truth.';
    default:     return `${quant}. ${display.quality} compression.`;
  }
}

function getContextCommentary(tokens: number): string {
  if (tokens <= 1024) return 'A sticky note. Enough for a quick question, nothing more.';
  if (tokens <= 4096) return 'A few pages. Enough to hold a conversation — the glass is comfortably light.';
  if (tokens <= 8192) return 'A full chapter. The mind can review a code file or a short article without strain.';
  if (tokens <= 32768) return 'An entire book held in the mind. Long documents, complex threads — it remembers them all. But the glass grows heavy.';
  if (tokens <= 65536) return 'A small library. Whole codebases, research papers. But every page costs compute — the glass is nearly full.';
  return 'You seek to remember a thousand lifetimes. The glass strains under the weight. Every extra page slows the mind. Be certain you need this.';
}

const BATCH_COMMENTARY: string[] = [
  'Batch mode. Higher throughput at the cost of latency — great for processing workloads around the clock.',
  'Batch. Many requests at once, like a busy kitchen. More plates per hour, but each diner waits their turn.',
  'Batch mode. The cluster becomes a factory line — optimised for volume, not for conversation.',
  'Batch. Perfect for offline jobs — data processing, summarisation, anything that does not need an instant reply.',
  'Batch mode engaged. TPS climbs, but time to first token increases. The trade-off for throughput over responsiveness.',
  'Batch. Think of a printing press versus a calligrapher. The press is slower to set up, but once rolling it produces pages fast.',
  'Batch mode. The GPU stays busy filling a queue instead of waiting for one person to type. Maximum utilisation.',
  'Batch. Like a train — it departs on schedule, not on demand. But it carries everyone at once.',
  'Batch mode. Every watt of power goes toward throughput. Ideal when nobody is watching the clock.',
];

const INTERACTIVE_COMMENTARY: string[] = [
  'Interactive. One request at a time, served the moment it is ready. Best for chat and fast response.',
  'Interactive mode. A personal chef — one dish at a time, but it arrives instantly.',
  'Interactive. Great for coding and real-time conversation. Low latency, immediate feedback.',
  'Interactive. The cluster focuses on you — lowest possible time to first token.',
  'Interactive mode. Responsiveness over throughput. Every token arrives as fast as the hardware allows.',
  'Interactive. Like a live musician — they play the note the instant you ask for it. No queue, no delay.',
  'Interactive mode. The model is yours alone. It thinks the moment you speak, and answers before you blink.',
  'Interactive. When every millisecond matters — pair programming, debugging, real-time problem solving.',
  'Interactive mode. A direct line to the model. No sharing, no batching. Pure conversational flow.',
];

function getBatchCommentary(enabled: boolean): string {
  const pool = enabled ? BATCH_COMMENTARY : INTERACTIVE_COMMENTARY;
  return pool[Math.floor(Math.random() * pool.length)];
}

function getTopologyCommentary(topology: string): string {
  if (topology === 'SINGLE') return 'One scholar, one book. No coordination needed. Sometimes the simplest path is the wisest.';
  if (topology.startsWith('EP')) {
    const n = topology.match(/EP(\d+)/)?.[1] || '?';
    return `${n} scholars, ${n} different books. Each reads independently — no coordination needed, just parallel minds.`;
  }
  if (topology.startsWith('RING_PP')) {
    const n = topology.replace('RING_PP', '');
    return `Pipeline across ${n} machines. A bucket brigade — each scholar reads one chapter, then passes the bucket forward. More hands means more memory, but each hand-off costs time.`;
  }
  if (topology.startsWith('TP') || topology.includes('TP')) {
    const n = topology.match(/TP(\d+)/)?.[1] || '?';
    return `Tensor Parallel across ${n} machines. The scholars tear out the pages and read their fragments aloud in perfect synchronisation. Fastest response — but they must stay in lockstep.`;
  }
  return 'Topology selected.';
}

// ── Onboarding prompts ───────────────────────────────────────────

// Multiple variants per step — randomly selected each playthrough.
// Variant index 0 is the default (matches _001 audio clips).
const ONBOARDING_VARIANTS: Record<string, string[]> = {
  // ── Act 1: Who am I, what is this ──
  INTRO_GREETING: [
    "Hi! I'm Guruswami. I live right here on this cluster — these five computers you can see around me. This is my home.",
    "Hey there! Guruswami here. Welcome to my cluster — five computers, all mine. Well, ours now.",
    "Oh! Someone new. I'm Guruswami. See these five machines around me? That's the Chakra cluster. I live here.",
  ],
  INTRO_HELP: [
    "I need your help with something. Each of these machines has half a terabyte of memory — half a terabyte! That's a lot. Together they can run some incredibly powerful models. But someone needs to pick the right settings, and that someone is you.",
    "Here's the thing — these machines are powerful. Half a terabyte of memory each. But raw power means nothing without the right configuration. That's where you come in.",
    "Each of these computers has more memory than most people's entire setup. Half a terabyte. But I can't configure them myself — I need someone with good instincts. Interested?",
  ],
  INTRO_ROLE: [
    "I'll be right here in the middle if you need me. You're in charge — I'll speak up if something goes wrong. And trust me, things will go wrong. That's half the fun.",
    "You drive, I'll navigate. If you're about to crash into something, I'll shout. Probably.",
    "I'll hang out here in the middle and keep an eye on things. You make the decisions — I'll tell you how they went. Fair?",
  ],
  INTRO_CONTROLS: [
    "OK, these are our controls. Five models, a few settings to play with. Nothing scary. Let's just jump in.",
    "Right — here's what we're working with. Models, settings, topologies. Sounds complicated but it's really not. Let me show you.",
    "These are the controls. Don't worry about what everything does yet. We'll go through it step by step.",
  ],

  // ── Act 2: First load ──
  PICK_MODEL: [
    "First up — click on Qwen 32B. It's a good one to start with. Thirty-two billion parameters — not too big, not too small.",
    "Let's start with Qwen 32B — click on it. It's the friendliest model we've got. Big enough to be smart, small enough to be fast.",
    "Click Qwen 32B. Thirty-two billion parameters. Don't let the number scare you — it's actually one of the smaller ones.",
  ],
  PICK_QUANT: [
    "Now pick Q4. This is how compressed the model is. Q4 keeps it smart but small enough to be fast.",
    "Next — click Q4. Think of this like image quality. Q4 is high quality without being wasteful.",
    "Hit Q4. This controls how tightly we pack the model into memory. Q4 gives us the best trade-off.",
  ],
  PICK_CONTEXT: [
    "Set the context to 1K. Think of this as how much I can hold in my head at once during a conversation.",
    "Click 1K for context. This is the model's short-term memory — how much of the conversation it can see at once.",
    "Tap 1K. That's the conversation window. Small for now — we can always make it bigger later.",
  ],
  PICK_TOPOLOGY: [
    "Now for the fun part — click EP1. This loads everything onto just one computer. And when the model loads, the music starts. You're welcome.",
    "Almost there — click EP1. One computer, one model. Oh, and you'll want your speakers on for what comes next.",
    "Last setting — EP1. Click it and something special happens.",
  ],
  LOADING: [
    "Yes! It's alive! The model is loaded and the music is playing. Now let me show you what's happening on the cluster.",
    "There we go — first model loaded! Hear that? That's the sound of inference. Let me walk you through what you're looking at.",
    "Look at that! The cluster is running and the music is rolling. Before you start clicking things, let me point out a few numbers that matter.",
  ],

  // ── Act 3: What just happened ──
  TOUR_NODE: [
    "Notice that only one node is glowing — that's Muladhara. We're only using one fifth of the cluster right now. The other four computers are just sitting there, waiting. With just one node we can still run inference, but it may not be the fastest solution. For now, it'll do.",
    "See how only one node lit up? That's because EP1 puts everything on a single computer. Four fifths of the cluster is idle. One node can still handle inference — just not for more than one user at a time. We'll fix that later.",
    "Look at the cluster — one node active, four dark. We chose EP1, so the whole model is on one machine. It works, but it's not the most efficient use of what we have. For now, let's see what it can do.",
  ],
  TOUR_TPS: [
    "See the big number on the gauge? That's tokens per second — how fast the model produces words. Right now it's running at about thirty. Higher is better.",
    "That gauge is your speedometer. Tokens per second. The higher the number, the faster the model talks back. This is the number we're always trying to push up.",
    "First number to watch — tokens per second on that gauge. That's your speed. Everything we do from here is about making that number bigger.",
  ],
  TOUR_TTFT: [
    "Below that is time to first token — the delay before the model starts responding. We want this as small as possible. Nobody likes a slow thinker.",
    "Next number — time to first token. That's the awkward silence before the model starts talking. Smaller is better. Much smaller.",
    "See the number underneath? That's the wait time. How long before the first word comes out. Fast models start talking almost instantly.",
  ],
  TOUR_LAYERS: [
    "Over on the cluster display you can see the model layers stacked on one node. When we split across more computers later, this will spread out.",
    "See how all the layers are stacked on one computer? That's because we used EP1. When we try other topologies, the layers split across nodes.",
    "The coloured bars on the node show the model's layers — all sixty-four of them squeezed onto one machine. That changes when we use different topologies.",
  ],
  TOUR_MEMORY: [
    "And memory — each node has 512 gigabytes. Right now one computer is carrying the whole model plus the context window. Watch this number as we change settings.",
    "Check the memory bar on the active node. The model weights take up most of it, and the context window adds more on top. This is always the constraint we're fighting.",
    "Last thing — memory. The model has to fit in memory, and so does the context. If they don't fit, nothing works. Keep an eye on this one.",
  ],

  // ── Act 4: Break it, fix it ──
  TRY_BREAK: [
    "OK — let's break something. On purpose. Click TP5 and watch what happens.",
    "Time to crash the cluster. Intentionally. Click TP5.",
    "Ready to break something? Click TP5. I promise it'll be educational.",
  ],
  EXPLAIN_BREAK: [
    "Ouch. The model can't split evenly across five computers, so everything just crashes. Not every configuration works. Good to know, right?",
    "And there it goes. Five doesn't divide evenly into Qwen's head count, so the whole thing falls over. This is why configuration matters.",
    "Boom. The math didn't work and the cluster crashed. This is actually one of the most common mistakes — picking a topology that doesn't fit the model.",
  ],
  TRY_EP5: [
    "Don't worry — click EP5. That'll fix it.",
    "Easy fix — click EP5. Instead of splitting one model, we'll run five separate copies.",
    "No stress — hit EP5. Different approach entirely. You'll see.",
  ],
  EXPLAIN_EP5: [
    "There we go! Now each computer is running its own copy. Look at the speed — five times faster! That's more like it.",
    "Five copies, five computers, five times the speed. This is the simplest way to scale Qwen. Check the throughput gauge.",
    "See that? Each machine runs independently now. The throughput jumped to five times what it was. For this model, this is the best configuration.",
  ],
  FREEPLAY: [
    "That's the basics. Now you know how to load a model, pick the right settings, break things, and fix them. If you ever get stuck, I'm here to help.",
    "You've got the controls. You know what works and what crashes. Everything from here is experimentation.",
    "That's all you need. You can load models, pick settings, crash the cluster, and recover. The rest is practice.",
  ],
  TRY_CLICK_GURU: [
    "One more thing — if you need help, just click on my glass sphere. Try it now.",
    "Whenever you're stuck, click on me for a hint. Go on — try it.",
    "I'm always here. Click my sphere to test it out.",
  ],
  REWARD_INTRO: [
    "You've completed the tutorial level perfectly. As a bonus, I made you this track. It is massively over the top, but you earned every second of it.",
    "Tutorial complete! I made you a bonus track to celebrate. It's ridiculous, but you deserve it. It'll remind you of everything you just learned.",
    "That's it — you nailed it. Here's your bonus track. I went completely overboard with this one. But hey — you finished the tutorial and that deserves something special.",
  ],
  COMPLETE: [
    "When you're done listening, click a model card from the controls and start exploring. Each model has its own music, its own challenges, and its own personality. The next level is waiting.",
    "Take your time with the music. When you're ready, pick a different model. Every model is a different puzzle — and the music gets even better.",
    "Enjoy the track. When it's done, click a model card and the real fun begins. Everything you learned here will make sense when you start experimenting on your own.",
  ],
};

// Active prompts — randomly selected variant per step
const ONBOARDING_PROMPTS: Record<string, string> = Object.fromEntries(
  Object.entries(ONBOARDING_VARIANTS).map(([k, variants]) => [k, variants[0]])
);
// Legacy alias
ONBOARDING_PROMPTS.INTRO_CLUSTER = ONBOARDING_PROMPTS.INTRO_GREETING;

// Repeat hints shown after 30s of inactivity on a step
const ONBOARDING_HINTS: Record<string, string> = {
  PICK_MODEL: "Click the Qwen 32B card — it has a teal border.",
  PICK_QUANT: "The Q4 button — it's glowing.",
  PICK_CONTEXT: "Click the 1K button.",
  PICK_TOPOLOGY: "Click EP1 — the first topology button.",
  TRY_BREAK: "Go on, click TP5. Trust me.",
  TRY_EP5: "EP5 will fix it. Give it a click.",
  TRY_CLICK_GURU: "Click on my glass sphere — the glowing orb in the middle of the cluster.",
};

// ── Onboarding voice clips ───────────────────────────────────────

const ONBOARDING_CLIPS: Record<string, string> = {
  // v3 emotional clips — generated with expression tags
  INTRO_GREETING: 'onboarding/gs_onboard_greeting_001.m4a',
  INTRO_HELP: 'onboarding/gs_onboard_help_001.m4a',
  INTRO_ROLE: 'onboarding/gs_onboard_role_001.m4a',
  INTRO_CONTROLS: 'onboarding/gs_onboard_controls_001.m4a',
  INTRO_CLUSTER: 'onboarding/gs_onboard_greeting_001.m4a',  // legacy alias
  PICK_MODEL: 'onboarding/gs_onboard_pick_model_v2_001.m4a',
  PICK_QUANT: 'onboarding/gs_onboard_pick_quant_v2_001.m4a',
  PICK_CONTEXT: 'onboarding/gs_onboard_pick_context_001.m4a',
  PICK_TOPOLOGY: 'onboarding/gs_onboard_pick_topology_v2_001.m4a',
  LOADING: 'onboarding/gs_onboard_loading_v2_001.m4a',
  TRY_BREAK: 'onboarding/gs_onboard_try_break_001.m4a',
  EXPLAIN_BREAK: 'onboarding/gs_onboard_explain_break_001.m4a',
  TRY_EP5: 'onboarding/gs_onboard_try_ep5_001.m4a',
  EXPLAIN_EP5: 'onboarding/gs_onboard_explain_ep5_001.m4a',
  FREEPLAY: 'onboarding/gs_onboard_freeplay_v2_001.m4a',
  TRY_CLICK_GURU: 'onboarding/gs_onboard_try_click_guru_001.m4a',
  REWARD_INTRO: 'onboarding/gs_onboard_reward_intro_001.m4a',
  COMPLETE: 'onboarding/gs_onboard_complete_v3_001.m4a',
};

const TOUR_CLIPS: Record<string, string> = {
  // v3 emotional clips for tour steps
  TOUR_NODE: 'onboarding/gs_onboard_tour_node_001.m4a',
  TOUR_TPS: 'onboarding/gs_onboard_tour_tps_v2_001.m4a',
  TOUR_TTFT: 'onboarding/gs_onboard_tour_ttft_v2_001.m4a',
  TOUR_LAYERS: 'onboarding/gs_onboard_tour_layers_v2_001.m4a',
  TOUR_MEMORY: 'onboarding/gs_onboard_tour_memory_v2_001.m4a',
  // Interactive tutorial steps
  TRY_BREAK: 'onboarding/gs_onboard_try_break_001.m4a',
  EXPLAIN_BREAK: 'onboarding/gs_onboard_explain_break_001.m4a',
  TRY_EP5: 'onboarding/gs_onboard_try_ep5_001.m4a',
  EXPLAIN_EP5: 'onboarding/gs_onboard_explain_ep5_001.m4a',
  FREEPLAY: 'onboarding/gs_onboard_freeplay_v2_001.m4a',
  TRY_CLICK_GURU: 'onboarding/gs_onboard_try_click_guru_001.m4a',
  REWARD_INTRO: 'onboarding/gs_onboard_reward_intro_001.m4a',
  COMPLETE: 'onboarding/gs_onboard_complete_v3_001.m4a',
};

// ── Errors ───────────────────────────────────────────────────────

const GURU_ERRORS: Record<string, GuruError> = {
  OOM: {
    id: 'OOM',
    guru: 'The model is too big for this setup. Either spread it across more computers with tensor parallel, or compress it with a lower quantization like Q4.',
    system: '[ERR_OOM: Model exceeds available memory. Increase TP node count or lower quantization.]',
    severity: 'error',
  },
  KV_OVERFLOW: {
    id: 'KV_OVERFLOW',
    guru: 'The model fits, but the context window pushes it over the memory limit. Reduce the context length or use a lower quantization to free up space.',
    system: '[ERR_KV_OVERFLOW: Model + KV cache exceeds memory. Reduce context length or quantization.]',
    severity: 'error',
  },
  SUBOPTIMAL_TOPOLOGY: {
    id: 'SUBOPTIMAL_TOPOLOGY',
    guru: 'Pipeline parallel works, but it adds latency. Each stage waits for the previous one. Tensor parallel processes everything at once — much faster first-token time.',
    system: '[WARN_LATENCY: Pipeline parallel increases TTFT. Consider tensor parallel for lower latency.]',
    severity: 'warning',
  },
  Q2_HALLUCINATION: {
    id: 'Q2_HALLUCINATION',
    guru: 'Q2 is fast and tiny, but the quality is terrible. The model will produce nonsense most of the time. This is only useful for stress testing, not real work.',
    system: '[WARN_PERPLEXITY: Q2 quantization — severe quality loss. Output will be largely incoherent.]',
    severity: 'warning',
  },
  VRAM_HIGH_QUANT: {
    id: 'VRAM_HIGH_QUANT',
    guru: 'Full precision doesn\'t fit in memory at this topology. Drop to Q4 or Q6 — you\'ll barely notice the quality difference, but it\'ll actually run.',
    system: '[ERR_VRAM: Uncompressed weights exceed node limits. Use Q4 or Q6.]',
    severity: 'error',
  },
  CONTEXT_CAPPED: {
    id: 'CONTEXT_CAPPED',
    guru: 'This model wasn\'t trained for a context window that large. It has a hard limit built in during training. Choose a shorter context, or switch to a model that supports longer sequences.',
    system: '[ERR_CONTEXT: Context length exceeds model maximum. Reduce context or choose a model with a larger window.]',
    severity: 'error',
  },
  SHARD_ERROR: {
    id: 'SHARD_ERROR',
    guru: 'The model\'s attention heads don\'t divide evenly across that many nodes. The math has to be exact. Try TP2 or TP4 — those usually work.',
    system: '[ERR_SHARD: Attention heads indivisible by node count. Use TP2 or TP4.]',
    severity: 'error',
  },
  OOM_HINT_QUANT: {
    id: 'OOM_HINT_QUANT',
    guru: 'Try a lower quantization. Q4 cuts the memory to about a quarter — the model stays smart, it just takes a small quality hit.',
    system: '[HINT: Lower quantization reduces model size. Q4 is the standard sweet spot.]',
    severity: 'warning',
  },
  OOM_HINT_TOPOLOGY: {
    id: 'OOM_HINT_TOPOLOGY',
    guru: 'One computer can\'t hold this model alone. Spread it across more nodes with tensor parallel — TP2 halves the memory each node needs, TP4 quarters it.',
    system: '[HINT: Increase TP node count to distribute memory. TP2 = half per node, TP4 = quarter.]',
    severity: 'warning',
  },
  OOM_HINT_SHARD: {
    id: 'OOM_HINT_SHARD',
    guru: 'The attention heads need to split evenly. TP2 and TP4 work for most models. TP3 and TP5 almost never divide cleanly.',
    system: '[HINT: TP3/TP5 fail on most models. Use TP2 or TP4 for clean head division.]',
    severity: 'warning',
  },
  GPU_TIMEOUT: {
    id: 'GPU_TIMEOUT',
    guru: 'Metal has a sixty second timeout for GPU operations. Pipeline parallel processes stages one at a time, and this model is too big to finish a stage in time. Tensor parallel will work — it processes everything at once.',
    system: '[ERR_GPU_TIMEOUT: Metal 60s GPU timeout exceeded. Pipeline parallel too slow. Use tensor parallel.]',
    severity: 'error',
  },
  RDMA_UNSTABLE: {
    id: 'RDMA_UNSTABLE',
    guru: 'The heads divide fine by five, so the math works. But the five-node Thunderbolt mesh is unstable — it starts up and then the links drop. This is a known hardware limitation. Use TP4 instead.',
    system: '[ERR_RDMA: TP5 mesh unstable on Thunderbolt 5. Use TP4.]',
    severity: 'error',
  },
  RECOVERY: {
    id: 'RECOVERY',
    guru: 'We\'re back. The configuration works and the cluster is running again.',
    system: null,
    severity: 'success' as any,
  },
};

// ── Deep help explanations ───────────────────────────────────────

const DETAILED_HELP: Record<string, { text: string; voiceFile?: string }> = {
  model: {
    text: 'Think of each model as a different kind of mind. Kimi K2.5 has a trillion parameters — but only the relevant specialists wake for each question, like a hospital that routes you to exactly the right doctor. Llama uses its entire brain on every question — no shortcuts, no routing. The question is not which is better. The question is which matches your problem.',
    voiceFile: 'hover_tip/gs_hover_model_card_001.m4a',
  },
  quant: {
    text: 'We cannot fit the entire ocean into a cup, so we fold the water. Q4 folds it four times — the cup is a quarter the size, and you can barely taste what changed. Q8 is a gentle fold, nearly perfect. Q2 crushes the ocean into a thimble — fast and tiny, but do not trust the shadows it casts. At Q4, the model retains ninety-three percent fidelity. That last seven percent costs four times the memory. Is it worth it? That depends on what you are building.',
    voiceFile: 'hover_tip/gs_hover_quant_001.m4a',
  },
  kvCache: {
    text: 'The context window is how much the model holds in its head while it thinks. A 4K window holds a conversation. A 32K window holds an entire book. But every extra page costs compute and slows the response. Do not set this higher than you need. The art is matching the window to the task — a chat needs a sticky note, not a library.',
    voiceFile: 'hover_tip/gs_hover_context_001.m4a',
  },
  batch: {
    text: 'A personal chef cooks one plate at a time, served the instant it is ready. A busy kitchen cooks many orders simultaneously — more plates per hour, but each diner waits longer. Neither is better. Interactive for conversation, batch for processing a queue. Match the mode to the workload.',
    voiceFile: 'hover_tip/gs_hover_batch_001.m4a',
  },
  topology: {
    text: 'Imagine a book too large for any single shelf. Tensor Parallel tears out the pages — every scholar holds different fragments, but they must read aloud in perfect synchronisation. Fastest response, but coordination is everything. Pipeline is a bucket brigade — scholar one reads the first chapter, passes the bucket forward, and so on. Slower per request, but simpler. Standalone gives each scholar their own book entirely. The right answer depends on whether you value speed, capacity, or variety.',
    voiceFile: 'hover_tip/gs_hover_topology_001.m4a',
  },
  'topology-ep': {
    text: 'Embarrassingly Parallel — each node runs a complete, independent copy of the model. No communication overhead, no synchronisation. Maximum per-instance speed. The trade-off? Each node needs the full model in memory. Best when your model fits comfortably on a single node and you want to serve multiple users simultaneously.',
    voiceFile: 'hover_tip/gs_hover_ep_001.m4a',
  },
  'topology-pp': {
    text: 'Pipeline Parallel splits the model layer by layer across nodes in a chain. Node one processes the first layers, passes the result forward, node two handles the next batch, and so on. Any model can be split this way regardless of attention head count. The cost is pipeline latency — every extra stage adds wait time.',
    voiceFile: 'hover_tip/gs_hover_pp_001.m4a',
  },
  'topology-tp': {
    text: 'Tensor Parallel shards each layer\'s attention heads across nodes via Thunderbolt 5 RDMA. Every node computes a fraction of every layer simultaneously — the fastest approach for large models. But it requires the attention head count to divide evenly by the number of nodes, and demands high-bandwidth low-latency interconnect.',
    voiceFile: 'hover_tip/gs_hover_tp_001.m4a',
  },
  'tps-ttft': {
    text: 'Tokens per second is how fast the model thinks out loud. Time to First Token is how long it takes to start thinking. Longer context slows both — more to remember before the first word arrives. Watch both numbers as you change the topology and context window.',
    voiceFile: 'hover_tip/gs_hover_tps_001.m4a',
  },
  'kv-cache': {
    text: 'The KV cache is the model\'s short-term memory — every token it has seen so far. In Tensor Parallel, each node stores only its shard of the cache. In Pipeline Parallel, each node stores the cache for its own layers. MLA attention compresses this cache dramatically — what costs gigabytes in standard attention costs mere megabytes with Multi-Latent compression.',
    voiceFile: 'hover_tip/gs_hover_kv_cache_001.m4a',
  },
  'mesh-ring': {
    text: 'The layer split shows how the model is distributed across nodes. In Tensor Parallel, every layer is sharded — each node holds a vertical slice. In Pipeline Parallel, each node owns a sequential range of layers. In Data Parallel, each node runs a complete independent copy. Watch the column change as you switch topologies.',
    voiceFile: 'hover_tip/gs_hover_topology_001.m4a',
  },
  'quantization': {
    text: 'Quantization is the art of compression — like recording music at lower bitrates. F16 is the studio master. Q8 is a high-quality stream — nearly indistinguishable. Q4 is a good podcast — perfectly usable, ninety-three percent fidelity. Q2 is a phone call — you get the meaning, but the nuance is gone. Each step down halves the memory and speeds the generation.',
    voiceFile: 'hover_tip/gs_hover_quant_001.m4a',
  },
  'gpu-timeout': {
    text: 'Apple Metal enforces a sixty-second timeout on GPU command buffers. This is a hard wall — exceed it and the node kernel-panics and reboots. Pipeline Parallel multiplies the danger: each stage processes sequentially, so five stages means five times the prefill time. Tensor Parallel processes in parallel, staying under the limit much longer.',
    voiceFile: 'hover_tip/gs_hover_vram_001.m4a',
  },
  'arch-attention': {
    text: 'Attention is the heart of every transformer. Multi-Head Attention stores full keys and values for every head — expensive but precise. Grouped Query Attention shares keys across groups — four times cheaper in cache. Multi-Latent Attention compresses further into a low-rank latent space — eight times cheaper. The choice of attention mechanism determines how much memory your context window costs.',
    voiceFile: 'hover_tip/gs_hover_mla_001.m4a',
  },
  'cluster-comparison': {
    text: 'This cluster draws 350 watts and fits under a desk. An NVIDIA DGX H100 draws 10 kilowatts and needs a data center. The compute difference is enormous — but so is the cost. The question is not which is better. The question is which matches your task.',
    voiceFile: 'hover_tip/gs_hover_stability_001.m4a',
  },
};

// ── Challenges ───────────────────────────────────────────────────

const CHAKRA_CHALLENGES: ChakraChallenge[] = [
  {
    id: 'rivers-pace',
    title: "The River's Pace",
    goal: 'Maximize TPS',
    challenge: 'A heavy mind moves slowly, my friend. To run like the river, we must travel light. Show me how you would make the thoughts fly.',
    success: 'Ah, you hear it, do you not? The water flows without resistance. The clacky board sings with the speed of your design.',
    winCondition: (c) => {
      const isSmallModel = c.modelId?.includes('32b') || c.modelId?.includes('qwen') || false;
      const isFastQuant = c.quant === 'Q4' || c.quant === 'Q3' || c.quant === 'Q2';
      const isLowContext = (c.context || 4096) <= 4096;
      const isTP = c.topology?.includes('TP') || false;
      return isSmallModel && isFastQuant && isLowContext && isTP;
    },
  },
  {
    id: 'deep-historian',
    title: 'The Deep Historian',
    goal: 'Maximize context without crashing',
    challenge: 'We seek to remember a thousand lifetimes today. But memory is a heavy burden. How do we hold the entire ocean without breaking the glass?',
    success: 'The mandala expands. You have balanced the weight of history perfectly across the scholars. We remember everything.',
    winCondition: (c) => {
      const isBigContext = (c.context || 4096) >= 65536;
      const isDistributed = c.topology?.includes('TP') && (parseInt(c.topology?.match(/TP(\d+)/)?.[1] || '1') >= 4);
      const isMidModel = !c.modelId?.includes('405b');
      return isBigContext && (isDistributed || false) && isMidModel;
    },
  },
  {
    id: 'waking-leviathan',
    title: 'Waking the Leviathan',
    goal: 'Run Llama 405B',
    challenge: 'You ask to awaken the leviathan. A single mind cannot hold it; the burden must be shared across the entire network. Can you orchestrate the awakening?',
    success: 'A magnificent orchestration. The Thunderbolt mesh flashes, and the entire cluster breathes as one.',
    winCondition: (c) => {
      const is405B = c.modelId?.includes('405b') || c.modelId?.includes('llama-405') || false;
      const isTP4Plus = c.topology?.includes('TP') && (parseInt(c.topology?.match(/TP(\d+)/)?.[1] || '1') >= 4);
      const isCompressed = c.quant === 'Q4' || c.quant === 'Q3';
      return is405B && (isTP4Plus || false) && isCompressed;
    },
  },
];

// ── Tutorial recommendations ─────────────────────────────────────

const TUTORIAL_RECOMMENDED: Record<string, string> = {
  PICK_MODEL: 'qwen25-32b',
  PICK_QUANT: 'Q4',
  PICK_CONTEXT: '1024',
  PICK_TOPOLOGY: 'SINGLE',
  TRY_BREAK: 'TP5_RDMA',
  TRY_EP5: 'EP5_SOLO',
};

// ── Assembled config ─────────────────────────────────────────────

export const guruswamiConfig: CharacterConfig = {
  id: 'guruswami',
  voiceBasePath: BASE + 'guruswami/voice/',
  videoBasePath: BASE + 'guruswami/video/',
  animLibraryUrl: BASE + 'guruswami/animation-library.json',
  voiceLibraryUrl: BASE + 'guruswami/voice-library.json',
  transcriptionsUrl: BASE + 'guruswami/voice-transcriptions.json',
  modelVoicePrefixes: MODEL_VOICE_PREFIX,
  modelFarewellPrefixes: MODEL_FAREWELL_PREFIX,
  modelGreetingPrefixes: MODEL_GREETING_PREFIX,
  musicCommentaryPrefixes: MUSIC_COMMENTARY_PREFIX,
  modelVoiceVariants: 3,
  modelFarewellVariants: 10,
  modelGreetingVariants: 10,
  musicCommentaryVariants: 10,
  quantVoicePrefix: QUANT_VOICE_PREFIX,
  contextVoicePrefix: CONTEXT_VOICE_PREFIX,
  batchVoicePrefix: BATCH_VOICE_PREFIX,
  topologyVoiceMap: TOPOLOGY_VOICE_MAP,
  errors: GURU_ERRORS,
  detailedHelp: DETAILED_HELP,
  channelGreetings: CHANNEL_GREETINGS,
  onboardingPrompts: ONBOARDING_PROMPTS,
  onboardingHints: ONBOARDING_HINTS,
  tutorialRecommended: TUTORIAL_RECOMMENDED,
  challenges: CHAKRA_CHALLENGES,
  onboardingClips: ONBOARDING_CLIPS,
  tourClips: TOUR_CLIPS,
  getModelCommentary,
  getQuantCommentary,
  getContextCommentary,
  getBatchCommentary,
  getTopologyCommentary,
};

// Re-export for consumers that import these directly
export {
  GURU_ERRORS,
  DETAILED_HELP,
  CHAKRA_CHALLENGES,
  TUTORIAL_RECOMMENDED,
  ONBOARDING_PROMPTS,
  ONBOARDING_VARIANTS,
  CHANNEL_GREETINGS,
};
export type { GuruError, ChakraChallenge } from '../types';
