import { defineConfig } from '@playwright/test';

export default defineConfig({
  testMatch: '**/tests/progression-flow.spec.ts',
  timeout: 180000,
  expect: { timeout: 20000 },
  workers: 1,
  use: {
    baseURL: process.env.MUSCLOG_TEST_URL ?? 'http://localhost:8093',
    headless: true,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'phone-large-text',
      use: { viewport: { width: 414, height: 896 }, colorScheme: 'dark' },
    },
    { name: 'small-dark', use: { viewport: { width: 360, height: 780 }, colorScheme: 'dark' } },
    { name: 'phone-light', use: { viewport: { width: 414, height: 896 }, colorScheme: 'light' } },
    {
      name: 'tablet-comma',
      use: { viewport: { width: 820, height: 1180 }, colorScheme: 'dark', locale: 'nl-NL' },
    },
  ],
});
