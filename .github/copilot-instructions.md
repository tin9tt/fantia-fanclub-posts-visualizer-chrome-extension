# GitHub Copilot Instructions

This repository is a dependency-free Manifest V3 Chrome Extension for improving Fantia fanclub post cards.

## Scope

Target pages:

- `https://fantia.jp/fanclubs/545851`
- `https://fantia.jp/fanclubs/545851/posts*`

Main files:

- `manifest.json`
- `content-script.js`
- `content-style.css`

Do not add build tools, frameworks, TypeScript, or external runtime dependencies unless explicitly requested.

## Behavior

Enhance cards matching:

```js
div.module.post.post-md-square
```

Use these selectors:

```js
const TITLE_SELECTOR = ".post-title";
const THUMBNAIL_CONTAINER_SELECTOR = ".post-thumbnail";
const THUMBNAIL_IMAGE_SELECTOR = ".post-inner .post-thumbnail div img";
const LINK_SELECTOR = 'a.link-block[href^="/posts/"]';
```

The extension should:

- Remove `[動画連動] ` / `[音声連動] ` from titles.
- Add a video/audio badge to `.post-thumbnail`.
- Never append badges inside `.force-square`.
- Replace thumbnails only when the image is `/images/no-image-thumb.jpg`.
- Leave existing Fantia DOM and click behavior intact.

## Thumbnail fetching

Do not fetch post HTML.

Fetch thumbnails from:

```txt
https://fantia.jp/api/v1/posts/{postId}
```

Required headers:

```js
{
  accept: "application/json",
  "x-requested-with": "XMLHttpRequest",
  "x-csrf-token": csrfToken ?? "",
}
```

Read CSRF token from:

```js
document.querySelector('meta[name="csrf-token"]')?.getAttribute("content")
```

Extract the first image URL from `data?.post?.blog_comment` by parsing it as Quill Delta JSON and reading `ops[].insert.image`.

Cache only post URI to thumbnail URL mappings in `localStorage`.

Cache key:

```txt
fantia-post-enhancer.thumbnail-cache.v1
```

## Style

- Use plain JavaScript.
- Keep selectors centralized.
- Prefix custom classes with `fantia-post-enhancer-`.
- Use `console.debug` for diagnostics.
- Fail softly: if lookup, fetch, parsing, or replacement fails, leave the original card unchanged.
