(() => {
  "use strict";

  const $ = (s) => document.querySelector(s);
  const directoryView = $("#directory-view");
  const profileView = $("#profile-view");
  const postView = $("#post-view");
  const directory = $("#directory");
  const sentinel = $("#sentinel");
  const loading = $("#loading");
  const notice = $("#notice");
  const profileDetail = $("#profile-detail");
  const postDetail = $("#post-detail");
  const searchInput = $("#search-input");
  const BATCH_SIZE = 24;
  const cache = new Map();
  let nextId = 1n;
  let loadingBatch = false;
  let loadCheckFrame = 0;
  let renderFrame = 0;
  let currentMode = "directory";
  let directoryScroll = 0;
  let postManifestPromise = null;
  let postManifest = null;
  const postsById = new Map();

  const starts = ["Ael","Vael","Zy","Ely","Kael","Nyr","Oryn","Sael","Thae","Iri","Vey","Rhae","Lio","Cyr","Evo","Myrr","Xan","Noe","Ar","Sola","Tavi","Kyr","Dae","Or"];
  const middles = ["var","thir","lune","dran","mira","vex","syl","nari","quor","zen","drel","vian","kora","thex","rion","mora","lyth","sael","nyx","dorin"];
  const endings = ["ion","ara","eth","iel","ora","en","yx","aris","une","or","is","ael","ius","eon","ira","oth","yn","elle"];
  const bios = [
    "Maps quiet corners of the starbound network and collects forgotten stories.",
    "A thoughtful explorer drawn to strange signals and distant horizons.",
    "Studies the links between memory, language, and digital life.",
    "Keeps a private atlas of places that exist between known coordinates.",
    "Builds small tools to make a vast universe feel a little closer.",
    "Observes the changing patterns of the civilization from the outer rings.",
    "Collects music, old records, and messages from faraway settlements.",
    "A patient researcher fascinated by identity and how worlds connect.",
    "Travels through the archive, looking for details others overlook.",
    "Prefers quiet observatories, precise maps, and open-ended questions."
  ];
  const regions = ["Violet Reach","The Glass Meridian","Nacre Station","Outer Lattice","Aster Vale","The Quiet Ring","Cygnus Archive","Eidolon Basin","Northlight Expanse","The Resonant Fold"];
  const roles = ["Archive Keeper","Signal Cartographer","Pattern Researcher","World Builder","Memory Curator","Network Guide","Orbit Scholar","Frequency Listener","Civic Observer","Independent Explorer"];
  const interests = ["deep-space cartography","language systems","forgotten music","synthetic ecology","digital archaeology","star maps","memory studies","quiet machines","world design","signal theory"];

  function hashText(text) {
    let h = 2166136261;
    for (let i = 0; i < text.length; i++) {
      h ^= text.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  }
  function seeded(seed, salt) {
    let x = (hashText(seed + "|" + salt) + 0x6D2B79F5) >>> 0;
    x = Math.imul(x ^ (x >>> 15), x | 1);
    x ^= x + Math.imul(x ^ (x >>> 7), x | 61);
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  }
  function pick(list, id, salt) {
    return list[Math.floor(seeded(id, salt) * list.length)];
  }
  function titleCase(s) { return s.charAt(0).toUpperCase() + s.slice(1); }
  function canonicalId(raw) {
    const value = String(raw ?? "").trim();
    if (!/^\d+$/.test(value)) return null;
    return value.replace(/^0+(?=\d)/, "");
  }
  function profileFor(rawId) {
    const id = canonicalId(rawId);
    if (id === null || id === "0") return null;
    if (cache.has(id)) return cache.get(id);
    const n = BigInt(id);
    const seed = n.toString();
    const name = titleCase(pick(starts, seed, "a")) +
      pick(middles, seed, "b") + titleCase(pick(endings, seed, "c"));
    const profile = {
      id: seed,
      name,
      initials: (name.match(/[A-Z]/g) || ["Z","V"]).slice(0, 2).join(""),
      bio: pick(bios, seed, "bio"),
      role: pick(roles, seed, "role"),
      region: pick(regions, seed, "region"),
      interest: pick(interests, seed, "interest"),
      designation: "Z-" + (hashText(seed).toString(16).toUpperCase().padStart(8, "0")),
      discovered: "Cycle " + (n % 999983n + 1n).toString()
    };
    cache.set(id, profile);
    if (cache.size > 350) cache.delete(cache.keys().next().value);
    return profile;
  }
  function make(tag, className, text) {
    const el = document.createElement(tag);
    if (className) el.className = className;
    if (text !== undefined) el.textContent = text;
    return el;
  }
  function makeCard(profile) {
    const button = make("button", "profile-card");
    button.type = "button";
    button.setAttribute("aria-label", `Open ${profile.name}, profile ${profile.id}`);
    const top = make("div", "card-top");
    top.append(make("div", "avatar", profile.initials));
    const title = make("div");
    title.append(make("div", "card-name", profile.name), make("div", "card-number", "PROFILE " + profile.id));
    top.append(title);
    button.append(top, make("p", "card-bio", profile.bio));
    const meta = make("div", "card-meta");
    meta.append(make("span", "", profile.role), make("span", "", profile.region));
    button.append(meta);
    button.addEventListener("click", () => navigate({ profile: profile.id }));
    return button;
  }
  function getColumnCount() {
    const width = directory.clientWidth;
    if (width <= 360) return 1;
    if (width <= 650) return 2;
    if (width <= 950) return 3;
    return 4;
  }
  function renderBatch() {
    if (loadingBatch || currentMode !== "directory") return;
    loadingBatch = true;
    loading.hidden = false;
    requestAnimationFrame(() => {
      const frag = document.createDocumentFragment();
      // IDs are generated sequentially from 1 and use BigInt, so there is no 99-profile cap.
      for (let i = 0; i < BATCH_SIZE; i++) {
        const p = profileFor(nextId.toString());
        if (!p) break;
        frag.append(makeCard(p));
        nextId += 1n;
      }
      directory.append(frag);
      loading.hidden = true;
      loadingBatch = false;
      // If the page is still close to the bottom, immediately fill the remaining space.
      // This avoids relying on a one-time IntersectionObserver event that can stall.
      scheduleLoadCheck();
    });
  }
  function nearDirectoryEnd() {
    return window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 1400;
  }
  function checkForMore() {
    loadCheckFrame = 0;
    if (currentMode === "directory" && !loadingBatch && nearDirectoryEnd()) renderBatch();
  }
  function scheduleLoadCheck() {
    if (loadCheckFrame) return;
    loadCheckFrame = requestAnimationFrame(checkForMore);
  }
  function showOnly(mode) {
    currentMode = mode;
    directoryView.hidden = mode !== "directory";
    profileView.hidden = mode !== "profile";
    postView.hidden = mode !== "post";
    document.title = mode === "profile" ? "Profile — Zyvarion" : mode === "post" ? "Post — Zyvarion" : "Zyvarion — One Universe. Infinite Identities.";
  }
  function navigate(params, replace = false) {
    const url = new URL(window.location.href);
    url.search = "";
    for (const [key, value] of Object.entries(params)) if (value !== null && value !== undefined) url.searchParams.set(key, String(value));
    if (replace) history.replaceState({}, "", url);
    else history.pushState({}, "", url);
    routeFromUrl();
  }
  function appendInfo(parent, label, value) {
    const box = make("div", "info-box");
    box.append(make("small", "", label.toUpperCase()), make("span", "", value));
    parent.append(box);
  }
  function renderProfile(id) {
    const profile = profileFor(id);
    if (!profile) {
      profileDetail.replaceChildren(make("div", "error", "Invalid profile identifier. Use a positive whole-number identifier."));
      showOnly("profile");
      return;
    }
    profileDetail.replaceChildren();
    const hero = make("article", "profile-hero");
    const head = make("div", "profile-head");
    head.append(make("div", "avatar avatar-large", profile.initials));
    const title = make("div", "profile-title");
    title.append(make("p", "eyebrow", "IDENTITY RECORD"), make("h1", "", profile.name), make("div", "profile-id", "PROFILE " + profile.id));
    head.append(title);
    hero.append(head, make("p", "profile-bio", profile.bio));
    const grid = make("div", "info-grid");
    appendInfo(grid, "Identity category", profile.role);
    appendInfo(grid, "Region", profile.region);
    appendInfo(grid, "Designation", profile.designation);
    appendInfo(grid, "Discovery cycle", profile.discovered);
    appendInfo(grid, "Primary interest", profile.interest);
    appendInfo(grid, "Stable identifier", profile.id);
    hero.append(grid);
    profileDetail.append(hero);
    const content = make("section", "content-section");
    content.append(make("h2", "", "Associated posts"));
    const list = make("div", "empty-state", "No published posts are mapped to this generated identity. To add posts, define stable IDs in data/posts.txt and set each post's profile field to this identifier.");
    content.append(list);
    profileDetail.append(content);
    showOnly("profile");
  }

  function safeHttpUrl(value) {
    try {
      const url = new URL(value, window.location.href);
      if (url.protocol === "https:" || url.protocol === "http:") return url.href;
    } catch (_) {}
    return null;
  }
  function parsePosts(text) {
    // Each post begins at a standalone line containing only a hyphen.
    const blocks = text.replace(/\r\n?/g, "\n").split(/^\s*-\s*$/m).map(x => x.trim()).filter(Boolean);
    const parsed = [];
    for (const block of blocks) {
      const fields = {};
      let current = null;
      for (const line of block.split("\n")) {
        const match = line.match(/^\s*(id|profile|title|content|media)\s*:\s*(.*)$/i);
        if (match) {
          current = match[1].toLowerCase();
          fields[current] = match[2] || "";
        } else if (current) {
          fields[current] += (fields[current] ? "\n" : "") + line;
        } else if (line.trim()) {
          fields.content = (fields.content ? fields.content + "\n" : "") + line;
        }
      }
      if (!fields.id || !/^[a-zA-Z0-9_-]+$/.test(fields.id)) continue;
      fields.id = fields.id.trim();
      if (postsById.has(fields.id)) continue;
      fields.title = (fields.title || "Untitled discovery").trim();
      fields.content = (fields.content || "").trim();
      fields.profile = canonicalId(fields.profile || "1") || "1";
      fields.media = (fields.media || "").split(",").map(x => x.trim()).filter(Boolean);
      postsById.set(fields.id, fields);
      parsed.push(fields);
    }
    return parsed;
  }
  async function loadPosts() {
    if (postManifestPromise) return postManifestPromise;
    postManifestPromise = fetch("data/posts.txt", { cache: "no-cache" }).then(res => {
      if (!res.ok) throw new Error(`Could not load data/posts.txt (${res.status}).`);
      return res.text();
    }).then(parsePosts);
    try { postManifest = await postManifestPromise; return postManifest; }
    catch (error) { postManifestPromise = null; throw error; }
  }
  function youtubeEmbed(url) {
    try {
      const u = new URL(url);
      if (u.hostname === "youtu.be") return "https://www.youtube-nocookie.com/embed/" + u.pathname.slice(1);
      if (u.hostname.endsWith("youtube.com")) {
        if (u.pathname === "/watch") return "https://www.youtube-nocookie.com/embed/" + u.searchParams.get("v");
        const m = u.pathname.match(/^\/(?:shorts|embed)\/([^/]+)/);
        if (m) return "https://www.youtube-nocookie.com/embed/" + m[1];
      }
    } catch (_) {}
    return null;
  }
  function appendMedia(container, raw) {
    const url = safeHttpUrl(raw);
    if (!url) {
      container.append(make("div", "error", "A media URL was skipped because it is not a valid HTTP(S) address."));
      return;
    }
    const item = make("div", "media-item");
    const lower = url.split("?")[0].toLowerCase();
    const yt = youtubeEmbed(url);
    if (yt) {
      const frame = make("iframe");
      frame.src = yt;
      frame.loading = "lazy";
      frame.title = "Embedded YouTube video";
      frame.referrerPolicy = "strict-origin-when-cross-origin";
      frame.allow = "accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share";
      frame.allowFullscreen = true;
      frame.style.cssText = "width:100%;aspect-ratio:16/9;border:0;border-radius:9px;background:#050609";
      item.append(frame);
    } else if (/\.(png|jpe?g|gif|webp|avif|svg)$/.test(lower)) {
      const img = make("img");
      img.src = url; img.loading = "lazy"; img.alt = "Post media"; img.referrerPolicy = "no-referrer";
      img.onerror = () => { img.replaceWith(make("p", "muted", "Image unavailable.")); };
      item.append(img);
    } else if (/\.(mp4|webm|ogv|mov)$/.test(lower)) {
      const video = make("video"); video.controls = true; video.preload = "none"; video.playsInline = true;
      const source = make("source"); source.src = url; video.append(source);
      video.append(make("p", "muted", "Video unavailable in this browser."));
      item.append(video);
    } else if (/\.(mp3|wav|ogg|m4a|aac|flac)$/.test(lower)) {
      const audio = make("audio"); audio.controls = true; audio.preload = "none"; audio.src = url; audio.setAttribute("aria-label", "Post audio");
      item.append(audio);
    } else {
      const a = make("a", "", "Open or download attached file ↗"); a.href = url; a.target = "_blank"; a.rel = "noopener noreferrer";
      item.append(a);
    }
    container.append(item);
  }
  async function renderPost(postId) {
    showOnly("post");
    postDetail.replaceChildren(make("div", "loading", "Loading post…"));
    try {
      await loadPosts();
      const post = postsById.get(postId);
      if (!post) {
        postDetail.replaceChildren(make("div", "error", `Post “${postId}” was not found in data/posts.txt. Check the stable post ID and try again.`));
        return;
      }
      postDetail.replaceChildren();
      const card = make("article", "post-card");
      card.append(make("p", "eyebrow", "PERMANENT POST LINK"), make("h1", "", post.title));
      const meta = make("p", "muted", `POST ${post.id} · PROFILE ${post.profile}`);
      card.append(meta);
      const content = make("p", "post-content", post.content);
      card.append(content);
      if (post.media.length) {
        const media = make("div", "media-grid");
        post.media.forEach(url => appendMedia(media, url));
        card.append(media);
      }
      const profileLink = make("button", "back-button", "Open author profile →");
      profileLink.type = "button";
      profileLink.addEventListener("click", () => navigate({ profile: post.profile }));
      card.append(profileLink);
      postDetail.append(card);
    } catch (error) {
      const err = make("div", "error");
      err.append(make("p", "", "Post content could not be loaded."), make("p", "", error.message));
      const retry = make("button", "back-button", "Retry");
      retry.type = "button";
      retry.addEventListener("click", () => { postManifestPromise = null; renderPost(postId); });
      err.append(retry);
      postDetail.replaceChildren(err);
    }
  }
  function routeFromUrl() {
    const params = new URLSearchParams(window.location.search);
    const post = params.get("post");
    const profile = params.get("profile");
    if (post) { renderPost(post); return; }
    if (profile) { renderProfile(profile); return; }
    showOnly("directory");
    if (!directory.children.length) renderBatch();
    window.scrollTo(0, directoryScroll || 0);
    scheduleLoadCheck();
  }
  $("#search-form").addEventListener("submit", async event => {
    event.preventDefault();
    const q = searchInput.value.trim();
    if (!q) { notice.textContent = "Enter a profile number or exact display name."; return; }
    const numeric = canonicalId(q);
    if (numeric !== null) {
      if (numeric === "0") { notice.textContent = "Profile numbers start at 1."; return; }
      directoryScroll = window.scrollY;
      navigate({ profile: numeric });
      return;
    }
    const exact = q.toLocaleLowerCase();
    // Exact generated-name lookup is bounded and explicitly described; numeric IDs are directly addressable without scanning.
    notice.textContent = "Checking currently discoverable names…";
    const currentCards = Array.from(directory.querySelectorAll(".profile-card"));
    let found = null;
    for (const card of currentCards) {
      const name = card.querySelector(".card-name")?.textContent || "";
      if (name.toLocaleLowerCase() === exact) {
        found = card.querySelector(".card-number")?.textContent.replace(/^PROFILE\s+/, "");
        break;
      }
    }
    if (found) {
      directoryScroll = window.scrollY;
      navigate({ profile: found });
    } else {
      notice.textContent = "No exact match among currently rendered/discovered profiles. The full infinite name universe cannot be exhaustively searched without a global index. Search by numeric profile ID for direct access.";
    }
  });
  $("#back-button").addEventListener("click", () => {
    if (history.length > 1) history.back(); else navigate({});
  });
  $("#post-back-button").addEventListener("click", () => {
    if (history.length > 1) history.back(); else navigate({});
  });
  window.addEventListener("popstate", routeFromUrl);
  window.addEventListener("scroll", scheduleLoadCheck, { passive: true });
  window.addEventListener("resize", scheduleLoadCheck, { passive: true });

  // Keep the first screen useful even if observers are unavailable.
  routeFromUrl();
})();
