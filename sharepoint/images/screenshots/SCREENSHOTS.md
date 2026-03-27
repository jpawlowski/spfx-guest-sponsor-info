# Screenshots — Guest Sponsor Info Web Part

This folder holds the screenshots that are bundled into the `.sppkg` and submitted
to the **SharePoint Store (AppSource)** via Partner Center.

## Format Requirements (SharePoint Store)

| Property | Value |
|---|---|
| Format | PNG |
| Resolution | **1366 × 768 px** |
| Colour space | sRGB |
| Minimum count | **1** (submission is blocked without at least one) |
| Maximum count | **5** |
| File naming | `screenshot-N.png` (N = 1 … 5) |

> These paths must be listed in `config/package-solution.json` under
> `solution.metadata.screenshotPaths`, e.g.:
>
> ```json
> "screenshotPaths": [
>   "images/screenshots/screenshot-1.png",
>   "images/screenshots/screenshot-2.png"
> ]
> ```

## Recommended Screenshots (priority order)

### Screenshot 1 — Sponsor cards, guest user signed in (mandatory)

Show the web part live on a SharePoint landing page with a real (or mocked)
guest user signed in. The frame should show 2–3 sponsor cards with profile
photos, display names, and job titles visible. This is the "hero" screenshot
displayed as thumbnail in the Store.

**Tips:** Use a wide viewport so all cards are in a single row. Add a page
title or nav bar at the top to give visual context that this is SharePoint.

### Screenshot 2 — Hover/focus state with contact details

Click or hover a sponsor card so the popover with contact details is open:
e-mail address, phone number, office location, department. This demonstrates
the depth of information available.

### Screenshot 3 — Property pane / configuration

Open the web part property pane (edit mode). Show the available configuration
options: show-address-map toggle, Azure Maps key field, etc.

### Screenshot 4 — Edit-mode placeholder (for page authors)

Show the lightweight placeholder that non-guest page authors see in edit mode.
Demonstrates that page authors can still place and configure the web part even
if they are not a guest.

### Screenshot 5 — Mobile / narrow layout (optional)

Show the web part in a narrow column or on a mobile viewport. Cards should
stack vertically and remain readable.

---

## Azure Marketplace Screenshots (separate, NOT stored here)

For the **Azure Marketplace ARM template offer**, screenshots are uploaded
directly in Partner Center — they are **not** bundled in the `.sppkg`.

| Property | Value |
|---|---|
| Format | PNG |
| Resolution | **1280 × 720 px** (16 : 9) |
| Minimum count | 1 |
| Maximum count | 5 |

Recommended shots for the Azure Marketplace offer:

1. The deployed resource group in the Azure Portal (Function App + Storage + Plan)
2. The Function App environment-variable configuration screen
3. The Entra ID app registration page (permissions granted)
4. The architecture diagram from `docs/architecture-diagram.md`

These screenshots live outside this repository and are managed in the
Partner Center publishing portal.
