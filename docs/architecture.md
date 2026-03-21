# Architecture and Design Decisions

Project-specific decisions and known limitations.
For installation and build instructions see the [README](../README.md).

## SPFx Lifecycle and Non-Blocking Initialization

`onInit()` resolves immediately after `super.onInit()` and icon registration.
Graph and AAD HTTP client acquisition runs in the background via `_acquireClientsInBackground()`.

**Why:** SPFx awaits the `onInit()` Promise before rendering any web part on the page.
Blocking here with `getClient()` calls would delay the entire page layout, not just this
web part. By resolving `onInit()` immediately, the page renders all web parts in parallel.

**Render sequence for a guest user (view mode):**

1. SPFx calls `render()` right after `onInit()` resolves — both clients are still `undefined`.
   The React component initialises `loading = true` and the shimmer is immediately visible.
2. `_acquireClientsInBackground()` uses `Promise.allSettled` to wait for both clients
   concurrently, then calls `render()` once — passing real clients in a single props update.
3. The `useEffect` in `GuestSponsorInfo` detects the new client props and starts the data fetch.
4. Sponsors load; shimmer replaced by sponsor cards.

For non-guests `render()` returns `null` immediately in both step 1 and step 2 — no visible
effect. Edit-mode shows the placeholder in step 1 and re-renders with the proxy health-check
client in step 2.

## Guest Detection

Combined check: `isGuest = isExternalGuestUser || loginName.includes('#EXT#')`.

`isExternalGuestUser` is the primary signal (from the Entra token, synchronous, no Graph
call). The `#EXT#` fallback covers edge cases where the flag is not yet populated.

**Known limitation:** On a guest's very first visit, `loginName` can be empty because
the SharePoint user profile hasn't been provisioned yet. `isExternalGuestUser` is
unaffected.

## Data Paths

### Azure Function Proxy (recommended)

```text
[Guest Browser]
      │  SPFx acquires AAD token for function App Registration
      ▼
[Azure Function]
  - EasyAuth validates token, sets caller OID from X-MS-CLIENT-PRINCIPAL-ID
  - Calls Graph via Managed Identity (app permissions)
  - Returns { activeSponsors, unavailableCount }
      │
[SPFx]
  - Renders sponsor cards
  - Loads photos directly from Graph (delegated, progressive)
  - Polls presence with adaptive intervals
```

No Entra directory role needed for the guest. The function is the only party that
holds `User.Read.All`; the guest never sees that permission.

### Direct Graph (legacy fallback)

When no function URL is configured, the web part calls `GET /v1.0/me/sponsors` directly.
Requires the guest to hold an Entra directory role (e.g. Directory Readers) — see README.

## Graph Permissions

### Function (application, via Managed Identity)

| Permission | Purpose |
|---|---|
| `User.Read.All` | `/users/{oid}/sponsors`, `$batch` profile checks, `accountEnabled` |
| `Presence.Read.All` | **Optional.** `/communications/getPresencesByUserId`. Requires Teams licensing. Skipped when absent — sponsors render without presence indicator. |
| `MailboxSettings.Read` | **Optional.** Filter shared/room/equipment mailboxes. Skipped when absent. |

### Direct path (delegated, via SharePoint API access panel)

| Permission | Purpose |
|---|---|
| `User.Read` | `/me/sponsors`. Also requires Directory Readers role. |
| `User.ReadBasic.All` | Existence checks (`/users/{id}`), profile photos |
| `Presence.Read.All` | **Optional.** Presence status for sponsor cards. Skipped when not consented. |

### Why no `User.Read.All` on the delegated path

Reading `accountEnabled` requires `User.Read.All`. On the delegated path we avoid this
scope and instead probe with `GET /users/{id}?$select=id` — HTTP 404 = deleted, 200 =
still exists. Disabled-but-not-deleted sponsors remain visible until hard-deleted.
The function proxy path does not have this limitation.

## Profile Photos

Always fetched client-side (delegated token) via `/users/{id}/photo/$value`, even when
the function proxy is used for sponsor/presence data. Returned as `ArrayBuffer` → base64
data URL to avoid `Blob` URL leaks. Failed photo requests fall back to initials silently.

## Presence Display

Both `availability` and `activity` are read from Graph. Display labels follow
[Microsoft's documented combination table](https://learn.microsoft.com/en-us/graph/cloud-communications-manage-presence-state):
`activity` takes priority when it differs from `availability` (e.g. `Busy`/`InAMeeting` → "In a meeting").
All documented tokens are resolved via localised strings; undocumented tokens fall back to a
PascalCase word-splitter (English only).

**OutOfOffice as suffix modifier.** When `activity === 'OutOfOffice'`, the label is the
base `availability` label plus a localised suffix (e.g. "Available, out of office").
If no base availability is set, it falls back to the standalone "Out of office" string.
The dot colour uses the OOF magenta (`#B4009E`) regardless of the base availability.

**Focusing colour.** `Focusing` uses Teams purple (`#6264A7`), not the generic DND red.
This matches the colour Teams displays for focus sessions.

Presence is polled with adaptive intervals: 30 s when a sponsor card is actively hovered,
2 min when the browser tab is visible, 5 min when hidden.

## Azure Function

### Why the proxy exists

`/me/sponsors` requires the calling user to hold an Entra directory role. Assigning roles
to guests at scale is impractical (role-assignable groups have no dynamic membership,
automation requires `RoleManagement.ReadWrite.Directory`, and the sponsor-read permission
is not self-scoped — GDPR concern). The function sidesteps all of this.

### Security

- Caller OID comes from the EasyAuth-validated token — callers cannot query other users.
- CORS restricted to the tenant's SharePoint origin.
- No secrets stored; Managed Identity for Graph and storage access (RBAC, no keys).
- Caller OID redacted in function logs.
- Rate limit: 20 req / 60 s per user (in-memory sliding window, per instance).

### Data Filtering

- Sponsors: must resolve in Graph active view, `accountEnabled !== false`.
- Managers: same rules.
- Mailbox filter (when `MailboxSettings.Read` granted): exclude `userPurpose` other
  than `user` / `linked`. Without the permission the filter is skipped (fail-open).
- Excluded sponsors/managers are counted in `unavailableCount`.
- Max 5 sponsors enforced at the Graph query level.

### Runtime

Three concurrent Graph requests per invocation: sponsor lookup, presence, `$batch`
(profile + manager via `$expand=manager`). Photos are not fetched by the function.

Timeout app settings: `SPONSOR_LOOKUP_TIMEOUT_MS`, `BATCH_TIMEOUT_MS`,
`PRESENCE_TIMEOUT_MS`. Presence/manager degrade gracefully; sponsor lookup failure → 504.

### Deployment (`azd up`)

1. **Pre-provision** — creates/reuses EasyAuth App Registration, detects SharePoint tenant.
2. **Bicep** — provisions storage (RBAC, no keys), Function App with MI + EasyAuth,
   Log Analytics, App Insights.
3. **Post-provision** — grants Graph permissions to MI, prints API URL + Client ID.

> RBAC propagation can take 1–2 min after deploy. Wait and retry if errors appear
> immediately. Deployer needs **Owner** role on the resource group.

Manual fallback: `infra/setup-app-registration.ps1` + `infra/setup-graph-permissions.ps1`.

### Local Development

```bash
cd azure-function
cp local.settings.json.example local.settings.json  # fill in TENANT_ID etc.
npm install && npm start
# Pass guest OID via X-Dev-User-OID header (only accepted when NODE_ENV !== 'production').
```

## App Catalog Guest Access

Assets are bundled inside the `.sppkg`. Guest users cannot access re-hosted assets by
default (HTTP 403). Two solutions — see
[README – Guest Access Requirements](../README.md#guest-access-requirements):

- **Public CDN (recommended):** Assets served from `publiccdn.sharepointonline.com`,
  no auth needed. Simpler, faster, no ongoing permission management.
- **App Catalog permissions:** Grant Read to *All Users (membership)* + enable external
  sharing on the App Catalog site. *Everyone except external users* does **not** work.

`isDomainIsolated: true` is intentionally not used — it has known issues with guest token
acquisition.

## UI Behaviour

| User type | Edit mode | View mode |
|---|---|---|
| Guest | Text placeholder (no Graph calls) | Sponsor cards |
| Non-guest | Text placeholder (different message) | Hidden (`null`) |

Initials avatars use Fluent UI persona colours, deterministically derived from the
display name. Rich contact card shown via Callout (desktop) or Panel (mobile).

## Development Testing

### Hosted workbench

- **As member:** `SPFX_TENANT` in `.env` + `./scripts/start.sh`. Verifies non-guest path.
- **As guest:** Requires a second M365 tenant with your account as guest, sponsors assigned,
  API permissions consented, `.sppkg` deployed or localhost script loading enabled.

### Unit tests

`npm test` — covers guest detection, Graph service calls (mocked), and component rendering.

### Demo mode

Property pane toggle. Shows two fictitious sponsors without Graph calls.
Development/visual review only — disable before production.
