# 検索エンジンへの登録

登録対象は本番の `https://coffee-roasting-microwaves.pages.dev/`。
Google Search ConsoleではURLプレフィックスとして追加し、HTMLタグで所有者確認します。
所有者が提供した確認タグは `src/lib/search.mjs` に保存し、HTMLのheadへ出力しています。
確認完了後もタグを削除しないでください。認証パスワードではなく、公開される所有者確認情報です。

サイトマップ: https://coffee-roasting-microwaves.pages.dev/sitemap.xml

英日トップ2ページ、本文12ページ、焙煎ログ入口2ページの計16ページです。
個別焙煎ログは選択して表示する構成であり、独立ページとしては登録していません。
404、API、確認用サイトのURLはサイトマップに含めません。
robots.txtからもサイトマップを案内し、各ページのcanonicalとhreflangは本番の絶対URLを使います。

Googleで所有者確認したら、「サイトマップ」で `sitemap.xml` を送信します。
必要に応じて本番トップを「URL検査」で検査し、インデックス登録をリクエストします。
Google側の確認・送信結果が出るまでは登録完了と扱いません。
Bing Webmaster Toolsにも本番を登録してサイトマップを送信します。
DuckDuckGoは通常のリンク結果を主にBingから取得しますが、Bingでの掲載がDuckDuckGoの掲載を保証するわけではありません。

`public/_headers` は確認用固定URLとデプロイ固有・ブランチURLへ `X-Robots-Tag: noindex` を付けます。
本番固定URLにはこのヘッダーを付けません。検索除外を読めるよう、robots.txtで巡回を遮断しません。
既存の古いデプロイ固有URLの配信内容は変更されないため、古い版に遡ってヘッダーを追加するものではありません。

登録は広告・アクセス解析の導入を必要としません。サイトマップは発見を助けますが、掲載可否・時期・順位は検索エンジンが判断します。

公式手順: [Google所有者確認](https://support.google.com/webmasters/answer/9008080?hl=ja)、
[Googleサイトマップ](https://developers.google.com/search/docs/crawling-indexing/sitemaps/build-sitemap)、
[Bing登録手順](https://www.bing.com/webmasters/help/getting-started-checklist-66a806de)、
[Cloudflareヘッダー設定](https://developers.cloudflare.com/pages/configuration/headers/)。
