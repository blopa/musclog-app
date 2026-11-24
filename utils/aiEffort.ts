// How hard an AI request should reason, decided per kind of job. Pure and relative-import-only.
//
// Every provider has its own reasoning control (Claude's `output_config.effort`, Gemini's
// `thinkingLevel`, OpenAI's `reasoning_effort`), so a request names the KIND of job it is and this
// table answers how much effort that job gets at the person's thinking level
// (`utils/aiThinkingLevel.ts`); `utils/coachAI.ts` translates the answer for the provider. At `off`
// each job gets what it needs: a quick chat reply and a mechanical extraction think little, an
// analysis of weeks of data or a plan built from several constraints thinks more. `medium` and
// `high` lift every job to `high` (they differ in how many requests a job makes, not in effort) and
// `tokenmaxxing` asks for `max`, the most each provider takes. These are product choices, not
// measurements (`docs/RESEARCH.md` -> Reasoning effort per job).

import type { ThinkingLevel } from './aiThinkingLevel';

export type AiEffort = 'minimal' | 'low' | 'medium' | 'high' | 'max';

/** The kind of job a request does, which is all the effort table needs to know about it. */
export type AiTask =
  /** A conversational reply: the coach chat, a setup chat turn. */
  | 'chat'
  /** Reading something into a fixed shape: a meal, a label, a past workout. */
  | 'extraction'
  /** Prose analysis of the person's own data over a period. */
  | 'insight'
  /** Building something from several constraints: a workout plan, a meal plan, next volume. */
  | 'planning';

export const AI_TASK_EFFORT: Record<AiTask, Record<ThinkingLevel, AiEffort>> = {
  chat: { off: 'low', medium: 'high', high: 'high', tokenmaxxing: 'max' },
  extraction: { off: 'minimal', medium: 'high', high: 'high', tokenmaxxing: 'max' },
  insight: { off: 'medium', medium: 'high', high: 'high', tokenmaxxing: 'max' },
  planning: { off: 'medium', medium: 'high', high: 'high', tokenmaxxing: 'max' },
};

/** What an OpenAI-protocol request's `reasoning_effort` can say. */
export type ReasoningEffortValue = 'low' | 'medium' | 'high';

/**
 * The `reasoning_effort` for a job's effort. `low`, `medium` and `high` are the values every OpenAI
 * reasoning model takes (and the only ones the Musclog Iron Worker accepts); `minimal` is sent as
 * `low` because not every model lists anything below it, and `max` as `high`, the most all of them
 * take.
 */
export function reasoningEffortValue(effort: AiEffort): ReasoningEffortValue {
  switch (effort) {
    case 'minimal':
    case 'low':
      return 'low';
    case 'medium':
      return 'medium';
    case 'high':
    case 'max':
      return 'high';
  }
}

export function effortFor(task: AiTask, level: ThinkingLevel): AiEffort {
  return AI_TASK_EFFORT[task][level];
}
