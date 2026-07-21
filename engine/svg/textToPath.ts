/**
 * TextToPath Engine
 * Converts text strings into vector paths using OpenType.js
 * Handles glyph extraction, advance widths, and bounding boxes.
 */

import type { GlyphPath, PathCommand, Point, WordPaths } from '../../shared/types';

// OpenType is loaded dynamically to support both browser and Node environments
// In browser context, opentype is bundled; in CEP/Node it can be required directly
declare const opentype: any;

// ─── Font Cache ───────────────────────────────────────────────────────────────

const fontCache = new Map<string, any>();

export async function loadFont(fontUrl: string): Promise<any> {
  if (fontCache.has(fontUrl)) return fontCache.get(fontUrl)!;

  return new Promise((resolve, reject) => {
    const loadWithOt = async (ot: any) => {
      try {
        const response = await fetch(fontUrl);
        if (!response.ok) throw new Error(`Failed to fetch font: ${response.statusText}`);
        const buffer = await response.arrayBuffer();
        const font = ot.parse(buffer);
        fontCache.set(fontUrl, font);
        resolve(font);
      } catch (err) {
        reject(err);
      }
    };

    if (typeof opentype !== 'undefined') {
      loadWithOt(opentype);
    } else {
      // Fallback: dynamic import for bundled environments
      import('opentype.js')
        .then((otModule) => loadWithOt(otModule.default || otModule))
        .catch(reject);
    }
  });
}

// ─── Path Command Parsing ─────────────────────────────────────────────────────

/**
 * Convert an OpenType.js Path object into our normalized PathCommand array.
 */
export function parseOpenTypePath(otPath: any): PathCommand[] {
  const commands: PathCommand[] = [];

  for (const cmd of otPath.commands) {
    switch (cmd.type) {
      case 'M':
        commands.push({ type: 'M', x: cmd.x, y: cmd.y });
        break;
      case 'L':
        commands.push({ type: 'L', x: cmd.x, y: cmd.y });
        break;
      case 'C':
        commands.push({
          type: 'C',
          x1: cmd.x1, y1: cmd.y1,
          x2: cmd.x2, y2: cmd.y2,
          x: cmd.x, y: cmd.y,
        });
        break;
      case 'Q':
        commands.push({
          type: 'Q',
          x1: cmd.x1, y1: cmd.y1,
          x: cmd.x, y: cmd.y,
        });
        break;
      case 'Z':
        commands.push({ type: 'Z' });
        break;
    }
  }

  return commands;
}

// ─── Glyph Extraction ─────────────────────────────────────────────────────────

/**
 * Extract a GlyphPath for a single character from the loaded font.
 * fontSize defaults to 72 for a normalized unit system;
 * scaling is applied later during animation layer construction.
 */
export function extractGlyphPath(
  font: any,
  charOrGlyph: string | any,
  fontSize: number = 72,
  x: number = 0,
  y: number = 0,
): GlyphPath {
  const glyph = typeof charOrGlyph === 'string' ? font.charToGlyph(charOrGlyph) : charOrGlyph;
  const path = glyph.getPath(x, y, fontSize);
  const bbox = glyph.getBoundingBox();
  const scale = fontSize / font.unitsPerEm;

  return {
    char: typeof charOrGlyph === 'string' ? charOrGlyph : (glyph.name || ''),
    commands: parseOpenTypePath(path),
    advanceWidth: (glyph.advanceWidth ?? 0) * scale,
    boundingBox: {
      x1: (bbox.x1 ?? 0) * scale,
      y1: (bbox.y1 ?? 0) * scale,
      x2: (bbox.x2 ?? 0) * scale,
      y2: (bbox.y2 ?? 0) * scale,
    },
  };
}

// ─── Text to Word Paths ───────────────────────────────────────────────────────

/**
 * Convert an entire string into WordPaths.
 * Splits on spaces; each word is an array of per-character GlyphPaths.
 */
export function textToWordPaths(
  font: any,
  text: string,
  fontSize: number = 72,
  letterSpacingMultiplier: number = 1.0,
): WordPaths[] {
  const words = text.split(' ').filter(Boolean);
  const result: WordPaths[] = [];
  const scale = fontSize / font.unitsPerEm;

  for (const word of words) {
    const glyphs: GlyphPath[] = [];
    let cursorX = 0;
    let previousGlyph = null;

    // Use stringToGlyphs to properly evaluate GSUB (ligatures, contextual alternates)
    const shapedGlyphs = font.stringToGlyphs(word);

    for (const glyph of shapedGlyphs) {
      // Apply proper GPOS kerning between adjacent shaped glyphs
      if (previousGlyph) {
        const kerning = font.getKerningValue(previousGlyph, glyph);
        cursorX += kerning * scale;
      }

      const glyphPath = extractGlyphPath(font, glyph, fontSize, cursorX, 0);
      glyphs.push(glyphPath);
      
      cursorX += glyphPath.advanceWidth * letterSpacingMultiplier;
      previousGlyph = glyph;
    }

    result.push({
      word,
      glyphs,
      totalWidth: cursorX,
    });
  }

  return result;
}

// ─── Path Utilities ───────────────────────────────────────────────────────────

/**
 * Serialize PathCommand[] into an SVG path string.
 */
export function commandsToSvgPath(commands: PathCommand[]): string {
  return commands.map((cmd) => {
    switch (cmd.type) {
      case 'M': return `M ${cmd.x.toFixed(3)} ${cmd.y.toFixed(3)}`;
      case 'L': return `L ${cmd.x.toFixed(3)} ${cmd.y.toFixed(3)}`;
      case 'C': return `C ${cmd.x1.toFixed(3)} ${cmd.y1.toFixed(3)} ${cmd.x2.toFixed(3)} ${cmd.y2.toFixed(3)} ${cmd.x.toFixed(3)} ${cmd.y.toFixed(3)}`;
      case 'Q': return `Q ${cmd.x1.toFixed(3)} ${cmd.y1.toFixed(3)} ${cmd.x.toFixed(3)} ${cmd.y.toFixed(3)}`;
      case 'Z': return 'Z';
    }
  }).join(' ');
}

/**
 * Sample points along a path at a given resolution.
 * Used for pen position animation.
 */
export function samplePathPoints(commands: PathCommand[], resolution: number = 100): Point[] {
  const points: Point[] = [];
  let currentX = 0;
  let currentY = 0;

  for (const cmd of commands) {
    if (cmd.type === 'M') {
      currentX = cmd.x;
      currentY = cmd.y;
      points.push({ x: currentX, y: currentY });
    } else if (cmd.type === 'L') {
      points.push({ x: cmd.x, y: cmd.y });
      currentX = cmd.x;
      currentY = cmd.y;
    } else if (cmd.type === 'C') {
      // Sample cubic bezier
      const samples = sampleCubicBezier(
        { x: currentX, y: currentY },
        { x: cmd.x1, y: cmd.y1 },
        { x: cmd.x2, y: cmd.y2 },
        { x: cmd.x, y: cmd.y },
        resolution,
      );
      points.push(...samples);
      currentX = cmd.x;
      currentY = cmd.y;
    } else if (cmd.type === 'Q') {
      const samples = sampleQuadraticBezier(
        { x: currentX, y: currentY },
        { x: cmd.x1, y: cmd.y1 },
        { x: cmd.x, y: cmd.y },
        resolution,
      );
      points.push(...samples);
      currentX = cmd.x;
      currentY = cmd.y;
    }
  }

  return points;
}

function sampleCubicBezier(p0: Point, p1: Point, p2: Point, p3: Point, steps: number): Point[] {
  const pts: Point[] = [];
  for (let i = 1; i <= steps; i++) {
    const t = i / steps;
    const mt = 1 - t;
    pts.push({
      x: mt ** 3 * p0.x + 3 * mt ** 2 * t * p1.x + 3 * mt * t ** 2 * p2.x + t ** 3 * p3.x,
      y: mt ** 3 * p0.y + 3 * mt ** 2 * t * p1.y + 3 * mt * t ** 2 * p2.y + t ** 3 * p3.y,
    });
  }
  return pts;
}

function sampleQuadraticBezier(p0: Point, p1: Point, p2: Point, steps: number): Point[] {
  const pts: Point[] = [];
  for (let i = 1; i <= steps; i++) {
    const t = i / steps;
    const mt = 1 - t;
    pts.push({
      x: mt ** 2 * p0.x + 2 * mt * t * p1.x + t ** 2 * p2.x,
      y: mt ** 2 * p0.y + 2 * mt * t * p1.y + t ** 2 * p2.y,
    });
  }
  return pts;
}

/**
 * Estimate path length for timing calculations.
 */
export function estimatePathLength(commands: PathCommand[]): number {
  const points = samplePathPoints(commands, 50);
  let length = 0;
  for (let i = 1; i < points.length; i++) {
    const dx = points[i].x - points[i - 1].x;
    const dy = points[i].y - points[i - 1].y;
    length += Math.sqrt(dx * dx + dy * dy);
  }
  return length;
}

/**
 * Translate all path commands by (dx, dy).
 */
export function translateCommands(commands: PathCommand[], dx: number, dy: number): PathCommand[] {
  return commands.map((cmd) => {
    switch (cmd.type) {
      case 'M': return { ...cmd, x: cmd.x + dx, y: cmd.y + dy };
      case 'L': return { ...cmd, x: cmd.x + dx, y: cmd.y + dy };
      case 'C': return { ...cmd, x1: cmd.x1 + dx, y1: cmd.y1 + dy, x2: cmd.x2 + dx, y2: cmd.y2 + dy, x: cmd.x + dx, y: cmd.y + dy };
      case 'Q': return { ...cmd, x1: cmd.x1 + dx, y1: cmd.y1 + dy, x: cmd.x + dx, y: cmd.y + dy };
      case 'Z': return cmd;
    }
  });
}