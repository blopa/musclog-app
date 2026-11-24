import { applyD1Migrations, env } from 'cloudflare:test';
import { beforeEach } from 'vitest';

import { resetUpstreamCache } from '../src/upstream/select';

// Applied once per test file; applyD1Migrations skips migrations that already ran.
await applyD1Migrations(env.DB, env.TEST_MIGRATIONS);

// The toggle is cached per isolate; every test starts from a fresh read.
beforeEach(() => {
  resetUpstreamCache();
});
