# GitHub Copilot Instructions

This repository contains a SharePoint Online web part built with SharePoint Framework.
Authoritative versions are in `package.json` (`engines`, `dependencies`, `devDependencies`).

> **For AI coding agents:** See [AGENTS.md](../AGENTS.md) for recommended tools and workflows.

## After every code change

Always validate your changes before considering a task done:

1. **Lint** — always run `npm run lint` after every change (fast, catches most issues early).
   Per-type: `npm run lint:ts` · `npm run lint:md` · `npm run lint:loc` · `npm run lint:sh`
   Auto-fix: `npm run fix` (runs ESLint · Stylelint · Prettier for JSON · shfmt for shell · Markdownlint)
2. **Test** — run `npm test` when you changed logic, components, or services.
   Skip for pure documentation, config, or style-only changes.
3. **Build** — run `npm run build` only when the packaging artifact (`.sppkg`) is relevant,
   e.g. before a release. Not needed for regular development changes.

For interactive development use `npm start` (hosted workbench with hot-reload; requires `SPFX_SERVE_TENANT_DOMAIN` —
set in `.env` or as a host OS env var, see `.devcontainer/devcontainer.json`).
For a CI-style clean build from scratch use `./scripts/build.sh` (runs `npm ci` first).

If any lint errors or test failures appear after your changes, fix them before finishing.
Do not suppress linter rules or skip tests to make the pipeline green.

## Key scripts

| Script                                     | Purpose                                               |
| ------------------------------------------ | ----------------------------------------------------- |
| `./scripts/bootstrap.sh`                   | Install deps + create `.env` (run once after cloning) |
| `./scripts/reset.sh`                       | Wipe build outputs + node_modules, then re-bootstrap  |
| `./scripts/dev-webpart.sh`                 | Start SPFx web part dev server                        |
| `./scripts/dev-function.sh`                | Start Azure Function locally                          |
| `./scripts/test.sh`                        | Run tests                                             |
| `./scripts/lint.sh`                        | Run all linters                                       |
| `./scripts/lint-fix.sh`                    | Auto-fix lint issues locally                          |
| `./scripts/build.sh`                       | CI-style clean build → `.sppkg`                       |
| `./scripts/release-notes.sh`               | Preview release notes locally                         |
| `./scripts/set-version.sh v1.x.y`          | Stamp a release version                               |
| `./scripts/set-version.sh v1.x.y --commit` | Stamp, commit, and tag a release                      |
| `./scripts/upgrade-spfx.sh 1.x.y`          | Guided SPFx upgrade                                   |

The release workflow is documented in `docs/development.md` → "Publishing a Release".

## Stack constraints

- SPFx — do not upgrade unless explicitly asked. Use `scripts/upgrade-spfx.sh` when needed.
- Node.js — stay within the range defined in the `engines` field of `package.json`.
- React — the version is pinned; do not change it.
- Build tool: Heft (no Gulp). Use `npm test`, `npm run build`, `npm start` — never raw `npx heft`
  unless diagnosing a build problem.
- Before adding any package, verify compatibility with the current SPFx version.
- **Never run `npm audit fix --force`** — it would downgrade SPFx build-rig packages and break
  the build. Audit warnings in transitive SPFx dependencies cannot be fixed independently.
- **Never run `npm update`** on `@microsoft/sp-*`, `@rushstack/*`, `react`, or `@types/react`.
  These are managed as a coordinated set via `scripts/upgrade-spfx.sh`.

## Feature behaviour

- The web part shows the Microsoft Entra **sponsors** of the currently signed-in guest user.
- In **view mode**: render nothing for non-guest users; render sponsor cards for guests.
- In **edit mode**: always show a lightweight text placeholder — no Graph calls, no photos.
- Guest detection: `#EXT#` marker in `pageContext.user.loginName`.
- Microsoft Graph permissions in use: `User.Read` and `User.ReadBasic.All` only.
  Do not introduce `User.Read.All` or broader scopes.

## Code style

- All code comments and documentation in English. User-facing chat may stay in German.
- No bundled placeholder images. Use live profile photos from Graph; fall back to initials.
- Styles use `makeStyles` + `tokens` from `@fluentui/react-components` (Griffel) for all component-level
  styles. Do not add CSS/SCSS module files.
- Locale strings follow the SPFx AMD `define()` pattern in `loc/*.js`; add new keys to all 14 locale files
  (en-us, de-de, fr-fr, es-es, it-it, da-dk, fi-fi, ja-jp, nb-no, nl-nl, pl-pl, pt-br, sv-se, zh-cn).

## Shell scripts (`scripts/*.sh`)

- Every script must start with `set -euo pipefail` and
  `cd "$(dirname "${BASH_SOURCE[0]}")/.."`.
- Source `scripts/colors.sh` for all colour output — never copy the colour-detection
  block inline. Colour variables: `C_RED` `C_GRN` `C_YLW` `C_CYN` `C_BLD` `C_DIM` `C_RST`.
- After every change run `npm run lint:sh` (`shellcheck -x`). Fix all warnings — do not
  suppress them with `# shellcheck disable` without a comment explaining why.
- Bash parameter expansions and non-obvious constructs must have an inline comment.
- Scripts that perform side effects (file writes, git ops) should support a dry-run mode
  via a `maybe()` helper that prints `[dry-run] <cmd>` instead of executing.

## Key files

- `src/webparts/guestSponsorInfo/services/SponsorService.ts` — all Graph logic
- `src/webparts/guestSponsorInfo/components/GuestSponsorInfo.tsx` — main component
- `src/webparts/guestSponsorInfo/components/SponsorCard.tsx` — individual card
- `docs/architecture.md` — design decisions and known limitations
