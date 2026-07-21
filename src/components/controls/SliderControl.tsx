import React from 'react';

interface SliderControlProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  unit?: string;
  onChange: (value: number) => void;
  disabled?: boolean;
}

export function SliderControl({ label, value, min, max, step = 1, unit = '', onChange, disabled }: SliderControlProps) {
  const percent = ((value - min) / (max - min)) * 100;

  return (
    <div className="control-row">
      <div className="control-header">
        <label className="control-label">{label}</label>
        <span className="control-value">{value}{unit}</span>
      </div>
      <div className="slider-wrapper">
        <input
          type="range"
          className="control-slider"
          value={value}
          min={min}
          max={max}
          step={step}
          onChange={(e) => onChange(parseFloat(e.target.value))}
          disabled={disabled}
          style={{ '--fill-pct': `${percent}%` } as React.CSSProperties}
        />
      </div>
    </div>
  );
}
