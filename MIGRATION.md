# Fluent UI v8 → v9 Migration Plan

> **Single Source of Truth** for the migration from Fluent UI v8 to v9.
> All AI agents and contributors must follow this plan.

## Technical Decisions (binding)

| Decision | Value |
|----------|-------|
| **React** | Upgrade from 17.0.1 → **18.x** (SPFx 1.22 compatible) |
| **UI Library** | `@fluentui/react-components` (v9) — replaces `@fluentui/react` (v8) |
| **Icons** | `@fluentui/react-icons` — tree-shaken SVG, replaces `initializeIcons()` + MDL2 |
| **Theme Bridge** | `createV9Theme()` from `@fluentui/react-migration-v8-v9` |
| **Styling** | Griffel `makeStyles` + `shorthands` + design tokens — replaces SCSS CSS Modules |
| **Mobile Overlay** | `OverlayDrawer` (size="full", position="end") — replaces `Panel` |
| **Container Queries** | In Griffel `makeStyles` via nested `@container` at-rules |
| **Strategy** | Big Bang — one coordinated PR, no v8/v9 coexistence |

## Current State

- **SPFx 1.22.2**, React **17.0.1**, TypeScript **~5.9.3**
- `@fluentui/react` v8.106.4 (explicit dependency)
- `@fluentui/react-components` v9.73.4 (transitive only, unused)
- `@fluentui/react-icons` v2.0.321 (transitive only, unused)
- No FluentProvider/ThemeProvider — theming via inherited SharePoint CSS variables
- Styling: CSS Modules (`GuestSponsorInfo.module.scss`) with 30+ class names
- `initializeIcons()` called in `onInit()` — required for MDL2 icon font
- React 17 render API: `ReactDom.render()` / `unmountComponentAtNode()`

### Files with Fluent UI v8 imports (3 source + 2 test files)

| File | v8 Imports |
|------|------------|
| `SponsorCard.tsx` | Persona, Callout, ActionButton, IconButton, Icon, Link, TooltipHost, Panel, PanelType, DirectionalHint, PersonaPresence, PersonaSize, IButtonStyles |
| `GuestSponsorInfo.tsx` | MessageBar, MessageBarType |
| `GuestSponsorInfoWebPart.ts` | initializeIcons, MessageBar, MessageBarType |
| `SponsorCard.test.tsx` | Full jest.mock of all v8 components |
| `GuestSponsorInfo.test.tsx` | MessageBar mock (if present) |

---

## Phase 1: Dependencies & Infrastructure

### Step 1.1 — Update package.json

- Remove `@fluentui/react` from dependencies
- Add `@fluentui/react-components` (explicit, ^9.x)
- Add `@fluentui/react-icons` (explicit, ^2.x)
- Add `@fluentui/react-migration-v8-v9` (explicit)
- Upgrade `react` and `react-dom` to `18.x` (version per SPFx 1.22 compat matrix)
- Upgrade `@types/react` and `@types/react-dom` to `18.x`
- Update any `resolutions` field that pins React 17 types
- Run `npm install` and verify no peer dependency conflicts

**Files:** `package.json`

### Step 1.2 — Update WebPart render pipeline (React 18 API)

- Replace `ReactDom.render()` with `createRoot().render()`
- Replace `ReactDom.unmountComponentAtNode()` with `root.unmount()` in `onDispose()`
- Wrap root element in `<FluentProvider theme={v9Theme}>`
- Remove `initializeIcons()` call from `onInit()`
- Remove `import { initializeIcons, MessageBar, MessageBarType } from '@fluentui/react'`
- PropertyPane MessageBar: migrate to v9 `MessageBar` + `MessageBarBody`

**Files:** `src/webparts/guestSponsorInfo/GuestSponsorInfoWebPart.ts`

### Step 1.3 — SPFx Theme → FluentProvider bridge

- Use `createV9Theme(v8Theme)` to convert SPFx `IReadonlyTheme` to a Fluent v9 `Theme`
- Pass resulting theme to `<FluentProvider theme={v9Theme}>`
- Handle theme changes via `ThemeChangedEvent` on `this.context.serviceScope`
- Fallback: if `createV9Theme` produces visual issues, switch to manual `BrandVariants` mapping

**Files:** `src/webparts/guestSponsorInfo/GuestSponsorInfoWebPart.ts`, `package.json`

---

## Phase 2: Component Migration

### Step 2.1 — Migrate SponsorCard.tsx (largest file)

Component mapping:

| v8 Component | v9 Replacement | Notes |
|---|---|---|
| `Persona` | `Avatar` | `size` prop numeric values |
| `PersonaPresence` | `PresenceBadge` | `status`: "available" / "busy" / "away" / "offline" / "do-not-disturb" |
| `PersonaSize` | `Avatar` `size` prop | 20, 24, 28, 32, 36, 40, 48, 56, 64, 72, 96, 120, 128 |
| `Callout` | `Popover` + `PopoverSurface` + `PopoverTrigger` | `open` / `onOpenChange`, `positioning` prop |
| `Panel` | `OverlayDrawer` (size="full", position="end") | Mobile full-width overlay |
| `ActionButton` | `Button` | `appearance="transparent"`, `icon` prop, `as="a"` for links |
| `IconButton` | `Button` | `appearance="subtle"`, icon only |
| `Icon` | Named icon exports from `@fluentui/react-icons` | See icon mapping below |
| `Link` | `Link` | From `@fluentui/react-components` |
| `TooltipHost` | `Tooltip` | `<Tooltip content="..." relationship="label">` |
| `DirectionalHint` | `positioning` prop | e.g. `positioning="below-end"` |
| `IButtonStyles` | `makeStyles` | Inline style overrides → Griffel classes |

Icon name mapping (MDL2 → @fluentui/react-icons):

| MDL2 Name | v9 Icon Import |
|---|---|
| `Chat` | `ChatRegular` / `ChatFilled` |
| `Mail` | `MailRegular` |
| `Phone` | `CallRegular` |
| `CellPhone` | `PhoneMobileRegular` |
| `CityNext` | `BuildingRegular` |
| `MapPin` | `LocationRegular` |
| `Copy` | `CopyRegular` |
| `Accept` | `CheckmarkRegular` |
| `Org` | `OrganizationRegular` |

**Files:** `src/webparts/guestSponsorInfo/components/SponsorCard.tsx`

### Step 2.2 — Migrate GuestSponsorInfo.tsx

| v8 Component | v9 Replacement |
|---|---|
| `MessageBar` | `MessageBar` + `MessageBarBody` + `MessageBarTitle` (composable) |
| `MessageBarType.warning` | `intent="warning"` |
| `MessageBarType.error` | `intent="error"` |
| `MessageBarType.info` | `intent="info"` |

v9 MessageBar is compositional — title goes in `<MessageBarTitle>`,
body text in `<MessageBarBody>`.

**Files:** `src/webparts/guestSponsorInfo/components/GuestSponsorInfo.tsx`

### Step 2.3 — Verify SponsorList.tsx

Confirm it has no Fluent UI imports (expected: none).

**Files:** `src/webparts/guestSponsorInfo/components/SponsorList.tsx`

---

## Phase 3: Styling Migration

### Step 3.1 — Convert SCSS to makeStyles

Create `makeStyles` hooks for all styles in `GuestSponsorInfo.module.scss`.
Map CSS custom properties to Fluent v9 design tokens:

| CSS Variable | Fluent v9 Token |
|---|---|
| `var(--themePrimary)` | `tokens.colorBrandForeground1` |
| `var(--bodyText)` | `tokens.colorNeutralForeground1` |
| `var(--neutralLight)` | `tokens.colorNeutralBackground3` |
| `var(--neutralQuaternaryAlt)` | `tokens.colorNeutralStroke2` |
| `var(--neutralSecondary)` | `tokens.colorNeutralForeground2` |
| `var(--neutralTertiary)` | `tokens.colorNeutralForeground3` |
| `var(--neutralLighter)` | `tokens.colorNeutralBackground2` |
| `var(--white)` | `tokens.colorNeutralBackground1` |
| `var(--link)` | `tokens.colorBrandForegroundLink` |
| `var(--successText)` | `tokens.colorPaletteGreenForeground1` |

Tooling:

- `shorthands` helper for padding, margin, border
- `mergeClasses()` for conditional class composition
- `animationName` in makeStyles for `@keyframes` skeleton animation
- `@container` queries as nested at-rules in Griffel

Split into:

- `SponsorCard.styles.ts` — card, rich card, presence, actions,
  contact rows, copy button, manager row, map preview
- `GuestSponsorInfo.styles.ts` — webpart shell, loading skeletons,
  grid layouts, notifications

**Files:**

- Delete `src/webparts/guestSponsorInfo/components/GuestSponsorInfo.module.scss`
- Create `src/webparts/guestSponsorInfo/components/SponsorCard.styles.ts`
- Create `src/webparts/guestSponsorInfo/components/GuestSponsorInfo.styles.ts`
- Update `src/declarations.d.ts` (remove SCSS module declaration if no longer needed)

---

## Phase 4: Test Updates

### Step 4.1 — Update SponsorCard.test.tsx

- Replace `jest.mock('@fluentui/react', ...)` with mocks for:
  - `@fluentui/react-components` (Avatar, PresenceBadge, Popover, PopoverSurface, Button,
    Link, Tooltip, MessageBar, OverlayDrawer, etc.)
  - `@fluentui/react-icons` (named icon components as simple render stubs)
- Update assertions for v9-specific attributes
- Verify presence status assertions match v9 string values

### Step 4.2 — Update GuestSponsorInfo.test.tsx

- Update MessageBar mock to v9 compositional pattern

**Files:**

- `src/webparts/guestSponsorInfo/components/__tests__/SponsorCard.test.tsx`
- `src/webparts/guestSponsorInfo/components/__tests__/GuestSponsorInfo.test.tsx`

---

## Phase 5: AI Agent Instructions Update

### Step 5.1 — Create `.github/instructions/fluent-ui.instructions.md`

With `applyTo: "src/**"` containing:

- **PROHIBITION**: Never import from `@fluentui/react` — only `@fluentui/react-components`
  and `@fluentui/react-icons`
- **PROHIBITION**: Never use `initializeIcons()`, `mergeStyles`, `mergeStyleSets`,
  or any v8 styling API
- **REQUIREMENT**: Use `makeStyles` + `shorthands` + design tokens for all styling
- **REQUIREMENT**: Use `FluentProvider` as root wrapper
- **REQUIREMENT**: Use compositional v9 patterns
- **REFERENCE**: Component mapping table, Icon mapping, Token mapping

### Step 5.2 — Update `.github/copilot-instructions.md`

- "Stack constraints": `@fluentui/react` → `@fluentui/react-components`
- "Code style": CSS Modules → makeStyles
- Update React version reference, key files

### Step 5.3 — Update `AGENTS.md`

- "Stack Constraints": Fluent UI v9 + React 18
- "Key Files for Reference": add style files

**Files:**

- Create `.github/instructions/fluent-ui.instructions.md`
- Modify `.github/copilot-instructions.md`
- Modify `AGENTS.md`

---

## Phase 6: Cleanup & Documentation

### Step 6.1 — Remove obsolete files and references

- Delete `GuestSponsorInfo.module.scss`
- Remove SCSS-related lint config if no other SCSS files remain
  (`npm run lint:scss` script, stylelint config)
- Remove `@microsoft/sp-office-ui-fabric-core` dependency if only used for v8 theme CSS
- Clean up `config/sass.json` if unnecessary
- Remove SCSS module type declarations from `declarations.d.ts`

### Step 6.2 — Update docs/architecture.md

- Document the Fluent UI v9 migration
- Document the FluentProvider + SPFx theme bridge pattern

---

## Verification

1. `npm install` — no peer dependency conflicts
2. `npm run lint` — no lint errors (TS, MD; SCSS lint removed or updated)
3. `npm test` — all existing tests pass with updated mocks
4. `npm run build` — full production build succeeds, `.sppkg` generated
5. Manual workbench testing:
   - Sponsor cards render with correct avatars and presence
   - Rich card popup (Popover) opens/closes correctly on hover
   - Mobile panel (OverlayDrawer) works on narrow viewports
   - MessageBar notifications display for all scenarios
   - Theme changes reflect correctly (light/dark/custom)
   - Copy-to-clipboard buttons work with icon state switching
   - PropertyPane proxy status indicator renders correctly
6. `rg "@fluentui/react[^-]" src/` — returns 0 matches (no v8 remnants)
7. Agent smoke test: ask Copilot to add a component → must generate v9 code
