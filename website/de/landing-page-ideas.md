---
layout: doc
lang: de
title: Landingpage-Ideen
permalink: /de/landing-page-ideas/
description: >-
  Zusätzliche Ideen für eine SharePoint-Gast-Landingpage in Microsoft Entra
  B2B — besonders Quick-Links-Bereiche, tenant-fixierte
  Microsoft-365-Deeplinks und unterstützende Links rund um
  Sponsor-Sichtbarkeit.
lead: >-
  Ein kleines optionales Extra für Administratoren, die ihre
  SharePoint-Gast-Landingpage für Microsoft-Entra-B2B-Gäste-Onboarding
  hilfreicher machen wollen. Diese Ideen ergänzen das Guest Sponsor Info Web
  Part; sie sind keine Voraussetzung für das Produkt.
---

## Warum Diese Seite Existiert

Diese Seite ist bewusst klein gehalten. Sie soll keinen vollständigen Blueprint
für eine Landingpage vorgeben, sondern einige bewährte Ideen dafür zeigen, was
eine gemeinsame Landingpage für Gäste zusätzlich zum Sponsor-Web-Part noch
enthalten kann.

Wichtig ist die Rollenverteilung: **Guest Sponsor Info löst die Sponsor-
Sichtbarkeit**. Die umgebenden Landingpage-Elemente lösen Orientierung,
SharePoint-Gastzugriff, Microsoft-365-Einstiegspunkte und Self-Service. Erst
zusammen wird aus einer generischen Ankunftsseite ein sinnvoller Einstieg für
B2B-Gäste.

Wenn Sie das SharePoint-**Quick-Links**-Web-Part verwenden, lässt sich vieles
davon schon ohne eigene Entwicklung umsetzen. Mit aktiviertem Audience
Targeting kann dieselbe Landingpage unterschiedliche Links für Mitarbeitende
und Gäste anzeigen.

Die Beispiele unten verwenden Platzhalter wie `<tenant-id>`, `<tenant-name>`
und `<tenant-domain>`. Ersetzen Sie diese durch Ihre eigenen Werte.

## Ein Gutes Standardmuster

Für viele Microsoft-Entra-B2B-Tenants reichen bereits zwei
Quick-Links-Web-Parts für eine praxistaugliche SharePoint-Gast-Landingpage:

- Ein Bereich für **Microsoft 365**-Einstiegspunkte im richtigen Tenant.
- Ein Bereich für **Mein Gastkonto**-Self-Service-Aktionen.
- Optional ein kleines separates Quick-Links-Web-Part für **Weitere Apps**,
  damit dieser Link wie eine Nebenfunktion wirkt und nicht wie das Hauptziel.

Das funktioniert besonders gut, wenn auch die Landingpage selbst Audience
Targeting verwendet. Mitarbeitende sehen interne Ressourcen, während Gäste nur
die Links sehen, die ihnen im Ressourcen-Tenant tatsächlich helfen.

Unabhängig von diesen ausgehenden Links kann die Landingpage selbst
ebenfalls die Hub Site für den Gastbereich sein. Damit gewinnen Sie eine
gemeinsame Navigationsschicht, Hub-Branding-Optionen und eine klarere
Identität für den gesamten Bereich, auch wenn noch keine weiteren Sites
zugeordnet sind.

Das hilft auch bei der Benennung. So kann die zugrunde liegende Site zum
Beispiel weiterhin einen freundlichen Titel wie `Welcome @ Contoso` tragen,
während die Hub-Identität und die Hub-Navigation den größeren Bereich als
`Entrance Area` sichtbar machen.

Wenn später weitere Sites hinzukommen, wird diese Hub Site noch nützlicher.
Sie können Links zu zugeordneten oder nicht zugeordneten Sites in der Hub-
Navigation ergänzen und Audience Targeting nutzen, damit Mitarbeitende und
Gäste nicht dieselben Hub-Links sehen müssen.

So entsteht auf der Seite eine klare Aufgabenverteilung:

- das Sponsor-Web-Part beantwortet **wer hilft mir**
- die Quick-Links-Bereiche beantworten **wo gehe ich als Nächstes hin**
- die Konto-Links beantworten **was kann ich selbst lösen**

Der folgende Screenshot zeigt eine mögliche Komposition: eine gemeinsame
Gast-Landingpage mit tenant-fixierten Quick Links weit oben und dem Sponsor-
Bereich weiter unten auf der Seite.

<img src="{{ '/assets/images/entrance-landingpage-example.jpg' | relative_url }}" alt="Beispiel-Screenshot einer Landingpage.">

## Die Seite Leicht Wiederauffindbar Machen

Gäste profitieren von einer Seite, die sie ohne Reibungsverlust wiederfinden.

- Wenn die Landingpage später auf der Root Site (`/`) liegt, ist die URL oft
  schon für sich genommen leicht merkbar.
- Wenn das nicht möglich ist, kann sich eine gut merkbare Kurz-URL oder ein
  Shortlink auf diese Landingpage lohnen.
- Platzieren Sie weit oben auf der Seite eine sichtbare Call-to-Action, die den
  Gast nach dem ersten erfolgreichen Anmelden dazu auffordert, sich diese Seite
  zu bookmarken.
- Nennen Sie die Seite weiterhin in Einladungs- und Onboarding-Mails, gehen Sie
  aber nicht davon aus, dass Gäste diese E-Mails dauerhaft aufbewahren oder
  später noch einmal danach suchen wollen.

Da Browser keinen einheitlichen "Lesezeichen hinzufügen"-Link anbieten, der
überall sauber funktioniert, ist das meist besser als einfacher Hinweis oder
Callout gelöst und nicht als spezieller Skript-Button.

## Bereich 1 — Microsoft 365

Dieser Bereich gibt Gästen stabile Einstiegspunkte in den Ressourcen-Tenant.
Wo eine Microsoft-URL `tenantId` unterstützt, sollten Sie sie verwenden. Bei
SharePoint legt der Tenant-Hostname den Tenant-Kontext bereits selbst fest.

Gerade im Microsoft-Entra-B2B-Gäste-Onboarding ist das wichtiger, als es erst
einmal klingt. Gäste wissen oft, dass sie eingeladen wurden, aber nicht,
welcher tenant-spezifische Zielort ihr verlässlicher Startpunkt sein soll.

### Microsoft Teams

Verwenden Sie einen tenant-fixierten Teams-Einstiegslink, wenn Teams im
richtigen Ressourcen-Tenant geöffnet werden soll und nicht in dem Tenant, der
zufällig gerade zuvor aktiv war.

```text
https://teams.cloud.microsoft/?tenantId=<tenant-id>
```

Das ist hilfreich, weil es nicht voraussetzt, dass der Gast den Tenant-Wechsel
in Teams bereits manuell beherrscht. Außerdem vermeiden Sie damit Team-
spezifische Deeplinks, solange Sie nicht sicher wissen, dass die Team-
Mitgliedschaft bereits existiert.

### Microsoft SharePoint

Verlinken Sie auf eine tenant-eigene Übersichtsseite, eine andere Hub Site
oder eine Site-Navigation, über die Gäste gemeinsame Arbeitsbereiche und
Speicherorte finden können, ohne zuerst durch Teams navigieren zu müssen.

```text
https://<tenant-name>.sharepoint.com/teams/overview
```

In manchen Tenants ist das eine Hub Site. In anderen ist es einfach eine
kuratierte Übersichtsseite. Beides ist in Ordnung. Entscheidend ist, dass die
URL durch den SharePoint-Hostnamen bereits tenant-fixiert ist. Außerdem hilft
sie dabei, Teams-nahe Speicherorte oder normale Team Sites zu finden, die gar
nicht "teamified" sind.

### Viva Engage

Wenn Ihr Tenant Viva Engage als breitere Community-Ebene nutzt, kann das ein
sinnvoller paralleler Einstiegspunkt neben Teams und SharePoint sein.

```text
https://engage.cloud.microsoft/main/org/<tenant-domain>/
```

Das funktioniert am besten, wenn der Gast dort tatsächlich auf relevante
Communities zugreifen kann. Andernfalls sollten Sie den Link per Audience
Targeting aussteuern oder ganz weglassen.

### Weitere Apps

Ein tenant-fixierter Link zu "My Applications" ist als Fallback nützlich. Auf
der Landingpage funktioniert er aber meist besser als sekundäre Aktion und
nicht als primärer Einstiegspunkt.

```text
https://myapplications.microsoft.com/?tenantId=<tenant-id>
```

Ein gutes Muster ist, diesen Link in einem kleinen separaten Quick-Links-Web-
Part ohne sichtbare Abschnittsüberschrift darzustellen. Dann wirkt er eher wie
ein zusätzlicher Utility-Link als wie der Hauptpfad.

## Bereich 2 — Mein Gastkonto

Dieser Bereich konzentriert sich auf Self-Service. Er hilft Gästen dabei, ihr
Konto direkt im richtigen Ressourcen-Tenant zu verwalten, ohne erst selbst den
Tenant-Wechsel verstehen zu müssen.

Auf einer gut gestalteten SharePoint-Gast-Landingpage ergänzen diese Links den
Sponsor-Bereich, statt mit ihm zu konkurrieren. Die Sponsor-Beziehung zeigt,
wer für den Zugriff zuständig ist. Manche Tools nennen dieselbe Rolle
„Owner“; hier verwenden wir den Microsoft-Begriff Sponsor. Die Self-Service-
Links helfen bei den Themen, die keinen menschlichen Rückruf brauchen.

### Gastkonto

Verlinken Sie direkt auf die Kontenansicht des Gasts im richtigen Tenant.

```text
https://myaccount.microsoft.com/?tenantId=<tenant-id>
```

Das ist hilfreich, wenn der Gast Kontokontext, Organisationsinformationen oder
kontobezogene Hinweise im Ressourcen-Tenant prüfen muss.

### Sicherheitsinformationen

Dieser Link kann hilfreich sein, wenn der Gast Authentifizierungsmethoden im
Ressourcen-Tenant prüfen oder registrieren muss.

```text
https://mysignins.microsoft.com/security-info?tenantId=<tenant-id>
```

Behandeln Sie dies als praktisches Deeplink-Muster und testen Sie es
regelmäßig erneut.

### Nutzungsbedingungen

Wenn Ihr Tenant Terms of Use verwendet, kann ein Direktlink frühere
Akzeptanzen leichter wieder auffindbar machen.

```text
https://myaccount.microsoft.com/termsofuse/myacceptances?tenantId=<tenant-id>
```

Behandeln Sie dies als praktisches Deeplink-Muster und testen Sie es
regelmäßig erneut.

### Gastzugang Löschen

Microsoft dokumentiert das Verlassen einer Organisation über den Bereich
**Organizations** im My-Account-Portal. Wenn Ihre Landingpage diesen Ausstieg
direkter anbieten soll, verwenden Sie einen tenant-qualifizierten Leave-
Deeplink statt nur auf die allgemeine Kontoseite zu verweisen.

```text
https://myaccount.microsoft.com/organizations/leave/<tenant-id>?tenant=<tenant-id>
```

Das zielt direkter auf denselben Leave-Ablauf. Behandeln Sie dies als
praktisches Deeplink-Muster und testen Sie es regelmäßig erneut. Falls es in
Ihrem Tenant irgendwann nicht mehr funktioniert, nutzen Sie als Fallback den
tenant-fixierten Einstieg in My Account und führen den Gast manuell zu
**Organizations** -> **Leave**.

Auf der Seite selbst können Sie diesen Link auch etwas expliziter benennen,
zum Beispiel als **Gastzugang löschen**, **Meinen Gastzugang entfernen** oder
**Diese Organisation verlassen**.

## Faustregeln Für Links Und Deeplinks

Einige Beispiele auf dieser Seite sind echte Deeplinks. Andere sind einfach
tenant-fixierte URLs, die sich als verlässliche Startpunkte eignen. Dieselbe
Prüflogik gilt trotzdem für beide Arten von Links.

- Verwenden Sie `tenantId` überall dort, wo der Zieldienst es unterstützt.
- Nutzen Sie für SharePoint eine tenant-eigene URL statt einer generischen
  Microsoft-365-Startseite.
- Bevorzugen Sie Übersichtsseiten und Navigationshubs gegenüber Links, die nur
  nach bestehender Team-Mitgliedschaft funktionieren.
- Testen Sie jeden wichtigen Link, während Sie gleichzeitig im Home Tenant und
  mindestens in einem weiteren Gast-Tenant angemeldet sind.
- Prüfen Sie diese Links regelmäßig erneut. Die Teams-Muster sind dokumentiert,
  manche Account-Portal-URLs sind jedoch eher praktische Deeplink-Muster, die
  Microsoft im Lauf der Zeit ändern kann.

## Ein Einfaches Audience-Targeting-Modell

Auf derselben Landingpage müssen Gäste und Mitarbeitende nicht dieselben
Umfeldinhalte sehen.

- Zeigen Sie Gästen Sponsor-Hilfe, tenant-fixierte App-Links,
  Sicherheitsinfo-Self-Service und bei Bedarf Gast-Richtlinien.
- Zeigen Sie Mitarbeitenden interne Navigation, internen IT-Support, HR-
  Ressourcen und interne Kollaborationsziele.
- Lassen Sie das Guest Sponsor Info Web Part dort stehen, wo es Mehrwert
  schafft, und nutzen Sie Quick Links darum herum, damit die gesamte Seite wie
  ein bewusst gestalteter Einstieg wirkt.

<div class="doc-cta-box">
  <div>
    <p class="doc-cta-title">Die Landingpage als Gesamtsystem denken</p>
    <p class="doc-cta-sub">Sponsor-Sichtbarkeit, Gast-Self-Service und
      tenant-fixierte Einstiegspunkte funktionieren zusammen am besten.</p>
  </div>
  <div class="doc-cta-actions">
    <a href="{{ '/de/sponsor-vs-inviter/' | relative_url }}" class="btn btn-outline">Sponsor vs. Einladender</a>
    <a href="{{ '/de/setup/' | relative_url }}" class="btn btn-teal">Setup-Anleitung</a>
  </div>
</div>

## Passende Microsoft-Dokumentation

- [Use the Quick Links web part](https://support.microsoft.com/office/use-the-quick-links-web-part-e1df7561-209d-4362-96d4-469f85ab2a82)
- [Deep links in Microsoft Teams](https://learn.microsoft.com/microsoftteams/platform/concepts/build-and-test/deep-link-teams)
- [Planning your SharePoint hub sites](https://learn.microsoft.com/sharepoint/planning-hub-sites)
