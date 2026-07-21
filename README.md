# ✍ Handwriting Animation Plugin for Adobe After Effects

A commercial-quality CEP plugin that converts any text into a realistic handwriting animation inside After Effects — with correct stroke order, natural pen movement, pressure variation, and cursive joining.

---

## Architecture Overview

```
Text Input
    │
    ▼
engine/svg/TextToPath.ts        ← OpenType.js: text → GlyphPaths
    │
    ▼
engine/svg/BezierOptimizer.ts   ← RDP simplification + Catmull-Rom smoothing
    │
    ▼
engine/stroke/StrokeOrderEngine.ts  ← Sub-path ordering, pressure/speed profiles, jitter
    │
    ▼
engine/animation/AnimationGenerator.ts  ← Trim path keyframes, pen layer, CompositionData
    │
    ▼
src/utils/cepBridge.ts          ← Serializes to JSON, calls evalScript
    │
    ▼
host/jsx/handwriting.jsx        ← ExtendScript: builds AE layers from JSON
    │
    ▼
After Effects Timeline          ← Shape layers + Trim Paths + Easy Ease
```

---

## Quick Start

### Development (browser)

```bash
npm install
npm run dev
```

The panel renders at `http://localhost:3000` without AE. All AE calls are mocked.

### Build

```bash
npm run build
```

### Install in After Effects

```bash
npm run build:plugin
```

Then follow the instructions printed in the console (copy to CEP extensions folder, enable unsigned extensions).

---

## Folder Structure

```
ae-handwriting-plugin/
├── src/                        # React UI
│   ├── components/
│   │   ├── controls/           # TextInput, Select, Slider, Color, Toggle
│   │   ├── PluginPanel.tsx     # Root panel component
│   │   ├── PreviewPane.tsx     # SVG preview
│   │   ├── StatusBar.tsx       # Status / error display
│   │   └── GenerateButton.tsx  # Animated generate button
│   ├── hooks/
│   │   └── useHandwritingEngine.ts  # Central state + engine orchestration
│   ├── utils/
│   │   └── cepBridge.ts        # CEP <-> AE communication
│   └── styles/
│       └── panel.css           # Dark Adobe-style CSS
│
├── engine/                     # Pure TypeScript engine (no React dependency)
│   ├── svg/
│   │   ├── TextToPath.ts       # OpenType.js integration
│   │   └── BezierOptimizer.ts  # Path simplification & smoothing
│   ├── stroke/
│   │   └── StrokeOrderEngine.ts # Stroke decomposition, timing, pressure
│   └── animation/
│       ├── AnimationGenerator.ts # AE composition data builder
│       └── PresetExporter.ts   # JSON, SVG, MOGRT export
│
├── shared/
│   └── types.ts                # All shared TypeScript types
│
├── host/
│   ├── jsx/
│   │   └── handwriting.jsx     # ExtendScript — runs inside AE
│   ├── scripts/                # Additional JSX utilities
│   └── manifest/
│       └── manifest.xml        # CEP plugin manifest
│
├── assets/
│   ├── fonts/                  # TTF/OTF font files (Sacramento, Caveat, etc.)
│   ├── pens/                   # Pen tip PNG assets
│   └── textures/               # Paper texture PNGs
│
└── scripts/
    └── package-plugin.js       # Build → CEP package script
```

---

## Adding Fonts

1. Download TTF/OTF fonts (not WOFF/WOFF2) from [Google Fonts](https://fonts.google.com/)
2. Drop them into `assets/fonts/`
3. Add entries to `AVAILABLE_FONTS` in `src/hooks/useHandwritingEngine.ts`:

```typescript
{
  id: 'MyFont',
  label: 'My Font (Elegant)',
  url: 'assets/fonts/MyFont-Regular.ttf',
  style: 'cursive',
}
```

**Note:** opentype.js only supports TTF/OTF formats. WOFF2 files will fail with "Unsupported OpenType signature" error.

---

## Adding Handwriting Styles

Add a new entry to `STYLE_PRESETS` in `shared/types.ts`:

```typescript
'my-style': {
  id: 'my-style',
  label: 'My Style',
  description: 'Custom handwriting look',
  strokeWidthMultiplier: 1.1,
  speedMultiplier: 1.0,
  jitterAmount: 0.2,
  pressureVariation: 0.3,
  curveSmoothing: 0.7,
  pauseFrequency: 0.1,
  slantAngle: 5,
  letterSpacingMultiplier: 1.0,
},
```

And update the `HandwritingStyle` type union.

---

## ExtendScript Compatibility

`host/jsx/handwriting.jsx` targets **ExtendScript (ES3)** — no arrow functions, no `let`/`const`, no template literals. All modern TypeScript runs only in the panel (CEP browser context).

---

## Future AI Features (Architecture Hooks)

The engine is designed to support these additions without refactoring:

| Feature | Where to add |
|---|---|
| AI stroke prediction | `engine/stroke/StrokeOrderEngine.ts` → replace `orderSubPaths()` |
| Clone user handwriting | New `engine/ai/HandwritingCloner.ts` → output `StylePreset` |
| Multi-language support | `engine/svg/TextToPath.ts` → add RTL/vertical layout modes |
| AI pen pressure | `generatePressureProfile()` → ML model inference |
| Signature generation | New style preset + `engine/stroke/SignatureEngine.ts` |

---

## CEP Debug Console

Open Chrome DevTools for the panel:

```
http://localhost:7777
```

(requires `--enable-devtools` in manifest CEFCommandLine)

---

## Tech Stack

| Layer | Technology |
|---|---|
| UI | React 18, TypeScript, Vite |
| Styling | Custom CSS (Adobe dark theme) |
| Font parsing | OpenType.js |
| Path math | Custom bezier engine |
| AE integration | CEP 9 + ExtendScript (JSX) |
| Build | Vite + custom packaging script |