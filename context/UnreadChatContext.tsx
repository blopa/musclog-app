import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import { CONVERSATION_CONTEXTS, type ConversationContext } from '@/constants/chat';
import { UNREAD_CHAT_MESSAGES_COUNT } from '@/constants/misc';
import { isStaticExport } from '@/constants/platform';

type SetUnreadCountArg = number | ((prev: number) => number);

export type UnreadCountsByContext = Record<ConversationContext, number>;

type UnreadChatContextType = {
  /** Total across every conversation context — what the nav bar coach badge shows. */
  unreadCount: number;
  /** Per-conversation-context counts, so the coach's mode switcher can badge each mode. */
  unreadCountsByContext: UnreadCountsByContext;
  setUnreadCount: (
    conversationContext: ConversationContext,
    countOrUpdater: SetUnreadCountArg
  ) => Promise<void>;
  /** Clears one conversation context, or every one of them when called without an argument. */
  clearUnreadCount: (conversationContext?: ConversationContext) => Promise<void>;
};

const EMPTY_COUNTS: UnreadCountsByContext = { general: 0, exercise: 0, nutrition: 0 };

const normalizeCount = (value: unknown): number => {
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? Math.max(0, Math.floor(parsed)) : 0;
};

const parseStoredCounts = (stored: null | string): UnreadCountsByContext => {
  if (!stored) {
    return EMPTY_COUNTS;
  }

  try {
    const parsed: unknown = JSON.parse(stored);

    // Legacy shape: a bare total, written before counts were split per context. Every writer that
    // could produce one targeted the exercise context (workout summaries), so attribute it there
    // instead of dropping the badge the user already has.
    if (typeof parsed === 'number') {
      return { ...EMPTY_COUNTS, exercise: normalizeCount(parsed) };
    }

    if (parsed && typeof parsed === 'object') {
      const record = parsed as Record<string, unknown>;
      return {
        general: normalizeCount(record.general),
        exercise: normalizeCount(record.exercise),
        nutrition: normalizeCount(record.nutrition),
      };
    }
  } catch {
    // Unparseable store (hand-edited, or written by a build that used another shape) — start clean.
  }

  return EMPTY_COUNTS;
};

const UnreadChatContext = createContext<UnreadChatContextType | undefined>(undefined);

export function UnreadChatProvider({ children }: { children: ReactNode }) {
  const [countsByContext, setCountsByContext] = useState<UnreadCountsByContext>(EMPTY_COUNTS);
  const countsRef = useRef(countsByContext);

  useEffect(() => {
    countsRef.current = countsByContext;
  }, [countsByContext]);

  useEffect(() => {
    if (isStaticExport) {
      return;
    }

    AsyncStorage.getItem(UNREAD_CHAT_MESSAGES_COUNT)
      .then((stored) => {
        if (stored) {
          const parsed = parseStoredCounts(stored);
          setCountsByContext(parsed);
          countsRef.current = parsed;
        }
      })
      .catch(() => {});
  }, []);

  const persistCounts = useCallback(async (counts: UnreadCountsByContext) => {
    countsRef.current = counts;
    setCountsByContext(counts);
    try {
      await AsyncStorage.setItem(UNREAD_CHAT_MESSAGES_COUNT, JSON.stringify(counts));
    } catch (error) {
      console.error('Error persisting unread count:', error);
    }
  }, []);

  const setUnreadCount = useCallback(
    (conversationContext: ConversationContext, countOrUpdater: SetUnreadCountArg) => {
      const newValue =
        typeof countOrUpdater === 'function'
          ? countOrUpdater(countsRef.current[conversationContext])
          : countOrUpdater;

      return persistCounts({
        ...countsRef.current,
        [conversationContext]: Math.max(0, newValue),
      });
    },
    [persistCounts]
  );

  const clearUnreadCount = useCallback(
    (conversationContext?: ConversationContext) =>
      persistCounts(
        conversationContext
          ? { ...countsRef.current, [conversationContext]: 0 }
          : { ...EMPTY_COUNTS }
      ),
    [persistCounts]
  );

  const unreadCount = useMemo(
    () =>
      CONVERSATION_CONTEXTS.reduce(
        (total, conversationContext) => total + countsByContext[conversationContext],
        0
      ),
    [countsByContext]
  );

  const value = useMemo(
    () => ({
      unreadCount,
      unreadCountsByContext: countsByContext,
      setUnreadCount,
      clearUnreadCount,
    }),
    [unreadCount, countsByContext, setUnreadCount, clearUnreadCount]
  );

  return <UnreadChatContext.Provider value={value}>{children}</UnreadChatContext.Provider>;
}

export function useUnreadChat(): UnreadChatContextType {
  const context = useContext(UnreadChatContext);
  if (context === undefined) {
    throw new Error('useUnreadChat must be used within an UnreadChatProvider');
  }
  return context;
}
