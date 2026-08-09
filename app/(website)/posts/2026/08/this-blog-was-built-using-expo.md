---
title: 'This blog was built using Expo'
date: '2026-08-09'
category: 'development'
description: 'The page you are reading is a statically exported Expo Router route. Here is how generateStaticParams turns a folder of Markdown into HTML — and the three-hunk patch to expo-router I needed to make catch-all routes work at all.'
tags: ['Expo', 'Expo Router', 'Static Site', 'React Native', 'TypeScript']
---

The page you are reading is an Expo Router route.

Not a Next.js site next to the app. Not a separate repo. The same Expo project that builds the Android and iOS app also builds this website, statically exports it to HTML, and renders this post from a Markdown file sitting in `app/(website)/posts/`.

I did it that way mostly out of stubbornness — I did not want a second toolchain for four marketing pages — and it turned out to work far better than expected, right up until the point where it did not work at all and I had to patch the router. Both halves of that are worth writing down.

## One tree, two products

The whole thing hinges on Expo Router route groups. The repo has:

- `app/app/` — every mobile screen. Nutrition, workouts, progress, settings.
- `app/(website)/` — the public website. Landing page, FAQ, download, this blog.

The parenthesised `(website)` group is invisible in the URL, so those routes live at `/`, `/faq`, `/blog` while staying completely isolated from the app tree.

Inside the website group, every page exists twice:

```
app/(website)/faq.tsx        →  a native stub that redirects to /app
app/(website)/faq.web.tsx    →  the actual page
```

Expo Router picks the file by platform extension, so the marketing site never ships to a phone and the app never has to know the website exists. And because these are `.web.tsx` files that will only ever run in a browser, they are written as a plain React web app — real `<div>`, `<section>`, `<a>` elements with Tailwind classes, not React Native primitives.

## Markdown in, HTML out

A post is a Markdown file with frontmatter:

```markdown
---
title: 'This blog was built using Expo'
date: '2026-08-09'
category: 'development'
tags: ['Expo', 'Expo Router']
---

The page you are reading is an Expo Router route.
```

Files are discovered recursively, so the directory structure _is_ the URL: `posts/2026/08/this-blog-was-built-using-expo.md` becomes `/blog/2026/08/this-blog-was-built-using-expo`.

The interesting part is where the Markdown gets turned into HTML. Expo Router 57 has **static data loaders** — a route can export a `loader` that runs at build time, on the server, and whose result is baked into the exported page. You opt in through the plugin config:

```json
["expo-router", { "unstable_useServerDataLoaders": true }]
```

Then the route exports one:

```tsx
export const loader = createStaticLoader(async (params) => {
  const { loadBlogPostForRoute } = await import('@/utils/blogPosts.server');
  return loadBlogPostForRoute(params.slug);
});

export default function BlogPostPage() {
  const post = useLoaderData<typeof loader>();
  // ...
}
```

The dynamic `import()` matters. `blogPosts.server.ts` uses `node:fs/promises`, `markdown-it` and `highlight.js` — none of which should ever reach a browser. Keeping it behind a dynamic import inside the loader means the parser and the syntax highlighter run once at build time and stay out of the client bundle entirely. What the browser receives is finished HTML.

That is also the security posture. `markdown-it` runs with `html: false`, so raw HTML in a post is escaped rather than executed, unsafe link protocols are rejected, and code fences are escaped before highlighting. There is no `dangerouslySetInnerHTML` of anything a client ever touched.

## `generateStaticParams`

A loader gets you one page. The blog needs one page _per post_, and the router has no idea how many posts exist — they are files on disk, not routes.

That is what `generateStaticParams` is for. The catch-all route exports a function that returns the list of parameter values it should be built for, and Expo generates an HTML page for each:

```tsx
export async function generateStaticParams(): Promise<{ slug: string }[]> {
  const { loadBlogPostSummaries } = await import('@/utils/blogPosts.server');
  const posts = await loadBlogPostSummaries();

  return posts.map((post) => ({ slug: post.slug }));
}
```

Note that `slug` here is a multi-segment string — `2026/08/this-blog-was-built-using-expo` — because the route is `[...slug]`, a **deep** dynamic segment. Expo splits it back into path segments when it builds the file tree, so one entry produces `dist/blog/2026/08/this-blog-was-built-using-expo.html`.

Adding a post is therefore: drop a `.md` file in the right folder, rebuild. No route registration, no index to update, no config. The sitemap generator reads the same directory, so it appears there too.

The build output looks like this:

```
› Loaders (4):
/(website)/blog/index
/(website)/blog/[...slug]
/(website)/blog/2026/03/musclog-version-2-is-out
/(website)/blog/2026/08/this-blog-was-built-using-expo
```

One JSON payload per post, plus the index. Each exported HTML page inlines its own loader data, so the first paint needs no fetch at all.

You may have noticed the uninterpolated `[...slug]` in that list. Expo Router keeps the unresolved template route in its static manifest alongside the generated ones, so the loader also gets called once with the literal string `[...slug]`. There is no way to opt out, so `loadBlogPostForRoute` handles that case explicitly by falling back to the newest post. It is a wart, and it is the kind of thing you find out about at 1am.

## Now the part that did not work

Everything above is the happy path, and it is genuinely lovely. Here is what it cost.

Data loaders are alpha in SDK 57 — `unstable_` is right there in the config key — and catch-all routes are where the edges are sharpest. The blog needed three patches to `expo-router@57.0.11`, and I want to describe them properly, because two of them fail _silently_ and I lost a good while to the first one.

### 1. A catch-all cannot have a platform extension

I wanted the normal convention: `[...slug].tsx` as the native redirect, `[...slug].web.tsx` as the real page.

It does not work, and it does not fail loudly either. The route silently appears at the wrong URL, on every platform.

The cause is one line. Expo Router reads a file's platform extension by splitting the filename on dots and taking index 1:

```js
const filenameParts = removeSupportedExtensions(filename).split('.');
const filenameWithoutExtensions = filenameParts[0];
const platformExtension = filenameParts[1];
```

That is fine for `faq.web.tsx` → `['faq', 'web']`. Now do it to a deep dynamic segment, which contains three dots of its own:

```js
'[...slug].web.tsx' -> ['[', '', '', 'slug]', 'web']
//                      ↑ name          ↑ "platform extension" is ''
```

`''` is not a valid platform, so the file is not treated as a platform variant at all. It is registered as a route **literally named `blog/[...slug].web`**, published on Android and iOS too.

The consequences cascade. `[...slug].web.tsx` is not selected for web; `[...slug].native.tsx` never applies on native, so a phone would render the web page complete with its server-only loader; and a junk `blog/[...slug].native` route gets published to the static export. Single dynamic segments like `[id].web.tsx` are completely unaffected, which is exactly why this survives — you have to reach for a catch-all to trip it.

The fix is to read the extension off the end of the filename instead of by position:

```js
const filenameWithoutFileExtension = removeSupportedExtensions(filename);
const platformExtensionMatch = filenameWithoutFileExtension.match(/\.(android|ios|native|web)$/);
const filenameWithoutExtensions = platformExtensionMatch
  ? filenameWithoutFileExtension.slice(0, -platformExtensionMatch[0].length)
  : filenameWithoutFileExtension;
const platformExtension = platformExtensionMatch?.[1];
```

I found this by dumping the route tree at both platforms with a small script against the router's own `getRoutes()`, which I would recommend to anyone debugging Expo Router: the tree is a plain object, and staring at it answers questions that no amount of reading the file names will.

### 2. The platform extension leaks into the loader key

Fixing the parser is not enough, because the platform extension survives into the route's **context key** — the identifier Expo uses to find that route's loader data.

`useLoaderData` takes the context key and substitutes the actual parameters into it, so `/(website)/blog/[...slug]` becomes `/(website)/blog/2026/08/example`. The substitution is positional string slicing:

```js
if (segment.startsWith('[...')) {
  return options.params?.[segment.slice(4, -1)]?.join('/') || segment;
}
```

For `[...slug]` that slices out `"slug"` and finds the parameter. For `[...slug].web` it slices out `"slug].we"`, finds nothing, and falls back to the raw segment. The page then requests a loader at a path containing a literal `[...slug].web`, which the export never wrote, and you get "Failed to load loader data".

So the second hunk strips a trailing platform extension when building the context key. The satisfying part is that the router's `getContextKey` is used by exactly two things that matter here — the runtime hook, and `@expo/cli`'s static exporter when it decides where to write the loader JSON. Both import the same module, so patching it once keeps the two sides in agreement by construction. It also fixes `_layout.web.tsx`, whose context key was `/(website)/_layout.web` and therefore was not recognised as a layout at all.

### 3. Route groups in development

The third is smaller and only affects `npm run web`. The loader client asks for the filesystem context key — including the `(website)` group segment — while the dev server's manifest exposes public paths with groups stripped. So in development only, the patch removes route-group segments before requesting the loader. Production deliberately keeps them, because static export writes the loader files under exactly those paths.

## The one that was not a bug

One more constraint, and this one is not expo-router's fault — it is just how the output is laid out.

Loader payloads are written as extensionless files named after the route's context key. So a `blog.tsx` route with a loader writes `dist/_expo/loaders/(website)/blog`, and the posts write `dist/_expo/loaders/(website)/blog/2026/...`.

Which means `blog` needs to be a file and a directory at the same time. The export dies with:

```
Error: EISDIR: illegal operation on a directory,
  open 'dist/_expo/loaders/(website)/blog'
```

The fix is to move the index inside the folder — `blog/index.web.tsx` instead of `blog.web.tsx`. The URL is unchanged, the context key becomes `/(website)/blog/index`, and nothing collides. Any `foo.tsx` + `foo/[x].tsx` pair where both export loaders will hit this, so it is worth knowing before you name your files.

## Was it worth it?

Yes, though ask me again after the next SDK upgrade.

What I get is a website that shares the app's components, its theme, its i18n setup and its build pipeline. The FAQ page and the food diary use the same colour tokens because they import the same file. There is no second repo, no second deploy, no second dependency tree to keep patched.

What it costs is that I am running three patches against a package marked alpha, and each one is a small bet that upstream will land an equivalent fix before it drifts. To keep that bet honest, the patches are pinned by tests that assert the route tree resolves correctly on web and on native, that no platform-suffixed route leaks into the tree, and that context keys come out clean. If a future Expo upgrade regresses any of it, the build fails with a clear message instead of a blog that silently 404s.

That is the actual lesson, and it generalises past Expo: when you patch a dependency, the patch is not the deliverable. The test that tells you when the patch stops being needed — or stops being enough — is.

- [Browse the source](https://github.com/blopa/musclog-app) — the website lives in `app/(website)/`, the patch in `patches/`
- [Download Musclog](https://play.google.com/store/apps/details?id=com.werules.logger) for Android, or [join the iOS TestFlight](https://testflight.apple.com/join/mq3QMSHU)
