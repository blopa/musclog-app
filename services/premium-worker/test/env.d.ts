import type { D1Migration } from 'cloudflare:test';

import type { Env as WorkerEnv } from '../src/env';

// Types `env` from 'cloudflare:test' as the Worker's Env plus the test-only migrations binding.
declare global {
  namespace Cloudflare {
    interface Env extends WorkerEnv {
      TEST_MIGRATIONS: D1Migration[];
    }
  }
}
