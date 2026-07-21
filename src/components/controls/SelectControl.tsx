import React from 'react';

interface Option {
  value: string;
  label: string;
  description?: string;
}

interface SelectControlProps {
  label: string;
  value: string;
  options: Option[];
  onChange: (value: string) => void;
  disabled?: boolean;
}

export function SelectControl({ label, value, options, onChange, disabled }: SelectControlProps) {
  return (
    <div className="control-row">
      <label className="control-label">{label}</label>
      <select
        className="control-select"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value} title={opt.description}>
            {opt.label}
          </option>
        ))}
      </select>
    </div>
  );
}
