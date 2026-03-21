# Web Part Improvement Plan

Status: In progress
Owner: Team
Last updated: 2026-03-21
Purpose: Single consolidated checklist for all planned improvements to the Guest Sponsor Info
web part. Covers two work streams:

1. **Non-blocking initialization** — already implemented (see Phase 0 below).
2. **Fluent UI v8 consolidation** — replacing custom/hand-rolled UI patterns with standard
   components from `@fluentui/react` v8, which is the library SPFx 1.22.2 ships with.
   No library upgrade, no version switch.

## 1. Goal and Non-Goals

### Goals

- **Non-blocking init:** `onInit()` must not delay the SPFx page lifecycle. Client acquisition
  runs in the background; the page renders immediately with a shimmer, then re-renders once
  clients are ready. ✅ Done.
- **Fluent v8 consolidation:** Replace custom UI primitives with `@fluentui/react` v8 built-in
  components where a good fit exists (`Persona`, `IconButton`, `ActionButton`, `Link`).
- Reduce the amount of custom SCSS needed by letting Fluent components carry their own styling.
- Preserve current behavior exactly (guest logic, presence/activity logic, OOF suffix, adaptive polling).

### Non-Goals

- No upgrade to Fluent UI v9/v2 — SPFx 1.22.2 is not compatible with it without shims.
- No change to business logic or Graph permission model.
- No SPFx version upgrade in this stream.
- No redesign of product behavior unless explicitly approved.

## 2. Constraints and Risks

- `Persona` accepts `initialsColor` as `PersonaInitialsColor | string` — a hex string is valid,
  so the existing `getInitialsColor()` hash result can be passed directly without changes.
- `hidePersonaDetails={true}` suppresses Fluent's name/title text rendering; only the coin is shown.
- `imageShouldFadeIn={true}` is a native `Persona` prop — the photo fade-in is supported natively.
- `isOutOfOffice` is a native `Persona` prop that, combined with `presence`, renders the OOF ring
  in `#B4009E` — the same color currently hardcoded. No custom span needed for OOF.
- `Focusing` has no `PersonaPresence` enum equivalent and no native Fluent analog. It still requires
  a custom colored `<span>` overlaid on the coin (see Phase 3 hybrid approach).
- `PersonaSize.size72` exists in v8 and matches the current 72 px avatar dimension.
  The shimmer skeleton in `GuestSponsorInfo.tsx` uses a 72 px circle — verify alignment
  after switching to `Persona` (internal Persona padding could shift the layout).
- For context: Fluent v8 also ships `HoverCard` + `ExpandingCard` — a built-in hover-card
  pattern that could replace the manual `Callout`+hover-timer logic. This is out of scope
  for the current phases but worth evaluating before Phase 5 (overlay review).

## 3. Current Baseline (What we have today)

Stack: `@fluentui/react` v8.106.x · React 17 · SPFx 1.22.2

Already using Fluent v8 (keep as-is):

- `Callout` + `DirectionalHint` — desktop rich card overlay
- `Panel` + `PanelType` — mobile rich card overlay
- `TooltipHost` — tooltips on copy button and action links
- `Icon` — all glyph icons
- `Shimmer` / `ShimmerElementType` / `ShimmerElementsGroup` — loading skeleton

Custom / hand-rolled (migration candidates):

| Current custom code | Fluent v8 replacement candidate |
|---|---|
| `div.avatar` / `div.initials` + inline `backgroundColor` | `Persona` with `initialsColor` (hex string) + `imageInitials` + `hidePersonaDetails` |
| `span.presenceDot` with inline colour | `Persona`'s built-in `presence` + `isOutOfOffice` props |
| `span.richPresenceDot` with inline colour | `Persona` in rich card header, same props |
| `div.managerAvatar` + `div.initials` | `Persona` (size 40) for manager row |
| `<button>` + `<Icon>` copy button | `IconButton` with `TooltipHost` |
| `<a>` action links (Chat / Email / Call) | `ActionButton` with `href` |
| `<a>` contact value links | Fluent `Link` component |

Core files:

- `src/webparts/guestSponsorInfo/components/SponsorCard.tsx`
- `src/webparts/guestSponsorInfo/components/GuestSponsorInfo.tsx`
- `src/webparts/guestSponsorInfo/components/GuestSponsorInfo.module.scss`

Current behavior quality is good and test suite is stable. Migration should preserve this baseline.

## 4. Phases (Checklist)

## Phase 0: Non-Blocking Initialization ✅ Done

**Problem:** `onInit()` awaited `getClient()` for both Graph and AAD HTTP clients sequentially.
SPFx awaits `onInit()` before rendering any web part on the page, so the entire page was
blocked until both clients resolved (or timed out).

**Fix implemented in `GuestSponsorInfoWebPart.ts`:**

- [x] `onInit()` resolves immediately after `super.onInit()` and icon registration.
- [x] `_acquireClientsInBackground()` acquires Graph + AAD clients concurrently via
  `Promise.all` (both sub-promises catch their own errors and always resolve, so `Promise.all`
  is safe — `Promise.allSettled` is ES2020 and not available in the SPFx ES2015 lib target),
  then calls `render()` once — a single props update.
- [x] The React component already showed a shimmer when clients are `undefined`, so there
  is no visual regression.
- [x] Architecture docs updated (`docs/architecture.md`).
- [x] Lint and tests green.

Exit criteria: ✅ Met.

## Phase 1: Preparation and Safety Net

- [ ] Create feature branch for Fluent v8 consolidation work.
- [ ] Capture visual baseline screenshots for:
  - [ ] Sponsor grid
  - [ ] Sponsor rich card (desktop)
  - [ ] Sponsor rich card (mobile)
  - [ ] Edit mode placeholder
  - [ ] Error/empty states
- [ ] Verify existing tests pass before migration starts.
- [ ] Add missing targeted tests (if needed) for interaction regressions.

Exit criteria:

- Baseline snapshots and a green test run available.

## Phase 2: Low-Risk Component Swaps (Buttons & Links)

These are safe, localized changes with no visual side effects on layout.

- [ ] Replace custom `<button>` + `<Icon>` copy button (`CopyButton` component) with Fluent v8
  `IconButton` wrapped in `TooltipHost` — remove `.copyButton` / `.copyIcon` / `.copyButtonCopied` SCSS.
- [ ] Replace `<a>` action row links (Chat, Email, Call) with Fluent v8 `ActionButton`
  rendered **as an anchor** (`componentRef` is not needed — pass the `href`, `target`, and
  `rel` props directly; Fluent v8 `ActionButton`/`CommandBarButton` accept them and render
  an `<a>` element when `href` is present). Use `iconProps` for the icon.
  Remove or simplify `.richAction` / `.richActionIcon` / `.richActionLabel` SCSS.
- [ ] Replace `<a>` contact value links in info rows with Fluent v8 `Link` (text node only —
  the `::before` full-row overlay is intentionally kept, see Phase 4 for details).
- [ ] Keep existing `TooltipHost` and `Icon` usages unchanged in this phase.

Exit criteria:

- No behavior regressions. Lint and tests green. Small, reversible diff.

## Phase 3: Avatar + Presence Migration (Persona)

- [ ] Add helper `graphPresenceToPersonaPresence(availability, activity)` returning
  `{ presence: PersonaPresence; isOutOfOffice: boolean }`
  with the following mapping (to be inlined next to `PRESENCE_COLORS`):
  - `Available` / `AvailableIdle` → `{ presence: online, isOutOfOffice: false }`
  - `Away` / `BeRightBack` → `{ presence: away, isOutOfOffice: false }`
  - `Busy` / `BusyIdle` / `InACall` / `InAMeeting` / `Presenting` → `{ presence: busy, isOutOfOffice: false }`
  - `DoNotDisturb` → `{ presence: dnd, isOutOfOffice: false }`
  - `Offline` / `OffWork` → `{ presence: offline, isOutOfOffice: false }`
  - `OutOfOffice` → `{ presence: away, isOutOfOffice: true }` — Fluent renders the OOF ring natively in `#B4009E`.
    The `away` base lets Fluent pick the right open-circle OOF style.
  - `Focusing` → `{ presence: none, isOutOfOffice: false }` — still requires custom span (see below)
  - `PresenceUnknown` / unknown → `{ presence: none, isOutOfOffice: false }`
- [ ] Replace card thumbnail avatar (`div.avatar` + `div.initials` + `span.presenceDot`) with
  Fluent v8 `Persona` at `PersonaSize.size72`, passing:
  - `initialsColor={getInitialsColor(sponsor.displayName)}` (hex string — accepted natively)
  - `imageInitials={getInitials(sponsor.displayName)}`
  - `imageUrl={sponsor.photoUrl}` (undefined until loaded — `imageShouldFadeIn={true}` for native fade)
  - `presence` and `isOutOfOffice` from the helper above
  - `hidePersonaDetails={true}` — coin-only, no Fluent text rendered
  Retain the `.avatarWrapper` div as `position: relative` container for the Focusing custom span.
- [ ] Replace rich card header avatar (`div.richAvatar` + `div.initials` + `span.richPresenceDot`)
  with `Persona` at `PersonaSize.size72` using the same props.
  Retain `.richAvatarWrapper` as the `position: relative` container.
- [ ] Replace manager row avatar (`div.managerAvatar` + `div.initials`) with `Persona` at
  `PersonaSize.size40`, passing `initialsColor`, `imageInitials`, `imageUrl`, `hidePersonaDetails={true}`.
  No presence prop for manager.
- [ ] **Hybrid custom span — Focusing only:** For `Focusing`, set `presence={PersonaPresence.none}`
  and render the existing `<span>` dot in `#6264A7` (Teams purple) over the coin via absolute
  positioning. For all other states — including OOF — no custom span needed.
- [ ] **OOF is now native:** Pass `presence={PersonaPresence.away}` + `isOutOfOffice={true}`.
  Fluent renders the standard OOF open-circle ring in `#B4009E` automatically.
  Remove the `isOof` branch and custom span from the existing code.
- [ ] Photo behavior: keep `imageShouldFadeIn={true}` — Fluent `Persona` supports this natively.
  Remove the hand-rolled `@keyframes photo-fade-in` and `.photo` class from SCSS.
- [ ] Keep existing presence label logic (activity priority, OOF suffix) intact in `presenceLabel`.
- [ ] Validate all presence states visually (Available, Away, Busy, DND, Offline, OOF, Focusing).
- [ ] Remove now-unused SCSS: `.avatar`, `.avatarWrapper`, `.initials`, `.presenceDot`,
  `.richAvatar`, `.richAvatarWrapper`, `.richPresenceDot`, `.managerAvatar`, `.photo`,
  `@keyframes photo-fade-in`.

Exit criteria:

- Standard states (incl. OOF) rendered entirely by Fluent `Persona` presence ring.
  Only `Focusing` retains a custom colored span. Custom avatar CSS eliminated.
  Photo fade-in preserved via `imageShouldFadeIn`. All presence states correct.

## Phase 4: Typography and Contact Row Cleanup

- [ ] The `::before` full-row overlay in `.richInfoValue` is **intentionally retained** —
  it makes the entire info row clickable, not just the link text. Keep the CSS rule as-is.
- [ ] Replace `<a href="mailto:…">` and `<a href="tel:…">` text nodes inside `.richInfoValue`
  with Fluent v8 `Link` (styled via `styles` prop to suppress Fluent's default underline on
  non-hover so it matches the current appearance).
- [ ] Review `.richName`, `.richJobTitle`, `.richDept`, `.richPresenceLabel`,
  `.managerName`, `.managerJobTitle` — decide which can be replaced with Fluent v8
  `Text` component (with `variant` prop) vs. kept as CSS.
- [ ] Consolidate `.richSectionTitle` with a Fluent `Text` variant if appropriate.
- [ ] Preserve accessibility behavior (keyboard, focus, ARIA labels, tooltips) throughout.

Exit criteria:

- Rich card contact rows use Fluent `Link`. Custom typography CSS reduced to layout-only rules.

## Phase 5: Overlay Configuration Review

`Callout` and `Panel` are already v8 — no replacement needed in this stream. This phase
reviews their configuration and briefly evaluates `HoverCard`/`ExpandingCard` as an alternative.

- [ ] Evaluate `HoverCard` + `ExpandingCard`: Fluent v8 ships a built-in hover-card pattern
  that manages the hover delay and card reveal natively. Compare against the current manual
  `Callout` + `hideTimeout` mechanism in `SponsorList`. If `ExpandingCard` offers equivalent
  UX and simpler code, consider adopting it in a follow-up. Document decision.
- [ ] Verify `Callout` `preventDismissOnEvent` / `setInitialFocus` settings are optimal for
  SPFx canvas (layering, z-index, focus management).
- [ ] Verify `Panel` `isLightDismiss` / `hasCloseButton` / `onDismiss` wiring is correct —
  confirm it calls `onScheduleDeactivate` and not an abrupt state clear.
- [ ] Validate focus trap and dismiss behavior works in the SPFx workbench.
- [ ] Validate mobile Panel behavior (full-width custom panel, scroll, dismiss).

Exit criteria:

- No overlay behavior changes. Configuration verified and documented.

## Phase 6: Tokenization and CSS Cleanup

- [ ] Review remaining SCSS for hardcoded hex/px values that have Fluent v8 theme token
  equivalents accessible via the `useTheme()` hook in TSX (rather than dual
  `var(--token)` + `"[theme:token]"` CSS strings).
- [ ] Decide per-case: keep the CSS theme string (safe, always works in SP context) or move
  the value into the component via `useTheme()` and inline style — document the choice.
- [ ] Remove dead SCSS rules after each phase's component swaps are complete.
- [ ] Keep only project-specific structural CSS (grid layout, card dimensions, info row layout).

Exit criteria:

- No unexplained hardcoded colors or sizes. Dead CSS removed. Intentional custom styles documented.

## Phase 7: Finalization

- [ ] Update architecture docs (`docs/architecture.md`) with final UI stack note:
  Fluent UI v8 used throughout; custom CSS limited to structural layout only.
- [ ] Run full quality gate (`npm run lint`, `npm test`).
- [ ] Produce migration summary and follow-up backlog.

Exit criteria:

- All Fluent v8 replaceable patterns migrated. Documentation current. Quality gate green.

## 5. Work Packages by File (Initial Backlog)

### A. SponsorCard.tsx

File: `src/webparts/guestSponsorInfo/components/SponsorCard.tsx`

- [ ] Replace `CopyButton` with `IconButton` from `@fluentui/react`
- [ ] Replace action row `<a>` elements with `ActionButton` (with `href`)
- [ ] Replace contact value `<a>` elements with Fluent `Link`
- [ ] Add `graphPresenceToPersonaPresence()` helper returning `{ presence, isOutOfOffice }`
  with the mapping specified in Phase 3
- [ ] Replace card thumbnail avatar + presence dot with `Persona` (size 72):
  `initialsColor` hex, `imageInitials`, `imageShouldFadeIn`, `presence`, `isOutOfOffice`,
  `hidePersonaDetails={true}`, retain `.avatarWrapper` for Focusing span
- [ ] Replace rich card header avatar + presence dot with `Persona` (size 72), same props
- [ ] Replace manager row avatar with `Persona` (size 40), `hidePersonaDetails={true}`, no presence
- [ ] Remove OOF custom span — replaced by `isOutOfOffice` prop
- [ ] Keep Focusing custom span (only remaining custom dot) in Teams purple `#6264A7`
- [ ] Keep `PERSONA_COLORS` + `getInitialsColor()` as-is — passed via `initialsColor` as hex string.
  Do **not** switch to `PersonaInitialsColor` enum (different hues, breaks Teams consistency)

### B. GuestSponsorInfo.tsx

File: `src/webparts/guestSponsorInfo/components/GuestSponsorInfo.tsx`

- [ ] `Shimmer` / `ShimmerElementsGroup` already v8 — verify skeleton dimensions still match
  after `Persona` avatar size changes
- [ ] Ensure edit/view mode rendering unchanged
- [ ] No other changes expected in this file

### C. GuestSponsorInfo.module.scss

File: `src/webparts/guestSponsorInfo/components/GuestSponsorInfo.module.scss`

- [ ] Remove `.avatar`, `.avatarWrapper` contents, `.initials`, `.presenceDot` after Phase 3
  (`.avatarWrapper` div itself stays as Focusing-span container)
- [ ] Remove `.richAvatar`, `.richAvatarWrapper` contents, `.richPresenceDot` after Phase 3
- [ ] Remove `.managerAvatar` after Phase 3
- [ ] Remove `.copyButton`, `.copyIcon`, `.copyButtonCopied` after Phase 2
- [ ] Simplify `.richAction*` rules after Phase 2
- [ ] Remove `@keyframes photo-fade-in` and `.photo` after Phase 3 (`imageShouldFadeIn` is native)
- [ ] **Retain** `::before` overlay on `.richInfoValue` — intentional full-row click target (Decision log)
- [ ] Token/hardcoded-value pass in Phase 6
- [ ] Keep: grid layout, card dimensions, rich card dimensions, section/info structural rules,
  Focusing-dot positioning (`.presenceDot` only for Focusing state)

## 6. Definition of Done (Per PR)

- [ ] Scope limited to one phase/work package.
- [ ] No business logic regressions.
- [ ] Accessibility checks completed for changed interactions.
- [ ] `npm run lint` passes.
- [ ] `npm test` passes.
- [ ] Short changelog entry added to PR description.

## 7. Suggested PR Sequence

1. ~~PR-0: Non-blocking init~~ ✅ Already merged to main.
2. PR-1: Preparation + baseline (branch, screenshots, test run) — Phase 1
3. PR-2: Buttons & Links swap — Phase 2
4. PR-3: Avatar + Presence → Persona — Phase 3
5. PR-4: Typography + contact row cleanup — Phase 4
6. PR-5: Overlay config review — Phase 5
7. PR-6: Tokenization + CSS cleanup + docs — Phases 6 & 7

## 8. Decision Log

- [x] **Photo-fade-in:** Keep it — `Persona` has a native `imageShouldFadeIn` prop.
  No custom CSS animation needed; Fluent handles this internally.
- [x] **OOF presence dot:** Native — pass `presence={PersonaPresence.away}` + `isOutOfOffice={true}`.
  Fluent renders the open-circle OOF ring in `#B4009E` automatically. No custom span.
- [x] **Focusing presence dot:** Still custom — no Fluent enum equivalent.
  Custom `<span>` in Teams purple `#6264A7` overlaid on the coin, positioned via `.avatarWrapper`.
- [x] **OOF / Focusing presence dot:** Hybrid (Focusing only).
- [x] **Contact row click target:** Keep the `::before` full-row overlay. Use Fluent `Link` for
  the visible text node; the CSS overlay stays so the whole row is clickable. No UX regression.
- [x] **Avatar color palette:** Keep the current 12-color Teams-consistent palette via
  `initialsColor` hex prop on `Persona` (the prop accepts `PersonaInitialsColor | string`).
  Do not use `PersonaInitialsColor` enum (different hues).
- [ ] Decision: `useTheme()` hook in TSX vs. CSS theme strings for color tokens
- [ ] Decision: Which custom CSS classes remain intentionally (structural layout only)

## 9. Open Questions

- [ ] Do we want snapshot tests for key cards to detect UI regressions quickly?

---

Usage note:

- Keep this file temporary and update checkboxes during implementation.
- Remove or archive after migration completes.
