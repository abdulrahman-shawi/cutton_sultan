// components/settings/SettingsField.tsx
interface Option {
  value: string;
  label: string;
}

interface SettingsFieldProps {
  id: string;
  label: string;
  hint?: string;
  type?: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  inputMode?: 'text' | 'decimal' | 'email' | 'url';
  ltr?: boolean;
  full?: boolean;
  min?: string;
  step?: string;
  required?: boolean;
  options?: Option[];
}

export default function SettingsField({
  id,
  label,
  hint,
  type = 'text',
  value,
  onChange,
  placeholder,
  inputMode,
  ltr,
  full,
  min,
  step,
  required,
  options,
}: SettingsFieldProps) {
  const fieldClass = `settings-field${full ? ' full' : ''}`;

  return (
    <div className={fieldClass}>
      <label htmlFor={id} className="settings-label">
        {label}
        {required && (
          <span className="req" aria-hidden="true">
            {' '}
            *
          </span>
        )}
      </label>
      {options ? (
        <select
          id={id}
          className="settings-input"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          required={required}
        >
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      ) : (
        <input
          id={id}
          type={type}
          className={`settings-input${ltr ? ' ltr' : ''}`}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
          inputMode={inputMode}
          min={min}
          step={step}
          required={required}
        />
      )}
      {hint && <p className="settings-hint">{hint}</p>}
    </div>
  );
}
