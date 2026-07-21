import React from 'react';
import type { EngineResult } from '../../shared/types';
import type { EngineStatus } from '../hooks/useHandwritingEngine';

interface StatusBarProps {
  status: EngineStatus;
  error: string | null;
  result: EngineResult | null;
}

const STATUS_MESSAGES: Record<EngineStatus, string> = {
  idle: 'Ready',
  'loading-font': 'Loading font…',
  'generating-preview': 'Generating preview…',
  'generating-animation': 'Building animation data…',
  'sending-to-ae': 'Sending to After Effects…',
  success: 'Animation created successfully!',
  error: 'Error',
};

export function StatusBar({ status, error, result }: StatusBarProps) {
  const isError = status === 'error';
  const isSuccess = status === 'success';

  return (
    <div className={`status-bar ${isError ? 'error' : ''} ${isSuccess ? 'success' : ''}`}>
      <div className="status-indicator">
        {isError && <span className="status-dot error-dot" />}
        {isSuccess && <span className="status-dot success-dot" />}
        {!isError && !isSuccess && <span className="status-dot idle-dot" />}
        <span className="status-text">
          {isError ? error : STATUS_MESSAGES[status]}
        </span>
      </div>
      {isSuccess && result?.stats && (
        <div className="status-stats">
          <span>{result.stats.layerCount} layers</span>
          <span>·</span>
          <span>{result.stats.totalDuration.toFixed(1)}s</span>
        </div>
      )}
    </div>
  );
}
