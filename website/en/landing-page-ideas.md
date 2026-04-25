---
layout: doc
lang: en
title: Landing Page Ideas
permalink: /en/landing-page-ideas/
description: >-
  Optional ideas for a SharePoint guest landing page in Microsoft Entra B2B —
  especially Quick Links areas, tenant-pinned Microsoft 365 deep links, and
  supporting links around sponsor visibility.
lead: >-
  A small optional add-on for admins who want their SharePoint guest landing
  page to do more for Microsoft Entra B2B guest onboarding. These ideas sit
  around the Guest Sponsor Info web part; they are not required for the
  product to work.
---

## Why This Page Exists

This page is intentionally small. The goal is not to prescribe a complete
landing-page blueprint, but to show a few proven ideas for what else a shared
guest landing page can contain besides the sponsor web part.

The key distinction is this: **Guest Sponsor Info handles sponsor visibility**.
The surrounding landing-page elements handle orientation, SharePoint guest
access, Microsoft 365 entry points, and self-service actions. Together, they
turn a generic arrival page into something that actually helps B2B guests move
forward.

If you use the SharePoint **Quick Links** web part, you can already build most
of this without custom code. With audience targeting enabled, the same landing
page can show different links to employees and guests.

The examples below use placeholders such as `<tenant-id>`, `<tenant-name>`,
and `<tenant-domain>`. Replace them with your own values.

## A Good Default Pattern

For many Microsoft Entra B2B tenants, two Quick Links web parts are already
enough for a practical SharePoint guest landing page:

- One area for **Microsoft 365** entry points in the correct tenant.
- One area for **My Guest Account** self-service actions.
- Optionally, a small standalone Quick Links web part for **More Apps** so it
  looks secondary rather than like the primary destination.

This works especially well when the landing page itself uses audience targeting.
Employees can see internal employee resources, while guests see only the links
that actually help them in the resource tenant.

Separate from those outbound links, the landing page itself can also
be the hub site for the guest area. That gives you a shared navigation layer,
hub branding options, and a clearer identity for the whole area even before
you associate any other sites.

That can also help with naming. For example, the underlying site can keep a
friendly site title such as `Welcome @ Contoso`, while the hub identity and hub
navigation present the broader area as something like `Entrance Area`.

If you later do associate more sites, that hub becomes even more useful. You
can add links to associated or non-associated sites in the hub navigation and
use audience targeting so employees and guests do not have to see the same hub
links.

That gives you a clean split of responsibilities on the page:

- the sponsor web part answers **who can help me**
- the Quick Links areas answer **where should I go next**
- the account links answer **what can I fix myself**

The screenshot below shows one possible composition: a shared guest landing page with
tenant-pinned Quick Links near the top and the sponsor area further down the
page.

<img src="{{ '/assets/images/entrance-landingpage-example.jpg' | relative_url }}" alt="Landing page example screenshot.">

## Make The Page Easy To Return To

Guests benefit from a page they can find again without friction.

- If the landing page eventually lives at the tenant root site (`/`), the URL
  is often easy enough to remember on its own.
- If that is not possible, consider a memorable short URL or shortlink that
  resolves to the landing page.
- Add a visible call to action near the top of the page asking guests to
  bookmark the page after their first successful sign-in.
- Keep mentioning the page in invitation and onboarding emails, but do not
  assume guests will keep those emails forever or want to search for them
  later.

Because browsers do not offer one universal "add bookmark" link that works
cleanly everywhere, this is usually best as a simple instruction or callout,
not as a special scripted button.

## Area 1 — Microsoft 365

This area gives guests stable entry points into the resource tenant. Where a
Microsoft URL supports `tenantId`, include it. For SharePoint, the tenant
hostname itself already fixes the tenant context.

For Microsoft Entra B2B guest onboarding, that matters more than it sounds.
Guests often know they were invited, but not which tenant-specific destination
is supposed to become their reliable starting point.

### Microsoft Teams

Use a tenant-pinned Teams entry link when you want Teams to open in the correct
resource tenant instead of whichever tenant happened to be active before.

```text
https://teams.cloud.microsoft/?tenantId=<tenant-id>
```

This is useful because it does not assume that the guest already knows how to
switch tenant context manually. It also avoids sending the guest into a team-
specific deep link before you know that team membership already exists.

### Microsoft SharePoint

Link to a tenant-owned overview page, another hub site, or a site directory
that helps guests find shared workspaces and storage locations even without
navigating through Teams first.

```text
https://<tenant-name>.sharepoint.com/teams/overview
```

In some tenants this is a hub site. In others it is a manually curated overview
page. Either is fine. The important part is that the URL is already tenant-
fixed because it uses your SharePoint hostname. It can also help guests find
Team-connected storage areas or plain team sites that are not "teamified".

### Viva Engage

If your tenant uses Viva Engage as a broader community layer, it can be a
useful parallel entry point beside Teams and SharePoint.

```text
https://engage.cloud.microsoft/main/org/<tenant-domain>/
```

This works best when the guest actually has access to relevant communities. If
not, keep it audience-targeted or omit it.

### More Apps

A tenant-pinned My Applications link is useful as a fallback, but on the
landing page it usually works better as a secondary action than as the primary
entry point.

```text
https://myapplications.microsoft.com/?tenantId=<tenant-id>
```

A nice pattern is to render this as its own small Quick Links web part without
a visible section title, so it looks like an extra utility link rather than the
main path.

## Area 2 — My Guest Account

This area focuses on self-service. It helps guests manage their account inside
the correct resource tenant without first figuring out tenant switching on
their own.

On a well-designed SharePoint guest landing page, these links complement the
sponsor area instead of competing with it. The sponsor relationship tells the
guest who is responsible for their access. Some tools call that same role the
owner; here we use Microsoft's term, sponsor. The self-service links help them
solve the issues that do not need a human reply.

### Guest Account

Link directly to the guest's account view in the correct tenant.

```text
https://myaccount.microsoft.com/?tenantId=<tenant-id>
```

This is useful when the guest needs to review account context, organization
information, or account-related prompts in the resource tenant.

### Security Info

This can be a helpful link when the guest needs to review or register
authentication methods in the resource tenant.

```text
https://mysignins.microsoft.com/security-info?tenantId=<tenant-id>
```

Treat this as a practical deep-link pattern and re-test it periodically.

### Terms of Use

If your tenant uses Terms of Use, a direct link can make prior acceptances
easier to revisit.

```text
https://myaccount.microsoft.com/termsofuse/myacceptances?tenantId=<tenant-id>
```

Treat this as a practical deep-link pattern and re-test it periodically.

### Delete Guest Access

Microsoft documents leaving an organization through the My Account portal's
Organizations area. If you want your landing page to expose that exit path
more directly, use a tenant-qualified leave deep link instead of only linking
to the generic account homepage.

```text
https://myaccount.microsoft.com/organizations/leave/<tenant-id>?tenant=<tenant-id>
```

This aims at the same leave flow more directly. Treat it as a practical
deep-link pattern and re-test it periodically. If it ever stops working in
your tenant, fall back to the tenant-pinned My Account entry and navigate to
**Organizations** -> **Leave** manually.

You may want to label this link more explicitly on the page, for example as
**Delete Guest Access**, **Remove my guest access**, or **Leave this
organization**.

## Link Rules Of Thumb

Some of the examples on this page are true deep links. Others are simply
tenant-pinned URLs that are useful as stable starting points. The same review
logic still applies to both.

- Use `tenantId` wherever the target service supports it.
- For SharePoint, use a tenant-owned URL instead of a generic Microsoft 365
  home page.
- Prefer overview pages and navigation hubs over links that only work after
  team membership exists.
- Test every important link while signed into a home tenant and at least one
  additional guest tenant.
- Re-test these links periodically. The Teams patterns are documented, but some
  account-portal URLs are practical deep-link patterns that Microsoft can
  change over time.

## A Simple Audience-Targeting Model

On the same landing page, guests and employees do not need to see the same
surrounding content.

- Show guests sponsor help, tenant-pinned app links, security-info self-
  service, and optional guest policy links.
- Show employees internal navigation, internal IT support, HR resources, and
  internal-only collaboration destinations.
- Keep the Guest Sponsor Info web part where it adds value, but use Quick Links
  around it to make the whole page feel intentional.

<div class="doc-cta-box">
  <div>
    <p class="doc-cta-title">Use the landing page as a whole system</p>
    <p class="doc-cta-sub">Sponsor visibility, guest self-service, and tenant-pinned entry links work best together.</p>
  </div>
  <div class="doc-cta-actions">
    <a href="{{ '/en/sponsor-vs-inviter/' | relative_url }}" class="btn btn-outline">Sponsor vs Inviter</a>
    <a href="{{ '/en/setup/' | relative_url }}" class="btn btn-teal">Setup Guide</a>
  </div>
</div>

## Related Microsoft Guidance

- [Use the Quick Links web part](https://support.microsoft.com/office/use-the-quick-links-web-part-e1df7561-209d-4362-96d4-469f85ab2a82)
- [Deep links in Microsoft Teams](https://learn.microsoft.com/microsoftteams/platform/concepts/build-and-test/deep-link-teams)
- [Planning your SharePoint hub sites](https://learn.microsoft.com/sharepoint/planning-hub-sites)
