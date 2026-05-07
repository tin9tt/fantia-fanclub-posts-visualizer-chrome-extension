(() => {
  "use strict";

  //
  // Add badge by prefix in title
  // - [動画連動] → video badge
  // - [音声連動] → audio badge
  //

  const CARD_SELECTOR = "div.module.post.post-md-square";
  const TITLE_SELECTOR = ".post-title";
  const THUMBNAIL_CONTAINER_SELECTOR = ".post-thumbnail";
  const LINK_SELECTOR = 'a.link-block[href^="/posts/"]';

  const PROCESSED_ATTR = "data-fantia-post-enhancer-processed";
  const BADGE_CLASS = "fantia-post-enhancer-type-badge";
  const THUMBNAIL_CONTAINER_CLASS = "fantia-post-enhancer-thumbnail-container";

  const TYPE_PREFIXES = [
    {
      prefix: "[動画連動] ",
      type: "video",
      label: "動画連動",
      icon: createVideoIcon,
    },
    {
      prefix: "[音声連動] ",
      type: "audio",
      label: "音声連動",
      icon: createAudioIcon,
    },
  ];

  function enhanceAllCards(root = document) {
    const cards = collectCards(root);
    for (const card of cards) {
      enhanceCard(card);
    }
  }

  function collectCards(root) {
    const cards = [];

    if (root instanceof Element && root.matches(CARD_SELECTOR)) {
      cards.push(root);
    }

    if (root.querySelectorAll) {
      cards.push(...root.querySelectorAll(CARD_SELECTOR));
    }

    return cards;
  }

  function enhanceCard(card) {
    if (!(card instanceof HTMLElement)) {
      return;
    }

    if (card.getAttribute(PROCESSED_ATTR) === "true") {
      return;
    }

    card.setAttribute(PROCESSED_ATTR, "true");

    enhanceTitleAndBadge(card);
    replaceMissingThumbnail(card).catch((error) => {
      console.debug(
        "[Fantia Posts Enhancer] Failed to replace thumbnail.",
        error,
      );
    });
  }

  function enhanceTitleAndBadge(card) {
    const titleElement = card.querySelector(TITLE_SELECTOR);
    if (!titleElement) {
      return null;
    }

    const originalTitle = titleElement.textContent ?? "";
    const matched = TYPE_PREFIXES.find(({ prefix }) =>
      originalTitle.startsWith(prefix),
    );
    if (!matched) {
      return null;
    }

    titleElement.textContent = originalTitle.slice(matched.prefix.length);
    addTypeBadge(card, matched);

    const link = card.querySelector(LINK_SELECTOR);
    if (link instanceof HTMLAnchorElement) {
      const originalLinkTitle = link.getAttribute("title") ?? "";
      if (originalLinkTitle.startsWith(matched.prefix)) {
        link.setAttribute(
          "title",
          originalLinkTitle.slice(matched.prefix.length),
        );
      }
    }

    return matched.type;
  }

  function addTypeBadge(card, contentType) {
    const thumbnailContainer = card.querySelector(THUMBNAIL_CONTAINER_SELECTOR);
    if (!(thumbnailContainer instanceof HTMLElement)) {
      return;
    }

    if (thumbnailContainer.querySelector(`:scope > .${BADGE_CLASS}`)) {
      return;
    }

    thumbnailContainer.classList.add(THUMBNAIL_CONTAINER_CLASS);

    const badge = document.createElement("span");
    badge.className = BADGE_CLASS;
    badge.dataset.fantiaPostEnhancerType = contentType.type;
    badge.setAttribute("aria-label", contentType.label);
    badge.setAttribute("title", contentType.label);
    badge.appendChild(contentType.icon());

    thumbnailContainer.appendChild(badge);
  }

  function observeDomUpdates() {
    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        for (const node of mutation.addedNodes) {
          if (node instanceof Element) {
            enhanceAllCards(node);
          }
        }
      }
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
    });
  }

  function createVideoIcon() {
    const svg = createSvg("svg");
    svg.setAttribute("viewBox", "0 0 20 20");
    svg.setAttribute("fill", "currentColor");
    svg.setAttribute("aria-hidden", "true");
    svg.setAttribute("focusable", "false");

    const path = createSvg("path");
    path.setAttribute(
      "d",
      "M2 6a2 2 0 012-2h6a2 2 0 012 2v8a2 2 0 01-2 2H4a2 2 0 01-2-2V6zM14.553 7.106A1 1 0 0014 8v4a1 1 0 00.553.894l2 1A1 1 0 0018 13V7a1 1 0 00-1.447-.894l-2 1z",
    );
    path.setAttribute("fill", "currentColor");

    svg.appendChild(path);
    return svg;
  }

  function createAudioIcon() {
    const svg = createSvg("svg");
    svg.setAttribute("viewBox", "0 0 20 20");
    svg.setAttribute("fill", "currentColor");
    svg.setAttribute("aria-hidden", "true");
    svg.setAttribute("focusable", "false");

    const path = createSvg("path");
    path.setAttribute(
      "d",
      "M18 3a1 1 0 00-1.196-.98l-10 2A1 1 0 006 5v9.114A4.369 4.369 0 005 14c-1.657 0-3 .895-3 2s1.343 2 3 2 3-.895 3-2V7.82l8-1.6v5.894A4.37 4.37 0 0015 12c-1.657 0-3 .895-3 2s1.343 2 3 2 3-.895 3-2V3z",
    );
    path.setAttribute("fill", "currentColor");

    svg.appendChild(path);
    return svg;
  }

  function createSvg(tagName) {
    return document.createElementNS("http://www.w3.org/2000/svg", tagName);
  }

  //
  // Add thumbnail by fetching from post page when the thumbnail is missing.
  //

  const THUMBNAIL_IMAGE_SELECTOR = ".post-inner .post-thumbnail div img";
  const NO_IMAGE_SRC = "/images/no-image-thumb.jpg";
  const CACHE_KEY = "fantia-post-enhancer.thumbnail-cache.v1";

  const inFlightThumbnailRequests = new Map();

  async function replaceMissingThumbnail(card) {
    const thumbnailImage = card.querySelector(THUMBNAIL_IMAGE_SELECTOR);
    if (!(thumbnailImage instanceof HTMLImageElement)) {
      return;
    }

    if (!isNoImageThumbnail(thumbnailImage)) {
      return;
    }

    const link = card.querySelector(LINK_SELECTOR);
    if (!(link instanceof HTMLAnchorElement)) {
      return;
    }

    const postUri = link.getAttribute("href");
    if (!postUri) {
      return;
    }

    const thumbnailUrl = await getThumbnailUrl(postUri);
    if (!thumbnailUrl) {
      return;
    }

    console.debug(
      "[Fantia Posts Enhancer] Replace thumbnail:",
      postUri,
      thumbnailUrl,
    );

    thumbnailImage.src = thumbnailUrl;
    thumbnailImage.classList.add("fantia-post-enhancer-replaced-thumbnail");
  }

  function isNoImageThumbnail(image) {
    const rawSrc = image.getAttribute("src") ?? "";

    if (rawSrc === NO_IMAGE_SRC) {
      return true;
    }

    try {
      return new URL(rawSrc, location.origin).pathname === NO_IMAGE_SRC;
    } catch {
      return false;
    }
  }

  async function getThumbnailUrl(postUri) {
    const cache = loadThumbnailCache();

    if (cache[postUri]) {
      return cache[postUri];
    }

    if (inFlightThumbnailRequests.has(postUri)) {
      return inFlightThumbnailRequests.get(postUri);
    }

    const request = fetchThumbnailUrl(postUri)
      .then((thumbnailUrl) => {
        if (thumbnailUrl) {
          const latestCache = loadThumbnailCache();
          latestCache[postUri] = thumbnailUrl;
          saveThumbnailCache(latestCache);
        }

        return thumbnailUrl;
      })
      .finally(() => {
        inFlightThumbnailRequests.delete(postUri);
      });

    inFlightThumbnailRequests.set(postUri, request);
    return request;
  }

  async function fetchThumbnailUrl(postUri) {
    const postId = extractPostId(postUri);
    if (!postId) {
      return null;
    }

    const apiUrl = `https://fantia.jp/api/v1/posts/${postId}`;

    const csrfToken = getCsrfToken();

    const response = await fetch(apiUrl, {
      credentials: "include",
      cache: "force-cache",
      headers: {
        accept: "application/json",
        "x-requested-with": "XMLHttpRequest",
        "x-csrf-token": csrfToken ?? "",
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch ${apiUrl}: ${response.status}`);
    }

    const data = await response.json();

    const blogComment = data?.post?.blog_comment;
    if (typeof blogComment !== "string") {
      return null;
    }

    return extractFirstImageUrlFromBlogComment(blogComment);
  }

  function getCsrfToken() {
    return document
      .querySelector('meta[name="csrf-token"]')
      ?.getAttribute("content");
  }

  function extractPostId(postUri) {
    const match = postUri.match(/^\/posts\/(\d+)/);
    return match?.[1] ?? null;
  }

  function extractFirstImageUrlFromBlogComment(blogComment) {
    try {
      const parsed = JSON.parse(blogComment);
      const ops = Array.isArray(parsed?.ops) ? parsed.ops : [];

      for (const op of ops) {
        const imageUrl = op?.insert?.image;
        if (typeof imageUrl === "string" && imageUrl.startsWith("http")) {
          return imageUrl;
        }
      }
    } catch {
      const match = blogComment.match(/"image"\s*:\s*"(https?:\/\/[^"]+)"/);
      return match?.[1] ?? null;
    }

    return null;
  }

  function loadThumbnailCache() {
    try {
      const raw = localStorage.getItem(CACHE_KEY);
      if (!raw) {
        return {};
      }

      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
        return {};
      }

      return parsed;
    } catch {
      return {};
    }
  }

  function saveThumbnailCache(cache) {
    try {
      localStorage.setItem(CACHE_KEY, JSON.stringify(cache));
    } catch (error) {
      console.debug(
        "[Fantia Posts Enhancer] Failed to save thumbnail cache.",
        error,
      );
    }
  }

  enhanceAllCards();
  observeDomUpdates();
})();
