# リカバリ・再探索・盤面クリア 設計仕様

## 背景 / 目的

Water Sort Solver で `?`（未判明の色）を含む盤面を解くと、ソルバーは色を仮定した
「推定解（speculative）」か、`?` を露出させる手順を示す「部分解（partial）」を返す。
プレイ中に実際の色が判明したときのワークフローに、以下の課題がある。

1. **推測ミスからのリカバリができない**：推定解に沿って手を進めた後、判明した実際の色を
   そのマスに入力すると、現状は盤面が初期状態へリセットされ、途中経過が失われる。
2. **reveal 後の再探索ができない**：部分解の手順で `?` を露出させ実際の色を入力した後、
   「他の `?` を判明させる手順」や「解ける手順」を、その状態から探し直せない。
3. **盤面クリア手段がない**：新しいステージに進む際、盤面を空にするにはページ
   リロードしかない。

あわせて、当初「クリアした盤面を他者と共有する」想定で追加した **クリア後の盤面保存機能
（`ClearSaveForm`）を廃止**する。同一盤面が別プレイヤーに出現することは実質なく、用途が
失われたため。

## 中核となる観察

課題 1 と 2 は同じ操作で統一できる：ユーザーが **`?` を具体的な色へ確定入力した
＝新しい情報が入った（reveal）** とき、途中盤面を保ったまま「この盤面から再探索」できれば
両方を満たす。「推測が当たり/外れと判明」も「隠れていた色が判明」も、どちらも
`?` → 具体色 という同じ遷移として捉えられる。

## スコープ

- A. reveal 検知で途中盤面を維持する（初期状態へリセットしない）
- B. 「この盤面から再探索」ボタン（現在の表示盤面を新しい初期状態として解き直す）
- C. 「クリア」ボタン（盤面を空に・本数は維持・確認ダイアログあり）
- D. `unsolvable` の文言を「初回 solve」と「再探索（途中盤面）」で分岐する
- E. クリア後の盤面保存機能（`ClearSaveForm`）を削除（達成メッセージ「🎉 クリア！」は残す）

**スコープ外**：保存/読み込みモーダル（`SaveModal` / `useSaves`）は現状維持（手動で
現在盤面を保存する別機能）。reveal で判明した色を「元レイアウトの位置」に埋め戻す処理は
行わない（再探索では `?` セルも移動し位置対応が壊れるため確実に実装できない）。

---

## A. reveal 検知で途中盤面を維持する

### 純関数 `detectReveal`

新規モジュール `src/reveal.ts`：

```ts
import type { UITube } from './solver/types';

// あるセルが編集前 '?' → 編集後に具体色（'' でも '?' でもない）へ変わったか。
// = 未判明の色が判明した（reveal）シグナル。
export function detectReveal(oldTubes: UITube[], nextTubes: UITube[]): boolean;
```

- UITube（表示座標、上から下）レベルでセル単位に比較する。ユーザーは表示中のマスを直接
  編集するため、UI 座標での単純比較で正しく検知できる。
- 判定：いずれかの `(t, c)` で `oldTubes[t][c] === '?'` かつ `nextTubes[t][c]` が
  `''` でも `'?'` でもない → `true`。
- 非 reveal：`'' → 色`（初期入力）、`色 → 別の色`（既知セルの訂正）、変化なし、`'?' → ''` は
  すべて `false`。

### `handleTubesChange`（`App.tsx`）への分岐追加

先頭（`validateColorCounts` 実行後）に reveal 分岐を追加：

```
if (result && detectReveal(tubes, newTubes)) {
  setTubes(newTubes);          // 途中盤面＋判明した色を維持（初期へ戻さない）
  setResult(null);             // stale な解を破棄
  setPendingResearch(true);    // 右パネルに再探索プロンプトを表示
  return;
}
```

条件は `result` の型を問わない（`unsolvable` 後に判明色を訂正した場合も再探索へ導く）。

- `completedCount` / `initialTubes` は据え置き（`result` が null かつ再探索プロンプト表示中は
  参照されない）。
- reveal 以外の編集は既存ロジックのまま（解が有効なら初期へマップして再生、無効ならクリア）。

---

## B. 「この盤面から再探索」

### solve 経路の整理

既存 `handleSolve` を `runSolve(board: UITube[], isResearch: boolean)` に整理する。
振る舞いは現行 `handleSolve` と同一で、引数の `board` を解き、`initialTubes = board`、
`completedCount = 0`、`pendingResearch = false`、`resultIsResearch = isResearch` を設定して
worker（通常/deep）へ dispatch する。

- 左の「解く」ボタン → `runSolve(tubes, false)`
- 再探索の全導線 → `runSolve(tubes, true)`

再探索は「現在表示中の盤面を新しい初期状態として解く」＝ `runSolve(tubes, true)` に集約される。
新しい探索ロジックは不要。`initialTubes` は現在盤面へ再ベースされる（ステップ送り・
`handleReset` の基準として正しい）。

> 注：クリア後保存（E で削除）が無くなるため、「真の初期盤面」を別管理（`originalTubes`）
> する必要はない。`initialTubes` の再ベースで問題は生じない。

### ボタン配置（3か所）

いずれも押下で `runSolve(tubes, true)` を呼ぶ。

1. **再探索プロンプト**（`pendingResearch` 時、右パネル）：
   「盤面が変わりました。この盤面から再探索できます。」＋「この盤面から再探索」ボタン。
2. **`speculative` 結果パネル**：ヘッダの「リセット」の隣に「この盤面から再探索」。
3. **`partial` 結果パネル**：末尾に「この盤面から再探索」（reveal 手順実行後の再探索導線）。

### 右パネルの分岐

現行 `simulation | solving | deepSolving | SolutionList` に `pendingResearch` を追加：

```
... : (mode === 'solver' && pendingResearch) ? <ResearchPrompt onResearch=... />
    : <SolutionList ... />
```

---

## C. 「クリア」ボタン

- 配置：action-row（ソルバー／シミュレーション両モード）。ラベル「クリア」。
- `handleClear`：
  - 盤面に非空セルがあれば `window.confirm('盤面をクリアしますか？現在の入力は失われます。')`。
    キャンセルなら何もしない。空盤面なら確認なしで実行。
  - 実行内容：`setTubes(makeEmptyTubes(tubeCount))`（本数維持）、`setResult(null)`、
    `setError(null)`、`setCompletedCount(0)`、`setInitialTubes(null)`、
    `setPendingResearch(false)`、`setResultIsResearch(false)`、`setSimHistory([])`。

---

## D. `unsolvable` の文言分岐

`SolutionList` に `isResearch: boolean` prop を追加し、`unsolvable` 分岐を2系統に。

- **初回 solve（`isResearch === false`）＝現状維持**
  - 非 deep：「深い探索モード（最大120秒）をオンにして再度『解く』を試してください。」
  - deep：「アイテム（空き試験管の追加など）を使用しないとクリアできない盤面の可能性が
    あります。」
  - ＋ 盤面共有（`ReportBoardSection`）ボタン。

- **再探索＝途中盤面（`isResearch === true`）＝新規**
  - 文言：「この盤面（手順の途中）からは解が見つかりませんでした。推測した色が実際と
    違ったか、途中で詰みに入った可能性があります。手順のチェックを戻すか、判明した色を
    見直して再探索してください。パズル自体はアイテムなしで解ける可能性があります。」
  - **`ReportBoardSection`（レポートボタン）は表示しない**（ソルバーの限界ではなく
    ユーザーの分岐なので共有しても改善に使えない）。

---

## E. クリア後の盤面保存機能の削除

- `SolutionList` から `onSaveInitial` prop と `ClearSaveForm` コンポーネントを削除。
- クリア達成表示は残す：`cleared`（`moves.length > 0 && completedCount === moves.length`）の
  とき「🎉 クリア！」メッセージのみ表示（保存入力欄は無し）。
- `App.tsx` の `onSaveInitial={name => save(name, initialTubes ?? tubes)}` 配線を削除。
- `useSaves` の `save` / `SaveModal` は保持（手動保存で引き続き使用）。

---

## App の状態変更まとめ

- 追加：`pendingResearch: boolean`、`resultIsResearch: boolean`。
- 変更：`handleSolve` → `runSolve(board, isResearch)`。
- `pendingResearch` をクリアする契機：`runSolve` / `handleClear` / `handleLoad` /
  `handleTubeCountChange`。`resultIsResearch` は `runSolve` で設定、`handleClear` 等でリセット。

## データフロー（reveal → 再探索）

1. 推定解/部分解を表示中、ユーザーが判明した色を `?` マスへ入力。
2. `handleTubesChange` が `detectReveal` を検知 → 途中盤面を維持し `pendingResearch = true`。
3. 右パネルに再探索プロンプト。ユーザーが「この盤面から再探索」を押下。
4. `runSolve(tubes, true)` → 現在盤面を初期状態として solve。`resultIsResearch = true`。
5. 結果が `unsolvable` なら D の途中盤面向け文言（レポート非表示）。`speculative`/`partial`/
   `solved` なら通常表示（再探索ボタン付き）。

## エラーハンドリング

- `runSolve` は既存の `validateTubes` を再利用。再探索時に途中盤面が不正（色数超過等）なら
  `error` を表示し `result` は出さない。
- `window.confirm` キャンセルは no-op。
- worker エラーは既存ハンドラのまま。

---

## テスト方針（TDD）

自動テストは既存パターン（純関数のユニットテスト＋`SolutionList` の props 駆動 RTL）に合わせる。
worker 依存の App 統合フロー（`runSolve` の解探索、`pendingResearch` 遷移、クリア）は
既存同様に自動テスト対象外とし、実装後に手動 verify（アプリ実行）で確認する。

### `src/__tests__/reveal.test.ts`（純関数）

- `'?' → 色` を含む → `true`
- `'' → 色`（初期入力）→ `false`
- `色 → 別の色`（既知の訂正）→ `false`
- 変化なし → `false`
- `'?' → ''` → `false`

### `src/__tests__/SolutionList.test.tsx`（RTL 追記）

- `speculative`：`この盤面から再探索` ボタンが存在し、押下で `onResearch` が呼ばれる。
- `partial`：同上。
- `unsolvable` かつ `isResearch = true`：途中盤面向け文言を表示し、`VITE_REPORT_ENDPOINT`
  設定済みでも共有ボタンを表示しない。「アイテム」文言も出さない。
- `unsolvable` かつ `isResearch = false`：現状どおり（endpoint 設定時に共有ボタン表示）。
- `solved` かつクリア済み：「🎉 クリア！」メッセージを表示し、保存入力欄（textbox / 保存
  ボタン）は存在しない。

## 変更ファイル

- 新規：`src/reveal.ts`、`src/__tests__/reveal.test.ts`
- 変更：`src/App.tsx`（`runSolve`、reveal 分岐、`pendingResearch`/`resultIsResearch`、
  `handleClear`、クリアボタン、再探索プロンプト、`SolutionList` への props、保存配線削除）
- 変更：`src/components/SolutionList.tsx`（`onResearch`/`isResearch` prop、再探索ボタン×2、
  `unsolvable` 文言分岐、`ClearSaveForm` 削除・クリアメッセージ存置）
- 変更：`src/__tests__/SolutionList.test.tsx`
