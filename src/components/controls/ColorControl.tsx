import React from 'react';

interface ColorControlProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}

const PRESETS = [
  '#1a1a2e', '#16213e', '#0f3460', '#533483',
  '#2c3e50', '#7f8c8d', '#c0392b', '#27ae60',
];

export function ColorControl({ label, value, onChange, disabled }: ColorControlProps) {
  return (
    <div className="control-row">
      <label className="control-label">{label}</label>
      <div className="color-control">
        <div className="color-presets">
          {PRESETS.map((c) => (
            <button
              key={c}
              className={`color-swatch ${value === c ? 'active' : ''}`}
              style={{ background: c }}
              onClick={() => onChange(c)}
              disabled={disabled}
              title={c}
            />
          ))}
        </div>
        <div className="color-custom">
          <input
            type="color"
            className="color-picker"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            disabled={disabled}
          />
          <input
            type="text"
            className="color-hex"
            value={value}
            onChange={(e) => {
              const v = e.target.value;
              if (/^#[0-9a-fA-F]{6}$/.test(v)) onChange(v);
            }}
            disabled={disabled}
            maxLength={7}
          />
        </div>
      </div>
    </div>
  );
}
