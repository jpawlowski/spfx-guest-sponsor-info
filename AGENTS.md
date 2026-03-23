# Agent Customization Guide

This file documents tools and best practices for AI coding agents (GitHub Copilot, Claude, etc.) working in this repository.

## DevContainer Tools Available

The following CLI tools are pre-installed in `.devcontainer/Dockerfile` and should be used over their slower alternatives:

### File & Search Tools

| Tool | Alternative | Command Example | Best For |
|------|-------------|-----------------|----------|
| **ripgrep** (`rg`) | `grep` | `rg "ComponentName" src/ --type ts` | Fast code/text search across codebase |
| **fd** | `find` | `fd "\.tsx$" src/` | Finding files by pattern (faster, cleaner syntax) |
| **bat** | `cat` | `bat src/components/MyComponent.tsx` | Syntax-highlighted file preview in terminal |
| **shellcheck** | — | `shellcheck scripts/*.sh` | Static analysis of shell scripts |

### Data Processing Tools

| Tool | Use Case | Example |
|------|----------|---------|
| **jq** | JSON parsing | `cat package.json \| jq '.scripts'` |
| **yq** | YAML/config parsing | `yq eval '.devDependencies' package.json` |
| **fzf** | Interactive fuzzy selection | `fd "test.ts" \| fzf` (pick file interactively) |

## Recommended Agent Usage Patterns

### 1. **Searching Code**

```bash
# ✅ Good: Using rg for fast search
rg "SponsorService" src/ --type ts

# ❌ Avoid: Using grep (slower)
grep -r "SponsorService" src/
```

### 2. **Finding Files**

```bash
# ✅ Good: Using fd for clean syntax
fd "GuestSponsorInfo\.tsx"

# ❌ Avoid: Using find (verbose)
find . -name "*GuestSponsorInfo*" -type f
```

### 3. **Reading Configuration**

```bash
# ✅ Good: Using yq/jq for structured parsing
yq eval '.engines' package.json

# ❌ Avoid: Manual regex parsing
grep "engines" package.json | cut -d '"'
```

### 4. **Previewing Files in Terminals**

```bash
# ✅ Good: Using bat for syntax highlighting
bat src/webparts/guestSponsorInfo/GuestSponsorInfo.tsx

# ❌ Avoid: Using cat (no syntax highlighting)
cat src/webparts/guestSponsorInfo/GuestSponsorInfo.tsx
```

## Git Workflow

### Pre-commit Hook

The `.husky/pre-commit` hook automatically:

1. Runs `npm run fix` (auto-corrects formatting issues)
2. Runs `npm run lint` (validates code quality)

**Do not** skip this hook (`--no-verify`) except for meta-changes (infrastructure-only commits).

### Commit Message Format

Use Conventional Commits (enforced by `commitlint` via `.husky/commit-msg`).
See `.github/instructions/commit-message.instructions.md` for the full ruleset.

**Hard limits** (violations abort the commit):

- Header ≤ **100 characters**
- Every body/footer line ≤ **100 characters** — wrap prose manually
- Subject must be **lower-case**, no trailing period
- Type must be one of: `fix` `feat` `build` `chore` `ci` `docs` `perf`
  `refactor` `revert` `style` `test`

```text
chore(i18n): normalize locale files to UTF-8
feat(sponsor): add sponsor card caching
fix(graph): handle missing user profile gracefully
docs: update README configuration section
```

## When to Use npm Scripts vs Direct Commands

### ✅ Use `npm` Scripts (Managed + Linted)

```bash
npm run lint        # ESLint + Stylelint + Markdownlint + locale syntax
npm run fix         # Auto-correct formatting
npm run lint:ts     # TypeScript only
npm run lint:loc    # Locale .js files (node --check syntax only)
npm test            # Jest + coverage
npm start           # Dev server with hot-reload
npm run build       # Full production build + packaging
```

### ⚠️ Avoid Raw Commands Unless Necessary

```bash
# ❌ Don't run raw heft commands
npx heft build

# ✅ Use npm scripts instead
npm run build
```

```bash
# ❌ NEVER call the husky binary directly without -- separator.
#    Husky v9 treats its first positional argument as a target directory.
#    Running 'npx husky --version' (without --) makes husky create a
#    '--version/_' directory and overwrite core.hooksPath, breaking all
#    git hooks (commits and pushes will fail with "Illegal option --").
npx husky --version   # ❌ breaks git hooks!
npx husky list        # ❌ breaks git hooks!

# ✅ Use npm scripts to manage hooks
npm run prepare                           # (re-)install / reset git hooks

# ✅ If you need the husky version, use the -- separator:
node_modules/.bin/husky -- --version      # ✅ safe
```

## Code Validation Checklist

After **every** code change:

1. **Lint** → `npm run lint` (catches 95% of issues)
2. **Test** → `npm test` (if logic changed)
3. **Fix** → `npm run fix` (auto-correct before committing)
4. **Validate** → `npm run lint` again (final check)

**Never push with lint errors or test failures.**

## Stack Constraints (Do Not Violate)

- **SPFx version** — Do not upgrade; use `scripts/upgrade-spfx.sh` when explicitly requested
- **Node version** — Must stay within `engines` range in `package.json` (currently `>=22.14.0 <23.0.0`)
- **React version** — Pinned at 17.0.1; do not change
- **@microsoft/** packages — Managed as coordinated set; do not individually update

## Fluent UI v9 Rules (Enforced — Do Not Use v8 APIs)

This project has been migrated to **Fluent UI v9** (`@fluentui/react-components`).
All new code **must** use v9 APIs. Do not import from `@fluentui/react` (v8).

### Allowed imports

```typescript
// ✅ Fluent UI v9 components
import { FluentProvider, MessageBar, MessageBarBody, Avatar,
         PresenceBadge, Popover, PopoverTrigger, PopoverSurface,
         OverlayDrawer, DrawerHeader, DrawerHeaderTitle, DrawerBody,
         Button, Tooltip, Link, makeStyles, mergeClasses } from '@fluentui/react-components';

// ✅ Fluent UI v9 icons (SVG — no icon font needed)
import { ChatRegular, MailRegular, CallRegular, CopyRegular,
         CheckmarkRegular, PhoneRegular, BuildingRegular,
         LocationRegular, OrganizationRegular, DismissRegular } from '@fluentui/react-icons';

// ✅ Theme bridge (SPFx → v9)
import { createV9Theme } from '@fluentui/react-migration-v8-v9';
```

### Forbidden patterns

```typescript
// ❌ v8 components
import { Persona, Callout, Panel, ActionButton, IconButton,
         Icon, TooltipHost, MessageBar } from '@fluentui/react';
// ❌ v8 icon font
initializeIcons();
// ❌ v8 inline style overrides
const styles: IButtonStyles = { root: { ... } };
```

### Key component equivalents

| v8 | v9 |
|---|---|
| `Persona` (avatar display) | `Avatar` with `color="colorful"` |
| `PersonaPresence` enum | `PresenceBadge` `status` string prop |
| `Callout` | `Popover` + `PopoverTrigger` + `PopoverSurface` |
| `Panel` | `OverlayDrawer` + `DrawerHeader` + `DrawerBody` |
| `ActionButton` / `IconButton` | `Button` with `appearance="subtle"` |
| `Icon iconName="Chat"` | `<ChatRegular />` (SVG from `@fluentui/react-icons`) |
| `TooltipHost` | `Tooltip` with `relationship="label"` |
| `Link` | `Link` from `@fluentui/react-components` |
| `MessageBar` + `MessageBarType` | `MessageBar` + `MessageBarBody` with `intent` prop |
| `IButtonStyles` | `makeStyles(…)` (Griffel) |

### Theme integration

Always wrap the component tree in `<FluentProvider>` with the site theme:

```tsx
import { FluentProvider } from '@fluentui/react-components';
import { createV9Theme } from '@fluentui/react-migration-v8-v9';
// `theme` is the IReadonlyTheme from the SPFx ThemeProvider service
const v9Theme = theme ? createV9Theme(theme) : undefined;
return <FluentProvider theme={v9Theme}>{children}</FluentProvider>;
```

See `MIGRATION.md` for the full migration plan and component mapping table.

## Key Files for Reference

- **Lint config** → `config/` directory + `.markdownlint.json`
- **Locale strings** → `src/webparts/guestSponsorInfo/loc/*.js` (UTF-8 native characters, no `\uXXXX` escapes)
- **Components** → `src/webparts/guestSponsorInfo/components/`
- **Services** → `src/webparts/guestSponsorInfo/services/` (Graph API calls in `SponsorService.ts`)
