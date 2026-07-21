import React from 'react';

interface Option {
  value: string;
  label: string;
  description?: string;
  group?: string;
}

interface SelectControlProps {
  label: string;
  value: string;
  options: Option[];
  onChange: (value: string) => void;
  disabled?: boolean;
}

export function SelectControl({ label, value, options, onChange, disabled }: SelectControlProps) {
  // Group options by their `group` property. Un-grouped options go into '' (empty string).
  const groupedOptions = options.reduce((acc, opt) => {
    const key = opt.group || '';
    if (!acc[key]) acc[key] = [];
    acc[key].push(opt);
    return acc;
  }, {} as Record<string, Option[]>);

  return (
    <div className="control-row">
      <label className="control-label">{label}</label>
      <select
        className="control-select"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
      >
        {Object.entries(groupedOptions).map(([group, groupOptions]) => {
          if (group === '') {
            return groupOptions.map((opt) => (
              <option key={opt.value} value={opt.value} title={opt.description}>
                {opt.label}
              </option>
            ));
          } else {
            return (
              <optgroup key={group} label={group}>
                {groupOptions.map((opt) => (
                  <option key={opt.value} value={opt.value} title={opt.description}>
                    {opt.label}
                  </option>
                ))}
              </optgroup>
            );
          }
        })}
      </select>
    </div>
  );
}
