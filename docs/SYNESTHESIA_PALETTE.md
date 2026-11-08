# Synesthesia Color Palette

Design system palette for the Chakra Dashboard, based on the [Synesthesia VS Code theme](https://marketplace.visualstudio.com/items?itemName=DrFWord.Synesthesia).

## Design Principle

All colors share **identical saturation and lightness** — only hue varies, in 5-degree increments. This creates perceptual uniformity: no color "pops" more than another, yet there's enough range for every UI element.

HSL basis: `hsl(H, 43%, 50%)` — saturation 43%, lightness 50%.

## Full Spectrum (72 colors)

| Hue | Hex | Semantic Zone |
|-----|-----|---------------|
| 0° | `#b34d4d` | **Red** — Errors, destructive actions, critical alerts |
| 5° | `#b3554d` | |
| 10° | `#b35e4d` | |
| 15° | `#b3664d` | **Red-Orange** — Warnings, degraded state |
| 20° | `#b36f4d` | |
| 25° | `#b3774d` | |
| 30° | `#b3804d` | **Orange** — Active/hot, high utilization |
| 35° | `#b3884d` | |
| 40° | `#b3914d` | |
| 45° | `#b3994d` | **Amber** — Music controls, caution, warm accent |
| 50° | `#b3a24d` | |
| 55° | `#b3aa4d` | |
| 60° | `#b2b34d` | **Yellow** — Strings, text content, labels |
| 65° | `#aab34d` | |
| 70° | `#a1b34d` | |
| 75° | `#99b34d` | **Yellow-Green** — Transition zone |
| 80° | `#90b34d` | |
| 85° | `#88b34d` | |
| 90° | `#80b34d` | **Green** — Healthy, success, optimal |
| 95° | `#77b34d` | |
| 100° | `#6eb34d` | |
| 105° | `#66b34d` | |
| 110° | `#5eb34d` | **Bright Green** — Timestamps, logs |
| 115° | `#55b34d` | |
| 120° | `#4db34d` | **Pure Green** — Online, connected |
| 125° | `#4db355` | |
| 130° | `#4db35e` | **Teal-Green** — Functions, interactive |
| 135° | `#4db366` | |
| 140° | `#4db36f` | |
| 145° | `#4db377` | |
| 150° | `#4db380` | |
| 155° | `#4db388` | |
| 160° | `#4db391` | **Teal** — Self-referential, state |
| 165° | `#4db399` | |
| 170° | `#4db3a2` | |
| 175° | `#4db3aa` | **Cyan-Teal** — Mutable, dynamic |
| 180° | `#4db2b3` | **Cyan** — Network, data flow, RDMA |
| 185° | `#4daab3` | |
| 190° | `#4da1b3` | |
| 195° | `#4d99b3` | **Sky Blue** — Parameters, attributes |
| 200° | `#4d90b3` | |
| 205° | `#4d88b3` | |
| 210° | `#4d7fb3` | **Blue** — Types, classes, structure |
| 215° | `#4d77b3` | |
| 220° | `#4d6eb3` | |
| 225° | `#4d66b3` | **Deep Blue** — Properties, object fields |
| 230° | `#4d5eb3` | |
| 235° | `#4d55b3` | |
| 240° | `#4d4db3` | **Indigo** — Metadata, attributes |
| 245° | `#554db3` | |
| 250° | `#5d4db3` | **Blue-Violet** — Constants |
| 255° | `#664db3` | |
| 260° | `#6f4db3` | **Violet** — Storage, classes |
| 265° | `#774db3` | |
| 270° | `#7f4db3` | **Purple** — Interfaces, types |
| 275° | `#884db3` | |
| 280° | `#914db3` | **Deep Purple** — Storage modifiers |
| 285° | `#994db3` | |
| 290° | `#a14db3` | |
| 295° | `#aa4db3` | **Magenta** — Transition zone |
| 300° | `#b34db2` | |
| 305° | `#b34daa` | |
| 310° | `#b34da1` | **Pink-Magenta** — Operators, transforms |
| 315° | `#b34d99` | |
| 320° | `#b34d90` | |
| 325° | `#b34d88` | **Hot Pink** — Decorators |
| 330° | `#b34d80` | **Rose** — Expressions, queries |
| 335° | `#b34d77` | |
| 340° | `#b34d6e` | **Red-Pink** — Arithmetic, logic |
| 345° | `#b34d66` | |
| 350° | `#b34d5e` | **Red-Rose** — Relational operators |
| 355° | `#b34d55` | |

## Dashboard Mapping (Proposed)

| UI Element | Hue Range | Example |
|-----------|-----------|---------|
| Node: Muladhara | 0° | `#b34d4d` (red, root) |
| Node: Svadhisthana | 30° | `#b3804d` (orange, sacral) |
| Node: Manipura | 60° | `#b2b34d` (yellow, solar) |
| Node: Anahata | 120° | `#4db34d` (green, heart) |
| Node: Vishuddha | 180° | `#4db2b3` (cyan, throat) |
| Node: Ajna | 240° | `#4d4db3` (indigo, third eye) |
| Node: Sahasrara | 270° | `#7f4db3` (violet, crown) |
| Errors / Critical | 0-10° | Red zone |
| Warnings / Degraded | 15-25° | Orange zone |
| Music controls | 45° | Amber |
| Success / Healthy | 90-120° | Green zone |
| Speech controls | 120° | Emerald |
| Network / RDMA | 180° | Cyan |
| Types / Structure | 210-230° | Blue zone |
| Inference / AI | 260-280° | Purple zone |
| Operators / Logic | 330-355° | Rose zone |

## Generating Variants

Since all colors share the same S/L, you can derive lighter/darker variants uniformly:

```css
/* Base: hsl(H, 43%, 50%) */
/* Muted: hsl(H, 43%, 30%) — backgrounds, borders */
/* Bright: hsl(H, 43%, 70%) — highlights, hover */
/* Glow: hsl(H, 60%, 50%) — emphasis, active states */
/* Dim: hsl(H, 20%, 40%) — disabled, inactive */
```

## Chakra Node Colors (Current vs Synesthesia)

| Node | Current | Synesthesia Equivalent |
|------|---------|----------------------|
| Muladhara | `#ef4444` | `#b34d4d` (0°) |
| Svadhisthana | `#f97316` | `#b3804d` (30°) |
| Manipura | `#eab308` | `#b2b34d` (60°) |
| Anahata | `#22c55e` | `#4db34d` (120°) |
| Vishuddha | `#06b6d4` | `#4db2b3` (180°) |
| Ajna | `#6366f1` | `#4d4db3` (240°) |
| Sahasrara | `#a855f7` | `#7f4db3` (270°) |

The chakra system naturally maps to 7 evenly-spaced hues (~51° apart), fitting perfectly within the 72-color synesthesia spectrum.
