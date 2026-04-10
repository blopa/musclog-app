import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testMatch: ['**/tests/screenshot-automation.spec.ts'],
  timeout: 1200000,
  use: {
    ...devices['iPhone 14'],
    headless: true,
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['iPhone 14'] },
    },
  ],
});
