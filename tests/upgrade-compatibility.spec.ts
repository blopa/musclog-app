import { expect, test } from '@playwright/test';
import { readFileSync } from 'fs';

import websiteRoutes from '../components/website/websiteRoutes.json';
import { fixedPageSeo } from '../components/website/websiteMetadata';

const base =
  process.env.MUSCLOG_TEST_BASE_URL ?? `http://localhost:${process.env.MUSCLOG_TEST_PORT ?? 8081}`;

test.describe('SDK 58 compatibility', () => {
  test.setTimeout(60000);
  test('static HTML contains metadata, structured data, and hydration assets', async ({
    page,
    request,
  }) => {
    const sitemap = readFileSync('public/sitemap.xml', 'utf8');
    const paths = new Set([
      ...Object.values(websiteRoutes).map((route) => route.path),
      ...[...sitemap.matchAll(/<loc>(.*?)<\/loc>/g)].map((match) => new URL(match[1]).pathname),
    ]);
    for (const path of paths) {
      const response = await request.get(`${base}${path}`);
      expect(response.ok(), path).toBe(true);
      const html = await response.text();
      const metadata = await page.evaluate((source) => {
        const document = new DOMParser().parseFromString(source, 'text/html');
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
          schemas: [...document.querySelectorAll('script[type="application/ld+json"]')].map(
            (node) => JSON.parse(node.textContent ?? 'null')
          ),
        };
      }, html);
      expect(metadata.titles, path).toHaveLength(1);
      expect(metadata.titles[0], path).toBeTruthy();
      expect(metadata.descriptions, path).toHaveLength(1);
      expect(metadata.canonicals, path).toEqual([`https://musclog.app${path}`]);
      expect(metadata.scripts, path).toBeGreaterThan(0);
      expect(metadata.openGraph, path).toBeTruthy();
      expect(metadata.twitter, path).toBe('summary_large_image');
      expect(metadata.schemas.length, path).toBeGreaterThan(0);
      if (path === '/test') {
        expect(metadata.robots).toContain('noindex');
      }
    }
  });

  test('blog deep loads and navigation retain their loader data', async ({ page }) => {
    test.setTimeout(180000);
    await page.goto(`${base}/blog`, { timeout: 120000 });
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
    await page.goto(`${base}/`);
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
    await expect(page.locator('meta[name="description"]')).toHaveAttribute(
      'content',
      fixedPageSeo('home', 'es-es').description
    );
    expect(await page.locator('link[rel="canonical"]').count()).toBe(1);
  });

  test('the web app seeds a fresh database and opens nutrition and workouts', async ({ page }) => {
    test.setTimeout(180000);
    await page.goto(`${base}/app/onboarding/landing?demoModeEnabled=true`);
    await page.waitForURL(/\/app\/?$/, { timeout: 120000 });
    await page.goto(`${base}/app/nutrition/food`);
    await expect(page.getByRole('button', { name: 'Scan Barcode' })).toBeVisible({
      timeout: 30000,
    });
    await page.goto(`${base}/app/workout/workouts`);
    await expect(page.getByText('My Workouts', { exact: true }).first()).toBeVisible({
      timeout: 30000,
    });
    await page.reload();
    await expect(page.getByText('My Workouts', { exact: true }).first()).toBeVisible({
      timeout: 30000,
    });
  });
});
