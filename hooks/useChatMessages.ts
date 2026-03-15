import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { IMessage } from 'react-native-gifted-chat';

import {
  ANALYZE_PROGRESS,
  CHAT_INTENTION_KEY,
  GENERATE_MY_WORKOUTS,
  NUTRITION_CHECK,
  TRACK_MEAL,
} from '../constants/chat';
import ChatMessage from '../database/models/ChatMessage';
import { ChatService, NutritionService } from '../database/services';
import AiService from '../services/AiService';
import { getCurrentChatSessionId, setCurrentChatSessionId } from '../utils/chatSessionStorage';
import {
  type ChatHistoryEntry,
  type CoachResponse,
  generateWorkoutPlan,
  getNutritionInsights,
  getRecentWorkoutsInsights,
  sendCoachMessage,
  trackMeal,
  type TrackMealIngredient,
} from '../utils/coachAI';
import { getChatMessagePromptContent } from '../utils/prompts';
import { buildWorkoutCompletedSummaryForLLM, processWorkoutPlanResponse } from '../utils/workoutAI';

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
  workoutCompleted?: {
    workoutLogId: string;
    workoutName: string;
    volume: string;
    duration: string;
    personalRecords: number;
  };
  meal?: {
    messageId: string;
    mealName: string;
    calories: number;
    protein: number;
    carbs: number;
    fats: number;
    ingredients: TrackMealIngredient[];
    wasTracked: boolean;
  };
}

const INITIAL_LIMIT = 10;
const BATCH_SIZE = 10;

const COACH_USER = { _id: 2, name: 'Loggy', avatar: AI_COACH_AVATAR };

function toGiftedMessage(record: ChatMessage): ExtendedIMessage {
  const isCoach = record.sender === 'coach';
  const msg: ExtendedIMessage = {
    _id: record.id,
    text: record.message,
    createdAt: new Date(record.createdAt),
    user: isCoach ? COACH_USER : { _id: 1 },
  };

  if (record.payloadJson) {
    try {
      const payload = JSON.parse(record.payloadJson);
      if (payload.type === 'workoutCompleted') {
        msg.workoutCompleted = {
          workoutLogId: payload.workoutLogId,
          workoutName: payload.workoutName,
          volume: payload.volume,
          duration: payload.duration,
          personalRecords: payload.personalRecords,
        };
      } else if (payload.type === 'image' && payload.image) {
        msg.image = payload.image.startsWith('data:')
          ? payload.image
          : `data:image/jpeg;base64,${payload.image}`;
      } else if (payload.type === 'trackMeal') {
        const ingredients: TrackMealIngredient[] = payload.ingredients ?? [];
        msg.meal = {
          messageId: record.id,
          mealName: payload.mealType ?? 'meal',
          calories: payload.totalCalories ?? 0,
          protein: Math.round(ingredients.reduce((s, i) => s + i.protein, 0)),
          carbs: Math.round(ingredients.reduce((s, i) => s + i.carbs, 0)),
          fats: Math.round(ingredients.reduce((s, i) => s + i.fat, 0)),
          ingredients,
          wasTracked: payload.was_tracked ?? false,
        };
      }
    } catch {
      // ignore malformed payload
    }
  }

  return msg;
}

export type UseChatMessagesResult = {
  messages: ExtendedIMessage[];
  pendingCoachMessage: ExtendedIMessage | null;
  isLoading: boolean;
  isLoadingMore: boolean;
  isSending: boolean;
  hasMore: boolean;
  loadMore: () => Promise<void>;
  sendMessage: (text: string, base64Image?: string) => Promise<void>;
  clearHistory: (conversationContext?: 'general' | 'exercise' | 'nutrition') => Promise<void>;
  sessionId: string | null;
  addPendingCoachMessage: (msg: ExtendedIMessage) => void;
  clearPendingCoachMessage: () => void;
  /** When set, the last send failed and this text should be shown in the input so the user can retry. */
  failedMessageText: string | null;
  clearFailedMessageText: () => void;
  /** Ephemeral coach error message (not persisted). Shown in UI until user sends again. */
  ephemeralErrorAsMessage: ExtendedIMessage | null;
  deleteMessage: (messageId: string | number) => Promise<void>;
  markMealAsTracked: (
    messageId: string,
    ingredients: TrackMealIngredient[],
    date: Date,
    mealType: 'breakfast' | 'lunch' | 'dinner' | 'snack'
  ) => Promise<void>;
};

export function useChatMessages(
  conversationContext: 'general' | 'exercise' | 'nutrition' = 'general'
): UseChatMessagesResult {
  const { t } = useTranslation();
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ExtendedIMessage[]>([]);
  const [pendingCoachMessage, setPendingCoachMessage] = useState<ExtendedIMessage | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [currentOffset, setCurrentOffset] = useState(0);
  const [failedMessageText, setFailedMessageText] = useState<string | null>(null);
  const [ephemeralErrorMessage, setEphemeralErrorMessage] = useState<string | null>(null);

  // ASC-ordered cache of all loaded records for building AI history
  const rawMessagesRef = useRef<ChatMessage[]>([]);
  // Ref mirror for pendingCoachMessage to avoid stale closure in sendMessage
  const pendingCoachMessageRef = useRef<ExtendedIMessage | null>(null);

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

  // Initial load once sessionId is resolved, reload when context changes
  useEffect(() => {
    if (!sessionId) {
      return;
    }

    let cancelled = false;
    const doTask = async () => {
      setIsLoading(true);
      // Reset state when context changes
      setCurrentOffset(0);
      setHasMore(false);
      rawMessagesRef.current = [];
      try {
        const records = await ChatService.getSessionMessages(
          sessionId,
          INITIAL_LIMIT,
          0,
          conversationContext
        );
        if (cancelled) {
          return;
        }
        // records are DESC (newest first) — right for GiftedChat
        setMessages(records.map(toGiftedMessage));
        // Store ASC copy for AI history building
        rawMessagesRef.current = [...records].reverse();
        setCurrentOffset(records.length);

        // Check if there are older messages
        const lookAhead = await ChatService.getSessionMessages(
          sessionId,
          1,
          records.length,
          conversationContext
        );
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
  }, [sessionId, conversationContext]);

  const loadMore = useCallback(async () => {
    if (isLoadingMore || !hasMore || !sessionId) {
      return;
    }

    setIsLoadingMore(true);
    try {
      const olderRecords = await ChatService.getSessionMessages(
        sessionId,
        BATCH_SIZE,
        currentOffset,
        conversationContext
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
        const lookAhead = await ChatService.getSessionMessages(
          sessionId,
          1,
          newOffset,
          conversationContext
        );
        setHasMore(lookAhead.length > 0);
      }
    } catch (err) {
      console.error('[useChatMessages] loadMore error:', err);
    } finally {
      setIsLoadingMore(false);
    }
  }, [isLoadingMore, hasMore, sessionId, currentOffset, conversationContext]);

  const addPendingCoachMessage = useCallback((msg: ExtendedIMessage) => {
    pendingCoachMessageRef.current = msg;
    setPendingCoachMessage(msg);
  }, []);

  const clearPendingCoachMessage = useCallback(() => {
    pendingCoachMessageRef.current = null;
    setPendingCoachMessage(null);
  }, []);

  const clearFailedMessageText = useCallback(() => {
    setFailedMessageText(null);
  }, []);

  const deleteMessage = useCallback(
    async (messageId: string | number) => {
      const id = String(messageId);
      if (!messages.some((m) => String(m._id) === id)) {
        return;
      }
      await ChatService.deleteMessage(id);
      rawMessagesRef.current = rawMessagesRef.current.filter((r) => r.id !== id);
      setMessages((prev) => prev.filter((m) => String(m._id) !== id));
      setCurrentOffset((prev) => Math.max(0, prev - 1));
    },
    [messages]
  );

  const clearHistory = useCallback(
    async (contextToClear?: 'general' | 'exercise' | 'nutrition') => {
      if (!sessionId) {
        return;
      }

      try {
        if (contextToClear) {
          // Delete only messages for the specified context
          await ChatService.deleteSessionMessagesByContext(sessionId, contextToClear);

          // Get message IDs to remove before filtering rawMessagesRef
          const messageIdsToRemove = rawMessagesRef.current
            .filter((r) => r.context === contextToClear)
            .map((r) => r.id);

          // Filter out deleted messages from local state
          rawMessagesRef.current = rawMessagesRef.current.filter(
            (r) => r.context !== contextToClear
          );

          // Remove messages from UI state if we're viewing the cleared context
          if (contextToClear === conversationContext) {
            setMessages((prev) => prev.filter((m) => !messageIdsToRemove.includes(String(m._id))));
            setCurrentOffset(0);
            setHasMore(false);
            setFailedMessageText(null);
            setEphemeralErrorMessage(null);
          }
        } else {
          // If no context specified, delete entire session (backward compatibility)
          await ChatService.deleteSession(sessionId);
          rawMessagesRef.current = [];
          pendingCoachMessageRef.current = null;
          setMessages([]);
          setPendingCoachMessage(null);
          setCurrentOffset(0);
          setHasMore(false);
          setFailedMessageText(null);
          setEphemeralErrorMessage(null);
        }
      } catch (err) {
        console.error('[useChatMessages] clearHistory error:', err);
        throw err;
      }
    },
    [sessionId, conversationContext]
  );

  const sendMessage = useCallback(
    async (text: string, base64Image?: string) => {
      if ((!text.trim() && !base64Image) || isSending || !sessionId) {
        return;
      }

      setEphemeralErrorMessage(null); // Clear any previous error when user sends again
      clearFailedMessageText(); // Clear input immediately when user sends; if request fails we set it again
      setIsSending(true);
      let userRecord: ChatMessage | null = null;
      try {
        // 1. Check for pending chat intention (e.g., GENERATE_MY_WORKOUTS)
        const pendingIntention = await AsyncStorage.getItem(CHAT_INTENTION_KEY);

        // 1b. Clear in-memory pending coach message (visual-only; do not save to DB or send to API)
        if (pendingCoachMessageRef.current) {
          pendingCoachMessageRef.current = null;
          setPendingCoachMessage(null);
        }

        // 2. Persist user message and prepend to UI immediately
        userRecord = await ChatService.saveMessage({
          sessionId,
          sender: 'user',
          message: text.trim() || (base64Image ? t('coach.imageSent') : ''),
          context: conversationContext,
          payloadJson: base64Image
            ? JSON.stringify({ type: 'image', image: base64Image })
            : undefined,
        });
        rawMessagesRef.current = [...rawMessagesRef.current, userRecord];
        setMessages((prev) => [toGiftedMessage(userRecord!), ...prev]);
        setCurrentOffset((prev) => prev + 1);

        // 3. Read AI config via AiService
        const aiConfig = await AiService.getAiConfig();

        if (!aiConfig) {
          console.warn('[useChatMessages] No AI provider configured');
          if (userRecord) {
            const recordId = userRecord.id;
            await ChatService.deleteMessage(recordId);
            rawMessagesRef.current = rawMessagesRef.current.filter((r) => r.id !== recordId);
            setMessages((prev) => prev.filter((m) => m._id !== recordId));
          }
          setFailedMessageText(text.trim());
          setEphemeralErrorMessage(t('coach.errors.aiNotConfigured'));
          return;
        }

        // 4. Build chat history with system context and compression
        // Cap at 20 messages, use summarized_message if available.
        // Exclude the current user message from history — we pass it separately to sendCoachMessage
        // so it is not sent twice to the LLM.
        // Filter to only include messages from the current conversation context.
        const maxHistoryLength = 20;
        const contextFilteredHistory = rawMessagesRef.current.filter(
          (record) => record.context === conversationContext
        );

        const slicedHistory = contextFilteredHistory.slice(-maxHistoryLength);
        const historyWithoutCurrentMessage = slicedHistory.slice(0, -1);

        const systemMessage = await getChatMessagePromptContent();

        // Workout-completed messages are shown as Loggy in the UI but sent to the LLM as user
        // messages with rich content. We always recompute from payload so old messages get the
        // full JSON/linguistic summary too.
        const buildHistoryEntry = async (record: ChatMessage): Promise<ChatHistoryEntry> => {
          let role: 'user' | 'coach' = record.sender as 'user' | 'coach';
          let content = record.summarizedMessage ?? record.message;
          if (record.payloadJson) {
            try {
              const payload = JSON.parse(record.payloadJson);
              if (payload.type === 'workoutCompleted' && payload.workoutLogId) {
                role = 'user';
                content = await buildWorkoutCompletedSummaryForLLM(payload.workoutLogId, {
                  volumeStr: payload.volume ?? '0',
                  durationStr: payload.duration ?? '0m',
                  personalRecords: payload.personalRecords ?? 0,
                  weightUnit: payload.weightUnit ?? 'kg',
                  format: 'json',
                });
              }
            } catch {
              // ignore malformed payload
            }
          }
          return { role, content };
        };

        const historyEntries = await Promise.all(
          historyWithoutCurrentMessage.map(buildHistoryEntry)
        );
        const history: ChatHistoryEntry[] = [
          { role: 'user', content: systemMessage },
          ...historyEntries,
        ];

        // 5. Route based on pending intention or default to chat
        let reply: CoachResponse | null = null;
        let payloadJson: string | undefined = undefined;

        if (pendingIntention === GENERATE_MY_WORKOUTS) {
          // Pass last 6 conversation entries + current message so the model has context and sees recent back-and-forth (same idea as Analyze Progress / Nutrition Check)
          const recentConversation = [
            ...historyEntries.slice(-6),
            { role: 'user' as const, content: text.trim() },
          ];

          const workoutPlan = await generateWorkoutPlan(aiConfig, recentConversation);

          if (workoutPlan) {
            // Process the workout plan and create templates in database
            const processResult = await processWorkoutPlanResponse(workoutPlan, sessionId);

            reply = {
              msg4User: t('coach.success.workoutPlanGenerated', {
                count: processResult.templateIds.length,
                description: processResult.description,
              }),
              sumMsg: 'Generated workout plan',
            };

            // Store workout plan metadata in payload_json for UI rendering
            payloadJson = JSON.stringify({
              type: 'workoutPlan',
              templateIds: processResult.templateIds,
              count: processResult.templateIds.length,
            });

            await AsyncStorage.removeItem(CHAT_INTENTION_KEY); // Clear the intention
          } else {
            // Revert user message and restore text to input so user can retry
            if (userRecord) {
              const recordId = userRecord.id;
              await ChatService.deleteMessage(recordId);
              rawMessagesRef.current = rawMessagesRef.current.filter((r) => r.id !== recordId);
              setMessages((prev) => prev.filter((m) => m._id !== recordId));
            }
            setFailedMessageText(text.trim());
            setEphemeralErrorMessage(t('coach.errors.workoutGenerationFailed'));
            return;
          }
        } else if (pendingIntention === ANALYZE_PROGRESS) {
          const end = new Date();
          const start = new Date();
          start.setDate(start.getDate() - 7);
          const startDate = start.toISOString().split('T')[0];
          const endDate = end.toISOString().split('T')[0];
          const recentConversation = historyEntries.slice(-3);
          const result = await getRecentWorkoutsInsights(
            aiConfig,
            startDate,
            endDate,
            text.trim(),
            recentConversation
          );
          if (!result?.trim()) {
            if (userRecord) {
              const recordId = userRecord.id;
              await ChatService.deleteMessage(recordId);
              rawMessagesRef.current = rawMessagesRef.current.filter((r) => r.id !== recordId);
              setMessages((prev) => prev.filter((m) => m._id !== recordId));
            }
            setFailedMessageText(text.trim());
            setEphemeralErrorMessage(t('coach.errors.progressInsightFailed'));
            return;
          }

          reply = { msg4User: result, sumMsg: result.substring(0, 200) };
          await AsyncStorage.removeItem(CHAT_INTENTION_KEY);
        } else if (pendingIntention === NUTRITION_CHECK) {
          const end = new Date();
          const start = new Date();
          start.setDate(start.getDate() - 7);
          const startDate = start.toISOString().split('T')[0];
          const endDate = end.toISOString().split('T')[0];
          const recentConversation = historyEntries.slice(-3);
          const result = await getNutritionInsights(
            aiConfig,
            startDate,
            endDate,
            text.trim(),
            recentConversation
          );
          if (!result?.trim()) {
            if (userRecord) {
              const recordId = userRecord.id;
              await ChatService.deleteMessage(recordId);
              rawMessagesRef.current = rawMessagesRef.current.filter((r) => r.id !== recordId);
              setMessages((prev) => prev.filter((m) => m._id !== recordId));
            }

            setFailedMessageText(text.trim());
            setEphemeralErrorMessage(t('coach.errors.nutritionInsightFailed'));
            return;
          }

          reply = { msg4User: result, sumMsg: result.substring(0, 200) };
          await AsyncStorage.removeItem(CHAT_INTENTION_KEY);
        } else if (pendingIntention === TRACK_MEAL) {
          const result = await trackMeal(aiConfig, text.trim(), base64Image);
          if (!result || result.ingredients.length === 0) {
            if (userRecord) {
              const recordId = userRecord.id;
              await ChatService.deleteMessage(recordId);
              rawMessagesRef.current = rawMessagesRef.current.filter((r) => r.id !== recordId);
              setMessages((prev) => prev.filter((m) => m._id !== recordId));
            }

            setFailedMessageText(text.trim());
            setEphemeralErrorMessage(t('coach.errors.trackMealFailed'));
            return;
          }

          // Determine meal type based on current hour
          const hour = new Date().getHours();
          let mealType: 'breakfast' | 'lunch' | 'dinner' | 'snack' = 'snack';
          if (hour >= 5 && hour < 11) {
            mealType = 'breakfast';
          } else if (hour >= 11 && hour < 16) {
            mealType = 'lunch';
          } else if (hour >= 16 && hour < 22) {
            mealType = 'dinner';
          }

          const totalCalories = Math.round(
            result.ingredients.reduce((acc, curr) => acc + curr.kcal, 0)
          );
          const ingredientNames = result.ingredients.map((i) => i.name).join(', ');

          reply = {
            msg4User: t('coach.success.trackMealReady', {
              count: result.ingredients.length,
              ingredients: ingredientNames,
              calories: totalCalories,
            }),
            sumMsg: `Analyzed meal with ${result.ingredients.length} ingredients (${totalCalories} kcal)`,
          };

          payloadJson = JSON.stringify({
            type: 'trackMeal',
            ingredients: result.ingredients,
            totalCalories,
            mealType,
            was_tracked: false,
          });

          await AsyncStorage.removeItem(CHAT_INTENTION_KEY);
        } else {
          // Default: send regular chat message
          reply = await sendCoachMessage(aiConfig, history.slice(1), text.trim()); // slice(1) to exclude system message from standard chat
        }

        if (!reply) {
          throw new Error('No response from AI');
        }

        // 5b. If the AI returned a summary of the user's message, persist it
        if (reply.sumUserMsg && userRecord) {
          await ChatService.updateMessageSummary(userRecord, reply.sumUserMsg);
        }

        // 6. Persist coach reply and prepend to UI
        const coachRecord = await ChatService.saveMessage({
          sessionId,
          sender: 'coach',
          message: reply.msg4User,
          summarizedMessage: reply.sumMsg,
          payloadJson,
          context: conversationContext,
        });
        rawMessagesRef.current = [...rawMessagesRef.current, coachRecord];
        setMessages((prev) => [toGiftedMessage(coachRecord), ...prev]);
        setCurrentOffset((prev) => prev + 1);
      } catch (error) {
        console.error('[useChatMessages] sendMessage error:', error);
        if (sessionId && userRecord) {
          // Revert user message and restore text to input so user can retry
          const recordId = userRecord.id;
          await ChatService.deleteMessage(recordId).catch(() => {});
          rawMessagesRef.current = rawMessagesRef.current.filter((r) => r.id !== recordId);
          setMessages((prev) => prev.filter((m) => m._id !== recordId));
          setFailedMessageText(text.trim());
          setEphemeralErrorMessage(t('coach.errors.generalError'));
        }
      } finally {
        setIsSending(false);
      }
    },
    [sessionId, isSending, t, clearFailedMessageText, conversationContext]
  );

  const markMealAsTracked = useCallback(
    async (
      messageId: string,
      ingredients: TrackMealIngredient[],
      date: Date,
      mealType: 'breakfast' | 'lunch' | 'dinner' | 'snack'
    ) => {
      await NutritionService.logCustomMealsBatch(
        ingredients.map((i) => ({
          name: i.name,
          calories: i.kcal,
          protein: i.protein,
          carbs: i.carbs,
          fat: i.fat,
          fiber: i.fiber,
          grams: i.grams,
        })),
        date,
        mealType
      );

      const record = rawMessagesRef.current.find((r) => r.id === messageId);
      if (record?.payloadJson) {
        const updated = { ...JSON.parse(record.payloadJson), was_tracked: true };
        await ChatService.updateMessagePayload(messageId, JSON.stringify(updated));
      }

      setMessages((prev) =>
        prev.map((m) =>
          m._id === messageId && m.meal ? { ...m, meal: { ...m.meal, wasTracked: true } } : m
        )
      );
    },
    []
  );

  const ephemeralErrorAsMessage = useMemo((): ExtendedIMessage | null => {
    if (!ephemeralErrorMessage) {
      return null;
    }

    return {
      _id: 'ephemeral-error',
      text: ephemeralErrorMessage,
      createdAt: new Date(),
      user: COACH_USER,
    };
  }, [ephemeralErrorMessage]);

  return {
    messages,
    pendingCoachMessage,
    isLoading,
    isLoadingMore,
    isSending,
    hasMore,
    loadMore,
    sendMessage,
    clearHistory,
    sessionId,
    addPendingCoachMessage,
    clearPendingCoachMessage,
    failedMessageText,
    clearFailedMessageText,
    ephemeralErrorAsMessage,
    deleteMessage,
    markMealAsTracked,
  };
}
