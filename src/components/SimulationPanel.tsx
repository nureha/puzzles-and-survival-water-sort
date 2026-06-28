import { isValidMove, topColor, isGoal } from '../solver/bfs';
import { uiToInternal } from '../solver/types';
import type { UITube } from '../solver/types';

interface SimulationPanelProps {
  tubes: UITube[];
  moveCount: number;
  canUndo: boolean;
  onMove: (from: number, to: number) => void;
  onUndo: () => void;
  onReset: () => void;
}

export function SimulationPanel({ tubes, moveCount, canUndo, onMove, onUndo, onReset }: SimulationPanelProps) {
  const state = tubes.map(uiToInternal);
  const cleared = isGoal(state);

  const validMoves: { from: number; to: number; color: string }[] = [];
  if (!cleared) {
    for (let from = 0; from < state.length; from++) {
      for (let to = 0; to < state.length; to++) {
        if (isValidMove(state, from, to)) {
          validMoves.push({ from, to, color: topColor(state[from]) ?? '' });
        }
      }
    }
  }

  return (
    <div>
      <div className="sim-header">
        <span className="sim-move-count">{moveCount}手</span>
        <button className="save-load-btn" onClick={onUndo} disabled={!canUndo}>
          1手戻る
        </button>
        <button className="save-load-btn" onClick={onReset} disabled={!canUndo}>
          最初に戻る
        </button>
      </div>

      {cleared ? (
        <p style={{ color: 'var(--app-success)', fontWeight: 'bold', marginTop: '1rem', fontSize: '1.1rem' }}>
          クリア！
        </p>
      ) : validMoves.length === 0 ? (
        <p style={{ color: 'var(--app-error)', marginTop: '1rem' }}>
          詰みです（有効な手がありません）
        </p>
      ) : (
        <div className="sim-moves">
          <p className="sim-moves-title">有効な手（{validMoves.length}）</p>
          {validMoves.map((move, i) => (
            <button
              key={i}
              className="sim-move-btn"
              onClick={e => { (e.currentTarget as HTMLButtonElement).blur(); onMove(move.from, move.to); }}
            >
              試験管{move.from + 1} → 試験管{move.to + 1}
              <span className="sim-move-color">（{move.color}）</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
