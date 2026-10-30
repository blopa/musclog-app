import { randomUUID } from 'expo-crypto';
import { useCallback, useEffect, useReducer, useRef, useState } from 'react';

import { runOnboardingTurn } from '@/services/aiOnboardingTurn';
import {
  type AiOnboardingErrorKind,
  type ChatMessage,
  chatReducer,
  initialChatState,
} from '@/utils/aiOnboarding/chatState';
import { classifyAiOnboardingError } from '@/utils/aiOnboarding/classifyError';
import type { FieldIssue, FieldKey } from '@/utils/aiOnboarding/contract';
import type { AiOnboardingDraftRecord } from '@/utils/aiOnboarding/draftStorage';

import type { DraftPatch } from './useAiOnboardingDraft';

type ChatDraftApi = {
  draft: AiOnboardingDraftRecord;
  update: (patch: DraftPatch) => Promise<void>;
};

/** What the last reply said about the next step: the answers it asked about, and whether to review. */
type ReplyHints = { askedFields: FieldKey[]; readyForReview: boolean };
const NO_HINTS: ReplyHints = { askedFields: [], readyForReview: false };

/**
 * The setup conversation. It keeps its own transcript in the AI-setup draft and never touches
 * `chat_messages`, the coach's history, or the coach's prompts. The turn itself (ask, validate,
 * merge) is `runOnboardingTurn`; this hook owns the transcript, the in-flight request and saving.
 */
export function useAiOnboardingChat({ draft, update }: ChatDraftApi) {
  const { provider, mode } = draft;
  const [chat, dispatch] = useReducer(chatReducer, initialChatState);
  const [hints, setHints] = useState<ReplyHints>(NO_HINTS);
  const answersRef = useRef(draft.answers);
  const rejectedRef = useRef<FieldIssue[]>([]);
  const abortRef = useRef<AbortController | null>(null);
  const sendingRef = useRef(false);
  const persistedMessages = useRef<ChatMessage[]>(draft.messages);

  // Resume: the saved transcript is the starting state, and a turn cut off mid-flight shows as
  // unanswered with Retry rather than silently vanishing.
  useEffect(() => {
    dispatch({ type: 'hydrate', messages: persistedMessages.current });
    // Only on mount: later changes come from this hook itself.
  }, []);

  useEffect(() => {
    if (chat.messages !== persistedMessages.current) {
      persistedMessages.current = chat.messages;
      void update({ messages: chat.messages });
    }
  }, [chat.messages, update]);

  useEffect(
    () => () => {
      abortRef.current?.abort();
    },
    []
  );

  const runTurn = useCallback(
    async (history: ChatMessage[], text: string) => {
      sendingRef.current = true;
      const controller = new AbortController();
      abortRef.current = controller;
      try {
        const outcome = await runOnboardingTurn({
          provider,
          mode,
          answers: answersRef.current,
          rejected: rejectedRef.current,
          history,
          message: text,
          signal: controller.signal,
        });

        if (outcome.kind !== 'reply') {
          dispatch({ type: 'fail', kind: outcome.kind });
          return;
        }

        answersRef.current = outcome.answers;
        rejectedRef.current = outcome.rejected;
        setHints({ askedFields: outcome.askedFields, readyForReview: outcome.readyForReview });
        void update({ answers: outcome.answers });
        dispatch({
          type: 'reply',
          message: { id: randomUUID(), role: 'assistant', text: outcome.reply, at: Date.now() },
        });
      } catch (error) {
        const kind: AiOnboardingErrorKind = classifyAiOnboardingError(error);
        dispatch(kind === 'cancelled' ? { type: 'cancel' } : { type: 'fail', kind });
      } finally {
        sendingRef.current = false;
        abortRef.current = null;
      }
    },
    [provider, mode, update]
  );

  const send = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || sendingRef.current) {
        return;
      }

      const history = chat.messages;
      dispatch({
        type: 'send',
        message: { id: randomUUID(), role: 'user', text: trimmed, at: Date.now() },
      });
      void update({ composer: '' });
      await runTurn(history, trimmed);
    },
    [chat.messages, runTurn, update]
  );

  const retry = useCallback(async () => {
    const last = chat.messages[chat.messages.length - 1];
    if (!last || last.role !== 'user' || sendingRef.current) {
      return;
    }

    dispatch({ type: 'retry' });
    await runTurn(chat.messages.slice(0, -1), last.text);
  }, [chat.messages, runTurn]);

  /** Stops a turn in flight; the message goes back to the composer instead of being lost. */
  const cancel = useCallback(() => {
    const last = chat.messages[chat.messages.length - 1];
    if (last?.role === 'user') {
      void update({ composer: last.text });
    }

    abortRef.current?.abort();
  }, [chat.messages, update]);

  return {
    messages: chat.messages,
    status: chat.status,
    errorKind: chat.errorKind,
    askedFields: hints.askedFields,
    readyForReview: hints.readyForReview,
    answers: draft.answers,
    send,
    retry,
    cancel,
  };
}
