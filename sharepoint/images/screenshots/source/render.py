#!/usr/bin/env python3
"""Render each HTML file to a JPG using Playwright/Chromium.

Canvas size is auto-detected from a <meta name="canvas-size" content="WxH">
tag in each HTML file. Falls back to 1366x768 if not found.
"""
import re
import sys
from pathlib import Path
from playwright.sync_api import sync_playwright

HERE = Path(__file__).parent
OUT = HERE / "renders"
OUT.mkdir(exist_ok=True)

DEFAULT_SIZE = (1366, 768)


def detect_canvas_size(html_path: Path) -> tuple[int, int]:
    """Read <meta name="canvas-size" content="WxH"> from the HTML, or fall back."""
    text = html_path.read_text(encoding="utf-8")
    m = re.search(
        r'<meta\s+name=["\']canvas-size["\']\s+content=["\'](\d+)x(\d+)["\']',
        text,
    )
    if m:
        return int(m.group(1)), int(m.group(2))
    return DEFAULT_SIZE


# Allow rendering a single file (for previewing) or all
targets = sys.argv[1:] if len(sys.argv) > 1 else sorted(
    [p.name for p in HERE.glob("*.html")]
)

with sync_playwright() as p:
    browser = p.chromium.launch()
    for name in targets:
        html_path = HERE / name
        if not html_path.exists():
            print(f"!! missing: {html_path}")
            continue

        width, height = detect_canvas_size(html_path)
        ctx = browser.new_context(
            viewport={"width": width, "height": height},
            device_scale_factor=2,  # 2x for crisp output
        )
        page = ctx.new_page()

        url = html_path.resolve().as_uri()
        page.goto(url, wait_until="networkidle")
        page.evaluate("document.fonts.ready")
        page.wait_for_timeout(400)

        out_path = OUT / (html_path.stem + ".jpg")
        page.screenshot(
            path=str(out_path),
            type="jpeg",
            quality=92,
            full_page=False,
            clip={"x": 0, "y": 0, "width": width, "height": height},
        )
        print(f"ok  {out_path.name}  ({width}x{height} @2x)")
        ctx.close()

    browser.close()
