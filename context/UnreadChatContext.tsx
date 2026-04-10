import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';

import { UNREAD_CHAT_MESSAGES_COUNT } from '@/constants/misc';
import { isStaticExport } from '@/constants/platform';

type SetUnreadCountArg = number | ((prev: number) => number);

type UnreadChatContextType = {
  unreadCount: number;
  setUnreadCount: (countOrUpdater: SetUnreadCountArg) => Promise<void>;
  clearUnreadCount: () => Promise<void>;
};

const UnreadChatContext = createContext<UnreadChatContextType | undefined>(undefined);

export function UnreadChatProvider({ children }: { children: ReactNode }) {
  const [unreadCount, setUnreadCountState] = useState(0);
  const unreadCountRef = useRef(unreadCount);

  useEffect(() => {
    unreadCountRef.current = unreadCount;
  }, [unreadCount]);

  useEffect(() => {
    if (isStaticExport) {
      return;
    }

    AsyncStorage.getItem(UNREAD_CHAT_MESSAGES_COUNT)
      .then((stored) => {
        if (stored) {
          const parsed = Math.max(0, parseInt(stored, 10) || 0);
          setUnreadCountState(parsed);
          unreadCountRef.current = parsed;
        }
      })
      .catch(() => {});
  }, []);

  const setUnreadCount = useCallback(async (countOrUpdater: SetUnreadCountArg) => {
    const newValue =
      typeof countOrUpdater === 'function'
        ? countOrUpdater(unreadCountRef.current)
        : countOrUpdater;
    const value = Math.max(0, newValue);
    unreadCountRef.current = value;
    setUnreadCountState(value);
    try {
      await AsyncStorage.setItem(UNREAD_CHAT_MESSAGES_COUNT, value.toString());
    } catch (error) {
      console.error('Error persisting unread count:', error);
    }
  }, []);

  const clearUnreadCount = useCallback(() => setUnreadCount(0), [setUnreadCount]);

  return (
    <UnreadChatContext.Provider value={{ unreadCount, setUnreadCount, clearUnreadCount }}>
      {children}
    </UnreadChatContext.Provider>
  );
}

export function useUnreadChat(): UnreadChatContextType {
  const context = useContext(UnreadChatContext);
  if (context === undefined) {
    throw new Error('useUnreadChat must be used within an UnreadChatProvider');
  }
  return context;
}
