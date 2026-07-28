# リカバリ・再探索・盤面クリア Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** reveal 時に解と途中盤面を維持し、「この盤面から再探索」ボタンでリカバリでき、盤面クリアボタンを追加し、途中盤面の `unsolvable` 文言を分け、クリア後保存を廃止する。

**Architecture:** 純関数 `detectReveal` で `?`→具体色 の入力を検知し、`App.tsx` の `handleTubesChange` でその編集時に盤面をリセットしないよう分岐する。`handleSolve` を `runSolve(board, isResearch)` に整理し、`SolutionList` の各結果表示に「この盤面から再探索」ボタンと `isResearch` 別文言を追加する。ソルバー（`bfs.ts` / worker / `SolveResult` 型）は変更しない。

**Tech Stack:** React 19 + TypeScript, Vitest, @testing-library/react, oxlint。

## Global Constraints

- ソルバー・worker・`src/solver/types.ts` の `SolveResult` 型は変更しない。
- 保存/読み込みモーダル（`SaveModal` / `useSaves`）は現状維持。廃止するのは「クリア後の盤面保存（`ClearSaveForm`）」のみ。
- 再探索ボタンのアクセシブル名は全箇所で厳密に `この盤面から再探索`（テストが依存）。
- クリアの確認は `window.confirm('盤面をクリアしますか？現在の入力は失われます。')`。
- UITube は上から下・長さ4。値は `"A"`–`"Z"` | `"?"`（不明）| `""`（空）。
- 各コミットのメッセージ末尾に付与：
  `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`

---

### Task 1: `detectReveal` 純関数

**Files:**
- Create: `src/reveal.ts`
- Test: `src/__tests__/reveal.test.ts`

**Interfaces:**
- Produces: `detectReveal(oldTubes: UITube[], nextTubes: UITube[]): boolean`
  - いずれかのセルが `'?'` → `''` でも `'?'` でもない具体色 に変化したとき `true`。

- [ ] **Step 1: 失敗するテストを書く**

`src/__tests__/reveal.test.ts`：

```ts
import { describe, test, expect } from 'vitest';
import { detectReveal } from '../reveal';
import type { UITube } from '../solver/types';

describe('detectReveal', () => {
  test('? が具体色へ変わったら true', () => {
    const oldTubes: UITube[] = [['A', '?', '', '']];
    const nextTubes: UITube[] = [['A', 'B', '', '']];
    expect(detectReveal(oldTubes, nextTubes)).toBe(true);
  });

  test('空セルへの初期入力は false', () => {
    const oldTubes: UITube[] = [['A', '', '', '']];
    const nextTubes: UITube[] = [['A', 'B', '', '']];
    expect(detectReveal(oldTubes, nextTubes)).toBe(false);
  });

  test('既知色の別色への訂正は false', () => {
    const oldTubes: UITube[] = [['A', 'B', '', '']];
    const nextTubes: UITube[] = [['A', 'C', '', '']];
    expect(detectReveal(oldTubes, nextTubes)).toBe(false);
  });

  test('変化なしは false', () => {
    const t: UITube[] = [['A', '?', '', '']];
    expect(detectReveal(t, t)).toBe(false);
  });

  test('? が空へ変わったら false', () => {
    const oldTubes: UITube[] = [['A', '?', '', '']];
    const nextTubes: UITube[] = [['A', '', '', '']];
    expect(detectReveal(oldTubes, nextTubes)).toBe(false);
  });
});
```

- [ ] **Step 2: テストが失敗することを確認**

Run: `npm run test:run -- src/__tests__/reveal.test.ts`
Expected: FAIL（`Cannot find module '../reveal'`）

- [ ] **Step 3: 実装する**

`src/reveal.ts`：

```ts
import type { UITube } from './solver/types';

// あるセルが編集前 '?' → 編集後に具体色（'' でも '?' でもない）へ変わったか。
// = 未判明の色が判明した（reveal）シグナル。
export function detectReveal(oldTubes: UITube[], nextTubes: UITube[]): boolean {
  for (let t = 0; t < oldTubes.length; t++) {
    const oldTube = oldTubes[t];
    const nextTube = nextTubes[t];
    if (!oldTube || !nextTube) continue;
    for (let c = 0; c < oldTube.length; c++) {
      if (oldTube[c] === '?' && nextTube[c] !== '?' && nextTube[c] !== '') {
        return true;
      }
    }
  }
  return false;
}
```

- [ ] **Step 4: テストが通ることを確認**

Run: `npm run test:run -- src/__tests__/reveal.test.ts`
Expected: PASS（5 tests）

- [ ] **Step 5: コミット**

```bash
git add src/reveal.ts src/__tests__/reveal.test.ts
git commit -m "feat: add detectReveal to detect ?-to-color reveals

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 2: `SolutionList` に再探索ボタンと `isResearch` 文言分岐を追加

**Files:**
- Modify: `src/components/SolutionList.tsx`
- Test: `src/__tests__/SolutionList.test.tsx`

**Interfaces:**
- Produces（`SolutionListProps` に追加）：
  - `onResearch?: () => void` — 「この盤面から再探索」押下時に呼ぶ。
  - `isResearch?: boolean` — `true` のとき `unsolvable` を途中盤面向け文言にする（既定 `false`）。
- Consumes: `detectReveal` は使わない（本タスクは表示のみ）。

このタスクでは `onSaveInitial` / `ClearSaveForm` は残す（削除は Task 3）。新規 props は
optional なので `App.tsx` は未変更でもコンパイルが通る。

- [ ] **Step 1: 失敗するテストを書く**

`src/__tests__/SolutionList.test.tsx` の import 行を差し替え、テストを追記する。

import 行（先頭）を次に変更：

```tsx
import { describe, test, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { SolutionList } from '../components/SolutionList';
import type { UITube } from '../solver/types';
```

ファイル末尾に追記：

```tsx
describe('SolutionList 再探索・文言分岐', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  test('speculative で再探索ボタンを表示し押下で onResearch を呼ぶ', () => {
    const onResearch = vi.fn();
    render(
      <SolutionList
        result={{ type: 'speculative', moves: [{ from: 0, to: 1 }] }}
        completedCount={0}
        boardTubes={knownTubes}
        onStepToggle={vi.fn()}
        onReset={vi.fn()}
        onResearch={onResearch}
      />
    );
    const btn = screen.getByRole('button', { name: 'この盤面から再探索' });
    fireEvent.click(btn);
    expect(onResearch).toHaveBeenCalledTimes(1);
  });

  test('partial で再探索ボタンを表示する', () => {
    render(
      <SolutionList
        result={{ type: 'partial', moves: [], revealHints: [] }}
        completedCount={0}
        boardTubes={knownTubes}
        onStepToggle={vi.fn()}
        onReset={vi.fn()}
        onResearch={vi.fn()}
      />
    );
    expect(screen.getByRole('button', { name: 'この盤面から再探索' })).toBeInTheDocument();
  });

  test('unsolvable かつ isResearch で途中盤面向け文言を出し共有ボタンを出さない', () => {
    vi.stubEnv('VITE_REPORT_ENDPOINT', 'https://example.com/exec');
    render(
      <SolutionList
        result={{ type: 'unsolvable' }}
        completedCount={0}
        boardTubes={knownTubes}
        onStepToggle={vi.fn()}
        onReset={vi.fn()}
        onResearch={vi.fn()}
        isResearch
      />
    );
    expect(
      screen.getByText(/この盤面（手順の途中）からは解が見つかりませんでした/)
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'この盤面を共有して改善に協力する' })
    ).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'この盤面から再探索' })).toBeInTheDocument();
  });

  test('unsolvable かつ isResearch=false は従来文言＋共有ボタン', () => {
    vi.stubEnv('VITE_REPORT_ENDPOINT', 'https://example.com/exec');
    render(
      <SolutionList
        result={{ type: 'unsolvable' }}
        completedCount={0}
        boardTubes={knownTubes}
        onStepToggle={vi.fn()}
        onReset={vi.fn()}
      />
    );
    expect(screen.getByText('解が見つかりませんでした')).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'この盤面を共有して改善に協力する' })
    ).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: テストが失敗することを確認**

Run: `npm run test:run -- src/__tests__/SolutionList.test.tsx`
Expected: FAIL（`onResearch` 未対応でボタンが見つからない等）

- [ ] **Step 3: `SolutionList` を実装する**

props インターフェースを変更（`onResearch` / `isResearch` を追加）：

```tsx
interface SolutionListProps {
  result: SolveResult | null;
  completedCount: number;
  boardTubes: UITube[];
  onStepToggle: (index: number) => void;
  onReset: () => void;
  onResearch?: () => void;
  isResearch?: boolean;
  onSaveInitial?: (name: string) => void;
}
```

関数シグネチャの分割代入に `onResearch, isResearch` を追加：

```tsx
export function SolutionList({ result, completedCount, boardTubes, onStepToggle, onReset, onResearch, isResearch, onSaveInitial }: SolutionListProps) {
```

`unsolvable` 分岐（現在の `if (result.type === 'unsolvable') { ... }` ブロック全体）を次に置換：

```tsx
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
      </div>
    );
  }
```

`partial` 分岐の閉じ `</div>` 直前（`revealHints` ブロックの後）に再探索ボタンを追加：

```tsx
        {onResearch && <ResearchButton onResearch={onResearch} />}
      </div>
    );
  }
```

`speculative | solved` のヘッダ部分（`手順 (...)` の `span` と「リセット」`button` を含む
`div`）を次に置換して、再探索ボタンをリセットの隣に追加：

```tsx
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
        <span style={{ fontWeight: 'bold', color: 'var(--text-h)' }}>
          手順 ({result.moves.length}ステップ)
        </span>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          {onResearch && (
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
```

`MoveList` の定義の直前（`function MoveList` の上）に `ResearchButton` を追加：

```tsx
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
```

- [ ] **Step 4: テストが通ることを確認**

Run: `npm run test:run -- src/__tests__/SolutionList.test.tsx`
Expected: PASS（既存 2 + 追加 4）

- [ ] **Step 5: 型チェック**

Run: `npx tsc -b`
Expected: エラーなし（`App.tsx` は optional 追加のみなので影響なし）

- [ ] **Step 6: コミット**

```bash
git add src/components/SolutionList.tsx src/__tests__/SolutionList.test.tsx
git commit -m "feat: add re-search button and research-unsolvable messaging to SolutionList

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 3: クリア後保存（`ClearSaveForm`）を削除しメッセージのみ残す

**Files:**
- Modify: `src/components/SolutionList.tsx`
- Modify: `src/App.tsx`（`onSaveInitial` prop の受け渡し削除）
- Test: `src/__tests__/SolutionList.test.tsx`

**Interfaces:**
- Produces: `SolutionListProps` から `onSaveInitial` を削除。クリア時は `🎉 クリア！` の
  テキストのみ表示（保存入力欄なし）。

- [ ] **Step 1: 失敗するテストを書く**

`src/__tests__/SolutionList.test.tsx` の `describe('SolutionList 再探索・文言分岐', ...)`
内に追記：

```tsx
  test('クリア済み solved はメッセージのみで保存欄が無い', () => {
    render(
      <SolutionList
        result={{ type: 'solved', moves: [{ from: 0, to: 1 }] }}
        completedCount={1}
        boardTubes={knownTubes}
        onStepToggle={vi.fn()}
        onReset={vi.fn()}
      />
    );
    expect(screen.getByText('🎉 クリア！')).toBeInTheDocument();
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '保存' })).not.toBeInTheDocument();
  });
```

- [ ] **Step 2: テストが失敗することを確認**

Run: `npm run test:run -- src/__tests__/SolutionList.test.tsx`
Expected: FAIL（現状は `ClearSaveForm` が `onSaveInitial` 無しで何も出さず「🎉 クリア！」が見つからない）

- [ ] **Step 3: `SolutionList` から `ClearSaveForm` を削除**

先頭の import を変更（`useState` は不要になる）：

```tsx
import type { SolveResult, Move, UITube } from '../solver/types';
import { ReportBoardSection } from './ReportBoardSection';
```

`SolutionListProps` から `onSaveInitial` を削除：

```tsx
interface SolutionListProps {
  result: SolveResult | null;
  completedCount: number;
  boardTubes: UITube[];
  onStepToggle: (index: number) => void;
  onReset: () => void;
  onResearch?: () => void;
  isResearch?: boolean;
}
```

関数シグネチャの分割代入から `onSaveInitial` を削除：

```tsx
export function SolutionList({ result, completedCount, boardTubes, onStepToggle, onReset, onResearch, isResearch }: SolutionListProps) {
```

`speculative | solved` の描画末尾、現在の

```tsx
      {cleared && onSaveInitial && (
        <ClearSaveForm onSave={onSaveInitial} />
      )}
```

を次に置換：

```tsx
      {cleared && <p className="clear-title">🎉 クリア！</p>}
```

`ClearSaveForm` 関数定義（`function ClearSaveForm(...) { ... }` 全体）を削除する。

- [ ] **Step 4: `App.tsx` の受け渡しを削除**

`src/App.tsx` の `SolutionList` 使用箇所から `onSaveInitial` 行を削除：

削除前：
```tsx
            <SolutionList
              result={result}
              completedCount={completedCount}
              boardTubes={initialTubes ?? tubes}
              onStepToggle={handleStepToggle}
              onReset={handleReset}
              onSaveInitial={name => save(name, initialTubes ?? tubes)}
            />
```

削除後：
```tsx
            <SolutionList
              result={result}
              completedCount={completedCount}
              boardTubes={initialTubes ?? tubes}
              onStepToggle={handleStepToggle}
              onReset={handleReset}
            />
```

- [ ] **Step 5: テスト・型チェック**

Run: `npm run test:run -- src/__tests__/SolutionList.test.tsx`
Expected: PASS

Run: `npx tsc -b`
Expected: エラーなし（`save` は `SaveModal` で引き続き使用され未使用にならない）

- [ ] **Step 6: コミット**

```bash
git add src/components/SolutionList.tsx src/App.tsx src/__tests__/SolutionList.test.tsx
git commit -m "feat: drop post-clear board-save form, keep clear message

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 4: `App.tsx` の配線（runSolve・reveal 維持・クリア・再探索）

**Files:**
- Modify: `src/App.tsx`

**Interfaces:**
- Consumes: `detectReveal`（Task 1）、`SolutionList` の `onResearch` / `isResearch`（Task 2）。
- Produces: `runSolve(board: UITube[], isResearch: boolean): void`（内部関数）。

worker 依存のため自動テストは追加せず、実装後にビルド・lint・アプリ手動 verify で確認する。

- [ ] **Step 1: `detectReveal` を import する**

`src/App.tsx` の import 群に追加：

```tsx
import { detectReveal } from './reveal';
```

- [ ] **Step 2: `resultIsResearch` 状態を追加**

`const [deepThreshold, setDeepThreshold] = useState(0);` の直後に追加：

```tsx
  const [resultIsResearch, setResultIsResearch] = useState(false);
```

- [ ] **Step 3: `resetProgress` に `resultIsResearch` リセットを追加**

```tsx
  const resetProgress = () => {
    setCompletedCount(0);
    setInitialTubes(null);
    setResultIsResearch(false);
  };
```

- [ ] **Step 4: `handleSolve` を `runSolve(board, isResearch)` に整理**

現在の `const handleSolve = () => { ... };` 全体（`App.tsx` の該当関数）を次に置換：

```tsx
  const runSolve = (board: UITube[], isResearch: boolean) => {
    const validationError = validateTubes(board);
    if (validationError) {
      setError(validationError);
      setResult(null);
      return;
    }
    setError(null);
    setResult(null);
    setCompletedCount(0);
    setInitialTubes(board);
    setResultIsResearch(isResearch);

    if (deepMode) {
      workerRef.current?.terminate();
      deepWorkerRef.current?.terminate();
      setDeepSolving(true);
      setDeepThreshold(0);

      const deepWorker = new Worker(
        new URL('./solver/deep-solver.worker.ts', import.meta.url),
        { type: 'module' },
      );
      deepWorkerRef.current = deepWorker;

      deepWorker.onmessage = (e: MessageEvent<DeepWorkerOutMessage>) => {
        const msg = e.data;
        if (msg.type === 'progress') {
          setDeepThreshold(msg.threshold);
        } else {
          setDeepSolving(false);
          setResult(msg.moves ? { type: 'solved', moves: msg.moves } : { type: 'unsolvable', deep: true });
          deepWorker.terminate();
        }
      };
      deepWorker.onerror = () => {
        setDeepSolving(false);
        setResult({ type: 'unsolvable', deep: true });
        deepWorker.terminate();
      };
      deepWorker.postMessage(board);
      return;
    }

    setSolving(true);
    setSolverStates(0);
    workerRef.current?.terminate();
    const worker = new Worker(
      new URL('./solver/solver.worker.ts', import.meta.url),
      { type: 'module' },
    );
    workerRef.current = worker;

    worker.onmessage = (e: MessageEvent<WorkerOutMessage>) => {
      const msg = e.data;
      if (msg.type === 'progress') {
        setSolverStates(msg.states);
      } else {
        setResult(msg.result);
        setSolving(false);
        worker.terminate();
      }
    };

    worker.onerror = () => {
      setError('内部エラーが発生しました');
      setSolving(false);
      worker.terminate();
    };

    worker.postMessage(board);
  };

  const handleSolve = () => runSolve(tubes, false);
```

- [ ] **Step 5: `handleTubesChange` に reveal 維持分岐を追加**

`const handleTubesChange = (newTubes: UITube[]) => {` の直後、
`setError(validateColorCounts(newTubes));` の直後に追加：

```tsx
    // reveal（? を具体色へ確定入力）なら、解・進捗を消さず盤面へ反映するだけ。
    // 推測が当たっていれば継続、外れていれば「この盤面から再探索」でリカバリする。
    if (result && detectReveal(tubes, newTubes)) {
      setTubes(newTubes);
      return;
    }
```

- [ ] **Step 6: `handleClear` を追加**

`handleReset` の定義の直後に追加：

```tsx
  const handleClear = () => {
    const hasContent = tubes.some(tube => tube.some(c => c !== ''));
    if (hasContent && !window.confirm('盤面をクリアしますか？現在の入力は失われます。')) return;
    setTubes(makeEmptyTubes(tubeCount));
    setResult(null);
    setError(null);
    setCompletedCount(0);
    setInitialTubes(null);
    setResultIsResearch(false);
    setSimHistory([]);
  };
```

- [ ] **Step 7: クリアボタンを action-row に追加（両モード）**

ソルバーモードの `action-row`（`解く` ボタンを含む `div`）末尾、
`状態をコピー` の localhost ブロックの直後に追加：

```tsx
                <button className="save-load-btn" onClick={handleClear}>
                  クリア
                </button>
```

シミュレーションモードの `action-row`（`保存 / 読み込み` のみの `div`）にも追加：

```tsx
            <div className="action-row">
              <button className="save-load-btn" onClick={() => setShowSaveModal(true)}>
                保存 / 読み込み
              </button>
              <button className="save-load-btn" onClick={handleClear}>
                クリア
              </button>
            </div>
```

- [ ] **Step 8: `SolutionList` に `onResearch` / `isResearch` を渡す**

（Task 3 で `onSaveInitial` は削除済み）`SolutionList` 使用箇所を次にする：

```tsx
            <SolutionList
              result={result}
              completedCount={completedCount}
              boardTubes={initialTubes ?? tubes}
              onStepToggle={handleStepToggle}
              onReset={handleReset}
              onResearch={() => runSolve(tubes, true)}
              isResearch={resultIsResearch}
            />
```

- [ ] **Step 9: 全テスト・型チェック・lint**

Run: `npm run test:run`
Expected: 全 PASS

Run: `npx tsc -b`
Expected: エラーなし

Run: `npm run lint`
Expected: exit 0

- [ ] **Step 10: アプリ手動 verify**

Run: `npm run dev`（別ターミナル）。ブラウザで以下を確認：

1. `?` を含む盤面を「解く」→ 推定解が出る。手順を少し進め、`?` マスに色を入力しても
   盤面がリセットされず、解・チェック位置が保たれる。
2. 推定解パネル／部分解パネルに「この盤面から再探索」があり、押すと現在盤面から解き直す。
3. 途中盤面で再探索して解なしのとき、「この盤面（手順の途中）から…アイテムなしで解ける
   可能性…」の文言が出て、共有ボタンは出ない。初回 solve の解なしは従来文言＋共有ボタン。
4. 「クリア」ボタン：入力があると確認ダイアログ、OK で本数維持のまま空になる。
5. クリア達成時に「🎉 クリア！」が出て、保存入力欄は無い。保存/読み込みモーダルは従来通り動く。

- [ ] **Step 11: コミット**

```bash
git add src/App.tsx
git commit -m "feat: wire re-search, reveal-preservation, and clear button into App

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## 完了条件

- `npm run test:run` 全 PASS、`npx tsc -b` エラーなし、`npm run lint` exit 0。
- reveal 時に盤面・解が維持される。「この盤面から再探索」で現在盤面から解き直せる。
- クリアボタンで盤面を空にできる（本数維持・確認あり）。
- 途中盤面の `unsolvable` は専用文言・共有ボタン非表示。
- クリア後保存は廃止、達成メッセージは残存。
