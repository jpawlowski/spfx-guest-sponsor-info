#!/usr/bin/env python3
"""Render each HTML file to a 1366x768 JPG using Playwright/Chromium."""
import sys
from pathlib import Path
from playwright.sync_api import sync_playwright

HERE = Path(__file__).parent
OUT = HERE / "renders"
OUT.mkdir(exist_ok=True)

# Allow rendering a single file (for previewing) or all
targets = sys.argv[1:] if len(sys.argv) > 1 else sorted(
    [p.name for p in HERE.glob("0?-*.html")]
)

with sync_playwright() as p:
    browser = p.chromium.launch()
    ctx = browser.new_context(
        viewport={"width": 1366, "height": 768},
        device_scale_factor=2,  # 2x for crisp output
    )
    page = ctx.new_page()
    for name in targets:
        html_path = HERE / name
        if not html_path.exists():
            print(f"!! missing: {html_path}")
            continue
        url = html_path.resolve().as_uri()
        page.goto(url, wait_until="networkidle")
        # Wait for fonts
        page.evaluate("document.fonts.ready")
        page.wait_for_timeout(400)
        out_path = OUT / (html_path.stem + ".jpg")
        page.screenshot(
            path=str(out_path),
            type="jpeg",
            quality=92,
            full_page=False,
            clip={"x": 0, "y": 0, "width": 1366, "height": 768},
        )
        print(f"ok  {out_path.name}")
    browser.close()
