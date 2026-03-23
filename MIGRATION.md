# Fluent UI v8 → v9 Migration Plan

This document captures the agreed technical decisions and implementation roadmap
for migrating this web part from **`@fluentui/react` v8** to
**`@fluentui/react-components` v9**.

> **Status:** Implementation in progress.
> Track individual work items in the linked GitHub issues / PRs.

---

## 1 Context and Motivation

Fluent UI v8 (`@fluentui/react`) is in maintenance mode. Active development is on
v9 (`@fluentui/react-components`), which ships Griffel-based CSS-in-JS, a cleaner
component API, and first-class support for the modern Teams design language.

The SPFx 1.22 build rig is compatible with v9 because v9's peer dependency range is
`react >= 16.14.0 < 20.0.0`, which covers the pinned React 17.0.1 used by this project.

---

## 2 Stack Decisions

| Topic | Decision |
|---|---|
| **React** | Stay on 17.0.1 (pinned by SPFx 1.22). React 18 can be evaluated separately after SPFx is upgraded. |
| **SPFx** | Stay on 1.22.2. No SPFx upgrade as part of this migration. |
| **Fluent v9 package** | `@fluentui/react-components` (new v9 entry point) |
| **Theme bridge** | `createV9Theme` from `@fluentui/react-migration-v8-v9`. The SPFx `ThemeProvider` service supplies the host site theme as an `IReadonlyTheme`; this is passed to `createV9Theme` to produce a matching v9 `Theme`. |
| **Icon library** | `@fluentui/react-icons` (SVG icons, replaces MDL2 icon font). `initializeIcons()` is removed. |
| **CSS-in-JS** | Griffel (`makeStyles` from `@fluentui/react-components`) for new dynamic style needs. Existing CSS Modules (`.module.scss`) are kept for structural layout. |
| **Mobile overlay** | `OverlayDrawer` (position `"bottom"`) replaces the v8 `Panel` for the mobile rich card. |
| **Desktop popup** | `Popover` / `PopoverSurface` replaces the v8 `Callout`. |
| **Avatar** | `Avatar` (with `color="colorful"` for consistent-per-name auto-coloring) replaces `Persona`. |
| **Presence** | `PresenceBadge` replaces the `presence` prop on `Persona`. |

---

## 3 New Packages

```text
@fluentui/react-components      v9  – main v9 library
@fluentui/react-migration-v8-v9 v9  – createV9Theme bridge utility
@fluentui/react-icons           v2  – SVG icon components
```

The legacy `@fluentui/react` package is **kept** during the transition so that any
remaining v8 usage in property-pane helpers or utilities can be removed incrementally.
Once all v8 references are gone the package will be removed.

---

## 4 SPFx Theme Bridge

```tsx
// In GuestSponsorInfoWebPart.ts — obtain the v8-style IReadonlyTheme
import { ThemeProvider, IReadonlyTheme, ThemeChangedEventArgs } from '@microsoft/sp-component-base';

// In the React component — wrap with FluentProvider
import { FluentProvider } from '@fluentui/react-components';
import { createV9Theme } from '@fluentui/react-migration-v8-v9';

const v9Theme = theme ? createV9Theme(theme) : undefined;
return (
  <FluentProvider theme={v9Theme}>
    {/* web part content */}
  </FluentProvider>
);
```

The theme is re-fetched on every `ThemeChangedEvent` fired by the SPFx `ThemeProvider`
service. The web part calls `render()` after each change so the FluentProvider receives
the updated theme.

---

## 5 Component Mapping

### 5.1 MessageBar

| v8 | v9 |
|---|---|
| `<MessageBar messageBarType={MessageBarType.warning}>` | `<MessageBar intent="warning"><MessageBarBody>…</MessageBarBody></MessageBar>` |
| `MessageBarType.error` | `intent="error"` |
| `MessageBarType.info` | `intent="info"` |
| `MessageBarType.success` | `intent="success"` |

### 5.2 Avatar (replaces Persona)

| v8 | v9 |
|---|---|
| `<Persona size={PersonaSize.size72} initialsColor={…} imageInitials={…}>` | `<Avatar size={72} name={…} color="colorful" image={…}>` |
| `<Persona size={PersonaSize.size40} initialsColor={…}>` | `<Avatar size={40} name={…} color="colorful" image={…}>` |
| `presence={personaPresence} isOutOfOffice={…}` | `badge={{ status: presenceBadgeStatus }}` |

### 5.3 Popover (replaces Callout)

The v8 `Callout` with a `target` ref and `directionalHint` is replaced by a controlled
`Popover` that wraps both the trigger (thumbnail card) and the surface (rich card).
Positioning is delegated to Floating UI (built into v9) which automatically handles
viewport overflow — the manual space-check logic for `calloutHint` can be removed.

### 5.4 OverlayDrawer (replaces Panel)

The v8 `Panel` used for mobile (full-width, bottom) is replaced by:

```tsx
<OverlayDrawer
  open={isMobile && isActive}
  position="bottom"
  onOpenChange={(_, data) => { if (!data.open) onScheduleDeactivate(); }}
>
  <DrawerHeader>
    <DrawerHeaderTitle action={<Button icon={<DismissRegular />} onClick={onScheduleDeactivate} />}>
      {resolvedName}
    </DrawerHeaderTitle>
  </DrawerHeader>
  <DrawerBody>{richBody}</DrawerBody>
</OverlayDrawer>
```

### 5.5 Buttons

| v8 | v9 |
|---|---|
| `<ActionButton href={…} iconProps={{ iconName: 'Chat' }}>` | `<Button as="a" href={…} appearance="subtle" icon={<ChatRegular />} />` |
| `<IconButton iconProps={{ iconName: 'Copy' }} onClick={…}>` | `<Button appearance="subtle" icon={<CopyRegular />} onClick={…} />` |
| `IButtonStyles` inline style overrides | `makeStyles(…)` (Griffel) |

### 5.6 Tooltip

| v8 | v9 |
|---|---|
| `<TooltipHost content="…"><child /></TooltipHost>` | `<Tooltip content="…" relationship="label"><child /></Tooltip>` |

### 5.7 Link

`Link` from `@fluentui/react-components` is a drop-in replacement for `Link`
from `@fluentui/react` for `href`-based links.

### 5.8 Icons

MDL2 icon names are replaced by SVG components from `@fluentui/react-icons`:

| MDL2 name | v9 import |
|---|---|
| `Chat` | `ChatRegular` |
| `Mail` | `MailRegular` |
| `Phone` | `CallRegular` |
| `CellPhone` | `PhoneRegular` |
| `Copy` | `CopyRegular` |
| `Accept` | `CheckmarkRegular` |
| `CityNext` | `BuildingRegular` |
| `MapPin` | `LocationRegular` |
| `Org` | `OrganizationRegular` |
| `Cancel` / `ChromeClose` | `DismissRegular` |

---

## 6 CSS and Theming

- Existing **CSS Modules** (`.module.scss`) are kept as-is for structural layout,
  grid dimensions, and card sizing.
- All **colour tokens** in SCSS continue using the dual `var()` / `"[theme:]"` pattern
  that SPFx injects at runtime. No changes needed here.
- New **dynamic style needs** (e.g. replacing `IButtonStyles` inline overrides) use
  `makeStyles` / `mergeClasses` from `@fluentui/react-components`.
- Container queries (future enhancement) will use Griffel's `@container` support.

---

## 7 Removal of initializeIcons

The call to `initializeIcons()` in `GuestSponsorInfoWebPart.onInit()` is removed.
Fluent UI v9 uses SVG icons (`@fluentui/react-icons`) and does not depend on the
MDL2 icon font loaded by `initializeIcons()`.

---

## 8 Test Updates

Mocks for `@fluentui/react` in `*.test.tsx` files are replaced with equivalent mocks
for the v9 packages (`@fluentui/react-components`, `@fluentui/react-icons`).

---

## 9 Rollout Approach

The migration is done in a **single PR** that replaces all v8 component usage at once.
The v8 package (`@fluentui/react`) is left in `dependencies` during the transition but
will be removed once all references are eliminated and the migration is verified.

---

## 10 Future Work (out of scope for this PR)

- Upgrade React 17 → 18 (requires coordinated SPFx upgrade via `scripts/upgrade-spfx.sh`)
- Evaluate Griffel container queries for the sponsor grid responsive layout
- Remove `@fluentui/react` from `dependencies` once fully unused
- Switch from `color="colorful"` on Avatar to a custom token-based palette that exactly
  matches the original `PERSONA_COLORS` array
