import { applyD1Migrations, env } from 'cloudflare:test';

// Applied once per test file; applyD1Migrations skips migrations that already ran.
await applyD1Migrations(env.DB, env.TEST_MIGRATIONS);
