# Roadmap

The next steps for the site, in the order that makes them easiest. Each step says what has to be decided, what the
owner has to do (accounts, payments, legal), and what can be built in the code.

| Order | Step | Who | Depends on |
| --- | --- | --- | --- |
| 1 | Buy the domain and move its DNS to Cloudflare | Owner, then a small code change | The name |
| 2 | Danish as a second language: built, the texts to be reviewed | A Danish-speaking reviewer | Nothing |
| 3 | Decide the project's legal home: you personally, or a small association | Owner | Nothing |
| 4 | Shared login for teams and clubs (a backend) | Code, plus a privacy policy | Steps 1 and 3 |
| 5 | Donations, legally, with the tax rules | Owner, with advice | Step 3 |

None of this is legal or tax advice. Check the official sources linked below, or ask an accountant, before acting on
steps 3 to 5.

## 1. The domain, on Cloudflare

**Decide** the name and the ending. `.dk` suits Danish clubs best; `.com` or `.app` are alternatives.

**Where to buy it:**

- `.dk` domains are registered through a registrar approved by [Punktum dk](https://punktum.dk), the .dk registry.
  Cloudflare's own registrar does not appear to offer `.dk` (check its [TLD list](https://www.cloudflare.com/tld-policies)).
  So buy it at a Danish registrar and move only the **DNS** to Cloudflare: add the domain to a free Cloudflare account
  and change its nameservers to Cloudflare's at the registrar. The registration itself stays where it is.
- Other endings (`.com`, `.app`, …) can be bought directly at [Cloudflare Registrar](https://www.cloudflare.com/products/registrar/),
  so there is nothing to transfer. A domain bought elsewhere can only move to Cloudflare after 60 days and with its
  authorisation code ([transfer rules](https://developers.cloudflare.com/registrar/domain-transfers)).

**Connect it to the site** (GitHub Pages, [custom domains](https://docs.github.com/en/pages/configuring-a-custom-domain-for-your-github-pages-site)):

1. In Cloudflare DNS: `www` as a CNAME to `fbbrbn.github.io`, and the bare domain to GitHub's A records.
2. In GitHub, verify the domain (account settings → Pages), so nobody else can claim it.
3. In the repository's Settings → Pages, enter the custom domain and turn on "Enforce HTTPS".
4. In Cloudflare, set SSL/TLS to "Full".

**Code:** nothing has to change, because every link is relative and the router uses `#/`. Afterwards, update the
README link and the importer's contact URL (`USER_AGENT` in `scraper/import.ts` and `scraper/history.ts`).

**Cost:** a yearly fee for the domain. Cloudflare's free plan, GitHub Pages and the scheduled jobs are free for a
public repository.

## 2. Danish as a second language

**Status:** built (November 2026). Every page is in Danish or English. What is left is step 3 below: a review of the
Danish texts by a Danish-speaking club member. They are all in one file, [`src/i18n/da.tsx`](../src/i18n/da.tsx), next
to the English ones in [`src/i18n/en.tsx`](../src/i18n/en.tsx).

**Goal:** every page in Danish or English. The phone's language decides by default, a switch in the footer changes
it, and the choice is remembered on the device.

**How:**

- A small translation module with an English and a Danish text for every label, sentence and explanation. That
  includes the insights and the "How is this worked out?" texts, with Danish plural forms.
- Dates and numbers in the chosen language (`da-DK`: "ons. 4. nov.", decimal commas).
- The usual Danish terms where players expect them: holdkamp, pulje, række, single, double, sæt, rating.
- The documentation stays in English.

**Steps:**

1. Move every text into the dictionary. Done.
2. Draft the Danish texts. Done.
3. Have them reviewed by a Danish-speaking club member. To do.
4. Check every page at 390 px, since Danish words are often longer. Done: no page scrolls sideways in either language.

## 3. The project's legal home

Logins (step 4) and money (step 5) both need someone responsible. There are two realistic choices:

- **You personally.** This is simplest to start. You are the data controller for logins, and any donations are your
  personal income.
- **A small association (forening).** It needs statutes (vedtægter), a board and a yearly general meeting; a CVR number
  is free. The association can own the domain, be the data controller, keep the accounts and receive membership fees.
  This separates the project from your private finances, and makes it easier for others to help run it.

## 4. Shared login for teams and clubs

**Goal:** a team's lineup planner shared by its players. Each player answers *I can*, *Maybe* or *I can't* on their own
phone, the captain sees every answer and plans, and changes appear for everyone.

**Login model:** not one shared password per club, because it cannot be withdrawn from a player who leaves. Instead:

- Personal sign-in with a link sent by email, so there are no passwords to forget.
- The captain invites players with a link per team. Roles: captain and player, with a club admin later.

**Backend:** the site stays static on GitHub Pages; a small API stores the shared plans.

- **Recommended: Cloudflare Workers with a D1 database**, once the domain is on Cloudflare (step 1). The free tier
  covers a project this size, and data can be kept in the EU.
- **Alternative: Supabase** (Postgres, built-in sign-in and row-level security, EU region), the fastest to build.

**Privacy (GDPR):** emails and availability are personal data.

- A privacy policy page, and a data processing agreement with the provider.
- Data stored in the EU, only what is needed, and deleted on request.
- In Denmark, children can consent to online services themselves from age 13. For younger junior players, the
  captain or a parent answers for them.

**Steps:**

1. Decide the data controller (step 3).
2. Design the data model and API.
3. Build sign-in and team invites.
4. Share availability in the planner.
5. Add the privacy policy.
6. Test with Vallensbæk BTK 3, then open it to every team.

## 5. Donations, and the tax rules

The site costs little to run: only the domain, after step 1. Donations are optional, and in Denmark they come with
rules:

- **Asking the public for donations is an "indsamling"** under the Fundraising Act (indsamlingsloven). It has to be
  reported to the Indsamlingsnævnet before it starts. The accounts have to be published (on the website, if there is
  one), and audited if more than 50,000 kr is collected. Organisations approved for tax-deductible gifts are exempt
  from reporting each collection. See [Civilstyrelsen](https://civilstyrelsen.dk) and the act on
  [retsinformation.dk](https://www.retsinformation.dk/eli/lta/2014/511).
- **Gifts to a private person from anyone other than close family are taxable income** for the recipient (statsskatteloven
  § 4; see SKAT's [legal guidance](https://tax.dk/jv/ac/A_C_2_1_2_2_3.htm)). Donations you receive personally go on your
  tax return.
- **Selling something instead** (for example supporter memberships or sponsor space) is business income. That means a
  CVR number, and VAT (moms) registration once sales are expected to pass 50,000 kr; the measuring period changed in
  2025, so check [skat.dk](https://skat.dk). See also
  [when to register for VAT](https://www.bdo.dk/da-dk/faglig-info/depechen/depechen-artikler-2023/ivarksatter-hvornar-skal-du-momsregistreres).

**Options:**

| Option | Simple? | What it needs |
| --- | --- | --- |
| No donations; you pay the domain | Yes | Nothing |
| Donations to you (MobilePay, GitHub Sponsors) | Fairly | Probably reporting the collection, and declaring the money as income |
| An association with paying members | Some work | Statutes, board, accounts; membership fees are not a public collection |
| Sponsors or paid extras | Some work | CVR, invoices, VAT above the limit |

**Recommendation:** no donations for now, while the costs are only the domain. When the shared login comes (step 4),
decide on an association. Then ask the Indsamlingsnævnet and SKAT how donations to it would be treated before adding a
"Support the site" button.

## Also planned (code)

- **Use the earlier seasons for predictions:** a team's first matches of a season currently have no prediction, and
  last season's lineups can fill that gap. Calibrate the model on all the past seasons too.
- **Head-to-head records** between two players across all seasons, on the match preview.
