/**
 * The one definition of the public website's locale URLs: which languages exist, how a page's
 * path gets its language prefix, which pages are translated, and the `hreflang` set of a page.
 *
 * Every public page lives under a language prefix, English included (`/en/tools/protein-calculator`,
 * `/es/tools/protein-calculator`, `/pt-br/…`). An address with no prefix (`/tools/protein-calculator`) shows the English page: after the static export `scripts/write-unprefixed-pages.js` copies each English page to its unprefixed twin and gives it an inline script that settles the address (in place to `/en/…`, or to the page of the language the visitor chose before).
 *
 * This is plain CommonJS because `scripts/generate-web-seo-files.js` and
 * `scripts/write-unprefixed-pages.js` run outside the app bundle and must read the same rules the
 * router and the components use (the arrangement `blogRoutes.js` and `programRoutes.js` already
 * have). Paths passed in here are LOGICAL paths, the ones `websiteRoutes.json` lists
 * (`/tools/protein-calculator`, `/`): the prefix is added by `localizedPath`, never written by hand.
 *
 * Which pages each locale gets is `locales` in `websiteRoutes.json`: omitted means every locale,
 * `"en"` means English only (the blog), `"none"` means no prefix at all (`/open`, whose exact path
 * the app's link claim names, and the test page). A path that is not under a registered route is
 * not a website page (`/app`, `/images`, `/downloads`) and is never touched.
 */

const websiteRoutes = require('./websiteRoutes.json');

/**
 * `prefix` is the URL segment, `hreflang` what search engines are told (Portuguese is the Brazilian
 * translation, so it carries the region; the rest cover every region), `language` the i18n resource
 * key and `ogLocale` Open Graph's spelling.
 */
const WEBSITE_LOCALES = [
  { prefix: 'en', hreflang: 'en', language: 'en-US', ogLocale: 'en_US' },
  { prefix: 'es', hreflang: 'es', language: 'es-ES', ogLocale: 'es_ES' },
  { prefix: 'nl', hreflang: 'nl', language: 'nl-NL', ogLocale: 'nl_NL' },
  { prefix: 'pt-br', hreflang: 'pt-BR', language: 'pt-BR', ogLocale: 'pt_BR' },
  { prefix: 'ru', hreflang: 'ru', language: 'ru-RU', ogLocale: 'ru_RU' },
  { prefix: 'de', hreflang: 'de', language: 'de-DE', ogLocale: 'de_DE' },
  { prefix: 'fr', hreflang: 'fr', language: 'fr-FR', ogLocale: 'fr_FR' },
  { prefix: 'it', hreflang: 'it', language: 'it-IT', ogLocale: 'it_IT' },
  { prefix: 'pl', hreflang: 'pl', language: 'pl-PL', ogLocale: 'pl_PL' },
  { prefix: 'tr', hreflang: 'tr', language: 'tr-TR', ogLocale: 'tr_TR' },
];

const DEFAULT_LOCALE_PREFIX = 'en';
const X_DEFAULT = 'x-default';

const LOCALE_BY_PREFIX = new Map(WEBSITE_LOCALES.map((locale) => [locale.prefix, locale]));

function isLocalePrefix(value) {
  return typeof value === 'string' && LOCALE_BY_PREFIX.has(value);
}

function localeByPrefix(prefix) {
  return LOCALE_BY_PREFIX.get(prefix) ?? WEBSITE_LOCALES[0];
}

/** The locale an i18n language tag (`es-ES`, `pt-br`, `ru`) belongs to; English when unknown. */
function localeForLanguage(language) {
  const tag = String(language ?? '').toLowerCase();
  const exact = WEBSITE_LOCALES.find((locale) => locale.language.toLowerCase() === tag);
  if (exact) {
    return exact;
  }

  const primary = tag.split('-')[0];
  return (
    WEBSITE_LOCALES.find((locale) => locale.language.toLowerCase().split('-')[0] === primary) ??
    localeByPrefix(DEFAULT_LOCALE_PREFIX)
  );
}

/** Splits `/tools/x?y=1#z` into the path and the `?…#…` tail, which is never rewritten. */
function splitPath(value) {
  const match = /^([^?#]*)(.*)$/.exec(String(value));
  const rawPath = match[1] || '/';
  const path = rawPath.length > 1 ? rawPath.replace(/\/+$/, '') || '/' : rawPath;
  return { path: path.startsWith('/') ? path : `/${path}`, tail: match[2] };
}

const registeredRoutes = Object.values(websiteRoutes);

/**
 * `'all'`, `'en'` or `'none'` for a logical path, or `null` when it is not a website page. An exact
 * registry match wins; otherwise the nearest registered ancestor decides (`/blog/2026/x` follows
 * `/blog`, `/programs/push-pull-legs` follows `/programs`).
 */
function localeScopeOf(path) {
  const { path: normalized } = splitPath(path);
  let best = null;
  for (const route of registeredRoutes) {
    const isExact = route.path === normalized;
    const isAncestor = route.path !== '/' && normalized.startsWith(`${route.path}/`);
    if ((isExact || isAncestor) && (!best || route.path.length > best.path.length)) {
      best = route;
    }
  }

  return best ? (best.locales ?? 'all') : null;
}

/** The locale prefixes a logical path is published under. */
function localePrefixesFor(path) {
  const scope = localeScopeOf(path);
  if (scope === 'all') {
    return WEBSITE_LOCALES.map((locale) => locale.prefix);
  }

  return scope === 'en' ? [DEFAULT_LOCALE_PREFIX] : [];
}

/**
 * The public URL path of a logical path in a locale. A page with no copy in that locale is linked in
 * English (the blog), and an address that is not a website page (or is deliberately unprefixed, like
 * `/open`) comes back as it was. Query and hash are kept.
 */
function localizedPath(path, prefix = DEFAULT_LOCALE_PREFIX) {
  const { path: logical, tail } = splitPath(path);
  const available = localePrefixesFor(logical);
  if (available.length === 0) {
    return `${logical}${tail}`;
  }

  const chosen = available.includes(prefix) ? prefix : DEFAULT_LOCALE_PREFIX;
  return `/${chosen}${logical === '/' ? '' : logical}${tail}`;
}

/** `/es/tools/x?y#z` -> `{ locale: <es>, path: '/tools/x', tail: '?y#z' }`; `locale` is null when unprefixed. */
function parsePublicPath(pathname) {
  const { path, tail } = splitPath(pathname);
  const [, first = '', ...rest] = path.split('/');
  if (isLocalePrefix(first)) {
    return {
      locale: localeByPrefix(first),
      path: rest.length > 0 ? `/${rest.join('/')}` : '/',
      tail,
    };
  }

  return { locale: null, path, tail };
}

/** The logical path of a public one: the language prefix removed, anything else untouched. */
function stripLocalePrefix(pathname) {
  return parsePublicPath(pathname).path;
}

/**
 * The hreflang set of a logical path as `[hreflang, urlPath]` pairs, `x-default` last. Empty for a
 * page that has one language only: a lone `hreflang` would claim an alternate that does not exist.
 * Every translated page returns the SAME set, which is what makes the annotations reciprocal.
 */
function hreflangAlternatePaths(path) {
  if (localeScopeOf(path) !== 'all') {
    return [];
  }

  return [
    ...WEBSITE_LOCALES.map((locale) => [locale.hreflang, localizedPath(path, locale.prefix)]),
    [X_DEFAULT, localizedPath(path, DEFAULT_LOCALE_PREFIX)],
  ];
}

/**
 * The English `/en/…` address of an unprefixed one, query and hash kept (the development server forwards there; the build copies that page to the unprefixed address instead). `null` when
 * the address already has a prefix, is not a website page, or is deliberately unprefixed.
 */
function legacyForwardPath(pathname, search = '', hash = '') {
  const parsed = parsePublicPath(pathname);
  if (parsed.locale || localePrefixesFor(parsed.path).length === 0) {
    return null;
  }

  return `${localizedPath(parsed.path, DEFAULT_LOCALE_PREFIX)}${search}${hash}`;
}

module.exports = {
  DEFAULT_LOCALE_PREFIX,
  WEBSITE_LOCALES,
  X_DEFAULT,
  hreflangAlternatePaths,
  isLocalePrefix,
  legacyForwardPath,
  localeByPrefix,
  localeForLanguage,
  localePrefixesFor,
  localeScopeOf,
  localizedPath,
  parsePublicPath,
  splitPath,
  stripLocalePrefix,
};
