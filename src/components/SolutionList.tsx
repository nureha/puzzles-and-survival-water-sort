import type { SolveResult, Move } from '../solver/types';

interface SolutionListProps {
  result: SolveResult | null;
  completedSteps: Set<number>;
  onStepToggle: (index: number) => void;
  onReset: () => void;
}

export function SolutionList({ result, completedSteps, onStepToggle, onReset }: SolutionListProps) {
  if (!result) {
    return <p style={{ color: '#999' }}>試験管を入力して「解く」を押してください</p>;
  }

  if (result.type === 'unsolvable') {
    return <p style={{ color: '#c00' }}>解が見つかりませんでした（入力内容を確認してください）</p>;
  }

  if (result.type === 'partial') {
    return (
      <div>
        <p style={{ color: '#996600', marginBottom: '0.5rem' }}>
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
                <li key={i} style={{ fontSize: '0.9rem', color: '#555', marginBottom: '4px' }}>
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
        <span style={{ fontWeight: 'bold' }}>
          手順 ({result.moves.length}ステップ)
        </span>
        <button onClick={onReset} style={{ fontSize: '0.8rem', padding: '2px 10px' }}>
          リセット
        </button>
      </div>
      {result.moves.length === 0 ? (
        <p style={{ color: '#080' }}>すでに解けています！</p>
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
          <li
            key={i}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              padding: '4px 0',
              opacity: done ? 0.4 : 1,
              fontWeight: current ? 'bold' : 'normal',
              color: current ? '#0055cc' : 'inherit',
            }}
          >
            <input
              type="checkbox"
              checked={done}
              onChange={() => onStepToggle(i)}
              style={{ cursor: 'pointer' }}
            />
            <span style={{ textDecoration: done ? 'line-through' : 'none' }}>
              {current ? '▶ ' : ''}
              {i + 1}. 試験管{move.from + 1} → 試験管{move.to + 1}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
