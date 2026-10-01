import type { ReactNode } from 'react';
import { LETTER_COLORS, textColorForBg } from './legendColors';

// 下向きの矢じり（上辺に浅い切り欠きを持つ凹四角形）。
// 対応する Unicode 文字が無いため SVG で描く。
// 頂点: 左上(2,3) → 切り欠き(12,8) → 右上(22,3) → 先端(12,22)
function DartIcon() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
      <path d="M2 3 L12 8 L22 3 L12 22 Z" fill="currentColor" />
    </svg>
  );
}

const LEGEND: { letter: string; symbol: ReactNode; label: string; rotate?: number; fontSize?: string }[] = [
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
  { letter: 'L', symbol: '△', label: '三角形' },
  { letter: 'M', symbol: <DartIcon />, label: '矢じり' },
];

export function ShapeLegend() {
  return (
    <div className="shape-legend">
      <p className="shape-legend-title">凡例</p>
      <div className="shape-legend-grid">
        {LEGEND.map(({ letter, symbol, label, rotate, fontSize }) => {
          const color = LETTER_COLORS[letter] ?? '#888';
          const fg = textColorForBg(color);
          return (
            <div
              key={letter}
              className="shape-entry"
              title={label}
              style={{ background: color, borderColor: color }}
            >
              <span className="shape-entry-letter" style={{ color: fg === 'white' ? 'rgba(255,255,255,0.8)' : 'rgba(0,0,0,0.5)' }}>
                {letter}
              </span>
              <span
                className="shape-entry-symbol"
                style={{
                  color: fg,
                  ...(rotate ? { transform: `rotate(${rotate}deg)` } : undefined),
                  ...(fontSize ? { fontSize } : undefined),
                }}
              >
                {symbol}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
