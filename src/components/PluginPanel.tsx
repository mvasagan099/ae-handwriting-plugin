/**
 * PluginPanel — Root UI component for the AE Handwriting Plugin
 * Dark, professional aesthetic matching Adobe's design language.
 */

import React, { useState } from 'react';
import { useHandwritingEngine } from '../hooks/useHandwritingEngine';
import { TextInput } from './controls/TextInput';
import { SelectControl } from './controls/SelectControl';
import { SliderControl } from './controls/SliderControl';
import { ColorControl } from './controls/ColorControl';
import { ToggleControl } from './controls/ToggleControl';
import { PreviewPane } from './PreviewPane';
import { StatusBar } from './StatusBar';
import { GenerateButton } from './GenerateButton';
import type { HandwritingStyle, PaperBackground, PenType } from '../../shared/types';
import { STYLE_PRESETS } from '../../shared/types';

export function PluginPanel() {
  const { state, updateSettings, generatePreview, generateAnimation, exportSvg, exportJson, applyAiPrompt, fonts } =
    useHandwritingEngine();
  const { settings, status, previewSvg, lastResult, error } = state;

  const [showAdvanced, setShowAdvanced] = useState(false);
  const [activeTab, setActiveTab] = useState<'settings' | 'style' | 'ai'>('settings');
  const [aiPrompt, setAiPrompt] = useState('');

  const isLoading = [
    'generating-preview',
    'generating-animation',
    'sending-to-ae',
  ].includes(status);

  const styleOptions = Object.values(STYLE_PRESETS).map((p) => ({
    value: p.id,
    label: p.label,
    description: p.description,
  }));

  const fontOptions = fonts.map((f) => ({ value: f.id, label: f.label }));

  const penOptions: { value: PenType; label: string; icon: string; desc: string }[] = [
    { value: 'fountain', label: 'Fountain', icon: '🖊', desc: 'Fine ink lines' },
    { value: 'pencil',   label: 'Pencil',   icon: '✏️', desc: 'Light & textured' },
    { value: 'marker',   label: 'Marker',   icon: '🖍', desc: 'Bold & thick' },
    { value: 'brush',    label: 'Brush',    icon: '🖌', desc: 'Fluid strokes' },
  ];

  const paperOptions: { value: PaperBackground; label: string }[] = [
    { value: 'none', label: 'None (Transparent)' },
    { value: 'white', label: 'White Paper' },
    { value: 'cream', label: 'Cream Paper' },
    { value: 'lined', label: 'Lined Paper' },
    { value: 'grid', label: 'Grid Paper' },
    { value: 'aged', label: 'Aged Paper' },
    { value: 'dark', label: 'Dark Background' },
  ];

  return (
    <div className="plugin-panel">
      {/* Header */}
      <header className="panel-header">
        <div className="header-logo">
          <span className="logo-icon">✍</span>
          <div>
            <h1 className="panel-title">Handwriting</h1>
            <p className="panel-subtitle">Animation Engine</p>
          </div>
        </div>
        <div className="header-version">v1.0</div>
      </header>

      {/* Body container for sidebar + main content */}
      <div className="panel-body" style={{ display: 'flex', flex: 1, overflow: 'hidden', height: '100%' }}>
        
        {/* LEFT SIDEBAR (Tabs & Controls) */}
        <aside className="sidebar" style={{ width: '340px', minWidth: '340px', display: 'flex', flexDirection: 'column', borderRight: '1px solid #2a2a35', background: '#1a1a2e' }}>
          {/* Tab Navigation */}
          <nav className="tab-nav" style={{ flexShrink: 0 }}>
        <button
          className={`tab-btn ${activeTab === 'settings' ? 'active' : ''}`}
          onClick={() => setActiveTab('settings')}
        >
          Settings
        </button>
        <button
          className={`tab-btn ${activeTab === 'style' ? 'active' : ''}`}
          onClick={() => setActiveTab('style')}
        >
          Style
        </button>
        <button
          className={`tab-btn ${activeTab === 'ai' ? 'active' : ''}`}
          onClick={() => setActiveTab('ai')}
          style={{ color: '#b983ff' }}
        >
          ✨ AI Magic
        </button>
          </nav>

          <div className="controls-scroll" style={{ flex: 1, overflowY: 'auto', padding: '0 8px 16px 8px' }}>
        {activeTab === 'settings' && (
          <div className="controls-section">
            {/* Main Text Input moved to top of settings */}
            <div style={{ marginBottom: '16px' }}>
              <TextInput
                value={settings.text}
                onChange={(text) => updateSettings({ text })}
                placeholder="Type your text here…"
                onBlur={generatePreview}
                disabled={isLoading}
              />
            </div>

            {/* Font */}
            <SelectControl
              label="Font"
              value={settings.fontFamily}
              options={fontOptions}
              onChange={(v) => updateSettings({ fontFamily: v })}
              disabled={isLoading}
            />

            {/* Pen Type */}
            <div className="control-row">
              <label className="control-label">Pen Type</label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px', marginTop: '2px' }}>
                {penOptions.map((pen) => (
                  <button
                    key={pen.value}
                    onClick={() => updateSettings({ penType: pen.value })}
                    disabled={isLoading}
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: '2px',
                      padding: '6px 4px',
                      background: settings.penType === pen.value ? 'rgba(200,169,106,0.18)' : 'var(--bg-tertiary)',
                      border: settings.penType === pen.value ? '1px solid var(--accent)' : '1px solid var(--border)',
                      borderRadius: '4px',
                      cursor: isLoading ? 'default' : 'pointer',
                      opacity: isLoading ? 0.4 : 1,
                      transition: 'all 0.15s',
                    }}
                    title={pen.desc}
                  >
                    <span style={{ fontSize: '16px', lineHeight: 1 }}>{pen.icon}</span>
                    <span style={{ fontSize: '10px', color: settings.penType === pen.value ? 'var(--accent)' : 'var(--text-secondary)', fontWeight: settings.penType === pen.value ? 600 : 400 }}>{pen.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Ink Color */}
            <ColorControl
              label="Ink Color"
              value={settings.inkColor}
              onChange={(v) => updateSettings({ inkColor: v })}
              disabled={isLoading}
            />

            {/* Stroke Width */}
            <SliderControl
              label="Stroke Width"
              value={settings.strokeWidth}
              min={1}
              max={10}
              step={0.5}
              unit="px"
              onChange={(v) => updateSettings({ strokeWidth: v })}
              disabled={isLoading}
            />

            {/* Writing Speed */}
            <SliderControl
              label="Writing Speed"
              value={settings.writingSpeed}
              min={1}
              max={10}
              step={1}
              onChange={(v) => updateSettings({ writingSpeed: v })}
              disabled={isLoading}
            />

            {/* Paper Background */}
            <SelectControl
              label="Paper Background"
              value={settings.paperBackground}
              options={paperOptions}
              onChange={(v) => updateSettings({ paperBackground: v as PaperBackground })}
              disabled={isLoading}
            />

            {/* Toggles Row */}
            <div className="control-row" style={{ alignItems: 'center', gap: '16px' }}>
              <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{ flex: 1 }}>
                  <label className="control-label" style={{ display: 'block' }}>Show Pen Cursor</label>
                  <span style={{ fontSize: '10px', color: 'var(--text-secondary)' }}>Pen follows strokes</span>
                </div>
                <button
                  onClick={() => updateSettings({ animateHand: !settings.animateHand })}
                  disabled={isLoading}
                  style={{
                    width: '40px', height: '22px', borderRadius: '11px', border: 'none',
                    background: settings.animateHand ? 'var(--accent)' : 'var(--bg-tertiary)',
                    cursor: isLoading ? 'default' : 'pointer', position: 'relative',
                    transition: 'background 0.2s', flexShrink: 0,
                  }}
                >
                  <span style={{
                    position: 'absolute', top: '2px', left: settings.animateHand ? '20px' : '2px',
                    width: '18px', height: '18px', borderRadius: '50%', background: 'white',
                    transition: 'left 0.2s', display: 'block',
                  }}/>
                </button>
              </div>

              <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{ flex: 1 }}>
                  <label className="control-label" style={{ display: 'block' }}>Solid Fill Word</label>
                  <span style={{ fontSize: '10px', color: 'var(--text-secondary)' }}>Fills outline</span>
                </div>
                <button
                  onClick={() => updateSettings({ filledText: !settings.filledText })}
                  disabled={isLoading}
                  style={{
                    width: '40px', height: '22px', borderRadius: '11px', border: 'none',
                    background: settings.filledText ? 'var(--accent)' : 'var(--bg-tertiary)',
                    cursor: isLoading ? 'default' : 'pointer', position: 'relative',
                    transition: 'background 0.2s', flexShrink: 0,
                  }}
                >
                  <span style={{
                    position: 'absolute', top: '2px', left: settings.filledText ? '20px' : '2px',
                    width: '18px', height: '18px', borderRadius: '50%', background: 'white',
                    transition: 'left 0.2s', display: 'block',
                  }}/>
                </button>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'style' && (
          <div className="controls-section">
            {/* Handwriting Style */}
            <div className="style-grid">
              {styleOptions.map((opt) => (
                <button
                  key={opt.value}
                  className={`style-card ${settings.style === opt.value ? 'active' : ''}`}
                  onClick={() => updateSettings({ style: opt.value as HandwritingStyle })}
                  disabled={isLoading}
                  title={opt.description}
                >
                  <span className="style-label">{opt.label}</span>
                  <span className="style-desc">{opt.description}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'ai' && (
          <div className="controls-section" style={{ padding: '16px', background: '#1e1e24', borderRadius: '8px' }}>
            <h3 style={{ margin: '0 0 8px 0', fontSize: '14px', color: '#b983ff' }}>✨ Generate with AI</h3>
            <p style={{ margin: '0 0 12px 0', fontSize: '12px', color: '#aaa' }}>
              Describe the handwriting you want. The AI will instantly configure all settings to match.
            </p>
            <textarea 
              value={aiPrompt}
              onChange={(e) => setAiPrompt(e.target.value)}
              placeholder="e.g. Messy fast doctor's handwriting with thick ink on vintage paper..."
              style={{ width: '100%', height: '80px', padding: '8px', background: '#2a2a35', border: '1px solid #444', color: '#fff', borderRadius: '4px', resize: 'none', marginBottom: '12px' }}
            />
            <button 
              onClick={() => {
                applyAiPrompt(aiPrompt);
                // Optionally auto-preview after generating
                setTimeout(generatePreview, 1300);
              }}
              disabled={isLoading || !aiPrompt.trim()}
              style={{ width: '100%', padding: '8px', background: 'linear-gradient(90deg, #9b51e0 0%, #b983ff 100%)', color: '#fff', border: 'none', borderRadius: '4px', fontWeight: 'bold', cursor: 'pointer' }}
            >
              {isLoading ? 'Thinking...' : 'Generate Settings'}
            </button>
          </div>
        )}

        {/* Advanced Options (collapsible) */}
        <div className="advanced-section">
          <button
            className="advanced-toggle"
            onClick={() => setShowAdvanced(!showAdvanced)}
          >
            <span>Advanced Options</span>
            <span className={`chevron ${showAdvanced ? 'open' : ''}`}>›</span>
          </button>

          {showAdvanced && (
            <div className="advanced-controls">
              <ToggleControl
                label="Animate Hand"
                description="Show a pen following the stroke path"
                value={settings.animateHand}
                onChange={(v) => updateSettings({ animateHand: v })}
                disabled={isLoading}
              />
              <ToggleControl
                label="Randomize Pen Pressure"
                description="Vary stroke width naturally"
                value={settings.randomizePenPressure}
                onChange={(v) => updateSettings({ randomizePenPressure: v })}
                disabled={isLoading}
              />
              <ToggleControl
                label="Smooth Curves"
                description="Apply bezier smoothing to all strokes"
                value={settings.smoothCurves}
                onChange={(v) => updateSettings({ smoothCurves: v })}
                disabled={isLoading}
              />
              <ToggleControl
                label="Natural Pauses"
                description="Add micro-pauses between strokes"
                value={settings.naturalPauses}
                onChange={(v) => updateSettings({ naturalPauses: v })}
                disabled={isLoading}
              />
              <ToggleControl
                label="Auto Camera Zoom"
                description="Add subtle animated camera"
                value={settings.autoCameraZoom}
                onChange={(v) => updateSettings({ autoCameraZoom: v })}
                disabled={isLoading}
              />
            </div>
          )}
        </div>
        </div>

        {/* Action Buttons in Sidebar */}
        <div className="action-bar" style={{ display: 'flex', flexDirection: 'column', gap: '8px', padding: '16px', borderTop: '1px solid #2a2a35' }}>
          <button
            className="btn-preview"
            onClick={generatePreview}
            disabled={isLoading || !settings.text.trim()}
          >
            Preview
          </button>
          <GenerateButton
            status={status}
            onClick={generateAnimation}
            disabled={isLoading || !settings.text.trim()}
          />
          <div style={{ display: 'flex', gap: '8px', justifyContent: 'center', marginTop: '8px' }}>
            <button 
              className="btn-secondary" 
              onClick={exportSvg} 
              disabled={isLoading || !settings.text.trim()}
              style={{ flex: 1, padding: '4px', fontSize: '12px', background: 'transparent', border: '1px solid #444', color: '#ccc', borderRadius: '4px', cursor: 'pointer' }}
            >
              Export SVG
            </button>
            <button 
              className="btn-secondary" 
              onClick={exportJson}
              style={{ flex: 1, padding: '4px', fontSize: '12px', background: 'transparent', border: '1px solid #444', color: '#ccc', borderRadius: '4px', cursor: 'pointer' }}
            >
              Export Preset
            </button>
          </div>
        </div>
        </aside>

        {/* RIGHT MAIN AREA (Preview only) */}
        <main className="main-content" style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: '16px', background: '#12121a' }}>
          {/* Preview */}
          <div style={{ flex: 1, display: 'flex', minHeight: 0 }}>
            <PreviewPane
              svg={previewSvg}
              isLoading={status === 'generating-preview'}
              onRefresh={generatePreview}
              isEmpty={!settings.text.trim()}
            />
          </div>
        </main>
      </div>

      {/* Status */}
      <StatusBar status={status} error={error} result={lastResult} />
    </div>
  );
}