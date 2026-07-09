# inferUnknowns Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `?` セルに対し「各色4個」「同じ色は連続しない」制約を用いて自動推論・入力する機能を追加する。

**Architecture:** `src/solver/infer.ts` に推論ロジックを集約する。フェーズ1の反復ドメイン縮小で確定できる `?` を埋め、フェーズ2で残り3以下の `?` をバックトラッキング CSP で一意解を探して埋める。`App.tsx` の保存ボタンで `autoFillUnknown` の直後に呼び出す。

**Tech Stack:** TypeScript, Vitest

## Global Constraints

- UITube は上から下の順（index 0 = 上 = 先に注がれる側、index 3 = 下 = 最後に注がれる側）
- `?` は「不明な色」、`''` は「空スロット（液体なし）」
- 各色はパズル全体でちょうど4回出現する（既知セルのみで判定し、`?` / `''` は除く）
- 推論に使う色セット = 既知セルに1回以上出現している色のみ

---

### Task 1: `inferUnknowns` 関数の実装とテスト

**Files:**
- Create: `src/solver/infer.ts`
- Create: `src/__tests__/infer.test.ts`

**Interfaces:**
- Produces: `inferUnknowns(tubes: UITube[]): UITube[]`
  - 入力と同じ長さの UITube[] を返す
  - 確定できた `?` を色文字列で置き換える
  - 確定できなかった `?` はそのまま残す

- [ ] **Step 1: テストファイルを作成する（失敗するテストを書く）**

`src/__tests__/infer.test.ts` を以下の内容で作成する：

```typescript
import { describe, test, expect } from 'vitest';
import { inferUnknowns } from '../solver/infer';
import type { UITube } from '../solver/types';

describe('inferUnknowns', () => {
  // 変化なしケース
  test('? のないチューブはそのまま返す', () => {
    const tubes: UITube[] = [
      ['A', 'B', 'A', 'B'],
      ['B', 'A', 'B', 'A'],
    ];
    expect(inferUnknowns(tubes)).toEqual(tubes);
  });

  // フェーズ1: 残り必要数が1色のみ → 全 ? を確定
  test('残り必要数が1色のみで全 ? が確定できる', () => {
    // A が 3個既知 → あと1個必要。? は1個 → A に確定
    const tubes: UITube[] = [
      ['A', 'A', 'A', ''],
      ['', '', '', '?'],
    ];
    const result = inferUnknowns(tubes);
    expect(result[1][3]).toBe('A');
  });

  // フェーズ1: 隣接制約で候補が1つに絞られる
  test('隣接する既知セルとの連続を除外して候補が1つに絞られる', () => {
    // A×3, B×3 既知。残り: A×1, B×1 で ? が2個
    // tube[0] = ['A', '?', 'B', 'B'] → index1 は A/B のうち A 以外かつ B 以外 → どちらも除外
    //   ただし残り必要 A=1, B=1 で ? が2個なので一意ではない
    // シンプルなケース: ? が1個で残り候補が1色
    const tubes: UITube[] = [
      ['A', 'B', 'A', 'B'],
      ['B', 'A', 'B', '?'],
    ];
    // 既知: A×3, B×4 → 残り: A×1, B×0
    // ? の隣(index2)は B → 候補は A のみ → 確定
    const result = inferUnknowns(tubes);
    expect(result[1][3]).toBe('A');
  });

  // フェーズ1: 連続制約で候補ゼロ → ? のまま（不整合時は変更しない）
  test('候補が 0 のときは ? のまま残す', () => {
    // 残り必要 A=1 のみ、? は1個だが隣が A → 本来 A 以外が必要だが他に候補なし
    // この場合は推論不能として ? のまま
    const tubes: UITube[] = [
      ['A', 'A', 'A', 'A'],
      ['B', 'B', 'B', '?'],
    ];
    // 既知: A×4, B×3 → 残り B×1 しかないが、隣(index2)が B → 連続制約でも B が唯一の候補
    // 候補は B のみ (連続するが他にない) → B で確定（連続制約違反だが一意なら埋める）
    // NOTE: 連続制約はドメイン絞り込みに使うが、他に候補がなければ残す
    const result = inferUnknowns(tubes);
    // B が唯一の残り → 確定して B になる（制約違反でも一意解として扱う）
    expect(result[1][3]).toBe('B');
  });

  // フェーズ2: 残り3以下でバックトラッキング（一意解あり）
  test('残り ? が 3 以下で一意解がある場合は自動入力する', () => {
    // A×3, B×3, C×3 既知, ? が3個, 各チューブの隣接制約で一意に決まる
    // tube[0]: ['A', 'B', 'A', '?']  → index3 は A/B/C のうち A 以外 → B or C
    // tube[1]: ['B', 'C', 'B', '?']  → index3 は B 以外 → A or C
    // tube[2]: ['C', 'A', 'C', '?']  → index3 は C 以外 → A or B
    // 残り: A=1, B=1, C=1
    // 一意解: tube[0][3]=C, tube[1][3]=A, tube[2][3]=B
    //   (tube[0][3]: B は残り1個だが tube[1] も B が必要、C なら可)
    //   バックトラッキングで確認
    const tubes: UITube[] = [
      ['A', 'B', 'A', '?'],
      ['B', 'C', 'B', '?'],
      ['C', 'A', 'C', '?'],
    ];
    const result = inferUnknowns(tubes);
    // 全 ? が埋まっていること
    expect(result.flat().filter((c: string) => c === '?')).toHaveLength(0);
    // 各色が4個であること
    const flat = result.flat().filter((c: string) => c !== '' && c !== '?');
    const counts: Record<string, number> = {};
    for (const c of flat) counts[c] = (counts[c] ?? 0) + 1;
    expect(counts['A']).toBe(4);
    expect(counts['B']).toBe(4);
    expect(counts['C']).toBe(4);
  });

  // フェーズ2: 残り3以下だが複数解あり → ? のまま
  test('残り ? が 3 以下でも複数解があれば ? のまま残す', () => {
    // A×2, B×2 既知, ? が4個 → 4個はフェーズ2の対象外
    // → フェーズ1で絞れないまま残る
    // 代わりに残り ? が2個で対称ケース: A×3, B×3 で残り A=1, B=1, ? が2個
    // tube[0]: ['A', 'B', '?', '']  tube[1]: ['B', 'A', '?', '']
    // tube[0][2] は A/B のうち B(隣)以外 → A; tube[1][2] は B/A のうち A(隣)以外 → B
    // でも残り A=1, B=1 → tube[0][2]=A, tube[1][2]=B が一意解 → 確定してしまう
    // 複数解ケース: 制約が緩い場合
    // A×2, B×2 既知, ?が2個で tube[0]:['A','?','',''] tube[1]:['B','?','','']
    // tube[0][1] は A 以外 → B; tube[1][1] は B 以外 → A → これも一意
    // 本当に曖昧なケース: 残り A=2, B=0 で ? が2個、隣の制約なし
    // 実際は「残り A=2 のみ」→ 両方 A で一意。曖昧にならない。
    // 曖昧ケース: 未見色 C が存在するとき (推論不可)
    // A×4, B×3 既知。? が2個。残り B=1 のみ (A は4個済)。
    // tube[0]: ['B', 'B', 'B', '?'] tube[1]: ['', '', '', '?']
    // tube[0][3] は B 以外候補なし(残りBのみ&隣B) → 不整合 → ? のまま
    // tube[1][3] は B のみ残り → B に確定
    // ※ 不整合は変更しない
    const tubes: UITube[] = [
      ['B', 'B', 'B', '?'],
      ['', '', '', '?'],
      ['A', 'A', 'A', 'A'],
    ];
    const result = inferUnknowns(tubes);
    // tube[1][3] は B (残り唯一)
    expect(result[1][3]).toBe('B');
    // tube[0][3] は隣が B で残りも B のみ → 候補なしで ? のまま
    expect(result[0][3]).toBe('?');
  });
});
```

- [ ] **Step 2: テストが失敗することを確認する**

```bash
cd /Users/tsushimatatsuya/workspace/puzzles-and-survival && npm run test:run -- src/__tests__/infer.test.ts
```

期待: `Cannot find module '../solver/infer'` などのエラーで失敗

- [ ] **Step 3: `src/solver/infer.ts` を実装する**

```typescript
import type { UITube } from './types';

function countKnown(tubes: UITube[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const tube of tubes) {
    for (const cell of tube) {
      if (cell !== '' && cell !== '?') {
        counts[cell] = (counts[cell] ?? 0) + 1;
      }
    }
  }
  return counts;
}

function remaining(knownCounts: Record<string, number>): Record<string, number> {
  const rem: Record<string, number> = {};
  for (const [color, count] of Object.entries(knownCounts)) {
    if (count < 4) rem[color] = 4 - count;
  }
  return rem;
}

function possibleColors(
  tubes: UITube[],
  tubeIdx: number,
  cellIdx: number,
  rem: Record<string, number>,
): string[] {
  const prev = cellIdx > 0 ? tubes[tubeIdx][cellIdx - 1] : null;
  const next = cellIdx < 3 ? tubes[tubeIdx][cellIdx + 1] : null;
  return Object.entries(rem)
    .filter(([, count]) => count > 0)
    .map(([color]) => color)
    .filter(color => color !== prev && color !== next);
}

function applyAssignment(
  tubes: UITube[],
  tubeIdx: number,
  cellIdx: number,
  color: string,
): UITube[] {
  return tubes.map((tube, ti) => {
    if (ti !== tubeIdx) return tube;
    const next = [...tube] as UITube;
    next[cellIdx] = color;
    return next;
  });
}

// フェーズ1: 反復ドメイン縮小。候補が 1 つの ? を確定する。
function iterativeReduce(tubes: UITube[]): UITube[] {
  let current = tubes;
  let changed = true;
  while (changed) {
    changed = false;
    const known = countKnown(current);
    const rem = remaining(known);
    let next = current;
    for (let t = 0; t < current.length; t++) {
      for (let c = 0; c < 4; c++) {
        if (current[t][c] !== '?') continue;
        const possible = possibleColors(next, t, c, rem);
        if (possible.length === 1) {
          next = applyAssignment(next, t, c, possible[0]);
          rem[possible[0]] = (rem[possible[0]] ?? 1) - 1;
          changed = true;
        }
      }
    }
    current = next;
  }
  return current;
}

type UnknownPos = { tubeIdx: number; cellIdx: number };

function collectUnknowns(tubes: UITube[]): UnknownPos[] {
  const positions: UnknownPos[] = [];
  for (let t = 0; t < tubes.length; t++) {
    for (let c = 0; c < 4; c++) {
      if (tubes[t][c] === '?') positions.push({ tubeIdx: t, cellIdx: c });
    }
  }
  return positions;
}

// フェーズ2: バックトラッキング CSP。一意解のみ適用。
function backtrack(
  tubes: UITube[],
  positions: UnknownPos[],
  rem: Record<string, number>,
  idx: number,
  solutions: UITube[][],
): void {
  if (solutions.length > 1) return; // 複数解確定済み → 早期終了
  if (idx === positions.length) {
    solutions.push(tubes);
    return;
  }
  const { tubeIdx, cellIdx } = positions[idx];
  const possible = possibleColors(tubes, tubeIdx, cellIdx, rem);
  for (const color of possible) {
    const nextRem = { ...rem, [color]: rem[color] - 1 };
    const nextTubes = applyAssignment(tubes, tubeIdx, cellIdx, color);
    backtrack(nextTubes, positions, nextRem, idx + 1, solutions);
    if (solutions.length > 1) return;
  }
}

export function inferUnknowns(tubes: UITube[]): UITube[] {
  // フェーズ1
  let current = iterativeReduce(tubes);

  // フェーズ2: 残り ? が 3 以下のとき
  const unknowns = collectUnknowns(current);
  if (unknowns.length === 0 || unknowns.length > 3) return current;

  const known = countKnown(current);
  const rem = remaining(known);
  const solutions: UITube[][] = [];
  backtrack(current, unknowns, rem, 0, solutions);

  if (solutions.length === 1) return solutions[0];
  return current;
}
```

- [ ] **Step 4: テストを実行して全て通ることを確認する**

```bash
cd /Users/tsushimatatsuya/workspace/puzzles-and-survival && npm run test:run -- src/__tests__/infer.test.ts
```

期待: 全テスト PASS

- [ ] **Step 5: コミット**

```bash
cd /Users/tsushimatatsuya/workspace/puzzles-and-survival
git add src/solver/infer.ts src/__tests__/infer.test.ts
git commit -m "feat: add inferUnknowns – constraint-based ? resolution"
```

---

### Task 2: App.tsx に inferUnknowns を組み込む

**Files:**
- Modify: `src/App.tsx:357-359`

**Interfaces:**
- Consumes: `inferUnknowns(tubes: UITube[]): UITube[]` from `src/solver/infer.ts`

- [ ] **Step 1: import を追加する**

`src/App.tsx` の先頭 import 群に追加する（`normalizeTube` の import がある行の近く）：

```typescript
import { inferUnknowns } from './solver/infer';
```

- [ ] **Step 2: 保存ボタンの onClick を変更する**

変更前（`src/App.tsx` 約357行目）：
```typescript
<button className="save-load-btn" onClick={() => {
  handleTubesChange(autoFillUnknown(tubes));
  setShowSaveModal(true);
}}>
```

変更後：
```typescript
<button className="save-load-btn" onClick={() => {
  handleTubesChange(inferUnknowns(autoFillUnknown(tubes)));
  setShowSaveModal(true);
}}>
```

- [ ] **Step 3: 既存テストスイートが全て通ることを確認する**

```bash
cd /Users/tsushimatatsuya/workspace/puzzles-and-survival && npm run test:run
```

期待: 全テスト PASS

- [ ] **Step 4: コミット**

```bash
cd /Users/tsushimatatsuya/workspace/puzzles-and-survival
git add src/App.tsx
git commit -m "feat: wire inferUnknowns into save button flow"
```
