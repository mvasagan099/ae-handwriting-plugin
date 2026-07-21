/**
 * AnimationGenerator
 * Converts processed LetterStrokes into After Effects composition data:
 * shape layers, trim path keyframes, pen movement, camera.
 *
 * The output (CompositionData) is serialized and passed to ExtendScript
 * via the CEP bridge to be applied inside After Effects.
 */

import type {
  AnimatedProperty,
  CompositionData,
  Keyframe,
  LetterStrokes,
  PenLayerData,
  PenType,
  PluginSettings,
  ShapeLayerData,
  StrokeSegment,
  StylePreset,
} from '../../shared/types';
import {
  applyJitter,
  processWordStrokes,
} from '../stroke/strokeOrderEngine';
import { commandsToSvgPath, samplePathPoints, textToWordPaths, translateCommands } from '../svg/textToPath';
import { STYLE_PRESETS } from '../../shared/types';
import { optimizeSpacing } from '../ai/aiService'; // Force Vite cache refresh

// ─── Easing ───────────────────────────────────────────────────────────────────

/**
 * Build an animated property with smooth in/out easing.
 * AE uses cubic ease handles in terms of percentage (0–100).
 */
function buildTrimPathProperty(
  segment: StrokeSegment,
  startValue: number,
  endValue: number,
): AnimatedProperty {
  const easeIn = 33;
  const easeOut = 67;

  const keyframes: Keyframe[] = [
    { time: segment.startTime, value: startValue, easeIn, easeOut },
    {
      time: segment.startTime + segment.duration,
      value: endValue,
      easeIn,
      easeOut,
    },
  ];

  return { name: 'trimPath', keyframes };
}

function buildConstantProperty(name: string, value: number, duration: number): AnimatedProperty {
  return {
    name,
    keyframes: [
      { time: 0, value },
      { time: duration, value },
    ],
  };
}

function buildOpacityProperty(
  segmentStart: number,
  segmentEnd: number,
  totalDuration: number,
  isLift: boolean,
): AnimatedProperty {
  // Lift strokes are invisible (pen moves above paper)
  const opacityValue = isLift ? 0 : 100;

  const keyframes: Keyframe[] = [
    { time: Math.max(0, segmentStart - 0.001), value: 0 },
    { time: segmentStart, value: opacityValue },
    { time: segmentEnd, value: opacityValue },
    { time: Math.min(totalDuration, segmentEnd + 0.001), value: opacityValue },
  ];

  return { name: 'opacity', keyframes };
}

// ─── Shape Layer Builder ──────────────────────────────────────────────────────

function buildShapeLayer(
  segment: StrokeSegment,
  settings: PluginSettings,
  preset: StylePreset,
  totalDuration: number,
  layerIndex: number,
): ShapeLayerData {
  const jitteredCommands = applyJitter(
    segment.commands,
    preset.jitterAmount * (settings.randomizePenPressure ? 1 : 0.2),
  );

  const pathString = commandsToSvgPath(jitteredCommands);

  // Stroke width varies with pressure if enabled
  // We scale the stroke width proportionally to the fontSize (which is 280, originally 72)
  const baseWidth = settings.strokeWidth * preset.strokeWidthMultiplier * (280 / 72);
  const trimEnd = buildTrimPathProperty(segment, 0, 100);
  const trimStart = buildConstantProperty('trimPathStart', 0, totalDuration);

  // Apply penType specific styles
  let finalWidth = baseWidth;
  let lineCap: 'round' | 'butt' | 'square' = 'round';
  let lineJoin: 'round' | 'bevel' | 'miter' = 'round';
  let opacityMult = 1.0;

  if (settings.penType === 'marker') {
    finalWidth *= 2.5;
    lineCap = 'square';
    lineJoin = 'bevel';
  } else if (settings.penType === 'pencil') {
    finalWidth *= 0.8;
    opacityMult = 0.8;
  } else if (settings.penType === 'brush') {
    finalWidth *= 1.8;
  }

  const strokeWidthKeyframes: Keyframe[] = segment.pressure.map((p, i) => ({
    time: segment.startTime + (i / Math.max(1, segment.pressure.length - 1)) * segment.duration,
    value: finalWidth * (0.5 + p * 0.5),
    easeIn: 33,
    easeOut: 67,
  }));

  const opacityProp = buildOpacityProperty(
    segment.startTime,
    segment.startTime + segment.duration,
    totalDuration,
    segment.isLift,
  );
  
  if (opacityMult < 1.0) {
    opacityProp.keyframes.forEach(kf => kf.value *= opacityMult);
  }

  return {
    id: segment.id,
    name: segment.isLift
      ? `Lift_${layerIndex}`
      : `Stroke_${layerIndex}`,
    pathData: pathString,
    strokeColor: segment.isLift ? 'transparent' : settings.inkColor,
    strokeWidth: {
      name: 'strokeWidth',
      keyframes: strokeWidthKeyframes.length > 0
        ? strokeWidthKeyframes
        : [{ time: 0, value: finalWidth }],
    },
    trimPathStart: trimStart,
    trimPathEnd: trimEnd,
    opacity: opacityProp,
    lineCap,
    lineJoin,
    position: {
      x: buildConstantProperty('x', 0, totalDuration),
      y: buildConstantProperty('y', 0, totalDuration),
    },
  };
}

// ─── Pen Layer Builder ────────────────────────────────────────────────────────

/**
 * Build an animated pen layer that follows the writing path.
 * Samples position from all stroke paths in order.
 */
function buildPenLayer(
  allStrokes: LetterStrokes[],
  settings: PluginSettings,
  totalDuration: number,
): PenLayerData {
  const xKeyframes: Keyframe[] = [];
  const yKeyframes: Keyframe[] = [];
  const rotationKeyframes: Keyframe[] = [];
  const opacityKeyframes: Keyframe[] = [
    { time: 0, value: 0 },
    { time: 0.001, value: 100 },
    { time: totalDuration - 0.1, value: 100 },
    { time: totalDuration, value: 0 },
  ];

  for (const letter of allStrokes) {
    for (const segment of letter.segments) {
      const points = samplePathPoints(segment.commands, 20);
      if (points.length === 0) continue;

      points.forEach((pt, i) => {
        const t = segment.startTime + (i / Math.max(1, points.length - 1)) * segment.duration;
        xKeyframes.push({ time: t, value: pt.x, easeIn: 25, easeOut: 75 });
        yKeyframes.push({ time: t, value: pt.y, easeIn: 25, easeOut: 75 });

        // Estimate rotation from adjacent points
        if (i < points.length - 1) {
          const next = points[i + 1];
          const dx = next.x - pt.x;
          const dy = next.y - pt.y;
          const angle = Math.atan2(dy, dx) * (180 / Math.PI);
          rotationKeyframes.push({ time: t, value: angle + 45, easeIn: 33, easeOut: 67 });
        }
      });
    }
  }

  return {
    id: 'pen_layer',
    penType: settings.penType,
    position: {
      x: { name: 'x', keyframes: xKeyframes },
      y: { name: 'y', keyframes: yKeyframes },
    },
    rotation: { name: 'rotation', keyframes: rotationKeyframes },
    opacity: { name: 'opacity', keyframes: opacityKeyframes },
    scale: buildConstantProperty('scale', 100, totalDuration),
  };
}

// ─── Main Generator ───────────────────────────────────────────────────────────

export interface GeneratorOptions {
  font: any;
  settings: PluginSettings;
  compWidth?: number;
  compHeight?: number;
  frameRate?: number;
}

/**
 * Full pipeline: text → paths → strokes → AE composition data.
 */
export async function generateComposition(options: GeneratorOptions): Promise<CompositionData> {
  const {
    font,
    settings,
    compWidth = 1920,
    compHeight = 1080,
    frameRate = 30,
  } = options;

  const preset = STYLE_PRESETS[settings.style];
  const optimizedSpacing = optimizeSpacing(settings.text, preset.letterSpacingMultiplier);

  // 1. Convert text to word paths
  // Increase fontSize so the text fills the canvas better
  const fontSize = 280;
  const wordPaths = textToWordPaths(
    font,
    settings.text,
    fontSize,
    optimizedSpacing,
  );

  if (wordPaths.length === 0) {
    throw new Error('No text provided.');
  }

  // 2. Layout words (centered on comp)
  const wordSpacing = fontSize * 0.4;
  const totalTextWidth = wordPaths.reduce((sum, w) => sum + w.totalWidth, 0)
    + wordSpacing * (wordPaths.length - 1);

  let layoutX = (compWidth - totalTextWidth) / 2;
  const layoutY = compHeight / 2 + fontSize * 0.3;

  const allGlyphs = [];
  for (const word of wordPaths) {
    for (const glyph of word.glyphs) {
      // Translate glyph paths to the word's layout position.
      // (The glyph's internal X position within the word is already baked in by textToWordPaths)
      allGlyphs.push({
        ...glyph,
        commands: translateCommands(glyph.commands, layoutX, layoutY),
      });
    }
    // Advance layoutX by the entire word's width + the word spacing for the next word
    layoutX += word.totalWidth + wordSpacing;
  }

  // 3. Process strokes with timing
  // Scale the writing speed relative to the font size so it doesn't take forever to draw huge text!
  const speedScale = fontSize / 72;
  const pixelsPerSecond = (200 + settings.writingSpeed * 60) * speedScale;
  const allLetterStrokes = processWordStrokes(
    allGlyphs,
    preset,
    0,
    pixelsPerSecond,
    settings.randomizePenPressure,
  );

  // 4. Calculate total duration
  let totalDuration = 0;
  for (const letter of allLetterStrokes) {
    for (const seg of letter.segments) {
      const end = seg.startTime + seg.duration;
      if (end > totalDuration) totalDuration = end;
    }
  }
  totalDuration += 0.5; // trailing hold

  // 5. Build shape layers
  const shapeLayers: ShapeLayerData[] = [];
  let layerIndex = 0;

  for (const letter of allLetterStrokes) {
    for (const segment of letter.segments) {
      shapeLayers.push(
        buildShapeLayer(segment, settings, preset, totalDuration, layerIndex++),
      );
    }
  }

  // 6. Build pen layer
  const penLayer = settings.animateHand
    ? buildPenLayer(allLetterStrokes, settings, totalDuration)
    : undefined;

  // 7. Paper background color
  const bgColors: Record<string, string> = {
    none: 'transparent',
    white: '#ffffff',
    cream: '#f5f0e8',
    lined: '#f8f8ff',
    grid: '#f0f4f8',
    aged: '#e8dcc8',
    dark: '#1a1a2e',
  };

  const debugInfo = `Glyph 0 Cmd 0: ${allGlyphs[0]?.commands[0] ? JSON.stringify(allGlyphs[0].commands[0]) : 'none'} | Cmd 1: ${allGlyphs[0]?.commands[1] ? JSON.stringify(allGlyphs[0].commands[1]) : 'none'}`;

  return {
    name: `Handwriting_${settings.text.slice(0, 20).replace(/\s+/g, '_')}`,
    width: compWidth,
    height: compHeight,
    frameRate: 60,
    duration: totalDuration,
    backgroundColor: bgColors[settings.paperBackground] || '#ffffff',
    shapeLayers,
    penLayer,
    hasCamera: false,
  };
}

export async function generatePreviewSvg(options: GeneratorOptions): Promise<string> {
  // Use the animated SVG for the preview so users can see the handwriting animation in the panel!
  const animatedSvg = await generateAnimatedSvg(options);
  // Inject a unique timestamp comment at the end to force React dangerouslySetInnerHTML to remount and restart SMIL
  return animatedSvg + `\n<!-- timestamp: ${Date.now()} -->`;
}

import { estimatePathLength } from '../svg/textToPath';

/**
 * Generate a standalone SMIL animated SVG file containing the handwriting animation.
 * When animateHand is enabled, a detailed fountain pen cursor follows each stroke
 * in real time using SMIL animateMotion + mpath.
 */
export async function generateAnimatedSvg(options: GeneratorOptions): Promise<string> {
  const compData = await generateComposition(options);

  const svgWidth   = compData.width;
  const svgHeight  = compData.height;
  const totalDur   = compData.duration;
  const showPen    = options.settings.animateHand;

  const defsElements:   string[] = [];
  const pathElements:   string[] = [];
  const cursorElements: string[] = [];

  compData.shapeLayers.forEach((layer, i) => {
    if (layer.strokeColor === 'transparent') return; // skip pen lifts

    const pathId      = `sp${i}`;
    const maskId      = `mask${i}`;
    const startTime   = layer.trimPathEnd.keyframes[0].time;
    const duration    = Math.max(layer.trimPathEnd.keyframes[1].time - startTime, 0.01);
    const strokeWidth = layer.strokeWidth.keyframes[0]?.value ?? 3;
    const opacity     = (
      (layer.opacity.keyframes[1]?.value ?? layer.opacity.keyframes[0]?.value ?? 100) / 100
    );

    if (options.settings.filledText) {
      // ── Animated Mask (The Hack for Outline Fonts) ─────────────────────────
      const maskStrokeWidth = 30; 
      
      defsElements.push(
        `<mask id="${maskId}">` +
          `<path pathLength="1"` +
          ` style="stroke-dasharray:1;stroke-dashoffset:1;animation:drawStroke ${duration.toFixed(3)}s ease-in-out ${startTime.toFixed(3)}s both;"` +
          ` d="${layer.pathData}"` +
          ` fill="none" stroke="white" stroke-width="${maskStrokeWidth}" stroke-linecap="round" stroke-linejoin="round"/>` +
        `</mask>`
      );

      pathElements.push(
        `<path id="${pathId}"` +
        ` d="${layer.pathData}"` +
        ` fill="${layer.strokeColor}" stroke="${layer.strokeColor}"` +
        ` stroke-width="${strokeWidth.toFixed(2)}"` +
        ` stroke-linecap="${layer.lineCap || 'round'}"` +
        ` stroke-linejoin="${layer.lineJoin || 'round'}"` +
        ` opacity="${opacity.toFixed(2)}"` +
        ` mask="url(#${maskId})"/>`
      );
    } else {
      // ── True Single Line (Standard Path Tracing) ───────────────────────────
      pathElements.push(
        `<path id="${pathId}"` +
        ` style="stroke-dasharray:1;stroke-dashoffset:1;animation:drawStroke ${duration.toFixed(3)}s ease-in-out ${startTime.toFixed(3)}s both;"` +
        ` pathLength="1"` +
        ` d="${layer.pathData}"` +
        ` fill="none" stroke="${layer.strokeColor}"` +
        ` stroke-width="${strokeWidth.toFixed(2)}"` +
        ` stroke-linecap="${layer.lineCap || 'round'}"` +
        ` stroke-linejoin="${layer.lineJoin || 'round'}"` +
        ` opacity="${opacity.toFixed(2)}"/>`
      );
    }

    // ── Pen cursor for this stroke ────────────────────────────────────────────
    if (showPen) {
      const sf = Math.min(0.99998, startTime / totalDur).toFixed(5);
      const ef = Math.min(0.99999, (startTime + duration) / totalDur).toFixed(5);

      cursorElements.push(
        `<g opacity="0">` +
          `<use href="#pen-nib"/>` +
          `<animateMotion dur="${duration.toFixed(3)}s" begin="${startTime.toFixed(3)}s"` +
          ` rotate="auto" fill="freeze" repeatCount="1">` +
          `<mpath href="#${pathId}"/></animateMotion>` +
          `<animate attributeName="opacity"` +
          ` values="0;0;1;1;0;0"` +
          ` keyTimes="0;${sf};${sf};${ef};${ef};1"` +
          ` dur="${totalDur.toFixed(3)}s"` +
          ` calcMode="discrete" fill="freeze" repeatCount="1"/>` +
        `</g>`
      );
    }
  });

  // ── CSS keyframes ─────────────────────────────────────────────────────────
  const css = `<style>
    @keyframes drawStroke {
      from { stroke-dashoffset: 1; }
      to   { stroke-dashoffset: 0; }
    }
  </style>`;

  // ── Fountain pen SVG symbol ───────────────────────────────────────────────
  const penDefs = !showPen ? '' : `<defs>
  <linearGradient id="pg" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0%"   stop-color="#3c3c58"/>
    <stop offset="45%"  stop-color="#6060a0"/>
    <stop offset="100%" stop-color="#1e1e2e"/>
  </linearGradient>
  <linearGradient id="ng" x1="0" y1="0" x2="1" y2="0">
    <stop offset="0%"   stop-color="#9a6808"/>
    <stop offset="50%"  stop-color="#f0c040"/>
    <stop offset="100%" stop-color="#9a6808"/>
  </linearGradient>
  <filter id="ps" x="-30%" y="-30%" width="160%" height="160%">
    <feDropShadow dx="4" dy="5" stdDeviation="5" flood-color="#00000060"/>
  </filter>
  <g id="pen-nib">
    <g transform="rotate(-35)" filter="url(#ps)">
      <path d="M0,0 L-24,-8 L-24,8 Z" fill="url(#ng)" stroke="#8b6010" stroke-width="0.7"/>
      <line x1="0" y1="0" x2="-24" y2="0" stroke="#6a4808" stroke-width="1.2" stroke-dasharray="3,2"/>
      <circle cx="0" cy="0" r="3.5" fill="#040410"/>
      <rect x="-36" y="-10" width="12" height="20" rx="3" fill="#16162a" stroke="#2a2a40" stroke-width="0.8"/>
      <rect x="-84" y="-10" width="48" height="20" rx="4" fill="#0e0e1c" stroke="#2a2a40" stroke-width="0.8"/>
      <line x1="-44" y1="-10" x2="-44" y2="10" stroke="#2a2a3a" stroke-width="2.5"/>
      <line x1="-54" y1="-10" x2="-54" y2="10" stroke="#2a2a3a" stroke-width="2.5"/>
      <line x1="-64" y1="-10" x2="-64" y2="10" stroke="#2a2a3a" stroke-width="2.5"/>
      <line x1="-74" y1="-10" x2="-74" y2="10" stroke="#2a2a3a" stroke-width="2.5"/>
      <rect x="-92" y="-11" width="8" height="22" rx="2" fill="#c8a020" stroke="#9a7010" stroke-width="0.5"/>
      <rect x="-97" y="-10" width="4" height="20" rx="1" fill="#c8a020" stroke="#9a7010" stroke-width="0.4"/>
      <rect x="-215" y="-10" width="118" height="20" rx="5" fill="url(#pg)" stroke="#2a2a40" stroke-width="0.8"/>
      <rect x="-210" y="-8"  width="108" height="4"  rx="2" fill="white" opacity="0.13"/>
      <rect x="-168" y="-10" width="18"  height="20" rx="0" fill="none" stroke="#3a3a55" stroke-width="0.5"/>
      <ellipse cx="-215" cy="0" rx="11" ry="10" fill="#12121e" stroke="#2a2a40" stroke-width="0.8"/>
    </g>
  </g>
</defs>`;

  return [
    `<svg xmlns="http://www.w3.org/2000/svg"`,
    ` viewBox="0 0 ${svgWidth} ${svgHeight}"`,
    ` width="100%" height="100%"`,
    ` style="background-color:${compData.backgroundColor};border-radius:4px;">`,
    penDefs,
    css,
    ...defsElements, // Add our generated masks here!
    `<g id="strokes">`,
    ...pathElements,
    `</g>`,
    showPen ? `<g id="pen-layer">${cursorElements.join('')}</g>` : '',
    `</svg>`,
  ].join('\n');
}
