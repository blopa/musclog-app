import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, ReactNode, useCallback, useContext, useEffect, useState } from 'react';

import { UNREAD_CHAT_MESSAGES_COUNT } from '../constants/misc';

type UnreadChatContextType = {
  unreadCount: number;
  setUnreadCount: (count: number) => Promise<void>;
  clearUnreadCount: () => Promise<void>;
};

const UnreadChatContext = createContext<UnreadChatContextType | undefined>(undefined);

export function UnreadChatProvider({ children }: { children: ReactNode }) {
  const [unreadCount, setUnreadCountState] = useState(0);

  useEffect(() => {
    AsyncStorage.getItem(UNREAD_CHAT_MESSAGES_COUNT)
      .then((stored) => {
        if (stored) {
          setUnreadCountState(Math.max(0, parseInt(stored, 10) || 0));
        }
      })
      .catch(() => {});
  }, []);

  const setUnreadCount = useCallback(async (count: number) => {
    const value = Math.max(0, count);
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
