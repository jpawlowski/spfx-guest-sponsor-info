# Guest Sponsor Info

A SharePoint Online web part for landing pages in Microsoft Entra **resource tenants** that
shows the sponsors of the currently signed-in **guest user**.

The layout matches the SharePoint People web part:
each sponsor is shown as a card with a live photo (or initials fallback),
name, and job title.
Hovering or focusing a card reveals contact details.

## Applies to

- [SharePoint Framework](https://aka.ms/spfx)
- [SharePoint Online](https://www.microsoft.com/microsoft-365)
- [Microsoft Entra ID – External Identities (B2B)](https://learn.microsoft.com/azure/active-directory/external-identities/)

## Prerequisites

| Requirement | Detail |
|---|---|
| SharePoint Online | Modern team or communication site |
| Microsoft Entra | Guest accounts with one or more sponsors assigned |
| Microsoft Graph permissions | `User.Read` · `User.ReadBasic.All` |

The two Graph permissions must be approved by a tenant administrator in the
**SharePoint Admin Center → Advanced → API access** page after the solution is deployed.

## Solution

| Solution | Author(s) |
|---|---|
| `guest-sponsor-info.sppkg` | [Julian Pawlowski](https://github.com/jpawlowski) |

## Features

- **Sponsor cards** – photo (or initials + deterministic colour) · name · job title
- **Contact overlay** – email · business phone · mobile · office location · department on hover/focus
- **Guest-only in view mode** – renders `null` for member users; they see nothing
- **Edit-mode placeholder** – always visible to page authors regardless of guest status,
  so the web part can be positioned and configured on the page
- **Deleted-sponsor handling** – existence is verified without `User.Read.All`; accounts
  that have been deleted are counted and a friendly message is shown when all sponsors are gone
- **Multilingual** – English · German · French · Spanish · Italian
- **Theme-aware** – `supportsThemeVariants: true` honours the site theme
- **Least-privilege Graph permissions** – `User.ReadBasic.All` instead of `User.Read.All`

## Required Permissions

| Scope | Resource | Reason |
|---|---|---|
| `User.Read` | Microsoft Graph | Read the signed-in user's own profile |
| `User.ReadBasic.All` | Microsoft Graph | Fetch sponsor name, mail, job title, department, and phone |

> **Why not `User.Read.All`?**
> Sponsor profiles are publicly visible within the organisation.
> `User.ReadBasic.All` is sufficient and does not expose sensitive account data such as
> `accountEnabled` or `onPremisesSyncEnabled`.

## Minimal Path to Awesome

> "Minimal Path to Awesome" is a [PnP community convention](https://aka.ms/m365pnp) for SPFx
> web part README files — it means the shortest way to get the web part running.

### Deploy a pre-built release

1. Download the latest `guest-sponsor-info.sppkg` from [Releases](../../releases).
2. Upload it to your SharePoint **App Catalog**.
3. Approve the API permissions in
   **SharePoint Admin Center → Advanced → API access**.
4. Add the *Guest Sponsor Info* web part to a modern page.

### Build from source

```bash
npm install        # install dependencies
npm run build      # compile, test, bundle, and package
```

The packaged solution is written to `sharepoint/solution/guest-sponsor-info.sppkg`.

### Local development

```bash
cp .env.example .env          # fill in SPFX_TENANT=<your-tenant>.sharepoint.com
./scripts/start.sh            # starts dev server with hot-reload
```

The dev server bundles your code locally and serves it to the **hosted workbench** on your
SharePoint Online tenant. Accept the certificate warning at `https://localhost:4321` once
per browser session, then open the hosted workbench URL printed on startup.

See [docs/architecture.md](docs/architecture.md) for the different testing scenarios
(hosted workbench as member vs. guest vs. full integration test).

## All Build Commands

| Command | Description |
|---|---|
| `npm run build` | Full production build + unit tests + packaging |
| `npm test` | Compile and run unit tests |
| `npm start` | Start dev server (hot-reload, hosted workbench) |
| `npm run clean` | Delete all build output |
| `npm run lint` | Run all linters (TypeScript · SCSS · Markdown) |

Wrapper scripts in `scripts/` provide additional convenience (see below).

## Unit Tests

Tests are written with **Jest 29** and `react-dom/test-utils` (no additional test library needed).

```bash
npm test
```

Coverage output is written to `jest-output/coverage/`.

## Publishing a Release

Releases are created by pushing a SemVer tag. The recommended workflow:

```bash
./scripts/set-version.sh v1.2.3 --commit   # stamp version, commit, and create tag
git push && git push --tags                 # triggers the release GitHub Actions workflow
```

The workflow automatically:

1. Generates release notes from the Conventional Commit history (via [git-cliff](https://git-cliff.org)).
2. Builds the production `.sppkg`.
3. Creates a GitHub Release with the notes and the `.sppkg` attached.

For the **first release**, this works even with a single commit and no prior tags.
Preview what the release notes will look like before tagging:

```bash
./scripts/release-notes.sh
```

## Continuous Integration

| Workflow | Trigger | What it does |
|---|---|---|
| `ci.yml` | Push / PR to `main` | Build · test · upload coverage |
| `release.yml` | `v*` SemVer tag | Bump version · build · create GitHub Release + `.sppkg` asset |

## References

- [SharePoint Framework documentation](https://aka.ms/spfx)
- [Microsoft Graph – List sponsors](https://learn.microsoft.com/graph/api/user-list-sponsors)
- [Microsoft Entra B2B sponsors](https://learn.microsoft.com/azure/active-directory/external-identities/b2b-sponsors)
- [Use Microsoft Graph in your SPFx solution](https://docs.microsoft.com/sharepoint/dev/spfx/web-parts/get-started/using-microsoft-graph-apis)
- [Microsoft 365 Patterns and Practices](https://aka.ms/m365pnp)

## License

MIT — see [LICENSE](LICENSE) for details.

## Disclaimer

**THIS CODE IS PROVIDED *AS IS* WITHOUT WARRANTY OF ANY KIND, EITHER EXPRESS OR IMPLIED,
INCLUDING ANY IMPLIED WARRANTIES OF FITNESS FOR A PARTICULAR PURPOSE, MERCHANTABILITY,
OR NON-INFRINGEMENT.**
