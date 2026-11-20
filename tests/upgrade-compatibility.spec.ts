import { expect, test, type Page } from '@playwright/test';
import { readFileSync } from 'fs';

import { legacyForwardPath, localePrefixesFor } from '../components/website/localeRoutes';
import { fixedPageSeo } from '../components/website/websiteMetadata';
import websiteRoutes from '../components/website/websiteRoutes.json';

const base =
  process.env.MUSCLOG_TEST_BASE_URL ?? `http://localhost:${process.env.MUSCLOG_TEST_PORT ?? 8081}`;
const ORIGIN = 'https://musclog.app';

/** Parses an exported page in the browser and reads the head tags the checks below look at. */
function readMetadata(page: Page, source: string) {
  return page.evaluate((html) => {
    const document = new DOMParser().parseFromString(html, 'text/html');
    return {
      titles: [...document.querySelectorAll('title')].map((node) => node.textContent),
      descriptions: [...document.querySelectorAll('meta[name="description"]')].map((node) =>
        node.getAttribute('content')
      ),
      canonicals: [...document.querySelectorAll('link[rel="canonical"]')].map((node) =>
        node.getAttribute('href')
      ),
      robots: document.querySelector('meta[name="robots"]')?.getAttribute('content'),
      openGraph: document.querySelector('meta[property="og:title"]')?.getAttribute('content'),
      twitter: document.querySelector('meta[name="twitter:card"]')?.getAttribute('content'),
      scripts: document.querySelectorAll('script[src]').length,
      schemas: [...document.querySelectorAll('script[type="application/ld+json"]')].map((node) =>
        JSON.parse(node.textContent ?? 'null')
      ),
    };
  }, source);
}

test.describe('SDK 58 compatibility', () => {
  test.setTimeout(60000);
  test('static HTML contains metadata, structured data, and hydration assets', async ({
    page,
    request,
  }) => {
    const sitemap = readFileSync('public/sitemap.xml', 'utf8');
    const sitemapPaths = [...sitemap.matchAll(/<loc>(.*?)<\/loc>/g)].map(
      (match) => new URL(match[1]).pathname
    );
    const registeredPaths = Object.values(websiteRoutes).map((route) => route.path);
    // `/open` and `/test` are deliberately unprefixed: real pages with their own metadata.
    const unprefixedByDesign = registeredPaths.filter(
      (path) => localePrefixesFor(path).length === 0
    );
    // Every other registered path is an unprefixed address: it serves the English page, whose canonical is its /en/… twin.
    const legacyPaths = registeredPaths.filter((path) => localePrefixesFor(path).length > 0);

    for (const path of new Set([...sitemapPaths, ...unprefixedByDesign])) {
      const response = await request.get(`${base}${path}`);
      expect(response.ok(), path).toBe(true);
      const metadata = await readMetadata(page, await response.text());
      expect(metadata.titles, path).toHaveLength(1);
      expect(metadata.titles[0], path).toBeTruthy();
      expect(metadata.descriptions, path).toHaveLength(1);
      expect(metadata.canonicals, path).toEqual([`${ORIGIN}${path}`]);
      expect(metadata.scripts, path).toBeGreaterThan(0);
      expect(metadata.openGraph, path).toBeTruthy();
      expect(metadata.twitter, path).toBe('summary_large_image');
      expect(metadata.schemas.length, path).toBeGreaterThan(0);
      if (path === '/test') {
        expect(metadata.robots).toContain('noindex');
      }
    }

    for (const path of new Set(legacyPaths)) {
      const response = await request.get(`${base}${path}`);
      expect(response.ok(), path).toBe(true);
      const metadata = await readMetadata(page, await response.text());
      expect(metadata.canonicals, path).toEqual([`${ORIGIN}${legacyForwardPath(path)}`]);
    }
  });

  test('blog deep loads and navigation retain their loader data', async ({ page }) => {
    test.setTimeout(180000);
    await page.goto(`${base}/en/blog`, { timeout: 120000 });
    await expect(page.locator('main h1')).toBeVisible();
    const post = page.locator('main h2 a').first();
    const href = await post.getAttribute('href');
    expect(href).toContain('/blog/');
    await post.click();
    await expect(page.locator('article h1')).toBeVisible();
    await page.reload();
    await expect(page.locator('article h1')).toBeVisible();
    expect(await page.locator('link[rel="canonical"]').count()).toBe(1);
  });

  test('the landing page hydrates and its mobile menu and preferences work', async ({ page }) => {
    await page.goto(`${base}/en`);
    await expect(page.locator('main h1')).toBeVisible();
    await page.getByRole('button', { name: 'Preferences', exact: true }).click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await page.getByRole('tab', { name: 'Theme', exact: true }).click();
    await expect(page.getByRole('radiogroup')).toBeVisible();
    await page.keyboard.press('Escape');
    await page.getByRole('button', { name: 'Open menu', exact: true }).click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('button', { name: 'Open menu', exact: true })).toBeFocused();
    await page.getByRole('button', { name: 'Preferences', exact: true }).click();
    await page.getByRole('tab', { name: 'Language', exact: true }).click();
    await page.getByText('Español', { exact: true }).click();
    await expect(page).toHaveTitle(fixedPageSeo('home', 'es-es').title);
    // Static export metadata stays in the DOM; the client-side Head adds an updated twin after it.
    await expect(page.locator('meta[name="description"]').last()).toHaveAttribute(
      'content',
      fixedPageSeo('home', 'es-es').description
    );
    await expect(page.locator('link[rel="canonical"]').last()).toBeAttached();
  });

  test('the web app seeds a fresh database and opens nutrition and workouts', async ({ page }) => {
    test.setTimeout(180000);
    await page.goto(`${base}/app/onboarding/landing?demoModeEnabled=true`);
    await page.waitForURL(/\/app\/?$/, { timeout: 120000 });
    await page.goto(`${base}/app/nutrition/food`);
    // A fresh database has no food logged, so the diary shows its empty state instead of the
    // scan buttons.
    await expect(page.getByRole('button', { name: 'Log your meal' })).toBeVisible({
      timeout: 30000,
    });
    await page.goto(`${base}/app/workout/workouts`);
    await expect(page.getByText('My workouts', { exact: true }).first()).toBeVisible({
      timeout: 30000,
    });
    await page.reload();
    await expect(page.getByText('My workouts', { exact: true }).first()).toBeVisible({
      timeout: 30000,
    });
  });

  test.describe('unprefixed addresses', () => {
    /** The development server forwards unprefixed addresses instead, so skip without the built copy. */
    async function requireBuiltDist(request: import('@playwright/test').APIRequestContext) {
      const response = await request.get(`${base}/tools/one-rep-max`);
      const html = await response.text();
      test.skip(
        !html.includes('id="musclog-unprefixed"'),
        'needs the built dist (npm run build-android-web): the development server forwards unprefixed addresses instead'
      );
    }

    const HYDRATION_ERROR = /hydrat|Minified React error #(418|423|425)/i;

    test('an unprefixed address renders English and settles on /en without a reload', async ({
      page,
      request,
    }) => {
      test.setTimeout(120000);
      await requireBuiltDist(request);
      const pageErrors: Error[] = [];
      const consoleErrors: string[] = [];
      let documentRequests = 0;
      page.on('pageerror', (error) => pageErrors.push(error));
      page.on('console', (message) => {
        if (message.type() === 'error') {
          consoleErrors.push(message.text());
        }
      });
      page.on('request', (req) => {
        if (req.resourceType() === 'document') {
          documentRequests += 1;
        }
      });

      await page.goto(`${base}/tools/one-rep-max?x=1#top`);
      await expect(page).toHaveURL(`${base}/en/tools/one-rep-max?x=1#top`);
      await expect(page.locator('main h1')).toBeVisible();
      await expect(page.locator('html')).toHaveAttribute('lang', 'en');
      expect(documentRequests).toBe(1);

      await page.getByRole('button', { name: 'Preferences', exact: true }).click();
      await page.getByRole('tab', { name: 'Language', exact: true }).click();
      // The picker keeps the query and hash; the link also proves the router read the patched URL.
      await expect(page.locator('a[hreflang="es"]')).toHaveAttribute(
        'href',
        '/es/tools/one-rep-max?x=1#top'
      );

      expect(pageErrors).toEqual([]);
      expect(consoleErrors.filter((text) => HYDRATION_ERROR.test(text))).toEqual([]);
    });

    test("a stored non-English language opens that language's page", async ({ page, request }) => {
      test.setTimeout(120000);
      await requireBuiltDist(request);
      const pageErrors: Error[] = [];
      const consoleErrors: string[] = [];
      page.on('pageerror', (error) => pageErrors.push(error));
      page.on('console', (message) => {
        if (message.type() === 'error') {
          consoleErrors.push(message.text());
        }
      });
      await page.context().addInitScript(() => {
        try {
          window.localStorage.setItem('musclog_lang', 'es-ES');
        } catch {}
      });

      await page.goto(`${base}/tools/one-rep-max?x=1`);
      await expect(page).toHaveURL(`${base}/es/tools/one-rep-max?x=1`);
      await expect(page.locator('html')).toHaveAttribute('lang', 'es');
      await expect(page.locator('main h1')).toBeVisible();

      await page.goto(`${base}/blog`);
      await expect(page).toHaveURL(`${base}/en/blog`);
      await expect(page.locator('main h1')).toBeVisible();

      expect(pageErrors).toEqual([]);
      expect(consoleErrors.filter((text) => HYDRATION_ERROR.test(text))).toEqual([]);
    });

    test('unprefixed addresses are readable without JavaScript', async ({ browser, request }) => {
      test.setTimeout(120000);
      await requireBuiltDist(request);
      const context = await browser.newContext({ javaScriptEnabled: false });
      try {
        const cases = [
          { path: '/tools/one-rep-max', canonical: `${ORIGIN}/en/tools/one-rep-max` },
          { path: '/', canonical: `${ORIGIN}/en` },
          { path: '/home', canonical: `${ORIGIN}/en` },
        ];
        for (const { path, canonical } of cases) {
          const page = await context.newPage();
          await page.goto(`${base}${path}`);
          await expect(page).toHaveURL(`${base}${path}`);
          await expect(page.locator('main h1')).toBeVisible();
          await expect(page.locator('main h1')).not.toHaveText('');
          await expect(page.locator('meta[property="og:title"]')).toHaveAttribute('content', /.+/);
          await expect(page.locator('link[rel="canonical"]')).toHaveCount(1);
          await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', canonical);
          await page.close();
        }
      } finally {
        await context.close();
      }
    });
  });
});
