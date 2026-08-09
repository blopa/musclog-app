# Musclog Repo Architecture: App, Website, and Web App in One Expo Router Repo

This repository intentionally combines three product surfaces in one codebase:

1. The native mobile app for Android and iOS.
2. The public website at `musclog.app`.
3. The web version of the app at `musclog.app/app`.

That is not accidental or a temporary compromise. The repo is structured so all three surfaces can share the same routing system, shared business logic, shared database layer, shared translations, shared styling primitives, and shared product code wherever that makes sense.

## The Big Picture

The repo uses Expo + Expo Router as the common application shell.

- `app/app/*` contains the actual product app routes.
- `app/(website)/*` contains the public marketing/institutional website routes.
- `app/+html.tsx` customizes how the web build is wrapped at the raw HTML level.
- `app/index.tsx` decides the default entry path differently for web and native.

In practice:

- On Android and iOS, the user is sent into the app at `/app`.
- On web, the root path redirects to `/home`, which is the marketing website.
- On web, the app itself still exists at `/app`, and on desktop that `/app` route gets special phone-frame presentation.

## Route Structure

### Root entry

[`app/index.tsx`](/app/index.tsx) is the top-level traffic switch:

- `Platform.OS === 'web'` redirects to `/home`
- Native redirects to `/app`

So the same repo has a different default experience by platform:

- Web visitors land on the website.
- Mobile app users land in the product app.

### Product app routes

[`app/app/_layout.tsx`](/app/app/_layout.tsx) is the main app shell for the product itself. It loads:

- database initialization
- translations
- global CSS
- React Query
- settings, theme, snackbar, smart camera, unread chat, coach, and other providers
- migrations and startup safeguards
- the app stack navigator

Everything under `app/app/*` is the actual Musclog application: nutrition, workouts, profile, onboarding, settings, progress, and so on.

This is the route tree that powers:

- Android app
- iOS app
- web app at `/app`

### Website routes

The public site lives under the route group [`app/(website)/`](/app/%28website%29).

Examples:

- `/home`
- `/blog`
- `/privacy`
- `/terms`
- `/contact`
- `/calculator`

The web layout is [`app/(website)/_layout.web.tsx`](/app/%28website%29/_layout.web.tsx), which wraps pages with:

- `WebsiteProviders`
- `WebsiteSeoForCurrentRoute`
- `WebsiteOrganizationJsonLd`
- `WebsiteWrapper`

That gives the website its own header, footer, consent UI, SEO tags, structured data, and general web-only presentation.

[`WebsiteSeoForCurrentRoute`](/musclog/components/website/WebsiteSeo.tsx) maps the current pathname to the route key and renders [`WebsiteSeo`](/musclog/components/website/WebsiteSeo.tsx). That component owns the route title, description, canonical URL, robots directive, Open Graph tags (including `og:locale:alternate` for the other supported languages), Twitter card tags, and the shared preview image at `/images/seo-image.png` (sourced from [`assets/seo-image.png`](/musclog/assets/seo-image.png)). When adding a public website route, add its registry entry and translation metadata rather than adding SEO tags inside the page component.

### SEO / agentic discoverability

[`components/website/websiteRoutes.json`](/musclog/components/website/websiteRoutes.json) is the single route registry. Each entry carries the canonical `path`, an optional `robots` directive (omitted for indexable routes), and an optional `llms` blurb (`section`, `title`, `summary`). Everything below is derived from it, so adding a route means one entry there plus its `website.seo.routes.<key>` strings in each `lang/locales` `website.json`:

- `WebsiteSeo.tsx` reads it for canonical URLs and the `robots` meta tag, and derives its pathname → route-key lookup from it.
- [`scripts/generate-web-seo-files.js`](/musclog/scripts/generate-web-seo-files.js) reads it to regenerate `public/robots.txt`, `public/sitemap.xml` and `public/llms.txt` before every `npm run web` / `npm run build-android-web` (mirroring `sync-web-images.js`). **All three `public/` files are generated — never hand-edit them.** A route is treated as indexable unless its `robots` directive contains `noindex`. `robots.txt` explicitly allows the major AI answer/citation crawlers (GPTBot, ClaudeBot, PerplexityBot, Google-Extended, ...) in addition to the default `Allow: /`, since the marketing site has nothing that needs hiding from AI assistants. `llms.txt` follows the community [llms.txt](https://llmstxt.org/) convention; its section order and the non-route links (e.g. the GitHub repo) live in the script, the per-route copy lives in the registry. The sitemap carries no `<lastmod>`: it is optional, largely discounted by search engines, and stamping the build date into a tracked file dirtied the working tree on every `npm run web`.

`WebsiteOrganizationJsonLd` (in [`components/website/WebsiteStructuredData.tsx`](/musclog/components/website/WebsiteStructuredData.tsx)) mounts sitewide `Organization` + `WebSite` JSON-LD once, in `_layout.web.tsx`. Route-specific schema — `SoftwareApplicationJsonLd` on `/home`, `FaqPageJsonLd` on `/faq` (built from the same i18n content the page renders, not a separate copy) — is mounted from within the page component itself. Don't add fields that aren't backed by real data (e.g. `aggregateRating`).

The native fallback layout is [`app/(website)/_layout.tsx`](/app/%28website%29/_layout.tsx), which skips the website chrome. That keeps the route group valid across platforms without pretending the marketing site is a native app feature.

Several website routes also have native stubs such as:

- [`app/(website)/home.tsx`](/app/%28website%29/home.tsx)
- [`app/(website)/calculator.tsx`](/app/%28website%29/calculator.tsx)

These simply redirect to `/app` on native, which is a clean way to say: this content is part of the public website, not part of the mobile app UX.

### Blog content

The static `/blog` index and its individual `/blog/<year>/<month>/<slug>` pages discover Markdown
files recursively under
[`app/(website)/posts`](/app/%28website%29/posts). Each post must provide YAML frontmatter with a
`title`, `date` (`YYYY-MM-DD`), `category`, and `tags` array; `description` is optional and otherwise
comes from the first prose in the Markdown body. File and directory names become URL segments and
therefore accept only letters, numbers, hyphens, and underscores. The routes' Expo static loaders
read and validate the files through [`utils/blogPosts.server.ts`](/utils/blogPosts.server.ts).

The catch-all [`blog/[...slug].tsx`](/app/%28website%29/blog/%5B...slug%5D.tsx) route exports
`generateStaticParams` from those discovered slugs, so Expo emits one HTML page per post. Its
`[...slug].native.tsx` sibling redirects native users to `/app`; using an unsuffixed `.tsx` for the web
implementation is deliberate because Expo Router 57.0.11 cannot interpolate a catch-all parameter
from a platform-suffixed `[...slug].web.tsx` loader context. Expo Router 57 also retains the
unresolved catch-all template in its static manifest, so `loadBlogPostForRoute` handles the literal
`[...slug]` loader call that occurs during export in addition to the generated post paths.

Post bodies are converted to HTML inside the server loader with `markdown-it` and `highlight.js`.
That supports standard rich Markdown (headings, emphasis, links, lists, tables, blockquotes, images,
inline code, and fenced code blocks) while keeping the parser and highlighter out of the client
bundle. Source HTML is disabled, unsafe link protocols are rejected by `markdown-it`, and code
fences are escaped before highlighting. The page scopes all prose and highlight styles under
`.blog-prose` in `global.css`.

Each post renders frontmatter-derived article metadata and `BlogPosting` JSON-LD. The SEO generator
also discovers Markdown paths for `public/sitemap.xml`; the fixed-route registry remains the source
for robots rules and `llms.txt`. `unstable_useServerDataLoaders` must remain enabled on the
`expo-router` plugin in `app.json` for these build-time content steps.

Expo Router 57.0.11 still labels data loaders as alpha. Its client-side loader path builder receives
filesystem context keys such as `/(website)/blog.web` and
`/(website)/blog/2026/08/example` during development, while the dev-server manifest exposes their
public loader paths.
[`patches/expo-router+57.0.11.patch`](/patches/expo-router+57.0.11.patch) normalizes that context key
only in development, removing route-group segments and a possible `.web` suffix before requesting
the loader. Production deliberately keeps context keys because static export writes loader assets
under those paths. Remove the patch once Expo Router includes an equivalent upstream fix, and
recheck index-to-post navigation under both `npm run web` and a locally served static export when
upgrading it.

## Why `musclog.app/app` Exists

The website and the app are different things:

- `musclog.app` is the public website.
- `musclog.app/app` is the actual app running on the web.

That split is useful because the website and the app have different jobs:

- The website explains, markets, and distributes the product.
- The app is the product itself.

Keeping both in the same Expo Router tree means:

- one routing system
- one deployment pipeline
- one translation system
- one component library where sharing makes sense
- one source of truth for services, data models, and app behavior

It also avoids the common multi-repo pain of duplicating:

- branding and copy changes
- auth/session assumptions
- locale files
- shared links and legal pages
- design tokens and utility CSS
- release coordination between “marketing repo” and “product repo”

## The Special Role of `app/+html.tsx`

[`app/+html.tsx`](/app/+html.tsx) is the most important file for understanding the web experience.

It only runs for the web/static-rendered HTML shell, and it does three big things:

1. It injects a desktop landing panel beside the app.
2. It injects a phone-frame image overlay around the app.
3. It hides that whole wrapper on non-`/app` routes.

### What it does on `/app`

On desktop web, `/app` is not shown as a raw full-width site. Instead, `+html.tsx` renders:

- a left-side landing/info panel
- the app inside `.expo-web-app-shell`
- a bezel overlay image `.expo-web-phone-frame`

The relevant structure in `+html.tsx` is:

- `.expo-web-landing`
- `.expo-web-root`
- `.expo-web-app-shell`
- `.expo-web-phone-frame`

This is what creates the “the app is running inside a phone” effect on desktop.

### What it does on non-`/app` routes

`+html.tsx` also injects a small route gate script that checks the current pathname. If the path does not start with `/app`, it adds the `hide-desktop-wrapper` class to the document root.

That class disables the phone wrapper and landing panel for website routes like:

- `/home`
- `/privacy`
- `/terms`
- `/contact`

This is why the marketing website behaves like a normal website, while `/app` behaves like a framed product preview on desktop.

### Why this is described as “hacky”

It is a pragmatic HTML/CSS-level customization, not a pure in-app React layout.

That is intentional:

- it needs to run before React fully boots
- it needs to affect the raw document shell
- it needs to decide framing based on the current route
- it needs to work during static export

So yes, it is custom and a bit low-level, but it solves a real UX problem cleanly:

- website pages should feel like normal web pages
- app pages should feel like an app preview on desktop

## Where the Desktop Web Wrapper Styling Lives

The matching CSS lives in [`global.css`](/musclog/global.css).

Important classes:

- `.expo-web-body`
- `.expo-web-root`
- `.expo-web-app-shell`
- `.expo-web-phone-frame`
- `.expo-web-landing`
- `html.hide-desktop-wrapper`

Key behavior:

- default behavior is full-bleed on small viewports
- desktop phone-frame behavior starts at `min-width: 1024px`
- the wrapper is explicitly disabled for website routes via `hide-desktop-wrapper`

There is also an explicit sync point in [`utils/webPhoneFrame.ts`](/musclog/utils/webPhoneFrame.ts):

- `WEB_DESKTOP_PHONE_FRAME_MIN_WIDTH = 1024`

That constant is meant to stay in sync with the CSS media query in `global.css`.

## Why the Web App Is Still the Same App

The web app at `/app` is not a separate frontend. It is the same Expo Router app route tree that native uses.

That matters because the following layers are shared:

- route structure
- product screens
- hooks
- services
- database abstractions
- i18n
- business logic
- much of the component library

The app shell in [`app/app/_layout.tsx`](/app/app/_layout.tsx) is loaded for the product app on all platforms, including web.

There are platform-specific adaptations where needed, but the product surface is still fundamentally one app.

## Provider Split: App vs Website

The product app and the website do not use exactly the same wrapper stack.

### Product app providers

[`app/app/_layout.tsx`](/app/app/_layout.tsx) includes a heavier runtime shell:

- database setup
- migrations
- theme
- safe area
- gesture handler
- sentry boundary
- app-specific providers
- web modal shell provider

This is necessary because the app is interactive, stateful, data-heavy, and uses native/web platform features.

### Website providers

[`components/website/WebsiteProviders.tsx`](/musclog/components/website/WebsiteProviders.tsx) is intentionally lighter:

- React Query
- settings provider
- language initializer
- analytics consent

The website needs localization and some shared state, but it does not need the full app runtime shell.

## Why the Web Modal Shell Exists

The app side also contains web-specific infrastructure like [`context/WebModalShellContext.web.tsx`](/musclog/context/WebModalShellContext.web.tsx).

This exists because once the app is rendered inside the custom desktop phone shell, overlays and portals can become tricky. The modal shell host gives the web app a reliable portal target inside that wrapped environment.

That is another example of the repo making the web app feel polished without splitting it into a separate web-only project.

## Static Export and Web-Specific Safeguards

The repo is careful about static export and web build behavior.

Examples:

- [`constants/platform.ts`](/musclog/constants/platform.ts) exposes `isStaticExport` so startup logic can skip browser-only or DB-heavy side effects during export.
- `app/+html.tsx` is written to run in the static-rendered HTML phase.
- [`package.json`](/musclog/package.json) includes `prestart` and `web` scripts that run `scripts/sync-web-images.js`.

That `sync-web-images.js` step exists because the phone frame asset used by the desktop web wrapper has to be copied into the exported/public web path before serving/building.

## Native-Specific Behavior Still Lives Here Too

This repo is not “a website with an app inside it.” It is a real mobile app codebase that also serves the website and the web app.

Examples of clearly native-oriented behavior:

- orientation locking in [`app/app/_layout.tsx`](/app/app/_layout.tsx)
- native deep-link interception in [`app/+native-intent.tsx`](/app/+native-intent.tsx)
- Android/iOS build scripts in [`package.json`](/musclog/package.json)
- native-specific libraries for camera, health data, widgets, notifications, and platform integrations

So the architecture is better understood as:

- one mobile-first app codebase
- with a public website route group
- and a web rendering strategy that also exposes the app at `/app`

## Why Keeping Everything in One Repo Is Nice

This repo structure has real advantages.

### 1. Shared product logic stays shared

The app logic, services, database, and translations do not need to be copied or reimplemented in a separate website repo or separate web-app repo.

### 2. Website and app stay in sync

If a feature changes, the website copy, app screenshots, translations, legal links, and CTA targets can evolve in the same code review and the same release cycle.

### 3. One routing mental model

Expo Router handles:

- website routes
- app routes
- native navigation
- web navigation

That is much simpler than stitching together different frameworks or different repos.

### 4. Easier reuse of design and infrastructure

The repo can share:

- localization
- analytics consent behavior
- styling utilities
- assets
- deployment knowledge
- route conventions

### 5. Lower coordination overhead

With two repos, simple changes often require:

- duplicate PRs
- duplicate CI runs
- duplicated translation updates
- duplicated release coordination

Here, one change can update the website and app together when needed.

## The Main Tradeoff

The main cost of this architecture is complexity in the web shell.

Because the repo wants:

- a normal website at `musclog.app`
- a framed desktop app preview at `musclog.app/app`
- a shared Expo Router project for all of it

there is necessarily some custom route-aware HTML/CSS logic in `app/+html.tsx` and `global.css`.

That logic is more custom than a basic Expo web app, but it is also exactly what makes the unified repo approach work well.

## Practical Summary

Musclog is one Expo Router repo serving three related but distinct experiences:

1. Native product app on Android and iOS via `app/app/*`.
2. Public website via `app/(website)/*`.
3. Web product app at `/app`, using the same app routes as native.

The reason this works is:

- the routing is unified
- the providers are split appropriately
- `app/+html.tsx` customizes the desktop web shell
- `global.css` implements the phone-frame and landing-panel behavior
- the website wrapper is disabled outside `/app`

This is why one repo is genuinely nicer here than two:

- shared logic stays shared
- the website and product stay tightly aligned
- the web app is the real app, not a separate imitation
- deployment and maintenance overhead stay much lower

## Files Worth Knowing

- [`app/index.tsx`](/app/index.tsx)
- [`app/app/_layout.tsx`](/app/app/_layout.tsx)
- [`app/(website)/_layout.web.tsx`](/app/%28website%29/_layout.web.tsx)
- [`app/(website)/_layout.tsx`](/app/%28website%29/_layout.tsx)
- [`app/(website)/home.web.tsx`](/app/%28website%29/home.web.tsx)
- [`app/+html.tsx`](/app/+html.tsx)
- [`app/+native-intent.tsx`](/app/+native-intent.tsx)
- [`global.css`](/musclog/global.css)
- [`components/website/WebsiteWrapper.web.tsx`](/musclog/components/website/WebsiteWrapper.web.tsx)
- [`components/website/WebsiteProviders.tsx`](/musclog/components/website/WebsiteProviders.tsx)
- [`context/WebModalShellContext.web.tsx`](/musclog/context/WebModalShellContext.web.tsx)
- [`utils/webPhoneFrame.ts`](/musclog/utils/webPhoneFrame.ts)
- [`package.json`](/musclog/package.json)
