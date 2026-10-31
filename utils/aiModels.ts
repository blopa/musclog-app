import {
  CLAUDE_MODELS,
  DEFAULT_CLAUDE_MODEL,
  DEFAULT_GEMINI_MODEL,
  DEFAULT_OPENAI_MODEL,
  GEMINI_MODELS,
  OPENAI_MODELS,
} from '@/constants/ai';

const SUPPORTED_GEMINI_MODELS: ReadonlySet<string> = new Set(
  Object.values(GEMINI_MODELS).map((entry) => entry.value)
);
const SUPPORTED_CLAUDE_MODELS: ReadonlySet<string> = new Set(
  Object.values(CLAUDE_MODELS).map((entry) => entry.value)
);
const SUPPORTED_OPENAI_MODELS: ReadonlySet<string> = new Set(
  Object.values(OPENAI_MODELS).map((entry) => entry.value)
);

/**
 * The Gemini model to call for a stored choice. Only models in `GEMINI_MODELS` are ever used: a
 * stored model that is not listed (shut down, renamed, or dropped from the list on purpose) and
 * an empty one both resolve to the default, so a model the provider has retired can never reach
 * a request. The list is the single place a model is retired.
 */
export function resolveGeminiModel(stored: string | null | undefined): string {
  const model = stored?.trim();
  return model && SUPPORTED_GEMINI_MODELS.has(model) ? model : DEFAULT_GEMINI_MODEL;
}

export function resolveOpenAiModel(stored: string | null | undefined): string {
  const model = stored?.trim();
  return model && SUPPORTED_OPENAI_MODELS.has(model) ? model : DEFAULT_OPENAI_MODEL;
}

export function resolveClaudeModel(stored: string | null | undefined): string {
  const model = stored?.trim();
  return model && SUPPORTED_CLAUDE_MODELS.has(model) ? model : DEFAULT_CLAUDE_MODEL;
}
