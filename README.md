# Microwave Coffee Roasting Manual — public site

Astroで生成する、英語・日本語の静的マニュアルです。公開用ブランチは `cloudflare_integration` のみです。

Phase-2 で焙煎ログダッシュボードを追加しました。英語 `/roasting/`、日本語 `/ja/roasting/`。
データの取込・追加・全件再構築・D1接続は [phase-2 運用手順](docs/phase2-operations.md) を参照してください。

## 作業場所とブランチ

- 元の作業フォルダー：`main`。ローカルでの分析・試作を行います。
- この専用worktree：`cloudflare_integration`。公開対象だけを管理します。
- `main` 全体をこのブランチへマージせず、公開する原稿などの変更だけを確認して取り込んでください。
- 未追跡ファイルはブランチに所属しません。元の作業フォルダーで一括追加する場合、`.worktrees/` が含まれないことを確認してください。

## ローカルで使う

Node.js 22.12.0以上（検証環境は24.19.0）とnpmを使います。

```powershell
npm ci
npm run dev
```

表示されたローカルURLをブラウザーで開きます。配信用HTMLの検証とプレビューは以下です。

```powershell
npm run build
npm run preview -- --port 4321
```

`build` は17ページ、リンク・画像・言語切替、配信ファイルの許可リストを確認します。ブラウザー用JavaScriptは2つのダッシュボードページに限定し、マニュアル本文は静的です。成果物は `dist/` です。

## 原稿と公開範囲

- 本文の正本：`us_EN/*.md` と `ja_JP/*.md`。既存原稿をビルド時に直接読みます。
- 各言語の `index_*.md` は原稿の目次として保持します。サイトの目次・章順・短い紹介は `src/lib/manual.mjs` で定義します。
- `/` は英語トップ、`/ja/` は日本語トップ。章は `/en/equipment/`、`/ja/equipment/` などです。
- 言語切替は同じ章の別言語へ移動します。通常のリンクのみで動きます。
- `images/` から本文が参照する20枚だけを配信します。既存画像の内容は変更せず、ページ上では説明文を添えます。
- `_com_gpt/`、`analysis/`、`roasting_dashboard/`、`roasting_logs/`、`Open Roasting Dashboard.cmd` はこの公開用構成に含めません。
- `node_modules/`、`.astro/`、`dist/`、`.qa/`、環境変数ファイルはGit管理対象外です。
- `public/` にリポジトリの内容をまとめてコピーしないでください。画像とライセンスのみ、明示した処理で成果物へコピーします。

## Cloudflare Pagesへの接続

Cloudflare PagesのGit連携で、既存の `ddbaker/microwave_coffee_roasting_manual` のみを選択します。

| 設定 | 値 |
| --- | --- |
| Framework preset | Astro |
| Build command | `npm run build` |
| Build output directory | `dist` |
| Root directory | リポジトリのルート |
| 連携ブランチ | `cloudflare_integration` のみ |
| Node.js | 検証した版に固定（現在24.19.0） |

確認用プロジェクト `coffee-roasting-microwaves-preview` を接続済みです。

- 確認用URL： https://coffee-roasting-microwaves-preview.pages.dev/
- 日本語トップ： https://coffee-roasting-microwaves-preview.pages.dev/ja/
- `cloudflare_integration` へのpushで自動ビルド・公開します。
- Branch controlのPreview branchは `None` に設定済みです。`main` など、他のブランチは自動ビルド・公開しません。
- Cloudflare画面では、この確認用プロジェクトの固定URLが `Production` と表示されます。これはCloudflare内の環境名であり、運用上は確認用サイトです。
- 本番用プロジェクト：`coffee-roasting-microwaves`
- 本番URL： https://coffee-roasting-microwaves.pages.dev/ （日本語は `/ja/`）
- 本番は `cloudflare_integration` を接続先とし、Automatic production branch deploymentsを無効、Preview branchを `None` に設定しています。pushでは本番を更新しません。
- 初回本番公開：`dd890f669223e5c72437388e2b5ff4b77802a05a`（2026-09-18）。確認済みの同じコミットをAstroでビルドしました。
- 初回本番デプロイID：`b90bc0af-7d81-41ef-a4ab-edd775fcfd29`。

マニュアルは静的出力で、SSR用の `@astrojs/cloudflare` アダプターは使用しません。Phase-2 の焙煎ログだけが Pages Functions と D1 を使います。一般閲覧にログインは不要です。

GitHub Appのアクセス対象は `ddbaker/microwave_coffee_roasting_manual` のみです。GitHubへのpush後、Cloudflareのビルド成功と確認用URLを確認してください。本番反映は別の操作として扱います。

## 更新・本番反映・復旧

1. この公開用worktreeで原稿を更新し、`npm run build` で検証します。
2. 公開する変更だけをコミットし、`cloudflare_integration` へpushします。
3. 確認用Pagesの成功したデプロイで、コミットSHAとそのデプロイ固有のURLを記録し、内容を確認します。固定の確認用URLは次のpushで更新されるため、承認する版の特定にはコミットSHAと固有URLを使います。
4. 本番へ反映する際は、そのSHAを別のクリーンな作業場所へcheckoutし、`npm ci` と `npm run build` で静的ファイルを生成します。その成果物をローカルで確認し、確認用デプロイとの内容一致を検証してから公開します。確認後に別の版をビルドし直して混ぜないでください。
5. 既存のGit連携を保ったまま、Wranglerからその `dist` を本番へ送れます。以下は**本番を更新する手動操作**です。`APPROVED_COMMIT_SHA` は確認済みの完全なSHAへ置き換え、対象アカウントと作業場所を確認してから実行します。WranglerのインストールとCloudflareログインは別途必要です。初回公開では管理画面のAstro連携を使用しており、このCLI経由の手順はまだ実行していません。

```powershell
wrangler pages deploy dist --project-name coffee-roasting-microwaves --branch cloudflare_integration --commit-hash APPROVED_COMMIT_SHA
```

6. 本番URLで英日ページと画像を確認し、本番デプロイID・SHAを記録します。本番の自動公開設定は無効のままにします。
7. 復旧時は本番プロジェクトのDeploymentsで、以前の成功したProductionデプロイを選び、`Rollback to this deployment` を実行します。初回公開しかない間は戻り先がないため、既知の正常な成果物を再公開します。確認用プロジェクトのデプロイを本番プロジェクトへロールバックすることはできません。

仕様参照：[Git連携と手動公開](https://developers.cloudflare.com/pages/configuration/git-integration/)、[Wrangler Pagesコマンド](https://developers.cloudflare.com/workers/wrangler/commands/pages/)、[ロールバック](https://developers.cloudflare.com/pages/configuration/rollbacks/)。

## ライセンス

マニュアルの文章および画像は ddbaker に帰属し、[CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/) の条件で提供します。正式なライセンス全文は `LICENSE` を参照してください。利用時は著作者、出典、ライセンスへのリンク、変更した場合はその旨を表示してください。

この宣言の対象は文書・画像です。Astro等の依存ライブラリには、それぞれのライセンスが適用されます。サイト実装コードへの別途のライセンス付与は、この段階では行っていません。
