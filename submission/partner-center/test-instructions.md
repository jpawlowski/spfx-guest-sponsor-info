# Test Instructions — Guest Sponsor Info (Microsoft Marketplace / Partner Center)

> **Version these instructions apply to:** 1.2.1\
> **Solution package version:** 1.2.1.0\
> **Last updated:** 2026-05-05

---

## Overview

**Guest Sponsor Info** is a SharePoint Framework web part for SharePoint Online.
It shows the Microsoft Entra B2B sponsors of the signed-in guest user on a
SharePoint landing page.

The live page behavior is intentionally simple:

- Guest users see their sponsor cards.
- Internal users see nothing in view mode while public demo mode is off.
- Page authors see a live preview with mock sponsor cards in edit mode.

---

## Setup

Please use the supplied environment and accounts exactly as listed below.
Use the existing guest user, site home page, and web part instance.
Before starting, close all existing InPrivate / Incognito windows so the test
begins with a clean sign-in session.

---

## Supplied Environment

- Host tenant: `[HOST-TENANT].onmicrosoft.com`
- Guest home tenant: `[GUEST-HOME-TENANT].onmicrosoft.com`
- SharePoint site: `https://[HOST-TENANT].sharepoint.com/sites/[SITE-NAME]`
- Solution package: already deployed
- Web part instance: already added to the page and pre-configured
- Companion Azure Function: already configured and reachable

Guest sign-in:

- Open
   `https://[HOST-TENANT].sharepoint.com/sites/[SITE-NAME]`.
- At the Microsoft sign-in page, sign in with the **guest user's home-tenant
   account** listed in the next section.
- Inside the host tenant, SharePoint resolves this user to the invited guest
  object, which is the account that carries the Entra `#EXT#` guest marker.

---

## Test Accounts

### 1. Internal Editor (Host Tenant Member)

- UPN: `[INTERNAL-EDITOR-UPN]`
- Password: `[INTERNAL-EDITOR-PASSWORD]`
- Use for: edit mode preview, property pane checks, public demo mode check

### 2. External Guest (Home-Tenant Account)

- UPN: `[EXTERNAL-GUEST-UPN]`
- Password: `[EXTERNAL-GUEST-PASSWORD]`
- Use for: end-to-end guest validation

---

## Expected Data On The Supplied Site

Expected data in the supplied environment:

- The external guest is already invited into the host tenant.
- The external guest already has at least **2 active sponsors** assigned in
   Microsoft Entra.
- At least one sponsor has a real profile photo.
- At least one sponsor has **no** profile photo so the initials fallback can be
   observed.
- Public demo mode is **off** on the live page before testing starts.
- The pre-configured page shows the normal feature set unless noted otherwise in
   the submission notes:
   presence status, sponsor photo, manager section, business phone, work
   location, and map link.

If an inline Azure Maps preview is visible, it should load successfully.
If no Azure Maps key was configured for the supplied site, only the external map
link is expected.

---

## Review Steps

Run the checks in this order.

### 1. Real Guest Experience

1. Close all existing InPrivate / Incognito windows.
2. Open a new InPrivate / Incognito window.
3. Navigate to
   `https://[HOST-TENANT].sharepoint.com/sites/[SITE-NAME]`.
4. At the Microsoft sign-in page, sign in with the **External Guest** account
   listed above.

Expected result:

- The page loads without any additional setup.
- No configuration dialog appears on the live page.
- The web part renders sponsor cards for the signed-in guest.
- At least two sponsor cards are visible.
- One sponsor should show a real photo.
- One sponsor should fall back to initials because no profile photo is present.
- Sponsor name and job title are visible.
- The layout may appear as full or compact depending on available page width.
   Either is acceptable.

1. Open the first sponsor card by hovering over it or by tabbing to it.

Expected result:

- A contact surface opens for that sponsor.
- Email is shown together with a copy button.
- If configured on the supplied site, business phone, work location, address or
   map link, manager information, and presence are visible.

1. Click the copy button next to the email address.

Expected result:

- Temporary copied feedback appears.

1. Click **Chat**.

Expected result:

- Microsoft Teams desktop or Teams on the web opens, or the browser offers the
   Teams deep link according to local system settings.

1. If a map link is visible, click it.

Expected result:

- The selected map provider opens in the browser or operating-system map app.

### 2. Non-Guest View Mode

1. Close all existing InPrivate / Incognito windows.
2. Open a new InPrivate / Incognito window.
3. Navigate to
   `https://[HOST-TENANT].sharepoint.com/sites/[SITE-NAME]`.
4. At the Microsoft sign-in page, sign in with the **Internal Editor** account.
5. Make sure the page is in normal **view mode**.

Expected result:

- Because public demo mode is off, the web part does **not** render for this
   internal user.
- No sponsor cards, placeholder, or error message are shown.

### 3. Edit Mode Preview And Property Pane

This is a short check.

1. Stay signed in as the **Internal Editor** account.
2. Open the page in **Edit** mode.

Expected result:

- The web part immediately shows a **live preview with mock sponsor cards**.
- This is the current intended authoring experience.
- The preview is available even though the signed-in user is not a guest.

1. Select the web part and open its property pane.

Expected result:

- The property pane opens successfully.
- It contains, at minimum, these groups:
   **Settings**, **Sponsor Eligibility**, **Guest Notifications**,
   **Display**, **Contact**, **Organization**, and **Guest Sponsor API**.

1. Verify one representative change in each core area below.

**Settings**

- Change **Visible sponsors** from `2` to `1` and back.
- Expected result: the preview updates to show the new number of visible cards.

- Change **Simulate guest notification** to **No sponsors found**.
- Expected result: the preview shows the corresponding informational banner.

- Change **Simulate guest notification** to **Sponsor not available** or
   **Update available**.
- Expected result: the preview banner changes accordingly.

**Display**

- Change **Card layout** from **Automatic** to **Compact** and back.
- Expected result: the preview layout changes immediately.

- Toggle **Show presence status** off and on.
- Expected result: the presence indicator disappears and reappears.

**Contact**

- Toggle **Show business phone numbers** off and on.
- Expected result: the phone field disappears and reappears in the preview.

- Toggle **Show work location** off and on.
- Expected result: the work location field disappears and reappears.

**Organization**

- Toggle **Show manager** off and on.
- Expected result: the manager section disappears and reappears.

---

## Public Demo Mode Check

1. Stay signed in as the **Internal Editor** account.
2. In edit mode, open the property pane.
3. Under **Settings**, enable **Enable public demo mode for internal users**.
4. Save or publish the page and return to view mode.

Expected result:

- The internal host-tenant user now sees simulated sponsor cards on the live
   page.
- This validates the public demo mode behavior for internal users.

1. Turn public demo mode off again after the check.

---

## New Web Part Instance Check

1. Stay signed in as the **Internal Editor** account.
2. Create a new modern SharePoint page in
   `https://[HOST-TENANT].sharepoint.com/sites/[SITE-NAME]`.
3. Add the already deployed **Guest Sponsor Info** web part to that new page.
4. In the setup wizard, choose **Explore in Demo Mode**.
5. Complete the wizard and save the page.

Expected result:

- The web part can be added to the page.
- A newly added instance opens its first-run setup experience in edit mode.
- The wizard accepts the demo mode selection and completes successfully.
- The saved page shows simulated sponsor cards in view mode.

---

## Support Contact

Workoho GmbH · [support@workoho.com](mailto:support@workoho.com)\
GitHub: <https://github.com/workoho/spfx-guest-sponsor-info/issues>
