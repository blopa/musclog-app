import { useUnreadChat } from '../components/UnreadChatContext';

export function useUnreadChatMessages(): number {
  const { unreadCount } = useUnreadChat();

  return unreadCount;
}
