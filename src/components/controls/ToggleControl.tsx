import React from 'react';

interface ToggleControlProps {
  label: string;
  description?: string;
  value: boolean;
  onChange: (value: boolean) => void;
  disabled?: boolean;
}

export function ToggleControl({ label, description, value, onChange, disabled }: ToggleControlProps) {
  return (
    <div className="toggle-row" onClick={() => !disabled && onChange(!value)}>
      <div className="toggle-text">
        <span className="toggle-label">{label}</span>
        {description && <span className="toggle-desc">{description}</span>}
      </div>
      <div className={`toggle-switch ${value ? 'on' : 'off'} ${disabled ? 'disabled' : ''}`}>
        <div className="toggle-thumb" />
      </div>
    </div>
  );
}
