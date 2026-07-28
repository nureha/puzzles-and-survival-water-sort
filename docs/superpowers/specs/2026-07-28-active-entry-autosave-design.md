# 進行中データ（active entry）による判明状態の自動保存 設計仕様

## 背景 / 目的

`?` を含むパズルを進めていくと、推測・露出で少しずつ `?` が判明する。ユーザーは
**判明した状態（スタート状態）を保存して後で再開**したい。

- 例：10 個の `?` から開始 → 推測・露出で 6 個まで減らして行き詰まる → その「`?` が
  6 個のスタート状態」を保存し、後で読み込んで再開したい。
- 最後まで解けたときに盤面を保存する必要はない（クリア後保存 `ClearSaveForm` は廃止済み）。
- **読み込んだデータは基本的に別保存しない**ので、読み込み中の保存はそのデータへ上書きしたい。

## 用語

- **スタート状態**：各ボトルが「満杯（4 マス埋まり、`?` を含んでよい）」か「完全に空」の
  いずれか。途中まで注いだ半端なボトルが存在しない状態。
  - `isStartState(tubes)` = すべての tube について `tube.every(c => c === '')` または
    `tube.every(c => c !== '')`。
- **active entry**：現在「進行中」の保存データ。`activeEntryId: string | null` で保持。
- **判明（reveal）**：あるセルが `?` → 具体色 に変わること（`detectReveal`）。
- **訂正**：既に入れた具体色を別の色へ変えること。

## 中核方針

保存データは常に**スタート状態**（レイアウト不変・半端なボトル無し）。`?` を具体色へ
変えてもボトルは満杯のままなのでスタート状態は保たれる。よって：

- 現在盤面がスタート状態なら、その盤面そのものが有効な保存対象＝**丸ごと上書き**で
  「判明・訂正マスだけが変わった元データ」になる（位置対応の計算不要）。
- アプリ内でステップ送りして露出させた**途中盤面**での判明は、`?` の内部インデックス
  （ボトル・下からの位置）で元データの該当 `?` セルへ書き戻す。partial の露出手順は
  既知セルのみを動かし `?` セルは動かないため、内部インデックスは不変で正確。

**再探索・ステップ送りは「解の案内／プレビュー」であり、active entry（保存データ）には
一切影響しない。** 保存データは判明・訂正のみで更新される。

## モデル

### active entry のライフサイクル

- **設定**：
  - 手動で新規保存した（`save` の直後、新エントリの id を保持）
  - 既存データへ手動上書きした（`overwrite` した id を保持）
  - データを読み込んだ（`handleLoad` の entry id を保持）
- **解除**（`activeEntryId = null`）：
  - クリア（`handleClear`）
  - 本数変更（`handleTubeCountChange`）
  - データ削除で対象が active だったとき

### 手動保存の制約

- 手動保存（`SaveModal` の保存 / 上書き）は **`isStartState` のときのみ許可**。
  非スタート状態なら `alert('スタート状態（各ボトルが満杯か空）でないと保存できません')` で拒否。
- 保存する盤面 = 現在の表示盤面（スタート状態）そのまま。

### 自動保存（判明・訂正時）

`handleTubesChange` 内、編集が起きたとき（`newTubes` が `tubes` と異なる）：

- `activeEntryId` が無ければ何もしない（自動保存しない）。
- ある場合、active entry の保存盤面を次のように更新して `overwrite(activeEntryId, 更新後)`：
  - **`isStartState(newTubes)` のとき**：active entry を `newTubes` で丸ごと上書き。
    判明・訂正どちらも反映される（スタート状態なのでレイアウト不変）。
  - **途中盤面（非スタート状態）のとき**：`?` → 具体色 の判明のみを、内部インデックス
    `(tube t, index i)` で entry 盤面へ書き込む。**安全策として、書き込み先 entry セルが
    `?` の場合のみ書き込む**（`?` でなければスキップし、誤上書きを防ぐ）。

この自動保存は既存の reveal 表示挙動（approach C：`setTubes(newTubes)` で解・進捗を維持）
とは独立に行う（`result` の有無に関わらず、`activeEntryId` があれば実行）。

### 制約 / 限界（明記）

- **speculative の手をアプリ内でステップ送りした後の判明**は、`?` セルが移動しているため
  内部インデックスによる書き戻し位置がズレ得る。上記の「entry セルが `?` のときのみ書き込む」
  安全策により誤上書きは避けるが、その判明は保存に反映されないことがある。確実に反映したい
  場合はスタート状態（未ステップ）で判明入力する。
- **途中盤面での訂正**（既知色→別の色）は自動保存対象外。スタート状態で訂正すれば
  丸ごと上書きで反映される。

## 上書き既定（read → 保存＝上書き）

- `activeEntryId` があるとき、`SaveModal` の主保存アクションはそのデータへの上書きを既定にする。
- モーダルに現在の active entry を明示（例：「進行中: <名前>（自動保存中）」）。
- 別パズルとして保存したいときのために「新規として保存」も残す。
- 既存の各データ行の「上書き / 読み込み / 削除」は維持。「上書き」した場合その id を active にする。

## App / hook の変更

- `useSaves.save` を、生成した新エントリ（または id）を返すよう変更（active 設定のため）。
- App state に `activeEntryId: string | null` を追加。
- `handleLoad`：`activeEntryId = entry.id`。
- `handleClear` / `handleTubeCountChange`：`activeEntryId = null`。
- `handleTubesChange`：上記「自動保存」を追加。
- `SaveModal`：保存の start-state ガード、active entry 表示、上書き既定、`onSave` が id を返す配線。
- 現在「保存 / 読み込み」ボタンが実行している `inferUnknowns(autoFillUnknown(tubes))` は、
  入力を満杯（スタート状態）に整える用途として維持する（途中盤面には適用されない前提。
  非スタート状態は保存ガードで弾かれる）。

## テスト方針（TDD）

worker 非依存の純ロジックを中心に自動テスト、UI 配線は既存パターン＋手動 verify。

### 純関数

- `isStartState`（新規）：満杯／空のみ true、半端なボトルは false、`?` を含む満杯は true。
- 自動保存の盤面更新ロジックを純関数に切り出す
  `applyRevealToEntry(entryTubes, oldTubes, newTubes): UITube[]`：
  - `newTubes` がスタート状態 → `newTubes` を返す（丸ごと）。
  - 途中盤面 → `?`→色 の内部 `(t,i)` を、entry が `?` の箇所のみ反映して返す。
  - entry セルが `?` でない `(t,i)` はスキップ（誤上書き防止）。

### コンポーネント（RTL）

- `SaveModal`：非スタート状態で保存ボタン押下 → `onSave`/`onOverwrite` が呼ばれない（ガード）。
- `SaveModal`：active entry 表示と上書き既定の挙動。

### 手動 verify（worker 依存フロー）

- 10 `?` から partial 露出手順をステップ→判明入力→active entry が自動更新される。
- 読み込み → 進めて判明 → 同じデータへ上書きされる（新規増殖しない）。
- クリア/本数変更で active 解除、以後は自動保存されない。

## 変更ファイル

- 新規：`src/board.ts`（`isStartState`, `applyRevealToEntry`）、`src/__tests__/board.test.ts`
- 変更：`src/hooks/useSaves.ts`（`save` が id を返す）
- 変更：`src/App.tsx`（`activeEntryId`、自動保存、ライフサイクル）
- 変更：`src/components/SaveModal.tsx`（start-state ガード、active 表示、上書き既定）
- 変更：`src/__tests__/SaveModal.test.tsx`（新規または追記）
