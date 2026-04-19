export const MUSCLOG_GATEWAY_BASE_URL = process.env.EXPO_PUBLIC_MUSCLOG_GATEWAY_BASE_URL ?? '';
export const MUSCLOG_GATEWAY_AUTH_TOKEN = `Bearer ${process.env.EXPO_PUBLIC_MUSCLOG_GATEWAY_AUTH_TOKEN ?? ''}`;
export const MUSCLOG_GATEWAY_MODEL = process.env.EXPO_PUBLIC_MUSCLOG_GATEWAY_MODEL ?? 'google-ai-studio/gemini-2.5-flash';
// Alias of the provider key stored in Cloudflare AI Gateway's BYOK dashboard.
// Cloudflare injects it server-side — no provider key is shipped in the app.
export const MUSCLOG_GATEWAY_BYOK_ALIAS = process.env.EXPO_PUBLIC_MUSCLOG_GATEWAY_BYOK_ALIAS ?? 'default';
