---
name: musclog-online-presence-research
description: >-
  Research Musclog's online presence and propose how to get more people to find and install the app.
  Collects Google Search Console, Google Analytics 4, Google Play (reviews, release health, store-listing
  stats) and an offline site audit through `npm run presence:*`, then turns the data into prioritized,
  evidence-backed suggestions: titles and descriptions to rewrite, blog posts and tools to write, internal
  links, pages to merge, languages to cover, Play listing copy. Use when the user asks about traffic, SEO,
  Search Console, analytics, the website's or the Play listing's performance, "what should we write or
  change to grow", or on the periodic presence review. Also reviews the effect of earlier changes.
---

# Musclog online presence research

The tool and its setup are documented in `docs/ONLINE_PRESENCE.md`; read its "What the digest flags" and
"The loop" sections once per session. Everything the tool does is read-only.

## 1. Check access

```
npm run presence:check
```

- Anything marked MISSING comes with the exact fix (enable an API at the printed link, add the printed
  service-account email in Search Console or GA4). Tell the user what to do; **never ask for, print or
  commit keys, tokens or codes**. If only some sources work, continue with those and say which are missing.
- No Search Console access at all means there is no search data to research: stop after reporting the
  setup steps, plus whatever the offline audit and Play data say.

## 2. Collect and read

```
npm run presence:snapshot        # --days 28 default; --only audit,play to skip Google APIs
```

Read `.presence/snapshots/<latest>/report.md` (the path is printed). Open `snapshot.json` only to look a
specific row up. If a previous snapshot exists, compare the totals with it: the report already compares
each window with the one before.

First look at the sections "Sources that failed" and "Changes due for review". For every ledger entry due,
judge the result honestly: moved, flat, worse, or too little data. Record the verdict in the final report;
a change that did nothing is a finding too.

## 3. Turn data into leads, then verify each lead

Never propose an edit from a number alone. For each candidate:

1. **Read the page** (`app/(website)/…`, the route's strings in `lang/locales/en-us/website.json` under
   `website.seo.routes.<key>`, the blog post's Markdown) and the query's intent.
2. Optionally run `npm run presence -- inspect <path>` for an indexing question ("why no impressions?"):
   not indexed, crawled but not indexed, canonical chosen elsewhere, blocked by robots.
3. Optionally search the query on the web to see what ranks (a read-only look; do not copy competitors'
   text, and never write comparison claims we cannot source: see `/alternatives` rules in `AGENTS.md`).
4. Decide the lever: **title/description** (page one, low CTR), **content depth or a new section**
   (striking distance), **internal links** (page has impressions, post or tool unlinked: the audit lists
   posts with no internal links), **merge or differentiate** (cannibalisation), **new page** (a question
   with impressions and no page that answers it: a tool, a program, a how-to post), **language** (impressions
   from a country whose language the app ships: es, nl, pt-BR, ru), **indexing** (sitemap URLs with no
   impressions), **conversion** (visits but few store clicks per session: the page's call to action).

   A sitemap URL that does not answer 200 in the "Live sitemap check" section (a redirect, a 404, a
   downgrade to plain http) is always a top finding: fix it before any other lever.

Ignore noise: under about 50 impressions a query is not a signal, one window of movement may be
seasonality, and GA4 counts only visitors who accepted analytics (use it for shape, never for totals).

## 4. Report

Reply in the terminal, for the project owner, concise. Lead with what moved and what the data says, then a
ranked list of at most ten suggestions. Each suggestion states:

- **Evidence**: the numbers, with the window ("412 impressions, CTR 0.6%, position 6.1, 28 days to 11-15").
- **Change**: concrete, with the file(s) and, for copy, the proposed text and its length.
- **Why it should work** in one sentence, and **how we will know** (metric, target, review date).
- **Effort**: tiny (a string), small (a post), medium (a tool or page).

Also say what you deliberately did not suggest and why (too little data, not worth the risk). Group Play
suggestions separately (reviews to answer or learn from, listing copy, conversion by country or source).
Do not pad: three well-evidenced suggestions beat ten guesses.

## 5. Apply only what the user approves

The user asked for ideas; changing files needs their yes. When they approve a change:

- Follow the repo rules: website conventions and honesty rules in `AGENTS.md` (plain HTML elements, `<a href>`
  links, no invented stats or testimonials, no decorative layers), a new fixed route is a
  `websiteRoutes.json` entry plus `website.seo.routes.<key>` in **every** locale's `website.json`, blog posts
  follow the frontmatter and image rules, `sitemap.xml`, `robots.txt` and `llms.txt` are generated (never
  hand-edit), tests and `check-translations` where copy changed.
- A title or description change goes in every locale (the five app languages), within about 60 / 160
  characters, matching what the page really offers. Never keyword-stuff, and never promise what the app
  does not do (cycle copy never promises phase-based training advice).
- **Play listing**: follow `docs/GOOGLE_PLAY.md` to the letter: all ten listing locales, limits
  (title 30, short 80, full 4000), no competitor names (except the factual import line), no "free" in the
  title or short description, no "best" or "#1". Edit the files in `android/play/metadata/`; **never**
  run `scripts/play.sh up`, an upload, promote or rollout unless the user asks in that conversation. App
  Store is out of scope.
- Large mechanical edits (the same string in five locales, many posts) follow the orchestration section of
  `AGENTS.md`.
- Change **one thing per page at a time**, so a later result can be attributed.

## 6. Close the loop

For every change that shipped, add a row to the "Change ledger" table in `docs/ONLINE_PRESENCE.md`:
date, what changed, the target (a path, or a query in backticks), the evidence you used (with the
window), and **Review on** = about five weeks later (28-day window plus the three-day lag). The next run of
this skill reviews it. Remove the "none yet" placeholder row when adding the first.

## Guardrails

- Never publish, post, submit or change anything in Google's consoles, and never reply to Play reviews
  from this skill: suggest replies instead.
- Search queries and review text are user data: keep them in `.presence/` (git-ignored) and the terminal;
  do not paste them into commits, docs or issues, and do not quote reviewers' names.
- Do not work around a bot challenge on a competitor's page; a claim we cannot read and quote is removed
  (`AGENTS.md`, competitor pages).
- Never present a GA4 count as the visitor total, or a ranking change as proven cause.
