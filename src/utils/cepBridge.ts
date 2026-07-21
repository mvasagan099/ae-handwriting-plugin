/**
 * CEP Bridge
 * Handles all communication between the React panel (browser context)
 * and After Effects (ExtendScript context).
 *
 * In development (outside AE), calls are mocked so the panel renders normally.
 */

import type { BridgeMessage, BridgeResponse, CompositionData } from '../../shared/types';

// ─── CEP Detection ────────────────────────────────────────────────────────────

function getCEPInterface(): any {
  if (typeof window !== 'undefined' && (window as any).cep) {
    return (window as any).cep;
  }
  return null;
}

function getCSInterface(): any {
  if (typeof window !== 'undefined' && (window as any).CSInterface) {
    return new (window as any).CSInterface();
  }
  return null;
}

export const isInsideAE = (): boolean => {
  return !!getCSInterface();
};

// ─── Core evalScript Wrapper ──────────────────────────────────────────────────

/**
 * Execute an ExtendScript function inside After Effects.
 * Falls back to a mock response in development mode.
 */
export async function evalScript(
  functionName: string,
  args: string[] = [],
): Promise<BridgeResponse> {
  const cs = getCSInterface();

  if (!cs) {
    // Development mock
    console.log('[CEP Bridge] Mock call:', functionName, args);
    return {
      success: true,
      data: { mock: true, functionName },
    };
  }

  return new Promise((resolve) => {
    const script = `${functionName}(${args.map((a) => JSON.stringify(a)).join(',')})`;

    cs.evalScript(script, (result: string) => {
      try {
        const parsed: BridgeResponse = JSON.parse(result);
        resolve(parsed);
      } catch {
        resolve({ success: false, error: `Invalid response: ${result}` });
      }
    });
  });
}

// ─── High-Level Bridge API ────────────────────────────────────────────────────

/**
 * Send composition data to After Effects to build the animation.
 */
export async function sendCompositionToAE(
  composition: CompositionData,
): Promise<BridgeResponse> {
  const jsonData = JSON.stringify(composition);

  return evalScript('createHandwritingAnimation', [jsonData]);
}

/**
 * Check if After Effects is running and responsive.
 */
export async function pingAE(): Promise<boolean> {
  const cs = getCSInterface();
  if (!cs) return false;

  return new Promise((resolve) => {
    cs.evalScript('$.writeln("ping"); "pong"', (result: string) => {
      resolve(result === 'pong');
    });
  });
}

/**
 * Open a panel URL in the system browser (for links, docs).
 */
export function openInBrowser(url: string): void {
  const cs = getCSInterface();
  if (cs) {
    cs.openURLInDefaultBrowser(url);
  } else {
    window.open(url, '_blank');
  }
}

/**
 * Get the After Effects version string.
 */
export async function getAEVersion(): Promise<string> {
  const cs = getCSInterface();
  if (!cs) return 'Development Mode';

  return new Promise((resolve) => {
    cs.evalScript('app.version', (result: string) => {
      resolve(result || 'Unknown');
    });
  });
}

/**
 * Load a script file from the host/jsx directory.
 */
export function loadHostScript(scriptName: string): void {
  const cs = getCSInterface();
  if (!cs) return;

  const extensionPath = cs.getSystemPath('extension');
  const scriptPath = `${extensionPath}/host/jsx/${scriptName}`;
  cs.evalScript(`$.evalFile("${scriptPath.replace(/\\/g, '/')}")`);
}