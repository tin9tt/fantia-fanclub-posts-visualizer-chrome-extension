# DesignDoc: Fantia fanclub posts visualizer Chrome Extension

## 0. Abstract/Summary

この DesignDoc は、`https://fantia.jp/fanclubs/*`・`https://fantia.jp/fanclubs/*/posts` 専用の Chrome 拡張機能について記述する。

対象ページはコンテンツ一覧ページであり、各コンテンツは `class="module post post-md-square"` を持つ `div` として表示される。各コンテンツ要素は、サムネイル、タイトル、本文概要、メタ情報、投稿詳細へのリンクを含む。

本拡張機能は、以下の 2 つの表示改善を行う。

* コンテンツタイトルに含まれる `[動画連動] ` / `[音声連動] ` という文字接頭辞を削除し、代わりにサムネイル画像上のバッジとして視覚的に表示する。
* 未設定サムネイルを、Fantia Posts API から取得した投稿本文内の画像に置き換える。

これにより、一覧ページ上でコンテンツの種類と内容をより直感的に把握できるようにする。

## 1. Goals

* Fantia の特定ファンクラブ投稿一覧ページに限定して動作する Chrome 拡張機能を提供する。
* 投稿カードごとのタイトル接頭辞を削除し、タイトル本文を読みやすくする。
* `[動画連動] ` / `[音声連動] ` の種別を、サムネイル右下のアイコンバッジとして表示する。
* 未設定サムネイルの場合に限り、Fantia Posts API の `post.blog_comment` に含まれる最初の画像 URL を取得し、一覧サムネイルとして表示する。
* API から取得した thumbnail URL はキャッシュし、一覧ページ表示時の通信回数と待ち時間を抑える。
* Fantia 側の既存 DOM 構造やリンク遷移を可能な限り壊さず、表示拡張に限定する。

## 2. Features

### コンテンツの系統表示による明瞭化

概要: コンテンツのタイトル接頭辞を文字情報から視覚情報へ変換する。

対象カードは以下の selector で取得する。

```js
document.querySelectorAll('div.module.post.post-md-square')
```

各カード内では、以下の要素を利用する。

* タイトル: `.post-title`
* サムネイルコンテナ: `.post-thumbnail`
* 投稿リンク: `a.link-block[href^="/posts/"]`

処理手順は以下とする。

* 各カードの `.post-title` の `textContent` を取得する。
* タイトルが `[動画連動] ` で始まる場合、コンテンツ種別を `video` と判定する。
* タイトルが `[音声連動] ` で始まる場合、コンテンツ種別を `audio` と判定する。
* 判定できた場合、タイトルから該当 prefix を削除する。
* サムネイルコンテナの右下に種別バッジを追加する。

バッジ表示は以下の方針とする。

* `video`: 動画アイコンを表示する。
* `audio`: 音楽アイコンを表示する。
* バッジは `.post-thumbnail` 直下に追加し、`.post-thumbnail` の右下に `position: absolute` で配置する。
* `.force-square` 配下にバッジを追加すると Fantia 側の CSS の影響でバッジがサムネイル全体に拡大されるため、`.post-thumbnail` 直下に追加する。
* 既にバッジが追加済みのカードには重複追加しない。

想定 CSS:

```css
.fantia-post-enhancer-thumbnail-container {
  position: relative !important;
  overflow: visible !important;
}

.fantia-post-enhancer-type-badge {
  position: absolute !important;
  right: 8px !important;
  bottom: 8px !important;
  z-index: 10 !important;

  width: 36px !important;
  height: 36px !important;
  border-radius: 999px !important;

  display: flex !important;
  align-items: center !important;
  justify-content: center !important;

  box-sizing: border-box !important;
  padding: 0 !important;
  margin: 0 !important;
  line-height: 1 !important;
  pointer-events: none !important;
}

.fantia-post-enhancer-type-badge[data-fantia-post-enhancer-type="audio"] {
  background: #1e3a8a !important; /* Tailwind blue-900 */
  color: #93c5fd !important; /* Tailwind blue-300 */
}

.fantia-post-enhancer-type-badge[data-fantia-post-enhancer-type="video"] {
  background: #581c87 !important; /* Tailwind purple-900 */
  color: #d8b4fe !important; /* Tailwind purple-300 */
}

.fantia-post-enhancer-type-badge svg {
  display: block !important;
  width: 20px !important;
  height: 20px !important;
  margin: auto !important;
  fill: currentColor !important;
}
```

アイコンは初期実装では外部アセットを使わず、絵文字または SVG inline によって表現する。

* `video`: 動画 SVG
* `audio`: 音符 SVG

### 画像の変更

概要: 未設定サムネイルを、Fantia Posts API の `post.blog_comment` に含まれる画像に置き換える。

未設定サムネイルの判定は以下とする。

```js
const thumbnailImage = card.querySelector('.post-inner .post-thumbnail div img');
const isNoImage = thumbnailImage?.getAttribute('src') === '/images/no-image-thumb.jpg';
```

投稿詳細ページの URI は、カード内の以下のリンクから取得する。

```js
const link = card.querySelector('a.link-block[href^="/posts/"]');
const postUri = link?.getAttribute('href');
```

サムネイル置き換えの処理手順は以下とする。

* カードのサムネイル画像が `/images/no-image-thumb.jpg` であるか確認する。
* 未設定サムネイルではない場合は何もしない。
* 未設定サムネイルである場合、カード内の `a.link-block[href^="/posts/"]` から投稿 URI を取得する。
* 投稿 URI `/posts/{postId}` から `postId` を抽出する。
* `localStorage` から投稿 URI に対応する thumbnail URL を探す。
* キャッシュが存在する場合、その URL をサムネイル画像の `src` に設定する。
* キャッシュが存在しない場合、`https://fantia.jp/api/v1/posts/{postId}` を fetch する。
* API request には `x-requested-with: XMLHttpRequest` と `x-csrf-token` を付与する。
* `x-csrf-token` は一覧ページ内の `<meta name="csrf-token">` から取得する。
* API response の `{ post: { blog_comment: "..." } }` を取得する。
* `post.blog_comment` は Quill Delta JSON 文字列として扱い、`JSON.parse()` して `ops[].insert.image` の最初の URL を thumbnail URL として取得する。
* JSON parse に失敗した場合は、fallback として文字列中の `"image"` に続く URL を正規表現で抽出する。
* 画像 URL を localStorage に保存する。
* 取得した画像 URL を一覧カードのサムネイル画像の `src` に設定する。

localStorage の保存形式は以下とする。

```json
{
  "/posts/1": "https://image.example.com/1"
}
```

保存 key は以下とする。

```txt
fantia-post-enhancer.thumbnail-cache.v1
```

キャッシュ操作は以下の責務に分離する。

* `loadThumbnailCache()`: localStorage から JSON を読み込む。
* `saveThumbnailCache(cache)`: localStorage に JSON を保存する。
* `getCachedThumbnailUrl(postUri)`: 投稿 URI に対応する URL を取得する。
* `setCachedThumbnailUrl(postUri, thumbnailUrl)`: 投稿 URI に対応する URL を保存する。

fetch の注意点は以下とする。

* Posts API の取得は一覧カード数に比例して発生するため、同じ URI に対する重複 fetch を避ける。
* 同じ URI に対する重複 fetch は行わない。
* API request が 403 / 422 になることを避けるため、`x-requested-with: XMLHttpRequest` と `x-csrf-token` を付与する。
* fetch 失敗時は一覧表示を壊さず、元の未設定サムネイルのままにする。
* 画像が見つからない場合は、キャッシュに空値を保存するか、何も保存しないかを実装時に選択する。

初期実装では、画像が見つからない場合はキャッシュしない方針とする。これは、投稿本文が後から更新され画像が追加された場合に、再取得によって復旧できるようにするためである。

### DOM 更新への対応

Fantia の一覧ページでは、ページ遷移、追加読み込み、またはクライアントサイド更新によって DOM が後から変化する可能性がある。

そのため、初期表示時の一括処理に加えて、`MutationObserver` によって追加された投稿カードも処理対象とする。

実装方針は以下とする。

* 初期ロード時に `enhanceAllCards()` を実行する。
* `MutationObserver` で `document.body` 配下の追加 node を監視する。
* 追加 node 自身、またはその配下にある `div.module.post.post-md-square` を再処理する。
* 処理済みカードには `data-fantia-post-enhancer-processed="true"` を付与して二重処理を防ぐ。

### Chrome 拡張機能構成

想定ファイル構成は以下とする。

```txt
extension/
  manifest.json
  content-script.js
  content-style.css
```

`manifest.json` は Manifest V3 を使用する。

```json
{
  "manifest_version": 3,
  "name": "Fantia fanclub posts visualizer",
  "version": "0.1.0",
  "description": "https://fantia.jp/fanclubs/*/posts の投稿を見やすくする拡張機能",
  "content_scripts": [
    {
      "matches": [
        "https://fantia.jp/fanclubs/*/posts*"
      ],
      "js": ["content-script.js"],
      "css": ["content-style.css"],
      "run_at": "document_idle"
    }
  ],
  "permissions": [],
  "host_permissions": ["https://fantia.jp/api/v1/posts/*"]
}
```

`content-script.js` は以下の責務を持つ。

* 投稿カードの探索
* タイトル prefix の解析と削除
* 種別バッジの追加
* 未設定サムネイルの判定
* Fantia Posts API の取得
* `post.blog_comment` からの最初の画像 URL 抽出
* localStorage キャッシュの読み書き
* MutationObserver による追加カード処理

`content-style.css` は以下の責務を持つ。

* サムネイルコンテナの position 調整
* 種別バッジの見た目定義
* 置き換え後サムネイルの object-fit 調整

### 除外すること

* Fantia 全体に対する汎用拡張機能化は行わない。
* 投稿詳細ページ自体の表示変更は行わない。
* ユーザー設定 UI、オプションページ、ポップアップ UI は初期実装では作らない。
* サムネイルが既に設定済みの投稿に対して、本文画像で上書きしない。
* 投稿タイトル prefix 以外のタイトル本文の正規化は行わない。
