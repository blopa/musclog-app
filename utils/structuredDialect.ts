/**
 * The dialects a structured (schema-bound) request is written for, and the meal schema dialect built on
 * them. Shared by the request layer (`coachAI.ts`) and the prompt builders, so neither imports the other.
 */

export type StructuredDialect = 'openai' | 'gemini' | 'claude' | 'on-device' | 'gguf';

/**
 * The dialect a meal schema is written in: a provider's own, or `optional` for a custom local server,
 * which enforces no schema on its side. A required field it leaves out fails our own shape check and
 * costs a repair request, so for it (and for the small on-device models) nothing here is required.
 */
export type MealSchemaDialect = StructuredDialect | 'optional';
