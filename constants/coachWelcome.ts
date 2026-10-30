import type { ChatMessageContext } from '@/database/models/ChatMessage';

/** The translation key of the coach's seeded welcome for each conversation context. */
export const COACH_WELCOME_KEYS = {
  general: 'coach.welcomeMessage',
  exercise: 'coach.welcomeMessageExercise',
  nutrition: 'coach.welcomeMessageNutrition',
} as const satisfies Record<ChatMessageContext, string>;

/** The `payload_json` that marks a message as the seeded welcome. */
export const COACH_WELCOME_PAYLOAD_JSON = JSON.stringify({ type: 'welcome' });
