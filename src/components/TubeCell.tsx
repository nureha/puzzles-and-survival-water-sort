interface TubeCellProps {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}

export function TubeCell({ value, onChange, disabled = false }: TubeCellProps) {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.toUpperCase().slice(-1);
    if (raw === '' || raw === '?' || /^[A-Z]$/.test(raw)) {
      onChange(raw);
    }
  };

  return (
    <input
      type="text"
      value={value}
      onChange={handleChange}
      onFocus={e => e.target.select()}
      disabled={disabled}
      maxLength={1}
      style={{
        width: '2.5rem',
        height: '2.5rem',
        textAlign: 'center',
        fontSize: '1.2rem',
        fontWeight: 'bold',
        border: '2px solid var(--app-input-border)',
        borderRadius: '4px',
        background: disabled ? 'var(--app-input-disabled-bg)' : 'var(--app-input-bg)',
        color: value === '?' ? 'var(--app-q-color)' : 'var(--text-h)',
        cursor: disabled ? 'not-allowed' : 'text',
      }}
    />
  );
}
