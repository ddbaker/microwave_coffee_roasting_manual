# Microwave Coffee Roasting Manual — public site

Astroで生成する、英語・日本語の静的マニュアルです。公開用ブランチは `cloudflare_integration` のみです。

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

`build` は15ページ、リンク・画像・言語切替、配信ファイルの許可リスト、ブラウザー用JavaScriptがないことを確認します。成果物は `dist/` です。

## 原稿と公開範囲

- 本文の正本：`us_EN/*.md` と `ja_JP/*.md`。既存原稿をビルド時に直接読みます。
- 各言語の `index_*.md` は原稿の目次として保持します。サイトの目次・章順・短い紹介は `src/lib/manual.mjs` で定義します。
- `/` は英語トップ、`/ja/` は日本語トップ。章は `/en/equipment/`、`/ja/equipment/` などです。
- 言語切替は同じ章の別言語へ移動します。通常のリンクのみで動きます。
- `images/` から本文が参照する20枚だけを配信します。既存画像の内容は変更せず、ページ上では説明文を添えます。
- `_com_gpt/`、`analysis/`、`roasting_dashboard/`、`roasting_logs/`、`Open Roasting Dashboard.cmd` はこの公開用構成に含めません。
- `node_modules/`、`.astro/`、`dist/`、`.qa/`、環境変数ファイルはGit管理対象外です。
- `public/` にリポジトリの内容をまとめてコピーしないでください。画像とライセンスのみ、明示した処理で成果物へコピーします。

## Cloudflare Pagesへの接続（次の段階・未設定）

Cloudflare PagesのGit連携で、既存の `ddbaker/microwave_coffee_roasting_manual` のみを選択します。

| 設定 | 値 |
| --- | --- |
| Framework preset | Astro |
| Build command | `npm run build` |
| Build output directory | `dist` |
| Root directory | リポジトリのルート |
| 連携ブランチ | `cloudflare_integration` のみ |
| Node.js | 検証した版に固定（現在24.19.0） |

確認用・本番用を別のPagesプロジェクトにする計画です。確認用は上記ブランチから自動公開し、他のブランチのプレビュービルドは無効にします。本番用は自動公開せず、確認済みの成果物のみを明示的に公開します。`main` は接続対象にしません。

静的出力のため、SSR用の `@astrojs/cloudflare` アダプター、Pages Functions、データベース、ログイン機能は不要です。Cloudflare PagesのAstroプリセットによるGit連携とは別のものです。

GitHubへの保存とCloudflareへの公開は別の操作です。公開設定・URLは、接続完了時にこの文書へ追記します。

## ライセンス

マニュアルの文章および画像は ddbaker に帰属し、[CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/) の条件で提供します。正式なライセンス全文は `LICENSE` を参照してください。利用時は著作者、出典、ライセンスへのリンク、変更した場合はその旨を表示してください。

この宣言の対象は文書・画像です。Astro等の依存ライブラリには、それぞれのライセンスが適用されます。サイト実装コードへの別途のライセンス付与は、この段階では行っていません。
