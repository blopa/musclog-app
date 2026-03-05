import { useEffect, useState } from 'react';

import {
  getUnreadCount,
  initUnreadCount,
  subscribeToUnreadCount,
} from '../utils/chatSessionStorage';

export function useUnreadChatMessages(): number {
  const [unreadCount, setUnreadCount] = useState(getUnreadCount);

  useEffect(() => {
    let cancelled = false;

    initUnreadCount().then(() => {
      if (!cancelled) {
        setUnreadCount(getUnreadCount());
      }
    });

    const unsubscribe = subscribeToUnreadCount(() => {
      setUnreadCount(getUnreadCount());
    });

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, []);

  return unreadCount;
}
