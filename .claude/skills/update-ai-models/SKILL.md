---
name: update-ai-models
description: >-
  Refresh Musclog's supported Google Gemini, OpenAI and Anthropic Claude model lists against the providers' current
  docs. Use when the user asks to update, refresh or check the AI models, or on the monthly model
  review. Researches live model and deprecation pages, edits constants/ai.ts and the Gemini
  thinking-level table, updates tests and docs, and reports what changed and what is uncertain.
---

# Update AI models

Musclog lets users pick a Gemini, OpenAI or Claude model. The lists drift quickly (in 2026 they went months
stale and shipped models that were already shut down). This skill brings them current.

## How retirement works (read first, do not build a migration)

`GEMINI_MODELS` / `OPENAI_MODELS` / `CLAUDE_MODELS` in `constants/ai.ts` are both the picker and the **allowlist**.
`utils/aiModels.ts` replaces any stored model that is not in the list with the default, and
`AiService.getAiConfig` saves that replacement. So:

- Removing a model from the list retires it for every user automatically. **Never** add a boot
  migration, a replacement map or a per-model fallback.
- A model that is not in the list but a user still has stored just becomes the default. That is the
  intended behavior.

## Steps

### 1. Research (live sources only, today's date is in your context)

Use `WebFetch`/`WebSearch`. Do not rely on memory: the model names change every few weeks.

| Provider | Sources |
|---|---|
| Gemini | https://ai.google.dev/gemini-api/docs/models · https://ai.google.dev/gemini-api/docs/deprecations · https://ai.google.dev/gemini-api/docs/thinking · each candidate's page under `/gemini-api/docs/models/<id>` |
| OpenAI | https://developers.openai.com/api/docs/models · https://developers.openai.com/api/docs/deprecations · the `ChatModel` union in https://raw.githubusercontent.com/openai/openai-node/master/src/resources/shared.ts |
| Claude | https://platform.claude.com/docs/en/about-claude/models/overview · https://platform.claude.com/docs/en/about-claude/model-deprecations · the `Model` union in https://raw.githubusercontent.com/anthropics/anthropic-sdk-typescript/main/src/resources/messages/messages.ts (or `GET /v1/models` with the user's key, which is authoritative) · the `claude-api` skill's model table |

`WebFetch` summarizes with a small model and has contradicted itself between pages. **Cross-check
every model ID in at least two sources** (e.g. the models page and the SDK type list) and confirm
exact spelling. Anything you could only find in one place goes in the report as unverified; ask the
user before adding it.

### 2. Decide the lists

Keep the lists short: roughly a flagship, a balanced default, and a cheap tier per provider.

Include a model only if **all** hold:
- Accepts **image input and returns text** (the app does food-photo and chat vision). Exclude image
  generation, TTS, live/realtime, transcription, embedding, robotics, computer-use and
  codex/cyber/specialty models.
- Is not shut down, and has **no shutdown date within the next ~90 days**.
- Is not restricted to existing users of that model (Google did this to the 2.5 family).
- Prefer stable over `-preview`; take a preview only when it is the provider's newest in that tier
  with no stable equivalent (note this in a comment, as `gemini-3.1-pro-preview` is today).

Claude model IDs are written exactly as the models page lists them (`claude-opus-5-5`), **never with a
date suffix**. A model must also support **structured outputs** (`output_config.format`) and the
`output_config.effort` parameter, since `utils/coachAI.ts` sends both on every call (older models
such as Haiku 4.5 reject `effort`); drop one that does not.

Pick `DEFAULT_GEMINI_MODEL` / `DEFAULT_OPENAI_MODEL` / `DEFAULT_CLAUDE_MODEL` as the provider's own recommended
balanced/cost-efficient model for new projects. It must be in the list (a test enforces it).

Edit `constants/ai.ts`: update entries, the doc/deprecation links, any comment naming shutdown
dates, and the `Last updated: <Month Year>` line. Keys follow the existing style
(`GEMINI_3_8_FLASH`).

### 3. Gemini thinking levels (easy to get wrong, causes API errors)

`GEMINI_MODEL_CAPABILITIES` and `geminiModelFamily` in `utils/gemini.ts` choose how little a model
is told to think on structured calls. Sending a level the model does not list is a request error.
From the thinking docs page, build the table of which levels each current model accepts:

- Accepts `minimal` -> family `gemini-3-flash` (matched by prefix in `geminiModelFamily`).
- Lists only low/medium/high -> `gemini-3-flash-no-minimal` or the pro / `gemini-4` families (LOW).
- Uses `thinkingBudget` (2.5 family) -> unchanged.

Add or adjust prefixes so every listed model lands in a family that is valid for it, and add
the model to `utils/__tests__/geminiGenerationConfig.test.ts` (both the family table and the
"at most one thinking field" loop).

### 3b. Claude request parameters (easy to get wrong, causes API errors)

`buildClaudeParams` in `utils/coachAI.ts` sends `max_tokens`, `system`, `messages` and
`output_config: { effort, format? }` and nothing else, on purpose. The newest Claude models reject
`temperature`/`top_p`/`top_k`, `thinking: { type: 'disabled' }`, `budget_tokens`, assistant prefill and
forced `tool_choice`. For every model you add, check on the models page and in the migration notes
that none of these are needed, and that `effort` accepts the `low`/`high` values from `claudeEffort`
(`utils/claude.ts`). If a new model needs a different shape, report it rather than special-casing it
silently. A model that only works with a refusal fallback or a beta header goes in the report too.

### 4. Things to report, not change, without asking

- `constants/gateway.ts` `MUSCLOG_GATEWAY_MODEL` default (free tier through Cloudflare, env
  overridable, costs the user money). Say whether it is still a supported model and what you'd
  move it to.
- Any parameter incompatibility you notice (e.g. a new model family rejecting `temperature` or
  `max_tokens`; grep `utils/coachAI.ts` and `services/`).

### 5. Verify

Run (never `npm run lint:all`, it stages files and dirties the tree):

```bash
npx jest --selectProjects node --runTestsByPath utils/__tests__/aiModels.test.ts utils/__tests__/geminiGenerationConfig.test.ts services/__tests__/AiService.test.ts utils/__tests__/llmRetry.test.ts utils/__tests__/claude.test.ts utils/__tests__/coachAIClaude.test.ts
npx tsc --noEmit -p .
npx eslint constants/ai.ts utils/aiModels.ts utils/gemini.ts utils/claude.ts services/AiService.ts
npx prettier --check constants/ai.ts utils/gemini.ts utils/__tests__/geminiGenerationConfig.test.ts
```

Search for stragglers: `grep -rnE "gemini-[0-9]|gpt-[0-9]|claude-(opus|sonnet|haiku|fable)" --include=*.ts --include=*.tsx . --exclude-dir=node_modules`
(test fixtures that use a model purely as an arbitrary string are fine).

### 6. Report

Do not commit unless asked. Finish with:
- Added / removed per provider, with the reason for each removal (shut down, shutdown date, limited
  access, not vision+text).
- New defaults, if they changed.
- Thinking-level decisions per new Gemini model, and the request-parameter check per new Claude model.
- Unverified claims and anything single-sourced.
- Gateway default status and any parameter concerns from step 4.
- Source links.
