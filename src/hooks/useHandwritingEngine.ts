/**
 * useHandwritingEngine
 * Central React hook managing plugin state, font loading,
 * preview generation, and animation export to After Effects.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import type { EngineResult, PluginSettings } from '../../shared/types';
import { defaultSettings } from '../../shared/types';
import { generateComposition, generatePreviewSvg, generateAnimatedSvg } from '../../engine/animation/animationGenerator';
import { loadFont } from '../../engine/svg/textToPath';
import { sendCompositionToAE } from '../utils/cepBridge';
import { generateStyleFromPrompt } from '../../engine/ai/aiService';

// ─── Available Fonts ──────────────────────────────────────────────────────────

export interface FontOption {
  id: string;
  label: string;
  url: string;
  style: 'cursive' | 'print' | 'calligraphy';
  group?: string;
}

export const AVAILABLE_FONTS: FontOption[] = [
  {
    id: 'BlackOpsOne',
    label: 'Black Ops One',
    url: 'assets/fonts/BlackOpsOne-Regular.ttf',
    style: 'print',
    group: 'Double Line Fonts',
  },
  {
    id: 'PlaywriteID-Thin',
    label: 'Playwrite ID (Thin)',
    url: 'assets/fonts/PlaywriteID-Thin.ttf',
    style: 'cursive',
    group: 'Double Line Fonts',
  },
  {
    id: 'PlaywriteID-ExtraLight',
    label: 'Playwrite ID (Extra Light)',
    url: 'assets/fonts/PlaywriteID-ExtraLight.ttf',
    style: 'cursive',
    group: 'Double Line Fonts',
  },
  {
    id: 'PlaywriteID-Light',
    label: 'Playwrite ID (Light)',
    url: 'assets/fonts/PlaywriteID-Light.ttf',
    style: 'cursive',
    group: 'Double Line Fonts',
  },
  {
    id: 'PlaywriteID-Regular',
    label: 'Playwrite ID (Regular)',
    url: 'assets/fonts/PlaywriteID-Regular.ttf',
    style: 'cursive',
    group: 'Double Line Fonts',
  },
  {
    id: 'Sacramento-Regular',
    label: 'Sacramento',
    url: 'assets/fonts/Sacramento-Regular.otf',
    style: 'cursive',
    group: 'Double Line Fonts',
  },
  {
    id: 'DancingScript-Regular',
    label: 'Dancing Script (Regular)',
    url: 'assets/fonts/DancingScript-Regular.ttf',
    style: 'cursive',
    group: 'Double Line Fonts',
  },
  {
    id: 'DancingScript-Medium',
    label: 'Dancing Script (Medium)',
    url: 'assets/fonts/DancingScript-Medium.ttf',
    style: 'cursive',
    group: 'Double Line Fonts',
  },
  {
    id: 'DancingScript-SemiBold',
    label: 'Dancing Script (SemiBold)',
    url: 'assets/fonts/DancingScript-SemiBold.ttf',
    style: 'cursive',
    group: 'Double Line Fonts',
  },
  {
    id: 'DancingScript-Bold',
    label: 'Dancing Script (Bold)',
    url: 'assets/fonts/DancingScript-Bold.ttf',
    style: 'cursive',
    group: 'Double Line Fonts',
  },
  {
    id: 'BrotherSignature',
    label: 'Brother Signature',
    url: 'assets/fonts/Brother Signature.otf',
    style: 'cursive',
    group: 'Double Line Fonts',
  },
  {
    id: 'Caveat-Regular',
    label: 'Caveat (Regular)',
    url: 'assets/fonts/Caveat-Regular.ttf',
    style: 'print',
    group: 'Double Line Fonts',
  },
  {
    id: 'GreatVibes-Regular',
    label: 'Great Vibes',
    url: 'assets/fonts/GreatVibes-Regular.ttf',
    style: 'calligraphy',
    group: 'Double Line Fonts',
  },
  {
    id: 'Pacifico-Regular',
    label: 'Pacifico',
    url: 'assets/fonts/Pacifico-Regular.ttf',
    style: 'cursive',
    group: 'Double Line Fonts',
  },
  {
    id: 'BrotherdamSignature',
    label: 'Brotherdam Signature',
    url: 'assets/fonts/Brotherdam Signature.otf',
    style: 'cursive',
    group: 'Single Line Fonts',
  },
  {
    id: 'BrotherdamSignature-Italic',
    label: 'Brotherdam Signature (Italic)',
    url: 'assets/fonts/Brotherdam Signature Italic.otf',
    style: 'cursive',
    group: 'Single Line Fonts',
  },
  {
    id: 'BrothersideSignature',
    label: 'Brotherside Signature',
    url: 'assets/fonts/Brotherside Signature.otf',
    style: 'cursive',
    group: 'Single Line Fonts',
  },
  {
    id: 'BrotherSignature-7BWnK',
    label: 'Brother Signature (Alternative)',
    url: 'assets/fonts/BrotherSignature-7BWnK.otf',
    style: 'cursive',
    group: 'Single Line Fonts',
  },
  {
    id: 'HousttelySignature-GOonZ',
    label: 'Housttely Signature',
    url: 'assets/fonts/HousttelySignature-GOonZ.ttf',
    style: 'cursive',
    group: 'Single Line Fonts',
  },
  {
    id: 'AmericanSignature-w14En',
    label: 'American Signature',
    url: 'assets/fonts/AmericanSignature-w14En.ttf',
    style: 'cursive',
    group: 'Single Line Fonts',
  },
  {
    id: 'BukhariScript-lemD',
    label: 'Bukhari Script',
    url: 'assets/fonts/BukhariScript-lemD.ttf',
    style: 'cursive',
    group: 'Single Line Fonts',
  },
  {
    id: 'BukhariscriptAlternates-n5PV',
    label: 'Bukhari Script (Alternates)',
    url: 'assets/fonts/BukhariscriptAlternates-n5PV.ttf',
    style: 'cursive',
    group: 'Single Line Fonts',
  },
  {
    id: 'GustatoryDelightRegular-rgX3L',
    label: 'Gustatory Delight',
    url: 'assets/fonts/GustatoryDelightRegular-rgX3L.ttf',
    style: 'cursive',
    group: 'Single Line Fonts',
  },
  {
    id: 'CalifornianSignature-7OKLw',
    label: 'Californian Signature',
    url: 'assets/fonts/CalifornianSignature-7OKLw.otf',
    style: 'cursive',
    group: 'Single Line Fonts',
  },
  {
    id: 'OceanTrace',
    label: 'Ocean Trace',
    url: 'assets/fonts/OceanTrace.ttf',
    style: 'cursive',
    group: 'Single Line Fonts',
  },
  {
    id: 'CalifornianSignature-clean',
    label: 'Californian Signature (Clean)',
    url: 'assets/fonts/Californian Signature.otf',
    style: 'cursive',
    group: 'Single Line Fonts',
  },
  {
    id: 'GatewaySignature',
    label: 'Gateway Signature',
    url: 'assets/fonts/Gateway Signature.ttf',
    style: 'cursive',
    group: 'Single Line Fonts',
  },
  {
    id: 'FeasiblySingleLine',
    label: 'Feasibly Single Line',
    url: 'assets/fonts/FeasiblySingleLine-z8D90.ttf',
    style: 'cursive',
    group: 'Single Line Fonts',
  },
  {
    id: 'AuditoryPerceptionSingleLine',
    label: 'Auditory Perception Single Line',
    url: 'assets/fonts/AuditoryPerceptionSingleLine-RpELl.ttf',
    style: 'cursive',
    group: 'Single Line Fonts',
  },
];

// ─── State Types ──────────────────────────────────────────────────────────────

export type EngineStatus =
  | 'idle'
  | 'loading-font'
  | 'generating-preview'
  | 'generating-animation'
  | 'sending-to-ae'
  | 'success'
  | 'error';

export interface EngineState {
  settings: PluginSettings;
  status: EngineStatus;
  previewSvg: string | null;
  lastResult: EngineResult | null;
  error: string | null;
  aeVersion: string;
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useHandwritingEngine() {
  const [state, setState] = useState<EngineState>({
    settings: defaultSettings,
    status: 'idle',
    previewSvg: null,
    lastResult: null,
    error: null,
    aeVersion: 'Checking...',
  });

  // Loaded font cache reference
  const fontRef = useRef<any>(null);
  const previewTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ─── Font Loading ───────────────────────────────────────────────────────────

  const loadCurrentFont = useCallback(async (fontId: string): Promise<boolean> => {
    const fontOption = AVAILABLE_FONTS.find((f) => f.id === fontId);
    if (!fontOption) {
      setState((s) => ({ ...s, error: `Font "${fontId}" not found.` }));
      return false;
    }

    setState((s) => ({ ...s, status: 'loading-font', error: null }));

    try {
      fontRef.current = await loadFont(fontOption.url);
      setState((s) => ({ ...s, status: 'idle' }));
      return true;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.warn(`Font loading failed: ${msg}`);
      setState((s) => ({ ...s, status: 'error', error: `Font loading failed: ${msg}` }));
      return false;
    }
  }, []);

  // Load default font on mount
  useEffect(() => {
    loadCurrentFont(defaultSettings.fontFamily);
  }, [loadCurrentFont]);

  // ─── Settings Update ────────────────────────────────────────────────────────

  const updateSettings = useCallback(
    (patch: Partial<PluginSettings>) => {
      setState((s) => ({
        ...s,
        settings: { ...s.settings, ...patch },
        status: 'idle',
        error: null,
      }));

      // Reload font if changed
      if (patch.fontFamily) {
        loadCurrentFont(patch.fontFamily);
      }

      // Debounce auto-preview on text change
      if (patch.text !== undefined) {
        if (previewTimerRef.current) clearTimeout(previewTimerRef.current);
        previewTimerRef.current = setTimeout(() => {
          // will be triggered by the effect below
        }, 400);
      }
    },
    [loadCurrentFont],
  );

  // ─── AI Integration ─────────────────────────────────────────────────────────

  const applyAiPrompt = useCallback(async (prompt: string) => {
    if (!prompt.trim()) return;
    
    setState(s => ({ ...s, status: 'generating-preview', error: null }));
    try {
      const generatedSettings = await generateStyleFromPrompt(prompt);
      
      setState(s => ({
        ...s,
        settings: { ...s.settings, ...generatedSettings },
        status: 'idle',
      }));

      // Immediately trigger preview update
      if (previewTimerRef.current) clearTimeout(previewTimerRef.current);
      previewTimerRef.current = setTimeout(() => {
        // Preview is handled by the useEffect or UI call, but we can call it directly
        // However, if the font changed, we need to load it first.
        if (generatedSettings.fontFamily) {
          loadCurrentFont(generatedSettings.fontFamily).then(() => {
             // Let the component trigger preview
          });
        }
      }, 50);

    } catch (err) {
      console.error(err);
      setState(s => ({ ...s, status: 'error', error: 'AI Generation Failed' }));
    }
  }, [loadCurrentFont]);

  // ─── Preview Generation ─────────────────────────────────────────────────────

  const generatePreview = useCallback(async () => {
    if (!fontRef.current) {
      const ok = await loadCurrentFont(state.settings.fontFamily);
      if (!ok) return;
    }

    if (!state.settings.text.trim()) {
      setState((s) => ({ ...s, previewSvg: null }));
      return;
    }

    setState((s) => ({ ...s, status: 'generating-preview', error: null }));

    try {
      const svg = await generatePreviewSvg({
        font: fontRef.current,
        settings: state.settings,
      });

      setState((s) => ({
        ...s,
        status: 'idle',
        previewSvg: svg,
      }));
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setState((s) => ({
        ...s,
        status: 'error',
        error: `Preview failed: ${msg}`,
        previewSvg: null,
      }));
    }
  }, [state.settings, loadCurrentFont]);

  // ─── Animation Generation & Export ─────────────────────────────────────────

  const generateAnimation = useCallback(async () => {
    if (!state.settings.text.trim()) {
      setState((s) => ({ ...s, error: 'Please enter some text first.' }));
      return;
    }

    if (!fontRef.current) {
      const ok = await loadCurrentFont(state.settings.fontFamily);
      if (!ok) return;
    }

    setState((s) => ({ ...s, status: 'generating-animation', error: null }));

    try {
      const composition = await generateComposition({
        font: fontRef.current,
        settings: state.settings,
      });

      setState((s) => ({ ...s, status: 'sending-to-ae' }));

      const bridgeResult = await sendCompositionToAE(composition);

      if (!bridgeResult.success) {
        throw new Error(bridgeResult.error ?? 'Unknown AE error');
      }

      setState((s) => ({
        ...s,
        status: 'success',
        lastResult: {
          success: true,
          composition,
          stats: {
            totalStrokes: composition.shapeLayers.length,
            totalDuration: composition.duration,
            layerCount: composition.shapeLayers.length + (composition.penLayer ? 1 : 0),
          },
        },
      }));
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setState((s) => ({
        ...s,
        status: 'error',
        error: `Generation failed: ${msg}`,
        lastResult: { success: false, error: msg },
      }));
    }
  }, [state.settings, loadCurrentFont]);

  // ─── Exports ───────────────────────────────────────────────────────────────────

  const exportSvg = useCallback(async () => {
    if (!fontRef.current) return;
    try {
      const svgContent = await generateAnimatedSvg({
        font: fontRef.current,
        settings: state.settings,
      });
      const blob = new Blob([svgContent], { type: 'image/svg+xml' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `handwriting_${Date.now()}.svg`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('SVG Export failed', err);
    }
  }, [state.settings]);

  const exportJson = useCallback(() => {
    const json = JSON.stringify(state.settings, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `handwriting_preset_${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, [state.settings]);

  // ─── Reset ──────────────────────────────────────────────────────────────────

  const reset = useCallback(() => {
    setState((s) => ({
      ...s,
      status: 'idle',
      error: null,
      lastResult: null,
    }));
  }, []);

  return {
    state,
    updateSettings,
    generatePreview,
    generateAnimation,
    exportSvg,
    exportJson,
    applyAiPrompt,
    reset,
    fonts: AVAILABLE_FONTS,
  };
}