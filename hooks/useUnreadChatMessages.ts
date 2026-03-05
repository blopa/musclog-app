import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useState } from 'react';

import { UNREAD_CHAT_MESSAGES_COUNT } from '../constants/misc';

export function useUnreadChatMessages(): number {
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    const loadUnreadCount = async () => {
      try {
        const stored = await AsyncStorage.getItem(UNREAD_CHAT_MESSAGES_COUNT);
        const count = stored ? parseInt(stored, 10) : 0;
        setUnreadCount(count);
      } catch (error) {
        console.error('Error loading unread chat messages count:', error);
        setUnreadCount(0);
      }
    };

    loadUnreadCount();
  }, []);

  return unreadCount;
}
