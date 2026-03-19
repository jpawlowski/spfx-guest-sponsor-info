# Architecture and Design Decisions

This document explains the technical decisions made in the Guest Sponsor Info web part.
For installation and build instructions see the [README](../README.md).

## Guest Detection

**Primary signal:** `pageContext.user.isExternalGuestUser` — a boolean property on the SPFx
page context that is set directly from the Entra authentication token and is available
synchronously without any Graph call. This is the authoritative indicator for B2B guests.

**Fallback signal:** The `#EXT#` marker in `pageContext.user.loginName`. Entra guest UPNs
follow the form `user_externaldomain.com#EXT#@tenant.onmicrosoft.com`. This heuristic covers
edge cases where `isExternalGuestUser` might not be populated (e.g. during first-load before
the SPFx context is fully hydrated).

The combined check is: `isGuest = isExternalGuestUser || loginName.includes('#EXT#')`.

**Known limitation:** When a guest user visits a SharePoint site for the first time, the call
to `SP.UserProfile.ReadCacheOrCreate` may return HTTP 500 because the guest profile has not
been created yet. This can cause `pageContext.user.loginName` to be empty. The
`isExternalGuestUser` flag is populated from the Entra token and is unaffected by this
user-profile failure, which is why it is used as the primary signal.

**If the `#EXT#` marker is absent:** In unusual tenant configurations where a guest UPN has
been reset or renamed, the Graph `userType` property (`GET /v1.0/me?$select=userType`)
is the ground truth. This would require an async Graph call that is out of scope for the
current implementation; `isExternalGuestUser` covers this gap for all standard Entra B2B
configurations.

## Sponsor Retrieval

The web part supports two data paths:

### With Azure Function Proxy (recommended)

When `functionUrl` and `functionClientId` are configured in the web part property pane,
the web part calls the Azure Function proxy instead of Graph directly:

1. SPFx acquires an AAD token for the Function App's client ID via `aadHttpClientFactory`.
2. The request is sent to the function endpoint with the Bearer token.
3. EasyAuth validates the token and sets `X-MS-CLIENT-PRINCIPAL-ID` (the caller OID).
4. The function calls `GET /users/{callerOid}/sponsors` via its Managed Identity
   (application permission `User.Read.All`).
5. Profile photos, sponsor existence/accountEnabled checks, manager data, and manager photos
   are fetched via Graph `$batch`; presence is fetched in parallel via a single presence call.
6. The function returns `{ activeSponsors, unavailableCount }` — identical to the fallback path.

This path requires no Entra directory role for the calling guest user.

### Fallback: Direct Graph (legacy)

When no function is configured, the web part calls Graph directly with delegated permissions:

**Endpoint used:** `GET /v1.0/me/sponsors`

**Assumption:** The signed-in guest holds a qualifying Entra directory role
(see `README.md → Step 4` for options and their trade-offs).

**Properties selected:** `id`, `displayName`, `mail`, `jobTitle`, `department`, `officeLocation`, `businessPhones`, `mobilePhone`

**Risk:** The `/me/sponsors` relationship may be empty if no sponsors have been assigned in
Entra. The web part handles this gracefully and shows a "no sponsors" message.

## Profile Photos

**Endpoint used:** `GET /v1.0/users/{id}/photo/$value`

**Assumption:** The signed-in guest user has read access to the profile photos of their
sponsors. The `User.ReadBasic.All` delegated permission grants this access.

**Implementation detail:** Photos are fetched as `ArrayBuffer` and converted to base64 data
URLs. This avoids `Blob` URL leaks that would require explicit cleanup.

**Risk:** Profile photos may be restricted by tenant policies. A failed photo request is
silently ignored and the initials-based fallback is shown instead.

## Required Microsoft Graph Permissions

### With Azure Function Proxy (recommended)

The function uses application permissions granted to its Managed Identity.
No delegated permissions need to be approved by an admin in the SharePoint API access panel.

| Permission | Context | Why it is needed |
|---|---|---|
| `User.Read.All` | Azure Function (application) | Read any user's sponsors, profile data, and `accountEnabled` status via `/users/{oid}/sponsors` and `$batch` |
| `Presence.Read.All` | Azure Function (application) | Read sponsor presence status via `/communications/getPresencesByUserId` |
| `MailboxSettings.Read` | Azure Function (application) | **Optional.** Read each sponsor's mailbox `userPurpose` to filter out shared, room, and equipment mailboxes. Detected at runtime from the Managed Identity JWT — without it the filter is simply skipped and everything continues to work. |

All three permissions are assigned by `setup-graph-permissions.ps1` and by the `azd up`
post-provision hook. They are never exposed to the calling guest user. The function
enforces server-side that only the calling user's own sponsors are returned. It filters
out sponsor and manager accounts whose `accountEnabled` flag is `false`, and — when
`MailboxSettings.Read` is present — sponsors whose mailbox `userPurpose` is not `user`
or `linked`.

### Fallback: Direct Graph (legacy)

The following delegated permissions must be granted by a tenant administrator in the
SharePoint Admin Center → API access panel after the `.sppkg` is uploaded.

| Permission | Why it is needed | Can it be reduced? |
|---|---|---|
| `User.Read` | Read the signed-in user's own `/me/sponsors` relationship. | No – this is the smallest delegated scope in Graph. Note: in addition to this permission, the signed-in user must hold the **Directory Readers** role in Microsoft Entra. Without a qualifying role the API returns HTTP 403 regardless of consented scopes. |
| `User.ReadBasic.All` | Read whether each sponsor's directory object still exists (HTTP 404 detection) and load their profile photos via `/users/{id}/photo/$value`. | No – there is no narrower scope that covers reading *other* users' objects. `ReadBasic` exposes only: displayName, first/last name, mail, and photo. It does **not** grant access to sensitive properties like `accountEnabled`, licences, group memberships, etc. |

### Why `*.All` does not mean "full access"

The `All` suffix means the permission applies to *all users* in the tenant, not that it
grants access to *all data* about a user. `User.ReadBasic.All` is deliberately limited
to a very small set of identity attributes. Microsoft provides no narrower alternative
for reading another user's directory objects.

### Why `User.Read.All` is intentionally absent

Reading the `accountEnabled` flag on other users requires `User.Read.All` (or
`Directory.Read.All`), both of which expose far more tenant data than needed.
We therefore do **not** rely on `accountEnabled`.

Instead, we detect that a sponsor is no longer available by making a lightweight probe
request (`GET /users/{id}?$select=id`) for each sponsor:

- **HTTP 200** → sponsor's directory object still exists. The web part shows the card.
  (If the account is merely *disabled* rather than *deleted*, it will still appear –
  see limitation below.)
- **HTTP 404** → sponsor's directory object is gone (hard-deleted or past the 30-day
  soft-delete window). The web part counts this sponsor as unavailable.
- **Any other error** → treated as "still exists" so that a transient Graph outage does
  not incorrectly hide a sponsor card.

### Known limitation: disabled accounts (fallback direct Graph path only)

When the web part operates without the Azure Function proxy (fallback direct Graph path),
a sponsor whose Entra account has been *disabled* (but not yet deleted) will still show,
because confirming `accountEnabled === false` on another user requires `User.Read.All` —
a scope not requested on the delegated path. The account will disappear once hard-deleted
(typically 30 days after disabling, or immediately if force-deleted by an admin).

**This limitation does not apply to the recommended Azure Function proxy path.**
The proxy requests `accountEnabled` via its `User.Read.All` application permission and
filters out disabled sponsors before returning results.

If the direct Graph path must be used and this limitation is critical, use an admin-side
automation to remove the sponsor assignment from the guest user object at the time of
account deactivation.

## Azure Function Proxy

### Why Entra directory roles are not viable at scale

The `/me/sponsors` API requires the calling user to hold one of these Entra directory roles:
Directory Readers, Guest Inviter, Directory Writers, User Administrator, or a custom role with
`microsoft.directory/users/sponsors/read`. Assigning roles to B2B guest accounts at scale has
several structural problems:

1. **Role-assignable groups required** — Entra roles can only be assigned to security groups
   created with `isAssignableToRole = true`. This flag cannot be set on existing groups.
2. **No dynamic membership** — role-assignable groups do not support dynamic membership rules.
   Every new guest must be added manually or via automation.
3. **High-privilege automation** — tools that auto-add guests to the role-assignable group
   need `RoleManagement.ReadWrite.Directory` (effectively Global Admin access), which is
   unacceptable for third-party tools.
4. **Not self-scoped** — the `microsoft.directory/users/sponsors/read` permission allows the
   guest to read sponsor relationships of *other* guests, not just their own. This is a
   GDPR/DSGVO consideration.

### Architecture

```text
[Guest User Browser]
      │
      │  1. SPFx acquires AAD token for the function App Registration
      │     via context.aadHttpClientFactory.getClient(functionClientId)
      ▼
[Azure Function: getGuestSponsors]
  - EasyAuth validates the Bearer token
  - Reads caller OID from X-MS-CLIENT-PRINCIPAL-ID header
  - Calls Graph as Managed Identity (app permissions)
      │
      │  2. ISponsor[] JSON
      ▼
[SPFx web part → renders SponsorCard components]
```

### Token flow

- SPFx calls `aadHttpClientFactory.getClient(functionClientId)` — the factory acquires a
  delegated token for the function's App ID URI using the user's existing SharePoint session.
  No extra sign-in prompt is required.
- EasyAuth validates the Bearer token before the function code runs. The caller OID is read
  from the `X-MS-CLIENT-PRINCIPAL-ID` header that EasyAuth sets after validation.
- The Function App's system-assigned Managed Identity calls Graph with application permissions.
  No client secrets are stored anywhere.

### Security properties

- Guests never hold any Entra directory role — no role management overhead.
- The function enforces that only the calling user's own sponsors are returned. Callers cannot
  pass another OID — it comes from the EasyAuth-validated token.
- `User.Read.All` as an application permission does not mean the guest has that permission;
  it belongs to the function's identity. The function is the only party that can use it.
- Function logs redact the caller OID instead of writing the full GUID into logs.
- CORS is restricted to the tenant's SharePoint origin.
- Graph calls use short, environment-configurable fail-fast timeouts. Presence and manager
   photos degrade gracefully when they are slow; the core sponsor lookup fails with HTTP 504.
- No storage account keys are stored anywhere. The Function App's Managed Identity accesses
  its own storage account via three RBAC role assignments (Storage Blob Data Owner, Storage
  Queue Data Contributor, Storage Table Data Contributor) deployed by Bicep.
- Unauthenticated requests (missing or invalid Bearer token) are rejected with HTTP 401 by
  EasyAuth before the function code runs. CORS OPTIONS preflights are handled by the Azure
  platform's CORS module before EasyAuth, so they succeed without a token — this is required
  for the browser's preflight flow and carries no meaningful attack surface.

### Data filtering rules

- A sponsor is returned only when the object still resolves via the active `/users/{id}` view
   and `accountEnabled !== false`.
- A sponsor that is hard-deleted, soft-deleted, or disabled is excluded and counted in
   `unavailableCount`.
- A sponsor whose mailbox `userPurpose` is not `user` or `linked` (e.g. shared, room,
   equipment) is excluded and counted in `unavailableCount` when the `MailboxSettings.Read`
   application permission is granted. Without that permission the field is not read and all
   sponsors pass this filter (fail-open behaviour).
- A manager is returned only when the manager relationship resolves via the active Graph view
   and `accountEnabled !== false`.
- A soft-deleted manager or sponsor is treated as unavailable through the normal active-user
   endpoints; querying `directory/deletedItems` is not required for this UI scenario.

### Runtime characteristics

- A guest can have at most 5 sponsors; the function enforces this cap at the Graph query level.
- The function makes three concurrent Graph requests per invocation: one sponsor lookup,
   one presence call, and one `$batch` request with one sub-request per sponsor (manager
   data is inlined via `$expand=manager` — no separate manager batch needed). Profile photos
   are not fetched by the function; the SPFx client loads them progressively after the
   initial render.
- Timeout values can be tuned via app settings:
   `SPONSOR_LOOKUP_TIMEOUT_MS`, `BATCH_TIMEOUT_MS`, `PRESENCE_TIMEOUT_MS`.
- Authenticated callers are rate-limited to **20 requests per 60 seconds per user** using an
  in-memory sliding window. Excess requests receive HTTP 429 with a `Retry-After` header.
  The counter is per Function App instance; on a Consumption plan that briefly scales to
  multiple instances the effective limit per user rises proportionally, which remains
  acceptable for this use case (one page load = one request).

### Deployment

The recommended way to deploy the Azure Function proxy is via the
[Azure Developer CLI](https://learn.microsoft.com/en-us/azure/developer/azure-developer-cli/)
(`azd`). One command handles all steps end-to-end.

**Prerequisites:** Azure Developer CLI and Azure CLI installed; `az login` completed.

```bash
azd up
```

`azd up` runs the following steps in sequence:

1. **Pre-provision hook** — creates (or reuses) the Entra App Registration for EasyAuth,
   detects the SharePoint tenant name from the organisation's default verified domain,
   and generates a Function App name from the azd environment name.
2. **Bicep deployment** — provisions the storage account, App Service plan, Function App
   (with system-assigned Managed Identity and EasyAuth), three storage role assignments,
   a Log Analytics Workspace, an Application Insights component, and all app settings.
   No storage account keys are used.
3. **Post-provision hook** — grants `User.Read.All`, `Presence.Read.All` (optional), and
   `MailboxSettings.Read` (optional) to the Managed Identity, then prints the Sponsor API
   URL and Function Client ID to paste into the SPFx web part property pane.

> **First-deploy note:** Azure RBAC role assignment propagation can take 1–2 minutes after
> Bicep completes. If the function returns errors immediately after `azd up`, wait a moment
> and retry — no redeployment needed.
>
> **Required deployer permission:** Creating role assignments in Bicep requires the deploying
> principal to hold the **Owner** role (or a custom role with
> `Microsoft.Authorization/roleAssignments/write`) on the target resource group or subscription.

The `infra/setup-app-registration.ps1` and `infra/setup-graph-permissions.ps1` scripts
remain available as a manual fallback for environments where `azd` cannot be used.

### Local development

```bash
cd azure-function
cp local.settings.json.example local.settings.json  # fill in TENANT_ID etc.
npm install && npm start
# EasyAuth is absent locally; pass the guest OID via X-Dev-User-OID header.
# This header is only accepted when NODE_ENV !== 'production'.
# Optional: tune GRAPH call timeouts via *_TIMEOUT_MS values in local.settings.json.
# AzureWebJobsStorage uses Azurite (UseDevelopmentStorage=true) in local.settings.json;
# the MI-based storage config in Bicep only applies to the deployed Azure environment.
```

## App Catalog Access for Guest Users

All JavaScript and CSS assets are bundled *inside* the `.sppkg` file
(`includeClientSideAssets: true`). SharePoint re-hosts those assets at runtime.
Guest users have no default access to those assets, which causes HTTP 403 errors
and the web part never initialises.

There are two ways to resolve this. Both are described step-by-step in
[README – Guest Access Requirements](../README.md#guest-access-requirements).

### Option A – SharePoint Public CDN (recommended)

When the Public CDN is enabled and the `*/CLIENTSIDEASSETS` origin is registered, SharePoint
automatically rewrites asset URLs to `https://publiccdn.sharepointonline.com/…` — served
from an edge cache without authentication. Guest users (and even anonymous users) can
download the bundle with no App Catalog permissions at all. No `ShowAllUsersClaim`
configuration is required.

This is the preferred approach: it is simpler, faster (edge caching), and requires no
ongoing permission management as new guests are added.

### Option B – App Catalog permissions (alternative)

If the Public CDN cannot be enabled:

1. Verify `ShowAllUsersClaim` is `$true` (default for modern tenants).
2. Enable external sharing on the App Catalog site (*Existing guests* minimum).
3. Grant *Read* permission to **All Users (membership)** or a specific security group.
   Note: *Everyone except external users* explicitly excludes B2B guests.

**Why not `isDomainIsolated: true`?**
Domain-isolated web parts use a separate Microsoft Entra application and an isolated frame.
That model adds complexity and has known limitations with guest-user token acquisition;
`isDomainIsolated: false` (the default) is the recommended approach for guest-facing
solutions.

## Edit Mode Behaviour

In edit mode, the web part always shows a lightweight text placeholder. No Graph calls
are made in edit mode. This keeps the authoring experience fast and avoids permission
prompts for page editors who are not guest users.

## Display Mode Rendering

| User type | Edit mode | View mode |
|---|---|---|
| Guest user | Placeholder text | Full sponsor card grid |
| Non-guest user | Placeholder text (different message) | Web part hidden (`null`) |

## Profile Photo Colour Palette

Initials avatars use a deterministic colour derived from the sponsor's display name.
The colour set matches the Fluent UI persona colours used by SharePoint people experiences.

## Hover / Focus Interaction

The contact details overlay currently appears to the **right** of the card using
`position: absolute`. For cards near the right viewport edge, the overlay may be clipped.
A future iteration could use the Fluent UI `Callout` component, which handles viewport
boundary flipping automatically.

## Development Testing

Testing this web part end-to-end is more involved than typical SPFx components because the
core feature — showing a guest user's sponsors — requires the signed-in user to actually be
a guest in the target tenant, with sponsors assigned.

### Hosted workbench — as a regular member

Set `SPFX_TENANT` in your `.env` file and run `./scripts/start.sh`. SPFx serves the local
bundle from `https://localhost:4321` and embeds it in the real SharePoint page. You will
have a real `pageContext`, but because `#EXT#` is absent from your login name you will be
treated as a non-guest → the web part renders nothing in view mode. Useful for verifying
the non-guest code path.

### Hosted workbench — as a guest (full integration test)

This is the only complete end-to-end test. Prerequisites:

1. **A second Microsoft 365 tenant** (e.g. a partner or dedicated test tenant) where your
   account has been invited as a guest user.
2. **Sponsors must be explicitly assigned** to your guest account in that tenant:
   Microsoft Entra admin center → Users → your guest account → Sponsors → assign one or more
   internal users as sponsors.
3. **API permissions must be consented** in that tenant's SharePoint Admin Center → API
   access panel (`User.Read` and `User.ReadBasic.All`).
4. **The `.sppkg` must be deployed** in that tenant's App Catalog, or the tenant must be
   configured to load scripts from `localhost:4321` during local dev mode.

Set `SPFX_TENANT=<partner-tenant>.sharepoint.com` in your `.env`, run `./scripts/start.sh`,
and open the hosted workbench URL in a browser session where you are signed in as the guest
account.

### Unit tests (Jest)

`npm test` covers guest detection logic and Graph service calls with mocked API responses.
This is the practical substitute for integration testing when a guest-enabled second tenant
is not available. Run the tests after every change to `SponsorService.ts` or the main
component.

### Demo mode

The web part includes a **Demo mode** toggle in the property pane (edit the web part →
property pane → "Demo mode (mock data)"). When enabled:

- The user is treated as a guest regardless of the actual login name.
- Two fictitious sponsor records from `MockSponsorService.ts` are rendered without any
  Graph calls.
- Useful for visual review of sponsor card layout and styles on the hosted workbench
  without needing a genuine guest account with sponsors assigned.

Demo mode is intended for development and visual review only. It is not a security
boundary; disable it before deploying to production. The property is stored in the web
part instance properties and defaults to `false`.
