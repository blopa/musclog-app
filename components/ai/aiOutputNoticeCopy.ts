// The copy keys of the AI output notice (`AiOutputNotice.tsx`). Pure, so tests in the Node
// project can read them without loading React Native.

/**
 * What the AI produced on a surface. The kind only picks the one-line wording; the sheet it opens
 * is the same everywhere, so the app states one set of rules about AI output (the Terms' "AI
 * Features and AI Output" section says the same in full).
 */
export type AiOutputKind = 'chat' | 'estimate' | 'plan' | 'insight' | 'import' | 'settings';

// Whole keys, so `check-translations` sees every one.
export const AI_OUTPUT_NOTICE_KEYS: Record<AiOutputKind, string> = {
  chat: 'ai.outputNotice.chat',
  estimate: 'ai.outputNotice.estimate',
  plan: 'ai.outputNotice.plan',
  insight: 'ai.outputNotice.insight',
  import: 'ai.outputNotice.import',
  settings: 'ai.outputNotice.settings',
};

// The sheet's points, in reading order. Whole keys for the same reason.
export const AI_DISCLAIMER_POINT_KEYS = [
  'ai.disclaimer.points.optional',
  'ai.disclaimer.points.mistakes',
  'ai.disclaimer.points.notAdvice',
  'ai.disclaimer.points.health',
  'ai.disclaimer.points.check',
  'ai.disclaimer.points.edits',
  'ai.disclaimer.points.liability',
] as const;
