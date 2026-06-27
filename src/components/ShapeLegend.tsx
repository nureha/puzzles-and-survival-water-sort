const LEGEND: { letter: string; symbol: string; label: string }[] = [
  { letter: 'A', symbol: '♥', label: 'ハート' },
  { letter: 'B', symbol: '♦', label: 'ダイヤ' },
  { letter: 'C', symbol: '♠', label: 'スペード' },
  { letter: 'D', symbol: '♣', label: 'クラブ' },
  { letter: 'E', symbol: '★', label: '星' },
  { letter: 'F', symbol: '⚡', label: '稲妻' },
  { letter: 'G', symbol: '−', label: 'マイナス' },
  { letter: 'H', symbol: '＋', label: 'プラス' },
  { letter: 'I', symbol: '●', label: '丸' },
  { letter: 'J', symbol: '💧', label: 'しずく' },
  { letter: 'K', symbol: '■', label: '四角' },
];

export function ShapeLegend() {
  return (
    <div className="shape-legend">
      <p className="shape-legend-title">凡例</p>
      <div className="shape-legend-grid">
        {LEGEND.map(({ letter, symbol, label }) => (
          <div key={letter} className="shape-entry" title={label}>
            <span className="shape-entry-letter">{letter}</span>
            <span className="shape-entry-symbol">{symbol}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
