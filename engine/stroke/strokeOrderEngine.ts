/**
 * StrokeOrderEngine
 * Decomposes glyph paths into individual strokes in the correct writing order.
 * Handles contour splitting, sub-path ordering, and cursive joining.
 */

import type {
  GlyphPath,
  LetterStrokes,
  PathCommand,
  Point,
  StrokeSegment,
  StylePreset,
} from '../../shared/types';
import { estimatePathLength, samplePathPoints, translateCommands } from '../svg/textToPath';

// ─── Helpers ──────────────────────────────────────────────────────────────────

let segmentIdCounter = 0;
function nextId(): string {
  return `seg_${++segmentIdCounter}`;
}

/**
 * Split a flat PathCommand[] into sub-paths (each starting with M).
 */
function splitIntoSubPaths(commands: PathCommand[]): PathCommand[][] {
  const subPaths: PathCommand[][] = [];
  let current: PathCommand[] = [];

  for (const cmd of commands) {
    if (cmd.type === 'M' && current.length > 0) {
      subPaths.push(current);
      current = [];
    }
    current.push(cmd);
  }

  if (current.length > 0) subPaths.push(current);
  return subPaths;
}

/**
 * Get the start point of a sub-path (the M command).
 */
function getSubPathStart(subPath: PathCommand[]): Point {
  const first = subPath[0];
  if (first.type === 'M') return { x: first.x, y: first.y };
  return { x: 0, y: 0 };
}

/**
 * Get the end point of a sub-path.
 */
function getSubPathEnd(subPath: PathCommand[]): Point {
  for (let i = subPath.length - 1; i >= 0; i--) {
    const cmd = subPath[i];
    if (cmd.type === 'M' || cmd.type === 'L' || cmd.type === 'C' || cmd.type === 'Q') {
      return { x: cmd.x, y: cmd.y };
    }
  }
  return { x: 0, y: 0 };
}

/**
 * Estimate the top-left "start" of a sub-path (for ordering heuristics).
 */
function getSubPathBounds(subPath: PathCommand[]): { minX: number; minY: number; maxX: number; maxY: number } {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  const points = samplePathPoints(subPath, 20);
  for (const p of points) {
    if (p.x < minX) minX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.x > maxX) maxX = p.x;
    if (p.y > maxY) maxY = p.y;
  }
  return { minX, minY, maxX, maxY };
}

// ─── Stroke Ordering ──────────────────────────────────────────────────────────

/**
 * Order sub-paths in a natural handwriting sequence:
 * - Main body strokes (larger) before diacritics (smaller, like dots on i/j)
 * - Left-to-right, top-to-bottom within similar sizes
 */
function orderSubPaths(subPaths: PathCommand[][]): PathCommand[][] {
  const withMeta = subPaths.map((sp) => {
    const bounds = getSubPathBounds(sp);
    const width = bounds.maxX - bounds.minX;
    const height = bounds.maxY - bounds.minY;
    const area = width * height;
    return { sp, area, bounds };
  });

  // Sort: larger area first (body strokes), then top-to-bottom, left-to-right
  withMeta.sort((a, b) => {
    // If one is much smaller (< 15% area of largest), it's a diacritic — goes last
    const maxArea = Math.max(...withMeta.map((m) => m.area));
    const aIsDiacritic = a.area < maxArea * 0.15;
    const bIsDiacritic = b.area < maxArea * 0.15;

    if (aIsDiacritic !== bIsDiacritic) return aIsDiacritic ? 1 : -1;

    // Within same category: top-to-bottom, left-to-right
    const yDiff = a.bounds.minY - b.bounds.minY;
    if (Math.abs(yDiff) > 5) return yDiff;
    return a.bounds.minX - b.bounds.minX;
  });

  return withMeta.map((m) => m.sp);
}

// ─── Pressure Profile ─────────────────────────────────────────────────────────

/**
 * Generate a natural pressure profile along a stroke.
 * Pressure starts low, peaks in the middle, tapers at end.
 * With variation noise based on style preset.
 */
function generatePressureProfile(
  pointCount: number,
  preset: StylePreset,
  jitter: boolean = true,
): number[] {
  const profile: number[] = [];

  for (let i = 0; i < pointCount; i++) {
    const t = i / Math.max(1, pointCount - 1);
    // Base bell curve
    const base = Math.sin(t * Math.PI) * 0.6 + 0.4;
    // Add variation
    const noise = jitter
      ? (Math.random() - 0.5) * preset.pressureVariation * 0.3
      : 0;
    profile.push(Math.max(0.1, Math.min(1, base + noise)));
  }

  return profile;
}

/**
 * Generate a natural speed profile. Slow at start/end, faster in middle.
 * Fast-notes style is uniformly fast.
 */
function generateSpeedProfile(pointCount: number, preset: StylePreset): number[] {
  return Array.from({ length: pointCount }, (_, i) => {
    const t = i / Math.max(1, pointCount - 1);
    const base = Math.sin(t * Math.PI) * 0.5 + 0.5;
    return base * preset.speedMultiplier;
  });
}

// ─── Lift / Connect Detection ─────────────────────────────────────────────────

/**
 * For cursive fonts, decide if we should inject a connecting stroke
 * between the end of one sub-path and the start of the next.
 */
function shouldAddJoinStroke(
  prevEnd: Point,
  nextStart: Point,
  threshold: number = 15,
): boolean {
  const dx = nextStart.x - prevEnd.x;
  const dy = nextStart.y - prevEnd.y;
  const dist = Math.sqrt(dx * dx + dy * dy);
  return dist > threshold;
}

/**
 * Build a smooth connecting lift stroke (pen up-and-down arc).
 */
function buildLiftStroke(from: Point, to: Point, liftHeight: number = 20): PathCommand[] {
  const midX = (from.x + to.x) / 2;
  const midY = Math.min(from.y, to.y) - liftHeight;

  return [
    { type: 'M', x: from.x, y: from.y },
    {
      type: 'C',
      x1: from.x,
      y1: from.y - liftHeight / 2,
      x2: midX,
      y2: midY,
      x: midX,
      y: midY,
    },
    {
      type: 'C',
      x1: midX,
      y1: midY,
      x2: to.x,
      y2: to.y - liftHeight / 2,
      x: to.x,
      y: to.y,
    },
  ];
}

// ─── Main API ─────────────────────────────────────────────────────────────────

/**
 * Decompose a GlyphPath into ordered LetterStrokes with timing and dynamics.
 *
 * @param glyph - The extracted glyph path
 * @param preset - Style preset controlling speed, jitter, etc.
 * @param globalTimeOffset - Seconds from start of animation when this letter begins
 * @param pixelsPerSecond - How fast the pen moves (affects per-stroke timing)
 * @param randomizePressure - Whether to randomize pressure along strokes
 */
export function decomposeGlyph(
  glyph: GlyphPath,
  preset: StylePreset,
  globalTimeOffset: number,
  pixelsPerSecond: number = 300,
  randomizePressure: boolean = true,
): LetterStrokes {
  const subPaths = splitIntoSubPaths(glyph.commands);
  const orderedSubPaths = orderSubPaths(subPaths);
  const segments: StrokeSegment[] = [];

  let localTime = globalTimeOffset;
  let prevEnd: Point | null = null;

  for (let i = 0; i < orderedSubPaths.length; i++) {
    const subPath = orderedSubPaths[i];
    const start = getSubPathStart(subPath);
    const end = getSubPathEnd(subPath);

    // Pen lift between sub-paths
    if (prevEnd && shouldAddJoinStroke(prevEnd, start)) {
      const liftCommands = buildLiftStroke(prevEnd, start);
      const liftPoints = samplePathPoints(liftCommands, 10);
      const liftLength = estimatePathLength(liftCommands);
      const liftDuration = (liftLength / pixelsPerSecond) * 0.4; // Lifts are faster

      segments.push({
        id: nextId(),
        commands: liftCommands,
        duration: Math.max(0.02, liftDuration),
        startTime: localTime,
        pressure: Array(liftPoints.length).fill(0),
        speed: Array(liftPoints.length).fill(preset.speedMultiplier * 1.5),
        isLift: true,
      });

      localTime += liftDuration;
    }

    // Natural pause before stroke (if style calls for it)
    if (preset.pauseFrequency > 0 && Math.random() < preset.pauseFrequency && i > 0) {
      localTime += 0.05 + Math.random() * 0.1;
    }

    // Main stroke
    const strokePoints = samplePathPoints(subPath, 30);
    const strokeLength = estimatePathLength(subPath);
    const strokeDuration = Math.max(0.05, strokeLength / pixelsPerSecond / preset.speedMultiplier);

    segments.push({
      id: nextId(),
      commands: subPath,
      duration: strokeDuration,
      startTime: localTime,
      pressure: generatePressureProfile(strokePoints.length, preset, randomizePressure),
      speed: generateSpeedProfile(strokePoints.length, preset),
      isLift: false,
    });

    localTime += strokeDuration;
    prevEnd = end;
  }

  // Determine if this letter connects to the next (cursive join)
  const lastCmd = glyph.commands[glyph.commands.length - 1];
  let joinPoint: Point | undefined;
  if (lastCmd && (lastCmd.type === 'L' || lastCmd.type === 'C' || lastCmd.type === 'Q' || lastCmd.type === 'M')) {
    joinPoint = { x: lastCmd.x, y: lastCmd.y };
  }

  return {
    char: glyph.char,
    segments,
    connectsToNext: preset.curveSmoothing > 0.7 && !!joinPoint,
    joinPoint,
  };
}

/**
 * Process an array of GlyphPaths into LetterStrokes for animation.
 * Returns strokes with correct cumulative timing and optional word spacing pauses.
 */
export function processWordStrokes(
  glyphs: GlyphPath[],
  preset: StylePreset,
  startTime: number = 0,
  pixelsPerSecond: number = 300,
  randomizePressure: boolean = true,
): LetterStrokes[] {
  const result: LetterStrokes[] = [];
  let currentTime = startTime;

  for (const glyph of glyphs) {
    if (glyph.char === ' ') {
      // Space: just add a pause
      currentTime += 0.1 + Math.random() * 0.05;
      continue;
    }

    const letterStrokes = decomposeGlyph(
      glyph,
      preset,
      currentTime,
      pixelsPerSecond,
      randomizePressure,
    );

    result.push(letterStrokes);

    // Advance time past this letter's last segment
    const lastSeg = letterStrokes.segments[letterStrokes.segments.length - 1];
    if (lastSeg) {
      currentTime = lastSeg.startTime + lastSeg.duration;
    }

    // Small inter-letter pause
    if (preset.pauseFrequency > 0.05) {
      currentTime += 0.02 + Math.random() * 0.03 * preset.pauseFrequency;
    }
  }

  return result;
}

/**
 * Add jitter (micro hand tremor) to path commands.
 * Applied as tiny random offsets to each coordinate.
 */
export function applyJitter(
  commands: PathCommand[],
  jitterAmount: number,
): PathCommand[] {
  if (jitterAmount <= 0) return commands;

  const jitter = () => (Math.random() - 0.5) * jitterAmount * 2;

  return commands.map((cmd) => {
    switch (cmd.type) {
      case 'M': return { ...cmd, x: cmd.x + jitter(), y: cmd.y + jitter() };
      case 'L': return { ...cmd, x: cmd.x + jitter(), y: cmd.y + jitter() };
      case 'C': return {
        ...cmd,
        x1: cmd.x1 + jitter(), y1: cmd.y1 + jitter(),
        x2: cmd.x2 + jitter(), y2: cmd.y2 + jitter(),
        x: cmd.x + jitter(), y: cmd.y + jitter(),
      };
      case 'Q': return {
        ...cmd,
        x1: cmd.x1 + jitter(), y1: cmd.y1 + jitter(),
        x: cmd.x + jitter(), y: cmd.y + jitter(),
      };
      default: return cmd;
    }
  });
}