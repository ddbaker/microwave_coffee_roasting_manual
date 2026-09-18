# Phase-2: 焙煎ログの運用

## 構成と公開範囲

Astro の静的マニュアルに、英語 `/roasting/`、日本語 `/ja/roasting/` を追加。
この2ページだけがブラウザーで JavaScript を実行します。既存マニュアルは静的なままです。
Pages Functions は Workers の実行環境で動き、`GET /api/roasts/` と
`GET /api/roasts/<roast_id>` から D1 を読み取ります。
`public/_routes.json` により Functions の起動範囲をこの API に限定しています。

確認用サイト: https://coffee-roasting-microwaves-preview.pages.dev/roasting/

確認用 D1:

- アカウント: `ddbaker@github` (`8a5344178ba6d31dad27a889d7d38317`)
- データベース: `coffee-roasting-preview`
- ID: `d4b99e8d-928e-4847-b647-91602f798189`
- Pages の binding 名: `DB`
- 接続先プロジェクト: `coffee-roasting-microwaves-preview` の Production / Preview 環境

この Pages プロジェクトの Production は、運用上の「確認用固定URL」を意味します。
本番プロジェクト `coffee-roasting-microwaves` には D1 を追加していません。
本番公開には別の D1 を用意し、確認したソース一式から復元してから接続してください。
本番の自動デプロイは無効のままです。

Pages の接続設定は Cloudflare 側で管理します。DB ID を含むローカル設定は
Git 管理対象外です。公開ブランチに `wrangler.toml` / `wrangler.jsonc` を追加して
確認用 D1 を本番と共有しないでください。ZIP、SQL、ローカルDB、認証情報も配信しません。
公開 API で取得できるデータは、焙煎ログの検索情報・グラフ値・元の焙煎注記・出典です。

## 元データとグラフの規則

正本は `roasting_logs/gen_by_ddbaker/log_spreadsheet_snapshot_2026Sep14.zip`。
既存のローカル実装の README に残る `gen_by_man` は旧パスです。
ODS の `plots` シートから既存のキャッシュ値を読み、数式・マクロ・外部リンクは実行しません。
旧ローカル実装の解析処理を `scripts/roasting/ods_parser.py` に独立させました。

- 2026-09-14 のスナップショット: 352冊、7,846照射ステップ。
- グラフ対象: 体積値と実時間座標の両方を持つ237冊。残る115冊も D1 に保持し、グラフ一覧から除外。
- 右軸: 各照射の `W × 秒 / 1000` (kJ)。累積エネルギーでもワット値でもありません。
- 体積は休止終了時、エネルギーは照射終了時に配置。
- 下軸: 休止込み実時間。上軸: 累積照射時間。休止区間を短いバーで示す。
- `275/300` は287.5 mL。`275+` は280 mL、`275-` は270 mL。
  ±5 mL は参照PNGの作図仮定です。原表記と換算方式も保存しています。
- 出力の0・空白はエネルギー欠測として線を切ります。休止・実時間が不明な点を勝手に配置しません。
- 基本範囲は250–350 mLと0–30 kJ。範囲外の観測があれば25 mL / 5 kJ単位で軸を拡張。
- 初期体積を上回った後に初期体積以下へ戻る点を注記。各ログへ参照のステップ10を固定しません。
- PNGは2400×1555。参照と同じ配置・系列・配色。出典ファイル名は選択した実ファイル名。
- 原セルを探すための行番号、元の体積表記、照射ワット、休止値、数式・キャッシュ由来の注記を詳細に表示。
  ODS全体の原バイト列は元ZIPで保管します。D1を原本の唯一の保管場所にしないでください。

参照ログ: `2026/ethiopia_gesha-villedge_natural_23-24crop-26Jun/coffee_roast_26Jul25.ods`。
別途提供された sample ODS と26ステップの作図値が一致。
照射14:20、経過25:59、462 kJ、ステップ10は287.5 mL・照射7:50・経過12:36。
最後の体積はID25の325 mL、ID26の投入は6 kJ（体積未記録）。

## 初回準備

この公開用worktreeをカレントディレクトリにして実行します。Python 3、Node.js 24、
Wranglerが必要です。PowerShellヘルパーは通常のPython、またはこのPCのCodex同梱Pythonを使います。
別の場所なら `-Python 'C:\path\python.exe'` を指定してください。

```powershell
npm ci
npm install --prefix .data/tools --cache .data/npm-cache --no-audit --no-fund wrangler@4.135.0
node .data/tools/node_modules/wrangler/bin/wrangler.js login
```

認証は管理者本人のブラウザーで行います。認証トークンをサイト・Git・ZIPへ入れません。
初回だけ、次の内容を `wrangler.preview.jsonc` に保存します。このファイルはGit管理対象外です。

```json
{
  "name": "coffee-roasting-microwaves-preview",
  "pages_build_output_dir": "./dist",
  "compatibility_date": "2026-09-18",
  "d1_databases": [{
    "binding": "DB",
    "database_name": "coffee-roasting-preview",
    "database_id": "d4b99e8d-928e-4847-b647-91602f798189"
  }]
}
```

## ZIP の追加・更新

ZIPは公開用フォルダーの外で保管します。作成日時ではなく、ZIPと各ODSのSHA-256で内容を識別します。
年月日フォルダーより前のZIP内ルート（例 `logs/`）を取り除いた
`YYYY/folder_name/filename.ods` が一意キーです。同じフォルダーに既取込・未取込が混在していても判定できます。

まずSQLを生成・ローカル検証するだけなら:

```powershell
./scripts/roasting/update.ps1 -Zip 'D:\devel\microwave_coffee_roasting_manual\roasting_logs\gen_by_ddbaker\log_spreadsheet_snapshot_2026Sep14.zip'
```

確認用サイトのD1へ反映する場合:

```powershell
./scripts/roasting/update.ps1 -Zip 'D:\path\new-snapshot.zip' -Target Preview
```

通常更新では、ZIPに含まれない既存ファイルを残します。同じパス・同じ内容のファイルバージョンは
追加しません。同じパスの内容が変わったときだけ新バージョンを作り、そのパスの参照を更新します。
毎回、取込履歴と対象ファイルの一覧は記録します。元のファイル数やグラフ数は重複しません。
更新後は画面を再読み込みしてください。コードの再ビルド・再公開は不要です。

`-Zip 'D:\path\a.zip','D:\path\b.zip'` のように複数を指定できます。同じパス・同じ内容は統合します。
複数ZIPに同じパスの異なる内容が含まれる場合は、安全に停止します。採用する正本を1つに整理して再実行してください。
ZIP内のパス異常、壊れたODS、1ステートメント95 KB以上の非常に大きなプロファイルも反映前に停止します。
空のZIPで全データを消す処理はありません。

更新の簡易運用は「新しいZIPを置く → 上記1コマンド」です。無人のフォルダー監視やスケジューラーは導入していません。
ZIPファイルの作成日時が変わっても内容が同じなら、ODSの重複取込は起きません。

## 全件再構築と障害復旧

全件再構築では、指定したZIP群だけを有効な集合にします。通常更新と異なり、含まれないファイルは
公開対象から外れます。完全な正本一式を指定してください。

```powershell
./scripts/roasting/update.ps1 -Zip 'D:\path\complete-snapshot.zip' -Rebuild -Target Preview
```

DB内の全テーブルが消失していても、同じコマンドでスキーマから復元できます。
DBそのものが削除された場合は、次の順で復旧します。

1. `node .data/tools/node_modules/wrangler/bin/wrangler.js d1 create coffee-roasting-preview --location apac`
2. 返された新IDへ `wrangler.preview.jsonc` を更新。
3. 正本ZIP群を指定し `-Rebuild -Target Preview` を実行。
4. Cloudflare の確認用 Pages 設定で Production / Preview の D1 binding `DB` を新IDへ変更。
5. 確認用サイトを再デプロイし、件数・参照グラフ・絞り込みを確認。

ファイルバージョンと各取込の所属を分離し、最後のSQLだけで有効な取込IDを切り替えます。
途中失敗で不完全な集合を公開しません。ただし、WranglerのリモートSQL取込中はD1が一時的に
応答できなくなる場合があります。画面はエラーと再読み込みボタンを表示します。
SQLの再実行が必要なら元ZIPからコマンドを再実行し、新しい取込IDを生成してください。
管理者更新は同時実行せず、1回の完了を待って次を実行します。

旧バージョンと取込履歴は復旧用に保持するため、長期運用では容量が増えます。
不要履歴の削除はこのフェーズでは自動化していません。初回DBは約5.47 MBです。

## 管理者専用の仕組み

公開APIはGETだけで、POST / PUT / PATCH / DELETEは405を返します。
アップロード・更新・再構築の公開エンドポイントはありません。
書き込みはCloudflareの権限を持つ管理者が手元のCLIから実行します。
一般閲覧者にはログインを要求しません。Cloudflareアカウントへのアクセス権を他者へ渡さない前提です。

## ローカル確認とテスト

```powershell
./scripts/roasting/update.ps1 -Zip 'D:\path\complete-snapshot.zip' -Rebuild -Target Local
npm run build
./scripts/roasting/local-dev.ps1
```

http://127.0.0.1:8788/roasting/ を開きます。ローカル起動はGit管理外の `wrangler.jsonc` を作ります。
公開作業前にその設定ファイルを別の場所へ移し、Pagesの管理画面設定を使ってください。
`astro preview` だけではAPIは起動しません。

```powershell
python scripts/roasting/test_import.py
python scripts/roasting/import_logs.py --zip 'D:\path\complete-snapshot.zip' --rebuild --sqlite .data/roasting.sqlite3
node --test scripts/test-roasting-api.mjs
node scripts/test-roasting-browser.cjs
```

Pythonテストは提供された原ZIPとsample ODSを独立照合します。APIテストは上記SQLiteを使用。
ブラウザーテストはPlaywrightとMicrosoft Edgeを使用します。別PCでは環境変数
`PLAYWRIGHT_MODULE` にPlaywrightのインストールパスを設定してください。
`ROAST_BASE_URL` で検証URLを変更できます。352件の提供スナップショットを基準とする回帰テストです。

## コードの公開

`cloudflare_integration` へのpushは確認用サイトだけを自動更新します。
データは別操作でD1に取り込みます。DB IDとbindingはPages側の既存設定が使われます。
本番は自動公開無効のまま、別途レビューして反映します。

公式仕様: [PagesとD1の接続](https://developers.cloudflare.com/pages/functions/bindings/)、
[Pagesの設定](https://developers.cloudflare.com/pages/functions/wrangler-configuration/)、
[D1の制限](https://developers.cloudflare.com/d1/platform/limits/)、
[D1の料金・無料枠](https://developers.cloudflare.com/d1/platform/pricing/)。
有料プランへの変更はこの作業では行いません。
