# 進行中データ（active entry）自動保存 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 判明した `?`（スタート状態）の盤面を「進行中データ（active entry）」として保持し、判明・訂正のたびに自動でそのデータへ上書き保存する。読み込み中は保存＝上書き既定にする。

**Architecture:** 純関数 `isStartState` / `applyRevealToEntry` を `src/board.ts` に追加。`useSaves.save` が新エントリ id を返すようにする。`App.tsx` に `activeEntryId` を持たせ、`handleTubesChange` で active entry へ自動保存、ライフサイクル（読み込み/新規保存/上書きで設定、クリア/本数変更で解除）を配線。`SaveModal` はスタート状態ガードと上書き既定 UI を持つ。ソルバー・worker・`SolveResult` 型は変更しない。

**Tech Stack:** React 19 + TypeScript, Vitest, @testing-library/react（`render` / `renderHook`）, oxlint。

## Global Constraints

- ソルバー・worker・`src/solver/types.ts` は変更しない。
- スタート状態の定義：`tubes.every(tube => tube.every(c => c === '') || tube.every(c => c !== ''))`（各ボトルが満杯か空）。
- 自動保存は `activeEntryId` がある時のみ。判明色の書き戻しは「entry の該当セルが `?` のときだけ」書き込む（誤上書き防止）。
- 手動保存/上書きはスタート状態のときのみ許可。空盤面は `alert('盤面が空のため保存できません')`、非スタート状態は `alert('スタート状態（各ボトルが満杯か空）でないと保存できません')`。
- `SaveModal` の名前入力プレースホルダ「名前を入力（例: ステージ5-3）」は維持。
- 各コミットのメッセージ末尾に付与：
  `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`

---

### Task 1: `src/board.ts` — `isStartState` と `applyRevealToEntry`

**Files:**
- Create: `src/board.ts`
- Test: `src/__tests__/board.test.ts`

**Interfaces:**
- Produces:
  - `isStartState(tubes: UITube[]): boolean`
  - `applyRevealToEntry(entryTubes: UITube[], oldTubes: UITube[], newTubes: UITube[]): UITube[]`
    - `newTubes` がスタート状態なら `newTubes` を返す（丸ごと）。
    - それ以外は `?`→具体色 の内部 `(t,i)` を、entry が `?` の箇所のみ反映した盤面を返す。

- [ ] **Step 1: 失敗するテストを書く**

`src/__tests__/board.test.ts`：

```ts
import { describe, test, expect } from 'vitest';
import { isStartState, applyRevealToEntry } from '../board';
import type { UITube } from '../solver/types';

describe('isStartState', () => {
  test('満杯と空のみは true（? を含む満杯も可）', () => {
    expect(isStartState([['A', 'A', 'A', 'A'], ['', '', '', ''], ['B', '?', '?', '?']])).toBe(true);
  });
  test('半端なボトルがあると false', () => {
    expect(isStartState([['A', 'B', '', '']])).toBe(false);
  });
});

describe('applyRevealToEntry', () => {
  test('newTubes がスタート状態なら丸ごと返す', () => {
    const entry: UITube[] = [['?', '?', '?', '?']];
    const oldT: UITube[] = [['?', '?', '?', '?']];
    const newT: UITube[] = [['A', '?', '?', '?']]; // 満杯のまま → スタート状態
    expect(applyRevealToEntry(entry, oldT, newT)).toEqual(newT);
  });

  test('途中盤面の ?→色 を entry の該当 ? セルへ反映', () => {
    const entry: UITube[] = [['C', 'C', '?', '?']];
    const oldT: UITube[] = [['', '', '?', '?']]; // C ブロックを露出手で移動済み（途中盤面）
    const newT: UITube[] = [['', '', 'A', '?']]; // 露出した ? を A と判明
    expect(applyRevealToEntry(entry, oldT, newT)).toEqual([['C', 'C', 'A', '?']]);
  });

  test('entry の該当セルが ? でなければ書き込まない（誤上書き防止）', () => {
    const entry: UITube[] = [['C', 'C', 'D', '?']];
    const oldT: UITube[] = [['', '', '?', '?']];
    const newT: UITube[] = [['', '', 'A', '?']];
    expect(applyRevealToEntry(entry, oldT, newT)).toEqual([['C', 'C', 'D', '?']]);
  });
});
```

- [ ] **Step 2: テストが失敗することを確認**

Run: `npm run test:run -- src/__tests__/board.test.ts`
Expected: FAIL（`Cannot find module '../board'`）

- [ ] **Step 3: 実装する**

`src/board.ts`：

```ts
import type { UITube } from './solver/types';
import { uiToInternal, internalToUI } from './solver/types';

// スタート状態: 各ボトルが満杯（4マス埋まり、? を含んでよい）か完全に空。
export function isStartState(tubes: UITube[]): boolean {
  return tubes.every(tube => tube.every(c => c === '') || tube.every(c => c !== ''));
}

// 判明/訂正を active entry の保存盤面へ反映して返す。
// - newTubes がスタート状態: そのまま丸ごと（判明・訂正どちらも反映）。
// - 途中盤面: ?→具体色 の内部 (t,i) を、entry が ? の箇所のみ反映（誤上書き防止）。
export function applyRevealToEntry(
  entryTubes: UITube[],
  oldTubes: UITube[],
  newTubes: UITube[],
): UITube[] {
  if (isStartState(newTubes)) return newTubes;

  const entryInt = entryTubes.map(uiToInternal);
  const oldInt = oldTubes.map(uiToInternal);
  const newInt = newTubes.map(uiToInternal);

  for (let t = 0; t < oldInt.length; t++) {
    const oldTube = oldInt[t];
    const newTube = newInt[t];
    const entryTube = entryInt[t];
    if (!oldTube || !newTube || !entryTube) continue;
    for (let i = 0; i < oldTube.length; i++) {
      const revealed =
        oldTube[i] === '?' && newTube[i] !== undefined && newTube[i] !== '?' && newTube[i] !== '';
      if (revealed && entryTube[i] === '?') {
        entryTube[i] = newTube[i];
      }
    }
  }
  return entryInt.map(internalToUI);
}
```

- [ ] **Step 4: テストが通ることを確認**

Run: `npm run test:run -- src/__tests__/board.test.ts`
Expected: PASS（5 tests）

- [ ] **Step 5: コミット**

```bash
git add src/board.ts src/__tests__/board.test.ts
git commit -m "feat: add isStartState and applyRevealToEntry board helpers

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 2: `useSaves.save` が新エントリ id を返す

**Files:**
- Modify: `src/hooks/useSaves.ts`
- Test: `src/__tests__/useSaves.test.ts`

**Interfaces:**
- Produces: `save(name: string, tubes: UITube[]): string`（生成した id を返す）

- [ ] **Step 1: 失敗するテストを書く**

`src/__tests__/useSaves.test.ts`：

```ts
import { describe, test, expect, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useSaves } from '../hooks/useSaves';
import type { UITube } from '../solver/types';

describe('useSaves.save', () => {
  beforeEach(() => localStorage.clear());

  test('save は新しいエントリの id を返し、その id で保存される', () => {
    const board: UITube[] = [['A', 'A', 'A', 'A']];
    const { result } = renderHook(() => useSaves());
    let id = '';
    act(() => {
      id = result.current.save('テスト', board);
    });
    expect(id).toBeTruthy();
    expect(result.current.saves[0].id).toBe(id);
  });
});
```

- [ ] **Step 2: テストが失敗することを確認**

Run: `npm run test:run -- src/__tests__/useSaves.test.ts`
Expected: FAIL（`save` が `undefined` を返し `id` が空、または型エラー）

- [ ] **Step 3: 実装する**

`src/hooks/useSaves.ts` の `save` を次に置換：

```ts
  const save = useCallback((name: string, tubes: UITube[]): string => {
    const id = Date.now().toString();
    const entry: SaveEntry = { id, name, tubes, savedAt: Date.now() };
    setSaves(prev => {
      const next = [entry, ...prev];
      persist(next);
      return next;
    });
    return id;
  }, []);
```

- [ ] **Step 4: テストが通ることを確認**

Run: `npm run test:run -- src/__tests__/useSaves.test.ts`
Expected: PASS

- [ ] **Step 5: 型チェック**

Run: `npx tsc -b`
Expected: エラーなし（`save` の戻り値変更は既存呼び出しと互換）

- [ ] **Step 6: コミット**

```bash
git add src/hooks/useSaves.ts src/__tests__/useSaves.test.ts
git commit -m "feat: return new entry id from useSaves.save

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 3: `SaveModal` — スタート状態ガードと上書き既定

**Files:**
- Modify: `src/components/SaveModal.tsx`
- Test: `src/__tests__/SaveModal.test.tsx`

**Interfaces:**
- Consumes: `isStartState`（Task 1）
- Produces（`SaveModalProps` に追加）：`activeEntryId?: string | null`

- [ ] **Step 1: 失敗するテストを書く**

`src/__tests__/SaveModal.test.tsx`：

```tsx
import { describe, test, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { SaveModal } from '../components/SaveModal';
import type { UITube } from '../solver/types';
import type { SaveEntry } from '../hooks/useSaves';

const startBoard: UITube[] = [['A', 'A', 'A', 'A'], ['B', 'B', '?', '?']];
const midBoard: UITube[] = [['A', 'B', '', '']];

const baseProps = {
  saves: [] as SaveEntry[],
  onSave: vi.fn(),
  onLoad: vi.fn(),
  onDelete: vi.fn(),
  onOverwrite: vi.fn(),
  onClose: vi.fn(),
};

describe('SaveModal スタート状態ガード', () => {
  afterEach(() => vi.restoreAllMocks());

  test('非スタート状態では保存できずアラートを出す', () => {
    const onSave = vi.fn();
    const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {});
    render(<SaveModal {...baseProps} tubes={midBoard} onSave={onSave} />);
    fireEvent.change(screen.getByPlaceholderText(/名前を入力/), { target: { value: 'テスト' } });
    fireEvent.click(screen.getByRole('button', { name: '保存' }));
    expect(onSave).not.toHaveBeenCalled();
    expect(alertSpy).toHaveBeenCalled();
  });

  test('スタート状態なら保存できる', () => {
    const onSave = vi.fn();
    render(<SaveModal {...baseProps} tubes={startBoard} onSave={onSave} />);
    fireEvent.change(screen.getByPlaceholderText(/名前を入力/), { target: { value: 'テスト' } });
    fireEvent.click(screen.getByRole('button', { name: '保存' }));
    expect(onSave).toHaveBeenCalledWith('テスト', startBoard);
  });
});

describe('SaveModal 進行中データ', () => {
  const entry: SaveEntry = { id: 'e1', name: 'ステージ1', tubes: startBoard, savedAt: 0 };

  test('active のとき上書き保存ボタンと（進行中）表示', () => {
    const onOverwrite = vi.fn();
    render(
      <SaveModal {...baseProps} tubes={startBoard} saves={[entry]} activeEntryId="e1" onOverwrite={onOverwrite} />
    );
    fireEvent.click(screen.getByRole('button', { name: '上書き保存' }));
    expect(onOverwrite).toHaveBeenCalledWith('e1', startBoard);
    expect(screen.getAllByText(/進行中/).length).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 2: テストが失敗することを確認**

Run: `npm run test:run -- src/__tests__/SaveModal.test.tsx`
Expected: FAIL（非スタート状態でも `onSave` が呼ばれる／「上書き保存」ボタンが無い）

- [ ] **Step 3: `SaveModal` を実装する**

`src/components/SaveModal.tsx` を次の内容に置換：

```tsx
import { useState } from 'react';
import type { UITube } from '../solver/types';
import type { SaveEntry } from '../hooks/useSaves';
import { isStartState } from '../board';

interface SaveModalProps {
  tubes: UITube[];
  saves: SaveEntry[];
  activeEntryId?: string | null;
  onSave: (name: string, tubes: UITube[]) => void;
  onLoad: (entry: SaveEntry) => void;
  onDelete: (id: string) => void;
  onOverwrite: (id: string, tubes: UITube[]) => void;
  onClose: () => void;
}

export function SaveModal({ tubes, saves, activeEntryId, onSave, onLoad, onDelete, onOverwrite, onClose }: SaveModalProps) {
  const [name, setName] = useState('');
  const activeEntry = activeEntryId ? saves.find(s => s.id === activeEntryId) : undefined;

  const guardSaveable = (): boolean => {
    if (tubes.every(tube => tube.every(c => c === ''))) { alert('盤面が空のため保存できません'); return false; }
    if (!isStartState(tubes)) { alert('スタート状態（各ボトルが満杯か空）でないと保存できません'); return false; }
    return true;
  };

  const handleSave = () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    if (!guardSaveable()) return;
    onSave(trimmed, tubes);
    setName('');
  };

  const handleOverwriteActive = () => {
    if (!activeEntry) return;
    if (!guardSaveable()) return;
    onOverwrite(activeEntry.id, tubes);
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <span className="modal-title">保存 / 読み込み</span>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>
        <p className="modal-storage-note">データはサーバーには送信・保存されません</p>

        <div className="modal-section">
          <p className="modal-section-title">現在の状態を保存</p>
          {activeEntry && (
            <p className="modal-active-note">進行中: {activeEntry.name}（保存すると上書きされます）</p>
          )}
          {activeEntry && (
            <div className="save-input-row">
              <button className="save-confirm-btn" onClick={handleOverwriteActive}>
                上書き保存
              </button>
            </div>
          )}
          <div className="save-input-row">
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && !e.nativeEvent.isComposing && handleSave()}
              placeholder="名前を入力（例: ステージ5-3）"
              className="save-name-input"
              autoFocus
            />
            <button className="save-confirm-btn" onClick={handleSave} disabled={!name.trim()}>
              {activeEntry ? '別名で新規保存' : '保存'}
            </button>
          </div>
        </div>

        <div className="modal-section">
          <p className="modal-section-title">保存済みデータ</p>
          {saves.length === 0 ? (
            <p className="saves-empty">保存データはありません</p>
          ) : (
            <ul className="saves-list">
              {saves.map(entry => (
                <li key={entry.id} className="save-entry">
                  <div className="save-entry-info">
                    <span className="save-entry-name">
                      {entry.name}{entry.id === activeEntryId ? '（進行中）' : ''}
                    </span>
                    <span className="save-entry-date">
                      {new Date(entry.savedAt).toLocaleString('ja-JP', {
                        month: 'numeric',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                  </div>
                  <div className="save-entry-actions">
                    <button className="overwrite-btn" onClick={() => {
                      if (!guardSaveable()) return;
                      onOverwrite(entry.id, tubes);
                    }}>
                      上書き
                    </button>
                    <button className="load-btn" onClick={() => {
                      if (!confirm('現在の盤面が消えてしまいますがよろしいですか？')) return;
                      onLoad(entry);
                      onClose();
                    }}>
                      読み込み
                    </button>
                    <button className="delete-btn" onClick={() => onDelete(entry.id)}>
                      削除
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: テストが通ることを確認**

Run: `npm run test:run -- src/__tests__/SaveModal.test.tsx`
Expected: PASS（4 tests）

- [ ] **Step 5: 型チェック**

Run: `npx tsc -b`
Expected: エラーなし（`App.tsx` は `activeEntryId` 未指定でも optional なので通る）

- [ ] **Step 6: コミット**

```bash
git add src/components/SaveModal.tsx src/__tests__/SaveModal.test.tsx
git commit -m "feat: add start-state guard and overwrite-default to SaveModal

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 4: `App.tsx` — `activeEntryId` とライフサイクル・自動保存の配線

**Files:**
- Modify: `src/App.tsx`

**Interfaces:**
- Consumes: `applyRevealToEntry`（Task 1）、`useSaves.save`（id を返す, Task 2）、`SaveModal` の `activeEntryId`（Task 3）。

worker 非依存だが TubeGrid 経由の統合テストは既存に無いため、自動テストは追加せず、実装後にビルド・lint・アプリ手動 verify で確認する。

- [ ] **Step 1: import を追加する**

`src/App.tsx` の import 群に追加：

```tsx
import { applyRevealToEntry } from './board';
```

- [ ] **Step 2: `activeEntryId` 状態を追加**

`const [resultIsResearch, setResultIsResearch] = useState(false);` の直後に追加：

```tsx
  const [activeEntryId, setActiveEntryId] = useState<string | null>(null);
```

- [ ] **Step 3: `handleTubesChange` に自動保存を追加**

`const handleTubesChange = (newTubes: UITube[]) => {` の直後、
`setError(validateColorCounts(newTubes));` の直後（reveal 分岐より前）に追加：

```tsx
    // active entry があれば、判明/訂正を保存データへ自動反映（再探索・ステップ送りとは独立）。
    if (activeEntryId) {
      const entry = saves.find(s => s.id === activeEntryId);
      if (entry) overwrite(activeEntryId, applyRevealToEntry(entry.tubes, tubes, newTubes));
    }
```

- [ ] **Step 4: `handleLoad` で active に設定**

`handleLoad` の本体末尾（`resetProgress();` の後）に追加：

```tsx
    setActiveEntryId(entry.id);
```

- [ ] **Step 5: `handleClear` で解除**

`handleClear` 内の `setResultIsResearch(false);` の直後に追加：

```tsx
    setActiveEntryId(null);
```

- [ ] **Step 6: `handleTubeCountChange` で解除**

`handleTubeCountChange` 内の `resetProgress();` の直後に追加：

```tsx
    setActiveEntryId(null);
```

- [ ] **Step 7: `SaveModal` の配線を更新**

`src/App.tsx` の `<SaveModal ... />` を次に置換：

```tsx
        <SaveModal
          tubes={tubes}
          saves={saves}
          activeEntryId={activeEntryId}
          onSave={(name, board) => setActiveEntryId(save(name, board))}
          onLoad={handleLoad}
          onDelete={id => { remove(id); if (id === activeEntryId) setActiveEntryId(null); }}
          onOverwrite={(id, board) => { overwrite(id, board); setActiveEntryId(id); }}
          onClose={() => setShowSaveModal(false)}
        />
```

- [ ] **Step 8: 全テスト・型チェック・lint**

Run: `npm run test:run`
Expected: 全 PASS

Run: `npx tsc -b`
Expected: エラーなし

Run: `npm run lint`
Expected: exit 0

- [ ] **Step 9: アプリ手動 verify**

`npm run dev` は各自で起動。以下を確認：

1. スタート状態の盤面を手動で新規保存 → 進行中（active）になる。
2. `?` を判明入力（スタート状態のまま）→ 進行中データが自動上書きされる（保存モーダルで日時更新／内容反映を確認）。
3. partial の露出手順をステップ→露出した `?` を判明入力 → 進行中データの該当 `?` セルが更新される。
4. データを読み込み → 進めて判明 → 同じデータへ上書きされる（新規増殖しない）。
5. クリア／本数変更で進行中解除 → 以後の判明は自動保存されない。
6. 非スタート状態（途中盤面）で手動保存 → 拒否アラート。

- [ ] **Step 10: コミット**

```bash
git add src/App.tsx
git commit -m "feat: wire active-entry autosave and lifecycle into App

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## 完了条件

- `npm run test:run` 全 PASS、`npx tsc -b` エラーなし、`npm run lint` exit 0。
- スタート状態のみ保存可。判明/訂正で active entry が自動上書きされる。
- 読み込み中は保存＝上書き既定。クリア/本数変更で active 解除。
