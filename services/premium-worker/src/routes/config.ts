import type { Ctx } from '../context';
import { jsonResponse } from '../http';

/** GET /v1/config: public, no auth. `accepting_new` is the cron's meta flag (plan 13 row 5). */
export async function handleConfig(_request: Request, ctx: Ctx): Promise<Response> {
  const row = await ctx.env.DB.prepare(`SELECT value FROM meta WHERE key = 'accepting_new'`).first<{
    value: string;
  }>();
  const c = ctx.config;
  return jsonResponse({
    enabled: true,
    accepting_new: row?.value !== '0',
    vision_enabled: c.vision_enabled,
    image: {
      maxPx: c.image.max_px,
      maxBytes: c.image.max_bytes,
      quality: c.image.quality,
      maxImages: c.image.max_images,
      bodyMaxBytes: c.limits.body_max_bytes,
    },
    // This Worker accepts `reasoning_effort` in a request body. An app sends it only when this is
    // true, so an app that is newer than the deployed Worker never gets a 400 for an unknown field.
    reasoning_effort: true,
    minAppVersion: c.min_app_version,
  });
}

/** Kill switch or invalid config (the router decides): the app hides every hosted affordance. */
export function handleConfigDisabled(): Response {
  return jsonResponse({
    enabled: false,
    accepting_new: false,
    vision_enabled: false,
    image: null,
    reasoning_effort: false,
    minAppVersion: null,
  });
}
