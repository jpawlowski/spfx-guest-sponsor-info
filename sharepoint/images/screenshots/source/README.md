# Guest Sponsor Info — AppSource Marketplace Graphics

Source files for the 5-graphic carousel set (1366×768 JPG) used on the
Microsoft AppSource listing.

## What's in here

```text
marketplace/
├── 01-hero.html              ← "Let your guests know who to call."
├── 02-the-gap.html           ← "Your sponsor exists in Microsoft Entra..."
├── 03-live-cards.html        ← "Real photos. Real titles. Real reach."
├── 04-honest-teams.html      ← "Honest about what's ready — and what isn't."
├── 05-trust-stack.html       ← "Built to stay in your tenant."
├── base.css                  ← shared design tokens (colors, fonts, motifs)
├── render.py                 ← Playwright/Chromium renderer
├── assets/                   ← screenshots, logos used in the graphics
└── renders/                  ← output JPGs (1366×768 @2x then downsampled)
```

## How the graphics are built

Each graphic is a **standalone HTML file** that uses:

- `base.css` for the shared design system (brand colors, type scale, dotted-ring
  decorations, footer maker mark, slide indicator)
- A `<style>` block inside the HTML for slide-specific layout
- Images from `assets/` for screenshots and logos
- Google Fonts (Manrope + Inter) loaded over the network at render time

The HTML files render at exactly **1366×768 px** in a headless Chromium browser.
There is no build step — open any `.html` file in your browser to preview it.

## Editing

### Change copy / headline / labels

Open the corresponding `0X-*.html` file and edit the text directly. The
headlines are inside `<h2>` tags, ledes inside `<p class="lede">`, and badges
inside `<span class="pill">` or `<span class="state">` blocks.

### Change a brand color globally

Edit `base.css` — colors live as CSS variables at the top:

```css
--teal:        #12B2CD;
--teal-700:    #0E96AD;
--ink-deep:    #0A3D4F;
```

All 5 graphics will pick up the change automatically.

### Replace a screenshot

Drop a new image into `assets/` and update the corresponding
`<img src="assets/...">` reference in the HTML file. The screenshots
currently used:

- `my-sponsors-card-example.jpg` — desktop sponsor card popup (graphics 1, 3)
- `my-sponsors-card-example-mobile.jpg` — mobile sponsor card (graphic 3)
- `my-sponsors-noteams-example.jpg` — "Teams not set up yet" warning (graphic 4)
- `workoho-logo.svg` — maker mark in footer of every graphic
- `logo.svg` / `favicon.svg` — Guest Sponsor Info brand mark

### Add a new graphic

Copy any of the existing `0X-*.html` files as a template, change the slide
number in the bottom-right `<div class="slide-mark">`, and write your content.

## Re-rendering

You'll need Python 3 and Playwright installed:

```bash
pip install playwright
playwright install chromium
```

Then from the `marketplace/` directory:

```bash
# Render all 5 graphics
python3 render.py

# Render just one
python3 render.py 03-live-cards.html
```

Output goes to `renders/`. Files are rendered at 2x device-scale (2732×1536)
for sharp text, then need to be downsampled to 1366×768 for the AppSource
spec. Quick downsample with PIL:

```python
from PIL import Image
for f in ['01-hero.jpg', '02-the-gap.jpg', '03-live-cards.jpg',
          '04-honest-teams.jpg', '05-trust-stack.jpg']:
    Image.open(f'renders/{f}').resize((1366, 768), Image.LANCZOS).save(
        f'final/{f}', 'JPEG', quality=92, optimize=True, progressive=True)
```

## Design system reference

**Brand colors (set in `base.css`)**

- Teal `#12B2CD` (primary), Teal-700 `#0E96AD`, Teal-50 `#E8F7FB`
- Ink-Deep `#0A3D4F` (headlines), Ink `#0F2A35` (body), Ink-Muted `#4A6B76`
- Warn `#D97706` (used on graphic 4 for "not ready" state)
- Success `#16A34A` (used on graphic 4 "ready" state and presence dots)

**Typography**

- Display: **Manrope** 500/700/800 — headlines, eyebrows, badges, card titles
- Body: **Inter** 400/500/600/700 — paragraphs, labels, lede
- Mono: **JetBrains Mono** — URLs in browser frames, meta lines on graphic 5

**Recurring motifs**

- `.bg-grid` — subtle radial dot grid background
- `.dotted-ring` — large dashed teal circles (echoes the logo's "discovered
  sponsor" person)
- `.maker` — "Made by Workoho" mark, bottom-left of every slide
- `.slide-mark` — slide number + name, bottom-right of every slide
- `.eyebrow` — uppercase teal label with leading dash, above every headline

## Carousel narrative

1. **Hero** → product overview + value prop
2. **The Gap** → problem framing (what guests can't see today)
3. **Live Cards** → core capability (live data from Microsoft Graph)
4. **Honest Teams Status** → unique differentiator (no broken buttons)
5. **Trust Stack** → architectural credibility (privacy, source-available)

This sequence is tuned for AppSource's left-to-right carousel — graphic 1
serves as the dominant header thumbnail.
