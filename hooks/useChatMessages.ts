import { Q } from '@nozbe/watermelondb';
import { useCallback, useEffect, useRef, useState } from 'react';
import { IMessage } from 'react-native-gifted-chat';

import {
  ENABLE_GOOGLE_GEMINI_SETTING_TYPE,
  ENABLE_OPENAI_SETTING_TYPE,
  GOOGLE_GEMINI_API_KEY_SETTING_TYPE,
  GOOGLE_GEMINI_MODEL_SETTING_TYPE,
  OPENAI_API_KEY_SETTING_TYPE,
  OPENAI_MODEL_SETTING_TYPE,
} from '../constants/settings';
import { database } from '../database';
import ChatMessage from '../database/models/ChatMessage';
import Setting from '../database/models/Setting';
import { ChatService } from '../database/services/ChatService';
import { type ChatHistoryEntry, type CoachAIConfig, sendCoachMessage } from '../utils/coachAI';

// AI Coach avatar URL (shared with CoachModal)
export const AI_COACH_AVATAR =
  'https://lh3.googleusercontent.com/aida-public/AB6AXuAXxrp6riIDnXZkR98-jJEX8IIqKuGBbD6Nlxrt4t8oifz8KgM3q3VjFPKYVzNwfFBEbdvjEkEU1a8oYivCY0oJHBD1HEi-Pjg0638r8tULKurmfvFPaF6OSNcWQvlzhK3coc8DccgtARUtSOOmqSOoHEQM8JQIOwBYvElVbb2XsURsvRMicbylHk1qeA98fvyZhS3mwy_S67AKXjSWGEGJ5IJBSZNpAQRfaMWXjKg6b5xV_xg0ScM8K_urNvzJV1Pa5ATJZO9yDjw7';

export interface ExtendedIMessage extends IMessage {
  workout?: {
    title: string;
    duration: string;
    level: string;
    exerciseCount: number;
    calories: number;
  };
}

function toGiftedMessage(record: ChatMessage): ExtendedIMessage {
  const isCoach = record.sender === 'coach';
  return {
    _id: record.id,
    text: record.message,
    createdAt: new Date(record.createdAt),
    user: isCoach ? { _id: 2, name: 'Musclog Trainer', avatar: AI_COACH_AVATAR } : { _id: 1 },
  };
}

export type UseChatMessagesResult = {
  messages: ExtendedIMessage[];
  isLoading: boolean;
  isSending: boolean;
  sendMessage: (text: string) => Promise<void>;
  sessionId: string;
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
  if (settings.enableGoogleGemini && settings.googleGeminiApiKey) {
    return {
      provider: 'gemini',
      apiKey: settings.googleGeminiApiKey,
      model: settings.googleGeminiModel || 'gemini-2.5-flash',
    };
  }
  if (settings.enableOpenAi && settings.openAiApiKey) {
    return {
      provider: 'openai',
      apiKey: settings.openAiApiKey,
      model: settings.openAiModel || 'gpt-4o',
    };
  }
  return null;
}

export function useChatMessages(initialSessionId?: string): UseChatMessagesResult {
  const [sessionId] = useState<string>(() => initialSessionId ?? ChatService.generateSessionId());
  const [messages, setMessages] = useState<ExtendedIMessage[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);

  // Keep a ref to raw ChatMessage records for building AI history
  const rawMessagesRef = useRef<ChatMessage[]>([]);

  useEffect(() => {
    setIsLoading(true);

    const subscription = database
      .get<ChatMessage>('chat_messages')
      .query(
        Q.where('session_id', sessionId),
        Q.where('deleted_at', Q.eq(null)),
        Q.sortBy('created_at', Q.desc)
      )
      .observe()
      .subscribe({
        next: (records) => {
          // GiftedChat expects newest-first; query is already DESC
          rawMessagesRef.current = [...records].reverse(); // keep ASC copy for history building
          setMessages(records.map(toGiftedMessage));
          setIsLoading(false);
        },
        error: (err) => {
          console.error('[useChatMessages] subscription error:', err);
          setIsLoading(false);
        },
      });

    return () => subscription.unsubscribe();
  }, [sessionId]);

  const sendMessage = useCallback(
    async (text: string) => {
      if (!text.trim() || isSending) {
        return;
      }

      setIsSending(true);
      try {
        // 1. Persist user message
        await ChatService.saveMessage({
          sessionId,
          sender: 'user',
          message: text.trim(),
        });

        // 2. Build history for AI (oldest-first, use summarized when available)
        const history: ChatHistoryEntry[] = rawMessagesRef.current.map((record) => ({
          role: record.sender,
          content: record.summarizedMessage ?? record.message,
        }));

        // 3. Read AI settings from DB
        const fetchSetting = async (type: string) => {
          const results = await database
            .get<Setting>('settings')
            .query(Q.where('type', type), Q.where('deleted_at', Q.eq(null)))
            .fetch();
          return results[0]?.value ?? '';
        };

        const [
          enableGeminiRaw,
          enableOpenAiRaw,
          geminiApiKey,
          geminiModel,
          openAiApiKey,
          openAiModel,
        ] = await Promise.all([
          fetchSetting(ENABLE_GOOGLE_GEMINI_SETTING_TYPE),
          fetchSetting(ENABLE_OPENAI_SETTING_TYPE),
          fetchSetting(GOOGLE_GEMINI_API_KEY_SETTING_TYPE),
          fetchSetting(GOOGLE_GEMINI_MODEL_SETTING_TYPE),
          fetchSetting(OPENAI_API_KEY_SETTING_TYPE),
          fetchSetting(OPENAI_MODEL_SETTING_TYPE),
        ]);

        const aiConfig = await resolveAIConfig({
          enableGoogleGemini: enableGeminiRaw === 'true',
          enableOpenAi: enableOpenAiRaw === 'true',
          googleGeminiApiKey: geminiApiKey,
          googleGeminiModel: geminiModel,
          openAiApiKey: openAiApiKey,
          openAiModel: openAiModel,
        });

        if (!aiConfig) {
          console.warn('[useChatMessages] No AI provider configured');
          await ChatService.saveMessage({
            sessionId,
            sender: 'coach',
            message:
              'AI features are not configured. Please add a Gemini or OpenAI API key in Settings.',
          });
          return;
        }

        // 4. Call AI
        const reply = await sendCoachMessage(aiConfig, history, text.trim());

        // 5. Persist coach reply
        await ChatService.saveMessage({
          sessionId,
          sender: 'coach',
          message: reply,
        });
      } catch (error) {
        console.error('[useChatMessages] sendMessage error:', error);
        await ChatService.saveMessage({
          sessionId,
          sender: 'coach',
          message: 'Sorry, something went wrong. Please try again.',
        });
      } finally {
        setIsSending(false);
      }
    },
    [sessionId, isSending]
  );

  return { messages, isLoading, isSending, sendMessage, sessionId };
}
