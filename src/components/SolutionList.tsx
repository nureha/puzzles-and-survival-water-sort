import type { SolveResult, Move } from '../solver/types';

interface SolutionListProps {
  result: SolveResult | null;
  completedSteps: Set<number>;
  onStepToggle: (index: number) => void;
  onReset: () => void;
}

export function SolutionList({ result, completedSteps, onStepToggle, onReset }: SolutionListProps) {
  if (!result) {
    return <p style={{ color: 'var(--app-muted)' }}>試験管を入力して「解く」を押してください</p>;
  }

  if (result.type === 'unsolvable') {
    return <p style={{ color: 'var(--app-error)' }}>解が見つかりませんでした（入力内容を確認してください）</p>;
  }

  if (result.type === 'partial') {
    return (
      <div>
        <p style={{ color: 'var(--app-warning)', marginBottom: '0.5rem' }}>
          一部の色が不明なため、完全な解を求められません
        </p>
        {result.moves.length > 0 && (
          <>
            <p style={{ fontSize: '0.9rem', marginBottom: '0.5rem' }}>既知の色で可能な手順:</p>
            <MoveList
              moves={result.moves}
              completedSteps={completedSteps}
              onStepToggle={onStepToggle}
            />
          </>
        )}
        {result.revealHints.length > 0 && (
          <div style={{ marginTop: '1rem' }}>
            <p style={{ fontSize: '0.9rem', fontWeight: 'bold' }}>? を判明させるには:</p>
            <ul style={{ paddingLeft: '1.2rem' }}>
              {result.revealHints.map((hint, i) => (
                <li key={i} style={{ fontSize: '0.9rem', color: 'var(--app-hint)', marginBottom: '4px' }}>
                  {hint.description}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    );
  }

  // type === 'solved'
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
        <span style={{ fontWeight: 'bold', color: 'var(--text-h)' }}>
          手順 ({result.moves.length}ステップ)
        </span>
        <button onClick={onReset} style={{ fontSize: '0.8rem', padding: '2px 10px', background: 'var(--app-btn-bg)', border: '1px solid var(--app-btn-border)', borderRadius: '4px', color: 'var(--text-h)', cursor: 'pointer' }}>
          リセット
        </button>
      </div>
      {result.moves.length === 0 ? (
        <p style={{ color: 'var(--app-success)' }}>すでに解けています！</p>
      ) : (
        <MoveList
          moves={result.moves}
          completedSteps={completedSteps}
          onStepToggle={onStepToggle}
        />
      )}
    </div>
  );
}

function MoveList({
  moves,
  completedSteps,
  onStepToggle,
}: {
  moves: Move[];
  completedSteps: Set<number>;
  onStepToggle: (i: number) => void;
}) {
  const nextStep = moves.findIndex((_, i) => !completedSteps.has(i));

  return (
    <ol style={{ listStyle: 'none', padding: 0, margin: 0 }}>
      {moves.map((move, i) => {
        const done = completedSteps.has(i);
        const current = i === nextStep;
        return (
          <li key={i}>
            <label
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                padding: '6px 4px',
                cursor: 'pointer',
                opacity: done ? 0.4 : 1,
                fontWeight: current ? 'bold' : 'normal',
                color: current ? 'var(--app-link)' : 'var(--text)',
                userSelect: 'none',
              }}
            >
              <input
                type="checkbox"
                checked={done}
                onChange={() => onStepToggle(i)}
                style={{ cursor: 'pointer', flexShrink: 0 }}
              />
              <span style={{ textDecoration: done ? 'line-through' : 'none' }}>
                {current ? '▶ ' : ''}
                {i + 1}. 試験管{move.from + 1} → 試験管{move.to + 1}
              </span>
            </label>
          </li>
        );
      })}
    </ol>
  );
}
