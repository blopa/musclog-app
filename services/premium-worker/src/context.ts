import type { AiConfig } from './config';
import type { Deps } from './deps';
import type { Env } from './env';

/** What every route and cron job receives. */
export interface Ctx {
  env: Env;
  config: AiConfig;
  deps: Deps;
  /** For waitUntil (settlement must survive a client disconnect). */
  exec: ExecutionContext;
}
