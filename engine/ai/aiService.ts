import type { PluginSettings, HandwritingStyle, PenType, PaperBackground } from '../../shared/types';

/**
 * AI Service (Mocked)
 * Simulates a response from an LLM by parsing prompt keywords and mapping
 * them to intelligent preset overrides for the handwriting engine.
 */
export async function generateStyleFromPrompt(prompt: string): Promise<Partial<PluginSettings>> {
  // Simulate network delay
  await new Promise((res) => setTimeout(res, 1200));

  const lower = prompt.toLowerCase();
  const settings: Partial<PluginSettings> = {};

  // 1. Analyze for speed/style
  if (lower.includes('doctor') || lower.includes('fast') || lower.includes('messy')) {
    settings.style = 'fast-notes';
    settings.writingSpeed = 9;
    settings.randomizePenPressure = true;
    settings.naturalPauses = false;
  } else if (lower.includes('elegant') || lower.includes('calligraphy') || lower.includes('fancy')) {
    settings.style = 'calligraphy';
    settings.writingSpeed = 3;
    settings.smoothCurves = true;
    settings.randomizePenPressure = true;
    settings.fontFamily = 'PlaywriteID-Regular';
  } else if (lower.includes('school') || lower.includes('print') || lower.includes('clean')) {
    settings.style = 'school';
    settings.writingSpeed = 5;
    settings.fontFamily = 'PlaywriteID-Light';
  } else if (lower.includes('signature')) {
    settings.style = 'signature';
    settings.writingSpeed = 7;
    settings.fontFamily = 'PlaywriteID-Thin';
  } else if (lower.includes('sacramento')) {
    settings.fontFamily = 'Sacramento-Regular';
    settings.style = 'casual';
  } else if (lower.includes('dancing') || lower.includes('dance')) {
    settings.fontFamily = 'DancingScript-Regular';
    settings.style = 'casual';
  }

  // 2. Analyze for pen type
  if (lower.includes('marker') || lower.includes('thick')) {
    settings.penType = 'marker';
    settings.strokeWidth = 6;
  } else if (lower.includes('pencil') || lower.includes('sketch')) {
    settings.penType = 'pencil';
    settings.strokeWidth = 2;
  } else if (lower.includes('brush')) {
    settings.penType = 'brush';
    settings.strokeWidth = 5;
  }

  // 3. Analyze for paper
  if (lower.includes('old') || lower.includes('aged') || lower.includes('vintage')) {
    settings.paperBackground = 'aged';
    settings.inkColor = '#3a2d21';
  } else if (lower.includes('blueprint') || lower.includes('grid')) {
    settings.paperBackground = 'grid';
    settings.inkColor = '#1f3c88';
  } else if (lower.includes('dark')) {
    settings.paperBackground = 'dark';
    settings.inkColor = '#e0e0e0';
  }

  // 4. Color detection
  const colors: Record<string, string> = {
    red: '#d32f2f',
    blue: '#1976d2',
    green: '#388e3c',
    purple: '#7b1fa2',
    gold: '#fbc02d',
    black: '#000000',
  };
  for (const [key, val] of Object.entries(colors)) {
    if (lower.includes(key)) {
      settings.inkColor = val;
      break;
    }
  }

  return settings;
}

/**
 * Dynamically analyzes word overlapping (simulated) and adjusts letter spacing.
 */
export function optimizeSpacing(text: string, baseMultiplier: number): number {
  let overlapFactor = 0;
  
  // Example heuristic: lots of overlapping cursive letters (e.g., 'f', 'l', 'g', 'j') 
  // might need more space.
  const tightLetters = ['f', 'l', 'j', 'g', 'y', 'p'];
  for (const char of text) {
    if (tightLetters.includes(char.toLowerCase())) {
      overlapFactor += 0.05;
    }
  }

  // Limit expansion to +0.3
  return baseMultiplier + Math.min(overlapFactor, 0.3);
}
