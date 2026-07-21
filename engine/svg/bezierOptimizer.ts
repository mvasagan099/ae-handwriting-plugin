/**
 * BezierOptimizer
 * Post-processes PathCommands to produce smoother, more natural curves.
 * Implements the Ramer–Douglas–Peucker algorithm for simplification
 * and a Catmull-Rom → Bezier conversion for organic curves.
 */

import type { PathCommand, Point } from '../../shared/types';
import { samplePathPoints } from './textToPath';

// ─── Ramer–Douglas–Peucker ────────────────────────────────────────────────────

function perpendicularDistance(point: Point, lineStart: Point, lineEnd: Point): number {
  const dx = lineEnd.x - lineStart.x;
  const dy = lineEnd.y - lineStart.y;
  const mag = Math.sqrt(dx * dx + dy * dy);
  if (mag === 0) return Math.sqrt((point.x - lineStart.x) ** 2 + (point.y - lineStart.y) ** 2);

  return Math.abs(dy * point.x - dx * point.y + lineEnd.x * lineStart.y - lineEnd.y * lineStart.x) / mag;
}

function rdp(points: Point[], epsilon: number): Point[] {
  if (points.length < 3) return points;

  let maxDist = 0;
  let maxIdx = 0;
  const end = points.length - 1;

  for (let i = 1; i < end; i++) {
    const d = perpendicularDistance(points[i], points[0], points[end]);
    if (d > maxDist) { maxDist = d; maxIdx = i; }
  }

  if (maxDist > epsilon) {
    const left = rdp(points.slice(0, maxIdx + 1), epsilon);
    const right = rdp(points.slice(maxIdx), epsilon);
    return [...left.slice(0, -1), ...right];
  }

  return [points[0], points[end]];
}

// ─── Catmull-Rom → Cubic Bezier ───────────────────────────────────────────────

/**
 * Convert a sequence of points to smooth cubic bezier commands
 * using Catmull-Rom spline interpolation.
 */
export function pointsToCubicBezier(points: Point[], tension: number = 0.5): PathCommand[] {
  if (points.length < 2) return [];

  const cmds: PathCommand[] = [{ type: 'M', x: points[0].x, y: points[0].y }];

  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[Math.max(0, i - 1)];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[Math.min(points.length - 1, i + 2)];

    const cp1x = p1.x + (p2.x - p0.x) * tension / 3;
    const cp1y = p1.y + (p2.y - p0.y) * tension / 3;
    const cp2x = p2.x - (p3.x - p1.x) * tension / 3;
    const cp2y = p2.y - (p3.y - p1.y) * tension / 3;

    cmds.push({
      type: 'C',
      x1: cp1x, y1: cp1y,
      x2: cp2x, y2: cp2y,
      x: p2.x,  y: p2.y,
    });
  }

  return cmds;
}

// ─── Main Optimizer ───────────────────────────────────────────────────────────

/**
 * Simplify and smooth a PathCommand[] using RDP + Catmull-Rom.
 *
 * @param commands - Input path commands
 * @param simplifyEpsilon - RDP threshold (higher = more simplification)
 * @param smoothTension - Catmull-Rom tension (0–1, higher = tighter curves)
 */
export function optimizePath(
  commands: PathCommand[],
  simplifyEpsilon: number = 1.5,
  smoothTension: number = 0.4,
): PathCommand[] {
  // 1. Sample the path into points
  const sampled = samplePathPoints(commands, 60);
  if (sampled.length < 2) return commands;

  // 2. Simplify with RDP
  const simplified = rdp(sampled, simplifyEpsilon);
  if (simplified.length < 2) return commands;

  // 3. Re-interpolate as Catmull-Rom cubic beziers
  return pointsToCubicBezier(simplified, smoothTension);
}

/**
 * Apply smoothing to all non-lift segments in a stroke array.
 * Preserves Z commands (closed paths) and lift strokes.
 */
export function smoothStrokes(
  commandGroups: PathCommand[][],
  tension: number = 0.4,
): PathCommand[][] {
  return commandGroups.map((commands) => {
    const hasZ = commands.some((c) => c.type === 'Z');
    const optimized = optimizePath(commands, 1.5, tension);
    if (hasZ) optimized.push({ type: 'Z' });
    return optimized;
  });
}