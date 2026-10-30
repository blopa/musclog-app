import { AiCancelledError, AiInvalidKeyError, AiTimeoutError } from '@/utils/aiErrors';
import {
  AiCreditsError,
  type ChatHistoryEntry,
  GatewayRateLimitError,
  isAiConnectionError,
  isAiCreditsError,
} from '@/utils/coachAI';

/** Most messages kept in a saved conversation; the draft answers carry the state, not the log. */
export const MAX_STORED_MESSAGES = 80;

export type ChatMessage = {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  at: number;
  /** A user message the assistant has not answered (offline, killed mid-turn, failed). */
  status?: 'unanswered';
};

export type AiOnboardingErrorKind =
  | 'offline'
  | 'invalidKey'
  | 'credits'
  | 'gatewayLimit'
  | 'timeout'
  | 'cancelled'
  | 'malformed'
  /** The chosen provider is no longer usable (key removed, free tier off, model gone). */
  | 'unavailable'
  | 'unknown';

export type ChatState = {
  messages: ChatMessage[];
  status: 'idle' | 'sending' | 'error';
  errorKind: AiOnboardingErrorKind | null;
};

export type ChatAction =
  | { type: 'hydrate'; messages: ChatMessage[] }
  | { type: 'send'; message: ChatMessage }
  | { type: 'reply'; message: ChatMessage }
  | { type: 'fail'; kind: AiOnboardingErrorKind }
  | { type: 'retry' }
  | { type: 'cancel' }
  | { type: 'reset' };

export const initialChatState: ChatState = { messages: [], status: 'idle', errorKind: null };

const lastIndexOfRole = (messages: ChatMessage[], role: ChatMessage['role']): number => {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    if (messages[index].role === role) {
      return index;
    }
  }

  return -1;
};

const markLastUser = (messages: ChatMessage[], status: ChatMessage['status']): ChatMessage[] => {
  const index = lastIndexOfRole(messages, 'user');
  if (index < 0 || index !== messages.length - 1) {
    return messages;
  }

  return messages.map((message, at) => {
    if (at !== index) {
      return message;
    }

    const { status: _previous, ...rest } = message;
    return status ? { ...rest, status } : rest;
  });
};

/** Earlier unanswered messages travel in the history of the next turn, so they stop being flagged. */
const clearUnanswered = (messages: ChatMessage[]): ChatMessage[] =>
  messages.map(({ status: _status, ...rest }) => rest);

function capMessages(messages: ChatMessage[]): ChatMessage[] {
  return messages.length > MAX_STORED_MESSAGES ? messages.slice(-MAX_STORED_MESSAGES) : messages;
}

export function chatReducer(state: ChatState, action: ChatAction): ChatState {
  switch (action.type) {
    case 'hydrate': {
      // A saved conversation that ends on the person's own message was cut off mid-turn.
      const messages = markLastUser(capMessages(action.messages), 'unanswered');
      const last = messages[messages.length - 1];
      return {
        messages,
        status: last?.status === 'unanswered' ? 'error' : 'idle',
        errorKind: null,
      };
    }

    case 'send':
      return {
        messages: capMessages([...clearUnanswered(state.messages), action.message]),
        status: 'sending',
        errorKind: null,
      };

    case 'reply':
      return {
        messages: capMessages([...clearUnanswered(state.messages), action.message]),
        status: 'idle',
        errorKind: null,
      };

    case 'fail':
      return {
        messages: markLastUser(state.messages, 'unanswered'),
        status: 'error',
        errorKind: action.kind,
      };

    case 'retry':
      return { ...state, status: 'sending', errorKind: null };

    case 'cancel': {
      // A cancelled message leaves the transcript; the hook puts its text back in the composer.
      const last = state.messages[state.messages.length - 1];
      const messages = last?.role === 'user' ? state.messages.slice(0, -1) : state.messages;
      return { messages, status: 'idle', errorKind: null };
    }

    case 'reset':
      return initialChatState;
  }
}

/** The conversation as the history the model receives; a trailing unanswered message is the prompt. */
export function toHistory(messages: ChatMessage[]): ChatHistoryEntry[] {
  return messages.map((message) => ({
    role: message.role === 'user' ? 'user' : 'coach',
    content: message.text,
  }));
}

/** Maps whatever a provider call threw to what the person is told and which exits we offer. */
export function classifyAiOnboardingError(error: unknown): AiOnboardingErrorKind {
  if (error instanceof AiCancelledError) {
    return 'cancelled';
  }

  if (error instanceof AiInvalidKeyError) {
    return 'invalidKey';
  }

  if (error instanceof AiTimeoutError) {
    return 'timeout';
  }

  if (error instanceof GatewayRateLimitError) {
    return 'gatewayLimit';
  }

  if (error instanceof AiCreditsError || isAiCreditsError(error)) {
    return 'credits';
  }

  return isAiConnectionError(error) ? 'offline' : 'unknown';
}
