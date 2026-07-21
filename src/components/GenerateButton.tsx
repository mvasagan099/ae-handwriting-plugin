import React from 'react';
import type { EngineStatus } from '../hooks/useHandwritingEngine';

interface GenerateButtonProps {
  status: EngineStatus;
  onClick: () => void;
  disabled?: boolean;
}

export function GenerateButton({ status, onClick, disabled }: GenerateButtonProps) {
  const isGenerating = ['generating-animation', 'sending-to-ae'].includes(status);
  const isSuccess = status === 'success';

  const getLabel = () => {
    if (status === 'generating-animation') return 'Building…';
    if (status === 'sending-to-ae') return 'Sending to AE…';
    if (isSuccess) return '✓ Done! Generate Again';
    return 'Generate Animation';
  };

  return (
    <button
      className={`btn-generate ${isGenerating ? 'loading' : ''} ${isSuccess ? 'success' : ''}`}
      onClick={onClick}
      disabled={disabled || isGenerating}
    >
      {isGenerating && <span className="btn-spinner">⟳</span>}
      {getLabel()}
    </button>
  );
}
