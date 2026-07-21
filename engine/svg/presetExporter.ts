/**
 * PresetExporter
 * Serializes plugin settings and composition data to various export formats:
 * - JSON preset (for sharing/reuse)
 * - SVG animation (CSS-animated)
 * - MOGRT manifest stub
 */

import type { CompositionData, PluginSettings } from '../../shared/types';
import { commandsToSvgPath } from './textToPath';

// ─── JSON Preset ──────────────────────────────────────────────────────────────

export interface JsonPreset {
  version: string;
  name: string;
  createdAt: string;
  settings: PluginSettings;
  stats?: {
    layerCount: number;
    duration: number;
  };
}

export function exportJsonPreset(settings: PluginSettings, name: string, comp?: CompositionData): JsonPreset {
  return {
    version: '1.0.0',
    name,
    createdAt: new Date().toISOString(),
    settings,
    stats: comp
      ? { layerCount: comp.shapeLayers.length, duration: comp.duration }
      : undefined,
  };
}

export function downloadJsonPreset(preset: JsonPreset): void {
  const blob = new Blob([JSON.stringify(preset, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${preset.name.replace(/\s+/g, '_')}_preset.json`;
  a.click();
  URL.revokeObjectURL(url);
}

// ─── SVG Animation Export ─────────────────────────────────────────────────────

/**
 * Generate a self-contained SVG with CSS animations that approximate
 * the trim-path effect in browser. Not as accurate as AE but useful
 * for web embeds.
 */
export function exportSvgAnimation(comp: CompositionData): string {
  const { width, height, duration, shapeLayers, backgroundColor } = comp;

  const pathElements = shapeLayers
    .filter((l) => !l.name.startsWith('Lift'))
    .map((layer) => {
      const trimEnd = layer.trimPathEnd.keyframes;
      const delay = trimEnd.length > 0 ? trimEnd[0].time : 0;
      const animDuration = trimEnd.length > 1
        ? trimEnd[trimEnd.length - 1].time - delay
        : 0.5;

      // Estimate path length for stroke-dasharray trick
      const pathLen = 5000; // over-estimate; browser recalculates

      return `  <path
    d="${layer.pathData}"
    fill="none"
    stroke="${layer.strokeColor}"
    stroke-width="${layer.strokeWidth.keyframes[0]?.value ?? 3}"
    stroke-linecap="round"
    stroke-linejoin="round"
    stroke-dasharray="${pathLen}"
    stroke-dashoffset="${pathLen}"
    style="animation: draw_${layer.id} ${animDuration.toFixed(3)}s ease-in-out ${delay.toFixed(3)}s forwards"
  />`;
    }).join('\n');

  const keyframeBlocks = shapeLayers
    .filter((l) => !l.name.startsWith('Lift'))
    .map((layer) => `
  @keyframes draw_${layer.id} {
    to { stroke-dashoffset: 0; }
  }`).join('\n');

  return `<svg
  xmlns="http://www.w3.org/2000/svg"
  viewBox="0 0 ${width} ${height}"
  width="${width}" height="${height}"
>
  <style>
${keyframeBlocks}
  </style>
  <rect width="100%" height="100%" fill="${backgroundColor}"/>
${pathElements}
</svg>`;
}

export function downloadSvgAnimation(comp: CompositionData, name: string): void {
  const svg = exportSvgAnimation(comp);
  const blob = new Blob([svg], { type: 'image/svg+xml' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${name.replace(/\s+/g, '_')}_animation.svg`;
  a.click();
  URL.revokeObjectURL(url);
}

// ─── MOGRT Stub ───────────────────────────────────────────────────────────────

/**
 * Generate a minimal MOGRT manifest JSON.
 * A real MOGRT requires AE to package via File > Export > Motion Graphics Template.
 * This stub provides the metadata structure for future tooling integration.
 */
export function generateMogrtManifest(comp: CompositionData, settings: PluginSettings): object {
  return {
    mogrtVersion: '1',
    name: comp.name,
    description: `Handwriting animation: "${settings.text}"`,
    author: 'Handwriting Animation Plugin',
    parameters: [
      { name: 'Text', type: 'string', defaultValue: settings.text },
      { name: 'Ink Color', type: 'color', defaultValue: settings.inkColor },
      { name: 'Writing Speed', type: 'number', min: 1, max: 10, defaultValue: settings.writingSpeed },
    ],
    composition: {
      name: comp.name,
      width: comp.width,
      height: comp.height,
      frameRate: comp.frameRate,
      duration: comp.duration,
    },
  };
}