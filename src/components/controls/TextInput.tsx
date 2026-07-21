import React from 'react';

interface TextInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  onBlur?: () => void;
  disabled?: boolean;
}

export function TextInput({ value, onChange, placeholder, onBlur, disabled }: TextInputProps) {
  return (
    <div className="control-row">
      <label className="control-label">Text</label>
      <textarea
        className="text-area"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onBlur={onBlur}
        placeholder={placeholder}
        disabled={disabled}
        rows={3}
        maxLength={500}
      />
      <span className="char-count">{value.length}/500</span>
    </div>
  );
}
