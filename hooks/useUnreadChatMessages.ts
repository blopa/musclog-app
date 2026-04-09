import { useUnreadChat } from '@/context/UnreadChatContext';

export function useUnreadChatMessages(): number {
  const { unreadCount } = useUnreadChat();

  return unreadCount;
}
