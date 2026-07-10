# 盤面レポート機能 設計

**目的:** 「アイテムを使わないと解けない」と判断された盤面（`?` を含まず、探索してもmoveが見つからない盤面）を、開発者が把握できるようにする。ユーザーが1クリックで盤面情報を送信できる導線を、心理的抵抗の少ない文言で提供する。

## 表示条件

`SolutionList` の `result.type === 'unsolvable'` 分岐内、以下をすべて満たす場合のみボタンを表示する：

- 対象盤面（`initialTubes ?? tubes`）に `'?'` が1つも含まれない
- `import.meta.env.VITE_REPORT_ENDPOINT` が設定されている（後述）

`deep` フラグの有無（通常探索 / 深い探索）は問わない。

### 送信先が未設定の場合の挙動

このリポジトリはパブリックであり、誰でもclone・フォークしてビルド・デプロイできる。送信先URLをソースに直接埋め込むと、フォーク先のユーザーが送信した盤面情報が元の開発者（nureha）の管理するスプレッドシートに届いてしまう。これを避けるため：

- 送信先URLはソースにハードコードしない。Vite の環境変数 `VITE_REPORT_ENDPOINT` として、ビルド時にのみ注入する
- 本リポジトリの GitHub Actions ワークフロー（`.github/workflows/deploy.yml`）でのみ、GitHub Actions の repository secret から注入する
- 環境変数が存在しない場合（フォーク先のビルド、ローカル開発でセットしていない場合など）、レポート機能のUIごと非表示にする（ボタンも注釈も出さない）

## クライアント側フロー

`SolutionList.tsx` 内、`unsolvable` 分岐に `ReportBoardSection` を追加する。

1. 初期表示: ボタン「この盤面を共有して改善に協力する」
2. クリック: インライン確認に切り替える（既存の `ClearSaveForm` と同じ「クリックで展開するインラインフォーム」のパターンを踏襲）
   - 文言: 「盤面情報を開発者に送信します。送信すると元に戻せません。」
   - 「送信する」「キャンセル」ボタン
3. 「送信する」押下: 送信中は「送信中...」を表示してボタンを無効化し、次のリクエストを送る
   ```
   fetch(endpoint, { method: 'POST', body: JSON.stringify({ board, mode }) })
   ```
   - `Content-Type` ヘッダーは明示的に指定しない（未指定時のデフォルトは `text/plain` となり、CORSのpreflightが発生しない。Google Apps Script の Web App は `doOptions` を実装していないため、preflightが飛ぶと失敗する）
   - `board`: `initialTubes ?? tubes` を `本数, 空,` 区切りの文字列にフォーマットしたもの（既存 `App.tsx` の `handleCopyState` 内 `formatTubes` と同じロジックを共通化）
   - `mode`: `'通常探索'` または `'深い探索（120秒）'`（`result.deep` の有無で決定）
4. 成功時（`response.ok` かつ返却JSONの `ok === true`）: 「送信しました。ご協力ありがとうございます！」を表示し、フォームを閉じる
5. 失敗時（fetch自体の失敗 / `response.ok` が false / JSONの `ok` が false）: 「送信に失敗しました。時間をおいて再度お試しください。」+ 再試行できる「送信する」ボタンを再表示

## 送信データ

個人情報・ブラウザ情報は含めない。

```json
{ "board": "AB, 空, CDCD, ...", "mode": "通常探索" }
```

## GAS側（`gas/reportBoard.gs`。リポジトリに保管するが、実際の反映は開発者が script.google.com 上で手動で行う）

- スプレッドシートに直接バインドしたスクリプトプロジェクトとして作成する（`SpreadsheetApp.getActiveSpreadsheet()` を使うため、GitHub側にはSSのIDやトークンを一切持たない）
- `doPost(e)`:
  1. `JSON.parse(e.postData.contents)` でパース。失敗時はエラーJSONを返す
  2. バリデーション（**GitHub API・PAT・Issue作成は使わない。認証なしの公開エンドポイントのため必須**）:
     - `mode` はホワイトリスト `['通常探索', '深い探索（120秒）']` のいずれかであること
     - `board` は文字列であり、長さが300文字以下であること
     - `board` の文字種が `/^[A-Z0-9、,\s空]*$/` に一致すること（不明なフォーマットは記録しない）
     - 検証に失敗した場合は何も記録せず `{ ok: false }` を返す
  3. 検証を通過した場合のみ、アクティブシートに1行追記: `[new Date(), mode, board]`
  4. `ContentService.createTextOutput(JSON.stringify({ ok: true })).setMimeType(ContentService.MimeType.JSON)` を返す
- レート制限や上限は設けない。GAS無料枠自体の実行回数上限（1日あたりのURL Fetch/実行時間クォータ）を実質的な下限として扱う。バリデーションだけで不正な形式の記録を防ぐ

## ビルド設定変更

- `.github/workflows/deploy.yml` の `vite build` ステップに `VITE_REPORT_ENDPOINT: ${{ secrets.VITE_REPORT_ENDPOINT }}` を環境変数として渡す
- ローカル開発でこの機能を試す場合は `.env.local`（`*.local` は既に `.gitignore` 対象）に `VITE_REPORT_ENDPOINT=<自分のGAS Web App URL>` を設定する
- `.env.example` を追加し、変数名のみをコミットする（値は空）

## 開発者側の手動対応（このセッションでは代行不可）

1. 記録用のGoogleスプレッドシートを作成する
2. そのスプレッドシートの拡張機能からApps Scriptを開き、`gas/reportBoard.gs` の内容を貼り付ける
3. 「デプロイ」→「新しいデプロイ」→ 種類「ウェブアプリ」、実行ユーザー「自分」、アクセスできるユーザー「全員」でデプロイし、Web App URLを取得する
4. `gh secret set VITE_REPORT_ENDPOINT` （または GitHub の Settings > Secrets and variables > Actions）でリポジトリのActions secretとして登録する

## 対象外・やらないこと

- GitHub Issueの作成、GitHub API連携、PATの発行・保管は行わない
- IPベース・件数ベースのレート制限は実装しない（バリデーションのみで対応する、という開発者判断による）
- ブラウザ情報・ユーザー識別情報の送信は行わない
