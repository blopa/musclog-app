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
    // Every other registered path is an OLD address: a static page that forwards to English.
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
});
