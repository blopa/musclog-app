/**
 * Shapes a free-tier OpenRouter request body. The free tier is Google AI Studio's unpaid endpoint,
 * which retains and may train on what it receives, so the body is made authoritative here:
 * - `provider` is exactly `{ only: [slug], allow_fallbacks: false }` (any `provider` already on the
 *   body is replaced; in particular never `zdr` or `data_collection: 'deny'`, which no free endpoint
 *   satisfies, and no other provider or OpenRouter's shared capacity may serve it);
 * - no `models` fallback list, no `plugins` (web search included);
 * - `max_tokens` is set to `maxTokens` when the request names no output limit.
 * A body that is not a JSON object string is returned untouched.
 */
export function withGatewayProviderPin<T>(body: T, slug: string, maxTokens?: number): T | string {
  if (typeof body !== 'string' || !slug) {
    return body;
  }

  try {
    const parsed: unknown = JSON.parse(body);
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
      return body;
    }

    const { models: _models, plugins: _plugins, ...rest } = parsed as Record<string, unknown>;
    const next: Record<string, unknown> = {
      ...rest,
      provider: { only: [slug], allow_fallbacks: false },
    };
    if (
      maxTokens !== undefined &&
      next.max_tokens === undefined &&
      next.max_completion_tokens === undefined
    ) {
      next.max_tokens = maxTokens;
    }

    return JSON.stringify(next);
  } catch {
    return body;
  }
}
