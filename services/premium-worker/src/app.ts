// Router and composition root. createApp(makeDeps) lets tests inject fake upstreams; the
// production entry point (src/index.ts) uses defaultDeps.
import * as Sentry from '@sentry/cloudflare';
import type { AiConfig } from './config';
import { parseConfig } from './configSchema';
import type { Ctx } from './context';
import { runDaily, runQuarterHourly } from './cron';
import { defaultDeps, type MakeDeps } from './deps';
import type { Env } from './env';
import { ApiError, errorResponse } from './http';
import { consoleLogger } from './log';
import { handleChatCompletions } from './proxy/chat';
import { handleChallenge } from './routes/challenge';
import { handleConfig, handleConfigDisabled } from './routes/config';
import { handleEnroll } from './routes/enroll';
import { handleSession } from './routes/session';
import { handleUsage } from './routes/usage';

type Handler = (request: Request, ctx: Ctx) => Promise<Response>;

const ROUTES: Record<string, { method: string; handler: Handler }> = {
  '/v1/config': { method: 'GET', handler: handleConfig },
  '/v1/challenge': { method: 'GET', handler: handleChallenge },
  '/v1/enroll': { method: 'POST', handler: handleEnroll },
  '/v1/session': { method: 'POST', handler: handleSession },
  '/v1/usage': { method: 'GET', handler: handleUsage },
  '/v1/chat/completions': { method: 'POST', handler: handleChatCompletions },
};

export const QUARTER_HOURLY_CRON = '*/15 * * * *';
export const DAILY_CRON = '30 0 * * *';

// Parsed once per isolate per config text (a config change is a new deploy, so a new isolate).
let cached: { text: string; env: string; result: ReturnType<typeof parseConfig> } | null = null;
export function loadConfig(env: Env): ReturnType<typeof parseConfig> {
  if (!cached || cached.text !== env.AI_CONFIG_JSON || cached.env !== env.WORKER_ENV) {
    cached = { text: env.AI_CONFIG_JSON, env: env.WORKER_ENV, result: parseConfig(env) };
  }
  return cached.result;
}

/** The answer while hosted AI is off or its config is invalid: the config route gets its own body. */
function disabledResponse(pathname: string): Response {
  if (pathname === '/v1/config') return handleConfigDisabled();
  return errorResponse(503, 'hosted_disabled');
}

export function createApp(makeDeps: MakeDeps = defaultDeps): ExportedHandler<Env> {
  return {
    async fetch(request, env, exec) {
      const url = new URL(request.url);
      const route = ROUTES[url.pathname];
      if (!route) return errorResponse(404, 'not_found');
      if (request.method !== route.method) return errorResponse(405, 'method_not_allowed');

      const parsed = loadConfig(env);
      if (!parsed.ok) {
        // Fail closed: an invalid config never serves (plan section 7).
        consoleLogger().log({
          route: url.pathname,
          status: 503,
          code: 'config_invalid',
          severity: 'high',
        });
        return disabledResponse(url.pathname);
      }
      const config: AiConfig = parsed.config;
      if (env.HOSTED_AI_ENABLED !== 'true') return disabledResponse(url.pathname);

      const ctx: Ctx = { env, config, deps: makeDeps(env, config), exec };
      try {
        return await route.handler(request, ctx);
      } catch (e) {
        if (e instanceof ApiError) return errorResponse(e.status, e.code, e.extra);
        // The router answers 503 itself, so withSentry never sees this error: report it here
        // (src/sentry.ts drops the message and everything from the request).
        Sentry.captureException(e, { tags: { route: url.pathname, code: 'internal' } });
        ctx.deps.log.log({ route: url.pathname, status: 500, code: 'internal', severity: 'error' });
        return errorResponse(503, 'hosted_disabled');
      }
    },

    async scheduled(controller, env, exec) {
      const parsed = loadConfig(env);
      if (!parsed.ok) {
        consoleLogger().log({
          route: 'cron',
          status: 503,
          code: 'config_invalid',
          severity: 'high',
        });
        return;
      }
      // The kill switch does not stop the cron: sweeps and checks keep running.
      const ctx: Ctx = { env, config: parsed.config, deps: makeDeps(env, parsed.config), exec };
      if (controller.cron === DAILY_CRON) await runDaily(ctx);
      else await runQuarterHourly(ctx);
    },
  };
}
