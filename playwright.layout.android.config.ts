import { defineConfig } from '@playwright/test';

import { loadAuditProfiles } from './tests/layoutAudit/devices';

/**
 * Layout audit on a connected Android device (no browser involved). Run through
 * `npm run layout:audit:android`; see tests/layout-audit-android.spec.ts for the prerequisites.
 * Profiles run one after another, since they all change the same device's display.
 */
export default defineConfig({
  testMatch: ['**/tests/layout-audit-android.spec.ts'],
  timeout: 3_600_000,
  workers: 1,
  fullyParallel: false,
  globalSetup: './tests/layoutAudit/globalSetup.ts',
  globalTeardown: './tests/layoutAudit/globalTeardown.ts',
  reporter: [['list']],
  projects: loadAuditProfiles().map((profile) => ({ name: `android-${profile.id}` })),
});
