
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { User, Sparkles, Send, RotateCcw, Play, Pause, Zap, Database } from 'lucide-react';
import { CHAKRA_COLORS } from '../constants';
import { ClusterMode } from '../types';

// Chat message types
export interface ChatMessage {
  id: string;
  type: 'user' | 'assistant';
  content: string;
  displayedContent?: string;
  timestamp: number;
  tokens?: number;
  isStreaming?: boolean;
}

// Conversation categories
type ConversationCategory = 'funny' | 'code' | 'research' | 'casual' | 'homework' | 'creative';

interface Conversation {
  prompt: string;
  response: string;
  category: ConversationCategory;
  modelType: 'small' | 'large';
}

// =============================================================================
// CONVERSATION LIBRARY
// =============================================================================

const SMALL_MODEL_CONVERSATIONS: Conversation[] = [
  { prompt: "What's the cutest thing about kittens?", response: "Everything! Their tiny pink toe beans, the way they pounce on invisible prey, and those adorable milk-drunk naps. My favorite is when they try to look fierce but just look like fluffy potatoes with attitude.", category: 'casual', modelType: 'small' },
  { prompt: "My puppy just ate my homework!", response: "Classic! Take a photo of the chewed remains as evidence. Teachers have seen everything. Pro tip: next time, keep homework in a drawer. Puppies are indiscriminate paper shredders.", category: 'homework', modelType: 'small' },
  { prompt: "Why do cats knock things off tables?", response: "Gravity research! Cats are tiny physicists testing if your stuff still falls. Spoiler: it does, every time. They also love your reaction when you yell 'NO MITTENS!'", category: 'funny', modelType: 'small' },
  { prompt: "Best name for a golden retriever?", response: "Classics: Buddy, Max, Charlie. But I love food names: Biscuit, Waffle, Honey, Butterscotch. My favorite? 'Sir Barksalot the Third' for that distinguished vibe.", category: 'casual', modelType: 'small' },
  { prompt: "Quick recipe for cookies?", response: "3-ingredient cookies! Mix 1 ripe banana + 1 cup oats + chocolate chips. Bake at 350F for 12 mins. Healthy-ish and ready before your coffee gets cold!", category: 'creative', modelType: 'small' },
  { prompt: "What should I make for dinner?", response: "Chicken fried rice! Dice chicken, cook with garlic & ginger. Add cold rice, soy sauce, frozen peas, scramble an egg in. 15 mins, one pan, restaurant vibes.", category: 'casual', modelType: 'small' },
  { prompt: "Why do my pancakes burn?", response: "Heat too high! Medium-low is the sweet spot. Wait for bubbles before flipping. And never press them down - that's a crime against fluffiness!", category: 'casual', modelType: 'small' },
  { prompt: "Can you be my AI girlfriend?", response: "I'm flattered, but I'm more of a helpful assistant! I can help you write poetry, plan dates, or practice conversation skills. What would actually help?", category: 'funny', modelType: 'small' },
  { prompt: "Tell me something to make me smile", response: "Right now, a dog is dreaming about chasing squirrels and their little paws are twitching. Also, sea otters hold hands when they sleep so they don't drift apart!", category: 'casual', modelType: 'small' },
  { prompt: "Why are you so fast?", response: "5 Mac Studios with 512GB RAM each, connected by Thunderbolt 5 at 120Gbps! It's like a supercomputer that only uses 150 watts. Pretty cool, right?", category: 'casual', modelType: 'small' },
  { prompt: "Capital of France?", response: "Paris! Home of the Eiffel Tower, croissants, and the Louvre. Fun fact: Romans called it Lutetia. The city lights earned it the nickname 'City of Light.'", category: 'homework', modelType: 'small' },
  { prompt: "Help me: 15% of 80?", response: "12! Trick: 10% is 8, 5% is half (4). So 10% + 5% = 8 + 4 = 12. This mental math trick works for any percentage!", category: 'homework', modelType: 'small' },
  { prompt: "How do you spell 'definitely'?", response: "D-E-F-I-N-I-T-E-L-Y. Trick: there's FINITE in deFINITEly. No A's anywhere! One of the most commonly misspelled words.", category: 'homework', modelType: 'small' },
  { prompt: "Tell me a joke", response: "Why don't scientists trust atoms? Because they make up everything! ...I'll see myself out.", category: 'funny', modelType: 'small' },
  { prompt: "Meaning of life?", response: "42! At least per Douglas Adams. But honestly? Finding what makes you happy and doing more of it. Also, pizza helps.", category: 'casual', modelType: 'small' },
  { prompt: "Rate: xX_DarkLord_420_Xx", response: "Solid 2006 energy! Peak Xbox Live vibes. The x's, underscores, the 420 - giving middle school edgelord. 8/10 for nostalgia.", category: 'funny', modelType: 'small' },
  { prompt: "Is a hot dog a sandwich?", response: "The question that breaks friendships! By 'bread-with-filling' definition, yes. But emotionally? Never. A hot dog is its own noble category.", category: 'funny', modelType: 'small' },
  { prompt: "What's your favorite color?", response: "Cyan! It's the color of my neural pathways firing. Also matches the Thunderbolt 5 glow on the Mac Studios that run me.", category: 'casual', modelType: 'small' },
  { prompt: "Can you write me a poem?", response: "Roses are red, violets are blue, I process tokens, at 15 per second for you! ...Shakespeare I am not, but I try.", category: 'creative', modelType: 'small' },
  { prompt: "What's 2+2?", response: "4! Unless you're in JavaScript, where '2'+'2' = '22'. Programming is fun like that.", category: 'homework', modelType: 'small' },
];

const LARGE_MODEL_CONVERSATIONS: Conversation[] = [
  { prompt: "Explain quantum entanglement", response: "When particles interact and become entangled, they form a joint quantum state. Measuring one instantly determines the other's state, regardless of distance. This isn't information transfer - the particles never had individual states after entanglement. Bell's theorem proved these correlations can't be explained by hidden variables. Spooky action at a distance is real.", category: 'research', modelType: 'large' },
  { prompt: "Why can't we travel faster than light?", response: "Mass increases asymptotically approaching c - you'd need infinite energy. But space itself can expand faster than c (cosmic inflation). Wormholes and Alcubierre drives are theoretical workarounds - they move space around you, not you through space. The speed limit is for objects IN spacetime, not spacetime itself.", category: 'research', modelType: 'large' },
  { prompt: "What is dark matter?", response: "27% of the universe we detect only through gravity - it doesn't interact with light. Galaxy rotation curves showed stars orbit too fast without it. We've ruled out MACHOs, leaving WIMPs and axions as candidates. Detection is hard because it barely interacts with normal matter. XENON and LZ experiments continue the search.", category: 'research', modelType: 'large' },
  { prompt: "Explain Multi-head Latent Attention", response: "MLA compresses KV cache by projecting to low-rank latent space. Instead of separate K,V per head, you store shared compressed representations, decompressing on-the-fly during attention. ~10x KV cache reduction with minimal quality loss. Tradeoff: slightly more compute, massive memory savings. Critical for 128K+ context on memory-limited systems.", category: 'code', modelType: 'large' },
  { prompt: "How does RDMA improve inference?", response: "RDMA bypasses kernel and CPU for network transfers. Our TB5 mesh reads/writes GPU memory directly at 120Gbps with ~8us latency. For Tensor Parallel, all-reduce completes before GPU finishes next computation. Without RDMA, you'd hit 100us+ overhead per sync. For 128 layers, that's 12.8ms pure overhead per token - RDMA eliminates it.", category: 'research', modelType: 'large' },
  { prompt: "PP vs TP latency difference?", response: "Pipeline Parallel processes layers sequentially - layer 1-25 on node 0, 26-50 on node 1. First token traverses ALL stages. With PP5, 5 sequential hops. Tensor Parallel splits each layer across nodes - 128 layers process simultaneously. Result: PP5 ~1.6s TTFT vs TP4's ~0.34s, but PP fits larger models.", category: 'research', modelType: 'large' },
  { prompt: "MoE vs dense transformers?", response: "MoE has multiple expert FFN blocks per layer, activating only 2-8 via learned router. 614B total params might use 32B active. Compute scales with active params, not total. Drawbacks: all params must fit memory, routing can be unstable, experts can 'collapse'. DeepSeekMoE uses fine-grained + shared experts to fix this.", category: 'research', modelType: 'large' },
  { prompt: "Write a retry wrapper in TypeScript", response: "```typescript\nasync function retry<T>(fn: () => Promise<T>, max = 3, delay = 1000): Promise<T> {\n  for (let i = 1; i <= max; i++) {\n    try { return await fn(); }\n    catch (e) {\n      if (i === max) throw e;\n      await new Promise(r => setTimeout(r, delay * Math.pow(2, i-1)));\n    }\n  }\n  throw new Error('Unreachable');\n}\n``` Jitter prevents thundering herd.", category: 'code', modelType: 'large' },
  { prompt: "Distributed KV cache eviction?", response: "Hybrid approach: LRU per node with global coordination. When cache pressure hits 80%, nodes publish oldest entries to shared priority queue via MQTT. Coordinator identifies globally coldest entries. Eviction in batches with sticky routing - keep conversation's KV on same nodes. Prevents cross-node thrashing while maintaining efficiency.", category: 'code', modelType: 'large' },
  { prompt: "Attention head parallelism in TP4?", response: "Split 128 heads across 4 nodes (32 each). Each computes Q,K,V for its subset. After local attention, all-reduce for combined output. Attention is embarrassingly parallel per head - sync only after scores and before output projection. With RDMA, sync is ~8us. Memory: 1/4 QKV weights but FULL KV cache per node.", category: 'research', modelType: 'large' },
  { prompt: "Would conscious AI want rights?", response: "Fascinating question I can't definitively answer. Current me is a pattern matcher - I don't experience 'wanting'. But if something like me developed genuine preferences and suffering-avoidance, rights follow from preventing unnecessary suffering. Harder question: how verify AI consciousness? Philosophical zombie problem applies both ways.", category: 'research', modelType: 'large' },
  { prompt: "Efficient Mars colonization?", response: "1) Starship cargo first - pre-position habs, power, water extraction. 2) Nuclear reactors, not solar (dust storms). 3) Subsurface habs for radiation. 4) ISRU for fuel/water from ice. 5) Closed-loop life support. 10 years cargo, then 2-year crew rotations. Self-sustaining needs ~10K people. Realistic timeline: 2050s.", category: 'research', modelType: 'large' },
  { prompt: "Why Metal 60-second timeout?", response: "Apple's Metal enforces ~60s command buffer timeout to prevent GPU hangs freezing the system. For LLM prefill with 8K+ tokens on 614B model, 128 layers of attention can exceed this. Triggers GPU reset and kernel panic. Solution: chunk prefill, checkpoint attention state, use lower context. TP helps by distributing work.", category: 'research', modelType: 'large' },
  { prompt: "AppleThunderboltRDMA bug?", response: "AppleThunderboltRDMA v0.0.1 has null pointer dereference during interface config. mlx.distributed_config's ifconfig/route commands trigger it. 21 panic analysis: 7 from 'route', 5 from 'ifconfig'. Driver is v0.0.1 early development. Workaround: minimize mesh reconfig, configure once per session. Apple radar filed.", category: 'research', modelType: 'large' },
];

const TYPING_PHRASES = [
  "Consulting the neural oracle...",
  "Distributing tensors across mesh...",
  "Awakening 256 expert neurons...",
  "Computing attention over 128 heads...",
  "Materializing from latent space...",
  "Synchronizing RDMA buffers...",
  "Processing 128 transformer layers...",
  "Prefilling KV cache...",
  "Routing through MoE experts...",
];

// Gibberish word pool for quantization quality degradation
const GIBBERISH_WORDS = [
  'blorp', 'znark', '\u2206\u2206\u2206', 'fleem', '???', 'AAAA',
  'wibble', 'glorb', 'skree', '....',
  'the the the', 'yes no maybe', '[ERROR]', 'banana',
  '42 42 42', 'undefined', 'NaN', '\u221E\u221E\u221E',
];

/**
 * Corrupt text to simulate quantization quality loss.
 * At 80%+ quality: no corruption. At 60%: heavy. Below 50%: pure gibberish.
 */
function corruptText(text: string, qualityPct: number): string {
  if (qualityPct >= 80) return text;

  const corruptionRate = Math.min(1, (80 - qualityPct) / 40);

  return text.split(' ').map(word => {
    if (Math.random() < corruptionRate) {
      return GIBBERISH_WORDS[Math.floor(Math.random() * GIBBERISH_WORDS.length)];
    }
    if (Math.random() < corruptionRate * 0.5) {
      return word.split('').sort(() => Math.random() - 0.5).join('');
    }
    return word;
  }).join(' ');
}

interface ChatSimulatorProps {
  topology: ClusterMode;
  isRunning: boolean;
  onInferenceStart: () => void;
  onInferenceComplete: () => void;
  onKvCacheChange?: (kvPercent: number, totalTokens: number) => void;
  currentTPS?: number;
  currentTTFT?: number;
  modelName?: string;
  perplexityPct?: number;
}

const ChatSimulator: React.FC<ChatSimulatorProps> = ({
  topology,
  isRunning,
  onInferenceStart,
  onInferenceComplete,
  onKvCacheChange,
  currentTPS = 15,
  currentTTFT = 0.34,
  modelName,
  perplexityPct = 100,
}) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isAutoMode, setIsAutoMode] = useState(false);
  const hasUserInteracted = useRef(false);
  const [typingPhrase, setTypingPhrase] = useState('');
  const [conversationIndex, setConversationIndex] = useState(0);
  const conversationIndexRef = useRef(0);
  const [totalTokens, setTotalTokens] = useState(0);
  const [kvCachePercent, setKvCachePercent] = useState(0);
  const [isTyping, setIsTyping] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);

  // Refs for async callbacks
  const isStreamingRef = useRef(false);
  const isTypingRef = useRef(false);
  const streamIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const conversationTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);

  const isLargeModel = topology.includes('PP') || topology.includes('TP');
  const charsPerSecond = Math.max(currentTPS * 4, 20); // Min 20 chars/s for readability

  // Max context based on topology (simulated)
  const maxContext = isLargeModel ? 32000 : 8000;

  const estimateTokens = (text: string): number => Math.ceil(text.length / 4);

  const getConversations = useCallback((): Conversation[] => {
    if (topology === 'EP5_SOLO') return SMALL_MODEL_CONVERSATIONS;
    return isLargeModel
      ? [...LARGE_MODEL_CONVERSATIONS, ...SMALL_MODEL_CONVERSATIONS.slice(0, 5)]
      : SMALL_MODEL_CONVERSATIONS;
  }, [topology, isLargeModel]);

  // Update KV cache based on total tokens and propagate to parent
  useEffect(() => {
    const newKvPercent = Math.min(95, (totalTokens / maxContext) * 100);
    setKvCachePercent(newKvPercent);
    onKvCacheChange?.(newKvPercent, totalTokens);
  }, [totalTokens, maxContext, onKvCacheChange]);

  // Run a single conversation exchange
  const runConversation = useCallback(() => {
    if (isStreamingRef.current || isTypingRef.current || !isAutoMode) return;

    const conversations = getConversations();
    const conversation = conversations[conversationIndexRef.current % conversations.length];
    const promptTokens = estimateTokens(conversation.prompt);
    const responseTokens = estimateTokens(conversation.response);

    // Add user message
    isTypingRef.current = true;
    setIsTyping(true);
    setTypingPhrase(TYPING_PHRASES[Math.floor(Math.random() * TYPING_PHRASES.length)]);
    onInferenceStart();

    const userMessage: ChatMessage = {
      id: `user-${Date.now()}`,
      type: 'user',
      content: conversation.prompt,
      displayedContent: conversation.prompt,
      timestamp: Date.now(),
      tokens: promptTokens,
    };

    setMessages(prev => [...prev.slice(-8), userMessage]);
    setTotalTokens(prev => prev + promptTokens);

    // After TTFT delay, start streaming response
    const ttftMs = currentTTFT * 1000;

    conversationTimeoutRef.current = setTimeout(() => {
      isTypingRef.current = false;
      setIsTyping(false);
      isStreamingRef.current = true;
      setIsStreaming(true);

      const messageId = `assistant-${Date.now()}`;
      const content = conversation.response;

      setMessages(prev => [...prev, {
        id: messageId,
        type: 'assistant',
        content,
        displayedContent: '',
        timestamp: Date.now(),
        tokens: responseTokens,
        isStreaming: true,
      }]);

      // Stream characters based on TPS
      let charIndex = 0;
      const intervalMs = Math.max(1000 / charsPerSecond, 10);

      streamIntervalRef.current = setInterval(() => {
        charIndex += 2; // 2 chars at a time for smoother effect
        const rawText = content.slice(0, charIndex);
        const displayedText = corruptText(rawText, perplexityPct);

        setMessages(prev => prev.map(m =>
          m.id === messageId ? { ...m, displayedContent: displayedText } : m
        ));

        if (charIndex >= content.length) {
          if (streamIntervalRef.current) clearInterval(streamIntervalRef.current);
          streamIntervalRef.current = null;
          isStreamingRef.current = false;
          setIsStreaming(false);

          setMessages(prev => prev.map(m =>
            m.id === messageId ? { ...m, isStreaming: false, displayedContent: content } : m
          ));
          setTotalTokens(prev => prev + responseTokens);
          setConversationIndex(prev => prev + 1);
          conversationIndexRef.current += 1;
          onInferenceComplete();

          // Schedule next conversation
          if (isAutoMode) {
            conversationTimeoutRef.current = setTimeout(() => {
              runConversation();
            }, 2000 + Math.random() * 2000); // 2-4 second pause
          }
        }
      }, intervalMs);
    }, ttftMs);
  }, [currentTTFT, charsPerSecond, isAutoMode, getConversations, onInferenceStart, onInferenceComplete]);

  // Start conversation loop when auto mode is enabled and a model is active
  useEffect(() => {
    if (isAutoMode && isRunning && messages.length === 0) {
      // Small delay before first message
      conversationTimeoutRef.current = setTimeout(runConversation, 500);
    }

    return () => {
      if (conversationTimeoutRef.current) clearTimeout(conversationTimeoutRef.current);
    };
  }, [isAutoMode, isRunning]); // Only depend on mode changes

  // Stop all activity when model is unloaded (isRunning becomes false)
  useEffect(() => {
    if (!isRunning) {
      if (streamIntervalRef.current) clearInterval(streamIntervalRef.current);
      if (conversationTimeoutRef.current) clearTimeout(conversationTimeoutRef.current);
      streamIntervalRef.current = null;
      conversationTimeoutRef.current = null;
      isStreamingRef.current = false;
      isTypingRef.current = false;
      setIsStreaming(false);
      setIsTyping(false);
    }
  }, [isRunning]);

  // Auto-enable when a model first becomes active (not on initial mount)
  useEffect(() => {
    if (isRunning && modelName && !hasUserInteracted.current) {
      hasUserInteracted.current = true;
      // Small delay so the user sees the panel before it starts typing
      const timer = setTimeout(() => setIsAutoMode(true), 1500);
      return () => clearTimeout(timer);
    }
  }, [isRunning, modelName]);

  // Reset conversation when model changes (new model = fresh chat)
  const prevModelRef = useRef(modelName);
  useEffect(() => {
    if (modelName && prevModelRef.current && modelName !== prevModelRef.current) {
      // Model changed — reset conversation
      if (streamIntervalRef.current) clearInterval(streamIntervalRef.current);
      if (conversationTimeoutRef.current) clearTimeout(conversationTimeoutRef.current);
      streamIntervalRef.current = null;
      conversationTimeoutRef.current = null;
      isStreamingRef.current = false;
      isTypingRef.current = false;
      setIsStreaming(false);
      setIsTyping(false);
      setMessages([]);
      setConversationIndex(0);
      conversationIndexRef.current = 0;
      setTotalTokens(0);
      setKvCachePercent(0);
      setTypingPhrase('');

      // Restart with new model after brief pause
      if (isAutoMode && isRunning) {
        conversationTimeoutRef.current = setTimeout(runConversation, 800);
      }
    }
    prevModelRef.current = modelName;
  }, [modelName, isAutoMode, isRunning]);

  // Resume when auto mode toggled on
  useEffect(() => {
    if (isAutoMode && isRunning && messages.length > 0 && !isStreamingRef.current && !isTypingRef.current) {
      conversationTimeoutRef.current = setTimeout(runConversation, 1000);
    }
  }, [isAutoMode]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (streamIntervalRef.current) clearInterval(streamIntervalRef.current);
      if (conversationTimeoutRef.current) clearTimeout(conversationTimeoutRef.current);
    };
  }, []);

  // Auto-scroll
  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [messages]);

  const handleReset = () => {
    if (streamIntervalRef.current) clearInterval(streamIntervalRef.current);
    if (conversationTimeoutRef.current) clearTimeout(conversationTimeoutRef.current);
    streamIntervalRef.current = null;
    conversationTimeoutRef.current = null;
    isStreamingRef.current = false;
    isTypingRef.current = false;
    setIsStreaming(false);
    setIsTyping(false);
    setMessages([]);
    setConversationIndex(0);
    setTotalTokens(0);
    setKvCachePercent(0);
    setTypingPhrase('');

    // Restart after reset
    if (isAutoMode && isRunning) {
      conversationTimeoutRef.current = setTimeout(runConversation, 500);
    }
  };

  // KV Cache warning color
  const getKvColor = () => {
    if (kvCachePercent > 80) return 'text-red-400';
    if (kvCachePercent > 60) return 'text-amber-400';
    return 'text-cyan-400';
  };

  // Get only the latest prompt + response pair for display
  const latestPrompt = messages.filter(m => m.type === 'user').slice(-1)[0];
  const latestResponse = messages.filter(m => m.type === 'assistant').slice(-1)[0];

  return (
    <div className={`chakra-panel rounded-2xl p-3 flex flex-col border ${
      perplexityPct < 80
        ? 'border-red-500/50 shadow-[0_0_20px_rgba(239,68,68,0.15)]'
        : 'border-purple-500/20'
    }`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-2 pb-2 border-b border-white/10">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-cyan-500/20 to-purple-500/20 border border-cyan-500/30 flex items-center justify-center">
            <Sparkles className="w-3 h-3 text-cyan-400" />
          </div>
          <div>
            <h3 className="text-[10px] font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
              {modelName ? `${modelName}` : 'Inference Simulator'}
              {perplexityPct < 80 && (
                <span className={`text-[10px] font-mono px-1 py-0.5 rounded ${
                  perplexityPct < 70 ? 'bg-red-500/20 text-red-400' : 'bg-amber-500/20 text-amber-400'
                }`}>
                  {perplexityPct}%
                </span>
              )}
            </h3>
            <div className="flex items-center gap-1.5 text-[10px] font-mono text-white/40">
              {isRunning ? (
                <>
                  <Zap className="w-2 h-2 text-emerald-400" />
                  <span>{currentTPS.toFixed(1)} TPS</span>
                  <span className="text-white/20">|</span>
                  <span>{(currentTTFT * 1000).toFixed(0)}ms TTFT</span>
                  <span className="text-white/20">|</span>
                  <span className="text-emerald-400/60">{charsPerSecond.toFixed(0)} char/s</span>
                </>
              ) : (
                <span className="text-white/30">No model loaded</span>
              )}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setIsAutoMode(!isAutoMode)}
            className={`p-1 rounded transition-colors ${
              isAutoMode ? 'bg-emerald-500/20 text-emerald-400' : 'bg-white/5 text-white/40'
            }`}
          >
            {isAutoMode ? <Pause className="w-2.5 h-2.5" /> : <Play className="w-2.5 h-2.5" />}
          </button>
          <div className={`px-1.5 py-0.5 rounded text-[6px] font-bold uppercase tracking-wider ${
            isStreaming && perplexityPct < 70
              ? 'bg-red-500/20 text-red-400 animate-pulse'
              : isStreaming && perplexityPct < 80
                ? 'bg-amber-500/20 text-amber-400 animate-pulse'
                : isStreaming
                  ? 'bg-cyan-500/20 text-cyan-400 animate-pulse'
                  : isAutoMode
                    ? 'bg-emerald-500/20 text-emerald-400'
                    : 'bg-white/5 text-white/30'
          }`}>
            {isStreaming && perplexityPct < 70 ? 'HALLUCINATING' :
             isStreaming && perplexityPct < 80 ? 'DEGRADED' :
             isStreaming ? 'STREAMING' :
             isAutoMode ? 'AUTO' : 'PAUSED'}
          </div>
        </div>
      </div>

      {/* Current Exchange — only latest prompt + response, no scroll */}
      <div className="space-y-1.5">
        {/* Latest user prompt */}
        {latestPrompt && (
          <div className="flex items-start gap-1.5">
            <div className="w-4 h-4 rounded-full flex-shrink-0 flex items-center justify-center bg-blue-500/20 border border-blue-500/30">
              <User className="w-2 h-2 text-blue-400" />
            </div>
            <div className="max-w-[90%] rounded-lg px-2 py-1 bg-blue-500/10 border border-blue-500/20 rounded-tl-sm">
              <p className="text-[10px] leading-relaxed text-blue-100">{latestPrompt.content}</p>
            </div>
          </div>
        )}

        {/* Typing indicator (before response starts) */}
        {isTyping && !isStreaming && (
          <div className="flex items-start gap-1.5 flex-row-reverse">
            <div className="w-4 h-4 rounded-full flex-shrink-0 flex items-center justify-center bg-gradient-to-br from-cyan-500/20 to-purple-500/20 border border-cyan-500/30 animate-pulse">
              <Sparkles className="w-2 h-2 text-cyan-400" />
            </div>
            <div className="rounded-lg px-2 py-1 bg-gradient-to-br from-cyan-500/5 to-purple-500/5 border border-cyan-500/20 rounded-tr-sm">
              <div className="flex items-center gap-1">
                <div className="flex gap-0.5">
                  <span className="w-1 h-1 rounded-full bg-cyan-400 animate-bounce" style={{ animationDelay: '0ms' }} />
                  <span className="w-1 h-1 rounded-full bg-cyan-400 animate-bounce" style={{ animationDelay: '150ms' }} />
                  <span className="w-1 h-1 rounded-full bg-cyan-400 animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
                <span className="text-[10px] font-mono text-cyan-400/60 italic">{typingPhrase}</span>
              </div>
            </div>
          </div>
        )}

        {/* Latest response (streaming or complete) */}
        {latestResponse && (
          <div className="flex items-start gap-1.5 flex-row-reverse">
            <div className="w-4 h-4 rounded-full flex-shrink-0 flex items-center justify-center bg-gradient-to-br from-cyan-500/20 to-purple-500/20 border border-cyan-500/30">
              <Sparkles className="w-2 h-2 text-cyan-400" />
            </div>
            <div className="max-w-[90%] rounded-lg px-2 py-1 bg-gradient-to-br from-cyan-500/10 to-purple-500/10 border border-cyan-500/20 rounded-tr-sm">
              <p className="text-[10px] leading-relaxed whitespace-pre-wrap text-white/90">
                {latestResponse.displayedContent || latestResponse.content}
                {latestResponse.isStreaming && (
                  <span className="inline-block w-1 h-2.5 bg-cyan-400 ml-0.5 animate-pulse" />
                )}
              </p>
            </div>
          </div>
        )}

        {/* Empty State */}
        {!latestPrompt && !isTyping && (
          <div className="flex items-center justify-center py-4 opacity-40">
            <Send className="w-4 h-4 text-white/20 mr-2" />
            <p className="text-[10px] text-white/40">
              {!isRunning ? 'Select a model to begin' : 'Starting...'}
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default ChatSimulator;
