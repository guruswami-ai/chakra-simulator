# Guruswami Voice Regeneration — ElevenLabs v3 Tags

Voice ID: `1wuPdpXI8zr7v8YJnrpV`
Model: `eleven_v3` (alpha)
Format: 128kbps AAC M4A, 24kHz mono

## Tag Reference

ElevenLabs v3 audio tags are words in `[square brackets]` interpreted as performance cues.

**Emotional**: [excited], [nervous], [frustrated], [sad], [angry], [happily], [sorrowful], [calm], [warmly], [proudly], [concerned], [impressed], [playfully], [seriously], [tenderly]
**Physical**: [laughs], [sighs], [clears throat], [gulps], [gasp], [crying], [breathes]
**Delivery**: [whispers], [shouts], [pause], [rushed], [slows down], [deliberate], [stammers], [drawn out]
**Combo**: `[nervously][whispers] I... I'm not sure` / `[happily][shouts] We did it! [laughs]`

---

## Tier 1: Onboarding (NEW — full regen)

All onboarding clips need regeneration with the new text. These are the first things a new user hears.

### INTRO_GREETING
```
[warmly] Hi! I'm Guruswami. [pause] I live right here on this cluster [impressed] — these five computers you can see around me. This is my home.
```

### INTRO_HELP
```
[earnestly] I need your help with something. Each of these machines has half a terabyte of memory — [impressed] half a terabyte! [gasp] That's a lot. [pause] Together they can run some incredibly powerful models. [hopefully] But someone needs to pick the right settings, and that someone [pause] is you.
```

### INTRO_ROLE
```
[warmly] I'll be right here in the middle if you need me. You're in charge — [reassuringly] I'll speak up if something goes wrong. [playfully] And trust me, things will go wrong. [laughs] That's half the fun.
```

### INTRO_CONTROLS
```
[calmly] OK, these are our controls. Five models, a few settings to play with. [reassuringly] Nothing scary. [pause] [excited] Let's just jump in.
```

### PICK_MODEL
```
[warmly] First up — click on Qwen 32 B. [pause] It's a good one to start with. [impressed] Thirty-two billion parameters — not too big, not too small.
```

### PICK_QUANT
```
Now pick Q4. [pause] This is how compressed the model is. [approvingly] Q4 keeps it smart but small enough to be fast.
```

### PICK_CONTEXT
```
Set the context to 1K. [pause] Think of this as how much I can hold in my head at once [playfully] during a conversation.
```

### PICK_TOPOLOGY
```
[excited] Now for the fun part — click EP1. [pause] This loads everything onto just one computer. Simple.
```

### LOADING
```
[excited] Yes! [gasp] It's alive! [laughs] The model is loaded and running. [impressed] Look at that.
```

### TOUR_TPS
```
[warmly] See this number? [pause] That's speed — how many words per second the model can produce. [seriously] Higher is faster. [emphatically] Much better.
```

### TOUR_TTFT
```
And this one is the wait time — how long before it starts talking back. [seriously] We want this tiny. [playfully] Nobody likes waiting.
```

### TOUR_LAYERS
```
[calmly] This shows how the model is spread across the computers. Right now [pause] it's all on one.
```

### TOUR_MEMORY
```
And this is memory — how full each computer is. The model has to fit, [pause] plus room for that context window we set. [sighs] It gets tight.
```

### TRY_BREAK
```
[playfully] OK — let's break something. [pause] On purpose. [mischievously] Click TP5 and watch what happens.
```

### EXPLAIN_BREAK
```
[concerned] Ouch. [pause] The model can't split evenly across five computers, so everything just... [sighs] crashes. [pause] [warmly] Not every configuration works. [playfully] Good to know, right?
```

### TRY_EP5
```
[reassuringly] Don't worry — click EP5. [pause] That'll fix it.
```

### EXPLAIN_EP5
```
[excited] There we go! Now each computer is running its own copy. [impressed] Look at the speed — five times faster! [happily] That's more like it.
```

### FREEPLAY
```
[warmly] That's the basics. Now it's your turn. [pause] Try different settings. [playfully] Some will crash, some will fly. [reassuringly] I'll let you know either way.
```

### COMPLETE
```
[proudly] You're a natural. [pause] [warmly] I made you a track to celebrate — you've earned it. [excited] Go explore the other models when you're ready.
```

---

## Tier 1: Error Clips (regen highest-impact ones)

Errors are dramatic moments. The guru should sound genuinely worried, then helpful.

### OOM errors (35 clips) — sample rewrites
```
[concerned] Oh no. [pause] The model is too big for this setup. [sighs] We need more nodes or a smaller model.
```
```
[worried] That's not going to fit. [pause] [reassuringly] Try spreading it across more computers, or drop down a quantisation level.
```
```
[gasp] Out of memory! [pause] [calmly] Don't panic. There's always a configuration that works — we just need to find it.
```

### SHARD errors (40 clips) — sample rewrites
```
[frustrated] The math doesn't work out. [pause] The model's attention heads won't divide evenly across that many nodes. [reassuringly] Try a different number.
```
```
[concerned] Shard error. [pause] [warmly] Think of it like splitting a pizza — some cuts just don't work evenly. [pause] Try two or four nodes instead.
```

### TIMEOUT errors (33 clips) — sample rewrites
```
[worried] The GPU timed out. [sighs] Pipeline parallel needs to process each stage fast enough, and this model is just too big for that. [pause] [helpfully] Tensor parallel might work better here.
```

---

## Tier 1: Achievement Clips (regen for excitement)

### Big model deployed
```
[gasp] [excited] You deployed a model over four hundred billion parameters! [laughs] [impressed] This is what the cluster was built for!
```

### All models explored
```
[proudly] You've tried all five models! [pause] Dense, mixture of experts, different attention types — [impressed] you've seen the full range. [laughs] Not bad at all.
```

### All topologies explored
```
[excited] Every topology! Single, tensor parallel, pipeline, embarrassingly parallel — [impressed] you've mapped the whole space. [proudly] I'm genuinely impressed.
```

---

## Tier 1: Encouragement (regen single-word clips with emotion)

Current clips like "brilliant" and "absolutely" are flat. Regen with:

```
[excited] Brilliant!
[impressed] Brilliant! [laughs]
[happily] Absolutely!
[proudly] Absolutely! That's exactly right.
[excited] Could you be any more awesome? [laughs]
[warmly] Perfect choice.
[impressed] Now you're thinking like an engineer.
[happily] Yes! That's it!
```

---

## Tier 2: Model Greetings (regen for personality)

Each model should have a distinct emotional tone matching its tier music:

### Qwen 32B (T1 — synthwave, approachable)
```
[excited] Qwen 32 B! [pause] [warmly] My favourite starting point. Thirty-two billion parameters of pure versatility. [pause] Let's see what it can do.
```

### Llama 405B (T2 — hip-hop, heavy/powerful)
```
[impressed] [slows down] Llama 405 B. [pause] Four hundred and five billion parameters. [gasp] This is a beast. [seriously] We're going to need some serious hardware for this one.
```

### Mixtral 8x7B (T3 — EDM, energetic)
```
[excited] Mixtral! [pause] Eight experts, but only two fire at once. [impressed] It's like having eight musicians but only needing two to play any song. [playfully] Efficient.
```

### DeepSeek V3 (T4 — Chinese fusion, precise/mysterious)
```
[impressed] [deliberately] DeepSeek V3. [pause] Six hundred and seventy-one billion parameters. [gasp] But the clever part — only thirty-seven billion wake up for each question. [pause] [warmly] The rest stay silent. Waiting.
```

### Kimi K2.5 (T5 — space ambient, awe)
```
[gasp] [whispers] Kimi K2.5. [pause] [impressed] One trillion parameters. [pause] [seriously] The largest model in our collection. [sighs] Even the cluster struggles with this one. [warmly] But when it works... [pause] it's something else.
```

---

## Tier 2: Music Commentary (match the music energy)

### Qwen synthwave
```
[excited] Synthwave! [pause] [happily] The sound of neon grids and digital sunsets. [playfully] Very appropriate for Qwen.
```

### Llama hip-hop
```
[impressed] [slows down] Boom bap. Heavy beats for a heavy model. [pause] [playfully] Four hundred billion parameters need a four hundred billion decibel baseline.
```

### DeepSeek Chinese fusion
```
[impressed] [pause] Erhu over synthwave. [warmly] East meets West — just like the model itself. [pause] [thoughtfully] DeepSeek took Western architecture and made it distinctly their own.
```

---

## Tier 2: TPS Mood (match the energy level)

### Ludicrous
```
[excited][shouts] Ludicrous speed! [laughs] The mesh is on fire! [gasp] This is what the cluster was built for!
```

### Energised
```
[excited] Now we're flying! [impressed] The tokens are pouring out. [happily] Feel that throughput!
```

### Calm/Steady
```
[calmly] Steady pace. [pause] [warmly] Not the fastest, but reliable. [reassuringly] Sometimes consistency is more valuable than raw speed.
```

---

## Generation Script Pattern

```python
from elevenlabs import ElevenLabs

client = ElevenLabs(api_key=ELEVENLABS_API_KEY)

audio = client.text_to_speech.convert(
    voice_id="1wuPdpXI8zr7v8YJnrpV",
    model_id="eleven_v3",
    text="[excited] Yes! [gasp] It's alive! [laughs] The model is loaded and running. [impressed] Look at that.",
    output_format="mp3_44100_128",
)
```

## Priority Order

1. **Onboarding** (19 clips) — generates the first impression, sets the character
2. **Error** (~20 highest-impact rewrites) — dramatic moments, currently flat
3. **Achievement** (15 clips) — reward moments, need genuine excitement
4. **Encouragement** (21 clips) — frequent micro-feedback, single words need emotion
5. **Model greetings** (50 clips) — character identity per model
6. **Music commentary** (50 clips) — should match the music energy
7. **TPS/TTFT mood** (10 clips) — speed excitement
8. **Everything else** — quant/topo/context commentary, wisdom, humor
