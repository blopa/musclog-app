import { defineConfig } from '@playwright/test';

import { loadAuditProfiles } from './tests/layoutAudit/devices';

/**
 * Layout audit of the web build at the phone sizes in docs/SCREEN_SIZES.md. Run through
 * `npm run layout:audit`; `MUSCLOG_LAYOUT_SET=quick|phones|all` picks how many profiles.
 * See the Layout audit section of docs/DESIGN.md.
 */
export default defineConfig({
  testMatch: ['**/tests/layout-audit.spec.ts'],
  timeout: 3_600_000,
  fullyParallel: true,
  workers: Number(process.env.MUSCLOG_LAYOUT_WORKERS ?? 2),
  globalSetup: './tests/layoutAudit/globalSetup.ts',
  globalTeardown: './tests/layoutAudit/globalTeardown.ts',
  reporter: [['list']],
  use: {
    headless: true,
    hasTouch: true,
    // For a machine whose installed Chromium is not the build this Playwright version expects.
    launchOptions: process.env.MUSCLOG_CHROMIUM_PATH
      ? { executablePath: process.env.MUSCLOG_CHROMIUM_PATH }
      : {},
  },
  projects: loadAuditProfiles().map((profile) => ({
    name: profile.id,
    use: {
      viewport: profile.viewport,
      deviceScaleFactor: profile.deviceScaleFactor,
    },
  })),
});
