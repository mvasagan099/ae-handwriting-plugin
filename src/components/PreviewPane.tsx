import React from 'react';

interface PreviewPaneProps {
  svg: string | null;
  isLoading: boolean;
  onRefresh: () => void;
  isEmpty: boolean;
}

export function PreviewPane({ svg, isLoading, onRefresh, isEmpty }: PreviewPaneProps) {
  return (
    <div className="preview-pane">
      <div className="preview-header">
        <span className="preview-title">Preview</span>
        <button className="preview-refresh" onClick={onRefresh} disabled={isLoading || isEmpty}>
          {isLoading ? '⏳' : '↻'}
        </button>
      </div>
      <div className="preview-content">
        {isLoading && (
          <div className="preview-loading">
            <div className="loading-pen">✍</div>
            <span>Rendering preview…</span>
          </div>
        )}
        {!isLoading && isEmpty && (
          <div className="preview-empty">
            <span className="preview-empty-icon">✍</span>
            <span>Enter text to preview</span>
          </div>
        )}
        {!isLoading && !isEmpty && svg && (
          <div
            className="preview-svg"
            dangerouslySetInnerHTML={{ __html: svg }}
          />
        )}
        {!isLoading && !isEmpty && !svg && (
          <div className="preview-empty">
            <span>Click Preview to render</span>
          </div>
        )}
      </div>
    </div>
  );
}
