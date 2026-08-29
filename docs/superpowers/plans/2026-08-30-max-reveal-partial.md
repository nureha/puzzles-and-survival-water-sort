# 最大露出 partial 手順 実装計画

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `?` を含む盤面で推定解が得られなかったとき、1回の手順でできるだけ多くの `?` を露出させる手順を返す。

**Architecture:** 既存の `solvePartial`（最初の露出でBFS打ち切り）を `solveMaxReveal`（同じ手グラフをBFSで全探索し、トップが `?` になった試験管数の最大値を取る）へ置き換える。`isValidMove` がトップ `?` の試験管を from/to 両方で禁止しているため、露出した試験管は永久に凍結し、露出数は経路に沿って単調増加する。BFS が層順であることから、同じ露出数なら自動的に最短手数が選ばれる。

**Tech Stack:** TypeScript / React 19 / Vite / Vitest + @testing-library/react

## Global Constraints

- 元仕様: `docs/superpowers/specs/2026-08-30-max-reveal-partial-design.md`
- 探索予算の定数名と初期値: `REVEAL_MAX_STATES = 200_000`
- UI 文言はすべて日本語。既存の CSS 変数（`var(--app-hint)` `var(--app-muted)` `var(--app-warning)`）を使う。新しい CSS 変数は追加しない。
- 試験管番号はユーザー向け表示では常に 1 起点（`tubeIndex + 1`）。
- `RevealHint.stepIndex` は 0 起点（`moves` 配列のインデックス）。
- テスト実行: `npm run test:run`。lint: `npm run lint`。ビルド: `npm run build`。
- 作業ブランチは `feat/max-reveal-partial`（作成済み）。

## File Structure

| ファイル | 責務 | 変更内容 |
|---|---|---|
| `src/solver/types.ts` | 型定義 | `Move.revealsTube` 追加、`RevealHint.stepIndex` 追加、`RevealHint.description` 削除（Task 2） |
| `src/solver/bfs.ts` | 探索アルゴリズム | `solveMaxReveal` 追加、`solvePartial`/`partialWithReveal`/`findRevealHints`/`firstValidDest` 削除（Task 2） |
| `src/components/SolutionList.tsx` | 手順表示 | partial 分岐の文言生成を `description` 非依存に、ステップ印、露出0メッセージ（Task 1） |
| `src/__tests__/SolutionList.test.tsx` | UI テスト | partial 表示のテスト追加（Task 1） |
| `src/__tests__/bfs.test.ts` | ソルバーテスト | 最大露出のテスト追加（Task 2） |
| `README.md` | ユーザードキュメント | 「部分解」の説明を複数判明に更新（Task 2） |

Task 1（UI）を先に実施することで、各タスク終了時点で必ずビルドとテストが通る状態を保つ。Task 1 の時点ではソルバーは従来どおり `?` を1個だけ露出させるが、UI は新しいデータ形式で表示できるようになる。

---

### Task 1: SolutionList を description 非依存にし、ステップ印と露出0メッセージを追加する

**Files:**
- Modify: `src/solver/types.ts:14-19`
- Modify: `src/solver/bfs.ts:361-373`（`partialWithReveal`）
- Modify: `src/components/SolutionList.tsx:49-80`（partial 分岐）と `:150-199`（`MoveList`）
- Test: `src/__tests__/SolutionList.test.tsx`

**Interfaces:**
- Produces: `Move` に optional な `revealsTube?: number`（この手を適用した直後にトップが `?` になる試験管の 0 起点インデックス）。`RevealHint` に必須の `stepIndex: number`（`moves` 配列の 0 起点インデックス）。Task 2 の `solveMaxReveal` がこの2つを埋める。
- Consumes: なし。

- [ ] **Step 1: 失敗するテストを書く**

`src/__tests__/SolutionList.test.tsx` の末尾（`describe('SolutionList 再探索・文言分岐', ...)` ブロックの閉じ括弧の後）に追記する:

```tsx
describe('SolutionList partial 分岐（最大露出手順）', () => {
  const twoRevealResult = {
    type: 'partial' as const,
    moves: [
      { from: 0, to: 2, revealsTube: 0 },
      { from: 1, to: 3, revealsTube: 1 },
    ],
    revealHints: [
      { tubeIndex: 0, stepIndex: 0 },
      { tubeIndex: 1, stepIndex: 1 },
    ],
  };

  test('露出手にステップ印を表示する', () => {
    render(
      <SolutionList
        result={twoRevealResult}
        completedCount={0}
        boardTubes={knownTubes}
        onStepToggle={vi.fn()}
        onReset={vi.fn()}
      />
    );
    expect(screen.getByText('← 試験管1 の ? が判明')).toBeInTheDocument();
    expect(screen.getByText('← 試験管2 の ? が判明')).toBeInTheDocument();
  });

  test('見出しに判明する ? の個数を出す', () => {
    render(
      <SolutionList
        result={twoRevealResult}
        completedCount={0}
        boardTubes={knownTubes}
        onStepToggle={vi.fn()}
        onReset={vi.fn()}
      />
    );
    expect(screen.getByText('? を判明させる手順（2個の ? が判明します）:')).toBeInTheDocument();
  });

  test('末尾サマリに判明する試験管をすべて並べる', () => {
    render(
      <SolutionList
        result={twoRevealResult}
        completedCount={0}
        boardTubes={knownTubes}
        onStepToggle={vi.fn()}
        onReset={vi.fn()}
      />
    );
    expect(screen.getByText('試験管1・試験管2')).toBeInTheDocument();
    expect(screen.getByText(/判明した色を入力して/)).toBeInTheDocument();
  });

  test('露出できる手順が無いとき理由を明示する', () => {
    render(
      <SolutionList
        result={{ type: 'partial', moves: [], revealHints: [] }}
        completedCount={0}
        boardTubes={knownTubes}
        onStepToggle={vi.fn()}
        onReset={vi.fn()}
      />
    );
    expect(
      screen.getByText('動かせる既知のブロックが無く、? を判明させる手順がありません。')
    ).toBeInTheDocument();
  });
});
```

補足: `@testing-library/dom` の `getNodeText` は**直下のテキストノードのみ**を連結するため、`<strong>` で囲んだ試験管名は親 `<p>` のマッチ対象から外れる。上の `getByText('試験管1・試験管2')` は `<strong>` に、`getByText(/判明した色を入力して/)` は親 `<p>` にマッチする。

- [ ] **Step 2: テストを実行して失敗を確認する**

Run: `npm run test:run -- src/__tests__/SolutionList.test.tsx`

Expected: 4件 FAIL。`revealsTube` / `stepIndex` は型に存在しないため TypeScript エラー、または文言が見つからない旨のエラー。

- [ ] **Step 3: 型を拡張する**

`src/solver/types.ts` の `Move` と `RevealHint` を差し替える（`description` はこの時点では残す）:

```ts
export type Move = {
  from: number;
  to: number;
  isSpeculative?: boolean;
  // この手を適用した直後にトップが '?' になる試験管（0 起点）。
  // 1手は from 1本しか減らさないため、露出する試験管は高々1本。
  revealsTube?: number;
};

export type RevealHint = {
  tubeIndex: number;
  stepIndex: number;
  description: string;
};
```

- [ ] **Step 4: 既存の partialWithReveal が stepIndex を埋めるようにする**

`src/solver/bfs.ts` の `partialWithReveal`（361行目付近）を差し替える。この関数は Task 2 で削除されるが、ここでは型を満たすためだけに最小限を直す:

```ts
function partialWithReveal(state: PuzzleState, pathMoves: Move[], hints: RevealHint[]): SolveResult {
  if (hints.length === 0) return { type: 'partial', moves: pathMoves, revealHints: [] };
  const h = hints[0];
  const exposeMove: Move = { from: h.tubeIndex, to: firstValidDest(state, h.tubeIndex), revealsTube: h.tubeIndex };
  const moves = [...pathMoves, exposeMove];
  return {
    type: 'partial',
    moves,
    revealHints: [{
      tubeIndex: h.tubeIndex,
      stepIndex: moves.length - 1,
      description: h.description,
    }],
  };
}
```

- [ ] **Step 5: SolutionList の partial 分岐を書き換える**

`src/components/SolutionList.tsx` の 49〜80行目（`if (result.type === 'partial') { ... }` ブロック全体）を次に差し替える:

```tsx
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
```

- [ ] **Step 6: MoveList にステップ印を追加する**

`src/components/SolutionList.tsx` の `MoveList` 内、`</span>` の直後（188〜192行目の `<span>` を閉じた直後）に次を追加する:

```tsx
              {move.revealsTube !== undefined && (
                <span style={{ fontSize: '0.85rem', color: 'var(--app-hint)', flexShrink: 0 }}>
                  ← 試験管{move.revealsTube + 1} の ? が判明
                </span>
              )}
```

- [ ] **Step 7: テストを実行して通ることを確認する**

Run: `npm run test:run -- src/__tests__/SolutionList.test.tsx`

Expected: PASS。既存の `partial で再探索ボタンを表示する`（`moves: []`, `revealHints: []`）も、新しい露出0分岐が `ResearchButton` を描画するため引き続き PASS する。

- [ ] **Step 8: 全テスト・lint・ビルドを通す**

Run: `npm run test:run && npm run lint && npm run build`

Expected: すべて成功。

- [ ] **Step 9: コミット**

```bash
git add src/solver/types.ts src/solver/bfs.ts src/components/SolutionList.tsx src/__tests__/SolutionList.test.tsx
git commit -m "feat: render partial reveal steps from structured hints"
```

---

### Task 2: solveMaxReveal を実装して solvePartial を置き換える

**Files:**
- Modify: `src/solver/bfs.ts`（`solvePartial` / `partialWithReveal` / `findRevealHints` / `firstValidDest` を削除し `solveMaxReveal` を追加、`solve` の呼び出しを差し替え）
- Modify: `src/solver/types.ts`（`RevealHint.description` を削除）
- Modify: `README.md`（「色が不明な場合（? の使い方）」の部分解の説明）
- Test: `src/__tests__/bfs.test.ts`

**Interfaces:**
- Consumes: Task 1 で追加した `Move.revealsTube?: number` と `RevealHint.stepIndex: number`。
- Produces: `solve(initialState)` が `?` を含み推定解が出ない盤面に対して `{ type: 'partial'; moves: Move[]; revealHints: RevealHint[] }` を返す。`revealHints` は露出する試験管を**手順順**に並べ、`moves[h.stepIndex].revealsTube === h.tubeIndex` が常に成り立つ。

- [ ] **Step 1: 失敗するテストを書く**

`src/__tests__/bfs.test.ts` の末尾に追記する。ファイル冒頭の import に `solve` が無ければ追加すること（既存の `describe('solve – phase 2 ...')` が `solve` を使っているので既に import 済みのはず）。

```ts
describe('solveMaxReveal – 露出数の最大化', () => {
  // tube0/tube1 とも top が既知・その下が ?。空き試験管2本でどちらも露出できる。
  // 既知色 A:1 B:1 に対し ? が2個 → buildColorPool が null を返すため partial 経路に入る。
  const twoRevealBoard = (): PuzzleState => [
    ['?', 'A'],
    ['?', 'B'],
    [],
    [],
  ];

  test('複数の ? を1手順で露出させる', () => {
    const result = solve(twoRevealBoard());
    expect(result.type).toBe('partial');
    if (result.type !== 'partial') return;
    expect(result.revealHints.map(h => h.tubeIndex).sort()).toEqual([0, 1]);
    expect(result.moves).toHaveLength(2);
  });

  test('revealHints.stepIndex がその手の revealsTube と一致する', () => {
    const result = solve(twoRevealBoard());
    expect(result.type).toBe('partial');
    if (result.type !== 'partial') return;
    for (const hint of result.revealHints) {
      expect(result.moves[hint.stepIndex].revealsTube).toBe(hint.tubeIndex);
    }
  });

  test('revealsTube はその手の適用直後にトップが ? になる試験管を指す', () => {
    const board = twoRevealBoard();
    const result = solve(board);
    expect(result.type).toBe('partial');
    if (result.type !== 'partial') return;
    let s: PuzzleState = board;
    for (const move of result.moves) {
      s = applyMove(s, move.from, move.to);
      const src = s[move.from];
      const exposed = src.length > 0 && src[src.length - 1] === '?';
      expect(move.revealsTube).toBe(exposed ? move.from : undefined);
    }
  });

  test('露出数が同じなら最短手数を返す（余計な手を付けない）', () => {
    // tube0 の A を1手動かすだけで唯一の ? が露出する。
    // 既知 A:2 に対し ? が1個 → pool は [A,A] で長さ不一致 → partial 経路。
    const state: PuzzleState = [
      ['?', 'A'],
      ['A'],
      [],
    ];
    const result = solve(state);
    expect(result.type).toBe('partial');
    if (result.type !== 'partial') return;
    expect(result.moves).toHaveLength(1);
    expect(result.revealHints).toEqual([{ tubeIndex: 0, stepIndex: 0 }]);
  });

  test('露出できない盤面では手順もヒントも空になる', () => {
    // tube1 は既にトップが ? （凍結済み）、tube0 に ? は無い → 露出候補ゼロ。
    const state: PuzzleState = [
      ['A', 'B', 'A', 'B'],
      ['B', 'A', 'B', '?'],
    ];
    const result = solve(state);
    expect(result.type).toBe('partial');
    if (result.type !== 'partial') return;
    expect(result.moves).toEqual([]);
    expect(result.revealHints).toEqual([]);
  });

  // 最大構成に近い盤面。同一内容の試験管が並ぶため状態爆発が起きやすく、
  // 探索予算がそのまま実行時間に効く。Step 6 の予算調整はこのテストで測る。
  test('大きな盤面でも予算内に partial を返す', () => {
    // 既知 A が16個 → buildColorPool が needed < 0 で null → partial 経路。
    // 探索予算に達しても、その時点までの最良結果を返して停止すること。
    const state: PuzzleState = [
      ...Array.from({ length: 16 }, () => ['?', 'A'] as string[]),
      [], [], [], [],
    ];
    const result = solve(state);
    expect(result.type).toBe('partial');
    if (result.type !== 'partial') return;
    expect(result.revealHints.length).toBeGreaterThan(0);
    // 最後の手は必ず露出手
    expect(result.moves[result.moves.length - 1].revealsTube).toBeDefined();
  }, 10_000);
});
```

- [ ] **Step 2: テストを実行して失敗を確認する**

Run: `npm run test:run -- src/__tests__/bfs.test.ts`

Expected: `複数の ? を1手順で露出させる` が FAIL（現行実装は1個しか露出しないため `revealHints` は `[0]` のみ、`moves` は1手）。`revealHints` が `description` を含むため `toEqual` 比較も FAIL。

- [ ] **Step 3: RevealHint から description を削除する**

`src/solver/types.ts`:

```ts
export type RevealHint = {
  tubeIndex: number;
  stepIndex: number;
};
```

- [ ] **Step 4: solveMaxReveal を実装し、旧 partial 実装を削除する**

`src/solver/bfs.ts` から次の3つの関数を**丸ごと削除**する:
- `firstValidDest`（349行目付近）
- `partialWithReveal`（Task 1 で編集したもの）
- `solvePartial`（375行目付近）
- `findRevealHints`（476行目付近、ファイル末尾）

`SPECULATIVE_MAX_STATES` の定義（107行目付近）の直後に定数を追加する:

```ts
// partial（? の露出）探索の予算。? を含む盤面は isValidMove が凍結した試験管を
// 弾くぶん自由度が低く、到達状態数は具体色ソルバーより小さい。予算に達した場合は
// その時点までの最良結果を返す（旧実装が見つけていた最初の1個は同じ深さで
// 見つかるため、結果が旧実装より悪くなることはない）。
const REVEAL_MAX_STATES = 200_000;
```

削除した関数があった場所に次を追加する:

```ts
// トップが '?' の試験管の本数。isValidMove がトップ '?' の試験管を from にも to にも
// 選ばせないため、一度露出した試験管は永久に凍結する。よってこの値は経路に沿って
// 単調増加し、初期値との差がそのまま「この手順で新たに判明した ? の個数」になる。
function exposedCount(state: PuzzleState): number {
  let n = 0;
  for (const tube of state) {
    if (tube.length > 0 && tube[tube.length - 1] === '?') n++;
  }
  return n;
}

// 露出しうる試験管の本数の上限。'?' を含み、かつトップがまだ既知色の試験管。
// 到達可能とは限らないが、ここに達したら探索を打ち切ってよい。
function maxRevealable(state: PuzzleState): number {
  let n = 0;
  for (const tube of state) {
    if (tube.includes('?') && tube[tube.length - 1] !== '?') n++;
  }
  return n;
}

type RevealNode = { state: PuzzleState; parent: number; move: Move | null };

// 親ポインタを辿って経路を復元し、各手に revealsTube を付けて RevealHint を組み立てる。
function buildRevealResult(
  initialState: PuzzleState,
  nodes: RevealNode[],
  bestNode: number,
): SolveResult {
  const rawMoves: Move[] = [];
  for (let i = bestNode; i > 0; i = nodes[i].parent) {
    rawMoves.push(nodes[i].move!);
  }
  rawMoves.reverse();

  const moves: Move[] = [];
  const revealHints: RevealHint[] = [];
  let state = initialState;
  for (let i = 0; i < rawMoves.length; i++) {
    const move = rawMoves[i];
    state = applyMove(state, move.from, move.to);
    // 注ぎ先のトップは注いだ既知色になるため、露出しうるのは注ぎ元だけ。
    const src = state[move.from];
    if (src.length > 0 && src[src.length - 1] === '?') {
      moves.push({ ...move, revealsTube: move.from });
      revealHints.push({ tubeIndex: move.from, stepIndex: i });
    } else {
      moves.push(move);
    }
  }
  return { type: 'partial', moves, revealHints };
}

// 1回の手順で露出できる ? の個数を最大化する。BFS が層順（手数順）に展開するため、
// 露出数が同じ経路のうち最初に記録されるものが最短手数になる。また best を更新した
// 状態の直前状態は必ず露出数が小さい（そうでなければより短い経路が先に記録されて
// いる）ので、返す経路の末尾は必ず露出手であり、末尾の刈り込みは不要。
function solveMaxReveal(initialState: PuzzleState): SolveResult {
  const maxReveal = maxRevealable(initialState);
  if (maxReveal === 0) return { type: 'partial', moves: [], revealHints: [] };

  const baseExposed = exposedCount(initialState);
  const nodes: RevealNode[] = [{ state: initialState, parent: -1, move: null }];
  const visited = new Set<string>([stateKey(initialState)]);

  let best = 0;
  let bestNode = 0;

  for (let head = 0; head < nodes.length && visited.size < REVEAL_MAX_STATES; head++) {
    const { state } = nodes[head];

    const revealed = exposedCount(state) - baseExposed;
    if (revealed > best) {
      best = revealed;
      bestNode = head;
      if (best === maxReveal) break;
    }

    const firstEmpty = firstEmptyIndex(state);
    for (let from = 0; from < state.length; from++) {
      for (let to = 0; to < state.length; to++) {
        if (!isValidMove(state, from, to)) continue;
        if (state[to].length === 0 && to !== firstEmpty) continue;
        const next = applyMove(state, from, to);
        const key = stateKey(next);
        if (visited.has(key)) continue;
        visited.add(key);
        nodes.push({ state: next, parent: head, move: { from, to } });
      }
    }
  }

  return buildRevealResult(initialState, nodes, bestNode);
}
```

`solve` 内の呼び出しを差し替える（342行目付近）:

```ts
    return solveMaxReveal(initialState);
```

- [ ] **Step 5: テストを実行して通ることを確認する**

Run: `npm run test:run -- src/__tests__/bfs.test.ts`

Expected: 新規テストのうち `大きな盤面でも予算内に partial を返す` **以外**は PASS。既存の `reveal hint points to tube where moving top exposes ?` と `partial の手順は ? を露出させる手で終わる` も、新実装が `tubeIndex` と「末尾が露出手」の両方を満たすため引き続き PASS する。

`大きな盤面でも予算内に partial を返す` は初期値 `REVEAL_MAX_STATES = 200_000` では10秒のタイムアウトに掛かる可能性が高い。20本の盤面は1状態あたり 20×20 の手を評価し、`applyMove` が毎回20本ぶんの配列を確保するため、20万状態は数十秒規模になり得る。**掛かった場合は失敗ではなく Step 6 の入力**として扱い、そのまま次へ進むこと。

- [ ] **Step 6: 実行時間を測って REVEAL_MAX_STATES を確定する**

Run: `npm run test:run -- src/__tests__/bfs.test.ts --reporter=verbose`

`大きな盤面でも予算内に partial を返す` の所要時間を読む。**3秒以内**に収まる最大の値を、`200_000` → `100_000` → `50_000` → `20_000` → `10_000` の順に下げながら再測定して確定する。

判断の根拠: この探索はワーカースレッドで走るので UI はブロックしないが、ユーザーは「解く」を押してから結果を待つ。既存の `SPECULATIVE_MAX_STATES`（200,000）は具体色ソルバーで枝刈りが効く前提の値であり、partial 探索は同一内容の試験管が並ぶ盤面で状態が爆発しやすいため、同じ値が妥当とは限らない。

確定したら、定数のコメントに測定結果を1行追記する。例:

```ts
// 実測: 20本・?16個の盤面で約N.N秒（2026-08-30, Node 22 / M1）。
const REVEAL_MAX_STATES = 50_000;
```

- [ ] **Step 6b: 予算を下げても品質が落ちていないことを確認する**

Run: `npm run test:run -- src/__tests__/bfs.test.ts`

Expected: 全 PASS。特に `複数の ? を1手順で露出させる`（`moves` 2手）と `露出数が同じなら最短手数を返す`（`moves` 1手）が、予算を下げても変わらず通ること。これらは数十状態で決着するため予算の影響を受けない。

- [ ] **Step 7: 全テスト・lint・ビルドを通す**

Run: `npm run test:run && npm run lint && npm run build`

Expected: すべて成功。`description` を削除したので、まだ参照が残っていればここで TypeScript エラーになる。

- [ ] **Step 8: README を更新する**

`README.md` の「色が不明な場合（? の使い方）」節にある部分解の行を差し替える:

変更前:
```markdown
- **部分解**: 推定が難しい場合は、`?` の色を明らかにするための手順がヒントとして表示されます。表示された手順を実行することで隠れた色が判明し、改めて入力して解くことができます。
```

変更後:
```markdown
- **部分解**: 推定が難しい場合は、`?` の色を明らかにするための手順が表示されます。この手順は**一度にできるだけ多くの `?` が判明するように**組まれており、どのステップでどの試験管の `?` が判明するかが手順に注記されます。すべて実行してから判明した色をまとめて入力し、「この盤面から再探索」を押してください。途中まで実行して打ち切り、そこまでで判明した色だけで再探索することもできます。
```

- [ ] **Step 9: コミット**

```bash
git add src/solver/bfs.ts src/solver/types.ts src/__tests__/bfs.test.ts README.md
git commit -m "feat: maximize the number of ? revealed by a partial procedure"
```

---

## 完了条件

- `npm run test:run` / `npm run lint` / `npm run build` がすべて成功する。
- `?` を2本以上の試験管で露出できる盤面に対し、1つの手順で複数の `?` が判明する。
- 手順の各露出ステップに注記が出て、末尾に判明する試験管の一覧が出る。
- 露出できる手順が無い盤面で、その旨のメッセージが出る。
- `src/App.tsx` は無変更（`detectReveal` が複数セル同時の判明にそのまま対応するため）。
