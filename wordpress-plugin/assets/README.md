# WordPress.org plugin assets

These files are for the **WordPress.org Plugin Directory listing** — they are NOT
part of the installable plugin zip. When you publish to WordPress.org, commit
them to the **`assets/`** folder at the **root of your plugin's SVN checkout**
(the same level as `trunk/` and `tags/`), not inside `trunk/`.

## Icon (ready to use)
- `icon-128x128.png` — directory + search results icon
- `icon-256x256.png` — hi-DPI icon

These are generated from the Chatrico bot logo by `assets-src/render_icons.py`
(pure Python, no dependencies). Re-run it any time to regenerate:

```
python3 wordpress-plugin/assets-src/render_icons.py
```

## Banner (export to PNG before uploading)
WordPress.org banners must be **PNG or JPG**. Source SVGs are provided here:
- `banner-772x250.svg`  → export as `banner-772x250.png`
- `banner-1544x500.svg` → export as `banner-1544x500.png` (hi-DPI)

Export with any tool (Figma, Inkscape, or an online SVG→PNG converter), then
commit the PNGs to the SVN `assets/` folder.

## Listing text (SEO)
- **Display name:** Chatrico – AI Chat Bot & Live Chat
- **Tags:** ai chatbot, live chat, chatbot, ai chat, customer support
- The short description and full description live in `trunk/readme.txt`.
