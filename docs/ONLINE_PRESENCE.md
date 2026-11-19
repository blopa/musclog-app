# Online presence research

A feedback loop for getting more people to find Musclog: collect what Google says about the website and
the Play listing, find what is worth changing, change it, and look again later to see whether it worked.
The loop is a command-line tool (`scripts/presence.js`) plus the `musclog-online-presence-research` skill
(`.claude/skills/musclog-online-presence-research/`) that reads its output and proposes changes.

Everything here is **read-only**: it never changes Search Console, Analytics or Play. App Store is out of
scope for now.

## Sources

| Source             | What it gives                                                                                         | How                                                                               |
| ------------------ | ----------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| Search Console     | queries, pages, countries, devices, positions, CTR, sitemap status, URL inspection                    | REST API, service account (`scripts/presence/searchConsole.js`)                   |
| Google Analytics 4 | landing pages, traffic sources and campaigns, store-button clicks, demo starts                        | Data + Admin API, same key (`scripts/presence/analytics.js`)                      |
| Google Play        | reviews, release health, and (with a bucket id) store-listing visitors and installs by country/source | the `gplay` CLI and profile of `docs/GOOGLE_PLAY.md` (`scripts/presence/play.js`) |
| Offline site audit | title/description lengths, locale coverage, sitemap gaps, blog frontmatter and body checks            | reads the repo (`scripts/presence/siteAudit.js`)                                  |

**GA4 undercounts on purpose.** The site sends analytics only after the visitor accepts the consent banner
(`utils/websiteAnalytics.web.ts`), so GA4 numbers describe the _shape_ of traffic (which pages lead to a
store click) and never the visitor total. Search Console does not depend on consent: use it for volume.
Play's Reviews API returns only the last week, so every run merges what it gets into
`.presence/play-reviews.json`. The Play Developer API has no search-term report.

## Setup (one time, about 15 minutes)

The tool authenticates as a Google service account, with read-only scopes. It can reuse the Play publishing
key (`~/keys/musclog-play-service-account.json`) or have its own at
`~/keys/musclog-presence-service-account.json` (`MUSCLOG_PRESENCE_KEY` overrides both). Never commit a key.

1. **Enable the APIs** in the service account's Google Cloud project (`npm run presence:check` prints the
   exact activation link for each one that is off): _Google Search Console API_, _Google Analytics Data API_,
   _Google Analytics Admin API_, and optionally _Google Play Developer Reporting API_ (crash and ANR rates).
2. **Search Console**: verify `musclog.app` (a Domain property, `sc-domain:musclog.app`, is best), submit
   `https://musclog.app/sitemap.xml`, then Settings → Users and permissions → add the service account's
   email (`presence:check` prints it) as a **Restricted** user.
3. **Google Analytics**: Admin → Property access management → add the same email as **Viewer**. The numeric
   property id is found by matching the site's measurement id (`G-176QWPGYFM`); set
   `MUSCLOG_GA4_PROPERTY` only if discovery fails.
4. **Play statistics (optional)**: Play Console → Download reports → Statistics → Copy Cloud Storage URI,
   and put the bucket id in `.presence/config.json` as `playStatsBucket` (or `MUSCLOG_PLAY_STATS_BUCKET`).
   The service account needs "View app information and download bulk reports" for Musclog.

`.presence/config.json` (git-ignored) may also hold `gscSite`, `ga4Property` and `playProfile`; the matching
`MUSCLOG_GSC_SITE`, `MUSCLOG_GA4_PROPERTY` and `GPLAY_PROFILE` variables win.

## Commands

```
npm run presence:check       # what works, and the exact fix for what does not
npm run presence:snapshot    # collect everything (--days 28, --only gsc,ga4,play,audit)
npm run presence:report      # print the latest digest (--json, --snapshot DIR)
npm run presence -- inspect /tools/one-rep-max   # Google's own index verdict for a URL
npm run presence -- ledger   # change-ledger entries whose review date has passed
```

A snapshot is written to `.presence/snapshots/<date>/` (git-ignored: it holds real search queries):
`snapshot.json` (raw rows), `digest.json` and `report.md` (ranked, what the skill reads). One failing
source never loses the others; its error is listed at the top of the report. The window is 28 days ending
three days ago (Search Console lags), compared with the 28 days before it.

## What the digest flags (and how much to trust it)

Thresholds live in `scripts/presence/analysis.js`; they decide what is worth _looking at_, not what to change.

- **Page one, not winning the click**: position ≤ 10 with CTR under half of a typical curve → the title or
  description is the lever.
- **Striking distance**: positions 8–20 → content depth, internal links, a closer match to the query.
- **Cannibalisation**: two of our pages split one query → merge, or differentiate and link them.
- **Questions people ask**: queries phrased as questions, in the five app languages → post and tool ideas.
- **Movers**, **sitemap URLs with no impressions**, **countries and devices**, **weak landing pages** and
  **store clicks per page** (GA4), **reviews** and **store-listing conversion** (Play).
- **Site audit**: lengths, missing translations, missing sitemap entries, thin or unlinked posts.

Small numbers lie. Below roughly 50 impressions a query is noise; a ranking change inside one window can be
seasonality. The skill treats the digest as leads and reads the page before proposing an edit.

## The loop

1. `presence:snapshot`, read `report.md`.
2. Review every entry the report lists under "Changes due for review": did the target move?
3. Pick a few changes with evidence; change one thing per page at a time so the effect can be attributed.
4. Make the change under the repo's normal rules (website conventions in `AGENTS.md`, honest copy, all
   locales, tests) and add a row to the ledger below with a review date about five weeks out (one 28-day
   window plus the three-day lag).
5. Repeat on the review date.

Play listing changes follow `docs/GOOGLE_PLAY.md` (all ten locales, no competitor names, no "free" in the
title or short description) and are published only when the owner asks.

## Change ledger

Date = when it shipped. Target = a site path (`/tools/one-rep-max`) or a query in backticks. Evidence = the
numbers that justified it (window and values), so the review compares like with like. Review on = an ISO
day; `presence:report` lists the row from then on, with the target's current numbers beside it.

| Date       | Change | Target | Evidence | Review on |
| ---------- | ------ | ------ | -------- | --------- |
| _none yet_ |        |        |          |           |
