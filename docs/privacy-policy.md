# Privacy Policy

**Product:** Guest Sponsor Info for SharePoint Online\
**Publisher:** Workoho GmbH\
**Effective date:** 2026-03-25

---

## Overview

This Privacy Policy describes how the **Guest Sponsor Info** SharePoint web
part and its companion Azure Function API ("the Solution") handle personal data
while running inside your Microsoft 365 and Azure tenant.

**The Solution does not collect, store, or transmit personal data to Workoho
or any third party.** All data remains within your Microsoft 365 and Azure
environment.

### Who is affected by this policy?

The Solution involves three distinct parties:

- **The organisation** — the company or institution that deploys the Solution
  in its Microsoft 365 and Azure tenant ("your organisation" or "the tenant
  admin").
- **Member employees of your organisation** — whose profiles are displayed
  as sponsor cards inside the web part.
- **Guest users** — external individuals (from another company or as private
  persons) who sign in to your Microsoft 365 tenant under a Microsoft Entra
  External Identity (guest) account. Guest accounts are identified by the
  `#EXT#` marker in their User Principal Name. The web part is visible
  exclusively to those guest users.

From a data-protection perspective, the guest user is in a special position:
they belong to a third-party organisation and have no direct contractual
relationship with Workoho. Their personal data (UPN, Entra object ID) is
processed solely to render the sponsor contact cards that your organisation
has assigned to them. Workoho has no access to this data. The organisation
that deploys the Solution acts as the data controller; Workoho provides the
software tool only.

---

## Data Processed by the Solution

All personal data is processed at runtime exclusively within your tenant. No
data is stored beyond the current browser session or function invocation.

### Web Part (runs in the guest user's browser)

| Data | Source | Purpose | Stored? |
|-|-|-|-|
| Guest user's UPN / `loginName` | SharePoint page context | Detect the `#EXT#` marker to identify guest accounts | No — evaluated in memory only, never transmitted |
| Guest user's Entra object ID (OID) | Entra ID token (via MSAL) | Authenticate requests to the Azure Function API | No — present only in the short-lived Bearer token |
| Sponsor display name, given name, surname | Microsoft Graph | Render the sponsor name on the card | No — held in browser memory for the page lifetime |
| Sponsor job title, department | Microsoft Graph | Display role context on the card | No |
| Sponsor profile photo | Microsoft Graph CDN | Show a visual identifier on the card; initials fallback when absent | No — decoded in browser memory |
| Sponsor email address | Microsoft Graph | Render mailto link on the card | No |
| Sponsor phone numbers (business, mobile) | Microsoft Graph | Render click-to-call links on the card | No |
| Sponsor office location, city, country, address | Microsoft Graph | Render address and map hint on the card | No |
| Sponsor Teams presence (availability, activity) | Microsoft Graph / Azure Function | Show presence indicator on the card | No — polled periodically, held in browser memory |
| Sponsor's manager: display name, job title, department, photo | Microsoft Graph | Render manager context on the card | No |
| Guest's own Teams provisioning status | Azure Function (via Microsoft Graph) | Enable/disable Teams chat and call buttons | No |

### Azure Function API (runs in your Azure subscription)

The Azure Function processes personal data only for the duration of a single
HTTP request:

| Data | Source | Purpose | Stored? |
|-|-|-|-|
| Guest user's Entra OID (from EasyAuth header `X-MS-CLIENT-PRINCIPAL-ID`) | Azure App Service EasyAuth | Identify the caller; look up their sponsors via Graph | No — discarded after the request |
| Guest user's tenant ID and token audience (from EasyAuth claims) | Azure App Service EasyAuth | Validate that the caller belongs to the correct tenant | No |
| Sponsor profile fields (same set as above) | Microsoft Graph application call | Construct the JSON response | No — not persisted |
| Sponsor account status (`accountEnabled`, `isResourceAccount`, `assignedPlans`) | Microsoft Graph | Filter out disabled and resource accounts (Teams Room devices, Common Area Phones, etc.) | No |
| Sponsor mailbox settings (`mailboxSettings.userPurpose`) | Microsoft Graph | Filter out shared, room, and equipment mailboxes (requires `MailboxSettings.Read`) | No |
| Guest's joined Teams (`joinedTeams`) | Microsoft Graph | Determine Teams provisioning status | No |
| Guest's own Teams presence | Microsoft Graph | Used as fallback Teams provisioning signal | No |
| Redacted IP address (last octet masked for IPv4 / last 64 bits for IPv6) | HTTP request | Anonymous rate-limiting; partial security logging | Application Insights in **your** subscription — not accessible by Workoho |
| Redacted caller OID (first 8 and last 4 hex chars only) | Derived from EasyAuth OID | Structured logging / audit traces | Application Insights in **your** subscription |
| Web part version (`X-Client-Version` request header) | HTTP request header | Detect version mismatches; log update-available warnings | Application Insights in **your** subscription |

**Application Insights** receives structured traces, warnings, and error events
from the Function App. This data is stored in a Log Analytics workspace inside
**your own Azure subscription**. Workoho has no access to it.

---

## Microsoft Graph Permissions

The Solution uses two permission tiers depending on whether the optional Azure
Function component is deployed.

### Web Part — Delegated Permissions (acting as the signed-in guest user)

These permissions are requested by the SharePoint package and must be approved
by a Microsoft 365 administrator in the API Access page of the SharePoint
Admin Centre.

| Permission | Purpose | Required? |
|-|-|-|
| `User.Read` | Read the signed-in guest user's own profile and look up their sponsors via `/me/sponsors` | **Required** |
| `User.ReadBasic.All` | Read basic profile fields (display name, photo, email) of the sponsor users | **Required** when the Azure Function is not deployed (direct Graph path) |
| `Presence.Read.All` | Read real-time Teams presence status for sponsors | Optional — cards show without presence indicator if not granted |

> **Note:** In the recommended deployment with the Azure Function proxy the web
> part authenticates to the Function App rather than to Microsoft Graph directly.
> `User.ReadBasic.All` and `Presence.Read.All` are still declared in the package
> to support the optional direct-Graph fallback path and may be reduced by the
> tenant admin when the Function proxy is always available.

### Azure Function — Application Permissions (acting as its own Managed Identity)

These permissions are granted to the Function App's system-assigned Managed
Identity by running `infra/setup-graph-permissions.ps1`. They allow the
function to query Microsoft Graph server-side, independent of the guest user's
own consent.

| Permission | Purpose | Required? |
|-|-|-|
| `User.Read.All` | Read any user's full profile including `accountEnabled` status and sponsor list; resolve sponsor details and manager via `$expand` | **Required** (minimum for the Function path) |
| `Presence.Read.All` | Read real-time Teams presence for sponsors and the guest's own presence (used as a Teams provisioning signal) | Optional — presence indicators and Teams provisioning detection are disabled without it |
| `MailboxSettings.Read` | Read `mailboxSettings.userPurpose` to filter shared mailboxes, room accounts, and equipment accounts out of the sponsor list (supplements the always-active `isResourceAccount` filter) | Optional — filter is simply skipped without it |
| `TeamMember.Read.All` | Read the guest's joined Teams to determine whether their Teams guest account has been provisioned | Optional — sponsors can still be shown; Teams chat/call buttons default to enabled |

By default, the `setup-graph-permissions.ps1` script grants **all four
permissions**. A tenant administrator may choose to omit optional permissions;
doing so reduces functionality as described in the table above.

---

## Telemetry & Customer Usage Attribution

The ARM template for the Azure Function includes a
[Customer Usage Attribution (CUA)](https://learn.microsoft.com/en-us/partner-center/marketplace-offers/azure-partner-customer-usage-attribution)
tracking resource. When the template is deployed, Azure creates an empty
nested deployment named `pid-18fb4033-c9f3-41fa-a5db-e3a03b012939` in your
resource group.

Microsoft uses this GUID to forward **aggregated Azure consumption figures**
(compute hours, storage, etc.) for that resource group to Workoho via Partner
Center. **No personal data, tenant IDs, user names, or resource configurations
are shared.** See the
[Data Collection and Telemetry](deployment.md#data-collection-and-telemetry)
section of the deployment guide for details and opt-out instructions.

### GitHub Release Check

The Azure Function checks the GitHub Releases API once every six hours (and
on every cold start) to detect whether a newer version of the Solution is
available. This outbound HTTPS request is made **from the Azure Function
runtime inside your Azure subscription** and contains:

- The current Function version in the `User-Agent` header
  (e.g. `guest-sponsor-info-function/1.2.3`)

The result is cached in the Function's process memory for up to six hours.
When the SPFx web part is opened in edit mode and an Azure Function URL is
configured, the web part fetches this cached result from the Function's
`/api/getLatestRelease` endpoint — **not directly from GitHub**. No GitHub
API calls are made from the browser.

If no Azure Function is configured for the web part, no GitHub release check
is performed at all and the update notification in the property pane remains
hidden.

No personal data, tenant IDs, or user information are transmitted to GitHub.
The check is a standard read-only GitHub public API call and is subject to
GitHub's
[Privacy Statement](https://docs.github.com/site-policy/privacy-policies/github-general-privacy-statement).

---

## Microsoft AppSource / SharePoint Store

The Solution is submitted to the Microsoft AppSource marketplace and the
SharePoint Store. By installing it, your organisation accepts these policies
in addition to the
[Microsoft Marketplace Terms](https://learn.microsoft.com/en-us/legal/marketplace/marketplace-terms).

The following commitments apply to the Solution as a marketplace offering:

- **No hidden data collection.** The Solution does not phone home, embed
  analytics SDKs, or transmit telemetry to any Workoho-controlled endpoint.
- **Least-privilege permissions.** Only the permissions described in this
  policy are declared or requested. No permissions are silently elevated.
- **No token forwarding.** Bearer tokens issued by Entra ID are validated
  server-side by Azure App Service EasyAuth. The function code never parses
  or forwards raw token strings.
- **No stored credentials.** The Azure Function uses a system-assigned Managed
  Identity. No client secrets, certificates, or passwords are stored in code or
  configuration.
- **GDPR/data residency.** All personal data processed by the Solution stays
  within the tenant's Microsoft 365 and Azure regions. Workoho has no ability
  to access or export it.

---

## Third-Party Services

| Service | Used by | Data sent | Link |
|-|-|-|-|
| Microsoft Graph API | Web part, Azure Function | See permission tables above | [Privacy Statement](https://privacy.microsoft.com/privacystatement) |
| Microsoft Graph CDN | Web part browser | Sponsor/manager profile photo requests | [Privacy Statement](https://privacy.microsoft.com/privacystatement) |
| GitHub Releases API | Azure Function (timer trigger, every 6 h) | `User-Agent` with function version — no browser calls | [Privacy Statement](https://docs.github.com/site-policy/privacy-policies/github-general-privacy-statement) |
| Azure Application Insights | Azure Function | Structured traces (redacted IDs only) | Stored in **your** subscription |

No third-party analytics, advertising, or tracking services are used.

---

## Data Subject Rights

### Sponsor employees (member users of your organisation)

Profile data (name, photo, job title, etc.) is mastered in your organisation's
Microsoft Entra ID directory. To exercise data-subject rights (access,
rectification, erasure, objection), contact your organisation's Microsoft 365
administrator or refer to Microsoft's privacy documentation.

### Guest users

Guest accounts are managed in your organisation's Entra ID tenant as External
Identities. The guest user's home organisation retains control over the
personal data held in their home tenant (e.g. display name, email). Your
organisation controls the guest object in your tenant (e.g. the sponsor
assignment). To exercise data-subject rights, the guest should contact:

1. **Your organisation's data protection officer or Microsoft 365 admin** — for
   the Entra guest object and sponsor assignments stored in your tenant.
2. **Their own (home) organisation** — for personal data mastered there.
3. **Microsoft** — for data processing by Microsoft 365 and Azure services.
   Refer to the [Microsoft Privacy Statement](https://privacy.microsoft.com/privacystatement).

---

## Contact

For privacy-related questions about this Solution:

**Workoho GmbH**\
<https://workoho.com>

For questions about Microsoft's data processing, refer to the
[Microsoft Privacy Statement](https://privacy.microsoft.com/privacystatement).
