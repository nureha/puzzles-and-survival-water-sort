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
      disabled={disabled}
      maxLength={1}
      style={{
        width: '2.5rem',
        height: '2.5rem',
        textAlign: 'center',
        fontSize: '1.2rem',
        fontWeight: 'bold',
        border: '2px solid #ccc',
        borderRadius: '4px',
        background: disabled ? '#f0f0f0' : '#fff',
        color: value === '?' ? '#999' : '#222',
        cursor: disabled ? 'not-allowed' : 'text',
      }}
    />
  );
}
