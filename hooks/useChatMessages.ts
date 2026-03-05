import { useCallback, useEffect, useRef, useState } from 'react';
import { IMessage } from 'react-native-gifted-chat';

import ChatMessage from '../database/models/ChatMessage';
import { ChatService, GoogleAuthService, SettingsService } from '../database/services';
import { getCurrentChatSessionId, setCurrentChatSessionId } from '../utils/chatSessionStorage';
import {
  type ChatHistoryEntry,
  type CoachAIConfig,
  type CoachResponse,
  sendCoachMessage,
} from '../utils/coachAI';
import { getAccessToken } from '../utils/googleAuth';

// Local avatar image for Loggy
export const AI_COACH_AVATAR = require('../assets/avatars/loggy.png');

export interface ExtendedIMessage extends IMessage {
  workout?: {
    title: string;
    duration: string;
    level: string;
    exerciseCount: number;
    calories: number;
  };
}

const INITIAL_LIMIT = 10;
const BATCH_SIZE = 10;

function toGiftedMessage(record: ChatMessage): ExtendedIMessage {
  const isCoach = record.sender === 'coach';
  return {
    _id: record.id,
    text: record.message,
    createdAt: new Date(record.createdAt),
    user: isCoach ? { _id: 2, name: 'Loggy', avatar: AI_COACH_AVATAR } : { _id: 1 },
  };
}

export type UseChatMessagesResult = {
  messages: ExtendedIMessage[];
  isLoading: boolean;
  isLoadingMore: boolean;
  isSending: boolean;
  hasMore: boolean;
  loadMore: () => Promise<void>;
  sendMessage: (text: string) => Promise<void>;
  sessionId: string | null;
};

type AISettings = {
  enableGoogleGemini: boolean;
  enableOpenAi: boolean;
  googleGeminiApiKey: string;
  googleGeminiModel: string;
  openAiApiKey: string;
  openAiModel: string;
};

async function resolveAIConfig(settings: AISettings): Promise<CoachAIConfig | null> {
  // Priority 1: Google OAuth access token (user signed in with Google)
  const oauthGeminiEnabled = await GoogleAuthService.getOAuthGeminiEnabled();
  if (oauthGeminiEnabled) {
    const accessToken = await getAccessToken();
    if (accessToken) {
      return {
        provider: 'gemini',
        accessToken,
        model: settings.googleGeminiModel || 'gemini-2.5-flash',
      };
    }
  }

  // Priority 2: Manual Gemini API key
  if (settings.enableGoogleGemini && settings.googleGeminiApiKey) {
    return {
      provider: 'gemini',
      apiKey: settings.googleGeminiApiKey,
      model: settings.googleGeminiModel || 'gemini-2.5-flash',
    };
  }

  // Priority 3: OpenAI API key
  if (settings.enableOpenAi && settings.openAiApiKey) {
    return {
      provider: 'openai',
      apiKey: settings.openAiApiKey,
      model: settings.openAiModel || 'gpt-4o',
    };
  }

  return null;
}

export function useChatMessages(): UseChatMessagesResult {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ExtendedIMessage[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [currentOffset, setCurrentOffset] = useState(0);

  // ASC-ordered cache of all loaded records for building AI history
  const rawMessagesRef = useRef<ChatMessage[]>([]);

  // Resolve or create session ID on mount
  useEffect(() => {
    let cancelled = false;
    const doTask = async () => {
      let sid = await getCurrentChatSessionId();

      if (!sid) {
        sid = ChatService.generateSessionId();
        await setCurrentChatSessionId(sid);
      }

      if (!cancelled) {
        setSessionId(sid);
      }
    };

    doTask();

    return () => {
      cancelled = true;
    };
  }, []);

  // Initial load once sessionId is resolved
  useEffect(() => {
    if (!sessionId) {
      return;
    }

    let cancelled = false;
    const doTask = async () => {
      setIsLoading(true);
      try {
        const records = await ChatService.getSessionMessages(sessionId, INITIAL_LIMIT, 0);
        if (cancelled) {
          return;
        }
        // records are DESC (newest first) — right for GiftedChat
        setMessages(records.map(toGiftedMessage));
        // Store ASC copy for AI history building
        rawMessagesRef.current = [...records].reverse();
        setCurrentOffset(records.length);

        // Check if there are older messages
        const lookAhead = await ChatService.getSessionMessages(sessionId, 1, records.length);
        if (!cancelled) {
          setHasMore(lookAhead.length > 0);
        }
      } catch (err) {
        console.error('[useChatMessages] initial load error:', err);
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    };

    doTask();

    return () => {
      cancelled = true;
    };
  }, [sessionId]);

  const loadMore = useCallback(async () => {
    if (isLoadingMore || !hasMore || !sessionId) {
      return;
    }

    setIsLoadingMore(true);
    try {
      const olderRecords = await ChatService.getSessionMessages(
        sessionId,
        BATCH_SIZE,
        currentOffset
      );

      if (olderRecords.length === 0) {
        setHasMore(false);
        return;
      }

      // Prepend older records to ASC history ref
      rawMessagesRef.current = [...[...olderRecords].reverse(), ...rawMessagesRef.current];

      // Append to GiftedChat messages (older = further down the DESC list)
      setMessages((prev) => [...prev, ...olderRecords.map(toGiftedMessage)]);

      const newOffset = currentOffset + olderRecords.length;
      setCurrentOffset(newOffset);

      if (olderRecords.length < BATCH_SIZE) {
        setHasMore(false);
      } else {
        const lookAhead = await ChatService.getSessionMessages(sessionId, 1, newOffset);
        setHasMore(lookAhead.length > 0);
      }
    } catch (err) {
      console.error('[useChatMessages] loadMore error:', err);
    } finally {
      setIsLoadingMore(false);
    }
  }, [isLoadingMore, hasMore, sessionId, currentOffset]);

  const sendMessage = useCallback(
    async (text: string) => {
      if (!text.trim() || isSending || !sessionId) {
        return;
      }

      setIsSending(true);
      try {
        // 1. Snapshot history BEFORE saving the new user message to avoid duplication
        const history: ChatHistoryEntry[] = rawMessagesRef.current.map((record) => ({
          role: record.sender,
          content: record.summarizedMessage ?? record.message,
        }));

        // 2. Persist user message and prepend to UI immediately
        const userRecord = await ChatService.saveMessage({
          sessionId,
          sender: 'user',
          message: text.trim(),
        });
        rawMessagesRef.current = [...rawMessagesRef.current, userRecord];
        setMessages((prev) => [toGiftedMessage(userRecord), ...prev]);
        setCurrentOffset((prev) => prev + 1);

        // 3. Read AI settings from DB
        const [
          enableGoogleGemini,
          enableOpenAi,
          googleGeminiApiKey,
          googleGeminiModel,
          openAiApiKey,
          openAiModel,
        ] = await Promise.all([
          SettingsService.getEnableGoogleGemini(),
          SettingsService.getEnableOpenAi(),
          SettingsService.getGoogleGeminiApiKey(),
          SettingsService.getGoogleGeminiModel(),
          SettingsService.getOpenAiApiKey(),
          SettingsService.getOpenAiModel(),
        ]);

        const aiConfig = await resolveAIConfig({
          enableGoogleGemini,
          enableOpenAi,
          googleGeminiApiKey,
          googleGeminiModel,
          openAiApiKey,
          openAiModel,
        });

        if (!aiConfig) {
          console.warn('[useChatMessages] No AI provider configured');
          const errorRecord = await ChatService.saveMessage({
            sessionId,
            sender: 'coach',
            message:
              'AI features are not configured. Please add a Gemini or OpenAI API key in Settings.',
          });
          rawMessagesRef.current = [...rawMessagesRef.current, errorRecord];
          setMessages((prev) => [toGiftedMessage(errorRecord), ...prev]);
          setCurrentOffset((prev) => prev + 1);
          return;
        }

        // 4. Call AI
        const reply: CoachResponse = await sendCoachMessage(aiConfig, history, text.trim());

        // 4b. If the AI returned a summary of the user's message, persist it
        if (reply.sumUserMsg) {
          await ChatService.updateMessageSummary(userRecord, reply.sumUserMsg);
        }

        // 5. Persist coach reply and prepend to UI
        const coachRecord = await ChatService.saveMessage({
          sessionId,
          sender: 'coach',
          message: reply.msg4User,
          summarizedMessage: reply.sumMsg,
        });
        rawMessagesRef.current = [...rawMessagesRef.current, coachRecord];
        setMessages((prev) => [toGiftedMessage(coachRecord), ...prev]);
        setCurrentOffset((prev) => prev + 1);
      } catch (error) {
        console.error('[useChatMessages] sendMessage error:', error);
        if (sessionId) {
          const errorRecord = await ChatService.saveMessage({
            sessionId,
            sender: 'coach',
            message: 'Sorry, something went wrong. Please try again.',
          });

          rawMessagesRef.current = [...rawMessagesRef.current, errorRecord];
          setMessages((prev) => [toGiftedMessage(errorRecord), ...prev]);
          setCurrentOffset((prev) => prev + 1);
        }
      } finally {
        setIsSending(false);
      }
    },
    [sessionId, isSending]
  );

  return {
    messages,
    isLoading,
    isLoadingMore,
    isSending,
    hasMore,
    loadMore,
    sendMessage,
    sessionId,
  };
}
