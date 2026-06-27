import { TubeCell } from './TubeCell';
import { normalizeTube } from '../solver/types';
import type { UITube } from '../solver/types';

interface TubeGridProps {
  tubes: UITube[];
  onChange: (tubes: UITube[]) => void;
}

export function TubeGrid({ tubes, onChange }: TubeGridProps) {
  const handleCellChange = (tubeIndex: number, cellIndex: number, value: string) => {
    const newTubes = tubes.map(t => [...t] as UITube);
    newTubes[tubeIndex][cellIndex] = value;
    newTubes[tubeIndex] = normalizeTube(newTubes[tubeIndex]);
    onChange(newTubes);
  };

  return (
    <div className="tube-grid">
      {tubes.map((tube, ti) => (
        <div
          key={ti}
          className="tube-col"
          style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}
        >
          <span style={{ fontSize: '0.8rem', color: 'var(--app-muted)' }}>#{ti + 1}</span>
          {tube.map((cell, ci) => (
            <TubeCell
              key={ci}
              value={cell}
              onChange={v => handleCellChange(ti, ci, v)}
              disabled={ci > 0 && tube[ci - 1] === '?'}
            />
          ))}
        </div>
      ))}
    </div>
  );
}
