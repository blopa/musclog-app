// How hard an AI request should reason, decided per kind of job. Pure and relative-import-only.
//
// Every provider has its own reasoning control (Claude's `output_config.effort`, Gemini's
// `thinkingLevel`, OpenAI's `reasoning_effort`), so a request names the KIND of job it is and this
// table answers how much effort that job gets; `utils/coachAI.ts` translates the answer for the
// provider. The "Use thinking mode" setting moves every job to `high`; without it each job gets
// what it needs: a quick chat reply and a mechanical extraction think little, an analysis of
// weeks of data or a plan built from several constraints thinks more. These are product choices,
// not measurements (`docs/RESEARCH.md` -> Reasoning effort per job).

export type AiEffort = 'minimal' | 'low' | 'medium' | 'high';

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

export const AI_TASK_EFFORT: Record<AiTask, { normal: AiEffort; thinking: AiEffort }> = {
  chat: { normal: 'low', thinking: 'high' },
  extraction: { normal: 'minimal', thinking: 'high' },
  insight: { normal: 'medium', thinking: 'high' },
  planning: { normal: 'medium', thinking: 'high' },
};

/** What an OpenAI-protocol request's `reasoning_effort` can say. */
export type ReasoningEffortValue = 'low' | 'medium' | 'high';

/**
 * The `reasoning_effort` for a job's effort. `low`, `medium` and `high` are the values every OpenAI
 * reasoning model takes (and the only ones the Musclog Iron Worker accepts); `minimal` is sent as
 * `low` because not every model lists anything below it.
 */
export function reasoningEffortValue(effort: AiEffort): ReasoningEffortValue {
  return effort === 'minimal' ? 'low' : effort;
}

export function effortFor(task: AiTask, useThinkingMode: boolean): AiEffort {
  const row = AI_TASK_EFFORT[task];
  return useThinkingMode ? row.thinking : row.normal;
}
