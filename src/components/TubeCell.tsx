import { LETTER_COLORS, textColorForBg } from './legendColors';

interface TubeCellProps {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}

export function TubeCell({ value, onChange, disabled = false }: TubeCellProps) {
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    if (e.key === 'Backspace' || e.key === 'Delete') {
      e.preventDefault();
      onChange('');
      return;
    }
    if (e.key.length === 1) {
      e.preventDefault();
      const upper = e.key.toUpperCase();
      if (upper === '?' || /^[A-Z]$/.test(upper)) onChange(upper);
    }
  };

  // onChange handles paste; keyboard input is fully handled by onKeyDown
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.toUpperCase().slice(-1);
    if (raw === '' || raw === '?' || /^[A-Z]$/.test(raw)) onChange(raw);
  };

  const letterColor = /^[A-Z]$/.test(value) ? LETTER_COLORS[value] : undefined;
  const bg = disabled
    ? 'var(--app-input-disabled-bg)'
    : letterColor ?? 'var(--app-input-bg)';
  const fg = value === '?'
    ? 'var(--app-q-color)'
    : letterColor
      ? textColorForBg(letterColor)
      : 'var(--text-h)';

  return (
    <input
      type="text"
      value={value}
      onKeyDown={handleKeyDown}
      onChange={handleChange}
      onFocus={e => e.target.select()}
      disabled={disabled}
      maxLength={1}
      className="tube-cell"
      style={{
        border: `2px solid ${letterColor ?? 'var(--app-input-border)'}`,
        background: bg,
        color: fg,
        cursor: disabled ? 'not-allowed' : 'text',
      }}
    />
  );
}
