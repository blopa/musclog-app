# P0 spike C: Idempotency-Key per logical LLM request (read-only analysis, no code changed)

Sources read: `utils/coachAI.ts`, `utils/structuredChat.ts`, `services/aiOnboardingTurn.ts`, `node_modules/openai` 7.60.0.
Line numbers are for the current working tree.

## 1. Verdict on plan 8.2 step 2 and section 11 item 2

The plan sets `Idempotency-Key` in `defaultHeaders` inside `buildOpenAIClient`. **Today that happens to give one key per
logical request, but only by coincidence**, and the user's requirement ("generate a key for each logical request, not when
constructing a reusable client") is not what the code guarantees:

- Every OpenAI-compatible call site builds a _fresh_ client for the call (`utils/coachAI.ts:1031, 1400, 1553, 1752, 1971`),
  so a client lives exactly one logical call. A key in `defaultHeaders` would therefore not be shared across two logical calls
  today.
- Nothing enforces that. Any future client cache, a module-level client, or a helper that issues two requests through one
  client (for example a repair pass) would silently reuse the key, and the Worker would answer the second with
  409 `already_processed` or `in_progress`. That fails closed but looks like a random outage.
- The constructor has no knowledge of retries, streaming, or which request is "the same". The seam that does is `withLlmRetry`.

So: generate the key in the retry wrapper, pass it per request. Do not put it in `defaultHeaders`.

## 2. `utils/coachAI.ts` inventory

Retry layers in this file:

- `runWithAbort` (`:205`) runs ONE attempt: a new `AbortController`, a 60 s timer (`LLM_REQUEST_TIMEOUT_MS`, `:195`; idle timeout for
  streams through `touch()`), `AiTimeoutError` on timeout.
- `withLlmRetry(operation, config, request, { hasStreamed })` (`:247`) loops over `runWithAbort`: up to 3 retries after the first
  attempt for status 429/503/529 (`RETRYABLE_LLM_STATUSES` `:145`, delays 1/2/4 s `:146`), plus exactly one retry after a timeout
  (`:288-297`). It does not retry a rejected key, a cancel, or (for streams) once text was shown (`:280`). `request` receives only
  `(signal, touch)`.
- `buildOpenAIClient` (`:379`) passes only `apiKey`, `baseURL`, `dangerouslyAllowBrowser`, `defaultHeaders` (only the Cloudflare
  AI Gateway BYOK alias / user id), `fetch` (dev-web proxy). **It sets no `maxRetries` and no `timeout`**, so the SDK defaults apply:
  `maxRetries` 2 and `timeout` 600000 ms (`node_modules/openai/client.js:241, 251`; `DEFAULT_TIMEOUT = 600000` at `:1824`; docs line `:101`).
  The comment at `coachAI.ts:111` already assumes the 2 SDK retries.

OpenAI-compatible call sites (all go through `chat.completions.create`; `grep` found no other OpenAI use outside
`utils/aiKeyTest.ts:57`, which builds its own client with `maxRetries: 0` and sends a key-test list call, not a logical request):

| Function                                                                                                                                                      | Client built                                 | `withLlmRetry` calls per logical request                   | Request                                             |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------- | ---------------------------------------------------------- | --------------------------------------------------- |
| `sendViaOpenAI` (`:1024`)                                                                                                                                     | `:1031`, outside the loop, before the branch | 1: via `streamOpenAiText` (`:1079`) OR `:1098` (exclusive) | chat                                                |
| `generateText` (`:1309`)                                                                                                                                      | `:1400`                                      | 1: `streamOpenAiText` (`:1418`) OR `:1436`                 | text                                                |
| `generateTextWithHistory` (`:1456`)                                                                                                                           | `:1553`                                      | 1: `streamOpenAiText` (`:1577`) OR `:1595`                 | text with history                                   |
| `requestStructured` (`:1666`, used by `generateStructured` `:1794` and `sendStructuredChatTurn`)                                                              | `:1752`                                      | 1 (`:1780`)                                                | structured                                          |
| `generateWithImageStructured` (`:1840`; used by `extractRecipe` `:2029/2051`, `trackMeal` `:2200`, `estimateNutritionFromPhoto` `:2604`, label photo `:2664`) | `:1971`                                      | 1 (`:2004`)                                                | structured + image                                  |
| `streamOpenAiText` (`:509`)                                                                                                                                   | takes the caller's client                    | 1 (`:516`)                                                 | streaming, `{ ...payload, stream: true }` at `:521` |

Gemini (`:489`, `:1008`, `:1370`, `:1521`, `:1727`, `:1921`) and Claude (`runClaude` `:568/:585`) also use `withLlmRetry` once per
logical request; they are irrelevant to the hosted OpenAI-compatible path but follow the same pattern, which is why the wrapper
is the right seam.

**Result:** every OpenAI-compatible logical request calls `withLlmRetry` exactly once, and the client is built outside it.
`withLlmRetry`'s attempts, and the SDK's own internal retries inside each attempt, all go through the same `client`.

### Nested or repeated calls that are SEPARATE logical requests (each must get its own key)

- `trackMealWithThinking` (`:2094`): `extractRecipe` (1 request) then one `estimateMissingIngredients` request **per meal** in a loop
  (`:2112-2140`). Each goes through `generateStructured`/`generateWithImageStructured`, which builds its own client and calls
  `withLlmRetry` once. They must have different keys, and per-call key generation gives that.
- `runOnboardingTurn` (`services/aiOnboardingTurn.ts:61-92`): `ask(false)`, then if the reply is malformed `ask(true)` with a
  repair note appended to the system prompt. Different body, so a different logical request; reusing the key would be rejected or,
  worse, replay the first answer. Each `ask` calls `sendStructuredChatTurn` → `requestStructured` → one `withLlmRetry`.
- `sendStructuredChatTurn` (`utils/structuredChat.ts:61`) is a single `requestStructured` call, no retry of its own.
- User "send again" after a failed chat (`useChatMessages` restores the composer text) starts a new `sendCoachMessage`, hence a new
  key. That matches plan 8.2: "the lost response" is a new charged request.
- Retries by the caller of `sendCoachMessage` (`services/coachReplyStream.ts:251`): none found; one reply at a time.

## 3. `node_modules/openai` 7.60.0

- **The SDK adds no `Idempotency-Key` for OpenAI.** `buildHeaders` (`client.js:1396-1401`) only emits one when
  `this.idempotencyHeader` is set; nothing in the package assigns it (grep: only those lines read it), so for the OpenAI client it is
  undefined and `options.idempotencyKey` is ignored. (`defaultIdempotencyKey()` at `:444` is dead for OpenAI.) We must send the
  header ourselves.
- **Header precedence:** `buildHeaders` merges, in order, SDK headers, auth, `this._options.defaultHeaders`, body headers,
  then **`options.headers` last** (`client.js:1408-1425`), so a per-request `headers` option wins over `defaultHeaders`.
- **Internal retries reuse the same options object**: `retryRequest(options, …)` (`:1143`) ends with
  `return this.makeRequest(options, retriesRemaining - 1, requestLogID)` (`:1196`), and `makeRequest` rebuilds the request with
  `buildRequest(options, {retryCount})` (`:759`). So a per-request `headers: { 'Idempotency-Key': key }` is identical on every
  internal attempt. The SDK also sends `X-Stainless-Retry-Count` (attempt number) on each attempt (`:1411`), which the Worker can
  log but must not use as part of the key.
- **What the SDK retries** (`shouldRetry`, `:1121-1141`): honors an `x-should-retry: true|false` response header first, then
  408, **409**, 429 and any 5xx; connection errors/timeouts too. Backoff default is short (`calculateDefaultRetryTimeoutMillis`,
  `:1198`), or the `Retry-After` header when ≤ 60 s.
  - **Consequence for the plan:** the Worker's 409 `in_progress` and 409 `already_processed` (plan 8.2) will be retried twice by the
    SDK with the same key, immediately, and `withLlmRetry` will not retry them (409 is not in its set). The Worker should send
    `x-should-retry: false` on 409 `already_processed` (and probably on `in_progress`, using its own `Retry-After`/client handling
    instead), otherwise each 409 triples the load. Alternative: `maxRetries: 0` on the hosted client and let `withLlmRetry` own all
    retries, but `withLlmRetry` does not retry connection errors, so that would lose the SDK's recovery from a dropped connection.
    Prefer the header.
- **Retry budget for one logical request:** up to (1 + 3 `withLlmRetry`) × (1 + 2 SDK) = 12 HTTP attempts, plus one more
  `withLlmRetry` pass after a timeout. With `max_inflight = 2` and one key they are all collapsed by the Worker, which is the point.
- Streaming: the SDK retries only before the response is returned (connection and non-2xx), not mid-stream; `withLlmRetry` also
  stops retrying after the first text (`hasStreamed`, `:280`). A stream cut after first token is therefore never re-sent.

## 4. Smallest concrete design (do not implement in P0)

1. **Create the key in `withLlmRetry`**, once, before the `while (true)` (`coachAI.ts:258`):
   `const idempotencyKey = config.provider === 'hosted' ? randomUUID() : undefined;` (`randomUUID` from `expo-crypto`, as AGENTS.md
   requires). Pass it to the callback as a third argument:
   `request(signal, touch, { idempotencyKey })`. Existing callbacks ignore the extra argument, so Gemini, Claude and every other
   caller are untouched. The key lives exactly as long as one logical request and is reused by every `withLlmRetry` attempt (they all
   close over the same variable).
2. **Hand it to the HTTP layer per request, not `defaultHeaders`.** The six OpenAI call sites change from
   `client.chat.completions.create(payload, { signal })` to `… { signal, headers: hostedHeaders(ctx) }`, where
   `hostedHeaders(ctx)` returns `ctx.idempotencyKey ? { 'Idempotency-Key': ctx.idempotencyKey } : undefined` (a tiny helper in
   `coachAI.ts`). `buildOpenAIClient` keeps only the static `X-Musclog-Client` header in `defaultHeaders`, never the key.
3. **SDK-internal retries** reuse it automatically (same `options`, §3). **`withLlmRetry` retries** reuse it because the key is outside
   the loop. **Streaming:** `streamOpenAiText` passes the same `ctx` through its `request` closure to
   `create({ ...payload, stream: true }, { signal, headers })`; the retry before the first token reuses it, and after the first token
   nothing is re-sent.
4. **Separate logical requests get separate keys with no extra code**, because each calls `withLlmRetry` again: the repair `ask(true)`,
   every `estimateMissingIngredients`, and every user resend.
5. **Server side requirements to state in the contract:** the header is mandatory (400 without); the key is bound to
   `payment_key + req_id` (plan 8.2) and ideally to a SHA-256 of the allowlisted body, so the same key with a different body returns 422
   instead of replaying someone else's answer; the Worker sets `x-should-retry: false` on 409s the client must not blindly retry.

Alternative if changing the `request` callback signature is unwanted: `withLlmRetry` accepts `options.idempotencyKey` created by the
caller, but then each of the six sites must create it before the call. That is more edits for the same behavior, and easier to
forget; the wrapper approach is the smallest.

## 5. Tests that would prove it (jest `node`, mocked `fetch` passed to the OpenAI client via `buildOpenAIClient`'s `fetch` hook or `jest.mock('openai')`)

Existing precedent: `utils/__tests__/llmRetry.test.ts` (fake timers; `withLlmRetry` with stub callbacks) and
`utils/__tests__/coachAIStreaming.test.ts` (mocks `openai`).

1. `withLlmRetry` hosted: callback fails twice with status 503 then succeeds; assert `ctx.idempotencyKey` is defined and **identical on all three calls**.
2. Two sequential `withLlmRetry` calls with the same config: assert two **different** keys (UUID v4 shape).
3. Timeout retry: first attempt times out (fake timers), second succeeds; assert same key.
4. Non-hosted provider (gemini/openai): `ctx.idempotencyKey` is `undefined` and no header is sent (BYOK unchanged, including no header to api.openai.com).
5. End to end through a real `OpenAI` client with a recording `fetch`: the fetch first returns 503 with `x-should-retry: true` (SDK-internal retry),
   then 200; assert both HTTP requests carry the **same** `Idempotency-Key` header, differing `X-Stainless-Retry-Count`.
6. SDK + wrapper interplay: fetch returns 503 three times (SDK exhausts its 2 retries → throws), `withLlmRetry` retries once more;
   assert all 4+ requests carry one key.
7. Streaming: `streamOpenAiText` where the first connection fails before any text, then streams; assert the same key on both requests; and a stream that
   fails after `hasStreamed` is thrown and sends **no** second request.
8. `generateText`, `generateTextWithHistory`, `requestStructured`, `generateWithImageStructured` and `sendViaOpenAI` (stream and non-stream) each
   send the header on the first request (a table-driven test over the six sites, so a new call site that forgets `headers` fails).
9. `trackMealWithThinking` with two meals: the recorded requests show three distinct keys (recipe + two estimates); `runOnboardingTurn` with a malformed first reply shows two distinct keys.
10. A 409 response with `x-should-retry: false` triggers no SDK retry (one request recorded); without the header the SDK retries (documents why the Worker must send it).
11. `buildOpenAIClient` hosted: `defaultHeaders` contains no `Idempotency-Key` (guard against regressing to the plan's version).
12. Guard test: source-level check that no `Idempotency-Key` string appears in `defaultHeaders`.

Unverified: the real Worker's interaction (409 semantics, body-hash binding) is P1; `react-native` `fetch`/expo-fetch streaming behaviour
on a device was not tested.
