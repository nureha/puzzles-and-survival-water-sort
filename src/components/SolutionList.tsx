import type { SolveResult, Move, UITube } from '../solver/types';
import { ReportBoardSection } from './ReportBoardSection';

interface SolutionListProps {
  result: SolveResult | null;
  completedCount: number;
  boardTubes: UITube[];
  onStepToggle: (index: number) => void;
  onReset: () => void;
  onResearch?: () => void;
  onRestart?: () => void;
  isResearch?: boolean;
}

export function SolutionList({ result, completedCount, boardTubes, onStepToggle, onReset, onResearch, onRestart, isResearch }: SolutionListProps) {
  if (!result) {
    return <p style={{ color: 'var(--app-muted)' }}>試験管を入力して「解く」を押してください</p>;
  }

  if (result.type === 'unsolvable') {
    return (
      <div>
        {isResearch ? (
          <>
            <p style={{ color: 'var(--app-warning)', marginBottom: '0.5rem' }}>
              この盤面（手順の途中）からは解が見つかりませんでした。
            </p>
            <p style={{ fontSize: '0.85rem', color: 'var(--app-muted)' }}>
              推測した色が実際と違ったか、途中で詰みに入った可能性があります。手順のチェックを戻すか、判明した色を見直して再探索してください。パズル自体はアイテムなしで解ける可能性があります。
            </p>
          </>
        ) : (
          <>
            <p style={{ color: 'var(--app-error)', marginBottom: '0.5rem' }}>解が見つかりませんでした</p>
            <p style={{ fontSize: '0.85rem', color: 'var(--app-muted)' }}>
              {result.deep
                ? 'アイテム（空き試験管の追加など）を使用しないとクリアできない盤面の可能性があります。'
                : '深い探索モード（最大120秒）をオンにして再度「解く」を試してください。'}
            </p>
            <ReportBoardSection tubes={boardTubes} deep={result.deep} />
          </>
        )}
        {onResearch && <ResearchButton onResearch={onResearch} />}
        {onRestart && <RestartButton onRestart={onRestart} />}
      </div>
    );
  }

  if (result.type === 'partial') {
    const revealCount = result.revealHints.length;
    const warning = (
      <p style={{ color: 'var(--app-warning)', marginBottom: '0.5rem' }}>
        未判明の色が多いため推定解を求められませんでした。まず ? を判明させてください。
      </p>
    );

    if (result.moves.length === 0) {
      return (
        <div>
          {warning}
          <p style={{ fontSize: '0.9rem', color: 'var(--app-muted)' }}>
            動かせる既知のブロックが無く、? を判明させる手順がありません。
          </p>
          {onResearch && <ResearchButton onResearch={onResearch} />}
        </div>
      );
    }

    const tubeLabels = result.revealHints.map(h => `試験管${h.tubeIndex + 1}`).join('・');
    return (
      <div>
        {warning}
        <p style={{ fontSize: '0.9rem', marginBottom: '0.5rem' }}>
          ? を判明させる手順（{revealCount}個の ? が判明します）:
        </p>
        <MoveList
          moves={result.moves}
          completedCount={completedCount}
          onStepToggle={onStepToggle}
        />
        <p style={{ marginTop: '1rem', fontSize: '0.9rem', color: 'var(--app-hint)' }}>
          すべて実行すると <strong>{tubeLabels}</strong> の ? が判明します（{revealCount}個）。判明した色を入力して「この盤面から再探索」を押してください。
        </p>
        {onResearch && <ResearchButton onResearch={onResearch} />}
      </div>
    );
  }

  // type === 'solved' | 'speculative'
  const isSpeculative = result.type === 'speculative';
  const cleared = result.moves.length > 0 && completedCount === result.moves.length;

  return (
    <div>
      {isSpeculative && (
        <div style={{ padding: '0.6rem 0.75rem', marginBottom: '0.75rem', background: 'color-mix(in srgb, orange 12%, transparent)', border: '1px solid orange', borderRadius: '6px', fontSize: '0.85rem', color: 'var(--text)' }}>
          ⚠️ <strong>推定手順：</strong>? の色を仮定して解いています。実際の色が違う場合は手順が変わります。
        </div>
      )}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
        <span style={{ fontWeight: 'bold', color: 'var(--text-h)' }}>
          手順 ({result.moves.length}ステップ)
        </span>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          {onResearch && isSpeculative && (
            <button
              onClick={onResearch}
              style={{ fontSize: '0.8rem', padding: '2px 10px', background: 'var(--app-btn-bg)', border: '1px solid var(--app-btn-border)', borderRadius: '4px', color: 'var(--text-h)', cursor: 'pointer' }}
            >
              この盤面から再探索
            </button>
          )}
          <button
            onClick={onReset}
            style={{ fontSize: '0.8rem', padding: '2px 10px', background: 'var(--app-btn-bg)', border: '1px solid var(--app-btn-border)', borderRadius: '4px', color: 'var(--text-h)', cursor: 'pointer' }}
          >
            リセット
          </button>
        </div>
      </div>
      {result.moves.length === 0 ? (
        <p style={{ color: 'var(--app-success)' }}>すでに解けています！</p>
      ) : (
        <MoveList
          moves={result.moves}
          completedCount={completedCount}
          onStepToggle={onStepToggle}
        />
      )}
      {cleared && <p className="clear-title">🎉 クリア！</p>}
    </div>
  );
}

function ResearchButton({ onResearch }: { onResearch: () => void }) {
  return (
    <button
      onClick={onResearch}
      style={{ marginTop: '0.75rem', fontSize: '0.85rem', padding: '4px 12px', background: 'var(--app-btn-bg)', border: '1px solid var(--app-btn-border)', borderRadius: '4px', color: 'var(--text-h)', cursor: 'pointer' }}
    >
      この盤面から再探索
    </button>
  );
}

function RestartButton({ onRestart }: { onRestart: () => void }) {
  return (
    <button
      onClick={onRestart}
      style={{ marginTop: '0.75rem', marginLeft: '0.5rem', fontSize: '0.85rem', padding: '4px 12px', background: 'var(--app-btn-bg)', border: '1px solid var(--app-btn-border)', borderRadius: '4px', color: 'var(--text-h)', cursor: 'pointer' }}
    >
      リスタート
    </button>
  );
}

function MoveList({
  moves,
  completedCount,
  onStepToggle,
}: {
  moves: Move[];
  completedCount: number;
  onStepToggle: (i: number) => void;
}) {
  return (
    <ol style={{ listStyle: 'none', padding: 0, margin: 0 }}>
      {moves.map((move, i) => {
        const done = i < completedCount;
        const current = i === completedCount;
        const disabled = i !== completedCount && i !== completedCount - 1;
        const specColor = move.isSpeculative ? 'orange' : undefined;
        return (
          <li key={i}>
            <label
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                padding: '6px 4px',
                cursor: disabled ? 'default' : 'pointer',
                opacity: done && disabled ? 0.25 : done ? 0.4 : 1,
                fontWeight: current ? 'bold' : 'normal',
                color: specColor ?? (current ? 'var(--app-link)' : 'var(--text)'),
                userSelect: 'none',
              }}
            >
              <input
                type="checkbox"
                checked={done}
                disabled={disabled}
                onChange={() => onStepToggle(i)}
                style={{ cursor: disabled ? 'default' : 'pointer', flexShrink: 0 }}
              />
              <span style={{ textDecoration: done ? 'line-through' : 'none' }}>
                {current ? '▶ ' : ''}
                {i + 1}. 試験管{move.from + 1} → 試験管{move.to + 1}
                {move.isSpeculative ? ' （推定）' : ''}
              </span>
              {move.revealsTube !== undefined && (
                <span style={{ fontSize: '0.85rem', color: 'var(--app-hint)', flexShrink: 0 }}>
                  ← 試験管{move.revealsTube + 1} の ? が判明
                </span>
              )}
            </label>
          </li>
        );
      })}
    </ol>
  );
}
