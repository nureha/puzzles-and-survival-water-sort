# 盤面レポート機能 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 「アイテムを使わないと解けない」と判断された盤面（`?` を含まず、解が見つからない盤面）について、ユーザーが1クリックで盤面情報を開発者へ送信できるボタンを `SolutionList` に追加する。

**Architecture:** クライアントは環境変数 `VITE_REPORT_ENDPOINT`（ビルド時にのみ注入、パブリックリポジトリのフォーク先には渡らない）で指定されたGoogle Apps Script Web App URLへ `fetch` でPOSTする。GAS側はバリデーションのみでスプレッドシートに1行追記する（GitHub API・PAT・Issue作成は使わない）。送信先が未設定または盤面に `?` が残っている場合はUI自体を非表示にする。

**Tech Stack:** React, TypeScript, Vite, Vitest, Testing Library, Google Apps Script

## Global Constraints

- 送信先URLはソースにハードコードしない。`import.meta.env.VITE_REPORT_ENDPOINT` からのみ取得する
- `fetch` のリクエストに `Content-Type` ヘッダーを明示的に指定しない（CORS preflightを避けるため。デフォルトの `text/plain` になる）
- 送信データは `{ board: string, mode: '通常探索' | '深い探索（120秒）' }` のみ。個人情報・ブラウザ情報は含めない
- GitHub API・PAT・Issue作成は行わない
- レート制限・件数上限は実装しない（GAS側のバリデーションのみで対応する）
- 表示条件: `result.type === 'unsolvable'` であること、かつ対象盤面（`initialTubes ?? tubes`）に `'?'` が含まれないこと、かつ `VITE_REPORT_ENDPOINT` が設定されていること。3つすべてを満たさない場合はUIを一切表示しない
- 既存コードのインデント・命名規則（camelCase、`UITube`型、`var(--app-*)` CSS変数によるテーマ対応）に従う

---

### Task 1: `formatTubes` の共通化

**Files:**
- Create: `src/report/formatBoard.ts`
- Test: `src/__tests__/formatBoard.test.ts`
- Modify: `src/App.tsx:270-275`（`handleCopyState` 内のインライン関数を削除し、importに置き換える）

**Interfaces:**
- Produces: `formatTubes(tubes: UITube[]): string` — 各チューブを上から順に色を連結し、空チューブは `'空'`、チューブ間は `', '` で連結した文字列を返す

- [ ] **Step 1: 失敗するテストを書く**

`src/__tests__/formatBoard.test.ts` を作成する:

```typescript
import { describe, test, expect } from 'vitest';
import { formatTubes } from '../report/formatBoard';
import type { UITube } from '../solver/types';

describe('formatTubes', () => {
  test('空のチューブは「空」と表示する', () => {
    const tubes: UITube[] = [['', '', '', '']];
    expect(formatTubes(tubes)).toBe('空');
  });

  test('入っている色を上から順に連結する', () => {
    const tubes: UITube[] = [['A', 'B', '', '']];
    expect(formatTubes(tubes)).toBe('AB');
  });

  test('複数チューブをカンマ区切りで連結する', () => {
    const tubes: UITube[] = [
      ['A', 'B', '', ''],
      ['', '', '', ''],
      ['C', 'D', 'C', 'D'],
    ];
    expect(formatTubes(tubes)).toBe('AB, 空, CDCD');
  });
});
```

- [ ] **Step 2: テストが失敗することを確認する**

Run: `npm run test:run -- src/__tests__/formatBoard.test.ts`
Expected: FAIL（`Cannot find module '../report/formatBoard'`）

- [ ] **Step 3: `src/report/formatBoard.ts` を実装する**

```typescript
import type { UITube } from '../solver/types';

export function formatTubes(tubes: UITube[]): string {
  return tubes
    .map(tube => {
      const cells = tube.filter(cell => cell !== '');
      return cells.length === 0 ? '空' : cells.join('');
    })
    .join(', ');
}
```

- [ ] **Step 4: テストが通ることを確認する**

Run: `npm run test:run -- src/__tests__/formatBoard.test.ts`
Expected: PASS（3 tests）

- [ ] **Step 5: `App.tsx` の重複実装を置き換える**

`src/App.tsx` の先頭 import 群（`import { inferUnknowns } from './solver/infer';` の下）に追加:

```typescript
import { formatTubes } from './report/formatBoard';
```

`handleCopyState` 内（現状 `src/App.tsx:270-275` 付近）:

変更前:
```typescript
  const handleCopyState = () => {
    const formatTubes = (ts: UITube[]) =>
      ts.map(t => {
        const cells = t.filter(c => c !== '');
        return cells.length === 0 ? '空' : cells.join('');
      }).join(', ');

    const lines: string[] = [];
```

変更後:
```typescript
  const handleCopyState = () => {
    const lines: string[] = [];
```

（`formatTubes` の呼び出し箇所 `formatTubes(initialTubes)` / `formatTubes(tubes)` はそのまま変更不要。import した関数が使われる）

- [ ] **Step 6: 既存テストスイートが全て通ることを確認する**

Run: `npm run test:run`
Expected: 全テスト PASS

- [ ] **Step 7: コミット**

```bash
git add src/report/formatBoard.ts src/__tests__/formatBoard.test.ts src/App.tsx
git commit -m "refactor: extract formatTubes into shared report/formatBoard module"
```

---

### Task 2: 送信ロジック `reportBoard.ts`

**Files:**
- Create: `src/report/reportBoard.ts`
- Create: `src/vite-env.d.ts`
- Test: `src/__tests__/reportBoard.test.ts`

**Interfaces:**
- Consumes: なし（`import.meta.env.VITE_REPORT_ENDPOINT`、グローバル `fetch` のみ）
- Produces:
  - `type ReportMode = '通常探索' | '深い探索（120秒）'`
  - `getReportEndpoint(): string | undefined`
  - `isReportEnabled(): boolean`
  - `submitBoardReport(board: string, mode: ReportMode): Promise<boolean>`

- [ ] **Step 1: 失敗するテストを書く**

`src/__tests__/reportBoard.test.ts` を作成する:

```typescript
import { describe, test, expect, vi, afterEach } from 'vitest';
import { getReportEndpoint, isReportEnabled, submitBoardReport } from '../report/reportBoard';

describe('reportBoard', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  test('VITE_REPORT_ENDPOINT が未設定なら isReportEnabled は false', () => {
    vi.stubEnv('VITE_REPORT_ENDPOINT', '');
    expect(isReportEnabled()).toBe(false);
  });

  test('VITE_REPORT_ENDPOINT が設定されていれば取得でき isReportEnabled は true', () => {
    vi.stubEnv('VITE_REPORT_ENDPOINT', 'https://example.com/exec');
    expect(getReportEndpoint()).toBe('https://example.com/exec');
    expect(isReportEnabled()).toBe(true);
  });

  test('未設定の場合 submitBoardReport は fetch せず false を返す', async () => {
    vi.stubEnv('VITE_REPORT_ENDPOINT', '');
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    const result = await submitBoardReport('AB, 空', '通常探索');

    expect(result).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  test('送信成功時は true を返し、Content-Type を指定しないPOSTを送る', async () => {
    vi.stubEnv('VITE_REPORT_ENDPOINT', 'https://example.com/exec');
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ ok: true }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const result = await submitBoardReport('AB, 空', '通常探索');

    expect(result).toBe(true);
    expect(fetchMock).toHaveBeenCalledWith('https://example.com/exec', {
      method: 'POST',
      body: JSON.stringify({ board: 'AB, 空', mode: '通常探索' }),
    });
    const [, options] = fetchMock.mock.calls[0];
    expect(options.headers).toBeUndefined();
  });

  test('レスポンスの ok が false の場合は false を返す', async () => {
    vi.stubEnv('VITE_REPORT_ENDPOINT', 'https://example.com/exec');
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ ok: false }),
    }));

    expect(await submitBoardReport('AB', '通常探索')).toBe(false);
  });

  test('HTTPステータスが失敗の場合は false を返す', async () => {
    vi.stubEnv('VITE_REPORT_ENDPOINT', 'https://example.com/exec');
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      json: async () => ({ ok: true }),
    }));

    expect(await submitBoardReport('AB', '通常探索')).toBe(false);
  });

  test('fetch が例外を投げた場合は false を返す', async () => {
    vi.stubEnv('VITE_REPORT_ENDPOINT', 'https://example.com/exec');
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network error')));

    expect(await submitBoardReport('AB', '通常探索')).toBe(false);
  });
});
```

- [ ] **Step 2: テストが失敗することを確認する**

Run: `npm run test:run -- src/__tests__/reportBoard.test.ts`
Expected: FAIL（`Cannot find module '../report/reportBoard'`）

- [ ] **Step 3: `src/vite-env.d.ts` を作成する**

```typescript
/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_REPORT_ENDPOINT?: string;
}
```

- [ ] **Step 4: `src/report/reportBoard.ts` を実装する**

```typescript
export type ReportMode = '通常探索' | '深い探索（120秒）';

export function getReportEndpoint(): string | undefined {
  return import.meta.env.VITE_REPORT_ENDPOINT;
}

export function isReportEnabled(): boolean {
  return Boolean(getReportEndpoint());
}

export async function submitBoardReport(board: string, mode: ReportMode): Promise<boolean> {
  const endpoint = getReportEndpoint();
  if (!endpoint) return false;

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      body: JSON.stringify({ board, mode }),
    });
    if (!response.ok) return false;
    const data: unknown = await response.json();
    return typeof data === 'object' && data !== null && (data as { ok?: unknown }).ok === true;
  } catch {
    return false;
  }
}
```

- [ ] **Step 5: テストが通ることを確認する**

Run: `npm run test:run -- src/__tests__/reportBoard.test.ts`
Expected: PASS（7 tests）

- [ ] **Step 6: コミット**

```bash
git add src/report/reportBoard.ts src/vite-env.d.ts src/__tests__/reportBoard.test.ts
git commit -m "feat: add submitBoardReport for env-gated board reporting"
```

---

### Task 3: `ReportBoardSection` コンポーネント

**Files:**
- Create: `src/components/ReportBoardSection.tsx`
- Test: `src/__tests__/ReportBoardSection.test.tsx`
- Modify: `src/App.css`（末尾に新規CSSブロックを追加）

**Interfaces:**
- Consumes: `formatTubes` from `src/report/formatBoard.ts`, `isReportEnabled` / `submitBoardReport` / `ReportMode` from `src/report/reportBoard.ts`, `UITube` from `src/solver/types.ts`
- Produces: `ReportBoardSection({ tubes: UITube[], deep?: boolean }): JSX.Element | null`

- [ ] **Step 1: 失敗するテストを書く**

`src/__tests__/ReportBoardSection.test.tsx` を作成する:

```typescript
import { describe, test, expect, vi, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ReportBoardSection } from '../components/ReportBoardSection';
import type { UITube } from '../solver/types';

const knownTubes: UITube[] = [['A', 'B', '', '']];
const unknownTubes: UITube[] = [['A', '?', '?', '?']];

describe('ReportBoardSection', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  test('送信先が未設定なら何も表示しない', () => {
    vi.stubEnv('VITE_REPORT_ENDPOINT', '');
    render(<ReportBoardSection tubes={knownTubes} />);
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  test('盤面に ? が残っている場合は表示しない', () => {
    vi.stubEnv('VITE_REPORT_ENDPOINT', 'https://example.com/exec');
    render(<ReportBoardSection tubes={unknownTubes} />);
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  test('条件を満たすとボタンを表示し、クリックで確認表示に切り替わる', async () => {
    vi.stubEnv('VITE_REPORT_ENDPOINT', 'https://example.com/exec');
    const user = userEvent.setup();
    render(<ReportBoardSection tubes={knownTubes} />);

    await user.click(screen.getByRole('button', { name: 'この盤面を共有して改善に協力する' }));

    expect(screen.getByText('盤面情報を開発者に送信します。送信すると元に戻せません。')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '送信する' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'キャンセル' })).toBeInTheDocument();
  });

  test('キャンセルすると初期状態に戻る', async () => {
    vi.stubEnv('VITE_REPORT_ENDPOINT', 'https://example.com/exec');
    const user = userEvent.setup();
    render(<ReportBoardSection tubes={knownTubes} />);

    await user.click(screen.getByRole('button', { name: 'この盤面を共有して改善に協力する' }));
    await user.click(screen.getByRole('button', { name: 'キャンセル' }));

    expect(screen.getByRole('button', { name: 'この盤面を共有して改善に協力する' })).toBeInTheDocument();
  });

  test('送信成功時に完了メッセージを表示する', async () => {
    vi.stubEnv('VITE_REPORT_ENDPOINT', 'https://example.com/exec');
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ ok: true }) }));
    const user = userEvent.setup();
    render(<ReportBoardSection tubes={knownTubes} />);

    await user.click(screen.getByRole('button', { name: 'この盤面を共有して改善に協力する' }));
    await user.click(screen.getByRole('button', { name: '送信する' }));

    expect(await screen.findByText('送信しました。ご協力ありがとうございます！')).toBeInTheDocument();
  });

  test('送信失敗時にエラーメッセージと再送信ボタンを表示する', async () => {
    vi.stubEnv('VITE_REPORT_ENDPOINT', 'https://example.com/exec');
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network error')));
    const user = userEvent.setup();
    render(<ReportBoardSection tubes={knownTubes} />);

    await user.click(screen.getByRole('button', { name: 'この盤面を共有して改善に協力する' }));
    await user.click(screen.getByRole('button', { name: '送信する' }));

    expect(await screen.findByText('送信に失敗しました。時間をおいて再度お試しください。')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '送信する' })).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: テストが失敗することを確認する**

Run: `npm run test:run -- src/__tests__/ReportBoardSection.test.tsx`
Expected: FAIL（`Cannot find module '../components/ReportBoardSection'`）

- [ ] **Step 3: `src/components/ReportBoardSection.tsx` を実装する**

```typescript
import { useState } from 'react';
import type { UITube } from '../solver/types';
import { formatTubes } from '../report/formatBoard';
import { isReportEnabled, submitBoardReport } from '../report/reportBoard';
import type { ReportMode } from '../report/reportBoard';

interface ReportBoardSectionProps {
  tubes: UITube[];
  deep?: boolean;
}

type Status = 'idle' | 'confirm' | 'sending' | 'sent' | 'error';

export function ReportBoardSection({ tubes, deep }: ReportBoardSectionProps) {
  const [status, setStatus] = useState<Status>('idle');

  if (!isReportEnabled()) return null;
  if (tubes.some(tube => tube.includes('?'))) return null;

  const handleSubmit = async () => {
    setStatus('sending');
    const mode: ReportMode = deep ? '深い探索（120秒）' : '通常探索';
    const success = await submitBoardReport(formatTubes(tubes), mode);
    setStatus(success ? 'sent' : 'error');
  };

  if (status === 'sent') {
    return <p className="report-board-sent-msg">送信しました。ご協力ありがとうございます！</p>;
  }

  return (
    <div className="report-board">
      {status === 'idle' ? (
        <button className="report-board-btn" onClick={() => setStatus('confirm')}>
          この盤面を共有して改善に協力する
        </button>
      ) : (
        <>
          <p className="report-board-desc">盤面情報を開発者に送信します。送信すると元に戻せません。</p>
          {status === 'error' && (
            <p className="report-board-error">送信に失敗しました。時間をおいて再度お試しください。</p>
          )}
          <div className="report-board-actions">
            <button className="report-board-btn" onClick={handleSubmit} disabled={status === 'sending'}>
              {status === 'sending' ? '送信中...' : '送信する'}
            </button>
            <button
              className="report-board-cancel-btn"
              onClick={() => setStatus('idle')}
              disabled={status === 'sending'}
            >
              キャンセル
            </button>
          </div>
        </>
      )}
    </div>
  );
}
```

- [ ] **Step 4: `src/App.css` の末尾に新規CSSブロックを追加する**

ファイル末尾に追加:

```css
/* ── Report board ── */

.report-board {
  margin-top: 1rem;
  padding: 0.85rem 1rem;
  border: 1px solid var(--app-btn-border);
  border-radius: 8px;
  background: var(--app-btn-bg);
}

.report-board-btn {
  padding: 0.45rem 1rem;
  font-size: 0.9rem;
  background: #0055cc;
  color: white;
  border: none;
  border-radius: 6px;
  cursor: pointer;
}

.report-board-btn:hover:not(:disabled) {
  background: #0044aa;
}

.report-board-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.report-board-desc {
  font-size: 0.85rem;
  color: var(--text);
  margin: 0 0 0.6rem;
}

.report-board-error {
  font-size: 0.85rem;
  color: var(--app-error);
  margin: 0 0 0.6rem;
}

.report-board-actions {
  display: flex;
  gap: 0.5rem;
}

.report-board-cancel-btn {
  padding: 0.45rem 1rem;
  font-size: 0.9rem;
  background: none;
  color: var(--app-muted);
  border: 1px solid var(--app-btn-border);
  border-radius: 6px;
  cursor: pointer;
}

.report-board-cancel-btn:hover:not(:disabled) {
  background: var(--app-btn-bg);
  color: var(--text-h);
}

.report-board-sent-msg {
  font-size: 0.9rem;
  color: var(--app-success);
  margin: 0;
}
```

- [ ] **Step 5: テストが通ることを確認する**

Run: `npm run test:run -- src/__tests__/ReportBoardSection.test.tsx`
Expected: PASS（6 tests）

- [ ] **Step 6: コミット**

```bash
git add src/components/ReportBoardSection.tsx src/__tests__/ReportBoardSection.test.tsx src/App.css
git commit -m "feat: add ReportBoardSection component"
```

---

### Task 4: `SolutionList` / `App.tsx` への組み込み

**Files:**
- Modify: `src/components/SolutionList.tsx:1-28`
- Modify: `src/App.tsx`（`<SolutionList .../>` の呼び出し箇所）
- Test: `src/__tests__/SolutionList.test.tsx`

**Interfaces:**
- Consumes: `ReportBoardSection` from `src/components/ReportBoardSection.tsx`
- Produces: `SolutionListProps` に `boardTubes: UITube[]` を追加

- [ ] **Step 1: 失敗するテストを書く**

`src/__tests__/SolutionList.test.tsx` を作成する:

```typescript
import { describe, test, expect, vi, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { SolutionList } from '../components/SolutionList';
import type { UITube } from '../solver/types';

const knownTubes: UITube[] = [['A', 'B', '', '']];

describe('SolutionList unsolvable branch', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  test('解なし判定かつ送信先が設定済みならレポートボタンを表示する', () => {
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

    expect(screen.getByRole('button', { name: 'この盤面を共有して改善に協力する' })).toBeInTheDocument();
  });

  test('解が見つかった場合はレポートボタンを表示しない', () => {
    vi.stubEnv('VITE_REPORT_ENDPOINT', 'https://example.com/exec');
    render(
      <SolutionList
        result={{ type: 'solved', moves: [] }}
        completedCount={0}
        boardTubes={knownTubes}
        onStepToggle={vi.fn()}
        onReset={vi.fn()}
      />
    );

    expect(screen.queryByRole('button', { name: 'この盤面を共有して改善に協力する' })).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 2: テストが失敗することを確認する**

Run: `npm run test:run -- src/__tests__/SolutionList.test.tsx`
Expected: FAIL（`boardTubes` が必須propとして型エラー、または実行時にレポートボタンが見つからない）

- [ ] **Step 3: `SolutionList.tsx` を変更する**

`src/components/SolutionList.tsx` の先頭import群を変更:

変更前:
```typescript
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
```

変更後:
```typescript
import { useState } from 'react';
import type { SolveResult, Move, UITube } from '../solver/types';
import { ReportBoardSection } from './ReportBoardSection';

interface SolutionListProps {
  result: SolveResult | null;
  completedCount: number;
  boardTubes: UITube[];
  onStepToggle: (index: number) => void;
  onReset: () => void;
  onSaveInitial?: (name: string) => void;
}

export function SolutionList({ result, completedCount, boardTubes, onStepToggle, onReset, onSaveInitial }: SolutionListProps) {
```

`unsolvable` 分岐（`src/components/SolutionList.tsx:17-28` 付近）を変更:

変更前:
```typescript
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
```

変更後:
```typescript
  if (result.type === 'unsolvable') {
    return (
      <div>
        <p style={{ color: 'var(--app-error)', marginBottom: '0.5rem' }}>解が見つかりませんでした</p>
        <p style={{ fontSize: '0.85rem', color: 'var(--app-muted)' }}>
          {result.deep
            ? 'アイテム（空き試験管の追加など）を使用しないとクリアできない盤面の可能性があります。'
            : '深い探索モード（最大120秒）をオンにして再度「解く」を試してください。'}
        </p>
        <ReportBoardSection tubes={boardTubes} deep={result.deep} />
      </div>
    );
  }
```

- [ ] **Step 4: `App.tsx` の呼び出し箇所を変更する**

`src/App.tsx` の `<SolutionList .../>`（約404行目付近）:

変更前:
```typescript
            <SolutionList
              result={result}
              completedCount={completedCount}
              onStepToggle={handleStepToggle}
              onReset={handleReset}
              onSaveInitial={name => save(name, initialTubes ?? tubes)}
            />
```

変更後:
```typescript
            <SolutionList
              result={result}
              completedCount={completedCount}
              boardTubes={initialTubes ?? tubes}
              onStepToggle={handleStepToggle}
              onReset={handleReset}
              onSaveInitial={name => save(name, initialTubes ?? tubes)}
            />
```

- [ ] **Step 5: テストが通ることを確認する**

Run: `npm run test:run -- src/__tests__/SolutionList.test.tsx`
Expected: PASS（2 tests）

- [ ] **Step 6: 既存テストスイート全体が通ることを確認する**

Run: `npm run test:run`
Expected: 全テスト PASS

- [ ] **Step 7: コミット**

```bash
git add src/components/SolutionList.tsx src/App.tsx src/__tests__/SolutionList.test.tsx
git commit -m "feat: wire ReportBoardSection into SolutionList unsolvable branch"
```

---

### Task 5: CI/ビルド設定

**Files:**
- Create: `.env.example`
- Modify: `.github/workflows/deploy.yml`

**Interfaces:**
- Consumes: `VITE_REPORT_ENDPOINT`（GitHub Actions repository secret）

- [ ] **Step 1: `.env.example` を作成する**

```
VITE_REPORT_ENDPOINT=
```

- [ ] **Step 2: `.github/workflows/deploy.yml` のビルドステップに環境変数を渡す**

変更前:
```yaml
      - run: npx tsc -b && npx vite build --base=/${{ github.event.repository.name }}/
```

変更後:
```yaml
      - run: npx tsc -b && npx vite build --base=/${{ github.event.repository.name }}/
        env:
          VITE_REPORT_ENDPOINT: ${{ secrets.VITE_REPORT_ENDPOINT }}
```

- [ ] **Step 3: 環境変数なしでビルドが成功し、レポート機能が含まれないことを確認する**

Run: `npm run build`
Expected: ビルド成功（エラーなし）。`VITE_REPORT_ENDPOINT` は未設定のため `isReportEnabled()` は常に `false` を返す動作になる（実行時にレポートUIが出ない状態でビルドされる）

- [ ] **Step 4: 環境変数ありでビルドが成功することを確認する**

Run: `VITE_REPORT_ENDPOINT=https://example.com/exec npm run build`
Expected: ビルド成功（エラーなし）

- [ ] **Step 5: 全体のテスト・lintを実行する**

Run: `npm run test:run && npm run lint`
Expected: 全テスト PASS、lintエラーなし

- [ ] **Step 6: コミット**

```bash
git add .env.example .github/workflows/deploy.yml
git commit -m "ci: inject VITE_REPORT_ENDPOINT secret at build time"
```

---

### Task 6: GASスクリプトの追加

**Files:**
- Create: `gas/reportBoard.gs`

**Interfaces:**
- なし（このファイルは script.google.com 上に開発者が手動で貼り付けるためのリファレンス。npmビルド・テストの対象外）

- [ ] **Step 1: `gas/reportBoard.gs` を作成する**

```javascript
var ALLOWED_MODES = ['通常探索', '深い探索（120秒）'];
var BOARD_PATTERN = /^[A-Z0-9、,\s空]*$/;
var MAX_BOARD_LENGTH = 300;

function doPost(e) {
  var payload;
  try {
    payload = JSON.parse(e.postData.contents);
  } catch (err) {
    return respond(false);
  }

  if (!isValidPayload(payload)) {
    return respond(false);
  }

  var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  sheet.appendRow([new Date(), payload.mode, payload.board]);
  return respond(true);
}

function isValidPayload(payload) {
  if (!payload || typeof payload.board !== 'string' || typeof payload.mode !== 'string') {
    return false;
  }
  if (ALLOWED_MODES.indexOf(payload.mode) === -1) {
    return false;
  }
  if (payload.board.length > MAX_BOARD_LENGTH) {
    return false;
  }
  if (!BOARD_PATTERN.test(payload.board)) {
    return false;
  }
  return true;
}

function respond(ok) {
  return ContentService
    .createTextOutput(JSON.stringify({ ok: ok }))
    .setMimeType(ContentService.MimeType.JSON);
}
```

- [ ] **Step 2: コミット**

```bash
git add gas/reportBoard.gs
git commit -m "docs: add GAS web app script for board reporting"
```

---

## 実装完了後、開発者自身が行う手動セットアップ（このセッションでは代行不可）

1. 記録用のGoogleスプレッドシートを新規作成する
2. そのスプレッドシートの「拡張機能」→「Apps Script」を開き、`gas/reportBoard.gs` の内容を貼り付けて保存する
3. 「デプロイ」→「新しいデプロイ」→ 種類「ウェブアプリ」を選択し、実行ユーザー「自分」、アクセスできるユーザー「全員」でデプロイし、Web App URLを取得する
4. `gh secret set VITE_REPORT_ENDPOINT` （または GitHub の Settings > Secrets and variables > Actions）で、取得したURLをこのリポジトリのActions secretとして登録する
5. `main` にpushして再デプロイされれば、本番ビルドにレポート機能が有効化された状態で反映される
