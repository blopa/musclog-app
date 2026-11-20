---
title: 'I put the language in the URL, then spent two days on the URLs that have none'
date: '2026-11-20'
category: 'engineering'
description: 'Musclog translated its website into five languages and Google indexed one of them. This is how every page moved under /en, /es, /nl, /pt-br and /ru, why hreflang needs one function, why a layout broke every Spanish title, and why a redirect page was the wrong answer for a static site.'
tags: ['Musclog', 'SEO', 'i18n', 'hreflang', 'Expo Router', 'Static export', 'GitHub Pages', 'Web']
---

Musclog's website was translated into five languages for months. Search Console's verdict, when I finally looked: Google had indexed one of them.

That is not Google being lazy. I had built a site where `/tools/protein-calculator` was in English, and also in Spanish, and also in Dutch, depending on a value in your browser's `localStorage`. To a crawler that carries no `localStorage` and no opinions, that is one page in English with an identity crisis. The Spanish version did not exist at any address Google could ask for.

So I moved every public page under a language prefix. Then I found out that was the easy part.

## The bug is in the architecture

The old setup was the usual one for a React app. The URL says what page you want, a stored preference says what language you want, and i18next puts them together in the browser after hydration. It is a perfectly good design for an app. For a website it has a flaw: **the language is not part of the thing you can link to.** You cannot send a Brazilian friend a Portuguese link, because there is no Portuguese link. And a search engine cannot index a page that only exists after a click on a language picker.

The ledger entry I wrote for it (I keep a change ledger, with a review date, so future me can find out whether any of this worked) says it plainly: translations shared the English URL and had no `hreflang`, so only English was indexed, while Search Console was showing impressions from Brazil, India and Nigeria. People from countries that speak the languages I had translated into were landing on an English page. Great for my humility, bad for everything else.

The fix is also the usual one. Put the language in the address:

```
/en/tools/protein-calculator
/es/tools/protein-calculator
/nl/tools/protein-calculator
/pt-br/tools/protein-calculator
/ru/tools/protein-calculator
```

English gets a prefix too. I thought about leaving it bare for a moment, and then I thought about writing `if (locale !== 'en')` in forty places, and I came to my senses. Every public page has a prefix. There are no special cases, only the ones I am about to tell you about.

## One file knows what a URL is

The first rule I set was that nothing else may spell a prefix. `components/website/localeRoutes.js` is the only definition of which languages exist and how a path gets its prefix:

```js
const WEBSITE_LOCALES = [
  { prefix: 'en', hreflang: 'en', language: 'en-US', ogLocale: 'en_US' },
  { prefix: 'es', hreflang: 'es', language: 'es-ES', ogLocale: 'es_ES' },
  { prefix: 'nl', hreflang: 'nl', language: 'nl-NL', ogLocale: 'nl_NL' },
  { prefix: 'pt-br', hreflang: 'pt-BR', language: 'pt-BR', ogLocale: 'pt_BR' },
  { prefix: 'ru', hreflang: 'ru', language: 'ru-RU', ogLocale: 'ru_RU' },
];
```

Four spellings of one language, because four systems want four different ones. The URL wants `pt-br`, search engines want `pt-BR`, i18next wants `pt-BR` with a different casing convention in its resource keys, and Open Graph wants `pt_BR` with an underscore, because of course it does. Keeping those in one row means they cannot drift apart.

Everything else in the codebase works on _logical_ paths (`/tools/protein-calculator`) and the prefix is added at the edge:

```js
localizedPath('/tools/protein-calculator', 'es'); // '/es/tools/protein-calculator'
localizedPath('/blog/2026/11/some-post', 'es'); // '/en/blog/2026/11/some-post'
```

That second line is the interesting one. The blog is English only. Not "English for now": I write the posts in English and I am not machine-translating engineering essays about my own bugs. A page with no copy in a language is simply linked in English, and `localeScopeOf` decides which case you are in from the route registry, where a route can say `"locales": "en"` or `"none"` (`/open`, whose exact path the app's deep-link claim names, must not move at all).

Here is the part I am a little proud of. Nobody has to remember any of this, because there is a test that fails when you forget. `websiteHrefs.test.ts` scans the website's components and fails on a hard-coded internal href. Links go through a hook:

```ts
const href = useWebsiteHref();
// href('/tools') -> '/es/tools' on a Spanish page, '/en/tools' on an English one
```

A test that scans for the mistake is the cheapest way I know to find every place a refactor will hurt you, and it keeps working after I have forgotten why it exists.

## hreflang is one function, or it is a lie

`hreflang` is the annotation that tells Google "this page also exists in these other languages, at these addresses". It has one rule that matters more than the others: **it must be reciprocal.** If the English page lists the Spanish one, the Spanish page must list the English one, with the same set. Get one side wrong and Google ignores the whole cluster, quietly, without a warning.

The way to make a reciprocity bug impossible is to have exactly one place that produces the set:

```js
function hreflangAlternatePaths(path) {
  if (localeScopeOf(path) !== 'all') {
    return []; // a lone hreflang would claim an alternate that does not exist
  }

  return [
    ...WEBSITE_LOCALES.map((locale) => [locale.hreflang, localizedPath(path, locale.prefix)]),
    ['x-default', localizedPath(path, 'en')],
  ];
}
```

Every translated page gets the same list back, so the annotations match by construction. That list feeds three things that must agree: the `<head>` metadata (`alternates.languages`), the client-side `<link rel="alternate">`, and the sitemap, where each locale is its own `<url>` carrying `xhtml:link` alternates. The sitemap grew by a couple of thousand lines in that one commit. I did not write any of them. The generator did, which is the only reason I believe them.

`x-default` points at English, because "I don't know what language you want" is a question I answer with the language I can proofread.

## The layout that ate every Spanish title

Here is where it stopped being a tidy refactor.

Expo Router has a nice shape for this: a `[locale]` folder, and every page inside gets a `locale` param. I made the folder, put a layout in it that read the param and set the language, moved the pages in, built the site, and opened the Spanish home page. Perfect Spanish. Then I looked at the HTML source, which is the only thing a crawler reads. The title was English. The canonical was English.

The cause is in how Expo hands data to `generateMetadata`. A page's metadata function receives **only the params of the page's own route**. When the `[locale]` segment belongs to a _layout_, the page's own route does not include it, so `params.locale` never arrives. Every page was rendering metadata for `undefined`, which falls back to English. The component tree, which reads the router context, was fine, and that is exactly why I did not see it in the browser.

The fix is to delete the layout. With no layout in `[locale]/`, the segment is part of every page's own route and arrives where it should. Each page exports its own params and its own metadata:

```ts
export const generateStaticParams = localeStaticParams;
export const generateMetadata = fixedMetadataFor('toolProteinCalculator');
```

```ts
export async function localeStaticParams() {
  return WEBSITE_LOCALES.map(({ prefix }) => ({ locale: prefix }));
}
```

That is two lines of boilerplate in every page, which is exactly what I would have designed away if I had been allowed a layout. A test (`localeRoutes.test.ts`) reads the folder and fails if a page under `[locale]/` forgets either export. I would rather be annoyed by a test than by a Spanish page with an English title and a canonical that tells Google the Spanish page is a duplicate of the English one. Which is, to be clear, what my first build did.

## The blog does not live there

The blog stayed out of `[locale]`, in `app/(website)/en/blog/`, which is a plain folder whose URLs are already `/en/blog/…`. I tried putting it under `[locale]` first, for symmetry, and there were two problems.

1. Expo does not run the data loaders for static pages under a generated `[locale]` layout, so the blog index read `undefined` from `useLoaderData` and the export crashed.
2. An English-only tree under `[locale]` is rendered once per language. About 1,200 tag pages, five times. The export ran out of memory, and the wrapper now sets Node's heap to 8 GB because the whole site renders five times over anyway.

An English-only section wants to live in a folder that says so. The sitemap generator reads the same registry, so the blog gets one URL per post, a canonical, and no `hreflang`, because a post is not translated and claiming otherwise would be the reciprocity bug again.

## The language is the address, not the browser

Inside the app, a stored language preference decides what you see. On the website that has to flip: the address decides, and the stored preference only matters when the address has no opinion.

```tsx
export function useWebsiteLanguage(): boolean {
  const { locale } = parsePublicPath(usePathname());

  if (locale && i18n.language !== locale.language) {
    i18n.changeLanguage(locale.language);
  }
  // ...
}
```

Yes, that calls `changeLanguage` during render. It is on purpose, and I have a comment explaining so, because the first instinct of every reviewer, including me, is to put it in an effect. The static export renders every page in one Node process, and the first browser render must match the HTML it hydrates. An effect would run after the first render, so the first render would be in whatever language the previous page left behind. For a statically exported site that means a hydration mismatch and, worse, an export where page N inherits the language of page N−1.

There is also no redirect from `/en/…` to `/es/…` because your browser says Spanish. Googlebot has no preference, so a redirect that depends on one is an invitation to be indexed wrongly, and a Spanish speaker who wants the English page should be able to open it. The language picker is a list of real `<a href hreflang>` links. Click one and you navigate. Revolutionary.

## The addresses that have no language

Now the part that cost two days.

There are old links. `musclog.app/tools/protein-calculator` is in search results, in blog posts, in other people's posts, in a bookmark somewhere, in links I pasted into chats. Those addresses no longer correspond to a file. And the site is static files on GitHub Pages: there is no server, so there is no rewrite rule, no `301`, no nginx config. There is a folder, and a name either exists in it or it 404s.

### Attempt one: a redirect page

My first answer was a script, `write-legacy-redirects.js`, which wrote a tiny HTML file at every old address:

```html
<meta http-equiv="refresh" content="0; url=/en/tools/protein-calculator" />
<script>
  location.replace('/en/tools/protein-calculator' + location.search + location.hash);
</script>
```

Canonical pointing at the new URL, meta refresh as the no-JavaScript fallback, a script that keeps the query string and the hash. It worked. It is also what everybody does, and I shipped it, and then I looked at it from the other side.

A link preview bot, the thing that fetches a URL when you paste it into WhatsApp, Slack or Discord, reads the HTML and runs nothing. What it saw at `musclog.app/tools/protein-calculator` was a page titled "Musclog" with a body containing one link. Everyone who shared an old link got a blank preview. A human sees a flash of white and a fast redirect; a robot sees nothing, and robots are the audience that decides what the link looks like in the chat.

I added a nicer "taking you to the right page" screen to it (the second commit on the subject, `add better redirecting page`), felt vaguely better, and then understood that I was polishing the wrong thing. The problem was not that the redirect page was ugly. It was that **there was a page at that address and it had no content**.

### Attempt two: the page is the page

The right answer is that an address with no prefix is just another address for the English page. So after the export finishes, a script copies the finished English page to its unprefixed twin:

```
dist/en/tools/protein-calculator.html  ->  dist/tools/protein-calculator.html
dist/en/index.html                     ->  dist/index.html  (and dist/home.html)
```

Now the preview bot gets a real title, a real description, a real Open Graph image and real content, with no script involved. The copy keeps its canonical and its `hreflang` set pointing at the `/en/…` URL, so search engines fold the duplicate onto the real page. It is a duplicate that says so, which is the polite kind.

The unprefixed copies are not listed in the sitemap and nothing links to them. They exist so that an old link works, not so that anything new does.

That leaves one problem. A human who opens the unprefixed copy is looking at English HTML at an address with no language, and the app has to boot. This is where a stored preference earns its keep: someone who picked Spanish last week should land on the Spanish page, not on English. So each copy gets exactly one inline script, injected right after the charset meta, before the bundle:

```js
(function () {
  var e = '/en/tools/protein-calculator',
    t = { 'es-es': '/es/tools/protein-calculator' /* … */ },
    s = location.search + location.hash,
    u = e,
    m = false;
  try {
    var l = localStorage.getItem('musclog_lang');
    if (l) {
      l = t[l.toLowerCase()];
      if (typeof l === 'string') {
        u = l;
        m = true;
      }
    }
  } catch (x) {}
  if (m) {
    location.replace(u + s);
  } else {
    try {
      history.replaceState(null, '', u + s);
    } catch (x) {
      location.replace(u + s);
    }
  }
})();
```

(It is written as ES5 in the generator, with `<` escaped as the six characters `\u003c` so a path can never close the script tag.)

Two branches, and the difference between them is the whole design:

- **No stored language, or English:** `history.replaceState` rewrites the address to `/en/…` _in place_. No reload, no flash. The HTML on the page is English, the address now says English, and hydration agrees with both.
- **A stored non-English language:** `location.replace` to that language's own static page. It cannot be patched in place, because the HTML under the cursor is English, and a Spanish first render would not match it. Hydration mismatches are the kind of bug that works on your machine and looks haunted on someone else's.

The script has to run before the bundle for a reason that took me a while to believe: the router reads `location` while it hydrates. If the address still says `/tools/protein-calculator` when the router boots, it decides which route you are on from that, finds none, and renders a not-found page over perfectly good English HTML. The inline script is not cosmetic. It is the thing that makes the page exist.

The targets are written into each copy at build time instead of computed from `location`, so `/tools`, `/tools/` and `/tools.html` all land on the same URL.

### The dev server cannot do any of this

In development there is no `dist`. Nothing copies anything, so an unprefixed address on `npm run web` is a genuine 404. A small component (`LegacyForward`) exists only for the dev server: it takes the address, asks `legacyForwardPath`, and forwards to `/en/…`. Production never runs it. I mention it because there are now two mechanisms for the same job, one in the build and one in development, and I would like it on the record that I know.

## The build is a pipeline, and order is the feature

```
export-web-wrapper -> localize-web-exports -> write-unprefixed-pages -> flatten-web-indexes
```

- **export** renders every page. All of them come out with `<html lang="en">`, because `+html.tsx` runs once per document in a context that cannot see the route.
- **localize** stamps the right `<html lang>` on each language's pages, deletes the export's template pages for the literal `[locale]` segment (which render fine, and which no URL reaches), and refuses to continue if any language's home page is missing. That last check exists because the wrapper's exit code alone does not prove the export finished. A half-empty export that "succeeded" would let every later step run, and look like it worked.
- **write-unprefixed-pages** makes the unprefixed copies. It fails the build if an English source page is missing or if it would overwrite anything other than the export's own `index.html`.
- **flatten** copies every `X/index.html` to `X.html`, because GitHub Pages answers a directory URL with a `301` to `http://…/X/`, which contradicts a canonical that is https and has no trailing slash. It runs last so the flat copies carry the right language.

If you reorder those, nothing throws. The site builds, and the Spanish pages say `lang="en"`. This is, in my experience, how most build pipelines fail: not loudly, and not in the file you were editing.

## Adding a language afterwards

The best test of an architecture is the next feature. The same day, I added German, French, Italian, Polish and Turkish: a new row each in `WEBSITE_LOCALES`, translated copy, and the places that list locales by hand. The sitemap, the `hreflang` clusters, the unprefixed copies and the language picker all picked them up without a change. The new-language checklist in `AGENTS.md` is long, because a language touches more than the website, but "the website's URL structure" is not on it, which is the point. Ten languages, ten prefixes, one array.

I did find a bug on the way, naturally. `WebsitePreferences.tsx` keeps a table of language labels for the picker and a missing label crashes the header. A missing label crashes the whole header, so it is on the checklist now.

## The snackbar I did not plan

One last thing a refactor like this teaches you. If the blog is English-only and the language picker is in the header, what happens when a French reader on a post clicks "Français"? There is no French post. The address cannot change.

I made the chrome switch in place and show a small, polite note, in French, saying the posts are in English. It auto-dismisses after seven seconds and sits at the top, because the cookie banner owns the bottom. It is an honest answer to a question the architecture cannot answer any other way, and it is the only part of the whole project that a user will ever see, which seems about right.

## What I will measure

I do not know yet whether any of this worked, and the ledger says when I will: review on 25 December. Compare impressions by country, and the `/es`, `/pt-br`, `/nl` and `/ru` pages, after the sitemap is resubmitted. The old URLs consolidate onto `/en/…` over weeks, not days, so a bad first week proves nothing and a good one proves less.

What I can say is that Google finally has an address for each page in each language, a sitemap that says so, and `hreflang` annotations that agree with each other because one function wrote all of them. The tests fail if I forget a prefix, forget an export, or hard-code a link. And the old links still work, with real content in them, for the bots that do not run JavaScript.

If you are doing the same thing on a static host, the checklist is short and the order matters:

1. Put the language in the path, English included, and give every URL one definition.
2. Generate `hreflang`, canonicals and sitemap alternates from the same function.
3. Do not put `[locale]` in a layout if your metadata function needs the param.
4. Do not make an old address a redirect page. Make it the page.
5. Run the unprefixed copy's script before your bundle.
6. Write the tests first. They will find the links you forgot.

Musclog is open source, so all of this is in the repository if you want to see how rough the first draft was. The [tools](/tools) are a good place to see the result: each one now has five addresses, and one of them is, I promise, in your language.
