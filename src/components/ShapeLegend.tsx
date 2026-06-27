const LEGEND: { letter: string; symbol: string; label: string; rotate?: number; fontSize?: string }[] = [
  { letter: 'A', symbol: '♥', label: 'ハート' },
  { letter: 'B', symbol: '♦', label: 'ダイヤ' },
  { letter: 'C', symbol: '★', label: '星' },
  { letter: 'D', symbol: '⚡', label: '稲妻' },
  { letter: 'E', symbol: '−', label: 'マイナス' },
  { letter: 'F', symbol: '＋', label: 'プラス' },
  { letter: 'G', symbol: '●', label: '丸' },
  { letter: 'H', symbol: '💧', label: 'しずく' },
  { letter: 'I', symbol: '■', label: '四角' },
  { letter: 'J', symbol: '⬠', label: '五角形', rotate: 180, fontSize: '2.0rem' },
  { letter: 'K', symbol: 'II', label: 'イコール縦' },
];

export function ShapeLegend() {
  return (
    <div className="shape-legend">
      <p className="shape-legend-title">凡例</p>
      <div className="shape-legend-grid">
        {LEGEND.map(({ letter, symbol, label, rotate, fontSize }) => (
          <div key={letter} className="shape-entry" title={label}>
            <span className="shape-entry-letter">{letter}</span>
            <span
              className="shape-entry-symbol"
              style={(rotate || fontSize) ? { display: 'inline-block', transform: rotate ? `rotate(${rotate}deg)` : undefined, fontSize } : undefined}
            >
              {symbol}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
