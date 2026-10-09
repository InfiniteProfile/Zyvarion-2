ZYVARION CONTENT EDITING

Posts live in posts.txt. No HTML, CSS, or JavaScript edits are needed to add posts.

Every post block starts with a line containing one hyphen only:
-
id: unique-stable-post-id
profile: 123
title: Post title
content: Write the post text here.
media: https://example.com/photo.jpg, https://example.com/audio.mp3

Rules:
- Use a unique ID made of letters, digits, underscores, and hyphens.
- Never change an ID after sharing its URL.
- `profile` is a positive decimal profile number; it may be very large.
- Separate posts with a standalone hyphen line.
- `media` is optional; separate multiple HTTP(S) media URLs with commas.
- Supported media include image/video/audio direct URLs, YouTube links, and downloadable files.
- Ordinary hyphens within content do not split blocks.
- Text files are public when published on GitHub Pages.
- GitHub Pages is static hosting: it does not store user submissions or provide accounts/database writes.
