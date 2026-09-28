# Clear message when the AI API key is wrong

## Goal

When the user's own Gemini or OpenAI key is invalid, revoked, or lacks permission, say exactly that
and send them to AI settings. Right now it shows as a generic "something went wrong".

## What already exists

- [utils/coachAI.ts](../utils/coachAI.ts) classifies errors with `getErrorStatus`,
  `getErrorCode`, `getErrorMessage`, `isQuotaStyleError` and `isAiCreditsError`. It retries 429,
  503 and 529 via `withLlmRetry`, and reports through `reportAiError` (Sentry is skipped for
  credit/rate-limit errors).
- `AiCreditsError` and `GatewayRateLimitError` are the typed errors the UI understands.
- [hooks/useChatMessages.ts](../hooks/useChatMessages.ts) (around the `sendMessage` catch) maps
  errors to either `coach.errors.creditsExhausted` or `coach.errors.generalError`. Nothing covers
  auth failures.
- [services/AiService.ts](../services/AiService.ts) resolves which provider is active.

There is no auth-error classification anywhere. The main trap: **Gemini returns HTTP 400**
(`INVALID_ARGUMENT`, reason `API_KEY_INVALID`, message "API key not valid") for a bad key, not 401. A status-only check will miss it, and a naive "all 400s are key errors" rule would mislabel
malformed requests.

## Design

1. In `utils/coachAI.ts`, add `isInvalidApiKeyError(error)`, which returns true when any of these
   holds:
   - status `401`, or status `403` with a permission/key message;
   - OpenAI `code === 'invalid_api_key'`;
   - Gemini status `400` **and** the message or `error.details[].reason` contains
     `API_KEY_INVALID` / "API key not valid" / "API key expired".

   Keep it narrow: a 400 without a key signal stays a normal error. Record real error payloads
   from both SDKs as fixtures (`@google/genai` 2.24.0, `openai` 7.21.0) instead of guessing their
   shape.

2. Add `class AiInvalidKeyError extends Error { provider: CoachAIProvider }` next to
   `AiCreditsError`.
3. In every `catch` in `coachAI.ts` that currently checks `isAiCreditsError`, first check
   `isInvalidApiKeyError` and throw `AiInvalidKeyError`, but only for providers where the user
   supplies the key (`gemini`, `openai`, and `local` when a key is set). Gateway and on-device
   errors never become this error. There are many catch sites (roughly 20), so put the mapping in
   one helper, `toUserFacingAiError(error, config)`, and call that instead of copying the checks
   into each.
4. `shouldRetryLlmError` must never retry an auth error (it doesn't today, since 400/401/403 aren't
   in `RETRYABLE_LLM_STATUSES`; add a test to keep it that way).
5. Don't send auth errors to Sentry, for the same reason as credit errors: they're user
   configuration problems, not bugs. Extend `reportAiError`.
6. UI:
   - `useChatMessages`: map `AiInvalidKeyError` to a new
     `coach.errors.invalidApiKey` ("Your {{provider}} API key was rejected. Check it in AI
     settings.") plus an "Open AI settings" action. The coach already opens AI settings from
     `AINotConfiguredModal`; reuse that path.
   - Smart camera AI photo / label flows
     ([components/modals/SmartCameraModal.tsx](../components/modals/SmartCameraModal.tsx)): the
     same message in the error snackbar.
   - Any other screen that calls coachAI (meal plan, workout generation, insights) gets it for free
     if it already shows the thrown message; otherwise map it the same way.
7. Optional, but it pays off: add a **"Test key"** button in
   [components/modals/AISettingsModal.tsx](../components/modals/AISettingsModal.tsx) that makes a
   minimal call (list models, or a one-token generation) and shows ✓, "key rejected", or "network
   error". This catches bad keys during setup instead of on the first scan.

## Tests

- `utils/__tests__/coachAIErrors.test.ts`: Gemini 400 `API_KEY_INVALID` fixture → true; Gemini 400
  schema error → false; OpenAI 401 `invalid_api_key` → true; 429 → false; gateway provider never
  maps to `AiInvalidKeyError`; auth errors are not retried and not sent to Sentry.
- `hooks/__tests__/useChatMessages…`: an `AiInvalidKeyError` produces the new message, not
  `generalError`.

## Docs and translations

- New `coach.errors.invalidApiKey` (+ settings test-key strings) in all five locales.
- `AGENTS.md` → AI & LLM Integration: note `toUserFacingAiError` as the single classification
  point and the Gemini-400 caveat.
- `FUTURE_FEATURES.md`: this partly delivers "precise credential guidance" under provider
  failover; update that bullet.
