# Guest Sponsor Info — Marketing Graphics

Source files for:

- 5-graphic AppSource carousel set (1366×768 JPG) — every graphic includes
  at least one real product screenshot (Microsoft AppSource reviewer requirement)
- Open Graph social card (1200×630 JPG) for the website

## What's in here

```txt
marketplace/
├── 01-hero.html                  ← "Let your guests know who to call."
├── 02-where-guests-land.html     ← "Where your guests land."
├── 03-live-cards.html            ← "Real photos. Real titles. Real reach."
├── 04-honest-teams.html          ← "Honest about what's ready — and what isn't."
├── 05-easy-to-install.html       ← "Easy to install. Hard to outgrow."
├── og-social-card.html           ← Open Graph card for website meta tags (1200×630)
├── base.css                      ← shared design tokens (colors, fonts, motifs)
├── render.py                     ← Playwright/Chromium renderer (auto-detects canvas size)
├── assets/                       ← screenshots, logos used in the graphics
└── renders/                      ← output JPGs (created when you run render.py)
```

## Carousel narrative

1. **Hero** → product overview + value prop
   - Uses screenshot: `my-sponsors-card-example.jpg` (desktop sponsor card popup)
2. **Where guests land** → location/integration — sponsor cards on the SharePoint landing page B2B guests visit first
   - Uses screenshot: `entrance-landingpage-example.jpg` (full M365 landing page)
   - Spotlight box highlights the "My Sponsors" section added by the web part
3. **Live Cards** → detail features (live data from Microsoft Graph)
   - Uses screenshots: `my-sponsors-card-example.jpg` + `my-sponsors-card-example-mobile.jpg`
4. **Honest Teams Status** → unique differentiator (no broken buttons)
   - Uses screenshot: `my-sponsors-noteams-example.jpg` (Teams onboarding warning)
5. **Easy to install. Hard to outgrow.** → deployment story + architectural depth
   - Uses screenshots: `my-sponsors-setup-wizard.jpg` (Demo Mode setup) + `my-sponsor-preferences.jpg` (granular settings)
   - Trust pillars (right column) cover what isn't visible in screenshots: tenant boundary, zero-trust, no telemetry, source-available

The OG card condenses the whole story into one frame: hero headline + sponsor
card visual + the 3 strongest trust badges + URL.

## How the graphics are built

Each graphic is a **standalone HTML file** that uses:

- `base.css` for the shared design system (brand colors, type scale, dotted-ring
  decorations, footer maker mark)
- A `<style>` block inside the HTML for slide-specific layout
- Images from `assets/` for screenshots and logos
- Google Fonts (Manrope + Inter, plus JetBrains Mono on the OG card) loaded at render time

There is no build step — open any `.html` file in your browser to preview it.

### Canvas size

Each HTML file declares its own canvas size via a meta tag near the top:

```html
<meta name="canvas-size" content="1200x630">
```

The render script reads this and renders at the matching viewport. If the tag
is missing, it falls back to **1366×768** (AppSource carousel format).

The 5 carousel files don't need this tag — they use the default. The OG card
sets it to **1200×630**.

## Available screenshots in `assets/`

| File | Use case | Aspect |
|------|----------|--------|
| `entrance-landingpage-example.jpg` | Full M365 landing page with sponsors at bottom | 16:10 landscape |
| `my-sponsors-card-example.jpg` | Desktop sponsor card popup with contact details | landscape |
| `my-sponsors-card-example-mobile.jpg` | Mobile sponsor card with map | portrait |
| `my-sponsors-noteams-example.jpg` | "Teams not set up yet" warning state | landscape |
| `my-sponsor-preferences.jpg` | Web part settings/admin panel | very tall portrait (0.35) |
| `my-sponsors-setup-wizard.jpg` | Setup wizard with Demo Mode option | landscape (1.24) |
| `my-sponsors-editor-preview.jpg` | SharePoint editor view with expanded card | near-square (1.15) |
| `logo.svg` | Full Guest Sponsor Info logo (icon + wordmark) | 5.5:1 |
| `favicon.svg` | Just the brand icon (teal square with sponsors) | 1:1 |
| `workoho-logo.svg` | Workoho wordmark for "Made by" maker mark | wide |

`my-sponsors-editor-preview.jpg` is currently unused but available if you want
a screenshot showing the SharePoint editor experience.

## Editing

### Change copy / headlines / labels

Open the HTML file and edit the text directly. Headlines are inside `<h1>` /
`<h2>` tags, ledes inside `<p class="lede">`, and badges inside
`<span class="pill">` or similar blocks.

### Change a brand color globally

Edit `base.css` — colors live as CSS variables at the top:

```css
--teal:        #12B2CD;
--teal-700:    #0E96AD;
--ink-deep:    #0A3D4F;
```

All graphics will pick up the change automatically.

### Replace a screenshot

Drop a new image into `assets/` and update the corresponding
`<img src="assets/...">` reference in the HTML file. If you change a
screenshot's aspect ratio, you may need to adjust the explicit `height:`
on the containing element (e.g. `.pref-shot`, `.wizard-shot`, `.desktop`)
so the new image fits cleanly.

### Adjust a spotlight position

Some graphics (e.g. graphic 2) use absolute-positioned spotlight boxes to
highlight a region inside a screenshot. The position is set as percentage
of the screenshot's container:

```css
.spotlight-box {
  left: 51%;   /* horizontal start, as % of browser frame width */
  top: 71%;    /* vertical start, as % of browser frame height */
  width: 46%;  /* width, as % */
  height: 26%; /* height, as % */
}
```

If you swap the screenshot, you'll need to update these percentages to match
the new image.

### Add a new graphic at a different size

Copy any HTML file as a template and adjust its meta tag:

```html
<meta name="canvas-size" content="1080x1080">
```

You'll also need to override the body/canvas size in the file's internal
`<style>` block, since `base.css` hardcodes 1366×768:

```css
html, body { width: 1080px; height: 1080px; }
.canvas { width: 1080px; height: 1080px; }
```

The OG card (`og-social-card.html`) is a worked example of this override.

## Re-rendering

You'll need Python 3 and Playwright installed:

```bash
pip install playwright pillow
playwright install chromium
```

Then from the `marketplace/` directory:

```bash
# Render all HTML files
python3 render.py

# Render just one
python3 render.py 03-live-cards.html
python3 render.py og-social-card.html
```

Output goes to `renders/`. Files are rendered at 2× device-scale for sharp text
(e.g. 2732×1536 for 1366×768, or 2400×1260 for 1200×630), then need to be
downsampled to the exact target spec for distribution. Quick downsample with
PIL:

```python
from PIL import Image

# AppSource carousel — 1366x768
for f in ['01-hero.jpg', '02-where-guests-land.jpg', '03-live-cards.jpg',
          '04-honest-teams.jpg', '05-easy-to-install.jpg']:
    Image.open(f'renders/{f}').resize((1366, 768), Image.LANCZOS).save(
        f'final/{f}', 'JPEG', quality=92, optimize=True, progressive=True)

# OG social card — 1200x630
Image.open('renders/og-social-card.jpg').resize((1200, 630), Image.LANCZOS).save(
    'final/og-social-card.jpg', 'JPEG', quality=92, optimize=True, progressive=True)
```

## Using the OG card on the website

In the site's `<head>`:

```html
<meta property="og:image" content="https://guest-sponsor-info.workoho.cloud/og-social-card.jpg">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:image:type" content="image/jpeg">
<meta property="og:image:alt" content="Guest Sponsor Info — live sponsor cards on every SharePoint guest landing page">

<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:image" content="https://guest-sponsor-info.workoho.cloud/og-social-card.jpg">
```

The 1200×630 format covers Facebook, LinkedIn, X (as `summary_large_image`),
WhatsApp, Slack/Teams unfurls, and most other platforms in one go.

## Design system reference

**Brand colors (set in `base.css`)**

- Teal `#12B2CD` (primary), Teal-700 `#0E96AD`, Teal-50 `#E8F7FB`
- Ink-Deep `#0A3D4F` (headlines), Ink `#0F2A35` (body), Ink-Muted `#4A6B76`
- Warn `#D97706` (graphic 4 "not ready" state)
- Success `#16A34A` (graphic 4 "ready" state and presence dots)

**Typography**

- Display: **Manrope** 500/700/800 — headlines, eyebrows, badges, card titles
- Body: **Inter** 400/500/600/700 — paragraphs, labels, lede
- Mono: **JetBrains Mono** — URLs in browser frames, meta lines, OG card URL

**Recurring motifs**

- `.bg-grid` — subtle radial dot grid background
- `.dotted-ring` — large dashed teal circles (echoes the logo's "discovered
  sponsor" person)
- `.maker` — "Made by Workoho" mark
- `.slide-mark` — slide number + name (carousel only, OG card has no slide mark)
- `.eyebrow` — uppercase teal label with leading dash, above carousel headlines
