// ============================================================
// Shared Types - used by both frontend and engine
// ============================================================

export type PenType = 'fountain' | 'pencil' | 'marker' | 'brush';

export type HandwritingStyle =
  | 'casual'
  | 'school'
  | 'signature'
  | 'elegant'
  | 'calligraphy'
  | 'fast-notes'
  | 'marker-writing'
  | 'pencil-sketch';

export type PaperBackground =
  | 'none'
  | 'white'
  | 'cream'
  | 'lined'
  | 'grid'
  | 'aged'
  | 'dark';

export type ExportFormat = 'ae-project' | 'mogrt' | 'svg-animation' | 'json-preset';

// ─── Plugin Settings ──────────────────────────────────────────────────────────

export interface PluginSettings {
  text: string;
  fontFamily: string;
  style: HandwritingStyle;
  inkColor: string;
  strokeWidth: number;
  writingSpeed: number; // 1–10
  penType: PenType;
  paperBackground: PaperBackground;

  // Optional
  animateHand: boolean;
  filledText: boolean;
  randomizePenPressure: boolean;
  smoothCurves: boolean;
  naturalPauses: boolean;
  autoCameraZoom: boolean;
}

export const defaultSettings: PluginSettings = {
  text: '',
  fontFamily: 'PlaywriteID-Regular',
  style: 'elegant',
  inkColor: '#1a1a2e',
  strokeWidth: 3,
  writingSpeed: 3,
  penType: 'fountain',
  paperBackground: 'cream',
  animateHand: true,
  filledText: false,
  randomizePenPressure: true,
  smoothCurves: true,
  naturalPauses: true,
  autoCameraZoom: false,
};

// ─── SVG / Path Types ─────────────────────────────────────────────────────────

export interface Point {
  x: number;
  y: number;
}

export interface BezierCurve {
  start: Point;
  cp1: Point;
  cp2: Point;
  end: Point;
}

export type PathCommand =
  | { type: 'M'; x: number; y: number }
  | { type: 'L'; x: number; y: number }
  | { type: 'C'; x1: number; y1: number; x2: number; y2: number; x: number; y: number }
  | { type: 'Q'; x1: number; y1: number; x: number; y: number }
  | { type: 'Z' };

export interface GlyphPath {
  char: string;
  commands: PathCommand[];
  advanceWidth: number;
  boundingBox: { x1: number; y1: number; x2: number; y2: number };
}

export interface WordPaths {
  word: string;
  glyphs: GlyphPath[];
  totalWidth: number;
}

// ─── Stroke Types ─────────────────────────────────────────────────────────────

export interface StrokeSegment {
  id: string;
  commands: PathCommand[];
  duration: number;     // seconds
  startTime: number;    // seconds from start
  pressure: number[];   // pressure profile 0–1 per point
  speed: number[];      // speed profile per point
  isLift: boolean;      // true = pen lift between strokes
}

export interface LetterStrokes {
  char: string;
  segments: StrokeSegment[];
  connectsToNext: boolean; // cursive join
  joinPoint?: Point;
}

// ─── Animation Types ──────────────────────────────────────────────────────────

export interface Keyframe {
  time: number;   // seconds
  value: number;
  easeIn?: number;
  easeOut?: number;
}

export interface AnimatedProperty {
  name: string;
  keyframes: Keyframe[];
}

export interface Font {
  id: string;
  label: string;
  url: string;
  style: string;
  group?: string;
}

export interface ShapeLayerData {
  id: string;
  name: string;
  pathData: string;         // SVG path string
  strokeColor: string;
  strokeWidth: AnimatedProperty;
  trimPathStart: AnimatedProperty;
  trimPathEnd: AnimatedProperty;
  opacity: AnimatedProperty;
  lineCap: 'round' | 'butt' | 'square';
  lineJoin: 'round' | 'bevel' | 'miter';
  position: { x: AnimatedProperty; y: AnimatedProperty };
}

export interface PenLayerData {
  id: string;
  penType: PenType;
  position: { x: AnimatedProperty; y: AnimatedProperty };
  rotation: AnimatedProperty;
  opacity: AnimatedProperty;
  scale: AnimatedProperty;
}

export interface CompositionData {
  name: string;
  width: number;
  height: number;
  frameRate: number;
  duration: number;
  backgroundColor: string;
  shapeLayers: ShapeLayerData[];
  penLayer?: PenLayerData;
  hasCamera: boolean;
}

// ─── Engine Result ────────────────────────────────────────────────────────────

export interface EngineResult {
  success: boolean;
  composition?: CompositionData;
  previewSvg?: string;
  error?: string;
  warnings?: string[];
  stats?: {
    totalStrokes: number;
    totalDuration: number;
    layerCount: number;
  };
}

// ─── ExtendScript Bridge ──────────────────────────────────────────────────────

export interface BridgeMessage {
  type: 'generate' | 'preview' | 'ping' | 'export';
  payload?: unknown;
}

export interface BridgeResponse {
  success: boolean;
  data?: unknown;
  error?: string;
}

// ─── Style Presets ────────────────────────────────────────────────────────────

export interface StylePreset {
  id: HandwritingStyle;
  label: string;
  description: string;
  strokeWidthMultiplier: number;
  speedMultiplier: number;
  jitterAmount: number;      // 0–1
  pressureVariation: number; // 0–1
  curveSmoothing: number;    // 0–1
  pauseFrequency: number;    // 0–1
  slantAngle: number;        // degrees
  letterSpacingMultiplier: number;
}

export const STYLE_PRESETS: Record<HandwritingStyle, StylePreset> = {
  casual: {
    id: 'casual',
    label: 'Casual',
    description: 'Relaxed, everyday handwriting',
    strokeWidthMultiplier: 1.0,
    speedMultiplier: 1.2,
    jitterAmount: 0.3,
    pressureVariation: 0.2,
    curveSmoothing: 0.6,
    pauseFrequency: 0.1,
    slantAngle: 5,
    letterSpacingMultiplier: 1.0,
  },
  school: {
    id: 'school',
    label: 'School',
    description: 'Clean, upright print handwriting',
    strokeWidthMultiplier: 0.9,
    speedMultiplier: 0.9,
    jitterAmount: 0.15,
    pressureVariation: 0.1,
    curveSmoothing: 0.8,
    pauseFrequency: 0.15,
    slantAngle: 0,
    letterSpacingMultiplier: 1.1,
  },
  signature: {
    id: 'signature',
    label: 'Signature',
    description: 'Fluid, personal signature style',
    strokeWidthMultiplier: 1.2,
    speedMultiplier: 1.8,
    jitterAmount: 0.1,
    pressureVariation: 0.4,
    curveSmoothing: 0.9,
    pauseFrequency: 0.05,
    slantAngle: 15,
    letterSpacingMultiplier: 0.85,
  },
  elegant: {
    id: 'elegant',
    label: 'Elegant',
    description: 'Refined cursive with fine strokes',
    strokeWidthMultiplier: 0.8,
    speedMultiplier: 0.8,
    jitterAmount: 0.05,
    pressureVariation: 0.35,
    curveSmoothing: 0.95,
    pauseFrequency: 0.1,
    slantAngle: 10,
    letterSpacingMultiplier: 1.05,
  },
  calligraphy: {
    id: 'calligraphy',
    label: 'Calligraphy',
    description: 'Thick-thin contrast, deliberate strokes',
    strokeWidthMultiplier: 1.5,
    speedMultiplier: 0.6,
    jitterAmount: 0.02,
    pressureVariation: 0.7,
    curveSmoothing: 0.9,
    pauseFrequency: 0.2,
    slantAngle: 12,
    letterSpacingMultiplier: 1.2,
  },
  'fast-notes': {
    id: 'fast-notes',
    label: 'Fast Notes',
    description: 'Quick, scrawled writing under time pressure',
    strokeWidthMultiplier: 0.85,
    speedMultiplier: 2.5,
    jitterAmount: 0.5,
    pressureVariation: 0.15,
    curveSmoothing: 0.4,
    pauseFrequency: 0.03,
    slantAngle: 8,
    letterSpacingMultiplier: 0.9,
  },
  'marker-writing': {
    id: 'marker-writing',
    label: 'Marker Writing',
    description: 'Bold, confident marker strokes',
    strokeWidthMultiplier: 2.5,
    speedMultiplier: 1.3,
    jitterAmount: 0.08,
    pressureVariation: 0.05,
    curveSmoothing: 0.7,
    pauseFrequency: 0.08,
    slantAngle: 3,
    letterSpacingMultiplier: 1.0,
  },
  'pencil-sketch': {
    id: 'pencil-sketch',
    label: 'Pencil Sketch',
    description: 'Light, textured pencil strokes',
    strokeWidthMultiplier: 0.7,
    speedMultiplier: 0.95,
    jitterAmount: 0.4,
    pressureVariation: 0.25,
    curveSmoothing: 0.55,
    pauseFrequency: 0.12,
    slantAngle: 2,
    letterSpacingMultiplier: 1.0,
  },
};