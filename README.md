# Zyvarion

**ONE UNIVERSE. INFINITE IDENTITIES.**

A lightweight static website for deterministic, effectively unbounded generated profiles.

## Files

- `index.html` — app shell and accessible views
- `style.css` — responsive dark violet/cyan theme
- `script.js` — deterministic profile generation, large IDs, navigation, directory loading, post parsing and media rendering
- `data/posts.txt` — editable post manifest with stable post IDs
- `data/README.txt` — content editing guide
- `favicon.svg` — custom Zyvarion mark

## Publish on GitHub Pages

1. Upload the files and `data` folder to your repository.
2. In repository **Settings → Pages**, select the branch and folder containing `index.html`.
3. Open the published Pages URL. Direct profile links use `?profile=123`; post links use `?post=zyvarion-post-0001`.

## Profile IDs and generation

Profile IDs are positive decimal strings and are handled with `BigInt`; they are never converted to `Number` for identity. Profiles are generated on demand and are deterministic for each ID. Numeric search opens an ID directly without generating preceding profiles.

## Name search limitation

The universe is unbounded, so a global exhaustive name search cannot be guaranteed without an index. This implementation searches exact names among currently rendered/discovered cards and states that limitation honestly. Numeric IDs always work directly.

## Posts and media

Edit `data/posts.txt`. Every post needs a unique stable `id`. Keep published IDs unchanged. A post URL remains tied to its ID, not its current file position. Media URLs are comma-separated; direct image, video, audio, YouTube and downloadable links are supported. Files must be publicly reachable over HTTP(S).

## Important static-hosting limitation

GitHub Pages does not provide server-side database storage, user accounts, or shared user submissions. This version's generated identities are deterministic client-side records; the text file is the published source for posts. To let visitors submit content that persists for everyone, add a separate backend or content workflow.

## Virtualization note

The directory loads profile batches on demand and applies a bounded DOM window with spacer elements. This is a lightweight client-side implementation; extensive cross-device QA is still recommended before production use.
