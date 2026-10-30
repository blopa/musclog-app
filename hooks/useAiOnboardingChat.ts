import { randomUUID } from 'expo-crypto';
import { useCallback, useEffect, useReducer, useRef, useState } from 'react';

import { DEFAULT_LANG } from '@/lang/lang';
import { AiService } from '@/services/AiService';
import {
  type AiOnboardingErrorKind,
  type ChatMessage,
  chatReducer,
  classifyAiOnboardingError,
  initialChatState,
  toHistory,
} from '@/utils/aiOnboarding/chatState';
import type { FieldIssue, FieldKey } from '@/utils/aiOnboarding/contract';
import type { AiOnboardingDraftRecord } from '@/utils/aiOnboarding/draftStorage';
import { mergeAnswers } from '@/utils/aiOnboarding/merge';
import { buildChatSystemPrompt } from '@/utils/aiOnboarding/prompts';
import { buildTurnJsonSchema, parseAiTurn } from '@/utils/aiOnboarding/turnSchema';
import { sendStructuredChatTurn } from '@/utils/coachAI';

import type { DraftPatch } from './useAiOnboardingDraft';

/** Models with a small context window get the shorter prompt. */
const COMPACT_PROVIDERS = new Set(['on-device', 'local']);

const REPAIR_NOTE =
  '\n\nYour previous reply could not be read. Reply again with ONLY a JSON object that matches the schema exactly.';

type ChatDraftApi = {
  draft: AiOnboardingDraftRecord;
  update: (patch: DraftPatch) => Promise<void>;
};

/**
 * The setup conversation. It keeps its own transcript in the AI-setup draft and never touches
 * `chat_messages`, the coach's history, or the coach's prompts. The model's reply is validated
 * before anything from it is merged into the answers, and it has no tools: the worst a reply can
 * do is propose an answer the person then reviews.
 */
export function useAiOnboardingChat({ draft, update }: ChatDraftApi) {
  const [chat, dispatch] = useReducer(chatReducer, initialChatState);
  const [askedFields, setAskedFields] = useState<FieldKey[]>([]);
  const [readyForReview, setReadyForReview] = useState(false);
  const answersRef = useRef(draft.answers);
  const rejectedRef = useRef<FieldIssue[]>([]);
  const abortRef = useRef<AbortController | null>(null);
  const sendingRef = useRef(false);
  const persistedMessages = useRef<ChatMessage[]>(draft.messages);
  const updateRef = useRef(update);
  const providerRef = useRef(draft.provider);
  const modeRef = useRef(draft.mode);

  // Refs hold the latest values for the async turn; they are refreshed after render, not during it.
  useEffect(() => {
    updateRef.current = update;
    providerRef.current = draft.provider;
    modeRef.current = draft.mode;
  }, [update, draft.provider, draft.mode]);

  // Resume: the saved transcript is the starting state, and a turn cut off mid-flight shows as
  // unanswered with Retry rather than silently vanishing.
  useEffect(() => {
    dispatch({ type: 'hydrate', messages: persistedMessages.current });
    // Only on mount: later changes come from this hook itself.
  }, []);

  useEffect(() => {
    if (chat.messages !== persistedMessages.current) {
      persistedMessages.current = chat.messages;
      void updateRef.current({ messages: chat.messages });
    }
  }, [chat.messages]);

  useEffect(
    () => () => {
      abortRef.current?.abort();
    },
    []
  );

  const runTurn = useCallback(async (history: ChatMessage[], text: string) => {
    sendingRef.current = true;
    const controller = new AbortController();
    abortRef.current = controller;
    try {
      const provider = providerRef.current;
      const config = provider ? await AiService.getAiConfigForProvider(provider) : null;
      if (!config) {
        dispatch({ type: 'fail', kind: 'unavailable' });
        return;
      }

      const ask = (repair: boolean) =>
        sendStructuredChatTurn(
          { ...config, signal: controller.signal },
          {
            operation: 'aiOnboardingTurn',
            systemPrompt:
              buildChatSystemPrompt({
                mode: modeRef.current,
                language: config.language ?? DEFAULT_LANG,
                draft: answersRef.current,
                compact: COMPACT_PROVIDERS.has(config.provider),
                today: new Date(),
                rejected: rejectedRef.current,
              }) + (repair ? REPAIR_NOTE : ''),
            history: toHistory(history),
            userMessage: text,
            buildSchema: buildTurnJsonSchema,
            schemaName: 'onboarding_turn',
          }
        );
      const read = (result: Awaited<ReturnType<typeof ask>>) =>
        result.kind === 'ok' ? parseAiTurn(result.value, new Date()) : ({ ok: false } as const);

      let parsed = read(await ask(false));
      if (!parsed.ok) {
        // Models occasionally answer outside the schema; one quiet second try is usually enough.
        parsed = read(await ask(true));
      }

      if (!parsed.ok) {
        dispatch({ type: 'fail', kind: 'malformed' });
        return;
      }

      const { draft: merged } = mergeAnswers(answersRef.current, parsed.draftPatch);
      answersRef.current = merged;
      rejectedRef.current = parsed.rejected;
      setAskedFields(parsed.askedFields);
      setReadyForReview(parsed.readyForReview);
      void updateRef.current({ answers: merged });
      dispatch({
        type: 'reply',
        message: { id: randomUUID(), role: 'assistant', text: parsed.reply, at: Date.now() },
      });
    } catch (error) {
      const kind: AiOnboardingErrorKind = classifyAiOnboardingError(error);
      if (kind === 'cancelled') {
        dispatch({ type: 'cancel' });
      } else {
        dispatch({ type: 'fail', kind });
      }
    } finally {
      sendingRef.current = false;
      abortRef.current = null;
    }
  }, []);

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
      void updateRef.current({ composer: '' });
      await runTurn(history, trimmed);
    },
    [chat.messages, runTurn]
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
      void updateRef.current({ composer: last.text });
    }

    abortRef.current?.abort();
  }, [chat.messages]);

  return {
    messages: chat.messages,
    status: chat.status,
    errorKind: chat.errorKind,
    askedFields,
    readyForReview,
    answers: draft.answers,
    send,
    retry,
    cancel,
  };
}
