import { useState } from 'react';
import type { SolveResult, Move } from '../solver/types';

interface SolutionListProps {
  result: SolveResult | null;
  completedCount: number;
  onStepToggle: (index: number) => void;
  onReset: () => void;
  onSaveInitial?: (name: string) => void;
}

export function SolutionList({ result, completedCount, onStepToggle, onReset, onSaveInitial }: SolutionListProps) {
  if (!result) {
    return <p style={{ color: 'var(--app-muted)' }}>試験管を入力して「解く」を押してください</p>;
  }

  if (result.type === 'unsolvable') {
    return (
      <div>
        <p style={{ color: 'var(--app-error)', marginBottom: '0.5rem' }}>解が見つかりませんでした</p>
        <p style={{ fontSize: '0.85rem', color: 'var(--app-muted)' }}>
          {result.deep
            ? 'アイテム（空き試験管の追加など）を使用しないとクリアできない盤面の可能性があります。'
            : '深い探索モード（最大120秒）をオンにして再度「解く」を試してください。'}
        </p>
      </div>
    );
  }

  if (result.type === 'partial') {
    const hasMovesBeforeHint = result.moves.length > 0;
    return (
      <div>
        <p style={{ color: 'var(--app-warning)', marginBottom: '0.5rem' }}>
          未判明の色が多いため推定解を求められませんでした。まず ? を判明させてください。
        </p>
        {hasMovesBeforeHint && (
          <>
            <p style={{ fontSize: '0.9rem', marginBottom: '0.5rem' }}>? を露出させるための手順:</p>
            <MoveList
              moves={result.moves}
              completedCount={completedCount}
              onStepToggle={onStepToggle}
            />
          </>
        )}
        {result.revealHints.length > 0 && (
          <div style={{ marginTop: '1rem' }}>
            <p style={{ fontSize: '0.9rem', fontWeight: 'bold' }}>
              {hasMovesBeforeHint
                ? '上記の手順を実行後、以下の操作で ? が判明します:'
                : '? を判明させるには:'}
            </p>
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
        <button
          onClick={onReset}
          style={{ fontSize: '0.8rem', padding: '2px 10px', background: 'var(--app-btn-bg)', border: '1px solid var(--app-btn-border)', borderRadius: '4px', color: 'var(--text-h)', cursor: 'pointer' }}
        >
          リセット
        </button>
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
      {cleared && onSaveInitial && (
        <ClearSaveForm onSave={onSaveInitial} />
      )}
    </div>
  );
}

function ClearSaveForm({ onSave }: { onSave: (name: string) => void }) {
  const [name, setName] = useState('');
  const [saved, setSaved] = useState(false);

  const handleSave = () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    onSave(trimmed);
    setSaved(true);
  };

  return (
    <div className="clear-save">
      <p className="clear-title">🎉 クリア！</p>
      {saved ? (
        <p className="clear-saved-msg">保存しました ✓</p>
      ) : (
        <>
          <p className="clear-save-desc">初期状態を保存しておきますか？</p>
          <div className="save-input-row">
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && !e.nativeEvent.isComposing && handleSave()}
              placeholder="名前を入力（例: ステージ5-3）"
              className="save-name-input"
            />
            <button
              className="save-confirm-btn"
              onClick={handleSave}
              disabled={!name.trim()}
            >
              保存
            </button>
          </div>
        </>
      )}
    </div>
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
            </label>
          </li>
        );
      })}
    </ol>
  );
}
