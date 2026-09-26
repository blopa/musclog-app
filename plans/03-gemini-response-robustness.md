# Gemini response robustness (thinking models, timeouts, first scan)

## Goal

Make AI food scans and coach calls through Gemini never stay on "analyzing" forever, and parse
Gemini 3 / "thinking" responses correctly.

## What already exists

- [utils/gemini.ts](../utils/gemini.ts): `configureBasicGenAI` wraps `@google/genai` (2.24.0) and
  spreads a caller-provided `generationConfig` into `config`. There is no timeout and no abort
  signal.
- [constants/ai.ts](../constants/ai.ts) lists `gemini-3-pro-preview` and
  `gemini-3-flash-preview` next to the 2.5 family.
- [utils/coachAI.ts](../utils/coachAI.ts) `extractRawText(response)` returns
  `response.text ?? candidates[0].content.parts[0].text`. A thinking model can return several
  parts (thought summaries plus answer text), so `parts[0]` may be the wrong part.
- An empty result makes `generateStructured` return `null` silently, with no reason recorded
  (safety block, `MAX_TOKENS`, and so on).
- A "thinking mode" setting (`SettingsService.getUseThinkingMode`) exists for meal tracking.
- `withLlmRetry` retries 429/503/529 with backoff (1s, 2s, 4s).

## Design

### 1. Text extraction

Replace `extractRawText` with `extractGeminiText(response)`:

- Prefer the SDK's `response.text` getter. **Verify** in the installed SDK that it joins every text
  part and skips `thought: true` parts. If it does, the fallback only matters for mocks and the
  gateway.
- Fallback: take `candidates[0].content.parts`, drop parts with `thought === true` or no `text`,
  and join the rest. Never just take `parts[0]`.
- Return `{ text, finishReason, blockReason }` so callers can tell "empty because blocked" from
  "empty because truncated". Map `SAFETY`/`PROHIBITED_CONTENT` to a user message ("The image
  couldn't be analyzed") and `MAX_TOKENS` to a retry-once with a larger `maxOutputTokens`.

### 2. Model-aware generation config

Add `buildGeminiGenerationConfig(model, { json, schema, thinking })` in `utils/gemini.ts`:

- Gemini 3 models use `thinkingConfig.thinkingLevel`; Gemini 2.5 uses
  `thinkingConfig.thinkingBudget`. Sending the wrong field (or both) can be rejected or ignored.
  **Check both against the current Gemini API docs before coding**; the parameter names have
  changed across preview releases.
- For structured JSON calls (food scan, meal parse), use low or no thinking on Flash / Flash-Lite
  and keep the user's thinking-mode setting as the explicit override.
- Put the table in one place: `GEMINI_MODEL_CAPABILITIES` keyed by model family, next to
  `GEMINI_MODELS`.

### 3. Timeouts and cancellation

- Pass a per-request timeout through `httpOptions.timeout` (supported by `@google/genai`; confirm
  the unit is ms) and an `AbortSignal` in `config.abortSignal`.
- Defaults: 45s for image analysis, 30s for text. A timeout throws `AiTimeoutError`, which the UI
  shows as "This is taking too long. Try again", with a retry button.
- `withLlmRetry`: retry a timeout **once**, not three times; a stalled request usually stays
  stalled.
- Add a Cancel button to the scan-in-progress UI that aborts the controller. The OpenAI client
  accepts a `signal` too; use the same mechanism for both providers.

### 4. First scan after a cold start

- Add phase timing logs to the AI photo path, like the ones `useCameraCaptureFlow` already emits:
  `image-prep`, `settings-read`, `request`, `parse`. That way a slow first scan shows which step is
  slow in a release build (`adb logcat`).
- Likely suspects to measure (not assume): the first `ImageManipulator` resize/base64 encode, and
  several sequential `SettingsService` reads in `AiService.getAiConfig` (each awaits separately).
  Read them in parallel with `Promise.all`, and cache the resolved config until a setting changes.
- Given the SecureStore queue stall in `AGENTS.md`, confirm that no SecureStore read (API keys are
  stored encrypted) runs on the shared Expo module queue on the scan path.

## Tests

- `utils/__tests__/geminiText.test.ts`: multi-part response with a thought part first → only the
  answer text; all-thought response → empty with a reason; `SAFETY` block → blockReason set.
- `utils/__tests__/geminiGenerationConfig.test.ts`: Gemini 3 gets `thinkingLevel`, 2.5 gets
  `thinkingBudget`, never both.
- `withLlmRetry`: timeout retried once; auth errors never (see plan 02).

## Docs

- `AGENTS.md` → AI & LLM Integration: "Gemini text goes through `extractGeminiText`; generation
  config through `buildGeminiGenerationConfig`."
- `FIXES.md` entry if the cold-start measurement finds a real cause.
